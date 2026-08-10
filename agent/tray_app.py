#!/usr/bin/env python3
"""
================================================================================
NETOBSERVER AGENT - WINDOWS SYSTEM TRAY APPLICATION
================================================================================
A background Windows system tray application that wraps PacketCaptureAgent,
providing:
 1. System tray icon with live status (Capturing / Idle / Disconnected).
 2. Automatic popup configuration window on first run if config.json is missing.
 3. Context menu for Start/Stop capture, Settings dialog, and Exit.
================================================================================
"""

import os
import sys
import json
import time
import threading
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageDraw

# Import PacketCaptureAgent from local capture_agent module
try:
    from capture_agent import PacketCaptureAgent
except ImportError:
    # If running from PyInstaller frozen bundle or flat dir
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from capture_agent import PacketCaptureAgent

try:
    from scapy.all import get_if_list, conf
except ImportError:
    get_if_list = lambda: ["Default Interface"]
    conf = None

import pystray
from pystray import MenuItem as item


def get_app_dir():
    """Get directory where executable or script is located."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def get_config_path():
    """Return path to config.json."""
    return os.path.join(get_app_dir(), "config.json")


def load_config():
    """Load configuration from config.json if present."""
    config_path = get_config_path()
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Failed to read config file: {e}")
    return None


def save_config(config_data):
    """Save configuration to config.json."""
    config_path = get_config_path()
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=4)
        return True
    except Exception as e:
        print(f"[!] Failed to write config file: {e}")
        return False


def get_network_interfaces():
    """Retrieve list of friendly network interface names for Windows/Scapy."""
    interfaces = []
    try:
        if conf and hasattr(conf, 'ifaces'):
            for iface_key, iface_obj in conf.ifaces.items():
                name = getattr(iface_obj, 'name', None) or getattr(iface_obj, 'description', None) or str(iface_key)
                if name not in interfaces:
                    interfaces.append(name)
        if not interfaces:
            interfaces = get_if_list()
    except Exception as e:
        print(f"[!] Error detecting interfaces: {e}")
        interfaces = get_if_list()
    
    if not interfaces:
        interfaces = ["eth0", "wlan0", "Ethernet", "Wi-Fi"]
    return sorted(list(set(interfaces)))


def create_tray_icon_image(status="idle"):
    """Create dynamic system tray icon badge using Pillow."""
    width, height = 64, 64
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Outer dark shield background
    draw.ellipse((4, 4, 60, 60), fill=(26, 32, 44, 255), outline=(74, 85, 104, 255), width=3)
    
    # Inner status dot
    if status == "capturing":
        color = (48, 209, 88, 255)    # Emerald Green
    elif status == "connecting":
        color = (255, 214, 10, 255)   # Amber Yellow
    else:
        color = (255, 69, 58, 255)    # Red / Gray
        
    draw.ellipse((20, 20, 44, 44), fill=color)
    return image


class SettingsWindow:
    """Tkinter Settings GUI window for NetObserver Agent."""
    def __init__(self, current_config=None, on_save_callback=None):
        self.current_config = current_config or {}
        self.on_save_callback = on_save_callback
        self.result = None

    def show(self):
        root = tk.Tk()
        root.title("NetObserver Agent - Settings")
        root.geometry("460x380")
        root.resizable(False, False)
        
        # Center the window on screen
        root.update_idletasks()
        width = root.winfo_width()
        height = root.winfo_height()
        x = (root.winfo_screenwidth() // 2) - (width // 2)
        y = (root.winfo_screenheight() // 2) - (height // 2)
        root.geometry(f'{width}x{height}+{x}+{y}')

        # Styling
        style = ttk.Style()
        style.theme_use('clam')

        main_frame = ttk.Frame(root, padding="20 20 20 20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Header Title
        title_label = ttk.Label(
            main_frame,
            text="NetObserver Packet Agent Setup",
            font=("Segoe UI", 14, "bold")
        )
        title_label.pack(anchor=tk.W, pady=(0, 5))

        subtitle_label = ttk.Label(
            main_frame,
            text="Configure server connection and network interface for packet capture.",
            font=("Segoe UI", 9)
        )
        subtitle_label.pack(anchor=tk.W, pady=(0, 15))

        # Form Fields
        fields_frame = ttk.Frame(main_frame)
        fields_frame.pack(fill=tk.X, expand=True)

        # 1. Server URL
        ttk.Label(fields_frame, text="Server WebSocket URL:", font=("Segoe UI", 9, "bold")).pack(anchor=tk.W, pady=(5, 2))
        server_entry = ttk.Entry(fields_frame, width=50)
        server_entry.insert(0, self.current_config.get("server_url", "ws://localhost:3000"))
        server_entry.pack(fill=tk.X, pady=(0, 10))

        # 2. Token
        ttk.Label(fields_frame, text="Agent API Token:", font=("Segoe UI", 9, "bold")).pack(anchor=tk.W, pady=(5, 2))
        token_entry = ttk.Entry(fields_frame, width=50)
        token_entry.insert(0, self.current_config.get("token", "demo-token-12345"))
        token_entry.pack(fill=tk.X, pady=(0, 10))

        # 3. Network Interface
        ttk.Label(fields_frame, text="Capture Interface:", font=("Segoe UI", 9, "bold")).pack(anchor=tk.W, pady=(5, 2))
        available_ifaces = get_network_interfaces()
        iface_combo = ttk.Combobox(fields_frame, values=available_ifaces, state="readonly", width=47)
        
        default_iface = self.current_config.get("interface", available_ifaces[0] if available_ifaces else "")
        if default_iface in available_ifaces:
            iface_combo.set(default_iface)
        elif available_ifaces:
            iface_combo.set(available_ifaces[0])
            
        iface_combo.pack(fill=tk.X, pady=(0, 10))

        # 4. BPF Filter
        ttk.Label(fields_frame, text="BPF Filter (Optional, e.g. 'tcp or udp'):", font=("Segoe UI", 9)).pack(anchor=tk.W, pady=(5, 2))
        bpf_entry = ttk.Entry(fields_frame, width=50)
        bpf_entry.insert(0, self.current_config.get("bpf_filter", ""))
        bpf_entry.pack(fill=tk.X, pady=(0, 15))

        # Action Buttons
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(10, 0))

        def save_and_close():
            server_url = server_entry.get().strip()
            token = token_entry.get().strip()
            iface = iface_combo.get().strip()
            bpf = bpf_entry.get().strip()

            if not server_url:
                messagebox.showerror("Error", "Server URL cannot be empty.", parent=root)
                return
            if not iface:
                messagebox.showerror("Error", "Please select a network interface.", parent=root)
                return

            new_config = {
                "server_url": server_url,
                "token": token,
                "interface": iface,
                "bpf_filter": bpf if bpf else None
            }

            if save_config(new_config):
                self.result = new_config
                if self.on_save_callback:
                    self.on_save_callback(new_config)
                root.destroy()
            else:
                messagebox.showerror("Error", "Failed to save config.json", parent=root)

        save_btn = ttk.Button(btn_frame, text="Save & Start Capture", command=save_and_close)
        save_btn.pack(side=tk.RIGHT, padx=(5, 0))

        cancel_btn = ttk.Button(btn_frame, text="Cancel", command=root.destroy)
        cancel_btn.pack(side=tk.RIGHT)

        root.mainloop()
        return self.result


class NetObserverTrayApp:
    def __init__(self):
        self.config = load_config()
        self.agent = None
        self.agent_thread = None
        self.ws_thread = None
        self.is_capturing = False
        self.icon = None

    def start_capture_service(self):
        """Initializes and launches PacketCaptureAgent in background threads."""
        if not self.config:
            print("[!] No config available to start capture.")
            return

        if self.is_capturing:
            self.stop_capture_service()

        print(f"[*] Starting PacketCaptureAgent on interface: {self.config.get('interface')}")
        self.agent = PacketCaptureAgent(
            server_url=self.config.get("server_url", "ws://localhost:3000"),
            interface=self.config.get("interface"),
            bpf_filter=self.config.get("bpf_filter"),
            token=self.config.get("token", "demo-token-12345")
        )

        self.is_capturing = True

        # Launch WebSocket connection thread
        self.ws_thread = threading.Thread(target=self.agent.connect_websocket, daemon=True)
        self.ws_thread.start()

        # Launch Scapy sniffer thread
        self.agent_thread = threading.Thread(target=self.agent.start_capture, daemon=True)
        self.agent_thread.start()

        self.update_tray_state()

    def stop_capture_service(self):
        """Stops active PacketCaptureAgent."""
        print("[*] Stopping PacketCaptureAgent...")
        if self.agent:
            self.agent.running = False
            if self.agent.ws:
                try:
                    self.agent.ws.close()
                except Exception:
                    pass
            self.agent = None

        self.is_capturing = False
        self.update_tray_state()

    def toggle_capture(self, icon, item):
        """Toggle capture on/off from tray menu."""
        if self.is_capturing:
            self.stop_capture_service()
        else:
            self.start_capture_service()

    def open_settings_dialog(self, icon=None, item=None):
        """Opens settings GUI window."""
        def on_saved(new_config):
            self.config = new_config
            self.start_capture_service()

        # Run settings window in main thread / Tkinter event loop
        win = SettingsWindow(current_config=self.config, on_save_callback=on_saved)
        win.show()

    def update_tray_state(self):
        """Update system tray icon image and menu title."""
        if not self.icon:
            return

        if self.is_capturing:
            self.icon.icon = create_tray_icon_image("capturing")
            self.icon.title = f"NetObserver Agent - Capturing ({self.config.get('interface', 'N/A')})"
        else:
            self.icon.icon = create_tray_icon_image("idle")
            self.icon.title = "NetObserver Agent - Stopped"

    def exit_app(self, icon, item):
        """Completely shut down capture agent and tray icon."""
        print("[*] Exiting NetObserver Agent...")
        self.stop_capture_service()
        self.icon.stop()

    def build_menu(self):
        """Construct pystray context menu."""
        return pystray.Menu(
            item(
                lambda text: f"Status: {'Capturing' if self.is_capturing else 'Stopped'}",
                action=None,
                enabled=False
            ),
            item(
                lambda text: f"Interface: {self.config.get('interface', 'Not set')}" if self.config else "Interface: Not set",
                action=None,
                enabled=False
            ),
            pystray.Menu.SEPARATOR,
            item(
                lambda text: "Stop Capture" if self.is_capturing else "Start Capture",
                self.toggle_capture
            ),
            item("Settings...", lambda icon, item: threading.Thread(target=self.open_settings_dialog, daemon=True).start()),
            pystray.Menu.SEPARATOR,
            item("Exit NetObserver Agent", self.exit_app)
        )

    def run(self):
        """Main application entry point."""
        # 1. Check if config.json exists. If missing, show Settings window immediately.
        if not self.config:
            print("[*] No config.json found. Opening initial settings configuration window...")
            self.open_settings_dialog()
            self.config = load_config()

        # If user closed settings without saving config, prompt or exit
        if not self.config:
            print("[!] Configuration not set. Exiting.")
            sys.exit(0)

        # 2. Start capturing service
        self.start_capture_service()

        # 3. Create and run system tray icon
        self.icon = pystray.Icon(
            "NetObserverAgent",
            create_tray_icon_image("capturing" if self.is_capturing else "idle"),
            f"NetObserver Agent - {'Capturing' if self.is_capturing else 'Stopped'}",
            menu=self.build_menu()
        )

        print("[+] NetObserver Agent Tray App running in background.")
        self.icon.run()


def main():
    app = NetObserverTrayApp()
    app.run()


if __name__ == "__main__":
    main()
