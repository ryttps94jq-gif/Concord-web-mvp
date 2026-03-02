/**
 * Foundation Energy — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (subtypes, grid nominal frequency, health thresholds)
 *   - createEnergyDTU (happy path, grid health classification, anomaly detection)
 *   - recordEnergyReading (null handling, grid map updates, stat tracking)
 *   - getEnergyMap / getGridHealth
 *   - Metrics getters
 *   - initializeEnergy (indexing, double-init)
 *   - _resetEnergyState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  ENERGY_SUBTYPES,
  GRID_NOMINAL_FREQUENCY,
  GRID_HEALTH_THRESHOLDS,
  createEnergyDTU,
  recordEnergyReading,
  getEnergyMap,
  getGridHealth,
  getEnergyMetrics,
  getRecentEnergyReadings,
  initializeEnergy,
  _resetEnergyState,
} from "../lib/foundation-energy.js";

beforeEach(() => {
  _resetEnergyState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Energy — Constants", () => {
  it("defines 5 energy subtypes", () => {
    assert.equal(ENERGY_SUBTYPES.length, 5);
    assert.ok(ENERGY_SUBTYPES.includes("grid"));
    assert.ok(ENERGY_SUBTYPES.includes("renewable"));
    assert.ok(ENERGY_SUBTYPES.includes("waste"));
    assert.ok(ENERGY_SUBTYPES.includes("storage"));
    assert.ok(ENERGY_SUBTYPES.includes("demand"));
  });

  it("defines nominal frequencies", () => {
    assert.equal(GRID_NOMINAL_FREQUENCY.HZ_50, 50.0);
    assert.equal(GRID_NOMINAL_FREQUENCY.HZ_60, 60.0);
  });

  it("defines health thresholds", () => {
    assert.equal(GRID_HEALTH_THRESHOLDS.NORMAL, 0.05);
    assert.equal(GRID_HEALTH_THRESHOLDS.WARNING, 0.2);
    assert.equal(GRID_HEALTH_THRESHOLDS.CRITICAL, 0.5);
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(ENERGY_SUBTYPES), true);
    assert.equal(Object.isFrozen(GRID_NOMINAL_FREQUENCY), true);
    assert.equal(Object.isFrozen(GRID_HEALTH_THRESHOLDS), true);
  });
});

// ── createEnergyDTU ──────────────────────────────────────────────────────

describe("Foundation Energy — createEnergyDTU", () => {
  it("creates DTU with valid subtype", () => {
    const dtu = createEnergyDTU({ subtype: "renewable" });
    assert.match(dtu.id, /^energy_/);
    assert.equal(dtu.type, "ENERGY");
    assert.equal(dtu.subtype, "renewable");
    assert.ok(dtu.tags.includes("energy"));
    assert.ok(dtu.tags.includes("renewable"));
  });

  it("defaults to grid subtype for invalid input", () => {
    const dtu = createEnergyDTU({ subtype: "invalid" });
    assert.equal(dtu.subtype, "grid");
  });

  it("classifies normal grid health (deviation < 0.05)", () => {
    const dtu = createEnergyDTU({ frequency: 60.01, nominalFrequency: 60.0 });
    assert.equal(dtu.grid_health.load_estimate, "normal");
    assert.equal(dtu.grid_health.anomaly_detected, false);
    assert.equal(dtu.scope, "local");
    assert.equal(dtu.crpiScore, 0.2);
  });

  it("classifies elevated grid health (deviation > 0.05)", () => {
    const dtu = createEnergyDTU({ frequency: 60.1, nominalFrequency: 60.0 });
    assert.equal(dtu.grid_health.load_estimate, "elevated");
    assert.equal(dtu.grid_health.anomaly_detected, false);
  });

  it("classifies stressed grid health (deviation > 0.2)", () => {
    const dtu = createEnergyDTU({ frequency: 60.3, nominalFrequency: 60.0 });
    assert.equal(dtu.grid_health.load_estimate, "stressed");
    assert.equal(dtu.grid_health.anomaly_detected, true);
    assert.equal(dtu.scope, "global");
    assert.equal(dtu.crpiScore, 0.6);
  });

  it("classifies critical grid health (deviation > 0.5)", () => {
    const dtu = createEnergyDTU({ frequency: 60.7, nominalFrequency: 60.0 });
    assert.equal(dtu.grid_health.load_estimate, "critical");
    assert.equal(dtu.grid_health.anomaly_detected, true);
    assert.equal(dtu.scope, "global");
  });

  it("uses HZ_60 as default nominal frequency", () => {
    const dtu = createEnergyDTU({ frequency: 60.0 });
    assert.equal(dtu.grid_health.deviation_from_nominal, 0);
    assert.equal(dtu.grid_health.load_estimate, "normal");
  });

  it("supports HZ_50 nominal frequency", () => {
    const dtu = createEnergyDTU({ frequency: 50.3, nominalFrequency: 50.0 });
    assert.ok(dtu.grid_health.deviation_from_nominal > 0.2);
    assert.equal(dtu.grid_health.load_estimate, "stressed");
  });

  it("calculates stability_score (1 - deviation)", () => {
    const dtu = createEnergyDTU({ frequency: 60.3, nominalFrequency: 60.0 });
    assert.ok(dtu.measurements.stability_score >= 0);
    assert.ok(dtu.measurements.stability_score <= 1);
    assert.ok(Math.abs(dtu.measurements.stability_score - 0.7) < 0.01);
  });

  it("clamps stability_score between 0 and 1", () => {
    const dtu = createEnergyDTU({ frequency: 62.0, nominalFrequency: 60.0 }); // deviation 2.0
    assert.equal(dtu.measurements.stability_score, 0);
  });

  it("sets measurement fields from opts", () => {
    const dtu = createEnergyDTU({
      frequency: 59.98,
      harmonics: [120, 180],
      power_estimate: 500,
      efficiency_estimate: 0.85,
      harmonic_distortion: 0.02,
    });
    assert.equal(dtu.measurements.frequency, 59.98);
    assert.deepEqual(dtu.measurements.harmonics, [120, 180]);
    assert.equal(dtu.measurements.power_estimate, 500);
    assert.equal(dtu.measurements.efficiency_estimate, 0.85);
    assert.equal(dtu.grid_health.harmonic_distortion, 0.02);
  });

  it("defaults optional measurements", () => {
    const dtu = createEnergyDTU({});
    assert.deepEqual(dtu.measurements.harmonics, []);
    assert.equal(dtu.measurements.power_estimate, null);
    assert.equal(dtu.measurements.efficiency_estimate, null);
    assert.equal(dtu.grid_health.harmonic_distortion, null);
  });

  it("sets location and coverage_radius", () => {
    const dtu = createEnergyDTU({ location: { lat: 52.37, lng: 4.90 }, coverage_radius: 5 });
    assert.deepEqual(dtu.location, { lat: 52.37, lng: 4.90 });
    assert.equal(dtu.coverage_radius, 5);
  });
});

// ── recordEnergyReading ──────────────────────────────────────────────────

describe("Foundation Energy — recordEnergyReading", () => {
  it("returns null for null data", () => {
    assert.equal(recordEnergyReading(null), null);
  });

  it("records reading and increments stats", () => {
    const reading = recordEnergyReading({ frequency: 60.0 });
    assert.notEqual(reading, null);
    const metrics = getEnergyMetrics();
    assert.equal(metrics.stats.totalReadings, 1);
    assert.notEqual(metrics.stats.lastReadingAt, null);
  });

  it("updates grid map with location data", () => {
    recordEnergyReading({ frequency: 60.0, location: { lat: 52.37, lng: 4.90 } });
    const map = getEnergyMap();
    assert.equal(map.length, 1);
    assert.deepEqual(map[0].location, { lat: 52.37, lng: 4.90 });
  });

  it("does not update grid map without location", () => {
    recordEnergyReading({ frequency: 60.0 });
    const map = getEnergyMap();
    assert.equal(map.length, 0);
  });

  it("tracks grid anomalies", () => {
    recordEnergyReading({ frequency: 60.7, nominalFrequency: 60.0 }); // critical
    const metrics = getEnergyMetrics();
    assert.equal(metrics.stats.gridAnomalies, 1);
  });

  it("tracks renewable detections", () => {
    recordEnergyReading({ subtype: "renewable", frequency: 60.0 });
    const metrics = getEnergyMetrics();
    assert.equal(metrics.stats.renewableDetections, 1);
  });

  it("tracks waste detections", () => {
    recordEnergyReading({ subtype: "waste", frequency: 60.0 });
    const metrics = getEnergyMetrics();
    assert.equal(metrics.stats.wasteDetections, 1);
  });

  it("stores in STATE when provided", () => {
    const STATE = { dtus: new Map() };
    const reading = recordEnergyReading({ frequency: 60.0 }, STATE);
    assert.ok(STATE.dtus.has(reading.id));
  });

  it("trims readings at 1000 (keeps 800)", () => {
    for (let i = 0; i < 1010; i++) {
      recordEnergyReading({ frequency: 60.0 });
    }
    const readings = getRecentEnergyReadings(2000);
    assert.ok(readings.length <= 800);
  });
});

// ── getEnergyMap / getGridHealth ──────────────────────────────────────────

describe("Foundation Energy — Energy Map and Grid Health", () => {
  it("getEnergyMap returns empty initially", () => {
    assert.deepEqual(getEnergyMap(), []);
  });

  it("getEnergyMap returns entries with location data", () => {
    recordEnergyReading({ frequency: 60.0, location: { lat: 52.37, lng: 4.90 } });
    recordEnergyReading({ frequency: 60.0, location: { lat: 53.37, lng: 5.90 } });
    const map = getEnergyMap();
    assert.equal(map.length, 2);
  });

  it("getGridHealth returns normal when all readings are normal", () => {
    recordEnergyReading({ frequency: 60.0, location: { lat: 52.37, lng: 4.90 } });
    const health = getGridHealth();
    assert.equal(health.overallHealth, "normal");
    assert.equal(health.totalStations, 1);
    assert.equal(health.healthDistribution.normal, 1);
  });

  it("getGridHealth returns critical when any station is critical", () => {
    recordEnergyReading({ frequency: 60.0, location: { lat: 52.37, lng: 4.90 } });
    recordEnergyReading({ frequency: 60.7, nominalFrequency: 60.0, location: { lat: 53.37, lng: 5.90 } });
    const health = getGridHealth();
    assert.equal(health.overallHealth, "critical");
    assert.equal(health.healthDistribution.critical, 1);
  });

  it("getGridHealth returns stressed when worst is stressed", () => {
    recordEnergyReading({ frequency: 60.0, location: { lat: 52.37, lng: 4.90 } });
    recordEnergyReading({ frequency: 60.3, nominalFrequency: 60.0, location: { lat: 53.37, lng: 5.90 } });
    const health = getGridHealth();
    assert.equal(health.overallHealth, "stressed");
  });

  it("getGridHealth returns elevated when worst is elevated", () => {
    recordEnergyReading({ frequency: 60.1, nominalFrequency: 60.0, location: { lat: 52.37, lng: 4.90 } });
    const health = getGridHealth();
    assert.equal(health.overallHealth, "elevated");
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Energy — Metrics", () => {
  it("returns initial metrics", () => {
    const metrics = getEnergyMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.readingCount, 0);
    assert.equal(metrics.gridMapSize, 0);
    assert.ok(metrics.uptime >= 0);
  });

  it("getRecentEnergyReadings limits results", () => {
    for (let i = 0; i < 10; i++) {
      recordEnergyReading({ frequency: 60.0 });
    }
    const recent = getRecentEnergyReadings(5);
    assert.equal(recent.length, 5);
  });

  it("getRecentEnergyReadings defaults to 50", () => {
    for (let i = 0; i < 60; i++) {
      recordEnergyReading({ frequency: 60.0 });
    }
    const recent = getRecentEnergyReadings();
    assert.equal(recent.length, 50);
  });
});

// ── initializeEnergy ──────────────────────────────────────────────────────

describe("Foundation Energy — initializeEnergy", () => {
  it("initializes successfully", async () => {
    const result = await initializeEnergy({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    const metrics = getEnergyMetrics();
    assert.equal(metrics.initialized, true);
  });

  it("indexes ENERGY DTUs from STATE", async () => {
    const STATE = {
      dtus: new Map([
        ["e1", { type: "ENERGY", id: "e1" }],
        ["e2", { type: "ENERGY", id: "e2" }],
        ["other", { type: "SENSOR", id: "other" }],
      ]),
    };
    const result = await initializeEnergy(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 2);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeEnergy({});
    const result = await initializeEnergy({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE", async () => {
    const result = await initializeEnergy(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetEnergyState ──────────────────────────────────────────────────────

describe("Foundation Energy — _resetEnergyState", () => {
  it("resets all state", async () => {
    await initializeEnergy({});
    recordEnergyReading({ frequency: 60.0, location: { lat: 52.37, lng: 4.90 } });
    _resetEnergyState();

    const metrics = getEnergyMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.readingCount, 0);
    assert.equal(metrics.gridMapSize, 0);
    assert.equal(metrics.stats.totalReadings, 0);
    assert.equal(metrics.stats.gridAnomalies, 0);
    assert.equal(metrics.stats.renewableDetections, 0);
    assert.equal(metrics.stats.wasteDetections, 0);
    assert.equal(metrics.stats.lastReadingAt, null);
  });
});
