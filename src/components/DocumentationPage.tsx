import { 
  BookOpen, ShieldCheck, Server, ShieldAlert, Layers
} from "lucide-react";

export default function DocumentationPage() {
  return (
    <div className="space-y-6" id="documentation-page-root">
      
      {/* Overview Card */}
      <div className="app-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 bg-teal-500/10 border border-teal-500/30 rounded-xl items-center justify-center text-teal-600 dark:text-teal-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Technical Reference & Architecture Console
            </h3>
            <p className="text-xs text-[var(--text-muted)] font-sans mt-0.5">
              Overview of TCP/IP handshakes, routing layers, and secure TLS handshake profiles
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Sniffing Reality vs Protocol Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="docs-content-grid">
        
        {/* Left Column: Sniffing Architecture Explained - 7 Cols */}
        <div className="lg:col-span-7 app-card p-6 space-y-5">
          <h4 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4">
            Understanding Capture Constraints & Routing
          </h4>

          <div className="space-y-4 text-xs text-[var(--text-muted)] leading-relaxed font-sans">
            <p>
              In computer networking, a <strong className="text-[var(--text-main)] font-mono">packet sniffer</strong> is a utility that captures raw binary frames traversing a local network interface card (NIC).
            </p>

            <div className="bg-rose-500/10 p-4 border border-rose-500/30 rounded-xl space-y-2 font-mono">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> The Web Browser Sandbox Rule
              </span>
              <p className="text-[var(--text-main)] text-xs leading-relaxed font-sans">
                By security design, standard web browsers run in a highly restricted sandbox. They are <strong>strictly forbidden</strong> from accessing raw Layer 2 or Layer 3 hardware bindings directly off the physical wire.
              </p>
            </div>

            <p>
              To solve this, NetObserver acts as an <strong className="text-teal-600 dark:text-teal-400 font-mono">observability ingestion hub</strong>. Real network trace data arrives via:
            </p>

            <ul className="list-disc pl-5 space-y-2 text-xs text-[var(--text-muted)] font-mono">
              <li>
                <strong className="text-[var(--text-main)]">Offline PCAP Files:</strong> Binary dumps saved from Wireshark or tcpdump containing serial raw network packets.
              </li>
              <li>
                <strong className="text-[var(--text-main)]">Capture Agents (Probe Daemon):</strong> Separate privileged background script written in Python utilizing <code className="text-teal-600 dark:text-teal-400">scapy</code>, running as root/Administrator directly on the target network segment.
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Protocol reference cards - 5 Cols */}
        <div className="lg:col-span-5 space-y-4" id="docs-protocols-references">
          
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pl-1">
            Protocol Reference Cards
          </h4>

          {/* Card 1: TCP Handshake */}
          <div className="app-card p-5 space-y-2.5">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> TCP Three-Way Handshake
            </span>
            <p className="text-xs text-[var(--text-muted)] font-sans leading-relaxed">
              TCP guarantees delivery via the three-way handshake:
            </p>
            <div className="bg-[var(--bg-card-muted)] p-3 rounded-xl border border-[var(--border-color)] font-mono text-xs text-[var(--text-main)] leading-normal space-y-1 text-center font-semibold">
              <div>1. [SYN] ──▶ Client synchronizes ports</div>
              <div>2. ◀── [SYN-ACK] ── Server acknowledges sync</div>
              <div>3. [ACK] ──▶ Client completes connection</div>
            </div>
          </div>

          {/* Card 2: DNS & UDP datagrams */}
          <div className="app-card p-5 space-y-2.5">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="h-4 w-4" /> UDP Datagrams
            </span>
            <p className="text-xs text-[var(--text-muted)] font-sans leading-relaxed">
              UDP has zero session handshakes or ordering checks. Best for speed, DNS queries, streaming media, or background syslog reporting.
            </p>
          </div>

          {/* Card 3: TLS Certificate encryption */}
          <div className="app-card p-5 space-y-2.5">
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> TLS / SSL Encryption Previews
            </span>
            <p className="text-xs text-[var(--text-muted)] font-sans leading-relaxed">
              All application layer payloads under HTTPS are encrypted using RSA or Elliptic Curve cryptographic keys. Observers inspect transport-level variables, such as Hostnames via SNI.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
