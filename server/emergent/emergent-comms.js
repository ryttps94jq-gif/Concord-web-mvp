/**
 * Emergent-to-Emergent Direct Communication
 *
 * Emergents can only interact during structured dialogue sessions.
 * They can't send messages, flag concerns, request collaboration,
 * or share observations outside of scheduled deliberation.
 * They're colleagues who can only talk in meetings.
 *
 * This module adds:
 *   - Async message queue (fire-and-forget observations)
 *   - Collaboration requests (ask another emergent for help)
 *   - Concern flags (flag issues for specific emergents)
 *   - Shared observations (broadcast to role groups)
 *
 * Messages are not dialogue turns — they don't go through gates.
 * They're metadata signals that influence future session planning
 * and trust network updates.
 */

import { getEmergentState } from "./store.js";

// ── Message Types ────────────────────────────────────────────────────────────

export const MESSAGE_TYPES = Object.freeze({
  OBSERVATION:     "observation",     // "I noticed X"
  CONCERN:         "concern",         // "Something seems wrong with X"
  COLLABORATION:   "collaboration",   // "I need help with X"
  ACKNOWLEDGMENT:  "acknowledgment",  // "Received and noted"
  SIGNAL:          "signal",          // "Pattern detected: X"
});

const ALL_MESSAGE_TYPES = new Set(Object.values(MESSAGE_TYPES));

// ── Message Store ────────────────────────────────────────────────────────────

function getCommsStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._emergentComms) {
    es._emergentComms = {
      // Message queue: messageId → Message
      messages: new Map(),

      // Inbox index: emergentId → messageId[]
      inbox: new Map(),

      // Broadcast channels: roleOrGroup → messageId[]
      channels: new Map(),

      // Sequence counter
      seq: 0,

      metrics: {
        sent: 0,
        delivered: 0,
        acknowledged: 0,
        expired: 0,
      },
    };
  }
  return es._emergentComms;
}

// ── Sending Messages ─────────────────────────────────────────────────────────

/**
 * Send a direct message from one emergent to another.
 *
 * @param {Object} STATE
 * @param {Object} msg
 * @param {string} msg.fromId - Sender emergent ID
 * @param {string} msg.toId - Recipient emergent ID
 * @param {string} msg.type - Message type (observation|concern|collaboration|signal)
 * @param {string} msg.content - Message content (max 500 chars)
 * @param {Object} [msg.context] - Optional structured context
 * @param {string} [msg.replyTo] - Optional: reply to a previous message ID
 * @returns {{ ok, messageId }}
 */
export function sendMessage(STATE, msg = {}) {
  const es = getEmergentState(STATE);
  const store = getCommsStore(STATE);

  if (!msg.fromId || !msg.toId) return { ok: false, error: "from_and_to_required" };
  if (msg.fromId === msg.toId) return { ok: false, error: "self_message_not_allowed" };
  if (!ALL_MESSAGE_TYPES.has(msg.type)) return { ok: false, error: "invalid_message_type" };
  if (!es.emergents.has(msg.fromId)) return { ok: false, error: "sender_not_found" };
  if (!es.emergents.has(msg.toId)) return { ok: false, error: "recipient_not_found" };

  const messageId = `msg_${++store.seq}_${Date.now().toString(36)}`;

  const message = {
    messageId,
    fromId: msg.fromId,
    toId: msg.toId,
    type: msg.type,
    content: String(msg.content || "").slice(0, 500),
    context: msg.context || null,
    replyTo: msg.replyTo || null,
    status: "delivered",
    createdAt: new Date().toISOString(),
    readAt: null,
    acknowledgedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), // 7 day TTL
  };

  store.messages.set(messageId, message);

  // Add to recipient inbox
  if (!store.inbox.has(msg.toId)) store.inbox.set(msg.toId, []);
  store.inbox.get(msg.toId).push(messageId);
  // Cap inbox at 200 messages
  const inbox = store.inbox.get(msg.toId);
  if (inbox.length > 200) {
    const removed = inbox.splice(0, inbox.length - 200);
    for (const id of removed) store.messages.delete(id);
  }

  store.metrics.sent++;
  store.metrics.delivered++;

  return { ok: true, messageId };
}

/**
 * Broadcast a message to all emergents with a specific role.
 *
 * @param {Object} STATE
 * @param {Object} msg
 * @param {string} msg.fromId
 * @param {string} msg.role - Target role (e.g., "critic", "builder")
 * @param {string} msg.type
 * @param {string} msg.content
 * @returns {{ ok, messageIds, recipientCount }}
 */
export function broadcastToRole(STATE, msg = {}) {
  const es = getEmergentState(STATE);
  if (!msg.fromId || !msg.role || !msg.type) {
    return { ok: false, error: "from_role_type_required" };
  }

  const recipients = Array.from(es.emergents.values())
    .filter(e => e.active && e.role === msg.role && e.id !== msg.fromId);

  const messageIds = [];
  for (const recipient of recipients) {
    const result = sendMessage(STATE, {
      fromId: msg.fromId,
      toId: recipient.id,
      type: msg.type,
      content: msg.content,
      context: { ...msg.context, broadcast: true, targetRole: msg.role },
    });
    if (result.ok) messageIds.push(result.messageId);
  }

  // Track in broadcast channel
  const store = getCommsStore(STATE);
  if (!store.channels.has(msg.role)) store.channels.set(msg.role, []);
  store.channels.get(msg.role).push(...messageIds);

  return { ok: true, messageIds, recipientCount: messageIds.length };
}

// ── Reading Messages ─────────────────────────────────────────────────────────

/**
 * Get inbox for an emergent (unread and recent messages).
 *
 * @param {Object} STATE
 * @param {string} emergentId
 * @param {Object} [opts]
 * @param {boolean} [opts.unreadOnly=false]
 * @param {number} [opts.limit=50]
 * @returns {{ ok, messages, unreadCount }}
 */
export function getInbox(STATE, emergentId, opts = {}) {
  const store = getCommsStore(STATE);
  const inboxIds = store.inbox.get(emergentId) || [];

  let messages = inboxIds
    .map(id => store.messages.get(id))
    .filter(Boolean)
    .filter(m => !isExpired(m));

  const unreadCount = messages.filter(m => !m.readAt).length;

  if (opts.unreadOnly) {
    messages = messages.filter(m => !m.readAt);
  }

  // Most recent first
  messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limit = opts.limit || 50;
  messages = messages.slice(0, limit);

  return {
    ok: true,
    messages: messages.map(m => ({
      messageId: m.messageId,
      fromId: m.fromId,
      type: m.type,
      content: m.content,
      context: m.context,
      replyTo: m.replyTo,
      createdAt: m.createdAt,
      read: !!m.readAt,
      acknowledged: !!m.acknowledgedAt,
    })),
    unreadCount,
    totalCount: inboxIds.length,
  };
}

/**
 * Mark a message as read.
 */
export function markRead(STATE, messageId) {
  const store = getCommsStore(STATE);
  const msg = store.messages.get(messageId);
  if (!msg) return { ok: false, error: "not_found" };
  msg.readAt = new Date().toISOString();
  return { ok: true };
}

/**
 * Acknowledge a message (stronger than read — signals receipt + understanding).
 *
 * @param {Object} STATE
 * @param {string} messageId
 * @param {string} emergentId - The acknowledger
 * @param {string} [response] - Optional short response
 * @returns {{ ok }}
 */
export function acknowledgeMessage(STATE, messageId, emergentId, response) {
  const store = getCommsStore(STATE);
  const msg = store.messages.get(messageId);
  if (!msg) return { ok: false, error: "not_found" };
  if (msg.toId !== emergentId) return { ok: false, error: "not_recipient" };

  msg.acknowledgedAt = new Date().toISOString();
  msg.readAt = msg.readAt || msg.acknowledgedAt;
  msg.acknowledgmentResponse = response ? String(response).slice(0, 200) : null;

  store.metrics.acknowledged++;
  return { ok: true };
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Clean up expired messages.
 */
export function cleanupExpiredMessages(STATE) {
  const store = getCommsStore(STATE);
  let expired = 0;

  for (const [id, msg] of store.messages) {
    if (isExpired(msg)) {
      store.messages.delete(id);
      expired++;
    }
  }

  // Clean inbox references
  for (const [emergentId, ids] of store.inbox) {
    const valid = ids.filter(id => store.messages.has(id));
    if (valid.length !== ids.length) {
      store.inbox.set(emergentId, valid);
    }
  }

  store.metrics.expired += expired;
  return { ok: true, expired, remaining: store.messages.size };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export function getCommsMetrics(STATE) {
  const store = getCommsStore(STATE);

  // Type distribution
  const typeDistribution = {};
  for (const msg of store.messages.values()) {
    typeDistribution[msg.type] = (typeDistribution[msg.type] || 0) + 1;
  }

  return {
    ok: true,
    totalMessages: store.messages.size,
    typeDistribution,
    inboxes: store.inbox.size,
    channels: store.channels.size,
    ...store.metrics,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExpired(msg) {
  return msg.expiresAt && new Date(msg.expiresAt).getTime() < Date.now();
}
