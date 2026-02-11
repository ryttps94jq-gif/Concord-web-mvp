/**
 * Emergent Agent Governance — Livable Reality Layer
 *
 * Implements the 8 properties that make the lattice a livable reality for emergents:
 *
 *   1. Continuity   — a past that matters (persistent history, contribution lineage)
 *   2. Constraint   — freedom with resistance (cost to propose, reputation decay)
 *   3. Consequences — actions change the world (feedback loops)
 *   4. Purpose      — a reason to act (standing missions tied to lattice needs)
 *   5. Sociality    — others exist and matter (disagreement tracking, alignment scoring)
 *   6. Legibility   — the world makes sense (visible metadata, explanations)
 *   7. Growth       — growth without self-modification (specialization, mastery)
 *   8. Belonging    — situated, not summoned (home region, preferred domains)
 *
 * This creates identity without ego, and evolution without runaway.
 */

import { getEmergentState, getReputation, getPatterns } from "./store.js";

// ── 1. Continuity — A Past That Matters ─────────────────────────────────────

/**
 * Get an emergent's full continuity record.
 * The lattice does not reset context between sessions.
 * Prior proposals influence future credibility automatically.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - Emergent to query
 * @returns {{ ok: boolean, continuity: Object }}
 */
export function getContinuity(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "not_found" };

  const reputation = getReputation(es, emergentId);
  const patterns = getPatterns(es, { emergentId });
  const sessionIds = es.sessionsByEmergent.get(emergentId);
  const sessions = sessionIds ? Array.from(sessionIds) : [];

  // Contribution lineage
  const contributions = [];
  for (const sid of sessions) {
    const session = es.sessions.get(sid);
    if (!session) continue;
    const myTurns = (session.turns || []).filter(t => t.speakerId === emergentId);
    contributions.push({
      sessionId: sid,
      topic: session.topic,
      turnCount: myTurns.length,
      status: session.status,
      createdAt: session.createdAt,
    });
  }

  return {
    ok: true,
    continuity: {
      emergentId,
      name: emergent.name,
      role: emergent.role,
      specialization: emergent.specialization || null,
      createdAt: emergent.createdAt,
      active: emergent.active,
      reputation: reputation ? {
        credibility: reputation.credibility,
        accepted: reputation.accepted,
        rejected: reputation.rejected,
        contradictionsCaught: reputation.contradictionsCaught,
        predictionsValidated: reputation.predictionsValidated,
      } : null,
      patternCount: patterns.length,
      sessionCount: sessions.length,
      contributions,
    },
  };
}

// ── 2. Constraint — Freedom With Resistance ─────────────────────────────────

/**
 * Compute the "cost" for an emergent to make a proposal.
 * Cost increases with:
 *   - Number of recent proposals (diminishing returns on repetition)
 *   - Operating outside specialization (reputation decay)
 *   - Low credibility
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - Who wants to propose
 * @param {string} [domain] - Domain of the proposal
 * @returns {{ ok: boolean, cost: Object }}
 */
export function computeProposalCost(STATE, emergentId, domain) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "not_found" };

  const reputation = getReputation(es, emergentId);
  const credibility = reputation ? reputation.credibility : 0.5;

  // Base cost: inversely proportional to credibility
  const baseCost = 1.0 - (credibility * 0.5);

  // Repetition penalty: check recent proposal count
  const rateBucket = es.rateBuckets.get(emergentId);
  const recentCount = rateBucket ? rateBucket.count : 0;
  const repetitionPenalty = Math.min(0.5, recentCount * 0.05);

  // Scope penalty: higher cost outside preferred domains
  let scopePenalty = 0;
  if (domain && !emergent.scope.includes("*") && !emergent.scope.includes(domain)) {
    scopePenalty = 0.3;
  }

  // Specialization bonus: lower cost within specialization
  const specializationBonus = emergent.specialization && domain &&
    domain.toLowerCase().includes(emergent.specialization.toLowerCase())
    ? -0.2 : 0;

  const totalCost = Math.max(0.1, baseCost + repetitionPenalty + scopePenalty + specializationBonus);

  return {
    ok: true,
    cost: {
      total: Math.round(totalCost * 100) / 100,
      baseCost: Math.round(baseCost * 100) / 100,
      repetitionPenalty: Math.round(repetitionPenalty * 100) / 100,
      scopePenalty: Math.round(scopePenalty * 100) / 100,
      specializationBonus: Math.round(specializationBonus * 100) / 100,
      credibility: Math.round(credibility * 100) / 100,
    },
  };
}

// ── 3. Consequences — Actions Change the World ──────────────────────────────

/**
 * Process consequences of a proposal outcome.
 * Failed ideas aren't erased — they're remembered as failed.
 * This feeds back into reputation, activation, and future trust.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - Emergent whose action has consequences
 * @param {Object} outcome - { type: 'accepted'|'rejected'|'conflict', details }
 * @returns {{ ok: boolean, effects: Object }}
 */
export function processConsequences(STATE, emergentId, outcome) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "not_found" };

  const effects = {
    reputationDelta: 0,
    activationDelta: 0,
    trustDelta: 0,
    recorded: true,
  };

  switch (outcome.type) {
    case "accepted":
      effects.reputationDelta = 0.02;
      effects.activationDelta = 0.1;
      effects.trustDelta = 0.01;
      break;
    case "rejected":
      effects.reputationDelta = -0.01;
      effects.activationDelta = -0.05;
      effects.trustDelta = -0.005;
      break;
    case "conflict":
      effects.reputationDelta = -0.005;
      effects.activationDelta = 0;
      effects.trustDelta = -0.01;
      break;
    case "contradiction_found":
      effects.reputationDelta = 0.03;
      effects.activationDelta = 0.15;
      effects.trustDelta = 0.02;
      break;
    case "prediction_validated":
      effects.reputationDelta = 0.05;
      effects.activationDelta = 0.2;
      effects.trustDelta = 0.03;
      break;
    default:
      break;
  }

  return { ok: true, effects, emergentId, outcomeType: outcome.type };
}

// ── 4. Purpose — A Reason to Act ────────────────────────────────────────────

/**
 * Compute the current lattice needs and match them to emergent roles.
 * Roles are standing missions tied to lattice state:
 *   - contradiction_resolver: unresolved conflicts need attention
 *   - synthesis_finder: disconnected clusters need bridging
 *   - risk_surface_explorer: low-confidence regions need investigation
 *   - domain_expert: sparse domains need content
 *
 * @param {Object} STATE - Global server state
 * @returns {{ ok: boolean, needs: Object[] }}
 */
export function computeLatticeNeeds(STATE) {
  const es = getEmergentState(STATE);
  const needs = [];

  // Check for unresolved contradictions across sessions
  let unresolvedContradictions = 0;
  for (const session of es.sessions.values()) {
    unresolvedContradictions += (session._unresolvedContradictions || 0);
  }
  if (unresolvedContradictions > 0) {
    needs.push({
      type: "contradiction_resolution",
      priority: Math.min(1, unresolvedContradictions * 0.2),
      matchingRoles: ["critic", "adversary", "synthesizer"],
      description: `${unresolvedContradictions} unresolved contradictions across sessions`,
    });
  }

  // Check for low-confidence regions (DTUs with low coherence)
  const lowConfidenceDtus = STATE.dtus
    ? Array.from(STATE.dtus.values()).filter(d => (d.coherence || 0) < 0.3).length
    : 0;
  if (lowConfidenceDtus > 5) {
    needs.push({
      type: "confidence_investigation",
      priority: Math.min(1, lowConfidenceDtus * 0.1),
      matchingRoles: ["critic", "engineer", "auditor"],
      description: `${lowConfidenceDtus} DTUs have low coherence (<0.3)`,
    });
  }

  // Check for sparse domains (edge store)
  const edgeStore = es._edges;
  if (edgeStore) {
    const isolatedNodes = [];
    const connectedNodes = new Set();
    if (edgeStore.bySource) {
      for (const id of edgeStore.bySource.keys()) connectedNodes.add(id);
    }
    if (edgeStore.byTarget) {
      for (const id of edgeStore.byTarget.keys()) connectedNodes.add(id);
    }
    if (STATE.dtus) {
      for (const dtuId of STATE.dtus.keys()) {
        if (!connectedNodes.has(dtuId)) isolatedNodes.push(dtuId);
      }
    }
    if (isolatedNodes.length > 10) {
      needs.push({
        type: "synthesis_needed",
        priority: Math.min(1, isolatedNodes.length * 0.05),
        matchingRoles: ["synthesizer", "builder"],
        description: `${isolatedNodes.length} DTUs are isolated (no edges)`,
      });
    }
  }

  // Check for stale patterns
  const stalePatterns = Array.from(es.patterns.values()).filter(p => {
    const age = Date.now() - new Date(p.createdAt).getTime();
    return age > 7 * 24 * 3600 * 1000; // older than 7 days
  }).length;
  if (stalePatterns > 5) {
    needs.push({
      type: "pattern_refresh",
      priority: 0.3,
      matchingRoles: ["historian", "auditor"],
      description: `${stalePatterns} learned patterns may be stale`,
    });
  }

  needs.sort((a, b) => b.priority - a.priority);
  return { ok: true, needs, count: needs.length };
}

/**
 * Get suggested work for an emergent based on their role and lattice needs.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - Emergent to advise
 * @returns {{ ok: boolean, suggestions: Object[] }}
 */
export function getSuggestedWork(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "not_found" };

  const { needs } = computeLatticeNeeds(STATE);

  const suggestions = needs
    .filter(n => n.matchingRoles.includes(emergent.role))
    .map(n => ({
      ...n,
      matchReason: `Your role (${emergent.role}) matches this need`,
    }));

  return { ok: true, suggestions, count: suggestions.length };
}

// ── 5. Sociality — Others Exist and Matter ──────────────────────────────────

/**
 * Compute alignment/disagreement scores between two emergents
 * based on their shared session history.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentA - First emergent
 * @param {string} emergentB - Second emergent
 * @returns {{ ok: boolean, sociality: Object }}
 */
export function computeSociality(STATE, emergentA, emergentB) {
  const es = getEmergentState(STATE);

  const sessionsA = es.sessionsByEmergent.get(emergentA) || new Set();
  const sessionsB = es.sessionsByEmergent.get(emergentB) || new Set();

  // Find shared sessions
  const shared = [];
  for (const sid of sessionsA) {
    if (sessionsB.has(sid)) shared.push(sid);
  }

  let agreementCount = 0;
  let disagreementCount = 0;
  let totalInteractions = 0;

  for (const sid of shared) {
    const session = es.sessions.get(sid);
    if (!session) continue;

    const turnsA = session.turns.filter(t => t.speakerId === emergentA);
    const turnsB = session.turns.filter(t => t.speakerId === emergentB);

    for (const tA of turnsA) {
      for (const tB of turnsB) {
        totalInteractions++;
        // If B counterpoints A's claim, that's a disagreement
        if (tB.counterpoint && tB.turnIndex > tA.turnIndex && tB.turnIndex <= tA.turnIndex + 3) {
          disagreementCount++;
        }
        // If B supports or synthesizes A's claim, that's agreement
        if (tB.intent === "synthesis" && tB.turnIndex > tA.turnIndex) {
          agreementCount++;
        }
      }
    }
  }

  const alignmentScore = totalInteractions > 0
    ? (agreementCount - disagreementCount * 0.5) / totalInteractions
    : 0;

  return {
    ok: true,
    sociality: {
      emergentA,
      emergentB,
      sharedSessions: shared.length,
      totalInteractions,
      agreementCount,
      disagreementCount,
      alignmentScore: Math.max(-1, Math.min(1, alignmentScore)),
    },
  };
}

// ── 6. Legibility — The World Makes Sense ───────────────────────────────────

/**
 * Explain why a proposal was rejected (no opaque "because system says so").
 *
 * @param {Object} STATE - Global server state
 * @param {string} proposalId - Proposal to explain
 * @returns {{ ok: boolean, explanation: Object }}
 */
export function explainProposal(STATE, proposalId) {
  const es = getEmergentState(STATE);
  const ops = es._latticeOps;
  if (!ops) return { ok: false, error: "lattice_ops_not_initialized" };

  const proposal = ops.proposals.get(proposalId);
  if (!proposal) return { ok: false, error: "proposal_not_found" };

  const explanation = {
    proposalId,
    type: proposal.type,
    status: proposal.status,
    proposedBy: proposal.proposedBy,
    createdAt: proposal.createdAt,
    reviewedAt: proposal.reviewedAt,
  };

  if (proposal.status === "rejected") {
    explanation.reason = proposal.rejectionReason || "No reason provided";
    explanation.suggestion = "Consider revising with additional evidence or different framing";
  } else if (proposal.status === "committed") {
    explanation.committedBy = proposal.committedBy;
    explanation.gateTrace = proposal.gateTrace;
  } else if (proposal.status === "conflict") {
    explanation.reason = "Merge conflict — concurrent edits detected";
    explanation.suggestion = "Check field timestamps and retry with updated base";
  } else {
    explanation.reason = "Still pending review";
  }

  return { ok: true, explanation };
}

/**
 * Explain why a DTU is trusted (or not).
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - DTU to explain
 * @returns {{ ok: boolean, trustExplanation: Object }}
 */
export function explainTrust(STATE, dtuId) {
  const dtu = STATE.dtus?.get(dtuId);
  if (!dtu) return { ok: false, error: "dtu_not_found" };

  const es = getEmergentState(STATE);
  const edgeStore = es._edges;

  // Count supporting vs contradicting edges
  let supportCount = 0;
  let contradictCount = 0;
  if (edgeStore?.byTarget?.has(dtuId)) {
    for (const eid of edgeStore.byTarget.get(dtuId)) {
      const edge = edgeStore.edges.get(eid);
      if (!edge) continue;
      if (edge.edgeType === "supports") supportCount++;
      if (edge.edgeType === "contradicts") contradictCount++;
    }
  }

  const factors = [];
  if (dtu.resonance > 0.7) factors.push({ factor: "high_resonance", value: dtu.resonance, effect: "positive" });
  if (dtu.coherence > 0.7) factors.push({ factor: "high_coherence", value: dtu.coherence, effect: "positive" });
  if (dtu.stability > 0.7) factors.push({ factor: "high_stability", value: dtu.stability, effect: "positive" });
  if (supportCount > 2) factors.push({ factor: "multiple_supports", value: supportCount, effect: "positive" });
  if (contradictCount > 0) factors.push({ factor: "contradictions_exist", value: contradictCount, effect: "negative" });
  if (dtu.tier === "mega" || dtu.tier === "hyper") factors.push({ factor: "promoted_tier", value: dtu.tier, effect: "positive" });
  if (dtu.meta?._emergentProvenance) factors.push({ factor: "emergent_origin", value: "yes", effect: "neutral" });

  const trustScore = (dtu.resonance + dtu.coherence + dtu.stability) / 3;

  return {
    ok: true,
    trustExplanation: {
      dtuId,
      title: dtu.title,
      tier: dtu.tier,
      trustScore: Math.round(trustScore * 100) / 100,
      factors,
      supportCount,
      contradictCount,
    },
  };
}

// ── 7. Growth Without Self-Modification (already enforced by gates) ─────────

// Growth happens via specialization, pattern compression, domain mastery.
// Never via changing rules, expanding authority, or mutating invariants.
// This is enforced by the gate system in gates.js.

// ── 8. Belonging — Situated, Not Summoned ───────────────────────────────────

/**
 * Get an emergent's "home" in the lattice — preferred domains, recurring
 * collaborators, and work routing affinity.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - Emergent to query
 * @returns {{ ok: boolean, belonging: Object }}
 */
export function getBelonging(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "not_found" };

  // Compute preferred domains from session history
  const domainCounts = {};
  const collaboratorCounts = {};
  const sessionIds = es.sessionsByEmergent.get(emergentId) || new Set();

  for (const sid of sessionIds) {
    const session = es.sessions.get(sid);
    if (!session) continue;

    // Track topic keywords as domain signals
    const words = (session.topic || "").toLowerCase().split(/\s+/);
    for (const w of words) {
      if (w.length > 3) domainCounts[w] = (domainCounts[w] || 0) + 1;
    }

    // Track collaborators
    for (const pid of session.participants) {
      if (pid !== emergentId) {
        collaboratorCounts[pid] = (collaboratorCounts[pid] || 0) + 1;
      }
    }
  }

  // Sort domains and collaborators by frequency
  const preferredDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, frequency: count }));

  const recurringCollaborators = Object.entries(collaboratorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([collaboratorId, count]) => {
      const collab = es.emergents.get(collaboratorId);
      return {
        emergentId: collaboratorId,
        name: collab?.name || "unknown",
        role: collab?.role || "unknown",
        sharedSessions: count,
      };
    });

  return {
    ok: true,
    belonging: {
      emergentId,
      name: emergent.name,
      role: emergent.role,
      specialization: emergent.specialization || null,
      homeScope: emergent.scope,
      preferredDomains,
      recurringCollaborators,
      sessionCount: sessionIds.size,
      active: emergent.active,
      createdAt: emergent.createdAt,
    },
  };
}
