/**
 * Foundation Neural — Biological Interface Preparation
 *
 * Prepares the mesh for neural signal integration as Layer 8.
 * BCI hardware → DTU streams → mesh routing engine → lattice.
 * Before hardware exists, simulates neural transport characteristics
 * for testing.
 *
 * Rules:
 *   1. Real-time only. Neural channel can't tolerate store-and-forward.
 *   2. DTU stream format. Same encoding as every other channel.
 *   3. Mind Space integration. Neural is a transport adapter, not a new protocol.
 */

import crypto from "crypto";

function uid(prefix = "neural") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const NEURAL_TRANSPORT = Object.freeze({
  channel: "neural",
  protocol: "concord-bci",
  power_range: "microvolt",
  bandwidth: "very_high",
  range: "contact_to_centimeters",
  latency_tolerance: "real_time_only",
  encoding: "dtu_stream",
});

export const SIMULATION_PROFILES = Object.freeze({
  IDEAL:    { latencyMs: 1,   errorRate: 0.001, bandwidthMbps: 100 },
  GOOD:     { latencyMs: 5,   errorRate: 0.01,  bandwidthMbps: 50 },
  STANDARD: { latencyMs: 10,  errorRate: 0.05,  bandwidthMbps: 20 },
  NOISY:    { latencyMs: 25,  errorRate: 0.1,   bandwidthMbps: 5 },
});

// ── Module State ────────────────────────────────────────────────────────────

const _neuralState = {
  initialized: false,
  hardwareDetected: false,
  simulationMode: true,
  simulationProfile: "STANDARD",
  readinessChecks: {},
  streamLog: [],
  stats: {
    totalStreams: 0,
    totalDTUsEncoded: 0,
    totalDTUsDecoded: 0,
    simulationRuns: 0,
    lastStreamAt: null,
    uptime: Date.now(),
  },
};

// ── Neural DTU Encoding ─────────────────────────────────────────────────────

export function encodeToDTUStream(neuralSignal) {
  if (!neuralSignal) return null;

  const id = uid("neural_stream");
  const now = nowISO();

  const dtu = {
    id,
    type: "NEURAL_STREAM",
    subtype: "encode",
    created: now,
    source: "foundation-neural",
    encoding: NEURAL_TRANSPORT.encoding,
    signal: {
      channels: neuralSignal.channels || 1,
      sampleRate: neuralSignal.sampleRate || 250,
      duration: neuralSignal.duration || 0,
      dataPoints: neuralSignal.dataPoints || 0,
    },
    simulated: _neuralState.simulationMode,
    tags: ["foundation", "neural", "stream", "encode"],
    scope: "local",
    crpiScore: 0.3,
  };

  _neuralState.stats.totalDTUsEncoded++;
  _neuralState.streamLog.push({ id, direction: "encode", timestamp: now });
  if (_neuralState.streamLog.length > 200) {
    _neuralState.streamLog = _neuralState.streamLog.slice(-150);
  }

  return dtu;
}

export function decodeFromDTUStream(dtuStream) {
  if (!dtuStream) return null;

  _neuralState.stats.totalDTUsDecoded++;
  _neuralState.streamLog.push({
    id: dtuStream.id,
    direction: "decode",
    timestamp: nowISO(),
  });

  return {
    ok: true,
    channels: dtuStream.signal?.channels || 1,
    sampleRate: dtuStream.signal?.sampleRate || 250,
    simulated: _neuralState.simulationMode,
    decodedAt: nowISO(),
  };
}

// ── Simulation ──────────────────────────────────────────────────────────────

export function runSimulation(profile) {
  const profileName = profile || _neuralState.simulationProfile;
  const sim = SIMULATION_PROFILES[profileName] || SIMULATION_PROFILES.STANDARD;

  const result = {
    id: uid("sim"),
    profile: profileName,
    latencyMs: sim.latencyMs,
    errorRate: sim.errorRate,
    bandwidthMbps: sim.bandwidthMbps,
    // Simulate a DTU stream
    dtuEncodeTime: sim.latencyMs * 0.3,
    dtuDecodeTime: sim.latencyMs * 0.3,
    roundTripMs: sim.latencyMs * 2,
    throughputDTUsPerSec: Math.floor(sim.bandwidthMbps * 1000 / 64), // DTUs at ~64 bytes
    packetLoss: Math.random() < sim.errorRate,
    timestamp: nowISO(),
    simulated: true,
  };

  _neuralState.stats.simulationRuns++;
  return result;
}

// ── Readiness Assessment ────────────────────────────────────────────────────

export function assessReadiness() {
  const checks = {
    mesh_routing_ready: true,           // Mesh routing engine exists
    dtu_stream_encoding: true,          // Encoding functions exist
    mind_space_integration: true,       // Mind Space module exists
    transport_adapter: true,            // Transport adapter pattern ready
    hardware_detected: _neuralState.hardwareDetected,
    simulation_validated: _neuralState.stats.simulationRuns > 0,
    real_time_path: true,               // Real-time routing available
  };

  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(Boolean).length;

  _neuralState.readinessChecks = checks;

  return {
    ready: passedChecks === totalChecks,
    readiness: passedChecks / totalChecks,
    checks,
    hardwareRequired: !_neuralState.hardwareDetected,
    simulationMode: _neuralState.simulationMode,
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getNeuralMetrics() {
  return {
    initialized: _neuralState.initialized,
    hardwareDetected: _neuralState.hardwareDetected,
    simulationMode: _neuralState.simulationMode,
    simulationProfile: _neuralState.simulationProfile,
    readiness: assessReadiness(),
    stats: { ..._neuralState.stats },
    transport: NEURAL_TRANSPORT,
    uptime: Date.now() - _neuralState.stats.uptime,
  };
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeNeural(STATE) {
  if (_neuralState.initialized) return { ok: true, alreadyInitialized: true };

  // Hardware detection would go here — for now, simulation mode
  _neuralState.hardwareDetected = false;
  _neuralState.simulationMode = true;

  _neuralState.initialized = true;
  _neuralState.stats.uptime = Date.now();
  return { ok: true, simulationMode: true, hardwareDetected: false };
}

export function _resetNeuralState() {
  _neuralState.initialized = false;
  _neuralState.hardwareDetected = false;
  _neuralState.simulationMode = true;
  _neuralState.simulationProfile = "STANDARD";
  _neuralState.readinessChecks = {};
  _neuralState.streamLog = [];
  _neuralState.stats = {
    totalStreams: 0, totalDTUsEncoded: 0, totalDTUsDecoded: 0,
    simulationRuns: 0, lastStreamAt: null, uptime: Date.now(),
  };
}
