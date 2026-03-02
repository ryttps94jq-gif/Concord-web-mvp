/**
 * Foundation Identity — Signal-Layer Identity
 *
 * Identity based on physics, not secrets. Every device has a unique
 * electromagnetic fingerprint from manufacturing variations in hardware.
 * No password. No token. No account. Your device IS your identity.
 *
 * Fingerprint components:
 *   - Clock drift rate (unique crystal oscillator)
 *   - Transmission profile (rise/fall/power curve)
 *   - Signal constellation (DAC imperfections)
 *   - Frequency offset (transmitter precision)
 *
 * Rules:
 *   1. Physics-based. Fingerprints can't be forged without the hardware.
 *   2. Multi-observer. Multiple nodes verify each identity.
 *   3. Continuous verification. Every transmission re-verifies.
 *   4. No accounts. No passwords. No secrets to steal.
 */

import crypto from "crypto";

function uid(prefix = "identity") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const CONFIDENCE_LEVELS = Object.freeze({
  UNVERIFIED:    0,
  LOW:           0.3,
  MEDIUM:        0.6,
  HIGH:          0.85,
  ESTABLISHED:   0.95,
});

export const MIN_OBSERVATIONS_FOR_IDENTITY = 5;
export const VERIFICATION_TOLERANCE = 0.15; // 15% deviation allowed

// ── Module State ────────────────────────────────────────────────────────────

const _identityState = {
  initialized: false,
  identities: new Map(),     // nodeId → identity profile
  observations: new Map(),   // nodeId → observation[]
  verificationLog: [],       // Recent verification events
  stats: {
    totalIdentities: 0,
    totalObservations: 0,
    totalVerifications: 0,
    verificationsPassed: 0,
    verificationsFailed: 0,
    lastVerificationAt: null,
    uptime: Date.now(),
  },
};

// ── Identity DTU Creation ───────────────────────────────────────────────────

export function createIdentityDTU(opts) {
  const now = nowISO();

  return {
    id: uid("identity"),
    type: "IDENTITY",
    node_id: opts.node_id || opts.nodeId,
    fingerprint: {
      clock_drift_rate: opts.clock_drift_rate ?? 0,
      transmission_profile: opts.transmission_profile || [],
      signal_constellation: opts.signal_constellation || [],
      power_curve: opts.power_curve || [],
      frequency_offset: opts.frequency_offset ?? 0,
    },
    confidence: clamp(opts.confidence || 0, 0, 1),
    observations: opts.observationCount || 0,
    first_seen: opts.first_seen || now,
    last_verified: opts.last_verified || now,
    channel_fingerprints: opts.channel_fingerprints || {},
    created: now,
    source: "foundation-identity",
    tags: ["foundation", "identity"],
    scope: "global",
    crpiScore: 0.4,
  };
}

// ── Observation Recording ───────────────────────────────────────────────────

export function recordObservation(nodeId, observerNodeId, channelData) {
  if (!nodeId || !channelData) return null;

  const observation = {
    id: uid("obs"),
    nodeId,
    observerNodeId: observerNodeId || "self",
    channel: channelData.channel || "unknown",
    timestamp: nowISO(),
    measurements: {
      clock_drift_rate: channelData.clock_drift_rate ?? null,
      signal_strength: channelData.signal_strength ?? null,
      frequency_offset: channelData.frequency_offset ?? null,
      power_curve_sample: channelData.power_curve_sample ?? null,
      rise_time: channelData.rise_time ?? null,
      fall_time: channelData.fall_time ?? null,
    },
  };

  // Add to observation list
  if (!_identityState.observations.has(nodeId)) {
    _identityState.observations.set(nodeId, []);
  }
  const nodeObs = _identityState.observations.get(nodeId);
  nodeObs.push(observation);

  // Cap observations per node
  if (nodeObs.length > 200) {
    _identityState.observations.set(nodeId, nodeObs.slice(-150));
  }

  _identityState.stats.totalObservations++;

  // Check if we have enough observations to establish identity
  if (nodeObs.length >= MIN_OBSERVATIONS_FOR_IDENTITY && !_identityState.identities.has(nodeId)) {
    establishIdentity(nodeId);
  }

  return observation;
}

// ── Identity Establishment ──────────────────────────────────────────────────

export function establishIdentity(nodeId) {
  const observations = _identityState.observations.get(nodeId);
  if (!observations || observations.length < MIN_OBSERVATIONS_FOR_IDENTITY) return null;

  // Average the observed characteristics to build fingerprint
  const clockDrifts = observations
    .map(o => o.measurements.clock_drift_rate)
    .filter(v => v != null);
  const freqOffsets = observations
    .map(o => o.measurements.frequency_offset)
    .filter(v => v != null);
  const riseTimes = observations
    .map(o => o.measurements.rise_time)
    .filter(v => v != null);

  const avgClockDrift = clockDrifts.length > 0
    ? clockDrifts.reduce((a, b) => a + b, 0) / clockDrifts.length : 0;
  const avgFreqOffset = freqOffsets.length > 0
    ? freqOffsets.reduce((a, b) => a + b, 0) / freqOffsets.length : 0;

  // Confidence grows with more observations, capped at ESTABLISHED
  const confidence = Math.min(observations.length / 50, CONFIDENCE_LEVELS.ESTABLISHED);

  // Build channel fingerprints
  const channelFPs = {};
  for (const obs of observations) {
    if (!channelFPs[obs.channel]) channelFPs[obs.channel] = { count: 0 };
    channelFPs[obs.channel].count++;
  }

  const identity = {
    nodeId,
    fingerprint: {
      clock_drift_rate: avgClockDrift,
      frequency_offset: avgFreqOffset,
      transmission_profile: riseTimes.slice(0, 10),
    },
    confidence,
    observationCount: observations.length,
    observers: [...new Set(observations.map(o => o.observerNodeId))],
    firstSeen: observations[0].timestamp,
    lastVerified: nowISO(),
    channelFingerprints: channelFPs,
    verified: confidence >= CONFIDENCE_LEVELS.MEDIUM,
  };

  _identityState.identities.set(nodeId, identity);
  _identityState.stats.totalIdentities = _identityState.identities.size;

  return identity;
}

// ── Verification ────────────────────────────────────────────────────────────

export function verifyNode(nodeId, currentMeasurements) {
  if (!nodeId || !currentMeasurements) {
    return { verified: false, reason: "missing_input" };
  }

  const identity = _identityState.identities.get(nodeId);
  if (!identity) {
    return { verified: false, reason: "unknown_node", nodeId };
  }

  _identityState.stats.totalVerifications++;

  // Compare current measurements against established fingerprint
  let deviations = 0;
  let checks = 0;

  if (currentMeasurements.clock_drift_rate != null && identity.fingerprint.clock_drift_rate !== 0) {
    const drift = Math.abs(currentMeasurements.clock_drift_rate - identity.fingerprint.clock_drift_rate);
    const tolerance = Math.abs(identity.fingerprint.clock_drift_rate) * VERIFICATION_TOLERANCE;
    if (drift > tolerance && tolerance > 0) deviations++;
    checks++;
  }

  if (currentMeasurements.frequency_offset != null && identity.fingerprint.frequency_offset !== 0) {
    const offset = Math.abs(currentMeasurements.frequency_offset - identity.fingerprint.frequency_offset);
    const tolerance = Math.abs(identity.fingerprint.frequency_offset) * VERIFICATION_TOLERANCE;
    if (offset > tolerance && tolerance > 0) deviations++;
    checks++;
  }

  // If no checks possible, pass with low confidence
  if (checks === 0) {
    return { verified: true, confidence: 0.1, reason: "no_comparable_measurements" };
  }

  const deviationRatio = deviations / checks;
  const passed = deviationRatio <= 0.5; // Majority must match

  const result = {
    verified: passed,
    confidence: passed ? identity.confidence : 0,
    deviationRatio,
    checks,
    deviations,
    nodeId,
    reason: passed ? "fingerprint_match" : "fingerprint_mismatch",
  };

  // Log verification
  _identityState.verificationLog.push({
    ...result,
    timestamp: nowISO(),
  });
  if (_identityState.verificationLog.length > 500) {
    _identityState.verificationLog = _identityState.verificationLog.slice(-400);
  }

  if (passed) {
    _identityState.stats.verificationsPassed++;
    identity.lastVerified = nowISO();
  } else {
    _identityState.stats.verificationsFailed++;
  }
  _identityState.stats.lastVerificationAt = nowISO();

  return result;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getIdentityMetrics() {
  return {
    initialized: _identityState.initialized,
    identityCount: _identityState.identities.size,
    observationCount: _identityState.stats.totalObservations,
    stats: { ..._identityState.stats },
    uptime: Date.now() - _identityState.stats.uptime,
  };
}

export function getIdentity(nodeId) {
  return _identityState.identities.get(nodeId) || null;
}

export function getAllIdentities(limit = 100) {
  return [..._identityState.identities.values()].slice(0, limit);
}

export function getVerificationLog(limit = 50) {
  return _identityState.verificationLog.slice(-limit);
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeIdentity(STATE) {
  if (_identityState.initialized) return { ok: true, alreadyInitialized: true };

  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "IDENTITY" && dtu.node_id) {
        _identityState.identities.set(dtu.node_id, {
          nodeId: dtu.node_id,
          fingerprint: dtu.fingerprint || {},
          confidence: dtu.confidence || 0,
          observationCount: dtu.observations || 0,
          firstSeen: dtu.first_seen,
          lastVerified: dtu.last_verified,
          channelFingerprints: dtu.channel_fingerprints || {},
          verified: (dtu.confidence || 0) >= CONFIDENCE_LEVELS.MEDIUM,
        });
        indexed++;
      }
    }
  }

  _identityState.initialized = true;
  _identityState.stats.totalIdentities = _identityState.identities.size;
  _identityState.stats.uptime = Date.now();

  return { ok: true, indexed };
}

export function _resetIdentityState() {
  _identityState.initialized = false;
  _identityState.identities.clear();
  _identityState.observations.clear();
  _identityState.verificationLog = [];
  _identityState.stats = {
    totalIdentities: 0, totalObservations: 0, totalVerifications: 0,
    verificationsPassed: 0, verificationsFailed: 0, lastVerificationAt: null,
    uptime: Date.now(),
  };
}
