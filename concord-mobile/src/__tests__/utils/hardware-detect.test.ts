// Tests for hardware capability detection

import {
  detectHardwareCapabilities,
  isCapabilityAvailable,
  getGracefulDegradation,
  setNativeDeviceInfo,
  getNativeDeviceInfo,
  NativeDeviceInfo,
} from '../../utils/hardware-detect';
import { HardwareCapabilities } from '../../utils/types';

// ── Mock NativeDeviceInfo ────────────────────────────────────────────────────

function createMockNativeDeviceInfo(overrides: Partial<NativeDeviceInfo> = {}): NativeDeviceInfo {
  return {
    hasBluetooth: jest.fn().mockResolvedValue(true),
    hasBluetoothLE: jest.fn().mockResolvedValue(true),
    hasWifiDirect: jest.fn().mockResolvedValue(true),
    hasNFC: jest.fn().mockResolvedValue(true),
    hasGPS: jest.fn().mockResolvedValue(true),
    hasBarometer: jest.fn().mockResolvedValue(true),
    hasMagnetometer: jest.fn().mockResolvedValue(true),
    hasAccelerometer: jest.fn().mockResolvedValue(true),
    hasGyroscope: jest.fn().mockResolvedValue(true),
    hasAmbientLight: jest.fn().mockResolvedValue(true),
    hasFMRadio: jest.fn().mockResolvedValue(false),
    hasSecureEnclave: jest.fn().mockResolvedValue(true),
    getTotalRAMGB: jest.fn().mockResolvedValue(6),
    getAvailableStorageGB: jest.fn().mockResolvedValue(32),
    getCPUCores: jest.fn().mockResolvedValue(8),
    getPlatform: jest.fn().mockReturnValue('android' as const),
    getOSVersion: jest.fn().mockResolvedValue('14.0'),
    ...overrides,
  };
}

function createFullCapabilities(overrides: Partial<HardwareCapabilities> = {}): HardwareCapabilities {
  return {
    bluetooth: true,
    bluetoothLE: true,
    wifiDirect: true,
    nfc: true,
    gps: true,
    barometer: true,
    magnetometer: true,
    accelerometer: true,
    gyroscope: true,
    ambientLight: true,
    fmRadio: true,
    secureEnclave: true,
    totalRAMGB: 6,
    availableStorageGB: 32,
    cpuCores: 8,
    platform: 'android',
    osVersion: '14.0',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('hardware-detect', () => {
  beforeEach(() => {
    setNativeDeviceInfo(createMockNativeDeviceInfo());
  });

  describe('getNativeDeviceInfo', () => {
    it('should throw if not initialized', () => {
      // Force reset by setting null through the setter with a cast
      (setNativeDeviceInfo as any)(null);
      // We need a way to clear it; let's use the module directly
      // Actually the setter accepts NativeDeviceInfo; to test uninitialized we
      // re-import or call with null
      setNativeDeviceInfo(null as unknown as NativeDeviceInfo);
      expect(() => getNativeDeviceInfo()).toThrow('NativeDeviceInfo not initialized');
    });

    it('should return the set native device info', () => {
      const mock = createMockNativeDeviceInfo();
      setNativeDeviceInfo(mock);
      expect(getNativeDeviceInfo()).toBe(mock);
    });
  });

  describe('detectHardwareCapabilities', () => {
    it('should detect all capabilities from native modules', async () => {
      const capabilities = await detectHardwareCapabilities();

      expect(capabilities.bluetooth).toBe(true);
      expect(capabilities.bluetoothLE).toBe(true);
      expect(capabilities.wifiDirect).toBe(true);
      expect(capabilities.nfc).toBe(true);
      expect(capabilities.gps).toBe(true);
      expect(capabilities.barometer).toBe(true);
      expect(capabilities.magnetometer).toBe(true);
      expect(capabilities.accelerometer).toBe(true);
      expect(capabilities.gyroscope).toBe(true);
      expect(capabilities.ambientLight).toBe(true);
      expect(capabilities.fmRadio).toBe(false);
      expect(capabilities.secureEnclave).toBe(true);
      expect(capabilities.totalRAMGB).toBe(6);
      expect(capabilities.availableStorageGB).toBe(32);
      expect(capabilities.cpuCores).toBe(8);
      expect(capabilities.platform).toBe('android');
      expect(capabilities.osVersion).toBe('14.0');
    });

    it('should handle individual sensor detection failures gracefully', async () => {
      const mock = createMockNativeDeviceInfo({
        hasBluetooth: jest.fn().mockRejectedValue(new Error('BT unavailable')),
        hasGPS: jest.fn().mockRejectedValue(new Error('GPS error')),
        getTotalRAMGB: jest.fn().mockRejectedValue(new Error('RAM query failed')),
        getOSVersion: jest.fn().mockRejectedValue(new Error('OS version error')),
      });
      setNativeDeviceInfo(mock);

      const capabilities = await detectHardwareCapabilities();

      // Failed booleans default to false
      expect(capabilities.bluetooth).toBe(false);
      expect(capabilities.gps).toBe(false);
      // Failed numbers default to their fallbacks
      expect(capabilities.totalRAMGB).toBe(0);
      // Failed string defaults to 'unknown'
      expect(capabilities.osVersion).toBe('unknown');
      // Other sensors still work
      expect(capabilities.bluetoothLE).toBe(true);
      expect(capabilities.wifiDirect).toBe(true);
      expect(capabilities.accelerometer).toBe(true);
    });

    it('should handle all sensor failures without crashing', async () => {
      const mock = createMockNativeDeviceInfo({
        hasBluetooth: jest.fn().mockRejectedValue(new Error()),
        hasBluetoothLE: jest.fn().mockRejectedValue(new Error()),
        hasWifiDirect: jest.fn().mockRejectedValue(new Error()),
        hasNFC: jest.fn().mockRejectedValue(new Error()),
        hasGPS: jest.fn().mockRejectedValue(new Error()),
        hasBarometer: jest.fn().mockRejectedValue(new Error()),
        hasMagnetometer: jest.fn().mockRejectedValue(new Error()),
        hasAccelerometer: jest.fn().mockRejectedValue(new Error()),
        hasGyroscope: jest.fn().mockRejectedValue(new Error()),
        hasAmbientLight: jest.fn().mockRejectedValue(new Error()),
        hasFMRadio: jest.fn().mockRejectedValue(new Error()),
        hasSecureEnclave: jest.fn().mockRejectedValue(new Error()),
        getTotalRAMGB: jest.fn().mockRejectedValue(new Error()),
        getAvailableStorageGB: jest.fn().mockRejectedValue(new Error()),
        getCPUCores: jest.fn().mockRejectedValue(new Error()),
        getOSVersion: jest.fn().mockRejectedValue(new Error()),
      });
      setNativeDeviceInfo(mock);

      const capabilities = await detectHardwareCapabilities();

      expect(capabilities.bluetooth).toBe(false);
      expect(capabilities.totalRAMGB).toBe(0);
      expect(capabilities.availableStorageGB).toBe(0);
      expect(capabilities.cpuCores).toBe(1);
      expect(capabilities.osVersion).toBe('unknown');
    });

    it('should detect iOS platform', async () => {
      const mock = createMockNativeDeviceInfo({
        getPlatform: jest.fn().mockReturnValue('ios' as const),
      });
      setNativeDeviceInfo(mock);

      const capabilities = await detectHardwareCapabilities();
      expect(capabilities.platform).toBe('ios');
    });
  });

  describe('isCapabilityAvailable', () => {
    it('should return true for available boolean capabilities', async () => {
      expect(await isCapabilityAvailable('bluetooth')).toBe(true);
      expect(await isCapabilityAvailable('gps')).toBe(true);
    });

    it('should return false for unavailable boolean capabilities', async () => {
      expect(await isCapabilityAvailable('fmRadio')).toBe(false);
    });

    it('should return true for numeric capabilities > 0', async () => {
      expect(await isCapabilityAvailable('totalRAMGB')).toBe(true);
      expect(await isCapabilityAvailable('cpuCores')).toBe(true);
    });

    it('should return false for numeric capabilities = 0', async () => {
      const mock = createMockNativeDeviceInfo({
        getTotalRAMGB: jest.fn().mockResolvedValue(0),
      });
      setNativeDeviceInfo(mock);
      expect(await isCapabilityAvailable('totalRAMGB')).toBe(false);
    });

    it('should return true for string capabilities', async () => {
      expect(await isCapabilityAvailable('platform')).toBe(true);
      expect(await isCapabilityAvailable('osVersion')).toBe(true);
    });
  });

  describe('getGracefulDegradation', () => {
    it('should return empty array when all capabilities present', () => {
      const capabilities = createFullCapabilities();
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toEqual([]);
    });

    it('should report missing bluetooth', () => {
      const capabilities = createFullCapabilities({ bluetooth: false });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('Bluetooth unavailable — BLE mesh transport disabled');
    });

    it('should report missing GPS', () => {
      const capabilities = createFullCapabilities({ gps: false });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('GPS unavailable — location-based features limited');
    });

    it('should report missing NFC', () => {
      const capabilities = createFullCapabilities({ nfc: false });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('NFC unavailable — tap-to-share disabled');
    });

    it('should report missing secure enclave', () => {
      const capabilities = createFullCapabilities({ secureEnclave: false });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('Secure enclave unavailable — using software key storage');
    });

    it('should report low RAM', () => {
      const capabilities = createFullCapabilities({ totalRAMGB: 1.5 });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('Low RAM — local AI model may be constrained');
    });

    it('should not report low RAM when >= 2GB', () => {
      const capabilities = createFullCapabilities({ totalRAMGB: 2 });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).not.toContain('Low RAM — local AI model may be constrained');
    });

    it('should report low storage', () => {
      const capabilities = createFullCapabilities({ availableStorageGB: 0.5 });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('Low storage — DTU lattice capacity limited');
    });

    it('should not report low storage when >= 1GB', () => {
      const capabilities = createFullCapabilities({ availableStorageGB: 1 });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).not.toContain('Low storage — DTU lattice capacity limited');
    });

    it('should report multiple missing capabilities', () => {
      const capabilities = createFullCapabilities({
        bluetooth: false,
        bluetoothLE: false,
        gps: false,
        nfc: false,
        fmRadio: false,
        secureEnclave: false,
        totalRAMGB: 1,
        availableStorageGB: 0.3,
      });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations.length).toBeGreaterThanOrEqual(6);
    });

    it('should report all sensor-specific degradations', () => {
      const capabilities = createFullCapabilities({
        barometer: false,
        magnetometer: false,
        accelerometer: false,
        gyroscope: false,
        ambientLight: false,
      });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('Barometer unavailable — altitude sensing disabled');
      expect(degradations).toContain('Magnetometer unavailable — compass heading disabled');
      expect(degradations).toContain('Accelerometer unavailable — motion sensing disabled');
      expect(degradations).toContain('Gyroscope unavailable — rotation sensing disabled');
      expect(degradations).toContain('Ambient light sensor unavailable — light-based context disabled');
    });

    it('should report WiFi Direct degradation', () => {
      const capabilities = createFullCapabilities({ wifiDirect: false });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('WiFi Direct unavailable — WiFi P2P mesh transport disabled');
    });

    it('should report FM radio degradation', () => {
      const capabilities = createFullCapabilities({ fmRadio: false });
      const degradations = getGracefulDegradation(capabilities);
      expect(degradations).toContain('FM radio unavailable — broadcast receive disabled');
    });
  });
});
