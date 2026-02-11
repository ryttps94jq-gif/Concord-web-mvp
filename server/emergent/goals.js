/**
 * Emergent Agent Governance — Goal Formation (Without Desire)
 *
 * Stage 8: The system proposes work on its own, but only based on objective signals.
 *
 * Examples:
 *   - "This domain has rising contradiction density"
 *   - "This area lacks verified DTUs"
 *   - "This workflow repeatedly fails downstream"
 *   - "This project stalled due to missing primitives"
 *
 * These become system-generated work items, fed into the same scheduler.
 *
 * Important:
 *   - No wants
 *   - No preferences
 *   - No self-interest
 *   Just gap detection under constraints.
 *
 * Goal types:
 *   1. Gap Detection — missing knowledge, coverage holes
 *   2. Quality Pressure — degrading metrics, rising failures
 *   3. Maintenance Needs — stale data, expired evidence
 *   4. Structural Repair — broken edges, orphaned nodes
 *   5. Project Advancement — stalled projects, blocked milestones
 */

import { getEmergentState } from "./store.js";
import { createWorkItem, WORK_ITEM_TYPES } from "./scheduler.js";

// ── Goal Types ───────────────────────────────────────────────────────────────

export const GOAL_TYPES = Object.freeze({
  GAP_DETECTION:       "gap_detection",
  QUALITY_PRESSURE:    "quality_pressure",
  MAINTENANCE:         "maintenance",
  STRUCTURAL_REPAIR:   "structural_repair",
  PROJECT_ADVANCEMENT: "project_advancement",
});

export const ALL_GOAL_TYPES = Object.freeze(Object.values(GOAL_TYPES));

// ── Goal Store ───────────────────────────────────────────────────────────────

/**
 * Get or initialize the goal store.
 */
export function getGoalStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._goals) {
    es._goals = {
      goals: [],                    // detected goals (append-only)
      active: new Map(),            // goalId -> Goal (currently active)
      completed: [],                // resolved goals
      dismissed: [],                // dismissed as not worth pursuing

      // Thresholds that trigger goal detection
      thresholds: {
        contradictionDensityThreshold: 0.3,   // fraction of DTUs with contradictions
        unverifiedRatioThreshold: 0.7,        // fraction of DTUs without evidence
        failureRateThreshold: 0.5,            // failure rate for a work type
        staleDtuAgeMs: 30 * 24 * 3600 * 1000, // 30 days
        orphanedNodeThreshold: 10,            // number of disconnected DTUs
        stalledProjectAgeMs: 7 * 24 * 3600 * 1000, // 7 days with no progress
      },

      metrics: {
        totalDetected: 0,
        totalScheduled: 0,
        totalCompleted: 0,
        totalDismissed: 0,
        lastScan: null,
      },
    };
  }
  return es._goals;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GAP DETECTION SCAN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scan the lattice for gaps and quality issues, generating goals.
 * This is the system's "proactive observation" — no desires, just measurement.
 *
 * @param {Object} STATE - Global server state
 * @returns {{ ok: boolean, detected: Object[] }}
 */
export function scanForGoals(STATE) {
  const es = getEmergentState(STATE);
  const store = getGoalStore(STATE);
  const detected = [];

  // 1. Contradiction density
  const contradictionGoals = detectContradictionDensity(STATE, es, store);
  detected.push(...contradictionGoals);

  // 2. Unverified regions
  const unverifiedGoals = detectUnverifiedRegions(STATE, es, store);
  detected.push(...unverifiedGoals);

  // 3. Failure rate spikes
  const failureGoals = detectFailureRateSpikes(STATE, es, store);
  detected.push(...failureGoals);

  // 4. Structural orphans
  const orphanGoals = detectOrphanedNodes(STATE, es, store);
  detected.push(...orphanGoals);

  // 5. Stalled projects
  const stalledGoals = detectStalledProjects(STATE, es, store);
  detected.push(...stalledGoals);

  // 6. Stale DTUs
  const staleGoals = detectStaleDtus(STATE, es, store);
  detected.push(...staleGoals);

  // Deduplicate against active goals (same fingerprint)
  const activeFingerprints = new Set();
  for (const goal of store.active.values()) {
    activeFingerprints.add(goal.fingerprint);
  }

  const newGoals = detected.filter(g => !activeFingerprints.has(g.fingerprint));

  // Store new goals
  for (const goal of newGoals) {
    store.goals.push(goal);
    store.active.set(goal.goalId, goal);
    store.metrics.totalDetected++;
  }

  store.metrics.lastScan = new Date().toISOString();

  return { ok: true, detected: newGoals, count: newGoals.length, totalActive: store.active.size };
}

/**
 * Schedule a detected goal as a work item in the scheduler.
 *
 * @param {Object} STATE - Global server state
 * @param {string} goalId - Goal to schedule
 * @returns {{ ok: boolean, workItem?: Object }}
 */
export function scheduleGoal(STATE, goalId) {
  const store = getGoalStore(STATE);
  const goal = store.active.get(goalId);
  if (!goal) return { ok: false, error: "goal_not_found" };
  if (goal.scheduled) return { ok: false, error: "already_scheduled" };

  const result = createWorkItem(STATE, {
    type: goal.workItemType || WORK_ITEM_TYPES.LOW_CONFIDENCE,
    scope: goal.domain || "*",
    inputs: goal.inputs || [],
    createdBy: "goal_system",
    description: goal.description,
    signals: goal.signals || {},
  });

  if (!result.ok) return result;

  goal.scheduled = true;
  goal.workItemId = result.item.itemId;
  goal.scheduledAt = new Date().toISOString();
  store.metrics.totalScheduled++;

  return { ok: true, workItem: result.item, goal };
}

/**
 * Complete a goal (mark as resolved).
 */
export function completeGoal(STATE, goalId, outcome = {}) {
  const store = getGoalStore(STATE);
  const goal = store.active.get(goalId);
  if (!goal) return { ok: false, error: "goal_not_found" };

  goal.status = "completed";
  goal.completedAt = new Date().toISOString();
  goal.outcome = outcome;

  store.active.delete(goalId);
  store.completed.push(goal);
  store.metrics.totalCompleted++;

  return { ok: true, goal };
}

/**
 * Dismiss a goal (not worth pursuing).
 */
export function dismissGoal(STATE, goalId, reason) {
  const store = getGoalStore(STATE);
  const goal = store.active.get(goalId);
  if (!goal) return { ok: false, error: "goal_not_found" };

  goal.status = "dismissed";
  goal.dismissedAt = new Date().toISOString();
  goal.dismissReason = reason || "not_worth_pursuing";

  store.active.delete(goalId);
  store.dismissed.push(goal);
  store.metrics.totalDismissed++;

  return { ok: true, goal };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. QUERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get active goals.
 */
export function getActiveGoals(STATE, filters = {}) {
  const store = getGoalStore(STATE);
  let results = Array.from(store.active.values());

  if (filters.type) results = results.filter(g => g.type === filters.type);
  if (filters.domain) results = results.filter(g => g.domain === "*" || g.domain === filters.domain);
  if (filters.minPriority !== undefined) results = results.filter(g => g.priority >= filters.minPriority);

  results.sort((a, b) => b.priority - a.priority);
  return { ok: true, goals: results, count: results.length };
}

/**
 * Update goal detection thresholds.
 */
export function updateThresholds(STATE, overrides = {}) {
  const store = getGoalStore(STATE);
  for (const [key, value] of Object.entries(overrides)) {
    if (key in store.thresholds && typeof value === "number") {
      store.thresholds[key] = value;
    }
  }
  return { ok: true, thresholds: { ...store.thresholds } };
}

/**
 * Get goal metrics.
 */
export function getGoalMetrics(STATE) {
  const store = getGoalStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    activeGoals: store.active.size,
    completedGoals: store.completed.length,
    dismissedGoals: store.dismissed.length,
    thresholds: { ...store.thresholds },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DETECTION FUNCTIONS (pure measurement, no desire)
// ═══════════════════════════════════════════════════════════════════════════════

function detectContradictionDensity(STATE, es, store) {
  const goals = [];
  if (!STATE.dtus || STATE.dtus.size === 0) return goals;

  const edgeStore = es._edges;
  if (!edgeStore || !edgeStore.edges) return goals;

  // Count DTUs involved in contradiction edges
  const contradictedDtus = new Set();
  for (const edge of edgeStore.edges.values()) {
    if (edge.edgeType === "contradicts") {
      contradictedDtus.add(edge.sourceId);
      contradictedDtus.add(edge.targetId);
    }
  }

  const density = contradictedDtus.size / STATE.dtus.size;

  if (density > store.thresholds.contradictionDensityThreshold) {
    goals.push(makeGoal({
      type: GOAL_TYPES.QUALITY_PRESSURE,
      description: `Contradiction density is ${(density * 100).toFixed(1)}% (${contradictedDtus.size}/${STATE.dtus.size} DTUs)`,
      domain: "*",
      priority: Math.min(1, density * 2),
      workItemType: WORK_ITEM_TYPES.CONTRADICTION,
      inputs: Array.from(contradictedDtus).slice(0, 20),
      signals: { contradictionPressure: density, impact: 0.7, risk: 0.6 },
      fingerprint: `contradiction_density:${Math.round(density * 10) / 10}`,
      data: { density, count: contradictedDtus.size, total: STATE.dtus.size },
    }));
  }

  return goals;
}

function detectUnverifiedRegions(STATE, es, store) {
  const goals = [];
  const evidenceStore = es._evidence;
  if (!evidenceStore || !STATE.dtus || STATE.dtus.size === 0) return goals;

  const trackedDtus = evidenceStore.byDtu.size;
  const totalDtus = STATE.dtus.size;
  const unverifiedRatio = 1 - (trackedDtus / totalDtus);

  if (unverifiedRatio > store.thresholds.unverifiedRatioThreshold) {
    goals.push(makeGoal({
      type: GOAL_TYPES.GAP_DETECTION,
      description: `${(unverifiedRatio * 100).toFixed(1)}% of DTUs have no evidence attached (${totalDtus - trackedDtus}/${totalDtus})`,
      domain: "*",
      priority: Math.min(1, unverifiedRatio),
      workItemType: WORK_ITEM_TYPES.ARTIFACT_VALIDATION,
      signals: { uncertainty: unverifiedRatio, impact: 0.5 },
      fingerprint: `unverified_ratio:${Math.round(unverifiedRatio * 10) / 10}`,
      data: { unverifiedRatio, tracked: trackedDtus, total: totalDtus },
    }));
  }

  return goals;
}

function detectFailureRateSpikes(STATE, es, store) {
  const goals = [];
  const memoryStore = es._institutionalMemory;
  if (!memoryStore) return goals;

  for (const [key, rate] of memoryStore.failureRates) {
    if (rate.total < 5) continue; // need enough data
    if (rate.rate > store.thresholds.failureRateThreshold) {
      const [workType, domain] = key.split(":");
      goals.push(makeGoal({
        type: GOAL_TYPES.QUALITY_PRESSURE,
        description: `Work type "${workType}" in domain "${domain}" has ${(rate.rate * 100).toFixed(1)}% failure rate (${rate.failed}/${rate.total})`,
        domain,
        priority: Math.min(1, rate.rate),
        workItemType: WORK_ITEM_TYPES.ARTIFACT_VALIDATION,
        signals: { risk: rate.rate, impact: 0.6 },
        fingerprint: `failure_spike:${key}`,
        data: { workType, domain, ...rate },
      }));
    }
  }

  return goals;
}

function detectOrphanedNodes(STATE, es, store) {
  const goals = [];
  const edgeStore = es._edges;
  if (!edgeStore || !STATE.dtus || STATE.dtus.size === 0) return goals;

  const connected = new Set();
  if (edgeStore.bySource) for (const id of edgeStore.bySource.keys()) connected.add(id);
  if (edgeStore.byTarget) for (const id of edgeStore.byTarget.keys()) connected.add(id);

  const orphaned = [];
  for (const dtuId of STATE.dtus.keys()) {
    if (!connected.has(dtuId)) orphaned.push(dtuId);
  }

  if (orphaned.length > store.thresholds.orphanedNodeThreshold) {
    goals.push(makeGoal({
      type: GOAL_TYPES.STRUCTURAL_REPAIR,
      description: `${orphaned.length} DTUs are disconnected from the lattice`,
      domain: "*",
      priority: Math.min(1, orphaned.length * 0.03),
      workItemType: WORK_ITEM_TYPES.MISSING_EDGES,
      inputs: orphaned.slice(0, 20),
      signals: { uncertainty: 0.4, novelty: 0.5, effort: 0.3 },
      fingerprint: `orphaned_nodes:${Math.round(orphaned.length / 10) * 10}`,
      data: { count: orphaned.length },
    }));
  }

  return goals;
}

function detectStalledProjects(STATE, es, store) {
  const goals = [];
  const projectStore = es._projects;
  if (!projectStore) return goals;

  const now = Date.now();

  for (const project of projectStore.projects.values()) {
    if (project.status !== "active") continue;

    const lastUpdate = new Date(project.updatedAt).getTime();
    const staleAge = now - lastUpdate;

    if (staleAge > store.thresholds.stalledProjectAgeMs) {
      const daysSinceUpdate = Math.round(staleAge / (24 * 3600 * 1000));
      goals.push(makeGoal({
        type: GOAL_TYPES.PROJECT_ADVANCEMENT,
        description: `Project "${project.name}" has not progressed in ${daysSinceUpdate} days`,
        domain: project.scope,
        priority: Math.min(1, daysSinceUpdate * 0.1),
        workItemType: WORK_ITEM_TYPES.USER_PROMPT,
        inputs: [project.projectId],
        signals: { impact: 0.5, governancePressure: 0.3 },
        fingerprint: `stalled_project:${project.projectId}`,
        data: { projectId: project.projectId, daysSinceUpdate },
      }));
    }
  }

  return goals;
}

function detectStaleDtus(STATE, es, store) {
  const goals = [];
  if (!STATE.dtus || STATE.dtus.size === 0) return goals;

  const now = Date.now();
  let staleCount = 0;
  const staleDtus = [];

  for (const dtu of STATE.dtus.values()) {
    const timestamp = dtu.updatedAt || dtu.timestamp;
    if (!timestamp) continue;

    const age = now - new Date(timestamp).getTime();
    if (age > store.thresholds.staleDtuAgeMs) {
      staleCount++;
      if (staleDtus.length < 20) staleDtus.push(dtu.id);
    }
  }

  if (staleCount > 20) {
    goals.push(makeGoal({
      type: GOAL_TYPES.MAINTENANCE,
      description: `${staleCount} DTUs have not been updated in over ${Math.round(store.thresholds.staleDtuAgeMs / (24 * 3600 * 1000))} days`,
      domain: "*",
      priority: Math.min(1, staleCount * 0.01),
      workItemType: WORK_ITEM_TYPES.PATTERN_REFRESH,
      inputs: staleDtus,
      signals: { uncertainty: 0.3, effort: 0.2 },
      fingerprint: `stale_dtus:${Math.round(staleCount / 10) * 10}`,
      data: { count: staleCount },
    }));
  }

  return goals;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function makeGoal(opts) {
  return {
    goalId: `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: opts.type,
    description: opts.description,
    domain: opts.domain || "*",
    priority: opts.priority || 0.5,
    workItemType: opts.workItemType || WORK_ITEM_TYPES.USER_PROMPT,
    inputs: opts.inputs || [],
    signals: opts.signals || {},
    fingerprint: opts.fingerprint,
    data: opts.data || {},
    status: "active",
    scheduled: false,
    workItemId: null,
    scheduledAt: null,
    completedAt: null,
    detectedAt: new Date().toISOString(),
  };
}
