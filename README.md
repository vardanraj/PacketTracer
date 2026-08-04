# Net-Observer: Network Packet Collector & Analyzer

A high-performance, browser-accessible network packet capturing and analytics platform. Net-Observer operates on a decoupled client-agent architecture, allowing developers, security researchers, and students to aggregate, filter, and inspect raw packet metadata flowing across distributed interfaces.

---

## 🚀 Architecture Overview

1. **Python Capture Agent (`agent/capture_agent.py`)**:
   - Built on top of `scapy`.
   - Sniffs raw Ethernet frames on selected network interfaces.
   - Extracts packet headers (IP version, TTL, Identification, Ports, TCP Flags, Seq/Ack) and maps payloads.
   - Parses unencrypted HTTP metadata (Methods, Hosts, Paths) or DNS queries.
   - Decoupled: streams JSON metadata structures in real-time over WebSockets to the server.
2. **Central Dashboard Backend (`server.ts`)**:
   - Custom Node.js Express server running on port `3000`.
   - Dual-Mode: Features a built-in realistic **Traffic Simulation Engine** for testing when offline or in restricted cloud sandboxes (such as Google Cloud Run).
   - In-memory circular sliding-window buffer database to prevent memory bloat.
   - REST API endpoints for telemetry rates (PPS, Speed), protocol counts, and talkers.
3. **Frontend Dashboard UX (`src/App.tsx`)**:
   - Beautiful dark-theme tactical UI (Grafana/Wireshark hybrid).
   - Interactive stream with a play/pause switch, auto-scrolling, and protocol filter pills.
   - Bento-grid layout presenting Pie, Area, and Bar analytics charts from `Recharts`.
   - Packet Inspector: 3-tab drawer containing a header fields dictionary, styled Wireshark-like hexadecimal text dump, and raw JSON schema explorer.

---

## 🛠️ System Requirements & Prerequisites

### 1. Operating System & Capture Libraries
Raw sockets capturing requires access to local network device stacks. Install the driver matching your operating system:

* **Linux**:
  - Requires `libpcap` to capture packets:
    ```bash
    sudo apt-get update && sudo apt-get install -y libpcap-dev tcpdump
    ```
* **MacOS**:
  - MacOS has native libpcap drivers. No extra drivers are needed.
* **Windows**:
  - Requires **Npcap** or **WinPcap** drivers to listen to local Ethernet/Wi-Fi devices.
  - Download and install [Npcap](https://npcap.com/) (select "Install Npcap in WinPcap API-compatible mode" during setup).

### 2. Software Runtimes
- **Backend/Frontend**: Node.js v18+ & npm.
- **Capture Agent**: Python 3.8+.

---

## 📦 Local Installation & Setup

### Step 1: Clone the Repository & Install Dependencies
1. Extract or clone this directory.
2. Install Node.js workspace dependencies:
   ```bash
   npm install
   ```

### Step 2: Install Python dependencies
On the machine executing the capture agent (the monitored device):
```bash
pip install scapy websocket-client
```

---

## 🚦 Running the Application

### 1. Start the Full-Stack Server & Dashboard (on Port 3000)
Run the development command. This starts the unified Express server and mounts the React SPA client:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser. By default, the server runs in **Simulation Mode**, populating charts with realistic fake telemetry so you can explore the UI immediately.

### 2. Launch the Local Capture Agent (Sudo/Admin Required)
Ensure the Express server is active. On your monitored host, execute the agent to sniff real traffic and stream it to the dashboard.

* **Linux / MacOS**:
  ```bash
  # Automatically select the default interface
  sudo python3 agent/capture_agent.py --server ws://localhost:3000

  # Or list and choose a specific interface (e.g., eth0 or en0)
  sudo python3 agent/capture_agent.py --server ws://localhost:3000 --interface en0
  ```

* **Windows** (Open PowerShell / Command Prompt as Administrator):
  ```powershell
  python agent/capture_agent.py --server ws://localhost:3000 --interface "Ethernet"
  ```

Once connected, the backend will automatically transition from "Simulation" to "Real Agent" mode, and you will see your live home network traffic appear on screen!

---

## 🔐 Ethical Security Auditing Mandate

* **Explicit Ownership**: Only capture traffic on interfaces you own, or where you possess explicit, written security engineering authorization from the net owner. Sniffing unauthorized environments is a severe breach of international computer crime laws.
* **Confidentiality Safe-Guards**: Net-Observer does not support, nor will ever support, TLS session decryption. Encrypted HTTPS traffic is analyzed strictly from metadata envelope properties (such as SNI server names). No full user packet payloads are preserved long-term.

---

## 🗺️ Engineering Future Roadmap

1. **GeoIP Host Localization**:
   - Integrate an offline database lookup (e.g. MaxMind GeoLite2) to automatically parse public IPs, displaying geographic locations on a dynamic SVG maps panel.
2. **Anomalous Intrusion Alerts**:
   - Construct statistical machine learning alert triggers detecting port-scans (rapid SYN requests on sequential ports) or bandwidth spikes indicative of DDOS.
3. **PCAP Capture Export**:
   - Implement backend file creation allowing users to click "Export session" and download a standardized `.pcap` binary file to open directly inside Wireshark.
4. **Agent Group Management**:
   - Refactor the backend to support multiple, concurrent Capture Agents, mapping a distributed topology layout of an entire enterprise network onto a central collaborative dashboard.
