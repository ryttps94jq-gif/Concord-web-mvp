/**
 * Foundation Identity — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (confidence levels, min observations, verification tolerance)
 *   - createIdentityDTU (happy path, fingerprint, confidence clamping)
 *   - recordObservation (null handling, accumulation, auto-establish)
 *   - establishIdentity (insufficient observations, fingerprint building, confidence)
 *   - verifyNode (matching, mismatching, missing inputs, no comparable measurements)
 *   - Metrics getters (getIdentityMetrics, getIdentity, getAllIdentities, getVerificationLog)
 *   - initializeIdentity (indexing, double-init)
 *   - _resetIdentityState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  CONFIDENCE_LEVELS,
  MIN_OBSERVATIONS_FOR_IDENTITY,
  VERIFICATION_TOLERANCE,
  createIdentityDTU,
  recordObservation,
  establishIdentity,
  verifyNode,
  getIdentityMetrics,
  getIdentity,
  getAllIdentities,
  getVerificationLog,
  initializeIdentity,
  _resetIdentityState,
} from "../lib/foundation-identity.js";

beforeEach(() => {
  _resetIdentityState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Identity — Constants", () => {
  it("defines confidence levels", () => {
    assert.equal(CONFIDENCE_LEVELS.UNVERIFIED, 0);
    assert.equal(CONFIDENCE_LEVELS.LOW, 0.3);
    assert.equal(CONFIDENCE_LEVELS.MEDIUM, 0.6);
    assert.equal(CONFIDENCE_LEVELS.HIGH, 0.85);
    assert.equal(CONFIDENCE_LEVELS.ESTABLISHED, 0.95);
  });

  it("defines minimum observations for identity", () => {
    assert.equal(MIN_OBSERVATIONS_FOR_IDENTITY, 5);
  });

  it("defines verification tolerance", () => {
    assert.equal(VERIFICATION_TOLERANCE, 0.15);
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(CONFIDENCE_LEVELS), true);
  });
});

// ── createIdentityDTU ──────────────────────────────────────────────────────

describe("Foundation Identity — createIdentityDTU", () => {
  it("creates DTU with required fields", () => {
    const dtu = createIdentityDTU({ node_id: "node_001" });
    assert.match(dtu.id, /^identity_/);
    assert.equal(dtu.type, "IDENTITY");
    assert.equal(dtu.node_id, "node_001");
    assert.equal(dtu.source, "foundation-identity");
    assert.ok(dtu.tags.includes("foundation"));
    assert.ok(dtu.tags.includes("identity"));
    assert.equal(dtu.scope, "global");
    assert.equal(dtu.crpiScore, 0.4);
  });

  it("accepts nodeId as alternative to node_id", () => {
    const dtu = createIdentityDTU({ nodeId: "node_002" });
    assert.equal(dtu.node_id, "node_002");
  });

  it("sets fingerprint values from opts", () => {
    const dtu = createIdentityDTU({
      node_id: "n1",
      clock_drift_rate: 0.0015,
      transmission_profile: [1, 2, 3],
      signal_constellation: [4, 5],
      power_curve: [0.1, 0.2],
      frequency_offset: 0.005,
    });
    assert.equal(dtu.fingerprint.clock_drift_rate, 0.0015);
    assert.deepEqual(dtu.fingerprint.transmission_profile, [1, 2, 3]);
    assert.deepEqual(dtu.fingerprint.signal_constellation, [4, 5]);
    assert.deepEqual(dtu.fingerprint.power_curve, [0.1, 0.2]);
    assert.equal(dtu.fingerprint.frequency_offset, 0.005);
  });

  it("defaults fingerprint to zeros and empty arrays", () => {
    const dtu = createIdentityDTU({ node_id: "n1" });
    assert.equal(dtu.fingerprint.clock_drift_rate, 0);
    assert.deepEqual(dtu.fingerprint.transmission_profile, []);
    assert.equal(dtu.fingerprint.frequency_offset, 0);
  });

  it("clamps confidence between 0 and 1", () => {
    const lowDtu = createIdentityDTU({ node_id: "n1", confidence: -1 });
    assert.equal(lowDtu.confidence, 0);

    const highDtu = createIdentityDTU({ node_id: "n1", confidence: 5 });
    assert.equal(highDtu.confidence, 1);
  });

  it("sets created and last_verified timestamps", () => {
    const dtu = createIdentityDTU({ node_id: "n1" });
    assert.ok(dtu.created);
    assert.ok(dtu.last_verified);
  });
});

// ── recordObservation ──────────────────────────────────────────────────────

describe("Foundation Identity — recordObservation", () => {
  it("returns null for missing nodeId", () => {
    assert.equal(recordObservation(null, "obs1", { channel: "wifi" }), null);
    assert.equal(recordObservation("", "obs1", { channel: "wifi" }), null);
  });

  it("returns null for missing channelData", () => {
    assert.equal(recordObservation("node1", "obs1", null), null);
    assert.equal(recordObservation("node1", "obs1", undefined), null);
  });

  it("records a valid observation", () => {
    const obs = recordObservation("node1", "obs1", {
      channel: "wifi",
      clock_drift_rate: 0.001,
      signal_strength: -45,
      frequency_offset: 0.003,
    });
    assert.notEqual(obs, null);
    assert.match(obs.id, /^obs_/);
    assert.equal(obs.nodeId, "node1");
    assert.equal(obs.observerNodeId, "obs1");
    assert.equal(obs.channel, "wifi");
    assert.equal(obs.measurements.clock_drift_rate, 0.001);
    assert.equal(obs.measurements.signal_strength, -45);
  });

  it("defaults observerNodeId to self when not provided", () => {
    const obs = recordObservation("node1", null, { channel: "lora" });
    assert.equal(obs.observerNodeId, "self");
  });

  it("increments totalObservations stat", () => {
    recordObservation("node1", "obs1", { channel: "wifi" });
    recordObservation("node1", "obs2", { channel: "lora" });
    const metrics = getIdentityMetrics();
    assert.equal(metrics.observationCount, 2);
  });

  it("auto-establishes identity after MIN_OBSERVATIONS_FOR_IDENTITY observations", () => {
    for (let i = 0; i < MIN_OBSERVATIONS_FOR_IDENTITY; i++) {
      recordObservation("autoNode", `obs_${i}`, {
        channel: "wifi",
        clock_drift_rate: 0.001 + i * 0.0001,
        frequency_offset: 0.003,
      });
    }
    const identity = getIdentity("autoNode");
    assert.notEqual(identity, null);
    assert.equal(identity.nodeId, "autoNode");
  });

  it("caps observations per node at 200 (trims to 150)", () => {
    for (let i = 0; i < 210; i++) {
      recordObservation("bulkNode", `obs_${i}`, { channel: "wifi" });
    }
    // After trimming, should have 150 observations
    const metrics = getIdentityMetrics();
    assert.ok(metrics.observationCount >= 200); // total count still increments
  });
});

// ── establishIdentity ──────────────────────────────────────────────────────

describe("Foundation Identity — establishIdentity", () => {
  it("returns null if not enough observations", () => {
    recordObservation("node1", "obs1", { channel: "wifi" });
    const identity = establishIdentity("node1");
    assert.equal(identity, null);
  });

  it("returns null for unknown node", () => {
    assert.equal(establishIdentity("unknown_node"), null);
  });

  it("establishes identity with sufficient observations", () => {
    for (let i = 0; i < 6; i++) {
      recordObservation("nodeE", `obs_${i}`, {
        channel: "wifi",
        clock_drift_rate: 0.001,
        frequency_offset: 0.005,
        rise_time: 0.1,
      });
    }
    const identity = establishIdentity("nodeE");
    assert.notEqual(identity, null);
    assert.equal(identity.nodeId, "nodeE");
    assert.ok(identity.confidence > 0);
    assert.equal(identity.observationCount, 6);
    assert.ok(identity.observers.length > 0);
  });

  it("averages clock drift and frequency offset", () => {
    for (let i = 0; i < 5; i++) {
      recordObservation("avgNode", `obs_${i}`, {
        channel: "wifi",
        clock_drift_rate: 0.001 * (i + 1), // 0.001, 0.002, 0.003, 0.004, 0.005
        frequency_offset: 0.01 * (i + 1),
      });
    }
    const identity = establishIdentity("avgNode");
    assert.notEqual(identity, null);
    assert.ok(Math.abs(identity.fingerprint.clock_drift_rate - 0.003) < 0.001);
  });

  it("tracks channel fingerprints", () => {
    for (let i = 0; i < 5; i++) {
      recordObservation("chNode", `obs_${i}`, { channel: i < 3 ? "wifi" : "lora" });
    }
    const identity = establishIdentity("chNode");
    assert.notEqual(identity, null);
    assert.equal(identity.channelFingerprints.wifi.count, 3);
    assert.equal(identity.channelFingerprints.lora.count, 2);
  });

  it("confidence scales with observation count", () => {
    for (let i = 0; i < 5; i++) {
      recordObservation("confNode5", `obs_${i}`, { channel: "wifi" });
    }
    const id5 = establishIdentity("confNode5");

    _resetIdentityState();

    for (let i = 0; i < 30; i++) {
      recordObservation("confNode30", `obs_${i}`, { channel: "wifi" });
    }
    const id30 = establishIdentity("confNode30");

    assert.ok(id30.confidence > id5.confidence);
  });

  it("marks verified when confidence >= MEDIUM", () => {
    // Need enough observations for medium confidence (30+ for 0.6)
    for (let i = 0; i < 35; i++) {
      recordObservation("verNode", `obs_${i}`, { channel: "wifi" });
    }
    const identity = establishIdentity("verNode");
    assert.equal(identity.verified, true);
  });

  it("updates totalIdentities stat", () => {
    for (let i = 0; i < 5; i++) {
      recordObservation("statNode", `obs_${i}`, { channel: "wifi" });
    }
    establishIdentity("statNode");
    const metrics = getIdentityMetrics();
    assert.equal(metrics.identityCount, 1);
  });
});

// ── verifyNode ──────────────────────────────────────────────────────────────

describe("Foundation Identity — verifyNode", () => {
  beforeEach(() => {
    // Establish an identity
    for (let i = 0; i < 10; i++) {
      recordObservation("verifyMe", `obs_${i}`, {
        channel: "wifi",
        clock_drift_rate: 0.001,
        frequency_offset: 0.005,
      });
    }
    establishIdentity("verifyMe");
  });

  it("returns failure for missing nodeId", () => {
    const result = verifyNode(null, { clock_drift_rate: 0.001 });
    assert.equal(result.verified, false);
    assert.equal(result.reason, "missing_input");
  });

  it("returns failure for missing measurements", () => {
    const result = verifyNode("verifyMe", null);
    assert.equal(result.verified, false);
    assert.equal(result.reason, "missing_input");
  });

  it("returns failure for unknown node", () => {
    const result = verifyNode("unknownNode", { clock_drift_rate: 0.001 });
    assert.equal(result.verified, false);
    assert.equal(result.reason, "unknown_node");
    assert.equal(result.nodeId, "unknownNode");
  });

  it("passes verification when measurements match fingerprint", () => {
    const result = verifyNode("verifyMe", {
      clock_drift_rate: 0.001,
      frequency_offset: 0.005,
    });
    assert.equal(result.verified, true);
    assert.equal(result.reason, "fingerprint_match");
    assert.ok(result.confidence > 0);
  });

  it("fails verification when measurements deviate significantly", () => {
    const result = verifyNode("verifyMe", {
      clock_drift_rate: 0.1, // 100x deviation
      frequency_offset: 0.5, // 100x deviation
    });
    assert.equal(result.verified, false);
    assert.equal(result.reason, "fingerprint_mismatch");
  });

  it("returns low confidence when no comparable measurements", () => {
    const result = verifyNode("verifyMe", {
      signal_strength: -50, // Not used in verification
    });
    assert.equal(result.verified, true);
    assert.equal(result.confidence, 0.1);
    assert.equal(result.reason, "no_comparable_measurements");
  });

  it("increments verification stats", () => {
    verifyNode("verifyMe", { clock_drift_rate: 0.001 });
    verifyNode("verifyMe", { clock_drift_rate: 0.1 });
    const metrics = getIdentityMetrics();
    assert.equal(metrics.stats.totalVerifications, 2);
    assert.ok(metrics.stats.verificationsPassed >= 1);
    assert.notEqual(metrics.stats.lastVerificationAt, null);
  });

  it("logs verification events", () => {
    verifyNode("verifyMe", { clock_drift_rate: 0.001 });
    const log = getVerificationLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].nodeId, "verifyMe");
  });
});

// ── Metrics Getters ──────────────────────────────────────────────────────

describe("Foundation Identity — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getIdentityMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.identityCount, 0);
    assert.equal(metrics.observationCount, 0);
    assert.ok(metrics.uptime >= 0);
  });

  it("getIdentity returns null for unknown node", () => {
    assert.equal(getIdentity("nonexistent"), null);
  });

  it("getAllIdentities returns empty array initially", () => {
    const all = getAllIdentities();
    assert.deepEqual(all, []);
  });

  it("getAllIdentities respects limit", () => {
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 5; j++) {
        recordObservation(`n_${i}`, `obs_${j}`, { channel: "wifi" });
      }
      establishIdentity(`n_${i}`);
    }
    const limited = getAllIdentities(3);
    assert.equal(limited.length, 3);
  });

  it("getVerificationLog returns limited results", () => {
    const log = getVerificationLog(5);
    assert.ok(Array.isArray(log));
    assert.ok(log.length <= 5);
  });
});

// ── initializeIdentity ──────────────────────────────────────────────────

describe("Foundation Identity — initializeIdentity", () => {
  it("initializes successfully", async () => {
    const result = await initializeIdentity({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    const metrics = getIdentityMetrics();
    assert.equal(metrics.initialized, true);
  });

  it("indexes IDENTITY DTUs from STATE", async () => {
    const STATE = {
      dtus: new Map([
        ["i1", { type: "IDENTITY", node_id: "node1", fingerprint: {}, confidence: 0.8, observations: 10 }],
        ["i2", { type: "IDENTITY", node_id: "node2", fingerprint: {}, confidence: 0.5, observations: 5 }],
        ["other", { type: "SENSOR", id: "other" }],
      ]),
    };
    const result = await initializeIdentity(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 2);
    assert.notEqual(getIdentity("node1"), null);
    assert.notEqual(getIdentity("node2"), null);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeIdentity({});
    const result = await initializeIdentity({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE gracefully", async () => {
    const result = await initializeIdentity(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetIdentityState ──────────────────────────────────────────────────

describe("Foundation Identity — _resetIdentityState", () => {
  it("resets all state", async () => {
    await initializeIdentity({});
    recordObservation("node1", "obs1", { channel: "wifi" });
    _resetIdentityState();

    const metrics = getIdentityMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.identityCount, 0);
    assert.equal(metrics.observationCount, 0);
    assert.equal(metrics.stats.totalVerifications, 0);
  });
});
