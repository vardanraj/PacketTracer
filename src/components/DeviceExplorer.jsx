import { useState, useMemo } from "react";
import { 
  ArrowRight, Network, Clock
} from "lucide-react";

export default function DeviceExplorer({
  devices,
  sessions,
  packets
}) {
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [selectedDest, setSelectedDest] = useState("ALL");
  const [selectedProto, setSelectedProto] = useState("ALL");

  // Filter sessions based on selections
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const srcMatch = selectedSource === "ALL" || 
        session.sourceDevice === selectedSource || 
        session.sourceIp === selectedSource;
      const dstMatch = selectedDest === "ALL" || 
        session.destinationDevice === selectedDest || 
        session.destinationIp === selectedDest;
      const protoMatch = selectedProto === "ALL" || 
        session.protocol.toUpperCase() === selectedProto.toUpperCase();
      
      return srcMatch && dstMatch && protoMatch;
    });
  }, [sessions, selectedSource, selectedDest, selectedProto]);

  // Generate conversation timeline from packets matching source & dest
  const conversationTimeline = useMemo(() => {
    return packets.filter(pkt => {
      const isDirectFlow = (selectedSource === "ALL" || pkt.src_ip === selectedSource) && 
                           (selectedDest === "ALL" || pkt.dst_ip === selectedDest);
      const isReverseFlow = (selectedSource === "ALL" || pkt.dst_ip === selectedSource) && 
                            (selectedDest === "ALL" || pkt.src_ip === selectedDest);
      
      const protoMatch = selectedProto === "ALL" || pkt.protocol.toUpperCase() === selectedProto.toUpperCase();
      
      return (isDirectFlow || isReverseFlow) && protoMatch;
    }).slice(0, 15);
  }, [packets, selectedSource, selectedDest, selectedProto]);

  return (
    <div className="space-y-6" id="device-explorer-root">
      
      {/* Selector Cards */}
      <div className="app-card p-6" id="device-selector-bar">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
          <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <Network className="h-4.5 w-4.5 text-teal-500" /> Flow Compass & Topology Filter
          </h3>
          <span className="text-xs text-[var(--text-muted)] font-mono">Conversation Streams</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
          {/* Source System */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Source Node</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs rounded-lg px-3 py-2 text-[var(--text-main)] focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Devices / Any IP</option>
              {devices.map(d => (
                <option key={d.id} value={d.ipAddress}>
                  {d.hostname} ({d.ipAddress})
                </option>
              ))}
            </select>
          </div>

          {/* Destination System */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Destination Node</label>
            <select
              value={selectedDest}
              onChange={(e) => setSelectedDest(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs rounded-lg px-3 py-2 text-[var(--text-main)] focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Devices / Any IP</option>
              {devices.map(d => (
                <option key={d.id} value={d.ipAddress}>
                  {d.hostname} ({d.ipAddress})
                </option>
              ))}
            </select>
          </div>

          {/* Transport Protocol */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Protocol</label>
            <select
              value={selectedProto}
              onChange={(e) => setSelectedProto(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs rounded-lg px-3 py-2 text-[var(--text-main)] focus:outline-none cursor-pointer font-medium"
            >
              <option value="ALL">All Decoded Protocols</option>
              <option value="TCP">TCP (Transmission Control)</option>
              <option value="UDP">UDP (User Datagram)</option>
              <option value="HTTP">HTTP (Plain Web Service)</option>
              <option value="HTTPS">HTTPS (Encrypted TLS)</option>
              <option value="DNS">DNS (Domain Core Name)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sessions List & Timeline Cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="device-flows-timeline-deck">
        
        {/* Sessions Matrix List - 7 Cols */}
        <div className="lg:col-span-7 app-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
              <h4 className="text-sm font-bold text-[var(--text-main)]">
                Active Sessions Matrix
              </h4>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                {filteredSessions.length} Connection Flows
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => (
                  <div 
                    key={session.id}
                    className="bg-[var(--bg-card-muted)] border border-[var(--border-color)] rounded-xl p-3 flex items-center justify-between gap-4 font-sans"
                  >
                    {/* Source and Dest details */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-[var(--text-main)]">
                        <span className="text-xs font-bold truncate max-w-[140px] text-teal-600 dark:text-teal-400" title={session.sourceDevice}>
                          {session.sourceDevice}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                        <span className="text-xs font-bold truncate max-w-[140px] text-violet-600 dark:text-violet-400" title={session.destinationDevice}>
                          {session.destinationDevice}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono flex gap-2">
                        <span>IPs: {session.sourceIp} → {session.destinationIp}</span>
                        <span>•</span>
                        <span>Ports: {session.sourcePort || "*"} → {session.destinationPort || "*"}</span>
                      </div>
                    </div>

                    {/* Stats summary & status badge */}
                    <div className="flex items-center gap-3 text-right shrink-0">
                      <div className="space-y-0.5 font-mono">
                        <span className="text-xs text-[var(--text-main)] block font-bold">
                          {(session.bytesTransferred / 1024).toFixed(1)} KB
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] block">
                          {session.packetCount} pkts
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-0.5 font-bold text-[10px] font-mono rounded bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
                          {session.protocol}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            session.status === "active" ? "bg-emerald-500" : session.status === "failed" ? "bg-rose-500" : "bg-slate-400"
                          }`} />
                          <span className="text-[9px] text-[var(--text-muted)] uppercase font-semibold">{session.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-[var(--text-muted)] text-xs font-mono border border-dashed border-[var(--border-color)] rounded-xl">
                  No active session matching flow parameters.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] pt-3.5 mt-4 text-xs text-[var(--text-muted)] flex items-center gap-1.5 font-sans">
            <Clock className="h-3.5 w-3.5 text-teal-500" /> Timestamps derived relative to current audit session.
          </div>
        </div>

        {/* Conversation Dialog Timeline - 5 Cols */}
        <div className="app-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
              <h4 className="text-sm font-bold text-[var(--text-main)]">
                Packet Dialogue Stream
              </h4>
              <span className="text-xs text-[var(--text-muted)] font-mono">Latest Events</span>
            </div>

            <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1 relative">
              {/* Vertical track line */}
              <div className="absolute left-[13px] top-2 bottom-2 w-[2px] bg-[var(--border-color)] pointer-events-none" />

              {conversationTimeline.length > 0 ? (
                conversationTimeline.map((pkt) => {
                  const isLeftToRight = selectedSource === "ALL" || pkt.src_ip === selectedSource;
                  
                  return (
                    <div key={pkt.id} className="relative pl-7 flex flex-col gap-1 text-xs font-mono">
                      {/* Timeline marker */}
                      <div className="absolute left-[10px] top-1.5 h-2 w-2 rounded-full bg-teal-500 ring-2 ring-[var(--bg-card)]" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-muted)] text-[10px]">
                          {pkt.formatted_time ? pkt.formatted_time.split(" ")[1] : "unknown"}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-teal-500/10 text-teal-600 dark:text-teal-300 font-bold border border-teal-500/20">
                          {pkt.protocol}
                        </span>
                      </div>

                      <div className="text-[var(--text-main)] font-semibold">
                        <span className="text-teal-600 dark:text-teal-400">{pkt.src_ip.split(".").pop()}</span>
                        {isLeftToRight ? " ──▶ " : " ◀── "}
                        <span className="text-violet-600 dark:text-violet-400">{pkt.dst_ip.split(".").pop()}</span>
                      </div>
                      
                      <div className="text-[11px] text-[var(--text-muted)] truncate leading-relaxed max-w-[240px]" title={pkt.info}>
                        {pkt.info}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 text-[var(--text-muted)] text-xs font-mono">
                  Awaiting streams on selected filter parameters...
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] pt-3.5 mt-4 text-xs text-[var(--text-muted)] font-sans">
            Node addresses are shown as local network octets.
          </div>
        </div>

      </div>

    </div>
  );
}
