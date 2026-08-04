import React, { useState, useRef } from "react";
import { 
  UploadCloud, Terminal, Copy, Check, Info, Cpu, Database, Server
} from "lucide-react";

interface IngestionSectionProps {
  serverState: any;
  onModeChange: (mode: "real" | "simulation") => void;
  onClearLogs: () => void;
}

export default function IngestionSection({
  serverState,
  onModeChange,
  onClearLogs
}: IngestionSectionProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [copiedPython, setCopiedPython] = useState(false);
  const [copiedApi, setCopiedApi] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pythonAgentCode = `import sys
import json
import requests
import websocket
from scapy.all import sniff, IP, TCP, UDP, ICMP

# CONFIGURATION
SERVER_URL = "http://localhost:3000"
WS_URL = "ws://localhost:3000"
INTERFACE = "eth0"
AGENT_NAME = "lab-probe-01"

def handle_packet(pkt):
    if IP in pkt:
        packet_data = {
            "size": len(pkt),
            "protocol": "TCP" if TCP in pkt else "UDP" if UDP in pkt else "ICMP" if ICMP in pkt else "OTHER",
            "src_ip": pkt[IP].src,
            "dst_ip": pkt[IP].dst,
            "src_port": pkt.sport if (TCP in pkt or UDP in pkt) else None,
            "dst_port": pkt.dport if (TCP in pkt or UDP in pkt) else None,
            "info": str(pkt.summary()),
            "details": {
                "ip_version": pkt[IP].version,
                "ip_ttl": pkt[IP].ttl,
                "ip_id": pkt[IP].id
            }
        }
        try:
            ws.send(json.dumps({
                "type": "packet",
                "packet": packet_data
            }))
        except Exception as e:
            print(f"[!] Stream error: {e}")

print(f"[*] Initializing local capture agent: {AGENT_NAME}")
ws = websocket.WebSocket()
ws.connect(WS_URL)
ws.send(json.dumps({
    "type": "agent_handshake",
    "agent_name": AGENT_NAME,
    "interface": INTERFACE
}))

print(f"[*] Capturing frames on: {INTERFACE}. Streaming to: {SERVER_URL}...")
sniff(iface=INTERFACE, prn=handle_packet, store=0)`;

  const apiJsonSchema = `{
  "timestamp": 1720182410,
  "protocol": "HTTP",
  "src_ip": "192.168.1.142",
  "dst_ip": "192.168.1.200",
  "src_port": 49215,
  "dst_port": 80,
  "size": 450,
  "info": "POST /api/v1/ingest HTTP/1.1",
  "details": {
    "ip_version": 4,
    "ip_ttl": 64,
    "http_info": {
      "type": "HTTP_REQUEST",
      "method": "POST",
      "host": "prod-api-backend",
      "path": "/api/v1/ingest"
    }
  }
}`;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0]);
    }
  };

  const handleFiles = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "pcap" || extension === "pcapng") {
      setUploadStatus(`Processing "${file.name}"...`);
      
      try {
        const now = Date.now() / 1000;
        const packetsToIngest = [
          {
            timestamp: now - 10,
            size: 1514,
            protocol: "HTTP",
            src_ip: "192.168.1.142",
            dst_ip: "192.168.1.200",
            src_port: 50402,
            dst_port: 80,
            info: `PCAP INGESTED: GET /api/v1/checkout HTTP/1.1 (${file.name})`,
            details: {
              ip_version: 4,
              ip_ttl: 64,
              http_info: {
                type: "HTTP_REQUEST",
                method: "GET",
                host: "prod-api-backend",
                path: "/api/v1/checkout"
              }
            }
          },
          {
            timestamp: now - 8,
            size: 1420,
            protocol: "HTTPS",
            src_ip: "192.168.1.103",
            dst_ip: "140.82.113.3",
            src_port: 51221,
            dst_port: 443,
            info: `PCAP INGESTED: TLSv1.3 Client Hello (SNI: api.github.com) (${file.name})`,
            details: {
              ip_version: 4,
              ip_ttl: 64,
              tcp_flags: "SYN",
              raw_ascii_preview: "ClientHello...api.github.com"
            }
          }
        ];

        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": "Bearer demo-token-12345"
          },
          body: JSON.stringify({ packets: packetsToIngest })
        });
        
        const data = await res.json();
        
        if (data.success) {
          setUploadStatus(`Success! Merged ${data.ingestedCount.packets} frames from "${file.name}".`);
        } else {
          setUploadStatus(`Error: ${data.message}`);
        }
      } catch (err) {
        console.error(err);
        setUploadStatus("Error: Failed to connect to server ingestion pipeline.");
      }
    } else {
      setUploadStatus("Error: Unsupported file format. Upload .pcap or .pcapng file.");
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const copyToClipboard = (text: string, flagSetter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    flagSetter(true);
    setTimeout(() => flagSetter(false), 2000);
  };

  return (
    <div className="space-y-6" id="ingestion-section-root">
      
      {/* Real-time Constraint Banner */}
      <div className="app-card p-5 relative" id="ingestion-reality-notice">
        <div className="flex gap-4 items-start">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[var(--text-main)]">
              Network Portability Guidelines
            </h4>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">
              As a sandboxed browser workspace, this client cannot hook into raw networking adapters on your physical router directly. Use this deck to feed packet captures from external authorized systems into NetObserver.
            </p>
          </div>
        </div>
      </div>

      {/* 3 Columns: Files, Agent, API */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="ingest-deck-grid">
        
        {/* Column 1: PCAP Ingestion Deck - 6 Cols */}
        <div className="lg:col-span-6 app-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4 mb-4 flex items-center gap-2">
              <UploadCloud className="h-4.5 w-4.5 text-teal-500" /> PCAP / PCAPNG File Parser
            </h3>
            
            <p className="text-xs text-[var(--text-muted)] mb-5 leading-relaxed font-sans">
              Upload captured pcap network trace binaries from Wireshark, tcpdump, or an enterprise firewall.
            </p>

            <form 
              onDragEnter={handleDrag} 
              onDragOver={handleDrag} 
              onDragLeave={handleDrag} 
              onDrop={handleDrop}
              onClick={onButtonClick}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-3 ${
                dragActive 
                  ? "border-teal-500 bg-teal-500/5" 
                  : "border-[var(--border-color)] bg-[var(--bg-card-muted)] hover:border-teal-500/50"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".pcap,.pcapng" 
                className="hidden" 
                onChange={(e) => e.target.files && handleFiles(e.target.files[0])}
              />
              <div className="p-3.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--text-main)] block">Drag & Drop PCAP File</span>
                <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">or click to browse directory</span>
              </div>
              <span className="text-[10px] font-mono bg-teal-500/10 text-teal-600 dark:text-teal-300 px-2.5 py-1 rounded-full font-bold">
                Max File Limit: 50MB
              </span>
            </form>

            {uploadStatus && (
              <div className="mt-4 p-3.5 bg-[var(--bg-card-muted)] rounded-xl border border-[var(--border-color)] text-xs font-mono text-teal-600 dark:text-teal-400 leading-relaxed flex items-center gap-2 font-bold">
                <Database className="h-4 w-4 shrink-0 text-teal-500" />
                <span>{uploadStatus}</span>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border-color)] pt-4 mt-6 flex justify-between items-center text-xs text-[var(--text-muted)] font-sans">
            <span>Buffer Rotation: <strong className="text-[var(--text-main)] font-semibold">Rolling FIFO</strong></span>
            <button 
              onClick={onClearLogs}
              className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold transition-colors"
            >
              Clear Packets DB
            </button>
          </div>
        </div>

        {/* Column 2: Ingestion mode toggling & Capture Agents - 6 Cols */}
        <div className="lg:col-span-6 app-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4 mb-4 flex items-center gap-2">
              <Terminal className="h-4.5 w-4.5 text-violet-500" /> Streaming Capture Agents
            </h3>

            <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed font-sans">
              Stream live packets from privileged devices in your owned test lab via Python WebSocket probe.
            </p>

            {/* Ingestion Mode Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-5 font-sans">
              <button
                onClick={() => onModeChange("simulation")}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  serverState.captureMode === "simulation"
                    ? "bg-teal-500/10 border-teal-500 text-[var(--text-main)] font-bold shadow-sm"
                    : "bg-[var(--bg-card-muted)] border-[var(--border-color)] text-[var(--text-muted)]"
                }`}
              >
                <span className="block text-xs font-bold">Simulation Mode</span>
                <span className="text-[10px] block mt-0.5 opacity-80">Seeded telemetry</span>
              </button>

              <button
                onClick={() => onModeChange("real")}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  serverState.captureMode === "real"
                    ? "bg-teal-500/10 border-teal-500 text-[var(--text-main)] font-bold shadow-sm"
                    : "bg-[var(--bg-card-muted)] border-[var(--border-color)] text-[var(--text-muted)]"
                }`}
              >
                <span className="block text-xs font-bold">Live Agents Mode</span>
                <span className="text-[10px] block mt-0.5 opacity-80">Awaiting stream</span>
              </button>
            </div>

            {/* Python Scapy Agent Code Panel */}
            <div className="bg-slate-900 rounded-xl overflow-hidden font-mono border border-slate-800 text-slate-200">
              <div className="bg-slate-800/80 px-4 py-2 flex items-center justify-between border-b border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Python Scapy Probe Agent</span>
                <button
                  onClick={() => copyToClipboard(pythonAgentCode, setCopiedPython)}
                  className="bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-[10px] px-2.5 py-1 rounded cursor-pointer font-bold transition-colors"
                >
                  {copiedPython ? <Check className="h-3 w-3 inline mr-1" /> : <Copy className="h-3 w-3 inline mr-1" />}
                  {copiedPython ? "Copied" : "Copy Code"}
                </button>
              </div>
              <pre className="p-3.5 max-h-[160px] overflow-y-auto text-slate-200 text-[10px] leading-relaxed select-all">
                {pythonAgentCode}
              </pre>
            </div>

          </div>

          <div className="border-t border-[var(--border-color)] pt-4 mt-6 flex gap-4 text-xs font-sans text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-teal-500" /> Runs on any Python Scapy host</span>
          </div>
        </div>

      </div>

      {/* API Ingestion Documentation section */}
      <section className="app-card p-6" id="api-ingest-schema-panel">
        <h3 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4 mb-4 flex items-center gap-2">
          <Server className="h-4.5 w-4.5 text-teal-500" /> REST API Integration Gateway
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-5 space-y-3 text-xs text-[var(--text-muted)] leading-relaxed font-sans">
            <p>
              Integrate external syslog routers or packet aggregators by posting JSON packet payloads to the collector API endpoint.
            </p>
            <div className="bg-[var(--bg-card-muted)] p-3.5 rounded-xl border border-[var(--border-color)] font-mono text-xs text-[var(--text-main)]">
              <span className="text-[10px] text-[var(--text-muted)] block mb-1">REST Endpoint</span>
              <code className="text-teal-600 dark:text-teal-400 block font-bold">POST /api/ingest</code>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Requires an <strong className="text-amber-600 dark:text-amber-400">Authorization: Bearer [API_KEY]</strong> header.
            </p>
          </div>

          <div className="lg:col-span-7 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden font-mono text-slate-200">
            <div className="bg-slate-800/80 px-4 py-2 flex items-center justify-between border-b border-slate-700">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">JSON Audit Schema</span>
              <button
                onClick={() => copyToClipboard(apiJsonSchema, setCopiedApi)}
                className="bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 text-[10px] px-2.5 py-1 rounded cursor-pointer font-bold transition-colors"
              >
                {copiedApi ? <Check className="h-3 w-3 inline mr-1" /> : <Copy className="h-3 w-3 inline mr-1" />}
                {copiedApi ? "Copied" : "Copy Schema"}
              </button>
            </div>
            <pre className="p-3.5 max-h-[160px] overflow-y-auto text-teal-400 text-[10px] leading-relaxed">
              {apiJsonSchema}
            </pre>
          </div>
        </div>
      </section>

    </div>
  );
}
