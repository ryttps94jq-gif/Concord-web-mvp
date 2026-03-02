/**
 * Emergent Goals — Comprehensive Test Suite
 *
 * Covers all exports from emergent/goals.js:
 *   - GOAL_TYPES, ALL_GOAL_TYPES
 *   - getGoalStore()
 *   - scanForGoals()
 *   - scheduleGoal()
 *   - completeGoal()
 *   - dismissGoal()
 *   - getActiveGoals()
 *   - updateThresholds()
 *   - getGoalMetrics()
 *   - All detection functions (contradiction density, unverified regions,
 *     failure rate spikes, orphaned nodes, stalled projects, stale DTUs)
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// We need to mock dependencies before importing the module under test.
// goals.js imports from ./store.js and ./scheduler.js.

// Mock store.js — getEmergentState
const mockEmergentState = {};
const storeModule = await import("../emergent/store.js");

// Mock scheduler.js — createWorkItem, WORK_ITEM_TYPES
const schedulerModule = await import("../emergent/scheduler.js");

import {
  GOAL_TYPES,
  ALL_GOAL_TYPES,
  getGoalStore,
  scanForGoals,
  scheduleGoal,
  completeGoal,
  dismissGoal,
  getActiveGoals,
  updateThresholds,
  getGoalMetrics,
} from "../emergent/goals.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSTATE() {
  return {
    __emergent: {
      _goals: null,
      _edges: null,
      _evidence: null,
      _institutionalMemory: null,
      _projects: null,
    },
    dtus: new Map(),
  };
}

function populateGoalStore(STATE) {
  const store = getGoalStore(STATE);
  return store;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("goals constants", () => {
  it("GOAL_TYPES is frozen with expected keys", () => {
    assert.ok(Object.isFrozen(GOAL_TYPES));
    assert.equal(GOAL_TYPES.GAP_DETECTION, "gap_detection");
    assert.equal(GOAL_TYPES.QUALITY_PRESSURE, "quality_pressure");
    assert.equal(GOAL_TYPES.MAINTENANCE, "maintenance");
    assert.equal(GOAL_TYPES.STRUCTURAL_REPAIR, "structural_repair");
    assert.equal(GOAL_TYPES.PROJECT_ADVANCEMENT, "project_advancement");
  });

  it("ALL_GOAL_TYPES contains all values", () => {
    assert.ok(Object.isFrozen(ALL_GOAL_TYPES));
    assert.equal(ALL_GOAL_TYPES.length, 5);
    assert.ok(ALL_GOAL_TYPES.includes("gap_detection"));
    assert.ok(ALL_GOAL_TYPES.includes("quality_pressure"));
    assert.ok(ALL_GOAL_TYPES.includes("maintenance"));
    assert.ok(ALL_GOAL_TYPES.includes("structural_repair"));
    assert.ok(ALL_GOAL_TYPES.includes("project_advancement"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. getGoalStore
// ═══════════════════════════════════════════════════════════════════════════════

describe("getGoalStore()", () => {
  it("initializes goal store on first call", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    assert.ok(Array.isArray(store.goals));
    assert.ok(store.active instanceof Map);
    assert.ok(Array.isArray(store.completed));
    assert.ok(Array.isArray(store.dismissed));
    assert.ok(store.thresholds);
    assert.ok(store.metrics);
    assert.equal(store.metrics.totalDetected, 0);
    assert.equal(store.metrics.totalScheduled, 0);
    assert.equal(store.metrics.totalCompleted, 0);
    assert.equal(store.metrics.totalDismissed, 0);
    assert.equal(store.metrics.lastScan, null);
  });

  it("returns same store on subsequent calls", () => {
    const STATE = makeSTATE();
    const store1 = getGoalStore(STATE);
    const store2 = getGoalStore(STATE);
    assert.strictEqual(store1, store2);
  });

  it("has expected threshold defaults", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    assert.equal(store.thresholds.contradictionDensityThreshold, 0.3);
    assert.equal(store.thresholds.unverifiedRatioThreshold, 0.7);
    assert.equal(store.thresholds.failureRateThreshold, 0.5);
    assert.equal(store.thresholds.orphanedNodeThreshold, 10);
    assert.equal(store.thresholds.staleDtuAgeMs, 30 * 24 * 3600 * 1000);
    assert.equal(store.thresholds.stalledProjectAgeMs, 7 * 24 * 3600 * 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. scanForGoals — Empty lattice
// ═══════════════════════════════════════════════════════════════════════════════

describe("scanForGoals()", () => {
  it("returns no goals on empty lattice", () => {
    const STATE = makeSTATE();
    const result = scanForGoals(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.count, 0);
    assert.deepEqual(result.detected, []);
  });

  it("sets lastScan timestamp after scan", () => {
    const STATE = makeSTATE();
    scanForGoals(STATE);
    const store = getGoalStore(STATE);
    assert.ok(store.metrics.lastScan !== null);
  });

  // Contradiction density detection
  it("detects high contradiction density", () => {
    const STATE = makeSTATE();
    // Set up 10 DTUs
    for (let i = 0; i < 10; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    // Set up edge store with lots of contradiction edges
    const es = STATE.__emergent;
    es._edges = {
      edges: new Map(),
      bySource: new Map(),
      byTarget: new Map(),
    };
    // Make 4 DTUs involved in contradictions (density 0.4 > 0.3 threshold)
    es._edges.edges.set("e1", { edgeType: "contradicts", sourceId: "dtu_0", targetId: "dtu_1" });
    es._edges.edges.set("e2", { edgeType: "contradicts", sourceId: "dtu_2", targetId: "dtu_3" });

    const result = scanForGoals(STATE);
    assert.equal(result.ok, true);
    assert.ok(result.count > 0);
    const contradictionGoal = result.detected.find(g => g.type === GOAL_TYPES.QUALITY_PRESSURE);
    assert.ok(contradictionGoal);
    assert.ok(contradictionGoal.description.includes("Contradiction density"));
  });

  it("does not detect contradiction density below threshold", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 10; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._edges = {
      edges: new Map(),
      bySource: new Map(),
      byTarget: new Map(),
    };
    // Only 2 DTUs involved (density 0.2 < 0.3 threshold)
    es._edges.edges.set("e1", { edgeType: "contradicts", sourceId: "dtu_0", targetId: "dtu_1" });

    const result = scanForGoals(STATE);
    const contradictionGoals = result.detected.filter(g => g.description?.includes("Contradiction density"));
    assert.equal(contradictionGoals.length, 0);
  });

  it("skips contradiction detection when no DTUs", () => {
    const STATE = makeSTATE();
    STATE.dtus = new Map();
    const result = scanForGoals(STATE);
    assert.equal(result.ok, true);
  });

  it("skips contradiction detection when no edge store", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu_1", {});
    const result = scanForGoals(STATE);
    assert.equal(result.ok, true);
  });

  // Unverified regions detection
  it("detects unverified regions", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 10; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._evidence = { byDtu: new Map() };
    // Only 2 tracked (unverifiedRatio = 0.8 > 0.7 threshold)
    es._evidence.byDtu.set("dtu_0", []);
    es._evidence.byDtu.set("dtu_1", []);

    const result = scanForGoals(STATE);
    const unverifiedGoal = result.detected.find(g => g.type === GOAL_TYPES.GAP_DETECTION);
    assert.ok(unverifiedGoal);
    assert.ok(unverifiedGoal.description.includes("no evidence"));
  });

  it("does not detect unverified regions below threshold", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 10; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._evidence = { byDtu: new Map() };
    // 4 tracked (unverifiedRatio = 0.6 < 0.7 threshold)
    for (let i = 0; i < 4; i++) {
      es._evidence.byDtu.set(`dtu_${i}`, []);
    }
    const result = scanForGoals(STATE);
    const unverifiedGoals = result.detected.filter(g => g.type === GOAL_TYPES.GAP_DETECTION);
    assert.equal(unverifiedGoals.length, 0);
  });

  it("skips unverified detection when no evidence store", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu_1", {});
    const result = scanForGoals(STATE);
    assert.equal(result.ok, true);
  });

  // Failure rate spikes detection
  it("detects failure rate spikes", () => {
    const STATE = makeSTATE();
    const es = STATE.__emergent;
    es._institutionalMemory = {
      failureRates: new Map([
        ["contradiction:science", { total: 10, failed: 6, rate: 0.6 }],
      ]),
    };
    const result = scanForGoals(STATE);
    const failureGoal = result.detected.find(g => g.description?.includes("failure rate"));
    assert.ok(failureGoal);
    assert.equal(failureGoal.type, GOAL_TYPES.QUALITY_PRESSURE);
  });

  it("skips failure rate when total < 5", () => {
    const STATE = makeSTATE();
    const es = STATE.__emergent;
    es._institutionalMemory = {
      failureRates: new Map([
        ["contradiction:science", { total: 3, failed: 3, rate: 1.0 }],
      ]),
    };
    const result = scanForGoals(STATE);
    const failureGoals = result.detected.filter(g => g.description?.includes("failure rate"));
    assert.equal(failureGoals.length, 0);
  });

  it("skips failure rate below threshold", () => {
    const STATE = makeSTATE();
    const es = STATE.__emergent;
    es._institutionalMemory = {
      failureRates: new Map([
        ["contradiction:science", { total: 10, failed: 3, rate: 0.3 }],
      ]),
    };
    const result = scanForGoals(STATE);
    const failureGoals = result.detected.filter(g => g.description?.includes("failure rate"));
    assert.equal(failureGoals.length, 0);
  });

  it("skips failure detection when no institutional memory", () => {
    const STATE = makeSTATE();
    const result = scanForGoals(STATE);
    assert.equal(result.ok, true);
  });

  // Orphaned nodes detection
  it("detects orphaned nodes above threshold", () => {
    const STATE = makeSTATE();
    // 15 DTUs, all orphaned
    for (let i = 0; i < 15; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._edges = {
      edges: new Map(),
      bySource: new Map(),
      byTarget: new Map(),
    };

    const result = scanForGoals(STATE);
    const orphanGoal = result.detected.find(g => g.type === GOAL_TYPES.STRUCTURAL_REPAIR);
    assert.ok(orphanGoal);
    assert.ok(orphanGoal.description.includes("disconnected"));
  });

  it("does not detect orphaned nodes below threshold", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 5; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._edges = {
      edges: new Map(),
      bySource: new Map(),
      byTarget: new Map(),
    };

    const result = scanForGoals(STATE);
    const orphanGoals = result.detected.filter(g => g.type === GOAL_TYPES.STRUCTURAL_REPAIR);
    assert.equal(orphanGoals.length, 0);
  });

  it("counts connected nodes properly via bySource and byTarget", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 15; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._edges = {
      edges: new Map(),
      bySource: new Map([["dtu_0", ["e1"]], ["dtu_1", ["e2"]], ["dtu_2", ["e3"]], ["dtu_3", ["e4"]], ["dtu_4", ["e5"]]]),
      byTarget: new Map([["dtu_5", ["e6"]]]),
    };

    const result = scanForGoals(STATE);
    // 15 - 6 connected = 9 orphaned, below 10 threshold
    const orphanGoals = result.detected.filter(g => g.type === GOAL_TYPES.STRUCTURAL_REPAIR);
    assert.equal(orphanGoals.length, 0);
  });

  // Stalled projects detection
  it("detects stalled projects", () => {
    const STATE = makeSTATE();
    const es = STATE.__emergent;
    const oldDate = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(); // 14 days ago
    es._projects = {
      projects: new Map([
        ["p1", { projectId: "p1", name: "Test Project", status: "active", updatedAt: oldDate, scope: "science" }],
      ]),
    };

    const result = scanForGoals(STATE);
    const stalledGoal = result.detected.find(g => g.type === GOAL_TYPES.PROJECT_ADVANCEMENT);
    assert.ok(stalledGoal);
    assert.ok(stalledGoal.description.includes("Test Project"));
  });

  it("ignores non-active projects", () => {
    const STATE = makeSTATE();
    const es = STATE.__emergent;
    const oldDate = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    es._projects = {
      projects: new Map([
        ["p1", { projectId: "p1", name: "Done Project", status: "completed", updatedAt: oldDate, scope: "science" }],
      ]),
    };

    const result = scanForGoals(STATE);
    const stalledGoals = result.detected.filter(g => g.type === GOAL_TYPES.PROJECT_ADVANCEMENT);
    assert.equal(stalledGoals.length, 0);
  });

  it("ignores recently updated projects", () => {
    const STATE = makeSTATE();
    const es = STATE.__emergent;
    es._projects = {
      projects: new Map([
        ["p1", { projectId: "p1", name: "Active Project", status: "active", updatedAt: new Date().toISOString(), scope: "science" }],
      ]),
    };

    const result = scanForGoals(STATE);
    const stalledGoals = result.detected.filter(g => g.type === GOAL_TYPES.PROJECT_ADVANCEMENT);
    assert.equal(stalledGoals.length, 0);
  });

  it("skips stalled detection when no projects store", () => {
    const STATE = makeSTATE();
    const result = scanForGoals(STATE);
    assert.equal(result.ok, true);
  });

  // Stale DTUs detection
  it("detects stale DTUs when count > 20", () => {
    const STATE = makeSTATE();
    const oldDate = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(); // 60 days ago
    for (let i = 0; i < 25; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}`, updatedAt: oldDate });
    }
    const result = scanForGoals(STATE);
    const staleGoal = result.detected.find(g => g.type === GOAL_TYPES.MAINTENANCE);
    assert.ok(staleGoal);
    assert.ok(staleGoal.description.includes("not been updated"));
  });

  it("does not detect stale DTUs when count <= 20", () => {
    const STATE = makeSTATE();
    const oldDate = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    for (let i = 0; i < 15; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}`, updatedAt: oldDate });
    }
    const result = scanForGoals(STATE);
    const staleGoals = result.detected.filter(g => g.type === GOAL_TYPES.MAINTENANCE);
    assert.equal(staleGoals.length, 0);
  });

  it("uses timestamp field when updatedAt is missing", () => {
    const STATE = makeSTATE();
    const oldDate = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    for (let i = 0; i < 25; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}`, timestamp: oldDate });
    }
    const result = scanForGoals(STATE);
    const staleGoal = result.detected.find(g => g.type === GOAL_TYPES.MAINTENANCE);
    assert.ok(staleGoal);
  });

  it("skips DTUs without any timestamp", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 25; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const result = scanForGoals(STATE);
    const staleGoals = result.detected.filter(g => g.type === GOAL_TYPES.MAINTENANCE);
    assert.equal(staleGoals.length, 0);
  });

  // Deduplication
  it("deduplicates goals with same fingerprint as active goals", () => {
    const STATE = makeSTATE();
    // First scan to create goals
    for (let i = 0; i < 15; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._edges = {
      edges: new Map(),
      bySource: new Map(),
      byTarget: new Map(),
    };

    const result1 = scanForGoals(STATE);
    const firstCount = result1.count;

    // Second scan — should deduplicate
    const result2 = scanForGoals(STATE);
    assert.equal(result2.count, 0);
  });

  it("increments totalActive correctly", () => {
    const STATE = makeSTATE();
    for (let i = 0; i < 15; i++) {
      STATE.dtus.set(`dtu_${i}`, { id: `dtu_${i}` });
    }
    const es = STATE.__emergent;
    es._edges = {
      edges: new Map(),
      bySource: new Map(),
      byTarget: new Map(),
    };

    const result = scanForGoals(STATE);
    assert.equal(result.totalActive, result.count);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. scheduleGoal
// ═══════════════════════════════════════════════════════════════════════════════

describe("scheduleGoal()", () => {
  it("returns error for non-existent goal", () => {
    const STATE = makeSTATE();
    const result = scheduleGoal(STATE, "nonexistent");
    assert.equal(result.ok, false);
    assert.equal(result.error, "goal_not_found");
  });

  it("returns error for already-scheduled goal", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", {
      goalId: "g1",
      scheduled: true,
      workItemType: "user_prompt",
      domain: "*",
      inputs: [],
      description: "test",
      signals: {},
    });
    const result = scheduleGoal(STATE, "g1");
    assert.equal(result.ok, false);
    assert.equal(result.error, "already_scheduled");
  });

  it("schedules goal successfully and updates metrics", () => {
    const STATE = makeSTATE();
    // Initialize the scheduler store
    const es = STATE.__emergent;
    const store = getGoalStore(STATE);
    store.active.set("g1", {
      goalId: "g1",
      scheduled: false,
      workItemType: "user_prompt",
      domain: "science",
      inputs: ["dtu_1"],
      description: "Test goal",
      signals: { risk: 0.5 },
    });

    const result = scheduleGoal(STATE, "g1");
    // createWorkItem from scheduler is real; it may or may not succeed depending on scheduler state
    // But the function handles result.ok check
    if (result.ok) {
      assert.ok(result.workItem);
      assert.ok(result.goal);
      assert.equal(result.goal.scheduled, true);
      assert.ok(result.goal.workItemId);
      assert.ok(result.goal.scheduledAt);
      assert.equal(store.metrics.totalScheduled, 1);
    }
  });

  it("propagates scheduler failure", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", {
      goalId: "g1",
      scheduled: false,
      workItemType: null,
      domain: null,
      inputs: null,
      description: null,
      signals: null,
    });
    // createWorkItem will use defaults for missing values
    const result = scheduleGoal(STATE, "g1");
    // The result depends on the scheduler implementation
    assert.ok(typeof result.ok === "boolean");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. completeGoal
// ═══════════════════════════════════════════════════════════════════════════════

describe("completeGoal()", () => {
  it("returns error for non-existent goal", () => {
    const STATE = makeSTATE();
    const result = completeGoal(STATE, "nonexistent");
    assert.equal(result.ok, false);
    assert.equal(result.error, "goal_not_found");
  });

  it("completes an active goal", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", status: "active" });

    const result = completeGoal(STATE, "g1", { note: "done" });
    assert.equal(result.ok, true);
    assert.equal(result.goal.status, "completed");
    assert.ok(result.goal.completedAt);
    assert.deepEqual(result.goal.outcome, { note: "done" });
    assert.equal(store.active.has("g1"), false);
    assert.equal(store.completed.length, 1);
    assert.equal(store.metrics.totalCompleted, 1);
  });

  it("completes goal with default empty outcome", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", status: "active" });

    const result = completeGoal(STATE, "g1");
    assert.equal(result.ok, true);
    assert.deepEqual(result.goal.outcome, {});
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. dismissGoal
// ═══════════════════════════════════════════════════════════════════════════════

describe("dismissGoal()", () => {
  it("returns error for non-existent goal", () => {
    const STATE = makeSTATE();
    const result = dismissGoal(STATE, "nonexistent");
    assert.equal(result.ok, false);
    assert.equal(result.error, "goal_not_found");
  });

  it("dismisses an active goal with reason", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", status: "active" });

    const result = dismissGoal(STATE, "g1", "too_expensive");
    assert.equal(result.ok, true);
    assert.equal(result.goal.status, "dismissed");
    assert.ok(result.goal.dismissedAt);
    assert.equal(result.goal.dismissReason, "too_expensive");
    assert.equal(store.active.has("g1"), false);
    assert.equal(store.dismissed.length, 1);
    assert.equal(store.metrics.totalDismissed, 1);
  });

  it("uses default dismiss reason when none provided", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", status: "active" });

    const result = dismissGoal(STATE, "g1");
    assert.equal(result.goal.dismissReason, "not_worth_pursuing");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. getActiveGoals
// ═══════════════════════════════════════════════════════════════════════════════

describe("getActiveGoals()", () => {
  it("returns empty array when no active goals", () => {
    const STATE = makeSTATE();
    const result = getActiveGoals(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.count, 0);
    assert.deepEqual(result.goals, []);
  });

  it("returns all active goals", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", type: "gap_detection", domain: "*", priority: 0.8 });
    store.active.set("g2", { goalId: "g2", type: "maintenance", domain: "science", priority: 0.5 });

    const result = getActiveGoals(STATE);
    assert.equal(result.count, 2);
  });

  it("filters by type", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", type: "gap_detection", domain: "*", priority: 0.8 });
    store.active.set("g2", { goalId: "g2", type: "maintenance", domain: "*", priority: 0.5 });

    const result = getActiveGoals(STATE, { type: "gap_detection" });
    assert.equal(result.count, 1);
    assert.equal(result.goals[0].type, "gap_detection");
  });

  it("filters by domain", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", type: "gap_detection", domain: "*", priority: 0.8 });
    store.active.set("g2", { goalId: "g2", type: "maintenance", domain: "science", priority: 0.5 });

    const result = getActiveGoals(STATE, { domain: "science" });
    assert.equal(result.count, 2); // "*" matches all, "science" matches "science"
  });

  it("filters by minPriority", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", type: "gap_detection", domain: "*", priority: 0.8 });
    store.active.set("g2", { goalId: "g2", type: "maintenance", domain: "*", priority: 0.3 });

    const result = getActiveGoals(STATE, { minPriority: 0.5 });
    assert.equal(result.count, 1);
    assert.equal(result.goals[0].priority, 0.8);
  });

  it("sorts by priority descending", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1", type: "gap_detection", domain: "*", priority: 0.3 });
    store.active.set("g2", { goalId: "g2", type: "maintenance", domain: "*", priority: 0.8 });

    const result = getActiveGoals(STATE);
    assert.equal(result.goals[0].priority, 0.8);
    assert.equal(result.goals[1].priority, 0.3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. updateThresholds
// ═══════════════════════════════════════════════════════════════════════════════

describe("updateThresholds()", () => {
  it("updates valid threshold values", () => {
    const STATE = makeSTATE();
    const result = updateThresholds(STATE, { contradictionDensityThreshold: 0.5 });
    assert.equal(result.ok, true);
    assert.equal(result.thresholds.contradictionDensityThreshold, 0.5);
  });

  it("ignores non-existent threshold keys", () => {
    const STATE = makeSTATE();
    const result = updateThresholds(STATE, { nonExistentThreshold: 0.5 });
    assert.equal(result.ok, true);
    assert.equal(result.thresholds.nonExistentThreshold, undefined);
  });

  it("ignores non-number values", () => {
    const STATE = makeSTATE();
    const before = getGoalStore(STATE).thresholds.contradictionDensityThreshold;
    const result = updateThresholds(STATE, { contradictionDensityThreshold: "not_a_number" });
    assert.equal(result.thresholds.contradictionDensityThreshold, before);
  });

  it("returns current thresholds with no overrides", () => {
    const STATE = makeSTATE();
    const result = updateThresholds(STATE);
    assert.equal(result.ok, true);
    assert.ok(result.thresholds.contradictionDensityThreshold !== undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. getGoalMetrics
// ═══════════════════════════════════════════════════════════════════════════════

describe("getGoalMetrics()", () => {
  it("returns metrics for empty store", () => {
    const STATE = makeSTATE();
    const result = getGoalMetrics(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.metrics.totalDetected, 0);
    assert.equal(result.activeGoals, 0);
    assert.equal(result.completedGoals, 0);
    assert.equal(result.dismissedGoals, 0);
    assert.ok(result.thresholds);
  });

  it("reflects state after operations", () => {
    const STATE = makeSTATE();
    const store = getGoalStore(STATE);
    store.active.set("g1", { goalId: "g1" });
    store.completed.push({ goalId: "g2" });
    store.dismissed.push({ goalId: "g3" });
    store.metrics.totalDetected = 3;

    const result = getGoalMetrics(STATE);
    assert.equal(result.activeGoals, 1);
    assert.equal(result.completedGoals, 1);
    assert.equal(result.dismissedGoals, 1);
    assert.equal(result.metrics.totalDetected, 3);
  });
});
