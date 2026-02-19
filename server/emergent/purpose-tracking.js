/**
 * Purpose Tracking with Closed Loops
 *
 * The lattice generates needs through computeLatticeNeeds().
 * Nobody tracks whether those needs got fulfilled.
 * A need appears, gets addressed, but the loop never closes.
 *
 * This module closes the loop:
 *   1. Need identified → recorded with ID and timestamp
 *   2. Work assigned → linked to need by needId
 *   3. Work completed → need fulfillment assessed
 *   4. Fulfillment confirmed → feedback signal: "this gap was filled"
 *   5. Learning: which needs recur, which stay filled, which approaches work
 *
 * Without closed loops the lattice can't learn what works.
 */

import { getEmergentState, getReputation } from "./store.js";
import { computeLatticeNeeds } from "./reality.js";

// ── Purpose Store ────────────────────────────────────────────────────────────

function getPurposeStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._purposeTracking) {
    es._purposeTracking = {
      // Active needs: needId → NeedRecord
      needs: new Map(),

      // Work assignments: workId → WorkRecord
      work: new Map(),

      // Fulfillment log: chronological closed loops
      fulfillments: [],

      // Recurrence tracking: needType → { count, lastSeen, avgFulfillmentMs }
      recurrence: new Map(),

      // Effectiveness tracking: approach → { attempted, succeeded, avgDuration }
      effectiveness: new Map(),

      seq: 0,

      metrics: {
        needsRecorded: 0,
        workAssigned: 0,
        workCompleted: 0,
        loopsClosed: 0,
        needsRecurred: 0,
        needsStayedFilled: 0,
      },
    };
  }
  return es._purposeTracking;
}

// ── Need Recording ───────────────────────────────────────────────────────────

/**
 * Record a lattice need. Called when computeLatticeNeeds() finds a gap.
 *
 * @param {Object} STATE
 * @param {Object} need - From computeLatticeNeeds()
 * @param {string} need.type - contradiction_resolution, confidence_investigation, etc.
 * @param {number} need.priority
 * @param {string[]} need.matchingRoles
 * @param {string} need.description
 * @returns {{ ok, needId }}
 */
export function recordNeed(STATE, need = {}) {
  const store = getPurposeStore(STATE);
  const needId = `need_${++store.seq}_${Date.now().toString(36)}`;

  // Check for recent duplicate (same type within last hour)
  for (const [, existing] of store.needs) {
    if (existing.type === need.type && existing.status === "open") {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < 3600_000) {
        return { ok: true, needId: existing.needId, deduplicated: true };
      }
    }
  }

  const record = {
    needId,
    type: need.type,
    priority: need.priority || 0.5,
    matchingRoles: need.matchingRoles || [],
    description: need.description || "",
    status: "open",              // open → assigned → fulfilled | unfulfilled | stale
    createdAt: new Date().toISOString(),
    assignedAt: null,
    fulfilledAt: null,
    assignedWorkId: null,
    fulfillmentAssessment: null,
  };

  store.needs.set(needId, record);

  // Track recurrence
  const recurrence = store.recurrence.get(need.type) || { count: 0, lastSeen: null, fulfillmentTimes: [] };
  recurrence.count++;
  recurrence.lastSeen = record.createdAt;
  store.recurrence.set(need.type, recurrence);
  if (recurrence.count > 1) store.metrics.needsRecurred++;

  store.metrics.needsRecorded++;
  return { ok: true, needId };
}

/**
 * Scan lattice needs and record any new ones.
 *
 * @param {Object} STATE
 * @returns {{ ok, newNeeds, existingNeeds }}
 */
export function scanAndRecordNeeds(STATE) {
  const { needs: latticeNeeds } = computeLatticeNeeds(STATE);
  let newNeeds = 0;
  let existingNeeds = 0;

  for (const need of latticeNeeds) {
    const result = recordNeed(STATE, need);
    if (result.ok && !result.deduplicated) newNeeds++;
    else existingNeeds++;
  }

  return { ok: true, newNeeds, existingNeeds, total: latticeNeeds.length };
}

// ── Work Assignment ──────────────────────────────────────────────────────────

/**
 * Assign work to address a need.
 *
 * @param {Object} STATE
 * @param {Object} assignment
 * @param {string} assignment.needId - The need being addressed
 * @param {string} assignment.emergentId - Who's doing the work
 * @param {string} assignment.approach - Description of the approach
 * @param {string} [assignment.sessionId] - Associated dialogue session
 * @returns {{ ok, workId }}
 */
export function assignWork(STATE, assignment = {}) {
  const store = getPurposeStore(STATE);
  if (!assignment.needId || !assignment.emergentId) {
    return { ok: false, error: "need_and_emergent_required" };
  }

  const need = store.needs.get(assignment.needId);
  if (!need) return { ok: false, error: "need_not_found" };

  const workId = `work_${++store.seq}_${Date.now().toString(36)}`;

  const work = {
    workId,
    needId: assignment.needId,
    emergentId: assignment.emergentId,
    approach: String(assignment.approach || "").slice(0, 500),
    sessionId: assignment.sessionId || null,
    status: "in_progress", // in_progress → completed → assessed
    createdAt: new Date().toISOString(),
    completedAt: null,
    assessment: null,
  };

  store.work.set(workId, work);
  need.status = "assigned";
  need.assignedAt = work.createdAt;
  need.assignedWorkId = workId;

  store.metrics.workAssigned++;
  return { ok: true, workId };
}

/**
 * Record work completion with outcome.
 *
 * @param {Object} STATE
 * @param {string} workId
 * @param {Object} outcome
 * @param {string} outcome.result - "completed"|"partial"|"failed"|"abandoned"
 * @param {string} [outcome.summary]
 * @param {Object} [outcome.evidence] - DTU ids, session ids that demonstrate work
 * @returns {{ ok }}
 */
export function completeWork(STATE, workId, outcome = {}) {
  const store = getPurposeStore(STATE);
  const work = store.work.get(workId);
  if (!work) return { ok: false, error: "work_not_found" };

  work.status = "completed";
  work.completedAt = new Date().toISOString();
  work.outcome = {
    result: outcome.result || "completed",
    summary: String(outcome.summary || "").slice(0, 500),
    evidence: outcome.evidence || {},
  };

  store.metrics.workCompleted++;
  return { ok: true };
}

// ── Fulfillment Assessment (Closing the Loop) ────────────────────────────────

/**
 * Assess whether a need was actually fulfilled.
 * This is the closed loop — did the work actually address the need?
 *
 * @param {Object} STATE
 * @param {string} needId
 * @param {Object} assessment
 * @param {boolean} assessment.fulfilled - Was the need genuinely met?
 * @param {string} [assessment.reason]
 * @param {string} [assessment.assessedBy] - Who made the assessment
 * @returns {{ ok, loopClosed }}
 */
export function assessFulfillment(STATE, needId, assessment = {}) {
  const store = getPurposeStore(STATE);
  const need = store.needs.get(needId);
  if (!need) return { ok: false, error: "need_not_found" };

  need.status = assessment.fulfilled ? "fulfilled" : "unfulfilled";
  need.fulfilledAt = new Date().toISOString();
  need.fulfillmentAssessment = {
    fulfilled: !!assessment.fulfilled,
    reason: String(assessment.reason || "").slice(0, 500),
    assessedBy: assessment.assessedBy || "system",
    timestamp: need.fulfilledAt,
  };

  // Track effectiveness of the approach
  const work = need.assignedWorkId ? store.work.get(need.assignedWorkId) : null;
  if (work) {
    const approach = work.approach || "unknown";
    const eff = store.effectiveness.get(approach) || { attempted: 0, succeeded: 0, durations: [] };
    eff.attempted++;
    if (assessment.fulfilled) eff.succeeded++;
    const duration = new Date(need.fulfilledAt).getTime() - new Date(need.createdAt).getTime();
    eff.durations.push(duration);
    if (eff.durations.length > 50) eff.durations = eff.durations.slice(-50);
    store.effectiveness.set(approach, eff);
  }

  // Track fulfillment time in recurrence data
  const recurrence = store.recurrence.get(need.type);
  if (recurrence && assessment.fulfilled) {
    const fulfillmentMs = new Date(need.fulfilledAt).getTime() - new Date(need.createdAt).getTime();
    recurrence.fulfillmentTimes.push(fulfillmentMs);
    if (recurrence.fulfillmentTimes.length > 50) recurrence.fulfillmentTimes = recurrence.fulfillmentTimes.slice(-50);
  }

  // Log the closed loop
  store.fulfillments.push({
    needId,
    needType: need.type,
    fulfilled: assessment.fulfilled,
    approach: work?.approach || "unknown",
    emergentId: work?.emergentId || null,
    durationMs: work ? new Date(need.fulfilledAt).getTime() - new Date(work.createdAt).getTime() : 0,
    timestamp: need.fulfilledAt,
  });
  if (store.fulfillments.length > 500) store.fulfillments = store.fulfillments.slice(-500);

  store.metrics.loopsClosed++;
  if (assessment.fulfilled) store.metrics.needsStayedFilled++;

  return { ok: true, loopClosed: true };
}

/**
 * Auto-assess stale needs (open for > 48 hours without assignment).
 *
 * @param {Object} STATE
 * @returns {{ ok, staleCount }}
 */
export function assessStaleNeeds(STATE) {
  const store = getPurposeStore(STATE);
  const now = Date.now();
  let staleCount = 0;

  for (const [, need] of store.needs) {
    if (need.status !== "open") continue;
    const age = now - new Date(need.createdAt).getTime();
    if (age > 48 * 3600_000) {
      need.status = "stale";
      staleCount++;
    }
  }

  return { ok: true, staleCount };
}

// ── Learning Queries ─────────────────────────────────────────────────────────

/**
 * What approaches work best for each need type?
 *
 * @param {Object} STATE
 * @returns {{ ok, effectiveness }}
 */
export function getEffectivenessReport(STATE) {
  const store = getPurposeStore(STATE);
  const report = [];

  for (const [approach, eff] of store.effectiveness) {
    const successRate = eff.attempted > 0 ? eff.succeeded / eff.attempted : 0;
    const avgDuration = eff.durations.length > 0
      ? eff.durations.reduce((a, b) => a + b, 0) / eff.durations.length
      : 0;

    report.push({
      approach,
      attempted: eff.attempted,
      succeeded: eff.succeeded,
      successRate: Math.round(successRate * 100) / 100,
      avgDurationMs: Math.round(avgDuration),
      avgDurationHours: Math.round((avgDuration / 3600_000) * 10) / 10,
    });
  }

  report.sort((a, b) => b.successRate - a.successRate);
  return { ok: true, effectiveness: report };
}

/**
 * Which needs recur most? Which stay filled?
 *
 * @param {Object} STATE
 * @returns {{ ok, recurrence }}
 */
export function getRecurrenceReport(STATE) {
  const store = getPurposeStore(STATE);
  const report = [];

  for (const [type, rec] of store.recurrence) {
    const avgFulfillmentMs = rec.fulfillmentTimes.length > 0
      ? rec.fulfillmentTimes.reduce((a, b) => a + b, 0) / rec.fulfillmentTimes.length
      : null;

    report.push({
      type,
      occurrences: rec.count,
      lastSeen: rec.lastSeen,
      fulfilledCount: rec.fulfillmentTimes.length,
      avgFulfillmentHours: avgFulfillmentMs
        ? Math.round((avgFulfillmentMs / 3600_000) * 10) / 10
        : null,
    });
  }

  report.sort((a, b) => b.occurrences - a.occurrences);
  return { ok: true, recurrence: report };
}

/**
 * Get all open needs with their current status.
 */
export function getOpenNeeds(STATE) {
  const store = getPurposeStore(STATE);
  const needs = [];

  for (const [, need] of store.needs) {
    if (need.status === "fulfilled" || need.status === "stale") continue;
    needs.push(need);
  }

  needs.sort((a, b) => b.priority - a.priority);
  return { ok: true, needs, count: needs.length };
}

/**
 * Get purpose tracking metrics.
 */
export function getPurposeMetrics(STATE) {
  const store = getPurposeStore(STATE);

  let open = 0;
  let assigned = 0;
  let fulfilled = 0;
  let unfulfilled = 0;
  let stale = 0;
  for (const [, need] of store.needs) {
    if (need.status === "open") open++;
    else if (need.status === "assigned") assigned++;
    else if (need.status === "fulfilled") fulfilled++;
    else if (need.status === "unfulfilled") unfulfilled++;
    else if (need.status === "stale") stale++;
  }

  return {
    ok: true,
    needsByStatus: { open, assigned, fulfilled, unfulfilled, stale },
    approachesTracked: store.effectiveness.size,
    needTypesTracked: store.recurrence.size,
    closedLoops: store.fulfillments.length,
    ...store.metrics,
  };
}
