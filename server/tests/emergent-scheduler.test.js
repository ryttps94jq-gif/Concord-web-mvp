/**
 * Emergent Agent Governance v3 — Cognition Scheduler Test Suite
 *
 * Tests the complete scheduler pipeline:
 *   1. Work item creation and enqueue
 *   2. Priority scoring from signals
 *   3. Attention budget enforcement
 *   4. Allocator (top-K + role matching)
 *   5. Stop conditions and summarization
 *   6. Queue management (dequeue, expire)
 *   7. Lattice scan integration
 *   8. Safety invariants
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  WORK_ITEM_TYPES, ALL_WORK_ITEM_TYPES, STOP_REASONS,
  DEFAULT_WEIGHTS, DEFAULT_BUDGET,
  getScheduler,
  createWorkItem, scanAndCreateWorkItems,
  computePriority, rescoreQueue, updateWeights,
  checkBudget, getBudgetStatus, updateBudget,
  allocate, getAllocation, recordTurn, recordProposal,
  completeAllocation,
  getQueue, getActiveAllocations, getCompletedWork,
  dequeueItem, expireItems,
  getSchedulerMetrics,
} from "../emergent/scheduler.js";

import {
  getEmergentState,
  registerEmergent,
} from "../emergent/store.js";

import { createEdge } from "../emergent/edges.js";
import { proposeDTU } from "../emergent/lattice-ops.js";

// ── Test Helpers ─────────────────────────────────────────────────────────────

function freshState() {
  return {
    dtus: new Map(),
    shadowDtus: new Map(),
    __emergent: null,
  };
}

function addEmergent(STATE, overrides = {}) {
  const es = getEmergentState(STATE);
  const emergent = {
    id: overrides.id || `em_test_${Math.random().toString(36).slice(2)}`,
    name: overrides.name || "Test Emergent",
    role: overrides.role || "builder",
    scope: overrides.scope || ["*"],
    capabilities: overrides.capabilities || ["talk", "propose"],
    memoryPolicy: "distilled",
  };
  return registerEmergent(es, emergent);
}

function addDTU(STATE, overrides = {}) {
  const id = overrides.id || `dtu_test_${Math.random().toString(36).slice(2)}`;
  const dtu = {
    id,
    title: overrides.title || "Test DTU",
    content: overrides.content || "Test content",
    summary: overrides.summary || "Test summary",
    tier: overrides.tier || "regular",
    tags: overrides.tags || ["test"],
    parents: [],
    children: [],
    relatedIds: [],
    resonance: overrides.resonance ?? 0.5,
    coherence: overrides.coherence ?? 0.5,
    stability: overrides.stability ?? 0.5,
    ownerId: "user1",
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: overrides.meta || {},
  };
  STATE.dtus.set(id, dtu);
  return dtu;
}

function setupTeam(STATE) {
  addEmergent(STATE, { id: "em_builder", name: "Builder", role: "builder" });
  addEmergent(STATE, { id: "em_critic", name: "Critic", role: "critic" });
  addEmergent(STATE, { id: "em_synth", name: "Synthesizer", role: "synthesizer" });
  addEmergent(STATE, { id: "em_auditor", name: "Auditor", role: "auditor" });
  addEmergent(STATE, { id: "em_adversary", name: "Adversary", role: "adversary" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. WORK ITEM CREATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Work Item Creation", () => {

  describe("createWorkItem", () => {
    it("should create a work item with correct structure", () => {
      const STATE = freshState();
      const result = createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.CONTRADICTION,
        scope: "music",
        inputs: ["dtu_1", "dtu_2"],
        createdBy: "system",
        description: "Conflicting claims about tempo",
        signals: { impact: 0.8, risk: 0.6, contradictionPressure: 0.9 },
      });

      assert.ok(result.ok);
      assert.ok(result.item.itemId.startsWith("wi_"));
      assert.equal(result.item.type, "contradiction");
      assert.equal(result.item.scope, "music");
      assert.equal(result.item.status, "queued");
      assert.ok(result.item.priority > 0);
      assert.ok(result.item.createdAt);
    });

    it("should reject invalid work item types", () => {
      const STATE = freshState();
      const result = createWorkItem(STATE, { type: "nonexistent" });
      assert.equal(result.ok, false);
      assert.equal(result.error, "invalid_work_item_type");
    });

    it("should enqueue items in priority order", () => {
      const STATE = freshState();
      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.LOW_CONFIDENCE,
        createdBy: "system",
        signals: { impact: 0.2, risk: 0.1 },
      });
      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.CONTRADICTION,
        createdBy: "system",
        signals: { impact: 0.9, risk: 0.9, contradictionPressure: 1.0 },
      });
      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.USER_PROMPT,
        createdBy: "user",
        signals: { impact: 0.5, risk: 0.3 },
      });

      const queue = getQueue(STATE);
      assert.equal(queue.count, 3);
      // First item should have highest priority
      assert.ok(queue.queue[0].priority >= queue.queue[1].priority);
      assert.ok(queue.queue[1].priority >= queue.queue[2].priority);
    });

    it("should clamp signal values to [0,1]", () => {
      const STATE = freshState();
      const result = createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.HOT_NODE,
        createdBy: "system",
        signals: { impact: 5, risk: -1 },
      });
      assert.ok(result.ok);
      assert.equal(result.item.signals.impact, 1);
      assert.equal(result.item.signals.risk, 0);
    });

    it("should boost priority for items near deadline", () => {
      const STATE = freshState();
      const soonDeadline = Date.now() + 60000; // 1 minute from now
      const r1 = createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.GOVERNANCE_BACKLOG,
        createdBy: "system",
        signals: { impact: 0.5, governancePressure: 0.5 },
        deadline: soonDeadline,
      });

      const r2 = createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.GOVERNANCE_BACKLOG,
        createdBy: "system",
        signals: { impact: 0.5, governancePressure: 0.5 },
        // no deadline
      });

      assert.ok(r1.item.priority >= r2.item.priority);
    });
  });

  describe("WORK_ITEM_TYPES", () => {
    it("should define all 10 work item types", () => {
      assert.equal(ALL_WORK_ITEM_TYPES.length, 10);
      assert.ok(ALL_WORK_ITEM_TYPES.includes("contradiction"));
      assert.ok(ALL_WORK_ITEM_TYPES.includes("low_confidence"));
      assert.ok(ALL_WORK_ITEM_TYPES.includes("user_prompt"));
      assert.ok(ALL_WORK_ITEM_TYPES.includes("hot_node"));
      assert.ok(ALL_WORK_ITEM_TYPES.includes("governance_backlog"));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PRIORITY SCORING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Priority Scoring", () => {

  describe("computePriority", () => {
    it("should compute a weighted sum of signals", () => {
      const signals = {
        impact: 1.0,
        risk: 0,
        uncertainty: 0,
        novelty: 0,
        contradictionPressure: 0,
        governancePressure: 0,
        effort: 0,
      };
      const score = computePriority(signals, DEFAULT_WEIGHTS);
      assert.equal(score, DEFAULT_WEIGHTS.impact);
    });

    it("should produce higher scores for high-impact+high-risk items", () => {
      const high = computePriority(
        { impact: 0.9, risk: 0.9, uncertainty: 0.5, novelty: 0.5, contradictionPressure: 0.5, governancePressure: 0.5, effort: 0.2 },
        DEFAULT_WEIGHTS
      );
      const low = computePriority(
        { impact: 0.1, risk: 0.1, uncertainty: 0.1, novelty: 0.1, contradictionPressure: 0.1, governancePressure: 0.1, effort: 0.9 },
        DEFAULT_WEIGHTS
      );
      assert.ok(high > low);
    });

    it("should penalize high effort (negative weight)", () => {
      const cheap = computePriority(
        { impact: 0.5, risk: 0.5, uncertainty: 0, novelty: 0, contradictionPressure: 0, governancePressure: 0, effort: 0 },
        DEFAULT_WEIGHTS
      );
      const expensive = computePriority(
        { impact: 0.5, risk: 0.5, uncertainty: 0, novelty: 0, contradictionPressure: 0, governancePressure: 0, effort: 1.0 },
        DEFAULT_WEIGHTS
      );
      assert.ok(cheap > expensive);
    });

    it("should clamp result to [0,1]", () => {
      const maxSignals = { impact: 1, risk: 1, uncertainty: 1, novelty: 1, contradictionPressure: 1, governancePressure: 1, effort: 0 };
      const score = computePriority(maxSignals, DEFAULT_WEIGHTS);
      assert.ok(score <= 1);
      assert.ok(score >= 0);
    });
  });

  describe("rescoreQueue", () => {
    it("should re-sort queue after rescoring", () => {
      const STATE = freshState();
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.9 } });
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.LOW_CONFIDENCE, createdBy: "system", signals: { impact: 0.1 } });

      const result = rescoreQueue(STATE);
      assert.ok(result.ok);
      assert.equal(result.count, 2);

      const queue = getQueue(STATE);
      assert.ok(queue.queue[0].priority >= queue.queue[1].priority);
    });
  });

  describe("updateWeights", () => {
    it("should update weights and rescore", () => {
      const STATE = freshState();
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.5, risk: 0.5 } });

      const before = getQueue(STATE).queue[0].priority;
      updateWeights(STATE, { impact: 0.9, risk: 0.01 });
      const after = getQueue(STATE).queue[0].priority;

      // Priority should change after weight update
      assert.notEqual(before, after);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ATTENTION BUDGET
// ═══════════════════════════════════════════════════════════════════════════════

describe("Attention Budget", () => {

  describe("checkBudget", () => {
    it("should allow work when budget is available", () => {
      const STATE = freshState();
      const result = checkBudget(STATE);
      assert.ok(result.allowed);
      assert.ok(result.remaining.items > 0);
    });

    it("should block when max items per cycle exhausted", () => {
      const STATE = freshState();
      const sched = getScheduler(STATE);
      sched.currentCycle.itemsStarted = sched.budget.maxItemsPerCycle;

      const result = checkBudget(STATE);
      assert.equal(result.allowed, false);
      assert.equal(result.reason, STOP_REASONS.BUDGET_EXHAUSTED);
    });

    it("should block when max parallel sessions reached", () => {
      const STATE = freshState();
      const sched = getScheduler(STATE);
      sched.currentCycle.sessionsActive = sched.budget.maxParallelSessions;

      const result = checkBudget(STATE);
      assert.equal(result.allowed, false);
      assert.equal(result.reason, "max_parallel_sessions");
    });

    it("should auto-reset cycle when duration expires", () => {
      const STATE = freshState();
      const sched = getScheduler(STATE);
      sched.currentCycle.startedAt = Date.now() - sched.budget.cycleDurationMs - 1000;
      sched.currentCycle.itemsStarted = sched.budget.maxItemsPerCycle;

      const result = checkBudget(STATE);
      assert.ok(result.allowed); // cycle reset, budget refreshed
    });
  });

  describe("getBudgetStatus", () => {
    it("should report utilization", () => {
      const STATE = freshState();
      const sched = getScheduler(STATE);
      sched.currentCycle.itemsStarted = 1;

      const status = getBudgetStatus(STATE);
      assert.ok(status.ok);
      assert.ok(status.utilization.items > 0);
      assert.ok(status.cycle.remainingMs > 0);
    });
  });

  describe("updateBudget", () => {
    it("should override budget parameters", () => {
      const STATE = freshState();
      const result = updateBudget(STATE, { maxItemsPerCycle: 10, maxTurnsPerItem: 20 });
      assert.ok(result.ok);
      assert.equal(result.budget.maxItemsPerCycle, 10);
      assert.equal(result.budget.maxTurnsPerItem, 20);
    });

    it("should reject non-positive values", () => {
      const STATE = freshState();
      updateBudget(STATE, { maxItemsPerCycle: -5 });
      const sched = getScheduler(STATE);
      assert.ok(sched.budget.maxItemsPerCycle > 0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ALLOCATOR
// ═══════════════════════════════════════════════════════════════════════════════

describe("Allocator", () => {

  describe("allocate", () => {
    it("should allocate top-K items to matching emergents", () => {
      const STATE = freshState();
      setupTeam(STATE);

      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.CONTRADICTION,
        createdBy: "system",
        description: "Test contradiction",
        signals: { impact: 0.8, contradictionPressure: 0.9 },
      });

      const result = allocate(STATE, { k: 1 });
      assert.ok(result.ok);
      assert.equal(result.count, 1);

      const alloc = result.allocations[0];
      assert.equal(alloc.type, "contradiction");
      assert.equal(alloc.status, "active");
      assert.ok(alloc.team.length >= 1);
      assert.ok(alloc.allocationId.startsWith("alloc_"));
    });

    it("should match roles by affinity (contradiction -> critic/adversary)", () => {
      const STATE = freshState();
      setupTeam(STATE);

      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.CONTRADICTION,
        createdBy: "system",
        signals: { contradictionPressure: 1.0 },
      });

      const result = allocate(STATE, { k: 1 });
      const alloc = result.allocations[0];
      const roles = alloc.teamRoles.map(t => t.role);
      // Should include at least a critic or adversary
      assert.ok(roles.includes("critic") || roles.includes("adversary") || roles.includes("synthesizer"));
    });

    it("should add critic/adversary for contradiction items", () => {
      const STATE = freshState();
      setupTeam(STATE);

      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.CONTRADICTION,
        createdBy: "system",
        signals: { impact: 0.8 },
      });

      const result = allocate(STATE, { k: 1 });
      // Team should have more than one member for contradictions
      assert.ok(result.allocations[0].team.length >= 2);
    });

    it("should defer items when no matching emergents exist", () => {
      const STATE = freshState();
      // Only add a builder — no critic/adversary
      addEmergent(STATE, { id: "em_builder_only", role: "historian" });

      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.ARTIFACT_VALIDATION,
        createdBy: "system",
        signals: { impact: 0.5 },
      });

      const result = allocate(STATE, { k: 1 });
      assert.ok(result.ok);
      // Item was deferred — no matching auditor/engineer
      assert.equal(result.count, 0);
    });

    it("should respect budget limits", () => {
      const STATE = freshState();
      setupTeam(STATE);
      updateBudget(STATE, { maxItemsPerCycle: 1 });

      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.9 } });
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.LOW_CONFIDENCE, createdBy: "system", signals: { impact: 0.8 } });

      const result = allocate(STATE, { k: 5 });
      assert.equal(result.count, 1); // budget allows only 1
    });

    it("should return error when budget fully exhausted", () => {
      const STATE = freshState();
      const sched = getScheduler(STATE);
      sched.currentCycle.itemsStarted = sched.budget.maxItemsPerCycle;

      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system" });
      const result = allocate(STATE);
      assert.equal(result.ok, false);
      assert.equal(result.error, STOP_REASONS.BUDGET_EXHAUSTED);
    });
  });

  describe("getAllocation", () => {
    it("should retrieve active allocation by ID", () => {
      const STATE = freshState();
      setupTeam(STATE);
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.8 } });

      const allocated = allocate(STATE, { k: 1 });
      const allocId = allocated.allocations[0].allocationId;

      const result = getAllocation(STATE, allocId);
      assert.ok(result.ok);
      assert.equal(result.allocation.allocationId, allocId);
    });

    it("should return not_found for unknown allocation", () => {
      const STATE = freshState();
      const result = getAllocation(STATE, "alloc_nonexistent");
      assert.equal(result.ok, false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. TURN TRACKING + STOP CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Turn Tracking & Stop Conditions", () => {

  describe("recordTurn", () => {
    it("should increment turn count", () => {
      const STATE = freshState();
      setupTeam(STATE);
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.USER_PROMPT, createdBy: "user", signals: { impact: 0.5 } });
      const allocated = allocate(STATE, { k: 1 });
      const allocId = allocated.allocations[0].allocationId;

      const result = recordTurn(STATE, allocId);
      assert.ok(result.ok);
      assert.equal(result.turnsUsed, 1);
      assert.equal(result.stop.shouldStop, false);
    });

    it("should trigger stop when max turns reached", () => {
      const STATE = freshState();
      setupTeam(STATE);
      updateBudget(STATE, { maxTurnsPerItem: 3 });
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.USER_PROMPT, createdBy: "user", signals: { impact: 0.5 } });
      const allocated = allocate(STATE, { k: 1 });
      const allocId = allocated.allocations[0].allocationId;

      recordTurn(STATE, allocId);
      recordTurn(STATE, allocId);
      const third = recordTurn(STATE, allocId);

      assert.ok(third.stop.shouldStop);
      assert.equal(third.stop.reason, STOP_REASONS.MAX_TURNS);
    });
  });

  describe("recordProposal", () => {
    it("should track proposals emitted by allocation", () => {
      const STATE = freshState();
      setupTeam(STATE);
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.8 } });
      const allocated = allocate(STATE, { k: 1 });
      const allocId = allocated.allocations[0].allocationId;

      const result = recordProposal(STATE, allocId, "prop_123");
      assert.ok(result.ok);
      assert.equal(result.proposalCount, 1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. COMPLETION + SUMMARIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Completion & Summarization", () => {

  describe("completeAllocation", () => {
    it("should complete allocation with summary", () => {
      const STATE = freshState();
      setupTeam(STATE);
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.8 } });
      const allocated = allocate(STATE, { k: 1 });
      const allocId = allocated.allocations[0].allocationId;

      recordTurn(STATE, allocId);
      recordProposal(STATE, allocId, "prop_1");
      recordProposal(STATE, allocId, "prop_2");

      const result = completeAllocation(STATE, allocId, {
        stopReason: STOP_REASONS.CONSENSUS_REACHED,
        description: "Contradiction resolved via synthesis",
        confidenceLabels: { derived: 2 },
      });

      assert.ok(result.ok);
      assert.equal(result.completed.status, "completed");
      assert.equal(result.completed.stopReason, STOP_REASONS.CONSENSUS_REACHED);
      assert.ok(result.completed.summary);
      assert.equal(result.completed.summary.proposalIds.length, 2);
      assert.equal(result.completed.summary.turnsUsed, 1);
    });

    it("should move allocation from active to completed", () => {
      const STATE = freshState();
      setupTeam(STATE);
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.USER_PROMPT, createdBy: "user", signals: { impact: 0.5 } });
      const allocated = allocate(STATE, { k: 1 });
      const allocId = allocated.allocations[0].allocationId;

      completeAllocation(STATE, allocId, { stopReason: STOP_REASONS.MAX_TURNS });

      const active = getActiveAllocations(STATE);
      assert.equal(active.count, 0);

      const completed = getCompletedWork(STATE);
      assert.ok(completed.count >= 1);
    });

    it("should decrement active session count on completion", () => {
      const STATE = freshState();
      setupTeam(STATE);
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.8 } });
      allocate(STATE, { k: 1 });

      const beforeBudget = getBudgetStatus(STATE);
      const sessionsBeforeCompl = beforeBudget.cycle.sessionsActive;

      const active = getActiveAllocations(STATE);
      completeAllocation(STATE, active.allocations[0].allocationId, { stopReason: STOP_REASONS.MAX_TURNS });

      const afterBudget = getBudgetStatus(STATE);
      assert.ok(afterBudget.cycle.sessionsActive < sessionsBeforeCompl);
    });
  });

  describe("getCompletedWork", () => {
    it("should return completed work with limit", () => {
      const STATE = freshState();
      setupTeam(STATE);

      for (let i = 0; i < 5; i++) {
        createWorkItem(STATE, {
          type: WORK_ITEM_TYPES.USER_PROMPT,
          createdBy: "user",
          signals: { impact: 0.5 },
        });
      }

      const allocs = allocate(STATE, { k: 3 });
      for (const a of allocs.allocations) {
        completeAllocation(STATE, a.allocationId, { stopReason: STOP_REASONS.MAX_TURNS });
      }

      const recent = getCompletedWork(STATE, 2);
      assert.equal(recent.count, 2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Queue Management", () => {

  describe("dequeueItem", () => {
    it("should remove a specific item from the queue", () => {
      const STATE = freshState();
      const r = createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system" });
      const itemId = r.item.itemId;

      const before = getQueue(STATE).count;
      const result = dequeueItem(STATE, itemId);
      assert.ok(result.ok);
      assert.equal(getQueue(STATE).count, before - 1);
    });

    it("should return not_found for unknown item", () => {
      const STATE = freshState();
      const result = dequeueItem(STATE, "wi_nonexistent");
      assert.equal(result.ok, false);
    });
  });

  describe("expireItems", () => {
    it("should expire items past deadline", () => {
      const STATE = freshState();
      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.USER_PROMPT,
        createdBy: "user",
        deadline: Date.now() - 10000, // 10 seconds ago
      });
      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.CONTRADICTION,
        createdBy: "system",
        // no deadline — should survive
      });

      const result = expireItems(STATE);
      assert.ok(result.ok);
      assert.equal(result.count, 1);

      const queue = getQueue(STATE);
      assert.equal(queue.count, 1);
    });

    it("should not expire items with future deadline", () => {
      const STATE = freshState();
      createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.USER_PROMPT,
        createdBy: "user",
        deadline: Date.now() + 60000, // 1 minute from now
      });

      const result = expireItems(STATE);
      assert.equal(result.count, 0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. LATTICE SCAN INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Lattice Scan", () => {

  describe("scanAndCreateWorkItems", () => {
    it("should create work items from lattice state", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      // Add low-confidence high-usage DTUs
      for (let i = 0; i < 3; i++) {
        addDTU(STATE, {
          id: `dtu_lowconf_${i}`,
          coherence: 0.1,
          resonance: 0.8,
        });
      }

      const result = scanAndCreateWorkItems(STATE);
      assert.ok(result.ok);
      assert.ok(result.count >= 3); // at least the 3 low-confidence DTUs
    });

    it("should detect governance backlog from pending proposals", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      // Create enough pending proposals
      for (let i = 0; i < 5; i++) {
        proposeDTU(STATE, { title: `Pending ${i}`, proposedBy: "em_1" });
      }

      const result = scanAndCreateWorkItems(STATE);
      const backlogItems = result.created.filter(i => i.type === WORK_ITEM_TYPES.GOVERNANCE_BACKLOG);
      assert.ok(backlogItems.length >= 1);
    });

    it("should detect isolated DTUs (missing edges)", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      // Add DTUs without edges
      for (let i = 0; i < 10; i++) {
        addDTU(STATE, { id: `dtu_isolated_${i}` });
      }

      // Initialize edge store by creating then removing an edge
      createEdge(STATE, { sourceId: "dtu_isolated_0", targetId: "dtu_isolated_1", edgeType: "supports" });

      const result = scanAndCreateWorkItems(STATE);
      const edgeItems = result.created.filter(i => i.type === WORK_ITEM_TYPES.MISSING_EDGES);
      assert.ok(edgeItems.length >= 1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. METRICS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scheduler Metrics", () => {

  it("should track all key metrics", () => {
    const STATE = freshState();
    setupTeam(STATE);

    createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.8 } });
    createWorkItem(STATE, { type: WORK_ITEM_TYPES.LOW_CONFIDENCE, createdBy: "system", signals: { impact: 0.5 } });

    const allocated = allocate(STATE, { k: 1 });
    const allocId = allocated.allocations[0].allocationId;
    recordTurn(STATE, allocId);
    completeAllocation(STATE, allocId, { stopReason: STOP_REASONS.MAX_TURNS });

    const metrics = getSchedulerMetrics(STATE);
    assert.ok(metrics.ok);
    assert.ok(metrics.metrics.totalItemsQueued >= 2);
    assert.ok(metrics.metrics.totalItemsCompleted >= 1);
    assert.ok(metrics.metrics.totalTurnsUsed >= 1);
    assert.ok(metrics.queueDepth >= 1); // one item left
    assert.equal(metrics.activeAllocations, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SAFETY INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scheduler Safety Invariants", () => {

  it("budget is a hard cap (no bypass)", () => {
    const STATE = freshState();
    setupTeam(STATE);
    updateBudget(STATE, { maxItemsPerCycle: 2 });

    for (let i = 0; i < 5; i++) {
      createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.9 } });
    }

    const result = allocate(STATE, { k: 10 }); // ask for 10, budget is 2
    assert.ok(result.ok);
    assert.ok(result.count <= 2);
  });

  it("priority is deterministic (same signals = same score)", () => {
    const signals = { impact: 0.7, risk: 0.3, uncertainty: 0.5, novelty: 0.2, contradictionPressure: 0.1, governancePressure: 0.4, effort: 0.6 };
    const s1 = computePriority(signals);
    const s2 = computePriority(signals);
    assert.equal(s1, s2);
  });

  it("queue maintains priority ordering", () => {
    const STATE = freshState();
    for (let i = 0; i < 20; i++) {
      createWorkItem(STATE, {
        type: ALL_WORK_ITEM_TYPES[i % ALL_WORK_ITEM_TYPES.length],
        createdBy: "system",
        signals: { impact: Math.random(), risk: Math.random(), effort: Math.random() },
      });
    }

    const queue = getQueue(STATE);
    for (let i = 0; i < queue.queue.length - 1; i++) {
      assert.ok(queue.queue[i].priority >= queue.queue[i + 1].priority,
        `Item ${i} (${queue.queue[i].priority}) should be >= item ${i + 1} (${queue.queue[i + 1].priority})`);
    }
  });

  it("expired items are removed from the queue", () => {
    const STATE = freshState();
    createWorkItem(STATE, {
      type: WORK_ITEM_TYPES.USER_PROMPT,
      createdBy: "user",
      deadline: Date.now() - 1000,
    });

    const before = getQueue(STATE).count;
    expireItems(STATE);
    const after = getQueue(STATE).count;
    assert.ok(after < before);
  });

  it("completed allocations are immutable (retrievable from completed list)", () => {
    const STATE = freshState();
    setupTeam(STATE);
    createWorkItem(STATE, { type: WORK_ITEM_TYPES.CONTRADICTION, createdBy: "system", signals: { impact: 0.8 } });
    const allocated = allocate(STATE, { k: 1 });
    const allocId = allocated.allocations[0].allocationId;
    completeAllocation(STATE, allocId, { stopReason: STOP_REASONS.MAX_TURNS });

    // Should be findable in completed
    const result = getAllocation(STATE, allocId);
    assert.ok(result.ok);
    assert.equal(result.source, "completed");
    assert.equal(result.allocation.status, "completed");
  });

  it("all work items have provenance (createdBy is always set)", () => {
    const STATE = freshState();
    const r = createWorkItem(STATE, { type: WORK_ITEM_TYPES.HOT_NODE, createdBy: "em_scanner" });
    assert.equal(r.item.createdBy, "em_scanner");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. FULL PIPELINE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Full Pipeline Integration", () => {
  it("should run the complete scheduler pipeline: scan -> enqueue -> allocate -> work -> complete", () => {
    const STATE = freshState();
    setupTeam(STATE);

    // Set up lattice state that will trigger scan
    for (let i = 0; i < 3; i++) {
      addDTU(STATE, { id: `dtu_pipe_${i}`, coherence: 0.1, resonance: 0.8 });
    }

    // Step 1: Scan lattice
    const scanned = scanAndCreateWorkItems(STATE);
    assert.ok(scanned.ok);
    assert.ok(scanned.count > 0, `Expected scan to find work items, got ${scanned.count}`);

    // Step 2: Check queue
    const queue = getQueue(STATE);
    assert.ok(queue.count > 0);

    // Step 3: Allocate
    const allocated = allocate(STATE, { k: 1 });
    assert.ok(allocated.ok);
    assert.ok(allocated.count >= 1, `Expected at least 1 allocation, got ${allocated.count}`);

    const allocId = allocated.allocations[0].allocationId;

    // Step 4: Record work
    recordTurn(STATE, allocId);
    recordTurn(STATE, allocId);
    recordProposal(STATE, allocId, "prop_pipeline_1");

    // Step 5: Complete
    const completed = completeAllocation(STATE, allocId, {
      stopReason: STOP_REASONS.CONSENSUS_REACHED,
      description: "Low-confidence DTU investigated and updated",
    });

    assert.ok(completed.ok);
    assert.equal(completed.completed.summary.proposalIds.length, 1);
    assert.equal(completed.completed.summary.turnsUsed, 2);

    // Step 6: Verify metrics
    const metrics = getSchedulerMetrics(STATE);
    assert.ok(metrics.metrics.totalItemsQueued > 0);
    assert.ok(metrics.metrics.totalItemsCompleted >= 1);
    assert.ok(metrics.metrics.totalTurnsUsed >= 2);
  });
});
