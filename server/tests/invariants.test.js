/**
 * Invariant Enforcement Tests — System physics that must never break.
 *
 * These tests verify that Concord's core invariants hold under all conditions.
 * If any of these fail, the system's integrity is compromised.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { initAtlasState, getAtlasState, ATLAS_STATUS } from "../emergent/atlas-epistemic.js";
import { initScopeState, scopedWrite, scopedRetrieve, createSubmission, getDtuScope, getScopeMetrics } from "../emergent/atlas-scope-router.js";
import { applyWrite, WRITE_OPS } from "../emergent/atlas-write-guard.js";
import { chatRetrieve, saveAsDtu, publishToGlobal } from "../emergent/atlas-chat.js";
import { canUse, validateDerivativeRights, getOrigin, verifyOriginIntegrity, resolveLicense, computeContentHash } from "../emergent/atlas-rights.js";
import { SCOPES, LICENSE_TYPES, RIGHTS_ACTIONS } from "../emergent/atlas-config.js";
import { retrieve } from "../emergent/atlas-retrieval.js";

function makeTestState() {
  const STATE = { dtus: new Map(), shadowDtus: new Map(), sessions: new Map(), users: new Map(), orgs: new Map(), __emergent: null };
  initAtlasState(STATE);
  initScopeState(STATE);
  return STATE;
}

function makeGoodDtu(overrides = {}) {
  return {
    title: "Invariant test DTU",
    domainType: "empirical.physics",
    epistemicClass: "EMPIRICAL",
    tags: ["test"],
    claims: [{ claimType: "FACT", text: "Water boils at 100C", sources: [{ title: "Chemistry", publisher: "Pub", url: "https://example.com", sourceTier: "PRIMARY" }, { title: "Physics", publisher: "Pub2", url: "https://example2.com", sourceTier: "PRIMARY" }, { title: "NIST", publisher: "Gov", url: "https://nist.gov", sourceTier: "SECONDARY" }], evidenceTier: "CORROBORATED" }],
    author: { userId: "test-user", display: "Test User" },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: No DTU mutation outside write guard
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: No DTU mutation outside write guard", () => {
  let STATE;
  let dtuId;

  before(() => {
    STATE = makeTestState();
    const result = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu(), { actor: "test-user" });
    assert.ok(result.ok, `DTU creation must succeed: ${result.error || "unknown"}`);
    dtuId = result.dtu.id;
  });

  it("DTU created via scopedWrite exists in atlas.dtus", () => {
    const atlas = getAtlasState(STATE);
    assert.ok(atlas.dtus.has(dtuId), "DTU must exist in atlas.dtus after scopedWrite");
    const dtu = atlas.dtus.get(dtuId);
    assert.equal(dtu.title, "Invariant test DTU");
  });

  it("DTU has _rights metadata (proves write guard + rights stamping ran)", () => {
    const atlas = getAtlasState(STATE);
    const dtu = atlas.dtus.get(dtuId);
    assert.ok(dtu._rights, "DTU must have _rights metadata after going through write guard");
    assert.ok(dtu._rights.content_hash, "_rights must include content_hash");
    assert.ok(dtu._rights.license_type, "_rights must include license_type");
    assert.ok(dtu._rights.origin_lane, "_rights must include origin_lane");
  });

  it("DTU has a proof-of-origin record via getOrigin", () => {
    const originResult = getOrigin(STATE, dtuId);
    assert.ok(originResult.ok, "getOrigin must return ok for a write-guard-created DTU");
    assert.equal(originResult.origin.artifact_id, dtuId);
    assert.ok(originResult.origin.content_hash, "Origin must have content_hash");
    assert.ok(originResult.origin.origin_fingerprint, "Origin must have origin_fingerprint");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: No cross-lane write without submission
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: No cross-lane write without submission", () => {
  let STATE;
  let localDtuId;

  before(() => {
    STATE = makeTestState();
    const result = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu(), { actor: "test-user" });
    assert.ok(result.ok, `Local DTU creation must succeed: ${result.error || "unknown"}`);
    localDtuId = result.dtu.id;
  });

  it("scopedWrite to GLOBAL with same payload creates a new DTU (different ID)", () => {
    const globalResult = scopedWrite(STATE, SCOPES.GLOBAL, WRITE_OPS.CREATE, makeGoodDtu(), { actor: "test-user" });
    assert.ok(globalResult.ok, `Global DTU creation must succeed: ${globalResult.error || "unknown"}`);
    assert.notEqual(globalResult.dtu.id, localDtuId, "Global write must create a new DTU, not reuse the local one");
  });

  it("original local DTU scope must NOT change when a global write occurs", () => {
    const scope = getDtuScope(STATE, localDtuId);
    assert.equal(scope, SCOPES.LOCAL, "Local DTU scope must remain 'local' after a separate global write");
  });

  it("createSubmission from local to global produces a PENDING submission", () => {
    const subResult = createSubmission(STATE, localDtuId, SCOPES.GLOBAL, "test-user");
    assert.ok(subResult.ok, `Submission creation must succeed: ${subResult.error || "unknown"}`);
    assert.equal(subResult.submission.status, "PENDING", "New submission must start as PENDING");
    assert.equal(subResult.submission.sourceScope, SCOPES.LOCAL);
    assert.equal(subResult.submission.targetScope, SCOPES.GLOBAL);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: VERIFIED status only through promotion gate
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: VERIFIED status only through promotion gate", () => {
  let STATE;
  let globalDtuId;

  before(() => {
    STATE = makeTestState();
    const result = scopedWrite(STATE, SCOPES.GLOBAL, WRITE_OPS.CREATE, makeGoodDtu(), { actor: "test-user" });
    assert.ok(result.ok, `Global DTU creation must succeed: ${result.error || "unknown"}`);
    globalDtuId = result.dtu.id;
  });

  it("global DTU initial status is DRAFT", () => {
    const atlas = getAtlasState(STATE);
    const dtu = atlas.dtus.get(globalDtuId);
    assert.equal(dtu.status, ATLAS_STATUS.DRAFT, "Global DTU must start as DRAFT");
  });

  it("directly mutating dtu.status does NOT bypass the atlas status index", () => {
    const atlas = getAtlasState(STATE);
    const dtu = atlas.dtus.get(globalDtuId);
    const originalStatus = dtu.status;

    // Simulate a rogue direct mutation
    dtu.status = "VERIFIED";

    // The atlas byStatus index still records the DTU under its original status
    const draftSet = atlas.byStatus.get(originalStatus);
    assert.ok(
      draftSet && draftSet.has(globalDtuId),
      "Atlas byStatus index must still track the DTU under its original status even if raw object is mutated"
    );

    // The VERIFIED index should NOT contain this DTU (since no proper promote ran)
    const verifiedSet = atlas.byStatus.get("VERIFIED");
    const inVerifiedIndex = verifiedSet ? verifiedSet.has(globalDtuId) : false;
    assert.equal(inVerifiedIndex, false, "DTU must NOT appear in VERIFIED index without going through promote");

    // Restore for subsequent tests
    dtu.status = originalStatus;
  });

  it("applyWrite PROMOTE to VERIFIED fails when DTU lacks sufficient scores/sources", () => {
    const promoteResult = applyWrite(STATE, WRITE_OPS.PROMOTE, {
      dtuId: globalDtuId,
      targetStatus: "VERIFIED",
    }, { scope: SCOPES.GLOBAL, actor: "test-user" });

    assert.equal(promoteResult.ok, false, "Promotion to VERIFIED must fail for under-qualified DTU");
    assert.ok(promoteResult.error, "Failed promotion must include an error message");

    // Verify the DTU is still DRAFT
    const atlas = getAtlasState(STATE);
    const dtu = atlas.dtus.get(globalDtuId);
    assert.equal(dtu.status, ATLAS_STATUS.DRAFT, "DTU must remain DRAFT after failed promotion");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: Chat path does NOT write
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: Chat path does NOT write", () => {
  let STATE;

  before(() => {
    STATE = makeTestState();
    // Seed a local DTU so chatRetrieve has something to search against
    scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu({ title: "Seed DTU for chat" }), { actor: "test-user" });
  });

  it("chatRetrieve called 10 times does not change DTU count", () => {
    const atlas = getAtlasState(STATE);
    const countBefore = atlas.dtus.size;

    const queries = [
      "water boiling", "physics", "chemistry", "boils",
      "temperature", "empirical", "test", "100C",
      "nist", "sources",
    ];

    for (const q of queries) {
      chatRetrieve(STATE, q);
    }

    const countAfter = atlas.dtus.size;
    assert.equal(countAfter, countBefore, "chatRetrieve must never create DTUs");
  });

  it("chatRetrieve does not produce any escalations", () => {
    // Reset chat state for a clean measurement
    STATE._chat = undefined;

    chatRetrieve(STATE, "water boiling");
    chatRetrieve(STATE, "physics test");
    chatRetrieve(STATE, "random query");

    const chatState = STATE._chat;
    assert.ok(chatState, "Chat state must be initialized after chatRetrieve");
    assert.equal(chatState.metrics.escalations, 0, "Chat retrieval must produce 0 escalations");
    assert.equal(chatState.metrics.savesAsDtu, 0, "Chat retrieval must produce 0 savesAsDtu");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: Marketplace listing requires rights metadata
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: Marketplace listing requires rights metadata", () => {
  let STATE;
  let localDtuId;

  before(() => {
    STATE = makeTestState();
    const result = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu(), { actor: "test-user" });
    assert.ok(result.ok);
    localDtuId = result.dtu.id;
  });

  it("createSubmission from local to MARKETPLACE fails (requires global first)", () => {
    const subResult = createSubmission(STATE, localDtuId, SCOPES.MARKETPLACE, "test-user");
    assert.equal(subResult.ok, false, "Local -> Marketplace submission must fail");
    assert.ok(
      subResult.error.includes("Global") || subResult.error.includes("global"),
      `Error must mention Global requirement, got: "${subResult.error}"`
    );
  });

  it("every DTU created through write guard has _rights with content_hash, license_type, origin_lane", () => {
    // Create DTUs in different scopes and verify all have rights metadata
    const localResult = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu({ title: "Rights check local" }), { actor: "alice" });
    const globalResult = scopedWrite(STATE, SCOPES.GLOBAL, WRITE_OPS.CREATE, makeGoodDtu({ title: "Rights check global" }), { actor: "alice" });

    for (const result of [localResult, globalResult]) {
      assert.ok(result.ok, `DTU creation must succeed: ${result.error || "unknown"}`);
      const dtu = result.dtu;
      assert.ok(dtu._rights, `DTU "${dtu.title}" must have _rights property`);
      assert.ok(dtu._rights.content_hash, `DTU "${dtu.title}" must have _rights.content_hash`);
      assert.ok(dtu._rights.license_type, `DTU "${dtu.title}" must have _rights.license_type`);
      assert.ok(dtu._rights.origin_lane, `DTU "${dtu.title}" must have _rights.origin_lane`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: Submissions are immutable
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: Submissions are immutable", () => {
  let STATE;
  let submission;

  before(() => {
    STATE = makeTestState();
    const result = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu(), { actor: "test-user" });
    assert.ok(result.ok);
    const subResult = createSubmission(STATE, result.dtu.id, SCOPES.GLOBAL, "test-user");
    assert.ok(subResult.ok, `Submission creation must succeed: ${subResult.error || "unknown"}`);
    submission = subResult.submission;
  });

  it("submission.payload is frozen (Object.isFrozen)", () => {
    assert.ok(Object.isFrozen(submission.payload), "Submission payload must be frozen at creation");

    // Attempting to add a property should silently fail or throw in strict mode
    assert.throws(() => {
      "use strict";
      submission.payload.injected = "hacked";
    }, "Modifying a frozen payload must throw in strict mode");
  });

  it("submission has payloadHash and _sealed flag", () => {
    assert.ok(submission.payloadHash, "Submission must have payloadHash");
    assert.equal(typeof submission.payloadHash, "string", "payloadHash must be a string");
    assert.ok(submission.payloadHash.length > 0, "payloadHash must be non-empty");
    assert.equal(submission._sealed, true, "Submission must have _sealed === true");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: Rights enforcement blocks unauthorized actions
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: Rights enforcement blocks unauthorized actions", () => {
  let STATE;

  before(() => {
    STATE = makeTestState();
  });

  it("local DTU by alice: canUse(bob, VIEW) must be false (local scope, non-owner)", () => {
    const result = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu({
      author: { userId: "alice", display: "Alice" },
    }), { actor: "alice" });
    assert.ok(result.ok);

    const check = canUse(STATE, "bob", result.dtu.id, RIGHTS_ACTIONS.VIEW);
    assert.equal(check.allowed, false, "Bob must NOT be able to VIEW Alice's local DTU");
  });

  it("global DTU by alice with MARKET_EXCLUSIVE: canUse(bob, DERIVE) must be false", () => {
    const result = scopedWrite(STATE, SCOPES.GLOBAL, WRITE_OPS.CREATE, makeGoodDtu({
      author: { userId: "alice", display: "Alice" },
      license_type: LICENSE_TYPES.MARKET_EXCLUSIVE,
    }), { actor: "alice" });
    assert.ok(result.ok);

    const check = canUse(STATE, "bob", result.dtu.id, RIGHTS_ACTIONS.DERIVE);
    assert.equal(check.allowed, false, "Bob must NOT be able to DERIVE from a MARKET_EXCLUSIVE DTU");
  });

  it("global DTU by alice (default ATTRIBUTION_OPEN): canUse(bob, DERIVE) must be true", () => {
    const result = scopedWrite(STATE, SCOPES.GLOBAL, WRITE_OPS.CREATE, makeGoodDtu({
      author: { userId: "alice", display: "Alice" },
      // No explicit license_type => defaults to CONCORD_ATTRIBUTION_OPEN for global
    }), { actor: "alice" });
    assert.ok(result.ok);

    const check = canUse(STATE, "bob", result.dtu.id, RIGHTS_ACTIONS.DERIVE);
    assert.equal(check.allowed, true, "Bob must be able to DERIVE from an ATTRIBUTION_OPEN global DTU");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: Origin integrity holds for unmodified DTUs
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: Origin integrity holds for unmodified DTUs", () => {
  let STATE;
  let dtu;

  before(() => {
    STATE = makeTestState();
    const result = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu(), { actor: "test-user" });
    assert.ok(result.ok);
    dtu = result.dtu;
  });

  it("verifyOriginIntegrity returns intact: true for unmodified DTU", () => {
    const integrity = verifyOriginIntegrity(STATE, dtu);
    assert.ok(integrity.ok, "verifyOriginIntegrity must return ok");
    assert.equal(integrity.intact, true, "Unmodified DTU must pass integrity check");
    assert.equal(integrity.origin_hash, integrity.current_hash, "Origin hash must match current hash");
  });

  it("origin.content_hash matches computeContentHash of the DTU", () => {
    const originResult = getOrigin(STATE, dtu.id);
    assert.ok(originResult.ok);

    const directHash = computeContentHash(dtu);
    assert.equal(
      originResult.origin.content_hash,
      directHash,
      "Origin content_hash must match directly computed hash"
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invariant: Lane-aware license defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe("Invariant: Lane-aware license defaults", () => {
  let STATE;

  before(() => {
    STATE = makeTestState();
  });

  it("local DTU without explicit license gets CONCORD_PERSONAL", () => {
    const result = scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, makeGoodDtu({
      // No license_type specified
    }), { actor: "test-user" });
    assert.ok(result.ok);

    assert.equal(
      result.dtu._rights.license_type,
      LICENSE_TYPES.PERSONAL,
      "Local DTU default license must be CONCORD_PERSONAL"
    );
  });

  it("global DTU without explicit license gets CONCORD_ATTRIBUTION_OPEN", () => {
    const result = scopedWrite(STATE, SCOPES.GLOBAL, WRITE_OPS.CREATE, makeGoodDtu({
      // No license_type specified
    }), { actor: "test-user" });
    assert.ok(result.ok);

    assert.equal(
      result.dtu._rights.license_type,
      LICENSE_TYPES.ATTRIBUTION_OPEN,
      "Global DTU default license must be CONCORD_ATTRIBUTION_OPEN"
    );
  });

  it("DTU with explicit CONCORD_NONCOMMERCIAL keeps that license (not overridden)", () => {
    const result = scopedWrite(STATE, SCOPES.GLOBAL, WRITE_OPS.CREATE, makeGoodDtu({
      license_type: LICENSE_TYPES.NONCOMMERCIAL,
    }), { actor: "test-user" });
    assert.ok(result.ok);

    assert.equal(
      result.dtu._rights.license_type,
      LICENSE_TYPES.NONCOMMERCIAL,
      "Explicit CONCORD_NONCOMMERCIAL must not be overridden by lane default"
    );
  });
});
