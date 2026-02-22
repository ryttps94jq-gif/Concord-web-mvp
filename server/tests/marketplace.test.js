/**
 * Marketplace Test Suite
 * Tests DTU marketplace submission, review, quality gates, and user credits.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// ── Mock Marketplace ─────────────────────────────────────────────────────────

function createMarketplace() {
  const globalDTUs = new Map();
  const localDTUs = new Map();
  const submissions = [];
  const userCredits = new Map();

  function submitToMarketplace(dtu) {
    // Quality gate: confidence check
    if (dtu.tier === "base" && (dtu.confidence || 0) < 0.7) {
      return { ok: false, error: "BASE DTU with confidence < 0.7 rejected" };
    }

    // Semantic duplicate check
    for (const [, existing] of globalDTUs) {
      const titleSimilarity = jaccardSimilarity(dtu.title, existing.title);
      if (titleSimilarity > 0.8) {
        return { ok: false, error: "Semantically duplicate DTU rejected" };
      }
    }

    submissions.push({ dtu, status: "pending", submittedAt: Date.now() });
    return { ok: true, status: "pending_review" };
  }

  function councilReview(submissionIndex, decision, reason = "") {
    const sub = submissions[submissionIndex];
    if (!sub) return { ok: false, error: "Submission not found" };

    if (decision === "accept") {
      sub.status = "accepted";
      const globalDTU = {
        ...sub.dtu,
        id: `global-${crypto.randomUUID()}`,
        scope: "global",
        acceptedAt: Date.now(),
      };
      globalDTUs.set(globalDTU.id, globalDTU);

      // Credit the user
      const credits = userCredits.get(sub.dtu.ownerId) || 0;
      userCredits.set(sub.dtu.ownerId, credits + 1);

      return { ok: true, globalDTU };
    }

    sub.status = "rejected";
    sub.reason = reason;
    return { ok: true, rejected: true, reason };
  }

  function pullGlobalDTU(dtuId, userId) {
    const globalDTU = globalDTUs.get(dtuId);
    if (!globalDTU) return { ok: false, error: "Global DTU not found" };

    const localCopy = {
      ...globalDTU,
      id: `local-${crypto.randomUUID()}`,
      scope: "local",
      ownerId: userId,
      sourceGlobalId: dtuId,
    };
    localDTUs.set(localCopy.id, localCopy);
    return { ok: true, dtu: localCopy };
  }

  function getUserCredits(userId) {
    return userCredits.get(userId) || 0;
  }

  function getLocalDTUs(userId) {
    return [...localDTUs.values()].filter(d => d.ownerId === userId);
  }

  return { submitToMarketplace, councilReview, pullGlobalDTU, getUserCredits, getLocalDTUs, globalDTUs, submissions };
}

function jaccardSimilarity(a, b) {
  const tokensA = new Set(a.toLowerCase().split(/\s+/));
  const tokensB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...tokensA].filter(t => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Marketplace", () => {
  let market;

  beforeEach(() => {
    market = createMarketplace();
  });

  it("user can submit local DTU to marketplace", () => {
    const result = market.submitToMarketplace({
      title: "Advanced React Patterns",
      body: "Content about React patterns",
      tier: "base",
      confidence: 0.85,
      ownerId: "user-1",
    });
    assert.ok(result.ok);
    assert.equal(result.status, "pending_review");
  });

  it("BASE DTU with confidence < 0.7 rejected", () => {
    const result = market.submitToMarketplace({
      title: "Low Quality DTU",
      body: "Not confident content",
      tier: "base",
      confidence: 0.5,
      ownerId: "user-1",
    });
    assert.ok(!result.ok);
    assert.ok(result.error.includes("confidence < 0.7"));
  });

  it("semantically duplicate DTU rejected", () => {
    // First submission succeeds
    market.submitToMarketplace({
      title: "Introduction to Machine Learning",
      body: "ML content",
      tier: "mega",
      confidence: 0.9,
      ownerId: "user-1",
    });
    market.councilReview(0, "accept");

    // Duplicate submission rejected
    const result = market.submitToMarketplace({
      title: "Introduction to Machine Learning",
      body: "Similar ML content",
      tier: "base",
      confidence: 0.8,
      ownerId: "user-2",
    });
    assert.ok(!result.ok);
    assert.ok(result.error.includes("duplicate"));
  });

  it("council review accepts quality submission", () => {
    market.submitToMarketplace({
      title: "Quality Knowledge Unit",
      body: "High quality content",
      tier: "mega",
      confidence: 0.95,
      ownerId: "user-1",
    });

    const result = market.councilReview(0, "accept");
    assert.ok(result.ok);
    assert.ok(result.globalDTU);
    assert.equal(result.globalDTU.scope, "global");
  });

  it("council review rejects low-quality submission", () => {
    market.submitToMarketplace({
      title: "Questionable Content",
      body: "Needs improvement",
      tier: "base",
      confidence: 0.75,
      ownerId: "user-1",
    });

    const result = market.councilReview(0, "reject", "Content lacks depth and specificity");
    assert.ok(result.ok);
    assert.ok(result.rejected);
    assert.ok(result.reason.includes("lacks depth"));
  });

  it("accepted submission creates global DTU", () => {
    market.submitToMarketplace({
      title: "Accepted Knowledge",
      body: "Great content",
      tier: "mega",
      confidence: 0.9,
      ownerId: "user-1",
    });

    market.councilReview(0, "accept");
    assert.equal(market.globalDTUs.size, 1);
    const global = [...market.globalDTUs.values()][0];
    assert.equal(global.scope, "global");
  });

  it("accepted submission credits user", () => {
    market.submitToMarketplace({
      title: "Credited Knowledge",
      body: "Content worth crediting",
      tier: "mega",
      confidence: 0.9,
      ownerId: "user-1",
    });

    assert.equal(market.getUserCredits("user-1"), 0);
    market.councilReview(0, "accept");
    assert.equal(market.getUserCredits("user-1"), 1);
  });

  it("rejected submission returns reason", () => {
    market.submitToMarketplace({
      title: "Rejected Content",
      body: "Bad content",
      tier: "base",
      confidence: 0.75,
      ownerId: "user-1",
    });

    const result = market.councilReview(0, "reject", "Insufficient evidence for claims");
    assert.ok(result.reason);
    assert.equal(result.reason, "Insufficient evidence for claims");
  });

  it("new user starts with zero local DTUs", () => {
    const dtus = market.getLocalDTUs("brand-new-user");
    assert.equal(dtus.length, 0);
  });

  it("user can pull global DTU into local instance", () => {
    market.submitToMarketplace({
      title: "Pullable Knowledge",
      body: "Content to share",
      tier: "mega",
      confidence: 0.9,
      ownerId: "user-1",
    });
    market.councilReview(0, "accept");

    const globalId = [...market.globalDTUs.keys()][0];
    const result = market.pullGlobalDTU(globalId, "user-2");
    assert.ok(result.ok);
    assert.equal(result.dtu.scope, "local");
    assert.equal(result.dtu.ownerId, "user-2");
    assert.equal(result.dtu.sourceGlobalId, globalId);
  });
});
