/**
 * Trust Networks Between Emergents
 *
 * Emergents have individual reputation scores but no relational trust.
 * Builder doesn't have a trust score toward Critic. Historian doesn't
 * know which emergents have been reliable in the past.
 *
 * This module builds a directed trust graph:
 *   A ──trust(0.7)──→ B means A trusts B with weight 0.7
 *
 * Trust is earned through:
 *   - Validated contributions in shared sessions
 *   - Successful contradiction detection
 *   - Synthesis that both parties accepted
 *   - Calibrated predictions (predicted outcome matched)
 *
 * Trust decays with:
 *   - Echo behavior (uncritical agreement)
 *   - Failed predictions
 *   - Contradiction of previously promoted work
 *
 * Trust is directional and asymmetric — A trusting B
 * does not imply B trusting A.
 */

import { getEmergentState, getReputation } from "./store.js";

// ── Trust Graph Store ────────────────────────────────────────────────────────

function getTrustStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._trustNetwork) {
    es._trustNetwork = {
      // Directed trust edges: "fromId→toId" → TrustEdge
      edges: new Map(),

      // Per-emergent aggregate: emergentId → { trustedBy, trusts }
      aggregates: new Map(),

      metrics: {
        edgesCreated: 0,
        edgesUpdated: 0,
        eventsProcessed: 0,
        decaysApplied: 0,
      },
    };
  }
  return es._trustNetwork;
}

function trustKey(fromId, toId) {
  return `${fromId}→${toId}`;
}

// ── Trust Operations ─────────────────────────────────────────────────────────

/**
 * Get trust score from one emergent to another.
 *
 * @param {Object} STATE
 * @param {string} fromId - The truster
 * @param {string} toId - The trusted
 * @returns {{ ok, trust, history }}
 */
export function getTrust(STATE, fromId, toId) {
  const store = getTrustStore(STATE);
  const edge = store.edges.get(trustKey(fromId, toId));

  if (!edge) {
    return { ok: true, trust: 0.5, neutral: true, reason: "no_relationship" };
  }

  return {
    ok: true,
    trust: edge.score,
    neutral: false,
    interactions: edge.interactions,
    lastUpdated: edge.lastUpdated,
    factors: edge.factors,
  };
}

/**
 * Record a trust-building event between emergents.
 *
 * @param {Object} STATE
 * @param {Object} event
 * @param {string} event.fromId - The truster (observer)
 * @param {string} event.toId - The trusted (actor)
 * @param {string} event.type - Event type:
 *   "validated" — actor's contribution was validated by observer
 *   "synthesized" — actor successfully synthesized observer's work
 *   "contradiction_found" — actor found real contradiction
 *   "prediction_correct" — actor's prediction was confirmed
 *   "echo_detected" — actor echoed uncritically (trust decay)
 *   "prediction_wrong" — actor's prediction was wrong
 *   "promoted_then_contradicted" — actor promoted flawed work
 * @param {number} [event.weight=1.0] - Event strength multiplier
 * @returns {{ ok, newTrust }}
 */
export function recordTrustEvent(STATE, event = {}) {
  const { fromId, toId, type, weight = 1.0 } = event;
  if (!fromId || !toId || fromId === toId) {
    return { ok: false, error: "invalid_trust_event" };
  }

  const store = getTrustStore(STATE);
  const key = trustKey(fromId, toId);

  let edge = store.edges.get(key);
  if (!edge) {
    edge = {
      fromId,
      toId,
      score: 0.5, // neutral starting trust
      interactions: 0,
      factors: { validated: 0, synthesized: 0, contradictionFound: 0, predictionCorrect: 0, echoDetected: 0, predictionWrong: 0, promotedFlawed: 0 },
      history: [],
      createdAt: new Date().toISOString(),
      lastUpdated: null,
    };
    store.edges.set(key, edge);
    store.metrics.edgesCreated++;
  }

  // Trust deltas per event type
  const DELTAS = {
    validated: 0.05,
    synthesized: 0.06,
    contradiction_found: 0.08,
    prediction_correct: 0.07,
    echo_detected: -0.04,
    prediction_wrong: -0.05,
    promoted_then_contradicted: -0.08,
  };

  const delta = (DELTAS[type] || 0) * weight;
  edge.score = clamp(edge.score + delta, 0, 1);
  edge.interactions++;
  edge.lastUpdated = new Date().toISOString();

  // Track factors
  const factorKey = type.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (edge.factors[factorKey] !== undefined) {
    edge.factors[factorKey]++;
  }

  // History (keep last 50)
  edge.history.push({
    type,
    delta,
    scoreAfter: edge.score,
    timestamp: edge.lastUpdated,
  });
  if (edge.history.length > 50) edge.history = edge.history.slice(-50);

  // Update aggregates
  updateAggregate(store, fromId);
  updateAggregate(store, toId);

  store.metrics.eventsProcessed++;
  store.metrics.edgesUpdated++;

  return { ok: true, newTrust: edge.score, delta, interactions: edge.interactions };
}

/**
 * Process a completed dialogue session to extract trust events.
 * Called at session distillation time.
 *
 * @param {Object} STATE
 * @param {Object} session - Completed dialogue session
 * @returns {{ ok, eventsRecorded }}
 */
export function extractTrustFromSession(STATE, session) {
  if (!session?.participants || session.participants.length < 2) {
    return { ok: true, eventsRecorded: 0 };
  }

  let eventsRecorded = 0;
  const turns = session.turns || [];

  for (let i = 1; i < turns.length; i++) {
    const turn = turns[i];
    const prevTurn = turns[i - 1];

    if (!turn.speakerId || !prevTurn.speakerId) continue;
    if (turn.speakerId === prevTurn.speakerId) continue;

    // Synthesis turn validates the previous speaker
    if (turn.intent === "synthesis" || turn.intent === "integrate") {
      recordTrustEvent(STATE, {
        fromId: turn.speakerId,
        toId: prevTurn.speakerId,
        type: "synthesized",
      });
      eventsRecorded++;
    }

    // Counterpoint that was later resolved = validated
    if (turn.counterpoint && i + 1 < turns.length) {
      const nextTurn = turns[i + 1];
      if (nextTurn?.intent === "synthesis") {
        recordTrustEvent(STATE, {
          fromId: prevTurn.speakerId,
          toId: turn.speakerId,
          type: "validated",
        });
        eventsRecorded++;
      }
    }

    // Echo detection: if turn is too similar to previous
    if (turn._noveltyScore !== undefined && turn._noveltyScore < 0.1) {
      recordTrustEvent(STATE, {
        fromId: prevTurn.speakerId,
        toId: turn.speakerId,
        type: "echo_detected",
      });
      eventsRecorded++;
    }
  }

  return { ok: true, eventsRecorded };
}

/**
 * Get the full trust network for an emergent.
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @returns {{ ok, trusts, trustedBy, aggregate }}
 */
export function getEmergentTrustNetwork(STATE, emergentId) {
  const store = getTrustStore(STATE);
  const es = getEmergentState(STATE);

  const trusts = [];   // who this emergent trusts
  const trustedBy = []; // who trusts this emergent

  for (const [, edge] of store.edges) {
    if (edge.fromId === emergentId) {
      const emergent = es.emergents.get(edge.toId);
      trusts.push({
        emergentId: edge.toId,
        name: emergent?.name || "Unknown",
        role: emergent?.role || "unknown",
        trust: edge.score,
        interactions: edge.interactions,
      });
    }
    if (edge.toId === emergentId) {
      const emergent = es.emergents.get(edge.fromId);
      trustedBy.push({
        emergentId: edge.fromId,
        name: emergent?.name || "Unknown",
        role: emergent?.role || "unknown",
        trust: edge.score,
        interactions: edge.interactions,
      });
    }
  }

  trusts.sort((a, b) => b.trust - a.trust);
  trustedBy.sort((a, b) => b.trust - a.trust);

  const aggregate = store.aggregates.get(emergentId) || {
    avgTrustGiven: 0.5,
    avgTrustReceived: 0.5,
    trustsCount: 0,
    trustedByCount: 0,
  };

  return {
    ok: true,
    emergentId,
    trusts,
    trustedBy,
    aggregate,
  };
}

/**
 * Decay all trust edges by a factor (called periodically).
 * Trust decays toward neutral (0.5) over time.
 *
 * @param {Object} STATE
 * @param {number} [factor=0.01] - Decay toward 0.5
 * @returns {{ ok, decayed }}
 */
export function decayTrustNetwork(STATE, factor = 0.01) {
  const store = getTrustStore(STATE);
  let decayed = 0;

  for (const [, edge] of store.edges) {
    const distance = edge.score - 0.5;
    edge.score -= distance * factor;
    decayed++;
  }

  store.metrics.decaysApplied++;
  return { ok: true, decayed };
}

/**
 * Get trust network metrics.
 */
export function getTrustNetworkMetrics(STATE) {
  const store = getTrustStore(STATE);
  let highTrust = 0;
  let lowTrust = 0;

  for (const [, edge] of store.edges) {
    if (edge.score > 0.7) highTrust++;
    if (edge.score < 0.3) lowTrust++;
  }

  return {
    ok: true,
    totalEdges: store.edges.size,
    highTrustEdges: highTrust,
    lowTrustEdges: lowTrust,
    emergentsTracked: store.aggregates.size,
    ...store.metrics,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function updateAggregate(store, emergentId) {
  let trustGivenSum = 0;
  let trustGivenCount = 0;
  let trustReceivedSum = 0;
  let trustReceivedCount = 0;

  for (const [, edge] of store.edges) {
    if (edge.fromId === emergentId) {
      trustGivenSum += edge.score;
      trustGivenCount++;
    }
    if (edge.toId === emergentId) {
      trustReceivedSum += edge.score;
      trustReceivedCount++;
    }
  }

  store.aggregates.set(emergentId, {
    avgTrustGiven: trustGivenCount > 0 ? trustGivenSum / trustGivenCount : 0.5,
    avgTrustReceived: trustReceivedCount > 0 ? trustReceivedSum / trustReceivedCount : 0.5,
    trustsCount: trustGivenCount,
    trustedByCount: trustReceivedCount,
  });
}
