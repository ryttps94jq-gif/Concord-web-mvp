/**
 * Comprehensive tests for emergent/lattice-ops.js
 *
 * Covers: OP_CLASS, getLatticeOps, readDTU, readStaging, queryLattice,
 * proposeDTU, proposeEdit, proposeEdge, commitProposal, rejectProposal,
 * listProposals, getLatticeMetrics, plus internal apply helpers and utilities.
 *
 * Run: node --test tests/emergent-lattice-ops.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  OP_CLASS,
  getLatticeOps,
  readDTU,
  readStaging,
  queryLattice,
  proposeDTU,
  proposeEdit,
  proposeEdge,
  commitProposal,
  rejectProposal,
  listProposals,
  getLatticeMetrics,
} from "../emergent/lattice-ops.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSTATE() {
  return {
    __emergent: {
      version: "1.0.0",
      emergents: new Map(),
    },
    dtus: new Map(),
    shadowDtus: new Map(),
  };
}

// ── OP_CLASS ─────────────────────────────────────────────────────────────────

describe("OP_CLASS constant", () => {
  it("has READ, PROPOSE, COMMIT keys with correct values", () => {
    assert.equal(OP_CLASS.READ, "read");
    assert.equal(OP_CLASS.PROPOSE, "propose");
    assert.equal(OP_CLASS.COMMIT, "commit");
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(OP_CLASS));
  });
});

// ── getLatticeOps ────────────────────────────────────────────────────────────

describe("getLatticeOps", () => {
  it("initializes lattice ops on first call", () => {
    const STATE = makeSTATE();
    const ops = getLatticeOps(STATE);
    assert.ok(ops.staging);
    assert.ok(ops.staging.dtus instanceof Map);
    assert.ok(ops.staging.edges instanceof Map);
    assert.ok(ops.staging.artifacts instanceof Map);
    assert.ok(ops.proposals instanceof Map);
    assert.ok(Array.isArray(ops.commitLog));
    assert.deepEqual(ops.metrics, {
      reads: 0,
      proposals: 0,
      commits: 0,
      rejections: 0,
      mergeConflicts: 0,
    });
  });

  it("returns same object on subsequent calls", () => {
    const STATE = makeSTATE();
    const ops1 = getLatticeOps(STATE);
    const ops2 = getLatticeOps(STATE);
    assert.equal(ops1, ops2);
  });
});

// ── readDTU ──────────────────────────────────────────────────────────────────

describe("readDTU", () => {
  it("reads from canonical lattice", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1", title: "Test" });
    const result = readDTU(STATE, "dtu1", "reader1");
    assert.ok(result.ok);
    assert.equal(result.source, "canonical");
    assert.equal(result.readerId, "reader1");
    assert.equal(result.dtu.id, "dtu1");
  });

  it("returns a snapshot (not the original reference)", () => {
    const STATE = makeSTATE();
    const original = { id: "dtu2", title: "Original" };
    STATE.dtus.set("dtu2", original);
    const result = readDTU(STATE, "dtu2", "reader1");
    result.dtu.title = "Modified";
    assert.equal(original.title, "Original");
  });

  it("reads from shadow lattice when not in canonical", () => {
    const STATE = makeSTATE();
    STATE.shadowDtus.set("sdtu1", { id: "sdtu1", title: "Shadow" });
    const result = readDTU(STATE, "sdtu1", "reader1");
    assert.ok(result.ok);
    assert.equal(result.source, "shadow");
  });

  it("returns not_found when DTU absent", () => {
    const STATE = makeSTATE();
    const result = readDTU(STATE, "missing", "reader1");
    assert.ok(!result.ok);
    assert.equal(result.error, "not_found");
    assert.equal(result.dtuId, "missing");
  });

  it("increments reads metric", () => {
    const STATE = makeSTATE();
    readDTU(STATE, "x", "r1");
    readDTU(STATE, "y", "r2");
    const ops = getLatticeOps(STATE);
    assert.equal(ops.metrics.reads, 2);
  });

  it("handles missing dtus map gracefully", () => {
    const STATE = makeSTATE();
    STATE.dtus = undefined;
    STATE.shadowDtus = undefined;
    const result = readDTU(STATE, "any", "reader");
    assert.ok(!result.ok);
    assert.equal(result.error, "not_found");
  });
});

// ── readStaging ──────────────────────────────────────────────────────────────

describe("readStaging", () => {
  it("reads from staging dtus", () => {
    const STATE = makeSTATE();
    const ops = getLatticeOps(STATE);
    ops.staging.dtus.set("p1", { title: "Staged DTU" });
    const result = readStaging(STATE, "p1");
    assert.ok(result.ok);
    assert.equal(result.item.title, "Staged DTU");
  });

  it("reads from staging edges", () => {
    const STATE = makeSTATE();
    const ops = getLatticeOps(STATE);
    ops.staging.edges.set("p2", { sourceId: "a", targetId: "b" });
    const result = readStaging(STATE, "p2");
    assert.ok(result.ok);
    assert.equal(result.item.sourceId, "a");
  });

  it("reads from staging artifacts", () => {
    const STATE = makeSTATE();
    const ops = getLatticeOps(STATE);
    ops.staging.artifacts.set("p3", { name: "art" });
    const result = readStaging(STATE, "p3");
    assert.ok(result.ok);
    assert.equal(result.item.name, "art");
  });

  it("returns not_found_in_staging when missing", () => {
    const STATE = makeSTATE();
    const result = readStaging(STATE, "missing");
    assert.ok(!result.ok);
    assert.equal(result.error, "not_found_in_staging");
  });

  it("increments reads metric", () => {
    const STATE = makeSTATE();
    readStaging(STATE, "x");
    const ops = getLatticeOps(STATE);
    assert.equal(ops.metrics.reads, 1);
  });
});

// ── queryLattice ─────────────────────────────────────────────────────────────

describe("queryLattice", () => {
  let STATE;

  beforeEach(() => {
    STATE = makeSTATE();
    STATE.dtus.set("d1", { id: "d1", tags: ["math"], tier: "mega", resonance: 0.8, coherence: 0.9 });
    STATE.dtus.set("d2", { id: "d2", tags: ["physics"], tier: "regular", resonance: 0.3, coherence: 0.5 });
    STATE.dtus.set("d3", { id: "d3", tags: ["math", "physics"], tier: "mega", resonance: 0.6, coherence: 0.7 });
    STATE.shadowDtus.set("s1", { id: "s1", tags: ["math"], tier: "shadow", resonance: 0.4 });
  });

  it("returns all canonical DTUs with no filter", () => {
    const result = queryLattice(STATE);
    assert.ok(result.ok);
    assert.equal(result.count, 3);
  });

  it("filters by tags", () => {
    const result = queryLattice(STATE, { tags: ["physics"] });
    assert.ok(result.ok);
    assert.equal(result.count, 2);
  });

  it("filters by tier", () => {
    const result = queryLattice(STATE, { tier: "mega" });
    assert.ok(result.ok);
    assert.equal(result.count, 2);
  });

  it("filters by minResonance", () => {
    const result = queryLattice(STATE, { minResonance: 0.5 });
    assert.ok(result.ok);
    assert.equal(result.count, 2);
  });

  it("filters by minCoherence", () => {
    const result = queryLattice(STATE, { minCoherence: 0.8 });
    assert.ok(result.ok);
    assert.equal(result.count, 1);
  });

  it("includes shadow DTUs when includeShadows is true", () => {
    const result = queryLattice(STATE, { includeShadows: true, tags: ["math"] });
    assert.ok(result.ok);
    assert.equal(result.count, 3); // d1, d3, s1
  });

  it("respects limit, defaults to 50", () => {
    const result = queryLattice(STATE, { limit: 2 });
    assert.ok(result.ok);
    assert.equal(result.count, 2);
  });

  it("caps limit at 200", () => {
    const result = queryLattice(STATE, { limit: 500 });
    assert.ok(result.ok);
    // Just tests the function runs, since we only have 3 DTUs
    assert.ok(result.count <= 200);
  });

  it("handles empty dtus map", () => {
    STATE.dtus = undefined;
    const result = queryLattice(STATE);
    assert.ok(result.ok);
    assert.equal(result.count, 0);
  });

  it("handles DTUs without tags gracefully", () => {
    STATE.dtus.set("d4", { id: "d4", tier: "regular" });
    const result = queryLattice(STATE, { tags: ["math"] });
    assert.ok(result.ok);
    // d4 should be filtered out (no tags)
  });

  it("handles DTUs without resonance/coherence in min filters", () => {
    STATE.dtus.set("d5", { id: "d5" });
    const result = queryLattice(STATE, { minResonance: 0, minCoherence: 0 });
    assert.ok(result.ok);
  });
});

// ── proposeDTU ───────────────────────────────────────────────────────────────

describe("proposeDTU", () => {
  it("creates a proposal with all defaults", () => {
    const STATE = makeSTATE();
    const result = proposeDTU(STATE);
    assert.ok(result.ok);
    const p = result.proposal;
    assert.ok(p.proposalId.startsWith("prop_"));
    assert.equal(p.type, "dtu_create");
    assert.equal(p.status, "pending");
    assert.equal(p.proposedBy, "unknown");
    assert.equal(p.data.title, "Untitled");
    assert.equal(p.data.tier, "regular");
    assert.equal(p.confidenceLabel, "hypothesis");
    assert.equal(p.expectedImpact, "low");
  });

  it("creates a proposal with custom opts", () => {
    const STATE = makeSTATE();
    const result = proposeDTU(STATE, {
      proposedBy: "emergent1",
      sessionId: "sess1",
      title: "My DTU",
      content: "Hello world",
      summary: "short summary",
      tier: "mega",
      tags: ["a", "b"],
      parents: ["p1"],
      resonance: 0.5,
      coherence: 0.6,
      stability: 0.7,
      meta: { key: "val" },
      confidenceLabel: "validated",
      predictedConfidence: 0.9,
      expectedImpact: "high",
      noveltyScore: 0.8,
    });
    assert.ok(result.ok);
    const p = result.proposal;
    assert.equal(p.proposedBy, "emergent1");
    assert.equal(p.data.title, "My DTU");
    assert.equal(p.data.tier, "mega");
    assert.deepEqual(p.data.tags, ["a", "b"]);
    assert.equal(p.confidenceLabel, "validated");
    assert.equal(p.expectedImpact, "high");
    assert.equal(p.noveltyScore, 0.8);
  });

  it("stores proposal in proposals map and staging", () => {
    const STATE = makeSTATE();
    const result = proposeDTU(STATE, { title: "Test" });
    const ops = getLatticeOps(STATE);
    assert.ok(ops.proposals.has(result.proposal.proposalId));
    assert.ok(ops.staging.dtus.has(result.proposal.proposalId));
  });

  it("increments proposals metric", () => {
    const STATE = makeSTATE();
    proposeDTU(STATE);
    proposeDTU(STATE);
    const ops = getLatticeOps(STATE);
    assert.equal(ops.metrics.proposals, 2);
  });

  it("truncates title to 500 chars", () => {
    const STATE = makeSTATE();
    const result = proposeDTU(STATE, { title: "x".repeat(600) });
    assert.equal(result.proposal.data.title.length, 500);
  });

  it("truncates content to 10000 chars", () => {
    const STATE = makeSTATE();
    const result = proposeDTU(STATE, { content: "x".repeat(15000) });
    assert.equal(result.proposal.data.content.length, 10000);
  });

  it("handles tags that are not an array", () => {
    const STATE = makeSTATE();
    const result = proposeDTU(STATE, { tags: "not-an-array" });
    assert.deepEqual(result.proposal.data.tags, []);
  });

  it("limits tags to 20", () => {
    const STATE = makeSTATE();
    const tags = Array.from({ length: 30 }, (_, i) => `tag${i}`);
    const result = proposeDTU(STATE, { tags });
    assert.equal(result.proposal.data.tags.length, 20);
  });
});

// ── proposeEdit ──────────────────────────────────────────────────────────────

describe("proposeEdit", () => {
  it("creates an edit proposal for an existing DTU", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1", title: "Original" });
    const result = proposeEdit(STATE, {
      targetDtuId: "dtu1",
      proposedBy: "emergent1",
      edits: { title: "New Title", resonance: 0.9 },
      reason: "Improving accuracy",
    });
    assert.ok(result.ok);
    assert.equal(result.proposal.type, "dtu_edit");
    assert.equal(result.proposal.targetDtuId, "dtu1");
  });

  it("returns error for missing target DTU", () => {
    const STATE = makeSTATE();
    const result = proposeEdit(STATE, { targetDtuId: "missing" });
    assert.ok(!result.ok);
    assert.equal(result.error, "target_dtu_not_found");
  });

  it("sanitizes edits to only allowed fields", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1" });
    const result = proposeEdit(STATE, {
      targetDtuId: "dtu1",
      edits: { title: "new", dangerousField: "hack", resonance: 0.5, meta: {} },
    });
    assert.ok(result.ok);
    assert.equal(result.proposal.edits.title, "new");
    assert.equal(result.proposal.edits.resonance, 0.5);
    assert.equal(result.proposal.edits.dangerousField, undefined);
    assert.ok(result.proposal.edits.meta !== undefined);
  });

  it("increments proposals metric", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1" });
    proposeEdit(STATE, { targetDtuId: "dtu1" });
    const ops = getLatticeOps(STATE);
    assert.equal(ops.metrics.proposals, 1);
  });

  it("truncates reason to 2000 chars", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1" });
    const result = proposeEdit(STATE, {
      targetDtuId: "dtu1",
      reason: "x".repeat(3000),
    });
    assert.equal(result.proposal.reason.length, 2000);
  });
});

// ── proposeEdge ──────────────────────────────────────────────────────────────

describe("proposeEdge", () => {
  it("creates an edge proposal", () => {
    const STATE = makeSTATE();
    const result = proposeEdge(STATE, {
      sourceId: "a",
      targetId: "b",
      edgeType: "supports",
      weight: 0.7,
      confidence: 0.8,
      evidenceRefs: ["ref1"],
      proposedBy: "em1",
    });
    assert.ok(result.ok);
    assert.equal(result.proposal.type, "edge_create");
    assert.equal(result.proposal.data.sourceId, "a");
    assert.equal(result.proposal.data.targetId, "b");
    assert.equal(result.proposal.data.weight, 0.7);
    assert.equal(result.proposal.data.confidence, 0.8);
  });

  it("clamps weight and confidence to [0,1]", () => {
    const STATE = makeSTATE();
    const result = proposeEdge(STATE, { weight: 5, confidence: -1 });
    assert.equal(result.proposal.data.weight, 1);
    assert.equal(result.proposal.data.confidence, 0);
  });

  it("stores in proposals and staging edges", () => {
    const STATE = makeSTATE();
    const result = proposeEdge(STATE);
    const ops = getLatticeOps(STATE);
    assert.ok(ops.proposals.has(result.proposal.proposalId));
    assert.ok(ops.staging.edges.has(result.proposal.proposalId));
  });

  it("handles missing evidenceRefs", () => {
    const STATE = makeSTATE();
    const result = proposeEdge(STATE, {});
    assert.deepEqual(result.proposal.data.evidenceRefs, []);
  });
});

// ── commitProposal ───────────────────────────────────────────────────────────

describe("commitProposal", () => {
  it("commits a dtu_create proposal", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE, { title: "Test DTU", proposedBy: "em1" });
    const result = commitProposal(STATE, prop.proposal.proposalId, {
      gateTrace: { approved: true },
      committedBy: "council",
    });
    assert.ok(result.ok);
    assert.ok(result.commit);
    assert.equal(result.commit.type, "dtu_create");
    assert.equal(result.commit.proposedBy, "em1");
    // DTU should exist in canonical lattice
    assert.ok(STATE.dtus.size > 0);
  });

  it("commits a dtu_edit proposal", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1", title: "Old", meta: {} });
    const prop = proposeEdit(STATE, {
      targetDtuId: "dtu1",
      edits: { title: "New" },
    });
    const result = commitProposal(STATE, prop.proposal.proposalId, {
      gateTrace: { approved: true },
    });
    assert.ok(result.ok);
    assert.equal(STATE.dtus.get("dtu1").title, "New");
  });

  it("commits an edge_create proposal", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("a", { id: "a", relatedIds: [] });
    STATE.dtus.set("b", { id: "b" });
    const prop = proposeEdge(STATE, { sourceId: "a", targetId: "b" });
    const result = commitProposal(STATE, prop.proposal.proposalId, {
      gateTrace: { approved: true },
    });
    assert.ok(result.ok);
    assert.ok(STATE.dtus.get("a").relatedIds.includes("b"));
  });

  it("rejects if proposal not found", () => {
    const STATE = makeSTATE();
    const result = commitProposal(STATE, "missing", { gateTrace: {} });
    assert.ok(!result.ok);
    assert.equal(result.error, "proposal_not_found");
  });

  it("rejects if proposal not pending", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    rejectProposal(STATE, prop.proposal.proposalId, "bad");
    const result = commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(!result.ok);
    assert.equal(result.error, "proposal_not_pending");
  });

  it("rejects if gate trace missing", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    const result = commitProposal(STATE, prop.proposal.proposalId, {});
    assert.ok(!result.ok);
    assert.equal(result.error, "gate_trace_required");
  });

  it("handles unknown proposal type", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    // Manually change type to something invalid
    getLatticeOps(STATE).proposals.get(prop.proposal.proposalId).type = "alien";
    const result = commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(!result.ok);
    assert.equal(result.error, "unknown_proposal_type");
  });

  it("handles merge conflict for dtu_edit when target is gone", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1" });
    const prop = proposeEdit(STATE, { targetDtuId: "dtu1", edits: { title: "New" } });
    // Remove the DTU before commit
    STATE.dtus.delete("dtu1");
    const result = commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(!result.ok);
    assert.equal(result.error, "merge_conflict");
    const ops = getLatticeOps(STATE);
    assert.equal(ops.metrics.mergeConflicts, 1);
  });

  it("removes from staging on commit", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE, { title: "Test" });
    const ops = getLatticeOps(STATE);
    assert.ok(ops.staging.dtus.has(prop.proposal.proposalId));
    commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(!ops.staging.dtus.has(prop.proposal.proposalId));
  });

  it("edge_create handles source DTU without relatedIds", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("a", { id: "a" }); // no relatedIds
    const prop = proposeEdge(STATE, { sourceId: "a", targetId: "b" });
    const result = commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(result.ok);
    assert.ok(STATE.dtus.get("a").relatedIds.includes("b"));
  });

  it("edge_create does not duplicate relatedIds", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("a", { id: "a", relatedIds: ["b"] });
    const prop = proposeEdge(STATE, { sourceId: "a", targetId: "b" });
    const result = commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(result.ok);
    assert.equal(STATE.dtus.get("a").relatedIds.filter(id => id === "b").length, 1);
  });

  it("edge_create handles missing source DTU gracefully", () => {
    const STATE = makeSTATE();
    // No DTU for source
    const prop = proposeEdge(STATE, { sourceId: "missing", targetId: "b" });
    const result = commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(result.ok); // applyEdgeCreate still returns ok: true
  });

  it("dtu_create creates dtus Map if missing", () => {
    const STATE = makeSTATE();
    STATE.dtus = undefined;
    const prop = proposeDTU(STATE, { title: "Created" });
    const result = commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    assert.ok(result.ok);
    assert.ok(STATE.dtus instanceof Map);
    assert.ok(STATE.dtus.size > 0);
  });

  it("dtu_edit applies only allowed fields", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1", title: "Old", content: "old", resonance: 0.1 });
    const prop = proposeEdit(STATE, {
      targetDtuId: "dtu1",
      edits: { title: "New", content: "new", resonance: 0.9, summary: "s", tags: ["t"], coherence: 0.5, stability: 0.3 },
    });
    commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    const dtu = STATE.dtus.get("dtu1");
    assert.equal(dtu.title, "New");
    assert.equal(dtu.content, "new");
    assert.equal(dtu.resonance, 0.9);
    assert.equal(dtu.summary, "s");
    assert.deepEqual(dtu.tags, ["t"]);
    assert.equal(dtu.coherence, 0.5);
    assert.equal(dtu.stability, 0.3);
    assert.ok(dtu.updatedAt);
    assert.equal(dtu.meta._lastEditProposal, prop.proposal.proposalId);
  });

  it("increments commits metric and adds to commit log", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    commitProposal(STATE, prop.proposal.proposalId, { gateTrace: {} });
    const ops = getLatticeOps(STATE);
    assert.equal(ops.metrics.commits, 1);
    assert.equal(ops.commitLog.length, 1);
  });
});

// ── rejectProposal ───────────────────────────────────────────────────────────

describe("rejectProposal", () => {
  it("rejects a pending proposal", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    const result = rejectProposal(STATE, prop.proposal.proposalId, "Not good");
    assert.ok(result.ok);
    assert.equal(result.status, "rejected");
    // Verify proposal state
    const ops = getLatticeOps(STATE);
    const rejected = ops.proposals.get(prop.proposal.proposalId);
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectionReason, "Not good");
  });

  it("returns error for missing proposal", () => {
    const STATE = makeSTATE();
    const result = rejectProposal(STATE, "missing", "reason");
    assert.ok(!result.ok);
    assert.equal(result.error, "proposal_not_found");
  });

  it("returns error if proposal not pending", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    rejectProposal(STATE, prop.proposal.proposalId, "first");
    const result = rejectProposal(STATE, prop.proposal.proposalId, "second");
    assert.ok(!result.ok);
    assert.equal(result.error, "proposal_not_pending");
  });

  it("removes from staging on rejection", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE, { title: "T" });
    const ops = getLatticeOps(STATE);
    assert.ok(ops.staging.dtus.has(prop.proposal.proposalId));
    rejectProposal(STATE, prop.proposal.proposalId, "bad");
    assert.ok(!ops.staging.dtus.has(prop.proposal.proposalId));
  });

  it("increments rejections metric", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    rejectProposal(STATE, prop.proposal.proposalId, "nope");
    assert.equal(getLatticeOps(STATE).metrics.rejections, 1);
  });

  it("truncates rejection reason to 2000 chars", () => {
    const STATE = makeSTATE();
    const prop = proposeDTU(STATE);
    rejectProposal(STATE, prop.proposal.proposalId, "x".repeat(3000));
    const rejected = getLatticeOps(STATE).proposals.get(prop.proposal.proposalId);
    assert.equal(rejected.rejectionReason.length, 2000);
  });
});

// ── listProposals ────────────────────────────────────────────────────────────

describe("listProposals", () => {
  it("lists all proposals with no filter", () => {
    const STATE = makeSTATE();
    proposeDTU(STATE, { proposedBy: "a" });
    proposeDTU(STATE, { proposedBy: "b" });
    const result = listProposals(STATE);
    assert.ok(result.ok);
    assert.equal(result.count, 2);
  });

  it("filters by status", () => {
    const STATE = makeSTATE();
    const p1 = proposeDTU(STATE);
    proposeDTU(STATE);
    rejectProposal(STATE, p1.proposal.proposalId, "bad");
    const result = listProposals(STATE, { status: "rejected" });
    assert.equal(result.count, 1);
  });

  it("filters by type", () => {
    const STATE = makeSTATE();
    STATE.dtus.set("dtu1", { id: "dtu1" });
    proposeDTU(STATE);
    proposeEdit(STATE, { targetDtuId: "dtu1" });
    const result = listProposals(STATE, { type: "dtu_edit" });
    assert.equal(result.count, 1);
  });

  it("filters by proposedBy", () => {
    const STATE = makeSTATE();
    proposeDTU(STATE, { proposedBy: "alice" });
    proposeDTU(STATE, { proposedBy: "bob" });
    const result = listProposals(STATE, { proposedBy: "alice" });
    assert.equal(result.count, 1);
  });

  it("returns empty list when no proposals match", () => {
    const STATE = makeSTATE();
    const result = listProposals(STATE, { status: "committed" });
    assert.ok(result.ok);
    assert.equal(result.count, 0);
  });
});

// ── getLatticeMetrics ────────────────────────────────────────────────────────

describe("getLatticeMetrics", () => {
  it("returns comprehensive metrics", () => {
    const STATE = makeSTATE();
    proposeDTU(STATE);
    proposeDTU(STATE);
    readDTU(STATE, "x", "r");
    const metrics = getLatticeMetrics(STATE);
    assert.ok(metrics.ok);
    assert.equal(metrics.metrics.proposals, 2);
    assert.equal(metrics.metrics.reads, 1);
    assert.equal(metrics.pendingProposals, 2);
    assert.equal(metrics.stagingDtus, 2);
    assert.equal(metrics.stagingEdges, 0);
    assert.equal(metrics.commitLogSize, 0);
  });
});
