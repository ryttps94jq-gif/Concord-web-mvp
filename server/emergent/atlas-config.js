/**
 * Atlas Configuration — Centralized thresholds, strictness profiles, and auto-promote gates.
 *
 * Every threshold / policy constant lives here so tuning never requires refactoring logic.
 * This is the single source of truth referenced by atlas-write-guard, atlas-scope-router,
 * atlas-store, atlas-epistemic, atlas-autogen-v2, and atlas-council.
 */

// ── Schema version ──────────────────────────────────────────────────────────
export const ATLAS_SCHEMA_VERSION = "atlas-1.1";

// ── Scopes (Lanes) ─────────────────────────────────────────────────────────
export const SCOPES = Object.freeze({
  LOCAL:       "local",
  GLOBAL:      "global",
  MARKETPLACE: "marketplace",
});

export const SCOPE_SET = new Set(Object.values(SCOPES));

// ── Verification Levels ─────────────────────────────────────────────────────
export const VALIDATION_LEVEL = Object.freeze({
  OFF:  "OFF",
  SOFT: "SOFT",   // warnings only
  HARD: "HARD",   // errors block
});

// ── Lane-Specific Statuses ──────────────────────────────────────────────────

export const LOCAL_STATUS = Object.freeze({
  LOCAL_DRAFT:    "LOCAL_DRAFT",
  LOCAL_PROPOSED: "LOCAL_PROPOSED",
  LOCAL_VERIFIED: "LOCAL_VERIFIED",
  LOCAL_DISPUTED: "LOCAL_DISPUTED",
});

export const GLOBAL_STATUS = Object.freeze({
  DRAFT:       "DRAFT",
  PROPOSED:    "PROPOSED",
  VERIFIED:    "VERIFIED",
  DISPUTED:    "DISPUTED",
  DEPRECATED:  "DEPRECATED",
  QUARANTINED: "QUARANTINED",
});

export const MARKET_STATUS = Object.freeze({
  LISTING_DRAFT:    "LISTING_DRAFT",
  LISTING_REVIEW:   "LISTING_REVIEW",
  LISTED:           "LISTED",
  LISTING_DISPUTED: "LISTING_DISPUTED",
  DELISTED:         "DELISTED",
  QUARANTINED:      "QUARANTINED",
});

// ── Status Transition Rules (per lane) ──────────────────────────────────────

export const LOCAL_TRANSITIONS = Object.freeze({
  LOCAL_DRAFT:    ["LOCAL_PROPOSED"],
  LOCAL_PROPOSED: ["LOCAL_VERIFIED", "LOCAL_DISPUTED"],
  LOCAL_VERIFIED: ["LOCAL_DISPUTED"],
  LOCAL_DISPUTED: ["LOCAL_VERIFIED"],
});

export const GLOBAL_TRANSITIONS = Object.freeze({
  DRAFT:       ["PROPOSED"],
  PROPOSED:    ["VERIFIED", "DISPUTED", "QUARANTINED"],
  VERIFIED:    ["DISPUTED", "DEPRECATED", "QUARANTINED"],
  DISPUTED:    ["VERIFIED", "QUARANTINED"],
  DEPRECATED:  ["QUARANTINED"],
  QUARANTINED: [],
});

export const MARKET_TRANSITIONS = Object.freeze({
  LISTING_DRAFT:    ["LISTING_REVIEW"],
  LISTING_REVIEW:   ["LISTED", "LISTING_DISPUTED", "QUARANTINED"],
  LISTED:           ["LISTING_DISPUTED", "DELISTED", "QUARANTINED"],
  LISTING_DISPUTED: ["LISTED", "DELISTED", "QUARANTINED"],
  DELISTED:         ["QUARANTINED"],
  QUARANTINED:      [],
});

// ── Auto-Promote Gate Thresholds (per epistemic class) ──────────────────────
// These are the thresholds for the AutoPromoteGate — the ONLY path to VERIFIED.
// Rule-based, not "by class" — a DTU is promoted because it passes these gates.

export const AUTO_PROMOTE_THRESHOLDS = Object.freeze({
  FORMAL: {
    min_structural:     0.85,
    min_factual:        0.0,    // proof-based, not score-based
    proofVerified:      true,   // required: proofVerified flag must be true
    uniqueSources:      0,      // N/A for proofs
    maxHighContra:      0,
    uncitedFactsOk:     false,  // all facts must be cited (or proof-verified)
    dedupeThreshold:    0.65,
    label:              "VERIFIED",
  },
  EMPIRICAL: {
    min_structural:     0.85,
    min_factual:        0.80,
    proofVerified:      false,
    uniqueSources:      3,
    maxHighContra:      0,
    uncitedFactsOk:     false,
    dedupeThreshold:    0.65,
    label:              "VERIFIED",
  },
  HISTORICAL: {
    min_structural:     0.85,
    min_factual:        0.75,
    proofVerified:      false,
    uniqueSources:      2,      // primary or independent
    maxHighContra:      0,      // HIGH(NUMERIC|DATE) = 0
    uncitedFactsOk:     false,
    dedupeThreshold:    0.65,
    label:              "VERIFIED",
  },
  INTERPRETIVE: {
    min_structural:     0.70,
    min_factual:        0.0,    // factual not applicable
    proofVerified:      false,
    uniqueSources:      0,
    maxHighContra:      0,
    uncitedFactsOk:     true,   // interpretations don't need citations
    dedupeThreshold:    0.65,
    label:              "VERIFIED_INTERPRETATION",   // distinct label
  },
  MODEL: {
    min_structural:     0.85,
    min_factual:        0.0,    // models aren't "factual"
    proofVerified:      false,
    uniqueSources:      0,
    maxHighContra:      0,
    uncitedFactsOk:     false,
    requireAssumptions: true,   // must declare assumptions
    requireSensitivity: true,   // sensitivity test flag or reason
    dedupeThreshold:    0.65,
    label:              "VERIFIED",
  },
  ARTS: {
    min_structural:     0.70,
    min_factual:        0.55,   // only for factual claims (date/attribution/venue)
    proofVerified:      false,
    uniqueSources:      1,      // provenance + primary catalog
    maxHighContra:      0,
    uncitedFactsOk:     false,
    dedupeThreshold:    0.65,
    label:              "VERIFIED",   // facts only; meaning/interpretation stays PROPOSED
  },
  DESIGN: {
    min_structural:     0.75,
    min_factual:        0.60,
    proofVerified:      false,
    uniqueSources:      1,      // docs/measurements
    maxHighContra:      0,
    uncitedFactsOk:     false,
    dedupeThreshold:    0.65,
    label:              "VERIFIED",
  },
  GENERAL: {
    min_structural:     0.70,
    min_factual:        0.60,
    proofVerified:      false,
    uniqueSources:      1,
    maxHighContra:      0,
    uncitedFactsOk:     false,
    dedupeThreshold:    0.65,
    label:              "VERIFIED",
  },
});

// ── Proposed-level thresholds (used by the write guard / store) ─────────────
export const PROPOSED_THRESHOLDS = Object.freeze({
  FORMAL:       { min_structural: 0.50 },
  EMPIRICAL:    { min_structural: 0.45 },
  HISTORICAL:   { min_structural: 0.45 },
  INTERPRETIVE: { min_structural: 0.40 },
  MODEL:        { min_structural: 0.50 },
  ARTS:         { min_structural: 0.40 },
  DESIGN:       { min_structural: 0.45 },
  GENERAL:      { min_structural: 0.40 },
});

// ── Contradiction Severity + Types ──────────────────────────────────────────

export const CONTRADICTION_TYPES = Object.freeze({
  NUMERIC:              "NUMERIC",
  DATE:                 "DATE",
  CAUSAL:               "CAUSAL",
  ATTRIBUTION:          "ATTRIBUTION",
  DEFINITIONAL:         "DEFINITIONAL",
  MODEL_ASSUMPTION:     "MODEL_ASSUMPTION",
  INTERPRETATION_CONFLICT: "INTERPRETATION_CONFLICT",
  PROVENANCE_CHAIN:     "PROVENANCE_CHAIN",
});

export const CONTRADICTION_SEVERITY = Object.freeze({
  LOW:    "LOW",
  MEDIUM: "MEDIUM",
  HIGH:   "HIGH",
});

// ── Duplicate Threshold ─────────────────────────────────────────────────────
export const DUP_THRESH = 0.65;

// ── Strictness Profiles (per lane) ──────────────────────────────────────────

export const STRICTNESS_PROFILES = Object.freeze({
  [SCOPES.LOCAL]: {
    validationLevel:            VALIDATION_LEVEL.SOFT,
    minStructural:              0.0,    // no hard minimum
    minFactual:                 0.0,
    sourceRequiredForFacts:     false,
    contradictionGateSeverity:  "NONE",   // NONE | HIGH_ONLY | MED_AND_HIGH
    autopromotePolicy:          "LOCAL_RULES",
    antiGamingPolicy:           "LIGHT",   // rate limits only
    auditPolicy:                "OPTIONAL",
    dedupeRequired:             false,
    cycleCheckRequired:         false,
  },
  [SCOPES.GLOBAL]: {
    validationLevel:            VALIDATION_LEVEL.HARD,
    minStructural:              0.40,
    minFactual:                 0.0,
    sourceRequiredForFacts:     true,
    contradictionGateSeverity:  "MED_AND_HIGH",
    autopromotePolicy:          "AUTO_PROMOTE_GATE",
    antiGamingPolicy:           "FULL",
    auditPolicy:                "MANDATORY",
    dedupeRequired:             true,
    cycleCheckRequired:         true,
  },
  [SCOPES.MARKETPLACE]: {
    validationLevel:            VALIDATION_LEVEL.HARD,
    minStructural:              0.40,
    minFactual:                 0.0,
    sourceRequiredForFacts:     true,
    contradictionGateSeverity:  "MED_AND_HIGH",
    autopromotePolicy:          "AUTO_PROMOTE_GATE",
    antiGamingPolicy:           "FULL",
    auditPolicy:                "MANDATORY",
    dedupeRequired:             true,
    cycleCheckRequired:         true,
    // Marketplace-extra
    provenanceRequired:         true,
    licenseMetadataRequired:    true,
    fraudCheckRequired:         true,
    royaltySplitRequired:       true,
  },
});

// ── Autogen v2 Budgets ──────────────────────────────────────────────────────

export const AUTOGEN_BUDGETS = Object.freeze({
  maxNewDTUsPerRun:      10,
  maxNewDTUsPerDay:      100,
  maxChildrenPerParent:  5,
  maxDepth:              25,
  qualityFloorBase:      0.40,
  qualityFloorPenalty:   0.02,   // += per depth level
  cycleLock:             true,
  dedupeThreshold:       DUP_THRESH,
});

// ── Anti-Gaming Caps ────────────────────────────────────────────────────────

export const ANTIGAMING_CAPS = Object.freeze({
  maxProposedPerUserPerHour:   20,
  maxLinksPerUserPerHour:      30,
  maxProposedPerDomainPerHour: 50,
  maxSameAuthorSupportLinks:   5,
  maxSingleAuthorConfidence:   0.25,
  similarityThreshold:         DUP_THRESH,
});

// ── Chat Profile (Loose Mode) ────────────────────────────────────────────
// Chat sits ABOVE Atlas, not inside it. No DTU writes, no status machine,
// no promotion gate, no submission objects. Just fast retrieval + synthesis.
export const CHAT_PROFILE = Object.freeze({
  validationLevel:            VALIDATION_LEVEL.OFF,
  contradictionGate:          "OFF",
  antiGaming:                 "NONE",
  sourceRequired:             false,
  promotionPolicy:            "NEVER",   // chat never auto-promotes
  dedupeRequired:             false,
  cycleCheckRequired:         false,
  maxRetrievalResults:        10,        // keep retrieval fast
  defaultRetrievalPolicy:     "LOCAL_THEN_GLOBAL",
  allowSpeculation:           true,
  allowBrainstorm:            true,
  showConfidenceBadge:        "ON_GLOBAL_REF",  // only when quoting Global DTUs
  showScopeLabels:            true,              // always label source scope
});

// ── Retrieval Policies ──────────────────────────────────────────────────────

export const RETRIEVAL_POLICY = Object.freeze({
  LOCAL_ONLY:               "LOCAL_ONLY",
  GLOBAL_ONLY:              "GLOBAL_ONLY",
  LOCAL_THEN_GLOBAL:        "LOCAL_THEN_GLOBAL",
  GLOBAL_THEN_LOCAL:        "GLOBAL_THEN_LOCAL",
  LOCAL_PLUS_GLOBAL:        "LOCAL_PLUS_GLOBAL",
  LOCAL_PLUS_GLOBAL_MARKET: "LOCAL_PLUS_GLOBAL_MARKET",
});

export const DEFAULT_RETRIEVAL_POLICY = RETRIEVAL_POLICY.LOCAL_THEN_GLOBAL;

// ── Helper: get auto-promote config for a given epistemic class ─────────────

export function getAutoPromoteConfig(epistemicClass) {
  return AUTO_PROMOTE_THRESHOLDS[epistemicClass] || AUTO_PROMOTE_THRESHOLDS.EMPIRICAL;
}

// ── Helper: get strictness profile for scope ────────────────────────────────

export function getStrictnessProfile(scope) {
  return STRICTNESS_PROFILES[scope] || STRICTNESS_PROFILES[SCOPES.LOCAL];
}

// ── Helper: get transitions for a scope + status ────────────────────────────

export function getLaneTransitions(scope) {
  if (scope === SCOPES.LOCAL) return LOCAL_TRANSITIONS;
  if (scope === SCOPES.MARKETPLACE) return MARKET_TRANSITIONS;
  return GLOBAL_TRANSITIONS;
}

export function canLaneTransition(scope, from, to) {
  const table = getLaneTransitions(scope);
  return (table[from] || []).includes(to);
}

// ── Helper: get initial status for a scope ──────────────────────────────────

export function getInitialStatus(scope) {
  if (scope === SCOPES.LOCAL) return LOCAL_STATUS.LOCAL_DRAFT;
  if (scope === SCOPES.MARKETPLACE) return MARKET_STATUS.LISTING_DRAFT;
  return GLOBAL_STATUS.DRAFT;
}
