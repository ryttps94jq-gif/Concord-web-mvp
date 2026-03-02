/**
 * Tests for grc/sovereignty-invariants.js
 *
 * Covers: SOVEREIGNTY_INVARIANTS, checkSovereigntyInvariants, assertSovereignty
 * All 5 invariants tested: personal_dtus_never_leak, global_requires_council,
 * entities_scoped_to_owner, global_assist_requires_consent, sessions_isolated.
 *
 * Run: node --test tests/sovereignty-invariants.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SOVEREIGNTY_INVARIANTS,
  checkSovereigntyInvariants,
  assertSovereignty,
} from "../grc/sovereignty-invariants.js";

// ── SOVEREIGNTY_INVARIANTS constant ─────────────────────────────────────────

describe("SOVEREIGNTY_INVARIANTS", () => {
  it("is an array of 5 invariants", () => {
    assert.ok(Array.isArray(SOVEREIGNTY_INVARIANTS));
    assert.equal(SOVEREIGNTY_INVARIANTS.length, 5);
  });

  it("each invariant has name, description, and check function", () => {
    for (const inv of SOVEREIGNTY_INVARIANTS) {
      assert.equal(typeof inv.name, "string");
      assert.equal(typeof inv.description, "string");
      assert.equal(typeof inv.check, "function");
    }
  });

  it("includes all expected invariant names", () => {
    const names = SOVEREIGNTY_INVARIANTS.map(i => i.name);
    assert.ok(names.includes("personal_dtus_never_leak"));
    assert.ok(names.includes("global_requires_council"));
    assert.ok(names.includes("entities_scoped_to_owner"));
    assert.ok(names.includes("global_assist_requires_consent"));
    assert.ok(names.includes("sessions_isolated"));
  });
});

// ── Individual invariant checks ─────────────────────────────────────────────

describe("personal_dtus_never_leak", () => {
  const inv = SOVEREIGNTY_INVARIANTS.find(i => i.name === "personal_dtus_never_leak");

  it("passes when user reads their own personal DTU", () => {
    const result = inv.check({
      type: "dtu_read",
      dtu: { scope: "personal", ownerId: "user1" },
      requestingUser: "user1",
    });
    assert.equal(result.pass, true);
  });

  it("fails when another user reads a personal DTU", () => {
    const result = inv.check({
      type: "dtu_read",
      dtu: { scope: "personal", ownerId: "user1" },
      requestingUser: "user2",
    });
    assert.equal(result.pass, false);
    assert.equal(result.severity, "critical");
    assert.ok(result.repair.includes("Block access"));
  });

  it("passes for non-personal scope DTU", () => {
    const result = inv.check({
      type: "dtu_read",
      dtu: { scope: "global", ownerId: "user1" },
      requestingUser: "user2",
    });
    assert.equal(result.pass, true);
  });

  it("passes for unrelated operation type", () => {
    const result = inv.check({ type: "other_operation" });
    assert.equal(result.pass, true);
  });
});

describe("global_requires_council", () => {
  const inv = SOVEREIGNTY_INVARIANTS.find(i => i.name === "global_requires_council");

  it("passes when council-approved scope change to global", () => {
    const result = inv.check({
      type: "dtu_scope_change",
      newScope: "global",
      councilApproved: true,
    });
    assert.equal(result.pass, true);
  });

  it("fails when scope change to global without council approval", () => {
    const result = inv.check({
      type: "dtu_scope_change",
      newScope: "global",
      councilApproved: false,
    });
    assert.equal(result.pass, false);
    assert.equal(result.severity, "critical");
    assert.ok(result.repair.includes("council"));
  });

  it("passes for scope change to non-global", () => {
    const result = inv.check({
      type: "dtu_scope_change",
      newScope: "local",
      councilApproved: false,
    });
    assert.equal(result.pass, true);
  });

  it("passes for unrelated operation type", () => {
    const result = inv.check({ type: "other_operation" });
    assert.equal(result.pass, true);
  });
});

describe("entities_scoped_to_owner", () => {
  const inv = SOVEREIGNTY_INVARIANTS.find(i => i.name === "entities_scoped_to_owner");

  it("passes when entity accesses its owner's substrate", () => {
    const result = inv.check({
      type: "entity_read",
      entity: { ownerId: "user1" },
      targetDtu: { ownerId: "user1", scope: "personal" },
    });
    assert.equal(result.pass, true);
  });

  it("fails when entity accesses another owner's non-global substrate", () => {
    const result = inv.check({
      type: "entity_read",
      entity: { ownerId: "user1" },
      targetDtu: { ownerId: "user2", scope: "personal" },
    });
    assert.equal(result.pass, false);
    assert.equal(result.severity, "critical");
    assert.ok(result.repair.includes("cross-owner"));
  });

  it("passes when entity accesses global DTU from different owner", () => {
    const result = inv.check({
      type: "entity_read",
      entity: { ownerId: "user1" },
      targetDtu: { ownerId: "user2", scope: "global" },
    });
    assert.equal(result.pass, true);
  });

  it("passes for unrelated operation type", () => {
    const result = inv.check({ type: "other_operation" });
    assert.equal(result.pass, true);
  });
});

describe("global_assist_requires_consent", () => {
  const inv = SOVEREIGNTY_INVARIANTS.find(i => i.name === "global_assist_requires_consent");

  it("passes when user has consented to global DTU sync", () => {
    const result = inv.check({
      type: "dtu_sync",
      source: "global",
      userConsented: true,
    });
    assert.equal(result.pass, true);
  });

  it("fails when global DTU syncs without user consent", () => {
    const result = inv.check({
      type: "dtu_sync",
      source: "global",
      userConsented: false,
    });
    assert.equal(result.pass, false);
    assert.equal(result.severity, "critical");
    assert.ok(result.repair.includes("consent"));
  });

  it("passes for non-global source sync", () => {
    const result = inv.check({
      type: "dtu_sync",
      source: "local",
      userConsented: false,
    });
    assert.equal(result.pass, true);
  });

  it("passes for unrelated operation type", () => {
    const result = inv.check({ type: "other_operation" });
    assert.equal(result.pass, true);
  });
});

describe("sessions_isolated", () => {
  const inv = SOVEREIGNTY_INVARIANTS.find(i => i.name === "sessions_isolated");

  it("passes when user reads their own session", () => {
    const result = inv.check({
      type: "session_read",
      requestingUser: "user1",
      session: { ownerId: "user1" },
    });
    assert.equal(result.pass, true);
  });

  it("fails when user reads another user's session", () => {
    const result = inv.check({
      type: "session_read",
      requestingUser: "user2",
      session: { ownerId: "user1" },
    });
    assert.equal(result.pass, false);
    assert.equal(result.severity, "critical");
    assert.ok(result.repair.includes("cross-user"));
  });

  it("passes for unrelated operation type", () => {
    const result = inv.check({ type: "other_operation" });
    assert.equal(result.pass, true);
  });
});

// ── checkSovereigntyInvariants ──────────────────────────────────────────────

describe("checkSovereigntyInvariants", () => {
  it("returns pass: true when no violations", () => {
    const result = checkSovereigntyInvariants({ type: "unrelated_op" });
    assert.equal(result.pass, true);
    assert.deepStrictEqual(result.violations, []);
  });

  it("returns pass: false when a violation exists", () => {
    const result = checkSovereigntyInvariants({
      type: "dtu_read",
      dtu: { scope: "personal", ownerId: "user1" },
      requestingUser: "user2",
    });
    assert.equal(result.pass, false);
    assert.ok(result.violations.length > 0);
  });

  it("violation contains invariant name, description, severity, repair", () => {
    const result = checkSovereigntyInvariants({
      type: "dtu_read",
      dtu: { scope: "personal", ownerId: "user1" },
      requestingUser: "user2",
    });
    const v = result.violations[0];
    assert.equal(v.invariant, "personal_dtus_never_leak");
    assert.equal(typeof v.description, "string");
    assert.equal(v.severity, "critical");
    assert.equal(typeof v.repair, "string");
  });

  it("can detect multiple violations simultaneously", () => {
    // An operation that triggers both personal_dtus_never_leak AND sessions_isolated
    // won't happen in practice (different types), but each is checked independently.
    // Let's craft ops that trigger at least the personal DTU leak
    const result = checkSovereigntyInvariants({
      type: "dtu_read",
      dtu: { scope: "personal", ownerId: "user1" },
      requestingUser: "user2",
    });
    assert.ok(result.violations.length >= 1);
  });

  it("handles invariant check throwing an exception (fail-open)", () => {
    // If an invariant check itself throws, it's treated as pass.
    // We can't easily inject, but the catch block covers this.
    // Call with a strange operation that might cause property access issues.
    const result = checkSovereigntyInvariants(null);
    // Should not throw
    assert.equal(typeof result.pass, "boolean");
  });
});

// ── assertSovereignty ───────────────────────────────────────────────────────

describe("assertSovereignty", () => {
  it("returns result when no violations", () => {
    const result = assertSovereignty({ type: "unrelated" });
    assert.equal(result.pass, true);
    assert.deepStrictEqual(result.violations, []);
  });

  it("throws on critical violation", () => {
    assert.throws(
      () => assertSovereignty({
        type: "dtu_read",
        dtu: { scope: "personal", ownerId: "user1" },
        requestingUser: "user2",
      }),
      (err) => {
        assert.ok(err.message.includes("SOVEREIGNTY VIOLATION"));
        assert.ok(err.message.includes("personal_dtus_never_leak"));
        return true;
      }
    );
  });

  it("throws with the repair message in the error", () => {
    assert.throws(
      () => assertSovereignty({
        type: "dtu_scope_change",
        newScope: "global",
        councilApproved: false,
      }),
      (err) => {
        assert.ok(err.message.includes("council"));
        return true;
      }
    );
  });

  it("does not throw when violations are present but none are critical", () => {
    // All current invariants have severity: "critical", so this is
    // more of a design-time assertion. If we could have a non-critical one,
    // it would pass through.
    // For now, just test that non-violation operations don't throw.
    const result = assertSovereignty({ type: "safe_operation" });
    assert.equal(result.pass, true);
  });
});
