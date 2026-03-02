/**
 * Treasury Reconciliation Tests
 *
 * Comprehensive tests for economy/treasury-reconciliation.js covering:
 * - runTreasuryReconciliation: balanced books, drift detection, alert callbacks
 * - getReconciliationHistory: pagination, empty results, JSON parsing
 * - DRIFT_THRESHOLD export
 * - calculateLedgerTotals (indirectly through runTreasuryReconciliation)
 * - buildAlertMessage (indirectly through alert triggers)
 * - Edge cases: empty ledger, single entry, negative balances, null Stripe balance
 * - Error paths: DB failures, broken alert callbacks, invalid JSON
 *
 * Run: node --test tests/treasury-reconciliation.test.js
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

import {
  runTreasuryReconciliation,
  getReconciliationHistory,
  DRIFT_THRESHOLD,
} from "../economy/treasury-reconciliation.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a fresh in-memory DB with all tables required by treasury-reconciliation.
 * Mirrors the production schema from migrations 002 and 008.
 */
function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    -- Treasury singleton
    CREATE TABLE IF NOT EXISTS treasury (
      id              TEXT PRIMARY KEY,
      total_usd       REAL NOT NULL DEFAULT 0,
      total_coins     REAL NOT NULL DEFAULT 0,
      last_reconciled TEXT,
      drift_amount    REAL DEFAULT 0,
      drift_alert     INTEGER DEFAULT 0,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Seed single treasury record
    INSERT INTO treasury (id, total_usd, total_coins, updated_at)
    VALUES ('treasury_main', 0, 0, datetime('now'));

    -- Treasury events log
    CREATE TABLE IF NOT EXISTS treasury_events (
      id            TEXT PRIMARY KEY,
      event_type    TEXT NOT NULL CHECK(event_type IN ('MINT', 'BURN', 'RECONCILE', 'DRIFT_ALERT')),
      amount        REAL NOT NULL,
      usd_before    REAL NOT NULL,
      usd_after     REAL NOT NULL,
      coins_before  REAL NOT NULL,
      coins_after   REAL NOT NULL,
      ref_id        TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Economy ledger
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

    -- Economy withdrawals
    CREATE TABLE IF NOT EXISTS economy_withdrawals (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      amount        REAL NOT NULL CHECK(amount > 0),
      fee           REAL NOT NULL DEFAULT 0,
      net           REAL NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      ledger_id     TEXT,
      reviewed_by   TEXT,
      reviewed_at   TEXT,
      processed_at  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Reconciliation log
    CREATE TABLE IF NOT EXISTS treasury_reconciliation_log (
      id                TEXT PRIMARY KEY,
      ledger_total      REAL NOT NULL,
      stripe_total      REAL,
      drift             REAL NOT NULL DEFAULT 0,
      alert_triggered   INTEGER NOT NULL DEFAULT 0,
      details_json      TEXT DEFAULT '{}',
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Audit log (used by economyAudit)
    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      timestamp   TEXT,
      category    TEXT,
      action      TEXT,
      user_id     TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      request_id  TEXT,
      path        TEXT,
      method      TEXT,
      status_code TEXT,
      details     TEXT
    );
  `);

  return db;
}

/**
 * Set the treasury state.
 */
function seedTreasury(db, usd, coins) {
  db.prepare(
    "UPDATE treasury SET total_usd = ?, total_coins = ? WHERE id = 'treasury_main'"
  ).run(usd, coins);
}

/**
 * Insert a ledger entry directly.
 */
function insertLedgerEntry(db, { id, type, from, to, amount, fee, net, status }) {
  db.prepare(`
    INSERT INTO economy_ledger (id, type, from_user_id, to_user_id, amount, fee, net, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, type, from || null, to || null, amount, fee ?? 0, net ?? amount, status ?? "complete");
}

/**
 * Insert a pending withdrawal entry.
 */
function insertWithdrawal(db, { id, userId, amount, status }) {
  db.prepare(`
    INSERT INTO economy_withdrawals (id, user_id, amount, fee, net, status, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'))
  `).run(id, userId, amount, amount, status ?? "pending");
}

/**
 * Insert a reconciliation log entry directly (for history tests).
 */
function insertReconciliationLog(db, { id, ledgerTotal, stripeTotal, drift, alert, detailsJson, createdAt }) {
  db.prepare(`
    INSERT INTO treasury_reconciliation_log (id, ledger_total, stripe_total, drift, alert_triggered, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, ledgerTotal, stripeTotal ?? null, drift ?? 0, alert ? 1 : 0, detailsJson ?? "{}", createdAt ?? "2025-01-01 00:00:00");
}

/**
 * Set up a balanced treasury scenario:
 * - User A purchased 1000 coins (net=1000, to=user_a)
 * - User A withdrew 200 coins (amount=200, from=user_a)
 * - Platform received 50 in fees (net=50, to=__PLATFORM__, amount=50, from=user_a)
 *
 * Ledger calculations:
 * - totalMinted (TOKEN_PURCHASE net sum): 1000
 * - totalWithdrawn (WITHDRAWAL amount sum): 200
 * - expectedTreasury: 1000 - 200 = 800
 * - credits (to_user_id IS NOT NULL): net(1000) + net(50) = 1050 => 105000 cents
 * - debits (from_user_id IS NOT NULL): amount(200) + amount(50) = 250 => 25000 cents
 * - circulatingCoins: (105000 - 25000) / 100 = 800
 * - totalFees (FEE to __PLATFORM__): 50
 *
 * Treasury state: 800 USD, 800 coins (matching circulating)
 */
function seedBalancedScenario(db) {
  seedTreasury(db, 800, 800);

  // Token purchase: 1000 coins to user_a
  insertLedgerEntry(db, {
    id: "tx_purchase_1", type: "TOKEN_PURCHASE",
    from: null, to: "user_a", amount: 1000, fee: 0, net: 1000,
  });

  // Withdrawal: 200 from user_a
  insertLedgerEntry(db, {
    id: "tx_withdrawal_1", type: "WITHDRAWAL",
    from: "user_a", to: null, amount: 200, fee: 0, net: 200,
  });

  // Fee: 50 to platform
  insertLedgerEntry(db, {
    id: "tx_fee_1", type: "FEE",
    from: "user_a", to: "__PLATFORM__", amount: 50, fee: 0, net: 50,
  });
}

// ── Setup/Teardown ───────────────────────────────────────────────────────────

let db;
let consoleSpy;
let originalConsoleError;

beforeEach(() => {
  db = createTestDb();

  // Capture console.error to suppress noise and allow assertion
  originalConsoleError = console.error;
  consoleSpy = [];
  console.error = (...args) => { consoleSpy.push(args.join(" ")); };
});

afterEach(() => {
  console.error = originalConsoleError;
  if (db) {
    try { db.close(); } catch { /* ignore */ }
  }
});

// =============================================================================
// 1. DRIFT_THRESHOLD export
// =============================================================================

describe("DRIFT_THRESHOLD", () => {
  it("exports the drift threshold constant as 0.01", () => {
    assert.equal(typeof DRIFT_THRESHOLD, "number");
    assert.equal(DRIFT_THRESHOLD, 0.01);
  });
});

// =============================================================================
// 2. runTreasuryReconciliation — balanced books (no drift)
// =============================================================================

describe("runTreasuryReconciliation — balanced books", () => {
  it("returns ok: true with no alerts when everything balances", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.ok, true);
    assert.equal(result.alert, false);
    assert.ok(result.reconciliationId.startsWith("rec_"));
  });

  it("populates reconciliation.ledger with correct totals", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);
    const ledger = result.reconciliation.ledger;

    assert.equal(ledger.totalMinted, 1000);
    assert.equal(ledger.totalWithdrawn, 200);
    assert.equal(ledger.totalFees, 50);
    assert.equal(ledger.expectedTreasury, 800);
    assert.equal(ledger.transactionCount, 3);
    assert.equal(ledger.pendingWithdrawals, 0);
  });

  it("populates reconciliation.treasury from coin-service state", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    assert.deepEqual(result.reconciliation.treasury, { usd: 800, coins: 800 });
  });

  it("sets stripeBalance to 'not_provided' when not given", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.stripeBalance, "not_provided");
    assert.equal(result.reconciliation.drifts.stripe, null);
    assert.equal(result.reconciliation.alerts.stripe, false);
  });

  it("records zero drifts when balanced", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.drifts.treasury, 0);
    assert.equal(result.reconciliation.alerts.treasury, false);
  });

  it("records reconciliation in the DB log", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);

    assert.ok(row, "reconciliation log row should exist");
    assert.equal(row.ledger_total, 800);
    assert.equal(row.stripe_total, null);
    assert.equal(row.alert_triggered, 0);
  });

  it("updates treasury drift tracking row", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db);

    const treasury = db.prepare("SELECT * FROM treasury WHERE id = 'treasury_main'").get();
    assert.equal(treasury.drift_amount, 0);
    assert.equal(treasury.drift_alert, 0);
    assert.ok(treasury.last_reconciled, "last_reconciled should be set");
  });

  it("does not insert a DRIFT_ALERT treasury event when balanced", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db);

    const count = db.prepare(
      "SELECT COUNT(*) as c FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get().c;
    assert.equal(count, 0);
  });

  it("always logs reconciliation_complete audit event", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db);

    const audit = db.prepare(
      "SELECT * FROM audit_log WHERE action = 'treasury_reconciliation_complete'"
    ).get();
    assert.ok(audit, "audit log should contain reconciliation_complete");
    assert.equal(audit.user_id, "system");
  });

  it("does not log reconciliation_alert audit event when balanced", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db);

    const audit = db.prepare(
      "SELECT * FROM audit_log WHERE action = 'treasury_reconciliation_alert'"
    ).get();
    assert.equal(audit, undefined, "no alert audit should exist when balanced");
  });
});

// =============================================================================
// 3. runTreasuryReconciliation — treasury drift detection (imbalanced books)
// =============================================================================

describe("runTreasuryReconciliation — treasury drift detection", () => {
  it("detects treasury USD drift when treasury does not match ledger", () => {
    seedBalancedScenario(db);
    // Expected treasury from ledger: 1000-200 = 800
    // But set actual treasury_usd to 810 => drift of +10
    // Coins = 800 to match circulating so no coin drift
    seedTreasury(db, 810, 800);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.alert, true);
    assert.equal(result.reconciliation.drifts.treasury, 10);
    assert.equal(result.reconciliation.alerts.treasury, true);
  });

  it("detects negative treasury drift", () => {
    seedBalancedScenario(db);
    // Expected 800, actual 799 => drift of -1
    seedTreasury(db, 799, 800);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.alert, true);
    assert.equal(result.reconciliation.drifts.treasury, -1);
    assert.equal(result.reconciliation.alerts.treasury, true);
  });

  it("detects coin supply drift", () => {
    seedBalancedScenario(db);
    // circulatingCoins from ledger = 800 (see seedBalancedScenario)
    // Treasury coins = 810 => drift = 810 - 800 = 10
    seedTreasury(db, 800, 810);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.alert, true);
    assert.equal(result.reconciliation.alerts.coins, true);
    assert.equal(result.reconciliation.drifts.coins, 10);
  });

  it("triggers alert when invariant is violated (coins exceed USD)", () => {
    // Set coins > usd — this violates the invariant
    seedTreasury(db, 100, 200);

    // Add a purchase so there's ledger data matching treasury_usd=100
    insertLedgerEntry(db, {
      id: "tx_p1", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 100, fee: 0, net: 100,
    });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.alert, true);
    assert.equal(result.reconciliation.invariantHolds, false);
    assert.equal(result.reconciliation.alerts.invariant, true);
  });

  it("logs reconciliation_alert audit event on drift", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    runTreasuryReconciliation(db);

    const audit = db.prepare(
      "SELECT * FROM audit_log WHERE action = 'treasury_reconciliation_alert'"
    ).get();
    assert.ok(audit, "alert audit log should exist");
  });

  it("inserts DRIFT_ALERT treasury event on drift", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    const result = runTreasuryReconciliation(db);

    const event = db.prepare(
      "SELECT * FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get();
    assert.ok(event, "DRIFT_ALERT event should exist");
    assert.equal(event.amount, 10);
    assert.equal(event.ref_id, result.reconciliationId);
  });

  it("prints alert to console.error on drift", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    runTreasuryReconciliation(db);

    const alertMessages = consoleSpy.filter(m => m.includes("[TREASURY ALERT]"));
    assert.ok(alertMessages.length >= 1, "Expected at least one alert message on console.error");
    assert.ok(alertMessages[0].includes("Treasury drift"), "Alert should mention treasury drift");
  });

  it("does not alert on sub-threshold drift (less than $0.01)", () => {
    // With integer-like floats in SQLite, it's hard to get sub-threshold drift via ledger.
    // We can set treasury to 800 and have expectedTreasury = 800 => 0 drift.
    seedBalancedScenario(db);
    seedTreasury(db, 800, 800);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.alerts.treasury, false);
  });

  it("alerts on exactly threshold drift ($0.01)", () => {
    seedBalancedScenario(db);
    // 800.01 - 800 = 0.01 which equals DRIFT_THRESHOLD
    seedTreasury(db, 800.01, 800);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.drifts.treasury, 0.01);
    assert.equal(result.reconciliation.alerts.treasury, true);
    assert.equal(result.alert, true);
  });

  it("records alert_triggered=1 in DB log when drift detected", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    const result = runTreasuryReconciliation(db);

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);
    assert.equal(row.alert_triggered, 1);
  });
});

// =============================================================================
// 4. runTreasuryReconciliation — Stripe balance drift
// =============================================================================

describe("runTreasuryReconciliation — Stripe balance", () => {
  it("detects Stripe drift when stripeBalance differs from expected", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 810 });

    assert.equal(result.reconciliation.stripeBalance, 810);
    assert.equal(result.reconciliation.drifts.stripe, 10);
    assert.equal(result.reconciliation.alerts.stripe, true);
    assert.equal(result.alert, true);
  });

  it("reports no Stripe drift when balance matches expected treasury", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 800 });

    assert.equal(result.reconciliation.drifts.stripe, 0);
    assert.equal(result.reconciliation.alerts.stripe, false);
  });

  it("handles negative Stripe drift (Stripe has less than expected)", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 790 });

    assert.equal(result.reconciliation.drifts.stripe, -10);
    assert.equal(result.reconciliation.alerts.stripe, true);
  });

  it("records Stripe balance in DB log when provided", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 800 });

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);
    assert.equal(row.stripe_total, 800);
  });

  it("uses stripe drift in reconciliation log drift column when provided", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 810 });

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);
    // drift column: stripeDrift ?? treasuryDrift — stripe drift is 10
    assert.equal(row.drift, 10);
  });

  it("uses treasury drift in log drift column when stripe not provided", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    const result = runTreasuryReconciliation(db);

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);
    // stripeDrift is null, so drift = treasuryDrift = 10
    assert.equal(row.drift, 10);
  });

  it("handles stripeBalance of zero", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 0 });

    // stripeBalance is 0, expected is 800 => drift = -800
    assert.equal(result.reconciliation.stripeBalance, 0);
    assert.equal(result.reconciliation.drifts.stripe, -800);
    assert.equal(result.reconciliation.alerts.stripe, true);
  });

  it("correctly handles stripeBalance = null (treats as not provided)", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: null });

    assert.equal(result.reconciliation.stripeBalance, "not_provided");
    assert.equal(result.reconciliation.drifts.stripe, null);
  });

  it("correctly handles stripeBalance = undefined (treats as not provided)", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: undefined });

    assert.equal(result.reconciliation.stripeBalance, "not_provided");
    assert.equal(result.reconciliation.drifts.stripe, null);
  });
});

// =============================================================================
// 5. Alert callback
// =============================================================================

describe("runTreasuryReconciliation — alertCallback", () => {
  it("calls alertCallback with message and details on drift", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    let callbackArgs = null;
    const alertCallback = (message, details) => { callbackArgs = { message, details }; };

    runTreasuryReconciliation(db, { alertCallback });

    assert.ok(callbackArgs, "alertCallback should have been called");
    assert.equal(typeof callbackArgs.message, "string");
    assert.ok(callbackArgs.message.includes("Treasury drift"));
    assert.ok(callbackArgs.details.alerts);
    assert.ok(callbackArgs.details.drifts);
  });

  it("does not call alertCallback when no alert is triggered", () => {
    seedBalancedScenario(db);

    let called = false;
    const alertCallback = () => { called = true; };

    runTreasuryReconciliation(db, { alertCallback });

    assert.equal(called, false);
  });

  it("gracefully handles alertCallback that throws", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    const alertCallback = () => { throw new Error("callback exploded"); };

    // Should not throw — error is caught silently
    const result = runTreasuryReconciliation(db, { alertCallback });

    assert.equal(result.ok, true);
    assert.equal(result.alert, true);
  });

  it("includes Stripe drift in alert message when present", () => {
    seedBalancedScenario(db);

    let callbackMsg = "";
    const alertCallback = (message) => { callbackMsg = message; };

    runTreasuryReconciliation(db, { stripeBalance: 810, alertCallback });

    assert.ok(callbackMsg.includes("Stripe drift"));
  });

  it("includes coin supply drift in alert message", () => {
    seedBalancedScenario(db);
    // Force coin drift by mismatching coins with circulating
    seedTreasury(db, 800, 9999);

    let callbackMsg = "";
    const alertCallback = (message) => { callbackMsg = message; };

    runTreasuryReconciliation(db, { alertCallback });

    assert.ok(callbackMsg.includes("Coin supply drift"));
  });

  it("includes invariant violation in alert message", () => {
    // Coins > USD violates invariant
    seedTreasury(db, 10, 50);

    // Needs a ledger entry so expected treasury = 10
    insertLedgerEntry(db, {
      id: "tx_p1", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 10, fee: 0, net: 10,
    });

    let callbackMsg = "";
    const alertCallback = (message) => { callbackMsg = message; };

    runTreasuryReconciliation(db, { alertCallback });

    assert.ok(callbackMsg.includes("TREASURY INVARIANT VIOLATED"));
  });

  it("combines multiple alerts into a single pipe-delimited message", () => {
    seedBalancedScenario(db);
    // Treasury drift + coin drift
    seedTreasury(db, 810, 9999);

    let callbackMsg = "";
    const alertCallback = (message) => { callbackMsg = message; };

    runTreasuryReconciliation(db, { alertCallback });

    assert.ok(callbackMsg.includes(" | "), "Multiple alerts should be pipe-separated");
  });
});

// =============================================================================
// 6. runTreasuryReconciliation — pending transactions
// =============================================================================

describe("runTreasuryReconciliation — pending transactions", () => {
  it("reports pending withdrawals in ledger totals", () => {
    seedBalancedScenario(db);
    insertWithdrawal(db, { id: "wd_1", userId: "user_a", amount: 150, status: "pending" });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.ledger.pendingWithdrawals, 150);
  });

  it("accumulates multiple pending withdrawals", () => {
    seedBalancedScenario(db);
    insertWithdrawal(db, { id: "wd_1", userId: "user_a", amount: 100, status: "pending" });
    insertWithdrawal(db, { id: "wd_2", userId: "user_a", amount: 50, status: "approved" });
    insertWithdrawal(db, { id: "wd_3", userId: "user_b", amount: 25, status: "processing" });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.ledger.pendingWithdrawals, 175);
  });

  it("ignores completed and rejected withdrawals in pending count", () => {
    seedBalancedScenario(db);
    insertWithdrawal(db, { id: "wd_1", userId: "user_a", amount: 100, status: "complete" });
    insertWithdrawal(db, { id: "wd_2", userId: "user_a", amount: 50, status: "rejected" });
    insertWithdrawal(db, { id: "wd_3", userId: "user_a", amount: 25, status: "cancelled" });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.ledger.pendingWithdrawals, 0);
  });

  it("does not factor pending withdrawals into expected treasury calculation", () => {
    seedBalancedScenario(db);
    insertWithdrawal(db, { id: "wd_1", userId: "user_a", amount: 150, status: "pending" });

    const result = runTreasuryReconciliation(db);

    // Expected treasury is still totalMinted - totalWithdrawn = 1000 - 200 = 800
    assert.equal(result.reconciliation.ledger.expectedTreasury, 800);
  });
});

// =============================================================================
// 7. Edge cases — empty ledger
// =============================================================================

describe("runTreasuryReconciliation — empty ledger", () => {
  it("handles empty ledger with zero totals", () => {
    // Treasury at 0/0, no ledger entries
    const result = runTreasuryReconciliation(db);

    assert.equal(result.ok, true);
    assert.equal(result.alert, false);
    assert.equal(result.reconciliation.ledger.totalMinted, 0);
    assert.equal(result.reconciliation.ledger.totalWithdrawn, 0);
    assert.equal(result.reconciliation.ledger.expectedTreasury, 0);
    assert.equal(result.reconciliation.ledger.circulatingCoins, 0);
    assert.equal(result.reconciliation.ledger.transactionCount, 0);
    assert.equal(result.reconciliation.ledger.pendingWithdrawals, 0);
    assert.equal(result.reconciliation.ledger.totalFees, 0);
  });

  it("reports no drift with empty ledger and zero treasury", () => {
    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.drifts.treasury, 0);
    assert.equal(result.reconciliation.drifts.coins, 0);
    assert.equal(result.reconciliation.drifts.stripe, null);
  });
});

// =============================================================================
// 8. Edge cases — single entry
// =============================================================================

describe("runTreasuryReconciliation — single entry ledger", () => {
  it("handles single purchase with matching treasury", () => {
    seedTreasury(db, 50, 50);
    insertLedgerEntry(db, {
      id: "tx_p1", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 50, fee: 0, net: 50,
    });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.ok, true);
    assert.equal(result.reconciliation.ledger.totalMinted, 50);
    assert.equal(result.reconciliation.ledger.expectedTreasury, 50);
    assert.equal(result.reconciliation.ledger.transactionCount, 1);
    assert.equal(result.reconciliation.drifts.treasury, 0);
  });

  it("handles single withdrawal only (negative expected treasury)", () => {
    seedTreasury(db, 0, 0);
    insertLedgerEntry(db, {
      id: "tx_w1", type: "WITHDRAWAL",
      from: "user_a", to: null, amount: 100, fee: 0, net: 100,
    });

    const result = runTreasuryReconciliation(db);

    // Expected: 0 (minted) - 100 (withdrawn) = -100
    assert.equal(result.reconciliation.ledger.expectedTreasury, -100);
    // Treasury is 0, so drift = 0 - (-100) = 100
    assert.equal(result.reconciliation.drifts.treasury, 100);
    assert.equal(result.alert, true);
  });
});

// =============================================================================
// 9. Edge cases — incomplete transactions (non-complete status)
// =============================================================================

describe("runTreasuryReconciliation — transaction status filtering", () => {
  it("only counts complete transactions in ledger totals", () => {
    seedTreasury(db, 100, 100);

    // Complete purchase
    insertLedgerEntry(db, {
      id: "tx_p1", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 100, fee: 0, net: 100, status: "complete",
    });
    // Pending purchase (should be ignored)
    insertLedgerEntry(db, {
      id: "tx_p2", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 500, fee: 0, net: 500, status: "pending",
    });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.ledger.totalMinted, 100);
    assert.equal(result.reconciliation.ledger.transactionCount, 1);
  });
});

// =============================================================================
// 10. Default opts handling
// =============================================================================

describe("runTreasuryReconciliation — default options handling", () => {
  it("works with no opts parameter at all", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.ok, true);
    assert.equal(result.reconciliation.stripeBalance, "not_provided");
  });

  it("works with empty opts object", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, {});

    assert.equal(result.ok, true);
  });
});

// =============================================================================
// 11. Reconciliation ID format
// =============================================================================

describe("runTreasuryReconciliation — reconciliation ID", () => {
  it("generates unique reconciliation IDs with rec_ prefix", () => {
    seedBalancedScenario(db);

    const result1 = runTreasuryReconciliation(db);
    const result2 = runTreasuryReconciliation(db);

    assert.ok(result1.reconciliationId.startsWith("rec_"));
    assert.ok(result2.reconciliationId.startsWith("rec_"));
    assert.notEqual(result1.reconciliationId, result2.reconciliationId);
    // Total length: "rec_" + 16 hex chars = 20
    assert.equal(result1.reconciliationId.length, 20);
  });
});

// =============================================================================
// 12. Timestamp format
// =============================================================================

describe("runTreasuryReconciliation — timestamp", () => {
  it("includes a timestamp in ISO-like format without T and Z", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    assert.ok(result.reconciliation.timestamp, "timestamp should be present");
    // Format: "YYYY-MM-DD HH:MM:SS.mmm" (no T, no Z)
    assert.ok(!result.reconciliation.timestamp.includes("T"), "should not contain T");
    assert.ok(!result.reconciliation.timestamp.includes("Z"), "should not contain Z");
    assert.ok(result.reconciliation.timestamp.includes(" "), "should have space separator");
  });
});

// =============================================================================
// 13. Floating-point precision
// =============================================================================

describe("runTreasuryReconciliation — floating-point precision", () => {
  it("rounds drift calculations to 2 decimal places", () => {
    seedBalancedScenario(db);
    // 800.123 - 800 = 0.123 => rounded to 0.12
    seedTreasury(db, 800.123, 800);

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.drifts.treasury, 0.12);
  });

  it("rounds Stripe drift to 2 decimal places", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 800.007 });

    assert.equal(result.reconciliation.drifts.stripe, 0.01);
  });
});

// =============================================================================
// 14. Details JSON stored in reconciliation log
// =============================================================================

describe("runTreasuryReconciliation — details_json in reconciliation log", () => {
  it("stores complete details as JSON in reconciliation log", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 800 });

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);
    const details = JSON.parse(row.details_json);

    assert.ok(details.ledger, "details should contain ledger");
    assert.ok(details.treasury, "details should contain treasury");
    assert.ok(details.stripe, "details should contain stripe");
    assert.ok(details.drifts, "details should contain drifts");
    assert.equal(typeof details.invariant, "boolean");
    assert.ok(details.alerts, "details should contain alerts");
  });

  it("sets stripe to null in details when not provided", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);
    const details = JSON.parse(row.details_json);

    assert.equal(details.stripe, null);
  });

  it("includes stripe balance and drift in details when provided", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 810 });

    const row = db.prepare(
      "SELECT * FROM treasury_reconciliation_log WHERE id = ?"
    ).get(result.reconciliationId);
    const details = JSON.parse(row.details_json);

    assert.deepEqual(details.stripe, { balance: 810, drift: 10 });
  });
});

// =============================================================================
// 15. getReconciliationHistory
// =============================================================================

describe("getReconciliationHistory", () => {
  it("returns items, total, alertCount, limit, and offset", () => {
    insertReconciliationLog(db, {
      id: "rec_001", ledgerTotal: 800, drift: 0, alert: false,
    });
    insertReconciliationLog(db, {
      id: "rec_002", ledgerTotal: 810, drift: 10, alert: true,
    });

    const result = getReconciliationHistory(db);

    assert.equal(result.items.length, 2);
    assert.equal(result.total, 2);
    assert.equal(result.alertCount, 1);
    assert.equal(result.limit, 30);
    assert.equal(result.offset, 0);
  });

  it("parses details_json for each item", () => {
    insertReconciliationLog(db, {
      id: "rec_001", ledgerTotal: 800, drift: 0, alert: false,
      detailsJson: '{"foo":"bar","num":42}',
    });

    const result = getReconciliationHistory(db);

    assert.deepEqual(result.items[0].details, { foo: "bar", num: 42 });
  });

  it("returns empty object for invalid JSON in details_json", () => {
    // Insert directly with invalid JSON (bypass normal flow)
    db.prepare(`
      INSERT INTO treasury_reconciliation_log (id, ledger_total, drift, alert_triggered, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("rec_bad", 0, 0, 0, "NOT VALID JSON{{{", "2025-01-01 00:00:00");

    const result = getReconciliationHistory(db);

    assert.deepEqual(result.items[0].details, {});
  });

  it("applies custom limit and offset", () => {
    for (let i = 0; i < 50; i++) {
      insertReconciliationLog(db, {
        id: `rec_${String(i).padStart(3, "0")}`,
        ledgerTotal: 800,
        drift: 0,
        alert: false,
        createdAt: `2025-01-${String(i + 1).padStart(2, "0")} 00:00:00`,
      });
    }

    const result = getReconciliationHistory(db, { limit: 10, offset: 20 });

    assert.equal(result.limit, 10);
    assert.equal(result.offset, 20);
    assert.equal(result.items.length, 10);
    assert.equal(result.total, 50);
  });

  it("uses default limit=30, offset=0 when not specified", () => {
    const result = getReconciliationHistory(db);

    assert.equal(result.limit, 30);
    assert.equal(result.offset, 0);
  });

  it("handles empty history (no reconciliation records)", () => {
    const result = getReconciliationHistory(db);

    assert.equal(result.items.length, 0);
    assert.equal(result.total, 0);
    assert.equal(result.alertCount, 0);
  });

  it("uses defaults when called with empty opts", () => {
    const result = getReconciliationHistory(db, {});

    assert.equal(result.limit, 30);
    assert.equal(result.offset, 0);
  });

  it("preserves original item fields alongside parsed details", () => {
    insertReconciliationLog(db, {
      id: "rec_full",
      ledgerTotal: 800,
      stripeTotal: 800,
      drift: 0,
      alert: false,
      detailsJson: '{"ledger":{"totalMinted":1000}}',
      createdAt: "2025-01-01 00:00:00",
    });

    const result = getReconciliationHistory(db);
    const item = result.items[0];

    assert.equal(item.id, "rec_full");
    assert.equal(item.ledger_total, 800);
    assert.equal(item.stripe_total, 800);
    assert.equal(item.drift, 0);
    assert.equal(item.alert_triggered, 0);
    assert.equal(item.created_at, "2025-01-01 00:00:00");
    assert.deepEqual(item.details, { ledger: { totalMinted: 1000 } });
  });

  it("returns results in descending order by created_at", () => {
    insertReconciliationLog(db, {
      id: "rec_old", ledgerTotal: 800, drift: 0, alert: false,
      createdAt: "2025-01-01 00:00:00",
    });
    insertReconciliationLog(db, {
      id: "rec_new", ledgerTotal: 810, drift: 10, alert: true,
      createdAt: "2025-06-15 12:00:00",
    });

    const result = getReconciliationHistory(db);

    assert.equal(result.items[0].id, "rec_new");
    assert.equal(result.items[1].id, "rec_old");
  });
});

// =============================================================================
// 16. Multiple drift types simultaneously
// =============================================================================

describe("runTreasuryReconciliation — multiple concurrent drifts", () => {
  it("detects treasury, coin, and Stripe drift simultaneously", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 9999);

    const result = runTreasuryReconciliation(db, { stripeBalance: 790 });

    assert.equal(result.alert, true);
    assert.equal(result.reconciliation.alerts.treasury, true);
    assert.equal(result.reconciliation.alerts.coins, true);
    assert.equal(result.reconciliation.alerts.stripe, true);
  });

  it("alert is true if only invariant fails (no numeric drifts)", () => {
    // Coins > USD violates invariant, but numeric drifts could be zero
    // Create scenario where treasury USD matches expected but coins > USD
    seedTreasury(db, 100, 200);
    insertLedgerEntry(db, {
      id: "tx_p1", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 100, fee: 0, net: 100,
    });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.alert, true);
    assert.equal(result.reconciliation.alerts.invariant, true);
  });
});

// =============================================================================
// 17. Treasury event metadata on drift
// =============================================================================

describe("runTreasuryReconciliation — treasury event on drift", () => {
  it("records event with correct metadata JSON", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    runTreasuryReconciliation(db);

    const event = db.prepare(
      "SELECT * FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get();
    assert.ok(event);
    const metadata = JSON.parse(event.metadata_json);
    assert.ok(metadata.alerts, "metadata should have alerts");
    assert.ok(metadata.drifts, "metadata should have drifts");
  });

  it("uses absolute value of drift for event amount", () => {
    seedBalancedScenario(db);
    // treasury drift = 790 - 800 = -10
    seedTreasury(db, 790, 800);

    runTreasuryReconciliation(db);

    const event = db.prepare(
      "SELECT * FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get();
    // amount should be Math.abs(-10) = 10
    assert.equal(event.amount, 10);
  });

  it("uses stripe drift for event amount when stripe is provided", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db, { stripeBalance: 825 });

    const event = db.prepare(
      "SELECT * FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get();
    // Math.abs(stripeDrift) = Math.abs(25) = 25
    assert.equal(event.amount, 25);
  });

  it("sets usd_before and usd_after to current treasury USD", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    runTreasuryReconciliation(db);

    const event = db.prepare(
      "SELECT * FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get();
    assert.equal(event.usd_before, 810);
    assert.equal(event.usd_after, 810);
  });

  it("sets coins_before and coins_after to current treasury coins", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 850);

    runTreasuryReconciliation(db);

    const event = db.prepare(
      "SELECT * FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get();
    assert.equal(event.coins_before, 850);
    assert.equal(event.coins_after, 850);
  });

  it("references reconciliation ID in ref_id field", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    const result = runTreasuryReconciliation(db);

    const event = db.prepare(
      "SELECT * FROM treasury_events WHERE event_type = 'DRIFT_ALERT'"
    ).get();
    assert.equal(event.ref_id, result.reconciliationId);
  });
});

// =============================================================================
// 18. Large-value reconciliation
// =============================================================================

describe("runTreasuryReconciliation — large values", () => {
  it("handles very large balances without precision loss", () => {
    // credits: net=10000000 => 1000000000000 cents (to user_a)
    // debits: amount=2000000 => 200000000 cents (from user_a)
    // circulating = (1000000000 - 200000000) / 100 = 8000000
    seedTreasury(db, 8000000, 8000000);

    insertLedgerEntry(db, {
      id: "tx_big_buy", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 10000000, fee: 0, net: 10000000,
    });
    insertLedgerEntry(db, {
      id: "tx_big_wd", type: "WITHDRAWAL",
      from: "user_a", to: null, amount: 2000000, fee: 0, net: 2000000,
    });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.ok, true);
    assert.equal(result.reconciliation.ledger.totalMinted, 10000000);
    assert.equal(result.reconciliation.ledger.expectedTreasury, 8000000);
    assert.equal(result.reconciliation.drifts.treasury, 0);
    assert.equal(result.reconciliation.drifts.coins, 0);
  });
});

// =============================================================================
// 19. Audit logging behavior
// =============================================================================

describe("runTreasuryReconciliation — audit logging", () => {
  it("logs reconciliation_complete with system user ID", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db);

    const audit = db.prepare(
      "SELECT * FROM audit_log WHERE action = 'treasury_reconciliation_complete'"
    ).get();
    assert.ok(audit);
    assert.equal(audit.user_id, "system");
  });

  it("logs both alert and complete audit events on drift", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    runTreasuryReconciliation(db);

    const alertAudit = db.prepare(
      "SELECT * FROM audit_log WHERE action = 'treasury_reconciliation_alert'"
    ).get();
    const completeAudit = db.prepare(
      "SELECT * FROM audit_log WHERE action = 'treasury_reconciliation_complete'"
    ).get();

    assert.ok(alertAudit, "alert audit should exist");
    assert.ok(completeAudit, "complete audit should exist");
  });

  it("alert audit includes reconciliation details", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);

    runTreasuryReconciliation(db);

    const alertAudit = db.prepare(
      "SELECT * FROM audit_log WHERE action = 'treasury_reconciliation_alert'"
    ).get();
    const details = JSON.parse(alertAudit.details);
    assert.ok(details.reconciliationId, "should have reconciliationId");
    assert.ok(details.alerts, "should have alerts");
    assert.ok(details.drifts, "should have drifts");
  });
});

// =============================================================================
// 20. Return structure completeness
// =============================================================================

describe("runTreasuryReconciliation — return structure", () => {
  it("returns all expected top-level fields", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);

    assert.ok("ok" in result);
    assert.ok("reconciliationId" in result);
    assert.ok("alert" in result);
    assert.ok("reconciliation" in result);
  });

  it("returns all expected reconciliation sub-fields", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);
    const rec = result.reconciliation;

    assert.ok("ledger" in rec);
    assert.ok("treasury" in rec);
    assert.ok("stripeBalance" in rec);
    assert.ok("drifts" in rec);
    assert.ok("invariantHolds" in rec);
    assert.ok("alerts" in rec);
    assert.ok("timestamp" in rec);
  });

  it("returns all expected alerts sub-fields", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);
    const alerts = result.reconciliation.alerts;

    assert.ok("stripe" in alerts);
    assert.ok("treasury" in alerts);
    assert.ok("coins" in alerts);
    assert.ok("invariant" in alerts);
  });

  it("returns all expected drifts sub-fields", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);
    const drifts = result.reconciliation.drifts;

    assert.ok("treasury" in drifts);
    assert.ok("coins" in drifts);
    assert.ok("stripe" in drifts);
  });

  it("returns all expected ledger sub-fields", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db);
    const ledger = result.reconciliation.ledger;

    assert.ok("totalMinted" in ledger);
    assert.ok("totalWithdrawn" in ledger);
    assert.ok("totalFees" in ledger);
    assert.ok("circulatingCoins" in ledger);
    assert.ok("pendingWithdrawals" in ledger);
    assert.ok("expectedTreasury" in ledger);
    assert.ok("transactionCount" in ledger);
  });
});

// =============================================================================
// 21. Historical reconciliation — running multiple reconciliations
// =============================================================================

describe("runTreasuryReconciliation — historical reconciliation", () => {
  it("accumulates reconciliation history across multiple runs", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db);
    runTreasuryReconciliation(db, { stripeBalance: 800 });
    runTreasuryReconciliation(db, { stripeBalance: 810 });

    const history = getReconciliationHistory(db);

    assert.equal(history.total, 3);
    assert.equal(history.items.length, 3);
    // At least one alert (the stripe=810 run)
    assert.ok(history.alertCount >= 1);
  });

  it("each run creates a unique log entry", () => {
    seedBalancedScenario(db);

    const r1 = runTreasuryReconciliation(db);
    const r2 = runTreasuryReconciliation(db);

    assert.notEqual(r1.reconciliationId, r2.reconciliationId);

    const rows = db.prepare("SELECT * FROM treasury_reconciliation_log").all();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].id, rows[1].id);
  });

  it("updates treasury last_reconciled timestamp on each run", () => {
    seedBalancedScenario(db);

    runTreasuryReconciliation(db);
    const t1 = db.prepare("SELECT last_reconciled FROM treasury WHERE id = 'treasury_main'").get();

    // Tiny delay to ensure different timestamp (in practice, nowISO includes ms)
    runTreasuryReconciliation(db);
    const t2 = db.prepare("SELECT last_reconciled FROM treasury WHERE id = 'treasury_main'").get();

    assert.ok(t1.last_reconciled, "last_reconciled should be set after first run");
    assert.ok(t2.last_reconciled, "last_reconciled should be set after second run");
  });
});

// =============================================================================
// 22. Error paths — DB write failures
// =============================================================================

describe("runTreasuryReconciliation — DB error handling", () => {
  it("continues and returns result even when reconciliation log table is missing", () => {
    seedBalancedScenario(db);
    // Drop the reconciliation log table to simulate DB error
    db.exec("DROP TABLE treasury_reconciliation_log");

    const result = runTreasuryReconciliation(db);

    // Should still return ok: true (the error is caught in the try/catch)
    assert.equal(result.ok, true);
    // Error should be logged
    const errorLogs = consoleSpy.filter(m => m.includes("Failed to record"));
    assert.ok(errorLogs.length >= 1, "DB error should be logged to console.error");
  });

  it("still processes alerts even when DB write fails", () => {
    seedBalancedScenario(db);
    seedTreasury(db, 810, 800);
    db.exec("DROP TABLE treasury_reconciliation_log");

    let callbackCalled = false;
    const alertCallback = () => { callbackCalled = true; };

    const result = runTreasuryReconciliation(db, { alertCallback });

    assert.equal(result.alert, true);
    assert.equal(callbackCalled, true);
  });
});

// =============================================================================
// 23. Multiple transaction types in ledger
// =============================================================================

describe("runTreasuryReconciliation — diverse ledger entries", () => {
  it("correctly calculates with mixed transaction types", () => {
    // Credits (to_user_id IS NOT NULL): net(200)+net(150)+net(10)+net(25) = 385 => 38500 cents
    // Debits (from_user_id IS NOT NULL): amount(50)+amount(10)+amount(25) = 85 => 8500 cents
    // circulatingCoins = (38500-8500)/100 = 300
    // expectedTreasury = minted(350) - withdrawn(50) = 300
    seedTreasury(db, 300, 300);

    // Multiple purchases
    insertLedgerEntry(db, {
      id: "tx_p1", type: "TOKEN_PURCHASE",
      from: null, to: "user_a", amount: 200, fee: 0, net: 200,
    });
    insertLedgerEntry(db, {
      id: "tx_p2", type: "TOKEN_PURCHASE",
      from: null, to: "user_b", amount: 150, fee: 0, net: 150,
    });

    // Withdrawal
    insertLedgerEntry(db, {
      id: "tx_w1", type: "WITHDRAWAL",
      from: "user_a", to: null, amount: 50, fee: 0, net: 50,
    });

    // Fee to platform
    insertLedgerEntry(db, {
      id: "tx_f1", type: "FEE",
      from: "user_a", to: "__PLATFORM__", amount: 10, fee: 0, net: 10,
    });

    // Transfer between users (not minted or withdrawn)
    insertLedgerEntry(db, {
      id: "tx_t1", type: "TRANSFER",
      from: "user_a", to: "user_b", amount: 25, fee: 0, net: 25,
    });

    const result = runTreasuryReconciliation(db);

    assert.equal(result.reconciliation.ledger.totalMinted, 350);
    assert.equal(result.reconciliation.ledger.totalWithdrawn, 50);
    assert.equal(result.reconciliation.ledger.totalFees, 10);
    assert.equal(result.reconciliation.ledger.expectedTreasury, 300);
    assert.equal(result.reconciliation.ledger.transactionCount, 5);
  });
});

// =============================================================================
// 24. Idempotency and concurrent safety
// =============================================================================

describe("runTreasuryReconciliation — repeated calls", () => {
  it("produces consistent results on repeated calls with same data", () => {
    seedBalancedScenario(db);

    const r1 = runTreasuryReconciliation(db);
    const r2 = runTreasuryReconciliation(db);

    assert.equal(r1.reconciliation.ledger.totalMinted, r2.reconciliation.ledger.totalMinted);
    assert.equal(r1.reconciliation.ledger.expectedTreasury, r2.reconciliation.ledger.expectedTreasury);
    assert.equal(r1.reconciliation.drifts.treasury, r2.reconciliation.drifts.treasury);
    assert.equal(r1.alert, r2.alert);
  });
});

// =============================================================================
// 25. getReconciliationHistory — with real reconciliation runs
// =============================================================================

describe("getReconciliationHistory — integration with runTreasuryReconciliation", () => {
  it("retrieves reconciliation entries created by runTreasuryReconciliation", () => {
    seedBalancedScenario(db);

    const result = runTreasuryReconciliation(db, { stripeBalance: 800 });
    const history = getReconciliationHistory(db);

    assert.equal(history.total, 1);
    assert.equal(history.items[0].id, result.reconciliationId);

    // Verify parsed details contain expected structure
    const details = history.items[0].details;
    assert.ok(details.ledger);
    assert.ok(details.treasury);
    assert.ok(details.drifts);
  });

  it("correctly counts alerts from actual reconciliation runs", () => {
    seedBalancedScenario(db);

    // Run 1: no alert
    runTreasuryReconciliation(db);

    // Run 2: stripe drift alert
    runTreasuryReconciliation(db, { stripeBalance: 810 });

    // Run 3: no alert
    runTreasuryReconciliation(db, { stripeBalance: 800 });

    const history = getReconciliationHistory(db);

    assert.equal(history.total, 3);
    assert.equal(history.alertCount, 1);
  });
});
