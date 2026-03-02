// Concord Mobile — Mesh State Store (Zustand)

import { create } from 'zustand';
import type {
  MeshPeer,
  MeshState,
  MeshHealth,
  TransportStatus,
  RelayQueueEntry,
  TransportLayer,
  ConnectionState,
} from '../utils/types';
import { TRANSPORT_LAYERS } from '../utils/constants';

interface MeshStore {
  // State
  peers: Map<string, MeshPeer>;
  transports: TransportStatus[];
  relayQueue: RelayQueueEntry[];
  meshHealth: MeshHealth;
  connectionState: ConnectionState;
  recentHashes: Set<string>;

  // Actions
  addPeer: (peer: MeshPeer) => void;
  removePeer: (peerId: string) => void;
  updatePeer: (peerId: string, updates: Partial<MeshPeer>) => void;
  updatePeerReputation: (peerId: string, validDTU: boolean) => void;
  pruneStale: (maxAgeMs: number) => string[];

  setTransportStatus: (layer: TransportLayer, status: Partial<TransportStatus>) => void;
  getActiveTransports: () => TransportStatus[];

  enqueueRelay: (entry: RelayQueueEntry) => void;
  dequeueRelay: () => RelayQueueEntry | undefined;
  clearRelayQueue: () => void;

  addSeenHash: (hash: string) => void;
  hasSeenHash: (hash: string) => boolean;
  clearSeenHashes: () => void;

  updateMeshHealth: (health: Partial<MeshHealth>) => void;
  setConnectionState: (state: ConnectionState) => void;

  getMeshState: () => MeshState;
  reset: () => void;
}

const initialTransports: TransportStatus[] = Object.values(TRANSPORT_LAYERS).map(layer => ({
  layer: layer as TransportLayer,
  available: false,
  active: false,
  peerCount: 0,
  lastActivity: 0,
}));

const initialHealth: MeshHealth = {
  connectedPeers: 0,
  activeTransports: 0,
  relayQueueDepth: 0,
  dtusPropagated: 0,
  dtusReceived: 0,
  uptime: 0,
};

export const useMeshStore = create<MeshStore>((set, get) => ({
  peers: new Map(),
  transports: [...initialTransports],
  relayQueue: [],
  meshHealth: { ...initialHealth },
  connectionState: 'offline',
  recentHashes: new Set(),

  addPeer: (peer) => set(state => {
    const peers = new Map(state.peers);
    peers.set(peer.id, peer);
    return {
      peers,
      meshHealth: { ...state.meshHealth, connectedPeers: peers.size },
    };
  }),

  removePeer: (peerId) => set(state => {
    const peers = new Map(state.peers);
    peers.delete(peerId);
    return {
      peers,
      meshHealth: { ...state.meshHealth, connectedPeers: peers.size },
    };
  }),

  updatePeer: (peerId, updates) => set(state => {
    const peers = new Map(state.peers);
    const existing = peers.get(peerId);
    if (existing) {
      peers.set(peerId, { ...existing, ...updates });
    }
    return { peers };
  }),

  updatePeerReputation: (peerId, validDTU) => set(state => {
    const peers = new Map(state.peers);
    const peer = peers.get(peerId);
    if (peer) {
      const rep = { ...peer.reputation };
      if (validDTU) {
        rep.validDTUs += 1;
        rep.totalRelays += 1;
      } else {
        rep.invalidDTUs += 1;
      }
      // Score: valid / (valid + invalid*3) — invalid DTUs weighted 3x
      const denominator = rep.validDTUs + rep.invalidDTUs * 3;
      rep.score = denominator > 0 ? rep.validDTUs / denominator : 0.5;
      peers.set(peerId, { ...peer, reputation: rep });
    }
    return { peers };
  }),

  pruneStale: (maxAgeMs) => {
    const now = Date.now();
    const pruned: string[] = [];
    set(state => {
      const peers = new Map(state.peers);
      for (const [id, peer] of peers) {
        if (now - peer.lastSeen > maxAgeMs) {
          peers.delete(id);
          pruned.push(id);
        }
      }
      return {
        peers,
        meshHealth: { ...state.meshHealth, connectedPeers: peers.size },
      };
    });
    return pruned;
  },

  setTransportStatus: (layer, status) => set(state => {
    const transports = state.transports.map(t =>
      t.layer === layer ? { ...t, ...status } : t
    );
    const activeCount = transports.filter(t => t.active).length;
    return {
      transports,
      meshHealth: { ...state.meshHealth, activeTransports: activeCount },
    };
  }),

  getActiveTransports: () => get().transports.filter(t => t.active),

  enqueueRelay: (entry) => set(state => {
    const queue = [...state.relayQueue, entry]
      .sort((a, b) => b.priority - a.priority); // higher priority first
    return {
      relayQueue: queue,
      meshHealth: { ...state.meshHealth, relayQueueDepth: queue.length },
    };
  }),

  dequeueRelay: () => {
    const state = get();
    if (state.relayQueue.length === 0) return undefined;
    const [next, ...rest] = state.relayQueue;
    set({
      relayQueue: rest,
      meshHealth: { ...state.meshHealth, relayQueueDepth: rest.length },
    });
    return next;
  },

  clearRelayQueue: () => set(state => ({
    relayQueue: [],
    meshHealth: { ...state.meshHealth, relayQueueDepth: 0 },
  })),

  addSeenHash: (hash) => set(state => {
    const hashes = new Set(state.recentHashes);
    hashes.add(hash);
    return { recentHashes: hashes };
  }),

  hasSeenHash: (hash) => get().recentHashes.has(hash),

  clearSeenHashes: () => set({ recentHashes: new Set() }),

  updateMeshHealth: (health) => set(state => ({
    meshHealth: { ...state.meshHealth, ...health },
  })),

  setConnectionState: (connectionState) => set({ connectionState }),

  getMeshState: () => {
    const state = get();
    return {
      peers: state.peers,
      activePeers: Array.from(state.peers.values()).filter(p => p.authenticated).length,
      transports: state.transports,
      relayQueue: state.relayQueue,
      recentHashes: state.recentHashes,
      meshHealth: state.meshHealth,
    };
  },

  reset: () => set({
    peers: new Map(),
    transports: [...initialTransports],
    relayQueue: [],
    meshHealth: { ...initialHealth },
    connectionState: 'offline',
    recentHashes: new Set(),
  }),
}));
