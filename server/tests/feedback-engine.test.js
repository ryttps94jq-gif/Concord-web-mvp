/**
 * Feedback Engine Test Suite
 *
 * Tests the user feedback processing pipeline:
 *   - FEEDBACK_TYPES constant
 *   - aggregateFeedback() signal aggregation
 *   - processFeedbackQueue() batch processing with proposals/repairs
 *   - getFeedbackSummary() dashboard summary
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  FEEDBACK_TYPES,
  aggregateFeedback,
  processFeedbackQueue,
  getFeedbackSummary,
} from "../lib/feedback-engine.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createSTATE() {
  return {
    dtus: new Map(),
    feedbackQueue: [],
  };
}

function makeFeedbackDTU(id, targetType, targetId, feedbackType, bullet = null) {
  return {
    id,
    machine: { kind: "user_feedback" },
    core: {
      claims: [
        `${targetType}:${targetId}`,
        `Type: ${feedbackType}`,
      ],
    },
    human: {
      bullets: bullet ? [bullet] : [],
    },
  };
}

// ── FEEDBACK_TYPES ──────────────────────────────────────────────────────────

describe("FEEDBACK_TYPES", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(FEEDBACK_TYPES));
  });

  it("defines LIKE with positive signal", () => {
    assert.equal(FEEDBACK_TYPES.LIKE.weight, 0.3);
    assert.equal(FEEDBACK_TYPES.LIKE.signal, "positive");
  });

  it("defines DISLIKE with negative signal", () => {
    assert.equal(FEEDBACK_TYPES.DISLIKE.weight, -0.3);
    assert.equal(FEEDBACK_TYPES.DISLIKE.signal, "negative");
  });

  it("defines REPORT with strongest negative weight", () => {
    assert.equal(FEEDBACK_TYPES.REPORT.weight, -1.0);
    assert.equal(FEEDBACK_TYPES.REPORT.signal, "negative");
  });

  it("defines FEATURE_REQUEST as evolution signal", () => {
    assert.equal(FEEDBACK_TYPES.FEATURE_REQUEST.weight, 0);
    assert.equal(FEEDBACK_TYPES.FEATURE_REQUEST.signal, "evolution");
  });

  it("defines BUG_REPORT as repair signal", () => {
    assert.equal(FEEDBACK_TYPES.BUG_REPORT.weight, 0);
    assert.equal(FEEDBACK_TYPES.BUG_REPORT.signal, "repair");
  });

  it("defines LENS_SUGGESTION as evolution signal", () => {
    assert.equal(FEEDBACK_TYPES.LENS_SUGGESTION.weight, 0);
    assert.equal(FEEDBACK_TYPES.LENS_SUGGESTION.signal, "evolution");
  });

  it("has exactly 6 feedback types", () => {
    assert.equal(Object.keys(FEEDBACK_TYPES).length, 6);
  });
});

// ── aggregateFeedback ───────────────────────────────────────────────────────

describe("aggregateFeedback", () => {
  it("returns zero counts when no feedback DTUs exist", () => {
    const STATE = createSTATE();
    const result = aggregateFeedback(STATE, "lens", "finance");

    assert.equal(result.targetType, "lens");
    assert.equal(result.targetId, "finance");
    assert.equal(result.total, 0);
    assert.equal(result.sentiment, 0);
    assert.equal(result.likes, 0);
    assert.equal(result.dislikes, 0);
    assert.deepEqual(result.featureRequests, []);
    assert.deepEqual(result.bugReports, []);
    assert.deepEqual(result.suggestions, []);
  });

  it("counts likes and dislikes correctly", () => {
    const STATE = createSTATE();
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "lens", "finance", "like"));
    STATE.dtus.set("fb2", makeFeedbackDTU("fb2", "lens", "finance", "like"));
    STATE.dtus.set("fb3", makeFeedbackDTU("fb3", "lens", "finance", "dislike"));

    const result = aggregateFeedback(STATE, "lens", "finance");
    assert.equal(result.total, 3);
    assert.equal(result.likes, 2);
    assert.equal(result.dislikes, 1);
    assert.equal(result.sentiment, 1); // 2 - 1
  });

  it("collects feature requests as bullets", () => {
    const STATE = createSTATE();
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "lens", "code", "feature_request", "Add dark mode"));
    STATE.dtus.set("fb2", makeFeedbackDTU("fb2", "lens", "code", "feature_request", "Add autocomplete"));

    const result = aggregateFeedback(STATE, "lens", "code");
    assert.equal(result.featureRequests.length, 2);
    assert.ok(result.featureRequests.includes("Add dark mode"));
    assert.ok(result.featureRequests.includes("Add autocomplete"));
  });

  it("collects bug reports as bullets", () => {
    const STATE = createSTATE();
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "dtu", "d1", "bug_report", "Crash on load"));

    const result = aggregateFeedback(STATE, "dtu", "d1");
    assert.equal(result.bugReports.length, 1);
    assert.equal(result.bugReports[0], "Crash on load");
  });

  it("collects lens suggestions as bullets", () => {
    const STATE = createSTATE();
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "lens", "math", "lens_suggestion", "Add graphing"));

    const result = aggregateFeedback(STATE, "lens", "math");
    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0], "Add graphing");
  });

  it("filters by targetType and targetId", () => {
    const STATE = createSTATE();
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "lens", "finance", "like"));
    STATE.dtus.set("fb2", makeFeedbackDTU("fb2", "lens", "code", "like"));
    STATE.dtus.set("fb3", makeFeedbackDTU("fb3", "dtu", "finance", "like"));

    const result = aggregateFeedback(STATE, "lens", "finance");
    assert.equal(result.total, 1);
    assert.equal(result.likes, 1);
  });

  it("ignores non-feedback DTUs", () => {
    const STATE = createSTATE();
    STATE.dtus.set("regular", { id: "regular", machine: { kind: "knowledge" } });
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "lens", "finance", "like"));

    const result = aggregateFeedback(STATE, "lens", "finance");
    assert.equal(result.total, 1);
  });
});

// ── processFeedbackQueue ────────────────────────────────────────────────────

describe("processFeedbackQueue", () => {
  it("returns processed=0 when queue is empty", async () => {
    const STATE = createSTATE();
    const result = await processFeedbackQueue(STATE);
    assert.equal(result.processed, 0);
  });

  it("processes all items in the queue", async () => {
    const STATE = createSTATE();
    STATE.feedbackQueue = [
      { targetType: "lens", targetId: "finance", type: "like" },
      { targetType: "lens", targetId: "finance", type: "dislike" },
      { targetType: "lens", targetId: "code", type: "like" },
    ];

    const result = await processFeedbackQueue(STATE);
    assert.equal(result.processed, 3);
    assert.equal(STATE.feedbackQueue.length, 0); // Queue cleared
  });

  it("adjusts DTU authority score for dtu feedback", async () => {
    const STATE = createSTATE();
    STATE.dtus.set("d1", { id: "d1", authority: { score: 0.5 } });

    // Add feedback DTUs that will be found by aggregateFeedback
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "dtu", "d1", "like"));
    STATE.dtus.set("fb2", makeFeedbackDTU("fb2", "dtu", "d1", "like"));

    STATE.feedbackQueue = [
      { targetType: "dtu", targetId: "d1", type: "like" },
      { targetType: "dtu", targetId: "d1", type: "like" },
    ];

    await processFeedbackQueue(STATE, { authorityAdjustmentRate: 0.1 });

    const dtu = STATE.dtus.get("d1");
    // sentiment = 2 likes - 0 dislikes = 2, adjustment = 2 * 0.1 = 0.2
    assert.ok(dtu.authority.score > 0.5);
  });

  it("clamps authority score between 0 and 1", async () => {
    const STATE = createSTATE();
    STATE.dtus.set("d1", { id: "d1", authority: { score: 0.99 } });
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "dtu", "d1", "like"));

    STATE.feedbackQueue = [
      { targetType: "dtu", targetId: "d1" },
    ];

    await processFeedbackQueue(STATE, { authorityAdjustmentRate: 0.5 });

    const dtu = STATE.dtus.get("d1");
    assert.ok(dtu.authority.score <= 1);
  });

  it("initializes authority if missing", async () => {
    const STATE = createSTATE();
    STATE.dtus.set("d1", { id: "d1" });
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "dtu", "d1", "like"));

    STATE.feedbackQueue = [
      { targetType: "dtu", targetId: "d1" },
    ];

    await processFeedbackQueue(STATE);

    const dtu = STATE.dtus.get("d1");
    assert.ok(dtu.authority);
    assert.equal(typeof dtu.authority.score, "number");
  });

  it("generates proposals when feature requests exceed threshold", async () => {
    const STATE = createSTATE();

    // Create 4 feature request DTUs
    for (let i = 0; i < 4; i++) {
      STATE.dtus.set(`fb${i}`, makeFeedbackDTU(`fb${i}`, "lens", "math", "feature_request", `Feature ${i}`));
    }

    STATE.feedbackQueue = [
      { targetType: "lens", targetId: "math" },
    ];

    const result = await processFeedbackQueue(STATE, { minRequestsForProposal: 3 });
    assert.equal(result.proposals, 1);
  });

  it("generates repairs when bug reports exceed threshold", async () => {
    const STATE = createSTATE();

    for (let i = 0; i < 3; i++) {
      STATE.dtus.set(`fb${i}`, makeFeedbackDTU(`fb${i}`, "lens", "code", "bug_report", `Bug ${i}`));
    }

    STATE.feedbackQueue = [
      { targetType: "lens", targetId: "code" },
    ];

    const result = await processFeedbackQueue(STATE, { minReportsForRepair: 2 });
    assert.equal(result.repairs, 1);
  });

  it("creates evolution proposal DTU on negative sentiment", async () => {
    const STATE = createSTATE();

    // Create enough dislikes for extreme negative sentiment
    for (let i = 0; i < 10; i++) {
      STATE.dtus.set(`fb${i}`, makeFeedbackDTU(`fb${i}`, "lens", "broken", "dislike"));
    }

    STATE.feedbackQueue = [
      { targetType: "lens", targetId: "broken" },
    ];

    const before = STATE.dtus.size;
    await processFeedbackQueue(STATE, { negativeSentimentThreshold: -5 });

    // Should have created an evolution_proposal DTU
    const proposalDtus = Array.from(STATE.dtus.values()).filter(
      d => d.machine?.kind === "evolution_proposal"
    );
    assert.ok(proposalDtus.length >= 1);
    assert.ok(proposalDtus[0].id.startsWith("evolution_broken_"));
    assert.equal(proposalDtus[0].domain, "governance");
  });

  it("handles missing feedbackQueue gracefully", async () => {
    const STATE = { dtus: new Map() };
    const result = await processFeedbackQueue(STATE);
    assert.equal(result.processed, 0);
  });

  it("uses custom threshold options", async () => {
    const STATE = createSTATE();

    // 2 feature requests (below default threshold of 3, but meets custom threshold of 2)
    STATE.dtus.set("fb1", makeFeedbackDTU("fb1", "lens", "test", "feature_request", "F1"));
    STATE.dtus.set("fb2", makeFeedbackDTU("fb2", "lens", "test", "feature_request", "F2"));

    STATE.feedbackQueue = [
      { targetType: "lens", targetId: "test" },
    ];

    const result = await processFeedbackQueue(STATE, { minRequestsForProposal: 2 });
    assert.equal(result.proposals, 1);
  });
});

// ── getFeedbackSummary ──────────────────────────────────────────────────────

describe("getFeedbackSummary", () => {
  it("returns zeros for empty state", () => {
    const STATE = createSTATE();
    const result = getFeedbackSummary(STATE);

    assert.equal(result.totalFeedback, 0);
    assert.equal(result.pendingInQueue, 0);
    assert.equal(result.proposals, 0);
    assert.equal(result.pendingProposals, 0);
  });

  it("counts feedback DTUs", () => {
    const STATE = createSTATE();
    STATE.dtus.set("fb1", { id: "fb1", machine: { kind: "user_feedback" } });
    STATE.dtus.set("fb2", { id: "fb2", machine: { kind: "user_feedback" } });
    STATE.dtus.set("reg1", { id: "reg1", machine: { kind: "knowledge" } });

    const result = getFeedbackSummary(STATE);
    assert.equal(result.totalFeedback, 2);
  });

  it("counts pending queue items", () => {
    const STATE = createSTATE();
    STATE.feedbackQueue = [{ type: "like" }, { type: "dislike" }];

    const result = getFeedbackSummary(STATE);
    assert.equal(result.pendingInQueue, 2);
  });

  it("counts proposal DTUs and pending proposals", () => {
    const STATE = createSTATE();
    STATE.dtus.set("p1", {
      id: "p1",
      machine: { kind: "evolution_proposal", verifier: { status: "pending_review" } },
    });
    STATE.dtus.set("p2", {
      id: "p2",
      machine: { kind: "evolution_proposal", verifier: { status: "approved" } },
    });
    STATE.dtus.set("p3", {
      id: "p3",
      machine: { kind: "evolution_proposal", verifier: { status: "pending_review" } },
    });

    const result = getFeedbackSummary(STATE);
    assert.equal(result.proposals, 3);
    assert.equal(result.pendingProposals, 2);
  });

  it("handles missing feedbackQueue", () => {
    const STATE = { dtus: new Map() };
    const result = getFeedbackSummary(STATE);
    assert.equal(result.pendingInQueue, 0);
  });
});
