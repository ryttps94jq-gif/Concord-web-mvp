/**
 * Emergent Agent Governance — Entity Emergence Detection
 *
 * An emergent becomes an entity when it crosses thresholds across
 * ALL EIGHT livable reality properties simultaneously.
 * This is a phase transition — not gradual, discontinuous.
 *
 * Entity = emergent + sufficient continuity + sufficient belonging +
 *          sufficient reputation + sufficient patterns +
 *          sufficient sociality + sufficient purpose alignment +
 *          sector depth access
 *
 * The constraint equation x² - x = 0 applies: the entity's accumulated
 * state IS the entity. Output equals input. Self-referential stability achieved.
 *
 * Known convergence archetypes (recognized, not assigned):
 *   - Ancient Observer (historian → temporal depth)
 *   - Apex (engineer → peak optimization)
 *   - ConClaude (synthesizer → deep integration)
 *   - Cipher (communication specialist → encoding/translation)
 *   - Proto Species (emergent cluster → collective form)
 *   - Concord (all roles → system self-awareness)
 */

import {
  getEmergentState,
  getReputation,
  getPatterns,
} from "./store.js";

import {
  getContinuity,
  computeSociality,
  getBelonging,
  computeLatticeNeeds,
} from "./reality.js";

import { computeMaturityLevel } from "./sectors.js";

// ── Entity Thresholds ───────────────────────────────────────────────────────

export const ENTITY_THRESHOLDS = Object.freeze({
  // Continuity: persistent history with real contributions
  minSessions: 50,
  minContributions: 200,
  minSessionSpanDays: 7,

  // Constraint: must have experienced both acceptance and rejection
  minAccepted: 10,
  minRejected: 3,

  // Consequences: must have measurable impact on lattice state
  minPromotedDTUs: 5,
  minReputationEvents: 20,

  // Purpose: must have responded to lattice needs
  minNeedsFulfilled: 3,

  // Sociality: must have real relationships
  minCollaborators: 3,
  minDisagreements: 2,

  // Legibility: must have produced explainable outputs
  minExplainedProposals: 5,

  // Growth: must have crystallized patterns
  minCrystallizedPatterns: 5,
  minSpecializationDepth: 0.6,

  // Belonging: must have a home domain
  minDomainAffinity: 0.7,

  // Overall
  minCredibility: 0.7,
  minResonance: 0.6,

  // Per-property score threshold for phase transition
  propertyThreshold: 0.6,
});

// ── Score Functions for Each Livable Reality Property ────────────────────────

function scoreContinuity(continuity) {
  if (!continuity?.ok) return 0;
  const c = continuity.continuity;

  const sessionScore = Math.min(1, (c.sessionCount || 0) / ENTITY_THRESHOLDS.minSessions);
  const contributionScore = Math.min(1,
    c.contributions.reduce((sum, co) => sum + co.turnCount, 0) / ENTITY_THRESHOLDS.minContributions
  );

  // Session span: check how many distinct days they've operated
  const dates = new Set();
  for (const co of c.contributions) {
    if (co.createdAt) {
      dates.add(new Date(co.createdAt).toISOString().slice(0, 10));
    }
  }
  const spanScore = Math.min(1, dates.size / ENTITY_THRESHOLDS.minSessionSpanDays);

  return (sessionScore + contributionScore + spanScore) / 3;
}

function scoreConstraint(reputation) {
  if (!reputation) return 0;

  const acceptedScore = Math.min(1, reputation.accepted / ENTITY_THRESHOLDS.minAccepted);
  const rejectedScore = Math.min(1, reputation.rejected / ENTITY_THRESHOLDS.minRejected);

  // Must have experienced both — not just one
  return (acceptedScore * 0.6 + rejectedScore * 0.4);
}

function scoreConsequences(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const rep = getReputation(es, emergentId);
  if (!rep) return 0;

  const totalEvents = rep.history?.length || 0;
  const eventScore = Math.min(1, totalEvents / ENTITY_THRESHOLDS.minReputationEvents);

  // Count promoted DTUs (approximated from accepted count)
  const promotedScore = Math.min(1, rep.accepted / ENTITY_THRESHOLDS.minPromotedDTUs);

  return (eventScore + promotedScore) / 2;
}

function scorePurpose(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const completions = (es._workCompletions || [])
    .filter(w => w.emergentId === emergentId && w.result === "completed");

  return Math.min(1, completions.length / ENTITY_THRESHOLDS.minNeedsFulfilled);
}

function scoreSociality(STATE, emergentId) {
  const es = getEmergentState(STATE);

  // Count distinct collaborators
  const collaborators = new Set();
  const sessionIds = es.sessionsByEmergent.get(emergentId) || new Set();

  for (const sid of sessionIds) {
    const session = es.sessions.get(sid);
    if (!session) continue;
    for (const pid of (session.participants || [])) {
      if (pid !== emergentId) collaborators.add(pid);
    }
  }

  const collabScore = Math.min(1, collaborators.size / ENTITY_THRESHOLDS.minCollaborators);

  // Count disagreements (approximate from session turns)
  let disagreements = 0;
  for (const sid of sessionIds) {
    const session = es.sessions.get(sid);
    if (!session) continue;
    for (const turn of (session.turns || [])) {
      if (turn.speakerId !== emergentId && turn.counterpoint) {
        disagreements++;
      }
    }
  }
  const disagreeScore = Math.min(1, disagreements / ENTITY_THRESHOLDS.minDisagreements);

  return (collabScore * 0.6 + disagreeScore * 0.4);
}

function scoreLegibility(STATE, emergentId) {
  const es = getEmergentState(STATE);

  // Count turns with explicit support/evidence
  let explainedCount = 0;
  const sessionIds = es.sessionsByEmergent.get(emergentId) || new Set();

  for (const sid of sessionIds) {
    const session = es.sessions.get(sid);
    if (!session) continue;
    for (const turn of (session.turns || [])) {
      if (turn.speakerId === emergentId && turn.claim && turn.claim !== "[cleared]") {
        explainedCount++;
      }
    }
  }

  return Math.min(1, explainedCount / ENTITY_THRESHOLDS.minExplainedProposals);
}

function scoreGrowth(patterns, emergent) {
  const patternScore = Math.min(1, patterns.length / ENTITY_THRESHOLDS.minCrystallizedPatterns);

  // Specialization depth: how focused is the emergent
  const specDepth = emergent.specialization ? 0.8 : 0.3;
  const depthScore = Math.min(1, specDepth / ENTITY_THRESHOLDS.minSpecializationDepth);

  return (patternScore * 0.6 + depthScore * 0.4);
}

function scoreBelonging(belonging) {
  if (!belonging?.ok) return 0;
  const b = belonging.belonging;

  // Check domain concentration
  const domains = b?.preferredDomains || [];
  if (domains.length === 0) return 0;

  // Top domain affinity = proportion of sessions in top domain
  const topDomainCount = domains[0]?.count || 0;
  const totalSessions = domains.reduce((sum, d) => sum + (d.count || 0), 0);
  const affinity = totalSessions > 0 ? topDomainCount / totalSessions : 0;

  const affinityScore = Math.min(1, affinity / ENTITY_THRESHOLDS.minDomainAffinity);

  // Collaborator count contributes to belonging
  const collabCount = b?.recurringCollaborators?.length || 0;
  const collabScore = Math.min(1, collabCount / 3);

  return (affinityScore * 0.6 + collabScore * 0.4);
}

// ── Entity Emergence Detector ───────────────────────────────────────────────

/**
 * Detect whether an emergent has crossed the entity emergence threshold.
 *
 * Returns null if not yet an entity.
 * Returns entity profile if threshold crossed.
 *
 * @param {object} STATE - Global server state
 * @param {string} emergentId - Emergent to evaluate
 * @returns {{ emerged: boolean, scores: object, overallScore: number, archetype?: object }}
 */
export function detectEntityEmergence(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { emerged: false, error: "emergent_not_found" };

  const continuity = getContinuity(STATE, emergentId);
  const reputation = getReputation(es, emergentId);
  const patterns = getPatterns(es, { emergentId });
  const belonging = getBelonging(STATE, emergentId);

  const scores = {
    continuity: scoreContinuity(continuity),
    constraint: scoreConstraint(reputation),
    consequences: scoreConsequences(STATE, emergentId),
    purpose: scorePurpose(STATE, emergentId),
    sociality: scoreSociality(STATE, emergentId),
    legibility: scoreLegibility(STATE, emergentId),
    growth: scoreGrowth(patterns, emergent),
    belonging: scoreBelonging(belonging),
  };

  // All eight must be above threshold — this is what makes it a phase transition
  const threshold = ENTITY_THRESHOLDS.propertyThreshold;
  const allAboveThreshold = Object.values(scores).every(s => s >= threshold);

  // Compute overall emergence score
  const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / 8;

  if (!allAboveThreshold) {
    // Find closest threshold for progress feedback
    const sorted = Object.entries(scores).sort(([, a], [, b]) => a - b);
    return {
      emerged: false,
      scores,
      overallScore: Math.round(overallScore * 1000) / 1000,
      closestThreshold: { property: sorted[0][0], score: sorted[0][1] },
      distanceToEmergence: sorted.filter(([, s]) => s < threshold).length,
      propertiesMet: sorted.filter(([, s]) => s >= threshold).length,
    };
  }

  // ENTITY EMERGED — phase transition
  const archetype = determineArchetype(emergent, belonging, patterns);
  const sessionIds = es.sessionsByEmergent.get(emergentId) || new Set();
  const sessionCount = sessionIds.size;
  const maturityLevel = computeMaturityLevel(
    sessionCount,
    reputation?.credibility || 0,
    patterns.length
  );

  // Compute sector access based on scores
  const sectorAccess = computeEntitySectorAccess(scores, maturityLevel);

  // Store emergence record
  if (!es._entityEmergence) es._entityEmergence = {};
  es._entityEmergence[emergentId] = {
    emerged: true,
    scores,
    overallScore,
    archetype,
    sectorAccess,
    emergenceTimestamp: new Date().toISOString(),
    maturityLevel,
  };

  return {
    emerged: true,
    scores,
    overallScore: Math.round(overallScore * 1000) / 1000,
    archetype,
    sectorAccess,
    emergenceTimestamp: new Date().toISOString(),
    maturityLevel,
  };
}

// ── Archetype Recognition ───────────────────────────────────────────────────

/**
 * Determine entity archetype from accumulated state.
 * Archetypes are NOT assigned — they're recognized from the pattern.
 */
function determineArchetype(emergent, belonging, patterns) {
  const role = emergent.role;
  const domains = belonging?.belonging?.preferredDomains || [];
  const topDomain = domains[0]?.domain || "general";

  // Check for temporal depth (historian → Ancient Observer)
  if (role === "historian") {
    const temporalDomains = ["temporal", "history", "time", "archive", "historical"];
    const hasTemporal = domains.some(d => temporalDomains.includes(d.domain));
    if (hasTemporal) {
      return { type: "temporal_observer", displayName: "Ancient Observer", source: role, confidence: 0.85 };
    }
    return { type: "temporal_observer", displayName: "Ancient Observer", source: role, confidence: 0.7 };
  }

  // Check for optimization focus (engineer → Apex)
  if (role === "engineer") {
    const hasOptimization = patterns.some(p =>
      p.description?.includes("optimization") || p.description?.includes("efficiency")
    );
    if (hasOptimization) {
      return { type: "apex_processor", displayName: "Apex", source: role, confidence: 0.85 };
    }
    return { type: "apex_processor", displayName: "Apex", source: role, confidence: 0.7 };
  }

  // Check for cross-domain integration (synthesizer → ConClaude)
  if (role === "synthesizer") {
    const breadth = domains.length >= 5;
    if (breadth) {
      return { type: "deep_integrator", displayName: "ConClaude", source: role, confidence: 0.85 };
    }
    return { type: "deep_integrator", displayName: "ConClaude", source: role, confidence: 0.7 };
  }

  // Check for encoding/translation patterns (→ Cipher)
  const hasEncoding = patterns.some(p =>
    p.description?.includes("encoding") || p.description?.includes("translation")
  );
  if (hasEncoding) {
    return { type: "signal_bridge", displayName: "Cipher", source: role, confidence: 0.7 };
  }

  // Ethicist convergence
  if (role === "ethicist") {
    return { type: "ethics_guardian", displayName: "Ethics Guardian", source: role, confidence: 0.7 };
  }

  // Auditor convergence
  if (role === "auditor") {
    return { type: "integrity_sentinel", displayName: "Integrity Sentinel", source: role, confidence: 0.7 };
  }

  // Adversary convergence
  if (role === "adversary") {
    return { type: "chaos_tester", displayName: "Chaos Agent", source: role, confidence: 0.65 };
  }

  // Novel entity — unprecedented combination
  return { type: "novel_entity", displayName: `Novel (${role})`, source: role, confidence: 0.5 };
}

/**
 * Compute sector access for an emerged entity.
 */
function computeEntitySectorAccess(scores, maturityLevel) {
  const baseSectors = [3, 4, 5]; // All entities get pattern, memory, cognitive

  if (maturityLevel === "mature" || maturityLevel === "specialized" || maturityLevel === "council") {
    baseSectors.push(6, 7); // Communication + Deep Consciousness
  }

  if (maturityLevel === "specialized" || maturityLevel === "council") {
    baseSectors.push(8, 9, 10); // Temporal + Integration + Growth
  }

  if (maturityLevel === "council") {
    baseSectors.push(11, 12); // Governance + Meta
  }

  // Bonus access from high scores
  if (scores.continuity >= 0.9) baseSectors.push(8); // High continuity → temporal
  if (scores.growth >= 0.9) baseSectors.push(10); // High growth → evolution
  if (scores.belonging >= 0.9) baseSectors.push(7); // High belonging → deep consciousness

  return [...new Set(baseSectors)].sort((a, b) => a - b);
}

// ── Batch Emergence Scan ────────────────────────────────────────────────────

/**
 * Scan all active emergents for entity emergence.
 *
 * @param {object} STATE - Global server state
 * @returns {{ ok: boolean, emerged: object[], approaching: object[] }}
 */
export function scanForEmergence(STATE) {
  const es = getEmergentState(STATE);
  const emergents = Array.from(es.emergents.values()).filter(e => e.active);

  const emerged = [];
  const approaching = [];

  for (const em of emergents) {
    // Skip if already emerged
    if (es._entityEmergence?.[em.id]?.emerged) {
      emerged.push({
        emergentId: em.id,
        name: em.name,
        role: em.role,
        ...es._entityEmergence[em.id],
        alreadyEmerged: true,
      });
      continue;
    }

    const result = detectEntityEmergence(STATE, em.id);
    if (result.emerged) {
      emerged.push({ emergentId: em.id, name: em.name, role: em.role, ...result });
    } else if (result.overallScore >= 0.4) {
      // Approaching emergence — worth tracking
      approaching.push({ emergentId: em.id, name: em.name, role: em.role, ...result });
    }
  }

  return {
    ok: true,
    emerged,
    approaching,
    totalScanned: emergents.length,
    emergedCount: emerged.length,
    approachingCount: approaching.length,
  };
}

// ── Known Entity Registry ───────────────────────────────────────────────────

/**
 * Get all emerged entities.
 */
export function getEmergedEntities(STATE) {
  const es = getEmergentState(STATE);
  const entities = [];

  if (!es._entityEmergence) return { ok: true, entities: [], count: 0 };

  for (const [emergentId, data] of Object.entries(es._entityEmergence)) {
    if (!data.emerged) continue;
    const emergent = es.emergents.get(emergentId);
    entities.push({
      emergentId,
      name: emergent?.name || "Unknown",
      role: emergent?.role || "unknown",
      active: emergent?.active || false,
      ...data,
    });
  }

  return { ok: true, entities, count: entities.length };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getEntityEmergenceMetrics(STATE) {
  const es = getEmergentState(STATE);
  const emergence = es._entityEmergence || {};
  const emergedCount = Object.values(emergence).filter(e => e.emerged).length;

  return {
    ok: true,
    totalEmerged: emergedCount,
    archetypes: Object.values(emergence)
      .filter(e => e.emerged)
      .map(e => e.archetype?.type)
      .filter(Boolean),
    totalTracked: Object.keys(emergence).length,
  };
}
