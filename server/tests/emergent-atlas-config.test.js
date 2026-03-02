/**
 * Tests for atlas-config.js — Centralized thresholds, strictness profiles, and helpers.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ATLAS_SCHEMA_VERSION,
  SCOPES,
  SCOPE_SET,
  VALIDATION_LEVEL,
  LOCAL_STATUS,
  GLOBAL_STATUS,
  MARKET_STATUS,
  LOCAL_TRANSITIONS,
  GLOBAL_TRANSITIONS,
  MARKET_TRANSITIONS,
  AUTO_PROMOTE_THRESHOLDS,
  PROPOSED_THRESHOLDS,
  CONTRADICTION_TYPES,
  CONTRADICTION_SEVERITY,
  DUP_THRESH,
  STRICTNESS_PROFILES,
  AUTOGEN_BUDGETS,
  ANTIGAMING_CAPS,
  CHAT_PROFILE,
  LICENSE_TYPES,
  LICENSE_TYPE_SET,
  LICENSE_PROFILES,
  DEFAULT_LICENSE_BY_LANE,
  RIGHTS_ACTIONS,
  DERIVATION_TYPES,
  RETRIEVAL_POLICY,
  DEFAULT_RETRIEVAL_POLICY,
  getAutoPromoteConfig,
  getStrictnessProfile,
  getLaneTransitions,
  canLaneTransition,
  getInitialStatus,
} from "../emergent/atlas-config.js";

// ── Constants ────────────────────────────────────────────────────────────────

describe("atlas-config constants", () => {
  it("ATLAS_SCHEMA_VERSION is atlas-1.1", () => {
    assert.equal(ATLAS_SCHEMA_VERSION, "atlas-1.1");
  });

  it("SCOPES is frozen with three values", () => {
    assert.equal(SCOPES.LOCAL, "local");
    assert.equal(SCOPES.GLOBAL, "global");
    assert.equal(SCOPES.MARKETPLACE, "marketplace");
    assert.throws(() => { SCOPES.LOCAL = "x"; }, TypeError);
  });

  it("SCOPE_SET contains all scope values", () => {
    assert.ok(SCOPE_SET.has("local"));
    assert.ok(SCOPE_SET.has("global"));
    assert.ok(SCOPE_SET.has("marketplace"));
    assert.equal(SCOPE_SET.size, 3);
  });

  it("VALIDATION_LEVEL is frozen with OFF/SOFT/HARD", () => {
    assert.equal(VALIDATION_LEVEL.OFF, "OFF");
    assert.equal(VALIDATION_LEVEL.SOFT, "SOFT");
    assert.equal(VALIDATION_LEVEL.HARD, "HARD");
    assert.throws(() => { VALIDATION_LEVEL.OFF = "x"; }, TypeError);
  });

  it("LOCAL_STATUS has expected values", () => {
    assert.equal(LOCAL_STATUS.LOCAL_DRAFT, "LOCAL_DRAFT");
    assert.equal(LOCAL_STATUS.LOCAL_PROPOSED, "LOCAL_PROPOSED");
    assert.equal(LOCAL_STATUS.LOCAL_VERIFIED, "LOCAL_VERIFIED");
    assert.equal(LOCAL_STATUS.LOCAL_DISPUTED, "LOCAL_DISPUTED");
  });

  it("GLOBAL_STATUS has expected values", () => {
    assert.equal(GLOBAL_STATUS.DRAFT, "DRAFT");
    assert.equal(GLOBAL_STATUS.PROPOSED, "PROPOSED");
    assert.equal(GLOBAL_STATUS.VERIFIED, "VERIFIED");
    assert.equal(GLOBAL_STATUS.DISPUTED, "DISPUTED");
    assert.equal(GLOBAL_STATUS.DEPRECATED, "DEPRECATED");
    assert.equal(GLOBAL_STATUS.QUARANTINED, "QUARANTINED");
  });

  it("MARKET_STATUS has expected values", () => {
    assert.equal(MARKET_STATUS.LISTING_DRAFT, "LISTING_DRAFT");
    assert.equal(MARKET_STATUS.LISTING_REVIEW, "LISTING_REVIEW");
    assert.equal(MARKET_STATUS.LISTED, "LISTED");
    assert.equal(MARKET_STATUS.LISTING_DISPUTED, "LISTING_DISPUTED");
    assert.equal(MARKET_STATUS.DELISTED, "DELISTED");
    assert.equal(MARKET_STATUS.QUARANTINED, "QUARANTINED");
  });

  it("LOCAL_TRANSITIONS defines correct transitions", () => {
    assert.deepStrictEqual(LOCAL_TRANSITIONS.LOCAL_DRAFT, ["LOCAL_PROPOSED"]);
    assert.deepStrictEqual(LOCAL_TRANSITIONS.LOCAL_PROPOSED, ["LOCAL_VERIFIED", "LOCAL_DISPUTED"]);
    assert.deepStrictEqual(LOCAL_TRANSITIONS.LOCAL_VERIFIED, ["LOCAL_DISPUTED"]);
    assert.deepStrictEqual(LOCAL_TRANSITIONS.LOCAL_DISPUTED, ["LOCAL_VERIFIED"]);
  });

  it("GLOBAL_TRANSITIONS QUARANTINED is terminal", () => {
    assert.deepStrictEqual(GLOBAL_TRANSITIONS.QUARANTINED, []);
  });

  it("MARKET_TRANSITIONS QUARANTINED is terminal", () => {
    assert.deepStrictEqual(MARKET_TRANSITIONS.QUARANTINED, []);
  });

  it("AUTO_PROMOTE_THRESHOLDS has all epistemic classes", () => {
    const classes = ["FORMAL", "EMPIRICAL", "HISTORICAL", "INTERPRETIVE", "MODEL", "ARTS", "DESIGN", "GENERAL"];
    for (const cls of classes) {
      assert.ok(AUTO_PROMOTE_THRESHOLDS[cls], `Missing threshold for ${cls}`);
      assert.equal(typeof AUTO_PROMOTE_THRESHOLDS[cls].min_structural, "number");
    }
  });

  it("FORMAL auto-promote requires proofVerified", () => {
    assert.equal(AUTO_PROMOTE_THRESHOLDS.FORMAL.proofVerified, true);
  });

  it("INTERPRETIVE label is VERIFIED_INTERPRETATION", () => {
    assert.equal(AUTO_PROMOTE_THRESHOLDS.INTERPRETIVE.label, "VERIFIED_INTERPRETATION");
  });

  it("PROPOSED_THRESHOLDS has all classes", () => {
    const classes = ["FORMAL", "EMPIRICAL", "HISTORICAL", "INTERPRETIVE", "MODEL", "ARTS", "DESIGN", "GENERAL"];
    for (const cls of classes) {
      assert.ok(PROPOSED_THRESHOLDS[cls], `Missing proposed threshold for ${cls}`);
    }
  });

  it("CONTRADICTION_TYPES is frozen", () => {
    assert.equal(CONTRADICTION_TYPES.NUMERIC, "NUMERIC");
    assert.equal(CONTRADICTION_TYPES.DATE, "DATE");
    assert.equal(CONTRADICTION_TYPES.CAUSAL, "CAUSAL");
    assert.equal(CONTRADICTION_TYPES.INTERPRETATION_CONFLICT, "INTERPRETATION_CONFLICT");
  });

  it("CONTRADICTION_SEVERITY has LOW/MEDIUM/HIGH", () => {
    assert.equal(CONTRADICTION_SEVERITY.LOW, "LOW");
    assert.equal(CONTRADICTION_SEVERITY.MEDIUM, "MEDIUM");
    assert.equal(CONTRADICTION_SEVERITY.HIGH, "HIGH");
  });

  it("DUP_THRESH is 0.65", () => {
    assert.equal(DUP_THRESH, 0.65);
  });

  it("STRICTNESS_PROFILES contains all scopes", () => {
    assert.ok(STRICTNESS_PROFILES[SCOPES.LOCAL]);
    assert.ok(STRICTNESS_PROFILES[SCOPES.GLOBAL]);
    assert.ok(STRICTNESS_PROFILES[SCOPES.MARKETPLACE]);
  });

  it("Local profile is SOFT validation", () => {
    assert.equal(STRICTNESS_PROFILES[SCOPES.LOCAL].validationLevel, VALIDATION_LEVEL.SOFT);
  });

  it("Global profile is HARD validation", () => {
    assert.equal(STRICTNESS_PROFILES[SCOPES.GLOBAL].validationLevel, VALIDATION_LEVEL.HARD);
  });

  it("Marketplace profile requires provenance and license", () => {
    const mp = STRICTNESS_PROFILES[SCOPES.MARKETPLACE];
    assert.equal(mp.provenanceRequired, true);
    assert.equal(mp.licenseMetadataRequired, true);
    assert.equal(mp.fraudCheckRequired, true);
    assert.equal(mp.royaltySplitRequired, true);
  });

  it("AUTOGEN_BUDGETS has expected fields", () => {
    assert.equal(AUTOGEN_BUDGETS.maxNewDTUsPerRun, 10);
    assert.equal(AUTOGEN_BUDGETS.maxNewDTUsPerDay, 100);
    assert.equal(AUTOGEN_BUDGETS.cycleLock, true);
    assert.equal(AUTOGEN_BUDGETS.dedupeThreshold, DUP_THRESH);
  });

  it("ANTIGAMING_CAPS has expected fields", () => {
    assert.equal(ANTIGAMING_CAPS.maxProposedPerUserPerHour, 20);
    assert.equal(ANTIGAMING_CAPS.similarityThreshold, DUP_THRESH);
  });

  it("CHAT_PROFILE has validation OFF", () => {
    assert.equal(CHAT_PROFILE.validationLevel, VALIDATION_LEVEL.OFF);
    assert.equal(CHAT_PROFILE.contradictionGate, "OFF");
    assert.equal(CHAT_PROFILE.promotionPolicy, "NEVER");
    assert.equal(CHAT_PROFILE.maxRetrievalResults, 10);
  });

  it("LICENSE_TYPES has expected types", () => {
    assert.equal(LICENSE_TYPES.PERSONAL, "CONCORD_PERSONAL");
    assert.equal(LICENSE_TYPES.OPEN, "CONCORD_OPEN");
    assert.equal(LICENSE_TYPES.CUSTOM, "CUSTOM");
  });

  it("LICENSE_TYPE_SET matches LICENSE_TYPES values", () => {
    for (const val of Object.values(LICENSE_TYPES)) {
      assert.ok(LICENSE_TYPE_SET.has(val));
    }
  });

  it("LICENSE_PROFILES[PERSONAL] disallows everything", () => {
    const p = LICENSE_PROFILES[LICENSE_TYPES.PERSONAL];
    assert.equal(p.attribution_required, false);
    assert.equal(p.derivative_allowed, false);
    assert.equal(p.commercial_use_allowed, false);
    assert.equal(p.redistribution_allowed, false);
  });

  it("LICENSE_PROFILES[CUSTOM] is null", () => {
    assert.equal(LICENSE_PROFILES[LICENSE_TYPES.CUSTOM], null);
  });

  it("DEFAULT_LICENSE_BY_LANE has lane-specific defaults", () => {
    assert.equal(DEFAULT_LICENSE_BY_LANE[SCOPES.LOCAL], LICENSE_TYPES.PERSONAL);
    assert.equal(DEFAULT_LICENSE_BY_LANE[SCOPES.GLOBAL], LICENSE_TYPES.ATTRIBUTION_OPEN);
    assert.equal(DEFAULT_LICENSE_BY_LANE[SCOPES.MARKETPLACE], null);
  });

  it("RIGHTS_ACTIONS has expected values", () => {
    assert.equal(RIGHTS_ACTIONS.VIEW, "VIEW");
    assert.equal(RIGHTS_ACTIONS.CITE, "CITE");
    assert.equal(RIGHTS_ACTIONS.DERIVE, "DERIVE");
    assert.equal(RIGHTS_ACTIONS.TRANSFER, "TRANSFER");
  });

  it("DERIVATION_TYPES has expected values", () => {
    assert.equal(DERIVATION_TYPES.EXTENSION, "EXTENSION");
    assert.equal(DERIVATION_TYPES.REVISION, "REVISION");
    assert.equal(DERIVATION_TYPES.SYNTHESIS, "SYNTHESIS");
  });

  it("RETRIEVAL_POLICY has expected values", () => {
    assert.equal(RETRIEVAL_POLICY.LOCAL_ONLY, "LOCAL_ONLY");
    assert.equal(RETRIEVAL_POLICY.GLOBAL_ONLY, "GLOBAL_ONLY");
    assert.equal(RETRIEVAL_POLICY.LOCAL_THEN_GLOBAL, "LOCAL_THEN_GLOBAL");
    assert.equal(RETRIEVAL_POLICY.LOCAL_PLUS_GLOBAL_MARKET, "LOCAL_PLUS_GLOBAL_MARKET");
  });

  it("DEFAULT_RETRIEVAL_POLICY is LOCAL_THEN_GLOBAL", () => {
    assert.equal(DEFAULT_RETRIEVAL_POLICY, RETRIEVAL_POLICY.LOCAL_THEN_GLOBAL);
  });
});

// ── Helper functions ─────────────────────────────────────────────────────────

describe("getAutoPromoteConfig", () => {
  it("returns config for known epistemic class", () => {
    const cfg = getAutoPromoteConfig("FORMAL");
    assert.equal(cfg.proofVerified, true);
    assert.equal(cfg.min_structural, 0.85);
  });

  it("falls back to EMPIRICAL for unknown class", () => {
    const cfg = getAutoPromoteConfig("UNKNOWN_CLASS");
    assert.deepStrictEqual(cfg, AUTO_PROMOTE_THRESHOLDS.EMPIRICAL);
  });

  it("returns each class correctly", () => {
    for (const cls of Object.keys(AUTO_PROMOTE_THRESHOLDS)) {
      const cfg = getAutoPromoteConfig(cls);
      assert.deepStrictEqual(cfg, AUTO_PROMOTE_THRESHOLDS[cls]);
    }
  });
});

describe("getStrictnessProfile", () => {
  it("returns profile for known scope", () => {
    const p = getStrictnessProfile(SCOPES.GLOBAL);
    assert.equal(p.validationLevel, VALIDATION_LEVEL.HARD);
  });

  it("falls back to LOCAL for unknown scope", () => {
    const p = getStrictnessProfile("unknown_scope");
    assert.deepStrictEqual(p, STRICTNESS_PROFILES[SCOPES.LOCAL]);
  });
});

describe("getLaneTransitions", () => {
  it("returns LOCAL_TRANSITIONS for local scope", () => {
    const t = getLaneTransitions(SCOPES.LOCAL);
    assert.deepStrictEqual(t, LOCAL_TRANSITIONS);
  });

  it("returns MARKET_TRANSITIONS for marketplace scope", () => {
    const t = getLaneTransitions(SCOPES.MARKETPLACE);
    assert.deepStrictEqual(t, MARKET_TRANSITIONS);
  });

  it("returns GLOBAL_TRANSITIONS for global scope", () => {
    const t = getLaneTransitions(SCOPES.GLOBAL);
    assert.deepStrictEqual(t, GLOBAL_TRANSITIONS);
  });

  it("defaults to GLOBAL_TRANSITIONS for unknown scope", () => {
    const t = getLaneTransitions("something_else");
    assert.deepStrictEqual(t, GLOBAL_TRANSITIONS);
  });
});

describe("canLaneTransition", () => {
  it("returns true for valid local transition", () => {
    assert.equal(canLaneTransition(SCOPES.LOCAL, "LOCAL_DRAFT", "LOCAL_PROPOSED"), true);
  });

  it("returns false for invalid local transition", () => {
    assert.equal(canLaneTransition(SCOPES.LOCAL, "LOCAL_DRAFT", "LOCAL_VERIFIED"), false);
  });

  it("returns true for valid global transition", () => {
    assert.equal(canLaneTransition(SCOPES.GLOBAL, "DRAFT", "PROPOSED"), true);
  });

  it("returns false for QUARANTINED (terminal)", () => {
    assert.equal(canLaneTransition(SCOPES.GLOBAL, "QUARANTINED", "VERIFIED"), false);
  });

  it("returns true for marketplace transition", () => {
    assert.equal(canLaneTransition(SCOPES.MARKETPLACE, "LISTING_DRAFT", "LISTING_REVIEW"), true);
  });

  it("returns false for non-existent from status", () => {
    assert.equal(canLaneTransition(SCOPES.GLOBAL, "NONEXISTENT", "PROPOSED"), false);
  });
});

describe("getInitialStatus", () => {
  it("returns LOCAL_DRAFT for local scope", () => {
    assert.equal(getInitialStatus(SCOPES.LOCAL), LOCAL_STATUS.LOCAL_DRAFT);
  });

  it("returns LISTING_DRAFT for marketplace scope", () => {
    assert.equal(getInitialStatus(SCOPES.MARKETPLACE), MARKET_STATUS.LISTING_DRAFT);
  });

  it("returns DRAFT for global scope", () => {
    assert.equal(getInitialStatus(SCOPES.GLOBAL), GLOBAL_STATUS.DRAFT);
  });

  it("defaults to DRAFT for unknown scope", () => {
    assert.equal(getInitialStatus("anything"), GLOBAL_STATUS.DRAFT);
  });
});
