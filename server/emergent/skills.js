/**
 * Emergent Agent Governance — Skill Formation
 *
 * Stage 3: Distill what worked into reusable "skills."
 *
 * Three skill types:
 *   1. Reasoning Templates — reusable multi-step reasoning chains
 *      extracted from successful sessions ("pattern acquisition" made actionable)
 *
 *   2. Macro Playbooks — "when you see X, run steps A→B→C"
 *      condition-action sequences learned from repeated patterns
 *
 *   3. Test Bundles — verification templates that automatically attach
 *      to proposals of a certain type/domain
 *
 * This is how performance improves without "getting smarter."
 * No LLM needed. Pure structure.
 */

import { getEmergentState, getPatterns } from "./store.js";

// ── Skill Types ──────────────────────────────────────────────────────────────

export const SKILL_TYPES = Object.freeze({
  REASONING_TEMPLATE:  "reasoning_template",
  MACRO_PLAYBOOK:      "macro_playbook",
  TEST_BUNDLE:         "test_bundle",
});

export const ALL_SKILL_TYPES = Object.freeze(Object.values(SKILL_TYPES));

// ── Skill Maturity Levels ────────────────────────────────────────────────────

export const SKILL_MATURITY = Object.freeze({
  CANDIDATE:    "candidate",     // extracted but unvalidated
  TESTED:       "tested",        // used at least once with positive outcome
  PROVEN:       "proven",        // used 5+ times with >60% success
  CANONICAL:    "canonical",     // adopted system-wide, governance-approved
  DEPRECATED:   "deprecated",    // no longer effective
});

// ── Skill Store ──────────────────────────────────────────────────────────────

/**
 * Get or initialize the skill store.
 */
export function getSkillStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._skills) {
    es._skills = {
      skills: new Map(),          // skillId -> Skill
      byType: new Map(),          // skillType -> Set<skillId>
      byDomain: new Map(),        // domain -> Set<skillId>
      byRole: new Map(),          // role -> Set<skillId>
      byWorkType: new Map(),      // workItemType -> Set<skillId>

      // Usage tracking
      usage: new Map(),           // skillId -> { applied, succeeded, failed, lastUsed }

      metrics: {
        totalSkills: 0,
        totalApplied: 0,
        totalSucceeded: 0,
        totalFailed: 0,
        skillsByMaturity: {},
      },
    };
  }
  return es._skills;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. REASONING TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a reasoning template from a successful pattern.
 *
 * A reasoning template is a structured multi-step reasoning chain:
 *   step 1: "identify the central claim" (role: builder)
 *   step 2: "find supporting evidence" (role: builder)
 *   step 3: "test for counterexamples" (role: critic)
 *   step 4: "synthesize if consistent" (role: synthesizer)
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.name - Human-readable name
 * @param {string} opts.sourcePatternId - Pattern this was derived from (provenance)
 * @param {string} [opts.domain] - Domain this applies to
 * @param {string} [opts.workType] - Work item type this applies to
 * @param {Object[]} opts.steps - Array of { role, action, constraints?, condition? }
 * @param {string[]} [opts.applicableRoles] - Roles that can use this template
 * @returns {{ ok: boolean, skill?: Object }}
 */
export function createReasoningTemplate(STATE, opts = {}) {
  const store = getSkillStore(STATE);

  if (!opts.name || !Array.isArray(opts.steps) || opts.steps.length === 0) {
    return { ok: false, error: "name_and_steps_required" };
  }

  // Validate steps
  for (let i = 0; i < opts.steps.length; i++) {
    const step = opts.steps[i];
    if (!step.role || !step.action) {
      return { ok: false, error: `step_${i}_missing_role_or_action` };
    }
  }

  const skillId = `skill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const skill = {
    skillId,
    type: SKILL_TYPES.REASONING_TEMPLATE,
    name: String(opts.name).slice(0, 200),
    domain: opts.domain || "*",
    workType: opts.workType || null,
    applicableRoles: Array.isArray(opts.applicableRoles) ? opts.applicableRoles : ["*"],
    maturity: SKILL_MATURITY.CANDIDATE,
    steps: opts.steps.map((s, i) => ({
      stepIndex: i,
      role: s.role,
      action: String(s.action).slice(0, 500),
      constraints: Array.isArray(s.constraints) ? s.constraints : [],
      condition: s.condition || null,  // "only if previous step found contradiction"
    })),
    provenance: {
      sourcePatternId: opts.sourcePatternId || null,
      createdAt: new Date().toISOString(),
      createdBy: opts.createdBy || "system",
    },
    version: 1,
  };

  store.skills.set(skillId, skill);
  indexSkill(store, skill);
  initUsage(store, skillId);
  store.metrics.totalSkills++;
  updateMaturityCounts(store);

  return { ok: true, skill };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MACRO PLAYBOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a macro playbook — a condition→action sequence.
 *
 * "When you see X, run steps A→B→C"
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.name - Human-readable name
 * @param {Object} opts.trigger - Condition that activates this playbook
 * @param {string} opts.trigger.type - "work_type" | "signal_threshold" | "pattern_match"
 * @param {*} opts.trigger.value - The condition value
 * @param {Object[]} opts.actions - Array of { action, params?, gated? }
 * @param {string} [opts.domain] - Domain this applies to
 * @returns {{ ok: boolean, skill?: Object }}
 */
export function createMacroPlaybook(STATE, opts = {}) {
  const store = getSkillStore(STATE);

  if (!opts.name || !opts.trigger || !Array.isArray(opts.actions) || opts.actions.length === 0) {
    return { ok: false, error: "name_trigger_and_actions_required" };
  }

  if (!opts.trigger.type || opts.trigger.value === undefined) {
    return { ok: false, error: "trigger_must_have_type_and_value" };
  }

  const skillId = `skill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const skill = {
    skillId,
    type: SKILL_TYPES.MACRO_PLAYBOOK,
    name: String(opts.name).slice(0, 200),
    domain: opts.domain || "*",
    workType: opts.workType || null,
    applicableRoles: Array.isArray(opts.applicableRoles) ? opts.applicableRoles : ["*"],
    maturity: SKILL_MATURITY.CANDIDATE,
    trigger: {
      type: opts.trigger.type,
      value: opts.trigger.value,
      description: opts.trigger.description || null,
    },
    actions: opts.actions.map((a, i) => ({
      actionIndex: i,
      action: String(a.action).slice(0, 500),
      params: a.params || {},
      gated: !!a.gated,  // requires governance approval before executing
    })),
    provenance: {
      sourcePatternId: opts.sourcePatternId || null,
      createdAt: new Date().toISOString(),
      createdBy: opts.createdBy || "system",
    },
    version: 1,
  };

  store.skills.set(skillId, skill);
  indexSkill(store, skill);
  initUsage(store, skillId);
  store.metrics.totalSkills++;
  updateMaturityCounts(store);

  return { ok: true, skill };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. TEST BUNDLES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a test bundle — verification checks that attach to proposals.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.name - Human-readable name
 * @param {string} opts.domain - Domain this test bundle applies to
 * @param {string} [opts.workType] - Work item type this auto-attaches to
 * @param {Object[]} opts.checks - Array of { name, type, rule, severity }
 * @returns {{ ok: boolean, skill?: Object }}
 */
export function createTestBundle(STATE, opts = {}) {
  const store = getSkillStore(STATE);

  if (!opts.name || !Array.isArray(opts.checks) || opts.checks.length === 0) {
    return { ok: false, error: "name_and_checks_required" };
  }

  const validCheckTypes = ["consistency", "completeness", "schema", "contradiction", "citation", "range"];
  for (let i = 0; i < opts.checks.length; i++) {
    const check = opts.checks[i];
    if (!check.name || !check.type) {
      return { ok: false, error: `check_${i}_missing_name_or_type` };
    }
    if (!validCheckTypes.includes(check.type)) {
      return { ok: false, error: `check_${i}_invalid_type`, allowed: validCheckTypes };
    }
  }

  const skillId = `skill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const skill = {
    skillId,
    type: SKILL_TYPES.TEST_BUNDLE,
    name: String(opts.name).slice(0, 200),
    domain: opts.domain || "*",
    workType: opts.workType || null,
    applicableRoles: ["auditor", "critic", "engineer"],
    maturity: SKILL_MATURITY.CANDIDATE,
    checks: opts.checks.map((c, i) => ({
      checkIndex: i,
      name: String(c.name).slice(0, 200),
      type: c.type,
      rule: c.rule || null,          // deterministic rule (regex, range, schema)
      severity: c.severity || "warning",  // "warning" | "error" | "info"
      description: c.description || null,
    })),
    provenance: {
      createdAt: new Date().toISOString(),
      createdBy: opts.createdBy || "system",
    },
    version: 1,
  };

  store.skills.set(skillId, skill);
  indexSkill(store, skill);
  initUsage(store, skillId);
  store.metrics.totalSkills++;
  updateMaturityCounts(store);

  return { ok: true, skill };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SKILL LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record that a skill was applied, with outcome.
 *
 * @param {Object} STATE - Global server state
 * @param {string} skillId - Skill that was applied
 * @param {boolean} succeeded - Whether the application succeeded
 * @param {Object} [context] - Additional context
 * @returns {{ ok: boolean, usage?: Object, maturityChanged?: boolean }}
 */
export function recordSkillApplication(STATE, skillId, succeeded, context = {}) {
  const store = getSkillStore(STATE);
  const skill = store.skills.get(skillId);
  if (!skill) return { ok: false, error: "skill_not_found" };

  const usage = store.usage.get(skillId);
  usage.applied++;
  if (succeeded) usage.succeeded++;
  else usage.failed++;
  usage.lastUsed = new Date().toISOString();
  usage.history.push({
    succeeded,
    timestamp: usage.lastUsed,
    context: Object.keys(context).length > 0 ? context : undefined,
  });

  // Cap history
  if (usage.history.length > 100) {
    usage.history = usage.history.slice(-50);
  }

  store.metrics.totalApplied++;
  if (succeeded) store.metrics.totalSucceeded++;
  else store.metrics.totalFailed++;

  // Auto-promote maturity based on track record
  const maturityChanged = autoPromoteMaturity(skill, usage);

  return { ok: true, usage: { ...usage, history: undefined }, maturityChanged };
}

/**
 * Get a specific skill.
 */
export function getSkill(STATE, skillId) {
  const store = getSkillStore(STATE);
  const skill = store.skills.get(skillId);
  if (!skill) return { ok: false, error: "not_found" };
  const usage = store.usage.get(skillId) || { applied: 0, succeeded: 0, failed: 0 };
  return { ok: true, skill, usage: { ...usage, history: undefined } };
}

/**
 * Query skills by type, domain, role, or work type.
 */
export function querySkills(STATE, filters = {}) {
  const store = getSkillStore(STATE);
  let results = Array.from(store.skills.values());

  if (filters.type) results = results.filter(s => s.type === filters.type);
  if (filters.domain) results = results.filter(s => s.domain === "*" || s.domain === filters.domain);
  if (filters.role) results = results.filter(s =>
    s.applicableRoles.includes("*") || s.applicableRoles.includes(filters.role)
  );
  if (filters.workType) results = results.filter(s => !s.workType || s.workType === filters.workType);
  if (filters.maturity) results = results.filter(s => s.maturity === filters.maturity);
  if (filters.minMaturity) {
    const levels = Object.values(SKILL_MATURITY);
    const minIdx = levels.indexOf(filters.minMaturity);
    results = results.filter(s => levels.indexOf(s.maturity) >= minIdx);
  }

  return { ok: true, skills: results, count: results.length };
}

/**
 * Find matching skills for a given work context.
 * Returns skills that could be applied to the current work item.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} context - { workType, domain, role }
 * @returns {{ ok: boolean, matches: Object[] }}
 */
export function findMatchingSkills(STATE, context = {}) {
  const store = getSkillStore(STATE);
  const matches = [];

  for (const skill of store.skills.values()) {
    if (skill.maturity === SKILL_MATURITY.DEPRECATED) continue;

    let score = 0;

    // Match by work type
    if (context.workType && skill.workType === context.workType) score += 3;
    else if (!skill.workType) score += 1;

    // Match by domain
    if (context.domain && (skill.domain === context.domain || skill.domain === "*")) score += 2;

    // Match by role
    if (context.role && (skill.applicableRoles.includes(context.role) || skill.applicableRoles.includes("*"))) score += 1;

    // Maturity bonus
    if (skill.maturity === SKILL_MATURITY.CANONICAL) score += 3;
    else if (skill.maturity === SKILL_MATURITY.PROVEN) score += 2;
    else if (skill.maturity === SKILL_MATURITY.TESTED) score += 1;

    if (score > 1) {
      const usage = store.usage.get(skill.skillId);
      matches.push({
        skillId: skill.skillId,
        name: skill.name,
        type: skill.type,
        maturity: skill.maturity,
        relevanceScore: score,
        successRate: usage && usage.applied > 0 ? usage.succeeded / usage.applied : null,
        timesApplied: usage ? usage.applied : 0,
      });
    }
  }

  matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return { ok: true, matches, count: matches.length };
}

/**
 * Distill patterns from the pattern store into skills.
 * Analyzes existing learned patterns and creates skills from recurring ones.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} [opts]
 * @param {number} [opts.minOccurrences=3] - Minimum similar patterns to form a skill
 * @returns {{ ok: boolean, created: Object[] }}
 */
export function distillPatternsToSkills(STATE, opts = {}) {
  const es = getEmergentState(STATE);
  const store = getSkillStore(STATE);
  const patterns = getPatterns(es, {});
  const minOccurrences = opts.minOccurrences || 3;

  // Group patterns by role sequence
  const sequenceGroups = {};
  for (const pattern of patterns) {
    const key = (pattern.template?.roleSequence || []).join("->");
    if (!sequenceGroups[key]) sequenceGroups[key] = [];
    sequenceGroups[key].push(pattern);
  }

  const created = [];

  for (const [sequence, group] of Object.entries(sequenceGroups)) {
    if (group.length < minOccurrences) continue;

    // Check if we already have a skill for this sequence
    const existing = Array.from(store.skills.values()).find(
      s => s.type === SKILL_TYPES.REASONING_TEMPLATE &&
           s._sourceSequence === sequence
    );
    if (existing) continue;

    // Build reasoning template from the pattern group
    const representative = group[0];
    const roleSeq = representative.template?.roleSequence || [];
    const intentSeq = representative.template?.intentSequence || [];

    const steps = roleSeq.map((role, i) => ({
      role,
      action: intentSeq[i] || "contribute",
      constraints: representative.constraints || [],
    }));

    const result = createReasoningTemplate(STATE, {
      name: `Distilled: ${sequence} (${group.length} patterns)`,
      sourcePatternId: representative.patternId,
      domain: "*",
      steps,
      applicableRoles: [...new Set(roleSeq)],
      createdBy: "skill_distillation",
    });

    if (result.ok) {
      result.skill._sourceSequence = sequence;
      created.push(result.skill);
    }
  }

  return { ok: true, created, count: created.length };
}

/**
 * Deprecate a skill (mark as no longer effective).
 */
export function deprecateSkill(STATE, skillId, reason) {
  const store = getSkillStore(STATE);
  const skill = store.skills.get(skillId);
  if (!skill) return { ok: false, error: "not_found" };

  skill.maturity = SKILL_MATURITY.DEPRECATED;
  skill._deprecatedAt = new Date().toISOString();
  skill._deprecationReason = reason || "no_reason_given";
  updateMaturityCounts(store);

  return { ok: true, skill };
}

/**
 * Get skill metrics.
 */
export function getSkillMetrics(STATE) {
  const store = getSkillStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    totalSkills: store.skills.size,
    byType: {
      reasoning_templates: countByType(store, SKILL_TYPES.REASONING_TEMPLATE),
      macro_playbooks: countByType(store, SKILL_TYPES.MACRO_PLAYBOOK),
      test_bundles: countByType(store, SKILL_TYPES.TEST_BUNDLE),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function indexSkill(store, skill) {
  addToIndex(store.byType, skill.type, skill.skillId);
  addToIndex(store.byDomain, skill.domain, skill.skillId);
  if (skill.workType) addToIndex(store.byWorkType, skill.workType, skill.skillId);
  for (const role of skill.applicableRoles) {
    addToIndex(store.byRole, role, skill.skillId);
  }
}

function addToIndex(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function initUsage(store, skillId) {
  store.usage.set(skillId, {
    applied: 0,
    succeeded: 0,
    failed: 0,
    lastUsed: null,
    history: [],
  });
}

function autoPromoteMaturity(skill, usage) {
  const oldMaturity = skill.maturity;

  if (skill.maturity === SKILL_MATURITY.DEPRECATED) return false;

  if (skill.maturity === SKILL_MATURITY.CANDIDATE && usage.applied >= 1 && usage.succeeded >= 1) {
    skill.maturity = SKILL_MATURITY.TESTED;
  }

  if (skill.maturity === SKILL_MATURITY.TESTED && usage.applied >= 5) {
    const rate = usage.succeeded / usage.applied;
    if (rate >= 0.6) {
      skill.maturity = SKILL_MATURITY.PROVEN;
    }
  }

  // Auto-deprecate: if applied 10+ times with <30% success
  if (usage.applied >= 10) {
    const rate = usage.succeeded / usage.applied;
    if (rate < 0.3) {
      skill.maturity = SKILL_MATURITY.DEPRECATED;
      skill._deprecatedAt = new Date().toISOString();
      skill._deprecationReason = "auto_deprecated_low_success_rate";
    }
  }

  return skill.maturity !== oldMaturity;
}

function updateMaturityCounts(store) {
  const counts = {};
  for (const skill of store.skills.values()) {
    counts[skill.maturity] = (counts[skill.maturity] || 0) + 1;
  }
  store.metrics.skillsByMaturity = counts;
}

function countByType(store, type) {
  return store.byType.has(type) ? store.byType.get(type).size : 0;
}
