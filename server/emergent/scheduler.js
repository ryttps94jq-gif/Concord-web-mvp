/**
 * Emergent Agent Governance — Cognition Scheduler
 *
 * The "brain stem" that decides:
 *   - what gets attention first
 *   - how deep to go
 *   - when to stop
 *   - what gets deferred
 *
 * Core idea: finite attention budget + a priority queue.
 *
 * Pipeline:
 *   1. Lattice produces work items (contradictions, low-confidence DTUs, proposals, etc.)
 *   2. Each item gets a priority score from tracked signals
 *   3. System has a fixed attention budget per cycle
 *   4. Allocator picks top-K items and assigns them to emergents by role
 *   5. Work happens in staging lattice only (gates run every turn)
 *   6. Stop conditions + summarization emit structured results
 *   7. Governance decides what becomes real
 *
 * No emotions. Just math.
 */

import { getEmergentState, listEmergents, getReputation } from "./store.js";

// ── Work Item Types ──────────────────────────────────────────────────────────

export const WORK_ITEM_TYPES = Object.freeze({
  CONTRADICTION:       "contradiction",
  LOW_CONFIDENCE:      "low_confidence",
  USER_PROMPT:         "user_prompt",
  PROPOSAL_CRITIQUE:   "proposal_critique",
  MISSING_EDGES:       "missing_edges",
  ARTIFACT_VALIDATION: "artifact_validation",
  HOT_NODE:            "hot_node",
  SYNTHESIS_NEEDED:    "synthesis_needed",
  PATTERN_REFRESH:     "pattern_refresh",
  GOVERNANCE_BACKLOG:  "governance_backlog",
});

export const ALL_WORK_ITEM_TYPES = Object.freeze(Object.values(WORK_ITEM_TYPES));

// ── Priority Signal Weights (tunable) ────────────────────────────────────────

export const DEFAULT_WEIGHTS = Object.freeze({
  impact:              0.25,
  risk:                0.20,
  uncertainty:         0.15,
  novelty:             0.15,
  contradictionPressure: 0.10,
  governancePressure:  0.10,
  effort:             -0.05,  // negative: cheap wins get a bonus
});

// ── Budget Defaults ──────────────────────────────────────────────────────────

export const DEFAULT_BUDGET = Object.freeze({
  maxItemsPerCycle:          3,
  maxTurnsPerItem:          10,
  maxParallelSessions:       5,
  maxDeepSynthesisPerUser:   1,
  maxProposalsPerCycle:     10,
  cycleDurationMs:       60000,  // 1 minute
});

// ── Role Affinity — which roles handle which work types ──────────────────────

const ROLE_AFFINITY = Object.freeze({
  contradiction:       ["critic", "adversary", "synthesizer"],
  low_confidence:      ["critic", "engineer", "auditor"],
  user_prompt:         ["builder", "synthesizer"],
  proposal_critique:   ["critic", "adversary", "auditor"],
  missing_edges:       ["synthesizer", "builder", "historian"],
  artifact_validation: ["auditor", "engineer"],
  hot_node:            ["builder", "synthesizer", "historian"],
  synthesis_needed:    ["synthesizer", "builder"],
  pattern_refresh:     ["historian", "auditor"],
  governance_backlog:  ["auditor", "ethicist"],
});

// ── Stop Conditions ──────────────────────────────────────────────────────────

export const STOP_REASONS = Object.freeze({
  BUDGET_EXHAUSTED:      "budget_exhausted",
  NOVELTY_PLATEAU:       "novelty_plateau",
  CONTRADICTION_STUCK:   "contradiction_unresolved",
  FATAL_FLAW:            "fatal_flaw_found",
  MAX_TURNS:             "max_turns_reached",
  ALL_GATES_BLOCKED:     "all_gates_blocked",
  CONSENSUS_REACHED:     "consensus_reached",
});

// ── Scheduler State ──────────────────────────────────────────────────────────

/**
 * Get or initialize the scheduler state.
 */
export function getScheduler(STATE) {
  const es = getEmergentState(STATE);
  if (!es._scheduler) {
    es._scheduler = {
      // Work queue (priority queue implemented as sorted array)
      queue: [],                    // WorkItem[] sorted by priority desc

      // Active allocations
      active: new Map(),            // allocationId -> Allocation

      // Completed work history
      completed: [],                // CompletedWork[]

      // Budget tracking per cycle
      currentCycle: {
        startedAt: Date.now(),
        itemsStarted: 0,
        turnsUsed: 0,
        proposalsEmitted: 0,
        sessionsActive: 0,
        deepSynthesisUsed: new Map(), // userId -> count
      },

      // Configuration (can be overridden)
      budget: { ...DEFAULT_BUDGET },
      weights: { ...DEFAULT_WEIGHTS },

      // Metrics
      metrics: {
        totalItemsQueued: 0,
        totalItemsCompleted: 0,
        totalItemsDeferred: 0,
        totalItemsExpired: 0,
        totalCycles: 0,
        totalTurnsUsed: 0,
        avgPriority: 0,
        avgCompletionTurns: 0,
        budgetExhaustions: 0,
      },
    };
  }
  return es._scheduler;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. WORK ITEM CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a work item and enqueue it.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Work item options
 * @param {string} opts.type - One of WORK_ITEM_TYPES
 * @param {string} opts.scope - Lens/domain scope
 * @param {string[]} opts.inputs - DTU IDs / artifact IDs / edge IDs
 * @param {string} opts.createdBy - user/system/emergentId
 * @param {string} [opts.description] - Human-readable description
 * @param {Object} [opts.signals] - Pre-computed signal overrides
 * @param {number} [opts.deadline] - Optional deadline timestamp
 * @returns {{ ok: boolean, item?: Object }}
 */
export function createWorkItem(STATE, opts = {}) {
  const sched = getScheduler(STATE);

  if (!opts.type || !ALL_WORK_ITEM_TYPES.includes(opts.type)) {
    return { ok: false, error: "invalid_work_item_type", provided: opts.type, allowed: ALL_WORK_ITEM_TYPES };
  }

  const itemId = `wi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const item = {
    itemId,
    type: opts.type,
    scope: opts.scope || "*",
    inputs: Array.isArray(opts.inputs) ? opts.inputs.slice(0, 50) : [],
    createdBy: opts.createdBy || "system",
    description: String(opts.description || "").slice(0, 500),
    deadline: opts.deadline || null,
    status: "queued",

    // Priority signals (computed or provided)
    signals: {
      impact:              clamp(opts.signals?.impact ?? 0.5, 0, 1),
      risk:                clamp(opts.signals?.risk ?? 0.3, 0, 1),
      uncertainty:         clamp(opts.signals?.uncertainty ?? 0.5, 0, 1),
      novelty:             clamp(opts.signals?.novelty ?? 0.5, 0, 1),
      contradictionPressure: clamp(opts.signals?.contradictionPressure ?? 0, 0, 1),
      governancePressure:  clamp(opts.signals?.governancePressure ?? 0, 0, 1),
      effort:              clamp(opts.signals?.effort ?? 0.5, 0, 1),
    },

    // Computed priority (set below)
    priority: 0,

    // Provenance
    createdAt: new Date().toISOString(),
    assignedAt: null,
    completedAt: null,
  };

  // Compute priority score
  item.priority = computePriority(item.signals, sched.weights);

  // Urgency boost for items with deadlines
  if (item.deadline) {
    const timeLeft = item.deadline - Date.now();
    if (timeLeft > 0 && timeLeft < 300000) {  // < 5 minutes
      item.priority = Math.min(1, item.priority + 0.2);
    }
  }

  // Insert into sorted queue (binary insertion for efficiency)
  insertSorted(sched.queue, item);
  sched.metrics.totalItemsQueued++;

  // Update running average
  sched.metrics.avgPriority = runningAvg(
    sched.metrics.avgPriority,
    item.priority,
    sched.metrics.totalItemsQueued
  );

  return { ok: true, item };
}

/**
 * Bulk-create work items from lattice analysis.
 * Scans the lattice for contradictions, low-confidence DTUs, etc.
 *
 * @param {Object} STATE - Global server state
 * @returns {{ ok: boolean, created: Object[] }}
 */
export function scanAndCreateWorkItems(STATE) {
  const es = getEmergentState(STATE);
  const created = [];

  // 1. Check for unresolved contradictions
  for (const session of es.sessions.values()) {
    if (session.status === "completed" && (session._unresolvedContradictions || 0) > 0) {
      const result = createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.CONTRADICTION,
        scope: session.topic || "*",
        inputs: [session.sessionId],
        createdBy: "system",
        description: `${session._unresolvedContradictions} unresolved contradiction(s) in session "${session.topic}"`,
        signals: {
          impact: 0.7,
          risk: 0.6,
          contradictionPressure: Math.min(1, session._unresolvedContradictions * 0.3),
          effort: 0.4,
        },
      });
      if (result.ok) created.push(result.item);
    }
  }

  // 2. Check for low-confidence, high-usage DTUs
  if (STATE.dtus) {
    for (const dtu of STATE.dtus.values()) {
      if ((dtu.coherence || 0) < 0.3 && (dtu.resonance || 0) > 0.5) {
        const result = createWorkItem(STATE, {
          type: WORK_ITEM_TYPES.LOW_CONFIDENCE,
          scope: (dtu.tags || [])[0] || "*",
          inputs: [dtu.id],
          createdBy: "system",
          description: `DTU "${dtu.title}" has low coherence (${dtu.coherence}) but high usage (${dtu.resonance})`,
          signals: {
            impact: dtu.resonance || 0.5,
            risk: 0.5,
            uncertainty: 1 - (dtu.coherence || 0),
            effort: 0.3,
          },
        });
        if (result.ok) created.push(result.item);
      }
    }
  }

  // 3. Check for pending governance backlog
  const latticeOps = es._latticeOps;
  if (latticeOps) {
    const pending = Array.from(latticeOps.proposals.values()).filter(p => p.status === "pending");
    if (pending.length > 3) {
      const result = createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.GOVERNANCE_BACKLOG,
        scope: "*",
        inputs: pending.slice(0, 10).map(p => p.proposalId),
        createdBy: "system",
        description: `${pending.length} proposals awaiting governance review`,
        signals: {
          impact: 0.6,
          governancePressure: Math.min(1, pending.length * 0.15),
          effort: 0.3,
        },
      });
      if (result.ok) created.push(result.item);
    }
  }

  // 4. Check for isolated DTUs (missing edges)
  const edgeStore = es._edges;
  if (edgeStore && STATE.dtus) {
    const connected = new Set();
    if (edgeStore.bySource) for (const id of edgeStore.bySource.keys()) connected.add(id);
    if (edgeStore.byTarget) for (const id of edgeStore.byTarget.keys()) connected.add(id);

    const isolated = [];
    for (const dtuId of STATE.dtus.keys()) {
      if (!connected.has(dtuId)) isolated.push(dtuId);
    }
    if (isolated.length > 5) {
      const result = createWorkItem(STATE, {
        type: WORK_ITEM_TYPES.MISSING_EDGES,
        scope: "*",
        inputs: isolated.slice(0, 20),
        createdBy: "system",
        description: `${isolated.length} DTUs have no edges — structural gaps in the lattice`,
        signals: {
          impact: 0.5,
          uncertainty: 0.4,
          effort: 0.3,
          novelty: 0.4,
        },
      });
      if (result.ok) created.push(result.item);
    }
  }

  // 5. Check for hot nodes from activation system
  const activation = es._activation;
  if (activation) {
    for (const [dtuId, entry] of activation.global) {
      if (entry.score > 0.8 && entry.accessCount > 5) {
        const result = createWorkItem(STATE, {
          type: WORK_ITEM_TYPES.HOT_NODE,
          scope: "*",
          inputs: [dtuId],
          createdBy: "system",
          description: `DTU ${dtuId} is a hot node (score=${entry.score.toFixed(2)}, accesses=${entry.accessCount})`,
          signals: {
            impact: entry.score,
            novelty: 0.6,
            effort: 0.4,
          },
        });
        if (result.ok) created.push(result.item);
      }
    }
  }

  return { ok: true, created, count: created.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PRIORITY SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute priority score from signals and weights.
 *
 * priority = w1*impact + w2*risk + w3*uncertainty + w4*novelty
 *          + w5*contradictionPressure + w6*governancePressure + w7*effort
 *
 * (effort weight is negative — cheap wins get a boost)
 *
 * @param {Object} signals - Signal values (0-1)
 * @param {Object} weights - Signal weights
 * @returns {number} Priority score (clamped to [0,1])
 */
export function computePriority(signals, weights = DEFAULT_WEIGHTS) {
  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += weight * (signals[key] ?? 0);
  }
  return clamp(Math.round(score * 1000) / 1000, 0, 1);
}

/**
 * Re-score all queued items (useful after weight changes).
 */
export function rescoreQueue(STATE) {
  const sched = getScheduler(STATE);
  for (const item of sched.queue) {
    item.priority = computePriority(item.signals, sched.weights);
  }
  sched.queue.sort((a, b) => b.priority - a.priority);
  return { ok: true, count: sched.queue.length };
}

/**
 * Update priority weights.
 */
export function updateWeights(STATE, newWeights = {}) {
  const sched = getScheduler(STATE);
  for (const [key, value] of Object.entries(newWeights)) {
    if (key in sched.weights) {
      sched.weights[key] = value;
    }
  }
  return rescoreQueue(STATE);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ATTENTION BUDGET
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if the budget allows starting a new work item.
 *
 * @param {Object} STATE - Global server state
 * @param {string} [userId] - User context (for per-user limits)
 * @returns {{ allowed: boolean, reason?: string, remaining: Object }}
 */
export function checkBudget(STATE, userId) {
  const sched = getScheduler(STATE);
  const budget = sched.budget;

  // Check if cycle has expired — reset refreshes budget
  if (Date.now() - sched.currentCycle.startedAt > budget.cycleDurationMs) {
    resetCycle(sched);
  }

  // Read cycle AFTER potential reset (resetCycle replaces the object)
  const cycle = sched.currentCycle;

  const remaining = {
    items: budget.maxItemsPerCycle - cycle.itemsStarted,
    sessions: budget.maxParallelSessions - cycle.sessionsActive,
    proposals: budget.maxProposalsPerCycle - cycle.proposalsEmitted,
    turns: budget.maxTurnsPerItem * (budget.maxItemsPerCycle - cycle.itemsStarted),
  };

  if (cycle.itemsStarted >= budget.maxItemsPerCycle) {
    return { allowed: false, reason: STOP_REASONS.BUDGET_EXHAUSTED, remaining };
  }

  if (cycle.sessionsActive >= budget.maxParallelSessions) {
    return { allowed: false, reason: "max_parallel_sessions", remaining };
  }

  // Per-user deep synthesis limit
  if (userId) {
    const userSynth = cycle.deepSynthesisUsed.get(userId) || 0;
    remaining.deepSynthesis = budget.maxDeepSynthesisPerUser - userSynth;
  }

  return { allowed: true, remaining };
}

/**
 * Get current budget status.
 */
export function getBudgetStatus(STATE) {
  const sched = getScheduler(STATE);
  const cycle = sched.currentCycle;
  const budget = sched.budget;

  const elapsed = Date.now() - cycle.startedAt;
  const remaining = Math.max(0, budget.cycleDurationMs - elapsed);

  return {
    ok: true,
    budget,
    cycle: {
      startedAt: new Date(cycle.startedAt).toISOString(),
      elapsed,
      remainingMs: remaining,
      itemsStarted: cycle.itemsStarted,
      turnsUsed: cycle.turnsUsed,
      proposalsEmitted: cycle.proposalsEmitted,
      sessionsActive: cycle.sessionsActive,
    },
    utilization: {
      items: cycle.itemsStarted / budget.maxItemsPerCycle,
      turns: cycle.turnsUsed / (budget.maxTurnsPerItem * budget.maxItemsPerCycle),
      sessions: cycle.sessionsActive / budget.maxParallelSessions,
    },
  };
}

/**
 * Override budget parameters.
 */
export function updateBudget(STATE, overrides = {}) {
  const sched = getScheduler(STATE);
  for (const [key, value] of Object.entries(overrides)) {
    if (key in sched.budget && typeof value === "number" && value > 0) {
      sched.budget[key] = value;
    }
  }
  return { ok: true, budget: { ...sched.budget } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ALLOCATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Allocate the next top-K work items to matching emergents.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} [opts] - Options
 * @param {number} [opts.k] - Number of items to allocate (defaults to budget remaining)
 * @returns {{ ok: boolean, allocations: Object[] }}
 */
export function allocate(STATE, opts = {}) {
  const sched = getScheduler(STATE);
  const es = getEmergentState(STATE);

  // Reset cycle if expired
  if (Date.now() - sched.currentCycle.startedAt > sched.budget.cycleDurationMs) {
    resetCycle(sched);
  }

  const budgetCheck = checkBudget(STATE);
  if (!budgetCheck.allowed) {
    return { ok: false, error: budgetCheck.reason, remaining: budgetCheck.remaining };
  }

  const k = Math.min(
    opts.k || budgetCheck.remaining.items,
    budgetCheck.remaining.items,
    sched.queue.length
  );

  if (k <= 0) {
    return { ok: true, allocations: [], reason: "nothing_to_allocate" };
  }

  const allocations = [];

  for (let i = 0; i < k && sched.queue.length > 0; i++) {
    const item = sched.queue.shift();  // pop highest priority

    // Find matching emergents by role affinity
    const affinityRoles = ROLE_AFFINITY[item.type] || ["builder"];
    const candidates = listEmergents(es, { active: true })
      .filter(e => affinityRoles.includes(e.role));

    if (candidates.length === 0) {
      // No matching emergents — defer
      item.status = "deferred";
      sched.metrics.totalItemsDeferred++;
      sched.queue.push(item);  // re-insert at back
      continue;
    }

    // Pick the best candidate (highest credibility among matching roles)
    const ranked = candidates.map(e => ({
      ...e,
      credibility: (getReputation(es, e.id)?.credibility || 0.5),
    })).sort((a, b) => b.credibility - a.credibility);

    // Build team: primary + optional critic/adversary
    const team = [ranked[0].id];

    // Add a critic/adversary if item type calls for one
    if (["contradiction", "proposal_critique", "low_confidence"].includes(item.type)) {
      const critic = listEmergents(es, { active: true })
        .find(e => (e.role === "critic" || e.role === "adversary") && !team.includes(e.id));
      if (critic) team.push(critic.id);
    }

    // Add a synthesizer for synthesis work
    if (["synthesis_needed", "missing_edges"].includes(item.type)) {
      const synth = listEmergents(es, { active: true })
        .find(e => e.role === "synthesizer" && !team.includes(e.id));
      if (synth) team.push(synth.id);
    }

    const allocationId = `alloc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const allocation = {
      allocationId,
      itemId: item.itemId,
      type: item.type,
      scope: item.scope,
      inputs: item.inputs,
      description: item.description,
      priority: item.priority,
      team,
      teamRoles: team.map(id => {
        const e = es.emergents.get(id);
        return { id, role: e?.role, name: e?.name };
      }),
      maxTurns: sched.budget.maxTurnsPerItem,
      turnsUsed: 0,
      status: "active",
      proposals: [],
      signals: item.signals,
      startedAt: new Date().toISOString(),
      completedAt: null,
      stopReason: null,
      summary: null,
    };

    item.status = "assigned";
    item.assignedAt = new Date().toISOString();

    sched.active.set(allocationId, allocation);
    sched.currentCycle.itemsStarted++;
    sched.currentCycle.sessionsActive++;
    allocations.push(allocation);
  }

  return { ok: true, allocations, count: allocations.length };
}

/**
 * Get a specific allocation.
 */
export function getAllocation(STATE, allocationId) {
  const sched = getScheduler(STATE);
  const alloc = sched.active.get(allocationId);
  if (!alloc) {
    // Check completed
    const completed = sched.completed.find(c => c.allocationId === allocationId);
    return completed
      ? { ok: true, allocation: completed, source: "completed" }
      : { ok: false, error: "not_found" };
  }
  return { ok: true, allocation: alloc, source: "active" };
}

/**
 * Record a turn used by an allocation.
 */
export function recordTurn(STATE, allocationId) {
  const sched = getScheduler(STATE);
  const alloc = sched.active.get(allocationId);
  if (!alloc) return { ok: false, error: "allocation_not_found" };

  alloc.turnsUsed++;
  sched.currentCycle.turnsUsed++;
  sched.metrics.totalTurnsUsed++;

  // Check stop conditions
  const stop = checkStopConditions(alloc, sched);
  if (stop.shouldStop) {
    return { ok: true, turnsUsed: alloc.turnsUsed, stop };
  }

  return { ok: true, turnsUsed: alloc.turnsUsed, stop: { shouldStop: false } };
}

/**
 * Record a proposal emitted by an allocation.
 */
export function recordProposal(STATE, allocationId, proposalId) {
  const sched = getScheduler(STATE);
  const alloc = sched.active.get(allocationId);
  if (!alloc) return { ok: false, error: "allocation_not_found" };

  alloc.proposals.push(proposalId);
  sched.currentCycle.proposalsEmitted++;

  return { ok: true, proposalCount: alloc.proposals.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. STOP CONDITIONS + SUMMARIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check stop conditions for an active allocation.
 *
 * @param {Object} alloc - Active allocation
 * @param {Object} sched - Scheduler state
 * @returns {{ shouldStop: boolean, reason?: string }}
 */
function checkStopConditions(alloc, sched) {
  // Max turns reached
  if (alloc.turnsUsed >= alloc.maxTurns) {
    return { shouldStop: true, reason: STOP_REASONS.MAX_TURNS };
  }

  // Budget exhausted at cycle level
  if (sched.currentCycle.turnsUsed >= sched.budget.maxTurnsPerItem * sched.budget.maxItemsPerCycle) {
    return { shouldStop: true, reason: STOP_REASONS.BUDGET_EXHAUSTED };
  }

  return { shouldStop: false };
}

/**
 * Complete an allocation with a summary.
 *
 * @param {Object} STATE - Global server state
 * @param {string} allocationId - Allocation to complete
 * @param {Object} opts - Completion details
 * @param {string} opts.stopReason - One of STOP_REASONS
 * @param {Object} opts.summary - Structured summary
 * @returns {{ ok: boolean, completed?: Object }}
 */
export function completeAllocation(STATE, allocationId, opts = {}) {
  const sched = getScheduler(STATE);
  const alloc = sched.active.get(allocationId);
  if (!alloc) return { ok: false, error: "allocation_not_found" };

  alloc.status = "completed";
  alloc.completedAt = new Date().toISOString();
  alloc.stopReason = opts.stopReason || STOP_REASONS.MAX_TURNS;

  // Build summary
  alloc.summary = {
    whatChanged: alloc.proposals.length > 0
      ? `${alloc.proposals.length} proposal(s) emitted`
      : "No proposals emitted",
    proposalIds: alloc.proposals,
    turnsUsed: alloc.turnsUsed,
    unresolved: opts.unresolved || [],
    confidenceLabels: opts.confidenceLabels || {},
    description: opts.description || `Work item ${alloc.type} completed after ${alloc.turnsUsed} turns`,
  };

  // Move to completed
  sched.active.delete(allocationId);
  sched.completed.push(alloc);
  sched.currentCycle.sessionsActive = Math.max(0, sched.currentCycle.sessionsActive - 1);
  sched.metrics.totalItemsCompleted++;

  // Update avg completion turns
  sched.metrics.avgCompletionTurns = runningAvg(
    sched.metrics.avgCompletionTurns,
    alloc.turnsUsed,
    sched.metrics.totalItemsCompleted
  );

  return { ok: true, completed: alloc };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the current work queue (read-only view).
 */
export function getQueue(STATE) {
  const sched = getScheduler(STATE);
  return {
    ok: true,
    queue: sched.queue.map(freezeItem),
    count: sched.queue.length,
  };
}

/**
 * Get active allocations.
 */
export function getActiveAllocations(STATE) {
  const sched = getScheduler(STATE);
  return {
    ok: true,
    allocations: Array.from(sched.active.values()),
    count: sched.active.size,
  };
}

/**
 * Get completed work history.
 */
export function getCompletedWork(STATE, limit = 50) {
  const sched = getScheduler(STATE);
  const recent = sched.completed.slice(-limit);
  return {
    ok: true,
    completed: recent,
    count: recent.length,
    total: sched.completed.length,
  };
}

/**
 * Remove a specific item from the queue.
 */
export function dequeueItem(STATE, itemId) {
  const sched = getScheduler(STATE);
  const index = sched.queue.findIndex(i => i.itemId === itemId);
  if (index === -1) return { ok: false, error: "not_found" };
  const [removed] = sched.queue.splice(index, 1);
  return { ok: true, removed };
}

/**
 * Expire old queued items past their deadline.
 */
export function expireItems(STATE) {
  const sched = getScheduler(STATE);
  const now = Date.now();
  const expired = [];

  sched.queue = sched.queue.filter(item => {
    if (item.deadline && item.deadline < now) {
      item.status = "expired";
      expired.push(item);
      sched.metrics.totalItemsExpired++;
      return false;
    }
    return true;
  });

  return { ok: true, expired, count: expired.length };
}

/**
 * Get full scheduler metrics.
 */
export function getSchedulerMetrics(STATE) {
  const sched = getScheduler(STATE);
  return {
    ok: true,
    queueDepth: sched.queue.length,
    activeAllocations: sched.active.size,
    completedTotal: sched.completed.length,
    metrics: { ...sched.metrics },
    budget: { ...sched.budget },
    weights: { ...sched.weights },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function insertSorted(arr, item) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].priority > item.priority) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, item);
}

function resetCycle(sched) {
  sched.currentCycle = {
    startedAt: Date.now(),
    itemsStarted: 0,
    turnsUsed: 0,
    proposalsEmitted: 0,
    sessionsActive: 0,
    deepSynthesisUsed: new Map(),
  };
  sched.metrics.totalCycles++;
}

function freezeItem(item) {
  return JSON.parse(JSON.stringify(item));
}

function runningAvg(current, newValue, count) {
  if (count <= 1) return newValue;
  return current + (newValue - current) / count;
}
