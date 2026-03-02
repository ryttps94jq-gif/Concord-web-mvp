// Tests for Local Ledger — append-only SQLite transaction ledger

import { createLocalLedger } from '../../economy/wallet/local-ledger';
import type { LocalLedger, SQLiteDatabase, SQLiteResultSet } from '../../economy/wallet/local-ledger';
import type { Transaction, TransactionType } from '../../utils/types';
import { COIN_DECIMALS } from '../../utils/constants';

// ── Mock SQLite Database ─────────────────────────────────────────────────────

interface MockRow {
  [key: string]: unknown;
}

function createMockDB(): SQLiteDatabase & { _store: Map<string, MockRow>; _sqlLog: string[] } {
  const store = new Map<string, MockRow>();
  const sqlLog: string[] = [];

  function makeResult(rows: MockRow[]): SQLiteResultSet {
    return {
      rows: {
        length: rows.length,
        item: (i: number) => rows[i],
        raw: () => rows.map(r => Object.values(r)),
      },
      rowsAffected: 0,
    };
  }

  const db: SQLiteDatabase & { _store: Map<string, MockRow>; _sqlLog: string[] } = {
    _store: store,
    _sqlLog: sqlLog,
    executeSql: jest.fn(async (sql: string, params?: unknown[]): Promise<SQLiteResultSet> => {
      sqlLog.push(sql.trim());

      // CREATE TABLE / CREATE INDEX — no-op
      if (sql.trim().startsWith('CREATE')) {
        return makeResult([]);
      }

      // INSERT
      if (sql.trim().startsWith('INSERT INTO transactions')) {
        if (!params || params.length < 12) return makeResult([]);
        const id = params[0] as string;
        if (store.has(id)) {
          // Idempotent: already exists
          return makeResult([]);
        }
        store.set(id, {
          id: params[0],
          type: params[1],
          amount: params[2],
          from_key: params[3],
          to_key: params[4],
          timestamp: params[5],
          nonce: params[6],
          balance_hash: params[7],
          signature: params[8],
          status: params[9],
          propagated: params[10],
          created_at: params[11],
        });
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 1 };
      }

      // SELECT by id
      if (sql.includes('WHERE id = ?')) {
        const id = params?.[0] as string;
        const row = store.get(id);
        return makeResult(row ? [row] : []);
      }

      // SELECT pending
      if (sql.includes("status = 'pending'")) {
        const rows = Array.from(store.values()).filter(r => r.status === 'pending');
        return makeResult(rows);
      }

      // SELECT unpropagated
      if (sql.includes('propagated = 0')) {
        const rows = Array.from(store.values()).filter(r => r.propagated === 0);
        return makeResult(rows);
      }

      // UPDATE propagated
      if (sql.includes('UPDATE transactions SET propagated')) {
        const id = params?.[0] as string;
        const row = store.get(id);
        if (row) {
          row.propagated = 1;
        }
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: row ? 1 : 0 };
      }

      // SUM queries for balance
      if (sql.includes('SUM(amount)') && sql.includes("status = 'confirmed'")) {
        const rows = Array.from(store.values()).filter(r => r.status === 'confirmed');
        let total = 0;

        if (sql.includes("to_key != ''") && sql.includes("('transfer', 'reward', 'royalty')")) {
          // Incoming
          for (const row of rows) {
            if (['transfer', 'reward', 'royalty'].includes(row.type as string) && row.to_key) {
              total += row.amount as number;
            }
          }
        } else if (sql.includes("from_key != ''") && sql.includes("('transfer', 'marketplace_purchase')")) {
          // Outgoing
          for (const row of rows) {
            if (['transfer', 'marketplace_purchase'].includes(row.type as string) && row.from_key) {
              total += row.amount as number;
            }
          }
        }
        return makeResult([{ total }]);
      }

      // SUM for pending outgoing
      if (sql.includes('SUM(amount)') && sql.includes("status = 'pending'")) {
        const rows = Array.from(store.values()).filter(r => r.status === 'pending');
        let total = 0;
        for (const row of rows) {
          if (['transfer', 'marketplace_purchase'].includes(row.type as string) && row.from_key) {
            total += row.amount as number;
          }
        }
        return makeResult([{ total }]);
      }

      // SELECT all (for getTransactions and verifyBalance)
      if (sql.includes('SELECT *') || (sql.includes('SELECT type, amount'))) {
        let rows = Array.from(store.values());

        // Filter by type
        if (params && sql.includes('type = ?')) {
          const typeFilter = params[0] as string;
          rows = rows.filter(r => r.type === typeFilter);
        }

        // Filter by status confirmed (for verifyBalance)
        if (sql.includes("status = 'confirmed'")) {
          rows = rows.filter(r => r.status === 'confirmed');
        }

        // Sort by timestamp DESC
        rows.sort((a, b) => (b.timestamp as number) - (a.timestamp as number));

        // Limit
        if (sql.includes('LIMIT ?')) {
          const limitIdx = params ? params.length - 1 : 0;
          const limit = params?.[limitIdx] as number;
          if (limit > 0) {
            rows = rows.slice(0, limit);
          }
        }

        return makeResult(rows);
      }

      return makeResult([]);
    }),
    transaction: jest.fn(async (fn) => {
      fn({ executeSql: () => {} });
    }),
  };

  return db;
}

// ── Test Transaction Factory ─────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_001',
    type: 'transfer' as TransactionType,
    amount: 10,
    fromKey: 'sender_pub_key',
    toKey: 'receiver_pub_key',
    timestamp: 1700000000000,
    nonce: new Uint8Array(16).fill(0x01),
    balanceHash: 'abc123hash',
    signature: new Uint8Array(64).fill(0x02),
    status: 'confirmed',
    propagated: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LocalLedger', () => {
  let db: ReturnType<typeof createMockDB>;
  let ledger: LocalLedger;

  beforeEach(() => {
    db = createMockDB();
    ledger = createLocalLedger(db);
  });

  // ── Initialization ──────────────────────────────────────────────────────

  describe('initialization', () => {
    it('creates the transactions table on first operation', async () => {
      await ledger.getBalance();
      expect(db._sqlLog.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS transactions'))).toBe(true);
    });

    it('creates indices on first operation', async () => {
      await ledger.getBalance();
      expect(db._sqlLog.some(sql => sql.includes('CREATE INDEX IF NOT EXISTS idx_transactions_status'))).toBe(true);
      expect(db._sqlLog.some(sql => sql.includes('CREATE INDEX IF NOT EXISTS idx_transactions_propagated'))).toBe(true);
    });

    it('only initializes once across multiple calls', async () => {
      await ledger.getBalance();
      await ledger.getBalance();
      const createCount = db._sqlLog.filter(sql => sql.includes('CREATE TABLE')).length;
      expect(createCount).toBe(1);
    });
  });

  // ── recordTransaction ───────────────────────────────────────────────────

  describe('recordTransaction', () => {
    it('inserts a new transaction into the database', async () => {
      const tx = makeTx();
      await ledger.recordTransaction(tx);
      expect(db._store.has('tx_001')).toBe(true);
    });

    it('serializes nonce and signature to hex', async () => {
      const tx = makeTx();
      await ledger.recordTransaction(tx);
      const stored = db._store.get('tx_001');
      expect(typeof stored?.nonce).toBe('string');
      expect(typeof stored?.signature).toBe('string');
    });

    it('is idempotent — same transaction ID recorded once', async () => {
      const tx = makeTx();
      await ledger.recordTransaction(tx);
      await ledger.recordTransaction(tx);
      // Store only has one entry
      expect(db._store.size).toBe(1);
    });

    it('records different transaction IDs separately', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_001' }));
      await ledger.recordTransaction(makeTx({ id: 'tx_002' }));
      expect(db._store.size).toBe(2);
    });

    it('stores propagated flag as integer 0 or 1', async () => {
      await ledger.recordTransaction(makeTx({ propagated: false }));
      expect(db._store.get('tx_001')?.propagated).toBe(0);
    });

    it('stores propagated=true as integer 1', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_p', propagated: true }));
      expect(db._store.get('tx_p')?.propagated).toBe(1);
    });

    it('stores the transaction status', async () => {
      await ledger.recordTransaction(makeTx({ status: 'pending' }));
      expect(db._store.get('tx_001')?.status).toBe('pending');
    });

    it('stores the timestamp', async () => {
      const ts = 1700000000000;
      await ledger.recordTransaction(makeTx({ timestamp: ts }));
      expect(db._store.get('tx_001')?.timestamp).toBe(ts);
    });
  });

  // ── Append-Only Guarantee ──────────────────────────────────────────────

  describe('append-only guarantee', () => {
    it('never issues DELETE SQL on the transactions table', async () => {
      await ledger.recordTransaction(makeTx());
      await ledger.getBalance();
      await ledger.getTransactions();
      await ledger.markPropagated('tx_001');
      const deleteQueries = db._sqlLog.filter(
        sql => sql.toUpperCase().includes('DELETE FROM TRANSACTIONS') ||
               sql.toUpperCase().includes('DELETE FROM transactions')
      );
      expect(deleteQueries.length).toBe(0);
    });

    it('only updates the propagated field, never transaction data', async () => {
      await ledger.recordTransaction(makeTx());
      await ledger.markPropagated('tx_001');
      const updateQueries = db._sqlLog.filter(sql => sql.includes('UPDATE'));
      expect(updateQueries.length).toBe(1);
      expect(updateQueries[0]).toContain('propagated');
      // No UPDATE that touches amount, from_key, to_key, etc.
      expect(updateQueries[0]).not.toContain('amount');
      expect(updateQueries[0]).not.toContain('from_key');
      expect(updateQueries[0]).not.toContain('status');
    });
  });

  // ── getBalance ──────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns zero balance when no transactions exist', async () => {
      const balance = await ledger.getBalance();
      expect(balance.available).toBe(0);
      expect(balance.pending).toBe(0);
      expect(balance.total).toBe(0);
    });

    it('computes balance from confirmed transactions', async () => {
      await ledger.recordTransaction(makeTx({
        id: 'tx_in1',
        type: 'reward',
        amount: 50,
        fromKey: '',
        toKey: 'me',
        status: 'confirmed',
      }));
      const balance = await ledger.getBalance();
      expect(balance.total).toBe(50);
    });

    it('subtracts outgoing from available', async () => {
      // First add some incoming
      await ledger.recordTransaction(makeTx({
        id: 'tx_in',
        type: 'reward',
        amount: 100,
        fromKey: '',
        toKey: 'me',
        status: 'confirmed',
      }));
      await ledger.recordTransaction(makeTx({
        id: 'tx_out',
        type: 'transfer',
        amount: 30,
        fromKey: 'me',
        toKey: 'them',
        status: 'confirmed',
      }));
      const balance = await ledger.getBalance();
      expect(balance.total).toBe(70);
    });

    it('reserves pending outgoing from available balance', async () => {
      await ledger.recordTransaction(makeTx({
        id: 'tx_in',
        type: 'reward',
        amount: 100,
        fromKey: '',
        toKey: 'me',
        status: 'confirmed',
      }));
      await ledger.recordTransaction(makeTx({
        id: 'tx_pend',
        type: 'transfer',
        amount: 25,
        fromKey: 'me',
        toKey: 'them',
        status: 'pending',
      }));
      const balance = await ledger.getBalance();
      expect(balance.pending).toBe(25);
      expect(balance.available).toBe(75);
      expect(balance.total).toBe(100);
    });

    it('includes lastUpdated timestamp', async () => {
      const before = Date.now();
      const balance = await ledger.getBalance();
      const after = Date.now();
      expect(balance.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(balance.lastUpdated).toBeLessThanOrEqual(after);
    });

    it('handles COIN_DECIMALS precision', async () => {
      await ledger.recordTransaction(makeTx({
        id: 'tx_precision',
        type: 'reward',
        amount: 0.00000001,
        fromKey: '',
        toKey: 'me',
        status: 'confirmed',
      }));
      const balance = await ledger.getBalance();
      expect(balance.total).toBeCloseTo(0.00000001, COIN_DECIMALS);
    });
  });

  // ── getTransactions ─────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('returns empty array when no transactions', async () => {
      const txs = await ledger.getTransactions();
      expect(txs).toEqual([]);
    });

    it('returns all transactions without filters', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_1' }));
      await ledger.recordTransaction(makeTx({ id: 'tx_2' }));
      const txs = await ledger.getTransactions();
      expect(txs.length).toBe(2);
    });

    it('respects limit parameter', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_1' }));
      await ledger.recordTransaction(makeTx({ id: 'tx_2' }));
      await ledger.recordTransaction(makeTx({ id: 'tx_3' }));
      const txs = await ledger.getTransactions(2);
      expect(txs.length).toBe(2);
    });

    it('filters by transaction type', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_t', type: 'transfer' }));
      await ledger.recordTransaction(makeTx({ id: 'tx_r', type: 'reward' }));
      const txs = await ledger.getTransactions(undefined, 'transfer');
      expect(txs.length).toBe(1);
      expect(txs[0].type).toBe('transfer');
    });

    it('deserializes nonce back to Uint8Array', async () => {
      await ledger.recordTransaction(makeTx());
      const txs = await ledger.getTransactions();
      expect(txs[0].nonce).toBeInstanceOf(Uint8Array);
    });

    it('deserializes signature back to Uint8Array', async () => {
      await ledger.recordTransaction(makeTx());
      const txs = await ledger.getTransactions();
      expect(txs[0].signature).toBeInstanceOf(Uint8Array);
    });
  });

  // ── getTransaction ──────────────────────────────────────────────────────

  describe('getTransaction', () => {
    it('returns undefined for non-existent transaction', async () => {
      const tx = await ledger.getTransaction('nonexistent');
      expect(tx).toBeUndefined();
    });

    it('returns the transaction by ID', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_find' }));
      const tx = await ledger.getTransaction('tx_find');
      expect(tx).toBeDefined();
      expect(tx!.id).toBe('tx_find');
    });

    it('returns correct amount', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_amt', amount: 42.5 }));
      const tx = await ledger.getTransaction('tx_amt');
      expect(tx!.amount).toBe(42.5);
    });
  });

  // ── getPendingTransactions ──────────────────────────────────────────────

  describe('getPendingTransactions', () => {
    it('returns only pending transactions', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_c', status: 'confirmed' }));
      await ledger.recordTransaction(makeTx({ id: 'tx_p', status: 'pending' }));
      const pending = await ledger.getPendingTransactions();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('tx_p');
    });

    it('returns empty array when no pending', async () => {
      await ledger.recordTransaction(makeTx({ status: 'confirmed' }));
      const pending = await ledger.getPendingTransactions();
      expect(pending.length).toBe(0);
    });
  });

  // ── markPropagated / getUnpropagated ────────────────────────────────────

  describe('markPropagated and getUnpropagated', () => {
    it('marks a transaction as propagated', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_prop', propagated: false }));
      await ledger.markPropagated('tx_prop');
      expect(db._store.get('tx_prop')?.propagated).toBe(1);
    });

    it('getUnpropagated returns only unpropagated transactions', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_u1', propagated: false }));
      await ledger.recordTransaction(makeTx({ id: 'tx_u2', propagated: false }));
      const unprop = await ledger.getUnpropagated();
      expect(unprop.length).toBe(2);
    });

    it('getUnpropagated excludes propagated transactions', async () => {
      await ledger.recordTransaction(makeTx({ id: 'tx_np', propagated: false }));
      await ledger.markPropagated('tx_np');
      const unprop = await ledger.getUnpropagated();
      expect(unprop.length).toBe(0);
    });

    it('does not crash when marking non-existent transaction', async () => {
      await expect(ledger.markPropagated('ghost')).resolves.not.toThrow();
    });
  });

  // ── verifyBalance ───────────────────────────────────────────────────────

  describe('verifyBalance', () => {
    it('reports valid when computed matches stored', async () => {
      await ledger.recordTransaction(makeTx({
        id: 'tx_v1',
        type: 'reward',
        amount: 100,
        fromKey: '',
        toKey: 'me',
        status: 'confirmed',
      }));
      const result = await ledger.verifyBalance();
      expect(result.valid).toBe(true);
      expect(result.computed).toBe(result.stored);
    });

    it('reports valid for empty ledger', async () => {
      const result = await ledger.verifyBalance();
      expect(result.valid).toBe(true);
      expect(result.computed).toBe(0);
      expect(result.stored).toBe(0);
    });

    it('computes balance as incoming minus outgoing', async () => {
      await ledger.recordTransaction(makeTx({
        id: 'tx_in',
        type: 'reward',
        amount: 200,
        fromKey: '',
        toKey: 'me',
        status: 'confirmed',
      }));
      await ledger.recordTransaction(makeTx({
        id: 'tx_out',
        type: 'transfer',
        amount: 50,
        fromKey: 'me',
        toKey: 'them',
        status: 'confirmed',
      }));
      const result = await ledger.verifyBalance();
      expect(result.valid).toBe(true);
      expect(result.computed).toBe(150);
    });
  });
});
