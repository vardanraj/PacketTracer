import { Activity, ShieldCheck, Terminal, ArrowRight, Sun, Moon, Cpu, Radio, Network } from "lucide-react";

export default function LandingPage({ onLaunch, isDarkMode = false, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex flex-col relative overflow-hidden transition-colors" id="landing-page-root">
      
      {/* Background Gradient Wash (Teal-to-Violet-to-Magenta signature glow effect) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[750px] md:w-[950px] h-[350px] sm:h-[450px] md:h-[550px] pointer-events-none opacity-30 dark:opacity-25 blur-[60px] sm:blur-[100px] z-0 overflow-hidden">
        <div className="w-full h-full rounded-full bg-gradient-to-r from-[#2DD4BF] via-[#A855F7] to-[#C026D3] animate-blob transform-gpu" />
      </div>

      {/* Header Bar */}
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onLaunch(false)}>
            <div className="h-9 w-9 bg-teal-500/10 border border-teal-500/30 rounded-lg flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <img src="/favicon.svg" alt="Net Observer Logo" className="h-5 w-5" />
            </div>
            <span className="font-sans text-sm sm:text-base tracking-tight font-bold text-[var(--text-main)]">
              Net<span className="text-teal-600 dark:text-teal-400">Observer</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--text-muted)]">
            <span className="hover:text-[var(--text-main)] transition-colors cursor-pointer" onClick={() => onLaunch(false)}>Dashboard SOC</span>
            <span className="hover:text-[var(--text-main)] transition-colors cursor-pointer" onClick={() => onLaunch(false)}>Packet Ingestion</span>
            <span className="hover:text-[var(--text-main)] transition-colors cursor-pointer" onClick={() => onLaunch(false)}>Docs</span>
            <span className="hover:text-[var(--text-main)] transition-colors cursor-pointer" onClick={() => onLaunch(false)}>Support</span>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-2.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-card-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Toggle Light / Dark Mode"
            >
              {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>
          )}

          <button 
            onClick={() => onLaunch(true)}
            className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] px-2.5 sm:px-3 py-2.5 transition-colors cursor-pointer min-h-[44px] flex items-center"
          >
            Guest Demo
          </button>
          
          <button 
            onClick={() => onLaunch(false)}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3 sm:px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
          >
            <span className="hidden sm:inline">Launch Dashboard</span>
            <span className="sm:hidden">Launch</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16 z-10 w-full space-y-12">
        
        {/* Two-Column Grid: Text & CTAs on Left, Single Preview Card on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Telemetry Badge, Headline, Subcopy, CTAs, Metrics */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-300 text-xs font-medium max-w-full shadow-xs">
                <ShieldCheck className="h-4 w-4 text-teal-500 shrink-0" />
                <span className="truncate">Real-Time Network Telemetry & Deep Packet Inspection</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-[var(--text-main)]">
                Total visibility across every <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2DD4BF] via-[#A855F7] to-[#C026D3]">packet & session.</span>
              </h1>

              <p className="text-[var(--text-muted)] text-sm sm:text-base md:text-lg leading-relaxed max-w-xl font-sans">
                Inspect live stream ingress, monitor active talkers, diagnose throughput spikes, and analyze PCAP traces with a unified observability hub.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <button
                onClick={() => onLaunch(false)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[44px]"
              >
                Launch Observatorium
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => onLaunch(true)}
                className="bg-[var(--bg-card)]/80 backdrop-blur-md border border-[var(--border-color)] hover:border-teal-500/50 text-[var(--text-main)] font-semibold text-xs px-5 py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] min-h-[44px]"
              >
                <Terminal className="h-4 w-4 text-teal-500" />
                Start Guest Session
              </button>
            </div>

            {/* Quick Telemetry Metrics Banner */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-6 border-t border-[var(--border-color)] text-left">
              <div>
                <div className="text-base sm:text-xl font-bold font-mono text-[var(--text-main)]">10 Gbps+</div>
                <div className="text-[10px] sm:text-xs text-[var(--text-muted)] font-sans">Ingress Rate</div>
              </div>
              <div>
                <div className="text-base sm:text-xl font-bold font-mono text-[var(--text-main)]">L2 – L7</div>
                <div className="text-[10px] sm:text-xs text-[var(--text-muted)] font-sans">Protocol Stack</div>
              </div>
              <div>
                <div className="text-base sm:text-xl font-bold font-mono text-[var(--text-main)]">&lt; 1 ms</div>
                <div className="text-[10px] sm:text-xs text-[var(--text-muted)] font-sans">Parse Latency</div>
              </div>
            </div>
          </div>

          {/* Right Column: Single Live Preview Glass Card (LIVE INGRESS NODE) */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="w-full max-w-md hero-glass-card rounded-2xl p-4 sm:p-5 shadow-2xl border border-teal-500/30">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-500 animate-ping" />
                  <span className="text-xs font-mono font-bold text-[var(--text-main)]">LIVE INGRESS NODE</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-teal-500/20 text-teal-600 dark:text-teal-300 font-bold">TCP STREAM</span>
              </div>

              <div className="bg-[var(--bg-card-muted)]/80 rounded-xl p-3 mb-3 space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Source:</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400 truncate ml-2">192.168.1.142:50402</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Destination:</span>
                  <span className="font-bold text-[var(--text-main)] truncate ml-2">192.168.1.200:80</span>
                </div>
                <div className="text-[10px] text-[var(--text-subtle)] pt-1.5 border-t border-[var(--border-color)] truncate">
                  HTTP GET /api/v1/checkout [SYN Ack=1 Win=64240]
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center font-mono">
                <div className="bg-teal-500/10 rounded-lg p-2 border border-teal-500/20">
                  <div className="text-[10px] text-[var(--text-muted)]">PACKETS/SEC</div>
                  <div className="text-sm font-bold text-teal-600 dark:text-teal-300">2,480 p/s</div>
                </div>
                <div className="bg-violet-500/10 rounded-lg p-2 border border-violet-500/20">
                  <div className="text-[10px] text-[var(--text-muted)]">BANDWIDTH</div>
                  <div className="text-sm font-bold text-violet-600 dark:text-violet-300">18.4 Mbps</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Feature Cards Grid */}
        <section className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="app-card p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Network className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text-main)]">Flow Compass</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Discover network device topology, active session pairs, open ports, and host conversations automatically.
            </p>
          </div>

          <div className="app-card p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text-main)]">Protocol Inspection</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Hex dumps, header decoders, and payload viewports for TCP, UDP, ICMP, HTTP, HTTPS, and DNS.
            </p>
          </div>

          <div className="app-card p-6 space-y-3">
            <div className="h-10 w-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400">
              <Radio className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-[var(--text-main)]">Live Probe Agents</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Stream live packets from local network hardware using the Python Scapy daemon or parse PCAP file dumps.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] py-8 px-6 bg-[var(--bg-card)] text-center text-[var(--text-muted)] text-xs font-mono flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>NetObserver Telemetry Engine • v2.5.0</div>
        <div className="flex gap-4">
          <span className="hover:text-teal-500 cursor-pointer">Security Policy</span>
          <span className="hover:text-teal-500 cursor-pointer">Ethical Guidelines</span>
          <span className="hover:text-teal-500 cursor-pointer">Documentation</span>
        </div>
      </footer>

    </div>
  );
}
