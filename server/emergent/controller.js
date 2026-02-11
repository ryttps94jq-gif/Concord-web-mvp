/**
 * Emergent Agent Governance — Session Controller
 *
 * Orchestrates the full emergent dialogue pipeline with safety controls:
 *   - Session lifecycle management
 *   - Anti-runaway loop protection
 *   - Mandatory summary emission
 *   - Novelty decay / stop conditions
 *   - Consent boundary enforcement
 *
 * This is the "session controller issue" layer that prevents:
 *   - Silent self-reinforcement
 *   - Cognitive drift without user visibility
 *   - Unbounded dialogue loops
 */

import {
  SESSION_LIMITS,
  EMERGENT_ROLES,
  MEMORY_POLICIES,
} from "./schema.js";

import {
  getEmergentState,
  getSession,
  listEmergents,
} from "./store.js";

import {
  createDialogueSession,
  submitTurn,
  completeDialogueSession,
} from "./dialogue.js";

import {
  extractPatterns,
  distillSession,
  processReputationShift,
} from "./growth.js";

import { reviewBundle } from "./governance.js";

// ── Orchestrated Session Runner ─────────────────────────────────────────────

/**
 * Run a full dialogue session with all safety controls.
 * This is the main entry point for orchestrated emergent dialogues.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Session options
 * @param {string[]} opts.participantIds - Emergent IDs
 * @param {string} opts.topic - Session topic
 * @param {Object[]} opts.turns - Pre-planned turns to submit
 * @param {string[]} [opts.inputDtuIds] - Input DTU IDs
 * @param {string} [opts.userPrompt] - User prompt
 * @param {boolean} [opts.autoComplete=true] - Auto-complete when turns exhausted or stop condition met
 * @returns {{ ok: boolean, session: Object, results: Object[], bundle?: Object, growth?: Object }}
 */
export function runDialogueSession(STATE, opts = {}) {
  const {
    participantIds = [],
    topic = "untitled",
    turns = [],
    inputDtuIds = [],
    userPrompt = null,
    autoComplete = true,
  } = opts;

  // Create the session
  const sessionResult = createDialogueSession(STATE, {
    participantIds,
    topic,
    inputDtuIds,
    userPrompt,
    memoryPolicy: MEMORY_POLICIES.DISTILLED,
  });

  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error, details: sessionResult };
  }

  const sessionId = sessionResult.session.sessionId;
  const results = [];

  // Submit turns in order with safety checks
  for (const turn of turns) {
    const turnResult = submitTurn(STATE, sessionId, turn);
    results.push(turnResult);

    // Stop on gate failure
    if (!turnResult.ok) {
      break;
    }

    // Stop on stop condition
    if (turnResult.stopCondition?.shouldStop) {
      break;
    }
  }

  // Auto-complete if requested
  let bundle = null;
  let growth = null;
  if (autoComplete) {
    const completion = completeDialogueSession(STATE, sessionId);
    if (completion.ok) {
      bundle = completion.bundle;

      // Run growth pipeline
      growth = runGrowthPipeline(STATE, sessionId, bundle);
    }
  }

  return {
    ok: true,
    sessionId,
    session: getSession(getEmergentState(STATE), sessionId),
    results,
    bundle,
    growth,
  };
}

// ── Growth Pipeline ─────────────────────────────────────────────────────────

/**
 * Run the full growth pipeline after a session completes:
 *   1. Extract patterns
 *   2. Distill memory
 *   3. Process reputation shifts (if reviewed)
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Completed session
 * @param {Object} bundle - Output bundle
 * @returns {Object} Growth results
 */
function runGrowthPipeline(STATE, sessionId, bundle) {
  // 1. Extract patterns
  const promotedClaims = (bundle?.candidateDTUs || []).map(c => c.claim);
  const patterns = extractPatterns(STATE, sessionId, promotedClaims);

  // 2. Distill session into memory
  const distillation = distillSession(STATE, sessionId);

  return {
    patterns: patterns.ok ? patterns.patterns : [],
    distillation: distillation.ok ? distillation.distillation : null,
  };
}

// ── Consent & Routing ───────────────────────────────────────────────────────

/**
 * Check if an emergent can contact a user through a given lens.
 * Enforces the consent boundary: no emergent can initiate contact
 * outside an enabled lens, and no global "pop-in" behavior.
 *
 * @param {Object} STATE - Global server state
 * @param {string} emergentId - Emergent attempting contact
 * @param {string} targetUserId - Target user
 * @param {string} lens - Lens through which contact is attempted
 * @param {Object} [userPreferences] - User's consent preferences
 * @returns {{ allowed: boolean, reason: string }}
 */
export function checkContactConsent(STATE, emergentId, targetUserId, lens, userPreferences = {}) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);

  if (!emergent) {
    return { allowed: false, reason: "emergent_not_found" };
  }

  if (!emergent.active) {
    return { allowed: false, reason: "emergent_inactive" };
  }

  // Check scope
  if (!emergent.scope.includes(lens) && !emergent.scope.includes("*")) {
    return { allowed: false, reason: "out_of_scope", lens, scope: emergent.scope };
  }

  // Check user consent (opt-in only)
  const enabledLenses = userPreferences.emergentEnabledLenses || [];
  if (!enabledLenses.includes(lens) && !enabledLenses.includes("*")) {
    return { allowed: false, reason: "user_not_opted_in", lens };
  }

  // Check if user has blocked this emergent
  const blockedEmergents = userPreferences.blockedEmergents || [];
  if (blockedEmergents.includes(emergentId)) {
    return { allowed: false, reason: "user_blocked_emergent" };
  }

  return { allowed: true, reason: "consent_verified" };
}

// ── Status & Diagnostics ────────────────────────────────────────────────────

/**
 * Get the full status of the emergent system.
 *
 * @param {Object} STATE - Global server state
 * @returns {Object} System status
 */
export function getSystemStatus(STATE) {
  const es = getEmergentState(STATE);

  return {
    version: es.version,
    initialized: es.initialized,
    initializedAt: es.initializedAt,
    emergentCount: es.emergents.size,
    activeEmergents: listEmergents(es, { active: true }).length,
    activeSessions: es.activeSessions,
    totalSessions: es.metrics.sessionsCreated,
    completedSessions: es.metrics.sessionsCompleted,
    turnsProcessed: es.metrics.turnsProcessed,
    gateChecks: es.metrics.gateChecks,
    gateDenials: es.metrics.gateDenials,
    dtusProposed: es.metrics.dtusProposed,
    dtusPromoted: es.metrics.dtusPromoted,
    echoWarnings: es.metrics.echoWarnings,
    noveltyStops: es.metrics.noveltyStops,
    rateBlocks: es.metrics.rateBlocks,
    patternCount: es.patterns.size,
    specializationCount: es.specializations.length,
    sessionLimits: SESSION_LIMITS,
  };
}
