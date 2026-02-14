// economy/withdrawals.js
// Multi-step withdrawal workflow: request → pending → approved → processing → complete.
// Withdrawals are NEVER instant.

import { randomUUID } from "crypto";
import { validateAmount, validateBalance } from "./validators.js";
import { calculateFee, PLATFORM_ACCOUNT_ID } from "./fees.js";
import { recordTransactionBatch, generateTxId } from "./ledger.js";

function uid() {
  return "wd_" + randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowISO() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Request a withdrawal. Creates a pending withdrawal record.
 * Does NOT debit balance yet — that happens at processing.
 */
export function requestWithdrawal(db, { userId, amount }) {
  const amountCheck = validateAmount(amount);
  if (!amountCheck.ok) return amountCheck;

  // Check user has sufficient balance (including pending withdrawals)
  const pendingSum = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM economy_withdrawals
    WHERE user_id = ? AND status IN ('pending', 'approved', 'processing')
  `).get(userId)?.total || 0;

  const balCheck = validateBalance(db, userId, amount + pendingSum);
  if (!balCheck.ok) {
    return { ok: false, error: "insufficient_balance_including_pending", pendingAmount: pendingSum, balance: balCheck.balance };
  }

  const { fee, net } = calculateFee("WITHDRAWAL", amount);
  const id = uid();
  const now = nowISO();

  db.prepare(`
    INSERT INTO economy_withdrawals (id, user_id, amount, fee, net, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, userId, amount, fee, net, now, now);

  return { ok: true, withdrawal: { id, userId, amount, fee, net, status: "pending", createdAt: now } };
}

/**
 * Approve a pending withdrawal (admin action).
 */
export function approveWithdrawal(db, { withdrawalId, reviewerId }) {
  const wd = db.prepare("SELECT * FROM economy_withdrawals WHERE id = ?").get(withdrawalId);
  if (!wd) return { ok: false, error: "withdrawal_not_found" };
  if (wd.status !== "pending") return { ok: false, error: "withdrawal_not_pending", currentStatus: wd.status };

  const now = nowISO();
  db.prepare(`
    UPDATE economy_withdrawals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(reviewerId, now, now, withdrawalId);

  return { ok: true, withdrawal: { ...wd, status: "approved", reviewed_by: reviewerId, reviewed_at: now } };
}

/**
 * Reject a pending withdrawal (admin action).
 */
export function rejectWithdrawal(db, { withdrawalId, reviewerId }) {
  const wd = db.prepare("SELECT * FROM economy_withdrawals WHERE id = ?").get(withdrawalId);
  if (!wd) return { ok: false, error: "withdrawal_not_found" };
  if (wd.status !== "pending") return { ok: false, error: "withdrawal_not_pending", currentStatus: wd.status };

  const now = nowISO();
  db.prepare(`
    UPDATE economy_withdrawals SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(reviewerId, now, now, withdrawalId);

  return { ok: true, withdrawal: { ...wd, status: "rejected", reviewed_by: reviewerId, reviewed_at: now } };
}

/**
 * Process an approved withdrawal — actually debits the user and records the ledger entry.
 * This is where tokens leave the system.
 */
export function processWithdrawal(db, { withdrawalId, requestId, ip }) {
  const wd = db.prepare("SELECT * FROM economy_withdrawals WHERE id = ?").get(withdrawalId);
  if (!wd) return { ok: false, error: "withdrawal_not_found" };
  if (wd.status !== "approved") return { ok: false, error: "withdrawal_not_approved", currentStatus: wd.status };

  // Re-check balance at processing time
  const balCheck = validateBalance(db, wd.user_id, wd.amount);
  if (!balCheck.ok) return { ok: false, error: "insufficient_balance_at_processing", balance: balCheck.balance };

  const batchId = generateTxId();
  const now = nowISO();

  const doProcess = db.transaction(() => {
    // Debit user
    const entries = [{
      id: generateTxId(),
      type: "WITHDRAWAL",
      from: wd.user_id,
      to: null,
      amount: wd.amount,
      fee: wd.fee,
      net: wd.net,
      status: "complete",
      metadata: { withdrawalId, batchId, role: "debit" },
      requestId,
      ip,
    }];

    // Fee to platform
    if (wd.fee > 0) {
      entries.push({
        id: generateTxId(),
        type: "FEE",
        from: null,
        to: PLATFORM_ACCOUNT_ID,
        amount: wd.fee,
        fee: 0,
        net: wd.fee,
        status: "complete",
        metadata: { withdrawalId, batchId, role: "fee", sourceType: "WITHDRAWAL" },
        requestId,
        ip,
      });
    }

    const results = recordTransactionBatch(db, entries);

    // Update withdrawal status
    db.prepare(`
      UPDATE economy_withdrawals
      SET status = 'complete', ledger_id = ?, processed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(results[0].id, now, now, withdrawalId);

    return results;
  });

  try {
    const results = doProcess();
    return { ok: true, batchId, transactions: results, withdrawal: { ...wd, status: "complete" } };
  } catch (err) {
    return { ok: false, error: "withdrawal_processing_failed", detail: err.message };
  }
}

/**
 * Cancel a pending withdrawal (user action).
 */
export function cancelWithdrawal(db, { withdrawalId, userId }) {
  const wd = db.prepare("SELECT * FROM economy_withdrawals WHERE id = ?").get(withdrawalId);
  if (!wd) return { ok: false, error: "withdrawal_not_found" };
  if (wd.user_id !== userId) return { ok: false, error: "not_owner" };
  if (wd.status !== "pending") return { ok: false, error: "can_only_cancel_pending", currentStatus: wd.status };

  const now = nowISO();
  db.prepare(`
    UPDATE economy_withdrawals SET status = 'cancelled', updated_at = ? WHERE id = ?
  `).run(now, withdrawalId);

  return { ok: true, withdrawal: { ...wd, status: "cancelled" } };
}

/**
 * Get withdrawals for a user.
 */
export function getUserWithdrawals(db, userId, { limit = 25, offset = 0 } = {}) {
  const items = db.prepare(`
    SELECT * FROM economy_withdrawals WHERE user_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(userId, limit, offset);

  const total = db.prepare("SELECT COUNT(*) as c FROM economy_withdrawals WHERE user_id = ?").get(userId)?.c || 0;

  return { items, total, limit, offset };
}

/**
 * Get all withdrawals (admin view).
 */
export function getAllWithdrawals(db, { status, limit = 50, offset = 0 } = {}) {
  let sql = "SELECT * FROM economy_withdrawals WHERE 1=1";
  const params = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as c");
  const total = db.prepare(countSql).get(...params)?.c || 0;

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return { items: db.prepare(sql).all(...params), total, limit, offset };
}
