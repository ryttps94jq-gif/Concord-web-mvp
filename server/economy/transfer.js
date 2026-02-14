// economy/transfer.js
// Atomic transfer engine. All writes happen inside a single SQLite transaction.
// If any step fails, nothing commits — no partial state.

import { recordTransactionBatch, generateTxId } from "./ledger.js";
import { calculateFee, PLATFORM_ACCOUNT_ID } from "./fees.js";
import { validateTransfer, validateAmount, validateBalance } from "./validators.js";

/**
 * Execute an atomic transfer between two users.
 *
 * Steps (all-or-nothing):
 *   1. Validate sender balance
 *   2. Compute fee
 *   3. Compute net amount
 *   4. Create debit record (from sender)
 *   5. Create credit record (to recipient)
 *   6. Create fee record (to platform)
 *   7. Commit all together
 *
 * @returns {{ ok: boolean, transactions: array, error?: string }}
 */
export function executeTransfer(db, { from, to, amount, type = "TRANSFER", metadata = {}, requestId, ip }) {
  // 1. Validate
  const validation = validateTransfer(db, { from, to, amount });
  if (!validation.ok) return validation;

  // 2-3. Compute fee and net
  const { fee, net } = calculateFee(type, amount);

  // 4-7. Atomic commit: debit + credit + fee
  const entries = [];
  const batchId = generateTxId();

  // Debit: sender loses the full amount
  entries.push({
    id: generateTxId(),
    type,
    from,
    to,
    amount,
    fee,
    net,
    status: "complete",
    metadata: { ...metadata, batchId, role: "debit" },
    requestId,
    ip,
  });

  // Credit: recipient gets the net amount
  entries.push({
    id: generateTxId(),
    type,
    from: null,
    to,
    amount: net,
    fee: 0,
    net,
    status: "complete",
    metadata: { ...metadata, batchId, role: "credit" },
    requestId,
    ip,
  });

  // Fee: platform gets the fee (if > 0)
  if (fee > 0) {
    entries.push({
      id: generateTxId(),
      type: "FEE",
      from: null,
      to: PLATFORM_ACCOUNT_ID,
      amount: fee,
      fee: 0,
      net: fee,
      status: "complete",
      metadata: { ...metadata, batchId, role: "fee", sourceType: type },
      requestId,
      ip,
    });
  }

  // Execute atomically
  const doTransfer = db.transaction(() => {
    return recordTransactionBatch(db, entries);
  });

  try {
    const results = doTransfer();
    return {
      ok: true,
      batchId,
      transactions: results,
      amount,
      fee,
      net,
      from,
      to,
    };
  } catch (err) {
    return { ok: false, error: "transaction_failed", detail: err.message };
  }
}

/**
 * Execute a token purchase (external money → tokens).
 * No sender — tokens are minted to the buyer, with a fee to platform.
 */
export function executePurchase(db, { userId, amount, metadata = {}, requestId, ip }) {
  const amountCheck = validateAmount(amount);
  if (!amountCheck.ok) return amountCheck;

  if (!userId) return { ok: false, error: "missing_user_id" };

  const { fee, net } = calculateFee("TOKEN_PURCHASE", amount);
  const batchId = generateTxId();

  const entries = [
    // Credit: buyer gets net tokens
    {
      id: generateTxId(),
      type: "TOKEN_PURCHASE",
      from: null,
      to: userId,
      amount: net,
      fee: 0,
      net,
      status: "complete",
      metadata: { ...metadata, batchId, role: "credit", grossAmount: amount },
      requestId,
      ip,
    },
  ];

  // Fee to platform
  if (fee > 0) {
    entries.push({
      id: generateTxId(),
      type: "FEE",
      from: null,
      to: PLATFORM_ACCOUNT_ID,
      amount: fee,
      fee: 0,
      net: fee,
      status: "complete",
      metadata: { ...metadata, batchId, role: "fee", sourceType: "TOKEN_PURCHASE" },
      requestId,
      ip,
    });
  }

  const doPurchase = db.transaction(() => {
    return recordTransactionBatch(db, entries);
  });

  try {
    const results = doPurchase();
    return { ok: true, batchId, transactions: results, amount, fee, net };
  } catch (err) {
    return { ok: false, error: "purchase_failed", detail: err.message };
  }
}

/**
 * Execute a marketplace purchase: buyer pays seller, platform takes fee.
 */
export function executeMarketplacePurchase(db, { buyerId, sellerId, amount, listingId, metadata = {}, requestId, ip }) {
  // Validate buyer balance
  const balCheck = validateBalance(db, buyerId, amount);
  if (!balCheck.ok) return balCheck;

  const { fee, net } = calculateFee("MARKETPLACE_PURCHASE", amount);
  const batchId = generateTxId();

  const entries = [
    // Debit: buyer pays full amount
    {
      id: generateTxId(),
      type: "MARKETPLACE_PURCHASE",
      from: buyerId,
      to: sellerId,
      amount,
      fee,
      net,
      status: "complete",
      metadata: { ...metadata, batchId, listingId, role: "debit" },
      requestId,
      ip,
    },
    // Credit: seller gets net
    {
      id: generateTxId(),
      type: "MARKETPLACE_PURCHASE",
      from: null,
      to: sellerId,
      amount: net,
      fee: 0,
      net,
      status: "complete",
      metadata: { ...metadata, batchId, listingId, role: "credit" },
      requestId,
      ip,
    },
  ];

  // Fee to platform
  if (fee > 0) {
    entries.push({
      id: generateTxId(),
      type: "FEE",
      from: null,
      to: PLATFORM_ACCOUNT_ID,
      amount: fee,
      fee: 0,
      net: fee,
      status: "complete",
      metadata: { ...metadata, batchId, listingId, role: "fee", sourceType: "MARKETPLACE_PURCHASE" },
      requestId,
      ip,
    });
  }

  const doMarketplace = db.transaction(() => {
    return recordTransactionBatch(db, entries);
  });

  try {
    const results = doMarketplace();
    return { ok: true, batchId, transactions: results, amount, fee, net, buyerId, sellerId, listingId };
  } catch (err) {
    return { ok: false, error: "marketplace_purchase_failed", detail: err.message };
  }
}

/**
 * Create a reversal for a transaction. Never deletes — always adds counter-entry.
 */
export function executeReversal(db, { originalTxId, reason, requestId, ip }) {
  const original = db.prepare("SELECT * FROM economy_ledger WHERE id = ?").get(originalTxId);
  if (!original) return { ok: false, error: "transaction_not_found" };
  if (original.status === "reversed") return { ok: false, error: "already_reversed" };

  const batchId = generateTxId();

  const doReversal = db.transaction(() => {
    // Mark original as reversed
    db.prepare("UPDATE economy_ledger SET status = 'reversed' WHERE id = ?").run(originalTxId);

    // Create reversal entry (swap from/to)
    const entries = [{
      id: generateTxId(),
      type: "REVERSAL",
      from: original.to_user_id,
      to: original.from_user_id,
      amount: original.net,
      fee: 0,
      net: original.net,
      status: "complete",
      metadata: { originalTxId, reason, batchId, role: "reversal" },
      requestId,
      ip,
    }];

    return recordTransactionBatch(db, entries);
  });

  try {
    const results = doReversal();
    return { ok: true, batchId, transactions: results, originalTxId };
  } catch (err) {
    return { ok: false, error: "reversal_failed", detail: err.message };
  }
}
