// Tests for BLE Scanner
import { createBLEScanner } from '../../mesh/bluetooth/ble-scanner';
import type { ScanOptions } from '../../mesh/bluetooth/ble-scanner';
import type { BLEManager, BLEDevice } from '../../mesh/bluetooth/ble-advertiser';
import type { MeshPeer } from '../../utils/types';
import { CONCORD_BLE_SERVICE_UUID, TRANSPORT_LAYERS } from '../../utils/constants';

// ── Mock BLE Manager ──────────────────────────────────────────────────────────

type ScanListener = (error: Error | null, device: BLEDevice | null) => void;

function createMockBLEManager(overrides?: Partial<BLEManager>): BLEManager & { _scanListener: ScanListener | null } {
  const mock: BLEManager & { _scanListener: ScanListener | null } = {
    _scanListener: null,
    startDeviceScan: jest.fn((
      _uuids: string[] | null,
      _options: Record<string, unknown> | null,
      listener: ScanListener,
    ) => {
      mock._scanListener = listener;
    }),
    stopDeviceScan: jest.fn(() => {
      mock._scanListener = null;
    }),
    destroy: jest.fn(),
    state: jest.fn().mockResolvedValue('PoweredOn'),
    connectToDevice: jest.fn(),
    cancelDeviceConnection: jest.fn(),
    ...overrides,
  };
  return mock;
}

function createMockDevice(overrides?: Partial<BLEDevice>): BLEDevice {
  return {
    id: 'device-1',
    name: 'ConcordPeer',
    rssi: -55,
    serviceUUIDs: [CONCORD_BLE_SERVICE_UUID],
    localName: 'ConcordNode',
    manufacturerData: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BLE Scanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createBLEScanner', () => {
    it('should create a scanner instance', () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      expect(scanner).toBeDefined();
      expect(scanner.startScan).toBeInstanceOf(Function);
      expect(scanner.stopScan).toBeInstanceOf(Function);
      expect(scanner.isScanning).toBeInstanceOf(Function);
      expect(scanner.getDiscoveredPeers).toBeInstanceOf(Function);
      expect(scanner.clearPeers).toBeInstanceOf(Function);
    });
  });

  describe('isScanning', () => {
    it('should return false initially', () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      expect(scanner.isScanning()).toBe(false);
    });

    it('should return true after startScan', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      expect(scanner.isScanning()).toBe(true);
    });

    it('should return false after stopScan', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());
      await scanner.stopScan();

      expect(scanner.isScanning()).toBe(false);
    });
  });

  describe('startScan', () => {
    it('should check BLE state', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      expect(manager.state).toHaveBeenCalled();
    });

    it('should throw if BLE not ready', async () => {
      const manager = createMockBLEManager({
        state: jest.fn().mockResolvedValue('PoweredOff'),
      });
      const scanner = createBLEScanner(manager);

      await expect(scanner.startScan(jest.fn())).rejects.toThrow('BLE not ready');
    });

    it('should scan for Concord service UUID', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      expect(manager.startDeviceScan).toHaveBeenCalledWith(
        [CONCORD_BLE_SERVICE_UUID],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should be idempotent when already scanning', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());
      await scanner.startScan(jest.fn());

      expect(manager.startDeviceScan).toHaveBeenCalledTimes(1);
    });

    it('should pass allowDuplicates from options', async () => {
      const manager = createMockBLEManager();
      const options: ScanOptions = { allowDuplicates: true };
      const scanner = createBLEScanner(manager, options);

      await scanner.startScan(jest.fn());

      expect(manager.startDeviceScan).toHaveBeenCalledWith(
        expect.any(Array),
        { allowDuplicates: true },
        expect.any(Function),
      );
    });
  });

  describe('peer discovery', () => {
    it('should call onPeerDiscovered for new devices', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);

      const device = createMockDevice();
      manager._scanListener!(null, device);

      expect(onDiscovered).toHaveBeenCalledTimes(1);
      const discoveredPeer = onDiscovered.mock.calls[0][0] as MeshPeer;
      expect(discoveredPeer.id).toBe('device-1');
      expect(discoveredPeer.transport).toBe(TRANSPORT_LAYERS.BLUETOOTH);
      expect(discoveredPeer.rssi).toBe(-55);
      expect(discoveredPeer.name).toBe('ConcordNode');
    });

    it('should deduplicate peers by ID', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);

      const device = createMockDevice();
      manager._scanListener!(null, device);
      manager._scanListener!(null, device); // Same device again

      expect(onDiscovered).toHaveBeenCalledTimes(1);
    });

    it('should update RSSI for existing peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      manager._scanListener!(null, createMockDevice({ rssi: -55 }));
      manager._scanListener!(null, createMockDevice({ rssi: -40 }));

      const peers = scanner.getDiscoveredPeers();
      expect(peers).toHaveLength(1);
      expect(peers[0].rssi).toBe(-40);
    });

    it('should update lastSeen for existing peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      const now = Date.now();
      manager._scanListener!(null, createMockDevice());

      jest.advanceTimersByTime(5000);
      manager._scanListener!(null, createMockDevice());

      const peers = scanner.getDiscoveredPeers();
      expect(peers[0].lastSeen).toBeGreaterThanOrEqual(now + 5000);
    });

    it('should update name from localName', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      manager._scanListener!(null, createMockDevice({ localName: null, name: 'OldName' }));
      manager._scanListener!(null, createMockDevice({ localName: 'NewName' }));

      const peers = scanner.getDiscoveredPeers();
      expect(peers[0].name).toBe('NewName');
    });

    it('should handle null device gracefully', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(null, null);

      expect(onDiscovered).not.toHaveBeenCalled();
    });

    it('should handle scan errors gracefully', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(new Error('Connection lost'), null);

      expect(onDiscovered).not.toHaveBeenCalled();
      // Non-fatal error, still scanning
      expect(scanner.isScanning()).toBe(true);
    });

    it('should stop scanning on powered off error', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());
      manager._scanListener!(new Error('BLE powered off'), null);

      expect(scanner.isScanning()).toBe(false);
    });

    it('should stop scanning on unauthorized error', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());
      manager._scanListener!(new Error('BLE unauthorized'), null);

      expect(scanner.isScanning()).toBe(false);
    });

    it('should handle device with null RSSI', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(null, createMockDevice({ rssi: null }));

      const peer = onDiscovered.mock.calls[0][0] as MeshPeer;
      expect(peer.rssi).toBe(-100); // Default weak RSSI
    });

    it('should set default capabilities for BLE peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(null, createMockDevice());

      const peer = onDiscovered.mock.calls[0][0] as MeshPeer;
      expect(peer.capabilities.bluetooth).toBe(true);
      expect(peer.capabilities.wifiDirect).toBe(false);
      expect(peer.capabilities.nfc).toBe(false);
      expect(peer.capabilities.lora).toBe(false);
      expect(peer.capabilities.internet).toBe(false);
    });

    it('should set authenticated to false for new peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(null, createMockDevice());

      const peer = onDiscovered.mock.calls[0][0] as MeshPeer;
      expect(peer.authenticated).toBe(false);
    });

    it('should set neutral reputation for new peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(null, createMockDevice());

      const peer = onDiscovered.mock.calls[0][0] as MeshPeer;
      expect(peer.reputation.score).toBe(0.5);
      expect(peer.reputation.validDTUs).toBe(0);
      expect(peer.reputation.invalidDTUs).toBe(0);
    });

    it('should handle multiple distinct devices', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(null, createMockDevice({ id: 'dev-1' }));
      manager._scanListener!(null, createMockDevice({ id: 'dev-2' }));
      manager._scanListener!(null, createMockDevice({ id: 'dev-3' }));

      expect(onDiscovered).toHaveBeenCalledTimes(3);
      expect(scanner.getDiscoveredPeers()).toHaveLength(3);
    });

    it('should use device name as fallback when localName is null', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);
      const onDiscovered = jest.fn();

      await scanner.startScan(onDiscovered);
      manager._scanListener!(null, createMockDevice({ localName: null, name: 'FallbackName' }));

      const peer = onDiscovered.mock.calls[0][0] as MeshPeer;
      expect(peer.name).toBe('FallbackName');
    });
  });

  describe('stale peer pruning', () => {
    it('should prune stale peers based on discoveryTimeout', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager, { discoveryTimeoutMs: 10000, scanIntervalMs: 5000 });

      await scanner.startScan(jest.fn());

      manager._scanListener!(null, createMockDevice({ id: 'dev-1' }));

      expect(scanner.getDiscoveredPeers()).toHaveLength(1);

      // Advance past timeout
      jest.advanceTimersByTime(15000);

      // getDiscoveredPeers filters stale
      expect(scanner.getDiscoveredPeers()).toHaveLength(0);
    });

    it('should keep recently seen peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager, { discoveryTimeoutMs: 10000, scanIntervalMs: 5000 });

      await scanner.startScan(jest.fn());

      manager._scanListener!(null, createMockDevice({ id: 'dev-1' }));

      jest.advanceTimersByTime(3000);

      expect(scanner.getDiscoveredPeers()).toHaveLength(1);
    });

    it('should auto-prune via interval timer', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager, { discoveryTimeoutMs: 5000, scanIntervalMs: 3000 });

      await scanner.startScan(jest.fn());

      manager._scanListener!(null, createMockDevice({ id: 'dev-1' }));
      manager._scanListener!(null, createMockDevice({ id: 'dev-2' }));

      // Advance past scanInterval + discoveryTimeout to trigger pruning
      jest.advanceTimersByTime(10000);

      expect(scanner.getDiscoveredPeers()).toHaveLength(0);
    });
  });

  describe('stopScan', () => {
    it('should call stopDeviceScan on manager', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());
      await scanner.stopScan();

      expect(manager.stopDeviceScan).toHaveBeenCalled();
    });

    it('should be idempotent when not scanning', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.stopScan();

      expect(manager.stopDeviceScan).not.toHaveBeenCalled();
    });

    it('should clear the stale check timer', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());
      await scanner.stopScan();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('clearPeers', () => {
    it('should remove all discovered peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      manager._scanListener!(null, createMockDevice({ id: 'dev-1' }));
      manager._scanListener!(null, createMockDevice({ id: 'dev-2' }));

      expect(scanner.getDiscoveredPeers()).toHaveLength(2);

      scanner.clearPeers();

      expect(scanner.getDiscoveredPeers()).toHaveLength(0);
    });

    it('should work when no peers discovered', () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      scanner.clearPeers(); // Should not throw
      expect(scanner.getDiscoveredPeers()).toHaveLength(0);
    });
  });

  describe('getDiscoveredPeers', () => {
    it('should return empty array initially', () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      expect(scanner.getDiscoveredPeers()).toEqual([]);
    });

    it('should not return stale peers', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager, { discoveryTimeoutMs: 5000 });

      await scanner.startScan(jest.fn());
      manager._scanListener!(null, createMockDevice({ id: 'stale-dev' }));

      jest.advanceTimersByTime(6000);

      expect(scanner.getDiscoveredPeers()).toHaveLength(0);
    });

    it('should return fresh peers only', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager, { discoveryTimeoutMs: 5000 });

      await scanner.startScan(jest.fn());
      manager._scanListener!(null, createMockDevice({ id: 'dev-1' }));

      jest.advanceTimersByTime(3000);
      manager._scanListener!(null, createMockDevice({ id: 'dev-2' }));

      jest.advanceTimersByTime(3000);
      // dev-1 is now 6s old (stale), dev-2 is 3s old (fresh)

      const peers = scanner.getDiscoveredPeers();
      expect(peers).toHaveLength(1);
      expect(peers[0].id).toBe('dev-2');
    });
  });

  describe('default scan options', () => {
    it('should use default scan interval from constants', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());

      // Verify scanner was created and is scanning
      expect(scanner.isScanning()).toBe(true);
    });

    it('should use default discovery timeout from constants', async () => {
      const manager = createMockBLEManager();
      const scanner = createBLEScanner(manager);

      await scanner.startScan(jest.fn());
      manager._scanListener!(null, createMockDevice());

      // Default timeout is 30000ms from constants
      jest.advanceTimersByTime(25000);
      expect(scanner.getDiscoveredPeers()).toHaveLength(1);

      jest.advanceTimersByTime(10000);
      expect(scanner.getDiscoveredPeers()).toHaveLength(0);
    });
  });
});
