import { describe, it, expect, beforeEach } from 'vitest';
import {
  useLatticeStore,
  selectFilteredDTUs,
  selectDTUsByTier,
} from '@/store/lattice';
import type { DTU, DTUTier } from '@/lib/types/dtu';

function makeDTU(overrides: Partial<DTU> = {}): DTU {
  return {
    id: `dtu-${Math.random().toString(36).slice(2, 8)}`,
    tier: 'regular' as DTUTier,
    content: 'Test DTU content',
    summary: 'Test DTU summary',
    timestamp: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
}

describe('Lattice Store', () => {
  beforeEach(() => {
    useLatticeStore.setState({
      dtus: new Map(),
      dtuList: [],
      nodes: [],
      edges: [],
      resonance: {
        overall: 0.75,
        coherence: 0.8,
        stability: 0.7,
        homeostasis: 0.85,
        bioAge: 0.9,
        continuity: 0.65,
      },
      isLoadingDTUs: false,
      isLoadingGraph: false,
      tierFilter: 'all',
      searchQuery: '',
      dtuCount: 0,
      recentDTUs: [],
      activeDomains: [],
      knowledgeGaps: [],
      topologyStats: { nodes: 0, edges: 0, clusters: 0 },
    });
  });

  describe('initial state', () => {
    it('has empty DTU collections', () => {
      const state = useLatticeStore.getState();
      expect(state.dtus.size).toBe(0);
      expect(state.dtuList).toEqual([]);
    });

    it('has empty graph data', () => {
      const state = useLatticeStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
    });

    it('has default resonance values', () => {
      const { resonance } = useLatticeStore.getState();
      expect(resonance.overall).toBe(0.75);
      expect(resonance.coherence).toBe(0.8);
      expect(resonance.stability).toBe(0.7);
      expect(resonance.homeostasis).toBe(0.85);
      expect(resonance.bioAge).toBe(0.9);
      expect(resonance.continuity).toBe(0.65);
    });

    it('has loading states set to false', () => {
      const state = useLatticeStore.getState();
      expect(state.isLoadingDTUs).toBe(false);
      expect(state.isLoadingGraph).toBe(false);
    });

    it('has default filter values', () => {
      const state = useLatticeStore.getState();
      expect(state.tierFilter).toBe('all');
      expect(state.searchQuery).toBe('');
    });

    it('has default expansion state', () => {
      const state = useLatticeStore.getState();
      expect(state.dtuCount).toBe(0);
      expect(state.recentDTUs).toEqual([]);
      expect(state.activeDomains).toEqual([]);
      expect(state.knowledgeGaps).toEqual([]);
      expect(state.topologyStats).toEqual({ nodes: 0, edges: 0, clusters: 0 });
    });
  });

  describe('setDTUs', () => {
    it('sets DTUs from an array', () => {
      const dtu1 = makeDTU({ id: 'dtu-1' });
      const dtu2 = makeDTU({ id: 'dtu-2' });

      useLatticeStore.getState().setDTUs([dtu1, dtu2]);

      const state = useLatticeStore.getState();
      expect(state.dtus.size).toBe(2);
      expect(state.dtuList).toEqual(['dtu-1', 'dtu-2']);
      expect(state.dtus.get('dtu-1')).toEqual(dtu1);
      expect(state.dtus.get('dtu-2')).toEqual(dtu2);
    });

    it('replaces existing DTUs completely', () => {
      const dtu1 = makeDTU({ id: 'dtu-1' });
      useLatticeStore.getState().setDTUs([dtu1]);

      const dtu2 = makeDTU({ id: 'dtu-2' });
      useLatticeStore.getState().setDTUs([dtu2]);

      const state = useLatticeStore.getState();
      expect(state.dtus.size).toBe(1);
      expect(state.dtus.has('dtu-1')).toBe(false);
      expect(state.dtus.has('dtu-2')).toBe(true);
    });

    it('handles empty array', () => {
      useLatticeStore.getState().setDTUs([]);

      expect(useLatticeStore.getState().dtus.size).toBe(0);
      expect(useLatticeStore.getState().dtuList).toEqual([]);
    });
  });

  describe('addDTU', () => {
    it('adds a DTU to the beginning of the list', () => {
      const dtu1 = makeDTU({ id: 'dtu-1' });
      const dtu2 = makeDTU({ id: 'dtu-2' });

      useLatticeStore.getState().addDTU(dtu1);
      useLatticeStore.getState().addDTU(dtu2);

      const state = useLatticeStore.getState();
      expect(state.dtuList).toEqual(['dtu-2', 'dtu-1']);
      expect(state.dtus.size).toBe(2);
    });

    it('preserves existing DTUs when adding', () => {
      const dtu1 = makeDTU({ id: 'dtu-1' });
      useLatticeStore.getState().setDTUs([dtu1]);

      const dtu2 = makeDTU({ id: 'dtu-2' });
      useLatticeStore.getState().addDTU(dtu2);

      expect(useLatticeStore.getState().dtus.size).toBe(2);
      expect(useLatticeStore.getState().dtus.has('dtu-1')).toBe(true);
    });
  });

  describe('updateDTU', () => {
    it('updates an existing DTU', () => {
      const dtu = makeDTU({ id: 'dtu-1', content: 'original' });
      useLatticeStore.getState().setDTUs([dtu]);

      useLatticeStore.getState().updateDTU('dtu-1', { content: 'updated' });

      expect(useLatticeStore.getState().dtus.get('dtu-1')!.content).toBe('updated');
    });

    it('preserves non-updated fields', () => {
      const dtu = makeDTU({ id: 'dtu-1', content: 'original', summary: 'test summary' });
      useLatticeStore.getState().setDTUs([dtu]);

      useLatticeStore.getState().updateDTU('dtu-1', { content: 'updated' });

      expect(useLatticeStore.getState().dtus.get('dtu-1')!.summary).toBe('test summary');
    });

    it('does nothing if the DTU does not exist', () => {
      useLatticeStore.getState().updateDTU('nonexistent', { content: 'test' });

      expect(useLatticeStore.getState().dtus.size).toBe(0);
    });
  });

  describe('removeDTU', () => {
    it('removes a DTU by id', () => {
      const dtu = makeDTU({ id: 'dtu-1' });
      useLatticeStore.getState().setDTUs([dtu]);

      useLatticeStore.getState().removeDTU('dtu-1');

      expect(useLatticeStore.getState().dtus.size).toBe(0);
      expect(useLatticeStore.getState().dtuList).toEqual([]);
    });

    it('removes from both map and list', () => {
      const dtu1 = makeDTU({ id: 'dtu-1' });
      const dtu2 = makeDTU({ id: 'dtu-2' });
      useLatticeStore.getState().setDTUs([dtu1, dtu2]);

      useLatticeStore.getState().removeDTU('dtu-1');

      expect(useLatticeStore.getState().dtus.has('dtu-1')).toBe(false);
      expect(useLatticeStore.getState().dtuList).toEqual(['dtu-2']);
    });

    it('does nothing for non-existent id', () => {
      const dtu = makeDTU({ id: 'dtu-1' });
      useLatticeStore.getState().setDTUs([dtu]);

      useLatticeStore.getState().removeDTU('nonexistent');

      expect(useLatticeStore.getState().dtus.size).toBe(1);
    });
  });

  describe('setGraph', () => {
    it('sets nodes and edges', () => {
      const nodes = [{ id: 'n1', label: 'Node 1' }];
      const edges = [{ source: 'n1', target: 'n2', weight: 0.5 }];

      useLatticeStore.getState().setGraph(nodes, edges);

      expect(useLatticeStore.getState().nodes).toEqual(nodes);
      expect(useLatticeStore.getState().edges).toEqual(edges);
    });
  });

  describe('setResonance', () => {
    it('sets resonance metrics and adds lastUpdated timestamp', () => {
      const metrics = {
        overall: 0.9,
        coherence: 0.85,
        stability: 0.88,
        homeostasis: 0.92,
        bioAge: 0.95,
        continuity: 0.87,
      };

      useLatticeStore.getState().setResonance(metrics);

      const { resonance } = useLatticeStore.getState();
      expect(resonance.overall).toBe(0.9);
      expect(resonance.coherence).toBe(0.85);
      expect(resonance.lastUpdated).toBeTruthy();
    });
  });

  describe('filter actions', () => {
    it('sets tier filter', () => {
      useLatticeStore.getState().setTierFilter('mega');
      expect(useLatticeStore.getState().tierFilter).toBe('mega');
    });

    it('sets search query', () => {
      useLatticeStore.getState().setSearchQuery('test query');
      expect(useLatticeStore.getState().searchQuery).toBe('test query');
    });

    it('sets tier filter back to all', () => {
      useLatticeStore.getState().setTierFilter('hyper');
      useLatticeStore.getState().setTierFilter('all');
      expect(useLatticeStore.getState().tierFilter).toBe('all');
    });
  });

  describe('loading actions', () => {
    it('sets DTU loading state', () => {
      useLatticeStore.getState().setLoadingDTUs(true);
      expect(useLatticeStore.getState().isLoadingDTUs).toBe(true);

      useLatticeStore.getState().setLoadingDTUs(false);
      expect(useLatticeStore.getState().isLoadingDTUs).toBe(false);
    });

    it('sets graph loading state', () => {
      useLatticeStore.getState().setLoadingGraph(true);
      expect(useLatticeStore.getState().isLoadingGraph).toBe(true);

      useLatticeStore.getState().setLoadingGraph(false);
      expect(useLatticeStore.getState().isLoadingGraph).toBe(false);
    });
  });

  describe('real-time expansion actions', () => {
    it('sets DTU count', () => {
      useLatticeStore.getState().setDTUCount(42);
      expect(useLatticeStore.getState().dtuCount).toBe(42);
    });

    it('adds recent DTU and increments count', () => {
      useLatticeStore.getState().setDTUCount(10);
      const dtu = makeDTU({ id: 'recent-1' });

      useLatticeStore.getState().addRecentDTU(dtu);

      expect(useLatticeStore.getState().recentDTUs).toHaveLength(1);
      expect(useLatticeStore.getState().recentDTUs[0].id).toBe('recent-1');
      expect(useLatticeStore.getState().dtuCount).toBe(11);
    });

    it('caps recentDTUs at 50', () => {
      for (let i = 0; i < 55; i++) {
        useLatticeStore.getState().addRecentDTU(makeDTU({ id: `dtu-${i}` }));
      }

      expect(useLatticeStore.getState().recentDTUs).toHaveLength(50);
      // Most recent should be first
      expect(useLatticeStore.getState().recentDTUs[0].id).toBe('dtu-54');
    });

    it('prepends new DTU to recentDTUs', () => {
      useLatticeStore.getState().addRecentDTU(makeDTU({ id: 'older' }));
      useLatticeStore.getState().addRecentDTU(makeDTU({ id: 'newer' }));

      expect(useLatticeStore.getState().recentDTUs[0].id).toBe('newer');
      expect(useLatticeStore.getState().recentDTUs[1].id).toBe('older');
    });

    it('sets active domains', () => {
      useLatticeStore.getState().setActiveDomains(['science', 'art']);
      expect(useLatticeStore.getState().activeDomains).toEqual(['science', 'art']);
    });

    it('sets knowledge gaps', () => {
      const gaps = [
        { id: 'gap-1', domain: 'science', description: 'Missing physics', severity: 0.8, discoveredAt: '2026-01-01' },
      ];
      useLatticeStore.getState().setKnowledgeGaps(gaps);
      expect(useLatticeStore.getState().knowledgeGaps).toEqual(gaps);
    });

    it('sets topology stats', () => {
      useLatticeStore.getState().setTopologyStats({ nodes: 100, edges: 200, clusters: 5 });
      expect(useLatticeStore.getState().topologyStats).toEqual({ nodes: 100, edges: 200, clusters: 5 });
    });
  });

  describe('selectFilteredDTUs', () => {
    it('returns all DTUs when no filters applied', () => {
      const dtu1 = makeDTU({ id: 'dtu-1', tier: 'regular' });
      const dtu2 = makeDTU({ id: 'dtu-2', tier: 'mega' });
      useLatticeStore.getState().setDTUs([dtu1, dtu2]);

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(2);
    });

    it('filters by tier', () => {
      const dtu1 = makeDTU({ id: 'dtu-1', tier: 'regular' });
      const dtu2 = makeDTU({ id: 'dtu-2', tier: 'mega' });
      const dtu3 = makeDTU({ id: 'dtu-3', tier: 'regular' });
      useLatticeStore.getState().setDTUs([dtu1, dtu2, dtu3]);
      useLatticeStore.getState().setTierFilter('regular');

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(2);
      expect(result.every((d) => d.tier === 'regular')).toBe(true);
    });

    it('filters by search query matching content', () => {
      const dtu1 = makeDTU({ id: 'dtu-1', content: 'Hello world' });
      const dtu2 = makeDTU({ id: 'dtu-2', content: 'Goodbye world' });
      useLatticeStore.getState().setDTUs([dtu1, dtu2]);
      useLatticeStore.getState().setSearchQuery('hello');

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dtu-1');
    });

    it('filters by search query matching summary', () => {
      const dtu1 = makeDTU({ id: 'dtu-1', summary: 'Machine learning basics' });
      const dtu2 = makeDTU({ id: 'dtu-2', summary: 'Art history' });
      useLatticeStore.getState().setDTUs([dtu1, dtu2]);
      useLatticeStore.getState().setSearchQuery('machine');

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dtu-1');
    });

    it('filters by search query matching tags', () => {
      const dtu1 = makeDTU({ id: 'dtu-1', tags: ['physics', 'quantum'] });
      const dtu2 = makeDTU({ id: 'dtu-2', tags: ['art', 'painting'] });
      useLatticeStore.getState().setDTUs([dtu1, dtu2]);
      useLatticeStore.getState().setSearchQuery('quantum');

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dtu-1');
    });

    it('search is case-insensitive', () => {
      const dtu = makeDTU({ id: 'dtu-1', content: 'Hello World' });
      useLatticeStore.getState().setDTUs([dtu]);
      useLatticeStore.getState().setSearchQuery('HELLO');

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(1);
    });

    it('combines tier and search filters', () => {
      const dtu1 = makeDTU({ id: 'dtu-1', tier: 'regular', content: 'Hello' });
      const dtu2 = makeDTU({ id: 'dtu-2', tier: 'mega', content: 'Hello' });
      const dtu3 = makeDTU({ id: 'dtu-3', tier: 'regular', content: 'Goodbye' });
      useLatticeStore.getState().setDTUs([dtu1, dtu2, dtu3]);
      useLatticeStore.getState().setTierFilter('regular');
      useLatticeStore.getState().setSearchQuery('hello');

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dtu-1');
    });

    it('returns empty array when no DTUs match', () => {
      const dtu = makeDTU({ id: 'dtu-1', content: 'Hello' });
      useLatticeStore.getState().setDTUs([dtu]);
      useLatticeStore.getState().setSearchQuery('nonexistent');

      const result = selectFilteredDTUs(useLatticeStore.getState());
      expect(result).toHaveLength(0);
    });
  });

  describe('selectDTUsByTier', () => {
    it('counts DTUs by tier correctly', () => {
      useLatticeStore.getState().setDTUs([
        makeDTU({ id: '1', tier: 'regular' }),
        makeDTU({ id: '2', tier: 'regular' }),
        makeDTU({ id: '3', tier: 'mega' }),
        makeDTU({ id: '4', tier: 'hyper' }),
        makeDTU({ id: '5', tier: 'shadow' }),
        makeDTU({ id: '6', tier: 'shadow' }),
      ]);

      const counts = selectDTUsByTier(useLatticeStore.getState());
      expect(counts).toEqual({
        regular: 2,
        mega: 1,
        hyper: 1,
        shadow: 2,
      });
    });

    it('returns all zeros when no DTUs exist', () => {
      const counts = selectDTUsByTier(useLatticeStore.getState());
      expect(counts).toEqual({
        regular: 0,
        mega: 0,
        hyper: 0,
        shadow: 0,
      });
    });
  });
});
