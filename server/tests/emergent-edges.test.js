/**
 * Tests for emergent/edges.js — Edge Semantics & Provenance
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  EDGE_TYPES,
  ALL_EDGE_TYPES,
  getEdgeStore,
  createEdge,
  getEdge,
  queryEdges,
  updateEdge,
  removeEdge,
  getNeighborhood,
  findPaths,
  getEdgeMetrics,
} from "../emergent/edges.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSTATE() {
  return { __emergent: {} };
}

// ── Constants ───────────────────────────────────────────────────────────────

describe("EDGE_TYPES", () => {
  it("is frozen with expected keys", () => {
    assert.ok(Object.isFrozen(EDGE_TYPES));
    assert.equal(EDGE_TYPES.SUPPORTS, "supports");
    assert.equal(EDGE_TYPES.CONTRADICTS, "contradicts");
    assert.equal(EDGE_TYPES.DERIVES, "derives");
    assert.equal(EDGE_TYPES.REFERENCES, "references");
    assert.equal(EDGE_TYPES.SIMILAR, "similar");
    assert.equal(EDGE_TYPES.PARENT_OF, "parentOf");
    assert.equal(EDGE_TYPES.CAUSES, "causes");
    assert.equal(EDGE_TYPES.ENABLES, "enables");
    assert.equal(EDGE_TYPES.REQUIRES, "requires");
  });

  it("ALL_EDGE_TYPES contains all values", () => {
    assert.ok(Object.isFrozen(ALL_EDGE_TYPES));
    assert.equal(ALL_EDGE_TYPES.length, 9);
    for (const v of Object.values(EDGE_TYPES)) {
      assert.ok(ALL_EDGE_TYPES.includes(v));
    }
  });
});

// ── getEdgeStore ────────────────────────────────────────────────────────────

describe("getEdgeStore", () => {
  it("initializes store on first call", () => {
    const STATE = makeSTATE();
    const store = getEdgeStore(STATE);
    assert.ok(store.edges instanceof Map);
    assert.ok(store.bySource instanceof Map);
    assert.ok(store.byTarget instanceof Map);
    assert.ok(store.byType instanceof Map);
    assert.deepEqual(store.metrics, { created: 0, updated: 0, removed: 0, queries: 0 });
  });

  it("returns same store on subsequent calls", () => {
    const STATE = makeSTATE();
    const s1 = getEdgeStore(STATE);
    const s2 = getEdgeStore(STATE);
    assert.strictEqual(s1, s2);
  });
});

// ── createEdge ──────────────────────────────────────────────────────────────

describe("createEdge", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("fails when sourceId or targetId missing", () => {
    const r1 = createEdge(STATE, {});
    assert.equal(r1.ok, false);
    assert.equal(r1.error, "source_and_target_required");

    const r2 = createEdge(STATE, { sourceId: "a" });
    assert.equal(r2.ok, false);

    const r3 = createEdge(STATE, { targetId: "b" });
    assert.equal(r3.ok, false);
  });

  it("rejects self-edge", () => {
    const r = createEdge(STATE, { sourceId: "a", targetId: "a" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "self_edge_not_allowed");
  });

  it("rejects invalid edge type", () => {
    const r = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "bogus" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_edge_type");
    assert.equal(r.provided, "bogus");
  });

  it("creates edge with defaults", () => {
    const r = createEdge(STATE, { sourceId: "a", targetId: "b" });
    assert.equal(r.ok, true);
    assert.ok(r.edge.edgeId.startsWith("edge_"));
    assert.equal(r.edge.sourceId, "a");
    assert.equal(r.edge.targetId, "b");
    assert.equal(r.edge.edgeType, EDGE_TYPES.REFERENCES);
    assert.equal(r.edge.weight, 0.5);
    assert.equal(r.edge.confidence, 0.5);
    assert.equal(r.edge.createdBy.source, "emergent");
    assert.equal(r.edge.createdBy.id, "unknown");
    assert.deepEqual(r.edge.evidenceRefs, []);
    assert.equal(r.edge.label, null);
    assert.equal(r.edge.validationCount, 0);
  });

  it("creates edge with all options", () => {
    const r = createEdge(STATE, {
      sourceId: "a",
      targetId: "b",
      edgeType: EDGE_TYPES.SUPPORTS,
      weight: 0.9,
      confidence: 0.8,
      createdBySource: "user",
      createdById: "u1",
      evidenceRefs: ["ev1", "ev2"],
      label: "test label",
    });
    assert.equal(r.ok, true);
    assert.equal(r.edge.edgeType, "supports");
    assert.equal(r.edge.weight, 0.9);
    assert.equal(r.edge.confidence, 0.8);
    assert.equal(r.edge.createdBy.source, "user");
    assert.equal(r.edge.createdBy.id, "u1");
    assert.deepEqual(r.edge.evidenceRefs, ["ev1", "ev2"]);
    assert.equal(r.edge.label, "test label");
  });

  it("clamps weight and confidence", () => {
    const r = createEdge(STATE, { sourceId: "a", targetId: "b", weight: 5, confidence: -2 });
    assert.equal(r.edge.weight, 1);
    assert.equal(r.edge.confidence, 0);
  });

  it("limits evidenceRefs to 50", () => {
    const refs = Array.from({ length: 60 }, (_, i) => `ref_${i}`);
    const r = createEdge(STATE, { sourceId: "a", targetId: "b", evidenceRefs: refs });
    assert.equal(r.edge.evidenceRefs.length, 50);
  });

  it("truncates label to 200 chars", () => {
    const longLabel = "x".repeat(300);
    const r = createEdge(STATE, { sourceId: "a", targetId: "b", label: longLabel });
    assert.equal(r.edge.label.length, 200);
  });

  it("detects duplicate edges", () => {
    createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
    const r = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "duplicate_edge");
    assert.ok(r.existingEdgeId);
  });

  it("allows same source/target with different type", () => {
    createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
    const r = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "contradicts" });
    assert.equal(r.ok, true);
  });

  it("increments metrics.created", () => {
    createEdge(STATE, { sourceId: "a", targetId: "b" });
    createEdge(STATE, { sourceId: "c", targetId: "d" });
    assert.equal(getEdgeStore(STATE).metrics.created, 2);
  });

  it("updates bySource, byTarget, byType indices", () => {
    const r = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
    const store = getEdgeStore(STATE);
    assert.ok(store.bySource.get("a").has(r.edge.edgeId));
    assert.ok(store.byTarget.get("b").has(r.edge.edgeId));
    assert.ok(store.byType.get("supports").has(r.edge.edgeId));
  });
});

// ── getEdge ─────────────────────────────────────────────────────────────────

describe("getEdge", () => {
  it("returns edge by id", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b" });
    const r = getEdge(STATE, edge.edgeId);
    assert.equal(r.ok, true);
    assert.equal(r.edge.edgeId, edge.edgeId);
  });

  it("returns not_found for missing edge", () => {
    const STATE = makeSTATE();
    const r = getEdge(STATE, "nonexistent");
    assert.equal(r.ok, false);
    assert.equal(r.error, "not_found");
  });

  it("increments queries metric", () => {
    const STATE = makeSTATE();
    getEdge(STATE, "x");
    getEdge(STATE, "y");
    assert.equal(getEdgeStore(STATE).metrics.queries, 2);
  });
});

// ── queryEdges ──────────────────────────────────────────────────────────────

describe("queryEdges", () => {
  let STATE;
  beforeEach(() => {
    STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports", weight: 0.9 });
    createEdge(STATE, { sourceId: "a", targetId: "c", edgeType: "contradicts", weight: 0.3 });
    createEdge(STATE, { sourceId: "b", targetId: "c", edgeType: "supports", weight: 0.5, confidence: 0.8, createdById: "u1" });
  });

  it("returns all edges when no query", () => {
    const r = queryEdges(STATE);
    assert.equal(r.ok, true);
    assert.equal(r.count, 3);
  });

  it("filters by sourceId", () => {
    const r = queryEdges(STATE, { sourceId: "a" });
    assert.equal(r.count, 2);
  });

  it("filters by targetId", () => {
    const r = queryEdges(STATE, { targetId: "c" });
    assert.equal(r.count, 2);
  });

  it("filters by edgeType", () => {
    const r = queryEdges(STATE, { edgeType: "supports" });
    assert.equal(r.count, 2);
  });

  it("filters by minWeight", () => {
    const r = queryEdges(STATE, { minWeight: 0.5 });
    assert.equal(r.count, 2);
  });

  it("filters by minConfidence", () => {
    const r = queryEdges(STATE, { minConfidence: 0.8 });
    assert.equal(r.count, 1);
  });

  it("filters by createdById", () => {
    const r = queryEdges(STATE, { createdById: "u1" });
    assert.equal(r.count, 1);
  });

  it("respects limit", () => {
    const r = queryEdges(STATE, { limit: 1 });
    assert.equal(r.count, 1);
  });

  it("caps limit at 500", () => {
    const r = queryEdges(STATE, { limit: 9999 });
    assert.ok(r.edges.length <= 500);
  });

  it("sorts by weight descending", () => {
    const r = queryEdges(STATE);
    assert.ok(r.edges[0].weight >= r.edges[1].weight);
  });

  it("falls through to all edges when index empty for sourceId", () => {
    const r = queryEdges(STATE, { sourceId: "nonexistent" });
    assert.equal(r.count, 0);
  });

  it("falls through to byTarget when sourceId not present but targetId is", () => {
    const r = queryEdges(STATE, { targetId: "b" });
    assert.equal(r.count, 1);
  });
});

// ── updateEdge ──────────────────────────────────────────────────────────────

describe("updateEdge", () => {
  it("returns not_found for missing edge", () => {
    const STATE = makeSTATE();
    const r = updateEdge(STATE, "nonexistent");
    assert.equal(r.ok, false);
  });

  it("updates weight", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b", weight: 0.3 });
    const r = updateEdge(STATE, edge.edgeId, { weight: 0.9 });
    assert.equal(r.ok, true);
    assert.equal(r.edge.weight, 0.9);
  });

  it("updates confidence", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b", confidence: 0.2 });
    updateEdge(STATE, edge.edgeId, { confidence: 0.7 });
    assert.equal(getEdge(STATE, edge.edgeId).edge.confidence, 0.7);
  });

  it("clamps weight and confidence", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b" });
    updateEdge(STATE, edge.edgeId, { weight: 5, confidence: -1 });
    const e = getEdge(STATE, edge.edgeId).edge;
    assert.equal(e.weight, 1);
    assert.equal(e.confidence, 0);
  });

  it("appends evidenceRefs deduped, capped at 50", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b", evidenceRefs: ["r1"] });
    updateEdge(STATE, edge.edgeId, { evidenceRefs: ["r1", "r2"] });
    const refs = getEdge(STATE, edge.edgeId).edge.evidenceRefs;
    assert.ok(refs.includes("r1"));
    assert.ok(refs.includes("r2"));
    assert.equal(refs.length, 2);
  });

  it("validates edge (timestamp + count)", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b" });
    const before = edge.lastValidatedAt;
    updateEdge(STATE, edge.edgeId, { validate: true });
    const after = getEdge(STATE, edge.edgeId).edge;
    assert.equal(after.validationCount, 1);
    assert.ok(after.lastValidatedAt >= before);
  });

  it("increments metrics.updated", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b" });
    updateEdge(STATE, edge.edgeId, { weight: 0.1 });
    assert.equal(getEdgeStore(STATE).metrics.updated, 1);
  });
});

// ── removeEdge ──────────────────────────────────────────────────────────────

describe("removeEdge", () => {
  it("returns not_found for missing edge", () => {
    const STATE = makeSTATE();
    const r = removeEdge(STATE, "bogus");
    assert.equal(r.ok, false);
  });

  it("removes edge and cleans indices", () => {
    const STATE = makeSTATE();
    const { edge } = createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
    const r = removeEdge(STATE, edge.edgeId);
    assert.equal(r.ok, true);
    assert.equal(getEdge(STATE, edge.edgeId).ok, false);
    const store = getEdgeStore(STATE);
    assert.ok(!store.bySource.get("a")?.has(edge.edgeId));
    assert.ok(!store.byTarget.get("b")?.has(edge.edgeId));
    assert.ok(!store.byType.get("supports")?.has(edge.edgeId));
    assert.equal(store.metrics.removed, 1);
  });
});

// ── getNeighborhood ─────────────────────────────────────────────────────────

describe("getNeighborhood", () => {
  it("returns outgoing and incoming edges", () => {
    const STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b" });
    createEdge(STATE, { sourceId: "c", targetId: "a" });
    const r = getNeighborhood(STATE, "a");
    assert.equal(r.ok, true);
    assert.equal(r.outgoing.length, 1);
    assert.equal(r.incoming.length, 1);
    assert.equal(r.totalEdges, 2);
  });

  it("returns empty for node with no edges", () => {
    const STATE = makeSTATE();
    const r = getNeighborhood(STATE, "lonely");
    assert.equal(r.ok, true);
    assert.equal(r.outgoing.length, 0);
    assert.equal(r.incoming.length, 0);
  });
});

// ── findPaths ───────────────────────────────────────────────────────────────

describe("findPaths", () => {
  it("finds direct path", () => {
    const STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b" });
    const r = findPaths(STATE, "a", "b");
    assert.equal(r.ok, true);
    assert.equal(r.count, 1);
    assert.equal(r.paths[0].length, 2);
  });

  it("finds multi-hop path", () => {
    const STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b" });
    createEdge(STATE, { sourceId: "b", targetId: "c" });
    const r = findPaths(STATE, "a", "c");
    assert.equal(r.count, 1);
    assert.equal(r.paths[0].length, 3);
  });

  it("avoids cycles", () => {
    const STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b" });
    createEdge(STATE, { sourceId: "b", targetId: "a", edgeType: "contradicts" });
    createEdge(STATE, { sourceId: "b", targetId: "c" });
    const r = findPaths(STATE, "a", "c");
    assert.equal(r.count, 1);
  });

  it("returns empty when no path exists", () => {
    const STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b" });
    const r = findPaths(STATE, "a", "z");
    assert.equal(r.count, 0);
  });

  it("respects maxDepth", () => {
    const STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b" });
    createEdge(STATE, { sourceId: "b", targetId: "c" });
    createEdge(STATE, { sourceId: "c", targetId: "d" });
    const r = findPaths(STATE, "a", "d", 2);
    assert.equal(r.count, 0);
  });

  it("limits to 10 paths", () => {
    const STATE = makeSTATE();
    // Create many parallel paths a->xi->b
    for (let i = 0; i < 15; i++) {
      createEdge(STATE, { sourceId: "a", targetId: `x${i}` });
      createEdge(STATE, { sourceId: `x${i}`, targetId: "b" });
    }
    const r = findPaths(STATE, "a", "b");
    assert.ok(r.count <= 10);
  });
});

// ── getEdgeMetrics ──────────────────────────────────────────────────────────

describe("getEdgeMetrics", () => {
  it("returns metrics and type distribution", () => {
    const STATE = makeSTATE();
    createEdge(STATE, { sourceId: "a", targetId: "b", edgeType: "supports" });
    createEdge(STATE, { sourceId: "c", targetId: "d", edgeType: "supports" });
    createEdge(STATE, { sourceId: "e", targetId: "f", edgeType: "contradicts" });
    const r = getEdgeMetrics(STATE);
    assert.equal(r.ok, true);
    assert.equal(r.totalEdges, 3);
    assert.equal(r.typeDistribution["supports"], 2);
    assert.equal(r.typeDistribution["contradicts"], 1);
    assert.equal(r.metrics.created, 3);
  });
});
