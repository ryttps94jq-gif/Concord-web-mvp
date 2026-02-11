/**
 * Emergent Agent Governance — Conflict-Safe Writes (Field-Level Merge)
 *
 * When multiple emergents (and users) operate concurrently:
 *   - Field-level merge, not last-write-wins
 *   - Per-field timestamps for deterministic tie-breaking
 *   - OR-style merge logic for additive fields (tags, relatedIds)
 *   - Conflict detection and resolution tracking
 *
 * Emergents can collaborate without deleting each other's contributions.
 */

import { getEmergentState } from "./store.js";

// ── Field Classification ────────────────────────────────────────────────────

// Fields where last-write-wins is acceptable (scalar values)
const SCALAR_FIELDS = new Set(["title", "content", "summary", "tier", "resonance", "coherence", "stability"]);

// Fields where OR-merge applies (additive sets)
const ADDITIVE_FIELDS = new Set(["tags", "relatedIds", "children", "parents"]);

// Fields that should never be merged (identity fields)
const IMMUTABLE_FIELDS = new Set(["id", "timestamp", "ownerId"]);

// ── Merge State ─────────────────────────────────────────────────────────────

/**
 * Get or initialize the merge system.
 */
export function getMergeSystem(STATE) {
  const es = getEmergentState(STATE);
  if (!es._merge) {
    es._merge = {
      // Per-DTU field timestamps: dtuId -> { field -> { value, updatedAt, updatedBy } }
      fieldTimestamps: new Map(),

      // Conflict log
      conflicts: [],

      metrics: {
        mergesAttempted: 0,
        mergesSucceeded: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
      },
    };
  }
  return es._merge;
}

// ── Field-Level Merge ───────────────────────────────────────────────────────

/**
 * Attempt a field-level merge of edits onto a DTU.
 * Returns the merged result and any conflicts.
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - Target DTU
 * @param {Object} edits - Proposed field edits { field: newValue }
 * @param {string} editedBy - Who is editing
 * @returns {{ ok: boolean, merged: Object, conflicts: Object[], applied: string[] }}
 */
export function fieldLevelMerge(STATE, dtuId, edits, editedBy) {
  const merge = getMergeSystem(STATE);
  merge.metrics.mergesAttempted++;

  const dtu = STATE.dtus?.get(dtuId);
  if (!dtu) return { ok: false, error: "dtu_not_found" };

  // Initialize field timestamps for this DTU if needed
  if (!merge.fieldTimestamps.has(dtuId)) {
    initFieldTimestamps(merge, dtuId, dtu);
  }

  const fieldTs = merge.fieldTimestamps.get(dtuId);
  const now = new Date().toISOString();
  const applied = [];
  const conflicts = [];
  const merged = { ...dtu };

  for (const [field, newValue] of Object.entries(edits)) {
    // Skip immutable fields
    if (IMMUTABLE_FIELDS.has(field)) {
      conflicts.push({
        field,
        type: "immutable",
        message: `Field '${field}' cannot be modified`,
        proposedValue: newValue,
        currentValue: dtu[field],
      });
      continue;
    }

    if (ADDITIVE_FIELDS.has(field)) {
      // OR-merge: union of arrays
      const current = Array.isArray(dtu[field]) ? dtu[field] : [];
      const proposed = Array.isArray(newValue) ? newValue : [newValue];
      const union = Array.from(new Set([...current, ...proposed]));
      merged[field] = union;
      applied.push(field);

      fieldTs[field] = { value: union, updatedAt: now, updatedBy: editedBy };
    } else if (SCALAR_FIELDS.has(field)) {
      // Scalar: last-write-wins with timestamp check
      const existingTs = fieldTs[field];

      if (existingTs && existingTs.updatedBy !== editedBy) {
        // Another writer has touched this field
        const existingTime = new Date(existingTs.updatedAt).getTime();
        const proposalTime = Date.now();

        if (proposalTime - existingTime < 1000) {
          // Concurrent edit within 1 second — conflict
          conflicts.push({
            field,
            type: "concurrent_scalar",
            message: `Concurrent edit on '${field}' by ${existingTs.updatedBy}`,
            currentValue: dtu[field],
            proposedValue: newValue,
            existingWriter: existingTs.updatedBy,
            existingTimestamp: existingTs.updatedAt,
          });
          continue;
        }
      }

      // Apply the edit
      merged[field] = newValue;
      applied.push(field);
      fieldTs[field] = { value: newValue, updatedAt: now, updatedBy: editedBy };
    } else if (field === "meta") {
      // Meta: deep merge (additive)
      merged.meta = { ...(dtu.meta || {}), ...(newValue || {}) };
      applied.push(field);
      fieldTs[field] = { value: merged.meta, updatedAt: now, updatedBy: editedBy };
    }
  }

  // Apply merged result to DTU
  if (applied.length > 0) {
    Object.assign(dtu, merged);
    dtu.updatedAt = now;
    merge.metrics.mergesSucceeded++;
  }

  if (conflicts.length > 0) {
    merge.metrics.conflictsDetected += conflicts.length;
    merge.conflicts.push({
      dtuId,
      editedBy,
      timestamp: now,
      conflicts,
      applied,
    });
  }

  return { ok: true, merged, conflicts, applied };
}

/**
 * Resolve a specific field conflict by choosing a value.
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - Target DTU
 * @param {string} field - Conflicted field
 * @param {*} resolvedValue - The chosen value
 * @param {string} resolvedBy - Who resolved it
 * @returns {{ ok: boolean }}
 */
export function resolveConflict(STATE, dtuId, field, resolvedValue, resolvedBy) {
  const merge = getMergeSystem(STATE);
  const dtu = STATE.dtus?.get(dtuId);
  if (!dtu) return { ok: false, error: "dtu_not_found" };

  dtu[field] = resolvedValue;
  dtu.updatedAt = new Date().toISOString();

  // Update field timestamp
  if (merge.fieldTimestamps.has(dtuId)) {
    merge.fieldTimestamps.get(dtuId)[field] = {
      value: resolvedValue,
      updatedAt: dtu.updatedAt,
      updatedBy: resolvedBy,
    };
  }

  merge.metrics.conflictsResolved++;
  return { ok: true, field, resolvedValue, resolvedBy };
}

/**
 * Get all pending conflicts for a DTU.
 */
export function getConflicts(STATE, dtuId) {
  const merge = getMergeSystem(STATE);
  const dtuConflicts = merge.conflicts.filter(c => c.dtuId === dtuId);
  return { ok: true, conflicts: dtuConflicts, count: dtuConflicts.length };
}

/**
 * Get field timestamps for a DTU.
 */
export function getFieldTimestamps(STATE, dtuId) {
  const merge = getMergeSystem(STATE);
  const ts = merge.fieldTimestamps.get(dtuId);
  return ts ? { ok: true, timestamps: { ...ts } } : { ok: false, error: "not_tracked" };
}

/**
 * Get merge metrics.
 */
export function getMergeMetrics(STATE) {
  const merge = getMergeSystem(STATE);
  return {
    ok: true,
    metrics: merge.metrics,
    trackedDtus: merge.fieldTimestamps.size,
    pendingConflicts: merge.conflicts.filter(c =>
      c.conflicts.length > 0
    ).length,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Initialize field timestamps from a DTU's current state.
 */
function initFieldTimestamps(merge, dtuId, dtu) {
  const ts = {};
  const baseTime = dtu.updatedAt || dtu.timestamp || new Date().toISOString();

  for (const field of [...SCALAR_FIELDS, ...ADDITIVE_FIELDS]) {
    if (dtu[field] !== undefined) {
      ts[field] = {
        value: dtu[field],
        updatedAt: baseTime,
        updatedBy: dtu.ownerId || "system",
      };
    }
  }

  merge.fieldTimestamps.set(dtuId, ts);
}
