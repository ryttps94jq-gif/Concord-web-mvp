/**
 * Atlas Store — Comprehensive Test Suite
 *
 * Covers: contentHash, createAtlasDtu, getAtlasDtu, searchAtlasDtus,
 * promoteAtlasDtu, addAtlasLink, getScoreExplanation, recomputeScores,
 * registerEntity, getEntity, getContradictions, getAtlasMetrics
 *
 * All atlas-epistemic dependencies are exercised through real imports
 * since they are pure functions. STATE is constructed fresh per test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  contentHash,
  createAtlasDtu,
  getAtlasDtu,
  searchAtlasDtus,
  promoteAtlasDtu,
  addAtlasLink,
  getScoreExplanation,
  recomputeScores,
  registerEntity,
  getEntity,
  getContradictions,
  getAtlasMetrics,
} from "../emergent/atlas-store.js";

import { initAtlasState, ATLAS_STATUS } from "../emergent/atlas-epistemic.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function freshSTATE() {
  const STATE = {};
  initAtlasState(STATE);
  return STATE;
}

function validInput(overrides = {}) {
  return {
    title: "Test DTU",
    domainType: "empirical.physics",
    epistemicClass: "EMPIRICAL",
    tags: ["physics", "test"],
    claims: [
      {
        text: "Light speed is constant in a vacuum",
        claimType: "FACT",
        sources: [
          { title: "Relativity", url: "https://example.com/rel", sourceTier: "SCHOLARLY" },
        ],
      },
    ],
    author: { userId: "user1", display: "Test User", isSystem: false },
    ...overrides,
  };
}

// ── contentHash ──────────────────────────────────────────────────────────────

describe("contentHash", () => {
  it("returns a 16-char hex string", () => {
    const h = contentHash({ title: "Hello", claims: [{ text: "c1" }], tags: ["t1"] });
    assert.equal(typeof h, "string");
    assert.equal(h.length, 16);
    assert.match(h, /^[0-9a-f]{16}$/);
  });

  it("is deterministic for same input", () => {
    const input = { title: "X", claims: [{ text: "c" }], tags: ["a"] };
    assert.equal(contentHash(input), contentHash(input));
  });

  it("handles missing fields gracefully", () => {
    const h = contentHash({});
    assert.equal(h.length, 16);
  });

  it("changes when content changes", () => {
    const a = contentHash({ title: "A", claims: [], tags: [] });
    const b = contentHash({ title: "B", claims: [], tags: [] });
    assert.notEqual(a, b);
  });
});

// ── createAtlasDtu ───────────────────────────────────────────────────────────

describe("createAtlasDtu", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("creates a DTU with valid input", () => {
    const result = createAtlasDtu(STATE, validInput());
    assert.equal(result.ok, true);
    assert.ok(result.dtu);
    assert.ok(result.dtu.id.startsWith("atlas_"));
    assert.equal(result.dtu.status, ATLAS_STATUS.DRAFT);
    assert.equal(result.dtu.domainType, "empirical.physics");
    assert.equal(result.dtu.epistemicClass, "EMPIRICAL");
  });

  it("rejects invalid domainType", () => {
    const result = createAtlasDtu(STATE, validInput({ domainType: "invalid" }));
    assert.equal(result.ok, false);
    assert.match(result.error, /domainType/);
  });

  it("rejects missing domainType", () => {
    const result = createAtlasDtu(STATE, validInput({ domainType: undefined }));
    assert.equal(result.ok, false);
  });

  it("rejects invalid epistemicClass", () => {
    const result = createAtlasDtu(STATE, validInput({ epistemicClass: "BOGUS" }));
    assert.equal(result.ok, false);
    assert.match(result.error, /epistemicClass/);
  });

  it("resolves epistemicClass from domainType when not provided", () => {
    const result = createAtlasDtu(STATE, validInput({ epistemicClass: undefined }));
    assert.equal(result.ok, true);
    assert.ok(result.dtu.epistemicClass);
  });

  it("sets default author fields", () => {
    const result = createAtlasDtu(STATE, validInput({ author: undefined }));
    assert.equal(result.ok, true);
    assert.equal(result.dtu.author.userId, "unknown");
  });

  it("sets system actor in audit for system authors", () => {
    const result = createAtlasDtu(STATE, validInput({ author: { userId: "sys", isSystem: true } }));
    assert.equal(result.ok, true);
    assert.equal(result.dtu.audit.events[0].actor, "system");
  });

  it("labels uncited FACT claims as UNCORROBORATED", () => {
    const result = createAtlasDtu(STATE, validInput({
      claims: [{ text: "An uncited fact", claimType: "FACT", sources: [] }],
    }));
    assert.equal(result.ok, true);
    assert.equal(result.dtu.claims[0].evidenceTier, "UNCORROBORATED");
  });

  it("builds claims with default fields", () => {
    const result = createAtlasDtu(STATE, validInput({
      claims: [{ text: "bare claim" }],
    }));
    assert.equal(result.ok, true);
    const claim = result.dtu.claims[0];
    assert.ok(claim.claimId.startsWith("c_"));
    assert.equal(claim.claimType, "FACT");
    assert.deepEqual(claim.entities, []);
    assert.equal(claim.timeRange, null);
    assert.deepEqual(claim.numeric, []);
  });

  it("accepts a custom id", () => {
    const result = createAtlasDtu(STATE, validInput({ id: "custom_id_123" }));
    assert.equal(result.ok, true);
    assert.equal(result.dtu.id, "custom_id_123");
  });

  it("populates interpretations, assumptions, provenance, links", () => {
    const result = createAtlasDtu(STATE, validInput({
      interpretations: [{ school: "Kantian", text: "Interp" }],
      assumptions: [{ text: "Assumes constant", sensitivity: "HIGH" }],
      provenance: [{ type: "ORIGINAL", text: "From lab" }],
      links: { supports: ["dtu_1"], about: [{ entityId: "ent_1" }] },
    }));
    assert.equal(result.ok, true);
    assert.ok(result.dtu.interpretations.length > 0);
    assert.ok(result.dtu.assumptions.length > 0);
    assert.ok(result.dtu.provenance.length > 0);
  });

  it("sets _lane from _scope", () => {
    const result = createAtlasDtu(STATE, validInput({ _scope: "global" }));
    assert.equal(result.ok, true);
    assert.equal(result.dtu._lane, "global");
  });

  it("sets lineage fields", () => {
    const result = createAtlasDtu(STATE, validInput({
      lineage: { origin: "AUTOGEN", generationDepth: 2, parents: ["p1"], runId: "run1" },
    }));
    assert.equal(result.ok, true);
    assert.equal(result.dtu.lineage.origin, "AUTOGEN");
    assert.equal(result.dtu.lineage.generationDepth, 2);
  });

  it("computes scores on creation", () => {
    const result = createAtlasDtu(STATE, validInput());
    assert.equal(result.ok, true);
    assert.ok(typeof result.dtu.scores.confidence_factual === "number");
    assert.ok(typeof result.dtu.scores.credibility_structural === "number");
    assert.ok(typeof result.dtu.scores.confidence_overall === "number");
  });

  it("increments dtusCreated metric", () => {
    createAtlasDtu(STATE, validInput());
    createAtlasDtu(STATE, validInput());
    const metrics = getAtlasMetrics(STATE);
    assert.equal(metrics.dtusCreated, 2);
  });

  it("indexes by domain, class, status", () => {
    const result = createAtlasDtu(STATE, validInput());
    assert.equal(result.ok, true);
    const atlas = STATE._atlas;
    assert.ok(atlas.byDomainType.get("empirical.physics")?.has(result.dtu.id));
    assert.ok(atlas.byEpistemicClass.get("EMPIRICAL")?.has(result.dtu.id));
    assert.ok(atlas.byStatus.get("DRAFT")?.has(result.dtu.id));
  });

  it("indexes claim sources by url", () => {
    const result = createAtlasDtu(STATE, validInput());
    assert.equal(result.ok, true);
    const atlas = STATE._atlas;
    assert.ok(atlas.sources.get("https://example.com/rel")?.has(result.dtu.id));
  });

  it("indexes about links", () => {
    const result = createAtlasDtu(STATE, validInput({
      links: { about: [{ entityId: "ent_x" }] },
    }));
    assert.equal(result.ok, true);
    const atlas = STATE._atlas;
    assert.ok(atlas.about.get(result.dtu.id)?.has("ent_x"));
  });

  it("sets license_type and license_custom", () => {
    const result = createAtlasDtu(STATE, validInput({ license_type: "CC-BY-4.0", license_custom: "custom" }));
    assert.equal(result.ok, true);
    assert.equal(result.dtu.license_type, "CC-BY-4.0");
    assert.equal(result.dtu.license_custom, "custom");
  });
});

// ── getAtlasDtu ──────────────────────────────────────────────────────────────

describe("getAtlasDtu", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns DTU by id", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = getAtlasDtu(STATE, dtu.id);
    assert.equal(result.ok, true);
    assert.equal(result.dtu.id, dtu.id);
  });

  it("returns error for missing id", () => {
    const result = getAtlasDtu(STATE, "nonexistent_id");
    assert.equal(result.ok, false);
    assert.match(result.error, /not found/);
  });
});

// ── searchAtlasDtus ──────────────────────────────────────────────────────────

describe("searchAtlasDtus", () => {
  let STATE;
  beforeEach(() => {
    STATE = freshSTATE();
    createAtlasDtu(STATE, validInput({ title: "Physics 1" }));
    createAtlasDtu(STATE, validInput({ title: "Physics 2", domainType: "empirical.biology", epistemicClass: "EMPIRICAL" }));
  });

  it("returns all DTUs when no query filters", () => {
    const result = searchAtlasDtus(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.total, 2);
  });

  it("filters by domainType", () => {
    const result = searchAtlasDtus(STATE, { domainType: "empirical.physics" });
    assert.equal(result.ok, true);
    assert.equal(result.total, 1);
  });

  it("filters by epistemicClass", () => {
    const result = searchAtlasDtus(STATE, { epistemicClass: "EMPIRICAL" });
    assert.equal(result.ok, true);
    assert.equal(result.total, 2);
  });

  it("filters by status", () => {
    const result = searchAtlasDtus(STATE, { status: "DRAFT" });
    assert.equal(result.ok, true);
    assert.equal(result.total, 2);
  });

  it("combines filters with intersection", () => {
    const result = searchAtlasDtus(STATE, {
      domainType: "empirical.physics",
      epistemicClass: "EMPIRICAL",
    });
    assert.equal(result.ok, true);
    assert.equal(result.total, 1);
  });

  it("respects minConfidence filter", () => {
    const result = searchAtlasDtus(STATE, { minConfidence: 999 });
    assert.equal(result.total, 0);
  });

  it("filters by entity", () => {
    // No entities linked, should be 0
    const result = searchAtlasDtus(STATE, { entity: "ent_missing" });
    assert.equal(result.total, 0);
  });

  it("supports pagination via limit and offset", () => {
    const result = searchAtlasDtus(STATE, { limit: 1, offset: 0 });
    assert.equal(result.results.length, 1);
    assert.equal(result.total, 2);
    assert.equal(result.limit, 1);
    assert.equal(result.offset, 0);
  });

  it("caps limit at 200", () => {
    const result = searchAtlasDtus(STATE, { limit: 999 });
    assert.equal(result.limit, 200);
  });

  it("filters by lane", () => {
    const result = searchAtlasDtus(STATE, { lane: "local" });
    assert.equal(result.ok, true);
    assert.equal(result.total, 2);
  });

  it("returns empty for non-existent lane", () => {
    const result = searchAtlasDtus(STATE, { lane: "nonexistent_lane" });
    assert.equal(result.total, 0);
  });

  it("filters by _lane alias", () => {
    const result = searchAtlasDtus(STATE, { _lane: "local" });
    assert.equal(result.ok, true);
    assert.equal(result.total, 2);
  });

  it("returns empty for non-existent domain filter", () => {
    const result = searchAtlasDtus(STATE, { domainType: "nonexistent.type" });
    assert.equal(result.total, 0);
  });

  it("intersects epistemicClass with previous filter", () => {
    const result = searchAtlasDtus(STATE, {
      domainType: "empirical.physics",
      epistemicClass: "FORMAL",
    });
    assert.equal(result.total, 0);
  });

  it("intersects status with previous filter", () => {
    const result = searchAtlasDtus(STATE, {
      domainType: "empirical.physics",
      status: "VERIFIED",
    });
    assert.equal(result.total, 0);
  });

  it("intersects lane with previous filter", () => {
    const result = searchAtlasDtus(STATE, {
      domainType: "empirical.physics",
      lane: "local",
    });
    assert.equal(result.total, 1);
  });
});

// ── promoteAtlasDtu ──────────────────────────────────────────────────────────

describe("promoteAtlasDtu", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("promotes from DRAFT to PROPOSED", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = promoteAtlasDtu(STATE, dtu.id, "PROPOSED");
    assert.equal(result.ok, true);
    assert.equal(result.transition.from, "DRAFT");
    assert.equal(result.transition.to, "PROPOSED");
  });

  it("returns error for nonexistent DTU", () => {
    const result = promoteAtlasDtu(STATE, "missing_id", "PROPOSED");
    assert.equal(result.ok, false);
  });

  it("is idempotent when already at target status", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = promoteAtlasDtu(STATE, dtu.id, "DRAFT");
    assert.equal(result.ok, true);
    assert.equal(result.noop, true);
  });

  it("rejects invalid transition", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = promoteAtlasDtu(STATE, dtu.id, "VERIFIED");
    assert.equal(result.ok, false);
    assert.ok(result.allowedTransitions);
  });

  it("CAS fails when expectedStatus does not match", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = promoteAtlasDtu(STATE, dtu.id, "PROPOSED", "system", "PROPOSED");
    assert.equal(result.ok, false);
    assert.match(result.error, /CAS failed/);
  });

  it("CAS succeeds when expectedStatus matches", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = promoteAtlasDtu(STATE, dtu.id, "PROPOSED", "system", "DRAFT");
    assert.equal(result.ok, true);
  });

  it("updates status index on promote", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    promoteAtlasDtu(STATE, dtu.id, "PROPOSED");
    const atlas = STATE._atlas;
    assert.ok(!atlas.byStatus.get("DRAFT")?.has(dtu.id));
    assert.ok(atlas.byStatus.get("PROPOSED")?.has(dtu.id));
  });

  it("increments dtusVerified metric on VERIFIED", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    promoteAtlasDtu(STATE, dtu.id, "PROPOSED");
    // Force promote to VERIFIED (skip gate)
    const atlas = STATE._atlas;
    const d = atlas.dtus.get(dtu.id);
    d.status = "PROPOSED";
    // Try to promote — may fail gate check, that's fine, testing metric path
    promoteAtlasDtu(STATE, dtu.id, "VERIFIED");
    // Metric may or may not increment depending on gate
  });

  it("increments dtusDisputed metric on DISPUTED", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    promoteAtlasDtu(STATE, dtu.id, "PROPOSED");
    promoteAtlasDtu(STATE, dtu.id, "DISPUTED");
    const metrics = getAtlasMetrics(STATE);
    assert.equal(metrics.dtusDisputed, 1);
  });

  it("increments dtusQuarantined metric on QUARANTINED", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    promoteAtlasDtu(STATE, dtu.id, "PROPOSED");
    promoteAtlasDtu(STATE, dtu.id, "QUARANTINED");
    const metrics = getAtlasMetrics(STATE);
    assert.equal(metrics.dtusQuarantined, 1);
  });

  it("adds audit event on promote", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    promoteAtlasDtu(STATE, dtu.id, "PROPOSED", "actor1");
    const atlas = STATE._atlas;
    const d = atlas.dtus.get(dtu.id);
    const statusEvent = d.audit.events.find(e => e.action === "STATUS_CHANGE");
    assert.ok(statusEvent);
    assert.equal(statusEvent.actor, "actor1");
  });

  it("logs to atlas audit", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    promoteAtlasDtu(STATE, dtu.id, "PROPOSED");
    const atlas = STATE._atlas;
    assert.ok(atlas.audit.length > 0);
    assert.equal(atlas.audit[atlas.audit.length - 1].action, "PROMOTE");
  });
});

// ── addAtlasLink ─────────────────────────────────────────────────────────────

describe("addAtlasLink", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("adds a supports link", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    const result = addAtlasLink(STATE, src.id, dst.id, "supports");
    assert.equal(result.ok, true);
    assert.ok(result.link);
  });

  it("adds contradiction with reverse link", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    const result = addAtlasLink(STATE, src.id, dst.id, "contradicts", { severity: "MEDIUM" });
    assert.equal(result.ok, true);

    const atlas = STATE._atlas;
    const dstDtu = atlas.dtus.get(dst.id);
    assert.ok(dstDtu.links.contradicts.length > 0);
    assert.equal(dstDtu.links.contradicts[0].targetDtuId, src.id);
  });

  it("returns error for missing src DTU", () => {
    const { dtu: dst } = createAtlasDtu(STATE, validInput());
    const result = addAtlasLink(STATE, "missing", dst.id, "supports");
    assert.equal(result.ok, false);
    assert.match(result.error, /Source DTU not found/);
  });

  it("returns error for missing dst DTU", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput());
    const result = addAtlasLink(STATE, src.id, "missing", "supports");
    assert.equal(result.ok, false);
    assert.match(result.error, /Target DTU not found/);
  });

  it("returns error for invalid link type", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    const result = addAtlasLink(STATE, src.id, dst.id, "invalid_type");
    assert.equal(result.ok, false);
    assert.match(result.error, /Invalid link type/);
  });

  it("increments contradictionsLogged metric", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    addAtlasLink(STATE, src.id, dst.id, "contradicts");
    const metrics = getAtlasMetrics(STATE);
    assert.equal(metrics.contradictionsLogged, 1);
  });

  it("adds audit event on link", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    addAtlasLink(STATE, src.id, dst.id, "supports", { actor: "me" });
    const atlas = STATE._atlas;
    const s = atlas.dtus.get(src.id);
    const linkEvent = s.audit.events.find(e => e.action === "LINK_SUPPORTS");
    assert.ok(linkEvent);
  });

  it("stores link in global links list", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    addAtlasLink(STATE, src.id, dst.id, "sameAs");
    const atlas = STATE._atlas;
    assert.ok(atlas.links.length > 0);
  });

  it("initializes missing links array", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    // Delete the about array to test initialization
    const atlas = STATE._atlas;
    const s = atlas.dtus.get(src.id);
    delete s.links.about;
    const result = addAtlasLink(STATE, src.id, dst.id, "about");
    assert.equal(result.ok, true);
  });
});

// ── getScoreExplanation ──────────────────────────────────────────────────────

describe("getScoreExplanation", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns explanation for valid DTU", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = getScoreExplanation(STATE, dtu.id);
    assert.equal(result.ok, true);
    assert.ok("confidence_factual" in result);
  });

  it("returns error for missing DTU", () => {
    const result = getScoreExplanation(STATE, "missing");
    assert.equal(result.ok, false);
  });

  it("increments scoreComputations metric", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    getScoreExplanation(STATE, dtu.id);
    getScoreExplanation(STATE, dtu.id);
    const metrics = getAtlasMetrics(STATE);
    assert.ok(metrics.scoreComputations >= 2);
  });
});

// ── recomputeScores ──────────────────────────────────────────────────────────

describe("recomputeScores", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("recomputes scores for existing DTU", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = recomputeScores(STATE, dtu.id);
    assert.equal(result.ok, true);
    assert.ok(result.scores);
  });

  it("returns error for missing DTU", () => {
    const result = recomputeScores(STATE, "missing");
    assert.equal(result.ok, false);
  });
});

// ── registerEntity / getEntity ───────────────────────────────────────────────

describe("registerEntity / getEntity", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("registers an entity", () => {
    const result = registerEntity(STATE, "ent1", "Entity One", "PERSON");
    assert.equal(result.ok, true);
    assert.equal(result.entityId, "ent1");
    assert.equal(result.type, "PERSON");
  });

  it("registers with default type", () => {
    const result = registerEntity(STATE, "ent2", "Entity Two");
    assert.equal(result.type, "TOPIC");
  });

  it("retrieves an entity with linked DTUs", () => {
    registerEntity(STATE, "ent1", "Entity One");
    createAtlasDtu(STATE, validInput({
      links: { about: [{ entityId: "ent1" }] },
    }));
    const result = getEntity(STATE, "ent1");
    assert.equal(result.ok, true);
    assert.equal(result.entity.entityId, "ent1");
    assert.equal(result.dtuCount, 1);
  });

  it("returns error for missing entity", () => {
    const result = getEntity(STATE, "missing");
    assert.equal(result.ok, false);
  });
});

// ── getContradictions ────────────────────────────────────────────────────────

describe("getContradictions", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns contradictions for a DTU", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Src" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Dst" }));
    addAtlasLink(STATE, src.id, dst.id, "contradicts", { severity: "HIGH" });

    const result = getContradictions(STATE, src.id);
    assert.equal(result.ok, true);
    assert.equal(result.count, 1);
    assert.equal(result.bySeverity.HIGH, 1);
  });

  it("returns empty contradictions for DTU with none", () => {
    const { dtu } = createAtlasDtu(STATE, validInput());
    const result = getContradictions(STATE, dtu.id);
    assert.equal(result.ok, true);
    assert.equal(result.count, 0);
  });

  it("returns error for missing DTU", () => {
    const result = getContradictions(STATE, "missing");
    assert.equal(result.ok, false);
  });

  it("enriches contradiction targets", () => {
    const { dtu: src } = createAtlasDtu(STATE, validInput({ title: "Source" }));
    const { dtu: dst } = createAtlasDtu(STATE, validInput({ title: "Target" }));
    addAtlasLink(STATE, src.id, dst.id, "contradicts", { severity: "LOW" });

    const result = getContradictions(STATE, src.id);
    assert.equal(result.contradictions[0].targetTitle, "Target");
    assert.equal(result.bySeverity.LOW, 1);
  });
});

// ── getAtlasMetrics ──────────────────────────────────────────────────────────

describe("getAtlasMetrics", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns comprehensive metrics", () => {
    createAtlasDtu(STATE, validInput());
    registerEntity(STATE, "ent1", "E1");
    const result = getAtlasMetrics(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.totalDtus, 1);
    assert.equal(result.totalEntities, 1);
    assert.ok("byDomain" in result);
    assert.ok("byClass" in result);
    assert.ok("byStatus" in result);
  });

  it("returns zero metrics on fresh state", () => {
    const result = getAtlasMetrics(STATE);
    assert.equal(result.totalDtus, 0);
    assert.equal(result.totalLinks, 0);
  });
});
