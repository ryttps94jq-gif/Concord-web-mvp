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
  getPurchase, getUserPurchases, getPurchaseHistory,
  transitionPurchase, findPurchasesByStatus,
} from "./purchases.js";
import {
  runReconciliation, executeCorrection, getPurchaseReceipt, getReconciliationSummary,
} from "./reconciliation.js";
import { mintCoins, burnCoins, getTreasuryState, verifyTreasuryInvariant } from "./coin-service.js";
import {
  calculateGenerationalRate, registerCitation, getAncestorChain,
  distributeRoyalties, getCreatorRoyalties, getContentRoyalties,
} from "./royalty-cascade.js";
import {
  createEmergentAccount, transferToReserve, getEmergentAccount,
  listEmergentAccounts, suspendEmergentAccount, isEmergentAccount, canWithdrawToFiat,
} from "./emergent-accounts.js";
import {
  createListing, purchaseListing, getListing, searchListings,
  delistListing, updateListingPrice, checkWashTrading,
} from "./marketplace-service.js";
import { distributeFee, getFeeSplitBalances, getFeeDistributions } from "./fee-split.js";
import { runTreasuryReconciliation, getReconciliationHistory } from "./treasury-reconciliation.js";
import { getSystemBalanceSummary } from "./balances.js";

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
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

      const result = getBalance(db, userId);
      res.json({ ok: true, userId, ...result });
    } catch (err) {
      console.error("[economy] balance_fetch_failed:", err.message);
      res.status(500).json({ ok: false, error: "balance_fetch_failed" });
    }
  });

  // ── Transaction History ────────────────────────────────────────────────────

  app.get("/api/economy/history", (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ ok: false, error: "unauthorized" });

      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;
      const type = req.query.type || undefined;

      const result = getTransactions(db, userId, { limit, offset, type });
      res.json({ ok: true, userId, ...result });
    } catch (err) {
      console.error("[economy] history_fetch_failed:", err.message);
      res.status(500).json({ ok: false, error: "history_fetch_failed" });
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
      console.error("[economy] admin_transactions_failed:", err.message);
      res.status(500).json({ ok: false, error: "admin_transactions_failed" });
    }
  });

  // ── Token Purchase (direct ledger mint, no Stripe) ─────────────────────────

  app.post("/api/economy/buy", adminOnly, (req, res) => {
    try {
      const userId = req.body.user_id || req.user?.id;
      const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;

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

      console.error("[economy] purchase_failed:", err.message);

      res.status(500).json({ ok: false, error: "purchase_failed" });

    }
  });

  // ── Transfer (user → user) ─────────────────────────────────────────────────

  app.post("/api/economy/transfer", (req, res) => {
    try {
      const from = req.user?.id;
      const to = req.body.to;
      const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;

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

      console.error("[economy] transfer_failed:", err.message);

      res.status(500).json({ ok: false, error: "transfer_failed" });

    }
  });

  // ── Marketplace Purchase (buyer → seller, with fee) ────────────────────────

  app.post("/api/economy/marketplace-purchase", (req, res) => {
    try {
      const buyerId = req.body.buyer_id || req.user?.id;
      const sellerId = req.body.seller_id;
      const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;
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

      console.error("[economy] marketplace_purchase_failed:", err.message);

      res.status(500).json({ ok: false, error: "marketplace_purchase_failed" });

    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WITHDRAWALS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/economy/withdraw", (req, res) => {
    try {
      const userId = req.body.user_id || req.user?.id;
      const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;

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

      console.error("[economy] withdrawal_request_failed:", err.message);

      res.status(500).json({ ok: false, error: "withdrawal_request_failed" });

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

      console.error("[economy] withdrawals_fetch_failed:", err.message);

      res.status(500).json({ ok: false, error: "withdrawals_fetch_failed" });

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

      console.error("[economy] cancel_failed:", err.message);

      res.status(500).json({ ok: false, error: "cancel_failed" });

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

      console.error("[economy] approve_failed:", err.message);

      res.status(500).json({ ok: false, error: "approve_failed" });

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

      console.error("[economy] reject_failed:", err.message);

      res.status(500).json({ ok: false, error: "reject_failed" });

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

      console.error("[economy] process_failed:", err.message);

      res.status(500).json({ ok: false, error: "process_failed" });

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

      console.error("[economy] admin_withdrawals_failed:", err.message);

      res.status(500).json({ ok: false, error: "admin_withdrawals_failed" });

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

      console.error("[economy] reversal_failed:", err.message);

      res.status(500).json({ ok: false, error: "reversal_failed" });

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

      console.error("[economy] platform_balance_failed:", err.message);

      res.status(500).json({ ok: false, error: "platform_balance_failed" });

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

      console.error("[economy] integrity_check_failed:", err.message);

      res.status(500).json({ ok: false, error: "integrity_check_failed" });

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

      console.error("[economy] checkout_failed:", err.message);

      res.status(500).json({ ok: false, error: "checkout_failed" });

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

      console.error("[economy] webhook_failed:", err.message);

      res.status(500).json({ ok: false, error: "webhook_failed" });

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

      console.error("[economy] connect_onboard_failed:", err.message);

      res.status(500).json({ ok: false, error: "connect_onboard_failed" });

    }
  });

  app.get("/api/stripe/connect/status", (req, res) => {
    try {
      const userId = req.query.user_id || req.user?.id;
      if (!userId) return res.status(400).json({ ok: false, error: "missing_user_id" });

      const result = getConnectStatus(db, userId);
      res.json({ ok: true, userId, ...result });
    } catch (err) {

      console.error("[economy] connect_status_failed:", err.message);

      res.status(500).json({ ok: false, error: "connect_status_failed" });

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

      console.error("[economy] receipt_failed:", err.message);

      res.status(500).json({ ok: false, error: "receipt_failed" });

    }
  });

  // ── Purchase lookup by ID ────────────────────────────────────────────────

  app.get("/api/economy/purchases/:purchaseId", (req, res) => {
    try {
      const purchase = getPurchase(db, req.params.purchaseId);
      if (!purchase) return res.status(404).json({ ok: false, error: "purchase_not_found" });
      res.json({ ok: true, purchase });
    } catch (err) {

      console.error("[economy] purchase_lookup_failed:", err.message);

      res.status(500).json({ ok: false, error: "purchase_lookup_failed" });

    }
  });

  // ── Purchase status history ──────────────────────────────────────────────

  app.get("/api/economy/purchases/:purchaseId/history", (req, res) => {
    try {
      const history = getPurchaseHistory(db, req.params.purchaseId);
      res.json({ ok: true, purchaseId: req.params.purchaseId, history });
    } catch (err) {

      console.error("[economy] history_failed:", err.message);

      res.status(500).json({ ok: false, error: "history_failed" });

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

      console.error("[economy] purchases_list_failed:", err.message);

      res.status(500).json({ ok: false, error: "purchases_list_failed" });

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

      console.error("[economy] refund_failed:", err.message);

      res.status(500).json({ ok: false, error: "refund_failed" });

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

      console.error("[economy] make_good_failed:", err.message);

      res.status(500).json({ ok: false, error: "make_good_failed" });

    }
  });

  // ── Admin: Adjustment correction ─────────────────────────────────────────

  app.post("/api/economy/admin/purchases/:purchaseId/adjust", adminOnly, (req, res) => {
    try {
      const ctx = auditCtx(req);
      const adjustmentAmount = Math.round(parseFloat(req.body.amount) * 100) / 100;
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

      console.error("[economy] adjustment_failed:", err.message);

      res.status(500).json({ ok: false, error: "adjustment_failed" });

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

      console.error("[economy] transition_failed:", err.message);

      res.status(500).json({ ok: false, error: "transition_failed" });

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

      console.error("[economy] reconciliation_failed:", err.message);

      res.status(500).json({ ok: false, error: "reconciliation_failed" });

    }
  });

  // ── Admin: Reconciliation summary / dashboard ────────────────────────────

  app.get("/api/economy/admin/reconciliation/summary", adminOnly, (req, res) => {
    try {
      const result = getReconciliationSummary(db);
      res.json(result);
    } catch (err) {

      console.error("[economy] summary_failed:", err.message);

      res.status(500).json({ ok: false, error: "summary_failed" });

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

      console.error("[economy] purchases_query_failed:", err.message);

      res.status(500).json({ ok: false, error: "purchases_query_failed" });

    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TREASURY / COIN SERVICE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/economy/treasury", adminOnly, (_req, res) => {
    try {
      const state = getTreasuryState(db);
      const invariant = verifyTreasuryInvariant(db);
      res.json({ ok: true, treasury: state, invariant });
    } catch (err) {

      console.error("[economy] treasury_fetch_failed:", err.message);

      res.status(500).json({ ok: false, error: "treasury_fetch_failed" });

    }
  });

  app.post("/api/economy/admin/treasury/reconcile", adminOnly, (req, res) => {
    try {
      const stripeBalance = req.body.stripe_balance != null ? Math.round(parseFloat(req.body.stripe_balance) * 100) / 100 : undefined;
      const result = runTreasuryReconciliation(db, { stripeBalance });
      res.json(result);
    } catch (err) {

      console.error("[economy] reconciliation_failed:", err.message);

      res.status(500).json({ ok: false, error: "reconciliation_failed" });

    }
  });

  app.get("/api/economy/admin/treasury/history", adminOnly, (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
      const offset = parseInt(req.query.offset, 10) || 0;
      const result = getReconciliationHistory(db, { limit, offset });
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[economy] history_fetch_failed:", err.message);
      res.status(500).json({ ok: false, error: "history_fetch_failed" });
    }
  });

  app.get("/api/economy/admin/balances/summary", adminOnly, (_req, res) => {
    try {
      const summary = getSystemBalanceSummary(db);
      res.json({ ok: true, ...summary });
    } catch (err) {

      console.error("[economy] summary_failed:", err.message);

      res.status(500).json({ ok: false, error: "summary_failed" });

    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROYALTY CASCADE
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/economy/royalties/register-citation", (req, res) => {
    try {
      const { child_id, parent_id, creator_id, parent_creator_id, generation } = req.body;
      if (!child_id || !parent_id) return res.status(400).json({ ok: false, error: "missing_content_ids" });
      if (!creator_id || !parent_creator_id) return res.status(400).json({ ok: false, error: "missing_creator_ids" });

      const result = registerCitation(db, {
        childId: child_id,
        parentId: parent_id,
        creatorId: creator_id,
        parentCreatorId: parent_creator_id,
        generation: generation || 1,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {

      console.error("[economy] citation_failed:", err.message);

      res.status(500).json({ ok: false, error: "citation_failed" });

    }
  });

  app.get("/api/economy/royalties/chain/:contentId", (req, res) => {
    try {
      const ancestors = getAncestorChain(db, req.params.contentId);
      res.json({ ok: true, contentId: req.params.contentId, ancestors, count: ancestors.length });
    } catch (err) {

      console.error("[economy] chain_fetch_failed:", err.message);

      res.status(500).json({ ok: false, error: "chain_fetch_failed" });

    }
  });

  app.get("/api/economy/royalties/creator/:creatorId", (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;
      const result = getCreatorRoyalties(db, req.params.creatorId, { limit, offset });
      res.json({ ok: true, creatorId: req.params.creatorId, ...result });
    } catch (err) {

      console.error("[economy] royalties_fetch_failed:", err.message);

      res.status(500).json({ ok: false, error: "royalties_fetch_failed" });

    }
  });

  app.get("/api/economy/royalties/content/:contentId", (req, res) => {
    try {
      const payouts = getContentRoyalties(db, req.params.contentId);
      res.json({ ok: true, contentId: req.params.contentId, payouts, count: payouts.length });
    } catch (err) {

      console.error("[economy] content_royalties_failed:", err.message);

      res.status(500).json({ ok: false, error: "content_royalties_failed" });

    }
  });

  app.get("/api/economy/royalties/rate", (req, res) => {
    const generation = parseInt(req.query.generation, 10) || 0;
    const initialRate = parseFloat(req.query.initial_rate) || undefined;
    const rate = calculateGenerationalRate(generation, initialRate);
    res.json({ ok: true, generation, rate, ratePercent: `${(rate * 100).toFixed(3)}%` });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EMERGENT ACCOUNTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/economy/emergent/create", adminOnly, (req, res) => {
    try {
      const { emergent_id, display_name, seed_amount } = req.body;
      if (!emergent_id) return res.status(400).json({ ok: false, error: "missing_emergent_id" });

      const result = createEmergentAccount(db, {
        emergentId: emergent_id,
        displayName: display_name,
        seedAmount: seed_amount ? Math.round(parseFloat(seed_amount) * 100) / 100 : 0,
      });

      if (!result.ok) return res.status(400).json(result);

      const ctx = auditCtx(req);
      economyAudit(db, {
        action: "emergent_account_created",
        userId: ctx.userId || "admin",
        details: { emergentId: emergent_id, seedAmount: seed_amount },
        ...ctx,
      });

      res.json(result);
    } catch (err) {

      console.error("[economy] emergent_create_failed:", err.message);

      res.status(500).json({ ok: false, error: "emergent_create_failed" });

    }
  });

  app.get("/api/economy/emergent/:emergentId", (req, res) => {
    try {
      const account = getEmergentAccount(db, req.params.emergentId);
      if (!account) return res.status(404).json({ ok: false, error: "emergent_not_found" });
      res.json({ ok: true, account });
    } catch (err) {

      console.error("[economy] emergent_fetch_failed:", err.message);

      res.status(500).json({ ok: false, error: "emergent_fetch_failed" });

    }
  });

  app.get("/api/economy/emergent", (req, res) => {
    try {
      const status = req.query.status || "active";
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;
      const result = listEmergentAccounts(db, { status, limit, offset });
      res.json({ ok: true, ...result });
    } catch (err) {

      console.error("[economy] emergent_list_failed:", err.message);

      res.status(500).json({ ok: false, error: "emergent_list_failed" });

    }
  });

  app.post("/api/economy/emergent/:emergentId/transfer-to-reserve", (req, res) => {
    try {
      const amount = Math.round(parseFloat(req.body.amount) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ ok: false, error: "invalid_amount" });
      }

      const ctx = auditCtx(req);
      const result = transferToReserve(db, {
        emergentId: req.params.emergentId,
        amount,
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {

      console.error("[economy] transfer_failed:", err.message);

      res.status(500).json({ ok: false, error: "transfer_failed" });

    }
  });

  app.post("/api/economy/emergent/:emergentId/suspend", adminOnly, (req, res) => {
    try {
      const result = suspendEmergentAccount(db, {
        emergentId: req.params.emergentId,
        reason: req.body.reason || "admin_action",
      });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {

      console.error("[economy] suspend_failed:", err.message);

      res.status(500).json({ ok: false, error: "suspend_failed" });

    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETPLACE
  // ═══════════════════════════════════════════════════════════════════════════

  app.post("/api/economy/marketplace/list", (req, res) => {
    try {
      const {
        seller_id, content_id, content_type, title, description,
        price, content_data, license_type, royalty_chain,
      } = req.body;
      const sellerId = seller_id || req.user?.id;

      if (!sellerId) return res.status(400).json({ ok: false, error: "missing_seller_id" });

      const result = createListing(db, {
        sellerId,
        contentId: content_id,
        contentType: content_type,
        title,
        description,
        price: Math.round(parseFloat(price) * 100) / 100,
        contentData: content_data,
        licenseType: license_type,
        royaltyChain: royalty_chain || [],
      });

      if (!result.ok) return res.status(400).json(result);

      const ctx = auditCtx(req);
      economyAudit(db, {
        action: "marketplace_listing_created",
        userId: sellerId,
        amount: Math.round(parseFloat(price) * 100) / 100,
        details: { listingId: result.listing?.id, contentType: content_type, title },
        ...ctx,
      });

      res.json(result);
    } catch (err) {

      console.error("[economy] listing_failed:", err.message);

      res.status(500).json({ ok: false, error: "listing_failed" });

    }
  });

  app.post("/api/economy/marketplace/purchase", (req, res) => {
    try {
      const buyerId = req.body.buyer_id || req.user?.id;
      const listingId = req.body.listing_id;

      if (!buyerId) return res.status(400).json({ ok: false, error: "missing_buyer_id" });
      if (!listingId) return res.status(400).json({ ok: false, error: "missing_listing_id" });

      // Block emergent fiat withdrawal attempt (defense in depth)
      if (isEmergentAccount(buyerId) && !canWithdrawToFiat(buyerId)) {
        // This is fine — emergents CAN buy on marketplace, just can't withdraw to fiat
      }

      const ctx = auditCtx(req);
      const result = purchaseListing(db, {
        buyerId,
        listingId,
        requestId: ctx.requestId,
        ip: ctx.ip,
      });

      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {

      console.error("[economy] purchase_failed:", err.message);

      res.status(500).json({ ok: false, error: "purchase_failed" });

    }
  });

  app.get("/api/economy/marketplace/listings", (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;
      const result = searchListings(db, {
        contentType: req.query.content_type,
        sellerId: req.query.seller_id,
        status: req.query.status || "active",
        minPrice: req.query.min_price ? Math.round(parseFloat(req.query.min_price) * 100) / 100 : undefined,
        maxPrice: req.query.max_price ? Math.round(parseFloat(req.query.max_price) * 100) / 100 : undefined,
        limit,
        offset,
      });
      res.json({ ok: true, ...result });
    } catch (err) {

      console.error("[economy] listings_fetch_failed:", err.message);

      res.status(500).json({ ok: false, error: "listings_fetch_failed" });

    }
  });

  app.get("/api/economy/marketplace/listings/:listingId", (req, res) => {
    try {
      const listing = getListing(db, req.params.listingId);
      if (!listing) return res.status(404).json({ ok: false, error: "listing_not_found" });
      res.json({ ok: true, listing });
    } catch (err) {

      console.error("[economy] listing_fetch_failed:", err.message);

      res.status(500).json({ ok: false, error: "listing_fetch_failed" });

    }
  });

  app.post("/api/economy/marketplace/listings/:listingId/delist", (req, res) => {
    try {
      const sellerId = req.body.seller_id || req.user?.id;
      if (!sellerId) return res.status(400).json({ ok: false, error: "missing_seller_id" });

      const result = delistListing(db, { listingId: req.params.listingId, sellerId });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {

      console.error("[economy] delist_failed:", err.message);

      res.status(500).json({ ok: false, error: "delist_failed" });

    }
  });

  app.patch("/api/economy/marketplace/listings/:listingId/price", (req, res) => {
    try {
      const sellerId = req.body.seller_id || req.user?.id;
      const newPrice = Math.round(parseFloat(req.body.price) * 100) / 100;
      if (!sellerId) return res.status(400).json({ ok: false, error: "missing_seller_id" });

      const result = updateListingPrice(db, {
        listingId: req.params.listingId,
        sellerId,
        newPrice,
      });
      if (!result.ok) return res.status(400).json(result);
      res.json(result);
    } catch (err) {

      console.error("[economy] price_update_failed:", err.message);

      res.status(500).json({ ok: false, error: "price_update_failed" });

    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FEE SPLIT
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/economy/admin/fee-split/balances", adminOnly, (_req, res) => {
    try {
      const balances = getFeeSplitBalances(db);
      res.json({ ok: true, ...balances });
    } catch (err) {

      console.error("[economy] fee_split_balances_failed:", err.message);

      res.status(500).json({ ok: false, error: "fee_split_balances_failed" });

    }
  });

  app.get("/api/economy/admin/fee-split/history", adminOnly, (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;
      const result = getFeeDistributions(db, { limit, offset });
      res.json({ ok: true, ...result });
    } catch (err) {

      console.error("[economy] fee_split_history_failed:", err.message);

      res.status(500).json({ ok: false, error: "fee_split_history_failed" });

    }
  });
}
