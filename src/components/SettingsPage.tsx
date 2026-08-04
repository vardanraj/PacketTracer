import React, { useState } from "react";
import { 
  Settings, Save, Key, HardDrive, ShieldCheck, EyeOff
} from "lucide-react";

interface SettingsPageProps {
  serverState: any;
  onClearLogs: () => void;
}

export default function SettingsPage({
  onClearLogs
}: SettingsPageProps) {
  const [retentionCount, setRetentionCount] = useState("5000");
  const [anonymizeIps, setAnonymizeIps] = useState(false);
  const [redactHeaders, setRedactHeaders] = useState(true);
  const [apiKey, setApiKey] = useState("sk_live_6f4ae91e0a294b...");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  return (
    <div className="space-y-6" id="settings-page-root">
      
      {/* Title */}
      <div className="app-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 bg-teal-500/10 border border-teal-500/30 rounded-xl items-center justify-center text-teal-600 dark:text-teal-400">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Observability Platform Preferences
            </h3>
            <p className="text-xs text-[var(--text-muted)] font-sans mt-0.5">
              Customize buffering limits, metadata redactions, and secure REST credentials
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="settings-form-grid">
        
        {/* Left Column: Data retention & privacy - 7 Cols */}
        <div className="lg:col-span-7 app-card p-6 space-y-6">
          <h4 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4">
            Buffer Retention & Privacy Redactions
          </h4>

          {/* Retention option */}
          <div className="space-y-2 font-sans">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
              In-Memory Buffer Retention Limit
            </label>
            <select
              value={retentionCount}
              onChange={(e) => setRetentionCount(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs rounded-xl px-3 py-2.5 font-medium text-[var(--text-main)] focus:outline-none cursor-pointer"
            >
              <option value="1000">1,000 Buffered Packets (Ultralight, lowest latency)</option>
              <option value="5000">5,000 Buffered Packets (Recommended Standard)</option>
              <option value="10000">10,000 Buffered Packets (Enhanced auditing depth)</option>
            </select>
            <span className="text-xs text-[var(--text-muted)] block mt-1">
              When memory limits are reached, the database automatically drops the oldest packets (FIFO rotation).
            </span>
          </div>

          {/* Privacy Toggles */}
          <div className="space-y-4 pt-3 border-t border-[var(--border-color)]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[var(--text-main)] block">Anonymize Ingress Host IP Addresses</span>
                <p className="text-xs text-[var(--text-muted)] leading-normal font-sans">
                  Mask final network octets (e.g. 192.168.1.142 → 192.168.1.***) inside raw stream previews.
                </p>
              </div>
              <input
                type="checkbox"
                checked={anonymizeIps}
                onChange={(e) => setAnonymizeIps(e.target.checked)}
                className="mt-1 h-4 w-4 accent-teal-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pt-4 border-t border-[var(--border-color)]">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[var(--text-main)] block">Redact Application Headers</span>
                <p className="text-xs text-[var(--text-muted)] leading-normal font-sans">
                  Filter Cookie headers, Bearer tokens, and Authorization packets from raw HTTP/HTTPS logs before saving.
                </p>
              </div>
              <input
                type="checkbox"
                checked={redactHeaders}
                onChange={(e) => setRedactHeaders(e.target.checked)}
                className="mt-1 h-4 w-4 accent-teal-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Database Actions */}
          <div className="pt-4 border-t border-[var(--border-color)] flex justify-between items-center text-xs font-sans text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-teal-500" /> Storage Engine: SQLite / InMemory</span>
            <button
              type="button"
              onClick={onClearLogs}
              className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold transition-colors"
            >
              Purge Current Buffer
            </button>
          </div>
        </div>

        {/* Right Column: Credentials & Save - 5 Cols */}
        <div className="lg:col-span-5 app-card p-6 flex flex-col justify-between">
          <div className="space-y-5">
            <h4 className="text-sm font-bold text-[var(--text-main)] border-b border-[var(--border-color)] pb-4">
              Secure Access Tokens
            </h4>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">Compliance REST API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-teal-500" />
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-xs rounded-xl pl-9 pr-9 py-2.5 font-mono text-[var(--text-main)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-xs text-[var(--text-muted)] block leading-relaxed font-sans mt-1">
                Use this token inside headers to authenticate external live Python capture probes or syslog daemons.
              </span>
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--border-color)] mt-6 space-y-3">
            {isSaved && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs rounded-xl flex items-center gap-1.5 font-bold">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Configuration Saved Successfully!</span>
              </div>
            )}

            <button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              <Save className="h-4 w-4" /> Save System Parameters
            </button>
          </div>
        </div>

      </form>

    </div>
  );
}
