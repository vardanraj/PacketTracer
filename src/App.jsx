import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { 
  Activity, Radio, Workflow, Eye, FileText, Settings, BookOpen, LogOut,
  Search, User, Sparkles, Sliders, ChevronRight, X, Maximize2, Minimize2, Command,
  Moon, Sun, RefreshCw, LayoutDashboard, ShieldAlert, Menu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Mock Data imports
import { MOCK_DEVICES, MOCK_SESSIONS, MOCK_ALERTS, MOCK_PACKETS } from "./data/mockData.js";

// Modular sub-views
import LandingPage from "./components/LandingPage.jsx";
import AuthPage from "./components/AuthPage.jsx";
import DashboardOverview from "./components/DashboardOverview.jsx";
import IngestionSection from "./components/IngestionSection.jsx";
import ProtocolInspection from "./components/ProtocolInspection.jsx";
import AlertsPanel from "./components/AlertsPanel.jsx";

// Lazy-loaded telemetry modules
const DeviceExplorer = lazy(() => import("./components/DeviceExplorer.jsx"));
const ReportsPage = lazy(() => import("./components/ReportsPage.jsx"));
const SettingsPage = lazy(() => import("./components/SettingsPage.jsx"));
const DocumentationPage = lazy(() => import("./components/DocumentationPage.jsx"));

const PROTO_COLORS = {
  TCP: "#0284c7",     // Sky Blue
  UDP: "#059669",     // Emerald Green
  ICMP: "#d97706",    // Amber Orange
  HTTP: "#db2777",    // Pink
  HTTPS: "#7c3aed",   // Violet Purple
  DNS: "#0891b2",     // Cyan
  OTHER: "#64748b",   // Slate Gray
};

export default function App() {
  // Theme State (Light by default, toggleable to dark)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark" || 
      window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  // Navigation & Auth Flow States
  const [showLanding, setShowLanding] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [operatorName, setOperatorName] = useState("");
  const [currentView, setCurrentView] = useState("dashboard");

  // Client Customization / Personalization States
  const [isCompact, setIsCompact] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    return localStorage.getItem("onboarding_dismissed") === "true";
  });
  const [activeNotification, setActiveNotification] = useState(null);

  // Ingested Real-Time Stream States
  const [packets, setPackets] = useState([]);
  const [stats, setStats] = useState(null);
  const [, setInterfaces] = useState([]);
  const [serverState, setServerState] = useState({
    isCapturing: true,
    selectedInterface: "en0 (Wi-Fi)",
    captureMode: "simulation",
    connectedAgents: [],
  });

  // Database seed states
  const [devices, setDevices] = useState(MOCK_DEVICES);
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  // Client Control UI States
  const [selectedProtocol, setSelectedProtocol] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const [autoScroll] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("headers");

  // References
  const wsRef = useRef(null);
  const tableEndRef = useRef(null);

  // Global Keyboard Shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setSelectedPacket(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. Fetch REST APIs on launch
  useEffect(() => {
    fetchTelemetry();
    fetchInterfaces();
    fetchPackets();

    const interval = setInterval(() => {
      fetchTelemetry();
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchPackets();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // 2. Resolve WebSocket connection to backend
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-scroll when new live packets land
  useEffect(() => {
    if (autoScroll && tableEndRef.current && !isPaused) {
      tableEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [packets, autoScroll, isPaused]);

  // WebSocket Connector
  const connectWebSocket = () => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const loc = window.location;
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${loc.host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "packet_batch") {
          const newPackets = message.packets;
          if (!isPausedRef.current && Array.isArray(newPackets) && newPackets.length > 0) {
            setPackets((prev) => {
              const existingIds = new Set(prev.map(p => p.id));
              const uniqueNew = newPackets.filter(p => !existingIds.has(p.id));
              if (uniqueNew.length === 0) return prev;
              
              const updated = [...prev, ...uniqueNew];
              if (updated.length > 250) {
                return updated.slice(updated.length - 250);
              }
              return updated;
            });
          }
        } else if (message.type === "packet") {
          const newPacket = message.packet;
          if (!isPausedRef.current) {
            setPackets((prev) => {
              if (prev.some(p => p.id === newPacket.id)) {
                return prev;
              }
              const updated = [...prev, newPacket];
              if (updated.length > 250) {
                return updated.slice(updated.length - 250);
              }
              return updated;
            });
          }
        } else if (message.type === "status_update") {
          setServerState(message.status);
        }
      } catch (err) {
        console.warn("[WS] Parse warning:", err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 5000);
    };

    ws.onerror = (err) => {
      console.log("[WS] Error", err);
      ws.close();
    };
  };

  // REST API Actions
  const fetchInterfaces = async () => {
    try {
      const res = await fetch("/api/interfaces");
      const data = await res.json();
      setInterfaces(data);
    } catch (e) {
      console.error("Failed fetching interfaces", e);
    }
  };

  const fetchPackets = async () => {
    try {
      const res = await fetch("/api/packets?limit=100");
      const data = await res.json();
      const formatted = data.packets.reverse();
      setPackets((prev) => {
        if (formatted.length === 0) return MOCK_PACKETS;
        return formatted;
      });
    } catch (e) {
      console.error("Failed fetching packets", e);
      setPackets(MOCK_PACKETS);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed fetching stats", e);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      setAlerts(data);
    } catch (e) {
      console.error("Failed fetching alerts", e);
    }
  };

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/telemetry");
      const data = await res.json();
      if (data.status) setServerState(data.status);
      if (data.devices) setDevices(data.devices);
      if (data.sessions) setSessions(data.sessions);
      if (data.alerts) setAlerts(data.alerts);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.error("Failed fetching telemetry data", e);
    }
  };

  const handleToggleCapture = async () => {
    const endpoint = serverState.isCapturing ? "/api/capture/stop" : "/api/capture/start";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer demo-token-12345"
        },
        body: JSON.stringify({
          interfaceName: serverState.selectedInterface,
          mode: serverState.captureMode
        })
      });
      const data = await res.json();
      setServerState(data.state);
      fetchStats();
    } catch (e) {
      console.error("Failed toggling capture", e);
    }
  };

  const handleModeChange = async (mode) => {
    try {
      const res = await fetch("/api/capture/start", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer demo-token-12345"
        },
        body: JSON.stringify({
          interfaceName: serverState.selectedInterface,
          mode: mode
        })
      });
      const data = await res.json();
      setServerState(data.state);
      setPackets([]);
      fetchStats();
    } catch (e) {
      console.error("Failed updating capture mode", e);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch("/api/packets/clear", { 
        method: "POST",
        headers: {
          "Authorization": "Bearer demo-token-12345"
        }
      });
      setPackets([]);
      setSelectedPacket(null);
      fetchStats();
    } catch (e) {
      console.error("Failed clearing database", e);
    }
  };

  const handleAcknowledgeAlert = async (id) => {
    try {
      await fetch(`/api/alerts/${id}/acknowledge`, { 
        method: "POST",
        headers: {
          "Authorization": "Bearer demo-token-12345"
        }
      });
      fetchAlerts();
    } catch (e) {
      setAlerts((prev) => 
        prev.map(a => a.id === id ? { ...a, acknowledged: true } : a)
      );
    }
  };

  const handleClearAlerts = async () => {
    try {
      await fetch("/api/alerts/clear", { 
        method: "POST",
        headers: {
          "Authorization": "Bearer demo-token-12345"
        }
      });
      fetchAlerts();
    } catch (e) {
      setAlerts([]);
    }
  };

  // Auth Triggers
  const handleAuthLaunch = (guestMode) => {
    if (guestMode) {
      setOperatorName("guest-playground");
      setIsAuthenticated(true);
      setShowLanding(false);
    } else {
      setShowLanding(false);
    }
  };

  const handleLogin = (name, isDemo) => {
    setOperatorName(isDemo ? "demo-operator" : name);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowLanding(true);
  };

  // Filter & Search Logic
  const filteredPackets = useMemo(() => {
    return packets.filter((packet) => {
      const matchesProtocol = 
        selectedProtocol === "ALL" || 
        packet.protocol.toUpperCase() === selectedProtocol.toUpperCase();
      
      const lowerQuery = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        packet.src_ip.toLowerCase().includes(lowerQuery) ||
        packet.dst_ip.toLowerCase().includes(lowerQuery) ||
        packet.info.toLowerCase().includes(lowerQuery) ||
        packet.src_port?.toString().includes(lowerQuery) ||
        packet.dst_port?.toString().includes(lowerQuery);
      
      return matchesProtocol && matchesSearch;
    });
  }, [packets, selectedProtocol, searchQuery]);

  // Generated dynamic Hex Dump representation
  const renderedHexDump = useMemo(() => {
    if (!selectedPacket) return "";

    if (selectedPacket.details && selectedPacket.details.raw_hex_preview && selectedPacket.details.raw_ascii_preview) {
      const hexBytes = selectedPacket.details.raw_hex_preview.replace(/\.\.\./, "").split(" ");
      const asciiChars = selectedPacket.details.raw_ascii_preview.replace(/\.\.\./, "");
      
      let res = "";
      for (let i = 0; i < hexBytes.length; i += 16) {
        const offset = i.toString(16).padStart(4, "0");
        const hexRow = hexBytes.slice(i, i + 16).join(" ");
        const asciiRow = asciiChars.slice(i, i + 16);
        res += `${offset}  ${hexRow.padEnd(48, " ")}  |${asciiRow}|\n`;
      }
      return res;
    }

    const mockBytes = [];
    mockBytes.push(...[0x00, 0x0c, 0x29, 0xab, 0xcd, 0xef, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x08, 0x00]);
    mockBytes.push(...[0x45, 0x00, (selectedPacket.size >> 8) & 0xff, selectedPacket.size & 0xff]);
    mockBytes.push(...[0x1a, 0x2b, 0x40, 0x00, selectedPacket.details?.ip_ttl || 64, 0x06, 0x00, 0x00]);
    
    const srcParts = selectedPacket.src_ip.split(".").map(Number);
    if (srcParts.length === 4) mockBytes.push(...srcParts);
    else mockBytes.push(192, 168, 1, 142);
    
    const dstParts = selectedPacket.dst_ip.split(".").map(Number);
    if (dstParts.length === 4) mockBytes.push(...dstParts);
    else mockBytes.push(8, 8, 8, 8);

    const sPort = selectedPacket.src_port || 0;
    const dPort = selectedPacket.dst_port || 0;
    mockBytes.push((sPort >> 8) & 0xff, sPort & 0xff);
    mockBytes.push((dPort >> 8) & 0xff, dPort & 0xff);

    let output = "";
    for (let i = 0; i < mockBytes.length; i += 16) {
      const offset = i.toString(16).padStart(4, "0");
      const chunk = mockBytes.slice(i, i + 16);
      const hexPart = chunk.map(b => b.toString(16).padStart(2, "0")).join(" ");
      const asciiPart = chunk.map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ".")).join("");
      output += `${offset}  ${hexPart.padEnd(48, " ")}  |${asciiPart}|\n`;
    }
    return output;
  }, [selectedPacket]);

  if (showLanding) {
    return <LandingPage onLaunch={handleAuthLaunch} />;
  }

  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} onBack={() => setShowLanding(true)} />;
  }

  const executeCommand = (action) => {
    action();
    setCommandPaletteOpen(false);
    setPaletteQuery("");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col font-sans select-none antialiased relative overflow-hidden" id="applet-viewport">
      
      {/* 1. TOP NAVIGATION BAR */}
      {!focusMode && (
        <header className="px-3 sm:px-6 py-3 border-b border-[var(--border-color)] bg-[var(--bg-card)] sticky top-0 z-50 shadow-xs">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Mobile Hamburger Drawer Toggle + Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="md:hidden p-2.5 border border-[var(--border-color)] bg-[var(--bg-card-muted)] hover:bg-[var(--border-color)] rounded-xl text-[var(--text-main)] flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
                title="Toggle Mobile Navigation"
                aria-label="Toggle navigation drawer"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex h-9 w-9 bg-teal-500/10 border border-teal-500/30 rounded-xl items-center justify-center text-teal-600 dark:text-teal-400 cursor-pointer hover:bg-teal-500/20 transition-colors"
                title="Toggle Sidebar"
              >
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5 sm:gap-2">
                  Net<span className="text-teal-600 dark:text-teal-400">Observer</span>
                  <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20 font-bold">
                    v2.5
                  </span>
                </h1>
                <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                  <User className="h-3 w-3 text-teal-500 shrink-0" />
                  <span className="truncate max-w-[100px] sm:max-w-none">Operator: <strong className="text-[var(--text-main)]">{operatorName || "Guest"}</strong></span>
                </p>
              </div>
            </div>

            {/* Desktop Command Palette Input */}
            <div className="hidden md:flex items-center relative max-w-md w-full">
              <Search className="absolute left-3.5 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                readOnly
                onClick={() => setCommandPaletteOpen(true)}
                placeholder="Search telemetry or run commands... (Ctrl+K)"
                className="w-full pl-10 pr-16 py-1.5 text-xs bg-[var(--bg-card-muted)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-muted)] cursor-pointer text-left focus:outline-none hover:border-teal-500/50 transition-colors"
              />
              <span className="absolute right-3 font-mono text-[10px] font-semibold bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">
                ⌘K
              </span>
            </div>

            {/* Quick Actions & Status */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              
              {/* Mobile Search Icon Button */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="md:hidden p-2.5 border border-[var(--border-color)] bg-[var(--bg-card-muted)] hover:bg-[var(--border-color)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Search Command Palette (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* WS Live Dot */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card-muted)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-muted)]">
                <span className={`h-2 w-2 rounded-full ${wsConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span className="font-medium text-[11px]">{wsConnected ? "Live Stream" : "Offline"}</span>
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2.5 sm:p-2 border border-[var(--border-color)] bg-[var(--bg-card-muted)] hover:bg-[var(--border-color)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
              </button>

              {/* Density Toggle Button */}
              <button
                onClick={() => {
                  setIsCompact(!isCompact);
                  setActiveNotification(isCompact ? "Comfortable layout enabled" : "Compact layout enabled");
                  setTimeout(() => setActiveNotification(null), 2000);
                }}
                className={`hidden sm:flex p-2 border rounded-xl cursor-pointer transition-colors ${
                  isCompact 
                    ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400" 
                    : "border-[var(--border-color)] bg-[var(--bg-card-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
                title="Toggle density"
              >
                <Sliders className="h-4 w-4" />
              </button>

              {/* Focus Mode Trigger */}
              <button
                onClick={() => {
                  setFocusMode(true);
                  setActiveNotification("Focus mode active. Press Esc to exit.");
                  setTimeout(() => setActiveNotification(null), 3000);
                }}
                className="hidden sm:flex p-2 border border-[var(--border-color)] bg-[var(--bg-card-muted)] hover:bg-[var(--border-color)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition-colors"
                title="Enter Focus Mode"
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center gap-1.5 cursor-pointer transition-colors min-h-[44px]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* MOBILE NAVIGATION DRAWER OVERLAY */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-72 max-w-[85vw] bg-[var(--bg-card)] border-r border-[var(--border-color)] p-5 flex flex-col justify-between h-full z-10 shadow-2xl overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 bg-teal-500/10 border border-teal-500/30 rounded-lg flex items-center justify-center text-teal-600 dark:text-teal-400">
                      <Activity className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--text-main)]">NetObserver</h2>
                      <span className="text-[10px] text-[var(--text-muted)]">Operator: {operatorName || "Guest"}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileNavOpen(false)}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="space-y-1.5">
                  {[
                    { id: "dashboard", label: "Dashboard SOC", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
                    { id: "capture", label: "Packet Ingestion", icon: <Radio className="h-4.5 w-4.5" /> },
                    { id: "explorer", label: "Device Explorer", icon: <Workflow className="h-4.5 w-4.5" /> },
                    { id: "protocols", label: "Protocol Inspection", icon: <Eye className="h-4.5 w-4.5" /> },
                    { id: "alerts", label: "Security Alerts", icon: <ShieldAlert className="h-4.5 w-4.5" /> },
                    { id: "reports", label: "Audits & Reports", icon: <FileText className="h-4.5 w-4.5" /> },
                    { id: "settings", label: "Settings", icon: <Settings className="h-4.5 w-4.5" /> },
                    { id: "docs", label: "Documentation", icon: <BookOpen className="h-4.5 w-4.5" /> }
                  ].map((nav) => {
                    const isActive = currentView === nav.id;
                    return (
                      <button
                        key={nav.id}
                        onClick={() => {
                          setCurrentView(nav.id);
                          setSelectedPacket(null);
                          setMobileNavOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all flex items-center gap-3 min-h-[44px] cursor-pointer ${
                          isActive 
                            ? "bg-teal-600 text-white shadow-sm" 
                            : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-muted)]"
                        }`}
                      >
                        <span className="shrink-0">{nav.icon}</span>
                        <span>{nav.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-[var(--border-color)]">
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-3 text-xs font-semibold rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Exit Session</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NOTIFICATION TOAST */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-[var(--bg-card)] border border-teal-500/40 text-[var(--text-main)] px-4 py-2 text-xs rounded-xl shadow-lg flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-teal-500" />
              <span className="font-semibold">{activeNotification}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OPERATOR ONBOARDING BANNER */}
      {!onboardingDismissed && !focusMode && (
        <div className="px-6 pt-4 max-w-[1600px] mx-auto w-full z-40">
          <div className="app-card p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-teal-500/30">
            <div className="flex items-center gap-3.5">
              <div className="h-9 w-9 bg-teal-500/10 border border-teal-500/30 rounded-xl text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                  Network Analytics Dashboard Active
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  Press <strong className="text-teal-600 dark:text-teal-400 font-mono">Ctrl+K</strong> to launch command palette.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white cursor-pointer transition-colors"
              >
                Open Palette
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("onboarding_dismissed", "true");
                  setOnboardingDismissed(true);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BODY CONTAINER: Sidebar + Dynamic Panel */}
      <div className="flex-1 flex overflow-hidden z-10 max-w-[1600px] mx-auto w-full">
        
        {/* Sidebar */}
        {!focusMode && (
          <aside 
            className={`transition-all duration-300 ease-in-out border-r border-[var(--border-color)] bg-[var(--bg-card)] p-4 space-y-2 hidden md:flex flex-col justify-between ${
              sidebarCollapsed ? "w-16" : "w-56"
            }`}
            id="applet-sidebar"
          >
            {/* Nav List */}
            <div className="space-y-1">
              {[
                { id: "dashboard", label: "Dashboard SOC", icon: <LayoutDashboard className="h-4 w-4" /> },
                { id: "capture", label: "Packet Ingestion", icon: <Radio className="h-4 w-4" /> },
                { id: "explorer", label: "Device Explorer", icon: <Workflow className="h-4 w-4" /> },
                { id: "protocols", label: "Protocol Inspection", icon: <Eye className="h-4 w-4" /> },
                { id: "alerts", label: "Security Alerts", icon: <ShieldAlert className="h-4 w-4" /> },
                { id: "reports", label: "Audits & Reports", icon: <FileText className="h-4 w-4" /> },
                { id: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
                { id: "docs", label: "Documentation", icon: <BookOpen className="h-4 w-4" /> }
              ].map((nav) => {
                const isActive = currentView === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => { setCurrentView(nav.id); setSelectedPacket(null); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-3 cursor-pointer ${
                      isActive 
                        ? "bg-teal-600 text-white font-bold shadow-sm" 
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-muted)]"
                    }`}
                    title={sidebarCollapsed ? nav.label : ""}
                  >
                    <span className="shrink-0">{nav.icon}</span>
                    {!sidebarCollapsed && <span className="truncate">{nav.label}</span>}
                  </button>
                );
              })}
            </div>

            {/* Sidebar bottom capture nodes telemetry card */}
            {!sidebarCollapsed && (
              <div className="bg-[var(--bg-card-muted)] border border-[var(--border-color)] rounded-xl p-3">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-0.5">
                  Capture Nodes
                </span>
                <span className="text-xl font-bold text-[var(--text-main)]">
                  {serverState.connectedAgents.length}
                </span>
                <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">
                  Active WebSockets
                </span>
              </div>
            )}
          </aside>
        )}

        {/* Center Panel Viewport */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-300 relative ${focusMode ? "z-50" : ""}`} id="applet-center-viewport">
          
          {/* Focus mode floating exit header */}
          {focusMode && (
            <div className="mb-4 flex items-center justify-between app-card p-3">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Radio className="h-4 w-4 animate-pulse" /> Focus Mode Active
              </span>
              <button
                onClick={() => setFocusMode(false)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-card-muted)] cursor-pointer flex items-center gap-1.5"
              >
                <Minimize2 className="h-4 w-4" /> Exit Focus
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
                  <RefreshCw className="h-8 w-8 text-teal-500 animate-spin" />
                  <span className="text-xs font-medium text-[var(--text-muted)]">Loading telemetry module...</span>
                </div>
              }>
                {currentView === "dashboard" && (
                  <DashboardOverview
                    packets={packets}
                    stats={stats}
                    serverState={serverState}
                    onToggleCapture={handleToggleCapture}
                    alerts={alerts}
                    sessions={sessions}
                    devices={devices}
                    onSelectPacket={(pkt) => { setSelectedPacket(pkt); }}
                  />
                )}

                {currentView === "capture" && (
                  <IngestionSection
                    serverState={serverState}
                    onModeChange={handleModeChange}
                    onClearLogs={handleClearLogs}
                  />
                )}

                {currentView === "explorer" && (
                  <DeviceExplorer
                    devices={devices}
                    sessions={sessions}
                    packets={packets}
                  />
                )}

                {currentView === "protocols" && (
                  <ProtocolInspection
                    packets={packets}
                    onSelectPacket={(pkt) => { setSelectedPacket(pkt); }}
                  />
                )}

                {currentView === "alerts" && (
                  <AlertsPanel
                    alerts={alerts}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                    onClearAlerts={handleClearAlerts}
                  />
                )}

                {currentView === "reports" && (
                  <ReportsPage
                    packets={packets}
                    sessions={sessions}
                    alerts={alerts}
                  />
                )}

                {currentView === "settings" && (
                  <SettingsPage
                    serverState={serverState}
                    onClearLogs={handleClearLogs}
                  />
                )}

                {currentView === "docs" && (
                  <DocumentationPage />
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* SECONDARY ROW: LIVE PACKET STREAM PANEL */}
      <section 
        className={`bg-[var(--bg-card)] border-t border-[var(--border-color)] p-4 transition-all duration-300 flex flex-col justify-between relative overflow-hidden ${
          focusMode ? "h-[500px]" : "h-[260px]"
        }`} 
        id="diagnostics-global-stream"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3 mb-3 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
              <Radio className="h-4 w-4 text-teal-500 animate-pulse" /> Network Stream
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
              {filteredPackets.length} in buffer
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
            {/* Search filter input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search IP, port..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs bg-[var(--bg-card-muted)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none w-40"
              />
            </div>
            
            {/* Protocols selector */}
            <div className="flex gap-1 bg-[var(--bg-card-muted)] p-1 rounded-lg border border-[var(--border-color)]">
              {["ALL", "TCP", "UDP", "HTTP", "HTTPS", "DNS"].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedProtocol(p)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                    selectedProtocol === p 
                      ? "bg-teal-600 text-white shadow-xs" 
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Clear and pause stream buttons */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-all border ${
                isPaused 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400" 
                  : "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400"
              }`}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>

            <button
              onClick={handleClearLogs}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-all"
            >
              Purge
            </button>
          </div>
        </div>

        {/* Packet Stream Container (Card view on mobile, Table view on desktop) */}
        <div className="flex-1 overflow-y-auto pr-1 max-w-[1600px] mx-auto w-full">
          
          {/* Mobile Card-per-Row View (<md) */}
          <div className="md:hidden space-y-2 pb-2">
            {filteredPackets.length > 0 ? (
              filteredPackets.map((pkt) => {
                const color = PROTO_COLORS[pkt.protocol] || PROTO_COLORS.OTHER;
                const isSelected = selectedPacket?.id === pkt.id;
                return (
                  <div
                    key={pkt.id}
                    onClick={() => setSelectedPacket(pkt)}
                    className={`p-3 rounded-xl border text-xs font-mono space-y-2 cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-teal-500/10 border-teal-500 shadow-sm" 
                        : "bg-[var(--bg-card-muted)] border-[var(--border-color)] hover:border-teal-500/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-teal-600 dark:text-teal-400">#{pkt.id.slice(-4)}</span>
                        <span 
                          className="px-2 py-0.5 font-mono font-bold text-[10px] rounded text-white"
                          style={{ backgroundColor: color }}
                        >
                          {pkt.protocol}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {pkt.formatted_time ? pkt.formatted_time.split(" ")[1] : ""} • {pkt.size} B
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-teal-600 dark:text-teal-400 font-bold truncate max-w-[130px]">{pkt.src_ip}</span>
                      <ChevronRight className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                      <span className="text-violet-600 dark:text-violet-400 font-bold truncate max-w-[130px]">{pkt.dst_ip}</span>
                    </div>

                    <div className="text-[10px] text-[var(--text-main)] truncate bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]/50">
                      {pkt.info}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-[var(--text-muted)] text-xs font-mono">
                No matching packets inside diagnostic buffer.
              </div>
            )}
          </div>

          {/* Desktop Table View (>=md) */}
          <table className="hidden md:table w-full text-left border-collapse font-mono text-xs">
            <thead className="sticky top-0 bg-[var(--bg-card)] text-[var(--text-muted)] border-b border-[var(--border-color)] z-10 text-[10px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-1.5 px-3 w-16">ID</th>
                <th className="py-1.5 px-3 w-20">Time</th>
                <th className="py-1.5 px-3 w-36">Source</th>
                <th className="py-1.5 px-3 w-36">Destination</th>
                <th className="py-1.5 px-3 w-24">Protocol</th>
                <th className="py-1.5 px-3 w-20 text-right">Size</th>
                <th className="py-1.5 px-4">Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)] text-[var(--text-main)]">
              {filteredPackets.length > 0 ? (
                filteredPackets.map((pkt) => {
                  const color = PROTO_COLORS[pkt.protocol] || PROTO_COLORS.OTHER;
                  const isSelected = selectedPacket?.id === pkt.id;
                  return (
                    <tr 
                      key={pkt.id}
                      onClick={() => setSelectedPacket(pkt)}
                      className={`hover:bg-[var(--bg-card-muted)] cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-teal-500/10 font-bold border-l-2 border-l-teal-500" 
                          : ""
                      } ${isCompact ? "text-[11px] py-0.5" : "py-1.5"}`}
                    >
                      <td className="py-1 px-3 text-teal-600 dark:text-teal-400 font-bold text-[11px]">#{pkt.id.slice(-4)}</td>
                      <td className="py-1 px-3 text-[var(--text-muted)] text-[11px]">{pkt.formatted_time ? pkt.formatted_time.split(" ")[1] : "unknown"}</td>
                      <td className="py-1 px-3 font-semibold text-teal-600 dark:text-teal-400 truncate max-w-[130px]">{pkt.src_ip}</td>
                      <td className="py-1 px-3 font-semibold text-violet-600 dark:text-violet-400 truncate max-w-[130px]">{pkt.dst_ip}</td>
                      <td className="py-1 px-3">
                        <span 
                          className="px-2 py-0.2 font-mono font-bold text-[10px] rounded text-white"
                          style={{ backgroundColor: color }}
                        >
                          {pkt.protocol}
                        </span>
                      </td>
                      <td className="py-1 px-3 text-right text-[var(--text-muted)]">{pkt.size} B</td>
                      <td className="py-1 px-4 text-[var(--text-main)] truncate max-w-[380px]" title={pkt.info}>
                        {pkt.info}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-muted)] text-xs font-mono">
                    No matching packets inside diagnostic buffer.
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={7} style={{ padding: 0, border: 0 }}>
                  <div ref={tableEndRef} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* RIGHT-SIDE SLIDING PACKET INSPECTION DRAWER */}
      <AnimatePresence>
        {selectedPacket && (
          <>
            {/* Background Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPacket(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 pointer-events-auto"
            />

            {/* Sidebar drawer body */}
            <motion.div 
              initial={{ x: "100%", opacity: 0.95 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[500px] bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl z-50 flex flex-col overflow-hidden"
              id="global-inspector-drawer"
            >
              {/* Header section */}
              <div className="p-5 border-b border-[var(--border-color)] flex flex-col gap-3 relative">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 px-2.5 py-1 rounded-lg">
                    Packet #{selectedPacket.id.slice(-6)}
                  </span>
                  
                  <button
                    onClick={() => setSelectedPacket(null)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-muted)] cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">{selectedPacket.src_ip}</span>
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">{selectedPacket.dst_ip}</span>
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed border-l-2 border-teal-500 pl-3 py-1 font-mono bg-[var(--bg-card-muted)] p-2 rounded-r-lg">
                  "{selectedPacket.info}"
                </p>

                {/* Tab selections */}
                <div className="flex items-center gap-1.5 mt-2 bg-[var(--bg-card-muted)] p-1 rounded-xl border border-[var(--border-color)]">
                  {[
                    { id: "headers", label: "Headers" },
                    { id: "hexdump", label: "Hex Dump" },
                    { id: "raw", label: "Raw JSON" }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setInspectorTab(t.id)}
                      className={`text-xs px-3 py-1.5 font-semibold transition-all cursor-pointer flex-1 text-center rounded-lg ${
                        inspectorTab === t.id 
                          ? "bg-teal-600 text-white shadow-xs" 
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Panel */}
              <div className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-5 bg-[var(--bg-card-muted)]">
                
                {/* Protocol flow animation visualization */}
                <div className="app-card p-4">
                  <h6 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Workflow className="h-3.5 w-3.5 text-teal-500" /> Traffic Flow
                  </h6>
                  <div className="relative flex items-center justify-between px-3 py-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
                    <div className="text-center">
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 block truncate max-w-[120px]">{selectedPacket.src_ip}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">Source</span>
                    </div>

                    {/* Animated connecting line */}
                    <div className="flex-1 mx-4 relative h-1 bg-[var(--border-color)] rounded-full">
                      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-0.5 bg-teal-500 rounded-full" />
                      <div className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-teal-400 animate-ping left-1/2" />
                    </div>

                    <div className="text-center">
                      <span className="text-xs font-bold text-violet-600 dark:text-violet-400 block truncate max-w-[120px]">{selectedPacket.dst_ip}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">Destination</span>
                    </div>
                  </div>
                </div>

                {/* Tab 1: Headers */}
                {inspectorTab === "headers" && (
                  <div className="space-y-4">
                    {/* IPv4 Internet Routing Headers */}
                    <div className="app-card p-4 space-y-2">
                      <h5 className="text-teal-600 dark:text-teal-400 text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border-color)] pb-1.5 mb-2 flex items-center justify-between">
                        <span>IPv4 Routing</span>
                        <span className="text-[9px] bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-1.5 py-0.2 rounded font-mono uppercase">Network</span>
                      </h5>
                      <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                        <span className="text-[var(--text-muted)]">Source Host Address:</span> 
                        <span className="text-teal-600 dark:text-teal-400 font-bold">{selectedPacket.src_ip}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                        <span className="text-[var(--text-muted)]">Destination Host Address:</span> 
                        <span className="text-violet-600 dark:text-violet-400 font-bold">{selectedPacket.dst_ip}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                        <span className="text-[var(--text-muted)]">IP Version:</span> 
                        <span className="text-[var(--text-main)]">IPv{selectedPacket.details?.ip_version || 4}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                        <span className="text-[var(--text-muted)]">Time-To-Live:</span> 
                        <span className="text-[var(--text-main)]">{selectedPacket.details?.ip_ttl || 64} hops</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[var(--text-muted)]">Identifier:</span> 
                        <span className="text-[var(--text-main)]">0x{selectedPacket.details?.ip_id?.toString(16).toUpperCase() || "N/A"}</span>
                      </div>
                    </div>

                    {/* Transport Level details */}
                    <div className="app-card p-4 space-y-2">
                      <h5 className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border-color)] pb-1.5 mb-2 flex items-center justify-between">
                        <span>Transport ({selectedPacket.protocol})</span>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono uppercase">Layer 4</span>
                      </h5>
                      {selectedPacket.src_port ? (
                        <>
                          <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                            <span className="text-[var(--text-muted)]">Source Port:</span> 
                            <span className="text-[var(--text-main)]">{selectedPacket.src_port}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                            <span className="text-[var(--text-muted)]">Destination Port:</span> 
                            <span className="text-[var(--text-main)]">{selectedPacket.dst_port}</span>
                          </div>
                          {selectedPacket.details?.tcp_flags && (
                            <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                              <span className="text-[var(--text-muted)]">TCP Flags:</span> 
                              <span className="text-amber-600 dark:text-amber-400 font-bold tracking-wider">{selectedPacket.details.tcp_flags}</span>
                            </div>
                          )}
                          {selectedPacket.details?.tcp_seq !== undefined && (
                            <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                              <span className="text-[var(--text-muted)]">Sequence Number:</span> 
                              <span className="text-[var(--text-main)]">{selectedPacket.details.tcp_seq}</span>
                            </div>
                          )}
                          {selectedPacket.details?.tcp_ack !== undefined && (
                            <div className="flex justify-between py-1">
                              <span className="text-[var(--text-muted)]">Acknowledgment:</span> 
                              <span className="text-[var(--text-main)]">{selectedPacket.details.tcp_ack}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-[var(--text-muted)] text-center py-3 italic">No multiplex ports mapped</div>
                      )}
                    </div>

                    {/* Application Payload decoded details */}
                    <div className="app-card p-4 space-y-2">
                      <h5 className="text-violet-600 dark:text-violet-400 text-[10px] font-bold uppercase tracking-wider border-b border-[var(--border-color)] pb-1.5 mb-2 flex items-center justify-between">
                        <span>Application Payload</span>
                        <span className="text-[9px] bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-1.5 py-0.2 rounded font-mono uppercase">Layer 7</span>
                      </h5>
                      <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                        <span className="text-[var(--text-muted)]">Payload Size:</span> 
                        <span className="text-[var(--text-main)] font-bold">{selectedPacket.size} Bytes</span>
                      </div>
                      {selectedPacket.details?.http_info ? (
                        <>
                          <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                            <span className="text-[var(--text-muted)]">Payload Type:</span> 
                            <span className="text-teal-600 dark:text-teal-400 font-bold">{selectedPacket.details.http_info.type}</span>
                          </div>
                          {selectedPacket.details.http_info.method && (
                            <div className="flex justify-between py-1 border-b border-[var(--border-color)]">
                              <span className="text-[var(--text-muted)]">Method:</span> 
                              <span className="text-teal-600 dark:text-teal-400 font-bold">{selectedPacket.details.http_info.method}</span>
                            </div>
                          )}
                          {selectedPacket.details.http_info.status_code && (
                            <div className="flex justify-between py-1">
                              <span className="text-[var(--text-muted)]">Status Code:</span> 
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedPacket.details.http_info.status_code}</span>
                            </div>
                          )}
                        </>
                      ) : selectedPacket.protocol === "HTTPS" ? (
                        <div className="text-xs text-[var(--text-muted)] leading-normal font-sans py-1">
                          <span className="text-violet-600 dark:text-violet-400 font-bold font-mono text-xs block mb-1">Encrypted TLS Payload</span>
                          HTTPS stream is encrypted. Parsed SNI hostname: <strong className="text-[var(--text-main)] font-mono">api.github.com</strong>
                        </div>
                      ) : (
                        <div className="text-[var(--text-muted)] text-center py-3 italic">No application payload headers decoded</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 2: Hex Dump */}
                {inspectorTab === "hexdump" && (
                  <div className="app-card p-4 space-y-2">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] block mb-2 uppercase tracking-wider">
                      Hexadecimal Representation
                    </span>
                    <div className="bg-slate-900 text-teal-400 p-3.5 rounded-xl max-h-[300px] overflow-y-auto">
                      <pre className="leading-relaxed font-mono text-[10px] whitespace-pre">
                        {renderedHexDump}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Tab 3: JSON Object */}
                {inspectorTab === "raw" && (
                  <div className="app-card p-4 space-y-2">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] block mb-2 uppercase tracking-wider">
                      Native Metadata Object
                    </span>
                    <div className="bg-slate-900 text-teal-300 p-3.5 rounded-xl max-h-[300px] overflow-y-auto">
                      <pre className="leading-relaxed text-[10px] whitespace-pre">
                        {JSON.stringify(selectedPacket, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* GLOBAL COMMAND PALETTE MODAL (Ctrl+K menu) */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommandPaletteOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 pointer-events-auto"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="fixed top-28 left-1/2 transform -translate-x-1/2 max-w-xl w-full mx-4 z-50 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Search input inside palette */}
              <div className="flex items-center p-4 border-b border-[var(--border-color)]">
                <Command className="h-5 w-5 text-teal-500 shrink-0 mr-3 animate-pulse" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type a protocol name, view name, or command..."
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  className="w-full text-sm bg-transparent focus:outline-none text-[var(--text-main)] placeholder-[var(--text-muted)]"
                />
                <button
                  onClick={() => setCommandPaletteOpen(false)}
                  className="text-xs text-[var(--text-muted)] bg-[var(--bg-card-muted)] border border-[var(--border-color)] px-2 py-1 rounded-lg font-mono"
                >
                  ESC
                </button>
              </div>

              {/* Action commands search listing */}
              <div className="p-3 max-h-[320px] overflow-y-auto space-y-1 font-sans text-xs">
                
                {/* Protocol filter commands */}
                <div className="px-3 py-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                  Filter Telemetry
                </div>
                {[
                  { name: "Show All Protocols (ALL)", shortcut: "A", action: () => setSelectedProtocol("ALL") },
                  { name: "Filter by TCP", shortcut: "T", action: () => setSelectedProtocol("TCP") },
                  { name: "Filter by UDP", shortcut: "U", action: () => setSelectedProtocol("UDP") },
                  { name: "Filter by HTTPS", shortcut: "S", action: () => setSelectedProtocol("HTTPS") },
                  { name: "Filter by DNS", shortcut: "D", action: () => setSelectedProtocol("DNS") }
                ].filter(cmd => cmd.name.toLowerCase().includes(paletteQuery.toLowerCase())).map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => executeCommand(cmd.action)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--bg-card-muted)] text-[var(--text-main)] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-teal-500" />
                      <span>{cmd.name}</span>
                    </div>
                    <span className="text-[10px] bg-[var(--bg-card-muted)] border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">{cmd.shortcut}</span>
                  </button>
                ))}

                {/* Navigation commands */}
                <div className="px-3 py-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold pt-2">
                  Navigation
                </div>
                {[
                  { name: "Dashboard SOC", view: "dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                  { name: "Packet Ingestion", view: "capture", icon: <Radio className="h-4 w-4" /> },
                  { name: "Device Explorer", view: "explorer", icon: <Workflow className="h-4 w-4" /> },
                  { name: "Protocol Inspection", view: "protocols", icon: <Eye className="h-4 w-4" /> },
                  { name: "Threat Incident Reports", view: "alerts", icon: <ShieldAlert className="h-4 w-4" /> },
                  { name: "Audits & Reports", view: "reports", icon: <FileText className="h-4 w-4" /> },
                  { name: "Settings Portal", view: "settings", icon: <Settings className="h-4 w-4" /> },
                  { name: "Documentation", view: "docs", icon: <BookOpen className="h-4 w-4" /> }
                ].filter(cmd => cmd.name.toLowerCase().includes(paletteQuery.toLowerCase())).map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => executeCommand(() => { setCurrentView(cmd.view); setSelectedPacket(null); })}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--bg-card-muted)] text-[var(--text-main)] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-teal-500">{cmd.icon}</span>
                      <span>{cmd.name}</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">Go</span>
                  </button>
                ))}

                {/* Capture commands */}
                <div className="px-3 py-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold pt-2">
                  System Actions
                </div>
                {[
                  { name: "Start Capture", action: () => { if (!serverState.isCapturing) handleToggleCapture(); } },
                  { name: "Stop Capture", action: () => { if (serverState.isCapturing) handleToggleCapture(); } },
                  { name: "Purge Database Diagnostic Logs", action: handleClearLogs },
                  { name: "Clear Security Incident Alerts", action: handleClearAlerts },
                  { name: "Toggle Compact Layout Density", action: () => setIsCompact(!isCompact) },
                  { name: "Toggle Light/Dark Theme", action: toggleTheme },
                  { name: "Show Onboarding Guide", action: () => { setOnboardingDismissed(false); localStorage.removeItem("onboarding_dismissed"); } }
                ].filter(cmd => cmd.name.toLowerCase().includes(paletteQuery.toLowerCase())).map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => executeCommand(cmd.action)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--bg-card-muted)] text-[var(--text-main)] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span>{cmd.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Run</span>
                  </button>
                ))}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
