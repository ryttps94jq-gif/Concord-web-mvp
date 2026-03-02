// Tests for Foundation Sense: Sensor Manager
// CRITICAL PRIVACY TESTS:
//   - Bluetooth NEVER returns individual device identifiers
//   - GPS geotagged to 100m grid, not exact coordinates
//   - WiFi returns hashed SSIDs only

import {
  createSensorManager,
  snapToGeoGrid,
  NativeSensorModules,
  SensorManager,
} from '../../foundation/sensors/sensor-manager';
import { HardwareCapabilities } from '../../utils/types';
import { FOUNDATION_GEO_GRID_METERS, FOUNDATION_SAMPLING_INTERVAL_MS } from '../../utils/constants';

// ── Mock Native Modules ──────────────────────────────────────────────────────

function createMockNativeModules(overrides: Partial<NativeSensorModules> = {}): NativeSensorModules {
  return {
    wifi: {
      scan: jest.fn().mockResolvedValue([
        { ssid: 'MyNetwork', bssid: 'AA:BB:CC:DD:EE:FF', rssi: -50, frequency: 2437, channel: 6, security: 'WPA2' },
        { ssid: 'CoffeeShop', bssid: '11:22:33:44:55:66', rssi: -70, frequency: 5180, channel: 36, security: 'WPA3' },
      ]),
    },
    bluetooth: {
      scanEnvironment: jest.fn().mockResolvedValue({
        deviceCount: 12,
        aggregateRSSI: -65,
        typeDistribution: { phone: 5, laptop: 3, wearable: 4 },
      }),
    },
    gps: {
      getCurrentPosition: jest.fn().mockResolvedValue({
        latitude: 40.748817,
        longitude: -73.985428,
        accuracy: 5.0,
        verticalAccuracy: 3.0,
        speed: 1.2,
        bearing: 45.0,
        altitude: 20.0,
        multipathIndicator: 0,
      }),
    },
    barometer: {
      read: jest.fn().mockResolvedValue({ pressure: 1013.25, relativeAltitude: 0 }),
    },
    magnetometer: {
      read: jest.fn().mockResolvedValue({ x: 25.5, y: -10.2, z: 42.8 }),
    },
    accelerometer: {
      readDuration: jest.fn().mockResolvedValue({ x: 0.01, y: 0.02, z: 9.81, magnitude: 9.81 }),
    },
    ambientLight: {
      read: jest.fn().mockResolvedValue({ lux: 350 }),
    },
    hashSSID: jest.fn().mockImplementation((ssid: string) => `hashed_${ssid}`),
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
    fmRadio: false,
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

describe('SensorManager', () => {
  let manager: SensorManager;
  let mockModules: NativeSensorModules;
  let capabilities: HardwareCapabilities;

  beforeEach(() => {
    mockModules = createMockNativeModules();
    capabilities = createFullCapabilities();
    manager = createSensorManager(mockModules);
    manager.initialize(capabilities);
  });

  describe('initialization', () => {
    it('should throw if not initialized when capturing', async () => {
      const uninitManager = createSensorManager(mockModules);
      await expect(uninitManager.captureAll()).rejects.toThrow('SensorManager not initialized');
    });

    it('should throw if not initialized when getting sensors', () => {
      const uninitManager = createSensorManager(mockModules);
      expect(() => uninitManager.getAvailableSensors()).toThrow('SensorManager not initialized');
    });

    it('should work after initialization', () => {
      expect(manager.getAvailableSensors().length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableSensors', () => {
    it('should list all sensors when all hardware available', () => {
      const sensors = manager.getAvailableSensors();
      expect(sensors).toContain('wifi');
      expect(sensors).toContain('bluetooth');
      expect(sensors).toContain('gps');
      expect(sensors).toContain('barometric');
      expect(sensors).toContain('magnetometer');
      expect(sensors).toContain('accelerometer');
      expect(sensors).toContain('ambient_light');
    });

    it('should exclude sensors when hardware unavailable', () => {
      const limitedCaps = createFullCapabilities({
        bluetooth: false,
        gps: false,
      });
      manager.initialize(limitedCaps);
      const sensors = manager.getAvailableSensors();
      expect(sensors).not.toContain('bluetooth');
      expect(sensors).not.toContain('gps');
      expect(sensors).toContain('wifi');
    });

    it('should exclude sensors when native modules missing', () => {
      const noWifiModules = createMockNativeModules({ wifi: undefined });
      const mgr = createSensorManager(noWifiModules);
      mgr.initialize(capabilities);
      const sensors = mgr.getAvailableSensors();
      expect(sensors).not.toContain('wifi');
    });
  });

  // ── CRITICAL PRIVACY: WiFi ────────────────────────────────────────────────

  describe('captureWiFi — PRIVACY', () => {
    it('should return hashed SSIDs, never raw SSIDs', async () => {
      const results = await manager.captureWiFi();

      expect(results.length).toBe(2);
      for (const result of results) {
        // Must have hashed SSID
        expect(result.ssidHash).toBeDefined();
        expect(typeof result.ssidHash).toBe('string');
        // Must NOT contain raw SSID values
        expect(result.ssidHash).not.toBe('MyNetwork');
        expect(result.ssidHash).not.toBe('CoffeeShop');
        // Must not have any bssid field
        expect((result as any).bssid).toBeUndefined();
        expect((result as any).ssid).toBeUndefined();
      }
    });

    it('should use the hashSSID function for each SSID', async () => {
      await manager.captureWiFi();
      expect(mockModules.hashSSID).toHaveBeenCalledWith('MyNetwork');
      expect(mockModules.hashSSID).toHaveBeenCalledWith('CoffeeShop');
    });

    it('should include signal strength and frequency data', async () => {
      const results = await manager.captureWiFi();
      expect(results[0].rssi).toBe(-50);
      expect(results[0].frequency).toBe(2437);
      expect(results[0].channel).toBe(6);
      expect(results[0].security).toBe('WPA2');
    });

    it('should calculate estimated distance', async () => {
      const results = await manager.captureWiFi();
      expect(results[0].estimatedDistance).toBeGreaterThan(0);
      expect(typeof results[0].estimatedDistance).toBe('number');
    });

    it('should throw if wifi module not available', async () => {
      const noWifi = createMockNativeModules({ wifi: undefined });
      const mgr = createSensorManager(noWifi);
      mgr.initialize(capabilities);
      await expect(mgr.captureWiFi()).rejects.toThrow('WiFi native module not available');
    });

    it('should use default hash function if custom not provided', async () => {
      const noHashModules = createMockNativeModules({ hashSSID: undefined });
      const mgr = createSensorManager(noHashModules);
      mgr.initialize(capabilities);
      const results = await mgr.captureWiFi();
      // Should still have hashed SSIDs (using default hash)
      expect(results[0].ssidHash).toBeDefined();
      expect(results[0].ssidHash).not.toBe('MyNetwork');
      expect(results[0].ssidHash.startsWith('ssid_')).toBe(true);
    });
  });

  // ── CRITICAL PRIVACY: Bluetooth ───────────────────────────────────────────

  describe('captureBluetooth — PRIVACY', () => {
    it('should return aggregate data ONLY, never individual device identifiers', async () => {
      const env = await manager.captureBluetooth();

      // MUST have aggregate fields
      expect(env.deviceCount).toBe(12);
      expect(env.aggregateRSSI).toBe(-65);
      expect(env.typeDistribution).toEqual({ phone: 5, laptop: 3, wearable: 4 });

      // MUST NOT have any individual device data
      expect((env as any).devices).toBeUndefined();
      expect((env as any).deviceList).toBeUndefined();
      expect((env as any).deviceIds).toBeUndefined();
      expect((env as any).macAddresses).toBeUndefined();
      expect((env as any).addresses).toBeUndefined();
      expect((env as any).names).toBeUndefined();
      expect((env as any).identifiers).toBeUndefined();

      // Verify the BluetoothEnvironment type only has these 3 fields
      const keys = Object.keys(env);
      expect(keys).toEqual(['deviceCount', 'aggregateRSSI', 'typeDistribution']);
    });

    it('should never expose individual Bluetooth device identifiers even if native module returns them', async () => {
      // Even if the native module erroneously includes extra data
      const badBtModule = {
        scanEnvironment: jest.fn().mockResolvedValue({
          deviceCount: 5,
          aggregateRSSI: -70,
          typeDistribution: { phone: 3, laptop: 2 },
          // Extra data that should NOT leak through
          devices: [{ id: 'AA:BB:CC', name: 'BadPhone' }],
          macAddresses: ['AA:BB:CC:DD:EE:FF'],
        }),
      };

      const modules = createMockNativeModules({ bluetooth: badBtModule });
      const mgr = createSensorManager(modules);
      mgr.initialize(capabilities);

      const env = await mgr.captureBluetooth();

      // We explicitly only take aggregate fields
      expect((env as any).devices).toBeUndefined();
      expect((env as any).macAddresses).toBeUndefined();
      expect(Object.keys(env).sort()).toEqual(['aggregateRSSI', 'deviceCount', 'typeDistribution']);
    });

    it('should throw if bluetooth module not available', async () => {
      const noBt = createMockNativeModules({ bluetooth: undefined });
      const mgr = createSensorManager(noBt);
      mgr.initialize(capabilities);
      await expect(mgr.captureBluetooth()).rejects.toThrow('Bluetooth native module not available');
    });
  });

  // ── CRITICAL PRIVACY: GPS ─────────────────────────────────────────────────

  describe('captureGPS — PRIVACY', () => {
    it('should NOT return exact latitude/longitude in GPSMultipath', async () => {
      const gps = await manager.captureGPS();

      // GPSMultipath should have accuracy, speed, bearing, altitude — NOT lat/lon
      expect((gps as any).latitude).toBeUndefined();
      expect((gps as any).longitude).toBeUndefined();
      expect((gps as any).lat).toBeUndefined();
      expect((gps as any).lon).toBeUndefined();

      expect(gps.accuracy).toBe(5.0);
      expect(gps.speed).toBe(1.2);
      expect(gps.bearing).toBe(45.0);
      expect(gps.altitude).toBe(20.0);
      expect(gps.multipathIndicator).toBe(0);
    });

    it('should throw if GPS module not available', async () => {
      const noGps = createMockNativeModules({ gps: undefined });
      const mgr = createSensorManager(noGps);
      mgr.initialize(capabilities);
      await expect(mgr.captureGPS()).rejects.toThrow('GPS native module not available');
    });
  });

  describe('snapToGeoGrid — PRIVACY', () => {
    it('should snap coordinates to ~100m grid', () => {
      const grid = snapToGeoGrid(40.748817, -73.985428);

      // The snapped coordinates should differ from exact coordinates
      // Calculate expected precision: ~100m / 111320m/deg ~ 0.000898 degrees
      const gridSizeLat = FOUNDATION_GEO_GRID_METERS / 111320;
      expect(Math.abs(grid.lat - 40.748817)).toBeLessThanOrEqual(gridSizeLat);
      expect(grid.lat).not.toBe(40.748817); // very unlikely to be exact
    });

    it('should round to grid, not truncate', () => {
      const grid1 = snapToGeoGrid(40.0, -73.0);
      const grid2 = snapToGeoGrid(40.0001, -73.0001);
      // Small differences within same grid cell should snap to same point
      // 0.0001 degrees ~ 11m, well within 100m grid
      expect(grid1.lat).toBeCloseTo(grid2.lat, 8);
    });

    it('should handle equator coordinates', () => {
      const grid = snapToGeoGrid(0, 0);
      expect(typeof grid.lat).toBe('number');
      expect(typeof grid.lon).toBe('number');
      expect(isNaN(grid.lat)).toBe(false);
      expect(isNaN(grid.lon)).toBe(false);
    });

    it('should handle high latitude coordinates', () => {
      // Near poles, longitude grid gets larger
      const grid = snapToGeoGrid(89.9, 10.0);
      expect(typeof grid.lat).toBe('number');
      expect(typeof grid.lon).toBe('number');
      expect(isNaN(grid.lat)).toBe(false);
      expect(isNaN(grid.lon)).toBe(false);
    });

    it('should handle negative coordinates', () => {
      const grid = snapToGeoGrid(-33.8688, 151.2093); // Sydney
      expect(typeof grid.lat).toBe('number');
      expect(typeof grid.lon).toBe('number');
    });
  });

  // ── Individual Sensor Captures ────────────────────────────────────────────

  describe('captureBarometric', () => {
    it('should return barometric reading', async () => {
      const reading = await manager.captureBarometric();
      expect(reading.sensor).toBe('barometric');
      expect(reading.values.pressure).toBe(1013.25);
      expect(reading.values.relativeAltitude).toBe(0);
      expect(reading.timestamp).toBeGreaterThan(0);
    });

    it('should include geo grid when GPS available', async () => {
      const reading = await manager.captureBarometric();
      expect(reading.geoGrid).toBeDefined();
      expect(typeof reading.geoGrid!.lat).toBe('number');
      expect(typeof reading.geoGrid!.lon).toBe('number');
    });

    it('should throw if barometer not available', async () => {
      const noBaro = createMockNativeModules({ barometer: undefined });
      const mgr = createSensorManager(noBaro);
      mgr.initialize(capabilities);
      await expect(mgr.captureBarometric()).rejects.toThrow('Barometer native module not available');
    });
  });

  describe('captureMagnetometer', () => {
    it('should return magnetometer reading', async () => {
      const reading = await manager.captureMagnetometer();
      expect(reading.sensor).toBe('magnetometer');
      expect(reading.values.x).toBe(25.5);
      expect(reading.values.y).toBe(-10.2);
      expect(reading.values.z).toBe(42.8);
    });

    it('should throw if magnetometer not available', async () => {
      const noMag = createMockNativeModules({ magnetometer: undefined });
      const mgr = createSensorManager(noMag);
      mgr.initialize(capabilities);
      await expect(mgr.captureMagnetometer()).rejects.toThrow('Magnetometer native module not available');
    });
  });

  describe('captureAccelerometer', () => {
    it('should return accelerometer reading with duration', async () => {
      const reading = await manager.captureAccelerometer(500);
      expect(reading.sensor).toBe('accelerometer');
      expect(reading.values.x).toBe(0.01);
      expect(reading.values.y).toBe(0.02);
      expect(reading.values.z).toBe(9.81);
      expect(reading.values.magnitude).toBe(9.81);
      expect(mockModules.accelerometer!.readDuration).toHaveBeenCalledWith(500);
    });

    it('should throw if accelerometer not available', async () => {
      const noAccel = createMockNativeModules({ accelerometer: undefined });
      const mgr = createSensorManager(noAccel);
      mgr.initialize(capabilities);
      await expect(mgr.captureAccelerometer(100)).rejects.toThrow('Accelerometer native module not available');
    });
  });

  describe('captureAmbientLight', () => {
    it('should return ambient light reading', async () => {
      const reading = await manager.captureAmbientLight();
      expect(reading.sensor).toBe('ambient_light');
      expect(reading.values.lux).toBe(350);
    });

    it('should throw if ambient light not available', async () => {
      const noLight = createMockNativeModules({ ambientLight: undefined });
      const mgr = createSensorManager(noLight);
      mgr.initialize(capabilities);
      await expect(mgr.captureAmbientLight()).rejects.toThrow('Ambient light native module not available');
    });
  });

  // ── captureAll (Graceful Degradation) ──────────────────────────────────────

  describe('captureAll — graceful degradation', () => {
    it('should capture all available sensors', async () => {
      const readings = await manager.captureAll();
      expect(readings.length).toBeGreaterThan(0);
      const sensorTypes = readings.map(r => r.sensor);
      expect(sensorTypes).toContain('wifi');
      expect(sensorTypes).toContain('bluetooth');
      expect(sensorTypes).toContain('gps');
      expect(sensorTypes).toContain('barometric');
      expect(sensorTypes).toContain('magnetometer');
      expect(sensorTypes).toContain('accelerometer');
      expect(sensorTypes).toContain('ambient_light');
    });

    it('should continue when individual sensors fail', async () => {
      // WiFi and barometer fail, but others succeed
      const failingModules = createMockNativeModules({
        wifi: { scan: jest.fn().mockRejectedValue(new Error('WiFi scan failed')) },
        barometer: { read: jest.fn().mockRejectedValue(new Error('Barometer error')) },
      });
      const mgr = createSensorManager(failingModules);
      mgr.initialize(capabilities);

      const readings = await mgr.captureAll();

      // Should still have readings from other sensors
      const sensorTypes = readings.map(r => r.sensor);
      expect(sensorTypes).not.toContain('wifi');
      expect(sensorTypes).not.toContain('barometric');
      expect(sensorTypes).toContain('bluetooth');
      expect(sensorTypes).toContain('gps');
      expect(readings.length).toBeGreaterThan(0);
    });

    it('should return empty array when all sensors fail', async () => {
      const allFailModules: NativeSensorModules = {
        wifi: { scan: jest.fn().mockRejectedValue(new Error()) },
        bluetooth: { scanEnvironment: jest.fn().mockRejectedValue(new Error()) },
        gps: { getCurrentPosition: jest.fn().mockRejectedValue(new Error()) },
        barometer: { read: jest.fn().mockRejectedValue(new Error()) },
        magnetometer: { read: jest.fn().mockRejectedValue(new Error()) },
        accelerometer: { readDuration: jest.fn().mockRejectedValue(new Error()) },
        ambientLight: { read: jest.fn().mockRejectedValue(new Error()) },
      };
      const mgr = createSensorManager(allFailModules);
      mgr.initialize(capabilities);

      const readings = await mgr.captureAll();
      expect(readings).toEqual([]);
    });

    it('should work with only bluetooth disabled in hardware', async () => {
      const limitedCaps = createFullCapabilities({ bluetooth: false });
      manager.initialize(limitedCaps);

      const readings = await manager.captureAll();
      const sensorTypes = readings.map(r => r.sensor);
      expect(sensorTypes).not.toContain('bluetooth');
      expect(sensorTypes).toContain('wifi');
    });

    it('should work with only GPS available', async () => {
      const gpsCaps = createFullCapabilities({
        bluetooth: false,
        wifiDirect: false,
        barometer: false,
        magnetometer: false,
        accelerometer: false,
        ambientLight: false,
      });
      manager.initialize(gpsCaps);

      const readings = await manager.captureAll();
      const sensorTypes = readings.map(r => r.sensor);
      expect(sensorTypes).toContain('gps');
      expect(sensorTypes.length).toBe(1);
    });

    it('should include wifi aggregate data in readings', async () => {
      const readings = await manager.captureAll();
      const wifiReading = readings.find(r => r.sensor === 'wifi');
      expect(wifiReading).toBeDefined();
      expect(wifiReading!.values.networkCount).toBe(2);
    });

    it('should include geo grid in GPS readings', async () => {
      const readings = await manager.captureAll();
      const gpsReading = readings.find(r => r.sensor === 'gps');
      expect(gpsReading).toBeDefined();
      expect(gpsReading!.geoGrid).toBeDefined();
      expect(typeof gpsReading!.geoGrid!.lat).toBe('number');
      expect(typeof gpsReading!.geoGrid!.lon).toBe('number');
    });
  });

  // ── Sampling Rate ─────────────────────────────────────────────────────────

  describe('setSamplingRate', () => {
    it('should set the sampling multiplier', () => {
      manager.setSamplingRate(2);
      expect(manager.getSamplingIntervalMs()).toBe(FOUNDATION_SAMPLING_INTERVAL_MS * 2);
    });

    it('should default to 1x multiplier', () => {
      expect(manager.getSamplingIntervalMs()).toBe(FOUNDATION_SAMPLING_INTERVAL_MS);
    });

    it('should throw on non-positive multiplier', () => {
      expect(() => manager.setSamplingRate(0)).toThrow('Sampling rate multiplier must be positive');
      expect(() => manager.setSamplingRate(-1)).toThrow('Sampling rate multiplier must be positive');
    });

    it('should support fractional multipliers for faster sampling', () => {
      manager.setSamplingRate(0.5);
      expect(manager.getSamplingIntervalMs()).toBe(FOUNDATION_SAMPLING_INTERVAL_MS * 0.5);
    });

    it('should support battery-aware multiplier', () => {
      manager.setSamplingRate(2); // low battery mode
      expect(manager.getSamplingIntervalMs()).toBe(FOUNDATION_SAMPLING_INTERVAL_MS * 2);
    });
  });

  // ── Barometric geo grid without GPS ────────────────────────────────────────

  describe('geo grid availability', () => {
    it('should omit geo grid when GPS capability is unavailable', async () => {
      const noGpsModules = createMockNativeModules({ gps: undefined });
      const mgr = createSensorManager(noGpsModules);
      mgr.initialize(createFullCapabilities({ gps: false }));

      const reading = await mgr.captureBarometric();
      expect(reading.geoGrid).toBeUndefined();
    });

    it('should omit geo grid when GPS read fails', async () => {
      const failGps = createMockNativeModules({
        gps: { getCurrentPosition: jest.fn().mockRejectedValue(new Error('GPS timeout')) },
      });
      const mgr = createSensorManager(failGps);
      mgr.initialize(capabilities);

      const reading = await mgr.captureBarometric();
      expect(reading.geoGrid).toBeUndefined();
    });
  });
});
