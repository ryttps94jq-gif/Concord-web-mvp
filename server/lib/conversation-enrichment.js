/**
 * Conversation Enrichment — Auto DTU Creation Per Exchange
 *
 * Every message exchange generates new DTUs automatically:
 *   - User messages → input DTUs (tagged with user ID, session ID, timestamp, intent/topic)
 *   - AI responses → output DTUs (tagged with entity ID, brain, confidence, referenced DTUs)
 *   - Every 10 exchanges → consolidation check (flagging for MEGA cycle)
 *
 * This is the feedback loop: each conversation makes the next conversation better
 * because new DTUs enter the substrate and get found by semantic search.
 *
 * Integrates with:
 *   - chat.respond macro (called post-response)
 *   - dtu-store.js (DTU persistence)
 *   - conversation-summarizer.js (summary DTU tracking)
 */

import crypto from "crypto";

// ── Constants ────────────────────────────────────────────────────────────────

/** Interval (in exchanges) for consolidation checks */
const CONSOLIDATION_CHECK_INTERVAL = 10;

/** Max age (in days) for chat shadow DTUs before pruning */
const MAX_SHADOW_AGE_DAYS = 7;

/** Minimum message length to create a DTU from */
const MIN_MESSAGE_LENGTH = 20;

/** Maximum DTU content length */
const MAX_DTU_CONTENT = 500;

// ── Input DTU Creation ───────────────────────────────────────────────────────

/**
 * Create a shadow DTU from a user message.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.userId - User identifier
 * @param {string} opts.sessionId - Session identifier
 * @param {string} opts.message - User message content
 * @param {string} [opts.timestamp] - Message timestamp
 * @param {string} [opts.intent] - Detected intent (from chat router)
 * @param {string[]} [opts.topics] - Detected topic tags
 * @returns {{ ok: boolean, dtuId?: string }}
 */
export function createInputDTU(STATE, opts) {
  const { userId, sessionId, message } = opts;

  if (!message || message.length < MIN_MESSAGE_LENGTH) {
    return { ok: false, error: "message_too_short" };
  }

  if (!STATE.shadowDtus) STATE.shadowDtus = new Map();

  const id = `chat_input_${crypto.randomBytes(6).toString("hex")}`;
  const now = opts.timestamp || new Date().toISOString();

  const tags = [
    "shadow", "chat-input",
    `session:${sessionId}`,
  ];
  if (userId) tags.push(`user:${userId}`);
  if (opts.intent) tags.push(`intent:${opts.intent}`);
  if (opts.topics) {
    for (const topic of opts.topics.slice(0, 5)) {
      tags.push(topic);
    }
  }

  const dtu = {
    id,
    title: `User: ${String(message).slice(0, 80)}`,
    tier: "shadow",
    content: String(message).slice(0, MAX_DTU_CONTENT),
    tags,
    human: { summary: String(message).slice(0, 200), bullets: [] },
    core: { definitions: [], invariants: [], claims: [], examples: [], nextActions: [] },
    machine: {
      kind: "chat_input",
      sessionId,
      userId: userId || null,
      intent: opts.intent || null,
      topics: opts.topics || [],
      messageLength: message.length,
    },
    lineage: { parents: [], children: [] },
    source: "chat-enrichment",
    meta: { hidden: true, chatInput: true },
    createdAt: now,
    updatedAt: now,
    authority: { model: "user", score: 0 },
    hash: crypto.createHash("sha256").update(message).digest("hex").slice(0, 16),
  };

  STATE.shadowDtus.set(id, dtu);
  return { ok: true, dtuId: id };
}

// ── Output DTU Creation ──────────────────────────────────────────────────────

/**
 * Create a shadow DTU from an AI response.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.sessionId - Session identifier
 * @param {string} opts.response - AI response content
 * @param {string} [opts.entityId] - Entity identifier
 * @param {string} [opts.brain] - Brain that generated the response
 * @param {number} [opts.confidence] - Response confidence score
 * @param {string[]} [opts.workingSetDtuIds] - IDs of DTUs in the working set for this response
 * @param {string} [opts.timestamp]
 * @returns {{ ok: boolean, dtuId?: string }}
 */
export function createOutputDTU(STATE, opts) {
  const { sessionId, response } = opts;

  if (!response || response.length < MIN_MESSAGE_LENGTH) {
    return { ok: false, error: "response_too_short" };
  }

  if (!STATE.shadowDtus) STATE.shadowDtus = new Map();

  const id = `chat_output_${crypto.randomBytes(6).toString("hex")}`;
  const now = opts.timestamp || new Date().toISOString();

  const tags = [
    "shadow", "chat-output",
    `session:${sessionId}`,
  ];
  if (opts.brain) tags.push(`brain:${opts.brain}`);
  if (opts.entityId) tags.push(`entity:${opts.entityId}`);

  const dtu = {
    id,
    title: `AI: ${String(response).slice(0, 80)}`,
    tier: "shadow",
    content: String(response).slice(0, MAX_DTU_CONTENT),
    tags,
    human: { summary: String(response).slice(0, 200), bullets: [] },
    core: { definitions: [], invariants: [], claims: [], examples: [], nextActions: [] },
    machine: {
      kind: "chat_output",
      sessionId,
      entityId: opts.entityId || null,
      brain: opts.brain || "conscious",
      confidence: opts.confidence ?? null,
      workingSetDtuIds: (opts.workingSetDtuIds || []).slice(0, 20),
      responseLength: response.length,
    },
    lineage: { parents: [], children: [] },
    source: "chat-enrichment",
    meta: { hidden: true, chatOutput: true },
    createdAt: now,
    updatedAt: now,
    authority: { model: opts.brain || "conscious", score: opts.confidence ?? 0 },
    hash: crypto.createHash("sha256").update(response).digest("hex").slice(0, 16),
  };

  STATE.shadowDtus.set(id, dtu);
  return { ok: true, dtuId: id };
}

// ── Consolidation Check ──────────────────────────────────────────────────────

/**
 * Check if conversation DTUs are clustering with existing substrate knowledge.
 *
 * Called every 10 exchanges. If session shadows cluster with existing DTUs
 * in the substrate, they get flagged for the next MEGA consolidation cycle.
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Session identifier
 * @returns {{ ok: boolean, flaggedCount?: number, shouldConsolidate?: boolean }}
 */
export function consolidationCheck(STATE, sessionId) {
  if (!STATE.shadowDtus || !STATE.dtus) {
    return { ok: true, flaggedCount: 0, shouldConsolidate: false };
  }

  // Find all chat shadows for this session
  const sessionShadows = [];
  for (const [id, dtu] of STATE.shadowDtus) {
    if (dtu.machine?.sessionId === sessionId &&
        (dtu.machine?.kind === "chat_input" || dtu.machine?.kind === "chat_output")) {
      sessionShadows.push(dtu);
    }
  }

  if (sessionShadows.length < 3) {
    return { ok: true, flaggedCount: 0, shouldConsolidate: false };
  }

  // Extract all tags from session shadows
  const sessionTags = new Set();
  for (const dtu of sessionShadows) {
    for (const tag of (dtu.tags || [])) {
      if (!tag.startsWith("shadow") && !tag.startsWith("session:") &&
          !tag.startsWith("user:") && !tag.startsWith("brain:") &&
          !tag.startsWith("entity:") && !tag.startsWith("intent:")) {
        sessionTags.add(tag);
      }
    }
  }

  if (sessionTags.size === 0) {
    return { ok: true, flaggedCount: 0, shouldConsolidate: false };
  }

  // Check for overlapping tags in the main DTU substrate
  let overlapCount = 0;
  const overlappingDomains = new Set();

  for (const [_id, dtu] of STATE.dtus) {
    const dtuTags = new Set(dtu.tags || []);
    let overlap = 0;
    for (const tag of sessionTags) {
      if (dtuTags.has(tag)) overlap++;
    }
    if (overlap >= 2) {
      overlapCount++;
      // Try to identify domain
      const domain = dtu.tags?.find(t => !["shadow", "regular", "mega", "hyper"].includes(t));
      if (domain) overlappingDomains.add(domain);
    }
  }

  // Flag for consolidation if significant overlap exists
  const shouldConsolidate = overlapCount >= 3;

  if (shouldConsolidate) {
    // Tag session shadows for MEGA consolidation
    for (const dtu of sessionShadows) {
      if (!dtu.meta) dtu.meta = {};
      dtu.meta.flaggedForConsolidation = true;
      dtu.meta.consolidationDomains = Array.from(overlappingDomains).slice(0, 5);
      dtu.meta.flaggedAt = new Date().toISOString();
    }
  }

  return {
    ok: true,
    flaggedCount: shouldConsolidate ? sessionShadows.length : 0,
    shouldConsolidate,
    overlapCount,
    domains: Array.from(overlappingDomains).slice(0, 10),
  };
}

/**
 * Check if a consolidation check is due for a session.
 *
 * @param {Object} sess - Session object
 * @returns {boolean}
 */
export function isConsolidationDue(sess) {
  if (!sess || !sess.messages) return false;
  const exchangeCount = Math.floor(sess.messages.length / 2);
  const lastCheck = sess._lastConsolidationCheck || 0;
  return exchangeCount > 0 && exchangeCount >= lastCheck + CONSOLIDATION_CHECK_INTERVAL;
}

// ── Pruning ──────────────────────────────────────────────────────────────────

/**
 * Prune chat shadow DTUs older than the max age.
 * Should be called periodically (e.g., on server startup or daily).
 *
 * @param {Object} STATE - Global server state
 * @param {number} [maxAgeDays] - Maximum age in days (default: 7)
 * @returns {{ ok: boolean, pruned: number }}
 */
export function pruneSessionDTUs(STATE, maxAgeDays = MAX_SHADOW_AGE_DAYS) {
  if (!STATE.shadowDtus) return { ok: true, pruned: 0 };

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let pruned = 0;

  for (const [id, dtu] of STATE.shadowDtus) {
    if (dtu.machine?.kind === "chat_input" || dtu.machine?.kind === "chat_output") {
      const createdAt = new Date(dtu.createdAt).getTime();
      if (createdAt < cutoff && !dtu.meta?.flaggedForConsolidation) {
        STATE.shadowDtus.delete(id);
        pruned++;
      }
    }
  }

  return { ok: true, pruned };
}

// ── Forge DTU Promotion ──────────────────────────────────────────────────────

/**
 * Promote a chat message exchange to a permanent substrate DTU.
 * Called when the user clicks "Forge DTU" on a chat message.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.messageContent - The message to promote
 * @param {string} opts.sessionId - Session ID
 * @param {string} [opts.userId] - User ID
 * @param {string} [opts.title] - Optional custom title
 * @param {string[]} [opts.tags] - Optional custom tags
 * @returns {{ ok: boolean, dtuId?: string }}
 */
export function forgeFromMessage(STATE, opts) {
  const { messageContent, sessionId } = opts;
  if (!messageContent || messageContent.length < 10) {
    return { ok: false, error: "content_too_short" };
  }

  const id = `forged_${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date().toISOString();

  const title = opts.title || `Forged: ${String(messageContent).slice(0, 60)}`;
  const tags = [
    "forged", "user-promoted",
    `session:${sessionId}`,
    ...(opts.tags || []),
  ];

  const dtu = {
    id,
    title,
    tier: "regular", // Promoted to regular tier (not shadow)
    content: String(messageContent).slice(0, 2000),
    summary: String(messageContent).slice(0, 300),
    tags,
    human: { summary: String(messageContent).slice(0, 300), bullets: [] },
    core: { definitions: [], invariants: [], claims: [], examples: [], nextActions: [] },
    machine: {
      kind: "user_forged",
      sessionId,
      userId: opts.userId || null,
      promotedAt: now,
      source: "chat_forge",
    },
    lineage: { parents: [], children: [] },
    source: "user-forge",
    meta: { userPromoted: true },
    createdAt: now,
    updatedAt: now,
    authority: { model: "user", score: 0.5 },
    hash: crypto.createHash("sha256").update(messageContent).digest("hex").slice(0, 16),
  };

  // Add to main DTU store (not shadow)
  if (!STATE.dtus) STATE.dtus = new Map();
  STATE.dtus.set(id, dtu);

  return { ok: true, dtuId: id, title };
}

// ── Exports ──────────────────────────────────────────────────────────────────

export const ENRICHMENT_CONSTANTS = Object.freeze({
  CONSOLIDATION_CHECK_INTERVAL,
  MAX_SHADOW_AGE_DAYS,
  MIN_MESSAGE_LENGTH,
  MAX_DTU_CONTENT,
});
