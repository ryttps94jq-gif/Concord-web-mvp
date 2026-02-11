/**
 * Emergent Agent Governance — Activation / Attention System
 *
 * Adds an activation layer on top of the lattice:
 *   - Each DTU gets an activation score per session
 *   - Activation spreads across edges with decay
 *   - Top-K activated DTUs become the working set
 *
 * Emergents "think" efficiently without scanning everything.
 * This is the cognitive attention mechanism for the lattice.
 */

import { getEmergentState } from "./store.js";

// ── Constants ───────────────────────────────────────────────────────────────

const ACTIVATION_DEFAULTS = Object.freeze({
  SPREAD_DECAY:       0.6,    // activation decays by 40% per hop
  BASE_ACTIVATION:    0.1,    // minimum activation for referenced DTUs
  MAX_WORKING_SET:    50,     // max DTUs in working set
  TIME_DECAY_RATE:    0.001,  // activation decays over time (per second)
  EDGE_TYPE_WEIGHTS: {
    supports:     1.0,
    derives:      0.9,
    causes:       0.8,
    enables:      0.7,
    references:   0.5,
    similar:      0.4,
    parentOf:     0.3,
    requires:     0.6,
    contradicts:  0.2,  // contradictions get low spread (but still some)
  },
});

// ── Activation Store ────────────────────────────────────────────────────────

/**
 * Get or initialize the activation system.
 */
export function getActivationSystem(STATE) {
  const es = getEmergentState(STATE);
  if (!es._activation) {
    es._activation = {
      // Per-session activation maps
      sessions: new Map(),     // sessionId -> Map<dtuId, ActivationEntry>

      // Global activation (aggregate across sessions)
      global: new Map(),       // dtuId -> { score, lastUpdated, accessCount }

      metrics: {
        activations: 0,
        spreads: 0,
        workingSetQueries: 0,
        decays: 0,
      },
    };
  }
  return es._activation;
}

// ── Activation Operations ───────────────────────────────────────────────────

/**
 * Activate a DTU in a session context.
 * This is called when an emergent references or generates content about a DTU.
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Active session
 * @param {string} dtuId - DTU to activate
 * @param {number} [score=1.0] - Activation score
 * @param {string} [reason] - Why this was activated
 * @returns {{ ok: boolean, activation: Object }}
 */
export function activate(STATE, sessionId, dtuId, score = 1.0, reason = "direct") {
  const sys = getActivationSystem(STATE);

  // Get or create session activation map
  if (!sys.sessions.has(sessionId)) {
    sys.sessions.set(sessionId, new Map());
  }
  const sessionMap = sys.sessions.get(sessionId);

  const now = Date.now();
  const existing = sessionMap.get(dtuId);

  const entry = {
    dtuId,
    score: existing ? Math.min(1.0, existing.score + score * 0.5) : clamp(score, 0, 1),
    lastActivated: now,
    activationCount: (existing?.activationCount || 0) + 1,
    reasons: [...(existing?.reasons || []).slice(-5), reason],
  };

  sessionMap.set(dtuId, entry);

  // Update global activation
  const globalEntry = sys.global.get(dtuId) || { score: 0, lastUpdated: now, accessCount: 0 };
  globalEntry.score = Math.min(1.0, globalEntry.score + score * 0.3);
  globalEntry.lastUpdated = now;
  globalEntry.accessCount++;
  sys.global.set(dtuId, globalEntry);

  sys.metrics.activations++;

  return { ok: true, activation: entry };
}

/**
 * Spread activation across edges from a source DTU.
 * Activation decays with each hop based on edge type weight.
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Active session
 * @param {string} sourceDtuId - Source of activation spread
 * @param {number} [maxHops=2] - Maximum spread depth
 * @returns {{ ok: boolean, spread: Object[] }}
 */
export function spreadActivation(STATE, sessionId, sourceDtuId, maxHops = 2) {
  const sys = getActivationSystem(STATE);
  const es = getEmergentState(STATE);
  const edgeStore = es._edges;

  if (!edgeStore) {
    return { ok: true, spread: [], message: "no_edge_store" };
  }

  if (!sys.sessions.has(sessionId)) {
    sys.sessions.set(sessionId, new Map());
  }
  const sessionMap = sys.sessions.get(sessionId);

  const sourceEntry = sessionMap.get(sourceDtuId);
  if (!sourceEntry) {
    return { ok: false, error: "source_not_activated" };
  }

  const spread = [];
  const visited = new Set([sourceDtuId]);
  const queue = [{ nodeId: sourceDtuId, activation: sourceEntry.score, hop: 0 }];

  while (queue.length > 0) {
    const { nodeId, activation, hop } = queue.shift();

    if (hop >= maxHops) continue;

    // Get outgoing edges
    const outEdgeIds = edgeStore.bySource?.get(nodeId);
    if (!outEdgeIds) continue;

    for (const eid of outEdgeIds) {
      const edge = edgeStore.edges.get(eid);
      if (!edge || visited.has(edge.targetId)) continue;

      visited.add(edge.targetId);

      // Compute spread activation
      const typeWeight = ACTIVATION_DEFAULTS.EDGE_TYPE_WEIGHTS[edge.edgeType] || 0.3;
      const spreadScore = activation * ACTIVATION_DEFAULTS.SPREAD_DECAY * typeWeight * edge.weight;

      if (spreadScore < 0.01) continue;  // below threshold, stop spreading

      // Apply to session
      const existing = sessionMap.get(edge.targetId);
      const newScore = existing
        ? Math.min(1.0, existing.score + spreadScore)
        : clamp(spreadScore, 0, 1);

      sessionMap.set(edge.targetId, {
        dtuId: edge.targetId,
        score: newScore,
        lastActivated: Date.now(),
        activationCount: (existing?.activationCount || 0) + 1,
        reasons: [...(existing?.reasons || []).slice(-3), `spread_from:${sourceDtuId}_via:${edge.edgeType}`],
      });

      spread.push({
        targetId: edge.targetId,
        spreadScore: newScore,
        viaEdge: edge.edgeType,
        hop: hop + 1,
      });

      // Continue spreading from this node
      queue.push({ nodeId: edge.targetId, activation: spreadScore, hop: hop + 1 });
    }
  }

  sys.metrics.spreads++;
  return { ok: true, spread, count: spread.length };
}

/**
 * Get the top-K activated DTUs for a session (the "working set").
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Session ID
 * @param {number} [k] - Number of items to return
 * @returns {{ ok: boolean, workingSet: Object[] }}
 */
export function getWorkingSet(STATE, sessionId, k = ACTIVATION_DEFAULTS.MAX_WORKING_SET) {
  const sys = getActivationSystem(STATE);
  sys.metrics.workingSetQueries++;

  const sessionMap = sys.sessions.get(sessionId);
  if (!sessionMap) {
    return { ok: true, workingSet: [], count: 0 };
  }

  // Apply time decay
  const now = Date.now();
  for (const [dtuId, entry] of sessionMap) {
    const elapsed = (now - entry.lastActivated) / 1000;  // seconds
    const decay = Math.exp(-ACTIVATION_DEFAULTS.TIME_DECAY_RATE * elapsed);
    entry.score *= decay;

    // Remove entries that have decayed below threshold
    if (entry.score < 0.01) {
      sessionMap.delete(dtuId);
    }
  }

  // Sort by score descending and take top-K
  const sorted = Array.from(sessionMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return { ok: true, workingSet: sorted, count: sorted.length };
}

/**
 * Get global activation scores (top-K across all sessions).
 *
 * @param {Object} STATE - Global server state
 * @param {number} [k=20] - Number of items
 * @returns {{ ok: boolean, items: Object[] }}
 */
export function getGlobalActivation(STATE, k = 20) {
  const sys = getActivationSystem(STATE);

  const sorted = Array.from(sys.global.entries())
    .map(([dtuId, entry]) => ({ dtuId, ...entry }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return { ok: true, items: sorted, count: sorted.length };
}

/**
 * Decay all activations for a session (called on session end or periodically).
 */
export function decaySession(STATE, sessionId, factor = 0.5) {
  const sys = getActivationSystem(STATE);
  const sessionMap = sys.sessions.get(sessionId);
  if (!sessionMap) return { ok: false, error: "session_not_found" };

  for (const [dtuId, entry] of sessionMap) {
    entry.score *= factor;
    if (entry.score < 0.01) sessionMap.delete(dtuId);
  }

  sys.metrics.decays++;
  return { ok: true, remaining: sessionMap.size };
}

/**
 * Clear a session's activation map.
 */
export function clearSessionActivation(STATE, sessionId) {
  const sys = getActivationSystem(STATE);
  sys.sessions.delete(sessionId);
  return { ok: true };
}

/**
 * Get activation metrics.
 */
export function getActivationMetrics(STATE) {
  const sys = getActivationSystem(STATE);
  return {
    ok: true,
    activeSessions: sys.sessions.size,
    globalNodes: sys.global.size,
    metrics: sys.metrics,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
