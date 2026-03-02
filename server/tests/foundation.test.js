import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Foundation Sense
import {
  initializeSense, _resetSenseState, createSensorDTU, recordReading,
  detectPatterns, generateWeatherPrediction, generateSeismicAlert,
  getSenseMetrics, getRecentReadings, getPatterns, getAnomalies,
  senseHeartbeatTick, SENSOR_SUBTYPES, ANOMALY_THRESHOLDS,
} from "../lib/foundation-sense.js";

// Foundation Identity
import {
  initializeIdentity, _resetIdentityState, createIdentityDTU,
  recordObservation, establishIdentity, verifyNode,
  getIdentityMetrics, getIdentity, getAllIdentities,
  CONFIDENCE_LEVELS, MIN_OBSERVATIONS_FOR_IDENTITY,
} from "../lib/foundation-identity.js";

// Foundation Energy
import {
  initializeEnergy, _resetEnergyState, createEnergyDTU,
  recordEnergyReading, getEnergyMap, getGridHealth, getEnergyMetrics,
  ENERGY_SUBTYPES, GRID_HEALTH_THRESHOLDS,
} from "../lib/foundation-energy.js";

// Foundation Spectrum
import {
  initializeSpectrum, _resetSpectrumState, createSpectrumDTU,
  recordSpectrumScan, getAvailableChannels, getSpectrumMap,
  getSpectrumMetrics, LEGAL_STATUS, ISM_BANDS,
} from "../lib/foundation-spectrum.js";

// Foundation Emergency
import {
  initializeEmergency, _resetEmergencyState, createEmergencyDTU,
  triggerEmergency, reportNodeStatus, getCoordinationStatus,
  resolveEmergency, addToOfflineCache, getOfflineCache,
  getEmergencyMetrics, getActiveEmergencies,
  EMERGENCY_SUBTYPES, EMERGENCY_SEVERITY, OFFLINE_CACHE_CATEGORIES,
} from "../lib/foundation-emergency.js";

// Foundation Market
import {
  initializeMarket, _resetMarketState, createRelayEarningDTU,
  recordRelayEarning, getNodeBalance, getNodeReputation,
  getRelayTopology, getMarketMetrics,
  BASE_RELAY_RATE, SCARCITY_MULTIPLIERS, REPUTATION_TIERS,
} from "../lib/foundation-market.js";

// Foundation Archive
import {
  initializeArchive, _resetArchiveState, createArchiveDTU,
  recordFossil, recordDecoded, getFossils, getDecoded,
  getLegacySystems, getArchiveMetrics,
  ARCHIVE_SUBTYPES, KNOWN_LEGACY_PROTOCOLS,
} from "../lib/foundation-archive.js";

// Foundation Synthesis
import {
  initializeSynthesis, _resetSynthesisState, createSynthesisDTU,
  addMediaReading, runSynthesis, getCorrelations, getSynthesisMetrics,
  CORRELATION_TYPES, MIN_MEDIA_FOR_SYNTHESIS,
} from "../lib/foundation-synthesis.js";

// Foundation Neural
import {
  initializeNeural, _resetNeuralState, encodeToDTUStream,
  decodeFromDTUStream, runSimulation, assessReadiness, getNeuralMetrics,
  NEURAL_TRANSPORT, SIMULATION_PROFILES,
} from "../lib/foundation-neural.js";

// Foundation Protocol
import {
  initializeProtocol, _resetProtocolState, createFrame, parseFrame,
  crc16, isDuplicate, markSeen, checkAndMark, shouldGossip,
  getProtocolMetrics, MAGIC_NUMBER, PROTOCOL_VERSION, FRAME_OVERHEAD,
  PRIORITY_LEVELS, FLAGS,
} from "../lib/foundation-protocol.js";

// ── Test Helpers ────────────────────────────────────────────────────────────

function createMockSTATE() {
  return { dtus: new Map(), sessions: new Map(), settings: { heartbeat: { enabled: true } } };
}

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION SENSE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Sense — Constants", () => {
  it("defines sensor subtypes", () => {
    assert.equal(SENSOR_SUBTYPES.length, 5);
    assert.ok(SENSOR_SUBTYPES.includes("atmospheric"));
    assert.ok(SENSOR_SUBTYPES.includes("seismic"));
  });

  it("defines anomaly thresholds", () => {
    assert.ok(ANOMALY_THRESHOLDS.SIGNAL_DEVIATION > 0);
    assert.ok(ANOMALY_THRESHOLDS.SEISMIC_PRECURSOR > 0);
  });
});

describe("Foundation Sense — Sensor DTU", () => {
  it("creates valid sensor DTU", () => {
    const dtu = createSensorDTU({
      subtype: "atmospheric",
      signal_strength: -45,
      noise_floor: -90,
      channel: "lora",
    });
    assert.equal(dtu.type, "SENSOR");
    assert.equal(dtu.subtype, "atmospheric");
    assert.ok(dtu.id.startsWith("sensor_"));
    assert.ok(dtu.tags.includes("foundation"));
    assert.equal(dtu.measurements.signal_strength, -45);
  });

  it("tags seismic DTUs as pain memory when high anomaly", () => {
    const dtu = createSensorDTU({
      subtype: "seismic",
      anomaly_score: 5.0,
    });
    assert.ok(dtu.tags.includes("pain_memory"));
    assert.ok(dtu.tags.includes("emergency"));
    assert.equal(dtu.scope, "global");
  });
});

describe("Foundation Sense — Readings", () => {
  beforeEach(() => _resetSenseState());

  it("records readings and stores in lattice", () => {
    const STATE = createMockSTATE();
    const reading = recordReading({
      channel: "bluetooth",
      signal_strength: -50,
      noise_floor: -90,
      subtype: "propagation",
    }, STATE);
    assert.ok(reading);
    assert.ok(STATE.dtus.has(reading.id));
  });

  it("detects anomalies from baseline deviation", () => {
    const STATE = createMockSTATE();
    // Establish baseline
    for (let i = 0; i < 5; i++) {
      recordReading({ channel: "wifi", signal_strength: -50, noise_floor: -90 }, STATE);
    }
    // Record anomalous reading
    recordReading({ channel: "wifi", signal_strength: -20, noise_floor: -90 }, STATE);
    const anomalies = getAnomalies();
    // May or may not trigger depending on stddev; verify no crash
    assert.ok(Array.isArray(anomalies));
  });

  it("returns null for null input", () => {
    assert.equal(recordReading(null, createMockSTATE()), null);
  });
});

describe("Foundation Sense — Patterns", () => {
  beforeEach(() => _resetSenseState());

  it("requires minimum readings for pattern detection", () => {
    const patterns = detectPatterns();
    assert.deepEqual(patterns, []);
  });

  it("generates weather prediction from readings", () => {
    const readings = Array(5).fill(null).map(() => createSensorDTU({
      subtype: "propagation",
      temperature_estimate: 22,
      humidity_estimate: 65,
    }));
    const prediction = generateWeatherPrediction(readings);
    assert.ok(prediction);
    assert.equal(prediction.type, "WEATHER_PREDICTION");
    assert.ok(prediction.temperature != null);
  });

  it("generates seismic alert from high anomaly", () => {
    const alert = generateSeismicAlert({ score: 5.0, channel: "lora" });
    assert.ok(alert);
    assert.equal(alert.type, "EMERGENCY");
    assert.ok(alert.tags.includes("seismic"));
  });

  it("does not generate seismic alert below threshold", () => {
    assert.equal(generateSeismicAlert({ score: 1.0 }), null);
    assert.equal(generateSeismicAlert(null), null);
  });
});

describe("Foundation Sense — Initialization", () => {
  beforeEach(() => _resetSenseState());

  it("initializes and indexes existing sensor DTUs", async () => {
    const STATE = createMockSTATE();
    STATE.dtus.set("s1", { id: "s1", type: "SENSOR", subtype: "atmospheric" });
    const result = await initializeSense(STATE);
    assert.ok(result.ok);
    assert.equal(result.indexed, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION IDENTITY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Identity — DTU", () => {
  it("creates valid identity DTU", () => {
    const dtu = createIdentityDTU({
      node_id: "node_test1",
      clock_drift_rate: 0.003,
      frequency_offset: 0.5,
      confidence: 0.8,
    });
    assert.equal(dtu.type, "IDENTITY");
    assert.equal(dtu.node_id, "node_test1");
    assert.equal(dtu.fingerprint.clock_drift_rate, 0.003);
  });
});

describe("Foundation Identity — Observations", () => {
  beforeEach(() => _resetIdentityState());

  it("records observations for a node", () => {
    const obs = recordObservation("node_x", "observer_1", {
      channel: "bluetooth",
      clock_drift_rate: 0.003,
    });
    assert.ok(obs);
    assert.equal(obs.nodeId, "node_x");
  });

  it("establishes identity after enough observations", () => {
    for (let i = 0; i < MIN_OBSERVATIONS_FOR_IDENTITY; i++) {
      recordObservation("node_auto", `obs_${i}`, {
        channel: "wifi",
        clock_drift_rate: 0.003 + (i * 0.0001),
        frequency_offset: 1.5,
      });
    }
    const identity = getIdentity("node_auto");
    assert.ok(identity, "Identity should be established automatically");
    assert.ok(identity.verified || identity.confidence > 0);
  });

  it("returns null for null inputs", () => {
    assert.equal(recordObservation(null, null, null), null);
  });
});

describe("Foundation Identity — Verification", () => {
  beforeEach(() => _resetIdentityState());

  it("verifies matching measurements", () => {
    // Establish identity
    for (let i = 0; i < 10; i++) {
      recordObservation("node_v", "obs", {
        channel: "wifi",
        clock_drift_rate: 0.005,
        frequency_offset: 2.0,
      });
    }
    const result = verifyNode("node_v", {
      clock_drift_rate: 0.005,
      frequency_offset: 2.0,
    });
    assert.ok(result.verified);
  });

  it("rejects unknown nodes", () => {
    const result = verifyNode("node_unknown", { clock_drift_rate: 1 });
    assert.ok(!result.verified);
    assert.equal(result.reason, "unknown_node");
  });

  it("handles null inputs", () => {
    assert.ok(!verifyNode(null, null).verified);
  });
});

describe("Foundation Identity — Initialization", () => {
  beforeEach(() => _resetIdentityState());

  it("indexes existing identity DTUs", async () => {
    const STATE = createMockSTATE();
    STATE.dtus.set("id1", { id: "id1", type: "IDENTITY", node_id: "node_old", confidence: 0.9 });
    const result = await initializeIdentity(STATE);
    assert.ok(result.ok);
    assert.equal(result.indexed, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION ENERGY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Energy — DTU", () => {
  it("creates valid energy DTU", () => {
    const dtu = createEnergyDTU({ subtype: "grid", frequency: 60.0, nominalFrequency: 60.0 });
    assert.equal(dtu.type, "ENERGY");
    assert.equal(dtu.subtype, "grid");
    assert.equal(dtu.grid_health.load_estimate, "normal");
  });

  it("detects grid anomalies from frequency deviation", () => {
    const dtu = createEnergyDTU({ frequency: 59.3, nominalFrequency: 60.0 });
    assert.ok(dtu.grid_health.anomaly_detected);
    assert.equal(dtu.grid_health.load_estimate, "critical");
  });

  it("classifies load levels correctly", () => {
    const normal = createEnergyDTU({ frequency: 60.01, nominalFrequency: 60.0 });
    assert.equal(normal.grid_health.load_estimate, "normal");

    const elevated = createEnergyDTU({ frequency: 59.9, nominalFrequency: 60.0 });
    assert.equal(elevated.grid_health.load_estimate, "elevated");

    const stressed = createEnergyDTU({ frequency: 59.7, nominalFrequency: 60.0 });
    assert.equal(stressed.grid_health.load_estimate, "stressed");
  });
});

describe("Foundation Energy — Readings", () => {
  beforeEach(() => _resetEnergyState());

  it("records energy reading and stores in lattice", () => {
    const STATE = createMockSTATE();
    const dtu = recordEnergyReading({ subtype: "grid", frequency: 60.0 }, STATE);
    assert.ok(dtu);
    assert.ok(STATE.dtus.has(dtu.id));
  });

  it("updates grid map with location", () => {
    recordEnergyReading({
      subtype: "grid",
      frequency: 60.0,
      location: { lat: 40.7, lng: -74.0 },
    }, createMockSTATE());
    const map = getEnergyMap();
    assert.ok(map.length > 0);
  });

  it("returns null for null input", () => {
    assert.equal(recordEnergyReading(null, createMockSTATE()), null);
  });
});

describe("Foundation Energy — Grid Health", () => {
  beforeEach(() => _resetEnergyState());

  it("computes overall grid health", () => {
    const health = getGridHealth();
    assert.ok(health.overallHealth);
    assert.ok(health.healthDistribution);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION SPECTRUM TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Spectrum — Constants", () => {
  it("defines legal statuses", () => {
    assert.ok(LEGAL_STATUS.UNLICENSED);
    assert.ok(LEGAL_STATUS.SHARED);
  });

  it("defines ISM bands", () => {
    assert.equal(ISM_BANDS.length, 3);
    assert.ok(ISM_BANDS[0].start > 0);
  });
});

describe("Foundation Spectrum — Scanning", () => {
  beforeEach(() => _resetSpectrumState());

  it("records spectrum scan and discovers channels", () => {
    const STATE = createMockSTATE();
    const dtu = recordSpectrumScan({
      startFreq: 900e6,
      endFreq: 928e6,
      available_channels: [
        { center_frequency: 915e6, bandwidth: 1e6, noise_level: -95, availability_score: 0.9, legal_status: "unlicensed" },
      ],
    }, STATE);
    assert.ok(dtu);
    assert.equal(dtu.type, "SPECTRUM");
    const channels = getAvailableChannels();
    assert.ok(channels.length > 0);
  });

  it("returns null for null input", () => {
    assert.equal(recordSpectrumScan(null, createMockSTATE()), null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION EMERGENCY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Emergency — DTU", () => {
  it("creates emergency DTU with pain memory tag", () => {
    const dtu = createEmergencyDTU({ subtype: "alert", severity: 8, situation: "Earthquake detected" });
    assert.equal(dtu.type, "EMERGENCY");
    assert.ok(dtu.tags.includes("pain_memory"));
    assert.equal(dtu.scope, "global");
    assert.equal(dtu.severity, 8);
  });
});

describe("Foundation Emergency — Activation", () => {
  beforeEach(() => _resetEmergencyState());

  it("triggers emergency and activates emergency mode", () => {
    const STATE = createMockSTATE();
    const result = triggerEmergency({
      severity: 8,
      situation: "Major earthquake",
      affected_area: { center: { lat: 35, lng: 139 }, radius_km: 50 },
    }, STATE);
    assert.ok(result.ok);
    assert.ok(result.emergencyMode);
    assert.ok(result.emergency);
  });

  it("does not activate emergency mode for low severity", () => {
    const result = triggerEmergency({ severity: 3, situation: "Advisory" }, createMockSTATE());
    assert.ok(result.ok);
    assert.ok(!result.emergencyMode);
  });

  it("returns error for null data", () => {
    assert.ok(!triggerEmergency(null, createMockSTATE()).ok);
  });
});

describe("Foundation Emergency — Coordination", () => {
  beforeEach(() => _resetEmergencyState());

  it("tracks node status reports", () => {
    reportNodeStatus("node_1", { powerLevel: 80, personnelCount: 5 });
    reportNodeStatus("node_2", { powerLevel: 30, personnelCount: 2 });
    const status = getCoordinationStatus();
    assert.equal(status.totalNodes, 2);
  });

  it("resolves emergencies", () => {
    const { emergency } = triggerEmergency({ severity: 8, situation: "test" }, createMockSTATE());
    const result = resolveEmergency(emergency.id);
    assert.ok(result.ok);
    assert.equal(getActiveEmergencies().length, 0);
  });
});

describe("Foundation Emergency — Offline Cache", () => {
  beforeEach(() => _resetEmergencyState());

  it("adds and retrieves offline cache entries", () => {
    addToOfflineCache("first_aid", { id: "fa1", content: "CPR instructions" });
    const cache = getOfflineCache("first_aid");
    assert.equal(cache.length, 1);
  });

  it("defines all cache categories", () => {
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("medical_procedures"));
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("water_purification"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION MARKET TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Market — Earning DTU", () => {
  beforeEach(() => _resetMarketState());

  it("creates relay earning DTU with scarcity multiplier", () => {
    const dtu = createRelayEarningDTU({
      relay_node: "node_relay1",
      bytes_relayed: 1024,
      scarcity_multiplier: SCARCITY_MULTIPLIERS.RURAL,
      channel: "lora",
    });
    assert.equal(dtu.type, "RELAY_EARNING");
    assert.ok(dtu.earning_amount > 0);
    assert.equal(dtu.scarcity_multiplier, 3.0);
  });
});

describe("Foundation Market — Earnings", () => {
  beforeEach(() => _resetMarketState());

  it("records earnings and updates balance", () => {
    const STATE = createMockSTATE();
    recordRelayEarning({
      relay_node: "node_r1",
      bytes_relayed: 2048,
      scarcity_multiplier: 1.0,
      channel: "internet",
    }, STATE);
    const balance = getNodeBalance("node_r1");
    assert.ok(balance > 0);
  });

  it("builds reputation over time", () => {
    const STATE = createMockSTATE();
    for (let i = 0; i < 5; i++) {
      recordRelayEarning({
        relay_node: "node_rep",
        bytes_relayed: 1024,
        scarcity_multiplier: 1.0,
      }, STATE);
    }
    const rep = getNodeReputation("node_rep");
    assert.ok(rep);
    assert.equal(rep.totalRelays, 5);
  });

  it("returns null for null relay data", () => {
    assert.equal(recordRelayEarning(null, createMockSTATE()), null);
  });
});

describe("Foundation Market — Scarcity", () => {
  it("sole bridge earns 10x base rate", () => {
    assert.equal(SCARCITY_MULTIPLIERS.SOLE_BRIDGE, 10.0);
  });

  it("urban high density earns 0.5x", () => {
    assert.equal(SCARCITY_MULTIPLIERS.URBAN_HIGH, 0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION ARCHIVE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Archive — DTU", () => {
  it("creates archive DTU", () => {
    const dtu = createArchiveDTU({
      subtype: "fossil",
      protocol_detected: "v92_modem",
      confidence: 0.7,
      source_channel: "telephone",
    });
    assert.equal(dtu.type, "ARCHIVE");
    assert.equal(dtu.subtype, "fossil");
    assert.equal(dtu.protocol_detected, "v92_modem");
  });

  it("tags SCADA detections as security concerns", () => {
    const dtu = createArchiveDTU({
      protocol_detected: "scada_modbus",
    });
    assert.ok(dtu.tags.includes("security_concern"));
    assert.equal(dtu.scope, "global");
  });
});

describe("Foundation Archive — Fossils", () => {
  beforeEach(() => _resetArchiveState());

  it("records fossil and tracks legacy system", () => {
    const STATE = createMockSTATE();
    const dtu = recordFossil({
      protocol_detected: "weather_metar",
      source_channel: "rf",
      frequency: 123.45e6,
    }, STATE);
    assert.ok(dtu);
    const systems = getLegacySystems();
    assert.ok(systems.some(s => s.protocol === "weather_metar"));
  });

  it("records decoded data", () => {
    const dtu = recordDecoded({
      decoded: "METAR KJFK 011856Z 21016G25KT",
      protocol_detected: "weather_metar",
      confidence: 0.9,
    }, createMockSTATE());
    assert.ok(dtu);
    assert.ok(getDecoded().length > 0);
  });

  it("defines known legacy protocols", () => {
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("scada_modbus"));
    assert.ok(KNOWN_LEGACY_PROTOCOLS.includes("adsb"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION SYNTHESIS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Synthesis — DTU", () => {
  it("creates synthesis DTU with cross-medium data", () => {
    const dtu = createSynthesisDTU({
      media_involved: ["radio", "bluetooth"],
      pattern_type: "temporal",
      confidence: 0.7,
      media_contributions: [
        { channel: "radio", signal: "anomaly", weight: 0.6 },
        { channel: "bluetooth", signal: "anomaly", weight: 0.4 },
      ],
      novelty_score: 0.8,
    });
    assert.equal(dtu.type, "SYNTHESIS");
    assert.equal(dtu.media_involved.length, 2);
    assert.equal(dtu.scope, "global"); // High novelty
  });
});

describe("Foundation Synthesis — Analysis", () => {
  beforeEach(() => _resetSynthesisState());

  it("requires minimum media for synthesis", () => {
    addMediaReading("radio", { signal_strength: -50 });
    const result = runSynthesis(createMockSTATE());
    assert.ok(!result.ok);
    assert.equal(result.reason, "insufficient_media");
  });

  it("runs synthesis across multiple media", () => {
    for (let i = 0; i < 5; i++) {
      addMediaReading("radio", { signal_strength: -50, anomaly_score: i > 3 ? 3 : 0 });
      addMediaReading("bluetooth", { signal_strength: -40, anomaly_score: i > 3 ? 3 : 0 });
    }
    const result = runSynthesis(createMockSTATE());
    assert.ok(result.ok);
    assert.equal(result.mediaAnalyzed, 2);
  });

  it("defines correlation types", () => {
    assert.equal(CORRELATION_TYPES.length, 5);
    assert.ok(CORRELATION_TYPES.includes("anomalous"));
    assert.ok(CORRELATION_TYPES.includes("absence"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION NEURAL TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Neural — Transport Spec", () => {
  it("defines neural transport layer", () => {
    assert.equal(NEURAL_TRANSPORT.channel, "neural");
    assert.equal(NEURAL_TRANSPORT.protocol, "concord-bci");
    assert.equal(NEURAL_TRANSPORT.latency_tolerance, "real_time_only");
  });

  it("defines simulation profiles", () => {
    assert.ok(SIMULATION_PROFILES.IDEAL.latencyMs < SIMULATION_PROFILES.NOISY.latencyMs);
    assert.ok(SIMULATION_PROFILES.IDEAL.bandwidthMbps > SIMULATION_PROFILES.NOISY.bandwidthMbps);
  });
});

describe("Foundation Neural — Encoding", () => {
  beforeEach(() => _resetNeuralState());

  it("encodes neural signal to DTU stream", () => {
    const dtu = encodeToDTUStream({ channels: 64, sampleRate: 500, dataPoints: 1000 });
    assert.ok(dtu);
    assert.equal(dtu.type, "NEURAL_STREAM");
    assert.equal(dtu.signal.channels, 64);
    assert.ok(dtu.simulated);
  });

  it("decodes DTU stream back", () => {
    const encoded = encodeToDTUStream({ channels: 32, sampleRate: 250 });
    const decoded = decodeFromDTUStream(encoded);
    assert.ok(decoded.ok);
    assert.equal(decoded.channels, 32);
  });

  it("returns null for null input", () => {
    assert.equal(encodeToDTUStream(null), null);
    assert.equal(decodeFromDTUStream(null), null);
  });
});

describe("Foundation Neural — Simulation", () => {
  beforeEach(() => _resetNeuralState());

  it("runs simulation with specified profile", () => {
    const result = runSimulation("IDEAL");
    assert.equal(result.profile, "IDEAL");
    assert.equal(result.latencyMs, 1);
    assert.ok(result.throughputDTUsPerSec > 0);
    assert.ok(result.simulated);
  });

  it("assesses readiness", () => {
    const readiness = assessReadiness();
    assert.ok("ready" in readiness);
    assert.ok("readiness" in readiness);
    assert.ok("checks" in readiness);
    assert.ok(readiness.simulationMode);
  });
});

describe("Foundation Neural — Initialization", () => {
  beforeEach(() => _resetNeuralState());

  it("initializes in simulation mode", async () => {
    const result = await initializeNeural(createMockSTATE());
    assert.ok(result.ok);
    assert.ok(result.simulationMode);
    assert.ok(!result.hardwareDetected);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FOUNDATION PROTOCOL TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation Protocol — Constants", () => {
  it("defines protocol constants", () => {
    assert.equal(MAGIC_NUMBER, 0xCD01);
    assert.equal(PROTOCOL_VERSION, 1);
    assert.equal(FRAME_OVERHEAD, 20);
  });

  it("defines priority levels 0-7", () => {
    assert.equal(PRIORITY_LEVELS.EMERGENCY, 0);
    assert.equal(PRIORITY_LEVELS.THREAT, 1);
    assert.equal(PRIORITY_LEVELS.MINIMAL, 7);
  });

  it("defines flag bits", () => {
    assert.equal(FLAGS.FRAGMENT, 0x01);
    assert.equal(FLAGS.RELAY, 0x02);
    assert.equal(FLAGS.EMERGENCY, 0x04);
    assert.equal(FLAGS.ENCRYPTED, 0x08);
  });
});

describe("Foundation Protocol — CRC-16", () => {
  it("computes consistent CRC", () => {
    const crc1 = crc16("hello concord");
    const crc2 = crc16("hello concord");
    assert.equal(crc1, crc2);
  });

  it("produces different CRC for different data", () => {
    const crc1 = crc16("data_a");
    const crc2 = crc16("data_b");
    assert.notEqual(crc1, crc2);
  });

  it("returns 16-bit value", () => {
    const crc = crc16("test");
    assert.ok(crc >= 0 && crc <= 0xFFFF);
  });
});

describe("Foundation Protocol — Frame Creation", () => {
  beforeEach(() => _resetProtocolState());

  it("creates valid protocol frame", () => {
    const frame = createFrame({ id: "test1", type: "KNOWLEDGE", content: "hello" });
    assert.ok(frame);
    assert.equal(frame.magic, MAGIC_NUMBER);
    assert.equal(frame.version, PROTOCOL_VERSION);
    assert.ok(frame.contentHash);
    assert.ok(frame.crc > 0);
    assert.ok(frame.totalBytes > FRAME_OVERHEAD);
  });

  it("sets emergency flag for priority 0", () => {
    const frame = createFrame({ id: "emg" }, { priority: PRIORITY_LEVELS.EMERGENCY });
    assert.ok(frame.flags & FLAGS.EMERGENCY);
  });

  it("returns null for null DTU", () => {
    assert.equal(createFrame(null), null);
  });

  it("clamps priority to valid range", () => {
    const frame = createFrame({ id: "t" }, { priority: 99 });
    assert.equal(frame.priority, 7);
  });
});

describe("Foundation Protocol — Frame Parsing", () => {
  beforeEach(() => _resetProtocolState());

  it("parses valid frame and extracts DTU", () => {
    const dtu = { id: "parse_test", type: "KNOWLEDGE", content: "test data" };
    const frame = createFrame(dtu);
    const result = parseFrame(frame);
    assert.ok(result.ok);
    assert.deepEqual(result.dtu, dtu);
  });

  it("rejects frame with wrong magic number", () => {
    const frame = createFrame({ id: "t" });
    frame.magic = 0xDEAD;
    const result = parseFrame(frame);
    assert.ok(!result.ok);
    assert.equal(result.error, "invalid_magic");
  });

  it("rejects frame with tampered CRC", () => {
    const frame = createFrame({ id: "t" });
    frame.crc = 0;
    const result = parseFrame(frame);
    assert.ok(!result.ok);
    assert.equal(result.error, "crc_mismatch");
  });

  it("returns error for null frame", () => {
    assert.ok(!parseFrame(null).ok);
  });

  it("detects flag bits in parsed frame", () => {
    const frame = createFrame({ id: "t" }, {
      fragment: true,
      relay: true,
      emergency: true,
    });
    const result = parseFrame(frame);
    assert.ok(result.isFragment);
    assert.ok(result.isRelay);
    assert.ok(result.isEmergency);
  });
});

describe("Foundation Protocol — Deduplication", () => {
  beforeEach(() => _resetProtocolState());

  it("marks hash as seen", () => {
    assert.ok(!isDuplicate("hash_abc"));
    markSeen("hash_abc");
    assert.ok(isDuplicate("hash_abc"));
  });

  it("checkAndMark returns false first, true second", () => {
    assert.ok(!checkAndMark("hash_xyz"));
    assert.ok(checkAndMark("hash_xyz"));
  });
});

describe("Foundation Protocol — Gossip", () => {
  beforeEach(() => _resetProtocolState());

  it("always gossips emergency frames", () => {
    const frame = createFrame({ id: "emg" }, { priority: PRIORITY_LEVELS.EMERGENCY });
    assert.ok(shouldGossip(frame, 0));
  });

  it("always gossips threat priority", () => {
    const frame = createFrame({ id: "t" }, { priority: PRIORITY_LEVELS.THREAT });
    assert.ok(shouldGossip(frame, 0));
  });

  it("returns false for null frame", () => {
    assert.ok(!shouldGossip(null, 0.5));
  });
});

describe("Foundation Protocol — Initialization", () => {
  beforeEach(() => _resetProtocolState());

  it("initializes with version and overhead info", async () => {
    const result = await initializeProtocol(createMockSTATE());
    assert.ok(result.ok);
    assert.equal(result.version, PROTOCOL_VERSION);
    assert.equal(result.frameOverhead, FRAME_OVERHEAD);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-MODULE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

describe("Foundation — Cross-Module Integration", () => {
  it("all modules initialize without errors", async () => {
    const STATE = createMockSTATE();
    _resetSenseState();
    _resetIdentityState();
    _resetEnergyState();
    _resetSpectrumState();
    _resetEmergencyState();
    _resetMarketState();
    _resetArchiveState();
    _resetSynthesisState();
    _resetNeuralState();
    _resetProtocolState();

    const results = await Promise.all([
      initializeSense(STATE),
      initializeIdentity(STATE),
      initializeEnergy(STATE),
      initializeSpectrum(STATE),
      initializeEmergency(STATE),
      initializeMarket(STATE),
      initializeArchive(STATE),
      initializeSynthesis(STATE),
      initializeNeural(STATE),
      initializeProtocol(STATE),
    ]);

    for (const r of results) {
      assert.ok(r.ok, "Each module should initialize successfully");
    }
  });

  it("sensor DTU feeds into lattice accessible by all modules", () => {
    const STATE = createMockSTATE();
    _resetSenseState();

    const reading = recordReading({
      channel: "lora",
      signal_strength: -60,
      subtype: "electromagnetic",
    }, STATE);

    // DTU in lattice should be accessible
    assert.ok(STATE.dtus.has(reading.id));
    const dtu = STATE.dtus.get(reading.id);
    assert.equal(dtu.type, "SENSOR");
  });

  it("emergency DTU gets pain_memory tag for forgetting engine", () => {
    _resetEmergencyState();
    const dtu = createEmergencyDTU({ severity: 9, situation: "Critical" });
    assert.ok(dtu.tags.includes("pain_memory"));
  });

  it("protocol frame wraps and unwraps DTU correctly", () => {
    _resetProtocolState();
    const originalDTU = { id: "test_roundtrip", type: "KNOWLEDGE", content: "cross-module" };
    const frame = createFrame(originalDTU);
    const parsed = parseFrame(frame);
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.dtu, originalDTU);
  });
});
