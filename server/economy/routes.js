// economy/routes.js
// HTTP endpoints for the economy system.
// All routes are mounted under /api/economy and /api/stripe.

import express from "express";
import { getBalance } from "./balances.js";
import { getTransactions, getAllTransactions } from "./ledger.js";
import { FEES, PLATFORM_ACCOUNT_ID } from "./fees.js";
import { executeTransfer, executePurchase, executeMarketplacePurchase, executeReversal } from "./transfer.js";
import {
  requestWithdrawal, approveWithdrawal, rejectWithdrawal,
  processWithdrawal, cancelWithdrawal, getUserWithdrawals, getAllWithdrawals,
} from "./withdrawals.js";
import { adminOnly } from "./guards.js";
import { economyAudit, auditCtx } from "./audit.js";
import {
  createCheckoutSession, handleWebhook, createConnectOnboarding,
  getConnectStatus, processStripeWithdrawal, STRIPE_ENABLED,
  MIN_WITHDRAW_TOKENS, MAX_WITHDRAW_TOKENS_PER_DAY,
} from "./stripe.js";
import {
  getPurchase, getPurchaseByRefId as _getPurchaseByRefId, getUserPurchases, getPurchaseHistory,
  transitionPurchase, findPurchasesByStatus,
} from "./purchases.js";
import {
  runReconciliation, executeCorrection, getPurchaseReceipt, getReconciliationSummary,
} from "./reconciliation.js";

/**
 * Register all economy + Stripe routes on the Express app.
 * @param {import('express').Express} app
 * @param {import('better-sqlite3').Database} db
 */
export function registerEconomyRoutes(app, db) {

  // ═══════════════════════════════════════════════════════════════════════════
  // ECONOMY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Balance ────────────────────────────────────────────────────────────────

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

  // ── Transaction History ────────────────────────────────────────────────────

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

  // ── Admin: all transactions ────────────────────────────────────────────────

  app.get("/api/economy/admin/transactions", adminOnly, (req, res) => {
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

  // ── Token Purchase (direct ledger mint, no Stripe) ─────────────────────────

  app.post("/api/economy/buy", adminOnly, (req, res) => {
    try {
      const userId = req.body.user_id || req.user?.id;
      const amount = parseFloat(req.body.amount);

      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const ctx = auditCtx(req);
      const result = executePurchase(db, {
        userId,
        amount,
        metadata: { source: req.body.source || "admin_api" },
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);

      economyAudit(db, {
        action: "admin_token_mint",
        userId,
        amount,
        txId: result.batchId,
        ...ctx,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "purchase_failed", detail: err.message });
    }
  });

  // ── Transfer (user → user) ─────────────────────────────────────────────────

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

      const ctx = auditCtx(req);
      const result = executeTransfer(db, {
        from,
        to,
        amount,
        type: req.body.type || "TRANSFER",
        metadata: req.body.metadata || {},
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);

      economyAudit(db, {
        action: "transfer",
        userId: from,
        amount,
        txId: result.batchId,
        details: { to, fee: result.fee, net: result.net },
        ...ctx,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "transfer_failed", detail: err.message });
    }
  });

  // ── Marketplace Purchase (buyer → seller, with fee) ────────────────────────

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

      const ctx = auditCtx(req);
      const result = executeMarketplacePurchase(db, {
        buyerId,
        sellerId,
        amount,
        listingId,
        metadata: req.body.metadata || {},
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);

      economyAudit(db, {
        action: "marketplace_purchase",
        userId: buyerId,
        amount,
        txId: result.batchId,
        details: { sellerId, listingId, fee: result.fee, net: result.net },
        ...ctx,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "marketplace_purchase_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WITHDRAWALS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/economy/withdraw", (req, res) => {
    try {
      const userId = req.body.user_id || req.user?.id;
      const amount = parseFloat(req.body.amount);

      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      // Enforce minimum withdrawal
      if (amount < MIN_WITHDRAW_TOKENS) {
        return res.status(400).json({ ok: false, error: "below_minimum_withdrawal", min: MIN_WITHDRAW_TOKENS });
      }

      // Check Stripe Connect account if Stripe is enabled
      if (STRIPE_ENABLED) {
        const connectStatus = getConnectStatus(db, userId);
        if (!connectStatus.connected || !connectStatus.onboardingComplete) {
          return res.status(400).json({ ok: false, error: "stripe_connect_required" });
        }
      }

      const ctx = auditCtx(req);
      const result = requestWithdrawal(db, { userId, amount });
      if (!result.ok) return res.status(400).json(result);

      economyAudit(db, {
        action: "withdrawal_requested",
        userId,
        amount,
        details: { withdrawalId: result.withdrawal?.id },
        ...ctx,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "withdrawal_request_failed", detail: err.message });
    }
  });

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

  // ── Admin: Withdrawal management ──────────────────────────────────────────

  app.post("/api/economy/admin/withdrawals/:id/approve", adminOnly, (req, res) => {
    try {
      const reviewerId = req.body.reviewer_id || req.user?.id || "system";
      const ctx = auditCtx(req);
      const result = approveWithdrawal(db, { withdrawalId: req.params.id, reviewerId });
      if (!result.ok) return res.status(400).json(result);

      economyAudit(db, {
        action: "withdrawal_approved",
        userId: reviewerId,
        details: { withdrawalId: req.params.id },
        ...ctx,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "approve_failed", detail: err.message });
    }
  });

  app.post("/api/economy/admin/withdrawals/:id/reject", adminOnly, (req, res) => {
    try {
      const reviewerId = req.body.reviewer_id || req.user?.id || "system";
      const ctx = auditCtx(req);
      const result = rejectWithdrawal(db, { withdrawalId: req.params.id, reviewerId });
      if (!result.ok) return res.status(400).json(result);

      economyAudit(db, {
        action: "withdrawal_rejected",
        userId: reviewerId,
        details: { withdrawalId: req.params.id },
        ...ctx,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "reject_failed", detail: err.message });
    }
  });

  app.post("/api/economy/admin/withdrawals/:id/process", adminOnly, async (req, res) => {
    try {
      const ctx = auditCtx(req);

      // Use Stripe Connect if enabled, otherwise local-only processing
      let result;
      if (STRIPE_ENABLED) {
        result = await processStripeWithdrawal(db, {
          withdrawalId: req.params.id,
          requestId: ctx.requestId,
          ip: ctx.ip,
        });
      } else {
        result = processWithdrawal(db, {
          withdrawalId: req.params.id,
          requestId: ctx.requestId,
          ip: ctx.ip,
        });
      }

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "process_failed", detail: err.message });
    }
  });

  app.get("/api/economy/admin/withdrawals", adminOnly, (req, res) => {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // REVERSALS (admin only)
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/economy/admin/reverse", adminOnly, (req, res) => {
    try {
      const { transaction_id, reason } = req.body;
      if (!transaction_id) return res.status(400).json({ ok: false, error: "missing_transaction_id" });

      const ctx = auditCtx(req);
      const result = executeReversal(db, {
        originalTxId: transaction_id,
        reason: reason || "admin_reversal",
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);

      economyAudit(db, {
        action: "reversal",
        userId: req.user?.id,
        txId: result.batchId,
        details: { originalTxId: transaction_id, reason },
        ...ctx,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "reversal_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEE SCHEDULE + PLATFORM INFO
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/economy/fees", (_req, res) => {
    res.json({ ok: true, fees: FEES, platformAccount: PLATFORM_ACCOUNT_ID });
  });

  app.get("/api/economy/platform-balance", adminOnly, (_req, res) => {
    try {
      const result = getBalance(db, PLATFORM_ACCOUNT_ID);
      res.json({ ok: true, platformAccount: PLATFORM_ACCOUNT_ID, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "platform_balance_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LEDGER INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/economy/integrity", (req, res) => {
    try {
      const totalCredits = db.prepare(`
        SELECT COALESCE(SUM(net), 0) as total FROM economy_ledger
        WHERE to_user_id IS NOT NULL AND status = 'complete'
      `).get()?.total || 0;

      const totalDebits = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM economy_ledger
        WHERE from_user_id IS NOT NULL AND status = 'complete'
      `).get()?.total || 0;

      const totalMinted = db.prepare(`
        SELECT COALESCE(SUM(net), 0) as total FROM economy_ledger
        WHERE type = 'TOKEN_PURCHASE' AND status = 'complete'
      `).get()?.total || 0;

      const totalWithdrawn = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM economy_ledger
        WHERE type = 'WITHDRAWAL' AND status = 'complete'
      `).get()?.total || 0;

      const platformFees = db.prepare(`
        SELECT COALESCE(SUM(net), 0) as total FROM economy_ledger
        WHERE type = 'FEE' AND to_user_id = ? AND status = 'complete'
      `).get(PLATFORM_ACCOUNT_ID)?.total || 0;

      const txCount = db.prepare("SELECT COUNT(*) as c FROM economy_ledger").get()?.c || 0;

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

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Buy tokens via Stripe Checkout ─────────────────────────────────────────

  app.post("/api/economy/buy/checkout", async (req, res) => {
    try {
      if (!STRIPE_ENABLED) {
        return res.status(503).json({ ok: false, error: "stripe_not_configured" });
      }

      const userId = req.body.user_id || req.user?.id;
      const tokens = parseInt(req.body.tokens, 10);

      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });
      if (!Number.isInteger(tokens) || tokens <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_token_amount" });
      }

      const ctx = auditCtx(req);
      const result = await createCheckoutSession(db, {
        userId,
        tokens,
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "checkout_failed", detail: err.message });
    }
  });

  // ── Stripe Webhook ─────────────────────────────────────────────────────────
  // IMPORTANT: webhook needs raw body for signature verification.
  // This route must be registered BEFORE express.json() body parser,
  // OR use express.raw() locally.

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const result = await handleWebhook(db, {
        rawBody: req.body,
        signature: req.headers["stripe-signature"],
        requestId: req.headers["x-request-id"],
        ip: req.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json({ received: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "webhook_failed", detail: err.message });
    }
  });

  // ── Stripe Connect ─────────────────────────────────────────────────────────

  app.post("/api/stripe/connect/onboard", async (req, res) => {
    try {
      if (!STRIPE_ENABLED) {
        return res.status(503).json({ ok: false, error: "stripe_not_configured" });
      }

      const userId = req.body.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const ctx = auditCtx(req);
      const result = await createConnectOnboarding(db, {
        userId,
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "connect_onboard_failed", detail: err.message });
    }
  });

  app.get("/api/stripe/connect/status", (req, res) => {
    try {
      const userId = req.query.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const result = getConnectStatus(db, userId);
      res.json({ ok: true, userId, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "connect_status_failed", detail: err.message });
    }
  });

  // ── Stripe configuration status ────────────────────────────────────────────

  app.get("/api/economy/config", (_req, res) => {
    res.json({
      ok: true,
      stripeEnabled: STRIPE_ENABLED,
      fees: FEES,
      minWithdrawal: MIN_WITHDRAW_TOKENS,
      maxWithdrawalPerDay: MAX_WITHDRAW_TOKENS_PER_DAY,
      platformAccount: PLATFORM_ACCOUNT_ID,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PURCHASE STATE MACHINE + SUPPORT SURFACE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Purchase receipt / lookup ────────────────────────────────────────────

  app.get("/api/economy/purchases/:purchaseId/receipt", (req, res) => {
    try {
      const result = getPurchaseReceipt(db, req.params.purchaseId);
      if (!result.ok) return res.status(404).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "receipt_failed", detail: err.message });
    }
  });

  // ── Purchase lookup by ID ────────────────────────────────────────────────

  app.get("/api/economy/purchases/:purchaseId", (req, res) => {
    try {
      const purchase = getPurchase(db, req.params.purchaseId);
      if (!purchase) return res.status(404).json({ ok: false, error: "purchase_not_found" });
      res.json({ ok: true, purchase });
    } catch (err) {
      res.status(500).json({ ok: false, error: "purchase_lookup_failed", detail: err.message });
    }
  });

  // ── Purchase status history ──────────────────────────────────────────────

  app.get("/api/economy/purchases/:purchaseId/history", (req, res) => {
    try {
      const history = getPurchaseHistory(db, req.params.purchaseId);
      res.json({ ok: true, purchaseId: req.params.purchaseId, history });
    } catch (err) {
      res.status(500).json({ ok: false, error: "history_failed", detail: err.message });
    }
  });

  // ── User purchases (buyer or seller) ─────────────────────────────────────

  app.get("/api/economy/purchases", (req, res) => {
    try {
      const userId = req.query.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const role = req.query.role === "seller" ? "seller" : "buyer";
      const status = req.query.status || undefined;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;

      const result = getUserPurchases(db, userId, { role, status, limit, offset });
      res.json({ ok: true, userId, role, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: "purchases_list_failed", detail: err.message });
    }
  });

  // ── Admin: Refund / reverse a purchase ───────────────────────────────────

  app.post("/api/economy/admin/purchases/:purchaseId/refund", adminOnly, (req, res) => {
    try {
      const ctx = auditCtx(req);
      const result = executeCorrection(db, {
        correctionType: "REVERSAL",
        purchaseId: req.params.purchaseId,
        reason: req.body.reason || "admin_refund",
        actor: ctx.userId || "admin",
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "refund_failed", detail: err.message });
    }
  });

  // ── Admin: Make-good for a failed/disputed purchase ──────────────────────

  app.post("/api/economy/admin/purchases/:purchaseId/make-good", adminOnly, (req, res) => {
    try {
      const ctx = auditCtx(req);
      const result = executeCorrection(db, {
        correctionType: "MAKE_GOOD",
        purchaseId: req.params.purchaseId,
        reason: req.body.reason || "admin_make_good",
        actor: ctx.userId || "admin",
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "make_good_failed", detail: err.message });
    }
  });

  // ── Admin: Adjustment correction ─────────────────────────────────────────

  app.post("/api/economy/admin/purchases/:purchaseId/adjust", adminOnly, (req, res) => {
    try {
      const ctx = auditCtx(req);
      const adjustmentAmount = parseFloat(req.body.amount);
      if (!Number.isFinite(adjustmentAmount) || adjustmentAmount === 0) {
        return res.status(400).json({ ok: false, error: "invalid_adjustment_amount" });
      }
      if (!req.body.user_id) {
        return res.status(400).json({ ok: false, error: "missing_user_id" });
      }

      const result = executeCorrection(db, {
        correctionType: "ADJUSTMENT",
        purchaseId: req.params.purchaseId,
        reason: req.body.reason || "admin_adjustment",
        actor: ctx.userId || "admin",
        adjustmentAmount,
        adjustmentUserId: req.body.user_id,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "adjustment_failed", detail: err.message });
    }
  });

  // ── Admin: Manually transition a purchase state ──────────────────────────

  app.post("/api/economy/admin/purchases/:purchaseId/transition", adminOnly, (req, res) => {
    try {
      const { status, reason } = req.body;
      if (!status) return res.status(400).json({ ok: false, error: "missing_target_status" });

      const ctx = auditCtx(req);
      const result = transitionPurchase(db, req.params.purchaseId, status, {
        reason: reason || "admin_manual_transition",
        actor: ctx.userId || "admin",
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "transition_failed", detail: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Admin: Run reconciliation sweep ──────────────────────────────────────

  app.post("/api/economy/admin/reconciliation/run", adminOnly, (req, res) => {
    try {
      const dryRun = req.body.dry_run === true || req.query.dry_run === "true";
      const staleCreatedMinutes = parseInt(req.body.stale_created_minutes, 10) || 30;
      const stalePaidMinutes = parseInt(req.body.stale_paid_minutes, 10) || 15;
      const staleSettledMinutes = parseInt(req.body.stale_settled_minutes, 10) || 15;

      const result = runReconciliation(db, {
        dryRun,
        staleCreatedMinutes,
        stalePaidMinutes,
        staleSettledMinutes,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "reconciliation_failed", detail: err.message });
    }
  });

  // ── Admin: Reconciliation summary / dashboard ────────────────────────────

  app.get("/api/economy/admin/reconciliation/summary", adminOnly, (req, res) => {
    try {
      const result = getReconciliationSummary(db);
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: "summary_failed", detail: err.message });
    }
  });

  // ── Admin: Find purchases by status ──────────────────────────────────────

  app.get("/api/economy/admin/purchases", adminOnly, (req, res) => {
    try {
      const status = req.query.status;
      if (!status) return res.status(400).json({ ok: false, error: "missing_status_filter" });

      const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const olderThanMinutes = parseInt(req.query.older_than_minutes, 10) || undefined;

      const purchases = findPurchasesByStatus(db, status, { limit, olderThanMinutes });
      res.json({ ok: true, status, count: purchases.length, purchases });
    } catch (err) {
      res.status(500).json({ ok: false, error: "purchases_query_failed", detail: err.message });
    }
  });
}
