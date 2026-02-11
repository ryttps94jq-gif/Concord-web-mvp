/**
 * Emergent Agent Governance — Module Entry Point
 *
 * Wires the emergent system into Concord's macro registry.
 * Follows the same init({ register, STATE, helpers }) pattern as LOAF modules.
 *
 * Non-negotiable invariants:
 *   1. Emergents may speak; they may not decide.
 *   2. All growth is gated (deterministic rules + governance).
 *   3. Every growth artifact has provenance.
 *   4. No self-reinforcing delusion loops.
 *   5. Everything is replayable.
 *
 * Three layers:
 *   A. Probabilistic Dialogue Engine (exploration)
 *   B. Deterministic Validation Gates (constraint)
 *   C. Governance / Promotion (becoming real)
 */

import {
  EMERGENT_ROLES,
  ALL_ROLES,
  CAPABILITIES,
  CONFIDENCE_LABELS,
  ALL_CONFIDENCE_LABELS,
  INTENT_TYPES,
  SESSION_LIMITS,
  MEMORY_POLICIES,
  GATE_RULES,
  TIER_THRESHOLDS,
  validateEmergent,
  validateTurnStructure,
} from "./schema.js";

import {
  getEmergentState,
  registerEmergent,
  getEmergent,
  listEmergents,
  deactivateEmergent,
  getSession,
  getOutputBundle,
  getGateTrace,
  getGateTracesForSession,
  getReputation,
  getPatterns,
} from "./store.js";

import {
  createDialogueSession,
  submitTurn,
  completeDialogueSession,
} from "./dialogue.js";

import {
  reviewBundle,
  requestSpecialization,
  createOutreach,
} from "./governance.js";

import {
  extractPatterns,
  distillSession,
  processReputationShift,
  recordContradictionCaught,
  recordPredictionValidated,
} from "./growth.js";

import {
  runDialogueSession,
  checkContactConsent,
  getSystemStatus,
} from "./controller.js";

const EMERGENT_VERSION = "1.0.0";

/**
 * Initialize the Emergent Agent Governance system.
 *
 * @param {Object} ctx - Server context
 * @param {Function} ctx.register - Macro registry function
 * @param {Object} ctx.STATE - Global server state
 * @param {Object} ctx.helpers - Utility functions
 */
function init({ register, STATE, helpers }) {
  const es = getEmergentState(STATE);
  es.initialized = true;
  es.initializedAt = new Date().toISOString();

  // ══════════════════════════════════════════════════════════════════════════
  // EMERGENT MANAGEMENT MACROS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * emergent.register — Register a new emergent agent
   */
  register("emergent", "register", (_ctx, input = {}) => {
    const emergent = {
      id: input.id || `em_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: String(input.name || "Unnamed Emergent"),
      role: input.role,
      scope: Array.isArray(input.scope) ? input.scope : ["*"],
      capabilities: Array.isArray(input.capabilities)
        ? input.capabilities
        : [CAPABILITIES.TALK, CAPABILITIES.PROPOSE],
      memoryPolicy: input.memoryPolicy || MEMORY_POLICIES.DISTILLED,
    };

    const validation = validateEmergent(emergent);
    if (!validation.valid) {
      return { ok: false, error: "invalid_emergent", validationErrors: validation.errors };
    }

    const registered = registerEmergent(es, emergent);
    return { ok: true, emergent: registered };
  }, { description: "Register a new emergent agent", public: false });

  /**
   * emergent.get — Get an emergent by ID
   */
  register("emergent", "get", (_ctx, input = {}) => {
    const emergent = getEmergent(es, input.id);
    if (!emergent) return { ok: false, error: "not_found" };
    const reputation = getReputation(es, input.id);
    return { ok: true, emergent, reputation };
  }, { description: "Get emergent by ID", public: true });

  /**
   * emergent.list — List all emergents
   */
  register("emergent", "list", (_ctx, input = {}) => {
    const emergents = listEmergents(es, {
      role: input.role,
      active: input.active,
    });
    return { ok: true, emergents, count: emergents.length };
  }, { description: "List all emergents", public: true });

  /**
   * emergent.deactivate — Deactivate an emergent
   */
  register("emergent", "deactivate", (_ctx, input = {}) => {
    const result = deactivateEmergent(es, input.id);
    if (!result) return { ok: false, error: "not_found" };
    return { ok: true, emergent: result };
  }, { description: "Deactivate an emergent", public: false });

  // ══════════════════════════════════════════════════════════════════════════
  // DIALOGUE SESSION MACROS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * emergent.session.create — Create a new dialogue session
   */
  register("emergent", "session.create", (_ctx, input = {}) => {
    return createDialogueSession(STATE, {
      participantIds: input.participantIds || [],
      topic: input.topic,
      inputDtuIds: input.inputDtuIds,
      inputArtifacts: input.inputArtifacts,
      userPrompt: input.userPrompt,
      memoryPolicy: input.memoryPolicy,
    });
  }, { description: "Create emergent dialogue session", public: false });

  /**
   * emergent.session.turn — Submit a turn to an active session
   */
  register("emergent", "session.turn", (_ctx, input = {}) => {
    return submitTurn(STATE, input.sessionId, {
      speakerId: input.speakerId,
      claim: input.claim,
      support: input.support !== undefined ? input.support : null,
      confidenceLabel: input.confidenceLabel,
      counterpoint: input.counterpoint,
      question: input.question,
      intent: input.intent,
      domains: input.domains,
    });
  }, { description: "Submit turn to dialogue session", public: false });

  /**
   * emergent.session.complete — Complete a dialogue session
   */
  register("emergent", "session.complete", (_ctx, input = {}) => {
    return completeDialogueSession(STATE, input.sessionId);
  }, { description: "Complete dialogue session and generate output bundle", public: false });

  /**
   * emergent.session.get — Get session details
   */
  register("emergent", "session.get", (_ctx, input = {}) => {
    const session = getSession(es, input.sessionId);
    if (!session) return { ok: false, error: "not_found" };
    return { ok: true, session };
  }, { description: "Get dialogue session details", public: true });

  /**
   * emergent.session.run — Run a full orchestrated dialogue
   */
  register("emergent", "session.run", (_ctx, input = {}) => {
    return runDialogueSession(STATE, {
      participantIds: input.participantIds,
      topic: input.topic,
      turns: input.turns || [],
      inputDtuIds: input.inputDtuIds,
      userPrompt: input.userPrompt,
      autoComplete: input.autoComplete !== false,
    });
  }, { description: "Run full orchestrated emergent dialogue", public: false });

  // ══════════════════════════════════════════════════════════════════════════
  // GOVERNANCE / PROMOTION MACROS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * emergent.review — Review an output bundle for promotion
   */
  register("emergent", "review", (_ctx, input = {}) => {
    return reviewBundle(STATE, input.bundleId, {
      votes: input.votes || [],
      targetTier: input.targetTier,
    });
  }, { description: "Review output bundle for promotion", public: false });

  /**
   * emergent.specialize — Request role specialization
   */
  register("emergent", "specialize", (_ctx, input = {}) => {
    return requestSpecialization(
      STATE,
      input.emergentId,
      input.newRole,
      input.justification,
      input.approvals || []
    );
  }, { description: "Request emergent role specialization", public: false });

  /**
   * emergent.outreach — Create outreach message to user
   */
  register("emergent", "outreach", (_ctx, input = {}) => {
    return createOutreach(STATE, {
      emergentId: input.emergentId,
      targetUserId: input.targetUserId,
      intent: input.intent,
      message: input.message,
      confidenceLabel: input.confidenceLabel,
      actionRequested: input.actionRequested,
      lens: input.lens,
    });
  }, { description: "Create emergent outreach message", public: false });

  /**
   * emergent.consent.check — Check contact consent
   */
  register("emergent", "consent.check", (_ctx, input = {}) => {
    const result = checkContactConsent(
      STATE,
      input.emergentId,
      input.targetUserId,
      input.lens,
      input.userPreferences || {}
    );
    return { ok: true, ...result };
  }, { description: "Check emergent contact consent", public: true });

  // ══════════════════════════════════════════════════════════════════════════
  // GROWTH MACROS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * emergent.growth.patterns — Extract patterns from a session
   */
  register("emergent", "growth.patterns", (_ctx, input = {}) => {
    return extractPatterns(STATE, input.sessionId, input.promotedClaims || []);
  }, { description: "Extract reasoning patterns from session", public: true });

  /**
   * emergent.growth.distill — Distill session into memory
   */
  register("emergent", "growth.distill", (_ctx, input = {}) => {
    return distillSession(STATE, input.sessionId);
  }, { description: "Distill session into candidate DTUs", public: true });

  /**
   * emergent.growth.reputation — Process reputation shifts
   */
  register("emergent", "growth.reputation", (_ctx, input = {}) => {
    return processReputationShift(STATE, input.bundleId, input.reviewResult || {});
  }, { description: "Process reputation shifts from review", public: false });

  /**
   * emergent.growth.contradiction — Record contradiction caught
   */
  register("emergent", "growth.contradiction", (_ctx, input = {}) => {
    return recordContradictionCaught(STATE, input.emergentId, input.sessionId);
  }, { description: "Record contradiction caught by emergent", public: false });

  /**
   * emergent.growth.prediction — Record prediction validated
   */
  register("emergent", "growth.prediction", (_ctx, input = {}) => {
    return recordPredictionValidated(STATE, input.emergentId, input.predictionRef);
  }, { description: "Record validated prediction", public: false });

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIT / STATUS MACROS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * emergent.status — Get system status
   */
  register("emergent", "status", (_ctx) => {
    return { ok: true, ...getSystemStatus(STATE) };
  }, { description: "Get emergent system status", public: true });

  /**
   * emergent.gate.trace — Get gate trace for a session
   */
  register("emergent", "gate.trace", (_ctx, input = {}) => {
    if (input.traceId) {
      const trace = getGateTrace(es, input.traceId);
      return trace ? { ok: true, trace } : { ok: false, error: "not_found" };
    }
    if (input.sessionId) {
      const traces = getGateTracesForSession(es, input.sessionId);
      return { ok: true, traces, count: traces.length };
    }
    return { ok: false, error: "provide traceId or sessionId" };
  }, { description: "Get gate traces for auditing", public: true });

  /**
   * emergent.bundle.get — Get an output bundle
   */
  register("emergent", "bundle.get", (_ctx, input = {}) => {
    const bundle = getOutputBundle(es, input.bundleId);
    if (!bundle) return { ok: false, error: "not_found" };
    return { ok: true, bundle };
  }, { description: "Get output bundle", public: true });

  /**
   * emergent.patterns — List learned patterns
   */
  register("emergent", "patterns", (_ctx, input = {}) => {
    const patterns = getPatterns(es, {
      role: input.role,
      emergentId: input.emergentId,
    });
    return { ok: true, patterns, count: patterns.length };
  }, { description: "List learned reasoning patterns", public: true });

  /**
   * emergent.reputation — Get reputation for an emergent
   */
  register("emergent", "reputation", (_ctx, input = {}) => {
    const rep = getReputation(es, input.emergentId);
    if (!rep) return { ok: false, error: "not_found" };
    return { ok: true, reputation: rep };
  }, { description: "Get emergent reputation", public: true });

  /**
   * emergent.schema — Get system schema and constants
   */
  register("emergent", "schema", (_ctx) => {
    return {
      ok: true,
      version: EMERGENT_VERSION,
      roles: ALL_ROLES,
      capabilities: Object.values(CAPABILITIES),
      confidenceLabels: ALL_CONFIDENCE_LABELS,
      intentTypes: Object.values(INTENT_TYPES),
      memoryPolicies: Object.values(MEMORY_POLICIES),
      gateRules: Object.values(GATE_RULES),
      tierThresholds: TIER_THRESHOLDS,
      sessionLimits: SESSION_LIMITS,
    };
  }, { description: "Get emergent system schema", public: true });

  // Log initialization
  if (helpers?.log) {
    helpers.log("emergent.init", `Emergent Agent Governance v${EMERGENT_VERSION} initialized`);
  }

  return {
    ok: true,
    version: EMERGENT_VERSION,
    macroCount: 22,
  };
}

export {
  EMERGENT_VERSION,
  init,
  // Re-export for direct access
  getEmergentState,
  registerEmergent,
  getEmergent,
  listEmergents,
  createDialogueSession,
  submitTurn,
  completeDialogueSession,
  reviewBundle,
  requestSpecialization,
  createOutreach,
  extractPatterns,
  distillSession,
  runDialogueSession,
  checkContactConsent,
  getSystemStatus,
};
