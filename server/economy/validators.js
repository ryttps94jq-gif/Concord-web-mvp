// economy/validators.js
// Input validation for all economy operations.

import { getBalance } from "./balances.js";

// Maximum single transaction: 1,000,000 tokens
const MAX_TRANSACTION_AMOUNT = 1_000_000;

// Minimum transaction: 0.01
const MIN_TRANSACTION_AMOUNT = 0.01;

// Rate limit: max transactions per user per minute
const MAX_TXN_PER_MINUTE = 30;

/**
 * Validate a positive numeric amount within bounds.
 */
export function validateAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { ok: false, error: "amount_must_be_number" };
  }
  if (amount < MIN_TRANSACTION_AMOUNT) {
    return { ok: false, error: "amount_below_minimum", min: MIN_TRANSACTION_AMOUNT };
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    return { ok: false, error: "amount_exceeds_maximum", max: MAX_TRANSACTION_AMOUNT };
  }
  return { ok: true };
}

/**
 * Validate that a user has sufficient balance.
 */
export function validateBalance(db, userId, amount) {
  const { balance } = getBalance(db, userId);
  if (balance < amount) {
    return { ok: false, error: "insufficient_balance", balance, required: amount };
  }
  return { ok: true, balance };
}

/**
 * Validate user IDs are present and not the same for transfers.
 */
export function validateUsers(from, to) {
  if (!from && !to) {
    return { ok: false, error: "missing_user_ids" };
  }
  if (from && to && from === to) {
    return { ok: false, error: "cannot_transfer_to_self" };
  }
  return { ok: true };
}

/**
 * Check rate limit: max N transactions per user in the last minute.
 */
export function validateRateLimit(db, userId) {
  const oneMinuteAgo = new Date(Date.now() - 60_000)
    .toISOString().replace("T", " ").replace("Z", "");

  const count = db.prepare(`
    SELECT COUNT(*) as c FROM economy_ledger
    WHERE from_user_id = ? AND created_at > ?
  `).get(userId, oneMinuteAgo)?.c || 0;

  if (count >= MAX_TXN_PER_MINUTE) {
    return { ok: false, error: "rate_limit_exceeded", limit: MAX_TXN_PER_MINUTE };
  }
  return { ok: true, count };
}

/**
 * Run all validations for a transfer.
 */
export function validateTransfer(db, { from, to, amount }) {
  const amountCheck = validateAmount(amount);
  if (!amountCheck.ok) return amountCheck;

  const userCheck = validateUsers(from, to);
  if (!userCheck.ok) return userCheck;

  const balanceCheck = validateBalance(db, from, amount);
  if (!balanceCheck.ok) return balanceCheck;

  const rateCheck = validateRateLimit(db, from);
  if (!rateCheck.ok) return rateCheck;

  return { ok: true };
}

/**
 * Run all validations for a purchase (buyer side).
 */
export function validatePurchase(db, { buyerId, amount }) {
  const amountCheck = validateAmount(amount);
  if (!amountCheck.ok) return amountCheck;

  if (!buyerId) {
    return { ok: false, error: "missing_buyer_id" };
  }

  const balanceCheck = validateBalance(db, buyerId, amount);
  if (!balanceCheck.ok) return balanceCheck;

  const rateCheck = validateRateLimit(db, buyerId);
  if (!rateCheck.ok) return rateCheck;

  return { ok: true };
}
