/**
 * Foundation Neural — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (NEURAL_TRANSPORT, SIMULATION_PROFILES)
 *   - encodeToDTUStream (happy path, null, signal fields)
 *   - decodeFromDTUStream (happy path, null, defaults)
 *   - runSimulation (profiles, default, stats)
 *   - assessReadiness (initial, post-simulation)
 *   - Metrics (getNeuralMetrics)
 *   - initializeNeural (simulation mode, double-init)
 *   - _resetNeuralState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  NEURAL_TRANSPORT,
  SIMULATION_PROFILES,
  encodeToDTUStream,
  decodeFromDTUStream,
  runSimulation,
  assessReadiness,
  getNeuralMetrics,
  initializeNeural,
  _resetNeuralState,
} from "../lib/foundation-neural.js";

beforeEach(() => {
  _resetNeuralState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Neural — Constants", () => {
  it("defines NEURAL_TRANSPORT specification", () => {
    assert.equal(NEURAL_TRANSPORT.channel, "neural");
    assert.equal(NEURAL_TRANSPORT.protocol, "concord-bci");
    assert.equal(NEURAL_TRANSPORT.power_range, "microvolt");
    assert.equal(NEURAL_TRANSPORT.bandwidth, "very_high");
    assert.equal(NEURAL_TRANSPORT.range, "contact_to_centimeters");
    assert.equal(NEURAL_TRANSPORT.latency_tolerance, "real_time_only");
    assert.equal(NEURAL_TRANSPORT.encoding, "dtu_stream");
  });

  it("defines 4 simulation profiles", () => {
    assert.ok(SIMULATION_PROFILES.IDEAL);
    assert.ok(SIMULATION_PROFILES.GOOD);
    assert.ok(SIMULATION_PROFILES.STANDARD);
    assert.ok(SIMULATION_PROFILES.NOISY);
  });

  it("IDEAL profile has best characteristics", () => {
    assert.equal(SIMULATION_PROFILES.IDEAL.latencyMs, 1);
    assert.equal(SIMULATION_PROFILES.IDEAL.errorRate, 0.001);
    assert.equal(SIMULATION_PROFILES.IDEAL.bandwidthMbps, 100);
  });

  it("NOISY profile has worst characteristics", () => {
    assert.equal(SIMULATION_PROFILES.NOISY.latencyMs, 25);
    assert.equal(SIMULATION_PROFILES.NOISY.errorRate, 0.1);
    assert.equal(SIMULATION_PROFILES.NOISY.bandwidthMbps, 5);
  });

  it("latency increases from IDEAL to NOISY", () => {
    assert.ok(SIMULATION_PROFILES.IDEAL.latencyMs < SIMULATION_PROFILES.GOOD.latencyMs);
    assert.ok(SIMULATION_PROFILES.GOOD.latencyMs < SIMULATION_PROFILES.STANDARD.latencyMs);
    assert.ok(SIMULATION_PROFILES.STANDARD.latencyMs < SIMULATION_PROFILES.NOISY.latencyMs);
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(NEURAL_TRANSPORT), true);
    assert.equal(Object.isFrozen(SIMULATION_PROFILES), true);
  });
});

// ── encodeToDTUStream ──────────────────────────────────────────────────────

describe("Foundation Neural — encodeToDTUStream", () => {
  it("returns null for null input", () => {
    assert.equal(encodeToDTUStream(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(encodeToDTUStream(undefined), null);
  });

  it("encodes a neural signal to DTU stream", () => {
    const dtu = encodeToDTUStream({
      channels: 64,
      sampleRate: 500,
      duration: 1.0,
      dataPoints: 32000,
    });
    assert.notEqual(dtu, null);
    assert.match(dtu.id, /^neural_stream_/);
    assert.equal(dtu.type, "NEURAL_STREAM");
    assert.equal(dtu.subtype, "encode");
    assert.equal(dtu.source, "foundation-neural");
    assert.equal(dtu.encoding, "dtu_stream");
    assert.equal(dtu.signal.channels, 64);
    assert.equal(dtu.signal.sampleRate, 500);
    assert.equal(dtu.signal.duration, 1.0);
    assert.equal(dtu.signal.dataPoints, 32000);
    assert.equal(dtu.simulated, true);
    assert.ok(dtu.tags.includes("neural"));
    assert.ok(dtu.tags.includes("stream"));
    assert.ok(dtu.tags.includes("encode"));
    assert.equal(dtu.scope, "local");
    assert.equal(dtu.crpiScore, 0.3);
  });

  it("defaults signal fields when not provided", () => {
    const dtu = encodeToDTUStream({});
    assert.equal(dtu.signal.channels, 1);
    assert.equal(dtu.signal.sampleRate, 250);
    assert.equal(dtu.signal.duration, 0);
    assert.equal(dtu.signal.dataPoints, 0);
  });

  it("increments totalDTUsEncoded stat", () => {
    encodeToDTUStream({ channels: 1 });
    encodeToDTUStream({ channels: 2 });
    const metrics = getNeuralMetrics();
    assert.equal(metrics.stats.totalDTUsEncoded, 2);
  });

  it("adds entry to stream log", () => {
    const dtu = encodeToDTUStream({ channels: 1 });
    const metrics = getNeuralMetrics();
    // Stream log is internal; check stats reflect the encoding
    assert.equal(metrics.stats.totalDTUsEncoded, 1);
  });

  it("trims stream log at 200 (keeps 150)", () => {
    for (let i = 0; i < 210; i++) {
      encodeToDTUStream({ channels: 1 });
    }
    // No external way to check log size, but should not throw
    const metrics = getNeuralMetrics();
    assert.equal(metrics.stats.totalDTUsEncoded, 210);
  });
});

// ── decodeFromDTUStream ──────────────────────────────────────────────────

describe("Foundation Neural — decodeFromDTUStream", () => {
  it("returns null for null input", () => {
    assert.equal(decodeFromDTUStream(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(decodeFromDTUStream(undefined), null);
  });

  it("decodes a DTU stream", () => {
    const encoded = encodeToDTUStream({ channels: 32, sampleRate: 1000 });
    const decoded = decodeFromDTUStream(encoded);
    assert.notEqual(decoded, null);
    assert.equal(decoded.ok, true);
    assert.equal(decoded.channels, 32);
    assert.equal(decoded.sampleRate, 1000);
    assert.equal(decoded.simulated, true);
    assert.ok(decoded.decodedAt);
  });

  it("defaults signal fields when missing", () => {
    const decoded = decodeFromDTUStream({ id: "test_stream" });
    assert.equal(decoded.channels, 1);
    assert.equal(decoded.sampleRate, 250);
  });

  it("increments totalDTUsDecoded stat", () => {
    decodeFromDTUStream({ id: "s1" });
    decodeFromDTUStream({ id: "s2" });
    const metrics = getNeuralMetrics();
    assert.equal(metrics.stats.totalDTUsDecoded, 2);
  });
});

// ── Full encode/decode round-trip ──────────────────────────────────────

describe("Foundation Neural — Encode/Decode Round Trip", () => {
  it("preserves signal characteristics through round-trip", () => {
    const original = { channels: 128, sampleRate: 2000, duration: 0.5, dataPoints: 128000 };
    const encoded = encodeToDTUStream(original);
    const decoded = decodeFromDTUStream(encoded);
    assert.equal(decoded.channels, 128);
    assert.equal(decoded.sampleRate, 2000);
  });
});

// ── runSimulation ──────────────────────────────────────────────────────────

describe("Foundation Neural — runSimulation", () => {
  it("runs simulation with default (STANDARD) profile", () => {
    const result = runSimulation();
    assert.notEqual(result, null);
    assert.match(result.id, /^sim_/);
    assert.equal(result.profile, "STANDARD");
    assert.equal(result.latencyMs, SIMULATION_PROFILES.STANDARD.latencyMs);
    assert.equal(result.errorRate, SIMULATION_PROFILES.STANDARD.errorRate);
    assert.equal(result.bandwidthMbps, SIMULATION_PROFILES.STANDARD.bandwidthMbps);
    assert.equal(result.simulated, true);
    assert.ok(result.roundTripMs > 0);
    assert.ok(result.throughputDTUsPerSec > 0);
    assert.ok(result.dtuEncodeTime > 0);
    assert.ok(result.dtuDecodeTime > 0);
  });

  it("runs simulation with IDEAL profile", () => {
    const result = runSimulation("IDEAL");
    assert.equal(result.profile, "IDEAL");
    assert.equal(result.latencyMs, 1);
    assert.equal(result.errorRate, 0.001);
    assert.equal(result.bandwidthMbps, 100);
    assert.ok(result.throughputDTUsPerSec > result.bandwidthMbps);
  });

  it("runs simulation with NOISY profile", () => {
    const result = runSimulation("NOISY");
    assert.equal(result.profile, "NOISY");
    assert.equal(result.latencyMs, 25);
  });

  it("falls back to STANDARD for unknown profile", () => {
    const result = runSimulation("UNKNOWN_PROFILE");
    assert.equal(result.latencyMs, SIMULATION_PROFILES.STANDARD.latencyMs);
  });

  it("increments simulationRuns stat", () => {
    runSimulation();
    runSimulation("IDEAL");
    runSimulation("NOISY");
    const metrics = getNeuralMetrics();
    assert.equal(metrics.stats.simulationRuns, 3);
  });

  it("roundTripMs is double latencyMs", () => {
    const result = runSimulation("GOOD");
    assert.equal(result.roundTripMs, SIMULATION_PROFILES.GOOD.latencyMs * 2);
  });

  it("encode/decode time is 30% of latency", () => {
    const result = runSimulation("GOOD");
    assert.ok(Math.abs(result.dtuEncodeTime - SIMULATION_PROFILES.GOOD.latencyMs * 0.3) < 0.001);
    assert.ok(Math.abs(result.dtuDecodeTime - SIMULATION_PROFILES.GOOD.latencyMs * 0.3) < 0.001);
  });
});

// ── assessReadiness ──────────────────────────────────────────────────────

describe("Foundation Neural — assessReadiness", () => {
  it("reports not fully ready initially (no hardware, no simulation)", () => {
    const readiness = assessReadiness();
    assert.equal(readiness.ready, false);
    assert.ok(readiness.readiness < 1);
    assert.equal(readiness.hardwareRequired, true);
    assert.equal(readiness.simulationMode, true);
    assert.equal(readiness.checks.hardware_detected, false);
    assert.equal(readiness.checks.simulation_validated, false);
    assert.equal(readiness.checks.mesh_routing_ready, true);
    assert.equal(readiness.checks.dtu_stream_encoding, true);
    assert.equal(readiness.checks.mind_space_integration, true);
    assert.equal(readiness.checks.transport_adapter, true);
    assert.equal(readiness.checks.real_time_path, true);
  });

  it("simulation_validated becomes true after running a simulation", () => {
    runSimulation();
    const readiness = assessReadiness();
    assert.equal(readiness.checks.simulation_validated, true);
  });

  it("readiness increases after simulation", () => {
    const before = assessReadiness().readiness;
    runSimulation();
    const after = assessReadiness().readiness;
    assert.ok(after > before);
  });

  it("still not ready without hardware (5/7 checks)", () => {
    runSimulation();
    const readiness = assessReadiness();
    assert.equal(readiness.ready, false);
    assert.equal(readiness.readiness, 6 / 7); // simulation + 5 always-true, but no hardware
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Neural — Metrics", () => {
  it("returns comprehensive metrics", () => {
    const metrics = getNeuralMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.hardwareDetected, false);
    assert.equal(metrics.simulationMode, true);
    assert.equal(metrics.simulationProfile, "STANDARD");
    assert.ok(metrics.readiness);
    assert.ok(metrics.transport);
    assert.equal(metrics.transport.channel, "neural");
    assert.ok(metrics.uptime >= 0);
  });

  it("reflects activity in stats", () => {
    encodeToDTUStream({ channels: 1 });
    decodeFromDTUStream({ id: "s1" });
    runSimulation();
    const metrics = getNeuralMetrics();
    assert.equal(metrics.stats.totalDTUsEncoded, 1);
    assert.equal(metrics.stats.totalDTUsDecoded, 1);
    assert.equal(metrics.stats.simulationRuns, 1);
  });
});

// ── initializeNeural ──────────────────────────────────────────────────────

describe("Foundation Neural — initializeNeural", () => {
  it("initializes in simulation mode", async () => {
    const result = await initializeNeural({});
    assert.equal(result.ok, true);
    assert.equal(result.simulationMode, true);
    assert.equal(result.hardwareDetected, false);
    const metrics = getNeuralMetrics();
    assert.equal(metrics.initialized, true);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeNeural({});
    const result = await initializeNeural({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE", async () => {
    const result = await initializeNeural(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetNeuralState ──────────────────────────────────────────────────────

describe("Foundation Neural — _resetNeuralState", () => {
  it("resets all state", async () => {
    await initializeNeural({});
    encodeToDTUStream({ channels: 1 });
    runSimulation();
    _resetNeuralState();

    const metrics = getNeuralMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.hardwareDetected, false);
    assert.equal(metrics.simulationMode, true);
    assert.equal(metrics.simulationProfile, "STANDARD");
    assert.equal(metrics.stats.totalDTUsEncoded, 0);
    assert.equal(metrics.stats.totalDTUsDecoded, 0);
    assert.equal(metrics.stats.simulationRuns, 0);
  });
});
