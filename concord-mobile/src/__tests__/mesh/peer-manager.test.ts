// Tests for Peer Manager
import {
  createPeerManager,
  calculateReputationScore,
  calculatePeerScore,
} from '../../mesh/transport/peer-manager';
import type { PeerManager } from '../../mesh/transport/peer-manager';
import type { MeshPeer, PeerReputation, TransportLayer } from '../../utils/types';
import { TRANSPORT_LAYERS } from '../../utils/constants';

// ── Test Helpers ──────────────────────────────────────────────────────────────

function createTestPeer(overrides?: Partial<MeshPeer>): MeshPeer {
  return {
    id: overrides?.id ?? `peer_${Math.random().toString(36).slice(2)}`,
    publicKey: 'test-public-key',
    name: 'TestPeer',
    transport: TRANSPORT_LAYERS.BLUETOOTH,
    rssi: -55,
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Peer Manager', () => {
  describe('calculateReputationScore', () => {
    it('should return 0.5 for no interactions', () => {
      const rep: PeerReputation = {
        validDTUs: 0,
        invalidDTUs: 0,
        totalRelays: 0,
        score: 0,
      };
      expect(calculateReputationScore(rep)).toBe(0.5);
    });

    it('should return 1.0 for all valid DTUs', () => {
      const rep: PeerReputation = {
        validDTUs: 10,
        invalidDTUs: 0,
        totalRelays: 10,
        score: 0,
      };
      expect(calculateReputationScore(rep)).toBe(1.0);
    });

    it('should return 0.0 for all invalid DTUs', () => {
      const rep: PeerReputation = {
        validDTUs: 0,
        invalidDTUs: 5,
        totalRelays: 5,
        score: 0,
      };
      expect(calculateReputationScore(rep)).toBe(0.0);
    });

    it('should penalize invalid DTUs 3x', () => {
      // 10 valid, 10 invalid
      // score = 10 / (10 + 10*3) = 10 / 40 = 0.25
      const rep: PeerReputation = {
        validDTUs: 10,
        invalidDTUs: 10,
        totalRelays: 20,
        score: 0,
      };
      expect(calculateReputationScore(rep)).toBe(0.25);
    });

    it('should compute correctly for mixed interactions', () => {
      // 9 valid, 1 invalid
      // score = 9 / (9 + 1*3) = 9 / 12 = 0.75
      const rep: PeerReputation = {
        validDTUs: 9,
        invalidDTUs: 1,
        totalRelays: 10,
        score: 0,
      };
      expect(calculateReputationScore(rep)).toBe(0.75);
    });

    it('should produce a value between 0 and 1', () => {
      for (let v = 0; v <= 20; v++) {
        for (let i = 0; i <= 20; i++) {
          const rep: PeerReputation = {
            validDTUs: v,
            invalidDTUs: i,
            totalRelays: v + i,
            score: 0,
          };
          const score = calculateReputationScore(rep);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('calculatePeerScore', () => {
    it('should return higher score for stronger signal', () => {
      const strongPeer = createTestPeer({
        rssi: -30,
        reputation: { validDTUs: 5, invalidDTUs: 0, totalRelays: 5, score: 1.0 },
      });
      const weakPeer = createTestPeer({
        rssi: -90,
        reputation: { validDTUs: 5, invalidDTUs: 0, totalRelays: 5, score: 1.0 },
      });

      expect(calculatePeerScore(strongPeer)).toBeGreaterThan(
        calculatePeerScore(weakPeer),
      );
    });

    it('should return higher score for better reputation', () => {
      const goodPeer = createTestPeer({
        rssi: -55,
        reputation: { validDTUs: 100, invalidDTUs: 0, totalRelays: 100, score: 1.0 },
      });
      const badPeer = createTestPeer({
        rssi: -55,
        reputation: { validDTUs: 0, invalidDTUs: 10, totalRelays: 10, score: 0.0 },
      });

      expect(calculatePeerScore(goodPeer)).toBeGreaterThan(
        calculatePeerScore(badPeer),
      );
    });

    it('should weight reputation at 60% and RSSI at 40%', () => {
      // Perfect reputation (1.0), strongest signal (-30 -> 1.0)
      const perfectPeer = createTestPeer({
        rssi: -30,
        reputation: { validDTUs: 10, invalidDTUs: 0, totalRelays: 10, score: 1.0 },
      });

      // Score = 1.0 * 0.6 + 1.0 * 0.4 = 1.0
      expect(calculatePeerScore(perfectPeer)).toBeCloseTo(1.0, 2);
    });

    it('should clamp RSSI normalization', () => {
      // RSSI < -100 should clamp to 0
      const veryWeakPeer = createTestPeer({
        rssi: -120,
        reputation: { validDTUs: 0, invalidDTUs: 0, totalRelays: 0, score: 0.5 },
      });
      expect(calculatePeerScore(veryWeakPeer)).toBeGreaterThanOrEqual(0);

      // RSSI > -30 should clamp to 1
      const veryStrongPeer = createTestPeer({
        rssi: -10,
        reputation: { validDTUs: 0, invalidDTUs: 0, totalRelays: 0, score: 0.5 },
      });
      expect(calculatePeerScore(veryStrongPeer)).toBeLessThanOrEqual(1);
    });
  });

  describe('createPeerManager', () => {
    it('should create a peer manager instance', () => {
      const pm = createPeerManager();

      expect(pm).toBeDefined();
      expect(pm.getAllPeers()).toEqual([]);
    });
  });

  describe('addPeer', () => {
    it('should add a new peer', () => {
      const pm = createPeerManager();
      const peer = createTestPeer({ id: 'peer-1' });

      pm.addPeer(peer);

      expect(pm.getAllPeers()).toHaveLength(1);
      expect(pm.getPeer('peer-1')).toBeDefined();
    });

    it('should merge existing peer data on duplicate add', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'peer-1', rssi: -60, name: 'OldName' }));
      pm.addPeer(createTestPeer({ id: 'peer-1', rssi: -40, name: 'NewName' }));

      const peer = pm.getPeer('peer-1');
      expect(peer).toBeDefined();
      expect(peer!.rssi).toBe(-40);
      expect(peer!.name).toBe('NewName');
      expect(pm.getAllPeers()).toHaveLength(1);
    });

    it('should preserve reputation when merging', () => {
      const pm = createPeerManager();

      const peer1 = createTestPeer({ id: 'peer-1' });
      pm.addPeer(peer1);

      // Update reputation through the manager
      pm.updateReputation('peer-1', true);
      pm.updateReputation('peer-1', true);
      pm.updateReputation('peer-1', true);

      // Re-add same peer (should not reset reputation)
      const peer2 = createTestPeer({ id: 'peer-1' });
      pm.addPeer(peer2);

      const finalPeer = pm.getPeer('peer-1')!;
      expect(finalPeer.reputation.validDTUs).toBe(3);
    });

    it('should merge capabilities', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({
        id: 'peer-1',
        capabilities: { bluetooth: true, wifiDirect: false, nfc: false, lora: false, internet: false },
      }));
      pm.addPeer(createTestPeer({
        id: 'peer-1',
        capabilities: { bluetooth: false, wifiDirect: true, nfc: false, lora: false, internet: false },
      }));

      const peer = pm.getPeer('peer-1')!;
      expect(peer.capabilities.bluetooth).toBe(true);
      expect(peer.capabilities.wifiDirect).toBe(true);
    });

    it('should update authenticated status (OR merge)', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'peer-1', authenticated: true }));
      pm.addPeer(createTestPeer({ id: 'peer-1', authenticated: false }));

      expect(pm.getPeer('peer-1')!.authenticated).toBe(true);
    });

    it('should update public key when provided', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'peer-1', publicKey: '' }));
      pm.addPeer(createTestPeer({ id: 'peer-1', publicKey: 'real-key-abc' }));

      expect(pm.getPeer('peer-1')!.publicKey).toBe('real-key-abc');
    });
  });

  describe('removePeer', () => {
    it('should remove an existing peer', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1' }));

      pm.removePeer('peer-1');

      expect(pm.getPeer('peer-1')).toBeUndefined();
      expect(pm.getAllPeers()).toHaveLength(0);
    });

    it('should not throw when removing non-existent peer', () => {
      const pm = createPeerManager();

      expect(() => pm.removePeer('non-existent')).not.toThrow();
    });
  });

  describe('getPeer', () => {
    it('should return undefined for unknown peer', () => {
      const pm = createPeerManager();
      expect(pm.getPeer('unknown')).toBeUndefined();
    });

    it('should return the peer object', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1', name: 'Alice' }));

      const peer = pm.getPeer('peer-1');
      expect(peer).toBeDefined();
      expect(peer!.name).toBe('Alice');
    });
  });

  describe('getAllPeers', () => {
    it('should return empty array for no peers', () => {
      const pm = createPeerManager();
      expect(pm.getAllPeers()).toEqual([]);
    });

    it('should return all added peers', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'p1' }));
      pm.addPeer(createTestPeer({ id: 'p2' }));
      pm.addPeer(createTestPeer({ id: 'p3' }));

      expect(pm.getAllPeers()).toHaveLength(3);
    });
  });

  describe('getActivePeers', () => {
    it('should return only recently seen peers', () => {
      jest.useFakeTimers();
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'active', lastSeen: Date.now() }));
      pm.addPeer(createTestPeer({ id: 'stale', lastSeen: Date.now() - 120000 }));

      const active = pm.getActivePeers();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');

      jest.useRealTimers();
    });

    it('should use 1 minute threshold', () => {
      jest.useFakeTimers();
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'recent', lastSeen: Date.now() - 30000 }));
      pm.addPeer(createTestPeer({ id: 'old', lastSeen: Date.now() - 90000 }));

      const active = pm.getActivePeers();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('recent');

      jest.useRealTimers();
    });

    it('should return empty array when all stale', () => {
      jest.useFakeTimers();
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'p1', lastSeen: Date.now() - 120000 }));
      pm.addPeer(createTestPeer({ id: 'p2', lastSeen: Date.now() - 120000 }));

      expect(pm.getActivePeers()).toHaveLength(0);

      jest.useRealTimers();
    });
  });

  describe('updateReputation', () => {
    it('should increment validDTUs for valid DTU', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1' }));

      pm.updateReputation('peer-1', true);

      const peer = pm.getPeer('peer-1')!;
      expect(peer.reputation.validDTUs).toBe(1);
      expect(peer.reputation.totalRelays).toBe(1);
    });

    it('should increment invalidDTUs for invalid DTU', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1' }));

      pm.updateReputation('peer-1', false);

      const peer = pm.getPeer('peer-1')!;
      expect(peer.reputation.invalidDTUs).toBe(1);
    });

    it('should recalculate score after update', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1' }));

      pm.updateReputation('peer-1', true);
      pm.updateReputation('peer-1', true);
      pm.updateReputation('peer-1', true);

      const peer = pm.getPeer('peer-1')!;
      expect(peer.reputation.score).toBe(1.0);
    });

    it('should decrease score for invalid DTU', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1' }));

      pm.updateReputation('peer-1', true);
      pm.updateReputation('peer-1', true);
      pm.updateReputation('peer-1', false);

      const peer = pm.getPeer('peer-1')!;
      // 2 / (2 + 1*3) = 2/5 = 0.4
      expect(peer.reputation.score).toBe(0.4);
    });

    it('should ignore unknown peers', () => {
      const pm = createPeerManager();

      // Should not throw
      pm.updateReputation('unknown-peer', true);
    });

    it('should not increment totalRelays for invalid DTU', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1' }));

      pm.updateReputation('peer-1', false);

      expect(pm.getPeer('peer-1')!.reputation.totalRelays).toBe(0);
    });
  });

  describe('getReputationScore', () => {
    it('should return 0 for unknown peer', () => {
      const pm = createPeerManager();
      expect(pm.getReputationScore('unknown')).toBe(0);
    });

    it('should return current score', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'peer-1' }));

      pm.updateReputation('peer-1', true);

      expect(pm.getReputationScore('peer-1')).toBe(1.0);
    });
  });

  describe('pruneStale', () => {
    it('should remove peers older than maxAgeMs', () => {
      jest.useFakeTimers();
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'fresh', lastSeen: Date.now() }));
      pm.addPeer(createTestPeer({ id: 'stale', lastSeen: Date.now() - 120000 }));

      const pruned = pm.pruneStale(60000);

      expect(pruned).toEqual(['stale']);
      expect(pm.getAllPeers()).toHaveLength(1);

      jest.useRealTimers();
    });

    it('should return empty array when nothing pruned', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer({ id: 'fresh' }));

      const pruned = pm.pruneStale(60000);
      expect(pruned).toEqual([]);
    });

    it('should handle empty peer list', () => {
      const pm = createPeerManager();
      const pruned = pm.pruneStale(60000);
      expect(pruned).toEqual([]);
    });

    it('should prune multiple stale peers', () => {
      jest.useFakeTimers();
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'stale-1', lastSeen: Date.now() - 200000 }));
      pm.addPeer(createTestPeer({ id: 'stale-2', lastSeen: Date.now() - 300000 }));
      pm.addPeer(createTestPeer({ id: 'fresh', lastSeen: Date.now() }));

      const pruned = pm.pruneStale(60000);

      expect(pruned).toHaveLength(2);
      expect(pruned).toContain('stale-1');
      expect(pruned).toContain('stale-2');
      expect(pm.getAllPeers()).toHaveLength(1);

      jest.useRealTimers();
    });
  });

  describe('selectBestPeers', () => {
    it('should return requested number of peers', () => {
      const pm = createPeerManager();

      for (let i = 0; i < 10; i++) {
        pm.addPeer(createTestPeer({ id: `p${i}` }));
      }

      expect(pm.selectBestPeers(3)).toHaveLength(3);
    });

    it('should return all peers if count exceeds total', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'p1' }));
      pm.addPeer(createTestPeer({ id: 'p2' }));

      expect(pm.selectBestPeers(10)).toHaveLength(2);
    });

    it('should sort by combined score (reputation + RSSI)', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({
        id: 'good-close',
        rssi: -30,
        reputation: { validDTUs: 10, invalidDTUs: 0, totalRelays: 10, score: 1.0 },
      }));
      pm.addPeer(createTestPeer({
        id: 'bad-far',
        rssi: -90,
        reputation: { validDTUs: 0, invalidDTUs: 5, totalRelays: 5, score: 0.0 },
      }));
      pm.addPeer(createTestPeer({
        id: 'neutral',
        rssi: -55,
        reputation: { validDTUs: 5, invalidDTUs: 0, totalRelays: 5, score: 1.0 },
      }));

      const best = pm.selectBestPeers(3);

      expect(best[0].id).toBe('good-close');
      expect(best[best.length - 1].id).toBe('bad-far');
    });

    it('should return empty array when no peers', () => {
      const pm = createPeerManager();
      expect(pm.selectBestPeers(5)).toEqual([]);
    });

    it('should handle count=0', () => {
      const pm = createPeerManager();
      pm.addPeer(createTestPeer());

      expect(pm.selectBestPeers(0)).toEqual([]);
    });
  });

  describe('getPeersByTransport', () => {
    it('should filter by transport layer', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ id: 'ble-1', transport: TRANSPORT_LAYERS.BLUETOOTH }));
      pm.addPeer(createTestPeer({ id: 'ble-2', transport: TRANSPORT_LAYERS.BLUETOOTH }));
      pm.addPeer(createTestPeer({ id: 'wifi-1', transport: TRANSPORT_LAYERS.WIFI_DIRECT }));
      pm.addPeer(createTestPeer({ id: 'lora-1', transport: TRANSPORT_LAYERS.LORA }));

      const blePeers = pm.getPeersByTransport(TRANSPORT_LAYERS.BLUETOOTH);
      expect(blePeers).toHaveLength(2);

      const wifiPeers = pm.getPeersByTransport(TRANSPORT_LAYERS.WIFI_DIRECT);
      expect(wifiPeers).toHaveLength(1);

      const loraPeers = pm.getPeersByTransport(TRANSPORT_LAYERS.LORA);
      expect(loraPeers).toHaveLength(1);
    });

    it('should return empty for transport with no peers', () => {
      const pm = createPeerManager();

      pm.addPeer(createTestPeer({ transport: TRANSPORT_LAYERS.BLUETOOTH }));

      expect(pm.getPeersByTransport(TRANSPORT_LAYERS.NFC)).toEqual([]);
    });

    it('should return empty array for empty peer list', () => {
      const pm = createPeerManager();
      expect(pm.getPeersByTransport(TRANSPORT_LAYERS.BLUETOOTH)).toEqual([]);
    });
  });
});
