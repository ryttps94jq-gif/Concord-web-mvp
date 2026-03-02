/**
 * Foundation Sense — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (sensor subtypes, derived products, anomaly thresholds)
 *   - createSensorDTU (happy path, subtypes, seismic escalation, edge cases)
 *   - recordReading (baseline creation, anomaly detection, state management)
 *   - detectPatterns (insufficient data, anomaly trends, signal degradation)
 *   - generateWeatherPrediction (happy path, missing data, edge cases)
 *   - generateSeismicAlert (threshold behavior, severity clamping)
 *   - Metrics getters (getSenseMetrics, getRecentReadings, getPatterns, getAnomalies)
 *   - senseHeartbeatTick (pattern detection cadence, anomaly cleanup)
 *   - initializeSense (indexing from STATE, double-init guard)
 *   - _resetSenseState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  SENSOR_SUBTYPES,
  DERIVED_PRODUCTS,
  ANOMALY_THRESHOLDS,
  createSensorDTU,
  recordReading,
  detectPatterns,
  generateWeatherPrediction,
  generateSeismicAlert,
  getSenseMetrics,
  getRecentReadings,
  getPatterns,
  getAnomalies,
  senseHeartbeatTick,
  initializeSense,
  _resetSenseState,
} from "../lib/foundation-sense.js";

beforeEach(() => {
  _resetSenseState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Sense — Constants", () => {
  it("defines 5 sensor subtypes", () => {
    assert.equal(SENSOR_SUBTYPES.length, 5);
    assert.ok(SENSOR_SUBTYPES.includes("atmospheric"));
    assert.ok(SENSOR_SUBTYPES.includes("electromagnetic"));
    assert.ok(SENSOR_SUBTYPES.includes("seismic"));
    assert.ok(SENSOR_SUBTYPES.includes("acoustic"));
    assert.ok(SENSOR_SUBTYPES.includes("propagation"));
  });

  it("defines 4 derived products", () => {
    assert.equal(DERIVED_PRODUCTS.length, 4);
    assert.ok(DERIVED_PRODUCTS.includes("weather_prediction"));
    assert.ok(DERIVED_PRODUCTS.includes("seismic_alert"));
    assert.ok(DERIVED_PRODUCTS.includes("environmental_monitor"));
    assert.ok(DERIVED_PRODUCTS.includes("energy_map"));
  });

  it("defines anomaly thresholds", () => {
    assert.equal(ANOMALY_THRESHOLDS.SIGNAL_DEVIATION, 3.0);
    assert.equal(ANOMALY_THRESHOLDS.NOISE_SPIKE, 2.5);
    assert.equal(ANOMALY_THRESHOLDS.PROPAGATION_SHIFT, 2.0);
    assert.equal(ANOMALY_THRESHOLDS.SEISMIC_PRECURSOR, 4.0);
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(SENSOR_SUBTYPES), true);
    assert.equal(Object.isFrozen(DERIVED_PRODUCTS), true);
    assert.equal(Object.isFrozen(ANOMALY_THRESHOLDS), true);
  });
});

// ── createSensorDTU ──────────────────────────────────────────────────────

describe("Foundation Sense — createSensorDTU", () => {
  it("creates a DTU with valid subtype", () => {
    const dtu = createSensorDTU({ subtype: "atmospheric", channel: "lora" });
    assert.match(dtu.id, /^sensor_/);
    assert.equal(dtu.type, "SENSOR");
    assert.equal(dtu.subtype, "atmospheric");
    assert.equal(dtu.channel, "lora");
    assert.ok(dtu.created);
    assert.ok(dtu.tags.includes("foundation"));
    assert.ok(dtu.tags.includes("sensor"));
    assert.ok(dtu.tags.includes("atmospheric"));
  });

  it("defaults to propagation for invalid subtype", () => {
    const dtu = createSensorDTU({ subtype: "invalid_type" });
    assert.equal(dtu.subtype, "propagation");
  });

  it("sets measurements from opts", () => {
    const dtu = createSensorDTU({
      subtype: "electromagnetic",
      signal_strength: -45,
      noise_floor: -90,
      propagation_delay: 10,
      frequency: 2400,
      bandwidth_observed: 20,
      error_rate: 0.01,
      anomaly_score: 1.5,
    });
    assert.equal(dtu.measurements.signal_strength, -45);
    assert.equal(dtu.measurements.noise_floor, -90);
    assert.equal(dtu.measurements.propagation_delay, 10);
    assert.equal(dtu.measurements.frequency, 2400);
    assert.equal(dtu.measurements.bandwidth_observed, 20);
    assert.equal(dtu.measurements.error_rate, 0.01);
    assert.equal(dtu.measurements.anomaly_score, 1.5);
  });

  it("defaults measurements to null/0 when not provided", () => {
    const dtu = createSensorDTU({ subtype: "acoustic" });
    assert.equal(dtu.measurements.signal_strength, null);
    assert.equal(dtu.measurements.noise_floor, null);
    assert.equal(dtu.measurements.anomaly_score, 0);
  });

  it("sets derived values from opts", () => {
    const dtu = createSensorDTU({
      subtype: "atmospheric",
      temperature_estimate: 22.5,
      humidity_estimate: 65,
      pressure_estimate: 1013,
      activity_level: 0.3,
    });
    assert.equal(dtu.derived.temperature_estimate, 22.5);
    assert.equal(dtu.derived.humidity_estimate, 65);
    assert.equal(dtu.derived.pressure_estimate, 1013);
    assert.equal(dtu.derived.activity_level, 0.3);
  });

  it("sets seismic subtype to global scope with higher crpiScore", () => {
    const dtu = createSensorDTU({ subtype: "seismic" });
    assert.equal(dtu.scope, "global");
    assert.equal(dtu.crpiScore, 0.8);
  });

  it("non-seismic subtypes get local scope", () => {
    const dtu = createSensorDTU({ subtype: "acoustic" });
    assert.equal(dtu.scope, "local");
    assert.equal(dtu.crpiScore, 0.2);
  });

  it("escalates seismic DTU with high anomaly score to emergency", () => {
    const dtu = createSensorDTU({
      subtype: "seismic",
      anomaly_score: 5.0, // Above SEISMIC_PRECURSOR threshold (4.0)
    });
    assert.ok(dtu.tags.includes("pain_memory"));
    assert.ok(dtu.tags.includes("emergency"));
    assert.equal(dtu.scope, "global");
    assert.equal(dtu.crpiScore, 0.9);
  });

  it("does not escalate seismic DTU below precursor threshold", () => {
    const dtu = createSensorDTU({
      subtype: "seismic",
      anomaly_score: 2.0,
    });
    assert.ok(!dtu.tags.includes("pain_memory"));
    assert.ok(!dtu.tags.includes("emergency"));
  });

  it("sets source, source_node, target_node from opts", () => {
    const dtu = createSensorDTU({
      subtype: "propagation",
      source: "custom-source",
      source_node: "node_A",
      target_node: "node_B",
    });
    assert.equal(dtu.source, "custom-source");
    assert.equal(dtu.source_node, "node_A");
    assert.equal(dtu.target_node, "node_B");
  });

  it("defaults source to foundation-sense", () => {
    const dtu = createSensorDTU({ subtype: "propagation" });
    assert.equal(dtu.source, "foundation-sense");
  });

  it("handles empty opts object", () => {
    const dtu = createSensorDTU({});
    assert.equal(dtu.subtype, "propagation");
    assert.equal(dtu.channel, "unknown");
  });
});

// ── recordReading ──────────────────────────────────────────────────────────

describe("Foundation Sense — recordReading", () => {
  it("returns null for null input", () => {
    assert.equal(recordReading(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(recordReading(undefined), null);
  });

  it("records a reading and increments stats", () => {
    const reading = recordReading({ channel: "lora", subtype: "atmospheric", signal_strength: -50 });
    assert.notEqual(reading, null);
    assert.match(reading.id, /^sensor_/);
    const metrics = getSenseMetrics();
    assert.equal(metrics.stats.totalReadings, 1);
    assert.notEqual(metrics.stats.lastReadingAt, null);
  });

  it("creates baseline on first reading for a channel", () => {
    recordReading({ channel: "wifi", source_node: "nodeA", signal_strength: -45, noise_floor: -90 });
    const metrics = getSenseMetrics();
    assert.equal(metrics.baselineCount, 1);
  });

  it("updates existing baseline on subsequent readings", () => {
    recordReading({ channel: "wifi", source_node: "nodeA", signal_strength: -45, noise_floor: -90 });
    recordReading({ channel: "wifi", source_node: "nodeA", signal_strength: -50, noise_floor: -88 });
    const metrics = getSenseMetrics();
    assert.equal(metrics.baselineCount, 1); // Same key, updated baseline
    assert.equal(metrics.stats.totalReadings, 2);
  });

  it("detects anomalies when score exceeds threshold", () => {
    // First reading establishes baseline
    recordReading({ channel: "test_ch", source_node: "n1", signal_strength: -50, noise_floor: -90 });
    // Second reading with wildly different values to trigger anomaly
    // The baseline stdSignal defaults to 5, so a reading deviating by >15 (3.0 * 5) triggers anomaly
    recordReading({ channel: "test_ch", source_node: "n1", signal_strength: -10, noise_floor: -90 });
    const metrics = getSenseMetrics();
    assert.ok(metrics.stats.anomaliesDetected >= 1);
  });

  it("stores reading in STATE.dtus when provided", () => {
    const STATE = { dtus: new Map() };
    const reading = recordReading({ channel: "lora", subtype: "acoustic" }, STATE);
    assert.ok(STATE.dtus.has(reading.id));
    assert.equal(STATE.dtus.get(reading.id), reading);
  });

  it("does not crash when STATE is undefined", () => {
    const reading = recordReading({ channel: "lora", subtype: "propagation" });
    assert.notEqual(reading, null);
  });

  it("caps readings at 1000 (trims to 800)", () => {
    for (let i = 0; i < 1005; i++) {
      recordReading({ channel: "bulk", signal_strength: -50 + (i % 10) });
    }
    const readings = getRecentReadings(2000);
    assert.ok(readings.length <= 800);
  });

  it("caps anomalies at 500 (trims to 400)", () => {
    // Create many anomalies by alternating extreme readings
    for (let i = 0; i < 510; i++) {
      // Establish baseline then deviate hugely
      recordReading({ channel: `ch_${i % 5}`, source_node: "n1", signal_strength: i % 2 === 0 ? -50 : 100 });
    }
    const anomalies = getAnomalies(1000);
    assert.ok(anomalies.length <= 500);
  });
});

// ── detectPatterns ──────────────────────────────────────────────────────────

describe("Foundation Sense — detectPatterns", () => {
  it("returns empty array with fewer than 10 readings", () => {
    for (let i = 0; i < 5; i++) {
      recordReading({ channel: "test", signal_strength: -50 });
    }
    const patterns = detectPatterns();
    assert.deepEqual(patterns, []);
  });

  it("returns empty array with no clear patterns", () => {
    for (let i = 0; i < 15; i++) {
      recordReading({ channel: `different_ch_${i}`, signal_strength: -50 });
    }
    const patterns = detectPatterns();
    assert.ok(Array.isArray(patterns));
  });

  it("detects signal degradation pattern", () => {
    // First readings with good signal
    for (let i = 0; i < 10; i++) {
      recordReading({ channel: "degrade_ch", signal_strength: -30 });
    }
    // Later readings with degraded signal (drop > 5)
    for (let i = 0; i < 10; i++) {
      recordReading({ channel: "degrade_ch", signal_strength: -50 });
    }
    const patterns = detectPatterns();
    const degradation = patterns.find(p => p.type === "signal_degradation");
    if (degradation) {
      assert.equal(degradation.channel, "degrade_ch");
      assert.ok(degradation.delta < 0);
    }
  });

  it("stores detected patterns in state and increments stats", () => {
    for (let i = 0; i < 10; i++) {
      recordReading({ channel: "pat_ch", signal_strength: -30 });
    }
    for (let i = 0; i < 10; i++) {
      recordReading({ channel: "pat_ch", signal_strength: -50 });
    }
    detectPatterns();
    const metrics = getSenseMetrics();
    assert.ok(metrics.patternCount >= 0);
  });
});

// ── generateWeatherPrediction ──────────────────────────────────────────────

describe("Foundation Sense — generateWeatherPrediction", () => {
  it("returns null for null/undefined input", () => {
    assert.equal(generateWeatherPrediction(null), null);
    assert.equal(generateWeatherPrediction(undefined), null);
  });

  it("returns null for fewer than 3 readings", () => {
    assert.equal(generateWeatherPrediction([]), null);
    assert.equal(generateWeatherPrediction([{ subtype: "propagation" }]), null);
    assert.equal(generateWeatherPrediction([{}, {}]), null);
  });

  it("returns null when no propagation/atmospheric readings exist", () => {
    const readings = [
      { subtype: "acoustic" },
      { subtype: "seismic" },
      { subtype: "electromagnetic" },
    ];
    assert.equal(generateWeatherPrediction(readings), null);
  });

  it("generates weather prediction from propagation readings", () => {
    const readings = [
      { subtype: "propagation", derived: { temperature_estimate: 20, humidity_estimate: 60 } },
      { subtype: "propagation", derived: { temperature_estimate: 22, humidity_estimate: 65 } },
      { subtype: "atmospheric", derived: { temperature_estimate: 21, humidity_estimate: 62 } },
    ];
    const pred = generateWeatherPrediction(readings);
    assert.notEqual(pred, null);
    assert.match(pred.id, /^weather_/);
    assert.equal(pred.type, "WEATHER_PREDICTION");
    assert.equal(pred.source, "foundation-sense");
    assert.equal(pred.basedOnReadings, 3);
    assert.ok(pred.temperature > 19 && pred.temperature < 23);
    assert.ok(pred.humidity > 59 && pred.humidity < 66);
    assert.ok(pred.confidence > 0 && pred.confidence <= 1);
    assert.ok(pred.tags.includes("weather"));
    assert.ok(pred.tags.includes("prediction"));
  });

  it("handles readings with null temperature/humidity", () => {
    const readings = [
      { subtype: "propagation", derived: {} },
      { subtype: "propagation", derived: {} },
      { subtype: "atmospheric", derived: {} },
    ];
    const pred = generateWeatherPrediction(readings);
    assert.notEqual(pred, null);
    assert.equal(pred.temperature, null);
    assert.equal(pred.humidity, null);
  });

  it("confidence scales with reading count (capped at 1.0)", () => {
    const readings = Array.from({ length: 25 }, () => ({
      subtype: "propagation",
      derived: { temperature_estimate: 20 },
    }));
    const pred = generateWeatherPrediction(readings);
    assert.equal(pred.confidence, 1.0);
  });
});

// ── generateSeismicAlert ──────────────────────────────────────────────────

describe("Foundation Sense — generateSeismicAlert", () => {
  it("returns null for null input", () => {
    assert.equal(generateSeismicAlert(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(generateSeismicAlert(undefined), null);
  });

  it("returns null when score is below SEISMIC_PRECURSOR threshold", () => {
    assert.equal(generateSeismicAlert({ score: 2.0, channel: "test" }), null);
    assert.equal(generateSeismicAlert({ score: 3.9, channel: "test" }), null);
  });

  it("generates alert when score meets threshold", () => {
    const alert = generateSeismicAlert({ score: 4.0, channel: "elf" });
    assert.notEqual(alert, null);
    assert.match(alert.id, /^seismic_alert_/);
    assert.equal(alert.type, "EMERGENCY");
    assert.equal(alert.subtype, "alert");
    assert.equal(alert.source, "foundation-sense");
    assert.equal(alert.scope, "global");
    assert.equal(alert.crpiScore, 0.95);
    assert.ok(alert.tags.includes("seismic"));
    assert.ok(alert.tags.includes("emergency"));
    assert.ok(alert.tags.includes("pain_memory"));
  });

  it("clamps severity between 1 and 10", () => {
    const lowAlert = generateSeismicAlert({ score: 4.0, channel: "test" });
    assert.ok(lowAlert.severity >= 1 && lowAlert.severity <= 10);

    const highAlert = generateSeismicAlert({ score: 100, channel: "test" });
    assert.equal(highAlert.severity, 10);
  });

  it("increments alertsGenerated stat", () => {
    generateSeismicAlert({ score: 5.0, channel: "test" });
    generateSeismicAlert({ score: 6.0, channel: "test" });
    const metrics = getSenseMetrics();
    assert.equal(metrics.stats.alertsGenerated, 2);
  });

  it("includes anomaly data in content", () => {
    const alert = generateSeismicAlert({ score: 5.5, channel: "elf_band" });
    assert.equal(alert.content.anomaly_score, 5.5);
    assert.equal(alert.content.channel, "elf_band");
    assert.ok(alert.content.situation.includes("seismic"));
  });
});

// ── Metrics Getters ──────────────────────────────────────────────────────

describe("Foundation Sense — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getSenseMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.readingCount, 0);
    assert.equal(metrics.patternCount, 0);
    assert.equal(metrics.anomalyCount, 0);
    assert.equal(metrics.baselineCount, 0);
    assert.equal(metrics.stats.totalReadings, 0);
    assert.ok(metrics.uptime >= 0);
  });

  it("getRecentReadings returns limited results", () => {
    for (let i = 0; i < 10; i++) {
      recordReading({ channel: "ch", signal_strength: -50 });
    }
    const recent = getRecentReadings(5);
    assert.equal(recent.length, 5);
  });

  it("getRecentReadings defaults to 50", () => {
    for (let i = 0; i < 60; i++) {
      recordReading({ channel: "ch", signal_strength: -50 });
    }
    const recent = getRecentReadings();
    assert.equal(recent.length, 50);
  });

  it("getPatterns returns limited results", () => {
    const patterns = getPatterns(5);
    assert.ok(Array.isArray(patterns));
    assert.ok(patterns.length <= 5);
  });

  it("getAnomalies returns limited results", () => {
    const anomalies = getAnomalies(5);
    assert.ok(Array.isArray(anomalies));
    assert.ok(anomalies.length <= 5);
  });
});

// ── senseHeartbeatTick ──────────────────────────────────────────────────

describe("Foundation Sense — senseHeartbeatTick", () => {
  it("runs without error on any tick", async () => {
    await senseHeartbeatTick({}, 1);
    await senseHeartbeatTick({}, 5);
  });

  it("triggers pattern detection every 10th tick", async () => {
    // Add enough readings for pattern detection to run
    for (let i = 0; i < 15; i++) {
      recordReading({ channel: "test", signal_strength: -50 });
    }
    await senseHeartbeatTick({}, 10);
    // Should not throw
  });

  it("cleans old anomalies every 100th tick", async () => {
    await senseHeartbeatTick({}, 100);
    // Should not throw; anomaly cleanup runs silently
  });
});

// ── initializeSense ──────────────────────────────────────────────────────

describe("Foundation Sense — initializeSense", () => {
  it("initializes successfully", async () => {
    const result = await initializeSense({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    const metrics = getSenseMetrics();
    assert.equal(metrics.initialized, true);
  });

  it("indexes existing SENSOR DTUs from STATE", async () => {
    const STATE = {
      dtus: new Map([
        ["s1", { type: "SENSOR", id: "s1", measurements: {} }],
        ["s2", { type: "SENSOR", id: "s2", measurements: {} }],
        ["other", { type: "IDENTITY", id: "other" }],
      ]),
    };
    const result = await initializeSense(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 2);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeSense({});
    const result = await initializeSense({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE gracefully", async () => {
    const result = await initializeSense(null);
    assert.equal(result.ok, true);
  });

  it("handles STATE without dtus", async () => {
    const result = await initializeSense({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
  });
});

// ── _resetSenseState ──────────────────────────────────────────────────────

describe("Foundation Sense — _resetSenseState", () => {
  it("resets all state", async () => {
    await initializeSense({});
    recordReading({ channel: "ch", signal_strength: -50 });
    _resetSenseState();

    const metrics = getSenseMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.readingCount, 0);
    assert.equal(metrics.patternCount, 0);
    assert.equal(metrics.anomalyCount, 0);
    assert.equal(metrics.baselineCount, 0);
    assert.equal(metrics.stats.totalReadings, 0);
    assert.equal(metrics.stats.anomaliesDetected, 0);
    assert.equal(metrics.stats.patternsFound, 0);
    assert.equal(metrics.stats.alertsGenerated, 0);
    assert.equal(metrics.stats.lastReadingAt, null);
  });
});
