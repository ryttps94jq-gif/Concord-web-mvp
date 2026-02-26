// prompts/spontaneous-queue.js
// Spontaneous Message Queue with Ticker
//
// The turn-based model is supplemented with a spontaneous outbound system.
// Concord can send messages to users without being prompted.
//
// Flow:
//   1. Subconscious processes a want-driven task and produces something noteworthy
//   2. Subconscious writes a spontaneous message request to the queue
//   3. A ticker (every 30 minutes) checks the queue
//   4. If user has active session, hasn't hit daily limit, cooldown elapsed, and enabled:
//      conscious brain formats and delivers
//   5. If no active session, message stays in queue up to 24 hours. Then archived.
//
// Rate limits:
//   - 3 spontaneous messages per day per user
//   - 60 minute cooldown between messages
//   - User can disable entirely

import { randomUUID } from "crypto";
import { checkSpontaneousContent } from "./spontaneous.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_MESSAGES_PER_DAY = 3;
const COOLDOWN_MS = 60 * 60 * 1000;  // 60 minutes
const TICKER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_QUEUE_SIZE = 100;

// ── Queue Store ───────────────────────────────────────────────────────────────

/**
 * Get or initialize the spontaneous queue from STATE.
 */
export function getSpontaneousQueue(STATE) {
  if (!STATE._spontaneousQueue) {
    STATE._spontaneousQueue = {
      queue: [],                  // pending messages
      delivered: [],              // delivered messages (for audit)
      archived: [],               // expired undelivered messages
      user_prefs: new Map(),      // userId -> { enabled, daily_count, last_delivered_at, last_reset_date }
      ticker_running: false,
      ticker_interval: null,
      metrics: {
        total_queued: 0,
        total_delivered: 0,
        total_archived: 0,
        total_blocked: 0,
        total_content_rejected: 0,
      },
    };
  }
  return STATE._spontaneousQueue;
}

// ── Queue Operations ──────────────────────────────────────────────────────────

/**
 * Enqueue a spontaneous message proposal from the subconscious.
 *
 * @param {object} STATE
 * @param {object} message
 * @param {string} message.content - What was found
 * @param {string} message.reason - Why the user would care
 * @param {string} [message.urgency] - low | medium | high
 * @param {string} [message.message_type] - statement | question | suggestion
 * @param {string} [message.user_id] - Target user (null = broadcast)
 * @param {string} [message.want_id] - Want that triggered this message
 * @returns {{ ok: boolean, queued?: object }}
 */
export function enqueueMessage(STATE, message = {}) {
  const store = getSpontaneousQueue(STATE);

  if (!message.content) {
    return { ok: false, error: "empty_content" };
  }

  // Pre-check content
  const contentCheck = checkSpontaneousContent(message.content);
  if (!contentCheck.allowed) {
    store.metrics.total_content_rejected++;
    return { ok: false, error: "content_rejected", reason: contentCheck.reason };
  }

  // Queue size limit
  if (store.queue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest low-urgency message
    const lowIdx = store.queue.findIndex(m => m.urgency === "low");
    if (lowIdx >= 0) {
      store.queue.splice(lowIdx, 1);
    } else {
      return { ok: false, error: "queue_full" };
    }
  }

  const msg = {
    id: `spon_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    content: message.content,
    reason: message.reason || "",
    urgency: message.urgency || "low",
    message_type: message.message_type || "statement",
    user_id: message.user_id || null,
    want_id: message.want_id || null,
    source: "subconscious",
    status: "pending",
    created_at: new Date().toISOString(),
    created_ts: Date.now(),
    formatted_content: null,
    delivered_at: null,
  };

  store.queue.push(msg);
  store.metrics.total_queued++;

  return { ok: true, queued: { ...msg } };
}

/**
 * Process the queue — check for deliverable messages.
 * This is called by the ticker (every 30 minutes) or on-demand.
 *
 * @param {object} STATE
 * @param {object} opts
 * @param {Function} [opts.formatCallback] - Async function to format via conscious brain
 * @param {Function} [opts.deliverCallback] - Async function to deliver to user
 * @param {Set} [opts.activeSessions] - Set of user IDs with active sessions
 * @returns {{ ok: boolean, processed: number, delivered: number, archived: number }}
 */
export async function processQueue(STATE, opts = {}) {
  const store = getSpontaneousQueue(STATE);
  const now = Date.now();
  let processed = 0;
  let delivered = 0;
  let archived = 0;

  const toRemove = [];

  for (let i = 0; i < store.queue.length; i++) {
    const msg = store.queue[i];
    processed++;

    // Check TTL
    if (now - msg.created_ts > MESSAGE_TTL_MS) {
      msg.status = "archived";
      store.archived.push(msg);
      toRemove.push(i);
      archived++;
      store.metrics.total_archived++;
      continue;
    }

    // Check if user has active session
    if (msg.user_id && opts.activeSessions && !opts.activeSessions.has(msg.user_id)) {
      continue; // Leave in queue for later
    }

    // Check rate limits for the target user
    const userId = msg.user_id || "__broadcast__";
    if (!canDeliver(store, userId)) {
      continue; // Rate limited — skip
    }

    // Format via conscious brain if callback provided
    if (opts.formatCallback && !msg.formatted_content) {
      try {
        const formatted = await opts.formatCallback(msg);
        if (formatted === "[SKIP]" || !formatted) {
          msg.status = "skipped";
          toRemove.push(i);
          continue;
        }

        // Re-check formatted content
        const check = checkSpontaneousContent(formatted);
        if (!check.allowed) {
          msg.status = "content_rejected";
          toRemove.push(i);
          store.metrics.total_content_rejected++;
          continue;
        }

        msg.formatted_content = formatted;
      } catch {
        continue; // Format failed — try again next tick
      }
    }

    // Deliver
    if (opts.deliverCallback) {
      try {
        await opts.deliverCallback(msg);
        msg.status = "delivered";
        msg.delivered_at = new Date().toISOString();
        store.delivered.push(msg);
        toRemove.push(i);
        delivered++;
        store.metrics.total_delivered++;

        // Update user delivery tracking
        recordDelivery(store, userId);
      } catch {
        continue; // Delivery failed — try again next tick
      }
    }
  }

  // Remove processed messages (reverse order to maintain indices)
  for (const idx of toRemove.sort((a, b) => b - a)) {
    store.queue.splice(idx, 1);
  }

  // Trim audit lists
  if (store.delivered.length > 500) store.delivered = store.delivered.slice(-500);
  if (store.archived.length > 500) store.archived = store.archived.slice(-500);

  return { ok: true, processed, delivered, archived };
}

// ── User Preferences ──────────────────────────────────────────────────────────

/**
 * Get or create user spontaneous message preferences.
 */
export function getUserPrefs(STATE, userId) {
  const store = getSpontaneousQueue(STATE);
  if (!store.user_prefs.has(userId)) {
    store.user_prefs.set(userId, {
      enabled: true,
      daily_count: 0,
      last_delivered_at: null,
      last_reset_date: todayStr(),
    });
  }
  return store.user_prefs.get(userId);
}

/**
 * Set whether a user wants to receive spontaneous messages.
 */
export function setUserSpontaneousEnabled(STATE, userId, enabled) {
  const prefs = getUserPrefs(STATE, userId);
  prefs.enabled = Boolean(enabled);
  return { ok: true, enabled: prefs.enabled };
}

/**
 * Check if a message can be delivered to a user.
 */
function canDeliver(store, userId) {
  const prefs = store.user_prefs.get(userId);
  if (!prefs) return true; // Default: allowed

  // User disabled
  if (!prefs.enabled) {
    store.metrics.total_blocked++;
    return false;
  }

  // Reset daily count if new day
  const today = todayStr();
  if (prefs.last_reset_date !== today) {
    prefs.daily_count = 0;
    prefs.last_reset_date = today;
  }

  // Daily limit
  if (prefs.daily_count >= MAX_MESSAGES_PER_DAY) {
    store.metrics.total_blocked++;
    return false;
  }

  // Cooldown
  if (prefs.last_delivered_at) {
    const elapsed = Date.now() - new Date(prefs.last_delivered_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      return false;
    }
  }

  return true;
}

/**
 * Record a delivery to update user tracking.
 */
function recordDelivery(store, userId) {
  if (!store.user_prefs.has(userId)) {
    store.user_prefs.set(userId, {
      enabled: true,
      daily_count: 0,
      last_delivered_at: null,
      last_reset_date: todayStr(),
    });
  }

  const prefs = store.user_prefs.get(userId);
  prefs.daily_count++;
  prefs.last_delivered_at = new Date().toISOString();
}

// ── Ticker ────────────────────────────────────────────────────────────────────

/**
 * Start the spontaneous message ticker.
 * Checks the queue every 30 minutes.
 *
 * @param {object} STATE
 * @param {object} opts
 * @param {Function} opts.formatCallback - Conscious brain formatting
 * @param {Function} opts.deliverCallback - Message delivery
 * @param {Function} opts.getActiveSessions - Returns Set<userId>
 * @returns {{ ok: boolean }}
 */
export function startTicker(STATE, opts = {}) {
  const store = getSpontaneousQueue(STATE);

  if (store.ticker_running) {
    return { ok: false, error: "already_running" };
  }

  store.ticker_running = true;
  store.ticker_interval = setInterval(async () => {
    try {
      const activeSessions = opts.getActiveSessions ? opts.getActiveSessions() : new Set();
      await processQueue(STATE, {
        formatCallback: opts.formatCallback,
        deliverCallback: opts.deliverCallback,
        activeSessions,
      });
    } catch (e) {
      console.error("[SpontaneousQueue] Ticker error:", e.message);
    }
  }, TICKER_INTERVAL_MS);

  return { ok: true };
}

/**
 * Stop the ticker.
 */
export function stopTicker(STATE) {
  const store = getSpontaneousQueue(STATE);

  if (store.ticker_interval) {
    clearInterval(store.ticker_interval);
    store.ticker_interval = null;
  }
  store.ticker_running = false;

  return { ok: true };
}

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * Get queue status and metrics.
 */
export function getQueueStatus(STATE) {
  const store = getSpontaneousQueue(STATE);
  return {
    ok: true,
    pending: store.queue.length,
    ticker_running: store.ticker_running,
    metrics: { ...store.metrics },
  };
}

/**
 * Get pending messages.
 */
export function getPendingMessages(STATE, limit = 20) {
  const store = getSpontaneousQueue(STATE);
  return {
    ok: true,
    messages: store.queue.slice(0, limit),
    total: store.queue.length,
  };
}

/**
 * Get delivered message history.
 */
export function getDeliveredMessages(STATE, limit = 50) {
  const store = getSpontaneousQueue(STATE);
  return {
    ok: true,
    messages: store.delivered.slice(-limit),
    total: store.delivered.length,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Re-export constants for testing
export { MAX_MESSAGES_PER_DAY, COOLDOWN_MS, TICKER_INTERVAL_MS, MESSAGE_TTL_MS };
