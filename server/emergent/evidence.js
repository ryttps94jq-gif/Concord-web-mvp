/**
 * Emergent Agent Governance — Evidence Objects + Truth Maintenance
 *
 * Stage 6: External Grounding + Verification
 *
 * Evidence Objects (first-class):
 *   Every important claim/artifact can optionally attach:
 *     - source links / documents
 *     - measurements / datasets
 *     - test results
 *     - "verified / unverified / disputed" epistemic states
 *
 *   So the lattice can distinguish:
 *     "we believe" vs "we know" vs "we tested"
 *
 * Truth Maintenance System:
 *   When new evidence arrives:
 *     - confidence updates
 *     - deprecate stale DTUs
 *     - promote verified ones
 *     - keep history + rollback
 *
 *   This is what makes the lattice behave like science instead of a notebook.
 */

import { getEmergentState } from "./store.js";

// ── Epistemic States ─────────────────────────────────────────────────────────

export const EPISTEMIC_STATUS = Object.freeze({
  UNVERIFIED:   "unverified",    // no evidence attached
  BELIEVED:     "believed",      // some supporting evidence but not tested
  TESTED:       "tested",        // has test results (pass or fail)
  VERIFIED:     "verified",      // tested + passed + independently confirmed
  DISPUTED:     "disputed",      // contradicting evidence exists
  DEPRECATED:   "deprecated",    // superseded by newer evidence
  RETRACTED:    "retracted",     // evidence proved it wrong
});

export const ALL_EPISTEMIC_STATUSES = Object.freeze(Object.values(EPISTEMIC_STATUS));

// ── Evidence Types ───────────────────────────────────────────────────────────

export const EVIDENCE_TYPES = Object.freeze({
  SOURCE_LINK:       "source_link",        // URL or document reference
  MEASUREMENT:       "measurement",        // quantitative data point
  DATASET:           "dataset",            // structured data collection
  TEST_RESULT:       "test_result",        // pass/fail/error from verification
  EXPERT_OPINION:    "expert_opinion",     // human expert input
  CROSS_REFERENCE:   "cross_reference",    // confirmed by another DTU
  COMPUTATION:       "computation",        // result of a deterministic calculation
  EXTERNAL_API:      "external_api",       // result from an external data source
});

export const ALL_EVIDENCE_TYPES = Object.freeze(Object.values(EVIDENCE_TYPES));

// ── Evidence Store ───────────────────────────────────────────────────────────

/**
 * Get or initialize the evidence store.
 */
export function getEvidenceStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._evidence) {
    es._evidence = {
      evidence: new Map(),          // evidenceId -> Evidence
      byDtu: new Map(),             // dtuId -> Set<evidenceId>
      byType: new Map(),            // evidenceType -> Set<evidenceId>
      byStatus: new Map(),          // epistemicStatus -> Set<dtuId>

      // Truth maintenance log
      maintenanceLog: [],           // { timestamp, dtuId, oldStatus, newStatus, reason, evidenceId }

      // Confidence tracking
      confidenceMap: new Map(),     // dtuId -> { score, basis, history }

      metrics: {
        totalEvidence: 0,
        totalMaintenanceEvents: 0,
        dtusByStatus: {},
        verifiedCount: 0,
        disputedCount: 0,
        retractedCount: 0,
      },
    };
  }
  return es._evidence;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. EVIDENCE OBJECTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Attach evidence to a DTU.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.dtuId - DTU this evidence supports/refutes
 * @param {string} opts.type - One of EVIDENCE_TYPES
 * @param {string} opts.summary - What this evidence shows
 * @param {string} [opts.direction] - "supports" | "refutes" | "neutral"
 * @param {Object} [opts.data] - Structured evidence data (URL, value, result, etc.)
 * @param {number} [opts.strength] - How strong this evidence is (0-1)
 * @param {string} [opts.sourceId] - Provenance: who/what produced this evidence
 * @returns {{ ok: boolean, evidence?: Object, statusChanged?: boolean }}
 */
export function attachEvidence(STATE, opts = {}) {
  const store = getEvidenceStore(STATE);

  if (!opts.dtuId) return { ok: false, error: "dtuId_required" };
  if (!opts.type || !ALL_EVIDENCE_TYPES.includes(opts.type)) {
    return { ok: false, error: "invalid_evidence_type", allowed: ALL_EVIDENCE_TYPES };
  }
  if (!opts.summary) return { ok: false, error: "summary_required" };

  const evidenceId = `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const evidence = {
    evidenceId,
    dtuId: opts.dtuId,
    type: opts.type,
    summary: String(opts.summary).slice(0, 500),
    direction: opts.direction || "supports",  // supports | refutes | neutral
    data: opts.data || {},
    strength: clamp(opts.strength ?? 0.5, 0, 1),
    sourceId: opts.sourceId || null,
    timestamp: new Date().toISOString(),
    supersededBy: null,
  };

  store.evidence.set(evidenceId, evidence);

  // Index by DTU
  if (!store.byDtu.has(opts.dtuId)) store.byDtu.set(opts.dtuId, new Set());
  store.byDtu.get(opts.dtuId).add(evidenceId);

  // Index by type
  if (!store.byType.has(opts.type)) store.byType.set(opts.type, new Set());
  store.byType.get(opts.type).add(evidenceId);

  store.metrics.totalEvidence++;

  // Recompute epistemic status
  const statusChanged = recomputeEpistemicStatus(STATE, opts.dtuId);

  return { ok: true, evidence, statusChanged };
}

/**
 * Get all evidence for a DTU.
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - DTU to query
 * @returns {{ ok: boolean, evidence: Object[], epistemicStatus: string, confidence: Object }}
 */
export function getEvidenceForDtu(STATE, dtuId) {
  const store = getEvidenceStore(STATE);
  const evidenceIds = store.byDtu.get(dtuId);

  if (!evidenceIds || evidenceIds.size === 0) {
    return {
      ok: true,
      evidence: [],
      epistemicStatus: EPISTEMIC_STATUS.UNVERIFIED,
      confidence: { score: 0, basis: "no_evidence" },
    };
  }

  const evidence = [];
  for (const eid of evidenceIds) {
    const ev = store.evidence.get(eid);
    if (ev && !ev.supersededBy) evidence.push(ev);
  }

  const status = computeEpistemicStatus(evidence);
  const confidence = store.confidenceMap.get(dtuId) || { score: 0, basis: "no_evidence" };

  return { ok: true, evidence, epistemicStatus: status, confidence };
}

/**
 * Supersede evidence (mark old evidence as replaced by new).
 */
export function supersedeEvidence(STATE, oldEvidenceId, newEvidenceId) {
  const store = getEvidenceStore(STATE);
  const oldEv = store.evidence.get(oldEvidenceId);
  if (!oldEv) return { ok: false, error: "old_evidence_not_found" };

  const newEv = store.evidence.get(newEvidenceId);
  if (!newEv) return { ok: false, error: "new_evidence_not_found" };

  oldEv.supersededBy = newEvidenceId;

  // Recompute status for affected DTU
  if (oldEv.dtuId) {
    recomputeEpistemicStatus(STATE, oldEv.dtuId);
  }

  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TRUTH MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recompute the epistemic status of a DTU based on its evidence.
 * Records the transition in the maintenance log.
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - DTU to recompute
 * @returns {boolean} Whether the status changed
 */
export function recomputeEpistemicStatus(STATE, dtuId) {
  const store = getEvidenceStore(STATE);
  const evidenceIds = store.byDtu.get(dtuId);

  if (!evidenceIds || evidenceIds.size === 0) return false;

  // Get active (non-superseded) evidence
  const activeEvidence = [];
  for (const eid of evidenceIds) {
    const ev = store.evidence.get(eid);
    if (ev && !ev.supersededBy) activeEvidence.push(ev);
  }

  const newStatus = computeEpistemicStatus(activeEvidence);
  const oldStatus = getCurrentStatus(store, dtuId);

  if (newStatus === oldStatus) return false;

  // Record the transition
  const logEntry = {
    timestamp: new Date().toISOString(),
    dtuId,
    oldStatus,
    newStatus,
    reason: `Evidence recomputation: ${activeEvidence.length} pieces of evidence`,
    evidenceCount: activeEvidence.length,
  };
  store.maintenanceLog.push(logEntry);

  // Cap maintenance log
  if (store.maintenanceLog.length > 5000) {
    store.maintenanceLog = store.maintenanceLog.slice(-2500);
  }

  // Update status index
  removeFromStatusIndex(store, dtuId, oldStatus);
  addToStatusIndex(store, dtuId, newStatus);

  // Update confidence
  const confidence = computeConfidence(activeEvidence);
  store.confidenceMap.set(dtuId, {
    score: confidence,
    basis: newStatus,
    evidenceCount: activeEvidence.length,
    lastUpdated: logEntry.timestamp,
    history: [
      ...(store.confidenceMap.get(dtuId)?.history || []).slice(-20),
      { score: confidence, status: newStatus, timestamp: logEntry.timestamp },
    ],
  });

  // Update metrics
  store.metrics.totalMaintenanceEvents++;
  updateStatusCounts(store);

  return true;
}

/**
 * Deprecate a DTU's evidence status (mark as superseded by newer knowledge).
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - DTU to deprecate
 * @param {string} reason - Why it's being deprecated
 * @param {string} [supersededBy] - ID of the DTU that replaces it
 * @returns {{ ok: boolean }}
 */
export function deprecateDtu(STATE, dtuId, reason, supersededBy) {
  const store = getEvidenceStore(STATE);
  const oldStatus = getCurrentStatus(store, dtuId);

  removeFromStatusIndex(store, dtuId, oldStatus);
  addToStatusIndex(store, dtuId, EPISTEMIC_STATUS.DEPRECATED);

  store.maintenanceLog.push({
    timestamp: new Date().toISOString(),
    dtuId,
    oldStatus,
    newStatus: EPISTEMIC_STATUS.DEPRECATED,
    reason: reason || "deprecated",
    supersededBy: supersededBy || null,
  });

  store.metrics.totalMaintenanceEvents++;
  updateStatusCounts(store);

  return { ok: true };
}

/**
 * Retract a DTU (evidence proved it wrong).
 */
export function retractDtu(STATE, dtuId, reason, evidenceId) {
  const store = getEvidenceStore(STATE);
  const oldStatus = getCurrentStatus(store, dtuId);

  removeFromStatusIndex(store, dtuId, oldStatus);
  addToStatusIndex(store, dtuId, EPISTEMIC_STATUS.RETRACTED);

  store.maintenanceLog.push({
    timestamp: new Date().toISOString(),
    dtuId,
    oldStatus,
    newStatus: EPISTEMIC_STATUS.RETRACTED,
    reason: reason || "retracted",
    evidenceId: evidenceId || null,
  });

  store.metrics.totalMaintenanceEvents++;
  updateStatusCounts(store);

  return { ok: true };
}

/**
 * Get the truth maintenance log for a DTU.
 */
export function getMaintenanceHistory(STATE, dtuId) {
  const store = getEvidenceStore(STATE);
  const history = store.maintenanceLog.filter(e => e.dtuId === dtuId);
  const confidence = store.confidenceMap.get(dtuId);
  return {
    ok: true,
    dtuId,
    history,
    currentStatus: getCurrentStatus(store, dtuId),
    confidence: confidence || null,
  };
}

/**
 * Get DTUs by epistemic status.
 */
export function getDtusByStatus(STATE, status) {
  const store = getEvidenceStore(STATE);
  if (!ALL_EPISTEMIC_STATUSES.includes(status)) {
    return { ok: false, error: "invalid_status", allowed: ALL_EPISTEMIC_STATUSES };
  }
  const dtuIds = store.byStatus.get(status);
  return { ok: true, dtuIds: dtuIds ? Array.from(dtuIds) : [], count: dtuIds ? dtuIds.size : 0 };
}

/**
 * Get confidence scores across the lattice.
 */
export function getConfidenceMap(STATE, opts = {}) {
  const store = getEvidenceStore(STATE);
  const entries = [];

  for (const [dtuId, conf] of store.confidenceMap) {
    if (opts.minScore !== undefined && conf.score < opts.minScore) continue;
    if (opts.maxScore !== undefined && conf.score > opts.maxScore) continue;
    if (opts.status && conf.basis !== opts.status) continue;

    entries.push({ dtuId, ...conf, history: undefined });
  }

  entries.sort((a, b) => a.score - b.score);
  const limit = opts.limit || 50;

  return { ok: true, entries: entries.slice(0, limit), total: entries.length };
}

/**
 * Get evidence metrics.
 */
export function getEvidenceMetrics(STATE) {
  const store = getEvidenceStore(STATE);
  updateStatusCounts(store);
  return {
    ok: true,
    metrics: { ...store.metrics },
    totalEvidence: store.evidence.size,
    trackedDtus: store.byDtu.size,
    confidenceTracked: store.confidenceMap.size,
    maintenanceLogSize: store.maintenanceLog.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute epistemic status from a set of evidence.
 */
function computeEpistemicStatus(evidence) {
  if (evidence.length === 0) return EPISTEMIC_STATUS.UNVERIFIED;

  const supporting = evidence.filter(e => e.direction === "supports");
  const refuting = evidence.filter(e => e.direction === "refutes");
  const tests = evidence.filter(e => e.type === EVIDENCE_TYPES.TEST_RESULT);

  // If there are refuting pieces of evidence, it's disputed
  if (refuting.length > 0 && supporting.length > 0) {
    return EPISTEMIC_STATUS.DISPUTED;
  }

  // If only refuting evidence exists
  if (refuting.length > 0 && supporting.length === 0) {
    return EPISTEMIC_STATUS.RETRACTED;
  }

  // If we have passing test results
  const passingTests = tests.filter(e => e.data?.result === "pass" && e.direction === "supports");
  if (passingTests.length > 0) {
    // Cross-referenced = verified
    const crossRefs = evidence.filter(e => e.type === EVIDENCE_TYPES.CROSS_REFERENCE);
    if (crossRefs.length > 0 || passingTests.length > 1) {
      return EPISTEMIC_STATUS.VERIFIED;
    }
    return EPISTEMIC_STATUS.TESTED;
  }

  // Has supporting evidence but no tests
  if (supporting.length > 0) {
    return EPISTEMIC_STATUS.BELIEVED;
  }

  return EPISTEMIC_STATUS.UNVERIFIED;
}

/**
 * Compute numeric confidence from evidence.
 */
function computeConfidence(evidence) {
  if (evidence.length === 0) return 0;

  let score = 0;
  let totalWeight = 0;

  for (const ev of evidence) {
    const weight = ev.strength;
    const direction = ev.direction === "supports" ? 1 : ev.direction === "refutes" ? -1 : 0;
    score += weight * direction;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return clamp(Math.round((score / totalWeight) * 100) / 100, -1, 1);
}

function getCurrentStatus(store, dtuId) {
  for (const [status, dtuIds] of store.byStatus) {
    if (dtuIds.has(dtuId)) return status;
  }
  return EPISTEMIC_STATUS.UNVERIFIED;
}

function addToStatusIndex(store, dtuId, status) {
  if (!store.byStatus.has(status)) store.byStatus.set(status, new Set());
  store.byStatus.get(status).add(dtuId);
}

function removeFromStatusIndex(store, dtuId, status) {
  const set = store.byStatus.get(status);
  if (set) set.delete(dtuId);
}

function updateStatusCounts(store) {
  const counts = {};
  for (const [status, dtuIds] of store.byStatus) {
    counts[status] = dtuIds.size;
  }
  store.metrics.dtusByStatus = counts;
  store.metrics.verifiedCount = counts[EPISTEMIC_STATUS.VERIFIED] || 0;
  store.metrics.disputedCount = counts[EPISTEMIC_STATUS.DISPUTED] || 0;
  store.metrics.retractedCount = counts[EPISTEMIC_STATUS.RETRACTED] || 0;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
