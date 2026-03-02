// Tests for mesh-store.ts

import { useMeshStore } from '../../store/mesh-store';
import { TRANSPORT_LAYERS } from '../../utils/constants';
import type { MeshPeer, RelayQueueEntry } from '../../utils/types';

function createMockPeer(overrides: Partial<MeshPeer> = {}): MeshPeer {
  return {
    id: `peer_${Math.random().toString(36).slice(2)}`,
    publicKey: 'pk_test_' + Math.random().toString(36).slice(2),
    transport: TRANSPORT_LAYERS.BLUETOOTH,
    rssi: -60,
    lastSeen: Date.now(),
    capabilities: {
      bluetooth: true,
      wifiDirect: false,
      nfc: false,
      lora: false,
      internet: false,
    },
    reputation: {
      validDTUs: 0,
      invalidDTUs: 0,
      totalRelays: 0,
      score: 0.5,
    },
    authenticated: false,
    ...overrides,
  };
}

describe('useMeshStore', () => {
  beforeEach(() => {
    useMeshStore.getState().reset();
  });

  describe('peer management', () => {
    test('addPeer adds peer and updates health', () => {
      const peer = createMockPeer();
      useMeshStore.getState().addPeer(peer);

      expect(useMeshStore.getState().peers.size).toBe(1);
      expect(useMeshStore.getState().peers.get(peer.id)).toEqual(peer);
      expect(useMeshStore.getState().meshHealth.connectedPeers).toBe(1);
    });

    test('addPeer updates existing peer', () => {
      const peer = createMockPeer({ id: 'peer_1' });
      useMeshStore.getState().addPeer(peer);
      const updated = { ...peer, rssi: -40 };
      useMeshStore.getState().addPeer(updated);

      expect(useMeshStore.getState().peers.size).toBe(1);
      expect(useMeshStore.getState().peers.get('peer_1')?.rssi).toBe(-40);
    });

    test('removePeer removes peer and updates health', () => {
      const peer = createMockPeer({ id: 'peer_1' });
      useMeshStore.getState().addPeer(peer);
      useMeshStore.getState().removePeer('peer_1');

      expect(useMeshStore.getState().peers.size).toBe(0);
      expect(useMeshStore.getState().meshHealth.connectedPeers).toBe(0);
    });

    test('removePeer does nothing for unknown peer', () => {
      const peer = createMockPeer();
      useMeshStore.getState().addPeer(peer);
      useMeshStore.getState().removePeer('nonexistent');

      expect(useMeshStore.getState().peers.size).toBe(1);
    });

    test('updatePeer updates specific fields', () => {
      const peer = createMockPeer({ id: 'peer_1', rssi: -80 });
      useMeshStore.getState().addPeer(peer);
      useMeshStore.getState().updatePeer('peer_1', { rssi: -50, authenticated: true });

      const updated = useMeshStore.getState().peers.get('peer_1');
      expect(updated?.rssi).toBe(-50);
      expect(updated?.authenticated).toBe(true);
    });

    test('updatePeer ignores unknown peer', () => {
      useMeshStore.getState().updatePeer('nonexistent', { rssi: -50 });
      expect(useMeshStore.getState().peers.size).toBe(0);
    });

    test('pruneStale removes old peers', () => {
      const fresh = createMockPeer({ id: 'fresh', lastSeen: Date.now() });
      const stale = createMockPeer({ id: 'stale', lastSeen: Date.now() - 120000 });
      useMeshStore.getState().addPeer(fresh);
      useMeshStore.getState().addPeer(stale);

      const pruned = useMeshStore.getState().pruneStale(60000);
      expect(pruned).toEqual(['stale']);
      expect(useMeshStore.getState().peers.size).toBe(1);
      expect(useMeshStore.getState().peers.has('fresh')).toBe(true);
    });

    test('pruneStale returns empty when no stale peers', () => {
      const peer = createMockPeer({ lastSeen: Date.now() });
      useMeshStore.getState().addPeer(peer);
      const pruned = useMeshStore.getState().pruneStale(60000);
      expect(pruned).toEqual([]);
    });
  });

  describe('peer reputation', () => {
    test('valid DTU increases reputation score', () => {
      const peer = createMockPeer({ id: 'peer_1' });
      useMeshStore.getState().addPeer(peer);

      useMeshStore.getState().updatePeerReputation('peer_1', true);
      const updated = useMeshStore.getState().peers.get('peer_1');
      expect(updated?.reputation.validDTUs).toBe(1);
      expect(updated?.reputation.totalRelays).toBe(1);
      expect(updated?.reputation.score).toBe(1); // 1/(1+0) = 1
    });

    test('invalid DTU decreases reputation score', () => {
      const peer = createMockPeer({ id: 'peer_1' });
      useMeshStore.getState().addPeer(peer);

      useMeshStore.getState().updatePeerReputation('peer_1', false);
      const updated = useMeshStore.getState().peers.get('peer_1');
      expect(updated?.reputation.invalidDTUs).toBe(1);
      expect(updated?.reputation.score).toBe(0); // 0/(0+3) = 0
    });

    test('mixed reputation computes correct score', () => {
      const peer = createMockPeer({ id: 'peer_1' });
      useMeshStore.getState().addPeer(peer);

      // 10 valid, 1 invalid
      for (let i = 0; i < 10; i++) {
        useMeshStore.getState().updatePeerReputation('peer_1', true);
      }
      useMeshStore.getState().updatePeerReputation('peer_1', false);

      const updated = useMeshStore.getState().peers.get('peer_1');
      // score = 10 / (10 + 1*3) = 10/13 ≈ 0.769
      expect(updated?.reputation.score).toBeCloseTo(10 / 13, 3);
    });

    test('10 invalid DTUs deprioritizes peer', () => {
      const peer = createMockPeer({ id: 'peer_1' });
      useMeshStore.getState().addPeer(peer);

      for (let i = 0; i < 10; i++) {
        useMeshStore.getState().updatePeerReputation('peer_1', false);
      }

      const updated = useMeshStore.getState().peers.get('peer_1');
      expect(updated?.reputation.score).toBe(0);
      expect(updated?.reputation.invalidDTUs).toBe(10);
    });
  });

  describe('transport status', () => {
    test('setTransportStatus updates transport', () => {
      useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, {
        available: true,
        active: true,
        peerCount: 3,
      });

      const bt = useMeshStore.getState().transports.find(
        t => t.layer === TRANSPORT_LAYERS.BLUETOOTH
      );
      expect(bt?.available).toBe(true);
      expect(bt?.active).toBe(true);
      expect(bt?.peerCount).toBe(3);
    });

    test('setTransportStatus updates active transport count in health', () => {
      useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, { active: true });
      useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.WIFI_DIRECT, { active: true });

      expect(useMeshStore.getState().meshHealth.activeTransports).toBe(2);
    });

    test('getActiveTransports returns only active', () => {
      useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, { active: true });
      useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.NFC, { active: false });

      const active = useMeshStore.getState().getActiveTransports();
      expect(active.length).toBe(1);
      expect(active[0].layer).toBe(TRANSPORT_LAYERS.BLUETOOTH);
    });
  });

  describe('relay queue', () => {
    test('enqueueRelay adds entry sorted by priority', () => {
      const low: RelayQueueEntry = {
        dtuId: 'dtu_1', dtuHash: 'hash1', priority: 1,
        ttl: 7, enqueuedAt: Date.now(), excludePeers: [],
      };
      const high: RelayQueueEntry = {
        dtuId: 'dtu_2', dtuHash: 'hash2', priority: 10,
        ttl: 15, enqueuedAt: Date.now(), excludePeers: [],
      };

      useMeshStore.getState().enqueueRelay(low);
      useMeshStore.getState().enqueueRelay(high);

      const queue = useMeshStore.getState().relayQueue;
      expect(queue[0].dtuId).toBe('dtu_2'); // higher priority first
      expect(queue[1].dtuId).toBe('dtu_1');
    });

    test('dequeueRelay returns highest priority', () => {
      const entries: RelayQueueEntry[] = [
        { dtuId: 'low', dtuHash: 'h1', priority: 1, ttl: 7, enqueuedAt: Date.now(), excludePeers: [] },
        { dtuId: 'high', dtuHash: 'h2', priority: 10, ttl: 15, enqueuedAt: Date.now(), excludePeers: [] },
        { dtuId: 'mid', dtuHash: 'h3', priority: 5, ttl: 7, enqueuedAt: Date.now(), excludePeers: [] },
      ];
      entries.forEach(e => useMeshStore.getState().enqueueRelay(e));

      const first = useMeshStore.getState().dequeueRelay();
      expect(first?.dtuId).toBe('high');
      expect(useMeshStore.getState().relayQueue.length).toBe(2);
    });

    test('dequeueRelay returns undefined when empty', () => {
      expect(useMeshStore.getState().dequeueRelay()).toBeUndefined();
    });

    test('clearRelayQueue empties queue', () => {
      useMeshStore.getState().enqueueRelay({
        dtuId: 'dtu_1', dtuHash: 'h', priority: 1, ttl: 7, enqueuedAt: Date.now(), excludePeers: [],
      });
      useMeshStore.getState().clearRelayQueue();
      expect(useMeshStore.getState().relayQueue.length).toBe(0);
    });
  });

  describe('seen hashes', () => {
    test('addSeenHash and hasSeenHash work correctly', () => {
      expect(useMeshStore.getState().hasSeenHash('abc')).toBe(false);
      useMeshStore.getState().addSeenHash('abc');
      expect(useMeshStore.getState().hasSeenHash('abc')).toBe(true);
    });

    test('clearSeenHashes resets set', () => {
      useMeshStore.getState().addSeenHash('abc');
      useMeshStore.getState().clearSeenHashes();
      expect(useMeshStore.getState().hasSeenHash('abc')).toBe(false);
    });
  });

  describe('connection state', () => {
    test('setConnectionState updates state', () => {
      useMeshStore.getState().setConnectionState('mesh-only');
      expect(useMeshStore.getState().connectionState).toBe('mesh-only');
    });
  });

  describe('getMeshState', () => {
    test('returns complete mesh state snapshot', () => {
      const peer = createMockPeer({ authenticated: true });
      useMeshStore.getState().addPeer(peer);
      useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, { active: true });

      const state = useMeshStore.getState().getMeshState();
      expect(state.peers.size).toBe(1);
      expect(state.activePeers).toBe(1);
      expect(state.transports.length).toBe(7);
    });
  });

  describe('reset', () => {
    test('resets all state to initial values', () => {
      useMeshStore.getState().addPeer(createMockPeer());
      useMeshStore.getState().addSeenHash('test');
      useMeshStore.getState().setConnectionState('online');

      useMeshStore.getState().reset();

      expect(useMeshStore.getState().peers.size).toBe(0);
      expect(useMeshStore.getState().connectionState).toBe('offline');
      expect(useMeshStore.getState().hasSeenHash('test')).toBe(false);
    });
  });
});
