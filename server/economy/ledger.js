// economy/ledger.js
// Append-only ledger — the single source of truth for all economic activity.
// Rows are NEVER updated or deleted. Reversals create new counter-entries.
//
// Transaction types:
//   TOKEN_PURCHASE       — Fiat → Coin via Stripe checkout
//   TRANSFER             — User-to-user coin transfer
//   MARKETPLACE_PURCHASE — Buyer purchases listing from seller
//   WITHDRAWAL           — Coin → Fiat via Stripe Connect (users only)
//   FEE                  — Platform fee collection entry
//   REVERSAL             — Counter-entry for disputed or failed transactions
//   ROYALTY              — Cascade royalty payout to ancestor creators
//   EMERGENT_TRANSFER    — Operating wallet → Reserve account

import { randomUUID } from "crypto";

function uid() {
  return "txn_" + randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowISO() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Check whether a ref_id has already been processed in the ledger.
 * Used for idempotency: if the ref_id exists, the operation was already done.
 * @param {object} db — better-sqlite3 instance
 * @param {string} refId — the idempotency reference ID
 * @returns {{ exists: boolean, entries?: object[] }}
 */
export function checkRefIdProcessed(db, refId) {
  if (!refId) return { exists: false };
  try {
    const rows = db.prepare(
      "SELECT id, type, amount, net, status, created_at FROM economy_ledger WHERE ref_id = ?"
    ).all(refId);
    if (rows.length > 0) return { exists: true, entries: rows };
  } catch {
    // ref_id column may not exist yet (pre-migration); treat as not processed
  }
  return { exists: false };
}

/**
 * Record a single ledger transaction.
 * @param {object} db — better-sqlite3 instance
 * @param {object} tx — transaction data (optional: tx.refId for idempotency)
 * @returns {{ id: string, createdAt: string }}
 */
export function recordTransaction(db, tx) {
  const id = tx.id || uid();
  const createdAt = nowISO();

  // Try inserting with ref_id column; fall back to without if column doesn't exist yet
  try {
    db.prepare(`
      INSERT INTO economy_ledger
        (id, type, from_user_id, to_user_id, amount, fee, net, status, metadata_json, request_id, ip, created_at, ref_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tx.type,
      tx.from || null,
      tx.to || null,
      tx.amount,
      tx.fee ?? 0,
      tx.net ?? (tx.amount - (tx.fee ?? 0)),
      tx.status || "complete",
      JSON.stringify(tx.metadata || {}),
      tx.requestId || null,
      tx.ip || null,
      createdAt,
      tx.refId || null,
    );
  } catch (e) {
    if (e.message?.includes('ref_id')) {
      // Fallback: column doesn't exist yet
      db.prepare(`
        INSERT INTO economy_ledger
          (id, type, from_user_id, to_user_id, amount, fee, net, status, metadata_json, request_id, ip, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, tx.type, tx.from || null, tx.to || null, tx.amount,
        tx.fee ?? 0, tx.net ?? (tx.amount - (tx.fee ?? 0)),
        tx.status || "complete", JSON.stringify(tx.metadata || {}),
        tx.requestId || null, tx.ip || null, createdAt,
      );
    } else {
      throw e;
    }
  }

  return { id, createdAt };
}

/**
 * Record multiple ledger entries atomically inside an existing transaction.
 * Caller must wrap this in db.transaction().
 * Each entry can optionally include a refId for idempotency tracking.
 */
export function recordTransactionBatch(db, entries) {
  const now = nowISO();
  const results = [];

  // Try with ref_id column first; fall back if it doesn't exist
  let useRefId = true;
  let stmt;
  try {
    // Probe whether ref_id column exists by checking table info
    const cols = db.prepare("PRAGMA table_info(economy_ledger)").all();
    const hasRefId = cols.some(c => c.name === "ref_id");
    if (!hasRefId) throw new Error("no ref_id column");

    stmt = db.prepare(`
      INSERT INTO economy_ledger
        (id, type, from_user_id, to_user_id, amount, fee, net, status, metadata_json, request_id, ip, created_at, ref_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  } catch {
    useRefId = false;
    stmt = db.prepare(`
      INSERT INTO economy_ledger
        (id, type, from_user_id, to_user_id, amount, fee, net, status, metadata_json, request_id, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  for (const tx of entries) {
    const id = tx.id || uid();
    if (useRefId) {
      stmt.run(
        id, tx.type, tx.from || null, tx.to || null, tx.amount,
        tx.fee ?? 0, tx.net ?? (tx.amount - (tx.fee ?? 0)),
        tx.status || "complete", JSON.stringify(tx.metadata || {}),
        tx.requestId || null, tx.ip || null, now, tx.refId || null,
      );
    } else {
      stmt.run(
        id, tx.type, tx.from || null, tx.to || null, tx.amount,
        tx.fee ?? 0, tx.net ?? (tx.amount - (tx.fee ?? 0)),
        tx.status || "complete", JSON.stringify(tx.metadata || {}),
        tx.requestId || null, tx.ip || null, now,
      );
    }
    results.push({ id, createdAt: now });
  }

  return results;
}

/**
 * Get all transactions for a user (both sent and received), most recent first.
 */
export function getTransactions(db, userId, { limit = 50, offset = 0, type } = {}) {
  let sql = `
    SELECT * FROM economy_ledger
    WHERE (from_user_id = ? OR to_user_id = ?)
  `;
  const params = [userId, userId];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const items = db.prepare(sql).all(...params);

  const countSql = type
    ? "SELECT COUNT(*) as c FROM economy_ledger WHERE (from_user_id = ? OR to_user_id = ?) AND type = ?"
    : "SELECT COUNT(*) as c FROM economy_ledger WHERE (from_user_id = ? OR to_user_id = ?)";
  const countParams = type ? [userId, userId, type] : [userId, userId];
  const total = db.prepare(countSql).get(...countParams)?.c || 0;

  return {
    items: items.map(parseRow),
    total,
    limit,
    offset,
  };
}

/**
 * Get all transactions system-wide (admin view).
 */
export function getAllTransactions(db, { limit = 100, offset = 0, type, status } = {}) {
  let sql = "SELECT * FROM economy_ledger WHERE 1=1";
  const params = [];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as c");
  const total = db.prepare(countSql).get(...params)?.c || 0;

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return {
    items: db.prepare(sql).all(...params).map(parseRow),
    total,
    limit,
    offset,
  };
}

/**
 * Get a single transaction by ID.
 */
export function getTransaction(db, txId) {
  const row = db.prepare("SELECT * FROM economy_ledger WHERE id = ?").get(txId);
  return row ? parseRow(row) : null;
}

function parseRow(row) {
  return {
    ...row,
    metadata: safeJsonParse(row.metadata_json),
  };
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return {}; }
}

export { uid as generateTxId, nowISO };
