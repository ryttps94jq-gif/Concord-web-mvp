// Tests for BLE Advertiser
import { createBLEAdvertiser } from '../../mesh/bluetooth/ble-advertiser';
import type { BLEManager } from '../../mesh/bluetooth/ble-advertiser';
import { CONCORD_BLE_SERVICE_UUID } from '../../utils/constants';

// ── Mock BLE Manager ──────────────────────────────────────────────────────────

function createMockBLEManager(overrides?: Partial<BLEManager>): BLEManager {
  return {
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
    destroy: jest.fn(),
    state: jest.fn().mockResolvedValue('PoweredOn'),
    startAdvertising: jest.fn().mockResolvedValue(undefined),
    stopAdvertising: jest.fn().mockResolvedValue(undefined),
    connectToDevice: jest.fn().mockResolvedValue({ id: 'mock', name: null, rssi: -50, serviceUUIDs: null, localName: null, manufacturerData: null }),
    cancelDeviceConnection: jest.fn().mockResolvedValue({ id: 'mock', name: null, rssi: -50, serviceUUIDs: null, localName: null, manufacturerData: null }),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BLE Advertiser', () => {
  describe('createBLEAdvertiser', () => {
    it('should create an advertiser instance', () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      expect(advertiser).toBeDefined();
      expect(advertiser.start).toBeInstanceOf(Function);
      expect(advertiser.stop).toBeInstanceOf(Function);
      expect(advertiser.isAdvertising).toBeInstanceOf(Function);
      expect(advertiser.getServiceUUID).toBeInstanceOf(Function);
    });
  });

  describe('getServiceUUID', () => {
    it('should return the Concord BLE service UUID', () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      expect(advertiser.getServiceUUID()).toBe(CONCORD_BLE_SERVICE_UUID);
    });
  });

  describe('isAdvertising', () => {
    it('should return false initially', () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      expect(advertiser.isAdvertising()).toBe(false);
    });

    it('should return true after start', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.start();

      expect(advertiser.isAdvertising()).toBe(true);
    });

    it('should return false after stop', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.start();
      await advertiser.stop();

      expect(advertiser.isAdvertising()).toBe(false);
    });
  });

  describe('start', () => {
    it('should check BLE state before advertising', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.start();

      expect(manager.state).toHaveBeenCalled();
    });

    it('should call startAdvertising with correct UUID and name', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.start();

      expect(manager.startAdvertising).toHaveBeenCalledWith(
        CONCORD_BLE_SERVICE_UUID,
        'Concord',
      );
    });

    it('should throw if BLE is not powered on', async () => {
      const manager = createMockBLEManager({
        state: jest.fn().mockResolvedValue('PoweredOff'),
      });
      const advertiser = createBLEAdvertiser(manager);

      await expect(advertiser.start()).rejects.toThrow('BLE not ready');
      expect(advertiser.isAdvertising()).toBe(false);
    });

    it('should throw if BLE state is Unknown', async () => {
      const manager = createMockBLEManager({
        state: jest.fn().mockResolvedValue('Unknown'),
      });
      const advertiser = createBLEAdvertiser(manager);

      await expect(advertiser.start()).rejects.toThrow('BLE not ready');
    });

    it('should throw if startAdvertising is not supported', async () => {
      const manager = createMockBLEManager({
        startAdvertising: undefined,
      });
      const advertiser = createBLEAdvertiser(manager);

      await expect(advertiser.start()).rejects.toThrow(
        'BLE advertising not supported',
      );
      expect(advertiser.isAdvertising()).toBe(false);
    });

    it('should be idempotent when already advertising', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.start();
      await advertiser.start(); // Should not throw

      // startAdvertising should only be called once
      expect(manager.startAdvertising).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from startAdvertising', async () => {
      const manager = createMockBLEManager({
        startAdvertising: jest.fn().mockRejectedValue(new Error('Native module error')),
      });
      const advertiser = createBLEAdvertiser(manager);

      await expect(advertiser.start()).rejects.toThrow('Native module error');
      expect(advertiser.isAdvertising()).toBe(false);
    });

    it('should set advertising state only after successful start', async () => {
      let resolveStart: () => void;
      const startPromise = new Promise<void>(resolve => {
        resolveStart = resolve;
      });
      const manager = createMockBLEManager({
        startAdvertising: jest.fn().mockReturnValue(startPromise),
      });
      const advertiser = createBLEAdvertiser(manager);

      const startOp = advertiser.start();
      expect(advertiser.isAdvertising()).toBe(false);

      resolveStart!();
      await startOp;
      expect(advertiser.isAdvertising()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should call stopAdvertising on the manager', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.start();
      await advertiser.stop();

      expect(manager.stopAdvertising).toHaveBeenCalled();
    });

    it('should be idempotent when not advertising', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.stop(); // Should not throw

      expect(manager.stopAdvertising).not.toHaveBeenCalled();
    });

    it('should handle missing stopAdvertising gracefully', async () => {
      const manager = createMockBLEManager({
        stopAdvertising: undefined,
      });
      const advertiser = createBLEAdvertiser(manager);

      // Need to mock startAdvertising to exist for start() to succeed
      await advertiser.start();
      await advertiser.stop(); // Should not throw

      expect(advertiser.isAdvertising()).toBe(false);
    });

    it('should allow restart after stop', async () => {
      const manager = createMockBLEManager();
      const advertiser = createBLEAdvertiser(manager);

      await advertiser.start();
      expect(advertiser.isAdvertising()).toBe(true);

      await advertiser.stop();
      expect(advertiser.isAdvertising()).toBe(false);

      await advertiser.start();
      expect(advertiser.isAdvertising()).toBe(true);
      expect(manager.startAdvertising).toHaveBeenCalledTimes(2);
    });
  });

  describe('error states', () => {
    it('should handle BLE state check failure', async () => {
      const manager = createMockBLEManager({
        state: jest.fn().mockRejectedValue(new Error('BLE unavailable')),
      });
      const advertiser = createBLEAdvertiser(manager);

      await expect(advertiser.start()).rejects.toThrow('BLE unavailable');
      expect(advertiser.isAdvertising()).toBe(false);
    });

    it('should handle Unauthorized BLE state', async () => {
      const manager = createMockBLEManager({
        state: jest.fn().mockResolvedValue('Unauthorized'),
      });
      const advertiser = createBLEAdvertiser(manager);

      await expect(advertiser.start()).rejects.toThrow('BLE not ready');
    });

    it('should handle Resetting BLE state', async () => {
      const manager = createMockBLEManager({
        state: jest.fn().mockResolvedValue('Resetting'),
      });
      const advertiser = createBLEAdvertiser(manager);

      await expect(advertiser.start()).rejects.toThrow('BLE not ready');
    });
  });
});
