import { useMemo } from "react";
import { 
  Play, Square, ShieldAlert, Cpu, Network, Globe, 
  ArrowDown, ArrowUp, ShieldCheck, Zap
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid 
} from "recharts";

const COLORS = [
  "#0d9488", // Teal
  "#7c3aed", // Violet
  "#f59e0b", // Amber
  "#c026d3", // Magenta
  "#06b6d4", // Cyan
  "#64748b"  // Slate
];

export default function DashboardOverview({
  packets,
  stats,
  serverState,
  onToggleCapture,
  alerts,
  sessions,
  devices
}) {

  // Protocol distribution counts
  const protocolPieData = useMemo(() => {
    if (stats?.protocolBreakdown && stats.protocolBreakdown.length > 0) {
      return stats.protocolBreakdown.map((item, idx) => ({
        name: item.protocol,
        value: item.count,
        color: COLORS[idx % COLORS.length]
      }));
    }
    return [
      { name: "TCP", value: 65, color: "#0d9488" },
      { name: "UDP", value: 20, color: "#10b981" },
      { name: "HTTPS", value: 12, color: "#7c3aed" },
      { name: "DNS", value: 3, color: "#06b6d4" }
    ];
  }, [stats]);

  // Top active talker IPs
  const sourceBarData = useMemo(() => {
    if (stats?.topSources && stats.topSources.length > 0) {
      return stats.topSources.map(item => ({
        ip: item.ip,
        packets: item.count,
        bytes: item.bytes
      }));
    }
    return [
      { ip: "192.168.1.142", packets: 145 },
      { ip: "192.168.1.200", packets: 120 },
      { ip: "140.82.113.3", packets: 84 },
      { ip: "8.8.8.8", packets: 42 }
    ];
  }, [stats]);

  // Active Alert Metrics
  const activeAlertsCount = useMemo(() => {
    return alerts.filter(a => !a.acknowledged).length;
  }, [alerts]);

  return (
    <div className="space-y-6" id="dashboard-overview-container">
      
      {/* 1. TOP CHAKRA-STYLE STAT CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="overview-metric-grid">
        
        {/* Stat 1: Packets Ingested */}
        <div className="app-card p-5 relative flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Ingress Rate
              </span>
              <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1">
                {stats?.packetsPerSecond || 2480} <span className="text-xs text-[var(--text-muted)] font-normal">p/s</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Network className="h-5 w-5" />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-semibold mt-4 pt-3 border-t border-[var(--border-color)]">
            <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
              <ArrowUp className="h-3 w-3 mr-0.5" /> +5.2%
            </span>
            <span className="text-[var(--text-muted)] font-normal text-[11px]">since last hour</span>
          </div>
        </div>

        {/* Stat 2: Total Bandwidth */}
        <div className="app-card p-5 relative flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Total Volume
              </span>
              <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1">
                {stats?.totalBytes ? (stats.totalBytes / 1024 / 1024).toFixed(2) : "18.40"} <span className="text-xs text-[var(--text-muted)] font-normal">MB</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Globe className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold mt-4 pt-3 border-t border-[var(--border-color)]">
            <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
              <ArrowUp className="h-3 w-3 mr-0.5" /> +12.4%
            </span>
            <span className="text-[var(--text-muted)] font-normal text-[11px]">throughput load</span>
          </div>
        </div>

        {/* Stat 3: Audited Devices */}
        <div className="app-card p-5 relative flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Active Devices
              </span>
              <div className="text-2xl font-bold font-mono text-[var(--text-main)] mt-1">
                {devices.filter(d => d.status === "online").length || 12}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Cpu className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold mt-4 pt-3 border-t border-[var(--border-color)]">
            <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
              +2 online
            </span>
            <span className="text-[var(--text-muted)] font-normal text-[11px]">{sessions.length} sessions</span>
          </div>
        </div>

        {/* Stat 4: Security Threat Alerts */}
        <div className="app-card p-5 relative flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Active Incidents
              </span>
              <div className={`text-2xl font-bold font-mono mt-1 ${activeAlertsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {activeAlertsCount}
              </div>
            </div>
            <div className={`p-2.5 rounded-xl ${activeAlertsCount > 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold mt-4 pt-3 border-t border-[var(--border-color)]">
            {activeAlertsCount > 0 ? (
              <>
                <span className="inline-flex items-center text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded text-[11px]">
                  <ArrowUp className="h-3 w-3 mr-0.5" /> +1
                </span>
                <span className="text-[var(--text-muted)] font-normal text-[11px]">requires investigation</span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                  <ArrowDown className="h-3 w-3 mr-0.5" /> -1
                </span>
                <span className="text-[var(--text-muted)] font-normal text-[11px]">all systems clean</span>
              </>
            )}
          </div>
        </div>

      </div>

      {/* 2. DARK PROMO / CONTROL CARD BREAKING UP LIGHT/DARK LAYOUT (Chakra Style) */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight uppercase text-white">
              Probe Daemon Broker Status: <span className="text-teal-400">{serverState.isCapturing ? "ACTIVE SCANNING" : "STANDBY"}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Mode: <strong className="text-slate-200">{serverState.captureMode}</strong> • Selected Interface: <strong className="text-slate-200">{serverState.selectedInterface || "en0"}</strong> • Agent Probes: <strong className="text-teal-400">{serverState.connectedAgents.length} Connected</strong>
            </p>
          </div>
        </div>

        <button
          onClick={onToggleCapture}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
            serverState.isCapturing 
              ? "bg-rose-600 hover:bg-rose-700 text-white" 
              : "bg-teal-600 hover:bg-teal-700 text-white"
          }`}
        >
          {serverState.isCapturing ? (
            <><Square className="h-4 w-4 fill-current" /> Pause Ingress Stream</>
          ) : (
            <><Play className="h-4 w-4 fill-current" /> Resume Ingress Stream</>
          )}
        </button>
      </div>

      {/* 3. CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-visualization-grid">
        
        {/* Bandwidth Throughput Chart - 8 Cols */}
        <div className="app-card p-6 lg:col-span-8 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-ping" /> Bandwidth Throughput Over Time
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Live packet ingress rate in Bytes per second</p>
            </div>
            <span className="text-[10px] font-mono bg-teal-500/10 text-teal-600 dark:text-teal-300 px-2.5 py-1 rounded-full font-bold">
              Realtime Socket
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={stats?.bandwidthOverTime || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorBytes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} fontFamily="monospace" />
                <YAxis stroke="var(--text-muted)" fontSize={10} fontFamily="monospace" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", borderRadius: "8px", fontFamily: "monospace" }}
                  labelClassName="text-xs text-[var(--text-main)] font-bold"
                />
                <Area type="monotone" dataKey="bytes" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBytes)" name="Throughput (Bytes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Protocol Distribution Donut - 4 Cols */}
        <div className="app-card p-6 lg:col-span-4 flex flex-col justify-between">
          <h3 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4 mb-4">
            Protocol Share
          </h3>

          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={protocolPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {protocolPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", borderRadius: "8px", fontFamily: "monospace" }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute text-center">
              <span className="block text-[10px] font-mono text-[var(--text-muted)] uppercase font-bold">TOTAL</span>
              <span className="text-lg font-bold font-mono text-[var(--text-main)]">
                {stats?.totalPackets || packets.length}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono text-[var(--text-muted)] border-t border-[var(--border-color)] pt-3">
            {protocolPieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate font-semibold">{item.name}</span>
                <span className="text-[var(--text-subtle)]">({item.value})</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4. ACTIVE TALKERS & INCIDENT MONITOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top Active Talkers Bar Chart - 6 Cols */}
        <div className="app-card p-6 lg:col-span-6">
          <h3 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4 mb-4">
            Top Talker Hosts
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="ip" stroke="var(--text-muted)" fontSize={10} fontFamily="monospace" />
                <YAxis stroke="var(--text-muted)" fontSize={10} fontFamily="monospace" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", borderRadius: "8px", fontFamily: "monospace" }}
                />
                <Bar dataKey="packets" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Packets Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Incident Feed Panel - 6 Cols */}
        <div className="app-card p-6 lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-4">
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Threat Incidents
              </h3>
              <span className="text-xs text-[var(--text-muted)] font-mono">SOC Monitor</span>
            </div>

            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {alerts.length > 0 ? (
                alerts.slice(0, 3).map((alert) => (
                  <div 
                    key={alert.id}
                    className={`p-3 rounded-xl border flex gap-3 ${
                      alert.severity === "critical"
                        ? "bg-rose-500/10 border-rose-500/30"
                        : "bg-[var(--bg-card-muted)] border-[var(--border-color)]"
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <ShieldAlert className={`h-4 w-4 ${
                        alert.severity === "critical" ? "text-rose-500" : "text-amber-500"
                      }`} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-main)]">{alert.title}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold ${
                          alert.severity === "critical" 
                            ? "bg-rose-500 text-white"
                            : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-sans leading-relaxed">{alert.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)] text-xs font-mono">
                  No unacknowledged incidents in queue.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] pt-3.5 mt-4 text-center">
            <span className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-500" /> Continuous security monitoring active
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
