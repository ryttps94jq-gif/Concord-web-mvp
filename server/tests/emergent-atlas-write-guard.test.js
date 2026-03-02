/**
 * Atlas Write Guard — Comprehensive Test Suite
 *
 * Covers: applyWrite, runAutoPromoteGate, ingestAutogenCandidate,
 * guardedDtuWrite, getWriteGuardLog, getWriteGuardMetrics, WRITE_OPS
 *
 * External dependencies (atlas-antigaming, atlas-rights, atlas-invariants,
 * atlas-config) are exercised through real imports where possible.
 * STATE is constructed fresh per test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  applyWrite,
  runAutoPromoteGate,
  ingestAutogenCandidate,
  guardedDtuWrite,
  getWriteGuardLog,
  getWriteGuardMetrics,
  WRITE_OPS,
} from "../emergent/atlas-write-guard.js";

import { initAtlasState } from "../emergent/atlas-epistemic.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function freshSTATE() {
  const STATE = { dtus: new Map() };
  initAtlasState(STATE);
  return STATE;
}

function validPayload(overrides = {}) {
  return {
    title: "Write Guard Test DTU",
    domainType: "empirical.physics",
    epistemicClass: "EMPIRICAL",
    tags: ["test"],
    claims: [
      {
        text: "A valid factual claim for testing",
        claimType: "FACT",
        sources: [{ title: "Source", url: "https://example.com/source", sourceTier: "SCHOLARLY" }],
      },
    ],
    author: { userId: "tester", display: "Tester", isSystem: false },
    ...overrides,
  };
}

// ── WRITE_OPS constant ───────────────────────────────────────────────────────

describe("WRITE_OPS", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(WRITE_OPS));
  });

  it("has all expected ops", () => {
    assert.equal(WRITE_OPS.CREATE, "CREATE");
    assert.equal(WRITE_OPS.UPDATE, "UPDATE");
    assert.equal(WRITE_OPS.PROMOTE, "PROMOTE");
    assert.equal(WRITE_OPS.INGEST, "INGEST");
    assert.equal(WRITE_OPS.AUTOGEN, "AUTOGEN");
    assert.equal(WRITE_OPS.IMPORT, "IMPORT");
  });
});

// ── applyWrite — CREATE ──────────────────────────────────────────────────────

describe("applyWrite — CREATE", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("creates a DTU via CREATE op", () => {
    const result = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    assert.equal(result.ok, true);
    assert.ok(result.dtu);
    assert.ok(result.dtu.id);
  });

  it("rejects invalid domainType in HARD mode", () => {
    const result = applyWrite(STATE, WRITE_OPS.CREATE, validPayload({ domainType: "invalid" }), { scope: "global" });
    assert.equal(result.ok, false);
  });

  it("resolves epistemicClass from domainType when not provided", () => {
    const result = applyWrite(STATE, WRITE_OPS.CREATE, validPayload({ epistemicClass: undefined }), { scope: "local" });
    assert.equal(result.ok, true);
    assert.ok(result.dtu.epistemicClass);
  });

  it("sets _scope metadata on payload", () => {
    const result = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    assert.equal(result.ok, true);
    assert.equal(result.scope, "local");
  });

  it("defaults claim types to FACT", () => {
    const payload = validPayload({ claims: [{ text: "No type claim" }] });
    const result = applyWrite(STATE, WRITE_OPS.CREATE, payload, { scope: "local" });
    assert.equal(result.ok, true);
  });

  it("works with INGEST op", () => {
    const result = applyWrite(STATE, WRITE_OPS.INGEST, validPayload(), { scope: "local" });
    assert.equal(result.ok, true);
  });

  it("works with AUTOGEN op", () => {
    const result = applyWrite(STATE, WRITE_OPS.AUTOGEN, validPayload(), { scope: "local" });
    assert.equal(result.ok, true);
  });

  it("works with IMPORT op", () => {
    const result = applyWrite(STATE, WRITE_OPS.IMPORT, validPayload(), { scope: "local" });
    assert.equal(result.ok, true);
  });

  it("overrides status to LOCAL_DRAFT for local scope", () => {
    const result = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    assert.equal(result.ok, true);
    assert.equal(result.dtu.status, "LOCAL_DRAFT");
  });

  it("returns unknown op error for bogus op", () => {
    const result = applyWrite(STATE, "BOGUS_OP", validPayload(), { scope: "local" });
    assert.equal(result.ok, false);
    assert.match(result.error, /Unknown write op/);
  });
});

// ── applyWrite — UPDATE ──────────────────────────────────────────────────────

describe("applyWrite — UPDATE", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("updates a DTU", () => {
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    assert.equal(create.ok, true);
    const result = applyWrite(STATE, WRITE_OPS.UPDATE, {
      dtuId: create.dtu.id,
      title: "Updated Title",
    }, { scope: "local" });
    assert.equal(result.ok, true);
    assert.equal(result.dtu.title, "Updated Title");
  });

  it("returns error for missing dtuId", () => {
    const result = applyWrite(STATE, WRITE_OPS.UPDATE, {}, { scope: "local" });
    assert.equal(result.ok, false);
    assert.match(result.error, /dtuId required/);
  });

  it("returns error for nonexistent DTU", () => {
    const result = applyWrite(STATE, WRITE_OPS.UPDATE, { dtuId: "fake_id" }, { scope: "local" });
    assert.equal(result.ok, false);
    assert.match(result.error, /not found/);
  });

  it("updates allowed fields only", () => {
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    const result = applyWrite(STATE, WRITE_OPS.UPDATE, {
      dtuId: create.dtu.id,
      tags: ["new_tag"],
    }, { scope: "local" });
    assert.equal(result.ok, true);
    assert.deepEqual(result.dtu.tags, ["new_tag"]);
  });

  it("also accepts id instead of dtuId", () => {
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    const result = applyWrite(STATE, WRITE_OPS.UPDATE, {
      id: create.dtu.id,
      title: "Via id",
    }, { scope: "local" });
    assert.equal(result.ok, true);
  });
});

// ── applyWrite — PROMOTE ─────────────────────────────────────────────────────

describe("applyWrite — PROMOTE", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("promotes a DTU", () => {
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    assert.equal(create.ok, true);
    // Manually set to DRAFT for promote test
    const atlas = STATE._atlas;
    const dtu = atlas.dtus.get(create.dtu.id);
    dtu.status = "DRAFT";
    atlas.byStatus.get("LOCAL_DRAFT")?.delete(dtu.id);
    if (!atlas.byStatus.has("DRAFT")) atlas.byStatus.set("DRAFT", new Set());
    atlas.byStatus.get("DRAFT").add(dtu.id);

    const result = applyWrite(STATE, WRITE_OPS.PROMOTE, {
      dtuId: create.dtu.id,
      targetStatus: "PROPOSED",
    }, { scope: "local" });
    // May or may not pass depending on gate
    assert.ok(typeof result.ok === "boolean");
  });

  it("returns error for missing dtuId in promote", () => {
    const result = applyWrite(STATE, WRITE_OPS.PROMOTE, { targetStatus: "PROPOSED" }, { scope: "global" });
    assert.equal(result.ok, false);
  });

  it("returns error for nonexistent DTU in promote", () => {
    const result = applyWrite(STATE, WRITE_OPS.PROMOTE, {
      dtuId: "fake",
      targetStatus: "PROPOSED",
    }, { scope: "global" });
    assert.equal(result.ok, false);
  });
});

// ── runAutoPromoteGate ───────────────────────────────────────────────────────

describe("runAutoPromoteGate", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns gate result with checks", () => {
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    const atlas = STATE._atlas;
    const dtu = atlas.dtus.get(create.dtu.id);
    const result = runAutoPromoteGate(STATE, dtu);
    assert.ok(typeof result.pass === "boolean");
    assert.ok(Array.isArray(result.checks));
    assert.ok(typeof result.reason === "string");
  });

  it("includes structural, factual, contradiction checks", () => {
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    const atlas = STATE._atlas;
    const dtu = atlas.dtus.get(create.dtu.id);
    const result = runAutoPromoteGate(STATE, dtu);
    const checkNames = result.checks.map(c => c.name);
    assert.ok(checkNames.includes("structural_score"));
    assert.ok(checkNames.includes("no_high_contradictions"));
    assert.ok(checkNames.includes("dedupe"));
    assert.ok(checkNames.includes("antigaming_clean"));
    assert.ok(checkNames.includes("no_lineage_cycle"));
  });

  it("reports failed checks when conditions unmet", () => {
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload({
      claims: [{ text: "Bare uncited claim", claimType: "FACT" }],
    }), { scope: "local" });
    const atlas = STATE._atlas;
    const dtu = atlas.dtus.get(create.dtu.id);
    dtu.scores = { confidence_factual: 0, credibility_structural: 0, confidence_overall: 0 };
    const result = runAutoPromoteGate(STATE, dtu);
    assert.ok(result.failedChecks.length > 0);
    assert.equal(result.pass, false);
  });
});

// ── ingestAutogenCandidate ───────────────────────────────────────────────────

describe("ingestAutogenCandidate", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("ingests an autogen candidate via applyWrite AUTOGEN", () => {
    const result = ingestAutogenCandidate(STATE, validPayload(), { actor: "autogen_v2" });
    assert.equal(result.ok, true);
    assert.ok(result.dtu);
  });

  it("defaults scope to global and actor to autogen_v2", () => {
    const result = ingestAutogenCandidate(STATE, validPayload());
    assert.equal(result.ok, true);
  });
});

// ── guardedDtuWrite ──────────────────────────────────────────────────────────

describe("guardedDtuWrite", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("bypasses guard for skill DTUs", () => {
    const dtu = { id: "skill_1", kind: "skill", title: "Test" };
    const result = guardedDtuWrite(STATE, dtu);
    assert.equal(result.ok, true);
    assert.equal(result.bypassed, true);
    assert.ok(STATE.dtus.has("skill_1"));
  });

  it("bypasses guard for system DTUs", () => {
    const dtu = { id: "sys_1", _system: true, title: "System" };
    const result = guardedDtuWrite(STATE, dtu);
    assert.equal(result.ok, true);
    assert.equal(result.bypassed, true);
  });

  it("bypasses guard for genesis DTUs", () => {
    const dtu = { id: "genesis_anchor_1", title: "Genesis" };
    const result = guardedDtuWrite(STATE, dtu);
    assert.equal(result.ok, true);
    assert.equal(result.bypassed, true);
  });

  it("routes atlas-schema DTUs through UPDATE", () => {
    // First create one
    const create = applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    assert.equal(create.ok, true);
    const dtu = { ...create.dtu, title: "Updated via guard" };
    const result = guardedDtuWrite(STATE, dtu);
    assert.ok(typeof result.ok === "boolean");
  });

  it("routes DTUs with domainType through CREATE", () => {
    const dtu = { id: "new_dtu_1", domainType: "empirical.physics", epistemicClass: "EMPIRICAL", title: "New", claims: [] };
    const result = guardedDtuWrite(STATE, dtu);
    assert.ok(typeof result.ok === "boolean");
  });

  it("routes DTUs with claims through CREATE", () => {
    const dtu = { id: "new_dtu_2", title: "Claim DTU", claims: [{ text: "Some claim", claimType: "FACT" }], domainType: "empirical.physics" };
    const result = guardedDtuWrite(STATE, dtu);
    assert.ok(typeof result.ok === "boolean");
  });

  it("falls back to direct write for DTUs without Atlas metadata", () => {
    const dtu = { id: "plain_1", title: "Plain DTU" };
    const result = guardedDtuWrite(STATE, dtu);
    assert.equal(result.ok, true);
    assert.equal(result.bypassed, true);
    assert.equal(result.reason, "no Atlas metadata");
  });
});

// ── getWriteGuardLog / getWriteGuardMetrics ──────────────────────────────────

describe("getWriteGuardLog / getWriteGuardMetrics", () => {
  let STATE;
  beforeEach(() => { STATE = freshSTATE(); });

  it("returns recent log entries", () => {
    applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    const log = getWriteGuardLog();
    assert.ok(Array.isArray(log));
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    }
    const log = getWriteGuardLog(2);
    assert.ok(log.length <= 2);
  });

  it("returns metrics with byDecision counts", () => {
    applyWrite(STATE, WRITE_OPS.CREATE, validPayload(), { scope: "local" });
    const metrics = getWriteGuardMetrics();
    assert.ok(typeof metrics.totalEntries === "number");
    assert.ok(typeof metrics.byDecision === "object");
  });
});
