// Concord Mobile — Local Marketplace Cache
// Browsable offline cache of marketplace listings.
// Listings cached from server, purchases via PeerTransfer.

import type {
  MarketplaceListing,
} from '../../utils/types';
import type { SQLiteDatabase, SQLiteResultSet } from '../wallet/local-ledger';
import type { PeerTransfer } from '../coin/peer-transfer';

// ── Local Marketplace Interface ──────────────────────────────────────────────

export interface LocalMarketplace {
  cacheListings(listings: MarketplaceListing[]): Promise<void>;
  getListings(options?: ListingFilterOptions): Promise<MarketplaceListing[]>;
  getListing(id: string): Promise<MarketplaceListing | undefined>;
  purchase(listingId: string, transfer: PeerTransfer): Promise<{ success: boolean; txId?: string; error?: string }>;
  getListingCount(): Promise<number>;
  clearCache(): Promise<void>;
}

export interface ListingFilterOptions {
  category?: string;
  maxPrice?: number;
  tags?: string[];
}

// ── Schema ───────────────────────────────────────────────────────────────────

const CREATE_LISTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS marketplace_listings (
    id TEXT PRIMARY KEY,
    dtu_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    creator_key TEXT NOT NULL,
    category TEXT NOT NULL,
    tags TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    cached_at INTEGER NOT NULL
  )
`;

const CREATE_LISTINGS_INDICES = `
  CREATE INDEX IF NOT EXISTS idx_listings_category ON marketplace_listings(category);
  CREATE INDEX IF NOT EXISTS idx_listings_price ON marketplace_listings(price);
  CREATE INDEX IF NOT EXISTS idx_listings_active ON marketplace_listings(active);
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function rowToListing(row: Record<string, unknown>): MarketplaceListing {
  return {
    id: row.id as string,
    dtuId: row.dtu_id as string,
    title: row.title as string,
    description: row.description as string,
    price: row.price as number,
    creatorKey: row.creator_key as string,
    category: row.category as string,
    tags: JSON.parse(row.tags as string),
    createdAt: row.created_at as number,
    active: (row.active as number) === 1,
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createLocalMarketplace(db: SQLiteDatabase): LocalMarketplace {
  let initialized = false;

  async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    await db.executeSql(CREATE_LISTINGS_TABLE);
    const indexStatements = CREATE_LISTINGS_INDICES.trim().split(';').filter(s => s.trim());
    for (const stmt of indexStatements) {
      await db.executeSql(stmt.trim());
    }
    initialized = true;
  }

  async function cacheListings(listings: MarketplaceListing[]): Promise<void> {
    await ensureInitialized();

    const now = Date.now();
    for (const listing of listings) {
      // Upsert: replace if exists (this is cache, not ledger)
      await db.executeSql(
        `INSERT OR REPLACE INTO marketplace_listings
         (id, dtu_id, title, description, price, creator_key, category, tags, created_at, active, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          listing.id,
          listing.dtuId,
          listing.title,
          listing.description,
          listing.price,
          listing.creatorKey,
          listing.category,
          JSON.stringify(listing.tags),
          listing.createdAt,
          listing.active ? 1 : 0,
          now,
        ]
      );
    }
  }

  async function getListings(options?: ListingFilterOptions): Promise<MarketplaceListing[]> {
    await ensureInitialized();

    let sql = 'SELECT * FROM marketplace_listings WHERE active = 1';
    const params: unknown[] = [];

    if (options?.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    if (options?.maxPrice !== undefined) {
      sql += ' AND price <= ?';
      params.push(options.maxPrice);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.executeSql(sql, params);
    let listings: MarketplaceListing[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      listings.push(rowToListing(result.rows.item(i)));
    }

    // Filter by tags in application layer (SQLite JSON queries are limited)
    if (options?.tags && options.tags.length > 0) {
      listings = listings.filter(listing =>
        options.tags!.some(tag => listing.tags.includes(tag))
      );
    }

    return listings;
  }

  async function getListing(id: string): Promise<MarketplaceListing | undefined> {
    await ensureInitialized();

    const result = await db.executeSql(
      'SELECT * FROM marketplace_listings WHERE id = ?',
      [id]
    );
    if (result.rows.length === 0) return undefined;
    return rowToListing(result.rows.item(0));
  }

  async function purchase(
    listingId: string,
    transfer: PeerTransfer
  ): Promise<{ success: boolean; txId?: string; error?: string }> {
    await ensureInitialized();

    // Find the listing
    const listing = await getListing(listingId);
    if (!listing) {
      return { success: false, error: 'Listing not found' };
    }
    if (!listing.active) {
      return { success: false, error: 'Listing is no longer active' };
    }

    try {
      // Create transfer to listing creator
      const tx = await transfer.createTransfer(listing.creatorKey, listing.price);

      // Mark listing as purchased locally (deactivate)
      await db.executeSql(
        'UPDATE marketplace_listings SET active = 0 WHERE id = ?',
        [listingId]
      );

      return { success: true, txId: tx.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  async function getListingCount(): Promise<number> {
    await ensureInitialized();

    const result = await db.executeSql(
      'SELECT COUNT(*) as count FROM marketplace_listings WHERE active = 1',
      []
    );
    return (result.rows.item(0).count as number) || 0;
  }

  async function clearCache(): Promise<void> {
    await ensureInitialized();
    await db.executeSql('DELETE FROM marketplace_listings', []);
  }

  return {
    cacheListings,
    getListings,
    getListing,
    purchase,
    getListingCount,
    clearCache,
  };
}
