/**
 * Foundation Protocol — Custom Concord Protocol
 *
 * Purpose-built radio protocol optimized for DTU characteristics.
 * No handshake (DTUs self-verify). Content-addressed routing.
 * Priority baked in. Gossip propagation by novelty. Deduplication
 * built in. Economic metadata in header.
 *
 * Protocol Frame (20 bytes):
 *   [2 bytes]  Magic: 0xCD01
 *   [1 byte]   Version
 *   [1 byte]   Priority (0-7)
 *   [1 byte]   TTL
 *   [1 byte]   Flags
 *   [4 bytes]  Content hash (first 4 bytes)
 *   [4 bytes]  Source node ID
 *   [2 bytes]  Fragment seq/total
 *   [2 bytes]  Payload length
 *   [N bytes]  DTU payload
 *   [2 bytes]  CRC-16
 *
 * Rules:
 *   1. No handshake. DTU self-verifies. Accept or reject immediately.
 *   2. Content-addressed. Route by hash, not destination IP.
 *   3. Priority native. EMERGENCY=0, THREAT=1, ECONOMIC=2, KNOWLEDGE=3.
 *   4. Gossip by novelty. High-novelty DTUs rebroadcast more.
 *   5. Dedup by hash. Same hash = same DTU = silently drop.
 */

import crypto from "crypto";

function uid(prefix = "protocol") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const MAGIC_NUMBER = 0xCD01;
export const PROTOCOL_VERSION = 1;
export const FRAME_OVERHEAD = 20; // bytes (without payload)
export const CRC_SIZE = 2;

export const PRIORITY_LEVELS = Object.freeze({
  EMERGENCY:  0,
  THREAT:     1,
  ECONOMIC:   2,
  KNOWLEDGE:  3,
  GENERAL:    4,
  LOW:        5,
  BACKGROUND: 6,
  MINIMAL:    7,
});

export const FLAGS = Object.freeze({
  FRAGMENT:   0x01,
  RELAY:      0x02,
  EMERGENCY:  0x04,
  ENCRYPTED:  0x08,
});

export const FREQUENCY_PLAN = Object.freeze({
  RANGE_900MHZ:  { center: 915e6,   bandwidth: 26e6,    use: "range" },
  BAND_2_4GHZ:   { center: 2.44e9,  bandwidth: 83.5e6,  use: "bandwidth" },
  BAND_5_8GHZ:   { center: 5.8e9,   bandwidth: 150e6,   use: "speed" },
});

// ── Module State ────────────────────────────────────────────────────────────

const _protocolState = {
  initialized: false,
  recentHashes: new Map(),    // hash → timestamp (for dedup)
  gossipLog: [],              // Recent gossip decisions
  frameLog: [],               // Recent protocol frames
  stats: {
    totalFramesCreated: 0,
    totalFramesParsed: 0,
    totalDeduplicated: 0,
    totalGossipBroadcasts: 0,
    totalGossipSuppressed: 0,
    crcErrors: 0,
    lastFrameAt: null,
    uptime: Date.now(),
  },
};

// ── CRC-16 ──────────────────────────────────────────────────────────────────

export function crc16(data) {
  let crc = 0xFFFF;
  const bytes = typeof data === "string" ? Buffer.from(data) : data;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xA001;
      else crc >>= 1;
    }
  }
  return crc & 0xFFFF;
}

// ── Frame Creation ──────────────────────────────────────────────────────────

export function createFrame(dtu, opts = {}) {
  if (!dtu) return null;

  const payload = typeof dtu === "string" ? dtu : JSON.stringify(dtu);
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  const contentHash = crypto.createHash("sha256").update(payload).digest("hex");

  const priority = clamp(opts.priority ?? PRIORITY_LEVELS.GENERAL, 0, 7);
  const ttl = clamp(opts.ttl || 7, 0, 255);

  let flags = 0;
  if (opts.fragment) flags |= FLAGS.FRAGMENT;
  if (opts.relay) flags |= FLAGS.RELAY;
  if (opts.emergency || priority === PRIORITY_LEVELS.EMERGENCY) flags |= FLAGS.EMERGENCY;
  if (opts.encrypted) flags |= FLAGS.ENCRYPTED;

  const frame = {
    magic: MAGIC_NUMBER,
    version: PROTOCOL_VERSION,
    priority,
    ttl,
    flags,
    contentHash: contentHash.slice(0, 8),  // First 4 bytes as hex
    sourceNodeId: (opts.sourceNodeId || "self").slice(-8),
    fragmentSeq: clamp(opts.fragmentSeq || 0, 0, 255),
    fragmentTotal: clamp(opts.fragmentTotal || 1, 1, 255),
    payloadLength: payloadBytes,
    payload,
    crc: 0, // Computed below
    totalBytes: FRAME_OVERHEAD + payloadBytes + CRC_SIZE,
  };

  // Compute CRC over everything except the CRC field itself
  const frameData = `${frame.magic}${frame.version}${frame.priority}${frame.ttl}${frame.flags}${frame.contentHash}${frame.sourceNodeId}${frame.fragmentSeq}${frame.fragmentTotal}${frame.payloadLength}${frame.payload}`;
  frame.crc = crc16(frameData);

  _protocolState.stats.totalFramesCreated++;
  _protocolState.stats.lastFrameAt = nowISO();

  _protocolState.frameLog.push({
    hash: frame.contentHash,
    priority: frame.priority,
    size: frame.totalBytes,
    timestamp: nowISO(),
  });
  if (_protocolState.frameLog.length > 500) {
    _protocolState.frameLog = _protocolState.frameLog.slice(-400);
  }

  return frame;
}

// ── Frame Parsing ───────────────────────────────────────────────────────────

export function parseFrame(frame) {
  if (!frame) return { ok: false, error: "null_frame" };

  if (frame.magic !== MAGIC_NUMBER) {
    return { ok: false, error: "invalid_magic", expected: MAGIC_NUMBER, got: frame.magic };
  }

  // Verify CRC
  const frameData = `${frame.magic}${frame.version}${frame.priority}${frame.ttl}${frame.flags}${frame.contentHash}${frame.sourceNodeId}${frame.fragmentSeq}${frame.fragmentTotal}${frame.payloadLength}${frame.payload}`;
  const expectedCrc = crc16(frameData);
  if (frame.crc !== expectedCrc) {
    _protocolState.stats.crcErrors++;
    return { ok: false, error: "crc_mismatch", expected: expectedCrc, got: frame.crc };
  }

  // Parse payload
  let dtu;
  try {
    dtu = JSON.parse(frame.payload);
  } catch {
    dtu = frame.payload;
  }

  _protocolState.stats.totalFramesParsed++;

  return {
    ok: true,
    dtu,
    priority: frame.priority,
    ttl: frame.ttl,
    flags: frame.flags,
    contentHash: frame.contentHash,
    sourceNodeId: frame.sourceNodeId,
    isFragment: !!(frame.flags & FLAGS.FRAGMENT),
    isRelay: !!(frame.flags & FLAGS.RELAY),
    isEmergency: !!(frame.flags & FLAGS.EMERGENCY),
    isEncrypted: !!(frame.flags & FLAGS.ENCRYPTED),
  };
}

// ── Deduplication ───────────────────────────────────────────────────────────

export function isDuplicate(contentHash) {
  if (!contentHash) return false;
  return _protocolState.recentHashes.has(contentHash);
}

export function markSeen(contentHash) {
  if (!contentHash) return;
  _protocolState.recentHashes.set(contentHash, Date.now());

  // Clean old entries (keep last hour)
  if (_protocolState.recentHashes.size > 10000) {
    const cutoff = Date.now() - (60 * 60 * 1000);
    for (const [hash, ts] of _protocolState.recentHashes) {
      if (ts < cutoff) _protocolState.recentHashes.delete(hash);
    }
  }
}

export function checkAndMark(contentHash) {
  if (isDuplicate(contentHash)) {
    _protocolState.stats.totalDeduplicated++;
    return true; // Is duplicate
  }
  markSeen(contentHash);
  return false; // Not duplicate
}

// ── Gossip Propagation ──────────────────────────────────────────────────────

export function shouldGossip(frame, noveltyScore) {
  if (!frame) return false;

  // Emergency always gossips
  if (frame.flags & FLAGS.EMERGENCY) return true;

  // Priority 0-1 always gossips
  if (frame.priority <= PRIORITY_LEVELS.THREAT) return true;

  // Higher novelty = higher gossip probability
  const ns = clamp(noveltyScore || 0, 0, 1);
  const gossipProbability = ns * 0.8 + 0.1; // 10% baseline + 80% from novelty

  const shouldBroadcast = Math.random() < gossipProbability;

  _protocolState.gossipLog.push({
    hash: frame.contentHash,
    novelty: ns,
    probability: gossipProbability,
    broadcast: shouldBroadcast,
    timestamp: nowISO(),
  });
  if (_protocolState.gossipLog.length > 200) {
    _protocolState.gossipLog = _protocolState.gossipLog.slice(-150);
  }

  if (shouldBroadcast) _protocolState.stats.totalGossipBroadcasts++;
  else _protocolState.stats.totalGossipSuppressed++;

  return shouldBroadcast;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getProtocolMetrics() {
  return {
    initialized: _protocolState.initialized,
    recentHashCount: _protocolState.recentHashes.size,
    stats: { ..._protocolState.stats },
    frameOverhead: FRAME_OVERHEAD,
    crcSize: CRC_SIZE,
    frequencyPlan: FREQUENCY_PLAN,
    uptime: Date.now() - _protocolState.stats.uptime,
  };
}

export function getRecentFrames(limit = 50) {
  return _protocolState.frameLog.slice(-limit);
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeProtocol(STATE) {
  if (_protocolState.initialized) return { ok: true, alreadyInitialized: true };

  _protocolState.initialized = true;
  _protocolState.stats.uptime = Date.now();
  return { ok: true, version: PROTOCOL_VERSION, frameOverhead: FRAME_OVERHEAD };
}

export function _resetProtocolState() {
  _protocolState.initialized = false;
  _protocolState.recentHashes.clear();
  _protocolState.gossipLog = [];
  _protocolState.frameLog = [];
  _protocolState.stats = {
    totalFramesCreated: 0, totalFramesParsed: 0, totalDeduplicated: 0,
    totalGossipBroadcasts: 0, totalGossipSuppressed: 0, crcErrors: 0,
    lastFrameAt: null, uptime: Date.now(),
  };
}
