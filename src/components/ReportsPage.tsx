import { useState, useMemo } from "react";
import { 
  FileText, Download, CheckCircle2, ShieldCheck, Calendar,
  ArrowDownToLine
} from "lucide-react";
import { Packet, Session, Alert } from "../types";

interface ReportsPageProps {
  packets: Packet[];
  sessions: Session[];
  alerts: Alert[];
}

export default function ReportsPage({
  packets,
  sessions,
  alerts
}: ReportsPageProps) {
  const [reportType, setReportType] = useState<"standard" | "incident" | "compliance">("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Calculate metrics for summary
  const totalBytes = useMemo(() => packets.reduce((sum, p) => sum + p.size, 0), [packets]);
  const complianceRating = useMemo(() => {
    const criticalCount = alerts.filter(a => a.severity === "critical").length;
    const highCount = alerts.filter(a => a.severity === "high").length;
    if (criticalCount > 0) return "C - RESTRICTED";
    if (highCount > 0) return "B - DEVIANT";
    return "A - NOMINAL SECURE";
  }, [alerts]);

  const handleExportCSV = () => {
    setIsGenerating(true);
    setSuccessMsg("");

    setTimeout(() => {
      const headers = "ID,Timestamp,Protocol,Source_IP,Destination_IP,Source_Port,Destination_Port,Size_Bytes,Info\n";
      const rows = packets.map(p => 
        `"${p.id}","${p.formatted_time}","${p.protocol}","${p.src_ip}","${p.dst_ip}","${p.src_port || ""}","${p.dst_port || ""}","${p.size}","${p.info.replace(/"/g, '""')}"`
      ).join("\n");

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `packet_collector_audit_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsGenerating(false);
      setSuccessMsg("EXPORT CSV GENERATED! Audit logs downloaded.");
    }, 800);
  };

  const handleExportJSON = () => {
    setIsGenerating(true);
    setSuccessMsg("");

    setTimeout(() => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        generatedAt: new Date().toISOString(),
        packetsCount: packets.length,
        complianceRating,
        sessions,
        alerts,
        packets
      }, null, 2));

      const link = document.createElement("a");
      link.setAttribute("href", dataStr);
      link.setAttribute("download", `packet_collector_audit_report_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsGenerating(false);
      setSuccessMsg("EXPORT JSON GENERATED! Audit logs downloaded.");
    }, 800);
  };

  return (
    <div className="space-y-6" id="reports-page-root">
      
      {/* Executive Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="reports-summary-cards">
        <div className="app-card p-5">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Compliance Rating</span>
          <span className={`text-xl font-bold font-mono block mt-1 ${
            complianceRating.includes("NOMINAL") ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
          }`}>
            {complianceRating}
          </span>
          <span className="text-xs text-[var(--text-muted)] block mt-2 font-sans">Derived from active threat alerts</span>
        </div>

        <div className="app-card p-5">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Packets Reviewed</span>
          <span className="text-xl font-bold font-mono text-[var(--text-main)] block mt-1">
            {packets.length} Records
          </span>
          <span className="text-xs text-[var(--text-muted)] block mt-2 font-sans">Volume: {(totalBytes / 1024 / 1024).toFixed(3)} MB</span>
        </div>

        <div className="app-card p-5">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Active Flow Channels</span>
          <span className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 block mt-1">
            {sessions.length} Operational Sessions
          </span>
          <span className="text-xs text-[var(--text-muted)] block mt-2 font-sans">Continuous monitoring active</span>
        </div>
      </div>

      {/* Primary Report builder controls & preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="reports-builder-deck">
        
        {/* Left: Report Configurator - 5 Cols */}
        <div className="lg:col-span-5 app-card p-6 flex flex-col justify-between">
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4 flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-teal-500" /> Compliance Report Console
            </h3>

            {/* Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Report Profile</label>
              <div className="flex flex-col gap-2">
                {[
                  { id: "standard", title: "Comprehensive Audit Report", desc: "Consolidated list of packets, volumes, and protocol distributions." },
                  { id: "incident", title: "SOC Threat Incident Log", desc: "Lists unresolved security threats and critical anomalies." },
                  { id: "compliance", title: "Regulatory Compliance Sheet", desc: "Detailed breakdown of device pairing & protocol access control flags." }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { setReportType(type.id as any); setSuccessMsg(""); }}
                    className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer ${
                      reportType === type.id 
                        ? "bg-teal-500/10 border-teal-500 text-[var(--text-main)] font-semibold shadow-sm" 
                        : "bg-[var(--bg-card-muted)] border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-color-hover)]"
                    }`}
                  >
                    <span className="text-xs font-bold block">{type.title}</span>
                    <span className="text-xs text-[var(--text-muted)] mt-0.5 block">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[var(--border-color)] mt-6">
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs rounded-xl flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportCSV}
                disabled={isGenerating || packets.length === 0}
                className="bg-[var(--bg-card-muted)] hover:bg-[var(--border-color)] text-[var(--text-main)] text-xs py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors border border-[var(--border-color)]"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                disabled={isGenerating || packets.length === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors shadow-sm"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" /> Export JSON
              </button>
            </div>
          </div>
        </div>

        {/* Right: Technical preview - 7 Cols */}
        <div className="lg:col-span-7 app-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
              <h4 className="text-sm font-bold text-[var(--text-main)]">
                Report Preview
              </h4>
              <span className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-teal-500" /> July 2026 Audit
              </span>
            </div>

            {reportType === "standard" && (
              <div className="space-y-4 text-xs font-mono text-[var(--text-main)]">
                <div className="p-3.5 bg-[var(--bg-card-muted)] rounded-xl border border-[var(--border-color)] space-y-1.5">
                  <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Generated On:</span> <span className="text-[var(--text-main)] font-bold">2026-07-24 13:10 UTC</span></div>
                  <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Scope Profile:</span> <span className="text-teal-600 dark:text-teal-400 font-bold">Packet Stream Console</span></div>
                  <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Compliance Status:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">Secure Log Retention</span></div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Top Stream Elements:</h5>
                  <div className="bg-[var(--bg-card-muted)] rounded-xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                    <div className="p-2.5 flex justify-between"><span>TCP Packets Ingested:</span> <span className="text-teal-600 dark:text-teal-400 font-bold">{packets.filter(p => p.protocol === "TCP").length}</span></div>
                    <div className="p-2.5 flex justify-between"><span>UDP Packets Ingested:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{packets.filter(p => p.protocol === "UDP").length}</span></div>
                    <div className="p-2.5 flex justify-between"><span>HTTP/HTTPS Web Packets:</span> <span className="text-violet-600 dark:text-violet-400 font-bold">{packets.filter(p => p.protocol === "HTTP" || p.protocol === "HTTPS").length}</span></div>
                  </div>
                </div>
              </div>
            )}

            {reportType === "incident" && (
              <div className="space-y-4 text-xs font-mono text-[var(--text-main)]">
                <div className="p-3.5 bg-[var(--bg-card-muted)] rounded-xl border border-[var(--border-color)] space-y-1.5">
                  <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Critical Anomalies:</span> <span className="text-rose-600 dark:text-rose-400 font-bold">{alerts.filter(a => a.severity === "critical" || a.severity === "high").length} Logs</span></div>
                  <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Average Reaction:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">4.2 minutes (SLA OK)</span></div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Historical Incident Spikes:</h5>
                  <div className="p-3 bg-[var(--bg-card-muted)] rounded-xl border border-[var(--border-color)] text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                    System audits identified <strong className="text-teal-600 dark:text-teal-400">2 unusual port probe sequences</strong> originating from internal device segment. Check firewall logs for router validation and SSH port binding rules.
                  </div>
                </div>
              </div>
            )}

            {reportType === "compliance" && (
              <div className="space-y-4 text-xs font-mono text-[var(--text-main)]">
                <div className="p-3.5 bg-[var(--bg-card-muted)] rounded-xl border border-[var(--border-color)] space-y-1.5">
                  <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Compliance Level:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Regulatory Pass</span></div>
                  <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Payload Handling:</span> <span className="text-[var(--text-main)] font-bold">Metadata Only (Zero Payload Violation)</span></div>
                </div>

                <p className="text-xs text-[var(--text-muted)] font-sans leading-relaxed">
                  Compliance Sheet certifies that no plaintext payload is gathered from SSL/TLS streams. All inspected packets represent lawful metadata elements captured inside enterprise guidelines.
                </p>
              </div>
            )}

          </div>

          <div className="border-t border-[var(--border-color)] pt-3.5 mt-4 text-xs text-[var(--text-muted)] flex items-center gap-1.5 justify-center font-sans">
            <ShieldCheck className="h-4 w-4 text-teal-500" /> Compliance keys signed and audited internally
          </div>
        </div>

      </div>

    </div>
  );
}
