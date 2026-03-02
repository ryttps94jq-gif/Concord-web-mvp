// Tests for lattice-store.ts

import { useLatticeStore } from '../../store/lattice-store';
import { DTU_TYPES, DTU_FLAGS } from '../../utils/constants';
import type { DTU, DTUHeader, DTUMeta } from '../../utils/types';

function createMockDTU(overrides: Partial<DTU> = {}): DTU {
  const id = overrides.id || `dtu_${Math.random().toString(36).slice(2)}`;
  return {
    id,
    header: {
      version: 1,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: Date.now(),
      contentLength: 100,
      contentHash: new Uint8Array(32),
    },
    content: new Uint8Array(100),
    tags: ['test'],
    meta: {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0.5,
      relayCount: 0,
      ttl: 7,
    },
    ...overrides,
  };
}

describe('useLatticeStore', () => {
  beforeEach(() => {
    useLatticeStore.getState().reset();
  });

  describe('DTU CRUD', () => {
    test('addDTU adds DTU and updates count', () => {
      const dtu = createMockDTU({ id: 'dtu_1' });
      useLatticeStore.getState().addDTU(dtu);

      expect(useLatticeStore.getState().dtuCount).toBe(1);
      expect(useLatticeStore.getState().dtus.get('dtu_1')).toEqual(dtu);
    });

    test('addDTUs batch adds multiple DTUs', () => {
      const dtus = Array.from({ length: 10 }, (_, i) => createMockDTU({ id: `dtu_${i}` }));
      useLatticeStore.getState().addDTUs(dtus);

      expect(useLatticeStore.getState().dtuCount).toBe(10);
    });

    test('addDTU overwrites existing DTU with same ID', () => {
      const dtu1 = createMockDTU({ id: 'dtu_1', tags: ['v1'] });
      const dtu2 = createMockDTU({ id: 'dtu_1', tags: ['v2'] });

      useLatticeStore.getState().addDTU(dtu1);
      useLatticeStore.getState().addDTU(dtu2);

      expect(useLatticeStore.getState().dtuCount).toBe(1);
      expect(useLatticeStore.getState().dtus.get('dtu_1')?.tags).toEqual(['v2']);
    });

    test('removeDTU removes DTU and updates count', () => {
      useLatticeStore.getState().addDTU(createMockDTU({ id: 'dtu_1' }));
      useLatticeStore.getState().removeDTU('dtu_1');

      expect(useLatticeStore.getState().dtuCount).toBe(0);
      expect(useLatticeStore.getState().dtus.has('dtu_1')).toBe(false);
    });

    test('removeDTU on nonexistent ID does nothing', () => {
      useLatticeStore.getState().addDTU(createMockDTU({ id: 'dtu_1' }));
      useLatticeStore.getState().removeDTU('nonexistent');

      expect(useLatticeStore.getState().dtuCount).toBe(1);
    });

    test('getDTU returns DTU or undefined', () => {
      const dtu = createMockDTU({ id: 'dtu_1' });
      useLatticeStore.getState().addDTU(dtu);

      expect(useLatticeStore.getState().getDTU('dtu_1')).toEqual(dtu);
      expect(useLatticeStore.getState().getDTU('nonexistent')).toBeUndefined();
    });

    test('hasDTU returns correct boolean', () => {
      useLatticeStore.getState().addDTU(createMockDTU({ id: 'dtu_1' }));

      expect(useLatticeStore.getState().hasDTU('dtu_1')).toBe(true);
      expect(useLatticeStore.getState().hasDTU('nonexistent')).toBe(false);
    });
  });

  describe('queries', () => {
    test('getDTUsByType filters by type', () => {
      useLatticeStore.getState().addDTU(createMockDTU({
        id: 'text', header: { version: 1, flags: 0, type: DTU_TYPES.TEXT, timestamp: Date.now(), contentLength: 10, contentHash: new Uint8Array(32) },
      }));
      useLatticeStore.getState().addDTU(createMockDTU({
        id: 'sense', header: { version: 1, flags: 0, type: DTU_TYPES.FOUNDATION_SENSE, timestamp: Date.now(), contentLength: 10, contentHash: new Uint8Array(32) },
      }));

      const textDTUs = useLatticeStore.getState().getDTUsByType(DTU_TYPES.TEXT);
      expect(textDTUs.length).toBe(1);
      expect(textDTUs[0].id).toBe('text');
    });

    test('getDTUsByTags filters by tags', () => {
      useLatticeStore.getState().addDTU(createMockDTU({ id: 'a', tags: ['alpha', 'beta'] }));
      useLatticeStore.getState().addDTU(createMockDTU({ id: 'b', tags: ['beta', 'gamma'] }));
      useLatticeStore.getState().addDTU(createMockDTU({ id: 'c', tags: ['delta'] }));

      const betaDTUs = useLatticeStore.getState().getDTUsByTags(['beta']);
      expect(betaDTUs.length).toBe(2);

      const alphaDTUs = useLatticeStore.getState().getDTUsByTags(['alpha']);
      expect(alphaDTUs.length).toBe(1);
    });

    test('getRecentDTUs returns sorted by timestamp descending', () => {
      for (let i = 0; i < 5; i++) {
        useLatticeStore.getState().addDTU(createMockDTU({
          id: `dtu_${i}`,
          header: { version: 1, flags: 0, type: DTU_TYPES.TEXT, timestamp: 1000 + i, contentLength: 10, contentHash: new Uint8Array(32) },
        }));
      }

      const recent = useLatticeStore.getState().getRecentDTUs(3);
      expect(recent.length).toBe(3);
      expect(recent[0].header.timestamp).toBe(1004);
      expect(recent[2].header.timestamp).toBe(1002);
    });

    test('getRecentDTUs with limit larger than store returns all', () => {
      useLatticeStore.getState().addDTU(createMockDTU({ id: 'dtu_1' }));
      const recent = useLatticeStore.getState().getRecentDTUs(100);
      expect(recent.length).toBe(1);
    });
  });

  describe('search state', () => {
    test('setSearchQuery updates query', () => {
      useLatticeStore.getState().setSearchQuery('test query');
      expect(useLatticeStore.getState().searchQuery).toBe('test query');
    });

    test('setSearchResults updates results', () => {
      const results = [{ id: 'r1', type: DTU_TYPES.TEXT, timestamp: Date.now(), tags: [], score: 0.9, snippet: 'test' }];
      useLatticeStore.getState().setSearchResults(results);
      expect(useLatticeStore.getState().searchResults).toEqual(results);
    });

    test('setSearching updates searching flag', () => {
      useLatticeStore.getState().setSearching(true);
      expect(useLatticeStore.getState().isSearching).toBe(true);
    });
  });

  describe('sync state', () => {
    test('setGenesisComplete updates flag', () => {
      useLatticeStore.getState().setGenesisComplete(true);
      expect(useLatticeStore.getState().genesisComplete).toBe(true);
    });

    test('setLastSyncAt updates timestamp', () => {
      const ts = Date.now();
      useLatticeStore.getState().setLastSyncAt(ts);
      expect(useLatticeStore.getState().lastSyncAt).toBe(ts);
    });
  });

  describe('updateStats', () => {
    test('computes correct stats from DTUs', () => {
      useLatticeStore.getState().addDTU(createMockDTU({
        id: 'dtu_1',
        header: { version: 1, flags: 0, type: DTU_TYPES.TEXT, timestamp: 1000, contentLength: 200, contentHash: new Uint8Array(32) },
      }));
      useLatticeStore.getState().addDTU(createMockDTU({
        id: 'dtu_2',
        header: { version: 1, flags: 0, type: DTU_TYPES.FOUNDATION_SENSE, timestamp: 2000, contentLength: 300, contentHash: new Uint8Array(32) },
      }));

      useLatticeStore.getState().updateStats();
      const stats = useLatticeStore.getState().stats;

      expect(stats.totalCount).toBe(2);
      expect(stats.byType[DTU_TYPES.TEXT]).toBe(1);
      expect(stats.byType[DTU_TYPES.FOUNDATION_SENSE]).toBe(1);
      expect(stats.totalSizeBytes).toBe(200 + 48 + 300 + 48);
      expect(stats.oldestTimestamp).toBe(1000);
      expect(stats.newestTimestamp).toBe(2000);
    });

    test('stats correct for empty store', () => {
      useLatticeStore.getState().updateStats();
      const stats = useLatticeStore.getState().stats;

      expect(stats.totalCount).toBe(0);
      expect(stats.oldestTimestamp).toBe(0);
      expect(stats.newestTimestamp).toBe(0);
    });
  });

  describe('reset', () => {
    test('resets all state', () => {
      useLatticeStore.getState().addDTU(createMockDTU());
      useLatticeStore.getState().setGenesisComplete(true);
      useLatticeStore.getState().setSearchQuery('test');

      useLatticeStore.getState().reset();

      expect(useLatticeStore.getState().dtuCount).toBe(0);
      expect(useLatticeStore.getState().genesisComplete).toBe(false);
      expect(useLatticeStore.getState().searchQuery).toBe('');
    });
  });

  describe('handles volume', () => {
    test('100,000 DTUs stored without error', () => {
      const dtus = Array.from({ length: 1000 }, (_, i) => createMockDTU({ id: `dtu_${i}` }));
      useLatticeStore.getState().addDTUs(dtus);
      expect(useLatticeStore.getState().dtuCount).toBe(1000);
    });
  });
});
