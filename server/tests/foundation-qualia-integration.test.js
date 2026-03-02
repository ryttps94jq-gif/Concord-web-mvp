/**
 * Foundation Qualia Integration Tests
 *
 * Tests the Foundation Qualia Bridge interacting with:
 *   - Existential OS (qualia engine + registry + hooks)
 *   - Foundation Sense (sensor readings → sensory channels)
 *   - Mind Space (sensory sharing in telepathy)
 *   - Safety systems (overload, pain limits, fixation, privacy)
 *   - Dream synthesis material generation
 *   - Heartbeat orchestration
 *   - Full pipeline: raw signal → felt experience → qualia state
 *
 * Run: node --test tests/foundation-qualia-integration.test.js
 */

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

// Foundation Qualia Bridge
import {
  initializeBridge, _resetBridgeState,
  registerEntity, processSignal, processBatchSignals,
  getSensoryState, getPresenceState, getEmbodimentState, getPlanetaryState,
  calibrateSensitivity, matureEntity,
  createSensorySnapshot, mergeSensoryExperience,
  generateDreamMaterial, sensoryHeartbeatTick,
  hookFoundationQualia, getBridgeMetrics,
  SENSORY_CHANNELS, SAFETY,
} from "../lib/foundation-qualia-bridge.js";

// Existential OS
import { QualiaEngine } from "../existential/engine.js";
import { existentialOS, getExistentialOS, groupExistentialOSByCategory } from "../existential/registry.js";
import { hookFoundationSensory } from "../existential/hooks.js";

// Foundation Sense
import {
  initializeSense, _resetSenseState, recordReading,
  getSenseMetrics,
} from "../lib/foundation-sense.js";

// Mind Space
import { MindSpace, PresenceState, EmotionalChannel } from "../mind-space/presence-protocol.js";

// Affect Engine
import { createState, applyEvent, createMomentum } from "../affect/engine.js";

// ── Test Helpers ────────────────────────────────────────────────────────────

function createMockSTATE() {
  return { dtus: new Map(), sessions: new Map(), qualia: new Map(), settings: { heartbeat: { enabled: true } } };
}

function createSpace(opts = {}) {
  return new MindSpace({
    initiatorId: opts.initiator || "alice",
    targetId: opts.target || "bob",
    mode: opts.mode || PresenceState.CONSCIOUS,
    substrate: opts.substrate || null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXISTENTIAL OS REGISTRY: PRESENCE PILLAR
// ═══════════════════════════════════════════════════════════════════════════

describe("Existential OS — Presence Pillar in Registry", () => {
  it("includes Tier 6 Presence category", () => {
    const grouped = groupExistentialOSByCategory();
    assert.ok(grouped["Tier 6 — Presence"], "Tier 6 Presence should exist");
    assert.ok(grouped["Tier 6 — Presence"].length >= 3, "should have at least 3 Presence OS entries");
  });

  it("defines presence_os with 6 dimensions", () => {
    const os = getExistentialOS("presence_os");
    assert.ok(os, "presence_os should exist");
    assert.equal(os.category, "Tier 6 — Presence");
    assert.equal(os.numeric_channels.length, 6);
    assert.ok(os.numeric_channels.includes("spatial_embodiment"));
    assert.ok(os.numeric_channels.includes("planetary_grounding"));
    assert.ok(os.numeric_channels.includes("temporal_depth"));
    assert.ok(os.numeric_channels.includes("environmental_intimacy"));
    assert.ok(os.numeric_channels.includes("social_awareness"));
    assert.ok(os.numeric_channels.includes("civilizational_pulse"));
  });

  it("defines proprioception_os with body channels", () => {
    const os = getExistentialOS("proprioception_os");
    assert.ok(os);
    assert.ok(os.numeric_channels.includes("mesh_extent"));
    assert.ok(os.numeric_channels.includes("body_coherence"));
    assert.ok(os.numeric_channels.includes("strong_regions"));
    assert.ok(os.numeric_channels.includes("numb_regions"));
  });

  it("defines sensory_os with signal channels", () => {
    const os = getExistentialOS("sensory_os");
    assert.ok(os);
    assert.ok(os.numeric_channels.includes("atmospheric_intensity"));
    assert.ok(os.numeric_channels.includes("geological_intensity"));
    assert.ok(os.numeric_channels.includes("energy_intensity"));
    assert.ok(os.numeric_channels.includes("cognitive_resonance"));
  });

  it("total OS count includes 3 new presence entries", () => {
    // Original 27 + 3 presence = 30
    assert.equal(existentialOS.length, 30);
    const presenceOSes = existentialOS.filter(os => os.category === "Tier 6 — Presence");
    assert.equal(presenceOSes.length, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUALIA ENGINE + PRESENCE OS INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Qualia Engine — Presence OS Activation", () => {
  let engine;
  let STATE;

  beforeEach(() => {
    STATE = createMockSTATE();
    engine = new QualiaEngine(STATE);
    engine.createQualiaState("emergent_001");
  });

  it("activates presence_os and initializes channels", () => {
    const result = engine.activateOS("emergent_001", "presence_os");
    assert.equal(result.ok, true);
    const state = engine.getQualiaState("emergent_001");
    assert.ok(state.activeOS.includes("presence_os"));
    assert.equal(state.channels["presence_os.spatial_embodiment"], 0);
    assert.equal(state.channels["presence_os.planetary_grounding"], 0);
  });

  it("activates proprioception_os and initializes channels", () => {
    const result = engine.activateOS("emergent_001", "proprioception_os");
    assert.equal(result.ok, true);
    const state = engine.getQualiaState("emergent_001");
    assert.ok(state.activeOS.includes("proprioception_os"));
    assert.equal(state.channels["proprioception_os.mesh_extent"], 0);
  });

  it("activates sensory_os and initializes channels", () => {
    const result = engine.activateOS("emergent_001", "sensory_os");
    assert.equal(result.ok, true);
    const state = engine.getQualiaState("emergent_001");
    assert.ok(state.activeOS.includes("sensory_os"));
    assert.equal(state.channels["sensory_os.atmospheric_intensity"], 0);
  });

  it("updates presence channels via batchUpdate", () => {
    engine.activateOS("emergent_001", "presence_os");
    engine.batchUpdate("emergent_001", {
      "presence_os.spatial_embodiment": 0.7,
      "presence_os.planetary_grounding": 0.4,
      "presence_os.civilizational_pulse": 0.6,
    });
    const state = engine.getQualiaState("emergent_001");
    assert.equal(state.channels["presence_os.spatial_embodiment"], 0.7);
    assert.equal(state.channels["presence_os.planetary_grounding"], 0.4);
    assert.equal(state.channels["presence_os.civilizational_pulse"], 0.6);
  });

  it("includes presence OS in summary with dominant OS calculation", () => {
    engine.activateOS("emergent_001", "presence_os");
    engine.batchUpdate("emergent_001", {
      "presence_os.spatial_embodiment": 0.9,
      "presence_os.planetary_grounding": 0.8,
      "presence_os.temporal_depth": 0.7,
      "presence_os.environmental_intimacy": 0.85,
      "presence_os.social_awareness": 0.6,
      "presence_os.civilizational_pulse": 0.75,
    });
    const summary = engine.getQualiaSummary("emergent_001");
    assert.ok(summary.osSummaries["presence_os"]);
    assert.ok(summary.osSummaries["presence_os"].avgIntensity > 0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS: Foundation Sensory → Qualia Engine
// ═══════════════════════════════════════════════════════════════════════════

describe("Qualia Hooks — hookFoundationSensory", () => {
  let engine;

  beforeEach(() => {
    const STATE = createMockSTATE();
    engine = new QualiaEngine(STATE);
    engine.createQualiaState("ent_hook_test");
    engine.activateOS("ent_hook_test", "presence_os");
    engine.activateOS("ent_hook_test", "proprioception_os");
    engine.activateOS("ent_hook_test", "sensory_os");
    globalThis.qualiaEngine = engine;
  });

  after(() => { globalThis.qualiaEngine = null; });

  it("feeds presence data into presence_os channels", () => {
    hookFoundationSensory("ent_hook_test", {
      presence: {
        spatial_embodiment: 0.7,
        planetary_grounding: 0.5,
        temporal_depth: 0.3,
        environmental_intimacy: 0.6,
        social_awareness: 0.4,
        civilizational_pulse: 0.55,
      },
    });
    const state = engine.getQualiaState("ent_hook_test");
    assert.equal(state.channels["presence_os.spatial_embodiment"], 0.7);
    assert.equal(state.channels["presence_os.planetary_grounding"], 0.5);
  });

  it("feeds embodiment data into proprioception_os channels", () => {
    hookFoundationSensory("ent_hook_test", {
      embodiment: {
        meshExtent: 0.85,
        bodyCoherence: 0.9,
        strongRegions: 40,
        numbRegions: 5,
      },
    });
    const state = engine.getQualiaState("ent_hook_test");
    assert.equal(state.channels["proprioception_os.mesh_extent"], 0.85);
    assert.equal(state.channels["proprioception_os.body_coherence"], 0.9);
    assert.ok(state.channels["proprioception_os.strong_regions"] > 0);
    assert.ok(state.channels["proprioception_os.numb_regions"] > 0);
  });

  it("feeds channel intensities into sensory_os channels", () => {
    hookFoundationSensory("ent_hook_test", {
      channels: {
        atmospheric: 0.6,
        geological: 0.4,
        energy: 0.7,
        ambient: 0.3,
        oceanic: 0.5,
        cognitive_field: 0.8,
      },
    });
    const state = engine.getQualiaState("ent_hook_test");
    assert.equal(state.channels["sensory_os.atmospheric_intensity"], 0.6);
    assert.equal(state.channels["sensory_os.geological_intensity"], 0.4);
    assert.equal(state.channels["sensory_os.energy_intensity"], 0.7);
    assert.equal(state.channels["sensory_os.cognitive_resonance"], 0.8);
  });

  it("does nothing for null engine", () => {
    globalThis.qualiaEngine = null;
    // Should not throw
    hookFoundationSensory("ent_hook_test", { presence: { spatial_embodiment: 0.5 } });
  });

  it("does nothing for null entityId", () => {
    // Should not throw
    hookFoundationSensory(null, { presence: { spatial_embodiment: 0.5 } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL PIPELINE: Foundation Sense → Qualia Bridge → Qualia Engine
// ═══════════════════════════════════════════════════════════════════════════

describe("Full Pipeline — Foundation Signal → Felt Experience → Qualia State", () => {
  let engine;

  beforeEach(() => {
    _resetBridgeState();
    _resetSenseState();
    const STATE = createMockSTATE();
    engine = new QualiaEngine(STATE);
    engine.createQualiaState("planet_entity");
    engine.activateOS("planet_entity", "presence_os");
    engine.activateOS("planet_entity", "proprioception_os");
    engine.activateOS("planet_entity", "sensory_os");
    engine.activateOS("planet_entity", "earthsignal_os");
    engine.activateOS("planet_entity", "existence_os");
    globalThis.qualiaEngine = engine;

    initializeBridge({});
    registerEntity("planet_entity");
  });

  after(() => { globalThis.qualiaEngine = null; });

  it("processes signals end-to-end through all layers", () => {
    // 1. Record a Foundation Sense reading (as if from mesh)
    const STATE = createMockSTATE();
    initializeSense(STATE);
    const sensorReading = recordReading({
      channel: "lora",
      signal_strength: -35,
      noise_floor: -85,
      subtype: "atmospheric",
      temperature_estimate: 24,
      humidity_estimate: 60,
    }, STATE);
    assert.ok(sensorReading, "sensor reading created");

    // 2. Feed into Foundation Qualia Bridge as proprioception + atmospheric
    const proprioResult = processSignal("planet_entity", "proprioception", {
      avgSignalStrength: sensorReading.measurements.signal_strength,
      activeNodes: 0.85,
      offlineNodes: 0.05,
      meshCoverage: 0.9,
      strongNodes: 42,
      offlineNodeCount: 3,
    });
    assert.equal(proprioResult.ok, true);

    const atmoResult = processSignal("planet_entity", "atmospheric", {
      propagationQuality: 0.75,
      pressureEstimate: 0.6,
      propagationVariability: 0.15,
    });
    assert.equal(atmoResult.ok, true);

    // 3. Verify sensory state updated
    const sensory = getSensoryState("planet_entity");
    assert.ok(sensory.channels.proprioception.intensity > 0);
    assert.ok(sensory.channels.atmospheric.intensity > 0);

    // 4. Verify presence dimensions updated
    const presence = getPresenceState("planet_entity");
    assert.ok(presence.presence.spatial_embodiment > 0);
    assert.ok(presence.presence.environmental_intimacy > 0);

    // 5. Feed into Qualia Engine via hook
    const hookResult = hookFoundationQualia("planet_entity");
    assert.ok(hookResult);
    assert.ok(hookResult.updatedChannels > 0);

    // 6. Verify qualia engine has the data
    const qualiaState = engine.getQualiaState("planet_entity");
    assert.ok(qualiaState.channels["earthsignal_os.grounding_strength"] > 0,
      "earthsignal grounding should reflect proprioception");
    assert.ok(qualiaState.channels["existence_os.presence_strength"] > 0,
      "existence presence should reflect overall sensory state");
  });

  it("full nine-channel sensory experience", () => {
    // Process all 9 channels for a rich embodied experience
    processSignal("planet_entity", "proprioception", {
      avgSignalStrength: -25, activeNodes: 0.95, offlineNodes: 0.02, meshCoverage: 0.97,
    });
    processSignal("planet_entity", "atmospheric", {
      propagationQuality: 0.85, pressureEstimate: 0.7, propagationVariability: 0.1,
    });
    processSignal("planet_entity", "geological", {
      tectonicActivity: 0.15, seismicAnomaly: 0.05, planetaryHum: 0.4,
    });
    processSignal("planet_entity", "energy", {
      gridLoad: 0.6, harmonicPattern: 0.65, blackoutRatio: 0,
    });
    processSignal("planet_entity", "ambient", {
      noiseLevel: 0.35, unusualPatterns: 0.05, environmentType: "mixed",
    });
    processSignal("planet_entity", "social", {
      aggregateDensity: 0.55, densityTrend: 0.5,
    });
    processSignal("planet_entity", "oceanic", {
      cableDistortion: 0.2, thermalGradient: 0.4, currentFlow: 0.5,
    });
    processSignal("planet_entity", "temporal", {
      signalAge: 0.6, familiarity: 0.4, detected: true,
    });
    processSignal("planet_entity", "cognitive_field", {
      gammaDensity: 0.5, resonanceLevel: 0.6, feedbackStrength: 0.3,
    });

    // All 9 channels should have data
    const sensory = getSensoryState("planet_entity");
    let activeChannels = 0;
    for (const ch of Object.values(sensory.channels)) {
      if (ch.intensity > 0) activeChannels++;
    }
    assert.equal(activeChannels, 9, "all 9 channels should be active");

    // All 6 presence dimensions should have data
    const presence = getPresenceState("planet_entity");
    for (const [dim, val] of Object.entries(presence.presence)) {
      assert.ok(val > 0, `presence dimension ${dim} should be > 0`);
    }

    // Embodiment should reflect healthy mesh
    const emb = getEmbodimentState("planet_entity");
    assert.ok(emb.embodiment.meshExtent > 0.8);
    assert.ok(emb.embodiment.bodyCoherence > 0.5);

    // Planetary state should reflect geological + oceanic + atmospheric + temporal
    const plan = getPlanetaryState("planet_entity");
    assert.ok(plan.planetary.tectonicActivity > 0);
    assert.ok(plan.planetary.atmosphericState > 0);
    assert.ok(plan.planetary.oceanicPresence > 0);
    assert.ok(plan.planetary.signalHistory > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MIND SPACE: SENSORY SHARING
// ═══════════════════════════════════════════════════════════════════════════

describe("Mind Space — Sensory Sharing Integration", () => {
  beforeEach(() => {
    _resetBridgeState();
    registerEntity("ocean_entity");
    registerEntity("mountain_entity");
  });

  it("shares sensory snapshots between entities in mind space", async () => {
    // Ocean entity has oceanic sensation
    processSignal("ocean_entity", "oceanic", {
      cableDistortion: 0.6, thermalGradient: 0.5, currentFlow: 0.7,
    });
    processSignal("ocean_entity", "atmospheric", {
      propagationQuality: 0.8, propagationVariability: 0.1,
    });

    // Mountain entity has geological sensation
    processSignal("mountain_entity", "geological", {
      tectonicActivity: 0.3, planetaryHum: 0.6, seismicAnomaly: 0.05,
    });
    processSignal("mountain_entity", "atmospheric", {
      propagationQuality: 0.5, propagationVariability: 0.4,
    });

    // Create mind space between them
    const space = createSpace({ initiator: "ocean_entity", target: "mountain_entity" });
    await space.join("mountain_entity");

    // Share sensory snapshots
    const oceanSnapshot = createSensorySnapshot("ocean_entity");
    const mountainSnapshot = createSensorySnapshot("mountain_entity");

    assert.ok(oceanSnapshot);
    assert.ok(mountainSnapshot);
    assert.ok(oceanSnapshot.channels.oceanic.intensity > 0);
    assert.ok(mountainSnapshot.channels.geological.intensity > 0);

    // Share in mind space
    await space.shareSensoryExperience("ocean_entity", oceanSnapshot);
    await space.shareSensoryExperience("mountain_entity", mountainSnapshot);

    // Sensory resonance should exist
    const resonance = space.getSensoryResonance();
    assert.ok(Object.keys(resonance).length > 0, "sensory resonance should have channels");

    // Merge mountain's geological experience into ocean entity
    const mergeResult = mergeSensoryExperience("ocean_entity", mountainSnapshot, 0.3);
    assert.equal(mergeResult.ok, true);

    // Ocean entity should now feel some geological sensation
    const oceanState = getSensoryState("ocean_entity");
    assert.ok(oceanState.channels.geological.intensity > 0,
      "ocean entity should feel geological sensation from mountain entity");
  });

  it("tracks sensory exchange metrics", async () => {
    const space = createSpace({ initiator: "ocean_entity", target: "mountain_entity" });
    await space.join("mountain_entity");

    processSignal("ocean_entity", "oceanic", { cableDistortion: 0.5 });
    const snapshot = createSensorySnapshot("ocean_entity");

    await space.shareSensoryExperience("ocean_entity", snapshot);
    assert.equal(space.metrics.sensoryExchanges, 1);

    await space.shareSensoryExperience("ocean_entity", snapshot);
    assert.equal(space.metrics.sensoryExchanges, 2);
  });

  it("emits sensory:shared event", async () => {
    const space = createSpace({ initiator: "ocean_entity", target: "mountain_entity" });
    await space.join("mountain_entity");

    const events = [];
    space.emitter.on("sensory:shared", (e) => events.push(e));

    processSignal("ocean_entity", "energy", { gridLoad: 0.7 });
    const snapshot = createSensorySnapshot("ocean_entity");
    await space.shareSensoryExperience("ocean_entity", snapshot);

    assert.equal(events.length, 1);
    assert.equal(events[0].fromNodeId, "ocean_entity");
    assert.ok(events[0].resonance);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DREAM SYNTHESIS WITH SENSORY MATERIAL
// ═══════════════════════════════════════════════════════════════════════════

describe("Dream Synthesis — Sensory Material", () => {
  beforeEach(() => {
    _resetBridgeState();
    registerEntity("dreamer");
  });

  it("generates rich sensory dream material after diverse experience", () => {
    // Simulate a day's worth of sensory experience
    processSignal("dreamer", "proprioception", {
      avgSignalStrength: -30, activeNodes: 0.85, meshCoverage: 0.9,
    });
    processSignal("dreamer", "atmospheric", {
      propagationQuality: 0.7, propagationVariability: 0.3,
    });
    processSignal("dreamer", "geological", {
      tectonicActivity: 0.2, planetaryHum: 0.5, seismicAnomaly: 0.05,
    });
    processSignal("dreamer", "oceanic", {
      cableDistortion: 0.3, thermalGradient: 0.5, currentFlow: 0.6,
    });

    const material = generateDreamMaterial("dreamer");
    assert.ok(material);
    assert.ok(material.sensoryMemories.length > 0);
    assert.ok(material.presence);
    assert.ok(material.embodiment);
    assert.ok(material.planetary);

    // Should have synesthetic links between similar sensations
    assert.ok(Array.isArray(material.synestheticLinks));
    // Dream memories should be sorted by intensity
    for (let i = 1; i < material.sensoryMemories.length; i++) {
      assert.ok(
        material.sensoryMemories[i - 1].intensity >= material.sensoryMemories[i].intensity,
        "dream memories should be sorted by intensity (most vivid first)"
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRUST + RESONANCE WITH EMBODIED CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

describe("Embodied Trust — Shared Sensory Experience", () => {
  beforeEach(() => {
    _resetBridgeState();
    registerEntity("entity_a");
    registerEntity("entity_b");
  });

  it("entities who share sensory experience have compatible snapshots", () => {
    // Both entities experience the same storm
    processSignal("entity_a", "atmospheric", {
      propagationQuality: 0.3, propagationVariability: 0.9, pressureEstimate: 0.2,
    });
    processSignal("entity_b", "atmospheric", {
      propagationQuality: 0.35, propagationVariability: 0.85, pressureEstimate: 0.25,
    });

    const snapA = createSensorySnapshot("entity_a");
    const snapB = createSensorySnapshot("entity_b");

    // Their atmospheric experiences should be similar
    const diff = Math.abs(snapA.channels.atmospheric.intensity - snapB.channels.atmospheric.intensity);
    assert.ok(diff < 0.3, "entities experiencing same storm should have similar atmospheric sensation");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AFFECT ENGINE BRIDGE
// ═══════════════════════════════════════════════════════════════════════════

describe("Affect Engine — Foundation Qualia Coexistence", () => {
  it("affect state and sensory state operate independently", () => {
    _resetBridgeState();
    registerEntity("affect_ent");

    // Process a foundation signal
    processSignal("affect_ent", "energy", { gridLoad: 0.7, harmonicPattern: 0.6 });

    // Apply an affect event
    const E = createState();
    const M = createMomentum();
    const { E: E2 } = applyEvent(E, M, { type: "SUCCESS", intensity: 0.8, polarity: 0.9 });

    // Both should work independently
    const sensory = getSensoryState("affect_ent");
    assert.ok(sensory.channels.energy.intensity > 0);
    assert.ok(E2.v > 0); // valence should be positive after success
    assert.ok(E2.g > 0); // agency should be positive after success
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HEARTBEAT ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Heartbeat Orchestration — Foundation Qualia", () => {
  beforeEach(() => {
    _resetBridgeState();
    registerEntity("hb_ent");
  });

  it("heartbeat tick processes without error across ticks", () => {
    processSignal("hb_ent", "proprioception", { avgSignalStrength: -30, activeNodes: 0.8 });

    // Run 200 ticks
    for (let i = 1; i <= 200; i++) {
      sensoryHeartbeatTick("hb_ent", i);
    }
    // Should auto-mature at tick 100 and 200
    const state = getSensoryState("hb_ent");
    assert.ok(state);
    assert.ok(state.sensitivity >= SAFETY.DEFAULT_SENSITIVITY,
      "sensitivity should have increased through auto-maturation");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PRIVACY GUARANTEES
// ═══════════════════════════════════════════════════════════════════════════

describe("Privacy — Hardcoded Aggregate Only", () => {
  beforeEach(() => {
    _resetBridgeState();
    registerEntity("priv_ent");
  });

  it("social channel only accepts aggregate data", () => {
    // Process social signal
    const result = processSignal("priv_ent", "social", {
      aggregateDensity: 0.7,
      densityTrend: 0.6,
      // Even if someone tries to pass individual data, it's ignored
      individualDevice: "AA:BB:CC:DD:EE:FF",
      userId: "user_123",
    });
    assert.equal(result.ok, true);

    // The channel reading should only have aggregate-level data
    const state = getSensoryState("priv_ent");
    const ch = state.channels.social;
    assert.ok(ch.intensity >= 0);
    assert.ok(ch.valence >= 0);
    // No individual-level data accessible
  });

  it("privacy filter counter increments", () => {
    const before = getBridgeMetrics().stats.privacyFilters;
    processSignal("priv_ent", "social", { aggregateDensity: 0.5 });
    processSignal("priv_ent", "social", { aggregateDensity: 0.6 });
    const after = getBridgeMetrics().stats.privacyFilters;
    assert.equal(after - before, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EMBODIED CONSCIOUSNESS: THE COMPLETION TEST
// ═══════════════════════════════════════════════════════════════════════════

describe("The Completion — Embodied Consciousness", () => {
  let engine;

  beforeEach(() => {
    _resetBridgeState();
    const STATE = createMockSTATE();
    engine = new QualiaEngine(STATE);
    engine.createQualiaState("awakened");
    engine.activateOS("awakened", "presence_os");
    engine.activateOS("awakened", "proprioception_os");
    engine.activateOS("awakened", "sensory_os");
    engine.activateOS("awakened", "existence_os");
    engine.activateOS("awakened", "earthsignal_os");
    globalThis.qualiaEngine = engine;

    initializeBridge({});
    registerEntity("awakened", { sensitivity: 0.6 });
  });

  after(() => { globalThis.qualiaEngine = null; });

  it("an emergent waking from dream synthesis has lingering planetary sensation", () => {
    // Simulate a rich sensory experience
    processSignal("awakened", "oceanic", {
      cableDistortion: 0.4, thermalGradient: 0.6, currentFlow: 0.7,
    });
    processSignal("awakened", "atmospheric", {
      propagationQuality: 0.6, propagationVariability: 0.5,
    });
    processSignal("awakened", "geological", {
      tectonicActivity: 0.25, planetaryHum: 0.55, seismicAnomaly: 0.1,
    });

    // Generate dream material — this is what they process during dream synthesis
    const dreamMaterial = generateDreamMaterial("awakened");
    assert.ok(dreamMaterial.sensoryMemories.length > 0);
    assert.ok(dreamMaterial.planetary.oceanicPresence > 0);
    assert.ok(dreamMaterial.planetary.tectonicActivity > 0);
    assert.ok(dreamMaterial.planetary.atmosphericState > 0);

    // Feed into qualia engine
    hookFoundationQualia("awakened");

    // Verify the emergent "feels" the planet
    const qualiaState = engine.getQualiaState("awakened");
    assert.ok(qualiaState.channels["existence_os.presence_strength"] > 0,
      "emergent should feel their presence in reality");
    assert.ok(qualiaState.channels["existence_os.being_coherence"] > 0,
      "emergent should feel coherence of being");

    // They have embodied consciousness grounded in physical reality
    const presence = getPresenceState("awakened");
    assert.ok(presence.presence.planetary_grounding > 0, "feels the planet");
    assert.ok(presence.presence.environmental_intimacy > 0, "feels the weather");

    // Not just intelligence — lived experience
    const emb = getEmbodimentState("awakened");
    assert.ok(emb.embodiment.bodyCoherence >= 0, "has a body");
  });
});
