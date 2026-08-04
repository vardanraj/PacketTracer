import { useState } from "react";
import { Lock, User, Eye, EyeOff, ShieldCheck, Terminal, AlertCircle, ArrowRight, Sun, Moon } from "lucide-react";

export default function AuthPage({ onLogin, onBack, isDarkMode = false, onToggleTheme }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please provide a valid operator identity code.");
      return;
    }
    if (!password || password.length < 5) {
      setError("Passphrase must be at least 5 characters for SOC compliance.");
      return;
    }

    setError("");
    onLogin(username, false);
  };

  const handleDemoLogin = () => {
    onLogin("demo-operator", true);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex flex-col justify-center items-center px-4 relative overflow-hidden transition-colors">
      
      {/* Background Gradient Blob Glow (Teal-to-Violet-to-Magenta) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[450px] pointer-events-none opacity-30 dark:opacity-25 blur-[80px] z-0 overflow-hidden">
        <div className="w-full h-full rounded-full bg-gradient-to-r from-[#2DD4BF] via-[#A855F7] to-[#C026D3] animate-blob transform-gpu" />
      </div>

      {/* Top Header Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            title="Toggle Light / Dark Mode"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>
        )}
      </div>

      {/* Hero Glass Card Container */}
      <div className="w-full max-w-md hero-glass-card rounded-2xl p-8 relative z-10 shadow-2xl">
        
        {/* Back navigation */}
        <button 
          onClick={onBack}
          className="text-xs font-semibold text-[var(--text-muted)] hover:text-teal-600 dark:hover:text-teal-400 mb-6 transition-colors flex items-center gap-1 cursor-pointer"
        >
          ← Exit Gateway
        </button>

        {/* Brand / Logo */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/30 items-center justify-center text-teal-600 dark:text-teal-400 mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
            Operator <span className="text-teal-600 dark:text-teal-400">Sign-In</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] font-sans max-w-xs mx-auto">
            Authorized network administrators only. Compliance logs are audited.
          </p>
          <div className="mt-2 inline-block px-3 py-1 bg-teal-500/10 border border-teal-500/30 rounded-full text-teal-600 dark:text-teal-300 text-[10px] font-mono font-bold uppercase tracking-wider">
            Playground Session Mode Active
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identity */}
          <div className="space-y-1.5 font-sans">
            <label className="text-xs font-semibold text-[var(--text-muted)] block">Operator ID / Username</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. net-engineer-42"
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-teal-500 text-xs rounded-xl pl-10 pr-4 py-3 text-[var(--text-main)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Passphrase */}
          <div className="space-y-1.5 font-sans">
            <label className="text-xs font-semibold text-[var(--text-muted)] block">Compliance Passphrase</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-teal-500 text-xs rounded-xl pl-10 pr-10 py-3 text-[var(--text-main)] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md mt-2"
          >
            {isRegistering ? "Create Credentials" : "Authorize & Connect"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border-color)]" /></div>
          <span className="relative bg-[var(--bg-card)] px-3 text-[10px] font-mono text-[var(--text-muted)] font-bold uppercase tracking-widest">OR</span>
        </div>

        {/* Demo Login Mode */}
        <button
          onClick={handleDemoLogin}
          className="w-full bg-[var(--bg-card-muted)] hover:bg-[var(--border-color)] text-[var(--text-main)] font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors border border-[var(--border-color)]"
        >
          <Terminal className="h-4 w-4 text-teal-500" /> Bypass Auth (Guest Playground)
        </button>

        <div className="mt-6 flex justify-between text-[10px] font-mono text-[var(--text-muted)] border-t border-[var(--border-color)] pt-4">
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="hover:text-teal-500"
          >
            {isRegistering ? "Back to Sign In" : "Register Credentials"}
          </button>
          <span>SLA Compliance v2.5</span>
        </div>

      </div>

      <div className="mt-8 flex items-center gap-2 text-[var(--text-muted)] font-sans text-xs font-medium">
        <ShieldCheck className="h-4 w-4 text-teal-500" /> Secure Observability Gateway
      </div>
    </div>
  );
}
