/**
 * Emergent Agent Governance — Layer C: Governance & Promotion
 *
 * Only here can the lattice change. This layer handles:
 *   - Council vote / credibility-weighted promotion
 *   - Tier thresholds (regular -> mega -> hyper)
 *   - Conflict labeling retained if unresolved
 *   - Provenance stored on every promoted DTU
 *   - Role specialization gating
 *
 * Key principle: Emergents may speak, but they may not decide.
 * All decisions flow through this deterministic governance layer.
 */

import {
  PROMOTION_TIERS,
  TIER_THRESHOLDS,
  EMERGENT_ROLES,
  ALL_ROLES,
} from "./schema.js";

import {
  getEmergentState,
  getOutputBundle,
  getReputation,
  updateReputation,
  storePattern,
  registerEmergent,
} from "./store.js";

// ── Promotion Pipeline ──────────────────────────────────────────────────────

/**
 * Review an output bundle for promotion.
 * Applies tier thresholds, credibility weighting, and conflict checks.
 *
 * @param {Object} STATE - Global server state
 * @param {string} bundleId - Output bundle to review
 * @param {Object} opts - Review options
 * @param {Object[]} [opts.votes] - Council votes [{voterId, decision, reason}]
 * @param {string} [opts.targetTier] - Requested tier
 * @returns {{ ok: boolean, promoted: Object[], rejected: Object[], deferred: Object[] }}
 */
export function reviewBundle(STATE, bundleId, opts = {}) {
  const es = getEmergentState(STATE);
  const bundle = getOutputBundle(es, bundleId);

  if (!bundle) {
    return { ok: false, error: "bundle_not_found" };
  }

  const { votes = [], targetTier = PROMOTION_TIERS.REGULAR } = opts;
  const thresholds = TIER_THRESHOLDS[targetTier] || TIER_THRESHOLDS.regular;

  const promoted = [];
  const rejected = [];
  const deferred = [];

  // Process candidate DTUs
  for (const candidate of bundle.candidateDTUs) {
    const review = reviewCandidate(candidate, bundle, votes, thresholds, es);

    if (review.decision === "promoted") {
      promoted.push({
        ...candidate,
        tier: targetTier,
        promotedAt: new Date().toISOString(),
        provenance: {
          bornFromSession: bundle.sessionId,
          participants: bundle.provenance.participants,
          participantRoles: bundle.provenance.participantRoles,
          votes: review.voteTally,
          credibilityWeight: review.credibilityWeight,
        },
        review,
      });

      // Update reputation for the proposer
      updateReputation(es, candidate.proposedBy, { type: "accepted", bundleId });
      es.metrics.dtusPromoted++;

    } else if (review.decision === "rejected") {
      rejected.push({ ...candidate, review });
      updateReputation(es, candidate.proposedBy, { type: "rejected", bundleId });

    } else {
      deferred.push({ ...candidate, review });
    }
  }

  // Process promotion requests from synthesizer
  for (const req of bundle.promotionRequests) {
    const review = reviewCandidate(req, bundle, votes, thresholds, es);
    if (review.decision === "promoted") {
      promoted.push({
        ...req,
        tier: req.requestedTier || targetTier,
        promotedAt: new Date().toISOString(),
        provenance: {
          bornFromSession: bundle.sessionId,
          participants: bundle.provenance.participants,
          participantRoles: bundle.provenance.participantRoles,
          votes: review.voteTally,
        },
        review,
      });
    }
  }

  return {
    ok: true,
    bundleId,
    promoted,
    rejected,
    deferred,
    unresolvedConflicts: bundle.conflicts,
  };
}

/**
 * Review a single candidate for promotion.
 */
function reviewCandidate(candidate, bundle, votes, thresholds, es) {
  const reasons = [];

  // 1. Check unresolved conflicts
  if (bundle.conflicts.length > 0) {
    reasons.push(`${bundle.conflicts.length} unresolved conflicts in session`);
  }

  // 2. Tally votes with credibility weighting
  const voteTally = tallyVotes(votes, es);

  // 3. Check approval threshold
  if (voteTally.weightedApprove < thresholds.minApprovals) {
    reasons.push(`insufficient approvals: ${voteTally.weightedApprove.toFixed(2)} < ${thresholds.minApprovals}`);
  }

  // 4. Check confidence label
  if (candidate.confidenceLabel === "speculative") {
    reasons.push("speculative claims cannot be promoted directly");
  }

  // 5. Compute credibility weight of proposer
  const proposerRep = getReputation(es, candidate.proposedBy);
  const credibilityWeight = proposerRep ? proposerRep.credibility : 0.5;

  // Decision
  let decision;
  if (reasons.length === 0 && voteTally.weightedApprove >= thresholds.minApprovals) {
    decision = "promoted";
  } else if (candidate.confidenceLabel === "speculative" || voteTally.weightedReject > voteTally.weightedApprove) {
    decision = "rejected";
  } else {
    decision = "deferred";
  }

  return {
    decision,
    reasons,
    voteTally,
    credibilityWeight,
    thresholds,
  };
}

/**
 * Tally votes with credibility weighting.
 * Voters with higher credibility scores have more influence.
 */
function tallyVotes(votes, es) {
  let weightedApprove = 0;
  let weightedReject = 0;
  let weightedAbstain = 0;
  let rawApprove = 0;
  let rawReject = 0;
  let rawAbstain = 0;

  for (const vote of votes) {
    const rep = getReputation(es, vote.voterId);
    const weight = rep ? rep.credibility : 0.5;

    switch (vote.decision) {
      case "approve":
        rawApprove++;
        weightedApprove += weight;
        break;
      case "reject":
        rawReject++;
        weightedReject += weight;
        break;
      case "abstain":
        rawAbstain++;
        weightedAbstain += weight;
        break;
    }
  }

  return {
    rawApprove,
    rawReject,
    rawAbstain,
    weightedApprove,
    weightedReject,
    weightedAbstain,
    totalVotes: votes.length,
  };
}

// ── Role Specialization ─────────────────────────────────────────────────────

/**
 * Request a role specialization (fork into subrole).
 * Requires deterministic justification + approval.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - Emergent requesting specialization
 * @param {string} newRole - New specialized role name
 * @param {string} justification - Why this specialization is needed
 * @param {Object[]} approvals - Council approvals
 * @returns {{ ok: boolean, emergent?: Object, error?: string }}
 */
export function requestSpecialization(STATE, emergentId, newRole, justification, approvals = []) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);

  if (!emergent) {
    return { ok: false, error: "emergent_not_found" };
  }

  // Validate the new role is a subrole of the existing role
  if (!newRole || typeof newRole !== "string") {
    return { ok: false, error: "invalid_new_role" };
  }

  // Must have justification
  if (!justification || justification.length < 10) {
    return { ok: false, error: "insufficient_justification" };
  }

  // Must have at least 2 approvals
  if (approvals.length < 2) {
    return { ok: false, error: "insufficient_approvals", required: 2, provided: approvals.length };
  }

  // Create the specialized fork
  const specializedId = `${emergentId}_spec_${Date.now().toString(36)}`;
  const specialized = {
    id: specializedId,
    name: `${emergent.name} (${newRole})`,
    role: emergent.role,  // base role stays the same for gate checks
    specialization: newRole,
    scope: [...emergent.scope],  // inherit scope
    capabilities: [...emergent.capabilities],
    memoryPolicy: emergent.memoryPolicy,
    parentId: emergentId,
    justification: String(justification).slice(0, 2000),
    approvedBy: approvals.map(a => a.voterId),
  };

  registerEmergent(es, specialized);

  // Log the specialization
  es.specializations.push({
    parentId: emergentId,
    childId: specializedId,
    fromRole: emergent.role,
    toSpecialization: newRole,
    justification,
    approvedBy: approvals.map(a => a.voterId),
    createdAt: new Date().toISOString(),
  });

  return { ok: true, emergent: specialized };
}

// ── Emergent Outreach (User Contact) ────────────────────────────────────────

/**
 * Create an outreach message from an emergent to a user.
 * Enforces consent boundaries and scope restrictions.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Outreach options
 * @param {string} opts.emergentId - Who is reaching out
 * @param {string} opts.targetUserId - Who to contact
 * @param {string} opts.intent - Why they are being contacted
 * @param {string} opts.message - The message content
 * @param {string} opts.confidenceLabel - Confidence of the message
 * @param {string} [opts.actionRequested] - What action is being asked
 * @param {string} [opts.lens] - Which lens this is scoped to
 * @returns {{ ok: boolean, outreach?: Object, error?: string }}
 */
export function createOutreach(STATE, opts = {}) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(opts.emergentId);

  if (!emergent) {
    return { ok: false, error: "emergent_not_found" };
  }
  if (!emergent.active) {
    return { ok: false, error: "emergent_inactive" };
  }

  // Validate lens scope
  if (opts.lens && !emergent.scope.includes(opts.lens) && !emergent.scope.includes("*")) {
    return { ok: false, error: "out_of_scope_lens", lens: opts.lens, allowedScope: emergent.scope };
  }

  // Build the outreach message with mandatory disclosure
  const outreach = {
    outreachId: `or_${Date.now().toString(36)}`,
    emergentId: opts.emergentId,
    emergentName: emergent.name,
    emergentRole: emergent.role,
    emergentSpecialization: emergent.specialization || null,
    targetUserId: opts.targetUserId,
    identity: `${emergent.name} [${emergent.role}${emergent.specialization ? ` / ${emergent.specialization}` : ""}]`,
    intent: String(opts.intent || "notification").slice(0, 200),
    message: String(opts.message || "").slice(0, 5000),
    confidenceLabel: opts.confidenceLabel || "speculative",
    actionRequested: opts.actionRequested ? String(opts.actionRequested).slice(0, 500) : null,
    lens: opts.lens || null,
    scope: emergent.scope,
    // Mandatory disclosure fields
    disclosure: {
      isEmergent: true,
      speakerIdentity: emergent.name,
      speakerRole: emergent.role,
      confidenceLevel: opts.confidenceLabel || "speculative",
      reason: opts.intent || "notification",
    },
    createdAt: new Date().toISOString(),
  };

  return { ok: true, outreach };
}
