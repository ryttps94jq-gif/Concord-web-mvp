/**
 * Consequence Cascading
 *
 * The reality.js consequence property tracks actions affecting reputation
 * but only one level deep. A DTU promotion doesn't cascade effects to
 * dependent DTUs. A governance decision doesn't propagate consequences
 * to affected domains.
 *
 * This module implements multi-hop consequence propagation:
 *   1. Source event (promotion, contradiction, merge, rejection)
 *   2. Identify affected nodes via edge traversal
 *   3. Apply cascading effects (confidence decay, activation boost, etc.)
 *   4. Record cascade path for auditability
 *
 * Consequences ripple through the graph but decay with distance.
 */

import { getEmergentState, getReputation } from "./store.js";
import { queryEdges, getNeighborhood } from "./edges.js";

// ── Cascade Types ────────────────────────────────────────────────────────────

export const CASCADE_TYPES = Object.freeze({
  PROMOTION:     "promotion",      // DTU promoted → dependent DTUs gain confidence
  CONTRADICTION: "contradiction",  // DTU contradicted → dependents lose confidence
  MERGE:         "merge",          // DTU merged → absorbed DTU edges redirect
  REJECTION:     "rejection",      // Proposal rejected → proposer reputation hit
  VALIDATION:    "validation",     // DTU validated → supporting DTUs gain confidence
});

// Decay per hop: consequence strength reduces by this factor each hop
const HOP_DECAY = 0.5;
// Max cascade depth
const MAX_CASCADE_DEPTH = 3;
// Minimum effect to continue cascading
const MIN_CASCADE_EFFECT = 0.005;

// ── Cascade Engine ───────────────────────────────────────────────────────────

function getCascadeStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._cascades) {
    es._cascades = {
      log: [],          // chronological cascade records (cap 500)
      metrics: {
        cascadesTriggered: 0,
        nodesAffected: 0,
        maxDepthReached: 0,
        totalEffectsApplied: 0,
      },
    };
  }
  return es._cascades;
}

/**
 * Cascade consequences from a source event through the edge graph.
 *
 * @param {Object} STATE
 * @param {Object} event
 * @param {string} event.type - CASCADE_TYPES value
 * @param {string} event.sourceDtuId - The DTU that triggered the cascade
 * @param {number} [event.magnitude=0.1] - Base effect strength
 * @param {string} [event.triggeredBy] - Who/what triggered this
 * @param {Object} [event.context] - Additional context
 * @returns {{ ok, cascadePath, nodesAffected, maxDepth }}
 */
export function cascadeConsequences(STATE, event = {}) {
  const { type, sourceDtuId, magnitude = 0.1, triggeredBy, context } = event;

  if (!sourceDtuId || !type) {
    return { ok: false, error: "source_and_type_required" };
  }

  const store = getCascadeStore(STATE);
  const cascadePath = [];
  const visited = new Set([sourceDtuId]);
  const queue = [{ dtuId: sourceDtuId, depth: 0, effect: magnitude }];
  let maxDepth = 0;

  while (queue.length > 0) {
    const { dtuId, depth, effect } = queue.shift();

    if (depth > MAX_CASCADE_DEPTH || effect < MIN_CASCADE_EFFECT) continue;
    if (depth > maxDepth) maxDepth = depth;

    // Apply effect to this DTU
    if (depth > 0) {
      const applied = applyCascadeEffect(STATE, dtuId, type, effect);
      cascadePath.push({
        dtuId,
        depth,
        effect: Math.round(effect * 1000) / 1000,
        applied: applied.applied,
        fieldAffected: applied.field,
      });
    }

    // Find connected DTUs via edges
    const neighborhood = getNeighborhood(STATE, dtuId);
    if (!neighborhood.ok) continue;

    const allEdges = [...(neighborhood.outgoing || []), ...(neighborhood.incoming || [])];

    for (const edge of allEdges) {
      const nextId = edge.sourceId === dtuId ? edge.targetId : edge.sourceId;
      if (visited.has(nextId)) continue;
      visited.add(nextId);

      // Edge type determines cascade propagation
      const propagation = getCascadePropagation(type, edge.edgeType);
      if (propagation <= 0) continue;

      const nextEffect = effect * HOP_DECAY * propagation * edge.weight;
      if (nextEffect >= MIN_CASCADE_EFFECT) {
        queue.push({ dtuId: nextId, depth: depth + 1, effect: nextEffect });
      }
    }
  }

  // Log the cascade
  const record = {
    type,
    sourceDtuId,
    triggeredBy: triggeredBy || "system",
    magnitude,
    nodesAffected: cascadePath.length,
    maxDepth,
    timestamp: new Date().toISOString(),
    context: context || null,
  };
  store.log.push(record);
  if (store.log.length > 500) store.log = store.log.slice(-500);

  store.metrics.cascadesTriggered++;
  store.metrics.nodesAffected += cascadePath.length;
  if (maxDepth > store.metrics.maxDepthReached) {
    store.metrics.maxDepthReached = maxDepth;
  }
  store.metrics.totalEffectsApplied += cascadePath.length;

  return {
    ok: true,
    cascadePath,
    nodesAffected: cascadePath.length,
    maxDepth,
  };
}

/**
 * Apply a cascade effect to a single DTU.
 *
 * @param {Object} STATE
 * @param {string} dtuId
 * @param {string} cascadeType
 * @param {number} effect - Signed magnitude
 * @returns {{ applied, field }}
 */
function applyCascadeEffect(STATE, dtuId, cascadeType, effect) {
  const dtu = STATE.dtus?.get(dtuId) || STATE.shadowDtus?.get(dtuId);
  if (!dtu) return { applied: false, field: null };

  switch (cascadeType) {
    case CASCADE_TYPES.PROMOTION:
    case CASCADE_TYPES.VALIDATION: {
      // Boost coherence of dependent DTUs
      dtu.coherence = clamp((dtu.coherence || 0.5) + effect, 0, 1);
      return { applied: true, field: "coherence" };
    }
    case CASCADE_TYPES.CONTRADICTION: {
      // Decay coherence of dependent DTUs
      dtu.coherence = clamp((dtu.coherence || 0.5) - effect, 0, 1);
      return { applied: true, field: "coherence" };
    }
    case CASCADE_TYPES.REJECTION: {
      // Reduce resonance
      dtu.resonance = clamp((dtu.resonance || 0.5) - effect * 0.5, 0, 1);
      return { applied: true, field: "resonance" };
    }
    case CASCADE_TYPES.MERGE: {
      // Boost stability (merged content is more settled)
      dtu.stability = clamp((dtu.stability || 0.5) + effect * 0.3, 0, 1);
      return { applied: true, field: "stability" };
    }
    default:
      return { applied: false, field: null };
  }
}

/**
 * Get cascade propagation factor for a given cascade type and edge type.
 * Some edge types propagate consequences more than others.
 *
 * @param {string} cascadeType
 * @param {string} edgeType
 * @returns {number} 0-1 propagation factor
 */
function getCascadePropagation(cascadeType, edgeType) {
  // Derives and supports propagate consequences strongly
  // Contradicts propagates inversely (contradiction of a contradiction → boost)
  // References and similar propagate weakly
  const matrix = {
    supports: 0.9,
    derives: 0.8,
    causes: 0.7,
    enables: 0.6,
    requires: 0.5,
    similar: 0.3,
    references: 0.2,
    parentOf: 0.4,
    contradicts: cascadeType === CASCADE_TYPES.CONTRADICTION ? 0.1 : -0.3,
  };
  return matrix[edgeType] ?? 0.1;
}

// ── Query & Metrics ──────────────────────────────────────────────────────────

/**
 * Get recent cascade log entries.
 */
export function getCascadeLog(STATE, limit = 50) {
  const store = getCascadeStore(STATE);
  const entries = store.log.slice(-limit).reverse();
  return { ok: true, entries, count: entries.length };
}

/**
 * Get cascade metrics.
 */
export function getCascadeMetrics(STATE) {
  const store = getCascadeStore(STATE);
  return { ok: true, ...store.metrics, logSize: store.log.length };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
