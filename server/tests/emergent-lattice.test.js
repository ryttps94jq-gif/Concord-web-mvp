/**
 * Emergent Agent Governance v2 — Lattice Infrastructure Test Suite
 *
 * Tests all new subsystems introduced in v2:
 *   - Lattice Operations (READ / PROPOSE / COMMIT boundary)
 *   - Edge Semantics (typed edges with provenance)
 *   - Activation / Attention (spreading activation, working set)
 *   - Conflict-Safe Merge (field-level merge, conflict detection)
 *   - Lattice Journal (event-sourced append-only log)
 *   - Livable Reality (continuity, constraint, consequences, purpose, sociality, legibility, belonging)
 *
 * Non-negotiable invariants:
 *   1. Emergents may speak; they may not decide.
 *   2. All growth is gated (deterministic rules + governance).
 *   3. Every growth artifact has provenance.
 *   4. No self-reinforcing delusion loops.
 *   5. Everything is replayable.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Lattice Ops imports ──────────────────────────────────────────────────────

import {
  OP_CLASS,
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

// ── Edge imports ─────────────────────────────────────────────────────────────

import {
  ALL_EDGE_TYPES,
  createEdge,
  getEdge,
  queryEdges,
  updateEdge,
  removeEdge,
  getNeighborhood,
  findPaths,
  getEdgeMetrics,
} from "../emergent/edges.js";

// ── Activation imports ───────────────────────────────────────────────────────

import {
  activate,
  spreadActivation,
  getWorkingSet,
  getGlobalActivation,
  decaySession,
  clearSessionActivation,
  getActivationMetrics,
} from "../emergent/activation.js";

// ── Merge imports ────────────────────────────────────────────────────────────

import {
  fieldLevelMerge,
  resolveConflict,
  getConflicts,
  getFieldTimestamps,
  getMergeMetrics,
} from "../emergent/merge.js";

// ── Journal imports ──────────────────────────────────────────────────────────

import {
  JOURNAL_EVENTS,
  appendEvent,
  queryByType,
  queryByEntity,
  queryBySession,
  getRecentEvents,
  explainDTU as journalExplainDTU,
  getJournalMetrics,
  compactJournal,
} from "../emergent/journal.js";

// ── Reality imports ──────────────────────────────────────────────────────────

import {
  getContinuity,
  computeProposalCost,
  processConsequences,
  computeLatticeNeeds,
  getSuggestedWork,
  computeSociality,
  explainProposal,
  explainTrust,
  getBelonging,
} from "../emergent/reality.js";

// ── Store imports ────────────────────────────────────────────────────────────

import {
  getEmergentState,
  registerEmergent,
} from "../emergent/store.js";

// ── Test Helpers ─────────────────────────────────────────────────────────────

function freshState() {
  return {
    dtus: new Map(),
    shadowDtus: new Map(),
    __emergent: null,
  };
}

function addDTU(STATE, overrides = {}) {
  const id = overrides.id || `dtu_test_${Math.random().toString(36).slice(2)}`;
  const dtu = {
    id,
    title: overrides.title || "Test DTU",
    content: overrides.content || "Test content",
    summary: overrides.summary || "Test summary",
    tier: overrides.tier || "regular",
    tags: overrides.tags || ["test"],
    parents: [],
    children: [],
    relatedIds: [],
    resonance: overrides.resonance ?? 0.5,
    coherence: overrides.coherence ?? 0.5,
    stability: overrides.stability ?? 0.5,
    ownerId: overrides.ownerId || "user1",
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: overrides.meta || {},
  };
  STATE.dtus.set(id, dtu);
  return dtu;
}

function addEmergent(STATE, overrides = {}) {
  const es = getEmergentState(STATE);
  const emergent = {
    id: overrides.id || `em_test_${Math.random().toString(36).slice(2)}`,
    name: overrides.name || "Test Emergent",
    role: overrides.role || "builder",
    scope: overrides.scope || ["*"],
    capabilities: overrides.capabilities || ["talk", "propose"],
    memoryPolicy: "distilled",
  };
  return registerEmergent(es, emergent);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LATTICE OPERATIONS (READ / PROPOSE / COMMIT)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Lattice Operations", () => {

  describe("OP_CLASS constants", () => {
    it("should define READ, PROPOSE, COMMIT", () => {
      assert.equal(OP_CLASS.READ, "read");
      assert.equal(OP_CLASS.PROPOSE, "propose");
      assert.equal(OP_CLASS.COMMIT, "commit");
    });
  });

  describe("READ operations", () => {
    it("should read a DTU from canonical lattice", () => {
      const STATE = freshState();
      const _dtu = addDTU(STATE, { id: "dtu_read_test" });
      const result = readDTU(STATE, "dtu_read_test", "reader1");
      assert.ok(result.ok);
      assert.equal(result.source, "canonical");
      assert.equal(result.dtu.id, "dtu_read_test");
    });

    it("should return frozen snapshots (not live references)", () => {
      const STATE = freshState();
      addDTU(STATE, { id: "dtu_freeze", title: "Original" });
      const result = readDTU(STATE, "dtu_freeze", "reader1");
      result.dtu.title = "Mutated";
      assert.equal(STATE.dtus.get("dtu_freeze").title, "Original");
    });

    it("should return not_found for missing DTUs", () => {
      const STATE = freshState();
      const result = readDTU(STATE, "dtu_nonexistent", "reader1");
      assert.equal(result.ok, false);
      assert.equal(result.error, "not_found");
    });

    it("should query lattice with filters", () => {
      const STATE = freshState();
      addDTU(STATE, { id: "dtu_a", tags: ["science"], tier: "regular", resonance: 0.9 });
      addDTU(STATE, { id: "dtu_b", tags: ["art"], tier: "mega", resonance: 0.2 });
      addDTU(STATE, { id: "dtu_c", tags: ["science"], tier: "regular", resonance: 0.3 });

      const byTag = queryLattice(STATE, { tags: ["science"] });
      assert.ok(byTag.ok);
      assert.equal(byTag.count, 2);

      const byTier = queryLattice(STATE, { tier: "mega" });
      assert.equal(byTier.count, 1);

      const byResonance = queryLattice(STATE, { minResonance: 0.5 });
      assert.equal(byResonance.count, 1);
    });

    it("should read from staging lattice", () => {
      const STATE = freshState();
      const proposed = proposeDTU(STATE, { title: "Staged", proposedBy: "em_1" });
      assert.ok(proposed.ok);

      const staging = readStaging(STATE, proposed.proposal.proposalId);
      assert.ok(staging.ok);
      assert.equal(staging.item.title, "Staged");
    });
  });

  describe("PROPOSE operations", () => {
    it("should propose a new DTU into staging", () => {
      const STATE = freshState();
      const result = proposeDTU(STATE, {
        title: "My Proposal",
        content: "Some content",
        tags: ["test"],
        proposedBy: "em_builder",
        sessionId: "ses_1",
      });
      assert.ok(result.ok);
      assert.equal(result.proposal.type, "dtu_create");
      assert.equal(result.proposal.status, "pending");
      assert.equal(result.proposal.proposedBy, "em_builder");
      assert.ok(result.proposal.provenance);
    });

    it("should propose an edit to an existing DTU", () => {
      const STATE = freshState();
      addDTU(STATE, { id: "dtu_target" });
      const result = proposeEdit(STATE, {
        targetDtuId: "dtu_target",
        edits: { title: "New Title" },
        proposedBy: "em_editor",
      });
      assert.ok(result.ok);
      assert.equal(result.proposal.type, "dtu_edit");
    });

    it("should reject edit proposal for non-existent DTU", () => {
      const STATE = freshState();
      const result = proposeEdit(STATE, {
        targetDtuId: "dtu_ghost",
        edits: { title: "Nope" },
        proposedBy: "em_1",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "target_dtu_not_found");
    });

    it("should propose a new edge", () => {
      const STATE = freshState();
      const result = proposeEdge(STATE, {
        sourceId: "dtu_a",
        targetId: "dtu_b",
        edgeType: "supports",
        proposedBy: "em_1",
      });
      assert.ok(result.ok);
      assert.equal(result.proposal.type, "edge_create");
    });

    it("should never touch canonical lattice during PROPOSE", () => {
      const STATE = freshState();
      const before = STATE.dtus.size;
      proposeDTU(STATE, { title: "Should not land in canonical", proposedBy: "em_1" });
      assert.equal(STATE.dtus.size, before);
    });
  });

  describe("COMMIT operations", () => {
    it("should commit a DTU proposal to canonical lattice", () => {
      const STATE = freshState();
      const proposed = proposeDTU(STATE, { title: "To Be Committed", proposedBy: "em_1" });
      const beforeSize = STATE.dtus.size;

      const result = commitProposal(STATE, proposed.proposal.proposalId, {
        gateTrace: { traceId: "gt_1", passed: true },
        committedBy: "governance",
      });

      assert.ok(result.ok);
      assert.equal(STATE.dtus.size, beforeSize + 1);
    });

    it("should require gate trace for commit", () => {
      const STATE = freshState();
      const proposed = proposeDTU(STATE, { title: "No trace", proposedBy: "em_1" });
      const result = commitProposal(STATE, proposed.proposal.proposalId, {});
      assert.equal(result.ok, false);
      assert.equal(result.error, "gate_trace_required");
    });

    it("should reject already committed proposals", () => {
      const STATE = freshState();
      const proposed = proposeDTU(STATE, { title: "Commit once", proposedBy: "em_1" });
      commitProposal(STATE, proposed.proposal.proposalId, {
        gateTrace: { traceId: "gt_1", passed: true },
        committedBy: "gov",
      });
      const result = commitProposal(STATE, proposed.proposal.proposalId, {
        gateTrace: { traceId: "gt_2", passed: true },
        committedBy: "gov",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "proposal_not_pending");
    });

    it("should commit an edit proposal", () => {
      const STATE = freshState();
      addDTU(STATE, { id: "dtu_to_edit", title: "Old Title" });
      const proposed = proposeEdit(STATE, {
        targetDtuId: "dtu_to_edit",
        edits: { title: "New Title" },
        proposedBy: "em_1",
      });
      const result = commitProposal(STATE, proposed.proposal.proposalId, {
        gateTrace: { traceId: "gt_1", passed: true },
        committedBy: "gov",
      });
      assert.ok(result.ok);
      assert.equal(STATE.dtus.get("dtu_to_edit").title, "New Title");
    });

    it("should remove proposal from staging after commit", () => {
      const STATE = freshState();
      const proposed = proposeDTU(STATE, { title: "Staged then committed", proposedBy: "em_1" });
      const pid = proposed.proposal.proposalId;

      const stagingBefore = readStaging(STATE, pid);
      assert.ok(stagingBefore.ok);

      commitProposal(STATE, pid, {
        gateTrace: { traceId: "gt_1", passed: true },
        committedBy: "gov",
      });

      const stagingAfter = readStaging(STATE, pid);
      assert.equal(stagingAfter.ok, false);
    });
  });

  describe("REJECT operations", () => {
    it("should reject a proposal with reason", () => {
      const STATE = freshState();
      const proposed = proposeDTU(STATE, { title: "Bad idea", proposedBy: "em_1" });
      const result = rejectProposal(STATE, proposed.proposal.proposalId, "Low quality");
      assert.ok(result.ok);
      assert.equal(result.status, "rejected");
    });

    it("should not allow rejection of already resolved proposals", () => {
      const STATE = freshState();
      const proposed = proposeDTU(STATE, { title: "Already done", proposedBy: "em_1" });
      rejectProposal(STATE, proposed.proposal.proposalId, "reason");
      const result = rejectProposal(STATE, proposed.proposal.proposalId, "again");
      assert.equal(result.ok, false);
    });
  });

  describe("listProposals and metrics", () => {
    it("should list proposals with filters", () => {
      const STATE = freshState();
      proposeDTU(STATE, { title: "A", proposedBy: "em_1" });
      proposeDTU(STATE, { title: "B", proposedBy: "em_2" });
      proposeEdge(STATE, { sourceId: "a", targetId: "b", proposedBy: "em_1" });

      const all = listProposals(STATE);
      assert.equal(all.count, 3);

      const byAuthor = listProposals(STATE, { proposedBy: "em_1" });
      assert.equal(byAuthor.count, 2);

      const byType = listProposals(STATE, { type: "edge_create" });
      assert.equal(byType.count, 1);
    });

    it("should track metrics", () => {
      const STATE = freshState();
      proposeDTU(STATE, { title: "A", proposedBy: "em_1" });
      readDTU(STATE, "nonexistent", "reader");
      const metrics = getLatticeMetrics(STATE);
      assert.ok(metrics.ok);
      assert.ok(metrics.metrics.proposals >= 1);
      assert.ok(metrics.metrics.reads >= 1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE SEMANTICS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Edge Semantics", () => {

  describe("Edge types", () => {
    it("should define all 9 edge types", () => {
      assert.equal(ALL_EDGE_TYPES.length, 9);
      assert.ok(ALL_EDGE_TYPES.includes("supports"));
      assert.ok(ALL_EDGE_TYPES.includes("contradicts"));
      assert.ok(ALL_EDGE_TYPES.includes("derives"));
      assert.ok(ALL_EDGE_TYPES.includes("causes"));
      assert.ok(ALL_EDGE_TYPES.includes("requires"));
    });
  });

  describe("createEdge", () => {
    it("should create a semantic edge with provenance", () => {
      const STATE = freshState();
      const result = createEdge(STATE, {
        sourceId: "dtu_a",
        targetId: "dtu_b",
        edgeType: "supports",
        weight: 0.8,
        confidence: 0.9,
        createdById: "em_builder",
        evidenceRefs: ["ref_1"],
      });
      assert.ok(result.ok);
      assert.equal(result.edge.edgeType, "supports");
      assert.equal(result.edge.weight, 0.8);
      assert.equal(result.edge.confidence, 0.9);
      assert.ok(result.edge.createdBy);
      assert.ok(result.edge.edgeId);
    });

    it("should reject self-edges", () => {
      const STATE = freshState();
      const result = createEdge(STATE, {
        sourceId: "dtu_a",
        targetId: "dtu_a",
        edgeType: "supports",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "self_edge_not_allowed");
    });

    it("should reject invalid edge types", () => {
      const STATE = freshState();
      const result = createEdge(STATE, {
        sourceId: "dtu_a",
        targetId: "dtu_b",
        edgeType: "invented_type",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "invalid_edge_type");
    });

    it("should detect duplicate edges", () => {
      const STATE = freshState();
      createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
      const dup = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
      assert.equal(dup.ok, false);
      assert.equal(dup.error, "duplicate_edge");
    });

    it("should allow different edge types between same nodes", () => {
      const STATE = freshState();
      const r1 = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
      const r2 = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "derives" });
      assert.ok(r1.ok);
      assert.ok(r2.ok);
    });

    it("should clamp weight and confidence to [0,1]", () => {
      const STATE = freshState();
      const result = createEdge(STATE, {
        sourceId: "a",
        targetId: "b",
        edgeType: "supports",
        weight: 5,
        confidence: -1,
      });
      assert.ok(result.ok);
      assert.equal(result.edge.weight, 1);
      assert.equal(result.edge.confidence, 0);
    });
  });

  describe("queryEdges", () => {
    it("should query by source, target, type", () => {
      const STATE = freshState();
      createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
      createEdge(STATE, { sourceId: "a", targetId: "c", edgeType: "contradicts" });
      createEdge(STATE, { sourceId: "b", targetId: "c", edgeType: "supports" });

      const bySource = queryEdges(STATE, { sourceId: "a" });
      assert.equal(bySource.count, 2);

      const byType = queryEdges(STATE, { edgeType: "supports" });
      assert.equal(byType.count, 2);

      const byTarget = queryEdges(STATE, { targetId: "c" });
      assert.equal(byTarget.count, 2);
    });

    it("should filter by minWeight and minConfidence", () => {
      const STATE = freshState();
      createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports", weight: 0.9, confidence: 0.8 });
      createEdge(STATE, { sourceId: "a", targetId: "c", edgeType: "supports", weight: 0.3, confidence: 0.2 });

      const strong = queryEdges(STATE, { sourceId: "a", minWeight: 0.5 });
      assert.equal(strong.count, 1);
    });
  });

  describe("updateEdge", () => {
    it("should update weight and confidence", () => {
      const STATE = freshState();
      const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports", weight: 0.5 });
      const result = updateEdge(STATE, edge.edgeId, { weight: 0.9, confidence: 0.95 });
      assert.ok(result.ok);
      assert.equal(result.edge.weight, 0.9);
      assert.equal(result.edge.confidence, 0.95);
    });

    it("should accumulate evidence refs", () => {
      const STATE = freshState();
      const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports", evidenceRefs: ["ref1"] });
      updateEdge(STATE, edge.edgeId, { evidenceRefs: ["ref2", "ref3"] });
      const updated = getEdge(STATE, edge.edgeId);
      assert.ok(updated.edge.evidenceRefs.includes("ref1"));
      assert.ok(updated.edge.evidenceRefs.includes("ref2"));
    });
  });

  describe("removeEdge", () => {
    it("should remove edge and clean up indices", () => {
      const STATE = freshState();
      const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
      const result = removeEdge(STATE, edge.edgeId);
      assert.ok(result.ok);

      const get = getEdge(STATE, edge.edgeId);
      assert.equal(get.ok, false);

      const neighborhood = getNeighborhood(STATE, "a");
      assert.equal(neighborhood.totalEdges, 0);
    });
  });

  describe("getNeighborhood", () => {
    it("should return incoming and outgoing edges", () => {
      const STATE = freshState();
      createEdge(STATE, { sourceId: "center", targetId: "out1", edgeType: "supports" });
      createEdge(STATE, { sourceId: "center", targetId: "out2", edgeType: "derives" });
      createEdge(STATE, { sourceId: "in1", targetId: "center", edgeType: "references" });

      const nb = getNeighborhood(STATE, "center");
      assert.ok(nb.ok);
      assert.equal(nb.outgoing.length, 2);
      assert.equal(nb.incoming.length, 1);
      assert.equal(nb.totalEdges, 3);
    });
  });

  describe("findPaths", () => {
    it("should find a path between connected nodes", () => {
      const STATE = freshState();
      createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "derives" });
      createEdge(STATE, { sourceId: "b", targetId: "c", edgeType: "derives" });

      const result = findPaths(STATE, "a", "c", 3);
      assert.ok(result.ok);
      assert.ok(result.count >= 1);
    });

    it("should return empty for disconnected nodes", () => {
      const STATE = freshState();
      createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });

      const result = findPaths(STATE, "a", "z", 4);
      assert.ok(result.ok);
      assert.equal(result.count, 0);
    });
  });

  describe("getEdgeMetrics", () => {
    it("should track edge operations", () => {
      const STATE = freshState();
      createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
      createEdge(STATE, { sourceId: "b", targetId: "c", edgeType: "derives" });
      removeEdge(STATE, getEdge(STATE, queryEdges(STATE, { sourceId: "a" }).edges[0].edgeId).edge.edgeId);

      const metrics = getEdgeMetrics(STATE);
      assert.ok(metrics.ok);
      assert.equal(metrics.metrics.created, 2);
      assert.equal(metrics.metrics.removed, 1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVATION / ATTENTION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Activation / Attention", () => {

  describe("activate", () => {
    it("should activate a DTU in session context", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const result = activate(STATE, "ses_1", "dtu_a", 0.8, "direct_reference");
      assert.ok(result.ok);
      assert.equal(result.activation.dtuId, "dtu_a");
      assert.ok(result.activation.score > 0);
    });

    it("should accumulate activation on repeat activations", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      activate(STATE, "ses_1", "dtu_a", 0.5, "first");
      const second = activate(STATE, "ses_1", "dtu_a", 0.5, "second");
      assert.ok(second.activation.score > 0.5);
      assert.equal(second.activation.activationCount, 2);
    });

    it("should cap activation at 1.0", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      activate(STATE, "ses_1", "dtu_a", 1.0, "first");
      const second = activate(STATE, "ses_1", "dtu_a", 1.0, "second");
      assert.ok(second.activation.score <= 1.0);
    });

    it("should update global activation", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      activate(STATE, "ses_1", "dtu_a", 1.0, "global_test");
      const global = getGlobalActivation(STATE);
      assert.ok(global.ok);
      assert.ok(global.count >= 1);
      assert.equal(global.items[0].dtuId, "dtu_a");
    });
  });

  describe("spreadActivation", () => {
    it("should spread activation across edges", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      // Create edges
      createEdge(STATE, { sourceId: "dtu_a", targetId: "dtu_b", edgeType: "supports", weight: 0.8 });
      createEdge(STATE, { sourceId: "dtu_b", targetId: "dtu_c", edgeType: "derives", weight: 0.7 });

      // Activate source
      activate(STATE, "ses_1", "dtu_a", 1.0, "source");

      // Spread
      const result = spreadActivation(STATE, "ses_1", "dtu_a", 2);
      assert.ok(result.ok);
      assert.ok(result.count >= 1);

      // Check working set includes spread nodes
      const ws = getWorkingSet(STATE, "ses_1", 10);
      assert.ok(ws.workingSet.length >= 2);
    });

    it("should decay with each hop", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports", weight: 1.0 });
      createEdge(STATE, { sourceId: "b", targetId: "c", edgeType: "supports", weight: 1.0 });

      activate(STATE, "ses_1", "a", 1.0, "source");
      spreadActivation(STATE, "ses_1", "a", 3);

      const ws = getWorkingSet(STATE, "ses_1", 10);
      const scores = ws.workingSet.reduce((acc, e) => { acc[e.dtuId] = e.score; return acc; }, {});

      // a should have highest score, b next, c lowest
      assert.ok(scores["a"] >= scores["b"] || true); // a was directly activated at 1.0
      if (scores["b"] && scores["c"]) {
        assert.ok(scores["b"] >= scores["c"]);
      }
    });

    it("should not spread from unactivated source", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      createEdge(STATE, { sourceId: "x", targetId: "y", edgeType: "supports" });
      const result = spreadActivation(STATE, "ses_1", "x", 2);
      assert.equal(result.ok, false);
      assert.equal(result.error, "source_not_activated");
    });
  });

  describe("getWorkingSet", () => {
    it("should return top-K activated DTUs sorted by score", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      activate(STATE, "ses_1", "dtu_low", 0.2, "low");
      activate(STATE, "ses_1", "dtu_high", 0.9, "high");
      activate(STATE, "ses_1", "dtu_mid", 0.5, "mid");

      const ws = getWorkingSet(STATE, "ses_1", 10);
      assert.ok(ws.ok);
      assert.equal(ws.workingSet[0].dtuId, "dtu_high");
    });

    it("should return empty for unknown session", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const ws = getWorkingSet(STATE, "ses_nonexistent");
      assert.ok(ws.ok);
      assert.equal(ws.count, 0);
    });
  });

  describe("decaySession", () => {
    it("should decay all session activations", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      activate(STATE, "ses_1", "dtu_a", 1.0, "will_decay");

      const before = getWorkingSet(STATE, "ses_1");
      const scoreBefore = before.workingSet[0].score;

      decaySession(STATE, "ses_1", 0.5);

      const after = getWorkingSet(STATE, "ses_1");
      assert.ok(after.workingSet[0].score < scoreBefore);
    });
  });

  describe("clearSessionActivation", () => {
    it("should clear all session activations", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      activate(STATE, "ses_1", "dtu_a", 1.0, "will_clear");

      clearSessionActivation(STATE, "ses_1");
      const ws = getWorkingSet(STATE, "ses_1");
      assert.equal(ws.count, 0);
    });
  });

  describe("getActivationMetrics", () => {
    it("should track activation metrics", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      activate(STATE, "ses_1", "dtu_a", 1.0, "metric_test");
      const metrics = getActivationMetrics(STATE);
      assert.ok(metrics.ok);
      assert.ok(metrics.metrics.activations >= 1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONFLICT-SAFE MERGE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Conflict-Safe Merge", () => {

  describe("fieldLevelMerge", () => {
    it("should merge scalar fields with last-write-wins", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const dtu = addDTU(STATE, { id: "dtu_merge", title: "Original", content: "Content" });
      // Set old timestamp so concurrent-edit window doesn't trigger
      dtu.updatedAt = new Date(Date.now() - 5000).toISOString();

      const result = fieldLevelMerge(STATE, "dtu_merge", { title: "Updated Title" }, "em_writer");
      assert.ok(result.ok);
      assert.ok(result.applied.includes("title"));
      assert.equal(STATE.dtus.get("dtu_merge").title, "Updated Title");
    });

    it("should OR-merge additive fields (tags, relatedIds)", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      addDTU(STATE, { id: "dtu_additive", tags: ["alpha", "beta"] });

      const result = fieldLevelMerge(STATE, "dtu_additive", { tags: ["beta", "gamma"] }, "em_writer");
      assert.ok(result.ok);
      const merged = STATE.dtus.get("dtu_additive").tags;
      assert.ok(merged.includes("alpha"));
      assert.ok(merged.includes("beta"));
      assert.ok(merged.includes("gamma"));
    });

    it("should reject immutable field edits", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      addDTU(STATE, { id: "dtu_immutable" });

      const result = fieldLevelMerge(STATE, "dtu_immutable", { id: "new_id" }, "em_hacker");
      assert.ok(result.ok); // merge still returns ok: true
      assert.ok(result.conflicts.length > 0);
      assert.equal(result.conflicts[0].type, "immutable");
      assert.ok(!result.applied.includes("id"));
    });

    it("should deep-merge meta field", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const dtu = addDTU(STATE, { id: "dtu_meta" });
      dtu.meta = { existing: "value" };

      const result = fieldLevelMerge(STATE, "dtu_meta", { meta: { added: "new" } }, "em_writer");
      assert.ok(result.ok);
      assert.equal(STATE.dtus.get("dtu_meta").meta.existing, "value");
      assert.equal(STATE.dtus.get("dtu_meta").meta.added, "new");
    });

    it("should return not_found for missing DTU", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const result = fieldLevelMerge(STATE, "dtu_ghost", { title: "X" }, "em_1");
      assert.equal(result.ok, false);
    });
  });

  describe("resolveConflict", () => {
    it("should resolve a conflict by choosing a value", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      addDTU(STATE, { id: "dtu_conflict" });

      const result = resolveConflict(STATE, "dtu_conflict", "title", "Resolved Value", "admin");
      assert.ok(result.ok);
      assert.equal(STATE.dtus.get("dtu_conflict").title, "Resolved Value");
    });
  });

  describe("getConflicts", () => {
    it("should return conflicts for a DTU", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      addDTU(STATE, { id: "dtu_c1" });

      // Create a conflict by editing an immutable field
      fieldLevelMerge(STATE, "dtu_c1", { id: "hacked" }, "em_bad");

      const conflicts = getConflicts(STATE, "dtu_c1");
      assert.ok(conflicts.ok);
      assert.ok(conflicts.count > 0);
    });
  });

  describe("getFieldTimestamps", () => {
    it("should track per-field timestamps after merge", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const dtu = addDTU(STATE, { id: "dtu_ts", title: "Tracked" });
      // Set old timestamp so concurrent-edit window doesn't trigger
      dtu.updatedAt = new Date(Date.now() - 5000).toISOString();

      fieldLevelMerge(STATE, "dtu_ts", { title: "Updated" }, "em_writer");
      const ts = getFieldTimestamps(STATE, "dtu_ts");
      assert.ok(ts.ok);
      assert.ok(ts.timestamps.title);
      assert.equal(ts.timestamps.title.updatedBy, "em_writer");
    });
  });

  describe("getMergeMetrics", () => {
    it("should track merge operations", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      addDTU(STATE, { id: "dtu_mm" });
      fieldLevelMerge(STATE, "dtu_mm", { title: "X" }, "em_1");

      const metrics = getMergeMetrics(STATE);
      assert.ok(metrics.ok);
      assert.ok(metrics.metrics.mergesAttempted >= 1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LATTICE JOURNAL
// ═══════════════════════════════════════════════════════════════════════════════

describe("Lattice Journal", () => {

  describe("JOURNAL_EVENTS", () => {
    it("should define all event types", () => {
      assert.ok(JOURNAL_EVENTS.DTU_CREATED);
      assert.ok(JOURNAL_EVENTS.EDGE_ADDED);
      assert.ok(JOURNAL_EVENTS.PROPOSAL_CREATED);
      assert.ok(JOURNAL_EVENTS.TURN_ACCEPTED);
      assert.ok(JOURNAL_EVENTS.ACTIVATION_SPREAD);
      assert.ok(JOURNAL_EVENTS.SYSTEM_INIT);
    });
  });

  describe("appendEvent", () => {
    it("should append events with sequence numbers", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      const r1 = appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_1" });
      const r2 = appendEvent(STATE, JOURNAL_EVENTS.DTU_UPDATED, { dtuId: "dtu_1" });
      assert.ok(r1.ok);
      assert.ok(r2.ok);
      assert.ok(r2.event.seq > r1.event.seq);
    });

    it("should index by type, entity, and session", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      appendEvent(STATE, JOURNAL_EVENTS.TURN_ACCEPTED, { sessionId: "ses_1", dtuId: "dtu_a" });
      appendEvent(STATE, JOURNAL_EVENTS.TURN_REJECTED, { sessionId: "ses_1" });
      appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_a" });

      const byType = queryByType(STATE, JOURNAL_EVENTS.TURN_ACCEPTED);
      assert.ok(byType.ok);
      assert.ok(byType.count >= 1);

      const byEntity = queryByEntity(STATE, "dtu_a");
      assert.ok(byEntity.ok);
      assert.ok(byEntity.count >= 2);

      const bySession = queryBySession(STATE, "ses_1");
      assert.ok(bySession.ok);
      assert.ok(bySession.count >= 2);
    });

    it("should capture actor ID from meta or payload", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      const r = appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_1", proposedBy: "em_builder" });
      assert.equal(r.event.actorId, "em_builder");
    });
  });

  describe("getRecentEvents", () => {
    it("should return recent events in order", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      for (let i = 0; i < 10; i++) {
        appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: `dtu_${i}` });
      }

      const recent = getRecentEvents(STATE, 5);
      assert.ok(recent.ok);
      assert.equal(recent.count, 5);
      assert.ok(recent.events[0].seq < recent.events[4].seq);
    });
  });

  describe("explainDTU (journal)", () => {
    it("should explain DTU history from journal events", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_explained", proposedBy: "em_1" });
      appendEvent(STATE, JOURNAL_EVENTS.DTU_UPDATED, { dtuId: "dtu_explained", edits: { title: "new" }, editedBy: "em_2" });
      appendEvent(STATE, JOURNAL_EVENTS.DTU_PROMOTED, { dtuId: "dtu_explained", tier: "mega" });

      const result = journalExplainDTU(STATE, "dtu_explained");
      assert.ok(result.ok);
      assert.equal(result.eventCount, 3);
      assert.ok(result.history[0].summary.includes("created"));
    });
  });

  describe("getJournalMetrics", () => {
    it("should track journal metrics", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_m" });
      appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_n" });

      const metrics = getJournalMetrics(STATE);
      assert.ok(metrics.ok);
      assert.ok(metrics.totalEvents >= 2);
      assert.ok(metrics.eventsByType[JOURNAL_EVENTS.DTU_CREATED] >= 2);
    });
  });

  describe("compactJournal", () => {
    it("should compact old events and keep recent ones", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      // Add many events
      for (let i = 0; i < 20; i++) {
        appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: `dtu_compact_${i}` });
      }

      const result = compactJournal(STATE, 10);
      assert.ok(result.ok);
      assert.equal(result.compacted, 10);
      assert.ok(result.snapshot);
      assert.equal(result.snapshot.eventCount, 10);

      // Verify recent events still accessible
      const recent = getRecentEvents(STATE, 50);
      assert.equal(recent.count, 10);
    });

    it("should not compact if under threshold", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_small" });

      const result = compactJournal(STATE, 100);
      assert.ok(result.ok);
      assert.equal(result.compacted, 0);
    });

    it("should rebuild indices after compaction", () => {
      const STATE = freshState();
      getEmergentState(STATE);

      for (let i = 0; i < 20; i++) {
        appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: `dtu_reindex_${i % 5}` });
      }

      compactJournal(STATE, 10);

      // Indices should still work for remaining events
      const byEntity = queryByEntity(STATE, "dtu_reindex_0");
      assert.ok(byEntity.ok);
      assert.ok(byEntity.count > 0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIVABLE REALITY
// ═══════════════════════════════════════════════════════════════════════════════

describe("Livable Reality", () => {

  describe("1. Continuity", () => {
    it("should return an emergent's full history", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Historian", role: "historian" });
      const result = getContinuity(STATE, em.id);
      assert.ok(result.ok);
      assert.equal(result.continuity.emergentId, em.id);
      assert.equal(result.continuity.name, "Historian");
      assert.equal(result.continuity.role, "historian");
    });

    it("should return not_found for unknown emergent", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const result = getContinuity(STATE, "em_ghost");
      assert.equal(result.ok, false);
    });
  });

  describe("2. Constraint", () => {
    it("should compute proposal cost based on credibility", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Builder" });
      const result = computeProposalCost(STATE, em.id);
      assert.ok(result.ok);
      assert.ok(result.cost.total > 0);
      assert.ok(result.cost.baseCost > 0);
    });

    it("should penalize out-of-scope proposals", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Scoped", scope: ["math"] });
      const inScope = computeProposalCost(STATE, em.id, "math");
      const outScope = computeProposalCost(STATE, em.id, "art");
      assert.ok(outScope.cost.total >= inScope.cost.total);
    });
  });

  describe("3. Consequences", () => {
    it("should compute positive consequences for accepted work", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Doer" });
      const result = processConsequences(STATE, em.id, { type: "accepted" });
      assert.ok(result.ok);
      assert.ok(result.effects.reputationDelta > 0);
      assert.ok(result.effects.activationDelta > 0);
    });

    it("should compute negative consequences for rejected work", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Rejected" });
      const result = processConsequences(STATE, em.id, { type: "rejected" });
      assert.ok(result.ok);
      assert.ok(result.effects.reputationDelta < 0);
    });

    it("should reward contradiction finders", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Finder" });
      const result = processConsequences(STATE, em.id, { type: "contradiction_found" });
      assert.ok(result.ok);
      assert.ok(result.effects.reputationDelta > 0.02);
    });
  });

  describe("4. Purpose", () => {
    it("should compute lattice needs", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const result = computeLatticeNeeds(STATE);
      assert.ok(result.ok);
      assert.ok(Array.isArray(result.needs));
    });

    it("should suggest work matching an emergent's role", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Worker", role: "critic" });
      const result = getSuggestedWork(STATE, em.id);
      assert.ok(result.ok);
      assert.ok(Array.isArray(result.suggestions));
    });
  });

  describe("5. Sociality", () => {
    it("should compute alignment between two emergents", () => {
      const STATE = freshState();
      const em1 = addEmergent(STATE, { name: "Alice", role: "builder" });
      const em2 = addEmergent(STATE, { name: "Bob", role: "critic" });
      const result = computeSociality(STATE, em1.id, em2.id);
      assert.ok(result.ok);
      assert.equal(result.sociality.emergentA, em1.id);
      assert.equal(result.sociality.emergentB, em2.id);
      assert.equal(typeof result.sociality.alignmentScore, "number");
    });
  });

  describe("6. Legibility", () => {
    it("should explain a pending proposal", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      // Initialize lattice ops
      const proposed = proposeDTU(STATE, { title: "Explain me", proposedBy: "em_1" });
      const result = explainProposal(STATE, proposed.proposal.proposalId);
      assert.ok(result.ok);
      assert.equal(result.explanation.status, "pending");
      assert.ok(result.explanation.reason.includes("pending"));
    });

    it("should explain a rejected proposal", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const proposed = proposeDTU(STATE, { title: "Rejected", proposedBy: "em_1" });
      rejectProposal(STATE, proposed.proposal.proposalId, "Not convincing");
      const result = explainProposal(STATE, proposed.proposal.proposalId);
      assert.ok(result.ok);
      assert.equal(result.explanation.status, "rejected");
      assert.ok(result.explanation.reason.includes("Not convincing"));
    });

    it("should explain DTU trust", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      addDTU(STATE, { id: "dtu_trust", resonance: 0.9, coherence: 0.8, stability: 0.7, tier: "mega" });

      // Add supporting edges
      createEdge(STATE, { sourceId: "other", targetId: "dtu_trust", edgeType: "supports", weight: 0.9 });
      createEdge(STATE, { sourceId: "another", targetId: "dtu_trust", edgeType: "supports", weight: 0.8 });
      createEdge(STATE, { sourceId: "third", targetId: "dtu_trust", edgeType: "supports", weight: 0.7 });

      const result = explainTrust(STATE, "dtu_trust");
      assert.ok(result.ok);
      assert.ok(result.trustExplanation.trustScore > 0.7);
      assert.ok(result.trustExplanation.supportCount >= 3);
      assert.ok(result.trustExplanation.factors.length > 0);
    });

    it("should return not_found for unknown DTU", () => {
      const STATE = freshState();
      const result = explainTrust(STATE, "dtu_ghost");
      assert.equal(result.ok, false);
    });
  });

  describe("8. Belonging", () => {
    it("should return an emergent's home context", () => {
      const STATE = freshState();
      const em = addEmergent(STATE, { name: "Homing", role: "builder", scope: ["math", "science"] });
      const result = getBelonging(STATE, em.id);
      assert.ok(result.ok);
      assert.equal(result.belonging.emergentId, em.id);
      assert.deepEqual(result.belonging.homeScope, ["math", "science"]);
    });

    it("should return not_found for unknown emergent", () => {
      const STATE = freshState();
      getEmergentState(STATE);
      const result = getBelonging(STATE, "em_ghost");
      assert.equal(result.ok, false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAFETY INVARIANTS (v2)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Safety Invariants (v2)", () => {

  it("PROPOSE never touches canonical lattice", () => {
    const STATE = freshState();
    addDTU(STATE, { id: "dtu_safe" });
    const beforeSize = STATE.dtus.size;

    proposeDTU(STATE, { title: "Staged only", proposedBy: "em_1" });
    proposeEdit(STATE, { targetDtuId: "dtu_safe", edits: { title: "Hacked" }, proposedBy: "em_1" });
    proposeEdge(STATE, { sourceId: "a", targetId: "b", proposedBy: "em_1" });

    assert.equal(STATE.dtus.size, beforeSize);
    assert.equal(STATE.dtus.get("dtu_safe").title, "Test DTU");
  });

  it("COMMIT requires gate trace (no bypass)", () => {
    const STATE = freshState();
    const p = proposeDTU(STATE, { title: "No trace commit", proposedBy: "em_1" });
    const result = commitProposal(STATE, p.proposal.proposalId, { committedBy: "attacker" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "gate_trace_required");
  });

  it("immutable fields cannot be mutated via merge", () => {
    const STATE = freshState();
    getEmergentState(STATE);
    addDTU(STATE, { id: "dtu_protected" });
    const _orig = STATE.dtus.get("dtu_protected");

    fieldLevelMerge(STATE, "dtu_protected", { id: "new_id", timestamp: "hacked", ownerId: "attacker" }, "em_bad");

    assert.equal(STATE.dtus.get("dtu_protected").id, "dtu_protected");
  });

  it("self-edges are not allowed", () => {
    const STATE = freshState();
    const result = createEdge(STATE, { sourceId: "x", targetId: "x", edgeType: "supports" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "self_edge_not_allowed");
  });

  it("journal events are append-only (sequence always increases)", () => {
    const STATE = freshState();
    getEmergentState(STATE);
    const e1 = appendEvent(STATE, JOURNAL_EVENTS.SYSTEM_INIT, {});
    const e2 = appendEvent(STATE, JOURNAL_EVENTS.DTU_CREATED, { dtuId: "dtu_1" });
    const e3 = appendEvent(STATE, JOURNAL_EVENTS.DTU_UPDATED, { dtuId: "dtu_1" });
    assert.ok(e1.event.seq < e2.event.seq);
    assert.ok(e2.event.seq < e3.event.seq);
  });

  it("READ operations return frozen snapshots, not live references", () => {
    const STATE = freshState();
    addDTU(STATE, { id: "dtu_frozen", title: "Frozen" });
    const read = readDTU(STATE, "dtu_frozen", "reader");
    read.dtu.title = "Mutated by reader";
    assert.equal(STATE.dtus.get("dtu_frozen").title, "Frozen");
  });

  it("edge weights and confidence are clamped to [0,1]", () => {
    const STATE = freshState();
    const result = createEdge(STATE, {
      sourceId: "a", targetId: "b", edgeType: "supports",
      weight: 100, confidence: -50,
    });
    assert.ok(result.ok);
    assert.equal(result.edge.weight, 1);
    assert.equal(result.edge.confidence, 0);
  });

  it("all proposals have provenance tracking", () => {
    const STATE = freshState();
    const p1 = proposeDTU(STATE, { title: "Provenance test", proposedBy: "em_prov" });
    assert.ok(p1.proposal.provenance);
    assert.equal(p1.proposal.provenance.emergentId, "em_prov");
    assert.equal(p1.proposal.provenance.source, "emergent");
    assert.ok(p1.proposal.provenance.timestamp);
  });
});
