#!/usr/bin/env python3
"""
================================================================================
NETWORK PACKET COLLECTOR & ANALYZER - CAPTURE AGENT
================================================================================
This script captures network traffic from a selected network interface and streams
the packet metadata to the central dashboard server via WebSockets.

Requirements:
    pip install scapy websocket-client

Usage (requires elevated privileges/root):
    sudo python3 capture_agent.py --server ws://localhost:3000 --interface eth0

Ethics & Security Notice:
    This tool is intended for educational, diagnostics, and network administration
    purposes. You must only capture traffic on network interfaces and networks that
    you own or have explicit, written authorization to monitor. Unauthorized packet
    sniffing may violate local, national, and international laws.
================================================================================
"""

import os
import sys
import json
import time
import argparse
import threading
import signal
from datetime import datetime

# Attempt to import scapy.
try:
    from scapy.all import sniff, IP, IPv6, TCP, UDP, ICMP, Raw, get_if_list
except ImportError:
    print("[ERROR] Scapy is not installed. Please install it with: pip install scapy", file=sys.stderr)
    sys.exit(1)

# Attempt to import websocket-client.
try:
    import websocket
except ImportError:
    print("[ERROR] websocket-client is not installed. Please install it with: pip install websocket-client", file=sys.stderr)
    sys.exit(1)


class PacketCaptureAgent:
    def __init__(self, server_url, interface, bpf_filter=None, token=None):
        self.server_url = server_url
        self.interface = interface
        self.bpf_filter = bpf_filter
        self.token = token
        self.ws = None
        self.connected = False
        self.running = True
        self.base_delay = 2
        self.max_delay = 60
        self.reconnect_attempt = 0
        
        # Stat tracking
        self.packets_captured = 0
        self.packets_sent = 0

    def connect_websocket(self):
        """Establishes connection to the central dashboard server with exponential backoff."""
        while self.running:
            try:
                print(f"[*] Connecting to dashboard server at {self.server_url}...")
                websocket.enableTrace(False)
                self.ws = websocket.WebSocketApp(
                    self.server_url,
                    on_open=self.on_open,
                    on_message=self.on_message,
                    on_error=self.on_error,
                    on_close=self.on_close
                )
                
                # Run the WebSocket loop in a blocking manner
                self.ws.run_forever()
            except Exception as e:
                print(f"[!] WebSocket loop error: {e}")
            
            if not self.running:
                break
            
            self.reconnect_attempt += 1
            delay = min(self.max_delay, self.base_delay * (2 ** self.reconnect_attempt))
            print(f"[*] Disconnected. Retrying connection in {delay} seconds (attempt {self.reconnect_attempt})...")
            
            # Sleep in tiny increments so shutdown is instant
            for _ in range(int(delay)):
                if not self.running:
                    break
                time.sleep(1)

    def on_open(self, ws):
        print("[+] WebSocket connection established successfully!")
        self.connected = True
        self.reconnect_attempt = 0  # Reset backoff attempt count on successful connection
        # Send a registration/handshake message to declare that we are a Capture Agent
        handshake = {
            "type": "agent_handshake",
            "agent_name": "Python Scapy Capture Agent",
            "interface": self.interface,
            "token": self.token,
            "timestamp": time.time()
        }
        self.ws.send(json.dumps(handshake))

    def on_message(self, ws, message):
        """Handle control messages from the dashboard server (e.g., stopping/starting the sniff)."""
        try:
            data = json.loads(message)
            print(f"[*] Received control message: {data}")
            # If the backend issues start/stop capturing, we can toggle sniff filters or state.
        except Exception as e:
            print(f"[!] Error parsing message from server: {e}")

    def on_error(self, ws, error):
        print(f"[!] WebSocket connection error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        print(f"[-] WebSocket connection closed. Status: {close_status_code}, Msg: {close_msg}")
        self.connected = False

    def extract_http_info(self, payload):
        """Simple heuristic parser to extract unencrypted HTTP metadata."""
        try:
            decoded = payload.decode('utf-8', errors='ignore')
            lines = decoded.split('\r\n')
            if not lines:
                return None
                
            # Check for HTTP Request (GET, POST, etc.)
            methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
            first_line_parts = lines[0].split()
            if len(first_line_parts) >= 3 and first_line_parts[0] in methods:
                method = first_line_parts[0]
                path = first_line_parts[1]
                
                host = "Unknown"
                user_agent = "Unknown"
                for line in lines[1:]:
                    if line.lower().startswith("host:"):
                        host = line.split(":", 1)[1].strip()
                    elif line.lower().startswith("user-agent:"):
                        user_agent = line.split(":", 1)[1].strip()
                
                return {
                    "type": "HTTP_REQUEST",
                    "method": method,
                    "host": host,
                    "path": path,
                    "user_agent": user_agent
                }
            
            # Check for HTTP Response
            if first_line_parts and first_line_parts[0].startswith("HTTP/"):
                status_code = first_line_parts[1] if len(first_line_parts) > 1 else "Unknown"
                phrase = " ".join(first_line_parts[2:]) if len(first_line_parts) > 2 else ""
                return {
                    "type": "HTTP_RESPONSE",
                    "status_code": status_code,
                    "phrase": phrase
                }
        except Exception:
            pass
        return None

    def process_packet(self, packet):
        """Analyzes a captured Scapy packet, extracts metadata, and enqueues it for streaming."""
        self.packets_captured += 1
        
        # Build base metadata
        packet_meta = {
            "timestamp": time.time(),
            "formatted_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
            "size": len(packet),
            "protocol": "OTHER",
            "src_ip": "Unknown",
            "dst_ip": "Unknown",
            "src_port": None,
            "dst_port": None,
            "info": "",
            "details": {}
        }

        # --- NETWORK LAYER (IP/IPv6) ---
        has_ip = False
        if IP in packet:
            packet_meta["src_ip"] = packet[IP].src
            packet_meta["dst_ip"] = packet[IP].dst
            packet_meta["details"]["ip_version"] = 4
            packet_meta["details"]["ip_ttl"] = packet[IP].ttl
            packet_meta["details"]["ip_id"] = packet[IP].id
            has_ip = True
        elif IPv6 in packet:
            packet_meta["src_ip"] = packet[IPv6].src
            packet_meta["dst_ip"] = packet[IPv6].dst
            packet_meta["details"]["ip_version"] = 6
            packet_meta["details"]["ip_ttl"] = packet[IPv6].hlim
            has_ip = True

        # --- TRANSPORT LAYER (TCP/UDP/ICMP) ---
        if TCP in packet:
            packet_meta["protocol"] = "TCP"
            packet_meta["src_port"] = packet[TCP].sport
            packet_meta["dst_port"] = packet[TCP].dport
            
            # TCP Flags parsing
            flags = packet[TCP].underlayer.sprintf("%TCP.flags%")
            # scapy sprintf flags representation or native flags integer
            flags_int = packet[TCP].flags
            flags_list = []
            flag_map = {
                0x01: "FIN", 0x02: "SYN", 0x04: "RST", 0x08: "PSH",
                0x10: "ACK", 0x20: "URG", 0x40: "ECE", 0x80: "CWR"
            }
            for bit, name in flag_map.items():
                if flags_int & bit:
                    flags_list.append(name)
            
            flags_str = "+".join(flags_list) if flags_list else "None"
            packet_meta["details"]["tcp_seq"] = packet[TCP].seq
            packet_meta["details"]["tcp_ack"] = packet[TCP].ack
            packet_meta["details"]["tcp_flags"] = flags_str
            packet_meta["info"] = f"Seq={packet[TCP].seq} Ack={packet[TCP].ack} Flags=[{flags_str}]"
            
            # Application-level heuristics
            if packet_meta["src_port"] == 80 or packet_meta["dst_port"] == 80:
                packet_meta["protocol"] = "HTTP"
            elif packet_meta["src_port"] == 443 or packet_meta["dst_port"] == 443:
                packet_meta["protocol"] = "HTTPS"

        elif UDP in packet:
            packet_meta["protocol"] = "UDP"
            packet_meta["src_port"] = packet[UDP].sport
            packet_meta["dst_port"] = packet[UDP].dport
            packet_meta["details"]["udp_len"] = packet[UDP].len
            packet_meta["info"] = f"Len={packet[UDP].len}"
            
            # Common UDP Application ports
            if packet_meta["src_port"] == 53 or packet_meta["dst_port"] == 53:
                packet_meta["protocol"] = "DNS"
            elif packet_meta["src_port"] == 67 or packet_meta["dst_port"] == 67 or packet_meta["src_port"] == 68 or packet_meta["dst_port"] == 68:
                packet_meta["protocol"] = "DHCP"
            elif packet_meta["src_port"] == 123 or packet_meta["dst_port"] == 123:
                packet_meta["protocol"] = "NTP"

        elif ICMP in packet:
            packet_meta["protocol"] = "ICMP"
            packet_meta["details"]["icmp_type"] = packet[ICMP].type
            packet_meta["details"]["icmp_code"] = packet[ICMP].code
            packet_meta["info"] = f"Type={packet[ICMP].type} Code={packet[ICMP].code}"

        # --- APPLICATION LAYER / RAW PAYLOAD SNIPPETS ---
        if Raw in packet:
            raw_payload = packet[Raw].load
            # Grab a hex/text preview
            preview_len = min(64, len(raw_payload))
            hex_preview = " ".join(f"{b:02x}" for b in raw_payload[:preview_len])
            ascii_preview = "".join(chr(b) if 32 <= b < 127 else "." for b in raw_payload[:preview_len])
            
            packet_meta["details"]["raw_hex_preview"] = hex_preview + ("..." if len(raw_payload) > preview_len else "")
            packet_meta["details"]["raw_ascii_preview"] = ascii_preview + ("..." if len(raw_payload) > preview_len else "")
            packet_meta["details"]["payload_len"] = len(raw_payload)

            # Heuristics for HTTP metadata on port 80
            if packet_meta["protocol"] == "HTTP":
                http_info = self.extract_http_info(raw_payload)
                if http_info:
                    packet_meta["details"]["http_info"] = http_info
                    if http_info["type"] == "HTTP_REQUEST":
                        packet_meta["info"] = f"HTTP {http_info['method']} {http_info['host']}{http_info['path']}"
                    elif http_info["type"] == "HTTP_RESPONSE":
                        packet_meta["info"] = f"HTTP/1.x Response Status={http_info['status_code']} ({http_info['phrase']})"

        # If it's DNS, try to parse basic query
        if packet_meta["protocol"] == "DNS" and packet_meta["info"] == f"Len={packet[UDP].len}":
            # DNS is highly nested, but let's give a friendly label if we can
            packet_meta["info"] = "DNS Query/Response"

        # Stream the packet JSON metadata over WebSocket
        if self.connected and self.ws:
            try:
                payload = {
                    "type": "packet",
                    "packet": packet_meta
                }
                self.ws.send(json.dumps(payload))
                self.packets_sent += 1
            except Exception as e:
                # Connection might have dropped mid-send
                self.connected = False
                print(f"[!] Error sending packet over WebSocket: {e}")

    def start_capture(self):
        """Starts sniffing network packets."""
        print(f"[*] Starting packet capture on interface: '{self.interface}'")
        if self.bpf_filter:
            print(f"[*] Applying BPF Filter: '{self.bpf_filter}'")

        def scapy_sniffer():
            try:
                sniff(
                    iface=self.interface,
                    prn=self.process_packet,
                    filter=self.bpf_filter,
                    store=0,
                    stop_filter=lambda x: not self.running
                )
            except Exception as e:
                print(f"[!] Fatal Sniffer Error: {e}")
                print("[!] Did you run this script with elevated privileges (sudo/Administrator)?")
                self.running = False

        sniffer_thread = threading.Thread(target=scapy_sniffer, daemon=True)
        sniffer_thread.start()

        # Keep parent thread alive and manage status reports
        last_report = time.time()
        while self.running:
            try:
                time.sleep(1)
                now = time.time()
                if now - last_report >= 5:
                    print(f"[*] Status: Captured={self.packets_captured}, Streamed={self.packets_sent}, Active={self.connected}")
                    last_report = now
            except KeyboardInterrupt:
                print("\n[-] KeyboardInterrupt received. Shutting down capture agent...")
                self.running = False
                break

        # Cleanup WS
        if self.ws:
            self.ws.close()
        print("[*] Capture agent finished.")


def main():
    # Print safety disclaimer prominently
    print("=" * 80)
    print("               SECURITY AND ETHICAL USAGE NOTICE - PLEASE READ               ")
    print("=" * 80)
    print("This packet capture agent is designed to inspect real-time network packets.")
    print("By executing this software, you confirm that:")
    print("  1. You own the host machine and the network being monitored, OR")
    print("  2. You have explicit, written authorization from the owner to intercept packets.")
    print("Unauthorized intercept of network traffic violates computer crime laws and is illegal.")
    print("=" * 80)
    
    # Retrieve interfaces for informational purposes
    try:
        available_ifs = get_if_list()
    except Exception:
        available_ifs = ["Unable to list (insufficient privileges)"]

    parser = argparse.ArgumentParser(description="Live Packet Capture Agent for the Network Observability Dashboard")
    parser.add_argument("--server", default="ws://localhost:3000", help="URL of the central web dashboard server")
    parser.add_argument("--interface", help="Network interface to sniff on (e.g. eth0, wlan0, en0)")
    parser.add_argument("--filter", default=None, help="BPF Filter string (e.g., 'tcp', 'udp port 53')")
    parser.add_argument("--token", default="demo-token-12345", help="API token for agent authentication")
    
    args = parser.parse_args()

    # Determine default interface if none provided
    selected_if = args.interface
    if not selected_if:
        print("[!] No interface specified. Available interfaces:")
        for idx, face in enumerate(available_ifs):
            print(f"  [{idx}] {face}")
        
        if len(available_ifs) > 0 and available_ifs[0] != "Unable to list (insufficient privileges)":
            selected_if = available_ifs[0]
            print(f"[*] Automatically selecting first interface: {selected_if}")
        else:
            print("[ERROR] No valid interface selected. Run with --interface <name>.")
            sys.exit(1)

    # Confirm capture script is run as root on Unix platforms
    if os.name != 'nt' and os.geteuid() != 0:
        print("[WARNING] You are not running as root. Raw packet capture WILL FAIL on Unix-like operating systems.")
        print("Please run using sudo: sudo python3 capture_agent.py ...\n")
        
        # We will continue just in case they have capabilities configured, but print prominent warning
        confirm = input("Continue anyway? (y/N): ").strip().lower()
        if confirm != 'y':
            sys.exit(1)

    agent = PacketCaptureAgent(
        server_url=args.server,
        interface=selected_if,
        bpf_filter=args.filter,
        token=args.token
    )

    def signal_handler(sig, frame):
        print("\n[-] Signal received. Shutting down capture agent gracefully...")
        agent.running = False
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Start WebSocket connection thread
    ws_thread = threading.Thread(target=agent.connect_websocket, daemon=True)
    ws_thread.start()

    # Start packet sniffer loop (blocking)
    agent.start_capture()


if __name__ == "__main__":
    main()
