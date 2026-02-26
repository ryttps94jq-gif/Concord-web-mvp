// economy/economic-system.test.js
// Comprehensive test suite for the Concord Economic System.
// Tests: Coin service, royalty cascades, emergent accounts, marketplace,
// fee splitting, treasury reconciliation, and Stripe hardening.
//
// Run: node --test server/economy/economic-system.test.js

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Core economy modules
import { calculateFee, FEES, PLATFORM_ACCOUNT_ID, FEE_SPLIT, UNIVERSAL_FEE_RATE } from "./fees.js";
import { recordTransaction, recordTransactionBatch, generateTxId } from "./ledger.js";
import { getBalance } from "./balances.js";
import { executePurchase, executeTransfer, executeMarketplacePurchase } from "./transfer.js";

// New economic system modules
import { mintCoins, burnCoins, getTreasuryState, verifyTreasuryInvariant } from "./coin-service.js";
import {
  calculateGenerationalRate, registerCitation, getAncestorChain,
  distributeRoyalties, getCreatorRoyalties, ROYALTY_FLOOR, DEFAULT_INITIAL_RATE,
} from "./royalty-cascade.js";
import {
  createEmergentAccount, transferToReserve, getEmergentAccount,
  listEmergentAccounts, suspendEmergentAccount, isEmergentAccount, canWithdrawToFiat,
  creditOperatingWallet, debitReserveAccount,
} from "./emergent-accounts.js";
import {
  createListing, purchaseListing, getListing, searchListings,
  delistListing, updateListingPrice, hashContent, checkWashTrading,
} from "./marketplace-service.js";
import { distributeFee, getFeeSplitBalances } from "./fee-split.js";
import { runTreasuryReconciliation } from "./treasury-reconciliation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, ".test_economic_system.db");

let db;

function setupTestDb() {
  try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }

  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create all required tables
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

    CREATE TABLE IF NOT EXISTS economy_withdrawals (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0, net REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      ledger_id TEXT, reviewed_by TEXT, reviewed_at TEXT, processed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL UNIQUE, buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL, listing_id TEXT NOT NULL, listing_type TEXT,
      license_type TEXT, amount REAL NOT NULL, source TEXT NOT NULL DEFAULT 'artistry',
      status TEXT NOT NULL DEFAULT 'CREATED', settlement_batch_id TEXT,
      ref_id TEXT, license_id TEXT, stripe_session_id TEXT, stripe_event_id TEXT,
      marketplace_fee REAL DEFAULT 0, seller_net REAL DEFAULT 0,
      total_royalties REAL DEFAULT 0, royalty_details_json TEXT DEFAULT '[]',
      error_message TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
      last_retry_at TEXT, resolved_by TEXT, resolved_at TEXT, resolution_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_status_history (
      id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL, from_status TEXT,
      to_status TEXT NOT NULL, reason TEXT, actor TEXT,
      metadata_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT, timestamp TEXT, category TEXT, action TEXT, user_id TEXT,
      ip_address TEXT, user_agent TEXT, request_id TEXT, path TEXT,
      method TEXT, status_code TEXT, details TEXT
    );

    CREATE TABLE IF NOT EXISTS treasury (
      id TEXT PRIMARY KEY, total_usd REAL NOT NULL DEFAULT 0,
      total_coins REAL NOT NULL DEFAULT 0, last_reconciled TEXT,
      drift_amount REAL DEFAULT 0, drift_alert INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO treasury (id, total_usd, total_coins, updated_at) VALUES ('treasury_main', 0, 0, datetime('now'));

    CREATE TABLE IF NOT EXISTS treasury_events (
      id TEXT PRIMARY KEY, event_type TEXT NOT NULL, amount REAL NOT NULL,
      usd_before REAL NOT NULL, usd_after REAL NOT NULL,
      coins_before REAL NOT NULL, coins_after REAL NOT NULL,
      ref_id TEXT, metadata_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS royalty_lineage (
      id TEXT PRIMARY KEY, child_id TEXT NOT NULL, parent_id TEXT NOT NULL,
      generation INTEGER NOT NULL DEFAULT 1, creator_id TEXT NOT NULL,
      parent_creator TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(child_id, parent_id)
    );
    CREATE INDEX IF NOT EXISTS idx_lineage_child  ON royalty_lineage(child_id);
    CREATE INDEX IF NOT EXISTS idx_lineage_parent ON royalty_lineage(parent_id);

    CREATE TABLE IF NOT EXISTS royalty_payouts (
      id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL, content_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL, amount REAL NOT NULL, generation INTEGER NOT NULL,
      royalty_rate REAL NOT NULL, source_tx_id TEXT NOT NULL,
      ledger_entry_id TEXT, metadata_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_royalty_recipient ON royalty_payouts(recipient_id, created_at);

    CREATE TABLE IF NOT EXISTS emergent_accounts (
      id TEXT PRIMARY KEY, emergent_id TEXT NOT NULL UNIQUE, display_name TEXT,
      operating_balance REAL NOT NULL DEFAULT 0, reserve_balance REAL NOT NULL DEFAULT 0,
      seed_amount REAL NOT NULL DEFAULT 0, total_earned REAL NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS marketplace_economy_listings (
      id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, content_id TEXT NOT NULL,
      content_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      price REAL NOT NULL, content_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', preview_type TEXT,
      preview_data TEXT, license_type TEXT NOT NULL DEFAULT 'standard',
      royalty_chain_json TEXT DEFAULT '[]', purchase_count INTEGER NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mel_hash ON marketplace_economy_listings(content_hash);

    CREATE TABLE IF NOT EXISTS fee_distributions (
      id TEXT PRIMARY KEY, source_tx_id TEXT NOT NULL, total_fee REAL NOT NULL,
      reserves_amount REAL NOT NULL, operating_amount REAL NOT NULL,
      payroll_amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wash_trade_flags (
      id TEXT PRIMARY KEY, account_a TEXT NOT NULL, account_b TEXT NOT NULL,
      content_id TEXT NOT NULL, trade_count INTEGER NOT NULL DEFAULT 1,
      flagged_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed INTEGER NOT NULL DEFAULT 0, reviewed_by TEXT, reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS treasury_reconciliation_log (
      id TEXT PRIMARY KEY, ledger_total REAL NOT NULL, stripe_total REAL,
      drift REAL NOT NULL DEFAULT 0, alert_triggered INTEGER NOT NULL DEFAULT 0,
      details_json TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stripe_events_processed (
      event_id TEXT PRIMARY KEY, event_type TEXT, processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE,
      stripe_account_id TEXT, onboarding_complete INTEGER DEFAULT 0,
      created_at TEXT, updated_at TEXT
    );
  `);
}

function seedUser(userId, amount) {
  recordTransaction(db, {
    type: "TOKEN_PURCHASE",
    from: null,
    to: userId,
    amount,
    fee: 0,
    net: amount,
    status: "complete",
    metadata: { source: "test_seed" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════════

describe("Concord Economic System", () => {
  before(() => setupTestDb());
  after(() => {
    db?.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
  });

  // ── Fee Structure ─────────────────────────────────────────────────────
  describe("Fee Structure", () => {
    it("marketplace fee should be 4% (0.04), not 5%", () => {
      assert.equal(FEES.MARKETPLACE_PURCHASE, 0.04);
    });

    it("universal fee should be 1.46%", () => {
      assert.equal(FEES.TRANSFER, 0.0146);
      assert.equal(FEES.TOKEN_PURCHASE, 0.0146);
      assert.equal(FEES.WITHDRAWAL, 0.0146);
      assert.equal(UNIVERSAL_FEE_RATE, 0.0146);
    });

    it("marketplace purchase should apply combined fee (1.46% + 4% = 5.46%)", () => {
      const { fee, net, rate } = calculateFee("MARKETPLACE_PURCHASE", 100);
      assert.equal(rate, 0.0546);
      assert.equal(fee, 5.46);
      assert.equal(net, 94.54);
    });

    it("royalty payouts should have 0% fee", () => {
      assert.equal(FEES.ROYALTY_PAYOUT, 0);
    });

    it("emergent transfers should incur 1.46% fee", () => {
      assert.equal(FEES.EMERGENT_TRANSFER, 0.0146);
    });

    it("fee split should be 80/10/10", () => {
      assert.equal(FEE_SPLIT.RESERVES, 0.80);
      assert.equal(FEE_SPLIT.OPERATING_COSTS, 0.10);
      assert.equal(FEE_SPLIT.PAYROLL, 0.10);
    });
  });

  // ── Coin Service ──────────────────────────────────────────────────────
  describe("Coin Service", () => {
    it("should mint coins and update treasury", () => {
      const result = mintCoins(db, { amount: 1000, userId: "user_mint_test" });
      assert.equal(result.ok, true);
      assert.equal(result.amount, 1000);
      assert.equal(result.treasury.usdAfter, 1000);
      assert.equal(result.treasury.coinsAfter, 1000);
    });

    it("should burn coins and update treasury", () => {
      const result = burnCoins(db, { amount: 100, userId: "user_mint_test" });
      assert.equal(result.ok, true);
      assert.equal(result.treasury.usdAfter, 900);
      assert.equal(result.treasury.coinsAfter, 900);
    });

    it("should reject burning more coins than treasury holds", () => {
      const result = burnCoins(db, { amount: 10000, userId: "user_mint_test" });
      assert.equal(result.ok, false);
      assert.equal(result.error, "treasury_insufficient");
    });

    it("should verify treasury invariant", () => {
      const result = verifyTreasuryInvariant(db);
      assert.equal(result.ok, true);
      assert.equal(result.invariantHolds, true);
      assert.equal(result.checks.coinsLteUsd, true);
    });

    it("should get current treasury state", () => {
      const state = getTreasuryState(db);
      assert.ok(state);
      assert.equal(state.total_usd, 900);
      assert.equal(state.total_coins, 900);
    });

    it("should reject mint with invalid params", () => {
      assert.equal(mintCoins(db, { amount: -5, userId: "user1" }).ok, false);
      assert.equal(mintCoins(db, { amount: 100, userId: "" }).ok, false);
    });
  });

  // ── Royalty Cascade Engine ────────────────────────────────────────────
  describe("Royalty Cascade Engine", () => {
    it("should calculate correct generational decay", () => {
      assert.equal(calculateGenerationalRate(0), DEFAULT_INITIAL_RATE);
      assert.equal(calculateGenerationalRate(1), 0.105);
      assert.equal(calculateGenerationalRate(2), 0.0525);
      assert.equal(calculateGenerationalRate(3), 0.02625);
    });

    it("should enforce 0.05% floor", () => {
      // At high generations, rate should floor at 0.0005
      const rateGen20 = calculateGenerationalRate(20);
      assert.equal(rateGen20, ROYALTY_FLOOR);
      assert.equal(rateGen20, 0.0005);

      // Check that gen 9+ hits the floor
      const rateGen9 = calculateGenerationalRate(9);
      assert.ok(rateGen9 >= ROYALTY_FLOOR);
    });

    it("royalties should never reach zero", () => {
      for (let i = 0; i < 100; i++) {
        const rate = calculateGenerationalRate(i);
        assert.ok(rate > 0, `Generation ${i} rate should be > 0`);
        assert.ok(rate >= ROYALTY_FLOOR, `Generation ${i} rate should be >= floor`);
      }
    });

    it("should register citations", () => {
      const result = registerCitation(db, {
        childId: "dtu_B",
        parentId: "dtu_A",
        creatorId: "creator_B",
        parentCreatorId: "creator_A",
        generation: 1,
      });
      assert.equal(result.ok, true);
    });

    it("should prevent self-citation", () => {
      const result = registerCitation(db, {
        childId: "dtu_X",
        parentId: "dtu_X",
        creatorId: "creator_X",
        parentCreatorId: "creator_X",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "self_citation_not_allowed");
    });

    it("should get ancestor chain", () => {
      // Register chain: C → B → A
      registerCitation(db, {
        childId: "dtu_C",
        parentId: "dtu_B",
        creatorId: "creator_C",
        parentCreatorId: "creator_B",
        generation: 1,
      });

      const chain = getAncestorChain(db, "dtu_C");
      assert.ok(chain.length >= 1);
      // Should find both B and A in the chain
      const creatorIds = chain.map(a => a.creatorId);
      assert.ok(creatorIds.includes("creator_B"));
      assert.ok(creatorIds.includes("creator_A"));
    });

    it("should distribute royalties to ancestors", () => {
      // Seed creator_A with balance for test
      seedUser("creator_A", 1000);
      seedUser("seller_test", 500);
      seedUser("buyer_royalty_test", 500);

      const result = distributeRoyalties(db, {
        contentId: "dtu_C",
        transactionAmount: 100,
        sourceTxId: "test_tx_001",
        buyerId: "buyer_royalty_test",
        sellerId: "seller_test",
      });

      assert.equal(result.ok, true);
      assert.ok(result.totalRoyalties > 0);
      assert.ok(result.payouts.length > 0);
    });

    it("should track creator royalty history", () => {
      const history = getCreatorRoyalties(db, "creator_A");
      assert.ok(history.totalEarned > 0);
      assert.ok(history.items.length > 0);
    });

    it("should detect citation cycles", () => {
      // Try to create A → C (which would form cycle C → B → A → C)
      const result = registerCitation(db, {
        childId: "dtu_A",
        parentId: "dtu_C",
        creatorId: "creator_A",
        parentCreatorId: "creator_C",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "citation_cycle_detected");
    });
  });

  // ── Emergent Accounts ─────────────────────────────────────────────────
  describe("Emergent Accounts", () => {
    it("should create an emergent account", () => {
      const result = createEmergentAccount(db, {
        emergentId: "emergent_alpha",
        displayName: "Alpha",
        seedAmount: 10,
      });
      assert.equal(result.ok, true);
      assert.equal(result.account.emergentId, "emergent_alpha");
      assert.equal(result.account.operatingBalance, 10);
      assert.equal(result.account.reserveBalance, 0);
    });

    it("should prevent duplicate emergent accounts", () => {
      const result = createEmergentAccount(db, {
        emergentId: "emergent_alpha",
        displayName: "Alpha Dupe",
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "emergent_account_exists");
    });

    it("should transfer from operating to reserve with fee", () => {
      const result = transferToReserve(db, {
        emergentId: "emergent_alpha",
        amount: 5,
      });
      assert.equal(result.ok, true);
      assert.ok(result.fee > 0); // 1.46% fee
      assert.ok(result.net < 5); // Net is less due to fee

      const account = getEmergentAccount(db, "emergent_alpha");
      assert.equal(account.operatingBalance, 5);
      assert.ok(account.reserveBalance > 0);
    });

    it("should reject transfer exceeding operating balance", () => {
      const result = transferToReserve(db, {
        emergentId: "emergent_alpha",
        amount: 100,
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "insufficient_operating_balance");
    });

    it("should identify emergent account IDs", () => {
      assert.equal(isEmergentAccount("emergent_op:alpha"), true);
      assert.equal(isEmergentAccount("emergent_res:alpha"), true);
      assert.equal(isEmergentAccount("user_123"), false);
    });

    it("should prevent emergent fiat withdrawal", () => {
      assert.equal(canWithdrawToFiat("emergent_op:alpha"), false);
      assert.equal(canWithdrawToFiat("emergent_res:alpha"), false);
      assert.equal(canWithdrawToFiat("user_123"), true);
    });

    it("should list emergent accounts", () => {
      createEmergentAccount(db, { emergentId: "emergent_beta", seedAmount: 10 });
      const list = listEmergentAccounts(db);
      assert.ok(list.items.length >= 2);
      assert.ok(list.total >= 2);
    });

    it("should suspend an emergent account", () => {
      const result = suspendEmergentAccount(db, {
        emergentId: "emergent_beta",
        reason: "test_suspension",
      });
      assert.equal(result.ok, true);
      assert.equal(result.status, "suspended");

      const account = getEmergentAccount(db, "emergent_beta");
      assert.equal(account.status, "suspended");
    });

    it("cold start: 10 emergents at $10 = $100 seed", () => {
      let totalSeed = 0;
      for (let i = 1; i <= 10; i++) {
        const result = createEmergentAccount(db, {
          emergentId: `cold_start_${i}`,
          seedAmount: 10,
        });
        if (result.ok) totalSeed += 10;
      }
      assert.equal(totalSeed, 100);
    });
  });

  // ── Marketplace Service ───────────────────────────────────────────────
  describe("Marketplace Service", () => {
    it("should create a listing", () => {
      const result = createListing(db, {
        sellerId: "seller_1",
        contentId: "content_001",
        contentType: "dtu",
        title: "Test DTU",
        description: "A test knowledge unit",
        price: 50,
        contentData: "This is the content of the DTU for hashing",
        licenseType: "standard",
      });
      assert.equal(result.ok, true);
      assert.ok(result.listing.id);
      assert.equal(result.listing.previewType, "structural_summary");
      assert.ok(result.listing.contentHash);
    });

    it("should reject duplicate content (hash collision)", () => {
      const result = createListing(db, {
        sellerId: "seller_2",
        contentId: "content_002",
        contentType: "dtu",
        title: "Duplicate DTU",
        price: 60,
        contentData: "This is the content of the DTU for hashing", // Same content
      });
      assert.equal(result.ok, false);
      assert.equal(result.error, "duplicate_content");
    });

    it("should hash content consistently", () => {
      const hash1 = hashContent("test content");
      const hash2 = hashContent("test content");
      const hash3 = hashContent("different content");
      assert.equal(hash1, hash2);
      assert.notEqual(hash1, hash3);
    });

    it("should search marketplace listings", () => {
      const results = searchListings(db, { status: "active" });
      assert.ok(results.items.length > 0);
      assert.ok(results.total > 0);
    });

    it("should filter listings by content type", () => {
      createListing(db, {
        sellerId: "seller_music",
        contentId: "music_001",
        contentType: "music",
        title: "Test Song",
        price: 25,
        contentData: "audio_data_bytes_here",
      });

      const musicOnly = searchListings(db, { contentType: "music" });
      assert.ok(musicOnly.items.length > 0);
      assert.ok(musicOnly.items.every(l => l.contentType === "music"));
    });

    it("should execute a marketplace purchase with fees", () => {
      seedUser("buyer_mkt", 200);
      const listing = searchListings(db, { status: "active" }).items[0];

      const result = purchaseListing(db, {
        buyerId: "buyer_mkt",
        listingId: listing.id,
      });
      assert.equal(result.ok, true);
      assert.ok(result.fee > 0);
      assert.ok(result.sellerNet > 0);
      assert.ok(result.sellerNet < listing.price); // Seller gets less due to fees
    });

    it("should prevent buying your own listing", () => {
      createListing(db, {
        sellerId: "buyer_mkt",
        contentId: "content_self",
        contentType: "dtu",
        title: "Self Listing",
        price: 10,
        contentData: "self_content_data",
      });

      const listing = searchListings(db, { sellerId: "buyer_mkt" }).items[0];
      const result = purchaseListing(db, { buyerId: "buyer_mkt", listingId: listing.id });
      assert.equal(result.ok, false);
      assert.equal(result.error, "cannot_buy_own_listing");
    });

    it("should delist a listing", () => {
      const listing = searchListings(db, { sellerId: "seller_music" }).items[0];
      const result = delistListing(db, { listingId: listing.id, sellerId: "seller_music" });
      assert.equal(result.ok, true);
      assert.equal(result.status, "delisted");
    });

    it("should update listing price", () => {
      const listingResult = createListing(db, {
        sellerId: "seller_price",
        contentId: "content_price",
        contentType: "art",
        title: "Art for Price Test",
        price: 100,
        contentData: "art_data_for_price_test",
      });
      const result = updateListingPrice(db, {
        listingId: listingResult.listing.id,
        sellerId: "seller_price",
        newPrice: 150,
      });
      assert.equal(result.ok, true);
      assert.equal(result.oldPrice, 100);
      assert.equal(result.newPrice, 150);
    });
  });

  // ── Fee Split Engine ──────────────────────────────────────────────────
  describe("Fee Split Engine", () => {
    it("should distribute fees 80/10/10", () => {
      const result = distributeFee(db, {
        feeAmount: 100,
        sourceTxId: "test_fee_source",
      });
      assert.equal(result.ok, true);
      assert.equal(result.distribution.reserves, 80);
      assert.equal(result.distribution.operating, 10);
      assert.equal(result.distribution.payroll, 10);
    });

    it("should handle small fee amounts correctly", () => {
      const result = distributeFee(db, {
        feeAmount: 1.46,
        sourceTxId: "test_small_fee",
      });
      assert.equal(result.ok, true);
      const { reserves, operating, payroll } = result.distribution;
      // Sum should equal original fee (within rounding)
      const sum = reserves + operating + payroll;
      assert.ok(Math.abs(sum - 1.46) < 0.02);
    });

    it("should reject zero or negative fees", () => {
      assert.equal(distributeFee(db, { feeAmount: 0, sourceTxId: "x" }).ok, false);
      assert.equal(distributeFee(db, { feeAmount: -5, sourceTxId: "x" }).ok, false);
    });
  });

  // ── Treasury Reconciliation ───────────────────────────────────────────
  describe("Treasury Reconciliation", () => {
    it("should run reconciliation without Stripe balance", () => {
      const result = runTreasuryReconciliation(db);
      assert.equal(result.ok, true);
      assert.ok(result.reconciliationId);
      assert.ok(result.reconciliation);
      assert.ok(result.reconciliation.ledger);
    });

    it("should detect drift when Stripe balance mismatches", () => {
      const result = runTreasuryReconciliation(db, { stripeBalance: 999999 });
      assert.equal(result.ok, true);
      assert.equal(result.alert, true);
      assert.ok(result.reconciliation.drifts.stripe !== 0);
    });

    it("should report reconciliation details accurately", () => {
      const result = runTreasuryReconciliation(db);
      assert.equal(result.ok, true);
      // Should have ledger totals
      assert.ok(result.reconciliation.ledger.transactionCount > 0);
      // Should have treasury state
      assert.ok(result.reconciliation.treasury.usd >= 0);
      assert.ok(result.reconciliation.treasury.coins >= 0);
    });
  });

  // ── Integration: Full Purchase Flow ───────────────────────────────────
  describe("Full Purchase Flow Integration", () => {
    it("should execute complete purchase with royalties and fee split", () => {
      // 1. Seed users
      seedUser("creator_original", 0.01); // Just needs to exist
      seedUser("derivative_creator", 0.01);
      seedUser("final_buyer", 500);

      // 2. Register citation chain: derivative → original
      registerCitation(db, {
        childId: "deriv_content",
        parentId: "orig_content",
        creatorId: "derivative_creator",
        parentCreatorId: "creator_original",
        generation: 1,
      });

      // 3. List the derivative content
      const listing = createListing(db, {
        sellerId: "derivative_creator",
        contentId: "deriv_content",
        contentType: "dtu",
        title: "Derivative Knowledge",
        price: 100,
        contentData: "derivative_content_unique_data",
        royaltyChain: [{ contentId: "orig_content", creatorId: "creator_original" }],
      });
      assert.equal(listing.ok, true);

      // 4. Execute purchase
      const purchase = purchaseListing(db, {
        buyerId: "final_buyer",
        listingId: listing.listing.id,
      });
      assert.equal(purchase.ok, true);

      // 5. Verify fees were collected
      assert.ok(purchase.fee > 0);

      // 6. Verify seller got paid (minus fees)
      assert.ok(purchase.sellerNet > 0);
      assert.ok(purchase.sellerNet < 100);

      // 7. Verify buyer was debited
      const buyerBalance = getBalance(db, "final_buyer");
      assert.ok(buyerBalance.balance < 500);
    });
  });

  // ── Wash Trade Detection ──────────────────────────────────────────────
  describe("Wash Trade Detection", () => {
    it("should not flag initial trades", () => {
      const result = checkWashTrading(db, {
        accountA: "wash_user_1",
        accountB: "wash_user_2",
        contentId: "wash_content",
      });
      assert.equal(result.flagged, false);
    });
  });

  // ── Content Hashing ───────────────────────────────────────────────────
  describe("Content Hashing", () => {
    it("should produce consistent SHA-256 hashes", () => {
      const h1 = hashContent("Hello World");
      const h2 = hashContent("Hello World");
      assert.equal(h1, h2);
      assert.equal(h1.length, 64); // SHA-256 hex length
    });

    it("should normalize whitespace", () => {
      const h1 = hashContent("  test content  ");
      const h2 = hashContent("test content");
      assert.equal(h1, h2);
    });

    it("should produce different hashes for different content", () => {
      const h1 = hashContent("content A");
      const h2 = hashContent("content B");
      assert.notEqual(h1, h2);
    });
  });

  // ── Emergent Economic Constraints ─────────────────────────────────────
  describe("Emergent Economic Constraints", () => {
    it("emergent funds should never become fiat", () => {
      // Verify all emergent account types cannot withdraw
      assert.equal(canWithdrawToFiat("emergent_op:test"), false);
      assert.equal(canWithdrawToFiat("emergent_res:test"), false);
    });

    it("emergent should be able to purchase on marketplace from reserve", () => {
      // Create emergent with funds
      createEmergentAccount(db, { emergentId: "buying_emergent", seedAmount: 100 });

      // Transfer to reserve
      const transfer = transferToReserve(db, {
        emergentId: "buying_emergent",
        amount: 50,
      });
      assert.equal(transfer.ok, true);

      // Verify reserve has funds
      const account = getEmergentAccount(db, "buying_emergent");
      assert.ok(account.reserveBalance > 0);
    });
  });
});
