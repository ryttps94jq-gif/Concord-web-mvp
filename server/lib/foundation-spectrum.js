/**
 * Foundation Spectrum — Spectrum Discovery
 *
 * The electromagnetic spectrum is vast. Most of it is unused at any given
 * time and place. This module discovers available frequencies for mesh
 * expansion. Every clean frequency is a potential new transport channel.
 *
 * Rules:
 *   1. Listen only. Never transmit on discovered frequencies without authorization.
 *   2. Regulatory awareness. Track legal status of discovered spectrum.
 *   3. Adaptive selection. Feed discovered channels into mesh routing engine.
 */

import crypto from "crypto";

function uid(prefix = "spectrum") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const LEGAL_STATUS = Object.freeze({
  UNLICENSED:      "unlicensed",
  LICENSED_UNUSED: "licensed_unused",
  SHARED:          "shared",
  UNKNOWN:         "unknown",
});

export const ISM_BANDS = Object.freeze([
  { name: "900MHz ISM", start: 902e6, end: 928e6, legal: LEGAL_STATUS.UNLICENSED },
  { name: "2.4GHz ISM", start: 2.4e9, end: 2.4835e9, legal: LEGAL_STATUS.UNLICENSED },
  { name: "5.8GHz ISM", start: 5.725e9, end: 5.875e9, legal: LEGAL_STATUS.UNLICENSED },
]);

// ── Module State ────────────────────────────────────────────────────────────

const _spectrumState = {
  initialized: false,
  scans: [],                   // Recent spectrum scans
  availableChannels: [],       // Discovered usable channels
  occupancyMap: new Map(),     // locationKey → frequency occupancy
  stats: {
    totalScans: 0,
    channelsDiscovered: 0,
    lastScanAt: null,
    uptime: Date.now(),
  },
};

// ── Spectrum DTU Creation ───────────────────────────────────────────────────

export function createSpectrumDTU(opts) {
  const now = nowISO();

  return {
    id: uid("spectrum"),
    type: "SPECTRUM",
    created: now,
    source: opts.source || "foundation-spectrum",
    frequency_range: {
      start: opts.startFreq || 0,
      end: opts.endFreq || 0,
    },
    occupancy: opts.occupancy || [],
    noise_floor: opts.noise_floor || [],
    available_channels: (opts.available_channels || []).map(ch => ({
      center_frequency: ch.center_frequency,
      bandwidth: ch.bandwidth,
      noise_level: ch.noise_level ?? -90,
      availability_score: clamp(ch.availability_score || 0, 0, 1),
      legal_status: Object.values(LEGAL_STATUS).includes(ch.legal_status)
        ? ch.legal_status : LEGAL_STATUS.UNKNOWN,
    })),
    location: opts.location || null,
    time_of_day: opts.time_of_day || new Date().toLocaleTimeString(),
    tags: ["foundation", "spectrum"],
    scope: "local",
    crpiScore: 0.2,
  };
}

// ── Spectrum Scanning ───────────────────────────────────────────────────────

export function recordSpectrumScan(scanData, STATE) {
  if (!scanData) return null;

  const dtu = createSpectrumDTU(scanData);

  _spectrumState.scans.push(dtu);
  if (_spectrumState.scans.length > 500) {
    _spectrumState.scans = _spectrumState.scans.slice(-400);
  }

  // Update available channels
  for (const ch of dtu.available_channels) {
    if (ch.availability_score > 0.7) {
      const existing = _spectrumState.availableChannels.find(
        c => Math.abs(c.center_frequency - ch.center_frequency) < ch.bandwidth
      );
      if (!existing) {
        _spectrumState.availableChannels.push({ ...ch, discoveredAt: nowISO() });
        _spectrumState.stats.channelsDiscovered++;
      }
    }
  }

  // Cap available channels
  if (_spectrumState.availableChannels.length > 200) {
    _spectrumState.availableChannels = _spectrumState.availableChannels.slice(-150);
  }

  // Update occupancy map
  if (dtu.location) {
    const key = `${Math.round(dtu.location.lat * 10)}_${Math.round(dtu.location.lng * 10)}`;
    _spectrumState.occupancyMap.set(key, {
      location: dtu.location,
      scan: dtu,
      updatedAt: nowISO(),
    });
  }

  if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);

  _spectrumState.stats.totalScans++;
  _spectrumState.stats.lastScanAt = nowISO();

  return dtu;
}

// ── Query Functions ─────────────────────────────────────────────────────────

export function getAvailableChannels(limit = 50) {
  return _spectrumState.availableChannels.slice(0, limit);
}

export function getSpectrumMap() {
  const entries = [];
  for (const [key, data] of _spectrumState.occupancyMap) {
    entries.push({ key, ...data });
  }
  return entries;
}

export function getSpectrumMetrics() {
  return {
    initialized: _spectrumState.initialized,
    scanCount: _spectrumState.scans.length,
    availableChannelCount: _spectrumState.availableChannels.length,
    occupancyMapSize: _spectrumState.occupancyMap.size,
    stats: { ..._spectrumState.stats },
    uptime: Date.now() - _spectrumState.stats.uptime,
  };
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeSpectrum(STATE) {
  if (_spectrumState.initialized) return { ok: true, alreadyInitialized: true };

  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "SPECTRUM") {
        _spectrumState.scans.push(dtu);
        indexed++;
      }
    }
  }

  _spectrumState.initialized = true;
  _spectrumState.stats.uptime = Date.now();
  return { ok: true, indexed };
}

export function _resetSpectrumState() {
  _spectrumState.initialized = false;
  _spectrumState.scans = [];
  _spectrumState.availableChannels = [];
  _spectrumState.occupancyMap.clear();
  _spectrumState.stats = {
    totalScans: 0, channelsDiscovered: 0, lastScanAt: null, uptime: Date.now(),
  };
}
