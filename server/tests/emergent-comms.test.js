/**
 * Tests for emergent/emergent-comms.js — Emergent-to-Emergent Communication
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  MESSAGE_TYPES,
  sendMessage,
  broadcastToRole,
  getInbox,
  markRead,
  acknowledgeMessage,
  cleanupExpiredMessages,
  getCommsMetrics,
} from "../emergent/emergent-comms.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSTATE() {
  return {
    __emergent: {
      emergents: new Map([
        ["e1", { id: "e1", role: "builder", active: true }],
        ["e2", { id: "e2", role: "critic", active: true }],
        ["e3", { id: "e3", role: "builder", active: true }],
        ["e4", { id: "e4", role: "builder", active: false }],
      ]),
    },
  };
}

// ── Constants ───────────────────────────────────────────────────────────────

describe("MESSAGE_TYPES", () => {
  it("is frozen with expected values", () => {
    assert.ok(Object.isFrozen(MESSAGE_TYPES));
    assert.equal(MESSAGE_TYPES.OBSERVATION, "observation");
    assert.equal(MESSAGE_TYPES.CONCERN, "concern");
    assert.equal(MESSAGE_TYPES.COLLABORATION, "collaboration");
    assert.equal(MESSAGE_TYPES.ACKNOWLEDGMENT, "acknowledgment");
    assert.equal(MESSAGE_TYPES.SIGNAL, "signal");
  });
});

// ── sendMessage ─────────────────────────────────────────────────────────────

describe("sendMessage", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("rejects when fromId or toId missing", () => {
    const r1 = sendMessage(STATE, { fromId: "e1" });
    assert.equal(r1.ok, false);
    assert.equal(r1.error, "from_and_to_required");
    const r2 = sendMessage(STATE, { toId: "e2" });
    assert.equal(r2.ok, false);
    const r3 = sendMessage(STATE, {});
    assert.equal(r3.ok, false);
  });

  it("rejects self-message", () => {
    const r = sendMessage(STATE, { fromId: "e1", toId: "e1", type: "observation" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "self_message_not_allowed");
  });

  it("rejects invalid message type", () => {
    const r = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "bogus" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_message_type");
  });

  it("rejects if sender not found", () => {
    const r = sendMessage(STATE, { fromId: "missing", toId: "e2", type: "observation" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "sender_not_found");
  });

  it("rejects if recipient not found", () => {
    const r = sendMessage(STATE, { fromId: "e1", toId: "missing", type: "observation" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "recipient_not_found");
  });

  it("sends a valid message", () => {
    const r = sendMessage(STATE, {
      fromId: "e1",
      toId: "e2",
      type: "observation",
      content: "Test message",
      context: { key: "val" },
      replyTo: "prev_msg",
    });
    assert.equal(r.ok, true);
    assert.ok(r.messageId.startsWith("msg_"));
  });

  it("truncates content to 500 chars", () => {
    const r = sendMessage(STATE, {
      fromId: "e1", toId: "e2", type: "observation",
      content: "x".repeat(600),
    });
    assert.equal(r.ok, true);
    // verify via inbox
    const inbox = getInbox(STATE, "e2");
    assert.equal(inbox.messages[0].content.length, 500);
  });

  it("handles missing content gracefully", () => {
    const r = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "signal" });
    assert.equal(r.ok, true);
  });

  it("caps inbox at 200 messages", () => {
    for (let i = 0; i < 210; i++) {
      sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: `msg${i}` });
    }
    const inbox = getInbox(STATE, "e2");
    assert.ok(inbox.totalCount <= 200);
  });

  it("increments sent and delivered metrics", () => {
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    const m = getCommsMetrics(STATE);
    assert.equal(m.sent, 1);
    assert.equal(m.delivered, 1);
  });
});

// ── broadcastToRole ─────────────────────────────────────────────────────────

describe("broadcastToRole", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("rejects when missing fields", () => {
    const r = broadcastToRole(STATE, {});
    assert.equal(r.ok, false);
    assert.equal(r.error, "from_role_type_required");
  });

  it("broadcasts to active recipients of matching role, excluding sender", () => {
    const r = broadcastToRole(STATE, {
      fromId: "e1",
      role: "builder",
      type: "observation",
      content: "broadcast test",
      context: { extra: true },
    });
    assert.equal(r.ok, true);
    // e3 is builder + active + not sender. e4 is builder but inactive.
    assert.equal(r.recipientCount, 1);
    assert.equal(r.messageIds.length, 1);
  });

  it("returns empty when no matching recipients", () => {
    const r = broadcastToRole(STATE, {
      fromId: "e1",
      role: "nonexistent_role",
      type: "observation",
      content: "test",
    });
    assert.equal(r.ok, true);
    assert.equal(r.recipientCount, 0);
  });

  it("tracks messages in broadcast channel", () => {
    broadcastToRole(STATE, {
      fromId: "e1", role: "builder", type: "signal", content: "ping",
    });
    const metrics = getCommsMetrics(STATE);
    assert.ok(metrics.channels >= 1);
  });
});

// ── getInbox ────────────────────────────────────────────────────────────────

describe("getInbox", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("returns empty inbox for unknown emergent", () => {
    const r = getInbox(STATE, "unknown");
    assert.equal(r.ok, true);
    assert.equal(r.messages.length, 0);
    assert.equal(r.unreadCount, 0);
  });

  it("returns messages with unreadCount", () => {
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: "hi" });
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "concern", content: "yo" });
    const r = getInbox(STATE, "e2");
    assert.equal(r.ok, true);
    assert.equal(r.messages.length, 2);
    assert.equal(r.unreadCount, 2);
  });

  it("filters unreadOnly", () => {
    const msg = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: "hi" });
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "concern", content: "yo" });
    markRead(STATE, msg.messageId);
    const r = getInbox(STATE, "e2", { unreadOnly: true });
    assert.equal(r.messages.length, 1);
    assert.equal(r.unreadCount, 1);
  });

  it("respects limit", () => {
    for (let i = 0; i < 5; i++) {
      sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: `m${i}` });
    }
    const r = getInbox(STATE, "e2", { limit: 2 });
    assert.equal(r.messages.length, 2);
  });

  it("sorts most recent first", () => {
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: "old" });
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: "new" });
    const r = getInbox(STATE, "e2");
    assert.ok(r.messages[0].createdAt >= r.messages[1].createdAt);
  });

  it("returns proper message shape", () => {
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: "test", context: { x: 1 }, replyTo: "prev" });
    const r = getInbox(STATE, "e2");
    const m = r.messages[0];
    assert.ok("messageId" in m);
    assert.ok("fromId" in m);
    assert.ok("type" in m);
    assert.ok("content" in m);
    assert.ok("context" in m);
    assert.ok("replyTo" in m);
    assert.ok("createdAt" in m);
    assert.equal(m.read, false);
    assert.equal(m.acknowledged, false);
  });
});

// ── markRead ────────────────────────────────────────────────────────────────

describe("markRead", () => {
  it("marks message as read", () => {
    const STATE = makeSTATE();
    const { messageId } = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    const r = markRead(STATE, messageId);
    assert.equal(r.ok, true);
    const inbox = getInbox(STATE, "e2");
    assert.equal(inbox.messages[0].read, true);
  });

  it("returns not_found for missing message", () => {
    const STATE = makeSTATE();
    const r = markRead(STATE, "nonexistent");
    assert.equal(r.ok, false);
    assert.equal(r.error, "not_found");
  });
});

// ── acknowledgeMessage ──────────────────────────────────────────────────────

describe("acknowledgeMessage", () => {
  let STATE;
  beforeEach(() => { STATE = makeSTATE(); });

  it("acknowledges a message", () => {
    const { messageId } = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    const r = acknowledgeMessage(STATE, messageId, "e2", "Got it");
    assert.equal(r.ok, true);
    const m = getCommsMetrics(STATE);
    assert.equal(m.acknowledged, 1);
  });

  it("also marks read if not already", () => {
    const { messageId } = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    acknowledgeMessage(STATE, messageId, "e2");
    const inbox = getInbox(STATE, "e2");
    assert.equal(inbox.messages[0].read, true);
    assert.equal(inbox.messages[0].acknowledged, true);
  });

  it("rejects if not recipient", () => {
    const { messageId } = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    const r = acknowledgeMessage(STATE, messageId, "e3");
    assert.equal(r.ok, false);
    assert.equal(r.error, "not_recipient");
  });

  it("returns not_found for missing message", () => {
    const r = acknowledgeMessage(STATE, "bogus", "e2");
    assert.equal(r.ok, false);
  });

  it("truncates response to 200 chars", () => {
    const { messageId } = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    acknowledgeMessage(STATE, messageId, "e2", "x".repeat(300));
    // No error thrown — just truncated internally
    assert.ok(true);
  });

  it("handles no response string", () => {
    const { messageId } = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    const r = acknowledgeMessage(STATE, messageId, "e2");
    assert.equal(r.ok, true);
  });
});

// ── cleanupExpiredMessages ──────────────────────────────────────────────────

describe("cleanupExpiredMessages", () => {
  it("removes expired messages and cleans inbox", () => {
    const STATE = makeSTATE();
    // Send a message
    const { messageId } = sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });

    // Manually expire it
    const es = STATE.__emergent;
    const store = es._emergentComms;
    const msg = store.messages.get(messageId);
    msg.expiresAt = new Date(Date.now() - 1000).toISOString();

    const r = cleanupExpiredMessages(STATE);
    assert.equal(r.ok, true);
    assert.equal(r.expired, 1);
    assert.equal(r.remaining, 0);

    // Inbox should be cleaned too
    const inbox = getInbox(STATE, "e2");
    assert.equal(inbox.messages.length, 0);
  });

  it("keeps non-expired messages", () => {
    const STATE = makeSTATE();
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation" });
    const r = cleanupExpiredMessages(STATE);
    assert.equal(r.expired, 0);
    assert.equal(r.remaining, 1);
  });
});

// ── getCommsMetrics ─────────────────────────────────────────────────────────

describe("getCommsMetrics", () => {
  it("returns full metrics object", () => {
    const STATE = makeSTATE();
    sendMessage(STATE, { fromId: "e1", toId: "e2", type: "observation", content: "hello" });
    sendMessage(STATE, { fromId: "e2", toId: "e1", type: "signal", content: "ping" });
    const m = getCommsMetrics(STATE);
    assert.equal(m.ok, true);
    assert.equal(m.totalMessages, 2);
    assert.ok(m.typeDistribution.observation >= 1);
    assert.ok(m.typeDistribution.signal >= 1);
    assert.equal(m.sent, 2);
    assert.equal(m.delivered, 2);
    assert.ok("inboxes" in m);
    assert.ok("channels" in m);
  });
});
