// Concord Mobile — Local SQLite Ledger
// Append-only ledger for Concord Coin transactions.
// Mirrors server ledger: records are NEVER updated or deleted.

import {
  COIN_DECIMALS,
} from '../../utils/constants';
import type {
  CoinBalance,
  Transaction,
  TransactionType,
} from '../../utils/types';

// ── SQLite Database Interface ────────────────────────────────────────────────

export interface SQLiteDatabase {
  executeSql(sql: string, params?: unknown[]): Promise<SQLiteResultSet>;
  transaction(fn: (tx: SQLiteTransaction) => void): Promise<void>;
}

export interface SQLiteTransaction {
  executeSql(sql: string, params?: unknown[]): void;
}

export interface SQLiteResultSet {
  rows: {
    length: number;
    item(index: number): Record<string, unknown>;
    raw(): unknown[][];
  };
  insertId?: number;
  rowsAffected: number;
}

// ── Local Ledger Interface ───────────────────────────────────────────────────

export interface LocalLedger {
  recordTransaction(tx: Transaction): Promise<void>;
  getBalance(): Promise<CoinBalance>;
  getTransactions(limit?: number, type?: TransactionType): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getPendingTransactions(): Promise<Transaction[]>;
  markPropagated(txId: string): Promise<void>;
  getUnpropagated(): Promise<Transaction[]>;
  verifyBalance(): Promise<{ valid: boolean; computed: number; stored: number }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function roundCoin(value: number): number {
  const factor = Math.pow(10, COIN_DECIMALS);
  return Math.round(value * factor) / factor;
}

function rowToTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row.id as string,
    type: row.type as TransactionType,
    amount: row.amount as number,
    fromKey: row.from_key as string,
    toKey: row.to_key as string,
    timestamp: row.timestamp as number,
    nonce: deserializeBytes(row.nonce as string),
    balanceHash: row.balance_hash as string,
    signature: deserializeBytes(row.signature as string),
    status: row.status as Transaction['status'],
    propagated: (row.propagated as number) === 1,
  };
}

function serializeBytes(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function deserializeBytes(hex: string): Uint8Array {
  if (!hex || hex.length === 0) return new Uint8Array(0);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    from_key TEXT NOT NULL,
    to_key TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    nonce TEXT NOT NULL,
    balance_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    propagated INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_propagated ON transactions(propagated);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
`;

// ── Factory ──────────────────────────────────────────────────────────────────

export function createLocalLedger(db: SQLiteDatabase): LocalLedger {
  let initialized = false;

  async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    await db.executeSql(CREATE_TABLE_SQL);
    // Execute index creation statements individually
    const indexStatements = CREATE_INDEX_SQL.trim().split(';').filter(s => s.trim());
    for (const stmt of indexStatements) {
      await db.executeSql(stmt.trim());
    }
    initialized = true;
  }

  async function recordTransaction(tx: Transaction): Promise<void> {
    await ensureInitialized();

    // Idempotency: check if transaction already exists
    const existing = await db.executeSql(
      'SELECT id FROM transactions WHERE id = ?',
      [tx.id]
    );
    if (existing.rows.length > 0) {
      return; // already recorded, idempotent
    }

    await db.executeSql(
      `INSERT INTO transactions (id, type, amount, from_key, to_key, timestamp, nonce, balance_hash, signature, status, propagated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.type,
        tx.amount,
        tx.fromKey,
        tx.toKey,
        tx.timestamp,
        serializeBytes(tx.nonce),
        tx.balanceHash,
        serializeBytes(tx.signature),
        tx.status,
        tx.propagated ? 1 : 0,
        Date.now(),
      ]
    );
  }

  async function getBalance(): Promise<CoinBalance> {
    await ensureInitialized();

    // Incoming confirmed
    const incomingResult = await db.executeSql(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE to_key != '' AND status = 'confirmed' AND type IN ('transfer', 'reward', 'royalty')`,
      []
    );
    const incoming = (incomingResult.rows.item(0).total as number) || 0;

    // Outgoing confirmed
    const outgoingResult = await db.executeSql(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE from_key != '' AND status = 'confirmed' AND type IN ('transfer', 'marketplace_purchase')`,
      []
    );
    const outgoing = (outgoingResult.rows.item(0).total as number) || 0;

    // Pending outgoing (reserved)
    const pendingResult = await db.executeSql(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE from_key != '' AND status = 'pending' AND type IN ('transfer', 'marketplace_purchase')`,
      []
    );
    const pendingOutgoing = (pendingResult.rows.item(0).total as number) || 0;

    const available = roundCoin(incoming - outgoing - pendingOutgoing);
    const pending = roundCoin(pendingOutgoing);
    const total = roundCoin(incoming - outgoing);

    return {
      available,
      pending,
      total,
      lastUpdated: Date.now(),
    };
  }

  async function getTransactions(limit?: number, type?: TransactionType): Promise<Transaction[]> {
    await ensureInitialized();

    let sql = 'SELECT * FROM transactions';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY timestamp DESC';

    if (limit && limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const result = await db.executeSql(sql, params);
    const transactions: Transaction[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      transactions.push(rowToTransaction(result.rows.item(i)));
    }
    return transactions;
  }

  async function getTransaction(id: string): Promise<Transaction | undefined> {
    await ensureInitialized();

    const result = await db.executeSql(
      'SELECT * FROM transactions WHERE id = ?',
      [id]
    );
    if (result.rows.length === 0) return undefined;
    return rowToTransaction(result.rows.item(0));
  }

  async function getPendingTransactions(): Promise<Transaction[]> {
    await ensureInitialized();

    const result = await db.executeSql(
      `SELECT * FROM transactions WHERE status = 'pending' ORDER BY timestamp ASC`,
      []
    );
    const transactions: Transaction[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      transactions.push(rowToTransaction(result.rows.item(i)));
    }
    return transactions;
  }

  async function markPropagated(txId: string): Promise<void> {
    await ensureInitialized();

    // NOTE: This is the ONLY field we update — propagated is a sync status flag,
    // NOT a ledger mutation. The transaction data itself is NEVER modified.
    await db.executeSql(
      'UPDATE transactions SET propagated = 1 WHERE id = ?',
      [txId]
    );
  }

  async function getUnpropagated(): Promise<Transaction[]> {
    await ensureInitialized();

    const result = await db.executeSql(
      `SELECT * FROM transactions WHERE propagated = 0 ORDER BY timestamp ASC`,
      []
    );
    const transactions: Transaction[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      transactions.push(rowToTransaction(result.rows.item(i)));
    }
    return transactions;
  }

  async function verifyBalance(): Promise<{ valid: boolean; computed: number; stored: number }> {
    await ensureInitialized();

    // Recompute balance from all transactions
    const allResult = await db.executeSql(
      `SELECT type, amount, from_key, to_key, status FROM transactions WHERE status = 'confirmed'`,
      []
    );

    let computed = 0;
    for (let i = 0; i < allResult.rows.length; i++) {
      const row = allResult.rows.item(i);
      const type = row.type as string;
      const amount = row.amount as number;

      if (type === 'transfer' || type === 'reward' || type === 'royalty') {
        // Incoming
        if (row.to_key) {
          computed += amount;
        }
      }
      if (type === 'transfer' || type === 'marketplace_purchase') {
        // Outgoing
        if (row.from_key) {
          computed -= amount;
        }
      }
    }

    computed = roundCoin(computed);
    const balance = await getBalance();
    const stored = balance.total;

    return {
      valid: Math.abs(computed - stored) < Math.pow(10, -COIN_DECIMALS),
      computed,
      stored,
    };
  }

  return {
    recordTransaction,
    getBalance,
    getTransactions,
    getTransaction,
    getPendingTransactions,
    markPropagated,
    getUnpropagated,
    verifyBalance,
  };
}
