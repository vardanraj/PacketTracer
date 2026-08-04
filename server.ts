import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { Packet, NetworkInterface, CaptureStats, ServerState, Device, Session, Alert } from "./src/types.js";
import { MOCK_DEVICES, MOCK_SESSIONS, MOCK_ALERTS, MOCK_PACKETS } from "./src/data/mockData.js";
import { authenticateCaptureAgent } from "./src/lib/services/agent-ingestion.js";

// Structured Logger
const Logger = {
  info: (msg: string, ctx?: any) => console.log(`[INFO] [${new Date().toISOString()}] ${msg}`, ctx ? JSON.stringify(ctx) : ""),
  warn: (msg: string, ctx?: any) => console.warn(`[WARN] [${new Date().toISOString()}] ${msg}`, ctx ? JSON.stringify(ctx) : ""),
  error: (msg: string, ctx?: any) => console.error(`[ERROR] [${new Date().toISOString()}] ${msg}`, ctx ? JSON.stringify(ctx) : "")
};

// Initialize Express and HTTP Server
const app = express();
const httpServer = createHttpServer(app);
const PORT = 3000;

app.use(express.json());

// CORS & Security Headers Middleware
app.use((req, res, next) => {
  const allowedOrigin = process.env.CLIENT_URL || "http://localhost:3000";
  const origin = req.headers.origin;
  
  if (origin && origin === allowedOrigin) {
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    res.header("Access-Control-Allow-Origin", allowedOrigin);
  }
  
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// In-Memory Rate Limiter Middleware
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 200; // Max 200 requests per minute

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const client = rateLimits.get(ip);
  
  if (!client || now > client.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  
  client.count++;
  if (client.count > RATE_LIMIT_MAX_REQUESTS) {
    Logger.warn(`Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }
  
  next();
}
app.use("/api", rateLimiter);

// Clean up expired rate limit entries every 10 minutes to avoid memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of rateLimits.entries()) {
    if (now > limit.resetTime) {
      rateLimits.delete(ip);
    }
  }
}, 600000);

// JWT-ready authentication hook (without implementing login system)
function authHook(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    // JWT validation logic can go here (e.g., jwt.verify(token))
    (req as any).user = { token, simulated: true, role: "operator" };
  }
  next();
}
app.use(authHook);

// Enforce real authentication for state-mutating API routes
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.API_TOKEN || "demo-token-12345";
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    Logger.warn(`Unauthenticated write request blocked: ${req.method} ${req.path}`);
    return res.status(401).json({ error: "Authentication required. Missing Bearer token." });
  }
  
  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    Logger.warn(`Unauthorized write request blocked (invalid token): ${req.method} ${req.path}`);
    return res.status(401).json({ error: "Unauthorized. Invalid Bearer token." });
  }
  
  next();
}

// In-Memory Databases seeded at boot
let packetsDb: Packet[] = [...MOCK_PACKETS];
let devicesDb: Device[] = [...MOCK_DEVICES];
let sessionsDb: Session[] = [...MOCK_SESSIONS];
let alertsDb: Alert[] = [...MOCK_ALERTS];

const MAX_PACKETS_RETENTION = 5000; // Limit memory usage
const MAX_SESSIONS_RETENTION = 1000;
const MAX_ALERTS_RETENTION = 1000;
const MAX_DEVICES_RETENTION = 1000;

// Server State
const state: ServerState = {
  isCapturing: true, // Start in capturing mode for simulation by default
  selectedInterface: "en0 (Wi-Fi)",
  captureMode: "simulation",
  connectedAgents: [],
};

// WebSocket Client Collections
const dashboardClients = new Set<WebSocket>();
const agentClients = new Map<WebSocket, { name: string; interface: string }>();

// Available Interfaces (Mock list representing typical network host interfaces)
const availableInterfaces: NetworkInterface[] = [
  { name: "en0 (Wi-Fi)", description: "Broadcom 802.11ac Wi-Fi Adapter", status: "up", type: "wifi", ip: "192.168.1.142" },
  { name: "eth0 (Ethernet)", description: "Intel Gigabit Ethernet Controller", status: "up", type: "ethernet", ip: "192.168.1.2" },
  { name: "lo0 (Loopback)", description: "Software Loopback Interface", status: "up", type: "loopback", ip: "127.0.0.1" },
  { name: "docker0 (Bridge)", description: "Docker Bridge Virtual Interface", status: "down", type: "virtual", ip: "172.17.0.1" },
];

// Helper to generate a unique packet ID
const generateId = () => Math.random().toString(36).substring(2, 11);

// Sanitize & Truncate helper to secure metadata against script injection and heavy payloads
function sanitizeString(str: string | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

function sanitizePacket(packet: Omit<Packet, "id">): Omit<Packet, "id"> {
  const sanitized = { ...packet };
  sanitized.info = sanitizeString(sanitized.info);
  sanitized.src_ip = sanitizeString(sanitized.src_ip);
  sanitized.dst_ip = sanitizeString(sanitized.dst_ip);
  
  if (sanitized.details) {
    const details = { ...sanitized.details };
    if (details.raw_hex_preview) {
      details.raw_hex_preview = sanitizeString(details.raw_hex_preview.substring(0, 128));
    }
    if (details.raw_ascii_preview) {
      details.raw_ascii_preview = sanitizeString(details.raw_ascii_preview.substring(0, 128));
    }
    if (details.http_info) {
      const http = { ...details.http_info };
      http.host = sanitizeString(http.host);
      http.path = sanitizeString(http.path);
      http.user_agent = sanitizeString(http.user_agent);
      details.http_info = http;
    }
    sanitized.details = details;
  }
  return sanitized;
}

// Helper to add packet and maintain database limit
function addPacket(packet: Omit<Packet, "id">): Packet {
  const sanitized = sanitizePacket(packet);
  const newPacket: Packet = {
    ...sanitized,
    id: generateId(),
  };
  
  packetsDb.unshift(newPacket); // Prepend new packet (newest first)
  
  // Apply retention policy rotation
  if (packetsDb.length > MAX_PACKETS_RETENTION) {
    packetsDb = packetsDb.slice(0, MAX_PACKETS_RETENTION);
  }
  
  return newPacket;
}

// SIMULATOR TRAFFIC GENERATOR
// Simulates highly realistic network traffic for demonstration / offline testing
const simulatedIps = [
  "192.168.1.142", // Local client (us)
  "192.168.1.1",   // Router / Gateway
  "8.8.8.8",       // Google DNS
  "140.82.113.3",  // GitHub
  "34.117.218.1",  // Google Cloud CDN
  "172.217.16.14", // YouTube
  "104.18.26.155", // Cloudflare DNS/CDN
  "192.168.1.105", // Smart TV
  "192.168.1.22",  // Smart Thermostat (IoT)
  "192.168.1.50",  // Local Network NAS File Server
];

const simulatedDomains = [
  "api.github.com",
  "google.com",
  "youtube.com",
  "cloudflare.com",
  "netflix.com",
  "weather-api.org",
  "pool.ntp.org"
];

let simulationInterval: NodeJS.Timeout | null = null;

function startSimulation() {
  if (simulationInterval) return;

  console.log("[*] Starting Packet Simulation Engine...");
  simulationInterval = setInterval(() => {
    if (!state.isCapturing || state.captureMode !== "simulation") return;

    // Determine how many packets to generate in this tick (bursts of 1-4 packets)
    const burstCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < burstCount; i++) {
      const protocols: Packet["protocol"][] = ["TCP", "UDP", "ICMP", "HTTP", "HTTPS", "DNS"];
      const protocol = protocols[Math.floor(Math.random() * protocols.length)];

      const isOutgoing = Math.random() > 0.4;
      const src_ip = isOutgoing ? "192.168.1.142" : simulatedIps[Math.floor(Math.random() * simulatedIps.length)];
      const dst_ip = isOutgoing ? simulatedIps[Math.floor(Math.random() * simulatedIps.length)] : "192.168.1.142";

      // Prevent identical source and destination
      if (src_ip === dst_ip) continue;

      let src_port: number | null = Math.floor(Math.random() * 55000) + 1024;
      let dst_port: number | null = Math.floor(Math.random() * 55000) + 1024;
      let size = Math.floor(Math.random() * 1400) + 64; // Ether payload sizes
      let info = "";
      const details: Packet["details"] = {};

      const now = new Date();
      const formatted_time = now.toISOString().replace("T", " ").replace("Z", "").slice(0, -1);

      switch (protocol) {
        case "HTTP":
          src_port = isOutgoing ? src_port : 80;
          dst_port = isOutgoing ? 80 : dst_port;
          const method = Math.random() > 0.8 ? "POST" : "GET";
          const host = simulatedDomains[Math.floor(Math.random() * simulatedDomains.length)];
          const path = method === "POST" ? "/api/v1/telemetry" : "/index.html?v=" + Math.floor(Math.random() * 1000);
          info = `HTTP ${method} ${host}${path}`;
          details.http_info = {
            type: isOutgoing ? "HTTP_REQUEST" : "HTTP_RESPONSE",
            method: isOutgoing ? method : undefined,
            host: host,
            path: path,
            status_code: isOutgoing ? undefined : "200",
            phrase: isOutgoing ? undefined : "OK",
            user_agent: isOutgoing ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" : undefined,
          };
          details.raw_ascii_preview = isOutgoing 
            ? `${method} ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0...\r\nAccept: */*\r\n\r\n`
            : `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 142\r\nServer: nginx\r\n\r\n{"status":"success","data":{}}`;
          break;

        case "HTTPS":
          src_port = isOutgoing ? src_port : 443;
          dst_port = isOutgoing ? 443 : dst_port;
          const hostHttps = simulatedDomains[Math.floor(Math.random() * simulatedDomains.length)];
          const isHandshake = Math.random() > 0.7;
          info = isHandshake ? `TLSv1.3 Handshake - Client Hello (SNI: ${hostHttps})` : `Application Data (Encrypted TLS Payload)`;
          details.tcp_flags = "PSH+ACK";
          details.raw_hex_preview = "16 03 01 02 00 01 00 01 fc 03 03 b2 d4 cd e3 98 d1 4a d1 ...";
          details.raw_ascii_preview = "...................ClientHello.SNI:" + hostHttps + ".......";
          break;

        case "DNS":
          src_port = isOutgoing ? src_port : 53;
          dst_port = isOutgoing ? 53 : dst_port;
          const queryDomain = simulatedDomains[Math.floor(Math.random() * simulatedDomains.length)];
          info = isOutgoing ? `Standard query 0x${Math.floor(Math.random() * 65535).toString(16)} A ${queryDomain}` : `Standard query response A ${queryDomain} IP 140.82.113.3`;
          details.udp_len = size - 28;
          break;

        case "TCP":
          // Random TCP traffic, flags syn/ack/rst
          const isSyn = Math.random() > 0.8;
          const isFin = !isSyn && Math.random() > 0.8;
          const tcpFlags = isSyn ? "SYN" : isFin ? "FIN+ACK" : "ACK";
          details.tcp_flags = tcpFlags;
          details.tcp_seq = Math.floor(Math.random() * 4000000000);
          details.tcp_ack = isSyn ? 0 : Math.floor(Math.random() * 4000000000);
          info = `Seq=${details.tcp_seq} Ack=${details.tcp_ack} Flags=[${tcpFlags}] Window=64240`;
          break;

        case "UDP":
          // UDP Media streaming or generic UDP payload
          src_port = isOutgoing ? 5004 : src_port; // RTP streaming port typically
          dst_port = isOutgoing ? dst_port : 5004;
          info = `UDP Payload size=${size} bytes`;
          details.udp_len = size - 28;
          details.raw_hex_preview = "a2 fc f0 d2 42 c3 45 61 72 84 f9 ca 10 32 4a c1 ...";
          break;

        case "ICMP":
          src_port = null;
          dst_port = null;
          const isRequest = Math.random() > 0.5;
          details.icmp_type = isRequest ? 8 : 0; // Echo request/reply
          details.icmp_code = 0;
          info = isRequest ? `Echo (ping) request id=0x1a4b seq=256 ttl=64` : `Echo (ping) reply id=0x1a4b seq=256 ttl=54`;
          break;
      }

      // Add fields
      details.ip_version = 4;
      details.ip_ttl = Math.floor(Math.random() * 64) + 60;
      details.ip_id = Math.floor(Math.random() * 65535);

      const packet = addPacket({
        timestamp: Date.now() / 1000,
        formatted_time,
        size,
        protocol,
        src_ip,
        dst_ip,
        src_port,
        dst_port,
        info,
        details,
      });

      // Broadcast to connected dashboard clients
      broadcastPacket(packet);
    }
  }, 350); // Generates packs every ~350ms
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("[-] Packet Simulation Engine Stopped.");
  }
}

// WebSocket batched packet broadcast buffer
let packetBroadcastQueue: Packet[] = [];
const BATCH_INTERVAL_MS = 150; // Batch broadcast every 150ms

// Batch broadcast interval timer
const broadcastInterval = setInterval(() => {
  if (packetBroadcastQueue.length === 0) return;
  
  // Backpressure safety check: take at most the latest 200 packets to send in a single batch
  const packetsToBroadcast = packetBroadcastQueue.slice(-200);
  packetBroadcastQueue = [];

  const payload = JSON.stringify({ type: "packet_batch", packets: packetsToBroadcast });

  dashboardClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      // Gracefully handle backpressure for slow client sockets (skip broadcast if bufferedAmount > 1MB)
      const buffered = (ws as any).bufferedAmount || 0;
      if (buffered > 1024 * 1024) {
        Logger.warn("Skipping packet batch broadcast to slow dashboard client to prevent memory overflow.");
        return;
      }
      try {
        ws.send(payload);
      } catch (err) {
        Logger.error("Error sending packet batch to dashboard client:", err);
      }
    }
  });
}, BATCH_INTERVAL_MS);

// WebSocket packet broadcast helper
function broadcastPacket(packet: Packet) {
  // Push packet to the broadcast batching queue
  packetBroadcastQueue.push(packet);
}

// Broadcast general status update to all connected dashboard client WebSockets
function broadcastStatus() {
  const payload = JSON.stringify({
    type: "status_update",
    status: {
      isCapturing: state.isCapturing,
      selectedInterface: state.selectedInterface,
      captureMode: state.captureMode,
      connectedAgents: Array.from(agentClients.values()).map(a => `${a.name} (${a.interface})`),
    }
  });
  dashboardClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
      } catch (err) {
        Logger.error("Error sending status update to dashboard client:", err);
      }
    }
  });
}

// Set up WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// Attach WS server upgrade logic
httpServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// WebSocket connection management with Heartbeat (ping/pong)
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const socket = ws as any;
    if (socket.isAlive === false) {
      Logger.info("Terminating unresponsive, dead WebSocket connection.");
      return ws.terminate();
    }
    socket.isAlive = false;
    try {
      ws.ping();
    } catch (e) {
      Logger.error("Failed to ping client socket, terminating connection.", e);
      ws.terminate();
    }
  });
}, 30000);

wss.on("connection", (ws) => {
  Logger.info("New WebSocket connection established.");
  
  const socket = ws as any;
  socket.isAlive = true;
  
  ws.on("pong", () => {
    socket.isAlive = true;
  });

  // By default, add to dashboard subscriptions until registered as an agent
  dashboardClients.add(ws);

  ws.on("message", (message) => {
    try {
      // Validate incoming message structure
      const rawData = message.toString();
      if (!rawData || rawData.length > 100000) {
        Logger.warn("Blocked excessively large incoming WebSocket message payload.");
        return;
      }

      const data = JSON.parse(rawData);
      if (!data || typeof data !== "object" || !data.type) {
        Logger.warn("Ignored invalid WebSocket message schema received.");
        return;
      }

      // 1. Handshake from the Python Capture Agent
      if (data.type === "agent_handshake") {
        const agentName = sanitizeString(data.agent_name || "Python Capture Agent");
        const agentInterface = sanitizeString(data.interface || "unknown");
        const secretToken = sanitizeString(data.token || data.agent_token || "");
        
        const remoteIp = (ws as any)._socket?.remoteAddress || "127.0.0.1";
        const isAuth = authenticateCaptureAgent({
          agentName,
          secretToken,
          authorizedSubnets: ["127.0.0.1", "::1", "192.168.1.0/24", "10.0.0.0/8"]
        }, remoteIp);

        const expectedToken = process.env.API_TOKEN || "demo-token-12345";
        if (!isAuth || secretToken !== expectedToken) {
          Logger.warn(`Capture Agent Handshake authentication failed for: ${agentName}`);
          ws.send(JSON.stringify({ type: "error", message: "Handshake authentication failed: Invalid or missing secret token." }));
          ws.close(4001, "Invalid token");
          return;
        }
        
        Logger.info(`Registering Capture Agent: ${agentName} on interface ${agentInterface}`);
        
        // Remove from dashboard clients, add to agent map
        dashboardClients.delete(ws);
        agentClients.set(ws, {
          name: agentName,
          interface: agentInterface
        });
        
        state.connectedAgents = Array.from(agentClients.values()).map(a => `${a.name} (${a.interface})`);
        
        // If an agent joins, switch the capture mode to 'real' if in default simulation
        if (state.captureMode === "simulation") {
          state.captureMode = "real";
          stopSimulation();
        }
        
        broadcastStatus();
        return;
      }

      // 2. Streamed packet from registered Python Capture Agent
      if (data.type === "packet" && agentClients.has(ws)) {
        if (!data.packet || typeof data.packet !== "object") {
          Logger.warn("Received malformed packet from capture agent, discarding.");
          return;
        }
        // Enqueue to db and broadcast to all frontend dashboards
        const storedPacket = addPacket(data.packet);
        broadcastPacket(storedPacket);
        return;
      }

    } catch (e) {
      Logger.error("Failed to parse/validate incoming WebSocket message:", e);
    }
  });

  ws.on("close", (code, reason) => {
    if (agentClients.has(ws)) {
      const agent = agentClients.get(ws);
      Logger.info(`Capture Agent disconnected: ${agent?.name}`);
      agentClients.delete(ws);
      state.connectedAgents = Array.from(agentClients.values()).map(a => `${a.name} (${a.interface})`);
      
      // If we lose real agent, switch back to simulation so visual graph stays active
      if (agentClients.size === 0) {
        state.captureMode = "simulation";
        if (state.isCapturing) {
          startSimulation();
        }
      }
      broadcastStatus();
    } else {
      Logger.info("Dashboard client disconnected.");
      dashboardClients.delete(ws);
    }
  });

  ws.on("error", (err) => {
    Logger.error("WebSocket socket error occurred:", err);
  });
});

// REST API ENDPOINTS
// GET /api/status - Current capture state
app.get("/api/status", (req, res) => {
  res.json({
    isCapturing: state.isCapturing,
    selectedInterface: state.selectedInterface,
    captureMode: state.captureMode,
    connectedAgents: Array.from(agentClients.values()).map(a => `${a.name} (${a.interface})`),
  });
});

// GET /api/interfaces - List interfaces
app.get("/api/interfaces", (req, res) => {
  res.json(availableInterfaces);
});

// GET /api/devices - Get all devices
app.get("/api/devices", (req, res) => {
  res.json(devicesDb);
});

// GET /api/devices/:id - Get device by ID
app.get("/api/devices/:id", (req, res) => {
  const device = devicesDb.find(d => d.id === req.params.id);
  if (!device) {
    return res.status(404).json({ error: "Device not found" });
  }
  res.json(device);
});

// POST /api/devices - Create/Add device
app.post("/api/devices", requireAuth, (req, res) => {
  const { hostname, ipAddress, macAddress, status, tags } = req.body;
  if (!hostname || !ipAddress || !macAddress) {
    return res.status(400).json({ error: "Missing required fields: hostname, ipAddress, macAddress" });
  }
  const newDevice: Device = {
    id: `dev-${generateId()}`,
    hostname: sanitizeString(hostname),
    ipAddress: sanitizeString(ipAddress),
    macAddress: sanitizeString(macAddress),
    status: status || "online",
    tags: Array.isArray(tags) ? tags.map(sanitizeString) : []
  };
  devicesDb.push(newDevice);
  if (devicesDb.length > MAX_DEVICES_RETENTION) {
    devicesDb = devicesDb.slice(-MAX_DEVICES_RETENTION);
  }
  res.status(201).json(newDevice);
});

// GET /api/sessions - Get all sessions
app.get("/api/sessions", (req, res) => {
  res.json(sessionsDb);
});

// GET /api/sessions/:id - Get session by ID
app.get("/api/sessions/:id", (req, res) => {
  const session = sessionsDb.find(s => s.id === req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

// POST /api/sessions - Create/Add session
app.post("/api/sessions", requireAuth, (req, res) => {
  const { sourceDevice, destinationDevice, protocol, sourceIp, destinationIp, sourcePort, destinationPort, status, packetCount, bytesTransferred } = req.body;
  if (!sourceDevice || !destinationDevice || !protocol || !sourceIp || !destinationIp) {
    return res.status(400).json({ error: "Missing required session fields" });
  }
  const newSession: Session = {
    id: `sess-${generateId()}`,
    sourceDevice: sanitizeString(sourceDevice),
    destinationDevice: sanitizeString(destinationDevice),
    protocol: sanitizeString(protocol),
    sourceIp: sanitizeString(sourceIp),
    destinationIp: sanitizeString(destinationIp),
    sourcePort: typeof sourcePort === "number" ? sourcePort : null,
    destinationPort: typeof destinationPort === "number" ? destinationPort : null,
    startTime: Math.floor(Date.now() / 1000),
    status: status || "active",
    packetCount: typeof packetCount === "number" ? packetCount : 0,
    bytesTransferred: typeof bytesTransferred === "number" ? bytesTransferred : 0
  };
  sessionsDb.push(newSession);
  if (sessionsDb.length > MAX_SESSIONS_RETENTION) {
    sessionsDb = sessionsDb.slice(-MAX_SESSIONS_RETENTION);
  }
  res.status(201).json(newSession);
});

// GET /api/alerts - Get all alerts
app.get("/api/alerts", (req, res) => {
  res.json(alertsDb);
});

// GET /api/alerts/:id - Get alert by ID
app.get("/api/alerts/:id", (req, res) => {
  const alert = alertsDb.find(a => a.id === req.params.id);
  if (!alert) {
    return res.status(404).json({ error: "Alert not found" });
  }
  res.json(alert);
});

// POST /api/alerts - Create/Add alert
app.post("/api/alerts", requireAuth, (req, res) => {
  const { type, severity, title, description, relatedSessionId } = req.body;
  if (!type || !severity || !title || !description) {
    return res.status(400).json({ error: "Missing required alert fields" });
  }
  const newAlert: Alert = {
    id: `alt-${generateId()}`,
    type: sanitizeString(type),
    severity,
    title: sanitizeString(title),
    description: sanitizeString(description),
    timestamp: Math.floor(Date.now() / 1000),
    relatedSessionId: relatedSessionId ? sanitizeString(relatedSessionId) : undefined,
    acknowledged: false
  };
  alertsDb.push(newAlert);
  if (alertsDb.length > MAX_ALERTS_RETENTION) {
    alertsDb = alertsDb.slice(-MAX_ALERTS_RETENTION);
  }
  res.status(201).json(newAlert);
});

// POST /api/alerts/:id/acknowledge - Acknowledge alert
app.post("/api/alerts/:id/acknowledge", requireAuth, (req, res) => {
  const alert = alertsDb.find(a => a.id === req.params.id);
  if (!alert) {
    return res.status(404).json({ error: "Alert not found" });
  }
  alert.acknowledged = true;
  res.json({ success: true, alert });
});

// POST /api/alerts/clear - Clear threat logs database
app.post("/api/alerts/clear", requireAuth, (req, res) => {
  alertsDb = [];
  res.json({ success: true });
});

// GET /api/reports - Aggregated summary report data with support for query params
app.get("/api/reports", (req, res) => {
  const { startDate, endDate, protocol, device } = req.query;

  let startTs = startDate ? parseFloat(startDate as string) : 0;
  let endTs = endDate ? parseFloat(endDate as string) : Math.floor(Date.now() / 1000);

  let filteredPackets = [...packetsDb];

  // Date range filter
  if (startDate || endDate) {
    filteredPackets = filteredPackets.filter(p => p.timestamp >= startTs && p.timestamp <= endTs);
  }

  // Protocol filter
  if (protocol && protocol !== "ALL") {
    filteredPackets = filteredPackets.filter(p => p.protocol.toUpperCase() === (protocol as string).toUpperCase());
  }

  // Device IP filter
  if (device) {
    const devIp = device as string;
    filteredPackets = filteredPackets.filter(p => p.src_ip === devIp || p.dst_ip === devIp);
  }

  // Aggregate metrics
  const totalPackets = filteredPackets.length;
  const totalBytes = filteredPackets.reduce((sum, p) => sum + p.size, 0);

  const protocolMap: { [key: string]: number } = {};
  filteredPackets.forEach(p => {
    protocolMap[p.protocol] = (protocolMap[p.protocol] || 0) + 1;
  });

  const criticalAlerts = alertsDb.filter(a => a.severity === "critical").length;
  const highAlerts = alertsDb.filter(a => a.severity === "high").length;
  let complianceRating = "A - NOMINAL SECURE";
  if (criticalAlerts > 0) complianceRating = "C - RESTRICTED";
  else if (highAlerts > 0) complianceRating = "B - DEVIANT";

  res.json({
    generatedAt: new Date().toISOString(),
    totalPackets,
    totalBytes,
    complianceRating,
    protocolUsage: protocolMap,
    alertsCount: alertsDb.length,
    activeSessionsCount: sessionsDb.filter(s => s.status === "active").length,
    scannedTimeRange: { start: startTs, end: endTs }
  });
});

// POST /api/ingest - Ingestion endpoint for uploaded PCAP or JSON metadata payloads
app.post("/api/ingest", requireAuth, (req, res) => {
  const { packets, sessions, devices, alerts } = req.body;
  
  let addedPackets: Packet[] = [];
  let addedSessions: Session[] = [];
  let addedDevices: Device[] = [];
  let addedAlerts: Alert[] = [];

  if (devices && Array.isArray(devices)) {
    devices.forEach((d: any) => {
      if (d.hostname && d.ipAddress && d.macAddress) {
        const newD: Device = {
          id: d.id || `dev-${generateId()}`,
          hostname: sanitizeString(d.hostname),
          ipAddress: sanitizeString(d.ipAddress),
          macAddress: sanitizeString(d.macAddress),
          status: d.status || "online",
          tags: Array.isArray(d.tags) ? d.tags.map(sanitizeString) : []
        };
        devicesDb.push(newD);
        addedDevices.push(newD);
      }
    });
    if (devicesDb.length > MAX_DEVICES_RETENTION) {
      devicesDb = devicesDb.slice(-MAX_DEVICES_RETENTION);
    }
  }

  if (sessions && Array.isArray(sessions)) {
    sessions.forEach((s: any) => {
      if (s.sourceDevice && s.destinationDevice && s.protocol && s.sourceIp && s.destinationIp) {
        const newS: Session = {
          id: s.id || `sess-${generateId()}`,
          sourceDevice: sanitizeString(s.sourceDevice),
          destinationDevice: sanitizeString(s.destinationDevice),
          protocol: sanitizeString(s.protocol),
          sourceIp: sanitizeString(s.sourceIp),
          destinationIp: sanitizeString(s.destinationIp),
          sourcePort: s.sourcePort || null,
          destinationPort: s.destinationPort || null,
          startTime: s.startTime || Math.floor(Date.now() / 1000),
          endTime: s.endTime,
          packetCount: s.packetCount || 0,
          bytesTransferred: s.bytesTransferred || 0,
          status: s.status || "active"
        };
        sessionsDb.push(newS);
        addedSessions.push(newS);
      }
    });
    if (sessionsDb.length > MAX_SESSIONS_RETENTION) {
      sessionsDb = sessionsDb.slice(-MAX_SESSIONS_RETENTION);
    }
  }

  if (packets && Array.isArray(packets)) {
    packets.forEach((p: any) => {
      if (p.protocol && p.src_ip && p.dst_ip) {
        const storedP = addPacket({
          timestamp: p.timestamp || Date.now() / 1000,
          formatted_time: p.formatted_time || new Date().toISOString().replace("T", " ").slice(0, -5),
          size: p.size || 64,
          protocol: p.protocol,
          src_ip: p.src_ip,
          dst_ip: p.dst_ip,
          src_port: p.src_port || null,
          dst_port: p.dst_port || null,
          info: p.info || `${p.protocol} Packet`,
          details: p.details || {}
        });
        addedPackets.push(storedP);
        broadcastPacket(storedP);
      }
    });
  }

  if (alerts && Array.isArray(alerts)) {
    alerts.forEach((a: any) => {
      if (a.type && a.severity && a.title && a.description) {
        const newA: Alert = {
          id: a.id || `alt-${generateId()}`,
          type: sanitizeString(a.type),
          severity: a.severity,
          title: sanitizeString(a.title),
          description: sanitizeString(a.description),
          timestamp: a.timestamp || Math.floor(Date.now() / 1000),
          relatedSessionId: a.relatedSessionId ? sanitizeString(a.relatedSessionId) : undefined,
          acknowledged: false
        };
        alertsDb.push(newA);
        addedAlerts.push(newA);
      }
    });
    if (alertsDb.length > MAX_ALERTS_RETENTION) {
      alertsDb = alertsDb.slice(-MAX_ALERTS_RETENTION);
    }
  }

  res.json({
    success: true,
    message: "Data successfully ingested and normalized into memory database schemas.",
    ingestedCount: {
      devices: addedDevices.length,
      sessions: addedSessions.length,
      packets: addedPackets.length,
      alerts: addedAlerts.length
    }
  });
});

// GET /api/packets - Paginated query for historical packets
app.get("/api/packets", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  const protocol = req.query.protocol as string;
  const sessionId = req.query.sessionId as string;
  const search = (req.query.search as string)?.toLowerCase();

  let filtered = [...packetsDb];

  if (protocol && protocol !== "ALL") {
    filtered = filtered.filter(p => p.protocol.toUpperCase() === protocol.toUpperCase());
  }

  if (sessionId) {
    // Attempt to match by matching IP/ports of corresponding session
    const session = sessionsDb.find(s => s.id === sessionId);
    if (session) {
      filtered = filtered.filter(p => 
        (p.src_ip === session.sourceIp && p.dst_ip === session.destinationIp && p.src_port === session.sourcePort && p.dst_port === session.destinationPort) ||
        (p.src_ip === session.destinationIp && p.dst_ip === session.sourceIp && p.src_port === session.destinationPort && p.dst_port === session.sourcePort)
      );
    }
  }

  if (search) {
    filtered = filtered.filter(p => 
      p.src_ip.toLowerCase().includes(search) ||
      p.dst_ip.toLowerCase().includes(search) ||
      p.info.toLowerCase().includes(search) ||
      p.src_port?.toString().includes(search) ||
      p.dst_port?.toString().includes(search)
    );
  }

  const paginated = filtered.slice(offset, offset + limit);

  res.json({
    packets: paginated,
    total: filtered.length,
    offset,
    limit
  });
});

// POST /api/packets/clear - Clear capture database
app.post("/api/packets/clear", requireAuth, (req, res) => {
  packetsDb = [];
  res.json({ success: true, message: "Logs cleared" });
});

// POST /api/capture/start - Start capture
app.post("/api/capture/start", requireAuth, (req, res) => {
  const { interfaceName, mode } = req.body;
  
  state.isCapturing = true;
  if (interfaceName) state.selectedInterface = interfaceName;
  if (mode) state.captureMode = mode;

  if (state.captureMode === "simulation") {
    startSimulation();
  } else {
    stopSimulation(); // Rely on external python agent streaming
  }

  broadcastStatus();
  res.json({ success: true, state });
});

// POST /api/capture/stop - Stop capture
app.post("/api/capture/stop", requireAuth, (req, res) => {
  state.isCapturing = false;
  stopSimulation();
  broadcastStatus();
  res.json({ success: true, state });
});

// GET /api/stats - Real-time stats calculations
app.get("/api/stats", (req, res) => {
  const totalPackets = packetsDb.length;
  let totalBytes = 0;

  const protocolMap = new Map<string, { count: number; bytes: number }>();
  const sourceMap = new Map<string, { count: number; bytes: number }>();
  const destMap = new Map<string, { count: number; bytes: number }>();
  
  const buckets: { [key: string]: { bytes: number; packets: number } } = {};
  const nowSecs = Math.floor(Date.now() / 1000);

  // Initialize last 6 buckets of 5 seconds each
  for (let idx = 5; idx >= 0; idx--) {
    const t = nowSecs - (idx * 5);
    const dateStr = new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    buckets[dateStr] = { bytes: 0, packets: 0 };
  }

  // Single-pass loop to calculate all metrics
  packetsDb.forEach(p => {
    const size = p.size;
    totalBytes += size;

    // Protocol breakdown
    const protoStat = protocolMap.get(p.protocol) || { count: 0, bytes: 0 };
    protoStat.count++;
    protoStat.bytes += size;
    protocolMap.set(p.protocol, protoStat);

    // Top sources
    const srcStat = sourceMap.get(p.src_ip) || { count: 0, bytes: 0 };
    srcStat.count++;
    srcStat.bytes += size;
    sourceMap.set(p.src_ip, srcStat);

    // Top destinations
    const dstStat = destMap.get(p.dst_ip) || { count: 0, bytes: 0 };
    dstStat.count++;
    dstStat.bytes += size;
    destMap.set(p.dst_ip, dstStat);

    // Bandwidth over time buckets
    const pSecs = Math.floor(p.timestamp);
    const bucketSecs = pSecs - (pSecs % 5);
    const dateStr = new Date(bucketSecs * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (buckets[dateStr] !== undefined) {
      buckets[dateStr].bytes += size;
      buckets[dateStr].packets++;
    }
  });

  const protocolBreakdown = Array.from(protocolMap.entries()).map(([protocol, stat]) => ({
    protocol,
    count: stat.count,
    bytes: stat.bytes
  }));

  const topSources = Array.from(sourceMap.entries())
    .map(([ip, stat]) => ({ ip, count: stat.count, bytes: stat.bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topDestinations = Array.from(destMap.entries())
    .map(([ip, stat]) => ({ ip, count: stat.count, bytes: stat.bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const bandwidthOverTime = Object.entries(buckets).map(([time, val]) => ({
    time,
    bytes: val.bytes,
    packets: val.packets
  }));

  // Calculate current Rates (BPS / PPS) based on the last 5 seconds
  const currentIntervalBucket = bandwidthOverTime[bandwidthOverTime.length - 1];
  const packetsPerSecond = currentIntervalBucket ? Math.round(currentIntervalBucket.packets / 5) : 0;
  const bytesPerSecond = currentIntervalBucket ? Math.round(currentIntervalBucket.bytes / 5) : 0;

  res.json({
    totalPackets,
    totalBytes,
    packetsPerSecond,
    bytesPerSecond,
    protocolBreakdown,
    topSources,
    topDestinations,
    bandwidthOverTime
  });
});

// GET /api/telemetry - Unified dashboard telemetry endpoint to prevent redundant polling
app.get("/api/telemetry", (req, res) => {
  const totalPackets = packetsDb.length;
  let totalBytes = 0;

  const protocolMap = new Map<string, { count: number; bytes: number }>();
  const sourceMap = new Map<string, { count: number; bytes: number }>();
  const destMap = new Map<string, { count: number; bytes: number }>();
  
  const buckets: { [key: string]: { bytes: number; packets: number } } = {};
  const nowSecs = Math.floor(Date.now() / 1000);

  for (let idx = 5; idx >= 0; idx--) {
    const t = nowSecs - (idx * 5);
    const dateStr = new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    buckets[dateStr] = { bytes: 0, packets: 0 };
  }

  packetsDb.forEach(p => {
    const size = p.size;
    totalBytes += size;

    const protoStat = protocolMap.get(p.protocol) || { count: 0, bytes: 0 };
    protoStat.count++;
    protoStat.bytes += size;
    protocolMap.set(p.protocol, protoStat);

    const srcStat = sourceMap.get(p.src_ip) || { count: 0, bytes: 0 };
    srcStat.count++;
    srcStat.bytes += size;
    sourceMap.set(p.src_ip, srcStat);

    const dstStat = destMap.get(p.dst_ip) || { count: 0, bytes: 0 };
    dstStat.count++;
    dstStat.bytes += size;
    destMap.set(p.dst_ip, dstStat);

    const pSecs = Math.floor(p.timestamp);
    const bucketSecs = pSecs - (pSecs % 5);
    const dateStr = new Date(bucketSecs * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (buckets[dateStr] !== undefined) {
      buckets[dateStr].bytes += size;
      buckets[dateStr].packets++;
    }
  });

  const protocolBreakdown = Array.from(protocolMap.entries()).map(([protocol, stat]) => ({
    protocol,
    count: stat.count,
    bytes: stat.bytes
  }));

  const topSources = Array.from(sourceMap.entries())
    .map(([ip, stat]) => ({ ip, count: stat.count, bytes: stat.bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topDestinations = Array.from(destMap.entries())
    .map(([ip, stat]) => ({ ip, count: stat.count, bytes: stat.bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const bandwidthOverTime = Object.entries(buckets).map(([time, val]) => ({
    time,
    bytes: val.bytes,
    packets: val.packets
  }));

  const currentIntervalBucket = bandwidthOverTime[bandwidthOverTime.length - 1];
  const packetsPerSecond = currentIntervalBucket ? Math.round(currentIntervalBucket.packets / 5) : 0;
  const bytesPerSecond = currentIntervalBucket ? Math.round(currentIntervalBucket.bytes / 5) : 0;

  const stats = {
    totalPackets,
    totalBytes,
    packetsPerSecond,
    bytesPerSecond,
    protocolBreakdown,
    topSources,
    topDestinations,
    bandwidthOverTime
  };

  const status = {
    isCapturing: state.isCapturing,
    selectedInterface: state.selectedInterface,
    captureMode: state.captureMode,
    connectedAgents: Array.from(agentClients.values()).map(a => `${a.name} (${a.interface})`),
  };

  res.json({
    status,
    devices: devicesDb,
    sessions: sessionsDb,
    alerts: alertsDb,
    stats
  });
});

// Kick off simulation immediately if we are in simulation mode
startSimulation();

// VITE MIDDLEWARE SETUP
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development server with Vite Hot Module Replacement (though HMR is off, asset serving is handled)
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serving built production resources
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[+] Dashboard Web & API server running on http://0.0.0.0:${PORT}`);
    console.log(`[+] Real-time packet streaming WebSocket server ready.`);
  });
}

startServer();
