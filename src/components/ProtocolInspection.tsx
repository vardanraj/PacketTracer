import { useState, useMemo } from "react";
import { 
  CheckCircle, Info, Filter
} from "lucide-react";
import { Packet } from "../types";

interface ProtocolInspectionProps {
  packets: Packet[];
  onSelectPacket: (packet: Packet) => void;
}

export default function ProtocolInspection({
  packets,
  onSelectPacket
}: ProtocolInspectionProps) {
  const [activeTab, setActiveTab] = useState<"TCP" | "UDP" | "IP" | "HTTP" | "HTTPS">("TCP");

  // Filter packets by selected tab protocol
  const protocolPackets = useMemo(() => {
    return packets.filter(p => p.protocol.toUpperCase() === activeTab);
  }, [packets, activeTab]);

  // Calculations for specific protocol metrics
  const tcpMetrics = useMemo(() => {
    const synCount = packets.filter(p => p.details.tcp_flags?.includes("SYN")).length;
    const finCount = packets.filter(p => p.details.tcp_flags?.includes("FIN")).length;
    const rstCount = packets.filter(p => p.details.tcp_flags?.includes("RST")).length;
    return { synCount, finCount, rstCount };
  }, [packets]);

  const httpMetrics = useMemo(() => {
    const requests = packets.filter(p => p.details.http_info?.type === "HTTP_REQUEST");
    const responses = packets.filter(p => p.details.http_info?.type === "HTTP_RESPONSE");
    const errors = packets.filter(p => {
      const code = p.details.http_info?.status_code;
      return code && (code.startsWith("4") || code.startsWith("5"));
    });
    return { requests: requests.length, responses: responses.length, errors: errors.length };
  }, [packets]);

  return (
    <div className="space-y-6" id="protocol-inspection-root">
      
      {/* Protocol Tabs Selector */}
      <div className="app-card p-3 flex flex-wrap gap-2" id="protocol-tab-selector">
        {(["TCP", "UDP", "IP", "HTTP", "HTTPS"] as const).map((proto) => {
          const count = packets.filter(p => p.protocol.toUpperCase() === proto).length;
          const isActive = activeTab === proto;
          return (
            <button
              key={proto}
              onClick={() => setActiveTab(proto)}
              className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                isActive 
                  ? "bg-teal-600 text-white shadow-sm font-bold" 
                  : "bg-[var(--bg-card-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
              }`}
            >
              <span>{proto}</span>
              <span className={`text-[10px] px-1.5 py-0.2 font-mono rounded font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-[var(--border-color)] text-[var(--text-main)]"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Protocol Dashboard drill-down details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="protocol-inspection-deck">
        
        {/* Left Column: Tech Overview & Statistics cards - 4 Cols */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Header Description */}
          <div className="app-card p-6 space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4 flex items-center gap-2">
              <Info className="h-4 w-4 text-teal-500" /> Decoder Intel
            </h3>
            
            {activeTab === "TCP" && (
              <div className="space-y-3 text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                <p>
                  <strong className="text-[var(--text-main)]">Transmission Control Protocol (TCP)</strong> is a connection-oriented layer 4 protocol ensuring ordered delivery.
                </p>
                <div className="bg-[var(--bg-card-muted)] p-3 rounded-xl border border-[var(--border-color)] font-mono text-xs space-y-1 text-[var(--text-main)]">
                  <div className="flex justify-between"><span>SYN Flags:</span> <span className="text-teal-600 dark:text-teal-400 font-bold">{tcpMetrics.synCount}</span></div>
                  <div className="flex justify-between"><span>FIN Flags:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{tcpMetrics.finCount}</span></div>
                  <div className="flex justify-between"><span>RST Aborts:</span> <span className="text-rose-600 dark:text-rose-400 font-bold">{tcpMetrics.rstCount}</span></div>
                </div>
              </div>
            )}

            {activeTab === "UDP" && (
              <div className="space-y-3 text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                <p>
                  <strong className="text-[var(--text-main)]">User Datagram Protocol (UDP)</strong> is a lightweight, connectionless transport protocol for real-time streams.
                </p>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Ideal for DNS, DHCP, NTP, and real-time media streams. Zero handshake checks.
                </p>
              </div>
            )}

            {activeTab === "IP" && (
              <div className="space-y-3 text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                <p>
                  <strong className="text-[var(--text-main)]">Internet Protocol (IP)</strong> is the layer 3 foundation of routing and packet addressing.
                </p>
                <div className="bg-[var(--bg-card-muted)] p-3 rounded-xl border border-[var(--border-color)] font-mono text-xs space-y-1 text-[var(--text-main)]">
                  <div>Addressing Scheme: <strong className="text-violet-600 dark:text-violet-400">IPv4 Standard</strong></div>
                  <div>Hop Limit TTL Range: <strong className="text-teal-600 dark:text-teal-400">60 - 128</strong></div>
                </div>
              </div>
            )}

            {activeTab === "HTTP" && (
              <div className="space-y-3 text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                <p>
                  <strong className="text-[var(--text-main)]">Hypertext Transfer Protocol (HTTP)</strong> is a plain text layer 7 web application standard.
                </p>
                <div className="bg-[var(--bg-card-muted)] p-3 rounded-xl border border-[var(--border-color)] font-mono text-xs space-y-1 text-[var(--text-main)]">
                  <div className="flex justify-between"><span>Requests Audited:</span> <span className="text-teal-600 dark:text-teal-400 font-bold">{httpMetrics.requests}</span></div>
                  <div className="flex justify-between"><span>Responses Received:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{httpMetrics.responses}</span></div>
                  <div className="flex justify-between"><span>HTTP Errors:</span> <span className="text-rose-600 dark:text-rose-400 font-bold">{httpMetrics.errors}</span></div>
                </div>
              </div>
            )}

            {activeTab === "HTTPS" && (
              <div className="space-y-3 text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                <p>
                  <strong className="text-[var(--text-main)]">HTTPS (Encrypted TLS)</strong> wraps web content inside cryptographic security layers.
                </p>
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs leading-relaxed text-[var(--text-main)] font-mono">
                  <span className="text-rose-600 dark:text-rose-400 font-bold block mb-1">Payload Compliance</span>
                  HTTPS content remains encrypted. Collector extracts only SNI metadata and handshake hostnames.
                </div>
              </div>
            )}

          </div>

          {/* Standards Checklist */}
          <div className="app-card p-6">
            <h4 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-3 block">Decoding Engine Logs</h4>
            <div className="space-y-2 text-xs font-mono text-[var(--text-muted)]">
              <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Payload Length audited</div>
              <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Port-map matching complete</div>
              <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> CRC checksum validation active</div>
            </div>
          </div>

        </div>

        {/* Right Column: Log Streams Table - 8 Cols */}
        <div className="lg:col-span-8 app-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
              <h4 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <Filter className="h-4 w-4 text-teal-500" /> Decoded {activeTab} Streams
              </h4>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                {protocolPackets.length} Logs
              </span>
            </div>

            <div className="overflow-x-auto pr-1">
              <table className="w-full text-left border-collapse font-mono text-xs text-[var(--text-main)]">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] text-[11px] font-bold uppercase">
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Route</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Audit Information Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {protocolPackets.length > 0 ? (
                    protocolPackets.map((pkt) => (
                      <tr 
                        key={pkt.id}
                        onClick={() => onSelectPacket(pkt)}
                        className="hover:bg-[var(--bg-card-muted)] cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 text-teal-600 dark:text-teal-400 font-bold">#{pkt.id.slice(-4)}</td>
                        <td className="py-2.5 px-3 truncate max-w-[150px] font-semibold">
                          <span className="text-teal-600 dark:text-teal-400">{pkt.src_ip.split(".").pop()}</span>
                          <span className="text-[var(--text-subtle)] font-normal"> → </span>
                          <span className="text-violet-600 dark:text-violet-400">{pkt.dst_ip.split(".").pop()}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-muted)]">{pkt.size} B</td>
                        <td className="py-2.5 px-3 text-[var(--text-main)] truncate max-w-[280px]" title={pkt.info}>
                          {pkt.info}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[var(--text-muted)] text-xs font-mono">
                        No decoded {activeTab} streams buffered in memory.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] pt-3.5 mt-4 text-xs font-mono text-[var(--text-muted)] flex items-center justify-between">
            <span>Buffer Capacity: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">100% Stable</strong></span>
            <span>Click row to expand detailed headers</span>
          </div>
        </div>

      </div>

    </div>
  );
}
