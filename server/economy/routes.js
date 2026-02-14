// economy/routes.js
// HTTP endpoints for the economy system.
// All routes are mounted under /api/economy.

import { getBalance } from "./balances.js";
import { getTransactions, getAllTransactions } from "./ledger.js";
import { FEES, PLATFORM_ACCOUNT_ID } from "./fees.js";
import { executeTransfer, executePurchase, executeMarketplacePurchase, executeReversal } from "./transfer.js";
import {
  requestWithdrawal, approveWithdrawal, rejectWithdrawal,
  processWithdrawal, cancelWithdrawal, getUserWithdrawals, getAllWithdrawals,
} from "./withdrawals.js";

/**
 * Register all economy routes on the Express app.
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
export function registerEconomyRoutes(app, db) {

  // ═══════════════════════════════════════════════════════════
  // Balance
  // ═══════════════════════════════════════════════════════════

  app.get("/api/economy/balance", (req, res) => {
    try {
      const userId = req.query.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const result = getBalance(db, userId);
      res.json({ ok: true, userId, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "balance_fetch_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Transaction History
  // ═══════════════════════════════════════════════════════════

  app.get("/api/economy/history", (req, res) => {
    try {
      const userId = req.query.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;
      const type = req.query.type || undefined;

      const result = getTransactions(db, userId, { limit, offset, type });
      res.json({ ok: true, userId, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "history_fetch_failed", detail: err.message });
    }
  });

  // Admin: all transactions
  app.get("/api/economy/admin/transactions", (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const offset = parseInt(req.query.offset, 10) || 0;
      const type = req.query.type || undefined;
      const status = req.query.status || undefined;

      const result = getAllTransactions(db, { limit, offset, type, status });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "admin_transactions_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Token Purchase (mint tokens)
  // ═══════════════════════════════════════════════════════════

  app.post("/api/economy/buy", (req, res) => {
    try {
      const userId = req.body.user_id || req.user?.id;
      const amount = parseFloat(req.body.amount);

      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const result = executePurchase(db, {
        userId,
        amount,
        metadata: { source: req.body.source || "api" },
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "purchase_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Transfer (user → user)
  // ═══════════════════════════════════════════════════════════

  app.post("/api/economy/transfer", (req, res) => {
    try {
      const from = req.body.from || req.user?.id;
      const to = req.body.to;
      const amount = parseFloat(req.body.amount);

      if (!from) return res.status(400).json({ ok: false, error: "missing_sender" });
      if (!to) return res.status(400).json({ ok: false, error: "missing_recipient" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const result = executeTransfer(db, {
        from,
        to,
        amount,
        type: req.body.type || "TRANSFER",
        metadata: req.body.metadata || {},
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "transfer_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Marketplace Purchase (buyer → seller, with fee)
  // ═══════════════════════════════════════════════════════════

  app.post("/api/economy/marketplace-purchase", (req, res) => {
    try {
      const buyerId = req.body.buyer_id || req.user?.id;
      const sellerId = req.body.seller_id;
      const amount = parseFloat(req.body.amount);
      const listingId = req.body.listing_id;

      if (!buyerId) return res.status(400).json({ ok: false, error: "missing_buyer_id" });
      if (!sellerId) return res.status(400).json({ ok: false, error: "missing_seller_id" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const result = executeMarketplacePurchase(db, {
        buyerId,
        sellerId,
        amount,
        listingId,
        metadata: req.body.metadata || {},
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "marketplace_purchase_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Withdrawals
  // ═══════════════════════════════════════════════════════════

  app.post("/api/economy/withdraw", (req, res) => {
    try {
      const userId = req.body.user_id || req.user?.id;
      const amount = parseFloat(req.body.amount);

      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const result = requestWithdrawal(db, { userId, amount });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "withdrawal_request_failed", detail: err.message });
    }
  });

  // Get user's withdrawals
  app.get("/api/economy/withdrawals", (req, res) => {
    try {
      const userId = req.query.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
      const offset = parseInt(req.query.offset, 10) || 0;

      const result = getUserWithdrawals(db, userId, { limit, offset });
      res.json({ ok: true, userId, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "withdrawals_fetch_failed", detail: err.message });
    }
  });

  // Cancel pending withdrawal
  app.post("/api/economy/withdrawals/:id/cancel", (req, res) => {
    try {
      const userId = req.body.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const result = cancelWithdrawal(db, { withdrawalId: req.params.id, userId });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "cancel_failed", detail: err.message });
    }
  });

  // Admin: approve withdrawal
  app.post("/api/economy/admin/withdrawals/:id/approve", (req, res) => {
    try {
      const reviewerId = req.body.reviewer_id || req.user?.id || "system";
      const result = approveWithdrawal(db, { withdrawalId: req.params.id, reviewerId });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "approve_failed", detail: err.message });
    }
  });

  // Admin: reject withdrawal
  app.post("/api/economy/admin/withdrawals/:id/reject", (req, res) => {
    try {
      const reviewerId = req.body.reviewer_id || req.user?.id || "system";
      const result = rejectWithdrawal(db, { withdrawalId: req.params.id, reviewerId });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "reject_failed", detail: err.message });
    }
  });

  // Admin: process approved withdrawal
  app.post("/api/economy/admin/withdrawals/:id/process", (req, res) => {
    try {
      const result = processWithdrawal(db, {
        withdrawalId: req.params.id,
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "process_failed", detail: err.message });
    }
  });

  // Admin: list all withdrawals
  app.get("/api/economy/admin/withdrawals", (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;
      const status = req.query.status || undefined;

      const result = getAllWithdrawals(db, { status, limit, offset });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "admin_withdrawals_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Reversals (admin)
  // ═══════════════════════════════════════════════════════════

  app.post("/api/economy/admin/reverse", (req, res) => {
    try {
      const { transaction_id, reason } = req.body;
      if (!transaction_id) return res.status(400).json({ ok: false, error: "missing_transaction_id" });

      const result = executeReversal(db, {
        originalTxId: transaction_id,
        reason: reason || "admin_reversal",
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "reversal_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Fee Schedule + Platform Info
  // ═══════════════════════════════════════════════════════════

  app.get("/api/economy/fees", (_req, res) => {
    res.json({ ok: true, fees: FEES, platformAccount: PLATFORM_ACCOUNT_ID });
  });

  app.get("/api/economy/platform-balance", (_req, res) => {
    try {
      const result = getBalance(db, PLATFORM_ACCOUNT_ID);
      res.json({ ok: true, platformAccount: PLATFORM_ACCOUNT_ID, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "platform_balance_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Ledger Integrity Check
  // ═══════════════════════════════════════════════════════════

  app.get("/api/economy/integrity", (_req, res) => {
    try {
      // Total credits across system
      const totalCredits = db.prepare(`
        SELECT COALESCE(SUM(net), 0) as total FROM economy_ledger
        WHERE to_user_id IS NOT NULL AND status = 'complete'
      `).get()?.total || 0;

      // Total debits across system
      const totalDebits = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM economy_ledger
        WHERE from_user_id IS NOT NULL AND status = 'complete'
      `).get()?.total || 0;

      // Total minted (purchases — credits with no from)
      const totalMinted = db.prepare(`
        SELECT COALESCE(SUM(net), 0) as total FROM economy_ledger
        WHERE type = 'TOKEN_PURCHASE' AND status = 'complete'
      `).get()?.total || 0;

      // Total withdrawn
      const totalWithdrawn = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM economy_ledger
        WHERE type = 'WITHDRAWAL' AND status = 'complete'
      `).get()?.total || 0;

      // Platform fees collected
      const platformFees = db.prepare(`
        SELECT COALESCE(SUM(net), 0) as total FROM economy_ledger
        WHERE type = 'FEE' AND to_user_id = ? AND status = 'complete'
      `).get(PLATFORM_ACCOUNT_ID)?.total || 0;

      // Transaction count
      const txCount = db.prepare("SELECT COUNT(*) as c FROM economy_ledger").get()?.c || 0;

      // Pending withdrawals
      const pendingWithdrawals = db.prepare(`
        SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as total
        FROM economy_withdrawals WHERE status IN ('pending', 'approved', 'processing')
      `).get();

      res.json({
        ok: true,
        integrity: {
          totalCredits: Math.round(totalCredits * 100) / 100,
          totalDebits: Math.round(totalDebits * 100) / 100,
          totalMinted: Math.round(totalMinted * 100) / 100,
          totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
          platformFees: Math.round(platformFees * 100) / 100,
          transactionCount: txCount,
          pendingWithdrawals: pendingWithdrawals?.c || 0,
          pendingWithdrawalAmount: Math.round((pendingWithdrawals?.total || 0) * 100) / 100,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: "integrity_check_failed", detail: err.message });
    }
  });
}
