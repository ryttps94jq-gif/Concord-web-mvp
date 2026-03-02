// Tests for Broadcast Bridge — DTU bridging between broadcast, mesh, and internet

import {
  createBroadcastBridge,
  verifyDTUIntegrity,
  DEFAULT_CONFIG,
} from '../../broadcast/bridge/broadcast-bridge';
import type {
  BroadcastBridge,
  MeshController,
  DTUStore,
} from '../../broadcast/bridge/broadcast-bridge';
import type { BroadcastConfig, BroadcastDTU, DTU, DTUHeader } from '../../utils/types';
import { DTU_TYPES } from '../../utils/constants';

// ── Mock Mesh Controller ─────────────────────────────────────────────────────

function createMockMeshController(): MeshController & { _broadcastedDTUs: DTU[] } {
  const broadcastedDTUs: DTU[] = [];
  return {
    _broadcastedDTUs: broadcastedDTUs,
    broadcastDTU: jest.fn(async (dtu: DTU) => {
      broadcastedDTUs.push(dtu);
      return true;
    }),
    isConnected: jest.fn(() => true),
    getPeerCount: jest.fn(() => 3),
  };
}

// ── Mock DTU Store ───────────────────────────────────────────────────────────

function createMockDTUStore(): DTUStore & { _store: Map<string, DTU> } {
  const store = new Map<string, DTU>();
  return {
    _store: store,
    storeDTU: jest.fn(async (dtu: DTU) => {
      store.set(dtu.id, dtu);
      return true;
    }),
    hasDTU: jest.fn(async (id: string) => store.has(id)),
    getDTU: jest.fn(async (id: string) => store.get(id) || null),
  };
}

// ── Test DTU Factory ─────────────────────────────────────────────────────────

function makeTestDTU(overrides: Partial<DTU> = {}): DTU {
  return {
    id: 'dtu_test_001',
    header: {
      version: 1,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: Date.now(),
      contentLength: 10,
      contentHash: new Uint8Array(32).fill(0xAB),
    },
    content: new Uint8Array(10).fill(0x42),
    tags: ['test'],
    meta: {
      scope: 'regional',
      published: true,
      painTagged: false,
      crpiScore: 0.5,
      originTransport: 5,
      relayCount: 0,
      ttl: 7,
      receivedAt: Date.now(),
    },
    ...overrides,
  };
}

function makeBroadcastDTU(dtuOverrides: Partial<DTU> = {}): BroadcastDTU {
  return {
    dtu: makeTestDTU(dtuOverrides),
    source: 'fm',
    receivedAt: Date.now(),
    signalStrength: 0.8,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BroadcastBridge', () => {
  let meshController: ReturnType<typeof createMockMeshController>;
  let store: ReturnType<typeof createMockDTUStore>;
  let bridge: BroadcastBridge;

  beforeEach(() => {
    meshController = createMockMeshController();
    store = createMockDTUStore();
    bridge = createBroadcastBridge(meshController, store);
    // Enable bridge mode
    bridge.configure({
      fmEnabled: true,
      dabEnabled: false,
      bridgeModeEnabled: true,
      internetBridgeEnabled: false,
    });
  });

  // ── configure / getConfig ───────────────────────────────────────────────

  describe('configure', () => {
    it('stores configuration', () => {
      const config: BroadcastConfig = {
        fmEnabled: true,
        dabEnabled: true,
        bridgeModeEnabled: true,
        internetBridgeEnabled: true,
      };
      bridge.configure(config);
      expect(bridge.getConfig()).toEqual(config);
    });

    it('returns a copy of config', () => {
      const config = bridge.getConfig();
      config.fmEnabled = !config.fmEnabled;
      expect(bridge.getConfig().fmEnabled).not.toBe(config.fmEnabled);
    });

    it('has sensible defaults', () => {
      bridge = createBroadcastBridge(meshController, store);
      const config = bridge.getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  // ── onBroadcastDTU ──────────────────────────────────────────────────────

  describe('onBroadcastDTU', () => {
    it('ingests a valid broadcast DTU', async () => {
      const bdtu = makeBroadcastDTU();
      await bridge.onBroadcastDTU(bdtu);
      expect(store.storeDTU).toHaveBeenCalled();
    });

    it('increments bridged count', async () => {
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(bridge.getBridgedCount()).toBe(1);
    });

    it('relays to mesh peers', async () => {
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(meshController.broadcastDTU).toHaveBeenCalled();
    });

    it('decrements TTL on relay', async () => {
      const bdtu = makeBroadcastDTU();
      bdtu.dtu.meta.ttl = 5;
      await bridge.onBroadcastDTU(bdtu);
      const relayed = meshController._broadcastedDTUs[0];
      expect(relayed.meta.ttl).toBe(4);
    });

    it('increments relayCount on relay', async () => {
      const bdtu = makeBroadcastDTU();
      bdtu.dtu.meta.relayCount = 2;
      await bridge.onBroadcastDTU(bdtu);
      const relayed = meshController._broadcastedDTUs[0];
      expect(relayed.meta.relayCount).toBe(3);
    });

    it('does not relay when TTL would reach 0', async () => {
      const bdtu = makeBroadcastDTU();
      bdtu.dtu.meta.ttl = 1;
      await bridge.onBroadcastDTU(bdtu);
      // TTL-1 = 0, so no relay
      expect(meshController.broadcastDTU).not.toHaveBeenCalled();
    });

    it('does not relay when no mesh peers', async () => {
      (meshController.getPeerCount as jest.Mock).mockReturnValue(0);
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(meshController.broadcastDTU).not.toHaveBeenCalled();
    });

    it('does not relay when mesh not connected', async () => {
      (meshController.isConnected as jest.Mock).mockReturnValue(false);
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(meshController.broadcastDTU).not.toHaveBeenCalled();
    });

    it('ignores when bridge mode disabled', async () => {
      bridge.configure({
        fmEnabled: true,
        dabEnabled: false,
        bridgeModeEnabled: false,
        internetBridgeEnabled: false,
      });
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(store.storeDTU).not.toHaveBeenCalled();
      expect(bridge.getBridgedCount()).toBe(0);
    });

    it('stores DTU before relaying', async () => {
      const callOrder: string[] = [];
      (store.storeDTU as jest.Mock).mockImplementation(async () => {
        callOrder.push('store');
        return true;
      });
      (meshController.broadcastDTU as jest.Mock).mockImplementation(async () => {
        callOrder.push('relay');
        return true;
      });

      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(callOrder).toEqual(['store', 'relay']);
    });
  });

  // ── Dedup: same DTU via broadcast and mesh stored once ──────────────────

  describe('deduplication', () => {
    it('does not store duplicate DTU by ID', async () => {
      const bdtu = makeBroadcastDTU();
      await bridge.onBroadcastDTU(bdtu);

      // Same DTU arrives again
      await bridge.onBroadcastDTU(bdtu);

      // Only stored once (second time hasDTU returns true)
      expect(store.storeDTU).toHaveBeenCalledTimes(1);
    });

    it('deduplicates by content hash', async () => {
      // Two DTUs with different IDs but same content hash
      const hash = new Uint8Array(32).fill(0xDE);
      const bdtu1 = makeBroadcastDTU({ id: 'dtu_a' });
      bdtu1.dtu.header.contentHash = hash;
      const bdtu2 = makeBroadcastDTU({ id: 'dtu_b' });
      bdtu2.dtu.header.contentHash = hash;

      await bridge.onBroadcastDTU(bdtu1);
      await bridge.onBroadcastDTU(bdtu2);

      // First stored, second deduplicated by content hash
      expect(store.storeDTU).toHaveBeenCalledTimes(1);
      expect(bridge.getBridgedCount()).toBe(1);
    });

    it('allows DTUs with different content hashes', async () => {
      const bdtu1 = makeBroadcastDTU({ id: 'dtu_x' });
      bdtu1.dtu.header.contentHash = new Uint8Array(32).fill(0x01);
      const bdtu2 = makeBroadcastDTU({ id: 'dtu_y' });
      bdtu2.dtu.header.contentHash = new Uint8Array(32).fill(0x02);

      await bridge.onBroadcastDTU(bdtu1);
      await bridge.onBroadcastDTU(bdtu2);

      expect(store.storeDTU).toHaveBeenCalledTimes(2);
      expect(bridge.getBridgedCount()).toBe(2);
    });
  });

  // ── Integrity check ────────────────────────────────────────────────────

  describe('integrity check', () => {
    it('rejects DTU with missing ID', async () => {
      const bdtu = makeBroadcastDTU({ id: '' });
      await bridge.onBroadcastDTU(bdtu);
      expect(store.storeDTU).not.toHaveBeenCalled();
    });

    it('rejects DTU with content length mismatch', async () => {
      const bdtu = makeBroadcastDTU();
      bdtu.dtu.header.contentLength = 999; // Doesn't match content.length
      await bridge.onBroadcastDTU(bdtu);
      expect(store.storeDTU).not.toHaveBeenCalled();
    });

    it('rejects DTU with far-future timestamp', async () => {
      const bdtu = makeBroadcastDTU();
      bdtu.dtu.header.timestamp = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 days
      await bridge.onBroadcastDTU(bdtu);
      expect(store.storeDTU).not.toHaveBeenCalled();
    });

    it('rejects DTU with TTL <= 0', async () => {
      const bdtu = makeBroadcastDTU();
      bdtu.dtu.meta.ttl = 0;
      await bridge.onBroadcastDTU(bdtu);
      expect(store.storeDTU).not.toHaveBeenCalled();
    });

    it('rejects DTU with missing header', async () => {
      const bdtu = makeBroadcastDTU();
      (bdtu.dtu as any).header = null;
      await bridge.onBroadcastDTU(bdtu);
      expect(store.storeDTU).not.toHaveBeenCalled();
    });

    it('rejects DTU with empty content hash', async () => {
      const bdtu = makeBroadcastDTU();
      bdtu.dtu.header.contentHash = new Uint8Array(0);
      await bridge.onBroadcastDTU(bdtu);
      expect(store.storeDTU).not.toHaveBeenCalled();
    });
  });

  // ── verifyDTUIntegrity (exported) ──────────────────────────────────────

  describe('verifyDTUIntegrity', () => {
    it('returns true for valid DTU', () => {
      expect(verifyDTUIntegrity(makeTestDTU())).toBe(true);
    });

    it('returns false for missing ID', () => {
      expect(verifyDTUIntegrity(makeTestDTU({ id: '' }))).toBe(false);
    });

    it('returns false for content length mismatch', () => {
      const dtu = makeTestDTU();
      dtu.header.contentLength = 999;
      expect(verifyDTUIntegrity(dtu)).toBe(false);
    });

    it('returns false for far-future timestamp', () => {
      const dtu = makeTestDTU();
      dtu.header.timestamp = Date.now() + 48 * 60 * 60 * 1000;
      expect(verifyDTUIntegrity(dtu)).toBe(false);
    });

    it('returns false for zero TTL', () => {
      const dtu = makeTestDTU();
      dtu.meta.ttl = 0;
      expect(verifyDTUIntegrity(dtu)).toBe(false);
    });

    it('returns false for negative TTL', () => {
      const dtu = makeTestDTU();
      dtu.meta.ttl = -1;
      expect(verifyDTUIntegrity(dtu)).toBe(false);
    });
  });

  // ── Internet bridge ────────────────────────────────────────────────────

  describe('internet bridge', () => {
    beforeEach(() => {
      (global as any).fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
      }));
    });

    afterEach(() => {
      delete (global as any).fetch;
    });

    it('forwards to server when internet bridge enabled', async () => {
      bridge.configure({
        fmEnabled: true,
        dabEnabled: false,
        bridgeModeEnabled: true,
        internetBridgeEnabled: true,
      });
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect((global as any).fetch).toHaveBeenCalled();
    });

    it('does not forward when internet bridge disabled', async () => {
      bridge.configure({
        fmEnabled: true,
        dabEnabled: false,
        bridgeModeEnabled: true,
        internetBridgeEnabled: false,
      });
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('continues even if server forward fails', async () => {
      bridge.configure({
        fmEnabled: true,
        dabEnabled: false,
        bridgeModeEnabled: true,
        internetBridgeEnabled: true,
      });
      (global as any).fetch = jest.fn(async () => { throw new Error('Network error'); });
      await expect(bridge.onBroadcastDTU(makeBroadcastDTU())).resolves.not.toThrow();
      expect(bridge.getBridgedCount()).toBe(1);
    });
  });

  // ── Storage failure ────────────────────────────────────────────────────

  describe('storage failure', () => {
    it('does not increment bridged count on storage failure', async () => {
      (store.storeDTU as jest.Mock).mockResolvedValueOnce(false);
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(bridge.getBridgedCount()).toBe(0);
    });

    it('does not relay on storage failure', async () => {
      (store.storeDTU as jest.Mock).mockResolvedValueOnce(false);
      await bridge.onBroadcastDTU(makeBroadcastDTU());
      expect(meshController.broadcastDTU).not.toHaveBeenCalled();
    });
  });

  // ── getBridgedCount ────────────────────────────────────────────────────

  describe('getBridgedCount', () => {
    it('starts at 0', () => {
      expect(bridge.getBridgedCount()).toBe(0);
    });

    it('increments for each unique bridged DTU', async () => {
      await bridge.onBroadcastDTU(makeBroadcastDTU({ id: 'a' }));
      await bridge.onBroadcastDTU(makeBroadcastDTU({ id: 'b' }));
      expect(bridge.getBridgedCount()).toBe(2);
    });
  });
});
