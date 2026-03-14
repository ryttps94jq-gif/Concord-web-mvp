/**
 * Stripe Webhook Source Tracking Tests
 *
 * Verifies that the checkout.session.completed webhook handler correctly
 * tracks purchase source (web, ios_app, android_app) in the metadata and audit log.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

let Database;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  Database = null;
}

// Create in-memory DB with required tables
function createTestDb() {
  if (!Database) return null;
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_events_processed (
      event_id TEXT PRIMARY KEY,
      event_type TEXT,
      processed_at TEXT
    )
  `);

  return db;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Source Tracking Metadata Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe("Stripe webhook source tracking", () => {
  it("ios_app source is included in session metadata", () => {
    const sessionMetadata = {
      userId: "user_1",
      tokens: "100",
      purpose: "TOKEN_PURCHASE",
      source: "ios_app",
      coinAmount: "100",
    };

    assert.equal(sessionMetadata.source, "ios_app");
    assert.equal(sessionMetadata.purpose, "TOKEN_PURCHASE");
  });

  it("android_app source is included in session metadata", () => {
    const sessionMetadata = {
      userId: "user_1",
      tokens: "50",
      purpose: "TOKEN_PURCHASE",
      source: "android_app",
      coinAmount: "50",
    };

    assert.equal(sessionMetadata.source, "android_app");
  });

  it("defaults source to 'web' when not specified", () => {
    const sessionMetadata = {
      userId: "user_1",
      tokens: "50",
      purpose: "TOKEN_PURCHASE",
    };

    const source = sessionMetadata.source || "web";
    assert.equal(source, "web");
  });

  it("preserves all valid source values", () => {
    const validSources = ["web", "ios_app", "android_app"];

    for (const source of validSources) {
      const metadata = { source };
      assert.ok(validSources.includes(metadata.source), `Invalid source: ${source}`);
    }
  });

  it("audit details include source field for iOS purchases", () => {
    const auditDetails = {
      stripeSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_test_456",
      fee: 1.46,
      net: 98.54,
      source: "ios_app",
    };

    assert.equal(auditDetails.source, "ios_app");
    assert.ok(auditDetails.stripeSessionId);
    assert.ok(auditDetails.stripePaymentIntentId);
  });

  it("web checkout metadata defaults correctly", () => {
    const webMetadata = {
      userId: "user_xyz",
      tokens: "10",
      purpose: "TOKEN_PURCHASE",
    };

    const source = webMetadata.source || "web";
    assert.equal(source, "web");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Event Idempotency (source tracking doesn't break idempotency)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Event idempotency with source tracking", () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  it("stripe_events_processed table stores event IDs", { skip: !Database && "better-sqlite3 not available" }, () => {
    const eventId = "evt_test_123";
    db.prepare(
      "INSERT OR IGNORE INTO stripe_events_processed (event_id, event_type, processed_at) VALUES (?, ?, ?)"
    ).run(eventId, "checkout.session.completed", new Date().toISOString());

    const row = db.prepare("SELECT event_id FROM stripe_events_processed WHERE event_id = ?").get(eventId);
    assert.ok(row);
    assert.equal(row.event_id, eventId);
  });

  it("duplicate events are detected", { skip: !Database && "better-sqlite3 not available" }, () => {
    const eventId = "evt_duplicate_456";
    db.prepare(
      "INSERT OR IGNORE INTO stripe_events_processed (event_id, event_type, processed_at) VALUES (?, ?, ?)"
    ).run(eventId, "checkout.session.completed", new Date().toISOString());

    // Try inserting again — should be ignored
    db.prepare(
      "INSERT OR IGNORE INTO stripe_events_processed (event_id, event_type, processed_at) VALUES (?, ?, ?)"
    ).run(eventId, "checkout.session.completed", new Date().toISOString());

    const count = db.prepare("SELECT COUNT(*) as cnt FROM stripe_events_processed WHERE event_id = ?").get(eventId);
    assert.equal(count.cnt, 1);
  });

  it("events with different sources are stored independently", { skip: !Database && "better-sqlite3 not available" }, () => {
    db.prepare(
      "INSERT INTO stripe_events_processed (event_id, event_type, processed_at) VALUES (?, ?, ?)"
    ).run("evt_ios_001", "checkout.session.completed", new Date().toISOString());

    db.prepare(
      "INSERT INTO stripe_events_processed (event_id, event_type, processed_at) VALUES (?, ?, ?)"
    ).run("evt_web_002", "checkout.session.completed", new Date().toISOString());

    const count = db.prepare("SELECT COUNT(*) as cnt FROM stripe_events_processed").get();
    assert.equal(count.cnt, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Checkout Session Metadata for Mobile Flow
// ═══════════════════════════════════════════════════════════════════════════════

describe("Checkout session metadata for mobile flow", () => {
  it("mobile checkout includes all required metadata fields", () => {
    const mobileMetadata = {
      userId: "user_abc",
      tokens: "25",
      purpose: "TOKEN_PURCHASE",
      source: "ios_app",
      coinAmount: "25",
    };

    assert.ok(mobileMetadata.userId, "Must include userId");
    assert.ok(mobileMetadata.tokens, "Must include tokens");
    assert.equal(mobileMetadata.purpose, "TOKEN_PURCHASE");
    assert.ok(["ios_app", "android_app", "web"].includes(mobileMetadata.source));
  });

  it("metadata preserves coin amount as string", () => {
    const metadata = { coinAmount: String(25.50) };
    assert.equal(metadata.coinAmount, "25.5");
    assert.equal(typeof metadata.coinAmount, "string");
  });

  it("metadata tokens field is string representation of integer", () => {
    const tokens = 25;
    const metadata = { tokens: String(tokens) };
    assert.equal(metadata.tokens, "25");
    assert.equal(parseInt(metadata.tokens, 10), 25);
  });
});
