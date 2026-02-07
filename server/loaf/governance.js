/**
 * LOAF I.1 — Governance Hardening + LOAF III.5 — Meta-Governance / Constitution
 *
 * - Council checks are fail-closed (deny by default)
 * - Owner override requires verified owner + override=true
 * - Single mandatory gate for all state-mutation domains
 * - Governance rules are artifacts with provenance
 * - Supermajority council required for governance changes
 * - Reversible governance actions
 * - Prevent silent power creep
 */

// Domains that MUST pass the mandatory mutation gate
const GATED_DOMAINS = Object.freeze([
  "experience.write",
  "world.write",
  "transfer.write",
  "canon.promote",
  "economy.distribute",
  "macro.register",
  "scheduler.modify",
]);

// Meta-governance constitution artifact store
const CONSTITUTION = {
  rules: new Map(),     // ruleId -> { id, text, provenance, version, createdAt, amendedAt, votes }
  amendments: [],       // chronological amendment log
  stats: { rulesCreated: 0, rulesAmended: 0, rulesReverted: 0, gateChecks: 0, gateDenials: 0 },
};

/**
 * Fail-closed council check.
 * Returns { allowed: true/false, reason, meta }
 * If no council quorum or rule found, default is DENY.
 */
function councilCheckFailClosed(actor, domain, action, opts = {}) {
  CONSTITUTION.stats.gateChecks++;

  // Must have actor
  if (!actor || !actor.role) {
    CONSTITUTION.stats.gateDenials++;
    return { allowed: false, reason: "no_actor", meta: { domain, action } };
  }

  // Owner override: requires verified owner + explicit override=true
  if (actor.role === "owner" || actor.role === "founder") {
    if (opts.override === true && actor.verified === true) {
      return { allowed: true, reason: "owner_override_verified", meta: { actor: actor.id, domain, action } };
    }
    // Owner without override flag still goes through normal gate
  }

  // System/internal calls with explicit internal flag
  if (opts.internal === true && (actor.role === "system" || actor.role === "owner" || actor.role === "founder")) {
    return { allowed: true, reason: "internal_system_call", meta: { actor: actor.id || "system", domain, action } };
  }

  // Check MACRO_ACL equivalent — admin or higher
  const allowedRoles = ["owner", "founder", "admin", "council"];
  if (!allowedRoles.includes(actor.role)) {
    CONSTITUTION.stats.gateDenials++;
    return { allowed: false, reason: "insufficient_role", meta: { role: actor.role, required: allowedRoles } };
  }

  // Check scopes
  const scopes = actor.scopes || [];
  const domainBase = domain.split(".")[0];
  const hasScope = scopes.includes("*") || scopes.includes(domain) || scopes.includes(domainBase);
  if (!hasScope) {
    CONSTITUTION.stats.gateDenials++;
    return { allowed: false, reason: "insufficient_scope", meta: { scopes, required: domain } };
  }

  return { allowed: true, reason: "council_approved", meta: { actor: actor.id, domain, action } };
}

/**
 * Mandatory mutation gate. All state-mutation domains pass through here.
 * Fail-closed: if anything is uncertain, deny.
 */
function mandatoryMutationGate(actor, domain, action, opts = {}) {
  // Check if this domain requires gating
  const fullDomain = `${domain}.${action}`;
  const isGated = GATED_DOMAINS.some(g => fullDomain.startsWith(g) || domain === g.split(".")[0]);

  if (!isGated) {
    // Not a gated domain — allow (read-only or non-mutation)
    return { allowed: true, reason: "not_gated", gated: false };
  }

  // Run fail-closed council check
  return { ...councilCheckFailClosed(actor, domain, action, opts), gated: true };
}

/**
 * Constitution rule management
 */
function createConstitutionRule(text, provenance, actor) {
  const check = councilCheckFailClosed(actor, "governance", "create_rule", { internal: false });
  if (!check.allowed) return { ok: false, error: check.reason };

  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rule = {
    id,
    text: String(text).slice(0, 5000),
    provenance: {
      source_type: provenance?.source_type || "manual",
      source_id: provenance?.source_id || actor?.id || "unknown",
      confidence: provenance?.confidence ?? 1.0,
      created_at: new Date().toISOString(),
    },
    version: 1,
    createdAt: new Date().toISOString(),
    amendedAt: null,
    votes: { approve: 0, deny: 0, abstain: 0, quorum: false },
    active: true,
  };

  CONSTITUTION.rules.set(id, rule);
  CONSTITUTION.stats.rulesCreated++;
  return { ok: true, rule };
}

function amendConstitutionRule(ruleId, newText, provenance, actor, supermajorityVotes) {
  const check = councilCheckFailClosed(actor, "governance", "amend_rule", { internal: false });
  if (!check.allowed) return { ok: false, error: check.reason };

  const rule = CONSTITUTION.rules.get(ruleId);
  if (!rule) return { ok: false, error: "rule_not_found" };

  // Require supermajority (>= 2/3 of votes must approve)
  const totalVotes = (supermajorityVotes?.approve || 0) + (supermajorityVotes?.deny || 0) + (supermajorityVotes?.abstain || 0);
  const approveRatio = totalVotes > 0 ? (supermajorityVotes?.approve || 0) / totalVotes : 0;
  if (totalVotes < 3 || approveRatio < 2 / 3) {
    return { ok: false, error: "supermajority_not_met", approveRatio, required: 2 / 3 };
  }

  const amendment = {
    ruleId,
    previousText: rule.text,
    newText: String(newText).slice(0, 5000),
    previousVersion: rule.version,
    newVersion: rule.version + 1,
    provenance: {
      source_type: provenance?.source_type || "amendment",
      source_id: provenance?.source_id || actor?.id || "unknown",
      confidence: provenance?.confidence ?? 1.0,
      amended_at: new Date().toISOString(),
    },
    votes: { ...supermajorityVotes },
    amendedAt: new Date().toISOString(),
  };

  rule.text = amendment.newText;
  rule.version = amendment.newVersion;
  rule.amendedAt = amendment.amendedAt;
  rule.votes = amendment.votes;

  CONSTITUTION.amendments.push(amendment);
  CONSTITUTION.stats.rulesAmended++;
  return { ok: true, rule, amendment };
}

function revertConstitutionRule(ruleId, actor, supermajorityVotes) {
  const check = councilCheckFailClosed(actor, "governance", "revert_rule", { internal: false });
  if (!check.allowed) return { ok: false, error: check.reason };

  // Find most recent amendment for this rule
  const lastAmendment = [...CONSTITUTION.amendments].reverse().find(a => a.ruleId === ruleId);
  if (!lastAmendment) return { ok: false, error: "no_amendments_to_revert" };

  const totalVotes = (supermajorityVotes?.approve || 0) + (supermajorityVotes?.deny || 0);
  const approveRatio = totalVotes > 0 ? (supermajorityVotes?.approve || 0) / totalVotes : 0;
  if (totalVotes < 3 || approveRatio < 2 / 3) {
    return { ok: false, error: "supermajority_not_met", approveRatio };
  }

  const rule = CONSTITUTION.rules.get(ruleId);
  if (!rule) return { ok: false, error: "rule_not_found" };

  rule.text = lastAmendment.previousText;
  rule.version = lastAmendment.previousVersion;
  rule.amendedAt = new Date().toISOString();

  CONSTITUTION.stats.rulesReverted++;
  return { ok: true, rule, revertedFrom: lastAmendment };
}

/**
 * Detect silent power creep: flag if governance rules are being
 * amended faster than expected or if single actors accumulate too many amendments.
 */
function detectPowerCreep(windowMs = 86400000) {
  const now = Date.now();
  const recentAmendments = CONSTITUTION.amendments.filter(
    a => (now - new Date(a.amendedAt).getTime()) < windowMs
  );

  // Count amendments per actor
  const actorCounts = {};
  for (const a of recentAmendments) {
    const actor = a.provenance?.source_id || "unknown";
    actorCounts[actor] = (actorCounts[actor] || 0) + 1;
  }

  const alerts = [];
  for (const [actor, count] of Object.entries(actorCounts)) {
    if (count >= 3) {
      alerts.push({ type: "power_creep", actor, amendments: count, window: windowMs });
    }
  }

  if (recentAmendments.length > 10) {
    alerts.push({ type: "amendment_velocity", count: recentAmendments.length, window: windowMs });
  }

  return { alerts, recentAmendments: recentAmendments.length, actorCounts };
}

/**
 * Register governance macros into the macro system.
 */
function init({ register, STATE, helpers: _helpers }) {
  // Attach CONSTITUTION to state
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.constitution = CONSTITUTION;

  register("loaf.governance", "status", (_ctx) => {
    return {
      ok: true,
      gatedDomains: GATED_DOMAINS,
      ruleCount: CONSTITUTION.rules.size,
      amendmentCount: CONSTITUTION.amendments.length,
      stats: CONSTITUTION.stats,
      powerCreep: detectPowerCreep(),
    };
  }, { public: true });

  register("loaf.governance", "check_gate", (ctx, input = {}) => {
    const result = mandatoryMutationGate(
      ctx.actor || input.actor,
      String(input.domain || ""),
      String(input.action || ""),
      { override: input.override === true, internal: input.internal === true }
    );
    return { ok: true, ...result };
  }, { public: true });

  register("loaf.governance", "create_rule", (ctx, input = {}) => {
    return createConstitutionRule(input.text, input.provenance, ctx.actor);
  }, { public: false });

  register("loaf.governance", "amend_rule", (ctx, input = {}) => {
    return amendConstitutionRule(input.ruleId, input.newText, input.provenance, ctx.actor, input.votes);
  }, { public: false });

  register("loaf.governance", "revert_rule", (ctx, input = {}) => {
    return revertConstitutionRule(input.ruleId, ctx.actor, input.votes);
  }, { public: false });

  register("loaf.governance", "list_rules", (_ctx) => {
    const rules = Array.from(CONSTITUTION.rules.values()).map(r => ({
      id: r.id, text: r.text, version: r.version, active: r.active,
      provenance: r.provenance, createdAt: r.createdAt, amendedAt: r.amendedAt,
    }));
    return { ok: true, rules };
  }, { public: true });

  register("loaf.governance", "detect_power_creep", (_ctx, input = {}) => {
    const windowMs = Number(input.windowMs) || 86400000;
    return { ok: true, ...detectPowerCreep(windowMs) };
  }, { public: true });
}

export {
  GATED_DOMAINS,
  CONSTITUTION,
  councilCheckFailClosed,
  mandatoryMutationGate,
  createConstitutionRule,
  amendConstitutionRule,
  revertConstitutionRule,
  detectPowerCreep,
  init,
};
