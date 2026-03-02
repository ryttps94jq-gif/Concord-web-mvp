/**
 * Tests for atlas-invariants.js — Runtime invariant monitor.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  assertInvariant,
  assertSoft,
  assertTyped,
  assertClaimLanes,
  assertNoCitedFactGaps,
  assertPromoteGateOnly,
  assertNoCycle,
  assertNotDuplicate,
  assertModelAssumptions,
  assertInterpretationNoFactualBoost,
  getInvariantMetrics,
  getInvariantLog,
  resetInvariantMetrics,
} from "../emergent/atlas-invariants.js";

// ── Reset before each test ────────────────────────────────────────────────────

describe("atlas-invariants", () => {
  beforeEach(() => {
    resetInvariantMetrics();
  });

  // ── assertInvariant ──────────────────────────────────────────────────────

  describe("assertInvariant", () => {
    it("passes when condition is true", () => {
      const result = assertInvariant("TEST_PASS", true, { dtuId: "d1" });
      assert.deepStrictEqual(result, { ok: true, name: "TEST_PASS" });
    });

    it("throws on failure with hardGate=true", () => {
      assert.throws(
        () => assertInvariant("TEST_FAIL", false, { dtuId: "d1" }, true),
        (err) => {
          assert.equal(err.invariantName, "TEST_FAIL");
          assert.deepStrictEqual(err.invariantMeta, { dtuId: "d1" });
          return true;
        }
      );
    });

    it("returns failure without throwing when hardGate=false", () => {
      const result = assertInvariant("TEST_SOFT", false, {}, false);
      assert.deepStrictEqual(result, { ok: false, name: "TEST_SOFT" });
    });

    it("increments metrics on pass", () => {
      assertInvariant("X", true);
      const m = getInvariantMetrics();
      assert.equal(m.totalAssertions, 1);
      assert.equal(m.passed, 1);
      assert.equal(m.failed, 0);
    });

    it("increments metrics on fail (soft)", () => {
      assertInvariant("Y", false, {}, false);
      const m = getInvariantMetrics();
      assert.equal(m.failed, 1);
      assert.equal(m.thrown, 0);
    });

    it("increments thrown on fail (hard)", () => {
      try { assertInvariant("Z", false, {}, true); } catch { /* expected */ }
      const m = getInvariantMetrics();
      assert.equal(m.failed, 1);
      assert.equal(m.thrown, 1);
    });

    it("tracks per-name counts", () => {
      assertInvariant("A", true);
      assertInvariant("A", true);
      assertInvariant("A", false, {}, false);
      const m = getInvariantMetrics();
      assert.equal(m.byName.A.pass, 2);
      assert.equal(m.byName.A.fail, 1);
    });

    it("logs failures", () => {
      assertInvariant("LOGGED", false, { detail: "x" }, false);
      const log = getInvariantLog();
      assert.equal(log.length, 1);
      assert.equal(log[0].name, "LOGGED");
      assert.equal(log[0].ok, false);
    });

    it("treats truthy values as passing", () => {
      const r1 = assertInvariant("T1", 1, {}, false);
      assert.equal(r1.ok, true);
      const r2 = assertInvariant("T2", "yes", {}, false);
      assert.equal(r2.ok, true);
    });

    it("treats falsy values (0, empty, null, undefined) as failing", () => {
      const r1 = assertInvariant("F1", 0, {}, false);
      assert.equal(r1.ok, false);
      const r2 = assertInvariant("F2", "", {}, false);
      assert.equal(r2.ok, false);
      const r3 = assertInvariant("F3", null, {}, false);
      assert.equal(r3.ok, false);
      const r4 = assertInvariant("F4", undefined, {}, false);
      assert.equal(r4.ok, false);
    });
  });

  // ── assertSoft ───────────────────────────────────────────────────────────

  describe("assertSoft", () => {
    it("never throws on failure", () => {
      const result = assertSoft("SOFT_TEST", false, { detail: "test" });
      assert.equal(result.ok, false);
      assert.equal(result.name, "SOFT_TEST");
    });

    it("returns ok on pass", () => {
      const result = assertSoft("SOFT_PASS", true);
      assert.equal(result.ok, true);
    });
  });

  // ── assertTyped ──────────────────────────────────────────────────────────

  describe("assertTyped", () => {
    it("passes when DTU has domainType, epistemicClass, and schemaVersion", () => {
      const dtu = { id: "d1", domainType: "empirical.physics", epistemicClass: "EMPIRICAL", schemaVersion: "atlas-1.0" };
      const result = assertTyped(dtu, false);
      assert.equal(result.ok, true);
    });

    it("fails when domainType is missing", () => {
      const dtu = { id: "d1", epistemicClass: "EMPIRICAL", schemaVersion: "atlas-1.0" };
      const result = assertTyped(dtu, false);
      assert.equal(result.ok, false);
    });

    it("fails when epistemicClass is missing", () => {
      const dtu = { id: "d1", domainType: "empirical.physics", schemaVersion: "atlas-1.0" };
      const result = assertTyped(dtu, false);
      assert.equal(result.ok, false);
    });

    it("fails when schemaVersion is missing", () => {
      const dtu = { id: "d1", domainType: "empirical.physics", epistemicClass: "EMPIRICAL" };
      const result = assertTyped(dtu, false);
      assert.equal(result.ok, false);
    });

    it("throws in hard mode on failure", () => {
      const dtu = { id: "d1" };
      assert.throws(() => assertTyped(dtu, true));
    });
  });

  // ── assertClaimLanes ─────────────────────────────────────────────────────

  describe("assertClaimLanes", () => {
    it("passes when claims are in separate lanes", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "FACT" },
          { claimId: "c2", claimType: "INTERPRETATION" },
        ],
      };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, true);
    });

    it("fails when duplicate claimId across lanes", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "FACT" },
          { claimId: "c1", claimType: "INTERPRETATION" },
        ],
      };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, false);
    });

    it("fails when INTERPRETATION has PROVEN evidenceTier", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "INTERPRETATION", evidenceTier: "PROVEN" },
        ],
      };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, false);
    });

    it("fails when INTERPRETATION has CORROBORATED evidenceTier", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "INTERPRETATION", evidenceTier: "CORROBORATED" },
        ],
      };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, false);
    });

    it("passes with empty claims", () => {
      const dtu = { id: "d1", claims: [] };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, true);
    });

    it("passes with no claims property", () => {
      const dtu = { id: "d1" };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, true);
    });

    it("classifies MODEL_OUTPUT and HYPOTHESIS as model claims", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "MODEL_OUTPUT" },
          { claimId: "c2", claimType: "HYPOTHESIS" },
        ],
      };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, true);
    });

    it("classifies RECEPTION as interpretive claim", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "RECEPTION", evidenceTier: "SUPPORTED" },
        ],
      };
      const result = assertClaimLanes(dtu, false);
      assert.equal(result.ok, true);
    });
  });

  // ── assertNoCitedFactGaps ─────────────────────────────────────────────────

  describe("assertNoCitedFactGaps", () => {
    it("passes when all FACT claims have sources", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "FACT", sources: [{ url: "http://a.com" }] },
        ],
      };
      const result = assertNoCitedFactGaps(dtu, false);
      assert.equal(result.ok, true);
    });

    it("fails when FACT claims have no sources", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "FACT", sources: [] },
        ],
      };
      const result = assertNoCitedFactGaps(dtu, false);
      assert.equal(result.ok, false);
    });

    it("fails when SPEC claims have no sources", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "SPEC" },
        ],
      };
      const result = assertNoCitedFactGaps(dtu, false);
      assert.equal(result.ok, false);
    });

    it("passes when no FACT or SPEC claims exist", () => {
      const dtu = {
        id: "d1",
        claims: [
          { claimId: "c1", claimType: "INTERPRETATION" },
        ],
      };
      const result = assertNoCitedFactGaps(dtu, false);
      assert.equal(result.ok, true);
    });

    it("passes with empty claims array", () => {
      const dtu = { id: "d1", claims: [] };
      const result = assertNoCitedFactGaps(dtu, false);
      assert.equal(result.ok, true);
    });
  });

  // ── assertPromoteGateOnly ─────────────────────────────────────────────────

  describe("assertPromoteGateOnly", () => {
    it("passes for atlas.status.promote actor", () => {
      const result = assertPromoteGateOnly("atlas.status.promote", false);
      assert.equal(result.ok, true);
    });

    it("passes for auto_promote_gate actor", () => {
      const result = assertPromoteGateOnly("auto_promote_gate", false);
      assert.equal(result.ok, true);
    });

    it("fails for any other actor", () => {
      const result = assertPromoteGateOnly("some_user", false);
      assert.equal(result.ok, false);
    });

    it("fails for council actor", () => {
      const result = assertPromoteGateOnly("council", false);
      assert.equal(result.ok, false);
    });
  });

  // ── assertNoCycle ─────────────────────────────────────────────────────────

  describe("assertNoCycle", () => {
    it("passes when hasCycle is false", () => {
      const result = assertNoCycle(false, "d1", false);
      assert.equal(result.ok, true);
    });

    it("fails when hasCycle is true", () => {
      const result = assertNoCycle(true, "d1", false);
      assert.equal(result.ok, false);
    });
  });

  // ── assertNotDuplicate ────────────────────────────────────────────────────

  describe("assertNotDuplicate", () => {
    it("passes when similarity is below threshold", () => {
      const result = assertNotDuplicate(0.5, 0.65, "d1", false);
      assert.equal(result.ok, true);
    });

    it("fails when similarity is at threshold", () => {
      const result = assertNotDuplicate(0.65, 0.65, "d1", false);
      assert.equal(result.ok, false);
    });

    it("fails when similarity is above threshold", () => {
      const result = assertNotDuplicate(0.9, 0.65, "d1", false);
      assert.equal(result.ok, false);
    });
  });

  // ── assertModelAssumptions ────────────────────────────────────────────────

  describe("assertModelAssumptions", () => {
    it("passes for non-MODEL DTUs regardless of assumptions", () => {
      const dtu = { id: "d1", epistemicClass: "EMPIRICAL" };
      const result = assertModelAssumptions(dtu, false);
      assert.equal(result.ok, true);
      assert.equal(result.name, "MODEL_HAS_ASSUMPTIONS");
    });

    it("passes for MODEL DTU with assumptions", () => {
      const dtu = { id: "d1", epistemicClass: "MODEL", assumptions: [{ text: "linear growth" }] };
      const result = assertModelAssumptions(dtu, false);
      assert.equal(result.ok, true);
    });

    it("fails for MODEL DTU without assumptions", () => {
      const dtu = { id: "d1", epistemicClass: "MODEL", assumptions: [] };
      const result = assertModelAssumptions(dtu, false);
      assert.equal(result.ok, false);
    });

    it("fails for MODEL DTU with no assumptions property", () => {
      const dtu = { id: "d1", epistemicClass: "MODEL" };
      const result = assertModelAssumptions(dtu, false);
      assert.equal(result.ok, false);
    });
  });

  // ── assertInterpretationNoFactualBoost ────────────────────────────────────

  describe("assertInterpretationNoFactualBoost", () => {
    it("passes for non-supports link type", () => {
      const result = assertInterpretationNoFactualBoost("contradicts", {}, {}, false);
      assert.equal(result.ok, true);
    });

    it("passes when source is not interpretive", () => {
      const srcDtu = { epistemicClass: "EMPIRICAL", claims: [{ claimType: "FACT" }] };
      const targetDtu = { claims: [{ claimType: "FACT" }] };
      const result = assertInterpretationNoFactualBoost("supports", srcDtu, targetDtu, false);
      assert.equal(result.ok, true);
    });

    it("fails when interpretive source supports factual target", () => {
      const srcDtu = {
        id: "s1",
        epistemicClass: "INTERPRETIVE",
        claims: [{ claimType: "INTERPRETATION" }],
      };
      const targetDtu = {
        id: "t1",
        claims: [{ claimType: "FACT" }],
      };
      const result = assertInterpretationNoFactualBoost("supports", srcDtu, targetDtu, false);
      assert.equal(result.ok, false);
    });

    it("passes when interpretive source supports non-factual target", () => {
      const srcDtu = {
        id: "s1",
        epistemicClass: "INTERPRETIVE",
        claims: [{ claimType: "INTERPRETATION" }],
      };
      const targetDtu = {
        id: "t1",
        claims: [{ claimType: "INTERPRETATION" }],
      };
      const result = assertInterpretationNoFactualBoost("supports", srcDtu, targetDtu, false);
      assert.equal(result.ok, true);
    });

    it("detects all-INTERPRETATION claims as interpretive source", () => {
      const srcDtu = {
        id: "s1",
        epistemicClass: "EMPIRICAL",
        claims: [
          { claimType: "INTERPRETATION" },
          { claimType: "RECEPTION" },
        ],
      };
      const targetDtu = {
        id: "t1",
        claims: [{ claimType: "SPEC" }],
      };
      const result = assertInterpretationNoFactualBoost("supports", srcDtu, targetDtu, false);
      assert.equal(result.ok, false);
    });
  });

  // ── Metrics + Log ────────────────────────────────────────────────────────

  describe("getInvariantMetrics", () => {
    it("returns zero counts after reset", () => {
      const m = getInvariantMetrics();
      assert.equal(m.totalAssertions, 0);
      assert.equal(m.passed, 0);
      assert.equal(m.failed, 0);
      assert.equal(m.thrown, 0);
      assert.deepStrictEqual(m.byName, {});
    });

    it("accumulates across multiple calls", () => {
      assertInvariant("A", true);
      assertInvariant("B", false, {}, false);
      assertInvariant("A", true);
      const m = getInvariantMetrics();
      assert.equal(m.totalAssertions, 3);
      assert.equal(m.passed, 2);
      assert.equal(m.failed, 1);
    });
  });

  describe("getInvariantLog", () => {
    it("returns empty after reset", () => {
      assert.deepStrictEqual(getInvariantLog(), []);
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        assertInvariant(`FAIL_${i}`, false, {}, false);
      }
      const log = getInvariantLog(3);
      assert.equal(log.length, 3);
    });

    it("default limit is 100", () => {
      for (let i = 0; i < 5; i++) {
        assertInvariant(`FAIL_${i}`, false, {}, false);
      }
      const log = getInvariantLog();
      assert.equal(log.length, 5);
    });
  });

  describe("resetInvariantMetrics", () => {
    it("clears everything", () => {
      assertInvariant("X", true);
      assertInvariant("Y", false, {}, false);
      resetInvariantMetrics();
      const m = getInvariantMetrics();
      assert.equal(m.totalAssertions, 0);
      assert.deepStrictEqual(getInvariantLog(), []);
    });
  });
});
