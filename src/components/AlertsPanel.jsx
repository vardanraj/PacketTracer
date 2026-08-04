import { useMemo } from "react";
import { 
  ShieldAlert, CheckCircle2, AlertOctagon, HelpCircle
} from "lucide-react";

export default function AlertsPanel({
  alerts,
  onAcknowledgeAlert,
  onClearAlerts
}) {

  // Unacknowledged vs. Acknowledged split
  const unacknowledged = useMemo(() => alerts.filter(a => !a.acknowledged), [alerts]);
  const acknowledged = useMemo(() => alerts.filter(a => a.acknowledged), [alerts]);

  return (
    <div className="space-y-6" id="alerts-panel-root">
      
      {/* Overview Banner */}
      <div className="app-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 bg-amber-500/10 border border-amber-500/30 rounded-xl items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              SOC Threat Incident Monitor & Response
            </h3>
            <p className="text-xs text-[var(--text-muted)] font-sans mt-0.5">
              Audits anomalies, traffic bursts, port scanning, and unauthorized host pairings
            </p>
          </div>
        </div>

        <button 
          onClick={onClearAlerts}
          className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors font-semibold"
        >
          Purge Resolved Alerts
        </button>
      </div>

      {/* Grid: Active vs Resolved logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="threats-logs-grid">
        
        {/* Active Threats List - 8 Cols */}
        <div className="lg:col-span-8 app-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4">
            <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertOctagon className="h-4 w-4" /> Unresolved Threat Logs ({unacknowledged.length})
            </h4>
            <span className="text-xs text-[var(--text-muted)] font-mono">Requires Action</span>
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {unacknowledged.length > 0 ? (
              unacknowledged.map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-xl border relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    alert.severity === "critical"
                      ? "bg-rose-500/10 border-rose-500/30"
                      : "bg-[var(--bg-card-muted)] border-[var(--border-color)]"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-main)]">{alert.title}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        alert.severity === "critical"
                          ? "bg-rose-500 text-white"
                          : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      }`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] font-sans leading-relaxed">{alert.description}</p>
                    <div className="text-[10px] font-mono text-[var(--text-subtle)] flex gap-2">
                      <span>Occurred: {new Date(alert.timestamp * 1000).toLocaleTimeString()}</span>
                      {alert.relatedSessionId && <span>• Session: #{alert.relatedSessionId.slice(-4)}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => onAcknowledgeAlert(alert.id)}
                    className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors font-semibold self-start sm:self-center shadow-sm"
                  >
                    Resolve Alert
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-24 text-[var(--text-muted)] text-xs font-mono border border-dashed border-[var(--border-color)] rounded-xl">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
                All active threat incidents have been reviewed and resolved.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Threat response instructions & resolved logs - 4 Cols */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Resolved Log Archive */}
          <div className="app-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4">
              Resolved Archive ({acknowledged.length})
            </h4>

            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
              {acknowledged.length > 0 ? (
                acknowledged.map((alert) => (
                  <div key={alert.id} className="p-2.5 bg-[var(--bg-card-muted)] rounded-lg border border-[var(--border-color)] text-xs font-mono text-[var(--text-main)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)] line-through truncate max-w-[150px]">{alert.title}</span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Resolved</span>
                    </div>
                    <span className="block text-[10px] text-[var(--text-subtle)] mt-1">Closed at: {new Date(alert.timestamp * 1000).toLocaleTimeString()}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)] text-xs font-mono">
                  Archive is currently empty.
                </div>
              )}
            </div>
          </div>

          {/* Incident Response Policy Card */}
          <div className="app-card p-6 space-y-3">
            <h4 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4" /> Response Handbook
            </h4>
            <div className="text-xs text-[var(--text-muted)] space-y-2 leading-relaxed font-sans">
              <p>1. Inspect target host IP and verify protocol decoders.</p>
              <p>2. Isolate malicious agent sockets or trigger capture purge.</p>
              <p>3. Export forensic audit logs via Compliance Reports page.</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
