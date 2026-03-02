// Tests for DTU Search — tokenization, relevance, search, index building

import {
  searchDTUs,
  buildSearchIndex,
  tokenize,
  computeRelevance,
} from '../../dtu/search/dtu-search';
import { createDTUStore, DTUStore, SQLiteDatabase } from '../../dtu/store/dtu-store';
import {
  DTU_VERSION,
  DTU_TYPES,
  DTU_FLAGS,
  DTU_HASH_SIZE,
  DEFAULT_DTU_TTL,
} from '../../utils/constants';
import type { DTU, DTUHeader, DTUMeta } from '../../utils/types';

// ── Mock SQLite ──────────────────────────────────────────────────────────────

function createMockDB(): SQLiteDatabase {
  return {
    executeSql: jest.fn(async () => ({
      rows: { length: 0, item: () => null },
    })),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDTU(
  id: string,
  opts: {
    type?: DTUTypeCode;
    tags?: string[];
    content?: string;
    timestamp?: number;
    painTagged?: boolean;
    priority?: boolean;
  } = {}
): DTU {
  const contentBytes = new TextEncoder().encode(opts.content ?? 'default content');
  let flags = 0;
  if (opts.painTagged) flags |= DTU_FLAGS.PAIN_TAGGED;
  if (opts.priority) flags |= DTU_FLAGS.PRIORITY;

  const header: DTUHeader = {
    version: DTU_VERSION,
    flags,
    type: opts.type ?? DTU_TYPES.TEXT,
    timestamp: opts.timestamp ?? Date.now(),
    contentLength: contentBytes.length,
    contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
  };

  const meta: DTUMeta = {
    scope: 'local',
    published: false,
    painTagged: opts.painTagged ?? false,
    crpiScore: 0,
    relayCount: 0,
    ttl: DEFAULT_DTU_TTL,
  };

  return {
    id,
    header,
    content: contentBytes,
    tags: opts.tags ?? [],
    meta,
    lineage: { parentId: null, ancestors: [], depth: 0 },
  };
}

function populateStore(store: DTUStore, dtus: DTU[]): void {
  for (const dtu of dtus) {
    store.set(dtu.id, dtu);
  }
}

// ── tokenize ─────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(tokenize('   ')).toEqual([]);
  });

  it('lowercases all tokens', () => {
    expect(tokenize('Hello World')).toEqual(['hello', 'world']);
  });

  it('splits on non-alphanumeric characters', () => {
    expect(tokenize('hello-world_foo.bar')).toEqual(['hello', 'world', 'foo', 'bar']);
  });

  it('removes stop words', () => {
    const tokens = tokenize('the quick brown fox is a test');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('is');
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
    expect(tokens).toContain('test');
  });

  it('removes tokens shorter than 2 characters', () => {
    const tokens = tokenize('I am a b c test');
    expect(tokens).not.toContain('i');
    expect(tokens).not.toContain('b');
    expect(tokens).not.toContain('c');
    expect(tokens).toContain('am');
    expect(tokens).toContain('test');
  });

  it('deduplicates tokens', () => {
    const tokens = tokenize('test test test hello test');
    expect(tokens).toEqual(['test', 'hello']);
  });

  it('handles numeric tokens', () => {
    const tokens = tokenize('version 42 build 123');
    expect(tokens).toContain('version');
    expect(tokens).toContain('42');
    expect(tokens).toContain('build');
    expect(tokens).toContain('123');
  });

  it('handles mixed alphanumeric', () => {
    const tokens = tokenize('dtu_test_001 sha256');
    expect(tokens).toContain('dtu');
    expect(tokens).toContain('test');
    expect(tokens).toContain('001');
    expect(tokens).toContain('sha256');
  });

  it('handles special characters', () => {
    const tokens = tokenize('hello!!! @world... #test');
    expect(tokens).toEqual(['hello', 'world', 'test']);
  });
});

// ── computeRelevance ─────────────────────────────────────────────────────────

describe('computeRelevance', () => {
  it('returns 0 for empty tokens', () => {
    const dtu = makeDTU('dtu_1', { tags: ['test'] });
    expect(computeRelevance([], dtu)).toBe(0);
  });

  it('scores exact tag matches highest (+3)', () => {
    const dtu = makeDTU('dtu_1', { tags: ['economy'] });
    const score = computeRelevance(['economy'], dtu);
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('scores prefix tag matches at +2', () => {
    const dtu = makeDTU('dtu_1', { tags: ['economics'] });
    const score = computeRelevance(['econ'], dtu);
    // "econ" is prefix of "economics" but not exact match
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('scores content matches at +1', () => {
    const dtu = makeDTU('dtu_1', { content: 'hello world', tags: [] });
    const score = computeRelevance(['hello'], dtu);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it('scores ID matches at +0.5', () => {
    const dtu = makeDTU('dtu_economy_001', { content: 'nothing', tags: [] });
    const score = computeRelevance(['economy'], dtu);
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  it('adds bonus for pain-tagged DTUs', () => {
    const normalDtu = makeDTU('dtu_1', { tags: ['test'], painTagged: false });
    const painDtu = makeDTU('dtu_2', { tags: ['test'], painTagged: true });

    const normalScore = computeRelevance(['test'], normalDtu);
    const painScore = computeRelevance(['test'], painDtu);
    expect(painScore).toBeGreaterThan(normalScore);
  });

  it('adds bonus for priority DTUs', () => {
    const normalDtu = makeDTU('dtu_1', { tags: ['test'], priority: false });
    const priorityDtu = makeDTU('dtu_2', { tags: ['test'], priority: true });

    const normalScore = computeRelevance(['test'], normalDtu);
    const priorityScore = computeRelevance(['test'], priorityDtu);
    expect(priorityScore).toBeGreaterThan(normalScore);
  });

  it('accumulates score across multiple matching tokens', () => {
    const dtu = makeDTU('dtu_1', {
      tags: ['economy', 'transfer'],
      content: 'test data',
    });
    const singleScore = computeRelevance(['economy'], dtu);
    const multiScore = computeRelevance(['economy', 'transfer'], dtu);
    expect(multiScore).toBeGreaterThan(singleScore);
  });

  it('handles DTU with non-text content gracefully', () => {
    const dtu = makeDTU('dtu_1', { tags: ['binary'] });
    // Override content with invalid UTF-8
    dtu.content = new Uint8Array([0xff, 0xfe, 0xfd]);
    const score = computeRelevance(['binary'], dtu);
    // Should still match tags
    expect(score).toBeGreaterThanOrEqual(3);
  });
});

// ── searchDTUs ───────────────────────────────────────────────────────────────

describe('searchDTUs', () => {
  let store: DTUStore;

  beforeEach(() => {
    store = createDTUStore(createMockDB());
  });

  it('returns empty array for empty query', () => {
    populateStore(store, [makeDTU('dtu_1', { tags: ['test'] })]);
    expect(searchDTUs(store, '')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    populateStore(store, [makeDTU('dtu_1', { tags: ['test'] })]);
    expect(searchDTUs(store, '   ')).toEqual([]);
  });

  it('finds DTUs by tag', () => {
    populateStore(store, [
      makeDTU('dtu_1', { tags: ['economy'] }),
      makeDTU('dtu_2', { tags: ['shield'] }),
    ]);
    const results = searchDTUs(store, 'economy');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('dtu_1');
  });

  it('finds DTUs by content', () => {
    populateStore(store, [
      makeDTU('dtu_1', { content: 'financial report Q4', tags: [] }),
      makeDTU('dtu_2', { content: 'weather forecast', tags: [] }),
    ]);
    const results = searchDTUs(store, 'financial');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('dtu_1');
  });

  it('sorts by relevance by default', () => {
    populateStore(store, [
      makeDTU('dtu_content', { content: 'economy growth report', tags: [] }),
      makeDTU('dtu_tag', { content: 'nothing', tags: ['economy'] }),
    ]);
    const results = searchDTUs(store, 'economy');
    // Tag match scores higher than content match
    expect(results[0].id).toBe('dtu_tag');
  });

  it('respects limit option', () => {
    const dtus = Array.from({ length: 20 }, (_, i) =>
      makeDTU(`dtu_${i}`, { tags: ['common'] })
    );
    populateStore(store, dtus);
    const results = searchDTUs(store, 'common', { limit: 5 });
    expect(results.length).toBe(5);
  });

  it('filters by type', () => {
    populateStore(store, [
      makeDTU('dtu_1', { type: DTU_TYPES.TEXT, tags: ['match'] }),
      makeDTU('dtu_2', { type: DTU_TYPES.KNOWLEDGE, tags: ['match'] }),
    ]);
    const results = searchDTUs(store, 'match', {
      types: [DTU_TYPES.TEXT],
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('dtu_1');
  });

  it('filters by tags', () => {
    populateStore(store, [
      makeDTU('dtu_1', { tags: ['economy', 'report'], content: 'economy data' }),
      makeDTU('dtu_2', { tags: ['shield'], content: 'economy alert' }),
    ]);
    const results = searchDTUs(store, 'economy', { tags: ['report'] });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('dtu_1');
  });

  it('filters by minScore', () => {
    populateStore(store, [
      makeDTU('dtu_high', { tags: ['economy', 'transfer'], content: 'economy data' }),
      makeDTU('dtu_low', { content: 'economy mention', tags: [] }),
    ]);
    const results = searchDTUs(store, 'economy', { minScore: 3 });
    // Only the one with tag match (score >= 3) should be included
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('dtu_high');
  });

  it('sorts by timestamp when specified', () => {
    populateStore(store, [
      makeDTU('dtu_old', { tags: ['match'], timestamp: 1000 }),
      makeDTU('dtu_new', { tags: ['match'], timestamp: 5000 }),
      makeDTU('dtu_mid', { tags: ['match'], timestamp: 3000 }),
    ]);
    const results = searchDTUs(store, 'match', { sortBy: 'timestamp' });
    expect(results[0].id).toBe('dtu_new');
    expect(results[1].id).toBe('dtu_mid');
    expect(results[2].id).toBe('dtu_old');
  });

  it('sorts by type when specified', () => {
    populateStore(store, [
      makeDTU('dtu_knowledge', { type: DTU_TYPES.KNOWLEDGE, tags: ['match'] }),
      makeDTU('dtu_text', { type: DTU_TYPES.TEXT, tags: ['match'] }),
      makeDTU('dtu_alert', { type: DTU_TYPES.EMERGENCY_ALERT, tags: ['match'] }),
    ]);
    const results = searchDTUs(store, 'match', { sortBy: 'type' });
    // Sorted ascending by type code
    expect(results[0].type).toBeLessThanOrEqual(results[1].type);
  });

  it('includes snippet in results', () => {
    populateStore(store, [
      makeDTU('dtu_1', { content: 'Hello world from concord', tags: ['hello'] }),
    ]);
    const results = searchDTUs(store, 'hello');
    expect(results[0].snippet).toContain('Hello world');
  });

  it('handles stop-word-only query by falling back to raw tokens', () => {
    populateStore(store, [
      makeDTU('dtu_1', { content: 'the quick fox', tags: ['the'] }),
    ]);
    // "the" is a stop word, but fallback should try raw token
    const results = searchDTUs(store, 'the');
    expect(results.length).toBe(1);
  });

  it('returns empty for no matches', () => {
    populateStore(store, [
      makeDTU('dtu_1', { tags: ['alpha'] }),
    ]);
    const results = searchDTUs(store, 'zzzzz');
    expect(results).toEqual([]);
  });

  it('works with empty store', () => {
    const results = searchDTUs(store, 'test');
    expect(results).toEqual([]);
  });
});

// ── buildSearchIndex ─────────────────────────────────────────────────────────

describe('buildSearchIndex', () => {
  let store: DTUStore;

  beforeEach(() => {
    store = createDTUStore(createMockDB());
  });

  it('builds an empty index for empty store', () => {
    const index = buildSearchIndex(store);
    expect(index.indexedCount).toBe(0);
    expect(index.tokenIndex.size).toBe(0);
    expect(index.dtuTokens.size).toBe(0);
  });

  it('indexes all DTUs in the store', () => {
    populateStore(store, [
      makeDTU('dtu_1', { tags: ['alpha'] }),
      makeDTU('dtu_2', { tags: ['beta'] }),
      makeDTU('dtu_3', { tags: ['gamma'] }),
    ]);
    const index = buildSearchIndex(store);
    expect(index.indexedCount).toBe(3);
  });

  it('builds token-to-ID mapping', () => {
    populateStore(store, [
      makeDTU('dtu_1', { tags: ['economy'] }),
      makeDTU('dtu_2', { tags: ['economy', 'transfer'] }),
    ]);
    const index = buildSearchIndex(store);
    const economyIds = index.tokenIndex.get('economy');
    expect(economyIds).toBeDefined();
    expect(economyIds!.size).toBe(2);
    expect(economyIds!.has('dtu_1')).toBe(true);
    expect(economyIds!.has('dtu_2')).toBe(true);
  });

  it('builds DTU-to-tokens mapping', () => {
    populateStore(store, [
      makeDTU('dtu_1', { tags: ['economy', 'transfer'] }),
    ]);
    const index = buildSearchIndex(store);
    const tokens = index.dtuTokens.get('dtu_1');
    expect(tokens).toBeDefined();
    expect(tokens).toContain('economy');
    expect(tokens).toContain('transfer');
  });

  it('sets builtAt timestamp', () => {
    const before = Date.now();
    const index = buildSearchIndex(store);
    const after = Date.now();
    expect(index.builtAt).toBeGreaterThanOrEqual(before);
    expect(index.builtAt).toBeLessThanOrEqual(after);
  });

  it('indexes content text tokens', () => {
    populateStore(store, [
      makeDTU('dtu_1', { content: 'financial report quarterly', tags: [] }),
    ]);
    const index = buildSearchIndex(store);
    expect(index.tokenIndex.has('financial')).toBe(true);
    expect(index.tokenIndex.has('report')).toBe(true);
    expect(index.tokenIndex.has('quarterly')).toBe(true);
  });

  it('does not duplicate DTU IDs in index', () => {
    populateStore(store, [
      makeDTU('dtu_1', { tags: ['test', 'test', 'test'] }),
    ]);
    const index = buildSearchIndex(store);
    const testIds = index.tokenIndex.get('test');
    expect(testIds!.size).toBe(1);
  });
});
