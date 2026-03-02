/**
 * Foundation Energy — Energy Detection & Mapping
 *
 * The mesh network listening across the spectrum inherently detects energy.
 * Power grid behavior, renewable sources, waste, battery state — all
 * captured passively from electromagnetic signatures.
 *
 * Rules:
 *   1. Passive detection only. Never transmit on power frequencies.
 *   2. All readings become DTUs. Full audit trail.
 *   3. Grid anomalies propagate with elevated priority.
 */

import crypto from "crypto";

function uid(prefix = "energy") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const ENERGY_SUBTYPES = Object.freeze([
  "grid", "renewable", "waste", "storage", "demand",
]);

export const GRID_NOMINAL_FREQUENCY = Object.freeze({
  HZ_50: 50.0,
  HZ_60: 60.0,
});

export const GRID_HEALTH_THRESHOLDS = Object.freeze({
  NORMAL:   0.05,  // ±0.05 Hz from nominal
  WARNING:  0.2,   // ±0.2 Hz — grid stress
  CRITICAL: 0.5,   // ±0.5 Hz — grid emergency
});

// ── Module State ────────────────────────────────────────────────────────────

const _energyState = {
  initialized: false,
  readings: [],
  gridMap: new Map(),        // locationKey → grid health readings
  energyMap: [],             // aggregate energy map entries
  stats: {
    totalReadings: 0,
    gridAnomalies: 0,
    renewableDetections: 0,
    wasteDetections: 0,
    lastReadingAt: null,
    uptime: Date.now(),
  },
};

// ── Energy DTU Creation ─────────────────────────────────────────────────────

export function createEnergyDTU(opts) {
  const now = nowISO();
  const subtype = ENERGY_SUBTYPES.includes(opts.subtype) ? opts.subtype : "grid";

  const nominal = opts.nominalFrequency || GRID_NOMINAL_FREQUENCY.HZ_60;
  const measured = opts.frequency || nominal;
  const deviation = Math.abs(measured - nominal);

  let loadEstimate = "normal";
  let anomalyDetected = false;
  if (deviation > GRID_HEALTH_THRESHOLDS.CRITICAL) {
    loadEstimate = "critical";
    anomalyDetected = true;
  } else if (deviation > GRID_HEALTH_THRESHOLDS.WARNING) {
    loadEstimate = "stressed";
    anomalyDetected = true;
  } else if (deviation > GRID_HEALTH_THRESHOLDS.NORMAL) {
    loadEstimate = "elevated";
  }

  return {
    id: uid("energy"),
    type: "ENERGY",
    subtype,
    created: now,
    source: opts.source || "foundation-energy",
    measurements: {
      frequency: measured,
      harmonics: opts.harmonics || [],
      power_estimate: opts.power_estimate ?? null,
      stability_score: clamp(1.0 - (deviation / 1.0), 0, 1),
      efficiency_estimate: opts.efficiency_estimate ?? null,
    },
    grid_health: {
      deviation_from_nominal: deviation,
      harmonic_distortion: opts.harmonic_distortion ?? null,
      load_estimate: loadEstimate,
      anomaly_detected: anomalyDetected,
    },
    location: opts.location || null,
    coverage_radius: opts.coverage_radius ?? null,
    tags: ["foundation", "energy", subtype],
    scope: anomalyDetected ? "global" : "local",
    crpiScore: anomalyDetected ? 0.6 : 0.2,
  };
}

// ── Reading Recording ───────────────────────────────────────────────────────

export function recordEnergyReading(data, STATE) {
  if (!data) return null;

  const dtu = createEnergyDTU(data);

  _energyState.readings.push(dtu);
  if (_energyState.readings.length > 1000) {
    _energyState.readings = _energyState.readings.slice(-800);
  }

  // Update grid map
  if (dtu.location) {
    const key = `${Math.round(dtu.location.lat * 10)}_${Math.round(dtu.location.lng * 10)}`;
    _energyState.gridMap.set(key, {
      location: dtu.location,
      lastReading: dtu,
      health: dtu.grid_health,
      updatedAt: nowISO(),
    });
  }

  // Track anomalies
  if (dtu.grid_health.anomaly_detected) {
    _energyState.stats.gridAnomalies++;
  }
  if (dtu.subtype === "renewable") _energyState.stats.renewableDetections++;
  if (dtu.subtype === "waste") _energyState.stats.wasteDetections++;

  if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);

  _energyState.stats.totalReadings++;
  _energyState.stats.lastReadingAt = nowISO();

  return dtu;
}

// ── Energy Map ──────────────────────────────────────────────────────────────

export function getEnergyMap() {
  const entries = [];
  for (const [key, data] of _energyState.gridMap) {
    entries.push({ key, ...data });
  }
  return entries;
}

export function getGridHealth() {
  const entries = getEnergyMap();
  const healthCounts = { normal: 0, elevated: 0, stressed: 0, critical: 0 };
  for (const e of entries) {
    const load = e.health?.load_estimate || "normal";
    healthCounts[load] = (healthCounts[load] || 0) + 1;
  }
  return {
    totalStations: entries.length,
    healthDistribution: healthCounts,
    overallHealth: healthCounts.critical > 0 ? "critical" :
      healthCounts.stressed > 0 ? "stressed" :
      healthCounts.elevated > 0 ? "elevated" : "normal",
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getEnergyMetrics() {
  return {
    initialized: _energyState.initialized,
    readingCount: _energyState.readings.length,
    gridMapSize: _energyState.gridMap.size,
    stats: { ..._energyState.stats },
    gridHealth: getGridHealth(),
    uptime: Date.now() - _energyState.stats.uptime,
  };
}

export function getRecentEnergyReadings(limit = 50) {
  return _energyState.readings.slice(-limit);
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeEnergy(STATE) {
  if (_energyState.initialized) return { ok: true, alreadyInitialized: true };

  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "ENERGY") {
        _energyState.readings.push(dtu);
        indexed++;
      }
    }
  }

  _energyState.initialized = true;
  _energyState.stats.uptime = Date.now();
  return { ok: true, indexed };
}

export function _resetEnergyState() {
  _energyState.initialized = false;
  _energyState.readings = [];
  _energyState.gridMap.clear();
  _energyState.energyMap = [];
  _energyState.stats = {
    totalReadings: 0, gridAnomalies: 0, renewableDetections: 0,
    wasteDetections: 0, lastReadingAt: null, uptime: Date.now(),
  };
}
