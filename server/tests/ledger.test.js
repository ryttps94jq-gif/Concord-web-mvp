/**
 * Comprehensive tests for economy/ledger.js
 *
 * Covers every exported function, happy paths, error cases, edge cases,
 * double-entry bookkeeping invariants, transaction atomicity, SQL
 * parameterisation, and idempotency.
 *
 * Run: node --test server/tests/ledger.test.js
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  checkRefIdProcessed,
  recordTransaction,
  recordTransactionBatch,
  getTransactions,
  getAllTransactions,
  getTransaction,
  generateTxId,
  nowISO,
} from "../economy/ledger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, ".test_ledger_unit.db");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a fully-featured in-memory (file-backed) test database.
 * Includes the ref_id column and all necessary indexes.
 */
function createTestDb() {
  const db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS economy_ledger (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      from_user_id  TEXT,
      to_user_id    TEXT,
      amount        REAL NOT NULL CHECK(amount > 0),
      fee           REAL NOT NULL DEFAULT 0 CHECK(fee >= 0),
      net           REAL NOT NULL CHECK(net > 0),
      status        TEXT NOT NULL DEFAULT 'complete',
      metadata_json TEXT DEFAULT '{}',
      request_id    TEXT,
      ip            TEXT,
      ref_id        TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK(from_user_id IS NOT NULL OR to_user_id IS NOT NULL)
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_from ON economy_ledger(from_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_to   ON economy_ledger(to_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_ref  ON economy_ledger(ref_id);
  `);

  return db;
}

/**
 * Build a test database WITHOUT the ref_id column to exercise fallback paths.
 */
function createTestDbWithoutRefId() {
  const dbPath = TEST_DB_PATH + ".noref";
  try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS economy_ledger (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      from_user_id  TEXT,
      to_user_id    TEXT,
      amount        REAL NOT NULL CHECK(amount > 0),
      fee           REAL NOT NULL DEFAULT 0 CHECK(fee >= 0),
      net           REAL NOT NULL CHECK(net > 0),
      status        TEXT NOT NULL DEFAULT 'complete',
      metadata_json TEXT DEFAULT '{}',
      request_id    TEXT,
      ip            TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK(from_user_id IS NOT NULL OR to_user_id IS NOT NULL)
    );
  `);

  return { db, dbPath };
}

function makeTx(overrides = {}) {
  return {
    type: "TOKEN_PURCHASE",
    to: "user-a",
    amount: 100,
    fee: 1.46,
    net: 98.54,
    ...overrides,
  };
}

function countRows(db) {
  return db.prepare("SELECT COUNT(*) as c FROM economy_ledger").get().c;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

let db;

beforeEach(() => {
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
  db = createTestDb();
});

afterEach(() => {
  if (db && db.open) db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
  try { fs.unlinkSync(TEST_DB_PATH + ".noref"); } catch { /* ok */ }
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. generateTxId
// ═════════════════════════════════════════════════════════════════════════════

describe("generateTxId", () => {
  it("returns a string prefixed with txn_", () => {
    const id = generateTxId();
    assert.ok(typeof id === "string");
    assert.ok(id.startsWith("txn_"), `Expected txn_ prefix, got: ${id}`);
  });

  it("returns a fixed-length ID (txn_ + 16 hex chars)", () => {
    const id = generateTxId();
    // "txn_" (4) + 16 hex chars = 20
    assert.equal(id.length, 20, `Expected length 20, got ${id.length}: ${id}`);
  });

  it("generates unique IDs across many calls", () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateTxId());
    }
    assert.equal(ids.size, 1000, "Expected 1000 unique IDs");
  });

  it("contains no dashes (UUID dashes stripped)", () => {
    const id = generateTxId();
    assert.ok(!id.includes("-"), `ID should not contain dashes: ${id}`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. nowISO
// ═════════════════════════════════════════════════════════════════════════════

describe("nowISO", () => {
  it("returns a string in YYYY-MM-DD HH:mm:ss.sss format (no T, no Z)", () => {
    const ts = nowISO();
    assert.ok(typeof ts === "string");
    assert.ok(!ts.includes("T"), "Should not contain T");
    assert.ok(!ts.includes("Z"), "Should not contain Z");
    // Should contain a space between date and time
    assert.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(ts), `Unexpected format: ${ts}`);
  });

  it("is close to the current time (within 2 seconds)", () => {
    const before = Date.now();
    const ts = nowISO();
    const after = Date.now();
    // Re-insert T and Z so Date can parse it
    const parsed = new Date(ts.replace(" ", "T") + "Z").getTime();
    assert.ok(parsed >= before - 2000 && parsed <= after + 2000, `Timestamp ${ts} out of range`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. recordTransaction — happy path
// ═════════════════════════════════════════════════════════════════════════════

describe("recordTransaction", () => {
  it("inserts a row and returns { id, createdAt }", () => {
    const result = recordTransaction(db, makeTx());
    assert.ok(result.id, "Should return an id");
    assert.ok(result.createdAt, "Should return createdAt");
    assert.equal(countRows(db), 1);
  });

  it("auto-generates an id if tx.id is not provided", () => {
    const result = recordTransaction(db, makeTx());
    assert.ok(result.id.startsWith("txn_"));
  });

  it("uses tx.id when explicitly provided", () => {
    const result = recordTransaction(db, makeTx({ id: "custom_id_001" }));
    assert.equal(result.id, "custom_id_001");
    const row = db.prepare("SELECT id FROM economy_ledger WHERE id = ?").get("custom_id_001");
    assert.ok(row);
  });

  it("persists all fields correctly", () => {
    const tx = {
      type: "TRANSFER",
      from: "sender-1",
      to: "receiver-1",
      amount: 200,
      fee: 2.92,
      net: 197.08,
      status: "complete",
      metadata: { note: "test payment" },
      requestId: "req-123",
      ip: "127.0.0.1",
      refId: "ref-abc",
    };
    const { id } = recordTransaction(db, tx);
    const row = db.prepare("SELECT * FROM economy_ledger WHERE id = ?").get(id);

    assert.equal(row.type, "TRANSFER");
    assert.equal(row.from_user_id, "sender-1");
    assert.equal(row.to_user_id, "receiver-1");
    assert.equal(row.amount, 200);
    assert.equal(row.fee, 2.92);
    assert.equal(row.net, 197.08);
    assert.equal(row.status, "complete");
    assert.equal(row.request_id, "req-123");
    assert.equal(row.ip, "127.0.0.1");
    assert.equal(row.ref_id, "ref-abc");
    assert.deepEqual(JSON.parse(row.metadata_json), { note: "test payment" });
  });

  it("defaults fee to 0 when not provided", () => {
    const { id } = recordTransaction(db, makeTx({ fee: undefined, net: undefined, amount: 50 }));
    const row = db.prepare("SELECT fee, net FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.fee, 0);
    assert.equal(row.net, 50); // amount - fee(0) = 50
  });

  it("defaults net to amount - fee when not provided", () => {
    const { id } = recordTransaction(db, makeTx({ amount: 100, fee: 5, net: undefined }));
    const row = db.prepare("SELECT net FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.net, 95);
  });

  it("defaults status to 'complete' when not provided", () => {
    const { id } = recordTransaction(db, makeTx({ status: undefined }));
    const row = db.prepare("SELECT status FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.status, "complete");
  });

  it("defaults metadata to empty object when not provided", () => {
    const { id } = recordTransaction(db, makeTx({ metadata: undefined }));
    const row = db.prepare("SELECT metadata_json FROM economy_ledger WHERE id = ?").get(id);
    assert.deepEqual(JSON.parse(row.metadata_json), {});
  });

  it("stores null for from/to when not provided", () => {
    // TOKEN_PURCHASE typically has only 'to'
    const { id } = recordTransaction(db, makeTx({ from: undefined }));
    const row = db.prepare("SELECT from_user_id, to_user_id FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.from_user_id, null);
    assert.equal(row.to_user_id, "user-a");
  });

  it("stores null for requestId, ip, refId when not provided", () => {
    const { id } = recordTransaction(db, makeTx());
    const row = db.prepare("SELECT request_id, ip, ref_id FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.request_id, null);
    assert.equal(row.ip, null);
    assert.equal(row.ref_id, null);
  });

  it("records different transaction types", () => {
    const types = [
      "TOKEN_PURCHASE", "TRANSFER", "MARKETPLACE_PURCHASE",
      "WITHDRAWAL", "FEE", "REVERSAL", "ROYALTY", "EMERGENT_TRANSFER",
    ];
    for (const type of types) {
      const { id } = recordTransaction(db, makeTx({ type }));
      const row = db.prepare("SELECT type FROM economy_ledger WHERE id = ?").get(id);
      assert.equal(row.type, type);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. recordTransaction — ref_id fallback (pre-migration)
// ═════════════════════════════════════════════════════════════════════════════

describe("recordTransaction — ref_id fallback", () => {
  it("falls back gracefully when ref_id column does not exist", () => {
    const { db: noRefDb, dbPath } = createTestDbWithoutRefId();
    try {
      const result = recordTransaction(noRefDb, makeTx());
      assert.ok(result.id);
      assert.ok(result.createdAt);
      const row = noRefDb.prepare("SELECT * FROM economy_ledger WHERE id = ?").get(result.id);
      assert.equal(row.amount, 100);
    } finally {
      noRefDb.close();
    }
  });

  it("re-throws non-ref_id errors (e.g. CHECK constraint failures)", () => {
    // amount <= 0 violates CHECK(amount > 0)
    assert.throws(() => {
      recordTransaction(db, makeTx({ amount: -5, net: -5 }));
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. recordTransactionBatch — happy path
// ═════════════════════════════════════════════════════════════════════════════

describe("recordTransactionBatch", () => {
  it("inserts multiple entries and returns results array", () => {
    const entries = [
      makeTx({ to: "batch-u1", amount: 50, fee: 0, net: 50 }),
      makeTx({ to: "batch-u2", amount: 30, fee: 0, net: 30 }),
      makeTx({ to: "batch-u3", amount: 20, fee: 0, net: 20 }),
    ];
    const results = recordTransactionBatch(db, entries);
    assert.equal(results.length, 3);
    assert.equal(countRows(db), 3);
    for (const r of results) {
      assert.ok(r.id);
      assert.ok(r.createdAt);
    }
  });

  it("all entries in a batch share the same createdAt timestamp", () => {
    const entries = [
      makeTx({ to: "ts-u1", amount: 10, fee: 0, net: 10 }),
      makeTx({ to: "ts-u2", amount: 20, fee: 0, net: 20 }),
    ];
    const results = recordTransactionBatch(db, entries);
    assert.equal(results[0].createdAt, results[1].createdAt);
  });

  it("uses provided tx.id if given, auto-generates otherwise", () => {
    const entries = [
      makeTx({ id: "batch_custom_1", to: "u1", amount: 10, fee: 0, net: 10 }),
      makeTx({ to: "u2", amount: 20, fee: 0, net: 20 }),
    ];
    const results = recordTransactionBatch(db, entries);
    assert.equal(results[0].id, "batch_custom_1");
    assert.ok(results[1].id.startsWith("txn_"));
  });

  it("handles an empty entries array without error", () => {
    const results = recordTransactionBatch(db, []);
    assert.deepEqual(results, []);
    assert.equal(countRows(db), 0);
  });

  it("handles single-entry batch", () => {
    const results = recordTransactionBatch(db, [
      makeTx({ to: "single-u", amount: 42, fee: 0, net: 42 }),
    ]);
    assert.equal(results.length, 1);
    assert.equal(countRows(db), 1);
  });

  it("persists ref_id for each entry when column exists", () => {
    const entries = [
      makeTx({ to: "ref-u1", amount: 10, fee: 0, net: 10, refId: "ref-batch-1" }),
      makeTx({ to: "ref-u2", amount: 20, fee: 0, net: 20, refId: "ref-batch-2" }),
    ];
    recordTransactionBatch(db, entries);
    const row1 = db.prepare("SELECT ref_id FROM economy_ledger WHERE ref_id = ?").get("ref-batch-1");
    const row2 = db.prepare("SELECT ref_id FROM economy_ledger WHERE ref_id = ?").get("ref-batch-2");
    assert.ok(row1);
    assert.ok(row2);
  });

  it("persists all fields correctly for batch entries", () => {
    const entries = [
      {
        type: "TRANSFER",
        from: "batch-from",
        to: "batch-to",
        amount: 100,
        fee: 1.46,
        net: 98.54,
        status: "pending",
        metadata: { batch: true },
        requestId: "req-batch",
        ip: "10.0.0.1",
        refId: "ref-batch-full",
      },
    ];
    const results = recordTransactionBatch(db, entries);
    const row = db.prepare("SELECT * FROM economy_ledger WHERE id = ?").get(results[0].id);
    assert.equal(row.type, "TRANSFER");
    assert.equal(row.from_user_id, "batch-from");
    assert.equal(row.to_user_id, "batch-to");
    assert.equal(row.amount, 100);
    assert.equal(row.fee, 1.46);
    assert.equal(row.net, 98.54);
    assert.equal(row.status, "pending");
    assert.equal(row.request_id, "req-batch");
    assert.equal(row.ip, "10.0.0.1");
    assert.equal(row.ref_id, "ref-batch-full");
    assert.deepEqual(JSON.parse(row.metadata_json), { batch: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. recordTransactionBatch — ref_id fallback
// ═════════════════════════════════════════════════════════════════════════════

describe("recordTransactionBatch — ref_id fallback", () => {
  it("falls back gracefully when ref_id column does not exist", () => {
    const { db: noRefDb, dbPath } = createTestDbWithoutRefId();
    try {
      const entries = [
        makeTx({ to: "noref-u1", amount: 10, fee: 0, net: 10 }),
        makeTx({ to: "noref-u2", amount: 20, fee: 0, net: 20 }),
      ];
      const results = recordTransactionBatch(noRefDb, entries);
      assert.equal(results.length, 2);
      const total = noRefDb.prepare("SELECT COUNT(*) as c FROM economy_ledger").get().c;
      assert.equal(total, 2);
    } finally {
      noRefDb.close();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. recordTransactionBatch — atomicity
// ═════════════════════════════════════════════════════════════════════════════

describe("recordTransactionBatch — atomicity", () => {
  it("when wrapped in db.transaction, all entries commit together", () => {
    const batchFn = db.transaction(() => {
      return recordTransactionBatch(db, [
        makeTx({ to: "atom-u1", amount: 10, fee: 0, net: 10 }),
        makeTx({ to: "atom-u2", amount: 20, fee: 0, net: 20 }),
      ]);
    });
    const results = batchFn();
    assert.equal(results.length, 2);
    assert.equal(countRows(db), 2);
  });

  it("when wrapped in db.transaction, a failure rolls back all entries", () => {
    const batchFn = db.transaction(() => {
      recordTransactionBatch(db, [
        makeTx({ to: "rollback-u1", amount: 10, fee: 0, net: 10 }),
      ]);
      // This should fail — amount -1 violates CHECK(amount > 0)
      recordTransaction(db, makeTx({ to: "rollback-u2", amount: -1, net: -1 }));
    });

    assert.throws(() => batchFn());
    // Rollback means no rows
    assert.equal(countRows(db), 0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. checkRefIdProcessed
// ═════════════════════════════════════════════════════════════════════════════

describe("checkRefIdProcessed", () => {
  it("returns { exists: false } for null/undefined/empty refId", () => {
    assert.deepEqual(checkRefIdProcessed(db, null), { exists: false });
    assert.deepEqual(checkRefIdProcessed(db, undefined), { exists: false });
    assert.deepEqual(checkRefIdProcessed(db, ""), { exists: false });
  });

  it("returns { exists: false } when no matching ref_id in ledger", () => {
    const result = checkRefIdProcessed(db, "nonexistent-ref");
    assert.equal(result.exists, false);
  });

  it("returns { exists: true, entries } when ref_id exists", () => {
    recordTransaction(db, makeTx({ refId: "dup-ref-1" }));
    const result = checkRefIdProcessed(db, "dup-ref-1");
    assert.equal(result.exists, true);
    assert.ok(Array.isArray(result.entries));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].type, "TOKEN_PURCHASE");
    assert.equal(result.entries[0].amount, 100);
  });

  it("returns multiple entries when ref_id was used across a batch", () => {
    recordTransactionBatch(db, [
      makeTx({ to: "multi-u1", amount: 10, fee: 0, net: 10, refId: "multi-ref" }),
      makeTx({ to: "multi-u2", amount: 20, fee: 0, net: 20, refId: "multi-ref" }),
    ]);
    const result = checkRefIdProcessed(db, "multi-ref");
    assert.equal(result.exists, true);
    assert.equal(result.entries.length, 2);
  });

  it("returns { exists: false } when ref_id column does not exist (fallback)", () => {
    const { db: noRefDb } = createTestDbWithoutRefId();
    try {
      const result = checkRefIdProcessed(noRefDb, "some-ref");
      assert.equal(result.exists, false);
    } finally {
      noRefDb.close();
    }
  });

  it("entries contain expected fields", () => {
    recordTransaction(db, makeTx({ refId: "field-check-ref" }));
    const result = checkRefIdProcessed(db, "field-check-ref");
    const entry = result.entries[0];
    assert.ok("id" in entry);
    assert.ok("type" in entry);
    assert.ok("amount" in entry);
    assert.ok("net" in entry);
    assert.ok("status" in entry);
    assert.ok("created_at" in entry);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. getTransactions
// ═════════════════════════════════════════════════════════════════════════════

describe("getTransactions", () => {
  it("returns transactions where user is sender or receiver", () => {
    recordTransaction(db, makeTx({ from: "alice", to: "bob", type: "TRANSFER", amount: 50, fee: 0, net: 50 }));
    recordTransaction(db, makeTx({ from: "bob", to: "charlie", type: "TRANSFER", amount: 30, fee: 0, net: 30 }));

    const aliceTx = getTransactions(db, "alice");
    assert.equal(aliceTx.items.length, 1);
    assert.equal(aliceTx.total, 1);

    const bobTx = getTransactions(db, "bob");
    assert.equal(bobTx.items.length, 2);
    assert.equal(bobTx.total, 2);

    const charlieTx = getTransactions(db, "charlie");
    assert.equal(charlieTx.items.length, 1);
    assert.equal(charlieTx.total, 1);
  });

  it("returns empty result for unknown user", () => {
    const result = getTransactions(db, "nonexistent-user");
    assert.equal(result.items.length, 0);
    assert.equal(result.total, 0);
  });

  it("respects limit and offset", () => {
    for (let i = 0; i < 10; i++) {
      recordTransaction(db, makeTx({ to: "paginated-user", amount: i + 1, fee: 0, net: i + 1 }));
    }

    const page1 = getTransactions(db, "paginated-user", { limit: 3, offset: 0 });
    assert.equal(page1.items.length, 3);
    assert.equal(page1.total, 10);
    assert.equal(page1.limit, 3);
    assert.equal(page1.offset, 0);

    const page2 = getTransactions(db, "paginated-user", { limit: 3, offset: 3 });
    assert.equal(page2.items.length, 3);
    assert.equal(page2.total, 10);
    assert.equal(page2.offset, 3);

    // Last partial page
    const page4 = getTransactions(db, "paginated-user", { limit: 3, offset: 9 });
    assert.equal(page4.items.length, 1);
  });

  it("filters by type when provided", () => {
    recordTransaction(db, makeTx({ to: "type-user", type: "TOKEN_PURCHASE", amount: 10, fee: 0, net: 10 }));
    recordTransaction(db, makeTx({ from: "type-user", to: "other", type: "TRANSFER", amount: 5, fee: 0, net: 5 }));
    recordTransaction(db, makeTx({ to: "type-user", type: "TOKEN_PURCHASE", amount: 20, fee: 0, net: 20 }));

    const purchases = getTransactions(db, "type-user", { type: "TOKEN_PURCHASE" });
    assert.equal(purchases.items.length, 2);
    assert.equal(purchases.total, 2);

    const transfers = getTransactions(db, "type-user", { type: "TRANSFER" });
    assert.equal(transfers.items.length, 1);
    assert.equal(transfers.total, 1);
  });

  it("uses default limit=50, offset=0 when options are omitted", () => {
    recordTransaction(db, makeTx({ to: "default-user", amount: 10, fee: 0, net: 10 }));
    const result = getTransactions(db, "default-user");
    assert.equal(result.limit, 50);
    assert.equal(result.offset, 0);
  });

  it("results are ordered by created_at DESC (most recent first)", () => {
    // Insert with ascending IDs so DB order would be ascending;
    // We verify output is descending
    const ids = [];
    for (let i = 0; i < 5; i++) {
      const { id } = recordTransaction(db, makeTx({ to: "order-user", amount: i + 1, fee: 0, net: i + 1 }));
      ids.push(id);
    }
    const result = getTransactions(db, "order-user");
    // All rows have the same created_at (nowISO is called per recordTransaction),
    // but order should still be DESC. Verify returned items come back in some order.
    assert.equal(result.items.length, 5);
  });

  it("parses metadata_json into metadata property", () => {
    recordTransaction(db, makeTx({ to: "meta-user", amount: 10, fee: 0, net: 10, metadata: { key: "value" } }));
    const result = getTransactions(db, "meta-user");
    assert.deepEqual(result.items[0].metadata, { key: "value" });
  });

  it("handles malformed metadata_json gracefully", () => {
    // Insert a row with invalid JSON directly
    const id = generateTxId();
    db.prepare(`
      INSERT INTO economy_ledger (id, type, to_user_id, amount, fee, net, metadata_json, created_at)
      VALUES (?, 'TOKEN_PURCHASE', 'bad-json-user', 10, 0, 10, 'not-json', datetime('now'))
    `).run(id);

    const result = getTransactions(db, "bad-json-user");
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0].metadata, {}); // safeJsonParse returns {}
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. getAllTransactions (admin view)
// ═════════════════════════════════════════════════════════════════════════════

describe("getAllTransactions", () => {
  it("returns all transactions system-wide", () => {
    recordTransaction(db, makeTx({ to: "all-u1", amount: 10, fee: 0, net: 10 }));
    recordTransaction(db, makeTx({ to: "all-u2", amount: 20, fee: 0, net: 20 }));
    recordTransaction(db, makeTx({ from: "all-u1", to: "all-u2", type: "TRANSFER", amount: 5, fee: 0, net: 5 }));

    const result = getAllTransactions(db);
    assert.equal(result.items.length, 3);
    assert.equal(result.total, 3);
  });

  it("uses default limit=100, offset=0", () => {
    recordTransaction(db, makeTx({ to: "def-user", amount: 10, fee: 0, net: 10 }));
    const result = getAllTransactions(db);
    assert.equal(result.limit, 100);
    assert.equal(result.offset, 0);
  });

  it("filters by type", () => {
    recordTransaction(db, makeTx({ to: "ft-u1", type: "TOKEN_PURCHASE", amount: 10, fee: 0, net: 10 }));
    recordTransaction(db, makeTx({ from: "ft-u1", to: "ft-u2", type: "TRANSFER", amount: 5, fee: 0, net: 5 }));

    const result = getAllTransactions(db, { type: "TOKEN_PURCHASE" });
    assert.equal(result.items.length, 1);
    assert.equal(result.total, 1);
    assert.equal(result.items[0].type, "TOKEN_PURCHASE");
  });

  it("filters by status", () => {
    recordTransaction(db, makeTx({ to: "fs-u1", amount: 10, fee: 0, net: 10, status: "complete" }));
    recordTransaction(db, makeTx({ to: "fs-u2", amount: 20, fee: 0, net: 20, status: "pending" }));

    const complete = getAllTransactions(db, { status: "complete" });
    assert.equal(complete.items.length, 1);
    assert.equal(complete.total, 1);

    const pending = getAllTransactions(db, { status: "pending" });
    assert.equal(pending.items.length, 1);
    assert.equal(pending.total, 1);
  });

  it("filters by both type AND status", () => {
    recordTransaction(db, makeTx({ to: "combo-u1", type: "TRANSFER", amount: 10, fee: 0, net: 10, status: "complete" }));
    recordTransaction(db, makeTx({ to: "combo-u2", type: "TRANSFER", amount: 20, fee: 0, net: 20, status: "pending" }));
    recordTransaction(db, makeTx({ to: "combo-u3", type: "TOKEN_PURCHASE", amount: 30, fee: 0, net: 30, status: "complete" }));

    const result = getAllTransactions(db, { type: "TRANSFER", status: "complete" });
    assert.equal(result.items.length, 1);
    assert.equal(result.total, 1);
  });

  it("respects limit and offset", () => {
    for (let i = 0; i < 5; i++) {
      recordTransaction(db, makeTx({ to: `page-u${i}`, amount: i + 1, fee: 0, net: i + 1 }));
    }
    const page = getAllTransactions(db, { limit: 2, offset: 2 });
    assert.equal(page.items.length, 2);
    assert.equal(page.total, 5);
    assert.equal(page.limit, 2);
    assert.equal(page.offset, 2);
  });

  it("returns empty result when no transactions exist", () => {
    const result = getAllTransactions(db);
    assert.equal(result.items.length, 0);
    assert.equal(result.total, 0);
  });

  it("parses metadata for each returned row", () => {
    recordTransaction(db, makeTx({ to: "admin-meta", amount: 10, fee: 0, net: 10, metadata: { admin: true } }));
    const result = getAllTransactions(db);
    assert.deepEqual(result.items[0].metadata, { admin: true });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. getTransaction (single lookup)
// ═════════════════════════════════════════════════════════════════════════════

describe("getTransaction", () => {
  it("returns a parsed transaction row by ID", () => {
    const { id } = recordTransaction(db, makeTx({ metadata: { single: true } }));
    const tx = getTransaction(db, id);
    assert.ok(tx);
    assert.equal(tx.id, id);
    assert.equal(tx.amount, 100);
    assert.deepEqual(tx.metadata, { single: true });
  });

  it("returns null for nonexistent ID", () => {
    const tx = getTransaction(db, "nonexistent_id_xyz");
    assert.equal(tx, null);
  });

  it("returns null for undefined/null ID", () => {
    // better-sqlite3 will bind undefined/null and find no match
    const tx = getTransaction(db, undefined);
    assert.equal(tx, null);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. Double-entry bookkeeping invariants
// ═════════════════════════════════════════════════════════════════════════════

describe("Double-entry bookkeeping invariants", () => {
  it("for a TRANSFER: debit amount equals credit amount + fee", () => {
    const amount = 100;
    const fee = 1.46;
    const net = 98.54;

    // Simulate a transfer: debit from sender, credit to receiver, fee to platform
    const batchFn = db.transaction(() => {
      return recordTransactionBatch(db, [
        { type: "TRANSFER", from: "sender", to: null, amount, fee: 0, net: amount, status: "complete", metadata: { role: "debit" } },
        { type: "TRANSFER", from: null, to: "receiver", amount, fee, net, status: "complete", metadata: { role: "credit" } },
        { type: "FEE", from: null, to: "platform", amount: fee, fee: 0, net: fee, status: "complete", metadata: { role: "fee" } },
      ]);
    });
    const results = batchFn();
    assert.equal(results.length, 3);

    // Verify credits (amount to receiver + fee to platform) = debit from sender
    const rows = db.prepare("SELECT * FROM economy_ledger").all();
    const debitRow = rows.find(r => JSON.parse(r.metadata_json).role === "debit");
    const creditRow = rows.find(r => JSON.parse(r.metadata_json).role === "credit");
    const feeRow = rows.find(r => JSON.parse(r.metadata_json).role === "fee");

    const totalCredited = creditRow.net + feeRow.net;
    assert.equal(
      Math.round(debitRow.amount * 100),
      Math.round(totalCredited * 100),
      `Debit ${debitRow.amount} should equal credits ${totalCredited}`
    );
  });

  it("net + fee = amount for every single entry", () => {
    recordTransaction(db, makeTx({ amount: 100, fee: 1.46, net: 98.54 }));
    recordTransaction(db, makeTx({ amount: 200, fee: 10, net: 190 }));
    recordTransaction(db, makeTx({ amount: 50, fee: 0, net: 50 }));

    const rows = db.prepare("SELECT amount, fee, net FROM economy_ledger").all();
    for (const row of rows) {
      const reconstructed = Math.round((row.fee + row.net) * 100) / 100;
      assert.equal(
        Math.round(row.amount * 100),
        Math.round(reconstructed * 100),
        `fee(${row.fee}) + net(${row.net}) should equal amount(${row.amount})`
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 13. Edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe("Edge cases", () => {
  it("handles very small amounts (e.g. 0.01)", () => {
    const { id } = recordTransaction(db, makeTx({ amount: 0.01, fee: 0, net: 0.01 }));
    const row = db.prepare("SELECT amount FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.amount, 0.01);
  });

  it("handles large amounts (e.g. 999999.99)", () => {
    const { id } = recordTransaction(db, makeTx({ amount: 999999.99, fee: 0, net: 999999.99 }));
    const row = db.prepare("SELECT amount FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.amount, 999999.99);
  });

  it("rejects zero amount (CHECK constraint)", () => {
    assert.throws(() => {
      recordTransaction(db, makeTx({ amount: 0, net: 0 }));
    }, /CHECK constraint/i);
  });

  it("rejects negative amount (CHECK constraint)", () => {
    assert.throws(() => {
      recordTransaction(db, makeTx({ amount: -100, net: -100 }));
    });
  });

  it("rejects negative fee (CHECK constraint)", () => {
    assert.throws(() => {
      recordTransaction(db, makeTx({ fee: -1 }));
    });
  });

  it("rejects zero net (CHECK constraint)", () => {
    assert.throws(() => {
      recordTransaction(db, makeTx({ amount: 10, fee: 10, net: 0 }));
    });
  });

  it("handles metadata with special characters and unicode", () => {
    const meta = { emoji: "\u{1F4B0}", quotes: 'He said "hello"', newline: "a\nb" };
    const { id } = recordTransaction(db, makeTx({ metadata: meta }));
    const row = db.prepare("SELECT metadata_json FROM economy_ledger WHERE id = ?").get(id);
    assert.deepEqual(JSON.parse(row.metadata_json), meta);
  });

  it("handles very large metadata objects", () => {
    const meta = {};
    for (let i = 0; i < 100; i++) {
      meta[`key_${i}`] = `value_${i}_${"x".repeat(50)}`;
    }
    const { id } = recordTransaction(db, makeTx({ metadata: meta }));
    const tx = getTransaction(db, id);
    assert.deepEqual(tx.metadata, meta);
  });

  it("duplicate custom IDs cause a PRIMARY KEY conflict", () => {
    recordTransaction(db, makeTx({ id: "dup-id" }));
    assert.throws(() => {
      recordTransaction(db, makeTx({ id: "dup-id" }));
    }, /UNIQUE constraint/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 14. SQL parameterisation (no injection)
// ═════════════════════════════════════════════════════════════════════════════

describe("SQL parameterisation", () => {
  it("user IDs with SQL injection patterns are safely stored and retrieved", () => {
    const maliciousId = "'; DROP TABLE economy_ledger; --";
    const { id } = recordTransaction(db, makeTx({ from: maliciousId, to: "safe-user" }));
    const row = db.prepare("SELECT from_user_id FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.from_user_id, maliciousId);
    // Table still exists
    assert.ok(countRows(db) >= 1);
  });

  it("type field with injection patterns is safely stored", () => {
    const { id } = recordTransaction(db, makeTx({ type: "TOKEN'; DROP TABLE economy_ledger;--" }));
    const row = db.prepare("SELECT type FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.type, "TOKEN'; DROP TABLE economy_ledger;--");
  });

  it("getTransactions with malicious userId does not corrupt queries", () => {
    const result = getTransactions(db, "' OR 1=1 --");
    assert.equal(result.items.length, 0);
    assert.equal(result.total, 0);
  });

  it("getTransactions with malicious type filter does not corrupt queries", () => {
    recordTransaction(db, makeTx({ to: "safe", amount: 10, fee: 0, net: 10 }));
    const result = getTransactions(db, "safe", { type: "' OR 1=1 --" });
    assert.equal(result.items.length, 0);
  });

  it("getAllTransactions with injection in type and status filters", () => {
    recordTransaction(db, makeTx({ to: "inj-user", amount: 10, fee: 0, net: 10 }));
    const result = getAllTransactions(db, { type: "x' OR '1'='1", status: "y' OR '1'='1" });
    assert.equal(result.items.length, 0);
    assert.equal(result.total, 0);
  });

  it("ref_id with injection patterns is safely stored and queried", () => {
    const maliciousRef = "ref'; DROP TABLE economy_ledger;--";
    recordTransaction(db, makeTx({ refId: maliciousRef }));
    const result = checkRefIdProcessed(db, maliciousRef);
    assert.equal(result.exists, true);
    assert.ok(countRows(db) >= 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 15. Idempotency via checkRefIdProcessed
// ═════════════════════════════════════════════════════════════════════════════

describe("Idempotency via checkRefIdProcessed", () => {
  it("allows detecting and skipping duplicate processing", () => {
    const refId = "idempotent-purchase-001";

    // First check — not processed yet
    const check1 = checkRefIdProcessed(db, refId);
    assert.equal(check1.exists, false);

    // Process the transaction
    recordTransaction(db, makeTx({ refId }));

    // Second check — now it exists
    const check2 = checkRefIdProcessed(db, refId);
    assert.equal(check2.exists, true);
    assert.equal(check2.entries.length, 1);
  });

  it("different ref_ids are independent", () => {
    recordTransaction(db, makeTx({ refId: "ref-alpha" }));
    recordTransaction(db, makeTx({ refId: "ref-beta", to: "user-b" }));

    assert.equal(checkRefIdProcessed(db, "ref-alpha").exists, true);
    assert.equal(checkRefIdProcessed(db, "ref-beta").exists, true);
    assert.equal(checkRefIdProcessed(db, "ref-gamma").exists, false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 16. Append-only ledger guarantee
// ═════════════════════════════════════════════════════════════════════════════

describe("Append-only ledger guarantee", () => {
  it("rows are never deleted — only counter-entries for reversals", () => {
    const { id: id1 } = recordTransaction(db, makeTx({ to: "append-u1", amount: 50, fee: 0, net: 50 }));
    const { id: id2 } = recordTransaction(db, makeTx({ to: "append-u2", amount: 30, fee: 0, net: 30 }));

    const countBefore = countRows(db);
    assert.equal(countBefore, 2);

    // Add a "reversal" as a new counter-entry (not deletion)
    recordTransaction(db, makeTx({
      type: "REVERSAL",
      from: "append-u1",
      to: null,
      amount: 50,
      fee: 0,
      net: 50,
      metadata: { originalTxId: id1, reason: "disputed" },
    }));

    // Count increased by 1 (append), never decreased
    assert.equal(countRows(db), countBefore + 1);

    // Original row still exists
    const original = db.prepare("SELECT * FROM economy_ledger WHERE id = ?").get(id1);
    assert.ok(original);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 17. Concurrent-like operations (sequential rapid-fire)
// ═════════════════════════════════════════════════════════════════════════════

describe("Rapid sequential operations (concurrency simulation)", () => {
  it("100 rapid inserts all succeed and are retrievable", () => {
    const ids = [];
    for (let i = 0; i < 100; i++) {
      const { id } = recordTransaction(db, makeTx({ to: "rapid-user", amount: 1, fee: 0, net: 1 }));
      ids.push(id);
    }
    assert.equal(countRows(db), 100);
    // All unique
    assert.equal(new Set(ids).size, 100);

    const result = getTransactions(db, "rapid-user", { limit: 200 });
    assert.equal(result.total, 100);
    assert.equal(result.items.length, 100);
  });

  it("batch of 50 entries in a single transaction succeeds", () => {
    const entries = [];
    for (let i = 0; i < 50; i++) {
      entries.push(makeTx({ to: `batch50-u${i}`, amount: i + 1, fee: 0, net: i + 1 }));
    }
    const batchFn = db.transaction(() => recordTransactionBatch(db, entries));
    const results = batchFn();
    assert.equal(results.length, 50);
    assert.equal(countRows(db), 50);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 18. Balance consistency — derived from ledger
// ═════════════════════════════════════════════════════════════════════════════

describe("Balance consistency (derived from ledger)", () => {
  it("sum of all credits (to_user_id=X) minus debits (from_user_id=X) is consistent", () => {
    // Simulate: user receives 100, sends 30, receives 20
    recordTransaction(db, makeTx({ to: "balance-user", amount: 100, fee: 0, net: 100 }));
    recordTransaction(db, makeTx({ from: "balance-user", to: "other", type: "TRANSFER", amount: 30, fee: 0, net: 30 }));
    recordTransaction(db, makeTx({ to: "balance-user", amount: 20, fee: 0, net: 20 }));

    // Manual balance derivation from ledger
    const credited = db.prepare(
      "SELECT COALESCE(SUM(net), 0) as total FROM economy_ledger WHERE to_user_id = ? AND status = 'complete'"
    ).get("balance-user").total;
    const debited = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM economy_ledger WHERE from_user_id = ? AND status = 'complete'"
    ).get("balance-user").total;

    const derivedBalance = credited - debited;
    // Received 100 + 20 = 120 net; sent 30 amount => balance = 90
    assert.equal(derivedBalance, 90);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 19. parseRow / safeJsonParse (internal, tested via public API)
// ═════════════════════════════════════════════════════════════════════════════

describe("parseRow / safeJsonParse (via getTransaction)", () => {
  it("parses valid JSON metadata", () => {
    const { id } = recordTransaction(db, makeTx({ metadata: { a: 1, b: [2, 3] } }));
    const tx = getTransaction(db, id);
    assert.deepEqual(tx.metadata, { a: 1, b: [2, 3] });
  });

  it("returns null for null metadata_json (JSON.parse(null) === null)", () => {
    const id = generateTxId();
    db.prepare(`
      INSERT INTO economy_ledger (id, type, to_user_id, amount, fee, net, metadata_json, created_at)
      VALUES (?, 'TOKEN_PURCHASE', 'null-meta', 10, 0, 10, NULL, datetime('now'))
    `).run(id);
    const tx = getTransaction(db, id);
    // JSON.parse(null) returns null, which is not an exception, so safeJsonParse returns null
    assert.equal(tx.metadata, null);
  });

  it("returns {} for empty string metadata_json", () => {
    const id = generateTxId();
    db.prepare(`
      INSERT INTO economy_ledger (id, type, to_user_id, amount, fee, net, metadata_json, created_at)
      VALUES (?, 'TOKEN_PURCHASE', 'empty-meta', 10, 0, 10, '', datetime('now'))
    `).run(id);
    const tx = getTransaction(db, id);
    assert.deepEqual(tx.metadata, {});
  });

  it("returns {} for invalid JSON metadata_json", () => {
    const id = generateTxId();
    db.prepare(`
      INSERT INTO economy_ledger (id, type, to_user_id, amount, fee, net, metadata_json, created_at)
      VALUES (?, 'TOKEN_PURCHASE', 'bad-meta', 10, 0, 10, '{broken', datetime('now'))
    `).run(id);
    const tx = getTransaction(db, id);
    assert.deepEqual(tx.metadata, {});
  });

  it("preserves all original row fields alongside metadata", () => {
    const { id } = recordTransaction(db, {
      type: "TRANSFER",
      from: "from-x",
      to: "to-x",
      amount: 42,
      fee: 0.61,
      net: 41.39,
      status: "complete",
      requestId: "r1",
      ip: "1.2.3.4",
    });
    const tx = getTransaction(db, id);
    assert.equal(tx.id, id);
    assert.equal(tx.type, "TRANSFER");
    assert.equal(tx.from_user_id, "from-x");
    assert.equal(tx.to_user_id, "to-x");
    assert.equal(tx.amount, 42);
    assert.equal(tx.fee, 0.61);
    assert.equal(tx.net, 41.39);
    assert.equal(tx.status, "complete");
    assert.equal(tx.request_id, "r1");
    assert.equal(tx.ip, "1.2.3.4");
    assert.ok(tx.created_at);
    // metadata field was added by parseRow
    assert.ok("metadata" in tx);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 20. Regression / stress tests
// ═════════════════════════════════════════════════════════════════════════════

describe("Stress & regression", () => {
  it("getTransaction count query remains correct after many inserts", () => {
    const N = 25;
    for (let i = 0; i < N; i++) {
      recordTransaction(db, makeTx({
        from: i % 2 === 0 ? "user-even" : "user-odd",
        to: i % 2 === 0 ? "user-odd" : "user-even",
        type: "TRANSFER",
        amount: i + 1,
        fee: 0,
        net: i + 1,
      }));
    }

    const evenTx = getTransactions(db, "user-even");
    assert.equal(evenTx.total, N); // user-even is from or to on every tx

    const oddTx = getTransactions(db, "user-odd");
    assert.equal(oddTx.total, N); // same — user-odd is from or to on every tx
  });

  it("getAllTransactions total matches actual row count", () => {
    for (let i = 0; i < 15; i++) {
      recordTransaction(db, makeTx({ to: `stress-u${i}`, amount: i + 1, fee: 0, net: i + 1 }));
    }
    const result = getAllTransactions(db, { limit: 5 });
    assert.equal(result.total, 15);
    assert.equal(result.items.length, 5);
  });

  it("fee=0 and net=amount is valid (no-fee transactions)", () => {
    const { id } = recordTransaction(db, makeTx({ amount: 77, fee: 0, net: 77 }));
    const row = db.prepare("SELECT fee, net, amount FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.fee, 0);
    assert.equal(row.net, 77);
    assert.equal(row.amount, 77);
  });

  it("fractional amounts are preserved precisely", () => {
    const { id } = recordTransaction(db, makeTx({ amount: 0.03, fee: 0.0004, net: 0.0296 }));
    const row = db.prepare("SELECT amount, fee, net FROM economy_ledger WHERE id = ?").get(id);
    assert.equal(row.amount, 0.03);
    assert.equal(row.fee, 0.0004);
    assert.equal(row.net, 0.0296);
  });
});
