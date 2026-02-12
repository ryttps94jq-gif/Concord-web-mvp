/**
 * Atlas Chat Loose Mode
 *
 * Chat sits ABOVE Atlas, not inside it.
 *
 *   Chat  = sandbox conversation engine   (fast, loose, expressive)
 *   Local = personal structured memory     (permissive, typed)
 *   Global = public epistemic record       (strict, gated)
 *   Market = economic layer                (strictest, audited)
 *
 * Chat pipeline:
 *   1. Retrieve (LOCAL_THEN_GLOBAL)  — lightweight, scope-labeled
 *   2. Apply shadow weighting        — rank by relevance, not governance
 *   3. Build structured context      — tagged with scope + confidence
 *   4. Return context envelope       — synthesis happens at caller layer
 *
 * What chat does NOT do:
 *   - Create DTUs
 *   - Trigger strict validation
 *   - Run contradiction graph
 *   - Block on evidence
 *   - Require domainType or claim typing
 *   - Create submission objects
 *   - Run anti-gaming scans
 *   - Auto-promote anything
 *
 * Escalation:
 *   User explicitly clicks "Save as DTU" / "Publish to Global" / "List on Marketplace"
 *   → THEN it enters atlas.index.applyWrite() and strictness kicks in.
 */

import { CHAT_PROFILE, SCOPES, RETRIEVAL_POLICY } from "./atlas-config.js";
import { retrieve as atlasRetrieve } from "./atlas-retrieval.js";
import { getAtlasState } from "./atlas-epistemic.js";
import { getDtuScope } from "./atlas-scope-router.js";
import { scopedWrite, createSubmission } from "./atlas-scope-router.js";
import { WRITE_OPS } from "./atlas-write-guard.js";

// ── Chat State ──────────────────────────────────────────────────────────────

function getChatState(STATE) {
  if (!STATE._chat) {
    STATE._chat = {
      // Chat sessions — ephemeral by design
      sessions: new Map(),
      metrics: {
        queries: 0,
        retrievals: 0,
        escalations: 0,
        savesAsDtu: 0,
        publishToGlobal: 0,
        listOnMarket: 0,
      },
    };
  }
  return STATE._chat;
}

// ── Core Chat Pipeline ──────────────────────────────────────────────────────

/**
 * Fast chat response path. No governance. O(retrieval + labeling).
 *
 * Returns a context envelope — the caller (LLM layer, UI, macro) handles synthesis.
 *
 * @param {object} STATE
 * @param {string} query         Free-text user input
 * @param {object} opts          { sessionId, limit, policy, minConfidence }
 * @returns {{ ok, context: ChatContext[], meta }}
 */
export function chatRetrieve(STATE, query, opts = {}) {
  const chat = getChatState(STATE);
  chat.metrics.queries++;
  chat.metrics.retrievals++;

  const limit = Math.min(opts.limit || CHAT_PROFILE.maxRetrievalResults, 50);
  const policy = opts.policy || CHAT_PROFILE.defaultRetrievalPolicy;

  // Step 1: Lightweight retrieval — reuses atlas-retrieval (already scope-labeled)
  const retrieval = atlasRetrieve(STATE, policy, query, {
    limit,
    minConfidence: opts.minConfidence,
    domainType: opts.domainType,
  });

  if (!retrieval.ok) {
    return { ok: true, context: [], meta: _buildMeta(query, policy, 0) };
  }

  // Step 2: Build chat context — scope-labeled, lightweight, no governance metadata
  const context = retrieval.results.map(r => _toChatContext(r));

  // Step 3: Apply shadow weighting (boost recently-accessed, local-first for chat)
  _applyShadowWeighting(STATE, context);

  // Sort by chat relevance (shadow-weighted)
  context.sort((a, b) => (b._chatRelevance || 0) - (a._chatRelevance || 0));

  return {
    ok: true,
    context: context.slice(0, limit),
    total: retrieval.total,
    meta: _buildMeta(query, policy, context.length),
  };
}

/**
 * Get chat metrics.
 */
export function getChatMetrics(STATE) {
  const chat = getChatState(STATE);
  return { ok: true, ...chat.metrics };
}

// ── Chat Context Builder ────────────────────────────────────────────────────

/**
 * Converts an Atlas retrieval result into a chat-friendly context object.
 * Strips governance metadata. Keeps scope labels + confidence for display.
 */
function _toChatContext(result) {
  const ctx = {
    id: result.id,
    title: result.title,
    claims: (result.claims || []).map(c => ({
      text: c.text,
      claimType: c.claimType,
    })),
    tags: result.tags || [],

    // ── Scope labeling (always present) ──────────────────────────────
    sourceScope: result._sourceScope,
    scopeLabel: result._scopeLabel,  // "Local knowledge" | "Global Atlas" | "Marketplace listing"

    // ── Confidence badge (only on Global/Marketplace references) ─────
    confidenceBadge: null,
    disputeIndicator: false,
    isVerified: false,
  };

  // Show confidence badge ONLY when referencing Global or Marketplace content
  if (result._sourceScope !== SCOPES.LOCAL) {
    ctx.confidenceBadge = {
      score: result.scores?.confidence_overall || 0,
      label: result._confidenceBranding,
      verified: result._isVerified || false,
      disputed: result._disputeIndicator || false,
    };
    ctx.disputeIndicator = result._disputeIndicator || false;
    ctx.isVerified = result._isVerified || false;
  }

  // Internal relevance for sorting
  ctx._chatRelevance = result._relevanceScore || 0;
  ctx._sourceConfidence = result.scores?.confidence_overall || 0;

  return ctx;
}

// ── Shadow Weighting ────────────────────────────────────────────────────────

/**
 * Lightweight shadow weighting for chat. Boosts recently-accessed DTUs
 * and applies a local-first bias for conversational context.
 * Does NOT run full graph recompute — that's heartbeat's job.
 */
function _applyShadowWeighting(STATE, contextItems) {
  const now = Date.now();
  const atlas = getAtlasState(STATE);

  for (const item of contextItems) {
    let boost = 0;

    // Recency boost: DTUs accessed recently get a bump
    const dtu = atlas.dtus.get(item.id);
    if (dtu) {
      const updatedAt = dtu.updatedAt ? new Date(dtu.updatedAt).getTime() : 0;
      const ageMinutes = (now - updatedAt) / 60000;
      if (ageMinutes < 30) boost += 0.3;       // very recent
      else if (ageMinutes < 120) boost += 0.15; // recent
      else if (ageMinutes < 1440) boost += 0.05; // today
    }

    // Local-first bias for chat (local content is more conversationally relevant)
    if (item.sourceScope === SCOPES.LOCAL) {
      boost += 0.1;
    }

    // Shadow DTU boost (if user has interacted with this DTU recently)
    const shadow = STATE.shadowDtus?.get(item.id);
    if (shadow) {
      boost += 0.2;
    }

    item._chatRelevance = (item._chatRelevance || 0) + boost;
  }
}

// ── Meta Builder ────────────────────────────────────────────────────────────

function _buildMeta(query, policy, resultCount) {
  return {
    mode: "chat",
    profile: "CHAT_PROFILE",
    validationLevel: "OFF",
    contradictionGate: "OFF",
    policy,
    query,
    resultCount,
    ts: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATION: "Commit to Atlas" flows
// ═══════════════════════════════════════════════════════════════════════════════
//
// Chat is ephemeral UNLESS the user explicitly escalates:
//   - "Save as DTU"         → creates Local DTU (SOFT validation)
//   - "Publish to Global"   → creates Local DTU + Global Submission (HARD gate)
//   - "List on Marketplace" → creates Local DTU + Market Submission (HARD+ gate)

/**
 * Save chat content as a Local DTU. SOFT validation only.
 * This is the lightest escalation — goes through the write guard
 * with LOCAL scope, so only warnings, no blocking.
 *
 * @param {object} STATE
 * @param {object} content   { title, content, tags, claims, domainType, epistemicClass }
 * @param {object} ctx       { actor, sessionId }
 * @returns Write guard result (from scopedWrite)
 */
export function saveAsDtu(STATE, content, ctx = {}) {
  const chat = getChatState(STATE);
  chat.metrics.escalations++;
  chat.metrics.savesAsDtu++;

  // Build a minimal DTU payload — user can flesh it out later.
  // Default to general.note / GENERAL when no domain is specified,
  // so the DTU passes store-level type checks without forcing
  // users to classify their chat notes upfront.
  const payload = {
    title: content.title || "Chat note",
    content: content.content || "",
    tags: content.tags || [],
    claims: content.claims || [],
    domainType: content.domainType || "general.note",
    epistemicClass: content.epistemicClass || "GENERAL",
    schemaVersion: content.schemaVersion || "atlas-1.1",
    claimType: content.claimType || null,
    _chatOrigin: true,
    _chatSessionId: ctx.sessionId || null,
    author: ctx.actor ? { userId: ctx.actor } : undefined,
  };

  // Goes through scopedWrite with LOCAL scope — SOFT validation, no blocking
  return scopedWrite(STATE, SCOPES.LOCAL, WRITE_OPS.CREATE, payload, {
    actor: ctx.actor || "chat_user",
    scope: SCOPES.LOCAL,
  });
}

/**
 * Save chat content as Local DTU, then immediately create a Global submission.
 * Two-step: LOCAL write (SOFT) + Submission creation (for council pipeline).
 *
 * @param {object} STATE
 * @param {object} content   DTU content fields
 * @param {object} ctx       { actor, sessionId }
 * @returns {{ ok, dtu?, submission?, error? }}
 */
export function publishToGlobal(STATE, content, ctx = {}) {
  const chat = getChatState(STATE);
  chat.metrics.escalations++;
  chat.metrics.publishToGlobal++;

  // Step 1: Save as local DTU first
  const saveResult = saveAsDtu(STATE, content, ctx);
  if (!saveResult.ok) {
    return { ok: false, error: saveResult.error, step: "save_local" };
  }

  // Step 2: Create cross-scope submission (Local → Global)
  const subResult = createSubmission(
    STATE,
    saveResult.dtu.id,
    SCOPES.GLOBAL,
    ctx.actor || "chat_user",
  );

  if (!subResult.ok) {
    return {
      ok: false,
      error: subResult.error,
      step: "create_submission",
      dtu: saveResult.dtu,  // local DTU was created successfully
    };
  }

  return {
    ok: true,
    dtu: saveResult.dtu,
    submission: subResult.submission,
    step: "submission_created",
    note: "DTU saved locally. Submission created for Global council review.",
  };
}

/**
 * Save chat content as Local DTU, then create a Marketplace submission.
 * Requires Global verification first (enforced by scope router).
 *
 * @param {object} STATE
 * @param {object} content   DTU content fields
 * @param {object} opts      { licenseTerms, royaltySplits, price, ... }
 * @param {object} ctx       { actor, sessionId }
 * @returns {{ ok, dtu?, submission?, error? }}
 */
export function listOnMarketplace(STATE, content, opts = {}, ctx = {}) {
  const chat = getChatState(STATE);
  chat.metrics.escalations++;
  chat.metrics.listOnMarket++;

  // Step 1: Save as local DTU
  const saveResult = saveAsDtu(STATE, content, ctx);
  if (!saveResult.ok) {
    return { ok: false, error: saveResult.error, step: "save_local" };
  }

  // Step 2: Create marketplace submission (will enforce Global-first rule)
  const subResult = createSubmission(
    STATE,
    saveResult.dtu.id,
    SCOPES.MARKETPLACE,
    ctx.actor || "chat_user",
    {
      licenseTerms: opts.licenseTerms,
      royaltySplits: opts.royaltySplits,
      price: opts.price,
      provenanceAttestation: opts.provenanceAttestation,
      rightsToSellAttestation: opts.rightsToSellAttestation,
    },
  );

  if (!subResult.ok) {
    return {
      ok: false,
      error: subResult.error,
      step: "create_submission",
      dtu: saveResult.dtu,
    };
  }

  return {
    ok: true,
    dtu: saveResult.dtu,
    submission: subResult.submission,
    step: "submission_created",
    note: "DTU saved locally. Marketplace submission created for review.",
  };
}

// ── Chat Session Tracking (optional, ephemeral) ─────────────────────────────

/**
 * Record a chat exchange in the ephemeral session log.
 * No DTU creation, no governance — just tracking for UX continuity.
 */
export function recordChatExchange(STATE, sessionId, exchange) {
  const chat = getChatState(STATE);

  if (!chat.sessions.has(sessionId)) {
    chat.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date().toISOString(),
      exchanges: [],
      escalations: [],
    });
  }

  const session = chat.sessions.get(sessionId);
  session.exchanges.push({
    ts: Date.now(),
    query: exchange.query,
    contextCount: exchange.contextCount || 0,
    hasGlobalRefs: exchange.hasGlobalRefs || false,
    hasLocalRefs: exchange.hasLocalRefs || false,
  });

  // Cap session log at 200 exchanges to prevent unbounded growth
  if (session.exchanges.length > 200) {
    session.exchanges = session.exchanges.slice(-200);
  }

  return { ok: true };
}

/**
 * Record when a chat session escalates to Atlas.
 */
export function recordChatEscalation(STATE, sessionId, escalation) {
  const chat = getChatState(STATE);
  const session = chat.sessions.get(sessionId);
  if (!session) return { ok: false, error: "Session not found" };

  session.escalations.push({
    ts: Date.now(),
    type: escalation.type,  // "save_as_dtu" | "publish_to_global" | "list_on_marketplace"
    dtuId: escalation.dtuId,
    submissionId: escalation.submissionId || null,
  });

  return { ok: true };
}

/**
 * Get a chat session's history.
 */
export function getChatSession(STATE, sessionId) {
  const chat = getChatState(STATE);
  const session = chat.sessions.get(sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  return { ok: true, session };
}
