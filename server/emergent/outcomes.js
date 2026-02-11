/**
 * Emergent Agent Governance — Outcome Signals + Scheduler Learning
 *
 * Stage 1: Reward / Outcome Signals
 *   Every completed work item produces measurable outcome signals:
 *     - user acceptance / reuse of the produced artifact/DTU
 *     - rollback / rejection rate from governance
 *     - contradiction reduction in that region of the lattice
 *     - downstream usage increase (touch counts)
 *     - error reports / complaints tied to that output
 *
 *   These become the "ground truth" for learning. No emotions. Just data.
 *
 * Stage 2: Scheduler Learning (Policy Improvement)
 *   Once outcomes exist, weights and routing can be updated:
 *     - weight tuning: adjust wImpact, wRisk, wContradiction... based on outcomes
 *     - assignment tuning: "this emergent role works best on this work type"
 *
 *   No LLM needed. Pure stats.
 */

import { getEmergentState } from "./store.js";
import { getScheduler, computePriority, rescoreQueue } from "./scheduler.js";

// ── Outcome Signal Types ─────────────────────────────────────────────────────

export const OUTCOME_SIGNALS = Object.freeze({
  USER_ACCEPTED:           "user_accepted",
  USER_REJECTED:           "user_rejected",
  USER_REUSED:             "user_reused",
  GOVERNANCE_APPROVED:     "governance_approved",
  GOVERNANCE_ROLLED_BACK:  "governance_rolled_back",
  CONTRADICTION_REDUCED:   "contradiction_reduced",
  CONTRADICTION_UNCHANGED: "contradiction_unchanged",
  DOWNSTREAM_USAGE_UP:     "downstream_usage_up",
  DOWNSTREAM_USAGE_FLAT:   "downstream_usage_flat",
  ERROR_REPORT:            "error_report",
  COMPLAINT:               "complaint",
  DTU_PROMOTED:            "dtu_promoted",
  DTU_DEPRECATED:          "dtu_deprecated",
});

export const ALL_OUTCOME_SIGNALS = Object.freeze(Object.values(OUTCOME_SIGNALS));

// ── Outcome Categories (for weight learning) ─────────────────────────────────

const POSITIVE_OUTCOMES = new Set([
  OUTCOME_SIGNALS.USER_ACCEPTED,
  OUTCOME_SIGNALS.USER_REUSED,
  OUTCOME_SIGNALS.GOVERNANCE_APPROVED,
  OUTCOME_SIGNALS.CONTRADICTION_REDUCED,
  OUTCOME_SIGNALS.DOWNSTREAM_USAGE_UP,
  OUTCOME_SIGNALS.DTU_PROMOTED,
]);

const NEGATIVE_OUTCOMES = new Set([
  OUTCOME_SIGNALS.USER_REJECTED,
  OUTCOME_SIGNALS.GOVERNANCE_ROLLED_BACK,
  OUTCOME_SIGNALS.ERROR_REPORT,
  OUTCOME_SIGNALS.COMPLAINT,
  OUTCOME_SIGNALS.DTU_DEPRECATED,
]);

// ── Outcome Store ────────────────────────────────────────────────────────────

/**
 * Get or initialize the outcome tracking state.
 */
export function getOutcomeStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._outcomes) {
    es._outcomes = {
      // All recorded outcomes
      records: [],                    // OutcomeRecord[]

      // Indices for fast lookup
      byWorkItem: new Map(),          // workItemId -> [indices]
      byAllocation: new Map(),        // allocationId -> [indices]
      byEmergent: new Map(),          // emergentId -> [indices]
      byWorkType: new Map(),          // workItemType -> [indices]
      bySignal: new Map(),            // signalType -> [indices]

      // Aggregated stats for learning
      stats: {
        totalRecorded: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        successRateByType: {},        // workItemType -> { success, total, rate }
        successRateByRole: {},        // emergentRole -> { success, total, rate }
        successRateBySignalWeight: {},// signalName -> correlation with success
      },

      // Weight learning history
      weightUpdates: [],              // { timestamp, oldWeights, newWeights, reason, improvement }

      // Assignment learning: role -> workType performance
      rolePerformance: new Map(),     // `${role}:${workType}` -> { success, total, avgTurns }

      metrics: {
        totalOutcomes: 0,
        learningCycles: 0,
        weightAdjustments: 0,
        lastLearningCycle: null,
      },
    };
  }
  return es._outcomes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OUTCOME RECORDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record an outcome signal for a completed work item.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.workItemId - The work item this outcome relates to
 * @param {string} opts.allocationId - The allocation that produced it
 * @param {string} opts.signal - One of OUTCOME_SIGNALS
 * @param {string} [opts.emergentId] - Which emergent was primary
 * @param {string} [opts.workType] - Type of work item
 * @param {string} [opts.emergentRole] - Role of the primary emergent
 * @param {Object} [opts.context] - Additional context (DTU IDs, contradiction count, etc.)
 * @param {Object} [opts.signalValues] - The priority signal values at time of scheduling
 * @returns {{ ok: boolean, record?: Object }}
 */
export function recordOutcome(STATE, opts = {}) {
  const store = getOutcomeStore(STATE);

  if (!opts.signal || !ALL_OUTCOME_SIGNALS.includes(opts.signal)) {
    return { ok: false, error: "invalid_outcome_signal", provided: opts.signal, allowed: ALL_OUTCOME_SIGNALS };
  }

  if (!opts.workItemId && !opts.allocationId) {
    return { ok: false, error: "must_provide_workItemId_or_allocationId" };
  }

  const record = {
    recordId: `out_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    workItemId: opts.workItemId || null,
    allocationId: opts.allocationId || null,
    signal: opts.signal,
    category: POSITIVE_OUTCOMES.has(opts.signal) ? "positive"
            : NEGATIVE_OUTCOMES.has(opts.signal) ? "negative"
            : "neutral",
    emergentId: opts.emergentId || null,
    emergentRole: opts.emergentRole || null,
    workType: opts.workType || null,
    signalValues: opts.signalValues || null,   // snapshot of priority signals at scheduling time
    context: opts.context || {},
    timestamp: new Date().toISOString(),
  };

  const index = store.records.length;
  store.records.push(record);

  // Update indices
  indexOutcome(store, "byWorkItem", record.workItemId, index);
  indexOutcome(store, "byAllocation", record.allocationId, index);
  indexOutcome(store, "byEmergent", record.emergentId, index);
  indexOutcome(store, "byWorkType", record.workType, index);
  indexOutcome(store, "bySignal", record.signal, index);

  // Update aggregate stats
  store.stats.totalRecorded++;
  if (record.category === "positive") store.stats.positiveCount++;
  else if (record.category === "negative") store.stats.negativeCount++;
  else store.stats.neutralCount++;

  // Update per-type success rate
  if (record.workType) {
    if (!store.stats.successRateByType[record.workType]) {
      store.stats.successRateByType[record.workType] = { success: 0, total: 0, rate: 0 };
    }
    const typeStats = store.stats.successRateByType[record.workType];
    typeStats.total++;
    if (record.category === "positive") typeStats.success++;
    typeStats.rate = typeStats.success / typeStats.total;
  }

  // Update per-role success rate
  if (record.emergentRole) {
    if (!store.stats.successRateByRole[record.emergentRole]) {
      store.stats.successRateByRole[record.emergentRole] = { success: 0, total: 0, rate: 0 };
    }
    const roleStats = store.stats.successRateByRole[record.emergentRole];
    roleStats.total++;
    if (record.category === "positive") roleStats.success++;
    roleStats.rate = roleStats.success / roleStats.total;
  }

  // Update role:workType performance matrix
  if (record.emergentRole && record.workType) {
    const key = `${record.emergentRole}:${record.workType}`;
    if (!store.rolePerformance.has(key)) {
      store.rolePerformance.set(key, { success: 0, total: 0, avgTurns: 0, rate: 0 });
    }
    const perf = store.rolePerformance.get(key);
    perf.total++;
    if (record.category === "positive") perf.success++;
    perf.rate = perf.success / perf.total;
  }

  store.metrics.totalOutcomes++;

  return { ok: true, record };
}

/**
 * Get all outcomes for a specific work item.
 */
export function getOutcomesForWorkItem(STATE, workItemId) {
  const store = getOutcomeStore(STATE);
  const indices = store.byWorkItem.get(workItemId) || [];
  const outcomes = indices.map(i => store.records[i]).filter(Boolean);
  return { ok: true, outcomes, count: outcomes.length };
}

/**
 * Get all outcomes for a specific allocation.
 */
export function getOutcomesForAllocation(STATE, allocationId) {
  const store = getOutcomeStore(STATE);
  const indices = store.byAllocation.get(allocationId) || [];
  const outcomes = indices.map(i => store.records[i]).filter(Boolean);
  return { ok: true, outcomes, count: outcomes.length };
}

/**
 * Get all outcomes for a specific emergent.
 */
export function getOutcomesForEmergent(STATE, emergentId) {
  const store = getOutcomeStore(STATE);
  const indices = store.byEmergent.get(emergentId) || [];
  const outcomes = indices.map(i => store.records[i]).filter(Boolean);
  return { ok: true, outcomes, count: outcomes.length };
}

/**
 * Get outcome summary statistics.
 */
export function getOutcomeStats(STATE) {
  const store = getOutcomeStore(STATE);
  return {
    ok: true,
    stats: { ...store.stats },
    rolePerformance: Object.fromEntries(store.rolePerformance),
    metrics: { ...store.metrics },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SCHEDULER LEARNING — WEIGHT TUNING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a learning cycle: analyze recent outcomes and adjust scheduler weights.
 *
 * Algorithm:
 *   For each priority signal (impact, risk, etc.), compute the correlation
 *   between high signal values at scheduling time and positive outcomes.
 *   Signals that correlate with success get weight increases;
 *   signals that correlate with failure get weight decreases.
 *
 * Guardrails:
 *   - Maximum adjustment per cycle: ±0.05 per weight
 *   - Weights are clamped to [-0.5, 0.5]
 *   - Minimum 20 outcomes required before learning starts
 *   - Weight history is preserved for audit
 *
 * @param {Object} STATE - Global server state
 * @param {Object} [opts]
 * @param {number} [opts.minSamples=20] - Minimum outcomes before learning
 * @param {number} [opts.maxAdjustment=0.05] - Maximum weight change per signal
 * @param {number} [opts.lookback=100] - Number of recent outcomes to analyze
 * @returns {{ ok: boolean, adjustments?: Object, reason?: string }}
 */
export function runWeightLearning(STATE, opts = {}) {
  const store = getOutcomeStore(STATE);
  const sched = getScheduler(STATE);

  const minSamples = opts.minSamples || 20;
  const maxAdj = opts.maxAdjustment || 0.05;
  const lookback = opts.lookback || 100;

  // Guard: need enough data
  const recentRecords = store.records.slice(-lookback).filter(r => r.signalValues);
  if (recentRecords.length < minSamples) {
    return {
      ok: false,
      reason: "insufficient_data",
      available: recentRecords.length,
      required: minSamples,
    };
  }

  const oldWeights = { ...sched.weights };
  const signalNames = Object.keys(oldWeights);
  const adjustments = {};

  // For each signal, compute correlation with positive outcomes
  for (const signal of signalNames) {
    const positiveValues = [];
    const negativeValues = [];

    for (const record of recentRecords) {
      const val = record.signalValues[signal];
      if (val === undefined || val === null) continue;

      if (record.category === "positive") {
        positiveValues.push(val);
      } else if (record.category === "negative") {
        negativeValues.push(val);
      }
    }

    if (positiveValues.length < 3 && negativeValues.length < 3) continue;

    const avgPositive = positiveValues.length > 0
      ? positiveValues.reduce((a, b) => a + b, 0) / positiveValues.length
      : 0;
    const avgNegative = negativeValues.length > 0
      ? negativeValues.reduce((a, b) => a + b, 0) / negativeValues.length
      : 0;

    // If positive outcomes had higher signal values, increase weight
    // If negative outcomes had higher signal values, decrease weight
    const diff = avgPositive - avgNegative;
    const adjustment = clamp(diff * 0.1, -maxAdj, maxAdj);

    if (Math.abs(adjustment) > 0.001) {
      adjustments[signal] = {
        oldWeight: oldWeights[signal],
        adjustment: Math.round(adjustment * 1000) / 1000,
        newWeight: clamp(
          Math.round((oldWeights[signal] + adjustment) * 1000) / 1000,
          -0.5,
          0.5
        ),
        avgPositive: Math.round(avgPositive * 100) / 100,
        avgNegative: Math.round(avgNegative * 100) / 100,
        sampleSize: positiveValues.length + negativeValues.length,
      };

      sched.weights[signal] = adjustments[signal].newWeight;
    }
  }

  if (Object.keys(adjustments).length === 0) {
    return { ok: true, adjustments: {}, reason: "no_significant_adjustments" };
  }

  // Re-score the queue with new weights
  rescoreQueue(STATE);

  // Record the learning event
  store.weightUpdates.push({
    timestamp: new Date().toISOString(),
    oldWeights,
    newWeights: { ...sched.weights },
    adjustments,
    samplesUsed: recentRecords.length,
  });

  // Cap weight update history
  if (store.weightUpdates.length > 100) {
    store.weightUpdates = store.weightUpdates.slice(-50);
  }

  store.metrics.learningCycles++;
  store.metrics.weightAdjustments += Object.keys(adjustments).length;
  store.metrics.lastLearningCycle = new Date().toISOString();

  return {
    ok: true,
    adjustments,
    newWeights: { ...sched.weights },
    samplesUsed: recentRecords.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ASSIGNMENT TUNING — ROLE/WORK-TYPE OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the optimal role assignments for each work type based on outcome data.
 *
 * Returns a ranked list of roles for each work type, sorted by success rate.
 * This can be used to update the ROLE_AFFINITY table in the scheduler.
 *
 * @param {Object} STATE - Global server state
 * @param {number} [minSamples=5] - Minimum outcomes to consider a role viable
 * @returns {{ ok: boolean, recommendations: Object }}
 */
export function getAssignmentRecommendations(STATE, minSamples = 5) {
  const store = getOutcomeStore(STATE);
  const recommendations = {};

  // Group by work type
  const workTypes = new Set();
  for (const key of store.rolePerformance.keys()) {
    const [, workType] = key.split(":");
    workTypes.add(workType);
  }

  for (const workType of workTypes) {
    const roleScores = [];

    for (const [key, perf] of store.rolePerformance) {
      const [role, wt] = key.split(":");
      if (wt !== workType) continue;
      if (perf.total < minSamples) continue;

      roleScores.push({
        role,
        successRate: Math.round(perf.rate * 100) / 100,
        total: perf.total,
        success: perf.success,
      });
    }

    if (roleScores.length > 0) {
      roleScores.sort((a, b) => b.successRate - a.successRate);
      recommendations[workType] = {
        rankedRoles: roleScores,
        bestRole: roleScores[0].role,
        confidence: roleScores[0].total >= 20 ? "high" : roleScores[0].total >= 10 ? "medium" : "low",
      };
    }
  }

  return { ok: true, recommendations };
}

/**
 * Get the weight learning history (for audit/transparency).
 */
export function getWeightHistory(STATE) {
  const store = getOutcomeStore(STATE);
  return {
    ok: true,
    history: store.weightUpdates.slice(-20),
    totalUpdates: store.weightUpdates.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function indexOutcome(store, indexName, key, index) {
  if (!key) return;
  if (!store[indexName].has(key)) store[indexName].set(key, []);
  store[indexName].get(key).push(index);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
