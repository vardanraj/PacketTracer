/**
 * Agent Ingestion & Handshake Service
 * Manages connections and handles streamed telemetry payload validation from authorized 
 * local capture agents (e.g. privileged Python + Scapy / Npcap script running outside the browser).
 */
import { Packet } from "../../types.js";

export interface AgentCredentials {
  agentName: string;
  secretToken: string;
  authorizedSubnets: string[];
}

export interface AgentHeartbeat {
  agentId: string;
  activeInterfaces: string[];
  cpuUsage: number;
  memoryUsage: number;
}

/**
 * Validates the capture agent's security credentials and verifies its origin subnet.
 * 
 * TODO(agent): Integrate secure JWT or token authentication.
 * In a real production deployment:
 * 1. The agent initiates a WebSocket connection with an Authorization header/auth token.
 * 2. This helper decodes the token, validating against the active session/API keys database.
 * 3. Compares the remote socket IP address against the configured authorizedSubnets.
 */
export function authenticateCaptureAgent(
  credentials: AgentCredentials,
  remoteIpAddress: string
): boolean {
  console.log(`[Agent Service] Authenticating agent '${credentials.agentName}' from IP: ${remoteIpAddress}`);
  
  if (!credentials.secretToken || credentials.secretToken.length < 8) {
    console.warn("[Agent Service] Authentication failed: Weak or missing security token.");
    return false;
  }

  // Allow any local subnets for this sandbox network observability model
  const isAuthorizedSubnet = credentials.authorizedSubnets.some(subnet => {
    // Basic prefix matching or CIDR validation
    return remoteIpAddress.startsWith(subnet.replace(".0/24", "")) || remoteIpAddress === "127.0.0.1" || remoteIpAddress === "::1";
  });

  if (!isAuthorizedSubnet) {
    console.warn(`[Agent Service] Access denied: IP ${remoteIpAddress} is not in authorized subnets.`);
    return false;
  }

  return true;
}

/**
 * Normalizes, validates, and stores incoming live-streamed packet packets.
 * 
 * TODO(backend): Real-time ingestion pipelines could forward to a fast queue (e.g., Redis / Kafka)
 * to prevent Event Loop blocks before inserting to the permanent database.
 */
export function processAgentStreamedPacket(
  rawPacket: any
): Omit<Packet, "id"> {
  // Validate schema at the boundary
  if (!rawPacket.protocol || !rawPacket.src_ip || !rawPacket.dst_ip) {
    throw new Error("Invalid streamed packet payload: missing core headers.");
  }

  return {
    timestamp: rawPacket.timestamp || Date.now() / 1000,
    formatted_time: rawPacket.formatted_time || new Date().toISOString().replace("T", " ").slice(0, -5),
    size: Number(rawPacket.size) || 64,
    protocol: rawPacket.protocol,
    src_ip: rawPacket.src_ip,
    dst_ip: rawPacket.dst_ip,
    src_port: rawPacket.src_port !== undefined ? Number(rawPacket.src_port) : null,
    dst_port: rawPacket.dst_port !== undefined ? Number(rawPacket.dst_port) : null,
    info: rawPacket.info || `Agent Captured ${rawPacket.protocol} packet`,
    details: rawPacket.details || {}
  };
}
