/**
 * Feedback Engine — processes user feedback, aggregates signals,
 * and generates evolution proposals for the council.
 *
 * Part of Concord Spec v2.1 — User-Driven Evolution Loop.
 */

const FEEDBACK_TYPES = Object.freeze({
  LIKE: { weight: 0.3, signal: "positive" },
  DISLIKE: { weight: -0.3, signal: "negative" },
  REPORT: { weight: -1.0, signal: "negative" },
  FEATURE_REQUEST: { weight: 0, signal: "evolution" },
  BUG_REPORT: { weight: 0, signal: "repair" },
  LENS_SUGGESTION: { weight: 0, signal: "evolution" },
});

export { FEEDBACK_TYPES };

/**
 * Aggregate feedback for a specific target (lens, DTU, entity).
 */
export function aggregateFeedback(STATE, targetType, targetId) {
  const feedbackDtus = Array.from(STATE.dtus.values()).filter(d =>
    d.machine?.kind === "user_feedback" &&
    d.core?.claims?.some(c => c.includes(`${targetType}:${targetId}`))
  );

  const likes = feedbackDtus.filter(d => d.core?.claims?.some(c => c.includes("Type: like"))).length;
  const dislikes = feedbackDtus.filter(d => d.core?.claims?.some(c => c.includes("Type: dislike"))).length;
  const featureRequests = feedbackDtus
    .filter(d => d.core?.claims?.some(c => c.includes("Type: feature_request")))
    .map(d => d.human?.bullets?.[0])
    .filter(Boolean);
  const bugReports = feedbackDtus
    .filter(d => d.core?.claims?.some(c => c.includes("Type: bug_report")))
    .map(d => d.human?.bullets?.[0])
    .filter(Boolean);
  const suggestions = feedbackDtus
    .filter(d => d.core?.claims?.some(c => c.includes("Type: lens_suggestion")))
    .map(d => d.human?.bullets?.[0])
    .filter(Boolean);

  return {
    targetType,
    targetId,
    total: feedbackDtus.length,
    sentiment: likes - dislikes,
    likes,
    dislikes,
    featureRequests,
    bugReports,
    suggestions,
  };
}

/**
 * Process the feedback queue — called periodically from the heartbeat.
 * Groups feedback by target, detects patterns, triggers evolution proposals.
 */
export async function processFeedbackQueue(STATE, options = {}) {
  const {
    minRequestsForProposal = 3,
    minReportsForRepair = 2,
    negativeSentimentThreshold = -5,
    authorityAdjustmentRate = 0.01,
  } = options;

  const queue = STATE.feedbackQueue || [];
  if (queue.length === 0) return { processed: 0 };

  // Group feedback by target
  const byTarget = {};
  for (const fb of queue) {
    const key = `${fb.targetType}:${fb.targetId}`;
    if (!byTarget[key]) byTarget[key] = [];
    byTarget[key].push(fb);
  }

  let processed = 0;
  const proposals = [];
  const repairs = [];

  for (const [targetKey, feedbacks] of Object.entries(byTarget)) {
    const [targetType, targetId] = targetKey.split(":");
    const aggregate = aggregateFeedback(STATE, targetType, targetId);

    // DTU feedback affects authority score
    if (targetType === "dtu") {
      const dtu = STATE.dtus.get(targetId);
      if (dtu) {
        const adjustment = aggregate.sentiment * authorityAdjustmentRate;
        dtu.authority = dtu.authority || {};
        dtu.authority.score = Math.max(0, Math.min(1,
          (dtu.authority.score || 0.5) + adjustment
        ));
      }
    }

    // Lens feedback — check thresholds for proposals
    if (targetType === "lens") {
      if (aggregate.featureRequests.length >= minRequestsForProposal ||
          aggregate.suggestions.length >= minRequestsForProposal) {
        proposals.push({ targetId, aggregate });
      }

      if (aggregate.bugReports.length >= minReportsForRepair) {
        repairs.push({ targetId, bugReports: aggregate.bugReports });
      }

      if (aggregate.sentiment < negativeSentimentThreshold) {
        // Flag for council review
        try {
          const proposalDtu = {
            id: `evolution_${targetId}_${Date.now()}`,
            tier: "regular",
            scope: "global",
            domain: "governance",
            human: {
              summary: `Lens Evolution Proposal: ${targetId} (auto-generated from ${aggregate.total} feedback items)`,
              bullets: [
                `Sentiment: ${aggregate.sentiment}`,
                ...aggregate.featureRequests.slice(0, 3),
                ...aggregate.suggestions.slice(0, 3),
              ],
            },
            core: {
              claims: [
                `Lens: ${targetId}`,
                `Feedback count: ${aggregate.total}`,
                `Sentiment: ${aggregate.sentiment}`,
              ],
              definitions: [],
              examples: aggregate.featureRequests.slice(0, 5),
            },
            machine: {
              kind: "evolution_proposal",
              verifier: { lensName: targetId, feedbackCount: aggregate.total, sentiment: aggregate.sentiment, status: "pending_review" },
            },
            lineage: { parents: [], children: [] },
            authority: { score: 0.6 },
            meta: { createdBy: "system", lens: "governance", type: "evolution_proposal", tags: ["governance", "evolution", targetId], createdAt: new Date().toISOString() },
          };
          STATE.dtus.set(proposalDtu.id, proposalDtu);
        } catch {}
      }
    }

    processed += feedbacks.length;
  }

  // Clear processed queue
  STATE.feedbackQueue = [];

  return { processed, proposals: proposals.length, repairs: repairs.length };
}

/**
 * Get feedback summary for the sovereign dashboard.
 */
export function getFeedbackSummary(STATE) {
  const feedbackDtus = Array.from(STATE.dtus.values()).filter(d => d.machine?.kind === "user_feedback");
  const pending = (STATE.feedbackQueue || []).length;
  const proposalDtus = Array.from(STATE.dtus.values()).filter(d => d.machine?.kind === "evolution_proposal");

  return {
    totalFeedback: feedbackDtus.length,
    pendingInQueue: pending,
    proposals: proposalDtus.length,
    pendingProposals: proposalDtus.filter(d => d.machine?.verifier?.status === "pending_review").length,
  };
}
