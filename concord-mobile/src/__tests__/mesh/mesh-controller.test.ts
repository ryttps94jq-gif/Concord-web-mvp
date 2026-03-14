// Tests for Mesh Controller
import { createMeshController } from '../../mesh/bluetooth/mesh-controller';
import type { MeshControllerDeps } from '../../mesh/bluetooth/mesh-controller';
import type { BLEAdvertiser } from '../../mesh/bluetooth/ble-advertiser';
import type { BLEScanner } from '../../mesh/bluetooth/ble-scanner';
import type { BLETransfer, TransferResult } from '../../mesh/bluetooth/ble-transfer';
import type { RelayEngine, RelayResult, RelayQueueStats } from '../../mesh/transport/relay';
import type { PeerManager } from '../../mesh/transport/peer-manager';
import type { DTU, MeshPeer } from '../../utils/types';
import { DTU_TYPES, DEFAULT_DTU_TTL, TRANSPORT_LAYERS } from '../../utils/constants';

// ── Mock Factories ────────────────────────────────────────────────────────────

function createMockAdvertiser(overrides?: Partial<BLEAdvertiser>): BLEAdvertiser {
  let advertising = false;
  return {
    start: jest.fn().mockImplementation(async () => { advertising = true; }),
    stop: jest.fn().mockImplementation(async () => { advertising = false; }),
    isAdvertising: jest.fn().mockImplementation(() => advertising),
    getServiceUUID: jest.fn().mockReturnValue('test-uuid'),
    ...overrides,
  };
}

function createMockScanner(overrides?: Partial<BLEScanner>): BLEScanner & { _onPeerDiscovered: ((peer: MeshPeer) => void) | null } {
  const mock: BLEScanner & { _onPeerDiscovered: ((peer: MeshPeer) => void) | null } = {
    _onPeerDiscovered: null,
    startScan: jest.fn().mockImplementation(async (cb: (peer: MeshPeer) => void) => {
      mock._onPeerDiscovered = cb;
    }),
    stopScan: jest.fn().mockResolvedValue(undefined),
    isScanning: jest.fn().mockReturnValue(false),
    getDiscoveredPeers: jest.fn().mockReturnValue([]),
    clearPeers: jest.fn(),
    ...overrides,
  };
  return mock;
}

type DTUReceivedCallback = (dtu: DTU, peerId: string) => void;

function createMockTransfer(overrides?: Partial<BLETransfer>): BLETransfer & { _receiveCallbacks: DTUReceivedCallback[] } {
  const callbacks: DTUReceivedCallback[] = [];
  const mock: BLETransfer & { _receiveCallbacks: DTUReceivedCallback[] } = {
    _receiveCallbacks: callbacks,
    sendDTU: jest.fn().mockImplementation(async (_peerId: string, dtu: DTU): Promise<TransferResult> => ({
      success: true,
      dtuId: dtu.id,
      bytesTransferred: 100,
      durationMs: 10,
      chunks: 1,
    })),
    onDTUReceived: jest.fn().mockImplementation((cb: DTUReceivedCallback) => {
      callbacks.push(cb);
    }),
    getActiveTransfers: jest.fn().mockReturnValue([]),
    cancelTransfer: jest.fn(),
    ...overrides,
  };
  return mock;
}

function createMockRelay(overrides?: Partial<RelayEngine>): RelayEngine {
  return {
    enqueue: jest.fn(),
    processQueue: jest.fn().mockResolvedValue({ sent: 0, failed: 0, skipped: 0, expired: 0 } as RelayResult),
    isDuplicate: jest.fn().mockReturnValue(false),
    markSeen: jest.fn(),
    getQueueDepth: jest.fn().mockReturnValue(0),
    getQueueStats: jest.fn().mockReturnValue({
      totalEntries: 0,
      byPriority: {},
      oldestEntryAge: 0,
      seenHashCount: 0,
    } as RelayQueueStats),
    clearExpired: jest.fn().mockReturnValue(0),
    ...overrides,
  };
}

function createMockPeerManager(overrides?: Partial<PeerManager>): PeerManager {
  const peers = new Map<string, MeshPeer>();
  return {
    addPeer: jest.fn().mockImplementation((peer: MeshPeer) => {
      peers.set(peer.id, peer);
    }),
    removePeer: jest.fn().mockImplementation((id: string) => {
      peers.delete(id);
    }),
    getPeer: jest.fn().mockImplementation((id: string) => peers.get(id)),
    getAllPeers: jest.fn().mockImplementation(() => Array.from(peers.values())),
    getActivePeers: jest.fn().mockImplementation(() => Array.from(peers.values())),
    updateReputation: jest.fn(),
    getReputationScore: jest.fn().mockReturnValue(0.5),
    pruneStale: jest.fn().mockReturnValue([]),
    selectBestPeers: jest.fn().mockReturnValue([]),
    getPeersByTransport: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

function createTestDTU(overrides?: Partial<DTU>): DTU {
  const content = new Uint8Array([1, 2, 3]);
  const contentHash = new Uint8Array(32);
  contentHash[0] = Math.floor(Math.random() * 256);
  contentHash[1] = Math.floor(Math.random() * 256);

  return {
    id: `dtu_test_${Math.random().toString(36).slice(2)}`,
    header: {
      version: 1,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: Date.now(),
      contentLength: content.length,
      contentHash,
    },
    content,
    tags: [],
    meta: {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: DEFAULT_DTU_TTL,
    },
    ...overrides,
  };
}

function createTestPeer(overrides?: Partial<MeshPeer>): MeshPeer {
  return {
    id: overrides?.id ?? `peer_${Math.random().toString(36).slice(2)}`,
    publicKey: 'test-key',
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

function createDeps(overrides?: Partial<MeshControllerDeps>): MeshControllerDeps {
  return {
    advertiser: createMockAdvertiser(),
    scanner: createMockScanner(),
    transfer: createMockTransfer(),
    relay: createMockRelay(),
    peerManager: createMockPeerManager(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Mesh Controller', () => {
  describe('createMeshController', () => {
    it('should create a controller instance', () => {
      const controller = createMeshController(createDeps());

      expect(controller).toBeDefined();
      expect(controller.start).toBeInstanceOf(Function);
      expect(controller.stop).toBeInstanceOf(Function);
      expect(controller.isRunning).toBeInstanceOf(Function);
      expect(controller.getMeshState).toBeInstanceOf(Function);
      expect(controller.getMeshHealth).toBeInstanceOf(Function);
      expect(controller.sendDTU).toBeInstanceOf(Function);
      expect(controller.onDTUReceived).toBeInstanceOf(Function);
      expect(controller.tick).toBeInstanceOf(Function);
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      const controller = createMeshController(createDeps());
      expect(controller.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      const controller = createMeshController(createDeps());
      await controller.start();
      expect(controller.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      const controller = createMeshController(createDeps());
      await controller.start();
      await controller.stop();
      expect(controller.isRunning()).toBe(false);
    });
  });

  describe('start', () => {
    it('should start advertiser and scanner', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);

      await controller.start();

      expect(deps.advertiser.start).toHaveBeenCalled();
      expect(deps.scanner.startScan).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);

      await controller.start();
      await controller.start();

      expect(deps.advertiser.start).toHaveBeenCalledTimes(1);
      expect(deps.scanner.startScan).toHaveBeenCalledTimes(1);
    });

    it('should add discovered peers to peer manager', async () => {
      const deps = createDeps();
      const scanner = deps.scanner as ReturnType<typeof createMockScanner>;
      const controller = createMeshController(deps);

      await controller.start();

      // Simulate peer discovery
      const peer = createTestPeer({ id: 'discovered-peer' });
      scanner._onPeerDiscovered!(peer);

      expect(deps.peerManager.addPeer).toHaveBeenCalledWith(peer);
    });
  });

  describe('stop', () => {
    it('should stop scanner and advertiser', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);

      await controller.start();
      await controller.stop();

      expect(deps.scanner.stopScan).toHaveBeenCalled();
      expect(deps.advertiser.stop).toHaveBeenCalled();
    });

    it('should be idempotent when not running', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);

      await controller.stop();

      expect(deps.scanner.stopScan).not.toHaveBeenCalled();
      expect(deps.advertiser.stop).not.toHaveBeenCalled();
    });
  });

  describe('sendDTU', () => {
    it('should send DTU to all active peers', async () => {
      const peer1 = createTestPeer({ id: 'peer-1' });
      const peer2 = createTestPeer({ id: 'peer-2' });
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([peer1, peer2]),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      const dtu = createTestDTU();
      await controller.sendDTU(dtu);

      expect(deps.transfer.sendDTU).toHaveBeenCalledTimes(2);
    });

    it('should mark DTU as seen in relay', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);
      await controller.start();

      const dtu = createTestDTU();
      await controller.sendDTU(dtu);

      expect(deps.relay.markSeen).toHaveBeenCalled();
    });

    it('should enqueue DTU in relay for future peers', async () => {
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([]),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      const dtu = createTestDTU({ meta: { scope: 'local', published: false, painTagged: false, crpiScore: 0, relayCount: 0, ttl: 5 } });
      await controller.sendDTU(dtu);

      expect(deps.relay.enqueue).toHaveBeenCalledWith(dtu, []);
    });

    it('should not enqueue DTU with TTL=0', async () => {
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([]),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      const dtu = createTestDTU({ meta: { scope: 'local', published: false, painTagged: false, crpiScore: 0, relayCount: 0, ttl: 0 } });
      await controller.sendDTU(dtu);

      expect(deps.relay.enqueue).not.toHaveBeenCalled();
    });

    it('should handle transfer failures gracefully', async () => {
      const peer = createTestPeer({ id: 'peer-1' });
      const transfer = createMockTransfer({
        sendDTU: jest.fn().mockRejectedValue(new Error('Connection lost')),
      });
      const deps = createDeps({
        transfer,
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([peer]),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      // Should not throw
      await expect(controller.sendDTU(createTestDTU())).resolves.not.toThrow();
    });

    it('should exclude already-sent peers from relay queue', async () => {
      const peer1 = createTestPeer({ id: 'peer-1' });
      const peer2 = createTestPeer({ id: 'peer-2' });
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([peer1, peer2]),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      const dtu = createTestDTU();
      await controller.sendDTU(dtu);

      expect(deps.relay.enqueue).toHaveBeenCalledWith(
        dtu,
        expect.arrayContaining(['peer-1', 'peer-2']),
      );
    });
  });

  describe('DTU reception', () => {
    it('should register receive handler on transfer', () => {
      const deps = createDeps();
      createMeshController(deps);

      expect(deps.transfer.onDTUReceived).toHaveBeenCalled();
    });

    it('should forward received DTUs to callbacks', async () => {
      const transfer = createMockTransfer();
      const deps = createDeps({ transfer });
      const controller = createMeshController(deps);

      const receivedDTUs: DTU[] = [];
      controller.onDTUReceived((dtu) => receivedDTUs.push(dtu));

      const dtu = createTestDTU();
      // Simulate receiving a DTU via transfer
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-sender');
      }

      expect(receivedDTUs).toHaveLength(1);
      expect(receivedDTUs[0].id).toBe(dtu.id);
    });

    it('should check deduplication on receive', async () => {
      const transfer = createMockTransfer();
      const relay = createMockRelay({ isDuplicate: jest.fn().mockReturnValue(true) });
      const deps = createDeps({ transfer, relay });
      const controller = createMeshController(deps);

      const receivedDTUs: DTU[] = [];
      controller.onDTUReceived((dtu) => receivedDTUs.push(dtu));

      const dtu = createTestDTU();
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-sender');
      }

      // Should be dropped as duplicate
      expect(receivedDTUs).toHaveLength(0);
    });

    it('should mark DTU as seen on receive', async () => {
      const transfer = createMockTransfer();
      const relay = createMockRelay();
      const deps = createDeps({ transfer, relay });
      createMeshController(deps);

      const dtu = createTestDTU();
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-sender');
      }

      expect(relay.markSeen).toHaveBeenCalled();
    });

    it('should update peer reputation on valid receive', async () => {
      const transfer = createMockTransfer();
      const peerManager = createMockPeerManager();
      const deps = createDeps({ transfer, peerManager });
      createMeshController(deps);

      const dtu = createTestDTU();
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-sender');
      }

      expect(peerManager.updateReputation).toHaveBeenCalledWith('peer-sender', true);
    });

    it('should enqueue received DTU for relay (excluding sender)', async () => {
      const transfer = createMockTransfer();
      const relay = createMockRelay();
      const deps = createDeps({ transfer, relay });
      createMeshController(deps);

      const dtu = createTestDTU();
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-sender');
      }

      expect(relay.enqueue).toHaveBeenCalledWith(dtu, ['peer-sender']);
    });

    it('should not relay DTU with TTL=0', async () => {
      const transfer = createMockTransfer();
      const relay = createMockRelay();
      const deps = createDeps({ transfer, relay });
      createMeshController(deps);

      const dtu = createTestDTU({
        meta: { scope: 'local', published: false, painTagged: false, crpiScore: 0, relayCount: 0, ttl: 0 },
      });
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-sender');
      }

      expect(relay.enqueue).not.toHaveBeenCalled();
    });

    it('should support multiple receive callbacks', async () => {
      const transfer = createMockTransfer();
      const deps = createDeps({ transfer });
      const controller = createMeshController(deps);

      const received1: DTU[] = [];
      const received2: DTU[] = [];
      controller.onDTUReceived((dtu) => received1.push(dtu));
      controller.onDTUReceived((dtu) => received2.push(dtu));

      const dtu = createTestDTU();
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-sender');
      }

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });
  });

  describe('tick', () => {
    it('should do nothing when not running', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);

      await controller.tick();

      expect(deps.peerManager.pruneStale).not.toHaveBeenCalled();
    });

    it('should prune stale peers', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);
      await controller.start();

      await controller.tick();

      expect(deps.peerManager.pruneStale).toHaveBeenCalledWith(120_000);
    });

    it('should clear expired relay entries', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);
      await controller.start();

      await controller.tick();

      expect(deps.relay.clearExpired).toHaveBeenCalled();
    });

    it('should process relay queue with active peers', async () => {
      const peer1 = createTestPeer({ id: 'p1' });
      const peer2 = createTestPeer({ id: 'p2' });
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([peer1, peer2]),
          pruneStale: jest.fn().mockReturnValue([]),
          addPeer: jest.fn(),
          removePeer: jest.fn(),
          getPeer: jest.fn(),
          getAllPeers: jest.fn().mockReturnValue([peer1, peer2]),
          updateReputation: jest.fn(),
          getReputationScore: jest.fn(),
          selectBestPeers: jest.fn(),
          getPeersByTransport: jest.fn(),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      await controller.tick();

      expect(deps.relay.processQueue).toHaveBeenCalledWith(
        expect.any(Function),
        ['p1', 'p2'],
      );
    });

    it('should not process relay queue with no active peers', async () => {
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([]),
          pruneStale: jest.fn().mockReturnValue([]),
          addPeer: jest.fn(),
          removePeer: jest.fn(),
          getPeer: jest.fn(),
          getAllPeers: jest.fn().mockReturnValue([]),
          updateReputation: jest.fn(),
          getReputationScore: jest.fn(),
          selectBestPeers: jest.fn(),
          getPeersByTransport: jest.fn(),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      await controller.tick();

      expect(deps.relay.processQueue).not.toHaveBeenCalled();
    });
  });

  describe('getMeshHealth', () => {
    it('should return zero health when not running', () => {
      const controller = createMeshController(createDeps());

      const health = controller.getMeshHealth();

      expect(health.uptime).toBe(0);
      expect(health.dtusPropagated).toBe(0);
      expect(health.dtusReceived).toBe(0);
    });

    it('should track uptime', async () => {
      jest.useFakeTimers();
      const deps = createDeps();
      const controller = createMeshController(deps);

      await controller.start();
      jest.advanceTimersByTime(5000);

      const health = controller.getMeshHealth();
      expect(health.uptime).toBeGreaterThanOrEqual(5000);

      jest.useRealTimers();
    });

    it('should count connected peers', async () => {
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([
            createTestPeer({ id: 'p1' }),
            createTestPeer({ id: 'p2' }),
          ]),
          addPeer: jest.fn(),
          removePeer: jest.fn(),
          getPeer: jest.fn(),
          getAllPeers: jest.fn().mockReturnValue([]),
          updateReputation: jest.fn(),
          getReputationScore: jest.fn(),
          pruneStale: jest.fn(),
          selectBestPeers: jest.fn(),
          getPeersByTransport: jest.fn(),
        }),
      });
      const controller = createMeshController(deps);

      const health = controller.getMeshHealth();
      expect(health.connectedPeers).toBe(2);
    });

    it('should report relay queue depth', () => {
      const deps = createDeps({
        relay: createMockRelay({
          getQueueDepth: jest.fn().mockReturnValue(42),
        }),
      });
      const controller = createMeshController(deps);

      const health = controller.getMeshHealth();
      expect(health.relayQueueDepth).toBe(42);
    });

    it('should track DTUs propagated', async () => {
      const peer = createTestPeer({ id: 'peer-1' });
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([peer]),
          addPeer: jest.fn(),
          removePeer: jest.fn(),
          getPeer: jest.fn(),
          getAllPeers: jest.fn().mockReturnValue([peer]),
          updateReputation: jest.fn(),
          getReputationScore: jest.fn(),
          pruneStale: jest.fn(),
          selectBestPeers: jest.fn(),
          getPeersByTransport: jest.fn(),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      await controller.sendDTU(createTestDTU());

      const health = controller.getMeshHealth();
      expect(health.dtusPropagated).toBe(1);
    });

    it('should track DTUs received', async () => {
      const transfer = createMockTransfer();
      const deps = createDeps({ transfer });
      const controller = createMeshController(deps);

      const dtu = createTestDTU();
      for (const cb of transfer._receiveCallbacks) {
        cb(dtu, 'peer-1');
      }

      const health = controller.getMeshHealth();
      expect(health.dtusReceived).toBe(1);
    });

    it('should report active transports based on advertiser', async () => {
      const advertiser = createMockAdvertiser();
      const deps = createDeps({ advertiser });
      const controller = createMeshController(deps);

      await controller.start();

      const health = controller.getMeshHealth();
      expect(health.activeTransports).toBe(1);
    });

    it('should report 0 active transports when not advertising', () => {
      const advertiser = createMockAdvertiser({
        isAdvertising: jest.fn().mockReturnValue(false),
      });
      const deps = createDeps({ advertiser });
      const controller = createMeshController(deps);

      const health = controller.getMeshHealth();
      expect(health.activeTransports).toBe(0);
    });
  });

  describe('getMeshState', () => {
    it('should return mesh state object', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);
      await controller.start();

      const state = controller.getMeshState();

      expect(state).toBeDefined();
      expect(state.peers).toBeInstanceOf(Map);
      expect(state.transports).toBeInstanceOf(Array);
      expect(state.meshHealth).toBeDefined();
    });

    it('should include bluetooth transport status', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);
      await controller.start();

      const state = controller.getMeshState();

      const bleTransport = state.transports.find(
        t => t.layer === TRANSPORT_LAYERS.BLUETOOTH,
      );
      expect(bleTransport).toBeDefined();
      expect(bleTransport!.available).toBe(true);
      expect(bleTransport!.active).toBe(true);
    });

    it('should report correct active peer count', async () => {
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([
            createTestPeer({ id: 'p1' }),
          ]),
          addPeer: jest.fn(),
          removePeer: jest.fn(),
          getPeer: jest.fn(),
          getAllPeers: jest.fn().mockReturnValue([createTestPeer({ id: 'p1' })]),
          updateReputation: jest.fn(),
          getReputationScore: jest.fn(),
          pruneStale: jest.fn(),
          selectBestPeers: jest.fn(),
          getPeersByTransport: jest.fn(),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      const state = controller.getMeshState();
      expect(state.activePeers).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle start failure from advertiser', async () => {
      const deps = createDeps({
        advertiser: createMockAdvertiser({
          start: jest.fn().mockRejectedValue(new Error('BLE not ready')),
        }),
      });
      const controller = createMeshController(deps);

      await expect(controller.start()).rejects.toThrow('BLE not ready');
      expect(controller.isRunning()).toBe(false);
    });

    it('should handle start failure from scanner', async () => {
      const deps = createDeps({
        scanner: createMockScanner({
          startScan: jest.fn().mockRejectedValue(new Error('Scan failed')),
        }),
      });
      const controller = createMeshController(deps);

      await expect(controller.start()).rejects.toThrow('Scan failed');
    });

    it('should handle rapid start/stop cycles', async () => {
      const deps = createDeps();
      const controller = createMeshController(deps);

      await controller.start();
      await controller.stop();
      await controller.start();
      await controller.stop();

      expect(deps.advertiser.start).toHaveBeenCalledTimes(2);
      expect(deps.advertiser.stop).toHaveBeenCalledTimes(2);
    });

    it('should handle tick with relay queue processing error', async () => {
      const deps = createDeps({
        relay: createMockRelay({
          processQueue: jest.fn().mockRejectedValue(new Error('Queue error')),
          clearExpired: jest.fn(),
          getQueueDepth: jest.fn().mockReturnValue(0),
          getQueueStats: jest.fn().mockReturnValue({
            totalEntries: 0, byPriority: {}, oldestEntryAge: 0, seenHashCount: 0,
          }),
        }),
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([createTestPeer()]),
          pruneStale: jest.fn().mockReturnValue([]),
          addPeer: jest.fn(),
          removePeer: jest.fn(),
          getPeer: jest.fn(),
          getAllPeers: jest.fn(),
          updateReputation: jest.fn(),
          getReputationScore: jest.fn(),
          selectBestPeers: jest.fn(),
          getPeersByTransport: jest.fn(),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      // Should propagate the error
      await expect(controller.tick()).rejects.toThrow('Queue error');
    });

    it('should handle concurrent sendDTU calls', async () => {
      const peer = createTestPeer({ id: 'peer-1' });
      const deps = createDeps({
        peerManager: createMockPeerManager({
          getActivePeers: jest.fn().mockReturnValue([peer]),
          addPeer: jest.fn(),
          removePeer: jest.fn(),
          getPeer: jest.fn(),
          getAllPeers: jest.fn().mockReturnValue([peer]),
          updateReputation: jest.fn(),
          getReputationScore: jest.fn(),
          pruneStale: jest.fn(),
          selectBestPeers: jest.fn(),
          getPeersByTransport: jest.fn(),
        }),
      });
      const controller = createMeshController(deps);
      await controller.start();

      const dtu1 = createTestDTU({ id: 'concurrent-1' });
      const dtu2 = createTestDTU({ id: 'concurrent-2' });

      await Promise.all([
        controller.sendDTU(dtu1),
        controller.sendDTU(dtu2),
      ]);

      expect(deps.transfer.sendDTU).toHaveBeenCalledTimes(2);
    });
  });
});
