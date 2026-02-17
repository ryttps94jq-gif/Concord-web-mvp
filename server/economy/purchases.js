// economy/purchases.js
// Purchase state machine — tracks every purchase through its lifecycle.
// States: CREATED → PAYMENT_PENDING → PAID → SETTLED → FULFILLED → (terminal)
// Terminal: FAILED, REFUNDED, CHARGEBACK, DISPUTED

import { randomUUID } from "crypto";
import { generateTxId } from "./ledger.js";

function uid() {
  return "pr_" + randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowISO() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

// Valid state transitions
const TRANSITIONS = {
  CREATED:          ["PAYMENT_PENDING", "PAID", "SETTLED", "FULFILLED", "FAILED"],
  PAYMENT_PENDING:  ["PAID", "FAILED"],
  PAID:             ["SETTLED", "FAILED", "REFUNDED", "CHARGEBACK"],
  SETTLED:          ["FULFILLED", "FAILED", "REFUNDED", "CHARGEBACK"],
  FULFILLED:        ["REFUNDED", "CHARGEBACK", "DISPUTED"],
  FAILED:           ["CREATED"],  // allow retry
  REFUNDED:         [],           // terminal
  CHARGEBACK:       ["DISPUTED"], // can escalate
  DISPUTED:         ["REFUNDED", "FULFILLED"], // can resolve either way
};

/**
 * Create a new purchase record in CREATED state.
 */
export function createPurchase(db, {
  purchaseId, buyerId, sellerId, listingId, listingType, licenseType,
  amount, source = "artistry", stripeSessionId,
}) {
  const id = uid();
  const now = nowISO();
  const refId = `purchase:${purchaseId}`;

  db.prepare(`
    INSERT INTO purchases
      (id, purchase_id, buyer_id, seller_id, listing_id, listing_type, license_type,
       amount, source, status, ref_id, stripe_session_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?, ?)
  `).run(
    id, purchaseId, buyerId, sellerId, listingId,
    listingType || null, licenseType || null,
    amount, source, refId, stripeSessionId || null, now, now,
  );

  recordTransition(db, purchaseId, null, "CREATED", "Purchase created", buyerId);

  return { id, purchaseId, status: "CREATED", refId };
}

/**
 * Transition a purchase to a new state. Enforces valid transitions.
 */
export function transitionPurchase(db, purchaseId, toStatus, { reason, actor, metadata, errorMessage } = {}) {
  const purchase = getPurchase(db, purchaseId);
  if (!purchase) return { ok: false, error: "purchase_not_found" };

  const allowed = TRANSITIONS[purchase.status] || [];
  if (!allowed.includes(toStatus)) {
    return {
      ok: false,
      error: "invalid_transition",
      detail: `Cannot transition from ${purchase.status} to ${toStatus}. Allowed: ${allowed.join(", ") || "none"}`,
    };
  }

  const now = nowISO();
  const updates = { status: toStatus, updated_at: now };

  if (errorMessage !== undefined) updates.error_message = errorMessage;
  if (toStatus === "FAILED") updates.retry_count = (purchase.retry_count || 0) + 1;
  if (toStatus === "FAILED") updates.last_retry_at = now;
  if (["REFUNDED", "CHARGEBACK", "DISPUTED"].includes(toStatus) && actor) {
    updates.resolved_by = actor;
    updates.resolved_at = now;
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(", ");
  const values = Object.values(updates);

  db.prepare(`UPDATE purchases SET ${setClauses} WHERE purchase_id = ?`).run(...values, purchaseId);

  recordTransition(db, purchaseId, purchase.status, toStatus, reason, actor, metadata);

  return { ok: true, purchaseId, from: purchase.status, to: toStatus };
}

/**
 * Update settlement details on a purchase after successful ledger commit.
 */
export function recordSettlement(db, purchaseId, {
  settlementBatchId, licenseId, marketplaceFee, sellerNet, totalRoyalties, royaltyDetails,
}) {
  const now = nowISO();
  db.prepare(`
    UPDATE purchases SET
      settlement_batch_id = ?,
      license_id = ?,
      marketplace_fee = ?,
      seller_net = ?,
      total_royalties = ?,
      royalty_details_json = ?,
      updated_at = ?
    WHERE purchase_id = ?
  `).run(
    settlementBatchId || null,
    licenseId || null,
    marketplaceFee ?? 0,
    sellerNet ?? 0,
    totalRoyalties ?? 0,
    JSON.stringify(royaltyDetails || []),
    now,
    purchaseId,
  );
}

/**
 * Get a purchase by purchaseId.
 */
export function getPurchase(db, purchaseId) {
  const row = db.prepare("SELECT * FROM purchases WHERE purchase_id = ?").get(purchaseId);
  if (!row) return null;
  return {
    ...row,
    royaltyDetails: safeJsonParse(row.royalty_details_json),
  };
}

/**
 * Get a purchase by ref_id (for reconciliation lookups).
 */
export function getPurchaseByRefId(db, refId) {
  const row = db.prepare("SELECT * FROM purchases WHERE ref_id = ?").get(refId);
  if (!row) return null;
  return { ...row, royaltyDetails: safeJsonParse(row.royalty_details_json) };
}

/**
 * Get purchases for a user (buyer or seller).
 */
export function getUserPurchases(db, userId, { role = "buyer", status, limit = 50, offset = 0 } = {}) {
  const col = role === "seller" ? "seller_id" : "buyer_id";
  let sql = `SELECT * FROM purchases WHERE ${col} = ?`;
  const params = [userId];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const items = db.prepare(sql).all(...params).map(r => ({
    ...r, royaltyDetails: safeJsonParse(r.royalty_details_json),
  }));

  const countSql = status
    ? `SELECT COUNT(*) as c FROM purchases WHERE ${col} = ? AND status = ?`
    : `SELECT COUNT(*) as c FROM purchases WHERE ${col} = ?`;
  const countParams = status ? [userId, status] : [userId];
  const total = db.prepare(countSql).get(...countParams)?.c || 0;

  return { items, total, limit, offset };
}

/**
 * Find purchases in a specific status (for reconciliation).
 */
export function findPurchasesByStatus(db, status, { limit = 100, olderThanMinutes } = {}) {
  let sql = "SELECT * FROM purchases WHERE status = ?";
  const params = [status];

  if (olderThanMinutes) {
    sql += " AND updated_at < datetime('now', ? || ' minutes')";
    params.push(`-${olderThanMinutes}`);
  }

  sql += " ORDER BY created_at ASC LIMIT ?";
  params.push(limit);

  return db.prepare(sql).all(...params).map(r => ({
    ...r, royaltyDetails: safeJsonParse(r.royalty_details_json),
  }));
}

/**
 * Get the full status history of a purchase.
 */
export function getPurchaseHistory(db, purchaseId) {
  return db.prepare(
    "SELECT * FROM purchase_status_history WHERE purchase_id = ? ORDER BY created_at ASC"
  ).all(purchaseId).map(r => ({
    ...r, metadata: safeJsonParse(r.metadata_json),
  }));
}

/**
 * Record a state transition in the history log.
 */
function recordTransition(db, purchaseId, fromStatus, toStatus, reason, actor, metadata) {
  db.prepare(`
    INSERT INTO purchase_status_history
      (id, purchase_id, from_status, to_status, reason, actor, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateTxId(), purchaseId, fromStatus, toStatus,
    reason || null, actor || null,
    JSON.stringify(metadata || {}), nowISO(),
  );
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return []; }
}

export { TRANSITIONS };
