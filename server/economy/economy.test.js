// economy/economy.test.js
// Test suite for Concord Economy System.
// Tests: idempotency, atomic transfers, persistence, withdrawal holds, double-spend.
//
// Run: node --test server/economy/economy.test.js

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import economy modules
import { recordTransaction, recordTransactionBatch, getTransactions, generateTxId } from "./ledger.js";
import { getBalance, hasSufficientBalance } from "./balances.js";
import { calculateFee, PLATFORM_ACCOUNT_ID } from "./fees.js";
import { validateAmount, validateBalance, validateUsers, validateTransfer } from "./validators.js";
import { executeTransfer, executePurchase, executeMarketplacePurchase, executeReversal } from "./transfer.js";
import { requestWithdrawal, approveWithdrawal, processWithdrawal, cancelWithdrawal } from "./withdrawals.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, ".test_economy.db");

let db;

function setupTestDb() {
  // Clean slate
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }

  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Run economy migrations
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
    CREATE INDEX IF NOT EXISTS idx_ledger_from ON economy_ledger(from_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_to   ON economy_ledger(to_user_id, created_at);

    CREATE TABLE IF NOT EXISTS economy_withdrawals (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      amount        REAL NOT NULL CHECK(amount > 0),
      fee           REAL NOT NULL DEFAULT 0,
      net           REAL NOT NULL CHECK(net > 0),
      status        TEXT NOT NULL DEFAULT 'pending',
      ledger_id     TEXT,
      reviewed_by   TEXT,
      reviewed_at   TEXT,
      processed_at  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stripe_events_processed (
      event_id    TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL UNIQUE,
      stripe_account_id   TEXT NOT NULL,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Audit log (used by economy audit module)
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      category TEXT,
      action TEXT,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      path TEXT,
      method TEXT,
      status_code TEXT,
      details TEXT
    );
  `);

  return db;
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

before(() => {
  db = setupTestDb();
});

after(() => {
  if (db) db.close();
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1: Ledger Integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe("Ledger", () => {
  it("records a transaction and retrieves it", () => {
    const result = recordTransaction(db, {
      type: "TOKEN_PURCHASE",
      to: "user-a",
      amount: 100,
      fee: 1.46,
      net: 98.54,
    });
    assert.ok(result.id);
    assert.ok(result.createdAt);

    const txs = getTransactions(db, "user-a");
    assert.ok(txs.items.length >= 1);
    const found = txs.items.find(t => t.id === result.id);
    assert.ok(found);
    assert.equal(found.amount, 100);
  });

  it("records a batch atomically", () => {
    const batchFn = db.transaction(() => {
      return recordTransactionBatch(db, [
        { type: "TOKEN_PURCHASE", to: "user-batch", amount: 50, fee: 0, net: 50 },
        { type: "TOKEN_PURCHASE", to: "user-batch", amount: 30, fee: 0, net: 30 },
      ]);
    });
    const results = batchFn();
    assert.equal(results.length, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2: Balance derivation (never stored)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Balances", () => {
  it("derives balance from ledger entries", () => {
    // user-a got 100 tokens from the ledger test
    const { balance } = getBalance(db, "user-a");
    assert.ok(balance > 0, `Expected positive balance, got ${balance}`);
  });

  it("returns zero for unknown user", () => {
    const { balance } = getBalance(db, "unknown-user-xyz");
    assert.equal(balance, 0);
  });

  it("checks sufficient balance correctly", () => {
    assert.equal(hasSufficientBalance(db, "user-a", 1), true);
    assert.equal(hasSufficientBalance(db, "user-a", 999999), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3: Fee engine
// ═══════════════════════════════════════════════════════════════════════════════

describe("Fees", () => {
  it("calculates 1.46% fee on transfers", () => {
    const { fee, net } = calculateFee("TRANSFER", 100);
    assert.equal(fee, 1.46);
    assert.equal(net, 98.54);
  });

  it("calculates 5% fee on marketplace", () => {
    const { fee, net } = calculateFee("MARKETPLACE_PURCHASE", 200);
    assert.equal(fee, 10);
    assert.equal(net, 190);
  });

  it("returns zero fee for royalty payouts", () => {
    const { fee } = calculateFee("ROYALTY_PAYOUT", 50);
    assert.equal(fee, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4: Validators
// ═══════════════════════════════════════════════════════════════════════════════

describe("Validators", () => {
  it("rejects negative amounts", () => {
    assert.equal(validateAmount(-5).ok, false);
  });

  it("rejects amounts above maximum", () => {
    assert.equal(validateAmount(2_000_000).ok, false);
  });

  it("accepts valid amounts", () => {
    assert.equal(validateAmount(50).ok, true);
  });

  it("rejects self-transfers", () => {
    assert.equal(validateUsers("same", "same").ok, false);
  });

  it("validates transfer with insufficient balance", () => {
    const result = validateTransfer(db, { from: "empty-user", to: "someone", amount: 100 });
    assert.equal(result.ok, false);
    assert.equal(result.error, "insufficient_balance");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5: Atomic transfers — no partial state
// ═══════════════════════════════════════════════════════════════════════════════

describe("Atomic Transfers", () => {
  it("executes transfer atomically: buyer decreases, seller increases, platform gets fee", () => {
    // Give user-transfer 1000 tokens (net after 1.46% fee)
    executePurchase(db, { userId: "user-transfer", amount: 1000 });

    const beforeSender = getBalance(db, "user-transfer").balance;
    const beforeRecipient = getBalance(db, "user-recipient").balance;
    const beforePlatform = getBalance(db, PLATFORM_ACCOUNT_ID).balance;

    const result = executeTransfer(db, {
      from: "user-transfer",
      to: "user-recipient",
      amount: 100,
    });

    assert.ok(result.ok, `Transfer failed: ${result.error}`);
    assert.ok(result.fee > 0);

    const afterSender = getBalance(db, "user-transfer").balance;
    const afterRecipient = getBalance(db, "user-recipient").balance;
    const afterPlatform = getBalance(db, PLATFORM_ACCOUNT_ID).balance;

    // Sender lost full amount
    const senderDelta = Math.round((beforeSender - afterSender) * 100) / 100;
    assert.equal(senderDelta, 100);
    // Recipient gained tokens
    assert.ok(afterRecipient > beforeRecipient, "Recipient should gain tokens");
    // Platform increased (fees from both purchase and transfer)
    assert.ok(afterPlatform > beforePlatform, "Platform should gain fees");
  });

  it("rejects transfer when insufficient balance", () => {
    const result = executeTransfer(db, {
      from: "broke-user",
      to: "user-recipient",
      amount: 500,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "insufficient_balance");
  });

  it("marketplace purchase: buyer→seller with 5% fee", () => {
    executePurchase(db, { userId: "buyer-mp", amount: 500 });

    const result = executeMarketplacePurchase(db, {
      buyerId: "buyer-mp",
      sellerId: "seller-mp",
      amount: 100,
      listingId: "listing-123",
    });

    assert.ok(result.ok);
    assert.equal(result.fee, 5); // 5% of 100
    assert.equal(result.net, 95);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 6: Double-spend prevention
// ═══════════════════════════════════════════════════════════════════════════════

describe("Double-Spend Prevention", () => {
  it("cannot spend same tokens twice in sequence", () => {
    // Purchase gives net tokens after 1.46% fee
    const purchase = executePurchase(db, { userId: "double-user", amount: 100 });
    assert.ok(purchase.ok);
    const availableBalance = getBalance(db, "double-user").balance;

    // First transfer uses most of the balance
    const transferAmount = Math.floor(availableBalance);
    const r1 = executeTransfer(db, { from: "double-user", to: "target1", amount: transferAmount });
    assert.ok(r1.ok, `First transfer failed: ${r1.error}`);

    // Second transfer for same amount should fail (balance depleted)
    const r2 = executeTransfer(db, { from: "double-user", to: "target2", amount: transferAmount });
    assert.equal(r2.ok, false);
    assert.equal(r2.error, "insufficient_balance");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 7: Reversals
// ═══════════════════════════════════════════════════════════════════════════════

describe("Reversals", () => {
  it("creates reversal entry, never deletes original", () => {
    executePurchase(db, { userId: "reversal-user", amount: 200 });
    const tx = executeTransfer(db, { from: "reversal-user", to: "other-user", amount: 50 });
    assert.ok(tx.ok);

    const originalTxId = tx.transactions[0].id;
    const reversal = executeReversal(db, { originalTxId, reason: "test" });
    assert.ok(reversal.ok);

    // Original still exists (marked reversed)
    const original = db.prepare("SELECT * FROM economy_ledger WHERE id = ?").get(originalTxId);
    assert.equal(original.status, "reversed");

    // Reversal entry exists
    assert.ok(reversal.transactions.length > 0);
  });

  it("cannot reverse an already-reversed transaction", () => {
    // The previous test already reversed the tx; try again
    const allTxs = getTransactions(db, "reversal-user");
    const reversedTx = allTxs.items.find(t => t.status === "reversed");
    if (reversedTx) {
      const result = executeReversal(db, { originalTxId: reversedTx.id, reason: "double" });
      assert.equal(result.ok, false);
      assert.equal(result.error, "already_reversed");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 8: Withdrawal workflow
// ═══════════════════════════════════════════════════════════════════════════════

describe("Withdrawal Workflow", () => {
  it("follows pending → approved → complete lifecycle", () => {
    executePurchase(db, { userId: "wd-user", amount: 500 });

    // Request
    const req = requestWithdrawal(db, { userId: "wd-user", amount: 100 });
    assert.ok(req.ok);
    assert.equal(req.withdrawal.status, "pending");

    // Approve
    const approve = approveWithdrawal(db, { withdrawalId: req.withdrawal.id, reviewerId: "admin" });
    assert.ok(approve.ok);

    // Process
    const process = processWithdrawal(db, { withdrawalId: req.withdrawal.id });
    assert.ok(process.ok);

    // Balance decreased
    const { balance } = getBalance(db, "wd-user");
    assert.ok(balance < 500);
  });

  it("withdrawal hold: pending withdrawal reduces available balance for new withdrawals", () => {
    executePurchase(db, { userId: "hold-user", amount: 100 });

    // Request withdrawal for 80
    const req1 = requestWithdrawal(db, { userId: "hold-user", amount: 80 });
    assert.ok(req1.ok);

    // Requesting another 80 should fail (only ~100 available, 80 pending)
    const req2 = requestWithdrawal(db, { userId: "hold-user", amount: 80 });
    assert.equal(req2.ok, false);
  });

  it("cancelled withdrawal releases hold", () => {
    executePurchase(db, { userId: "cancel-user", amount: 100 });

    const req = requestWithdrawal(db, { userId: "cancel-user", amount: 90 });
    assert.ok(req.ok);

    // Cancel it
    const cancel = cancelWithdrawal(db, { withdrawalId: req.withdrawal.id, userId: "cancel-user" });
    assert.ok(cancel.ok);

    // Now can request again
    const req2 = requestWithdrawal(db, { userId: "cancel-user", amount: 90 });
    assert.ok(req2.ok);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 9: Persistence (DB survives reconnect)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Persistence", () => {
  it("balance survives DB close and reopen", () => {
    executePurchase(db, { userId: "persist-user", amount: 777 });
    const before = getBalance(db, "persist-user").balance;

    // Close and reopen
    db.close();
    db = new Database(TEST_DB_PATH);
    db.pragma("journal_mode = WAL");

    const after = getBalance(db, "persist-user").balance;
    assert.equal(before, after);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 10: Webhook idempotency table
// ═══════════════════════════════════════════════════════════════════════════════

describe("Webhook Idempotency", () => {
  it("stores and detects processed events", () => {
    const eventId = "evt_test_123";

    // Not processed yet
    const check1 = db.prepare("SELECT event_id FROM stripe_events_processed WHERE event_id = ?").get(eventId);
    assert.equal(check1, undefined);

    // Mark processed
    db.prepare("INSERT INTO stripe_events_processed (event_id, event_type, processed_at) VALUES (?, ?, ?)").run(
      eventId, "checkout.session.completed", new Date().toISOString(),
    );

    // Now it's processed
    const check2 = db.prepare("SELECT event_id FROM stripe_events_processed WHERE event_id = ?").get(eventId);
    assert.ok(check2);
    assert.equal(check2.event_id, eventId);

    // Duplicate insert is ignored (INSERT OR IGNORE)
    db.prepare("INSERT OR IGNORE INTO stripe_events_processed (event_id, event_type, processed_at) VALUES (?, ?, ?)").run(
      eventId, "checkout.session.completed", new Date().toISOString(),
    );
    const count = db.prepare("SELECT COUNT(*) as c FROM stripe_events_processed WHERE event_id = ?").get(eventId);
    assert.equal(count.c, 1);
  });
});
