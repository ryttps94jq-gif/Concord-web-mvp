/**
 * Tests for emergent/threat-surface.js — Threat Surface Hardening
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createEmergentState } from "../emergent/store.js";

import {
  COST_TIERS,
  ALL_COST_TIERS,
  getThreatStore,
  registerRouteCost,
  registerRouteCosts,
  getRouteCost,
  checkRateLimit,
  checkCostBudget,
  auditEndpoints,
  analyzeUserActivity,
  blockUser,
  unblockUser,
  updateThreatConfig,
  getThreatMetrics,
} from "../emergent/threat-surface.js";

function makeSTATE() {
  const STATE = {};
  createEmergentState(STATE);
  return STATE;
}

describe("threat-surface", () => {
  let STATE;

  beforeEach(() => {
    STATE = makeSTATE();
  });

  // ── Constants ─────────────────────────────────────────────────────────

  describe("constants", () => {
    it("COST_TIERS has expected values", () => {
      assert.equal(COST_TIERS.FREE, "free");
      assert.equal(COST_TIERS.CHEAP, "cheap");
      assert.equal(COST_TIERS.MODERATE, "moderate");
      assert.equal(COST_TIERS.EXPENSIVE, "expensive");
      assert.equal(COST_TIERS.CRITICAL, "critical");
    });

    it("ALL_COST_TIERS is frozen array", () => {
      assert.ok(Object.isFrozen(ALL_COST_TIERS));
      assert.equal(ALL_COST_TIERS.length, 5);
    });
  });

  // ── getThreatStore ────────────────────────────────────────────────────

  describe("getThreatStore", () => {
    it("initializes threat store on first call", () => {
      const store = getThreatStore(STATE);
      assert.ok(store);
      assert.ok(store.routeRegistry instanceof Map);
      assert.ok(store.userRates instanceof Map);
      assert.ok(store.blockedUsers instanceof Map);
      assert.ok(store.config);
    });

    it("returns same store on subsequent calls", () => {
      const a = getThreatStore(STATE);
      const b = getThreatStore(STATE);
      assert.equal(a, b);
    });
  });

  // ── registerRouteCost ─────────────────────────────────────────────────

  describe("registerRouteCost", () => {
    it("registers a route", () => {
      const r = registerRouteCost(STATE, "test.route", "cheap");
      assert.equal(r.ok, true);
    });

    it("rejects invalid tier", () => {
      const r = registerRouteCost(STATE, "test.route", "invalid_tier");
      assert.equal(r.ok, false);
      assert.equal(r.error, "invalid_cost_tier");
    });

    it("stores description and public flag", () => {
      registerRouteCost(STATE, "test.route", "expensive", { description: "Test", public: true });
      const store = getThreatStore(STATE);
      const entry = store.routeRegistry.get("test.route");
      assert.equal(entry.description, "Test");
      assert.equal(entry.public, true);
    });
  });

  // ── registerRouteCosts ────────────────────────────────────────────────

  describe("registerRouteCosts", () => {
    it("bulk registers routes", () => {
      const r = registerRouteCosts(STATE, {
        "route.a": "cheap",
        "route.b": "expensive",
        "route.c": "invalid_tier",
      });
      assert.equal(r.ok, true);
      assert.equal(r.registered, 2); // only valid tiers
    });
  });

  // ── getRouteCost ──────────────────────────────────────────────────────

  describe("getRouteCost", () => {
    it("returns registered tier", () => {
      registerRouteCost(STATE, "test.route", "cheap");
      assert.equal(getRouteCost(STATE, "test.route"), "cheap");
    });

    it("returns moderate as default for unknown routes", () => {
      assert.equal(getRouteCost(STATE, "unknown.route"), "moderate");
    });
  });

  // ── checkRateLimit ────────────────────────────────────────────────────

  describe("checkRateLimit", () => {
    it("allows free tier without limit", () => {
      registerRouteCost(STATE, "free.route", "free");
      const r = checkRateLimit(STATE, "u1", "free.route");
      assert.equal(r.allowed, true);
      assert.equal(r.remaining, Infinity);
    });

    it("allows first request on cheap tier", () => {
      registerRouteCost(STATE, "cheap.route", "cheap");
      const r = checkRateLimit(STATE, "u1", "cheap.route");
      assert.equal(r.allowed, true);
      assert.ok(r.remaining > 0);
    });

    it("blocks user that exceeds rate limit", () => {
      registerRouteCost(STATE, "test.route", "critical");
      // Critical tier allows 2/min
      checkRateLimit(STATE, "u1", "test.route");
      checkRateLimit(STATE, "u1", "test.route");
      const r = checkRateLimit(STATE, "u1", "test.route");
      assert.equal(r.allowed, false);
      assert.match(r.reason, /rate_limit_exceeded/);
    });

    it("blocks temporarily blocked user", () => {
      blockUser(STATE, "u1", "test_block");
      const r = checkRateLimit(STATE, "u1", "test.route");
      assert.equal(r.allowed, false);
      assert.match(r.reason, /temporarily_blocked/);
    });

    it("unblocks expired block", () => {
      const store = getThreatStore(STATE);
      store.blockedUsers.set("u1", { until: Date.now() - 1000, reason: "test" });
      registerRouteCost(STATE, "test.route", "free");
      const r = checkRateLimit(STATE, "u1", "test.route");
      assert.equal(r.allowed, true);
    });

    it("resets rate window after windowMs", () => {
      registerRouteCost(STATE, "test.route", "critical");
      const store = getThreatStore(STATE);
      store.config.windowMs = 1; // 1ms window

      checkRateLimit(STATE, "u2", "test.route");
      checkRateLimit(STATE, "u2", "test.route");
      // Wait briefly and try again with a fresh window
      const userRates = store.userRates.get("u2");
      if (userRates?.critical) {
        userRates.critical.windowStart = Date.now() - 100000; // force window reset
      }
      const r = checkRateLimit(STATE, "u2", "test.route");
      assert.equal(r.allowed, true);
    });
  });

  // ── checkCostBudget ───────────────────────────────────────────────────

  describe("checkCostBudget", () => {
    it("allows free tier (zero cost)", () => {
      registerRouteCost(STATE, "free.route", "free");
      const r = checkCostBudget(STATE, "u1", "free.route");
      assert.equal(r.allowed, true);
      assert.equal(r.costUsed, 0);
    });

    it("deducts cost for expensive route", () => {
      registerRouteCost(STATE, "exp.route", "expensive");
      const r = checkCostBudget(STATE, "u1", "exp.route");
      assert.equal(r.allowed, true);
      assert.ok(r.costUsed > 0);
    });

    it("exhausts per-user budget", () => {
      registerRouteCost(STATE, "exp.route", "critical");
      const store = getThreatStore(STATE);
      store.config.perUserCostBudget = 50; // very low budget

      const r = checkCostBudget(STATE, "u1", "exp.route"); // cost = 100 > 50
      assert.equal(r.allowed, false);
      assert.equal(r.reason, "user_cost_budget_exhausted");
    });

    it("exhausts global budget", () => {
      registerRouteCost(STATE, "exp.route", "critical");
      const store = getThreatStore(STATE);
      store.config.perUserCostBudget = 100000;
      store.config.globalCostBudget = 50; // very low global

      const r = checkCostBudget(STATE, "u1", "exp.route");
      assert.equal(r.allowed, false);
      assert.equal(r.reason, "global_cost_budget_exhausted");
    });

    it("resets cost window after costWindowMs", () => {
      registerRouteCost(STATE, "exp.route", "expensive");
      const store = getThreatStore(STATE);
      store.config.perUserCostBudget = 30;

      checkCostBudget(STATE, "uwin", "exp.route"); // 25 cost
      // Force window reset
      store.userCostBudgets.get("uwin").windowStart = Date.now() - store.config.costWindowMs - 1;
      store.globalCost.windowStart = Date.now() - store.config.costWindowMs - 1;

      const r = checkCostBudget(STATE, "uwin", "exp.route");
      assert.equal(r.allowed, true);
    });
  });

  // ── auditEndpoints ────────────────────────────────────────────────────

  describe("auditEndpoints", () => {
    it("returns clean audit with no routes", () => {
      const r = auditEndpoints(STATE);
      assert.equal(r.ok, true);
      assert.equal(typeof r.score, "number");
      assert.ok(Array.isArray(r.issues));
    });

    it("flags expensive public routes", () => {
      registerRouteCost(STATE, "pub.exp", "expensive", { public: true });
      const r = auditEndpoints(STATE);
      assert.ok(r.issues.some(i => i.type === "expensive_public_route"));
    });

    it("flags critical public routes", () => {
      registerRouteCost(STATE, "pub.crit", "critical", { public: true });
      const r = auditEndpoints(STATE);
      assert.ok(r.issues.some(i => i.type === "expensive_public_route"));
    });

    it("stores lastAudit", () => {
      auditEndpoints(STATE);
      const store = getThreatStore(STATE);
      assert.ok(store.lastAudit);
      assert.ok(store.lastAudit.timestamp);
    });

    it("score decreases with high-severity issues", () => {
      const clean = auditEndpoints(STATE);
      registerRouteCost(STATE, "p1", "expensive", { public: true });
      registerRouteCost(STATE, "p2", "critical", { public: true });
      const dirty = auditEndpoints(STATE);
      assert.ok(dirty.score < clean.score);
    });
  });

  // ── analyzeUserActivity ───────────────────────────────────────────────

  describe("analyzeUserActivity", () => {
    it("returns clean for new user", () => {
      const r = analyzeUserActivity(STATE, "u1");
      assert.equal(r.ok, true);
      assert.equal(r.suspicious, false);
      assert.equal(r.patterns.length, 0);
    });

    it("detects persistent rate abuse", () => {
      const store = getThreatStore(STATE);
      for (let i = 0; i < 12; i++) {
        store.suspiciousActivity.push({
          userId: "u_abuser", type: "rate_limit_exceeded",
          timestamp: new Date().toISOString(),
        });
      }
      const r = analyzeUserActivity(STATE, "u_abuser");
      assert.ok(r.patterns.some(p => p.type === "persistent_rate_abuse"));
    });

    it("detects budget exhaustion pattern", () => {
      const store = getThreatStore(STATE);
      for (let i = 0; i < 4; i++) {
        store.suspiciousActivity.push({
          userId: "u_budget", type: "user_cost_budget_exhausted",
          timestamp: new Date().toISOString(),
        });
      }
      const r = analyzeUserActivity(STATE, "u_budget");
      assert.ok(r.patterns.some(p => p.type === "budget_exhaustion_pattern"));
    });

    it("detects reconnaissance pattern", () => {
      const store = getThreatStore(STATE);
      store.userRates.set("u_recon", {
        cheap: { count: 60, windowStart: Date.now() },
        expensive: { count: 5, windowStart: Date.now() },
      });
      const r = analyzeUserActivity(STATE, "u_recon");
      assert.ok(r.patterns.some(p => p.type === "reconnaissance_pattern"));
    });

    it("auto-blocks with 2+ high severity patterns", () => {
      const store = getThreatStore(STATE);
      for (let i = 0; i < 12; i++) {
        store.suspiciousActivity.push({
          userId: "u_bad", type: "rate_limit_exceeded",
          timestamp: new Date().toISOString(),
        });
      }
      for (let i = 0; i < 4; i++) {
        store.suspiciousActivity.push({
          userId: "u_bad", type: "user_cost_budget_exhausted",
          timestamp: new Date().toISOString(),
        });
      }
      analyzeUserActivity(STATE, "u_bad");
      assert.ok(store.blockedUsers.has("u_bad"));
    });
  });

  // ── blockUser / unblockUser ───────────────────────────────────────────

  describe("blockUser / unblockUser", () => {
    it("blocks a user", () => {
      const r = blockUser(STATE, "u1", "test_reason");
      assert.equal(r.ok, true);
      const store = getThreatStore(STATE);
      assert.ok(store.blockedUsers.has("u1"));
    });

    it("unblocks a user", () => {
      blockUser(STATE, "u1", "test");
      const r = unblockUser(STATE, "u1");
      assert.equal(r.ok, true);
      const store = getThreatStore(STATE);
      assert.ok(!store.blockedUsers.has("u1"));
    });

    it("tracks offenders in metrics", () => {
      blockUser(STATE, "u1", "test");
      blockUser(STATE, "u1", "test2");
      const store = getThreatStore(STATE);
      assert.equal(store.metrics.topOffenders["u1"], 2);
    });

    it("works with store passed directly", () => {
      const store = getThreatStore(STATE);
      const r = blockUser(store, "u_direct", "direct_block");
      assert.equal(r.ok, true);
    });
  });

  // ── updateThreatConfig ────────────────────────────────────────────────

  describe("updateThreatConfig", () => {
    it("updates valid config keys", () => {
      const r = updateThreatConfig(STATE, { perUserCostBudget: 2000 });
      assert.equal(r.ok, true);
      assert.equal(r.config.perUserCostBudget, 2000);
    });

    it("ignores invalid key types", () => {
      const store = getThreatStore(STATE);
      const original = store.config.perUserCostBudget;
      updateThreatConfig(STATE, { perUserCostBudget: "not a number" });
      assert.equal(store.config.perUserCostBudget, original);
    });

    it("ignores unknown keys", () => {
      const r = updateThreatConfig(STATE, { unknownKey: 123 });
      assert.equal(r.ok, true);
    });
  });

  // ── getThreatMetrics ──────────────────────────────────────────────────

  describe("getThreatMetrics", () => {
    it("returns metrics", () => {
      const r = getThreatMetrics(STATE);
      assert.equal(r.ok, true);
      assert.ok(r.metrics);
      assert.equal(typeof r.registeredRoutes, "number");
      assert.equal(typeof r.blockedUsers, "number");
      assert.equal(typeof r.suspiciousEvents, "number");
    });
  });
});
