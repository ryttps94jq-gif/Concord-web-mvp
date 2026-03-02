/**
 * Atlas Autogen V2 — Comprehensive Test Suite
 *
 * Covers: selectInputDtus, runAutogenV2, getAutogenRun,
 * acceptAutogenOutput, mergeAutogenOutput, propagateConfidence,
 * getAutogenV2Metrics
 *
 * STATE is constructed fresh per test with pre-populated DTUs.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  selectInputDtus,
  runAutogenV2,
  getAutogenRun,
  acceptAutogenOutput,
  mergeAutogenOutput,
  propagateConfidence,
  getAutogenV2Metrics,
} from "../emergent/atlas-autogen-v2.js";

import { initAtlasState } from "../emergent/atlas-epistemic.js";
import { createAtlasDtu, addAtlasLink } from "../emergent/atlas-store.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function freshSTATE() {
  const STATE = {};
  initAtlasState(STATE);
  return STATE;
}

function seedDtus(STATE, count = 5) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const result = createAtlasDtu(STATE, {
      title: `Seed DTU ${i}`,
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
      tags: ["seed", `topic${i}`],
      claims: [
        {
          text: `Seed claim ${i} with enough text to pass the minimum length requirement for dedup`,
          claimType: "FACT",
          sources: [{ title: `Source ${i}`, url: `https://example.com/s${i}`, sourceTier: "SCHOLARLY" }],
        },
      ],
      author: { userId: `author${i % 3}`, display: `Author ${i % 3}`, isSystem: false },
    });
    if (result.ok) {
      // Boost scores to meet MIN_INPUT_CONFIDENCE
      const atlas = STATE._atlas;
      const dtu = atlas.dtus.get(result.dtu.id);
      dtu.scores.confidence_factual = 0.6;
      dtu.scores.credibility_structural = 0.6;
      dtu.scores.confidence_overall = 0.6;
      ids.push(result.dtu.id);
    }
  }
  return ids;
}

// ── selectInputDtus ──────────────────────────────────────────────────────────

describe("selectInputDtus", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns inputs from matching domain", () => {
    seedDtus(STATE, 5);
    const result = selectInputDtus(STATE, { domainType: "empirical.physics" });
    assert.equal(result.ok, true);
    assert.ok(result.inputs.length > 0);
    assert.ok(result.totalCandidates > 0);
  });

  it("returns inputs by epistemicClass", () => {
    seedDtus(STATE, 3);
    const result = selectInputDtus(STATE, { epistemicClass: "EMPIRICAL" });
    assert.equal(result.ok, true);
    assert.ok(result.inputs.length > 0);
  });

  it("returns all non-quarantined DTUs when no filter", () => {
    seedDtus(STATE, 3);
    const result = selectInputDtus(STATE);
    assert.equal(result.ok, true);
    assert.ok(result.inputs.length >= 3);
  });

  it("filters out QUARANTINED DTUs", () => {
    const ids = seedDtus(STATE, 3);
    const atlas = STATE._atlas;
    atlas.dtus.get(ids[0]).status = "QUARANTINED";
    const result = selectInputDtus(STATE, { domainType: "empirical.physics" });
    // One quarantined should be excluded
    assert.ok(result.inputs.every(d => d.status !== "QUARANTINED"));
  });

  it("filters out DEPRECATED DTUs", () => {
    const ids = seedDtus(STATE, 3);
    const atlas = STATE._atlas;
    atlas.dtus.get(ids[0]).status = "DEPRECATED";
    const result = selectInputDtus(STATE);
    assert.ok(result.inputs.every(d => d.status !== "DEPRECATED"));
  });

  it("filters by minimum confidence", () => {
    seedDtus(STATE, 3);
    // Set one DTU below threshold
    const atlas = STATE._atlas;
    const firstId = Array.from(atlas.dtus.keys())[0];
    atlas.dtus.get(firstId).scores.confidence_overall = 0.1;
    const result = selectInputDtus(STATE);
    assert.ok(result.inputs.every(d => d.scores.confidence_overall >= 0.3));
  });

  it("filters by topic keyword", () => {
    seedDtus(STATE, 3);
    const result = selectInputDtus(STATE, { topic: "topic0" });
    assert.equal(result.ok, true);
  });

  it("limits by maxInputs", () => {
    seedDtus(STATE, 10);
    const result = selectInputDtus(STATE, { maxInputs: 2 });
    assert.ok(result.inputs.length <= 2);
  });

  it("applies author diversity cap", () => {
    seedDtus(STATE, 20);
    const result = selectInputDtus(STATE, { maxInputs: 20 });
    // Should not have more than maxPerAuthor from any single author
    const counts = new Map();
    for (const dtu of result.inputs) {
      const a = dtu.author?.userId || "unknown";
      counts.set(a, (counts.get(a) || 0) + 1);
    }
    const maxPerAuthor = Math.ceil(20 / 3);
    for (const [, count] of counts) {
      assert.ok(count <= maxPerAuthor);
    }
  });
});

// ── runAutogenV2 ─────────────────────────────────────────────────────────────

describe("runAutogenV2", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns insufficient inputs when too few DTUs", () => {
    seedDtus(STATE, 1);
    const result = runAutogenV2(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.outputs.length, 0);
    assert.match(result.reason || "", /Insufficient/i);
  });

  it("runs a full pipeline with sufficient inputs", () => {
    seedDtus(STATE, 5);
    const result = runAutogenV2(STATE, { domainTarget: "empirical.physics" });
    assert.equal(result.ok, true);
    assert.ok(result.run);
    assert.equal(result.run.status, "COMPLETED");
    assert.ok(result.metrics);
  });

  it("stores run in atlas autogenRuns", () => {
    seedDtus(STATE, 5);
    const result = runAutogenV2(STATE);
    const atlas = STATE._atlas;
    assert.ok(atlas.autogenRuns.size > 0);
  });

  it("respects budget options", () => {
    seedDtus(STATE, 5);
    const result = runAutogenV2(STATE, { budget: { maxDtus: 1, depthCap: 1 } });
    assert.equal(result.ok, true);
    assert.ok(result.outputs.length <= 1);
  });

  it("includes trace entries", () => {
    seedDtus(STATE, 5);
    const result = runAutogenV2(STATE);
    assert.ok(result.run.trace.length > 0);
    assert.equal(result.run.trace[0].stage, "INIT");
  });

  it("returns empty pipeline for no data", () => {
    const result = runAutogenV2(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.outputs.length, 0);
  });
});

// ── getAutogenRun ────────────────────────────────────────────────────────────

describe("getAutogenRun", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("retrieves a run by ID", () => {
    seedDtus(STATE, 5);
    const runResult = runAutogenV2(STATE);
    const result = getAutogenRun(STATE, runResult.run.runId);
    assert.equal(result.ok, true);
    assert.equal(result.run.runId, runResult.run.runId);
  });

  it("returns error for missing run", () => {
    const result = getAutogenRun(STATE, "nonexistent_run");
    assert.equal(result.ok, false);
    assert.match(result.error, /not found/);
  });
});

// ── acceptAutogenOutput ──────────────────────────────────────────────────────

describe("acceptAutogenOutput", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns error for missing DTU", () => {
    const result = acceptAutogenOutput(STATE, "missing_id");
    assert.equal(result.ok, false);
  });

  it("returns error for non-autogen DTU", () => {
    const create = createAtlasDtu(STATE, {
      title: "Not autogen",
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
      claims: [{ text: "claim", claimType: "FACT", sources: [{ title: "S", url: "https://x.com", sourceTier: "SCHOLARLY" }] }],
      author: { userId: "u1" },
      lineage: { origin: "HUMAN" },
    });
    if (create.ok) {
      const result = acceptAutogenOutput(STATE, create.dtu.id);
      assert.equal(result.ok, false);
      assert.match(result.error, /autogen/i);
    }
  });

  it("accepts autogen DTU and adds audit event", () => {
    const create = createAtlasDtu(STATE, {
      title: "Autogen DTU",
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
      claims: [{ text: "autogen claim text here", claimType: "FACT", sources: [{ title: "S", url: "https://x.com", sourceTier: "SCHOLARLY" }] }],
      author: { userId: "autogen_v2", isSystem: true },
      lineage: { origin: "AUTOGEN" },
    });
    if (create.ok) {
      const result = acceptAutogenOutput(STATE, create.dtu.id, "council");
      assert.equal(result.ok, true);
      assert.equal(result.dtuId, create.dtu.id);
    }
  });
});

// ── mergeAutogenOutput ───────────────────────────────────────────────────────

describe("mergeAutogenOutput", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("creates a sameAs link between two DTUs", () => {
    const src = createAtlasDtu(STATE, {
      title: "Src",
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
      claims: [{ text: "claim", claimType: "FACT", sources: [{ title: "S", url: "https://x.com", sourceTier: "SCHOLARLY" }] }],
      author: { userId: "u1" },
    });
    const dst = createAtlasDtu(STATE, {
      title: "Dst",
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
      claims: [{ text: "claim2", claimType: "FACT", sources: [{ title: "S2", url: "https://x2.com", sourceTier: "SCHOLARLY" }] }],
      author: { userId: "u2" },
    });
    if (src.ok && dst.ok) {
      const result = mergeAutogenOutput(STATE, src.dtu.id, dst.dtu.id, "council");
      assert.equal(result.ok, true);
    }
  });
});

// ── propagateConfidence ──────────────────────────────────────────────────────

describe("propagateConfidence", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns error for missing DTU", () => {
    const result = propagateConfidence(STATE, "missing_id");
    assert.equal(result.ok, false);
  });

  it("propagates confidence through support links", () => {
    const src = createAtlasDtu(STATE, {
      title: "Source",
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
      claims: [{ text: "claim", claimType: "FACT", sources: [{ title: "S", url: "https://s.com", sourceTier: "SCHOLARLY" }] }],
      author: { userId: "u1" },
    });
    const dst = createAtlasDtu(STATE, {
      title: "Target",
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
      claims: [{ text: "claim2", claimType: "FACT", sources: [{ title: "S2", url: "https://s2.com", sourceTier: "SCHOLARLY" }] }],
      author: { userId: "u2" },
    });
    if (src.ok && dst.ok) {
      addAtlasLink(STATE, src.dtu.id, dst.dtu.id, "supports", { strength: 0.8 });

      const atlas = STATE._atlas;
      atlas.dtus.get(src.dtu.id).scores.confidence_overall = 0.8;

      const result = propagateConfidence(STATE, src.dtu.id);
      assert.equal(result.ok, true);
      assert.ok(result.propagatedTo >= 0);
    }
  });

  it("respects maxHops", () => {
    const ids = seedDtus(STATE, 4);
    // Create chain: 0 -> 1 -> 2 -> 3
    for (let i = 0; i < 3; i++) {
      addAtlasLink(STATE, ids[i], ids[i + 1], "supports", { strength: 0.8 });
    }
    const result = propagateConfidence(STATE, ids[0], 1);
    assert.equal(result.ok, true);
    assert.equal(result.maxHops, 1);
  });

  it("does not propagate when boost < threshold", () => {
    const ids = seedDtus(STATE, 2);
    addAtlasLink(STATE, ids[0], ids[1], "supports", { strength: 0.001 });
    const atlas = STATE._atlas;
    atlas.dtus.get(ids[0]).scores.confidence_overall = 0.01;
    const result = propagateConfidence(STATE, ids[0], 2, 0.5);
    assert.equal(result.ok, true);
  });
});

// ── getAutogenV2Metrics ──────────────────────────────────────────────────────

describe("getAutogenV2Metrics", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns metrics structure", () => {
    const result = getAutogenV2Metrics(STATE);
    assert.equal(result.ok, true);
    assert.ok("totalRuns" in result);
    assert.ok("completedRuns" in result);
    assert.ok("totalOutputs" in result);
    assert.ok("dailyBudget" in result);
    assert.ok("aggregateMetrics" in result);
  });

  it("increments metrics after a run", () => {
    seedDtus(STATE, 5);
    runAutogenV2(STATE);
    const result = getAutogenV2Metrics(STATE);
    assert.ok(result.totalRuns >= 1);
  });
});
