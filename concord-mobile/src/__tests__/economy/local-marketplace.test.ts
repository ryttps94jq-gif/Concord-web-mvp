// Tests for Local Marketplace — offline browsable marketplace cache

import { createLocalMarketplace } from '../../economy/marketplace/local-marketplace';
import type { LocalMarketplace } from '../../economy/marketplace/local-marketplace';
import type { SQLiteDatabase, SQLiteResultSet } from '../../economy/wallet/local-ledger';
import type { PeerTransfer } from '../../economy/coin/peer-transfer';
import type { MarketplaceListing, Transaction } from '../../utils/types';

// ── Mock SQLite Database ─────────────────────────────────────────────────────

interface MockRow {
  [key: string]: unknown;
}

function createMockDB(): SQLiteDatabase & { _store: Map<string, MockRow> } {
  const store = new Map<string, MockRow>();

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

  return {
    _store: store,
    executeSql: jest.fn(async (sql: string, params?: unknown[]): Promise<SQLiteResultSet> => {
      // CREATE TABLE / CREATE INDEX
      if (sql.trim().startsWith('CREATE')) {
        return makeResult([]);
      }

      // INSERT OR REPLACE
      if (sql.trim().startsWith('INSERT OR REPLACE')) {
        if (!params || params.length < 11) return makeResult([]);
        const id = params[0] as string;
        store.set(id, {
          id: params[0],
          dtu_id: params[1],
          title: params[2],
          description: params[3],
          price: params[4],
          creator_key: params[5],
          category: params[6],
          tags: params[7],
          created_at: params[8],
          active: params[9],
          cached_at: params[10],
        });
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 1 };
      }

      // UPDATE active = 0 (must come before SELECT by ID since both match 'WHERE id = ?')
      if (sql.includes('UPDATE marketplace_listings SET active = 0')) {
        const id = params?.[0] as string;
        const row = store.get(id);
        if (row) {
          row.active = 0;
        }
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: row ? 1 : 0 };
      }

      // SELECT by ID
      if (sql.includes('WHERE id = ?')) {
        const id = params?.[0] as string;
        const row = store.get(id);
        return makeResult(row ? [row] : []);
      }

      // DELETE
      if (sql.includes('DELETE FROM marketplace_listings')) {
        store.clear();
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: store.size };
      }

      // COUNT
      if (sql.includes('COUNT(*)')) {
        const active = Array.from(store.values()).filter(r => r.active === 1);
        return makeResult([{ count: active.length }]);
      }

      // SELECT with filters
      if (sql.includes('SELECT *') && sql.includes('active = 1')) {
        let rows = Array.from(store.values()).filter(r => r.active === 1);

        // Filter by category
        if (sql.includes('category = ?')) {
          const category = params?.[0] as string;
          rows = rows.filter(r => r.category === category);
        }

        // Filter by price
        if (sql.includes('price <= ?')) {
          const priceIdx = sql.includes('category = ?') ? 1 : 0;
          const maxPrice = params?.[priceIdx] as number;
          rows = rows.filter(r => (r.price as number) <= maxPrice);
        }

        // Sort by created_at DESC
        rows.sort((a, b) => (b.created_at as number) - (a.created_at as number));

        return makeResult(rows);
      }

      return makeResult([]);
    }),
    transaction: jest.fn(async (fn) => {
      fn({ executeSql: () => {} });
    }),
  };
}

// ── Mock PeerTransfer ────────────────────────────────────────────────────────

function createMockTransfer(shouldSucceed: boolean = true): PeerTransfer {
  return {
    createTransfer: jest.fn(async (toKey: string, amount: number): Promise<Transaction> => {
      if (!shouldSucceed) {
        throw new Error('Insufficient funds');
      }
      return {
        id: 'tx_purchase_001',
        type: 'marketplace_purchase',
        amount,
        fromKey: 'buyer_key',
        toKey,
        timestamp: Date.now(),
        nonce: new Uint8Array(16),
        balanceHash: 'hash',
        signature: new Uint8Array(64),
        status: 'pending',
        propagated: false,
      };
    }),
    receiveTransfer: jest.fn(async () => ({ accepted: true })),
    validateTransfer: jest.fn(() => ({ valid: true, errors: [] })),
    checkDoubleSpend: jest.fn(async () => false),
  };
}

// ── Test Listing Factory ─────────────────────────────────────────────────────

function makeListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 'listing_001',
    dtuId: 'dtu_001',
    title: 'Test Listing',
    description: 'A test marketplace listing',
    price: 10,
    creatorKey: 'creator_pub_key',
    category: 'digital',
    tags: ['test', 'sample'],
    createdAt: 1700000000000,
    active: true,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LocalMarketplace', () => {
  let db: ReturnType<typeof createMockDB>;
  let marketplace: LocalMarketplace;

  beforeEach(() => {
    db = createMockDB();
    marketplace = createLocalMarketplace(db);
  });

  // ── cacheListings ───────────────────────────────────────────────────────

  describe('cacheListings', () => {
    it('caches a single listing', async () => {
      await marketplace.cacheListings([makeListing()]);
      expect(db._store.size).toBe(1);
    });

    it('caches multiple listings', async () => {
      await marketplace.cacheListings([
        makeListing({ id: 'l1' }),
        makeListing({ id: 'l2' }),
        makeListing({ id: 'l3' }),
      ]);
      expect(db._store.size).toBe(3);
    });

    it('replaces existing listing with same ID (upsert)', async () => {
      await marketplace.cacheListings([makeListing({ id: 'l1', price: 10 })]);
      await marketplace.cacheListings([makeListing({ id: 'l1', price: 20 })]);
      expect(db._store.size).toBe(1);
      expect(db._store.get('l1')?.price).toBe(20);
    });

    it('serializes tags as JSON', async () => {
      await marketplace.cacheListings([makeListing({ tags: ['art', 'music'] })]);
      const stored = db._store.get('listing_001');
      expect(stored?.tags).toBe('["art","music"]');
    });

    it('stores active as integer 1', async () => {
      await marketplace.cacheListings([makeListing({ active: true })]);
      expect(db._store.get('listing_001')?.active).toBe(1);
    });

    it('stores inactive as integer 0', async () => {
      await marketplace.cacheListings([makeListing({ active: false })]);
      expect(db._store.get('listing_001')?.active).toBe(0);
    });

    it('handles empty listings array', async () => {
      await marketplace.cacheListings([]);
      expect(db._store.size).toBe(0);
    });
  });

  // ── getListings ─────────────────────────────────────────────────────────

  describe('getListings (offline browsing)', () => {
    beforeEach(async () => {
      await marketplace.cacheListings([
        makeListing({ id: 'l1', category: 'digital', price: 5, tags: ['art'] }),
        makeListing({ id: 'l2', category: 'digital', price: 15, tags: ['music'] }),
        makeListing({ id: 'l3', category: 'physical', price: 25, tags: ['art', 'craft'] }),
        makeListing({ id: 'l4', category: 'digital', price: 50, active: false }),
      ]);
    });

    it('returns all active listings without filters', async () => {
      const listings = await marketplace.getListings();
      expect(listings.length).toBe(3); // l4 is inactive
    });

    it('filters by category', async () => {
      const listings = await marketplace.getListings({ category: 'digital' });
      expect(listings.length).toBe(2);
      expect(listings.every(l => l.category === 'digital')).toBe(true);
    });

    it('filters by max price', async () => {
      const listings = await marketplace.getListings({ maxPrice: 10 });
      expect(listings.every(l => l.price <= 10)).toBe(true);
    });

    it('filters by tags', async () => {
      const listings = await marketplace.getListings({ tags: ['art'] });
      expect(listings.length).toBe(2); // l1 and l3
      expect(listings.every(l => l.tags.includes('art'))).toBe(true);
    });

    it('combines category and price filters', async () => {
      const listings = await marketplace.getListings({
        category: 'digital',
        maxPrice: 10,
      });
      expect(listings.length).toBe(1);
      expect(listings[0].id).toBe('l1');
    });

    it('excludes inactive listings', async () => {
      const listings = await marketplace.getListings();
      expect(listings.find(l => l.id === 'l4')).toBeUndefined();
    });

    it('deserializes tags from JSON', async () => {
      const listings = await marketplace.getListings();
      expect(Array.isArray(listings[0].tags)).toBe(true);
    });

    it('returns empty array when no listings match', async () => {
      const listings = await marketplace.getListings({ category: 'nonexistent' });
      expect(listings).toEqual([]);
    });
  });

  // ── getListing ──────────────────────────────────────────────────────────

  describe('getListing', () => {
    it('returns a specific listing by ID', async () => {
      await marketplace.cacheListings([makeListing({ id: 'find_me' })]);
      const listing = await marketplace.getListing('find_me');
      expect(listing).toBeDefined();
      expect(listing!.id).toBe('find_me');
    });

    it('returns undefined for non-existent ID', async () => {
      const listing = await marketplace.getListing('ghost');
      expect(listing).toBeUndefined();
    });

    it('returns correct price', async () => {
      await marketplace.cacheListings([makeListing({ id: 'priced', price: 42.5 })]);
      const listing = await marketplace.getListing('priced');
      expect(listing!.price).toBe(42.5);
    });
  });

  // ── purchase ────────────────────────────────────────────────────────────

  describe('purchase', () => {
    it('completes purchase successfully', async () => {
      await marketplace.cacheListings([makeListing({ id: 'buy_me', price: 10 })]);
      const mockTransfer = createMockTransfer(true);
      const result = await marketplace.purchase('buy_me', mockTransfer);
      expect(result.success).toBe(true);
      expect(result.txId).toBe('tx_purchase_001');
    });

    it('creates transfer to listing creator', async () => {
      await marketplace.cacheListings([
        makeListing({ id: 'buy_me', price: 25, creatorKey: 'creator_123' }),
      ]);
      const mockTransfer = createMockTransfer(true);
      await marketplace.purchase('buy_me', mockTransfer);
      expect(mockTransfer.createTransfer).toHaveBeenCalledWith('creator_123', 25);
    });

    it('deactivates listing after purchase', async () => {
      await marketplace.cacheListings([makeListing({ id: 'buy_me' })]);
      const mockTransfer = createMockTransfer(true);
      await marketplace.purchase('buy_me', mockTransfer);
      // Listing should now be inactive
      expect(db._store.get('buy_me')?.active).toBe(0);
    });

    it('fails when listing not found', async () => {
      const mockTransfer = createMockTransfer(true);
      const result = await marketplace.purchase('ghost', mockTransfer);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('fails when listing is inactive', async () => {
      await marketplace.cacheListings([makeListing({ id: 'inactive', active: false })]);
      const mockTransfer = createMockTransfer(true);
      const result = await marketplace.purchase('inactive', mockTransfer);
      expect(result.success).toBe(false);
      expect(result.error).toContain('no longer active');
    });

    it('fails when transfer fails (insufficient funds)', async () => {
      await marketplace.cacheListings([makeListing({ id: 'expensive' })]);
      const mockTransfer = createMockTransfer(false);
      const result = await marketplace.purchase('expensive', mockTransfer);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient funds');
    });

    it('returns error message on failure', async () => {
      await marketplace.cacheListings([makeListing({ id: 'fail' })]);
      const mockTransfer = createMockTransfer(false);
      const result = await marketplace.purchase('fail', mockTransfer);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  // ── getListingCount ─────────────────────────────────────────────────────

  describe('getListingCount', () => {
    it('returns 0 for empty marketplace', async () => {
      const count = await marketplace.getListingCount();
      expect(count).toBe(0);
    });

    it('returns count of active listings only', async () => {
      await marketplace.cacheListings([
        makeListing({ id: 'l1', active: true }),
        makeListing({ id: 'l2', active: true }),
        makeListing({ id: 'l3', active: false }),
      ]);
      const count = await marketplace.getListingCount();
      expect(count).toBe(2);
    });
  });

  // ── clearCache ──────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('removes all listings', async () => {
      await marketplace.cacheListings([
        makeListing({ id: 'l1' }),
        makeListing({ id: 'l2' }),
      ]);
      await marketplace.clearCache();
      expect(db._store.size).toBe(0);
    });

    it('count returns 0 after clear', async () => {
      await marketplace.cacheListings([makeListing()]);
      await marketplace.clearCache();
      const count = await marketplace.getListingCount();
      expect(count).toBe(0);
    });
  });
});
