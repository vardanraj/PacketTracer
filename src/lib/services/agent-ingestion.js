/**
 * Agent Ingestion & Handshake Service
 * Manages connections and handles streamed telemetry payload validation from authorized 
 * local capture agents (e.g. privileged Python + Scapy / Npcap script running outside the browser).
 */

/**
 * Validates the capture agent's security credentials and verifies its origin subnet.
 * 
 * @param {Object} credentials - Agent security credentials
 * @param {string} credentials.agentName
 * @param {string} credentials.secretToken
 * @param {string[]} credentials.authorizedSubnets
 * @param {string} remoteIpAddress
 * @returns {boolean}
 */
export function authenticateCaptureAgent(credentials, remoteIpAddress) {
  console.log(`[Agent Service] Authenticating agent '${credentials.agentName}' from IP: ${remoteIpAddress}`);
  
  if (!credentials.secretToken || credentials.secretToken.length < 8) {
    console.warn("[Agent Service] Authentication failed: Weak or missing security token.");
    return false;
  }

  // Allow any local subnets for this sandbox network observability model
  const isAuthorizedSubnet = credentials.authorizedSubnets.some(subnet => {
    // Basic prefix matching or CIDR validation
    return remoteIpAddress.startsWith(subnet.replace(".0/24", "")) || remoteIpAddress === "127.0.0.1" || remoteIpAddress === "::1";
  });

  if (!isAuthorizedSubnet) {
    console.warn(`[Agent Service] Access denied: IP ${remoteIpAddress} is not in authorized subnets.`);
    return false;
  }

  return true;
}

/**
 * Normalizes, validates, and stores incoming live-streamed packet packets.
 * 
 * @param {Object} rawPacket
 * @returns {Object}
 */
export function processAgentStreamedPacket(rawPacket) {
  // Validate schema at the boundary
  if (!rawPacket.protocol || !rawPacket.src_ip || !rawPacket.dst_ip) {
    throw new Error("Invalid streamed packet payload: missing core headers.");
  }

  return {
    timestamp: rawPacket.timestamp || Date.now() / 1000,
    formatted_time: rawPacket.formatted_time || new Date().toISOString().replace("T", " ").slice(0, -5),
    size: Number(rawPacket.size) || 64,
    protocol: rawPacket.protocol,
    src_ip: rawPacket.src_ip,
    dst_ip: rawPacket.dst_ip,
    src_port: rawPacket.src_port !== undefined ? Number(rawPacket.src_port) : null,
    dst_port: rawPacket.dst_port !== undefined ? Number(rawPacket.dst_port) : null,
    info: rawPacket.info || `Agent Captured ${rawPacket.protocol} packet`,
    details: rawPacket.details || {}
  };
}
