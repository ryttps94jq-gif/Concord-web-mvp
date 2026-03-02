/**
 * Foundation Archive — Temporal Archaeology
 *
 * The physical infrastructure has been carrying data for decades.
 * This module listens for ghosts — residual signal patterns, protocol
 * fossils, legacy systems still broadcasting. Decoded data wraps into
 * DTUs for historical analysis.
 *
 * Rules:
 *   1. Listen only. Never interact with discovered legacy systems.
 *   2. Legacy SCADA/industrial detections generate Shield threat DTUs.
 *   3. All decoded data preserved as ARCHIVE DTUs.
 */

import crypto from "crypto";

function uid(prefix = "archive") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const ARCHIVE_SUBTYPES = Object.freeze([
  "residual", "fossil", "legacy_system", "signal_echo",
]);

export const KNOWN_LEGACY_PROTOCOLS = Object.freeze([
  "v92_modem", "v34_modem", "ax25", "scada_modbus",
  "scada_dnp3", "weather_metar", "weather_synop", "nmea_gps",
  "adsb", "ais_marine", "pager_pocsag", "pager_flex",
]);

// ── Module State ────────────────────────────────────────────────────────────

const _archiveState = {
  initialized: false,
  fossils: [],              // Discovered legacy signals
  decoded: [],              // Successfully decoded data
  legacySystems: new Map(), // protocol → detected system info
  stats: {
    totalFossils: 0,
    totalDecoded: 0,
    legacySystemsFound: 0,
    securityAlertsGenerated: 0,
    lastDiscoveryAt: null,
    uptime: Date.now(),
  },
};

// ── Archive DTU Creation ────────────────────────────────────────────────────

export function createArchiveDTU(opts) {
  const now = nowISO();
  const subtype = ARCHIVE_SUBTYPES.includes(opts.subtype) ? opts.subtype : "fossil";

  const dtu = {
    id: uid("archive"),
    type: "ARCHIVE",
    subtype,
    created: now,
    source: opts.source || "foundation-archive",
    source_channel: opts.source_channel || "unknown",
    frequency: opts.frequency ?? null,
    protocol_detected: opts.protocol_detected || "unknown",
    content: {
      raw_signal: opts.raw_signal || null,
      decoded: opts.decoded || null,
      confidence: clamp(opts.confidence || 0, 0, 1),
      estimated_age: opts.estimated_age || "unknown",
      origin_system: opts.origin_system || "unknown",
    },
    location: opts.location || null,
    historical_context: opts.historical_context || null,
    tags: ["foundation", "archive", subtype],
    scope: "local",
    crpiScore: opts.confidence > 0.8 ? 0.5 : 0.2,
  };

  // SCADA/industrial systems are security concerns
  if (opts.protocol_detected && (
    opts.protocol_detected.includes("scada") ||
    opts.protocol_detected.includes("modbus") ||
    opts.protocol_detected.includes("dnp3")
  )) {
    dtu.tags.push("security_concern", "infrastructure");
    dtu.scope = "global";
    dtu.crpiScore = 0.7;
  }

  return dtu;
}

// ── Fossil Recording ────────────────────────────────────────────────────────

export function recordFossil(signalData, STATE) {
  if (!signalData) return null;

  const dtu = createArchiveDTU(signalData);

  _archiveState.fossils.push(dtu);
  if (_archiveState.fossils.length > 500) {
    _archiveState.fossils = _archiveState.fossils.slice(-400);
  }

  // Track legacy system
  if (signalData.protocol_detected && signalData.protocol_detected !== "unknown") {
    const existing = _archiveState.legacySystems.get(signalData.protocol_detected);
    _archiveState.legacySystems.set(signalData.protocol_detected, {
      protocol: signalData.protocol_detected,
      detections: (existing?.detections || 0) + 1,
      lastSeen: nowISO(),
      firstSeen: existing?.firstSeen || nowISO(),
      location: signalData.location || existing?.location,
    });
    if (!existing) _archiveState.stats.legacySystemsFound++;
  }

  if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);

  _archiveState.stats.totalFossils++;
  _archiveState.stats.lastDiscoveryAt = nowISO();

  return dtu;
}

export function recordDecoded(decodedData, STATE) {
  if (!decodedData) return null;

  const dtu = createArchiveDTU({
    ...decodedData,
    subtype: "fossil",
    confidence: decodedData.confidence || 0.5,
  });

  _archiveState.decoded.push(dtu);
  if (_archiveState.decoded.length > 500) {
    _archiveState.decoded = _archiveState.decoded.slice(-400);
  }

  if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);

  _archiveState.stats.totalDecoded++;
  return dtu;
}

// ── Query Functions ─────────────────────────────────────────────────────────

export function getFossils(limit = 50) {
  return _archiveState.fossils.slice(-limit);
}

export function getDecoded(limit = 50) {
  return _archiveState.decoded.slice(-limit);
}

export function getLegacySystems() {
  return [..._archiveState.legacySystems.values()];
}

export function getArchiveMetrics() {
  return {
    initialized: _archiveState.initialized,
    fossilCount: _archiveState.fossils.length,
    decodedCount: _archiveState.decoded.length,
    legacySystemCount: _archiveState.legacySystems.size,
    stats: { ..._archiveState.stats },
    uptime: Date.now() - _archiveState.stats.uptime,
  };
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeArchive(STATE) {
  if (_archiveState.initialized) return { ok: true, alreadyInitialized: true };

  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "ARCHIVE") {
        _archiveState.fossils.push(dtu);
        indexed++;
      }
    }
  }

  _archiveState.initialized = true;
  _archiveState.stats.uptime = Date.now();
  return { ok: true, indexed };
}

export function _resetArchiveState() {
  _archiveState.initialized = false;
  _archiveState.fossils = [];
  _archiveState.decoded = [];
  _archiveState.legacySystems.clear();
  _archiveState.stats = {
    totalFossils: 0, totalDecoded: 0, legacySystemsFound: 0,
    securityAlertsGenerated: 0, lastDiscoveryAt: null, uptime: Date.now(),
  };
}
