/**
 * Foundation Sense — Global Sensor Network
 *
 * Every Concord Mesh node is already listening on multiple channels.
 * This module turns passive listening into active sensing.
 *
 * Captures: radio propagation characteristics, signal strength variations,
 * electromagnetic anomalies, noise floor analysis, timing analysis.
 *
 * Output products:
 *   - Weather prediction DTUs (propagation pattern analysis)
 *   - Seismic alert DTUs (electromagnetic precursors, Shield-priority)
 *   - Environmental monitoring DTUs (atmospheric composition)
 *   - Energy mapping DTUs (power grid behavior)
 *
 * Rules:
 *   1. Additive only. Sense never modifies existing systems.
 *   2. Silent failure. Sense never crashes the platform.
 *   3. Every reading is a DTU. Full audit trail.
 *   4. Seismic alerts propagate with Shield-level priority.
 */

import crypto from "crypto";

function uid(prefix = "sense") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const SENSOR_SUBTYPES = Object.freeze([
  "atmospheric", "electromagnetic", "seismic", "acoustic", "propagation",
]);

export const DERIVED_PRODUCTS = Object.freeze([
  "weather_prediction", "seismic_alert", "environmental_monitor", "energy_map",
]);

export const ANOMALY_THRESHOLDS = Object.freeze({
  SIGNAL_DEVIATION:  3.0,  // Standard deviations
  NOISE_SPIKE:       2.5,
  PROPAGATION_SHIFT: 2.0,
  SEISMIC_PRECURSOR: 4.0,
});

// ── Module State ────────────────────────────────────────────────────────────

const _senseState = {
  initialized: false,
  readings: [],           // Recent sensor readings
  patterns: [],           // Detected patterns from meta-derivation
  anomalies: [],          // Flagged anomalies
  baselines: new Map(),   // channel → baseline measurements
  stats: {
    totalReadings: 0,
    anomaliesDetected: 0,
    patternsFound: 0,
    alertsGenerated: 0,
    lastReadingAt: null,
    uptime: Date.now(),
  },
};

// ── Sensor DTU Creation ─────────────────────────────────────────────────────

export function createSensorDTU(opts) {
  const now = nowISO();
  const subtype = SENSOR_SUBTYPES.includes(opts.subtype) ? opts.subtype : "propagation";

  const measurements = {
    signal_strength: opts.signal_strength ?? null,
    noise_floor: opts.noise_floor ?? null,
    propagation_delay: opts.propagation_delay ?? null,
    frequency: opts.frequency ?? null,
    bandwidth_observed: opts.bandwidth_observed ?? null,
    error_rate: opts.error_rate ?? null,
    anomaly_score: opts.anomaly_score ?? 0,
  };

  const derived = {
    temperature_estimate: opts.temperature_estimate ?? null,
    humidity_estimate: opts.humidity_estimate ?? null,
    pressure_estimate: opts.pressure_estimate ?? null,
    activity_level: opts.activity_level ?? null,
  };

  const dtu = {
    id: uid("sensor"),
    type: "SENSOR",
    subtype,
    created: now,
    source: opts.source || "foundation-sense",
    source_node: opts.source_node || null,
    target_node: opts.target_node || null,
    channel: opts.channel || "unknown",
    measurements,
    derived,
    location: opts.location || null,
    tags: ["foundation", "sensor", subtype],
    scope: subtype === "seismic" ? "global" : "local",
    crpiScore: subtype === "seismic" ? 0.8 : 0.2,
  };

  if (subtype === "seismic" && (opts.anomaly_score || 0) >= ANOMALY_THRESHOLDS.SEISMIC_PRECURSOR) {
    dtu.tags.push("pain_memory", "emergency");
    dtu.scope = "global";
    dtu.crpiScore = 0.9;
  }

  return dtu;
}

// ── Signal Analysis ─────────────────────────────────────────────────────────

export function recordReading(channelData, STATE) {
  if (!channelData) return null;

  const reading = createSensorDTU(channelData);

  // Update baseline for this channel
  const baselineKey = `${channelData.channel}_${channelData.source_node || "self"}`;
  const baseline = _senseState.baselines.get(baselineKey);

  if (baseline) {
    // Compute anomaly score against baseline
    const signalDev = channelData.signal_strength != null
      ? Math.abs(channelData.signal_strength - baseline.avgSignal) / (baseline.stdSignal || 1)
      : 0;
    const noiseDev = channelData.noise_floor != null
      ? Math.abs(channelData.noise_floor - baseline.avgNoise) / (baseline.stdNoise || 1)
      : 0;
    reading.measurements.anomaly_score = Math.max(signalDev, noiseDev);

    // Update baseline with new reading
    baseline.count++;
    if (channelData.signal_strength != null) {
      baseline.avgSignal = baseline.avgSignal + (channelData.signal_strength - baseline.avgSignal) / baseline.count;
    }
    if (channelData.noise_floor != null) {
      baseline.avgNoise = baseline.avgNoise + (channelData.noise_floor - baseline.avgNoise) / baseline.count;
    }
    baseline.lastUpdate = nowISO();
  } else {
    // Establish new baseline
    _senseState.baselines.set(baselineKey, {
      channel: channelData.channel,
      avgSignal: channelData.signal_strength || -50,
      stdSignal: 5,
      avgNoise: channelData.noise_floor || -90,
      stdNoise: 3,
      count: 1,
      created: nowISO(),
      lastUpdate: nowISO(),
    });
  }

  // Store reading
  _senseState.readings.push(reading);
  if (_senseState.readings.length > 1000) {
    _senseState.readings = _senseState.readings.slice(-800);
  }

  // Check for anomalies
  if (reading.measurements.anomaly_score >= ANOMALY_THRESHOLDS.SIGNAL_DEVIATION) {
    _senseState.anomalies.push({
      id: uid("anomaly"),
      readingId: reading.id,
      score: reading.measurements.anomaly_score,
      channel: channelData.channel,
      timestamp: nowISO(),
    });
    _senseState.stats.anomaliesDetected++;

    if (_senseState.anomalies.length > 500) {
      _senseState.anomalies = _senseState.anomalies.slice(-400);
    }
  }

  // Store in lattice
  if (STATE?.dtus) {
    STATE.dtus.set(reading.id, reading);
  }

  _senseState.stats.totalReadings++;
  _senseState.stats.lastReadingAt = nowISO();

  return reading;
}

// ── Pattern Detection ───────────────────────────────────────────────────────

export function detectPatterns() {
  if (_senseState.readings.length < 10) return [];

  const recent = _senseState.readings.slice(-100);
  const patterns = [];

  // Group by channel and look for trends
  const byChannel = {};
  for (const r of recent) {
    const ch = r.channel;
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(r);
  }

  for (const [channel, readings] of Object.entries(byChannel)) {
    if (readings.length < 5) continue;

    // Compute average anomaly trend
    const scores = readings.map(r => r.measurements.anomaly_score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const recentAvg = scores.slice(-5).reduce((a, b) => a + b, 0) / Math.min(scores.length, 5);

    if (recentAvg > avgScore * 1.5 && recentAvg > 1.0) {
      patterns.push({
        id: uid("pattern"),
        type: "anomaly_trend",
        channel,
        direction: "increasing",
        avgScore,
        recentAvg,
        readingCount: readings.length,
        timestamp: nowISO(),
      });
    }

    // Check for signal degradation
    const signals = readings
      .map(r => r.measurements.signal_strength)
      .filter(s => s != null);
    if (signals.length >= 5) {
      const firstHalf = signals.slice(0, Math.floor(signals.length / 2));
      const secondHalf = signals.slice(Math.floor(signals.length / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (avgSecond < avgFirst - 5) {
        patterns.push({
          id: uid("pattern"),
          type: "signal_degradation",
          channel,
          delta: avgSecond - avgFirst,
          readingCount: signals.length,
          timestamp: nowISO(),
        });
      }
    }
  }

  // Store detected patterns
  for (const p of patterns) {
    _senseState.patterns.push(p);
    _senseState.stats.patternsFound++;
  }

  if (_senseState.patterns.length > 200) {
    _senseState.patterns = _senseState.patterns.slice(-150);
  }

  return patterns;
}

// ── Derived Products ────────────────────────────────────────────────────────

export function generateWeatherPrediction(readings) {
  if (!readings || readings.length < 3) return null;

  const propagationReadings = readings.filter(r =>
    r.subtype === "propagation" || r.subtype === "atmospheric"
  );
  if (propagationReadings.length === 0) return null;

  const avgTemp = propagationReadings
    .map(r => r.derived?.temperature_estimate)
    .filter(t => t != null);
  const avgHumidity = propagationReadings
    .map(r => r.derived?.humidity_estimate)
    .filter(h => h != null);

  return {
    id: uid("weather"),
    type: "WEATHER_PREDICTION",
    source: "foundation-sense",
    created: nowISO(),
    temperature: avgTemp.length > 0 ? avgTemp.reduce((a, b) => a + b, 0) / avgTemp.length : null,
    humidity: avgHumidity.length > 0 ? avgHumidity.reduce((a, b) => a + b, 0) / avgHumidity.length : null,
    basedOnReadings: propagationReadings.length,
    confidence: Math.min(propagationReadings.length / 20, 1.0),
    tags: ["foundation", "weather", "prediction"],
  };
}

export function generateSeismicAlert(anomaly) {
  if (!anomaly || anomaly.score < ANOMALY_THRESHOLDS.SEISMIC_PRECURSOR) return null;

  _senseState.stats.alertsGenerated++;

  return {
    id: uid("seismic_alert"),
    type: "EMERGENCY",
    subtype: "alert",
    severity: clamp(Math.round(anomaly.score * 2), 1, 10),
    source: "foundation-sense",
    created: nowISO(),
    content: {
      situation: "Electromagnetic precursor anomaly detected — potential seismic activity",
      anomaly_score: anomaly.score,
      channel: anomaly.channel,
    },
    tags: ["foundation", "seismic", "emergency", "pain_memory"],
    scope: "global",
    crpiScore: 0.95,
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getSenseMetrics() {
  return {
    initialized: _senseState.initialized,
    readingCount: _senseState.readings.length,
    patternCount: _senseState.patterns.length,
    anomalyCount: _senseState.anomalies.length,
    baselineCount: _senseState.baselines.size,
    stats: { ..._senseState.stats },
    uptime: Date.now() - _senseState.stats.uptime,
  };
}

export function getRecentReadings(limit = 50) {
  return _senseState.readings.slice(-limit);
}

export function getPatterns(limit = 20) {
  return _senseState.patterns.slice(-limit);
}

export function getAnomalies(limit = 20) {
  return _senseState.anomalies.slice(-limit);
}

// ── Heartbeat ───────────────────────────────────────────────────────────────

export async function senseHeartbeatTick(STATE, tick) {
  // Detect patterns every 10th tick
  if (tick % 10 === 0) {
    try { detectPatterns(); } catch { /* silent */ }
  }

  // Clean old anomalies every 100th tick
  if (tick % 100 === 0) {
    const cutoff = Date.now() - (6 * 60 * 60 * 1000); // 6 hours
    _senseState.anomalies = _senseState.anomalies.filter(a =>
      new Date(a.timestamp).getTime() > cutoff
    );
  }
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeSense(STATE) {
  if (_senseState.initialized) return { ok: true, alreadyInitialized: true };

  // Index existing sensor DTUs from lattice
  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "SENSOR") {
        _senseState.readings.push(dtu);
        indexed++;
      }
    }
  }

  _senseState.initialized = true;
  _senseState.stats.uptime = Date.now();

  return { ok: true, indexed };
}

export function _resetSenseState() {
  _senseState.initialized = false;
  _senseState.readings = [];
  _senseState.patterns = [];
  _senseState.anomalies = [];
  _senseState.baselines.clear();
  _senseState.stats = {
    totalReadings: 0, anomaliesDetected: 0, patternsFound: 0,
    alertsGenerated: 0, lastReadingAt: null, uptime: Date.now(),
  };
}
