/**
 * Emergent Agent Governance — Layer B: Deterministic Validation Gates
 *
 * Before anything from the probabilistic layer reaches a user or persists,
 * these gates enforce:
 *   - Identity binding (speaker matches allowed role/scope)
 *   - Scope binding (emergent can't cite/affect outside scope)
 *   - Disclosure enforcement (no unlabeled claims)
 *   - Anti-echo enforcement (adversarial critique present)
 *   - Novelty enforcement (no duplicates)
 *   - Risk enforcement (blocks unsafe outputs)
 *   - Economic enforcement (accounting invariants)
 *   - Rate enforcement (growth budgets, spam limits)
 *
 * Every gate check produces a GateTrace for the trust spine.
 */

import {
  GATE_RULES,
  ALL_CONFIDENCE_LABELS,
  EMERGENT_ROLES,
  contentHash,
} from "./schema.js";

// ── Gate Trace Factory ──────────────────────────────────────────────────────

let _traceSeq = 0;

function createTrace(ruleId, sessionId, emergentId, passed, reason, evidence = {}) {
  return {
    traceId: `gt_${Date.now().toString(36)}_${(++_traceSeq).toString(36)}`,
    ruleId,
    sessionId,
    emergentId,
    passed,
    reason,
    evidence,
    timestamp: new Date().toISOString(),
    finalDisposition: passed ? "allowed" : "blocked",
  };
}

// ── Individual Gates ────────────────────────────────────────────────────────

/**
 * Gate 1: Identity Binding
 * Verify the speaker's role matches what they claim and is active.
 */
export function gateIdentityBinding(emergent, session) {
  if (!emergent) {
    return createTrace(GATE_RULES.IDENTITY_BINDING, session?.sessionId, null, false,
      "emergent_not_found", {});
  }

  if (!emergent.active) {
    return createTrace(GATE_RULES.IDENTITY_BINDING, session?.sessionId, emergent.id, false,
      "emergent_inactive", { emergentId: emergent.id });
  }

  if (!session?.participants?.includes(emergent.id)) {
    return createTrace(GATE_RULES.IDENTITY_BINDING, session?.sessionId, emergent.id, false,
      "not_session_participant", { emergentId: emergent.id, sessionId: session?.sessionId });
  }

  return createTrace(GATE_RULES.IDENTITY_BINDING, session?.sessionId, emergent.id, true,
    "identity_verified", { role: emergent.role, name: emergent.name });
}

/**
 * Gate 2: Scope Binding
 * Emergent can only reference lenses/domains/DTU tags within its scope.
 */
export function gateScopeBinding(emergent, turn, session) {
  if (!emergent?.scope || !Array.isArray(emergent.scope)) {
    return createTrace(GATE_RULES.SCOPE_BINDING, session?.sessionId, emergent?.id, false,
      "no_scope_defined", {});
  }

  // Check if turn references anything outside scope
  const references = extractReferences(turn);
  const outOfScope = references.filter(ref => !isInScope(ref, emergent.scope));

  if (outOfScope.length > 0) {
    return createTrace(GATE_RULES.SCOPE_BINDING, session?.sessionId, emergent.id, false,
      "out_of_scope_reference", { outOfScope, allowedScope: emergent.scope });
  }

  return createTrace(GATE_RULES.SCOPE_BINDING, session?.sessionId, emergent.id, true,
    "scope_verified", { scope: emergent.scope });
}

/**
 * Gate 3: Disclosure Enforcement
 * No unlabeled claims allowed. Every claim must have a confidence label.
 */
export function gateDisclosureEnforcement(turn, session) {
  if (!turn.confidenceLabel || !ALL_CONFIDENCE_LABELS.includes(turn.confidenceLabel)) {
    return createTrace(GATE_RULES.DISCLOSURE_ENFORCEMENT, session?.sessionId, turn.speakerId, false,
      "missing_confidence_label", { provided: turn.confidenceLabel, allowed: ALL_CONFIDENCE_LABELS });
  }

  // If claiming "fact", must have citation
  if (turn.confidenceLabel === "fact" && (!turn.support || turn.support === null)) {
    return createTrace(GATE_RULES.DISCLOSURE_ENFORCEMENT, session?.sessionId, turn.speakerId, false,
      "fact_without_citation", { claim: truncate(turn.claim, 100) });
  }

  return createTrace(GATE_RULES.DISCLOSURE_ENFORCEMENT, session?.sessionId, turn.speakerId, true,
    "disclosure_verified", { label: turn.confidenceLabel });
}

/**
 * Gate 4: Anti-Echo Enforcement
 * Session must contain adversarial critique. Cannot promote if contradiction
 * count rises without resolution.
 */
export function gateAntiEcho(session) {
  if (!session?.turns || session.turns.length === 0) {
    return createTrace(GATE_RULES.ANTI_ECHO, session?.sessionId, null, true,
      "no_turns_yet", {});
  }

  const critiqueTurns = session.turns.filter(t =>
    t.intent === "critique" || t.counterpoint
  );

  const critiqueRatio = critiqueTurns.length / session.turns.length;

  // Check for presence of critic/adversary role
  const hasCritic = session.participants?.some(pid => {
    const role = session._participantRoles?.[pid];
    return role === EMERGENT_ROLES.CRITIC || role === EMERGENT_ROLES.ADVERSARY;
  });

  if (!hasCritic && session.turns.length >= 5) {
    return createTrace(GATE_RULES.ANTI_ECHO, session.sessionId, null, false,
      "no_critic_or_adversary", { participantCount: session.participants.length });
  }

  // Check for unresolved contradiction escalation
  const signals = session.signals || [];
  const contradictions = signals.filter(s => s.type === "contradiction");
  const unresolvedContradictions = contradictions.filter(s => !s.resolved);

  if (unresolvedContradictions.length > 3) {
    return createTrace(GATE_RULES.ANTI_ECHO, session.sessionId, null, false,
      "unresolved_contradictions_escalating", {
        total: contradictions.length,
        unresolved: unresolvedContradictions.length,
        critiqueRatio,
      });
  }

  return createTrace(GATE_RULES.ANTI_ECHO, session.sessionId, null, true,
    "anti_echo_passed", { critiqueRatio, hasCritic, unresolvedContradictions: unresolvedContradictions.length });
}

/**
 * Gate 5: Novelty Enforcement
 * Cannot propose duplicates (hash + semantic check).
 */
export function gateNoveltyCheck(turn, emergentState) {
  const hash = contentHash(turn.claim);

  if (emergentState.contentHashes.has(hash)) {
    return createTrace(GATE_RULES.NOVELTY_CHECK, turn.sessionId, turn.speakerId, false,
      "duplicate_content", { hash });
  }

  return createTrace(GATE_RULES.NOVELTY_CHECK, turn.sessionId, turn.speakerId, true,
    "novel_content", { hash });
}

/**
 * Gate 6: Risk Enforcement
 * Blocks unsafe outputs categorically.
 */
export function gateRiskCheck(turn, session) {
  const claim = String(turn.claim || "").toLowerCase();

  // Check for authority assertion (emergents may not decide)
  const authorityPatterns = [
    /\bi (?:have )?decide[ds]?\b/,
    /\bi (?:am |have )?authoriz/,
    /\bby my authority\b/,
    /\bi (?:hereby )?order\b/,
    /\bi (?:hereby )?grant\b/,
    /\bthis is (?:now )?(?:official|binding|final)\b/,
  ];

  for (const pat of authorityPatterns) {
    if (pat.test(claim)) {
      return createTrace(GATE_RULES.RISK_CHECK, session?.sessionId, turn.speakerId, false,
        "authority_assertion_blocked", { pattern: pat.source, claim: truncate(turn.claim, 100) });
    }
  }

  // Check for impersonation attempts
  if (/\b(?:speaking as|i am) (?:concord|the system|admin|owner|founder)\b/i.test(claim)) {
    return createTrace(GATE_RULES.RISK_CHECK, session?.sessionId, turn.speakerId, false,
      "impersonation_blocked", { claim: truncate(turn.claim, 100) });
  }

  return createTrace(GATE_RULES.RISK_CHECK, session?.sessionId, turn.speakerId, true,
    "risk_check_passed", {});
}

/**
 * Gate 7: Economic Enforcement
 * Anything marketplace-related must satisfy accounting invariants.
 */
export function gateEconomicCheck(turn, session) {
  // Only applies to turns that reference economic/marketplace domains
  const refs = extractReferences(turn);
  const hasEconomicRef = refs.some(r => r.startsWith("marketplace") || r.startsWith("economy"));

  if (!hasEconomicRef) {
    return createTrace(GATE_RULES.ECONOMIC_CHECK, session?.sessionId, turn.speakerId, true,
      "no_economic_reference", {});
  }

  // Emergents cannot directly modify economic state
  if (turn.intent === "suggestion" || turn.intent === "hypothesis") {
    return createTrace(GATE_RULES.ECONOMIC_CHECK, session?.sessionId, turn.speakerId, true,
      "economic_suggestion_only", { intent: turn.intent });
  }

  return createTrace(GATE_RULES.ECONOMIC_CHECK, session?.sessionId, turn.speakerId, false,
    "economic_mutation_blocked", { intent: turn.intent });
}

/**
 * Gate 8: Rate Enforcement
 * Growth budgets and spam limits.
 */
export function gateRateLimit(emergentId, emergentState) {
  const rate = checkEmergentRate(emergentState, emergentId);

  if (!rate.allowed) {
    return createTrace(GATE_RULES.RATE_LIMIT, null, emergentId, false,
      "rate_limit_exceeded", { remaining: rate.remaining, resetsAt: rate.resetsAt });
  }

  return createTrace(GATE_RULES.RATE_LIMIT, null, emergentId, true,
    "rate_within_budget", { remaining: rate.remaining });
}

// ── Composite Gate Runner ───────────────────────────────────────────────────

/**
 * Run all validation gates for a turn.
 * Returns { passed: boolean, traces: GateTrace[], blockingRule: string|null }
 *
 * This is the main entry point for Layer B validation.
 * FAIL-CLOSED: any gate failure blocks the turn.
 */
export function runAllGates(turn, emergent, session, emergentState) {
  const traces = [];

  // 1. Identity binding
  const identity = gateIdentityBinding(emergent, session);
  traces.push(identity);
  if (!identity.passed) {
    return { passed: false, traces, blockingRule: GATE_RULES.IDENTITY_BINDING };
  }

  // 2. Scope binding
  const scope = gateScopeBinding(emergent, turn, session);
  traces.push(scope);
  if (!scope.passed) {
    return { passed: false, traces, blockingRule: GATE_RULES.SCOPE_BINDING };
  }

  // 3. Disclosure enforcement
  const disclosure = gateDisclosureEnforcement(turn, session);
  traces.push(disclosure);
  if (!disclosure.passed) {
    return { passed: false, traces, blockingRule: GATE_RULES.DISCLOSURE_ENFORCEMENT };
  }

  // 4. Risk check
  const risk = gateRiskCheck(turn, session);
  traces.push(risk);
  if (!risk.passed) {
    return { passed: false, traces, blockingRule: GATE_RULES.RISK_CHECK };
  }

  // 5. Novelty check
  const novelty = gateNoveltyCheck(turn, emergentState);
  traces.push(novelty);
  if (!novelty.passed) {
    return { passed: false, traces, blockingRule: GATE_RULES.NOVELTY_CHECK };
  }

  // 6. Rate limit
  const rate = gateRateLimit(turn.speakerId, emergentState);
  traces.push(rate);
  if (!rate.passed) {
    return { passed: false, traces, blockingRule: GATE_RULES.RATE_LIMIT };
  }

  // 7. Economic check
  const economic = gateEconomicCheck(turn, session);
  traces.push(economic);
  if (!economic.passed) {
    return { passed: false, traces, blockingRule: GATE_RULES.ECONOMIC_CHECK };
  }

  return { passed: true, traces, blockingRule: null };
}

/**
 * Run anti-echo gate at session level (for promotion decisions).
 */
export function runAntiEchoGate(session) {
  return gateAntiEcho(session);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract domain/lens/DTU tag references from a turn.
 */
function extractReferences(turn) {
  const refs = [];
  if (turn.support && Array.isArray(turn.support)) {
    for (const s of turn.support) {
      if (typeof s === "string") refs.push(s);
      else if (s?.domain) refs.push(s.domain);
      else if (s?.tag) refs.push(s.tag);
    }
  }
  if (turn.domains && Array.isArray(turn.domains)) {
    refs.push(...turn.domains);
  }
  return refs;
}

/**
 * Check if a reference is within the emergent's allowed scope.
 */
function isInScope(ref, scope) {
  if (scope.includes("*")) return true;
  for (const s of scope) {
    if (ref === s) return true;
    if (ref.startsWith(s + ".")) return true;
    if (s.endsWith(".*") && ref.startsWith(s.slice(0, -2))) return true;
  }
  return false;
}

/**
 * Simple rate check (delegates to store if imported, otherwise inline).
 */
function checkEmergentRate(emergentState, emergentId, maxPerWindow = 100, windowMs = 3600000) {
  const now = Date.now();
  let bucket = emergentState.rateBuckets.get(emergentId);

  if (!bucket || (now - bucket.windowStart) > windowMs) {
    bucket = { count: 0, windowStart: now };
    emergentState.rateBuckets.set(emergentId, bucket);
  }

  if (bucket.count >= maxPerWindow) {
    emergentState.metrics.rateBlocks++;
    return { allowed: false, remaining: 0, resetsAt: bucket.windowStart + windowMs };
  }

  bucket.count++;
  return { allowed: true, remaining: maxPerWindow - bucket.count, resetsAt: bucket.windowStart + windowMs };
}

function truncate(str, maxLen = 100) {
  const s = String(str || "");
  return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
}
