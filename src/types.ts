/**
 * TypeScript Type Definitions for the Network Packet Collector & Analyzer
 */

export interface PacketDetails {
  ip_version?: number;
  ip_ttl?: number;
  ip_id?: number;
  tcp_seq?: number;
  tcp_ack?: number;
  tcp_flags?: string;
  udp_len?: number;
  icmp_type?: number;
  icmp_code?: number;
  raw_hex_preview?: string;
  raw_ascii_preview?: string;
  payload_len?: number;
  http_info?: {
    type: "HTTP_REQUEST" | "HTTP_RESPONSE";
    method?: string;
    host?: string;
    path?: string;
    user_agent?: string;
    status_code?: string;
    phrase?: string;
  };
}

export interface Packet {
  id: string; // Generated on server
  timestamp: number; // Unix timestamp
  formatted_time: string; // Formatted date string
  size: number; // Size in bytes
  protocol: "TCP" | "UDP" | "ICMP" | "HTTP" | "HTTPS" | "DNS" | "DHCP" | "NTP" | "OTHER";
  src_ip: string;
  dst_ip: string;
  src_port: number | null;
  dst_port: number | null;
  info: string;
  details: PacketDetails;
}

export interface NetworkInterface {
  name: string;
  description: string;
  status: "up" | "down";
  type: "loopback" | "ethernet" | "wifi" | "virtual";
  ip?: string;
}

export interface CaptureStats {
  totalPackets: number;
  totalBytes: number;
  packetsPerSecond: number;
  bytesPerSecond: number;
  protocolBreakdown: { protocol: string; count: number; bytes: number }[];
  topSources: { ip: string; count: number; bytes: number }[];
  topDestinations: { ip: string; count: number; bytes: number }[];
  bandwidthOverTime: { time: string; bytes: number; packets: number }[];
}

export interface ServerState {
  isCapturing: boolean;
  selectedInterface: string | null;
  captureMode: "real" | "simulation";
  connectedAgents: string[];
}

export interface Device {
  id: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  status: "online" | "offline";
  tags: string[];
}

export interface Session {
  id: string;
  sourceDevice: string; // hostname or ip
  destinationDevice: string; // hostname or ip
  protocol: string;
  sourceIp: string;
  destinationIp: string;
  sourcePort: number | null;
  destinationPort: number | null;
  startTime: number; // Unix timestamp
  endTime?: number; // Unix timestamp
  packetCount: number;
  bytesTransferred: number;
  status: "active" | "terminated" | "half-open" | "failed";
}

export interface Alert {
  id: string;
  type: string; // "spike" | "failure" | "anomaly" | "http_error"
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  timestamp: number; // Unix timestamp
  relatedSessionId?: string;
  acknowledged?: boolean;
}

