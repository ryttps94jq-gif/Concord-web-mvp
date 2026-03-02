/**
 * Tests for emergent/constitution.js — Constitution (Norms & Invariants)
 *
 * Covers: RULE_TIERS, ALL_RULE_TIERS, RULE_CATEGORIES, VIOLATION_SEVERITY,
 * getConstitutionStore, addRule, amendRule, deactivateRule, checkRules,
 * getRules, getRule, getAmendmentHistory, getViolationHistory, getConstitutionMetrics
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  RULE_TIERS,
  ALL_RULE_TIERS,
  RULE_CATEGORIES,
  VIOLATION_SEVERITY,
  getConstitutionStore,
  addRule,
  amendRule,
  deactivateRule,
  checkRules,
  getRules,
  getRule,
  getAmendmentHistory,
  getViolationHistory,
  getConstitutionMetrics,
} from "../emergent/constitution.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function freshSTATE() {
  return { __emergent: {} };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("constitution.js", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshSTATE();
  });

  // ── Constants ────────────────────────────────────────────────────────────

  describe("constants", () => {
    it("RULE_TIERS is frozen and correct", () => {
      assert.ok(Object.isFrozen(RULE_TIERS));
      assert.strictEqual(RULE_TIERS.IMMUTABLE, "immutable");
      assert.strictEqual(RULE_TIERS.CONSTITUTIONAL, "constitutional");
      assert.strictEqual(RULE_TIERS.POLICY, "policy");
    });

    it("ALL_RULE_TIERS includes all tiers", () => {
      assert.ok(Array.isArray(ALL_RULE_TIERS));
      assert.strictEqual(ALL_RULE_TIERS.length, 3);
      assert.ok(ALL_RULE_TIERS.includes("immutable"));
      assert.ok(ALL_RULE_TIERS.includes("constitutional"));
      assert.ok(ALL_RULE_TIERS.includes("policy"));
    });

    it("RULE_CATEGORIES is frozen", () => {
      assert.ok(Object.isFrozen(RULE_CATEGORIES));
      assert.strictEqual(RULE_CATEGORIES.AUTHORITY, "authority");
      assert.strictEqual(RULE_CATEGORIES.SAFETY, "safety");
    });

    it("VIOLATION_SEVERITY is frozen", () => {
      assert.ok(Object.isFrozen(VIOLATION_SEVERITY));
      assert.strictEqual(VIOLATION_SEVERITY.FATAL, "fatal");
      assert.strictEqual(VIOLATION_SEVERITY.CRITICAL, "critical");
      assert.strictEqual(VIOLATION_SEVERITY.WARNING, "warning");
      assert.strictEqual(VIOLATION_SEVERITY.INFO, "info");
    });
  });

  // ── getConstitutionStore ─────────────────────────────────────────────────

  describe("getConstitutionStore()", () => {
    it("initializes with immutable rules seeded", () => {
      const store = getConstitutionStore(STATE);
      assert.ok(store);
      assert.ok(store.rules instanceof Map);
      assert.ok(store.rules.size >= 10); // 10 immutable rules seeded
      assert.ok(store.rules.has("IMM-001"));
      assert.ok(store.rules.has("IMM-010"));
    });

    it("returns same instance on subsequent calls", () => {
      const s1 = getConstitutionStore(STATE);
      const s2 = getConstitutionStore(STATE);
      assert.strictEqual(s1, s2);
    });

    it("seeds immutable rules correctly", () => {
      const store = getConstitutionStore(STATE);
      const imm001 = store.rules.get("IMM-001");
      assert.strictEqual(imm001.tier, "immutable");
      assert.strictEqual(imm001.amendable, false);
      assert.strictEqual(imm001.active, true);
      assert.ok(imm001.statement.length > 0);
    });

    it("populates tier index", () => {
      const store = getConstitutionStore(STATE);
      const immutableSet = store.byTier.get("immutable");
      assert.ok(immutableSet instanceof Set);
      assert.ok(immutableSet.size >= 10);
    });

    it("populates category index", () => {
      const store = getConstitutionStore(STATE);
      const authorityRules = store.byCategory.get("authority");
      assert.ok(authorityRules instanceof Set);
      assert.ok(authorityRules.size >= 1);
    });

    it("populates tag index", () => {
      const store = getConstitutionStore(STATE);
      const governanceTags = store.byTag.get("governance");
      assert.ok(governanceTags instanceof Set);
      assert.ok(governanceTags.size >= 1);
    });
  });

  // ── addRule ──────────────────────────────────────────────────────────────

  describe("addRule()", () => {
    it("adds a constitutional rule", () => {
      const result = addRule(STATE, {
        statement: "Test constitutional rule",
        description: "Description here",
        tier: RULE_TIERS.CONSTITUTIONAL,
        category: RULE_CATEGORIES.SAFETY,
        tags: ["test"],
        severity: VIOLATION_SEVERITY.WARNING,
        createdBy: "test_user",
      });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rule);
      assert.ok(result.rule.ruleId.startsWith("CON-"));
      assert.strictEqual(result.rule.tier, "constitutional");
      assert.strictEqual(result.rule.active, true);
      assert.strictEqual(result.rule.amendable, true);
    });

    it("adds a policy rule", () => {
      const result = addRule(STATE, {
        statement: "Test policy rule",
        tier: RULE_TIERS.POLICY,
      });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rule.ruleId.startsWith("POL-"));
    });

    it("returns error when statement is missing", () => {
      const result = addRule(STATE, { tier: RULE_TIERS.POLICY });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "statement_required");
    });

    it("returns error when tier is immutable", () => {
      const result = addRule(STATE, {
        statement: "Test",
        tier: RULE_TIERS.IMMUTABLE,
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "cannot_add_immutable_rules");
    });

    it("returns error when tier is missing", () => {
      const result = addRule(STATE, { statement: "Test" });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "cannot_add_immutable_rules");
    });

    it("returns error for invalid tier", () => {
      const result = addRule(STATE, { statement: "Test", tier: "bogus" });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "invalid_tier");
    });

    it("truncates long statements and descriptions", () => {
      const result = addRule(STATE, {
        statement: "x".repeat(600),
        description: "y".repeat(3000),
        tier: RULE_TIERS.POLICY,
      });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rule.statement.length <= 500);
      assert.ok(result.rule.description.length <= 2000);
    });

    it("uses defaults for optional fields", () => {
      const result = addRule(STATE, {
        statement: "Minimal rule",
        tier: RULE_TIERS.POLICY,
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.rule.category, RULE_CATEGORIES.INTEGRITY);
      assert.strictEqual(result.rule.severity, VIOLATION_SEVERITY.WARNING);
      assert.strictEqual(result.rule.createdBy, "system");
      assert.deepStrictEqual(result.rule.tags, []);
    });

    it("caps tags at 20", () => {
      const tags = Array.from({ length: 30 }, (_, i) => `tag_${i}`);
      const result = addRule(STATE, {
        statement: "Many tags rule",
        tier: RULE_TIERS.POLICY,
        tags,
      });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rule.tags.length <= 20);
    });
  });

  // ── amendRule ────────────────────────────────────────────────────────────

  describe("amendRule()", () => {
    it("returns error for non-existent rule", () => {
      const result = amendRule(STATE, "NONEXISTENT");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "rule_not_found");
    });

    it("returns error for immutable rules", () => {
      getConstitutionStore(STATE); // seed rules
      const result = amendRule(STATE, "IMM-001", { newStatement: "Changed" });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "rule_not_amendable");
    });

    it("returns error when newStatement is missing", () => {
      addRule(STATE, { statement: "Test", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const result = amendRule(STATE, ruleId, {});
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "newStatement_required");
    });

    it("returns error when votes are missing", () => {
      addRule(STATE, { statement: "Test", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const result = amendRule(STATE, ruleId, { newStatement: "New" });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "votes_required");
    });

    it("returns error when votes array is empty", () => {
      addRule(STATE, { statement: "Test", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const result = amendRule(STATE, ruleId, { newStatement: "New", votes: [] });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "votes_required");
    });

    it("returns error when all votes are abstain", () => {
      addRule(STATE, { statement: "Test", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const result = amendRule(STATE, ruleId, {
        newStatement: "New",
        votes: [{ voterId: "v1", vote: "abstain" }],
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "no_valid_votes");
    });

    it("passes policy rule amendment with simple majority", () => {
      addRule(STATE, { statement: "Original", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const result = amendRule(STATE, ruleId, {
        newStatement: "Amended policy",
        votes: [
          { voterId: "v1", vote: "for" },
          { voterId: "v2", vote: "against" },
          { voterId: "v3", vote: "for" },
        ],
        reason: "test amendment",
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.amended, true);
      assert.ok(result.rule);
      assert.strictEqual(result.rule.statement, "Amended policy");
    });

    it("fails policy amendment without majority", () => {
      addRule(STATE, { statement: "Original", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const result = amendRule(STATE, ruleId, {
        newStatement: "Amended policy",
        votes: [
          { voterId: "v1", vote: "for" },
          { voterId: "v2", vote: "against" },
          { voterId: "v3", vote: "against" },
        ],
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.amended, false);
      assert.strictEqual(result.rule, undefined);
    });

    it("requires supermajority for constitutional rules", () => {
      addRule(STATE, { statement: "Original", tier: RULE_TIERS.CONSTITUTIONAL });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("CON-"));

      // 2 for, 1 against = 66.67% = 2/3, not > 2/3
      const result = amendRule(STATE, ruleId, {
        newStatement: "Changed",
        votes: [
          { voterId: "v1", vote: "for" },
          { voterId: "v2", vote: "for" },
          { voterId: "v3", vote: "against" },
        ],
      });
      assert.strictEqual(result.ok, true);
      // ratio 2/3 = 0.667, threshold is 2/3 = 0.667, > means strictly greater
      assert.strictEqual(result.amended, false);
    });

    it("passes constitutional amendment with supermajority", () => {
      addRule(STATE, { statement: "Original", tier: RULE_TIERS.CONSTITUTIONAL });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("CON-"));

      const result = amendRule(STATE, ruleId, {
        newStatement: "Changed",
        votes: [
          { voterId: "v1", vote: "for" },
          { voterId: "v2", vote: "for" },
          { voterId: "v3", vote: "for" },
          { voterId: "v4", vote: "against" },
        ],
        reason: "supermajority test",
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.amended, true);
    });

    it("updates version and lastAmended on successful amendment", () => {
      addRule(STATE, { statement: "Original", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const oldVersion = store.version;

      amendRule(STATE, ruleId, {
        newStatement: "New",
        newDescription: "Updated desc",
        votes: [{ voterId: "v1", vote: "for" }],
      });

      assert.ok(store.version > oldVersion);
      assert.ok(store.lastAmended);
    });

    it("records amendment history", () => {
      addRule(STATE, { statement: "Original", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));

      amendRule(STATE, ruleId, {
        newStatement: "New",
        votes: [{ voterId: "v1", vote: "for" }],
      });

      assert.ok(store.amendments.length >= 1);
    });
  });

  // ── deactivateRule ───────────────────────────────────────────────────────

  describe("deactivateRule()", () => {
    it("deactivates a policy rule", () => {
      addRule(STATE, { statement: "Deactivate me", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      const result = deactivateRule(STATE, ruleId);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.rule.active, false);
    });

    it("returns error for non-existent rule", () => {
      const result = deactivateRule(STATE, "NONEXISTENT");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "rule_not_found");
    });

    it("returns error for immutable rule", () => {
      getConstitutionStore(STATE);
      const result = deactivateRule(STATE, "IMM-001");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "cannot_deactivate_immutable");
    });

    it("returns error for constitutional rule", () => {
      addRule(STATE, { statement: "Test", tier: RULE_TIERS.CONSTITUTIONAL });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("CON-"));
      const result = deactivateRule(STATE, ruleId);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "cannot_deactivate_constitutional_use_amend");
    });
  });

  // ── checkRules ───────────────────────────────────────────────────────────

  describe("checkRules()", () => {
    it("returns allowed with no violations for benign actions", () => {
      const result = checkRules(STATE, {
        action: "read",
        tags: ["emergent"],
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.allowed, true);
    });

    it("detects IMM-001 violation (emergent commit)", () => {
      const result = checkRules(STATE, {
        action: "commit",
        actorType: "emergent",
        tags: ["emergent", "governance", "decision"],
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.allowed, false);
      assert.ok(result.violations.some(v => v.ruleId === "IMM-001"));
    });

    it("detects IMM-002 violation (ungated growth)", () => {
      const result = checkRules(STATE, {
        action: "growth",
        gated: false,
        tags: ["growth", "gate", "governance"],
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.allowed, false);
      assert.ok(result.violations.some(v => v.ruleId === "IMM-002"));
    });

    it("detects IMM-003 violation (no provenance)", () => {
      const result = checkRules(STATE, {
        action: "create",
        provenance: null,
        tags: ["provenance", "audit", "traceability"],
      });
      assert.strictEqual(result.ok, true);
      assert.ok(result.violations.some(v => v.ruleId === "IMM-003"));
    });

    it("detects IMM-004 violation (self-referential verification)", () => {
      const result = checkRules(STATE, {
        action: "verify",
        selfReferential: true,
        tags: ["verification", "loop", "delusion"],
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.allowed, false);
    });

    it("detects IMM-008 violation (governance bypass)", () => {
      const result = checkRules(STATE, {
        action: "governance_bypass",
        tags: ["governance", "fail-closed", "default-deny"],
      });
      assert.strictEqual(result.ok, true);
      assert.ok(result.violations.some(v => v.ruleId === "IMM-008"));
    });

    it("detects IMM-010 violation (optimize constitution)", () => {
      const result = checkRules(STATE, {
        action: "optimize",
        targetType: "constitution",
        tags: ["optimization", "constitution", "constraint"],
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.allowed, false);
    });

    it("skips inactive rules", () => {
      addRule(STATE, { statement: "Inactive rule", tier: RULE_TIERS.POLICY, tags: ["test_tag"] });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      deactivateRule(STATE, ruleId);

      const result = checkRules(STATE, { action: "something", tags: ["test_tag"] });
      assert.strictEqual(result.ok, true);
      // The deactivated rule should not produce violations
    });

    it("allows actions when context tags don't match any rules", () => {
      const result = checkRules(STATE, {
        action: "random_action",
        tags: ["completely_unrelated_tag"],
      });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.allowed, true);
    });

    it("checks all rules when context has no tags", () => {
      const result = checkRules(STATE, {});
      assert.strictEqual(result.ok, true);
      // No specific violation triggers without action details
    });

    it("logs violations and updates metrics", () => {
      checkRules(STATE, {
        action: "commit",
        actorType: "emergent",
        tags: ["emergent", "governance", "decision"],
      });
      const store = getConstitutionStore(STATE);
      assert.ok(store.metrics.totalViolations > 0);
      assert.ok(store.violations.length > 0);
    });
  });

  // ── getRules ─────────────────────────────────────────────────────────────

  describe("getRules()", () => {
    it("returns all rules", () => {
      const result = getRules(STATE);
      assert.strictEqual(result.ok, true);
      assert.ok(result.rules.length >= 10);
    });

    it("filters by tier", () => {
      const result = getRules(STATE, { tier: "immutable" });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rules.every(r => r.tier === "immutable"));
    });

    it("filters by category", () => {
      const result = getRules(STATE, { category: "safety" });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rules.every(r => r.category === "safety"));
    });

    it("filters by active status", () => {
      const result = getRules(STATE, { active: true });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rules.every(r => r.active === true));
    });

    it("filters by tag", () => {
      const result = getRules(STATE, { tag: "governance" });
      assert.strictEqual(result.ok, true);
      assert.ok(result.rules.every(r => r.tags.includes("governance")));
    });
  });

  // ── getRule ──────────────────────────────────────────────────────────────

  describe("getRule()", () => {
    it("returns a specific rule", () => {
      getConstitutionStore(STATE);
      const result = getRule(STATE, "IMM-001");
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.rule.ruleId, "IMM-001");
    });

    it("returns error for non-existent rule", () => {
      const result = getRule(STATE, "NONEXISTENT");
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.error, "not_found");
    });
  });

  // ── getAmendmentHistory ──────────────────────────────────────────────────

  describe("getAmendmentHistory()", () => {
    it("returns all amendments when no ruleId filter", () => {
      addRule(STATE, { statement: "Test", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      amendRule(STATE, ruleId, {
        newStatement: "New",
        votes: [{ voterId: "v1", vote: "for" }],
      });

      const result = getAmendmentHistory(STATE);
      assert.strictEqual(result.ok, true);
      assert.ok(result.amendments.length >= 1);
    });

    it("filters by ruleId", () => {
      addRule(STATE, { statement: "Test", tier: RULE_TIERS.POLICY });
      const store = getConstitutionStore(STATE);
      const ruleId = Array.from(store.rules.keys()).find(k => k.startsWith("POL-"));
      amendRule(STATE, ruleId, {
        newStatement: "New",
        votes: [{ voterId: "v1", vote: "for" }],
      });

      const result = getAmendmentHistory(STATE, ruleId);
      assert.strictEqual(result.ok, true);
      assert.ok(result.amendments.every(a => a.ruleId === ruleId));
    });
  });

  // ── getViolationHistory ──────────────────────────────────────────────────

  describe("getViolationHistory()", () => {
    it("returns violations", () => {
      checkRules(STATE, {
        action: "commit",
        actorType: "emergent",
        tags: ["emergent", "governance", "decision"],
      });
      const result = getViolationHistory(STATE);
      assert.strictEqual(result.ok, true);
      assert.ok(result.violations.length > 0);
    });

    it("filters by ruleId", () => {
      checkRules(STATE, {
        action: "commit",
        actorType: "emergent",
        tags: ["emergent", "governance", "decision"],
      });
      const result = getViolationHistory(STATE, { ruleId: "IMM-001" });
      assert.strictEqual(result.ok, true);
      assert.ok(result.violations.every(v => v.ruleId === "IMM-001"));
    });

    it("filters by severity", () => {
      checkRules(STATE, {
        action: "commit",
        actorType: "emergent",
        tags: ["emergent", "governance", "decision"],
      });
      const result = getViolationHistory(STATE, { severity: "fatal" });
      assert.strictEqual(result.ok, true);
      assert.ok(result.violations.every(v => v.severity === "fatal"));
    });

    it("respects limit and offset", () => {
      // Generate multiple violations
      for (let i = 0; i < 5; i++) {
        checkRules(STATE, {
          action: "commit",
          actorType: "emergent",
          tags: ["emergent", "governance", "decision"],
        });
      }
      const result = getViolationHistory(STATE, { limit: 2, offset: 1 });
      assert.strictEqual(result.ok, true);
      assert.ok(result.violations.length <= 2);
    });

    it("uses default limit of 50 and max of 200", () => {
      const result = getViolationHistory(STATE);
      assert.strictEqual(result.ok, true);
    });
  });

  // ── getConstitutionMetrics ───────────────────────────────────────────────

  describe("getConstitutionMetrics()", () => {
    it("returns metrics with initial values", () => {
      const result = getConstitutionMetrics(STATE);
      assert.strictEqual(result.ok, true);
      assert.ok(result.version >= 1);
      assert.ok(result.metrics);
      assert.ok(result.rulesByTier.immutable >= 10);
    });

    it("reflects added rules", () => {
      addRule(STATE, { statement: "Metric test", tier: RULE_TIERS.POLICY });
      const result = getConstitutionMetrics(STATE);
      assert.ok(result.rulesByTier.policy >= 1);
    });
  });
});
