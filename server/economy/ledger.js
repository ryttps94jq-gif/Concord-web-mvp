// economy/ledger.js
// Append-only ledger — the single source of truth for all economic activity.
// Rows are NEVER updated or deleted. Reversals create new counter-entries.

import { randomUUID } from "crypto";

function uid() {
  return "txn_" + randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowISO() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Record a single ledger transaction.
 * @param {object} db — better-sqlite3 instance
 * @param {object} tx — transaction data
 * @returns {{ id: string, createdAt: string }}
 */
export function recordTransaction(db, tx) {
  const id = tx.id || uid();
  const createdAt = nowISO();

  db.prepare(`
    INSERT INTO economy_ledger
      (id, type, from_user_id, to_user_id, amount, fee, net, status, metadata_json, request_id, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  );

  return { id, createdAt };
}

/**
 * Record multiple ledger entries atomically inside an existing transaction.
 * Caller must wrap this in db.transaction().
 */
export function recordTransactionBatch(db, entries) {
  const stmt = db.prepare(`
    INSERT INTO economy_ledger
      (id, type, from_user_id, to_user_id, amount, fee, net, status, metadata_json, request_id, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = nowISO();
  const results = [];

  for (const tx of entries) {
    const id = tx.id || uid();
    stmt.run(
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
      now,
    );
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
