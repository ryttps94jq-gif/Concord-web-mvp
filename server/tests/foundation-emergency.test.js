/**
 * Foundation Emergency — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (subtypes, severity levels, offline cache categories)
 *   - createEmergencyDTU (subtypes, severity clamping, content fields)
 *   - triggerEmergency (null handling, emergency mode activation, STATE integration)
 *   - reportNodeStatus / getCoordinationStatus
 *   - resolveEmergency
 *   - Offline knowledge cache (add, get)
 *   - Metrics getters
 *   - initializeEmergency (indexing, double-init)
 *   - _resetEmergencyState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  EMERGENCY_SUBTYPES,
  EMERGENCY_SEVERITY,
  OFFLINE_CACHE_CATEGORIES,
  createEmergencyDTU,
  triggerEmergency,
  reportNodeStatus,
  getCoordinationStatus,
  resolveEmergency,
  addToOfflineCache,
  getOfflineCache,
  getEmergencyMetrics,
  getActiveEmergencies,
  getRecentAlerts,
  getEmergencyStatus,
  initializeEmergency,
  _resetEmergencyState,
} from "../lib/foundation-emergency.js";

beforeEach(() => {
  _resetEmergencyState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Emergency — Constants", () => {
  it("defines 6 emergency subtypes", () => {
    assert.equal(EMERGENCY_SUBTYPES.length, 6);
    assert.ok(EMERGENCY_SUBTYPES.includes("alert"));
    assert.ok(EMERGENCY_SUBTYPES.includes("status"));
    assert.ok(EMERGENCY_SUBTYPES.includes("resource"));
    assert.ok(EMERGENCY_SUBTYPES.includes("medical"));
    assert.ok(EMERGENCY_SUBTYPES.includes("coordination"));
    assert.ok(EMERGENCY_SUBTYPES.includes("evacuation"));
  });

  it("defines severity levels with correct ranges", () => {
    assert.deepEqual(EMERGENCY_SEVERITY.ADVISORY, { min: 1, max: 3 });
    assert.deepEqual(EMERGENCY_SEVERITY.WARNING, { min: 4, max: 6 });
    assert.deepEqual(EMERGENCY_SEVERITY.EMERGENCY, { min: 7, max: 8 });
    assert.deepEqual(EMERGENCY_SEVERITY.CRITICAL, { min: 9, max: 10 });
  });

  it("defines 6 offline cache categories", () => {
    assert.equal(OFFLINE_CACHE_CATEGORIES.length, 6);
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("medical_procedures"));
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("first_aid"));
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("water_purification"));
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("shelter_construction"));
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("navigation"));
    assert.ok(OFFLINE_CACHE_CATEGORIES.includes("radio_communication"));
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(EMERGENCY_SUBTYPES), true);
    assert.equal(Object.isFrozen(EMERGENCY_SEVERITY), true);
    assert.equal(Object.isFrozen(OFFLINE_CACHE_CATEGORIES), true);
  });
});

// ── createEmergencyDTU ──────────────────────────────────────────────────────

describe("Foundation Emergency — createEmergencyDTU", () => {
  it("creates DTU with valid subtype", () => {
    const dtu = createEmergencyDTU({ subtype: "medical", severity: 7 });
    assert.match(dtu.id, /^emg_/);
    assert.equal(dtu.type, "EMERGENCY");
    assert.equal(dtu.subtype, "medical");
    assert.equal(dtu.severity, 7);
    assert.ok(dtu.tags.includes("emergency"));
    assert.ok(dtu.tags.includes("medical"));
    assert.ok(dtu.tags.includes("pain_memory"));
    assert.equal(dtu.scope, "global");
    assert.equal(dtu.relay_count, 0);
  });

  it("defaults to alert subtype for invalid subtype", () => {
    const dtu = createEmergencyDTU({ subtype: "invalid_subtype" });
    assert.equal(dtu.subtype, "alert");
  });

  it("clamps severity between 1 and 10", () => {
    const lowDtu = createEmergencyDTU({ severity: -5 });
    assert.equal(lowDtu.severity, 1);

    const highDtu = createEmergencyDTU({ severity: 100 });
    assert.equal(highDtu.severity, 10);
  });

  it("defaults severity to 5", () => {
    const dtu = createEmergencyDTU({});
    assert.equal(dtu.severity, 5);
  });

  it("calculates crpiScore from severity (clamped 0.5-1.0)", () => {
    const lowDtu = createEmergencyDTU({ severity: 1 });
    assert.equal(lowDtu.crpiScore, 0.5);

    const highDtu = createEmergencyDTU({ severity: 10 });
    assert.equal(highDtu.crpiScore, 1.0);
  });

  it("sets content fields from opts", () => {
    const dtu = createEmergencyDTU({
      situation: "Earthquake detected",
      resources_available: { water: 100 },
      resources_needed: { blankets: 50 },
      shelter_locations: [{ lat: 52.37, lng: 4.90 }],
      medical_info: { casualties: 5 },
      evacuation_routes: [{ route: "Highway A10" }],
    });
    assert.equal(dtu.content.situation, "Earthquake detected");
    assert.deepEqual(dtu.content.resources_available, { water: 100 });
    assert.deepEqual(dtu.content.resources_needed, { blankets: 50 });
    assert.equal(dtu.content.shelter_locations.length, 1);
    assert.equal(dtu.content.evacuation_routes.length, 1);
  });

  it("defaults content fields to empty", () => {
    const dtu = createEmergencyDTU({});
    assert.equal(dtu.content.situation, "");
    assert.deepEqual(dtu.content.resources_available, {});
    assert.deepEqual(dtu.content.resources_needed, {});
    assert.deepEqual(dtu.content.shelter_locations, []);
    assert.deepEqual(dtu.content.medical_info, {});
    assert.deepEqual(dtu.content.evacuation_routes, []);
  });

  it("sets verified and source fields", () => {
    const dtu = createEmergencyDTU({ verified: true, source: "test-source", source_node: "node_X" });
    assert.equal(dtu.verified, true);
    assert.equal(dtu.source, "test-source");
    assert.equal(dtu.source_node, "node_X");
  });

  it("defaults verified to false", () => {
    const dtu = createEmergencyDTU({});
    assert.equal(dtu.verified, false);
  });
});

// ── triggerEmergency ──────────────────────────────────────────────────────

describe("Foundation Emergency — triggerEmergency", () => {
  it("returns error for null data", () => {
    const result = triggerEmergency(null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_data");
  });

  it("triggers emergency with default severity 7", () => {
    const result = triggerEmergency({ situation: "Flood" });
    assert.equal(result.ok, true);
    assert.notEqual(result.emergency, undefined);
    assert.equal(result.emergency.severity, 7);
    assert.match(result.emergency.id, /^emg_/);
  });

  it("activates emergency mode for severity >= 7", () => {
    const result = triggerEmergency({ situation: "Major earthquake", severity: 8 });
    assert.equal(result.ok, true);
    assert.equal(result.emergencyMode, true);
    const metrics = getEmergencyMetrics();
    assert.equal(metrics.emergencyMode, true);
    assert.equal(metrics.stats.emergencyModeActivations, 1);
  });

  it("does not activate emergency mode for severity < 7", () => {
    const result = triggerEmergency({ situation: "Minor tremor", severity: 3 });
    assert.equal(result.ok, true);
    assert.equal(result.emergencyMode, false);
    const metrics = getEmergencyMetrics();
    assert.equal(metrics.emergencyMode, false);
  });

  it("adds to active emergencies and alerts", () => {
    triggerEmergency({ situation: "Test" });
    const metrics = getEmergencyMetrics();
    assert.equal(metrics.activeEmergencies, 1);
    assert.equal(metrics.alertCount, 1);
    assert.equal(metrics.stats.totalAlerts, 1);
  });

  it("tracks affected areas", () => {
    triggerEmergency({ situation: "Test", affected_area: { lat: 52.37, lng: 4.90, radius: 10 } });
    const status = getEmergencyStatus();
    assert.equal(status.affectedAreas.length, 1);
    assert.deepEqual(status.affectedAreas[0], { lat: 52.37, lng: 4.90, radius: 10 });
  });

  it("stores DTU in STATE when provided", () => {
    const STATE = { dtus: new Map() };
    const result = triggerEmergency({ situation: "Test" }, STATE);
    assert.ok(STATE.dtus.has(result.emergency.id));
  });

  it("trims alerts at 200 (keeps 150)", () => {
    for (let i = 0; i < 210; i++) {
      triggerEmergency({ situation: `Alert ${i}`, severity: 3 });
    }
    const metrics = getEmergencyMetrics();
    assert.ok(metrics.alertCount <= 160); // May be slightly over 150 due to trimming logic
    assert.equal(metrics.stats.totalAlerts, 210);
  });
});

// ── reportNodeStatus / getCoordinationStatus ───────────────────────────────

describe("Foundation Emergency — Coordination", () => {
  it("returns null for missing nodeId", () => {
    assert.equal(reportNodeStatus(null, {}), null);
    assert.equal(reportNodeStatus("", {}), null);
  });

  it("reports node status", () => {
    const entry = reportNodeStatus("node_A", {
      powerLevel: 85,
      personnelCount: 12,
      resources: { water: 50 },
      medicalNeeds: ["bandages"],
    });
    assert.notEqual(entry, null);
    assert.equal(entry.nodeId, "node_A");
    assert.equal(entry.powerLevel, 85);
    assert.equal(entry.personnelCount, 12);
    assert.deepEqual(entry.resources, { water: 50 });
    assert.deepEqual(entry.medicalNeeds, ["bandages"]);
    assert.ok(entry.reportedAt);
  });

  it("updates existing node status", () => {
    reportNodeStatus("node_B", { powerLevel: 90 });
    reportNodeStatus("node_B", { powerLevel: 50 });
    const status = getCoordinationStatus();
    assert.equal(status.totalNodes, 1);
    assert.equal(status.nodes[0].powerLevel, 50);
  });

  it("defaults optional fields", () => {
    const entry = reportNodeStatus("node_C", {});
    assert.equal(entry.powerLevel, null);
    assert.equal(entry.personnelCount, null);
    assert.deepEqual(entry.resources, {});
    assert.deepEqual(entry.medicalNeeds, []);
  });

  it("getCoordinationStatus returns correct data", () => {
    reportNodeStatus("n1", { powerLevel: 90 });
    reportNodeStatus("n2", { powerLevel: 60 });
    triggerEmergency({ situation: "Test", severity: 8 });

    const status = getCoordinationStatus();
    assert.equal(status.totalNodes, 2);
    assert.equal(status.emergencyMode, true);
    assert.equal(status.activeEmergencies, 1);
  });

  it("getCoordinationStatus limits nodes to 100", () => {
    for (let i = 0; i < 110; i++) {
      reportNodeStatus(`node_${i}`, { powerLevel: 50 });
    }
    const status = getCoordinationStatus();
    assert.equal(status.totalNodes, 110);
    assert.equal(status.nodes.length, 100);
  });
});

// ── resolveEmergency ──────────────────────────────────────────────────────

describe("Foundation Emergency — resolveEmergency", () => {
  it("resolves an active emergency", () => {
    const triggered = triggerEmergency({ situation: "Flood", severity: 8 });
    const emergencyId = triggered.emergency.id;

    const result = resolveEmergency(emergencyId);
    assert.equal(result.ok, true);
    assert.equal(result.resolved, emergencyId);

    const metrics = getEmergencyMetrics();
    assert.equal(metrics.activeEmergencies, 0);
  });

  it("returns error for non-existent emergency", () => {
    const result = resolveEmergency("nonexistent_id");
    assert.equal(result.ok, false);
    assert.equal(result.error, "not_found");
  });

  it("deactivates emergency mode when last emergency is resolved", () => {
    const e1 = triggerEmergency({ situation: "Quake", severity: 8 });
    const e2 = triggerEmergency({ situation: "Flood", severity: 9 });
    assert.equal(getEmergencyMetrics().emergencyMode, true);

    resolveEmergency(e1.emergency.id);
    assert.equal(getEmergencyMetrics().emergencyMode, true); // e2 still active

    resolveEmergency(e2.emergency.id);
    assert.equal(getEmergencyMetrics().emergencyMode, false);
  });

  it("getActiveEmergencies reflects resolved state", () => {
    const e1 = triggerEmergency({ situation: "Test" });
    assert.equal(getActiveEmergencies().length, 1);

    resolveEmergency(e1.emergency.id);
    assert.equal(getActiveEmergencies().length, 0);
  });
});

// ── Offline Knowledge Cache ──────────────────────────────────────────────

describe("Foundation Emergency — Offline Cache", () => {
  it("adds item to cache", () => {
    const result = addToOfflineCache("first_aid", { id: "doc1", content: "First aid basics" });
    assert.equal(result, true);
  });

  it("returns false for missing category", () => {
    assert.equal(addToOfflineCache(null, { id: "doc1" }), false);
    assert.equal(addToOfflineCache("", { id: "doc1" }), false);
  });

  it("returns false for missing dtu", () => {
    assert.equal(addToOfflineCache("first_aid", null), false);
    assert.equal(addToOfflineCache("first_aid", undefined), false);
  });

  it("retrieves items by category", () => {
    addToOfflineCache("navigation", { id: "nav1" });
    addToOfflineCache("navigation", { id: "nav2" });
    const items = getOfflineCache("navigation");
    assert.equal(items.length, 2);
  });

  it("returns empty array for unknown category", () => {
    assert.deepEqual(getOfflineCache("unknown_cat"), []);
  });

  it("returns category counts when no category specified", () => {
    addToOfflineCache("first_aid", { id: "doc1" });
    addToOfflineCache("first_aid", { id: "doc2" });
    addToOfflineCache("navigation", { id: "nav1" });
    const all = getOfflineCache();
    assert.equal(all.first_aid, 2);
    assert.equal(all.navigation, 1);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Emergency — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getEmergencyMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.emergencyMode, false);
    assert.equal(metrics.activeEmergencies, 0);
    assert.equal(metrics.alertCount, 0);
    assert.equal(metrics.coordinatedNodes, 0);
    assert.equal(metrics.stats.totalAlerts, 0);
    assert.ok(metrics.uptime >= 0);
  });

  it("getRecentAlerts returns limited results", () => {
    for (let i = 0; i < 10; i++) {
      triggerEmergency({ situation: `Test ${i}`, severity: 3 });
    }
    const alerts = getRecentAlerts(5);
    assert.equal(alerts.length, 5);
  });

  it("getRecentAlerts defaults to 50", () => {
    for (let i = 0; i < 60; i++) {
      triggerEmergency({ situation: `Test ${i}`, severity: 3 });
    }
    const alerts = getRecentAlerts();
    assert.equal(alerts.length, 50);
  });

  it("getEmergencyStatus returns correct structure", () => {
    const status = getEmergencyStatus();
    assert.equal(status.emergencyMode, false);
    assert.equal(status.activeCount, 0);
    assert.ok(Array.isArray(status.affectedAreas));
    assert.equal(status.coordinatedNodes, 0);
  });
});

// ── initializeEmergency ──────────────────────────────────────────────────

describe("Foundation Emergency — initializeEmergency", () => {
  it("initializes successfully", async () => {
    const result = await initializeEmergency({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    const metrics = getEmergencyMetrics();
    assert.equal(metrics.initialized, true);
  });

  it("indexes EMERGENCY DTUs from STATE", async () => {
    const STATE = {
      dtus: new Map([
        ["e1", { type: "EMERGENCY", id: "e1" }],
        ["e2", { type: "EMERGENCY", id: "e2" }],
        ["other", { type: "SENSOR", id: "other" }],
      ]),
    };
    const result = await initializeEmergency(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 2);
  });

  it("pre-populates offline cache categories on init", async () => {
    await initializeEmergency({});
    const metrics = getEmergencyMetrics();
    assert.equal(metrics.offlineCacheCategories, OFFLINE_CACHE_CATEGORIES.length);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeEmergency({});
    const result = await initializeEmergency({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE gracefully", async () => {
    const result = await initializeEmergency(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetEmergencyState ──────────────────────────────────────────────────

describe("Foundation Emergency — _resetEmergencyState", () => {
  it("resets all state", async () => {
    await initializeEmergency({});
    triggerEmergency({ situation: "Test", severity: 9 });
    reportNodeStatus("node1", { powerLevel: 80 });
    addToOfflineCache("first_aid", { id: "doc1" });
    _resetEmergencyState();

    const metrics = getEmergencyMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.emergencyMode, false);
    assert.equal(metrics.activeEmergencies, 0);
    assert.equal(metrics.alertCount, 0);
    assert.equal(metrics.coordinatedNodes, 0);
    assert.equal(metrics.offlineCacheCategories, 0);
    assert.equal(metrics.stats.totalAlerts, 0);
    assert.equal(metrics.stats.emergencyModeActivations, 0);
    assert.equal(metrics.stats.nodesCoordinated, 0);
    assert.equal(metrics.stats.lastAlertAt, null);
  });
});
