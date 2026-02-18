/**
 * Route Smoke Tests — Validates all Atlas-layer route handlers
 * don't crash on minimal, empty, or malformed inputs.
 *
 * Not a full HTTP test — validates the function layer beneath routes.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { initAtlasState } from "../emergent/atlas-epistemic.js";
import { initScopeState, scopedWrite, getSubmission, listSubmissions, getDtuScope, getScopeMetrics, getLocalQualityHints } from "../emergent/atlas-scope-router.js";
import { applyWrite, WRITE_OPS, getWriteGuardLog, getWriteGuardMetrics } from "../emergent/atlas-write-guard.js";
import { retrieve, retrieveForChat, retrieveLabeled, retrieveFromScope } from "../emergent/atlas-retrieval.js";
import { chatRetrieve, saveAsDtu, getChatMetrics, recordChatExchange, getChatSession } from "../emergent/atlas-chat.js";
import { canUse, generateCitation, getOrigin, getRightsMetrics, computeContentHash } from "../emergent/atlas-rights.js";
import { tickLocal, tickGlobal, tickMarketplace, getHeartbeatMetrics } from "../emergent/atlas-heartbeat.js";
import { getInvariantMetrics, getInvariantLog } from "../emergent/atlas-invariants.js";
import { SCOPES } from "../emergent/atlas-config.js";

function makeTestState() {
  const STATE = { dtus: new Map(), shadowDtus: new Map(), sessions: new Map(), users: new Map(), orgs: new Map(), __emergent: null };
  initAtlasState(STATE);
  initScopeState(STATE);
  return STATE;
}

// Seed a valid DTU for tests that need one
function seedDtu(STATE) {
  return scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, {
    title: "Smoke test DTU",
    domainType: "empirical.physics",
    epistemicClass: "EMPIRICAL",
    tags: ["smoke"],
    claims: [{ claimType: "FACT", text: "Test claim", sources: [{ title: "Src", publisher: "Pub", url: "https://example.com", sourceTier: "PRIMARY" }] }],
    author: { userId: "smoke-user" },
  }, { actor: "smoke-user" });
}

// ── Retrieval endpoints ──────────────────────────────────────────────────────

describe("Smoke: Retrieval endpoints", () => {
  let STATE;
  before(() => { STATE = makeTestState(); });

  it("retrieve with LOCAL_THEN_GLOBAL policy returns ok", () => {
    const res = retrieve(STATE, "LOCAL_THEN_GLOBAL", "test");
    assert.equal(res.ok, true);
  });

  it("retrieveForChat returns ok", () => {
    const res = retrieveForChat(STATE, "test");
    assert.equal(res.ok, true);
  });

  it("retrieveLabeled returns ok", () => {
    const res = retrieveLabeled(STATE, "LOCAL_THEN_GLOBAL", "test");
    assert.equal(res.ok, true);
  });

  it("retrieveFromScope with local scope returns ok", () => {
    const res = retrieveFromScope(STATE, "local", "test");
    assert.equal(res.ok, true);
  });

  it("retrieve with INVALID_POLICY falls back gracefully", () => {
    const res = retrieve(STATE, "INVALID_POLICY", "test");
    assert.equal(res.ok, true);
  });
});

// ── Chat endpoints ───────────────────────────────────────────────────────────

describe("Smoke: Chat endpoints", () => {
  let STATE;
  before(() => { STATE = makeTestState(); });

  it("chatRetrieve returns ok", () => {
    const res = chatRetrieve(STATE, "hello");
    assert.equal(res.ok, true);
  });

  it("getChatMetrics returns ok", () => {
    const res = getChatMetrics(STATE);
    assert.equal(res.ok, true);
  });

  it("recordChatExchange returns ok", () => {
    const res = recordChatExchange(STATE, "s1", { query: "hi" });
    assert.equal(res.ok, true);
  });

  it("getChatSession for nonexistent session returns ok false without crash", () => {
    const res = getChatSession(STATE, "nonexistent");
    assert.equal(res.ok, false);
  });

  it("saveAsDtu with minimal content returns ok", () => {
    const res = saveAsDtu(STATE, { title: "smoke" }, { actor: "a" });
    assert.equal(res.ok, true);
  });
});

// ── Rights endpoints ─────────────────────────────────────────────────────────

describe("Smoke: Rights endpoints", () => {
  let STATE;
  before(() => { STATE = makeTestState(); });

  it("getRightsMetrics returns ok", () => {
    const res = getRightsMetrics(STATE);
    assert.equal(res.ok, true);
  });

  it("canUse with nonexistent artifact has allowed key", () => {
    const res = canUse(STATE, "u1", "nonexistent-id", "VIEW");
    assert.equal(typeof res.allowed, "boolean");
  });

  it("generateCitation for nonexistent artifact returns ok false without crash", () => {
    const res = generateCitation(STATE, "nonexistent-id");
    assert.equal(res.ok, false);
  });

  it("getOrigin for nonexistent artifact returns ok false without crash", () => {
    const res = getOrigin(STATE, "nonexistent-id");
    assert.equal(res.ok, false);
  });

  it("computeContentHash returns a 64-char hex string", () => {
    const hash = computeContentHash({ title: "test" });
    assert.equal(typeof hash, "string");
    assert.equal(hash.length, 64);
  });
});

// ── Scope & submission endpoints ─────────────────────────────────────────────

describe("Smoke: Scope & submission endpoints", () => {
  let STATE;
  before(() => { STATE = makeTestState(); });

  it("getScopeMetrics returns ok", () => {
    const res = getScopeMetrics(STATE);
    assert.equal(res.ok, true);
  });

  it("getDtuScope for nonexistent DTU returns local as default", () => {
    const scope = getDtuScope(STATE, "nonexistent");
    assert.equal(scope, "local");
  });

  it("getSubmission for nonexistent ID returns ok false", () => {
    const res = getSubmission(STATE, "nonexistent");
    assert.equal(res.ok, false);
  });

  it("listSubmissions returns ok with submissions array", () => {
    const res = listSubmissions(STATE);
    assert.equal(res.ok, true);
    assert.ok(Array.isArray(res.submissions));
  });

  it("getLocalQualityHints for nonexistent DTU returns ok false", () => {
    const res = getLocalQualityHints(STATE, "nonexistent");
    assert.equal(res.ok, false);
  });
});

// ── Heartbeat endpoints ──────────────────────────────────────────────────────

describe("Smoke: Heartbeat endpoints", () => {
  let STATE;
  before(() => { STATE = makeTestState(); });

  it("tickLocal does not throw", () => {
    assert.doesNotThrow(() => tickLocal(STATE));
  });

  it("tickGlobal does not throw", () => {
    assert.doesNotThrow(() => tickGlobal(STATE));
  });

  it("tickMarketplace does not throw", () => {
    assert.doesNotThrow(() => tickMarketplace(STATE));
  });

  it("getHeartbeatMetrics returns an object", () => {
    const res = getHeartbeatMetrics();
    assert.equal(typeof res, "object");
    assert.notEqual(res, null);
  });
});

// ── Write guard endpoints ────────────────────────────────────────────────────

describe("Smoke: Write guard endpoints", () => {
  let STATE;
  before(() => { STATE = makeTestState(); });

  it("getWriteGuardLog returns an array", () => {
    const log = getWriteGuardLog();
    assert.ok(Array.isArray(log));
  });

  it("getWriteGuardMetrics has totalEntries", () => {
    const metrics = getWriteGuardMetrics();
    assert.equal(typeof metrics.totalEntries, "number");
  });

  it("applyWrite with INVALID_OP returns ok false", () => {
    const res = applyWrite(STATE, "INVALID_OP", {}, {});
    assert.equal(res.ok, false);
  });

  it("applyWrite CREATE with empty payload returns ok false, not throw", () => {
    const res = applyWrite(STATE, "CREATE", {}, { scope: "local" });
    assert.equal(res.ok, false);
  });
});

// ── Invariant endpoints ──────────────────────────────────────────────────────

describe("Smoke: Invariant endpoints", () => {
  it("getInvariantMetrics returns an object", () => {
    const res = getInvariantMetrics();
    assert.equal(typeof res, "object");
    assert.notEqual(res, null);
  });

  it("getInvariantLog returns an array", () => {
    const log = getInvariantLog(10);
    assert.ok(Array.isArray(log));
  });
});

// ── Write + Read roundtrip ───────────────────────────────────────────────────

describe("Smoke: Write + Read roundtrip", () => {
  let STATE;
  before(() => { STATE = makeTestState(); });

  it("seed a DTU then retrieve it in a roundtrip", () => {
    const writeRes = seedDtu(STATE);
    assert.equal(writeRes.ok, true);
    assert.ok(writeRes.dtu, "seedDtu should return a dtu object");
    assert.ok(writeRes.dtu.id, "dtu should have an id");

    // Verify scope assignment
    const scope = getDtuScope(STATE, writeRes.dtu.id);
    assert.equal(scope, "local");

    // Verify retrieval returns the seeded DTU
    const readRes = retrieve(STATE, "LOCAL_THEN_GLOBAL", "Smoke");
    assert.equal(readRes.ok, true);
    assert.ok(readRes.results.length > 0, "retrieval should find the seeded DTU");

    const found = readRes.results.find(r => r.id === writeRes.dtu.id);
    assert.ok(found, "the seeded DTU should appear in retrieval results");
    assert.equal(found.title, "Smoke test DTU");
  });
});
