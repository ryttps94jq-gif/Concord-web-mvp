// Concord Mobile — DTU Store
// SQLite-backed DTU store with write-through Map cache.
// SQLite is source of truth; Map is a fast read cache.

import {
  DEFAULT_DTU_TTL,
} from '../../utils/constants';
import type {
  DTU,
  DTUHeader,
  DTULineage,
  DTUMeta,
  DTUTypeCode,
  DTUStoreRow,
  DTUSearchResult,
  DTUStoreStats,
} from '../../utils/types';
import { toBase64, fromBase64, toHex, fromHex } from '../../utils/crypto';

// ── SQLite database interface ────────────────────────────────────────────────

export interface SQLiteDatabase {
  executeSql(
    sql: string,
    params?: any[]
  ): Promise<{ rows: { length: number; item(index: number): any } }>;
}

// ── DTU Store interface ──────────────────────────────────────────────────────

export interface DTUStore {
  get(id: string): DTU | undefined;
  set(id: string, dtu: DTU): void;
  has(id: string): boolean;
  delete(id: string): boolean;
  readonly size: number;
  search(query: string, limit?: number): DTUSearchResult[];
  getByType(type: DTUTypeCode): DTU[];
  getByTags(tags: string[]): DTU[];
  getStats(): DTUStoreStats;
  prune(options: { maxAgeDays: number; protectPainTagged: boolean }): number;
  clear(): void;
}

// ── Serialization helpers ────────────────────────────────────────────────────

function dtuToRow(dtu: DTU): DTUStoreRow {
  return {
    id: dtu.id,
    version: dtu.header.version,
    flags: dtu.header.flags,
    type: dtu.header.type,
    timestamp: dtu.header.timestamp,
    content_length: dtu.header.contentLength,
    content_hash: toHex(dtu.header.contentHash),
    content: toBase64(dtu.content),
    signature: dtu.signature ? toHex(dtu.signature) : null,
    parent_id: dtu.lineage?.parentId ?? null,
    tags: JSON.stringify(dtu.tags),
    scope: dtu.meta.scope,
    published: dtu.meta.published ? 1 : 0,
    pain_tagged: dtu.meta.painTagged ? 1 : 0,
    crpi_score: dtu.meta.crpiScore,
    relay_count: dtu.meta.relayCount,
    ttl: dtu.meta.ttl,
    creator_key: dtu.meta.creatorKey ?? null,
    geo_lat: dtu.meta.geoGrid?.lat ?? null,
    geo_lon: dtu.meta.geoGrid?.lon ?? null,
    received_at: dtu.meta.receivedAt ?? null,
    created_at: dtu.header.timestamp,
  };
}

function rowToDTU(row: DTUStoreRow): DTU {
  const header: DTUHeader = {
    version: row.version,
    flags: row.flags,
    type: row.type as DTUTypeCode,
    timestamp: row.timestamp,
    contentLength: row.content_length,
    contentHash: fromHex(row.content_hash),
  };

  const meta: DTUMeta = {
    creatorKey: row.creator_key ?? undefined,
    scope: row.scope as DTUMeta['scope'],
    published: row.published === 1,
    painTagged: row.pain_tagged === 1,
    crpiScore: row.crpi_score,
    relayCount: row.relay_count,
    ttl: row.ttl,
    receivedAt: row.received_at ?? undefined,
    geoGrid:
      row.geo_lat != null && row.geo_lon != null
        ? { lat: row.geo_lat, lon: row.geo_lon }
        : undefined,
  };

  const lineage: DTULineage = {
    parentId: row.parent_id,
    ancestors: row.parent_id ? [row.parent_id] : [],
    depth: row.parent_id ? 1 : 0,
  };

  let tags: string[];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }

  const dtu: DTU = {
    id: row.id,
    header,
    content: fromBase64(row.content),
    signature: row.signature ? fromHex(row.signature) : undefined,
    lineage,
    tags,
    meta,
  };

  return dtu;
}

// ── SQL statements ───────────────────────────────────────────────────────────

const SQL_CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS dtus (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    flags INTEGER NOT NULL,
    type INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    content_length INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    signature TEXT,
    parent_id TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    scope TEXT NOT NULL DEFAULT 'local',
    published INTEGER NOT NULL DEFAULT 0,
    pain_tagged INTEGER NOT NULL DEFAULT 0,
    crpi_score REAL NOT NULL DEFAULT 0,
    relay_count INTEGER NOT NULL DEFAULT 0,
    ttl INTEGER NOT NULL DEFAULT ${DEFAULT_DTU_TTL},
    creator_key TEXT,
    geo_lat REAL,
    geo_lon REAL,
    received_at INTEGER,
    created_at INTEGER NOT NULL
  )
`;

const SQL_CREATE_INDEX_TYPE = `
  CREATE INDEX IF NOT EXISTS idx_dtus_type ON dtus(type)
`;

const SQL_CREATE_INDEX_TIMESTAMP = `
  CREATE INDEX IF NOT EXISTS idx_dtus_timestamp ON dtus(timestamp)
`;

const SQL_CREATE_INDEX_PAIN = `
  CREATE INDEX IF NOT EXISTS idx_dtus_pain_tagged ON dtus(pain_tagged)
`;

const SQL_INSERT = `
  INSERT OR REPLACE INTO dtus (
    id, version, flags, type, timestamp, content_length, content_hash,
    content, signature, parent_id, tags, scope, published, pain_tagged,
    crpi_score, relay_count, ttl, creator_key, geo_lat, geo_lon,
    received_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SQL_SELECT_BY_ID = `SELECT * FROM dtus WHERE id = ?`;
const SQL_DELETE_BY_ID = `DELETE FROM dtus WHERE id = ?`;
const SQL_SELECT_ALL = `SELECT * FROM dtus`;
const SQL_SELECT_BY_TYPE = `SELECT * FROM dtus WHERE type = ?`;
const SQL_COUNT = `SELECT COUNT(*) as cnt FROM dtus`;
const SQL_DELETE_ALL = `DELETE FROM dtus`;

// ── Store factory ────────────────────────────────────────────────────────────

export function createDTUStore(db: SQLiteDatabase): DTUStore {
  const cache = new Map<string, DTU>();
  let initialized = false;

  // Initialize DB schema synchronously-ish: the first operation will await init
  const initPromise = initializeSchema(db);

  async function initializeSchema(database: SQLiteDatabase): Promise<void> {
    await database.executeSql(SQL_CREATE_TABLE);
    await database.executeSql(SQL_CREATE_INDEX_TYPE);
    await database.executeSql(SQL_CREATE_INDEX_TIMESTAMP);
    await database.executeSql(SQL_CREATE_INDEX_PAIN);

    // Load all existing DTUs into cache
    const result = await database.executeSql(SQL_SELECT_ALL);
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i) as DTUStoreRow;
      const dtu = rowToDTU(row);
      cache.set(dtu.id, dtu);
    }

    initialized = true;
  }

  function ensureInit(): void {
    // In production this would be awaited, but for the sync interface
    // we rely on the cache being populated by the time operations are called.
    // The init is triggered at creation time.
  }

  const store: DTUStore = {
    get(id: string): DTU | undefined {
      ensureInit();
      return cache.get(id);
    },

    set(id: string, dtu: DTU): void {
      ensureInit();
      cache.set(id, dtu);

      // Write-through to SQLite (fire-and-forget in sync API)
      const row = dtuToRow(dtu);
      db.executeSql(SQL_INSERT, [
        row.id, row.version, row.flags, row.type, row.timestamp,
        row.content_length, row.content_hash, row.content, row.signature,
        row.parent_id, row.tags, row.scope, row.published, row.pain_tagged,
        row.crpi_score, row.relay_count, row.ttl, row.creator_key,
        row.geo_lat, row.geo_lon, row.received_at, row.created_at,
      ]).catch((_err) => {
        // In production, log the error. The cache still has the DTU.
      });
    },

    has(id: string): boolean {
      ensureInit();
      return cache.has(id);
    },

    delete(id: string): boolean {
      ensureInit();
      const existed = cache.delete(id);
      if (existed) {
        db.executeSql(SQL_DELETE_BY_ID, [id]).catch((_err) => {
          // In production, log the error
        });
      }
      return existed;
    },

    get size(): number {
      return cache.size;
    },

    search(query: string, limit: number = 50): DTUSearchResult[] {
      ensureInit();
      if (!query || query.trim().length === 0) return [];

      const queryLower = query.toLowerCase().trim();
      const tokens = queryLower.split(/\s+/);
      const results: DTUSearchResult[] = [];

      for (const [_id, dtu] of cache) {
        let score = 0;

        // Check tags
        for (const tag of dtu.tags) {
          for (const token of tokens) {
            if (tag.toLowerCase().includes(token)) {
              score += 2;
            }
          }
        }

        // Check content (decode as text and search)
        try {
          const text = new TextDecoder().decode(dtu.content).toLowerCase();
          for (const token of tokens) {
            if (text.includes(token)) {
              score += 1;
            }
          }
        } catch {
          // Content is not text — skip
        }

        if (score > 0) {
          // Build snippet from content
          let snippet = '';
          try {
            const text = new TextDecoder().decode(dtu.content);
            snippet = text.substring(0, 100);
          } catch {
            snippet = '[binary content]';
          }

          results.push({
            id: dtu.id,
            type: dtu.header.type,
            timestamp: dtu.header.timestamp,
            tags: dtu.tags,
            score,
            snippet,
          });
        }
      }

      // Sort by score descending, then by timestamp descending
      results.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);

      return results.slice(0, limit);
    },

    getByType(type: DTUTypeCode): DTU[] {
      ensureInit();
      const results: DTU[] = [];
      for (const [_id, dtu] of cache) {
        if (dtu.header.type === type) {
          results.push(dtu);
        }
      }
      return results;
    },

    getByTags(tags: string[]): DTU[] {
      ensureInit();
      if (tags.length === 0) return [];

      const tagSet = new Set(tags.map((t) => t.toLowerCase()));
      const results: DTU[] = [];

      for (const [_id, dtu] of cache) {
        const hasAll = dtu.tags.some((t) => tagSet.has(t.toLowerCase()));
        if (hasAll) {
          results.push(dtu);
        }
      }

      return results;
    },

    getStats(): DTUStoreStats {
      ensureInit();
      const byType: Record<number, number> = {};
      let totalSizeBytes = 0;
      let oldestTimestamp = Infinity;
      let newestTimestamp = 0;

      for (const [_id, dtu] of cache) {
        byType[dtu.header.type] = (byType[dtu.header.type] || 0) + 1;
        totalSizeBytes += dtu.content.length;
        if (dtu.header.timestamp < oldestTimestamp) {
          oldestTimestamp = dtu.header.timestamp;
        }
        if (dtu.header.timestamp > newestTimestamp) {
          newestTimestamp = dtu.header.timestamp;
        }
      }

      // Handle empty store
      if (cache.size === 0) {
        oldestTimestamp = 0;
        newestTimestamp = 0;
      }

      return {
        totalCount: cache.size,
        byType,
        totalSizeBytes,
        oldestTimestamp,
        newestTimestamp,
      };
    },

    prune(options: { maxAgeDays: number; protectPainTagged: boolean }): number {
      ensureInit();
      const cutoff = Date.now() - options.maxAgeDays * 24 * 60 * 60 * 1000;
      const toDelete: string[] = [];

      for (const [id, dtu] of cache) {
        if (dtu.header.timestamp < cutoff) {
          if (options.protectPainTagged && dtu.meta.painTagged) {
            continue; // Skip pain-tagged DTUs
          }
          toDelete.push(id);
        }
      }

      for (const id of toDelete) {
        cache.delete(id);
        db.executeSql(SQL_DELETE_BY_ID, [id]).catch((_err) => {
          // In production, log the error
        });
      }

      return toDelete.length;
    },

    clear(): void {
      cache.clear();
      db.executeSql(SQL_DELETE_ALL).catch((_err) => {
        // In production, log the error
      });
    },
  };

  return store;
}
