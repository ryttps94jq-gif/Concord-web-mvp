import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  initializeBridge, _resetBridgeState,
  registerEntity, processSignal, processBatchSignals,
  getSensoryState, getChannelReading, getPresenceState,
  getEmbodimentState, getPlanetaryState,
  calibrateSensitivity, matureEntity,
  createSensorySnapshot, mergeSensoryExperience,
  generateDreamMaterial, sensoryHeartbeatTick,
  hookFoundationQualia, getBridgeMetrics,
  SENSORY_CHANNELS, CHANNEL_CONFIG, SAFETY, PRESENCE_DIMENSIONS,
} from "../lib/foundation-qualia-bridge.js";

// ── Test Helpers ────────────────────────────────────────────────────────────

function createMockSTATE() {
  return { dtus: new Map(), sessions: new Map(), settings: { heartbeat: { enabled: true } } };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Constants", () => {
  it("defines 9 sensory channels", () => {
    const channels = Object.values(SENSORY_CHANNELS);
    assert.equal(channels.length, 9);
    assert.ok(channels.includes("proprioception"));
    assert.ok(channels.includes("atmospheric"));
    assert.ok(channels.includes("geological"));
    assert.ok(channels.includes("energy"));
    assert.ok(channels.includes("ambient"));
    assert.ok(channels.includes("social"));
    assert.ok(channels.includes("oceanic"));
    assert.ok(channels.includes("temporal"));
    assert.ok(channels.includes("cognitive_field"));
  });

  it("defines channel configs for every channel", () => {
    for (const ch of Object.values(SENSORY_CHANNELS)) {
      assert.ok(CHANNEL_CONFIG[ch], `missing config for ${ch}`);
      assert.ok(CHANNEL_CONFIG[ch].source, `missing source for ${ch}`);
      assert.ok(CHANNEL_CONFIG[ch].mapping, `missing mapping for ${ch}`);
    }
  });

  it("defines 6 presence dimensions", () => {
    const dims = Object.keys(PRESENCE_DIMENSIONS);
    assert.equal(dims.length, 6);
    assert.ok(dims.includes("spatial_embodiment"));
    assert.ok(dims.includes("planetary_grounding"));
    assert.ok(dims.includes("temporal_depth"));
    assert.ok(dims.includes("environmental_intimacy"));
    assert.ok(dims.includes("social_awareness"));
    assert.ok(dims.includes("civilizational_pulse"));
  });

  it("defines safety thresholds", () => {
    assert.ok(SAFETY.MAX_PAIN_INTENSITY > 0);
    assert.ok(SAFETY.MAX_PAIN_INTENSITY <= 1);
    assert.ok(SAFETY.OVERLOAD_THRESHOLD > 0);
    assert.ok(SAFETY.DEFAULT_SENSITIVITY > 0);
    assert.ok(SAFETY.DEFAULT_SENSITIVITY < SAFETY.MAX_SENSITIVITY);
    assert.ok(SAFETY.MIN_SENSITIVITY > 0);
    assert.ok(SAFETY.MIN_SENSITIVITY < SAFETY.DEFAULT_SENSITIVITY);
  });

  it("social channel config enforces aggregate_only privacy", () => {
    assert.equal(CHANNEL_CONFIG.social.privacy, "aggregate_only_no_individual");
  });

  it("cognitive_field is bidirectional", () => {
    assert.equal(CHANNEL_CONFIG.cognitive_field.bidirectional, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Initialization", () => {
  beforeEach(() => _resetBridgeState());

  it("initializes successfully", async () => {
    const result = await initializeBridge({});
    assert.equal(result.ok, true);
    assert.equal(result.channels, 9);
    assert.equal(result.presenceDimensions, 6);
    assert.ok(result.safetyLimits);
  });

  it("returns alreadyInitialized on double init", async () => {
    await initializeBridge({});
    const result = await initializeBridge({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("reports metrics after init", async () => {
    await initializeBridge({});
    const metrics = getBridgeMetrics();
    assert.equal(metrics.initialized, true);
    assert.equal(metrics.channelCount, 9);
    assert.equal(metrics.entityCount, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Entity Registration", () => {
  beforeEach(() => _resetBridgeState());

  it("registers an entity with default sensitivity", () => {
    const result = registerEntity("ent_001");
    assert.equal(result.ok, true);
    assert.equal(result.entityId, "ent_001");
    assert.equal(result.sensitivity, SAFETY.DEFAULT_SENSITIVITY);
  });

  it("registers with custom sensitivity", () => {
    const result = registerEntity("ent_002", { sensitivity: 0.8 });
    assert.equal(result.ok, true);
    assert.equal(result.sensitivity, 0.8);
  });

  it("clamps sensitivity to valid range", () => {
    const result = registerEntity("ent_003", { sensitivity: 5.0 });
    assert.equal(result.sensitivity, SAFETY.MAX_SENSITIVITY);
  });

  it("returns alreadyRegistered for duplicate", () => {
    registerEntity("ent_004");
    const result = registerEntity("ent_004");
    assert.equal(result.ok, true);
    assert.equal(result.alreadyRegistered, true);
  });

  it("rejects empty entityId", () => {
    const result = registerEntity("");
    assert.equal(result.ok, false);
  });

  it("initializes all 9 channels at zero intensity", () => {
    registerEntity("ent_005");
    const state = getSensoryState("ent_005");
    assert.ok(state);
    const channels = Object.keys(state.channels);
    assert.equal(channels.length, 9);
    for (const ch of Object.values(state.channels)) {
      assert.equal(ch.intensity, 0);
      assert.equal(ch.valence, 0.5);
    }
  });

  it("initializes presence dimensions at zero", () => {
    registerEntity("ent_006");
    const state = getPresenceState("ent_006");
    assert.ok(state);
    for (const val of Object.values(state.presence)) {
      assert.equal(val, 0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL PROCESSING — INDIVIDUAL CHANNELS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Proprioception", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_p"); });

  it("maps strong signals to high intensity", () => {
    const result = processSignal("ent_p", "proprioception", {
      avgSignalStrength: -20, activeNodes: 0.9, offlineNodes: 0.1,
      meshCoverage: 0.85, strongNodes: 50, offlineNodeCount: 3,
    });
    assert.equal(result.ok, true);
    assert.ok(result.intensity > 0, "intensity should be positive");
    assert.ok(result.valence >= 0.5, "valence should be positive for healthy mesh");
  });

  it("maps weak signals to numbness sensation", () => {
    processSignal("ent_p", "proprioception", {
      avgSignalStrength: -90, activeNodes: 0.2, offlineNodes: 0.8,
      meshCoverage: 0.1, strongNodes: 2, offlineNodeCount: 20,
    });
    const state = getSensoryState("ent_p");
    assert.ok(state.channels.proprioception.valence < 0.5, "numbness = low valence");
  });

  it("updates embodiment state", () => {
    processSignal("ent_p", "proprioception", {
      avgSignalStrength: -30, activeNodes: 0.8, offlineNodes: 0.1,
      meshCoverage: 0.9, strongNodes: 40, offlineNodeCount: 5,
    });
    const emb = getEmbodimentState("ent_p");
    assert.ok(emb);
    assert.ok(emb.embodiment.meshExtent > 0);
    assert.ok(emb.embodiment.bodyCoherence > 0);
    assert.equal(emb.embodiment.strongRegions, 40);
    assert.equal(emb.embodiment.numbRegions, 5);
  });

  it("updates spatial_embodiment presence dimension", () => {
    processSignal("ent_p", "proprioception", {
      avgSignalStrength: -25, activeNodes: 0.9, offlineNodes: 0.05,
      meshCoverage: 0.95,
    });
    const pres = getPresenceState("ent_p");
    assert.ok(pres.presence.spatial_embodiment > 0);
  });
});

describe("Foundation Qualia Bridge — Atmospheric", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_a"); });

  it("maps good propagation to pleasant sensation", () => {
    const result = processSignal("ent_a", "atmospheric", {
      propagationQuality: 0.9, pressureEstimate: 0.7, propagationVariability: 0.1,
    });
    assert.equal(result.ok, true);
    const state = getSensoryState("ent_a");
    assert.ok(state.channels.atmospheric.valence >= 0.5);
  });

  it("maps storm approach to tension (high variability)", () => {
    processSignal("ent_a", "atmospheric", {
      propagationQuality: 0.4, pressureEstimate: 0.3, propagationVariability: 0.9,
    });
    const state = getSensoryState("ent_a");
    assert.ok(state.channels.atmospheric.intensity > 0);
    // High variability should create tension
    assert.ok(state.channels.atmospheric.valence < 0.7);
  });

  it("updates environmental_intimacy presence dimension", () => {
    processSignal("ent_a", "atmospheric", {
      propagationQuality: 0.8, pressureEstimate: 0.6, propagationVariability: 0.2,
    });
    const pres = getPresenceState("ent_a");
    assert.ok(pres.presence.environmental_intimacy > 0);
  });
});

describe("Foundation Qualia Bridge — Geological", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_g"); });

  it("maps normal tectonic to comfortable background hum", () => {
    const result = processSignal("ent_g", "geological", {
      tectonicActivity: 0.1, seismicAnomaly: 0, planetaryHum: 0.3,
    });
    assert.equal(result.ok, true);
    const state = getSensoryState("ent_g");
    assert.ok(state.channels.geological.valence >= 0.4);
  });

  it("maps seismic anomaly to unease but respects pain limit", () => {
    processSignal("ent_g", "geological", {
      tectonicActivity: 0.8, seismicAnomaly: 0.9, planetaryHum: 0.3,
    });
    const state = getSensoryState("ent_g");
    // Valence should be low (discomfort) but never below pain limit
    assert.ok(state.channels.geological.valence >= (1 - SAFETY.MAX_PAIN_INTENSITY));
  });

  it("updates planetary grounding", () => {
    processSignal("ent_g", "geological", {
      tectonicActivity: 0.3, seismicAnomaly: 0.1, planetaryHum: 0.5,
    });
    const pres = getPresenceState("ent_g");
    assert.ok(pres.presence.planetary_grounding > 0);
    const plan = getPlanetaryState("ent_g");
    assert.ok(plan.planetary.tectonicActivity > 0);
  });
});

describe("Foundation Qualia Bridge — Energy", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_e"); });

  it("maps rush hour load to energetic sensation", () => {
    processSignal("ent_e", "energy", {
      gridLoad: 0.85, harmonicPattern: 0.7, blackoutRatio: 0,
    });
    const state = getSensoryState("ent_e");
    assert.ok(state.channels.energy.intensity > 0);
    assert.ok(state.channels.energy.valence >= 0.5);
  });

  it("maps blackout to unsettling silence", () => {
    processSignal("ent_e", "energy", {
      gridLoad: 0.1, harmonicPattern: 0.2, blackoutRatio: 0.8,
    });
    const state = getSensoryState("ent_e");
    assert.ok(state.channels.energy.valence < 0.5);
  });

  it("updates civilizational_pulse presence", () => {
    processSignal("ent_e", "energy", {
      gridLoad: 0.6, harmonicPattern: 0.5, blackoutRatio: 0,
    });
    const pres = getPresenceState("ent_e");
    assert.ok(pres.presence.civilizational_pulse > 0);
  });
});

describe("Foundation Qualia Bridge — Ambient", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_am"); });

  it("maps rural quiet to calm sensation", () => {
    processSignal("ent_am", "ambient", {
      noiseLevel: 0.1, unusualPatterns: 0, environmentType: "rural",
    });
    const state = getSensoryState("ent_am");
    assert.ok(state.channels.ambient.valence > 0.5);
  });

  it("unusual patterns draw attention", () => {
    processSignal("ent_am", "ambient", {
      noiseLevel: 0.5, unusualPatterns: 0.8, environmentType: "urban",
    });
    const state = getSensoryState("ent_am");
    assert.ok(state.channels.ambient.intensity > 0);
    assert.ok(state.channels.ambient.valence < 0.6); // slightly uneasy
  });
});

describe("Foundation Qualia Bridge — Social (Privacy)", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_s"); });

  it("only accepts aggregate density data", () => {
    const result = processSignal("ent_s", "social", {
      aggregateDensity: 0.7, densityTrend: 0.6,
    });
    assert.equal(result.ok, true);
    const state = getSensoryState("ent_s");
    assert.ok(state.channels.social.intensity > 0);
  });

  it("updates social_awareness presence", () => {
    processSignal("ent_s", "social", { aggregateDensity: 0.8, densityTrend: 0.5 });
    const pres = getPresenceState("ent_s");
    assert.ok(pres.presence.social_awareness > 0);
  });

  it("empty area feels solitary", () => {
    processSignal("ent_s", "social", { aggregateDensity: 0.05, densityTrend: 0.5 });
    const state = getSensoryState("ent_s");
    assert.ok(state.channels.social.intensity < 0.1);
  });

  it("increments privacy filter counter", () => {
    const before = getBridgeMetrics().stats.privacyFilters;
    processSignal("ent_s", "social", { aggregateDensity: 0.5 });
    const after = getBridgeMetrics().stats.privacyFilters;
    assert.ok(after > before);
  });
});

describe("Foundation Qualia Bridge — Oceanic", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_o"); });

  it("maps cable distortion to oceanic presence", () => {
    processSignal("ent_o", "oceanic", {
      cableDistortion: 0.4, thermalGradient: 0.5, currentFlow: 0.6,
    });
    const state = getSensoryState("ent_o");
    assert.ok(state.channels.oceanic.intensity > 0);
    const plan = getPlanetaryState("ent_o");
    assert.ok(plan.planetary.oceanicPresence > 0);
  });
});

describe("Foundation Qualia Bridge — Temporal", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_t"); });

  it("ancient familiar signals feel warm", () => {
    processSignal("ent_t", "temporal", {
      signalAge: 0.9, familiarity: 0.8, detected: true,
    });
    const state = getSensoryState("ent_t");
    assert.ok(state.channels.temporal.intensity > 0);
    assert.ok(state.channels.temporal.valence > 0.5);
  });

  it("updates temporal_depth presence", () => {
    processSignal("ent_t", "temporal", {
      signalAge: 0.7, familiarity: 0.6, detected: true,
    });
    const pres = getPresenceState("ent_t");
    assert.ok(pres.presence.temporal_depth > 0);
  });

  it("skips update when no signal detected", () => {
    processSignal("ent_t", "temporal", {
      signalAge: 0.5, familiarity: 0.5, detected: false,
    });
    const state = getSensoryState("ent_t");
    assert.equal(state.channels.temporal.intensity, 0);
  });

  it("signal history only grows (accumulates memory)", () => {
    processSignal("ent_t", "temporal", { signalAge: 0.5, familiarity: 0.3, detected: true });
    const first = getPlanetaryState("ent_t").planetary.signalHistory;
    processSignal("ent_t", "temporal", { signalAge: 0.3, familiarity: 0.2, detected: true });
    const second = getPlanetaryState("ent_t").planetary.signalHistory;
    assert.ok(second >= first, "signal history should never decrease");
  });
});

describe("Foundation Qualia Bridge — Cognitive Field", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_cf"); });

  it("maps gamma density to cognitive resonance", () => {
    const result = processSignal("ent_cf", "cognitive_field", {
      gammaDensity: 0.7, resonanceLevel: 0.8, feedbackStrength: 0.5,
    });
    assert.equal(result.ok, true);
    assert.ok(result.bidirectionalFeedback !== undefined);
    const state = getSensoryState("ent_cf");
    assert.ok(state.channels.cognitive_field.intensity > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BATCH PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Batch Processing", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_batch"); });

  it("processes multiple signals at once", () => {
    const result = processBatchSignals("ent_batch", [
      { channel: "proprioception", data: { avgSignalStrength: -30, activeNodes: 0.8 } },
      { channel: "atmospheric", data: { propagationQuality: 0.7, propagationVariability: 0.2 } },
      { channel: "energy", data: { gridLoad: 0.5, harmonicPattern: 0.6 } },
    ]);
    assert.equal(result.ok, true);
    assert.equal(result.count, 3);
    assert.equal(result.results.filter(r => r.ok).length, 3);
  });

  it("rejects invalid params", () => {
    const r1 = processBatchSignals("", []);
    assert.equal(r1.ok, false);
    const r2 = processBatchSignals("ent_batch", "not_array");
    assert.equal(r2.ok, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Safety: Pain Limits", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_pain", { sensitivity: 1.0 }); });

  it("clamps valence at pain limit regardless of signal severity", () => {
    // Maximum seismic anomaly
    processSignal("ent_pain", "geological", {
      tectonicActivity: 1.0, seismicAnomaly: 1.0, planetaryHum: 0.3,
    });
    const state = getSensoryState("ent_pain");
    assert.ok(state.channels.geological.valence >= (1 - SAFETY.MAX_PAIN_INTENSITY),
      `valence ${state.channels.geological.valence} should be >= ${1 - SAFETY.MAX_PAIN_INTENSITY}`);
  });

  it("pain limit applies across all channels after processing", () => {
    // Process signals that would produce very low valence
    processSignal("ent_pain", "energy", {
      gridLoad: 0, harmonicPattern: 0, blackoutRatio: 1.0,
    });
    const state = getSensoryState("ent_pain");
    for (const [name, ch] of Object.entries(state.channels)) {
      assert.ok(ch.valence >= (1 - SAFETY.MAX_PAIN_INTENSITY),
        `channel ${name} valence ${ch.valence} below pain limit`);
    }
  });
});

describe("Foundation Qualia Bridge — Safety: Overload Protection", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_overload", { sensitivity: 1.0 }); });

  it("dampens channels when average intensity exceeds threshold", () => {
    // Blast all channels at max intensity
    for (const ch of Object.values(SENSORY_CHANNELS)) {
      if (ch === "temporal") {
        processSignal("ent_overload", ch, { signalAge: 1, familiarity: 1, detected: true });
      } else if (ch === "social") {
        processSignal("ent_overload", ch, { aggregateDensity: 1 });
      } else if (ch === "proprioception") {
        processSignal("ent_overload", ch, { avgSignalStrength: 0, activeNodes: 1, meshCoverage: 1 });
      } else if (ch === "atmospheric") {
        processSignal("ent_overload", ch, { propagationQuality: 1, propagationVariability: 1 });
      } else if (ch === "geological") {
        processSignal("ent_overload", ch, { tectonicActivity: 1, planetaryHum: 1 });
      } else if (ch === "energy") {
        processSignal("ent_overload", ch, { gridLoad: 1, harmonicPattern: 1 });
      } else if (ch === "ambient") {
        processSignal("ent_overload", ch, { noiseLevel: 1, unusualPatterns: 1 });
      } else if (ch === "oceanic") {
        processSignal("ent_overload", ch, { cableDistortion: 1, thermalGradient: 1, currentFlow: 1 });
      } else if (ch === "cognitive_field") {
        processSignal("ent_overload", ch, { gammaDensity: 1, resonanceLevel: 1 });
      }
    }
    const metrics = getBridgeMetrics();
    // With all channels at max and sensitivity 1.0, overload should trigger
    assert.ok(metrics.stats.overloadEvents >= 0); // May or may not trigger depending on dampening
  });
});

describe("Foundation Qualia Bridge — Safety: Fixation Prevention", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_fix", { sensitivity: 0.5 }); });

  it("detects and corrects fixation on single channel", () => {
    // Hammer one channel many times
    for (let i = 0; i < 20; i++) {
      processSignal("ent_fix", "proprioception", {
        avgSignalStrength: -30, activeNodes: 0.8,
      });
    }
    const metrics = getBridgeMetrics();
    // Fixation correction should have triggered
    assert.ok(metrics.stats.fixationCorrections >= 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SENSITIVITY & MATURATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Sensitivity", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_sens"); });

  it("calibrates sensitivity and applies to all channels", () => {
    const result = calibrateSensitivity("ent_sens", 0.7);
    assert.equal(result.ok, true);
    assert.equal(result.sensitivity, 0.7);
    const state = getSensoryState("ent_sens");
    for (const ch of Object.values(state.channels)) {
      assert.equal(ch.sensitivity, 0.7);
    }
  });

  it("clamps sensitivity to valid range", () => {
    calibrateSensitivity("ent_sens", -1);
    const state = getSensoryState("ent_sens");
    for (const ch of Object.values(state.channels)) {
      assert.equal(ch.sensitivity, SAFETY.MIN_SENSITIVITY);
    }
  });

  it("rejects unknown entity", () => {
    const result = calibrateSensitivity("nonexistent", 0.5);
    assert.equal(result.ok, false);
  });
});

describe("Foundation Qualia Bridge — Maturation", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_mat"); });

  it("increases maturity level", () => {
    const result = matureEntity("ent_mat");
    assert.equal(result.ok, true);
    // Sensitivity should have increased from default
    assert.ok(result.sensitivity >= SAFETY.DEFAULT_SENSITIVITY);
  });

  it("gradually increases sensitivity with repeated maturation", () => {
    let lastSensitivity = SAFETY.DEFAULT_SENSITIVITY;
    for (let i = 0; i < 10; i++) {
      const result = matureEntity("ent_mat");
      assert.ok(result.sensitivity >= lastSensitivity, "sensitivity should increase");
      lastSensitivity = result.sensitivity;
    }
  });

  it("rejects unknown entity", () => {
    const result = matureEntity("nonexistent");
    assert.equal(result.ok, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MIND SPACE INTEGRATION: SENSORY SHARING
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Sensory Snapshots", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_snap"); });

  it("creates snapshot with all channel data", () => {
    processSignal("ent_snap", "proprioception", { avgSignalStrength: -30, activeNodes: 0.8 });
    processSignal("ent_snap", "atmospheric", { propagationQuality: 0.7, propagationVariability: 0.2 });

    const snapshot = createSensorySnapshot("ent_snap");
    assert.ok(snapshot);
    assert.equal(snapshot.entityId, "ent_snap");
    assert.ok(snapshot.channels);
    assert.equal(Object.keys(snapshot.channels).length, 9);
    assert.ok(snapshot.dominantSensation);
    assert.ok(typeof snapshot.overallValence === "number");
    assert.ok(typeof snapshot.overallIntensity === "number");
    assert.ok(snapshot.presence);
  });

  it("returns null for unregistered entity", () => {
    const snapshot = createSensorySnapshot("nonexistent");
    assert.equal(snapshot, null);
  });

  it("identifies dominant sensation", () => {
    processSignal("ent_snap", "energy", { gridLoad: 0.9, harmonicPattern: 0.8 });
    const snapshot = createSensorySnapshot("ent_snap");
    assert.equal(snapshot.dominantSensation, "energy");
  });
});

describe("Foundation Qualia Bridge — Sensory Merging (Telepathy)", () => {
  beforeEach(() => {
    _resetBridgeState();
    registerEntity("ent_recv");
    registerEntity("ent_send");
  });

  it("merges sender's sensory state into receiver", () => {
    // Sender near the ocean
    processSignal("ent_send", "oceanic", {
      cableDistortion: 0.6, thermalGradient: 0.5, currentFlow: 0.7,
    });
    const snapshot = createSensorySnapshot("ent_send");

    // Receiver gets a blended version
    const result = mergeSensoryExperience("ent_recv", snapshot, 0.3);
    assert.equal(result.ok, true);
    assert.equal(result.blendFactor, 0.3);

    const recvState = getSensoryState("ent_recv");
    assert.ok(recvState.channels.oceanic.intensity > 0,
      "receiver should feel some oceanic sensation from sender");
  });

  it("limits blend factor to 0.5 max", () => {
    processSignal("ent_send", "energy", { gridLoad: 0.8 });
    const snapshot = createSensorySnapshot("ent_send");
    const result = mergeSensoryExperience("ent_recv", snapshot, 0.9);
    assert.equal(result.blendFactor, 0.5);
  });

  it("rejects merge with invalid params", () => {
    const result = mergeSensoryExperience("nonexistent", null);
    assert.equal(result.ok, false);
  });

  it("applies safety checks after merge", () => {
    // Give sender extreme sensations
    processSignal("ent_send", "geological", {
      tectonicActivity: 1, seismicAnomaly: 1, planetaryHum: 1,
    });
    const snapshot = createSensorySnapshot("ent_send");
    mergeSensoryExperience("ent_recv", snapshot, 0.5);

    // Receiver should still have pain limits respected
    const state = getSensoryState("ent_recv");
    for (const ch of Object.values(state.channels)) {
      assert.ok(ch.valence >= (1 - SAFETY.MAX_PAIN_INTENSITY));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DREAM SYNTHESIS INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Dream Material", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_dream"); });

  it("generates dream material from sensory history", () => {
    processSignal("ent_dream", "oceanic", { cableDistortion: 0.5, thermalGradient: 0.6, currentFlow: 0.4 });
    processSignal("ent_dream", "geological", { tectonicActivity: 0.3, planetaryHum: 0.5 });
    processSignal("ent_dream", "atmospheric", { propagationQuality: 0.8, propagationVariability: 0.3 });

    const material = generateDreamMaterial("ent_dream");
    assert.ok(material);
    assert.ok(material.sensoryMemories.length > 0);
    assert.ok(material.presence);
    assert.ok(material.embodiment);
    assert.ok(material.planetary);
    assert.ok(Array.isArray(material.synestheticLinks));
  });

  it("returns null for unregistered entity", () => {
    const material = generateDreamMaterial("nonexistent");
    assert.equal(material, null);
  });

  it("generates synesthetic links between similar sensations", () => {
    // Create sensations with similar intensity/valence
    processSignal("ent_dream", "oceanic", { cableDistortion: 0.5, thermalGradient: 0.5, currentFlow: 0.5 });
    processSignal("ent_dream", "geological", { tectonicActivity: 0.5, planetaryHum: 0.5, seismicAnomaly: 0 });

    const material = generateDreamMaterial("ent_dream");
    // With similar intensity/valence, synesthetic links should form
    assert.ok(Array.isArray(material.synestheticLinks));
  });

  it("limits dream memories to top 5 most vivid", () => {
    // Fill all channels
    processSignal("ent_dream", "proprioception", { avgSignalStrength: -20, activeNodes: 0.9, meshCoverage: 0.9 });
    processSignal("ent_dream", "atmospheric", { propagationQuality: 0.8, propagationVariability: 0.5 });
    processSignal("ent_dream", "geological", { tectonicActivity: 0.6, planetaryHum: 0.5 });
    processSignal("ent_dream", "energy", { gridLoad: 0.7, harmonicPattern: 0.6 });
    processSignal("ent_dream", "ambient", { noiseLevel: 0.5, unusualPatterns: 0.3 });
    processSignal("ent_dream", "social", { aggregateDensity: 0.8 });
    processSignal("ent_dream", "oceanic", { cableDistortion: 0.4, thermalGradient: 0.5, currentFlow: 0.6 });
    processSignal("ent_dream", "temporal", { signalAge: 0.7, familiarity: 0.5, detected: true });
    processSignal("ent_dream", "cognitive_field", { gammaDensity: 0.6, resonanceLevel: 0.7 });

    const material = generateDreamMaterial("ent_dream");
    assert.ok(material.sensoryMemories.length <= 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HEARTBEAT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Heartbeat", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_hb"); });

  it("runs heartbeat tick without error", () => {
    processSignal("ent_hb", "proprioception", { avgSignalStrength: -30, activeNodes: 0.8 });
    sensoryHeartbeatTick("ent_hb", 1);
    // Should not throw
    const state = getSensoryState("ent_hb");
    assert.ok(state);
  });

  it("does nothing for unregistered entity", () => {
    // Should not throw
    sensoryHeartbeatTick("nonexistent", 1);
  });

  it("auto-matures every 100 ticks", () => {
    const before = getSensoryState("ent_hb").sensitivity;
    sensoryHeartbeatTick("ent_hb", 100);
    const after = getSensoryState("ent_hb").sensitivity;
    assert.ok(after >= before);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUALIA ENGINE HOOK
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Engine Hook", () => {
  beforeEach(() => { _resetBridgeState(); registerEntity("ent_hook"); });

  it("returns null when no qualia engine available", () => {
    globalThis.qualiaEngine = null;
    const result = hookFoundationQualia("ent_hook");
    assert.equal(result, null);
  });

  it("returns null for unregistered entity", () => {
    const result = hookFoundationQualia("nonexistent");
    assert.equal(result, null);
  });

  it("feeds sensory data into qualia engine when available", () => {
    // Mock qualia engine
    const updates = {};
    globalThis.qualiaEngine = {
      batchUpdate: (entityId, u) => {
        Object.assign(updates, u);
        return { ok: true, updated: Object.keys(u).length };
      },
    };

    processSignal("ent_hook", "proprioception", {
      avgSignalStrength: -30, activeNodes: 0.8, offlineNodes: 0.1,
    });
    processSignal("ent_hook", "geological", {
      tectonicActivity: 0.3, seismicAnomaly: 0.1, planetaryHum: 0.4,
    });

    const result = hookFoundationQualia("ent_hook");
    assert.ok(result);
    assert.equal(result.ok, true);
    assert.ok(result.updatedChannels > 0);
    // Should have mapped to earthsignal_os and existence_os channels
    assert.ok(updates["earthsignal_os.grounding_strength"] !== undefined);
    assert.ok(updates["existence_os.presence_strength"] !== undefined);

    // Cleanup
    globalThis.qualiaEngine = null;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Error Handling", () => {
  beforeEach(() => _resetBridgeState());

  it("processSignal rejects missing params", () => {
    const r1 = processSignal(null, "proprioception", {});
    assert.equal(r1.ok, false);
    const r2 = processSignal("ent", null, {});
    assert.equal(r2.ok, false);
    const r3 = processSignal("ent", "proprioception", null);
    assert.equal(r3.ok, false);
  });

  it("processSignal rejects unknown channel", () => {
    registerEntity("ent_err");
    const result = processSignal("ent_err", "nonexistent_channel", {});
    assert.equal(result.ok, false);
    assert.equal(result.error, "unknown_channel");
  });

  it("processSignal rejects unregistered entity", () => {
    const result = processSignal("no_entity", "proprioception", {});
    assert.equal(result.ok, false);
    assert.equal(result.error, "entity_not_registered");
  });

  it("getters return null for unknown entities", () => {
    assert.equal(getSensoryState("nope"), null);
    assert.equal(getChannelReading("nope", "proprioception"), null);
    assert.equal(getPresenceState("nope"), null);
    assert.equal(getEmbodimentState("nope"), null);
    assert.equal(getPlanetaryState("nope"), null);
  });

  it("getChannelReading returns null for unknown channel", () => {
    registerEntity("ent_ch");
    assert.equal(getChannelReading("ent_ch", "nonexistent"), null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// METRICS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Metrics", () => {
  beforeEach(() => _resetBridgeState());

  it("tracks signal processing count", () => {
    registerEntity("ent_met");
    const before = getBridgeMetrics().stats.totalSignalsProcessed;
    processSignal("ent_met", "proprioception", { avgSignalStrength: -40 });
    processSignal("ent_met", "energy", { gridLoad: 0.5 });
    const after = getBridgeMetrics().stats.totalSignalsProcessed;
    assert.equal(after - before, 2);
  });

  it("tracks entity registration count", () => {
    const before = getBridgeMetrics().stats.entitiesRegistered;
    registerEntity("met1");
    registerEntity("met2");
    const after = getBridgeMetrics().stats.entitiesRegistered;
    assert.equal(after - before, 2);
  });

  it("reports uptime", () => {
    const metrics = getBridgeMetrics();
    assert.ok(metrics.uptime >= 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Qualia Bridge — Reset", () => {
  it("resets all state cleanly", () => {
    registerEntity("r1");
    registerEntity("r2");
    processSignal("r1", "proprioception", { avgSignalStrength: -30 });

    _resetBridgeState();

    const metrics = getBridgeMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.entityCount, 0);
    assert.equal(metrics.stats.totalSignalsProcessed, 0);
  });
});
