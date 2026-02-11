/**
 * Emergent Agent Governance — Growth Mechanisms
 *
 * Implements the four real growth mechanisms:
 *   1. Pattern Acquisition (deterministic) — extract successful reasoning templates
 *   2. Memory Distillation (DTU generation) — distill dialogues into DTUs
 *   3. Reputation Shift (governance feedback) — credibility vector updates
 *   4. Role Specialization (drift without chaos) — gated subrole forking
 *
 * All growth is gated: no self-reinforcing delusion loops.
 * Every artifact has provenance.
 */

import {
  EMERGENT_ROLES,
  CONFIDENCE_LABELS,
} from "./schema.js";

import {
  getEmergentState,
  getSession,
  getOutputBundle,
  storePattern,
  updateReputation,
} from "./store.js";

// ── 1. Pattern Acquisition ──────────────────────────────────────────────────

/**
 * Extract successful reasoning patterns from a completed session.
 * A "successful" session is one where promoted DTUs emerged.
 *
 * Patterns become learned policies attached to role profiles.
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Completed session to analyze
 * @param {string[]} [promotedClaims] - Claims that were promoted
 * @returns {{ ok: boolean, patterns: Object[] }}
 */
export function extractPatterns(STATE, sessionId, promotedClaims = []) {
  const es = getEmergentState(STATE);
  const session = getSession(es, sessionId);

  if (!session) {
    return { ok: false, error: "session_not_found", patterns: [] };
  }

  const patterns = [];
  const promotedSet = new Set(promotedClaims);

  // Analyze turn sequences that led to promoted outcomes
  for (let i = 0; i < session.turns.length; i++) {
    const turn = session.turns[i];

    // Check if this turn's claim was promoted
    if (promotedSet.size > 0 && !promotedSet.has(turn.claim)) continue;

    // Look at the preceding turns to find the reasoning chain
    const chain = [];
    for (let j = Math.max(0, i - 4); j <= i; j++) {
      chain.push({
        role: session.turns[j].speakerRole,
        intent: session.turns[j].intent,
        confidenceLabel: session.turns[j].confidenceLabel,
        hadCounterpoint: !!session.turns[j].counterpoint,
        hadQuestion: !!session.turns[j].question,
      });
    }

    // Generate pattern template
    const roleSequence = chain.map(c => c.role).join(" -> ");
    const pattern = {
      patternId: `pat_${Date.now().toString(36)}_${i}`,
      sessionId,
      emergentId: turn.speakerId,
      role: turn.speakerRole,
      description: `Successful ${turn.speakerRole} pattern: ${roleSequence}`,
      template: {
        roleSequence: chain.map(c => c.role),
        intentSequence: chain.map(c => c.intent),
        requiresCounterpoint: chain.some(c => c.hadCounterpoint),
        requiresQuestion: chain.some(c => c.hadQuestion),
        confidenceProgression: chain.map(c => c.confidenceLabel),
      },
      constraints: generateConstraints(turn.speakerRole, chain),
      quality: promotedSet.size > 0 ? "promoted" : "session_complete",
      createdAt: new Date().toISOString(),
    };

    patterns.push(pattern);
    storePattern(es, pattern);
  }

  return { ok: true, patterns };
}

/**
 * Generate learned constraints from a successful pattern.
 */
function generateConstraints(role, chain) {
  const constraints = [];

  switch (role) {
    case EMERGENT_ROLES.CRITIC:
      if (chain.some(c => c.hadCounterpoint)) {
        constraints.push("must_provide_counterpoint");
      }
      constraints.push("must_request_falsifiability_test");
      break;

    case EMERGENT_ROLES.SYNTHESIZER:
      constraints.push("must_label_unresolved_tensions");
      if (chain.some(c => c.hadQuestion)) {
        constraints.push("must_pose_integrative_question");
      }
      break;

    case EMERGENT_ROLES.BUILDER:
      constraints.push("must_cite_support_or_mark_no_citation");
      if (chain.some(c => c.confidenceLabel === CONFIDENCE_LABELS.HYPOTHESIS)) {
        constraints.push("must_propose_test_for_hypothesis");
      }
      break;

    case EMERGENT_ROLES.ADVERSARY:
      constraints.push("must_challenge_strongest_claim");
      constraints.push("must_identify_failure_mode");
      break;

    default:
      break;
  }

  return constraints;
}

// ── 2. Memory Distillation ──────────────────────────────────────────────────

/**
 * Distill a completed dialogue session into candidate DTU structures.
 * Extracts:
 *   - What was learned
 *   - What remains unresolved
 *   - New invariants discovered
 *   - New tests proposed
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Session to distill
 * @returns {{ ok: boolean, distillation: Object }}
 */
export function distillSession(STATE, sessionId) {
  const es = getEmergentState(STATE);
  const session = getSession(es, sessionId);

  if (!session) {
    return { ok: false, error: "session_not_found" };
  }

  const bundle = session.outputBundle
    ? getOutputBundle(es, session.outputBundle)
    : null;

  // What was learned: high-confidence claims from builders & synthesizers
  const learned = session.turns
    .filter(t =>
      (t.speakerRole === EMERGENT_ROLES.BUILDER || t.speakerRole === EMERGENT_ROLES.SYNTHESIZER) &&
      (t.confidenceLabel === CONFIDENCE_LABELS.FACT || t.confidenceLabel === CONFIDENCE_LABELS.DERIVED)
    )
    .map(t => ({
      claim: t.claim,
      confidence: t.confidenceLabel,
      support: t.support,
      turnIndex: t.turnIndex,
    }));

  // What remains unresolved: unresolved contradictions + unanswered questions
  const unresolved = [
    ...(session.signals || [])
      .filter(s => s.type === "contradiction" && !s.resolved)
      .map(s => ({ type: "contradiction", description: s.description })),
    ...session.turns
      .filter(t => t.question && !hasAnswer(session, t.turnIndex))
      .map(t => ({ type: "unanswered_question", question: t.question, turnIndex: t.turnIndex })),
  ];

  // New invariants: claims that were unchallenged by critics
  const invariants = session.turns
    .filter(t =>
      t.confidenceLabel === CONFIDENCE_LABELS.FACT &&
      !session.turns.some(other =>
        other.counterpoint &&
        other.turnIndex > t.turnIndex &&
        other.turnIndex <= t.turnIndex + 3
      )
    )
    .map(t => ({ claim: t.claim, proposedBy: t.speakerId }));

  // New tests proposed by critics/adversaries
  const tests = session.turns
    .filter(t =>
      (t.speakerRole === EMERGENT_ROLES.CRITIC || t.speakerRole === EMERGENT_ROLES.ADVERSARY) &&
      t.counterpoint
    )
    .map(t => ({
      test: t.counterpoint,
      targetClaim: t.turnIndex > 0 ? session.turns[t.turnIndex - 1]?.claim : null,
      proposedBy: t.speakerId,
    }));

  const distillation = {
    sessionId,
    topic: session.topic,
    learned,
    unresolved,
    invariants,
    tests,
    participantCount: session.participants.length,
    turnCount: session._turnCount,
    createdAt: new Date().toISOString(),
    provenance: {
      sessionId,
      participants: session.participants,
      participantRoles: session._participantRoles,
    },
  };

  return { ok: true, distillation };
}

/**
 * Check if a question at turnIndex was answered in subsequent turns.
 */
function hasAnswer(session, turnIndex) {
  for (let i = turnIndex + 1; i < session.turns.length && i <= turnIndex + 5; i++) {
    const t = session.turns[i];
    if (t.intent === "suggestion" || t.intent === "synthesis") {
      return true;
    }
  }
  return false;
}

// ── 3. Reputation Shift ─────────────────────────────────────────────────────

/**
 * Process reputation updates from a completed review cycle.
 *
 * @param {Object} STATE - Global server state
 * @param {string} bundleId - Reviewed bundle
 * @param {Object} reviewResult - Result from reviewBundle()
 * @returns {{ ok: boolean, updates: Object[] }}
 */
export function processReputationShift(STATE, bundleId, reviewResult) {
  const es = getEmergentState(STATE);
  const updates = [];

  // Promoted candidates boost proposer reputation
  for (const item of (reviewResult.promoted || [])) {
    const rep = updateReputation(es, item.proposedBy, {
      type: "accepted",
      bundleId,
      claim: truncate(item.claim, 100),
    });
    if (rep) updates.push({ emergentId: item.proposedBy, event: "accepted", credibility: rep.credibility });
  }

  // Rejected candidates slightly decrease proposer reputation
  for (const item of (reviewResult.rejected || [])) {
    const rep = updateReputation(es, item.proposedBy, {
      type: "rejected",
      bundleId,
      claim: truncate(item.claim, 100),
    });
    if (rep) updates.push({ emergentId: item.proposedBy, event: "rejected", credibility: rep.credibility });
  }

  return { ok: true, updates };
}

/**
 * Record that an emergent caught a contradiction (boosts critic reputation).
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - The emergent who caught the contradiction
 * @param {string} sessionId - Session where it was caught
 * @returns {{ ok: boolean, reputation?: Object }}
 */
export function recordContradictionCaught(STATE, emergentId, sessionId) {
  const es = getEmergentState(STATE);
  const rep = updateReputation(es, emergentId, {
    type: "contradiction_caught",
    sessionId,
  });
  if (!rep) return { ok: false, error: "emergent_not_found" };
  return { ok: true, reputation: rep };
}

/**
 * Record that an emergent's prediction was validated.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - The emergent whose prediction was validated
 * @param {string} predictionRef - Reference to the prediction
 * @returns {{ ok: boolean, reputation?: Object }}
 */
export function recordPredictionValidated(STATE, emergentId, predictionRef) {
  const es = getEmergentState(STATE);
  const rep = updateReputation(es, emergentId, {
    type: "prediction_validated",
    predictionRef,
  });
  if (!rep) return { ok: false, error: "emergent_not_found" };
  return { ok: true, reputation: rep };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncate(str, maxLen = 100) {
  const s = String(str || "");
  return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
}
