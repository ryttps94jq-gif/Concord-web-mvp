// Tests for DTU Store — CRUD, search, prune, stats

import {
  createDTUStore,
  DTUStore,
  SQLiteDatabase,
} from '../../dtu/store/dtu-store';
import {
  DTU_VERSION,
  DTU_TYPES,
  DTU_FLAGS,
  DTU_HASH_SIZE,
  DEFAULT_DTU_TTL,
} from '../../utils/constants';
import type { DTU, DTUHeader, DTUMeta, DTUTypeCode } from '../../utils/types';

// ── Mock SQLite ──────────────────────────────────────────────────────────────

function createMockDB(): SQLiteDatabase & { _queries: Array<{ sql: string; params?: any[] }> } {
  const queries: Array<{ sql: string; params?: any[] }> = [];

  return {
    _queries: queries,
    executeSql: jest.fn(async (sql: string, params?: any[]) => {
      queries.push({ sql, params });
      return { rows: { length: 0, item: (_i: number) => null } };
    }),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDTU(overrides: Partial<DTU> & { id?: string } = {}): DTU {
  const content = new TextEncoder().encode('test content');
  const header: DTUHeader = {
    version: DTU_VERSION,
    flags: 0,
    type: DTU_TYPES.TEXT,
    timestamp: Date.now(),
    contentLength: content.length,
    contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
  };
  const meta: DTUMeta = {
    scope: 'local',
    published: false,
    painTagged: false,
    crpiScore: 0,
    relayCount: 0,
    ttl: DEFAULT_DTU_TTL,
  };
  return {
    id: 'dtu_test_001',
    header,
    content,
    tags: ['test'],
    meta,
    lineage: { parentId: null, ancestors: [], depth: 0 },
    ...overrides,
  };
}

function makeDTUWithType(id: string, type: DTUTypeCode, tags: string[] = []): DTU {
  return makeDTU({
    id,
    header: {
      version: DTU_VERSION,
      flags: 0,
      type,
      timestamp: Date.now(),
      contentLength: 12,
      contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
    },
    tags,
  });
}

function makeDTUWithTimestamp(id: string, timestamp: number, painTagged = false): DTU {
  const dtu = makeDTU({
    id,
    header: {
      version: DTU_VERSION,
      flags: painTagged ? DTU_FLAGS.PAIN_TAGGED : 0,
      type: DTU_TYPES.TEXT,
      timestamp,
      contentLength: 12,
      contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
    },
  });
  dtu.meta.painTagged = painTagged;
  return dtu;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createDTUStore', () => {
  let db: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    db = createMockDB();
    createDTUStore(db);
  });

  it('initializes the database schema', () => {
    // Schema creation is async, but should have been called
    expect(db.executeSql).toHaveBeenCalled();
    // Check that CREATE TABLE was issued
    const createCalls = db._queries.filter((q) => q.sql.includes('CREATE TABLE'));
    expect(createCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('creates indexes for type, timestamp, and pain_tagged', () => {
    const indexCalls = db._queries.filter((q) => q.sql.includes('CREATE INDEX'));
    expect(indexCalls.length).toBeGreaterThanOrEqual(3);
  });
});

describe('DTUStore CRUD', () => {
  let db: ReturnType<typeof createMockDB>;
  let store: DTUStore;

  beforeEach(() => {
    db = createMockDB();
    store = createDTUStore(db);
  });

  // ── set & get ──────────────────────────────────────────────────────────

  it('set then get returns the DTU', () => {
    const dtu = makeDTU({ id: 'dtu_1' });
    store.set('dtu_1', dtu);
    const retrieved = store.get('dtu_1');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('dtu_1');
  });

  it('get returns undefined for missing id', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('set overwrites existing DTU', () => {
    const dtu1 = makeDTU({ id: 'dtu_1', tags: ['first'] });
    const dtu2 = makeDTU({ id: 'dtu_1', tags: ['second'] });
    store.set('dtu_1', dtu1);
    store.set('dtu_1', dtu2);
    expect(store.get('dtu_1')!.tags).toEqual(['second']);
  });

  it('set writes through to SQLite', () => {
    const dtu = makeDTU({ id: 'dtu_1' });
    store.set('dtu_1', dtu);
    const insertCalls = db._queries.filter((q) => q.sql.includes('INSERT OR REPLACE'));
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ── has ────────────────────────────────────────────────────────────────

  it('has returns true for existing DTU', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    expect(store.has('dtu_1')).toBe(true);
  });

  it('has returns false for missing DTU', () => {
    expect(store.has('nonexistent')).toBe(false);
  });

  // ── delete ─────────────────────────────────────────────────────────────

  it('delete removes from cache and returns true', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    const result = store.delete('dtu_1');
    expect(result).toBe(true);
    expect(store.has('dtu_1')).toBe(false);
  });

  it('delete returns false for nonexistent id', () => {
    const result = store.delete('nonexistent');
    expect(result).toBe(false);
  });

  it('delete issues SQL DELETE', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    store.delete('dtu_1');
    const deleteCalls = db._queries.filter((q) => q.sql.includes('DELETE FROM dtus WHERE'));
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ── size ───────────────────────────────────────────────────────────────

  it('size returns 0 for empty store', () => {
    expect(store.size).toBe(0);
  });

  it('size reflects added DTUs', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    store.set('dtu_2', makeDTU({ id: 'dtu_2' }));
    expect(store.size).toBe(2);
  });

  it('size decreases after delete', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    store.set('dtu_2', makeDTU({ id: 'dtu_2' }));
    store.delete('dtu_1');
    expect(store.size).toBe(1);
  });

  // ── clear ──────────────────────────────────────────────────────────────

  it('clear removes all DTUs', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    store.set('dtu_2', makeDTU({ id: 'dtu_2' }));
    store.clear();
    expect(store.size).toBe(0);
    expect(store.has('dtu_1')).toBe(false);
    expect(store.has('dtu_2')).toBe(false);
  });

  it('clear issues SQL DELETE ALL', () => {
    store.clear();
    const delCalls = db._queries.filter((q) => q.sql.includes('DELETE FROM dtus') && !q.sql.includes('WHERE'));
    expect(delCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('DTUStore search', () => {
  let db: ReturnType<typeof createMockDB>;
  let store: DTUStore;

  beforeEach(() => {
    db = createMockDB();
    store = createDTUStore(db);
  });

  it('returns empty array for empty query', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    expect(store.search('')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    expect(store.search('   ')).toEqual([]);
  });

  it('finds DTU by tag', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1', tags: ['economy', 'transfer'] }));
    const results = store.search('economy');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('dtu_1');
  });

  it('finds DTU by content', () => {
    const content = new TextEncoder().encode('hello world');
    const dtu = makeDTU({
      id: 'dtu_1',
      content,
      header: {
        version: DTU_VERSION,
        flags: 0,
        type: DTU_TYPES.TEXT,
        timestamp: Date.now(),
        contentLength: content.length,
        contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
      },
    });
    store.set('dtu_1', dtu);
    const results = store.search('hello');
    expect(results.length).toBe(1);
  });

  it('is case-insensitive', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1', tags: ['Economy'] }));
    const results = store.search('ECONOMY');
    expect(results.length).toBe(1);
  });

  it('scores tag matches higher than content matches', () => {
    const contentDtu = makeDTU({
      id: 'dtu_content',
      content: new TextEncoder().encode('economy report'),
      tags: ['report'],
      header: {
        version: DTU_VERSION, flags: 0, type: DTU_TYPES.TEXT,
        timestamp: Date.now() - 1000, contentLength: 15,
        contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
      },
    });
    const tagDtu = makeDTU({
      id: 'dtu_tag',
      content: new TextEncoder().encode('some other text'),
      tags: ['economy'],
      header: {
        version: DTU_VERSION, flags: 0, type: DTU_TYPES.TEXT,
        timestamp: Date.now(), contentLength: 15,
        contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
      },
    });

    store.set('dtu_content', contentDtu);
    store.set('dtu_tag', tagDtu);

    const results = store.search('economy');
    expect(results[0].id).toBe('dtu_tag'); // tag match scores higher
  });

  it('respects limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      store.set(`dtu_${i}`, makeDTU({ id: `dtu_${i}`, tags: ['common'] }));
    }
    const results = store.search('common', 3);
    expect(results.length).toBe(3);
  });

  it('defaults limit to 50', () => {
    for (let i = 0; i < 60; i++) {
      store.set(`dtu_${i}`, makeDTU({ id: `dtu_${i}`, tags: ['many'] }));
    }
    const results = store.search('many');
    expect(results.length).toBe(50);
  });

  it('includes snippet in results', () => {
    const content = new TextEncoder().encode('This is a test snippet');
    store.set('dtu_1', makeDTU({
      id: 'dtu_1',
      content,
      tags: ['test'],
      header: {
        version: DTU_VERSION, flags: 0, type: DTU_TYPES.TEXT,
        timestamp: Date.now(), contentLength: content.length,
        contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
      },
    }));
    const results = store.search('test');
    expect(results[0].snippet).toContain('This is a test');
  });

  it('truncates snippet to 100 characters', () => {
    const longText = 'a'.repeat(200);
    const content = new TextEncoder().encode(longText);
    store.set('dtu_1', makeDTU({
      id: 'dtu_1',
      content,
      tags: ['aaa'],
      header: {
        version: DTU_VERSION, flags: 0, type: DTU_TYPES.TEXT,
        timestamp: Date.now(), contentLength: content.length,
        contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
      },
    }));
    const results = store.search('aaa');
    expect(results[0].snippet.length).toBeLessThanOrEqual(100);
  });

  it('returns no results when nothing matches', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1', tags: ['alpha'] }));
    const results = store.search('zzzzz');
    expect(results).toEqual([]);
  });

  it('supports multi-token search', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1', tags: ['economy', 'transfer'] }));
    store.set('dtu_2', makeDTU({ id: 'dtu_2', tags: ['economy'] }));
    const results = store.search('economy transfer');
    // dtu_1 matches both tokens (higher score), dtu_2 matches one
    expect(results[0].id).toBe('dtu_1');
    expect(results.length).toBe(2);
  });
});

describe('DTUStore getByType', () => {
  let store: DTUStore;

  beforeEach(() => {
    store = createDTUStore(createMockDB());
  });

  it('returns DTUs matching the given type', () => {
    store.set('dtu_1', makeDTUWithType('dtu_1', DTU_TYPES.TEXT));
    store.set('dtu_2', makeDTUWithType('dtu_2', DTU_TYPES.KNOWLEDGE));
    store.set('dtu_3', makeDTUWithType('dtu_3', DTU_TYPES.TEXT));

    const results = store.getByType(DTU_TYPES.TEXT);
    expect(results.length).toBe(2);
    expect(results.map((d) => d.id).sort()).toEqual(['dtu_1', 'dtu_3']);
  });

  it('returns empty array for type with no DTUs', () => {
    store.set('dtu_1', makeDTUWithType('dtu_1', DTU_TYPES.TEXT));
    const results = store.getByType(DTU_TYPES.EMERGENCY_ALERT);
    expect(results).toEqual([]);
  });
});

describe('DTUStore getByTags', () => {
  let store: DTUStore;

  beforeEach(() => {
    store = createDTUStore(createMockDB());
  });

  it('returns DTUs matching any of the given tags', () => {
    store.set('dtu_1', makeDTUWithType('dtu_1', DTU_TYPES.TEXT, ['alpha', 'beta']));
    store.set('dtu_2', makeDTUWithType('dtu_2', DTU_TYPES.TEXT, ['gamma']));
    store.set('dtu_3', makeDTUWithType('dtu_3', DTU_TYPES.TEXT, ['beta', 'delta']));

    const results = store.getByTags(['beta']);
    expect(results.length).toBe(2);
    expect(results.map((d) => d.id).sort()).toEqual(['dtu_1', 'dtu_3']);
  });

  it('returns empty for empty tags array', () => {
    store.set('dtu_1', makeDTU({ id: 'dtu_1' }));
    expect(store.getByTags([])).toEqual([]);
  });

  it('is case-insensitive', () => {
    store.set('dtu_1', makeDTUWithType('dtu_1', DTU_TYPES.TEXT, ['Alpha']));
    const results = store.getByTags(['alpha']);
    expect(results.length).toBe(1);
  });

  it('returns no results when no tags match', () => {
    store.set('dtu_1', makeDTUWithType('dtu_1', DTU_TYPES.TEXT, ['alpha']));
    const results = store.getByTags(['zzz']);
    expect(results).toEqual([]);
  });
});

describe('DTUStore getStats', () => {
  let store: DTUStore;

  beforeEach(() => {
    store = createDTUStore(createMockDB());
  });

  it('returns zero stats for empty store', () => {
    const stats = store.getStats();
    expect(stats.totalCount).toBe(0);
    expect(stats.totalSizeBytes).toBe(0);
    expect(stats.oldestTimestamp).toBe(0);
    expect(stats.newestTimestamp).toBe(0);
    expect(stats.byType).toEqual({});
  });

  it('counts DTUs by type', () => {
    store.set('dtu_1', makeDTUWithType('dtu_1', DTU_TYPES.TEXT));
    store.set('dtu_2', makeDTUWithType('dtu_2', DTU_TYPES.TEXT));
    store.set('dtu_3', makeDTUWithType('dtu_3', DTU_TYPES.KNOWLEDGE));

    const stats = store.getStats();
    expect(stats.totalCount).toBe(3);
    expect(stats.byType[DTU_TYPES.TEXT]).toBe(2);
    expect(stats.byType[DTU_TYPES.KNOWLEDGE]).toBe(1);
  });

  it('computes total size in bytes', () => {
    const content1 = new Uint8Array(100);
    const content2 = new Uint8Array(200);
    store.set('dtu_1', makeDTU({
      id: 'dtu_1',
      content: content1,
      header: {
        version: DTU_VERSION, flags: 0, type: DTU_TYPES.TEXT,
        timestamp: Date.now(), contentLength: 100,
        contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
      },
    }));
    store.set('dtu_2', makeDTU({
      id: 'dtu_2',
      content: content2,
      header: {
        version: DTU_VERSION, flags: 0, type: DTU_TYPES.TEXT,
        timestamp: Date.now(), contentLength: 200,
        contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
      },
    }));

    const stats = store.getStats();
    expect(stats.totalSizeBytes).toBe(300);
  });

  it('tracks oldest and newest timestamps', () => {
    store.set('dtu_old', makeDTUWithTimestamp('dtu_old', 1000));
    store.set('dtu_new', makeDTUWithTimestamp('dtu_new', 5000));
    store.set('dtu_mid', makeDTUWithTimestamp('dtu_mid', 3000));

    const stats = store.getStats();
    expect(stats.oldestTimestamp).toBe(1000);
    expect(stats.newestTimestamp).toBe(5000);
  });
});

describe('DTUStore prune', () => {
  let store: DTUStore;

  beforeEach(() => {
    store = createDTUStore(createMockDB());
  });

  it('removes DTUs older than maxAgeDays', () => {
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000; // 31 days ago
    const recent = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago

    store.set('dtu_old', makeDTUWithTimestamp('dtu_old', old));
    store.set('dtu_recent', makeDTUWithTimestamp('dtu_recent', recent));

    const pruned = store.prune({ maxAgeDays: 30, protectPainTagged: false });
    expect(pruned).toBe(1);
    expect(store.has('dtu_old')).toBe(false);
    expect(store.has('dtu_recent')).toBe(true);
  });

  it('protects pain-tagged DTUs when protectPainTagged is true', () => {
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;

    store.set('dtu_pain', makeDTUWithTimestamp('dtu_pain', old, true));
    store.set('dtu_normal', makeDTUWithTimestamp('dtu_normal', old, false));

    const pruned = store.prune({ maxAgeDays: 30, protectPainTagged: true });
    expect(pruned).toBe(1);
    expect(store.has('dtu_pain')).toBe(true);
    expect(store.has('dtu_normal')).toBe(false);
  });

  it('does not protect pain-tagged when protectPainTagged is false', () => {
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;

    store.set('dtu_pain', makeDTUWithTimestamp('dtu_pain', old, true));

    const pruned = store.prune({ maxAgeDays: 30, protectPainTagged: false });
    expect(pruned).toBe(1);
    expect(store.has('dtu_pain')).toBe(false);
  });

  it('returns 0 when nothing to prune', () => {
    const recent = Date.now() - 1 * 24 * 60 * 60 * 1000;
    store.set('dtu_1', makeDTUWithTimestamp('dtu_1', recent));
    const pruned = store.prune({ maxAgeDays: 30, protectPainTagged: false });
    expect(pruned).toBe(0);
  });

  it('returns 0 for empty store', () => {
    const pruned = store.prune({ maxAgeDays: 30, protectPainTagged: false });
    expect(pruned).toBe(0);
  });

  it('updates size after pruning', () => {
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    store.set('dtu_1', makeDTUWithTimestamp('dtu_1', old));
    store.set('dtu_2', makeDTUWithTimestamp('dtu_2', old));

    expect(store.size).toBe(2);
    store.prune({ maxAgeDays: 30, protectPainTagged: false });
    expect(store.size).toBe(0);
  });
});
