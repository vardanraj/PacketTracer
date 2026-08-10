# Net Observer (PacketTracer)

A real-time network packet capture and analysis dashboard. A React/Node web app displays live network traffic streamed from a Python capture agent running on your machine.

**Live dashboard:** https://net-observer.onrender.com
**Repository:** https://github.com/vardanraj/PacketTracer

---

## How It Works

This project has two separate pieces that work together:

1. **Dashboard (web app)** — a React frontend + Node/Express backend with a WebSocket server. On its own, it runs a built-in traffic **simulator** so the UI has something to display. It switches to **real** mode automatically once a capture agent connects and authenticates.

2. **Capture Agent (`agent/capture_agent.py`)** — a Python + Scapy script that must be run locally, with Administrator/root privileges, on the machine whose traffic you want to observe. It sniffs real packets and streams them to the dashboard over a secure WebSocket.

Only one direction of automation exists: the dashboard can run anywhere (cloud host), but the capture agent must always run on the actual device generating the traffic — no browser or cloud service can access raw network interfaces for security reasons.

---

## Project Structure

```
├── server.js                  # Express + WebSocket backend, packet simulation engine
├── src/                       # React frontend
│   └── lib/services/
│       └── agent-ingestion.js # Agent auth + packet validation logic
├── agent/
│   ├── capture_agent.py       # Core Scapy-based packet sniffer (CLI)
│   ├── tray_app.py            # System tray wrapper with GUI settings (Windows)
│   ├── setup_autostart.bat    # Registers Task Scheduler auto-start (admin required)
│   ├── remove_autostart.bat   # Removes the Task Scheduler auto-start entry
│   └── config.json            # Local agent settings (gitignored — contains your token)
├── .gitignore
└── README.md
```

---

## Getting Started

### 1. Run the dashboard

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. You'll see simulated traffic flowing by default.

### 2. Run the capture agent (CLI method)

Requires Python 3, [Npcap](https://npcap.com) (Windows), and admin/root privileges.

```bash
cd agent
pip install scapy websocket-client
python capture_agent.py --server ws://localhost:3000 --interface <your-interface> --token <your-token>
```

Run with no `--interface` flag to see a list of available interfaces.

Once connected and authenticated, the dashboard automatically switches from simulated to real traffic.

### 3. Run the capture agent (Windows system tray app)

A friendlier alternative to the CLI for Windows users — no need to remember commands.

1. Install dependencies:
   ```powershell
   pip install pystray pillow
   ```
2. Run it once:
   ```powershell
   python agent/tray_app.py
   ```
3. On first launch, a Settings window prompts for your server URL, token, and network interface — saved to `config.json` so you won't need to enter them again.
4. A tray icon appears (green = capturing, grey = idle). Right-click for Start/Stop/Settings/Exit.

**To package as a standalone `.exe`:**
```powershell
pip install pyinstaller
pyinstaller --onefile --windowed --uac-admin --name "NetObserverAgent" tray_app.py
```

**To auto-start silently at login (no UAC prompt each time):**
Run `agent/setup_autostart.bat` as Administrator. This registers a Windows Task Scheduler entry (`/RL HIGHEST`) that launches the agent elevated on every login. Remove it anytime with `agent/remove_autostart.bat`.

---

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `API_TOKEN` | Server environment | Shared secret the capture agent must present to authenticate |
| `CLIENT_URL` | Server environment | Your deployed dashboard URL (used for CORS) |
| `server_url` | `agent/config.json` | WebSocket URL of the dashboard (`ws://` local, `wss://` deployed) |
| `token` | `agent/config.json` | Must match the server's `API_TOKEN` |
| `interface` | `agent/config.json` | Network adapter to sniff — on Windows, use the full device path, e.g. `\\Device\\NPF_{...}`, not a friendly name like "Wi-Fi" |

> **Security note:** The capture agent's token must be at least 8 characters — shorter tokens are rejected by the server's authentication check. Treat your token like a password; it's excluded from version control via `.gitignore`.

---

## Deployment

The dashboard needs a **persistent WebSocket server**, so it cannot run on serverless platforms like Vercel. It's deployed on [Render](https://render.com):

- **Build command:** `npm install && npm run build`
- **Start command:** `npm run start`
- **Environment variables:** `API_TOKEN`, `CLIENT_URL`, `NODE_ENV=production`

Point the capture agent at the deployed URL using `wss://` instead of `ws://`.

---

## Tech Stack

- **Frontend:** React, Tailwind CSS
- **Backend:** Node.js, Express, `ws` (WebSocket)
- **Capture Agent:** Python, Scapy, `websocket-client`
- **Windows Packaging:** PyInstaller, `pystray`, Tkinter
- **Hosting:** Render

---

## Ethical & Legal Notice

This tool captures real network traffic. Only run the capture agent on networks and devices you own, or have explicit written authorization to monitor. Unauthorized packet interception may violate computer crime laws in your jurisdiction.
