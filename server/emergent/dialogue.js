/**
 * Emergent Agent Governance — Layer A: Probabilistic Dialogue Engine
 *
 * Manages emergent-to-emergent dialogue sessions with:
 *   - Role-bound generation
 *   - Turn budget enforcement
 *   - Novelty pressure
 *   - Mandatory critique loops
 *   - Signal tracking (coherence, contradiction, novelty, risk)
 *
 * Mandatory structure per turn:
 *   - claim
 *   - support (DTU cites or null for "no cite")
 *   - confidence label
 *   - counterpoint or question
 *
 * Required roles in every serious session:
 *   - Builder (constructs)
 *   - Critic (attacks)
 *   - Synthesizer (integrates)
 */

import {
  EMERGENT_ROLES,
  SESSION_LIMITS,
  MEMORY_POLICIES,
  INTENT_TYPES,
  SESSION_SIGNAL_TYPES,
  CONFIDENCE_LABELS,
  validateTurnStructure,
  contentHash,
} from "./schema.js";

import { runAllGates, runAntiEchoGate } from "./gates.js";
import {
  getEmergentState,
  createSession as storeSession,
  getSession,
  completeSession,
  storeGateTrace,
  storeOutputBundle,
} from "./store.js";
import { recordTick } from "./subjective-time.js";

// ── Session Factory ─────────────────────────────────────────────────────────

let _sessionSeq = 0;

/**
 * Create a new dialogue session.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts - Session options
 * @param {string[]} opts.participantIds - Emergent IDs to participate
 * @param {string} opts.topic - Session topic
 * @param {string[]} [opts.inputDtuIds] - Input DTU IDs
 * @param {Object[]} [opts.inputArtifacts] - Input artifacts
 * @param {string} [opts.userPrompt] - Initiating user prompt
 * @param {string} [opts.memoryPolicy] - Memory retention policy
 * @returns {{ ok: boolean, session?: Object, error?: string }}
 */
export function createDialogueSession(STATE, opts = {}) {
  const es = getEmergentState(STATE);

  // Enforce concurrent session limit
  if (es.activeSessions >= SESSION_LIMITS.MAX_CONCURRENT) {
    return { ok: false, error: "max_concurrent_sessions_reached", limit: SESSION_LIMITS.MAX_CONCURRENT };
  }

  const {
    participantIds = [],
    topic = "untitled",
    inputDtuIds = [],
    inputArtifacts = [],
    userPrompt = null,
    memoryPolicy = MEMORY_POLICIES.DISTILLED,
  } = opts;

  // Validate participants exist and are active
  const participants = [];
  const participantRoles = {};
  for (const pid of participantIds) {
    const emergent = es.emergents.get(pid);
    if (!emergent) {
      return { ok: false, error: `emergent_not_found: ${pid}` };
    }
    if (!emergent.active) {
      return { ok: false, error: `emergent_inactive: ${pid}` };
    }
    participants.push(pid);
    participantRoles[pid] = emergent.role;
  }

  // Validate required roles (Builder + Critic + Synthesizer)
  const roles = Object.values(participantRoles);
  const missingRoles = [];
  if (!roles.includes(EMERGENT_ROLES.BUILDER)) missingRoles.push(EMERGENT_ROLES.BUILDER);
  if (!roles.includes(EMERGENT_ROLES.CRITIC) && !roles.includes(EMERGENT_ROLES.ADVERSARY)) {
    missingRoles.push(`${EMERGENT_ROLES.CRITIC} or ${EMERGENT_ROLES.ADVERSARY}`);
  }
  if (!roles.includes(EMERGENT_ROLES.SYNTHESIZER)) missingRoles.push(EMERGENT_ROLES.SYNTHESIZER);

  if (missingRoles.length > 0) {
    return { ok: false, error: "missing_required_roles", missingRoles };
  }

  const sessionId = `es_${Date.now().toString(36)}_${(++_sessionSeq).toString(36)}`;

  const session = {
    sessionId,
    participants,
    _participantRoles: participantRoles,
    topic: String(topic).slice(0, 500),
    inputs: {
      dtuIds: inputDtuIds,
      artifacts: inputArtifacts,
      userPrompt: userPrompt ? String(userPrompt).slice(0, 5000) : null,
    },
    turns: [],
    signals: [],
    outputBundle: null,
    status: "active",
    memoryPolicy,
    createdAt: new Date().toISOString(),
    completedAt: null,

    // Internal tracking
    _turnCount: 0,
    _noveltyScores: [],
    _lastSummaryAt: 0,
    _contradictionCount: 0,
    _unresolvedContradictions: 0,
  };

  storeSession(es, session);
  return { ok: true, session };
}

// ── Turn Submission ─────────────────────────────────────────────────────────

/**
 * Submit a turn to an active dialogue session.
 * Runs all Layer B gates before accepting.
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Target session
 * @param {Object} turn - Turn data
 * @returns {{ ok: boolean, turn?: Object, traces?: Object[], error?: string }}
 */
export function submitTurn(STATE, sessionId, turn) {
  const es = getEmergentState(STATE);
  const session = getSession(es, sessionId);

  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  if (session.status !== "active") {
    return { ok: false, error: "session_not_active", status: session.status };
  }

  // Check turn budget
  if (session._turnCount >= SESSION_LIMITS.MAX_TURNS) {
    return { ok: false, error: "turn_budget_exhausted", maxTurns: SESSION_LIMITS.MAX_TURNS };
  }

  // Validate turn structure
  const validation = validateTurnStructure(turn);
  if (!validation.valid) {
    return { ok: false, error: "invalid_turn_structure", validationErrors: validation.errors };
  }

  // Get speaker emergent
  const emergent = es.emergents.get(turn.speakerId);

  // Classify intent if not provided
  if (!turn.intent) {
    turn.intent = classifyIntent(turn);
  }

  // ── Run Layer B gates ───────────────────────────────────────────────────
  const gateResult = runAllGates(turn, emergent, session, es);

  // Store all gate traces
  for (const trace of gateResult.traces) {
    trace.sessionId = sessionId;
    storeGateTrace(es, trace);
  }

  if (!gateResult.passed) {
    return {
      ok: false,
      error: "gate_blocked",
      blockingRule: gateResult.blockingRule,
      traces: gateResult.traces,
    };
  }

  // ── Accept the turn ─────────────────────────────────────────────────────

  // Register content hash for novelty tracking
  const hash = contentHash(turn.claim);
  es.contentHashes.add(hash);

  const acceptedTurn = {
    turnIndex: session._turnCount,
    speakerId: turn.speakerId,
    speakerRole: emergent?.role || "unknown",
    claim: String(turn.claim).slice(0, 5000),
    support: turn.support,
    confidenceLabel: turn.confidenceLabel,
    counterpoint: turn.counterpoint || null,
    question: turn.question || null,
    intent: turn.intent,
    contentHash: hash,
    timestamp: new Date().toISOString(),
    gateTraceIds: gateResult.traces.map(t => t.traceId),
  };

  session.turns.push(acceptedTurn);
  session._turnCount++;
  es.metrics.turnsProcessed++;

  // ── Record subjective time tick for the speaking emergent ──────────────
  try {
    const existingHashes = new Set(session.turns.slice(0, -1).map(t => t.contentHash));
    const isNovel = !existingHashes.has(acceptedTurn.contentHash);
    const isEcho = !isNovel && session._turnCount > 3;
    const depth = acceptedTurn.confidenceLabel === "derived" || acceptedTurn.confidenceLabel === "fact" ? 1 : 0;
    recordTick(STATE, acceptedTurn.speakerId, { isNovel, isEcho, depth });
  } catch (_) { /* best-effort: don't block turns on time tracking */ }

  // ── Update session signals ──────────────────────────────────────────────
  updateSessionSignals(session, acceptedTurn);

  // ── Check stop conditions ───────────────────────────────────────────────
  const stopCheck = checkStopConditions(session);

  // ── Emit summary if interval reached ────────────────────────────────────
  let summary = null;
  if (session._turnCount - session._lastSummaryAt >= SESSION_LIMITS.SUMMARY_INTERVAL) {
    summary = generateSessionSummary(session);
    session._lastSummaryAt = session._turnCount;
  }

  return {
    ok: true,
    turn: acceptedTurn,
    traces: gateResult.traces,
    stopCondition: stopCheck.shouldStop ? stopCheck : null,
    summary,
  };
}

// ── Session Completion ──────────────────────────────────────────────────────

/**
 * Complete a dialogue session and generate the output bundle.
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Session to complete
 * @returns {{ ok: boolean, bundle?: Object, error?: string }}
 */
export function completeDialogueSession(STATE, sessionId) {
  const es = getEmergentState(STATE);
  const session = getSession(es, sessionId);

  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  if (session.status !== "active") {
    return { ok: false, error: "session_already_completed" };
  }

  // Run anti-echo gate before allowing completion
  const antiEcho = runAntiEchoGate(session);
  storeGateTrace(es, antiEcho);

  // Generate the output bundle
  const bundle = generateOutputBundle(session, es);
  storeOutputBundle(es, bundle);

  // Attach bundle to session
  session.outputBundle = bundle.bundleId;

  // Mark session complete (applies memory policy)
  completeSession(es, sessionId);

  return {
    ok: true,
    bundle,
    antiEchoTrace: antiEcho,
    sessionSummary: generateSessionSummary(session),
  };
}

// ── Output Bundle Generation ────────────────────────────────────────────────

/**
 * Generate the output bundle (growth payload) from a completed session.
 */
function generateOutputBundle(session, emergentState) {
  const bundleId = `ob_${Date.now().toString(36)}_${session.sessionId}`;

  // Extract candidate DTUs from builder turns with sufficient confidence
  const candidateDTUs = session.turns
    .filter(t =>
      t.speakerRole === EMERGENT_ROLES.BUILDER &&
      (t.confidenceLabel === CONFIDENCE_LABELS.FACT || t.confidenceLabel === CONFIDENCE_LABELS.DERIVED)
    )
    .map(t => ({
      claim: t.claim,
      support: t.support,
      confidenceLabel: t.confidenceLabel,
      proposedBy: t.speakerId,
      turnIndex: t.turnIndex,
    }));

  // Extract candidate edits from turns that reference existing DTUs
  const candidateEdits = session.turns
    .filter(t => t.support && Array.isArray(t.support) && t.support.some(s => typeof s === "string" && s.startsWith("dtu_")))
    .map(t => ({
      claim: t.claim,
      targetDtuIds: (t.support || []).filter(s => typeof s === "string" && s.startsWith("dtu_")),
      proposedBy: t.speakerId,
      confidenceLabel: t.confidenceLabel,
      turnIndex: t.turnIndex,
    }));

  // Extract tests from critic/adversary turns
  const tests = session.turns
    .filter(t =>
      (t.speakerRole === EMERGENT_ROLES.CRITIC || t.speakerRole === EMERGENT_ROLES.ADVERSARY) &&
      t.counterpoint
    )
    .map(t => ({
      test: t.counterpoint,
      targetClaim: session.turns[t.turnIndex > 0 ? t.turnIndex - 1 : 0]?.claim || null,
      proposedBy: t.speakerId,
      turnIndex: t.turnIndex,
    }));

  // Collect unresolved conflicts
  const conflicts = (session.signals || [])
    .filter(s => s.type === SESSION_SIGNAL_TYPES.CONTRADICTION && !s.resolved)
    .map(s => ({
      description: s.description,
      involvedTurns: s.turnIndices || [],
      severity: s.severity || "medium",
    }));

  // Collect all citations
  const citations = [];
  for (const t of session.turns) {
    if (t.support && Array.isArray(t.support)) {
      for (const s of t.support) {
        if (typeof s === "string") citations.push({ ref: s, turnIndex: t.turnIndex, speakerId: t.speakerId });
      }
    }
  }

  // Confidence label distribution
  const confidenceLabels = {};
  for (const t of session.turns) {
    confidenceLabels[t.confidenceLabel] = (confidenceLabels[t.confidenceLabel] || 0) + 1;
  }

  // Promotion requests from synthesizer turns
  const promotionRequests = session.turns
    .filter(t => t.speakerRole === EMERGENT_ROLES.SYNTHESIZER && t.intent === "suggestion")
    .map(t => ({
      claim: t.claim,
      requestedTier: "regular",  // default; upgrade logic is in governance layer
      reason: t.support ? `supported by ${(t.support || []).length} citations` : "synthesized",
      proposedBy: t.speakerId,
      turnIndex: t.turnIndex,
    }));

  emergentState.metrics.dtusProposed += candidateDTUs.length;

  return {
    bundleId,
    sessionId: session.sessionId,
    topic: session.topic,
    candidateDTUs,
    candidateEdits,
    tests,
    conflicts,
    citations,
    confidenceLabels,
    promotionRequests,
    provenance: {
      sessionId: session.sessionId,
      participants: session.participants,
      participantRoles: session._participantRoles,
      turnCount: session._turnCount,
      createdAt: session.createdAt,
      completedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

// ── Signal Tracking ─────────────────────────────────────────────────────────

/**
 * Update session signals after each accepted turn.
 */
function updateSessionSignals(session, turn) {
  // Novelty score: simple heuristic based on unique content
  const existingHashes = new Set(session.turns.slice(0, -1).map(t => t.contentHash));
  const isNovel = !existingHashes.has(turn.contentHash);
  const noveltyScore = isNovel ? 1.0 : 0.0;
  session._noveltyScores.push(noveltyScore);

  // Check for contradiction (if counterpoint exists, register as potential contradiction)
  if (turn.counterpoint) {
    const signal = {
      type: SESSION_SIGNAL_TYPES.CONTRADICTION,
      description: `Counterpoint by ${turn.speakerId}: ${truncate(turn.counterpoint, 200)}`,
      turnIndices: [turn.turnIndex],
      severity: turn.confidenceLabel === "fact" ? "high" : "medium",
      resolved: false,
      timestamp: turn.timestamp,
    };
    session.signals.push(signal);
    session._contradictionCount++;
    session._unresolvedContradictions++;
  }

  // Check for resolution (synthesizer turns can resolve contradictions)
  if (turn.speakerRole === EMERGENT_ROLES.SYNTHESIZER && turn.intent === "synthesis") {
    // Mark up to one unresolved contradiction as resolved
    const unresolved = session.signals.find(
      s => s.type === SESSION_SIGNAL_TYPES.CONTRADICTION && !s.resolved
    );
    if (unresolved) {
      unresolved.resolved = true;
      session._unresolvedContradictions = Math.max(0, session._unresolvedContradictions - 1);
    }
  }

  // Echo warning if novelty drops
  const recentNovelty = session._noveltyScores.slice(-5);
  const avgNovelty = recentNovelty.reduce((a, b) => a + b, 0) / recentNovelty.length;
  if (avgNovelty < SESSION_LIMITS.NOVELTY_FLOOR && session._turnCount > 5) {
    session.signals.push({
      type: SESSION_SIGNAL_TYPES.ECHO_WARNING,
      description: `Novelty dropped to ${avgNovelty.toFixed(2)} (floor: ${SESSION_LIMITS.NOVELTY_FLOOR})`,
      turnIndices: [turn.turnIndex],
      timestamp: turn.timestamp,
    });
  }
}

// ── Stop Conditions ─────────────────────────────────────────────────────────

/**
 * Check whether the session should stop.
 */
function checkStopConditions(session) {
  // Hard turn limit
  if (session._turnCount >= SESSION_LIMITS.MAX_TURNS) {
    return { shouldStop: true, reason: "turn_budget_exhausted" };
  }

  // Novelty decay stop
  const recentNovelty = session._noveltyScores.slice(-SESSION_LIMITS.MAX_TURNS_NO_NOVELTY);
  if (recentNovelty.length >= SESSION_LIMITS.MAX_TURNS_NO_NOVELTY) {
    const avgNovelty = recentNovelty.reduce((a, b) => a + b, 0) / recentNovelty.length;
    if (avgNovelty < SESSION_LIMITS.NOVELTY_FLOOR) {
      return { shouldStop: true, reason: "novelty_floor_breached", avgNovelty };
    }
  }

  // Unresolved contradiction escalation
  if (session._unresolvedContradictions > 5) {
    return { shouldStop: true, reason: "unresolved_contradictions_limit", count: session._unresolvedContradictions };
  }

  return { shouldStop: false };
}

// ── Session Summary ─────────────────────────────────────────────────────────

/**
 * Generate a summary of the session's current state.
 */
function generateSessionSummary(session) {
  const roleDistribution = {};
  for (const t of session.turns) {
    roleDistribution[t.speakerRole] = (roleDistribution[t.speakerRole] || 0) + 1;
  }

  const confidenceDistribution = {};
  for (const t of session.turns) {
    confidenceDistribution[t.confidenceLabel] = (confidenceDistribution[t.confidenceLabel] || 0) + 1;
  }

  const recentNovelty = session._noveltyScores.slice(-10);
  const avgNovelty = recentNovelty.length > 0
    ? recentNovelty.reduce((a, b) => a + b, 0) / recentNovelty.length
    : 1.0;

  return {
    sessionId: session.sessionId,
    topic: session.topic,
    status: session.status,
    turnCount: session._turnCount,
    roleDistribution,
    confidenceDistribution,
    avgNovelty,
    contradictions: session._contradictionCount,
    unresolvedContradictions: session._unresolvedContradictions,
    signalCount: session.signals.length,
    participants: session.participants,
  };
}

// ── Intent Classification ───────────────────────────────────────────────────

/**
 * Classify the intent of a turn based on its content and speaker role.
 */
function classifyIntent(turn) {
  const claim = String(turn.claim || "").toLowerCase();

  if (turn.question || claim.endsWith("?") || claim.startsWith("how") || claim.startsWith("what") || claim.startsWith("why")) {
    return INTENT_TYPES.QUESTION;
  }
  if (turn.counterpoint) {
    return INTENT_TYPES.CRITIQUE;
  }
  if (turn.confidenceLabel === CONFIDENCE_LABELS.SPECULATIVE) {
    return INTENT_TYPES.HYPOTHESIS;
  }
  if (turn.speakerRole === EMERGENT_ROLES.SYNTHESIZER) {
    return INTENT_TYPES.SYNTHESIS;
  }
  if (turn.speakerRole === EMERGENT_ROLES.CRITIC || turn.speakerRole === EMERGENT_ROLES.ADVERSARY) {
    return INTENT_TYPES.CRITIQUE;
  }

  return INTENT_TYPES.SUGGESTION;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncate(str, maxLen = 200) {
  const s = String(str || "");
  return s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
}
