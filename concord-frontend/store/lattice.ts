import { create } from 'zustand';
import { DTU, DTUTier } from '@/lib/types/dtu';

interface KnowledgeGap {
  id: string;
  domain: string;
  description: string;
  severity: number;
  discoveredAt: string;
}

interface LatticeState {
  // DTU data
  dtus: Map<string, DTU>;
  dtuList: string[]; // Ordered list of DTU IDs

  // Graph data
  nodes: GraphNode[];
  edges: GraphEdge[];

  // Resonance metrics
  resonance: ResonanceMetrics;

  // Loading states
  isLoadingDTUs: boolean;
  isLoadingGraph: boolean;

  // Filters
  tierFilter: DTUTier | 'all';
  searchQuery: string;

  // Real-time expansion
  dtuCount: number;
  recentDTUs: DTU[];           // Last 50 DTUs created (fed by socket)
  activeDomains: string[];     // Domains with recent activity
  knowledgeGaps: KnowledgeGap[];
  topologyStats: { nodes: number; edges: number; clusters: number };

  // Actions
  setDTUs: (dtus: DTU[]) => void;
  addDTU: (dtu: DTU) => void;
  updateDTU: (id: string, updates: Partial<DTU>) => void;
  removeDTU: (id: string) => void;
  setGraph: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setResonance: (metrics: ResonanceMetrics) => void;
  setTierFilter: (tier: DTUTier | 'all') => void;
  setSearchQuery: (query: string) => void;
  setLoadingDTUs: (loading: boolean) => void;
  setLoadingGraph: (loading: boolean) => void;

  // New actions
  setDTUCount: (count: number) => void;
  addRecentDTU: (dtu: DTU) => void;
  setActiveDomains: (domains: string[]) => void;
  setKnowledgeGaps: (gaps: KnowledgeGap[]) => void;
  setTopologyStats: (stats: { nodes: number; edges: number; clusters: number }) => void;
}

interface GraphNode {
  id: string;
  label?: string;
  tier?: DTUTier;
  resonance?: number;
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
  type?: string;
}

interface ResonanceMetrics {
  overall: number;
  coherence: number;
  stability: number;
  homeostasis: number;
  bioAge: number;
  continuity: number;
  lastUpdated?: string;
}

const defaultResonance: ResonanceMetrics = {
  overall: 0.75,
  coherence: 0.8,
  stability: 0.7,
  homeostasis: 0.85,
  bioAge: 0.9,
  continuity: 0.65,
};

export const useLatticeStore = create<LatticeState>((set, get) => ({
  // Initial state
  dtus: new Map(),
  dtuList: [],
  nodes: [],
  edges: [],
  resonance: defaultResonance,
  isLoadingDTUs: false,
  isLoadingGraph: false,
  tierFilter: 'all',
  searchQuery: '',
  dtuCount: 0,
  recentDTUs: [],
  activeDomains: [],
  knowledgeGaps: [],
  topologyStats: { nodes: 0, edges: 0, clusters: 0 },

  // Actions
  setDTUs: (dtus) => {
    const dtuMap = new Map<string, DTU>();
    const dtuList: string[] = [];

    dtus.forEach((dtu) => {
      dtuMap.set(dtu.id, dtu);
      dtuList.push(dtu.id);
    });

    set({ dtus: dtuMap, dtuList });
  },

  addDTU: (dtu) => {
    const { dtus, dtuList } = get();
    const newDtus = new Map(dtus);
    newDtus.set(dtu.id, dtu);

    set({
      dtus: newDtus,
      dtuList: [dtu.id, ...dtuList],
    });
  },

  updateDTU: (id, updates) => {
    const { dtus } = get();
    const existing = dtus.get(id);
    if (!existing) return;

    const newDtus = new Map(dtus);
    newDtus.set(id, { ...existing, ...updates });

    set({ dtus: newDtus });
  },

  removeDTU: (id) => {
    const { dtus, dtuList } = get();
    const newDtus = new Map(dtus);
    newDtus.delete(id);

    set({
      dtus: newDtus,
      dtuList: dtuList.filter((dtuId) => dtuId !== id),
    });
  },

  setGraph: (nodes, edges) => set({ nodes, edges }),

  setResonance: (metrics) =>
    set({
      resonance: { ...metrics, lastUpdated: new Date().toISOString() },
    }),

  setTierFilter: (tier) => set({ tierFilter: tier }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoadingDTUs: (loading) => set({ isLoadingDTUs: loading }),

  setLoadingGraph: (loading) => set({ isLoadingGraph: loading }),

  // New actions
  setDTUCount: (count) => set({ dtuCount: count }),

  addRecentDTU: (dtu) =>
    set((state) => ({
      recentDTUs: [dtu, ...state.recentDTUs].slice(0, 50),
      dtuCount: state.dtuCount + 1,
    })),

  setActiveDomains: (domains) => set({ activeDomains: domains }),

  setKnowledgeGaps: (gaps) => set({ knowledgeGaps: gaps }),

  setTopologyStats: (stats) => set({ topologyStats: stats }),
}));

// Selectors
export const selectFilteredDTUs = (state: LatticeState): DTU[] => {
  const { dtus, dtuList, tierFilter, searchQuery } = state;

  return dtuList
    .map((id) => dtus.get(id))
    .filter((dtu): dtu is DTU => {
      if (!dtu) return false;

      // Tier filter
      if (tierFilter !== 'all' && dtu.tier !== tierFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesContent = dtu.content?.toLowerCase().includes(query);
        const matchesSummary = dtu.summary?.toLowerCase().includes(query);
        const matchesTags = dtu.tags?.some((tag) =>
          tag.toLowerCase().includes(query)
        );

        if (!matchesContent && !matchesSummary && !matchesTags) return false;
      }

      return true;
    });
};

export const selectDTUsByTier = (
  state: LatticeState
): Record<DTUTier, number> => {
  const { dtus, dtuList } = state;

  const counts: Record<DTUTier, number> = {
    regular: 0,
    mega: 0,
    hyper: 0,
    shadow: 0,
  };

  dtuList.forEach((id) => {
    const dtu = dtus.get(id);
    if (dtu) {
      counts[dtu.tier]++;
    }
  });

  return counts;
};
