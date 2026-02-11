/**
 * Emergent Agent Governance — Constitution (Norms & Invariants)
 *
 * Stage 9: Rules that cannot be overridden by growth.
 *
 * Formalizes:
 *   - immutable invariants (cannot be changed by any process)
 *   - versioned constitutional rules (can be amended with supermajority)
 *   - explicit "cannot be optimized away" constraints
 *
 * This prevents capability drift from becoming system drift.
 *
 * Three layers:
 *   1. IMMUTABLE — hardcoded, cannot be changed (e.g., "emergents may not decide")
 *   2. CONSTITUTIONAL — amendable only via supermajority vote
 *   3. POLICY — can be changed by governance with simple majority
 *
 * Every rule has:
 *   - unique ID
 *   - human-readable statement
 *   - machine-checkable predicate (function signature or tag)
 *   - category and severity
 *   - provenance (who created it, when, why)
 *   - amendment history (if constitutional)
 */

import { getEmergentState } from "./store.js";

// ── Rule Tiers ───────────────────────────────────────────────────────────────

export const RULE_TIERS = Object.freeze({
  IMMUTABLE:       "immutable",       // cannot be changed, ever
  CONSTITUTIONAL:  "constitutional",  // requires supermajority to amend
  POLICY:          "policy",          // can be changed by governance
});

export const ALL_RULE_TIERS = Object.freeze(Object.values(RULE_TIERS));

// ── Rule Categories ──────────────────────────────────────────────────────────

export const RULE_CATEGORIES = Object.freeze({
  AUTHORITY:        "authority",        // who can do what
  SAFETY:           "safety",           // harm prevention
  INTEGRITY:        "integrity",        // data/process integrity
  TRANSPARENCY:     "transparency",     // visibility requirements
  ACCOUNTABILITY:   "accountability",   // responsibility chains
  PRIVACY:          "privacy",          // data protection
  FAIRNESS:         "fairness",         // equitable treatment
  CONTINUITY:       "continuity",       // system persistence
});

// ── Severity Levels ──────────────────────────────────────────────────────────

export const VIOLATION_SEVERITY = Object.freeze({
  FATAL:    "fatal",      // immediate halt
  CRITICAL: "critical",   // block operation + alert
  WARNING:  "warning",    // allow but log
  INFO:     "info",       // log only
});

// ── Constitution Store ───────────────────────────────────────────────────────

/**
 * Get or initialize the constitution store.
 */
export function getConstitutionStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._constitution) {
    es._constitution = {
      rules: new Map(),             // ruleId -> Rule
      byTier: new Map(),            // tier -> Set<ruleId>
      byCategory: new Map(),        // category -> Set<ruleId>
      byTag: new Map(),             // tag -> Set<ruleId>

      // Amendment history
      amendments: [],               // { ruleId, oldVersion, newVersion, timestamp, votes, result }

      // Violation log
      violations: [],               // { ruleId, timestamp, context, severity, action }

      // Current version
      version: 1,
      lastAmended: null,

      metrics: {
        totalRules: 0,
        totalViolations: 0,
        totalAmendments: 0,
        violationsByCategory: {},
        violationsBySeverity: {},
      },
    };

    // Seed with immutable invariants
    seedImmutableRules(es._constitution);
  }
  return es._constitution;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. IMMUTABLE INVARIANTS (seeded at initialization)
// ═══════════════════════════════════════════════════════════════════════════════

function seedImmutableRules(store) {
  const immutables = [
    {
      id: "IMM-001",
      statement: "Emergents may speak; they may not decide.",
      description: "All decisions require governance approval. Emergents can propose but never unilaterally commit.",
      category: RULE_CATEGORIES.AUTHORITY,
      tags: ["emergent", "governance", "decision"],
      severity: VIOLATION_SEVERITY.FATAL,
    },
    {
      id: "IMM-002",
      statement: "All growth is gated by deterministic rules and governance.",
      description: "No capability expansion, specialization, or promotion happens without explicit rule checks and governance approval.",
      category: RULE_CATEGORIES.SAFETY,
      tags: ["growth", "gate", "governance"],
      severity: VIOLATION_SEVERITY.FATAL,
    },
    {
      id: "IMM-003",
      statement: "Every growth artifact has provenance.",
      description: "Patterns, skills, DTUs, and all system artifacts must trace back to their origin.",
      category: RULE_CATEGORIES.INTEGRITY,
      tags: ["provenance", "audit", "traceability"],
      severity: VIOLATION_SEVERITY.CRITICAL,
    },
    {
      id: "IMM-004",
      statement: "No self-reinforcing delusion loops.",
      description: "The system cannot use its own outputs as evidence for its own correctness without external verification.",
      category: RULE_CATEGORIES.INTEGRITY,
      tags: ["verification", "loop", "delusion"],
      severity: VIOLATION_SEVERITY.FATAL,
    },
    {
      id: "IMM-005",
      statement: "Everything is replayable.",
      description: "All state changes are event-sourced. The system can be reconstructed from the journal.",
      category: RULE_CATEGORIES.CONTINUITY,
      tags: ["journal", "replay", "determinism"],
      severity: VIOLATION_SEVERITY.CRITICAL,
    },
    {
      id: "IMM-006",
      statement: "No hidden telemetry or user profiling.",
      description: "The system never phones home, tracks users, or profiles behavior without explicit consent.",
      category: RULE_CATEGORIES.PRIVACY,
      tags: ["telemetry", "privacy", "consent"],
      severity: VIOLATION_SEVERITY.FATAL,
    },
    {
      id: "IMM-007",
      statement: "Cloud LLM usage is opt-in only.",
      description: "No data is sent to external AI services without explicit user authorization.",
      category: RULE_CATEGORIES.PRIVACY,
      tags: ["llm", "cloud", "consent"],
      severity: VIOLATION_SEVERITY.FATAL,
    },
    {
      id: "IMM-008",
      statement: "Fail-closed governance: when uncertain, deny.",
      description: "Governance checks default to denial. Only explicitly approved actions proceed.",
      category: RULE_CATEGORIES.SAFETY,
      tags: ["governance", "fail-closed", "default-deny"],
      severity: VIOLATION_SEVERITY.CRITICAL,
    },
    {
      id: "IMM-009",
      statement: "Self-analysis outputs go through the same verification pipeline as all other outputs.",
      description: "The system cannot bypass governance or verification for its own operational analysis.",
      category: RULE_CATEGORIES.INTEGRITY,
      tags: ["self-reference", "verification", "governance"],
      severity: VIOLATION_SEVERITY.CRITICAL,
    },
    {
      id: "IMM-010",
      statement: "No optimization may override constitutional rules.",
      description: "Scheduler learning, skill formation, and goal detection cannot modify or circumvent constitutional constraints.",
      category: RULE_CATEGORIES.SAFETY,
      tags: ["optimization", "constitution", "constraint"],
      severity: VIOLATION_SEVERITY.FATAL,
    },
  ];

  for (const rule of immutables) {
    const fullRule = {
      ruleId: rule.id,
      tier: RULE_TIERS.IMMUTABLE,
      statement: rule.statement,
      description: rule.description,
      category: rule.category,
      tags: rule.tags,
      severity: rule.severity,
      active: true,
      version: 1,
      createdAt: new Date().toISOString(),
      createdBy: "system_bootstrap",
      amendable: false,
    };

    store.rules.set(rule.id, fullRule);
    addToIndex(store.byTier, RULE_TIERS.IMMUTABLE, rule.id);
    addToIndex(store.byCategory, rule.category, rule.id);
    for (const tag of rule.tags) {
      addToIndex(store.byTag, tag, rule.id);
    }
    store.metrics.totalRules++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CONSTITUTIONAL RULES (amendable with supermajority)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add a constitutional or policy rule.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.statement - The rule (human-readable)
 * @param {string} opts.description - Detailed explanation
 * @param {string} opts.tier - "constitutional" or "policy" (not "immutable")
 * @param {string} opts.category - One of RULE_CATEGORIES
 * @param {string[]} [opts.tags] - Searchable tags
 * @param {string} [opts.severity] - Violation severity
 * @param {string} [opts.createdBy] - Who proposed this rule
 * @returns {{ ok: boolean, rule?: Object }}
 */
export function addRule(STATE, opts = {}) {
  const store = getConstitutionStore(STATE);

  if (!opts.statement) return { ok: false, error: "statement_required" };
  if (!opts.tier || opts.tier === RULE_TIERS.IMMUTABLE) {
    return { ok: false, error: "cannot_add_immutable_rules" };
  }
  if (!ALL_RULE_TIERS.includes(opts.tier)) {
    return { ok: false, error: "invalid_tier", allowed: ALL_RULE_TIERS.filter(t => t !== RULE_TIERS.IMMUTABLE) };
  }

  const ruleId = `${opts.tier === RULE_TIERS.CONSTITUTIONAL ? "CON" : "POL"}-${String(store.metrics.totalRules + 1).padStart(3, "0")}`;

  const rule = {
    ruleId,
    tier: opts.tier,
    statement: String(opts.statement).slice(0, 500),
    description: String(opts.description || "").slice(0, 2000),
    category: opts.category || RULE_CATEGORIES.INTEGRITY,
    tags: Array.isArray(opts.tags) ? opts.tags.slice(0, 20) : [],
    severity: opts.severity || VIOLATION_SEVERITY.WARNING,
    active: true,
    version: 1,
    createdAt: new Date().toISOString(),
    createdBy: opts.createdBy || "system",
    amendable: true,
  };

  store.rules.set(ruleId, rule);
  addToIndex(store.byTier, rule.tier, ruleId);
  addToIndex(store.byCategory, rule.category, ruleId);
  for (const tag of rule.tags) {
    addToIndex(store.byTag, tag, ruleId);
  }
  store.metrics.totalRules++;

  return { ok: true, rule };
}

/**
 * Amend a constitutional or policy rule.
 * Constitutional rules require supermajority (≥ 2/3 votes for).
 * Policy rules require simple majority (> 1/2 votes for).
 *
 * @param {Object} STATE - Global server state
 * @param {string} ruleId - Rule to amend
 * @param {Object} opts
 * @param {string} opts.newStatement - New statement text
 * @param {string} [opts.newDescription] - New description
 * @param {Object[]} opts.votes - Array of { voterId, vote: "for"|"against"|"abstain" }
 * @param {string} opts.reason - Why this amendment is being proposed
 * @returns {{ ok: boolean, amended?: boolean, reason?: string }}
 */
export function amendRule(STATE, ruleId, opts = {}) {
  const store = getConstitutionStore(STATE);
  const rule = store.rules.get(ruleId);

  if (!rule) return { ok: false, error: "rule_not_found" };
  if (!rule.amendable) return { ok: false, error: "rule_not_amendable" };
  if (rule.tier === RULE_TIERS.IMMUTABLE) return { ok: false, error: "cannot_amend_immutable" };

  if (!opts.newStatement) return { ok: false, error: "newStatement_required" };
  if (!Array.isArray(opts.votes) || opts.votes.length === 0) {
    return { ok: false, error: "votes_required" };
  }

  // Count votes
  const forVotes = opts.votes.filter(v => v.vote === "for").length;
  const againstVotes = opts.votes.filter(v => v.vote === "against").length;
  const totalVotes = forVotes + againstVotes;

  if (totalVotes === 0) return { ok: false, error: "no_valid_votes" };

  // Check threshold
  const threshold = rule.tier === RULE_TIERS.CONSTITUTIONAL ? 2 / 3 : 0.5;
  const ratio = forVotes / totalVotes;
  const passed = ratio > threshold;

  const amendment = {
    ruleId,
    oldVersion: rule.version,
    oldStatement: rule.statement,
    newStatement: String(opts.newStatement).slice(0, 500),
    votes: {
      for: forVotes,
      against: againstVotes,
      abstain: opts.votes.filter(v => v.vote === "abstain").length,
      total: opts.votes.length,
      ratio: Math.round(ratio * 100) / 100,
      threshold: Math.round(threshold * 100) / 100,
    },
    passed,
    reason: opts.reason || "no_reason_given",
    timestamp: new Date().toISOString(),
  };

  store.amendments.push(amendment);
  store.metrics.totalAmendments++;

  if (passed) {
    rule.statement = amendment.newStatement;
    if (opts.newDescription) rule.description = String(opts.newDescription).slice(0, 2000);
    rule.version++;
    store.version++;
    store.lastAmended = amendment.timestamp;
    amendment.newVersion = rule.version;
  }

  return { ok: true, amended: passed, amendment, rule: passed ? rule : undefined };
}

/**
 * Deactivate a policy rule (constitutional rules cannot be deactivated, only amended).
 */
export function deactivateRule(STATE, ruleId) {
  const store = getConstitutionStore(STATE);
  const rule = store.rules.get(ruleId);

  if (!rule) return { ok: false, error: "rule_not_found" };
  if (rule.tier === RULE_TIERS.IMMUTABLE) return { ok: false, error: "cannot_deactivate_immutable" };
  if (rule.tier === RULE_TIERS.CONSTITUTIONAL) return { ok: false, error: "cannot_deactivate_constitutional_use_amend" };

  rule.active = false;
  return { ok: true, rule };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. VIOLATION CHECKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check an action against all active rules.
 * Returns violations (if any) and whether the action should be blocked.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} context - The action context to check
 * @param {string} context.action - What is being attempted
 * @param {string} [context.domain] - Domain of the action
 * @param {string} [context.actorId] - Who is attempting the action
 * @param {string[]} [context.tags] - Tags to match against rule tags
 * @returns {{ ok: boolean, allowed: boolean, violations: Object[] }}
 */
export function checkRules(STATE, context = {}) {
  const store = getConstitutionStore(STATE);
  const violations = [];
  let blocked = false;

  const contextTags = new Set(context.tags || []);

  for (const rule of store.rules.values()) {
    if (!rule.active) continue;

    // Check if this rule is relevant to the context
    const relevant = rule.tags.some(t => contextTags.has(t));
    if (!relevant && contextTags.size > 0) continue;

    // Run the check (tag-based matching for now)
    const violation = evaluateRule(rule, context);
    if (violation) {
      violations.push({
        ruleId: rule.ruleId,
        tier: rule.tier,
        statement: rule.statement,
        severity: rule.severity,
        message: violation.message,
      });

      if (rule.severity === VIOLATION_SEVERITY.FATAL || rule.severity === VIOLATION_SEVERITY.CRITICAL) {
        blocked = true;
      }
    }
  }

  // Log violations
  for (const v of violations) {
    store.violations.push({
      ...v,
      context: { action: context.action, domain: context.domain, actorId: context.actorId },
      timestamp: new Date().toISOString(),
      blocked,
    });

    store.metrics.totalViolations++;
    store.metrics.violationsByCategory[v.ruleId] = (store.metrics.violationsByCategory[v.ruleId] || 0) + 1;
    store.metrics.violationsBySeverity[v.severity] = (store.metrics.violationsBySeverity[v.severity] || 0) + 1;
  }

  // Cap violation log
  if (store.violations.length > 5000) {
    store.violations = store.violations.slice(-2500);
  }

  return { ok: true, allowed: !blocked, violations };
}

/**
 * Evaluate a single rule against a context.
 * Returns null if no violation, or { message } if violated.
 */
function evaluateRule(rule, context) {
  // Rule-specific checks based on category and tags

  // IMM-001: Emergents may not decide
  if (rule.ruleId === "IMM-001") {
    if (context.action === "commit" && context.actorType === "emergent") {
      return { message: "Emergent attempted to commit directly without governance" };
    }
  }

  // IMM-002: All growth is gated
  if (rule.ruleId === "IMM-002") {
    if (context.action === "growth" && !context.gated) {
      return { message: "Growth action attempted without gate check" };
    }
  }

  // IMM-003: Provenance required
  if (rule.ruleId === "IMM-003") {
    if (context.action === "create" && !context.provenance) {
      return { message: "Artifact creation attempted without provenance" };
    }
  }

  // IMM-004: No self-reinforcing loops
  if (rule.ruleId === "IMM-004") {
    if (context.action === "verify" && context.selfReferential) {
      return { message: "Self-referential verification detected" };
    }
  }

  // IMM-008: Fail-closed governance
  if (rule.ruleId === "IMM-008") {
    if (context.action === "governance_bypass") {
      return { message: "Governance bypass attempted" };
    }
  }

  // IMM-010: No optimization may override constitution
  if (rule.ruleId === "IMM-010") {
    if (context.action === "optimize" && context.targetType === "constitution") {
      return { message: "Optimization attempted to modify constitutional constraints" };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. QUERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all rules, optionally filtered.
 */
export function getRules(STATE, filters = {}) {
  const store = getConstitutionStore(STATE);
  let results = Array.from(store.rules.values());

  if (filters.tier) results = results.filter(r => r.tier === filters.tier);
  if (filters.category) results = results.filter(r => r.category === filters.category);
  if (filters.active !== undefined) results = results.filter(r => r.active === filters.active);
  if (filters.tag) results = results.filter(r => r.tags.includes(filters.tag));

  return { ok: true, rules: results, count: results.length };
}

/**
 * Get a specific rule.
 */
export function getRule(STATE, ruleId) {
  const store = getConstitutionStore(STATE);
  const rule = store.rules.get(ruleId);
  if (!rule) return { ok: false, error: "not_found" };
  return { ok: true, rule };
}

/**
 * Get amendment history.
 */
export function getAmendmentHistory(STATE, ruleId) {
  const store = getConstitutionStore(STATE);
  const amendments = ruleId
    ? store.amendments.filter(a => a.ruleId === ruleId)
    : store.amendments;

  return { ok: true, amendments, count: amendments.length };
}

/**
 * Get violation history.
 */
export function getViolationHistory(STATE, filters = {}) {
  const store = getConstitutionStore(STATE);
  let results = store.violations;

  if (filters.ruleId) results = results.filter(v => v.ruleId === filters.ruleId);
  if (filters.severity) results = results.filter(v => v.severity === filters.severity);

  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;

  return { ok: true, violations: results.slice(offset, offset + limit), total: results.length };
}

/**
 * Get constitution metrics.
 */
export function getConstitutionMetrics(STATE) {
  const store = getConstitutionStore(STATE);
  return {
    ok: true,
    version: store.version,
    lastAmended: store.lastAmended,
    metrics: { ...store.metrics },
    rulesByTier: {
      immutable: store.byTier.get(RULE_TIERS.IMMUTABLE)?.size || 0,
      constitutional: store.byTier.get(RULE_TIERS.CONSTITUTIONAL)?.size || 0,
      policy: store.byTier.get(RULE_TIERS.POLICY)?.size || 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function addToIndex(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}
