// Integration test: Wallet -> peer transfer -> marketplace via mesh
// Verifies that the economy module (ledger, peer transfer, marketplace)
// works end-to-end with DTU creation and mesh store tracking.

import { createPeerTransfer, IdentityManager } from '../../economy/coin/peer-transfer';
import { createLocalLedger, SQLiteDatabase, SQLiteResultSet } from '../../economy/wallet/local-ledger';
import { createLocalMarketplace } from '../../economy/marketplace/local-marketplace';
import { createTransactionDTU } from '../../dtu/creation/dtu-forge';
import { useEconomyStore } from '../../store/economy-store';
import { setCryptoProvider } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import type { Transaction, MarketplaceListing } from '../../utils/types';
import { TRANSACTION_NONCE_BYTES } from '../../utils/constants';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockCrypto: CryptoProvider = {
  sha256: jest.fn(async (d: Uint8Array) => new Uint8Array(32).fill(d.reduce((a, b) => a ^ b, 0))),
  hmacSha256: jest.fn(async () => new Uint8Array(32)),
  crc32: jest.fn(() => 0),
  randomBytes: jest.fn((s) => new Uint8Array(s).fill(0x42)),
  ed25519GenerateKeypair: jest.fn(async () => ({ publicKey: new Uint8Array(32).fill(1), privateKey: new Uint8Array(64).fill(2) })),
  ed25519Sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
  ed25519Verify: jest.fn(async () => true),
};

function createMockSQLite(): SQLiteDatabase {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const emptyResult = { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 0 };

  return {
    executeSql: jest.fn(async (sql: string, params?: unknown[]): Promise<SQLiteResultSet> => {
      const up = sql.trim().toUpperCase();
      if (up.startsWith('CREATE')) return emptyResult;

      if (up.startsWith('INSERT')) {
        const t = sql.match(/INTO\s+(\w+)/i)?.[1] ?? 'default';
        if (!tables[t]) tables[t] = [];
        const id = params?.[0] as string;
        const idx = tables[t].findIndex(r => r.id === id);
        const row: Record<string, unknown> = { id };
        if (t === 'transactions' && params) {
          Object.assign(row, { type: params[1], amount: params[2], from_key: params[3],
            to_key: params[4], timestamp: params[5], nonce: params[6], balance_hash: params[7],
            signature: params[8], status: params[9], propagated: params[10] });
        }
        if (t === 'marketplace_listings' && params) {
          Object.assign(row, { dtu_id: params[1], title: params[2], description: params[3],
            price: params[4], creator_key: params[5], category: params[6], tags: params[7],
            created_at: params[8], active: params[9] });
        }
        if (idx >= 0) { tables[t][idx] = row; } else { tables[t].push(row); }
        return { ...emptyResult, rowsAffected: 1 };
      }

      if (up.startsWith('SELECT')) {
        const t = sql.match(/FROM\s+(\w+)/i)?.[1] ?? 'default';
        const data = tables[t] ?? [];
        if (up.includes('SUM(AMOUNT)')) {
          const txs = tables['transactions'] ?? [];
          let total = 0;
          for (const tx of txs) {
            if (sql.includes('to_key') && sql.includes("'transfer', 'reward', 'royalty'")) {
              if (tx.to_key && ['transfer', 'reward', 'royalty'].includes(tx.type as string) && tx.status === 'confirmed')
                total += tx.amount as number;
            } else if (sql.includes('from_key') && sql.includes("status = 'pending'")) {
              if (tx.from_key && tx.status === 'pending') total += tx.amount as number;
            } else if (sql.includes('from_key')) {
              if (tx.from_key && tx.status === 'confirmed') total += tx.amount as number;
            }
          }
          return { rows: { length: 1, item: () => ({ total }), raw: () => [] }, rowsAffected: 0 };
        }
        if (up.includes('COUNT(*)')) {
          const filtered = data.filter(r => !sql.includes('active = 1') || r.active === 1);
          return { rows: { length: 1, item: () => ({ count: filtered.length }), raw: () => [] }, rowsAffected: 0 };
        }
        let filtered = [...data];
        if (sql.includes('WHERE id = ?') && params?.[0]) filtered = data.filter(r => r.id === params[0]);
        if (sql.includes('active = 1')) filtered = data.filter(r => r.active === 1);
        return { rows: { length: filtered.length, item: (i: number) => filtered[i], raw: () => [] }, rowsAffected: 0 };
      }

      if (up.startsWith('UPDATE')) {
        const t = sql.match(/UPDATE\s+(\w+)/i)?.[1] ?? 'default';
        const d = tables[t] ?? [];
        if (sql.includes('active = 0') && params?.[0]) { const r = d.find(x => x.id === params![0]); if (r) r.active = 0; }
        if (sql.includes('propagated = 1') && params?.[0]) { const r = d.find(x => x.id === params![0]); if (r) r.propagated = 1; }
        return { ...emptyResult, rowsAffected: 1 };
      }

      if (up.startsWith('DELETE')) { const t = sql.match(/FROM\s+(\w+)/i)?.[1] ?? 'default'; tables[t] = []; }
      return emptyResult;
    }),
    transaction: jest.fn(async (fn) => { fn({ executeSql: jest.fn() }); }),
  };
}

function createMockIdentity(publicKey: string): IdentityManager {
  return {
    getPublicKey: () => publicKey,
    sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
    verify: jest.fn(async () => true),
  };
}

function makeReward(toKey: string, amount: number): Transaction {
  return {
    id: `tx_reward_${Date.now()}`, type: 'reward', amount, fromKey: '', toKey,
    timestamp: Date.now(), nonce: new Uint8Array(TRANSACTION_NONCE_BYTES),
    balanceHash: 'hash', signature: new Uint8Array(64).fill(1), status: 'confirmed', propagated: true,
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => { setCryptoProvider(mockCrypto); });
beforeEach(() => { jest.clearAllMocks(); useEconomyStore.getState().reset(); });

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Wallet -> Peer Transfer -> Marketplace via Mesh flow', () => {
  it('creates a transfer, records it in the ledger, and wraps it as a DTU', async () => {
    const db = createMockSQLite();
    const ledger = createLocalLedger(db);
    const transfer = createPeerTransfer(createMockIdentity('pk_alice'), ledger);
    await ledger.recordTransaction(makeReward('pk_alice', 50));

    const tx = await transfer.createTransfer('pk_bob', 10);
    expect(tx.id).toMatch(/^tx_/);
    expect(tx.amount).toBe(10);
    expect(tx.fromKey).toBe('pk_alice');
    expect(tx.status).toBe('pending');

    const dtu = await createTransactionDTU(tx);
    expect(dtu.header.type).toBe(0x0006);
    expect(dtu.meta.creatorKey).toBe('pk_alice');
    expect(dtu.tags).toContain('economy');
  });

  it('validates transfer and rejects self-transfer', async () => {
    const db = createMockSQLite();
    const ledger = createLocalLedger(db);
    const transfer = createPeerTransfer(createMockIdentity('pk_alice'), ledger);
    await ledger.recordTransaction(makeReward('pk_alice', 100));

    await expect(transfer.createTransfer('pk_alice', 5)).rejects.toThrow('Cannot transfer to self');
  });

  it('validates transfer amount constraints', () => {
    const transfer = createPeerTransfer(createMockIdentity('pk_alice'), createLocalLedger(createMockSQLite()));
    const validTx: Transaction = {
      id: 'tx_test', type: 'transfer', amount: 10, fromKey: 'pk_alice', toKey: 'pk_bob',
      timestamp: Date.now(), nonce: new Uint8Array(TRANSACTION_NONCE_BYTES),
      balanceHash: 'hash_123', signature: new Uint8Array(64).fill(0x55),
      status: 'pending', propagated: false,
    };
    expect(transfer.validateTransfer(validTx).valid).toBe(true);
  });

  it('marketplace caches and retrieves listings', async () => {
    const marketplace = createLocalMarketplace(createMockSQLite());
    const listing: MarketplaceListing = {
      id: 'listing_art_1', dtuId: 'dtu_art_1', title: 'Digital Artwork',
      description: 'A painting', price: 25, creatorKey: 'pk_artist', category: 'art',
      tags: ['art'], createdAt: Date.now(), active: true,
    };
    await marketplace.cacheListings([listing]);

    const retrieved = await marketplace.getListing('listing_art_1');
    expect(retrieved?.title).toBe('Digital Artwork');
    expect(retrieved?.price).toBe(25);
  });

  it('tracks transactions in economy store for UI state', () => {
    const tx: Transaction = {
      id: 'tx_store_1', type: 'transfer', amount: 15, fromKey: 'pk_alice', toKey: 'pk_bob',
      timestamp: Date.now(), nonce: new Uint8Array(TRANSACTION_NONCE_BYTES),
      balanceHash: 'hash_abc', signature: new Uint8Array(64).fill(0x55),
      status: 'pending', propagated: false,
    };

    useEconomyStore.getState().addTransaction(tx);
    expect(useEconomyStore.getState().transactions).toHaveLength(1);
    expect(useEconomyStore.getState().pendingTransactions).toHaveLength(1);

    useEconomyStore.getState().markPropagated('tx_store_1');
    expect(useEconomyStore.getState().transactions[0].propagated).toBe(true);
    expect(useEconomyStore.getState().pendingTransactions).toHaveLength(0);
  });

  it('caches marketplace listings in economy store', () => {
    const listings: MarketplaceListing[] = [
      { id: 'l1', dtuId: 'd1', title: 'Song', description: 'A song', price: 5,
        creatorKey: 'pk_m', category: 'music', tags: ['music'], createdAt: Date.now(), active: true },
      { id: 'l2', dtuId: 'd2', title: 'Article', description: 'An article', price: 2,
        creatorKey: 'pk_w', category: 'writing', tags: ['writing'], createdAt: Date.now(), active: true },
    ];
    useEconomyStore.getState().cacheListings(listings);
    expect(useEconomyStore.getState().listingCount).toBe(2);
    expect(useEconomyStore.getState().getListingsByCategory('music')).toHaveLength(1);
  });

  it('rejects transfer with invalid structure', () => {
    const transfer = createPeerTransfer(createMockIdentity('pk_alice'), createLocalLedger(createMockSQLite()));
    const invalid = {
      id: '', type: 'invalid_type' as any, amount: -5, fromKey: '', toKey: '',
      timestamp: -1, nonce: new Uint8Array(0), balanceHash: '', signature: new Uint8Array(0),
      status: 'pending' as const, propagated: false,
    };
    const result = transfer.validateTransfer(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
