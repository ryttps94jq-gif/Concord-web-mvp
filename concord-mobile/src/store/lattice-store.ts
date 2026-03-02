// Concord Mobile — Local Lattice Store (Zustand)
// Manages the on-device DTU knowledge graph

import { create } from 'zustand';
import type { DTU, DTUTypeCode, DTUSearchResult, DTUStoreStats } from '../utils/types';

interface LatticeStore {
  // State
  dtus: Map<string, DTU>;
  dtuCount: number;
  stats: DTUStoreStats;
  searchQuery: string;
  searchResults: DTUSearchResult[];
  isSearching: boolean;
  genesisComplete: boolean;
  lastSyncAt: number;

  // DTU CRUD
  addDTU: (dtu: DTU) => void;
  addDTUs: (dtus: DTU[]) => void;
  removeDTU: (id: string) => void;
  getDTU: (id: string) => DTU | undefined;
  hasDTU: (id: string) => boolean;
  getDTUsByType: (type: DTUTypeCode) => DTU[];
  getDTUsByTags: (tags: string[]) => DTU[];
  getRecentDTUs: (limit: number) => DTU[];

  // Search
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: DTUSearchResult[]) => void;
  setSearching: (searching: boolean) => void;

  // Sync
  setGenesisComplete: (complete: boolean) => void;
  setLastSyncAt: (timestamp: number) => void;

  // Stats
  updateStats: () => void;

  // Reset
  reset: () => void;
}

const emptyStats: DTUStoreStats = {
  totalCount: 0,
  byType: {},
  totalSizeBytes: 0,
  oldestTimestamp: 0,
  newestTimestamp: 0,
};

export const useLatticeStore = create<LatticeStore>((set, get) => ({
  dtus: new Map(),
  dtuCount: 0,
  stats: { ...emptyStats },
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  genesisComplete: false,
  lastSyncAt: 0,

  addDTU: (dtu) => set(state => {
    const dtus = new Map(state.dtus);
    dtus.set(dtu.id, dtu);
    return { dtus, dtuCount: dtus.size };
  }),

  addDTUs: (newDtus) => set(state => {
    const dtus = new Map(state.dtus);
    for (const dtu of newDtus) {
      dtus.set(dtu.id, dtu);
    }
    return { dtus, dtuCount: dtus.size };
  }),

  removeDTU: (id) => set(state => {
    const dtus = new Map(state.dtus);
    dtus.delete(id);
    return { dtus, dtuCount: dtus.size };
  }),

  getDTU: (id) => get().dtus.get(id),

  hasDTU: (id) => get().dtus.has(id),

  getDTUsByType: (type) => {
    const results: DTU[] = [];
    for (const dtu of get().dtus.values()) {
      if (dtu.header.type === type) results.push(dtu);
    }
    return results;
  },

  getDTUsByTags: (tags) => {
    const tagSet = new Set(tags);
    const results: DTU[] = [];
    for (const dtu of get().dtus.values()) {
      if (dtu.tags.some(t => tagSet.has(t))) results.push(dtu);
    }
    return results;
  },

  getRecentDTUs: (limit) => {
    return Array.from(get().dtus.values())
      .sort((a, b) => b.header.timestamp - a.header.timestamp)
      .slice(0, limit);
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSearching: (searching) => set({ isSearching: searching }),

  setGenesisComplete: (complete) => set({ genesisComplete: complete }),
  setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),

  updateStats: () => set(state => {
    const byType: Record<number, number> = {};
    let totalSizeBytes = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;

    for (const dtu of state.dtus.values()) {
      byType[dtu.header.type] = (byType[dtu.header.type] || 0) + 1;
      totalSizeBytes += dtu.header.contentLength + 48; // header + content
      if (dtu.header.timestamp < oldestTimestamp) oldestTimestamp = dtu.header.timestamp;
      if (dtu.header.timestamp > newestTimestamp) newestTimestamp = dtu.header.timestamp;
    }

    return {
      stats: {
        totalCount: state.dtus.size,
        byType,
        totalSizeBytes,
        oldestTimestamp: state.dtus.size > 0 ? oldestTimestamp : 0,
        newestTimestamp,
      },
    };
  }),

  reset: () => set({
    dtus: new Map(),
    dtuCount: 0,
    stats: { ...emptyStats },
    searchQuery: '',
    searchResults: [],
    isSearching: false,
    genesisComplete: false,
    lastSyncAt: 0,
  }),
}));
