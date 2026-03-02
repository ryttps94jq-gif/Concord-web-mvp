// Concord Mobile — Foundation Sense: Sensor Manager
// Manages all phone sensors with privacy-first design.
// CRITICAL PRIVACY:
//   - Bluetooth: aggregate data ONLY, never individual device identifiers
//   - WiFi: hashed SSIDs only
//   - GPS: geotagged to 100m grid, never exact coordinates

import {
  SensorReading,
  WiFiScanResult,
  BluetoothEnvironment,
  GPSMultipath,
  SensorType,
  HardwareCapabilities,
  GeoGrid,
} from '../../utils/types';
import {
  FOUNDATION_GEO_GRID_METERS,
  FOUNDATION_SAMPLING_INTERVAL_MS,
  FOUNDATION_LOW_BATTERY_MULTIPLIER,
} from '../../utils/constants';

// ── Native Module Interfaces ─────────────────────────────────────────────────

export interface NativeWiFiModule {
  scan(): Promise<Array<{
    ssid: string;
    bssid: string;
    rssi: number;
    frequency: number;
    channel: number;
    security: string;
  }>>;
}

export interface NativeBluetoothModule {
  scanEnvironment(): Promise<{
    deviceCount: number;
    aggregateRSSI: number;
    typeDistribution: Record<string, number>;
  }>;
}

export interface NativeGPSModule {
  getCurrentPosition(): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
    verticalAccuracy: number;
    speed: number;
    bearing: number;
    altitude: number;
    multipathIndicator: number;
  }>;
}

export interface NativeBarometerModule {
  read(): Promise<{ pressure: number; relativeAltitude: number }>;
}

export interface NativeMagnetometerModule {
  read(): Promise<{ x: number; y: number; z: number }>;
}

export interface NativeAccelerometerModule {
  readDuration(durationMs: number): Promise<{ x: number; y: number; z: number; magnitude: number }>;
}

export interface NativeAmbientLightModule {
  read(): Promise<{ lux: number }>;
}

export interface NativeSensorModules {
  wifi?: NativeWiFiModule;
  bluetooth?: NativeBluetoothModule;
  gps?: NativeGPSModule;
  barometer?: NativeBarometerModule;
  magnetometer?: NativeMagnetometerModule;
  accelerometer?: NativeAccelerometerModule;
  ambientLight?: NativeAmbientLightModule;
  hashSSID?: (ssid: string) => string;
}

// ── Sensor Manager Interface ─────────────────────────────────────────────────

export interface SensorManager {
  initialize(capabilities: HardwareCapabilities): void;
  captureAll(): Promise<SensorReading[]>;
  captureWiFi(): Promise<WiFiScanResult[]>;
  captureBluetooth(): Promise<BluetoothEnvironment>;
  captureGPS(): Promise<GPSMultipath>;
  captureBarometric(): Promise<SensorReading>;
  captureMagnetometer(): Promise<SensorReading>;
  captureAccelerometer(durationMs: number): Promise<SensorReading>;
  captureAmbientLight(): Promise<SensorReading>;
  getAvailableSensors(): SensorType[];
  setSamplingRate(multiplier: number): void;
  getSamplingIntervalMs(): number;
}

// ── Geo Grid Helpers ─────────────────────────────────────────────────────────

/**
 * Snap a GPS coordinate to an approximate 100m grid cell.
 * PRIVACY: Ensures exact coordinates are never stored or transmitted.
 *
 * 1 degree latitude ~ 111,320 meters
 * 1 degree longitude ~ 111,320 * cos(lat) meters
 */
export function snapToGeoGrid(lat: number, lon: number): GeoGrid {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos((lat * Math.PI) / 180);

  const gridSizeLat = FOUNDATION_GEO_GRID_METERS / metersPerDegreeLat;
  const gridSizeLon = metersPerDegreeLon > 0
    ? FOUNDATION_GEO_GRID_METERS / metersPerDegreeLon
    : FOUNDATION_GEO_GRID_METERS / metersPerDegreeLat;

  return {
    lat: Math.round(lat / gridSizeLat) * gridSizeLat,
    lon: Math.round(lon / gridSizeLon) * gridSizeLon,
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createSensorManager(nativeModules: NativeSensorModules): SensorManager {
  let _capabilities: HardwareCapabilities | null = null;
  let _samplingMultiplier = 1;
  let _initialized = false;

  const _hashSSID = nativeModules.hashSSID || defaultHashSSID;

  function defaultHashSSID(ssid: string): string {
    // Simple hash fallback — production should use crypto.sha256
    let hash = 0;
    for (let i = 0; i < ssid.length; i++) {
      const char = ssid.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'ssid_' + Math.abs(hash).toString(16);
  }

  function ensureInitialized(): void {
    if (!_initialized || !_capabilities) {
      throw new Error('SensorManager not initialized. Call initialize() first.');
    }
  }

  function isSensorAvailable(sensor: SensorType): boolean {
    if (!_capabilities) return false;
    const capabilityMap: Record<SensorType, keyof HardwareCapabilities> = {
      wifi: 'wifiDirect',
      bluetooth: 'bluetooth',
      gps: 'gps',
      barometric: 'barometer',
      magnetometer: 'magnetometer',
      accelerometer: 'accelerometer',
      gyroscope: 'gyroscope',
      ambient_light: 'ambientLight',
    };
    return !!_capabilities[capabilityMap[sensor]];
  }

  function hasNativeModule(sensor: SensorType): boolean {
    const moduleMap: Record<SensorType, keyof NativeSensorModules> = {
      wifi: 'wifi',
      bluetooth: 'bluetooth',
      gps: 'gps',
      barometric: 'barometer',
      magnetometer: 'magnetometer',
      accelerometer: 'accelerometer',
      gyroscope: 'accelerometer', // gyroscope uses accel module for now
      ambient_light: 'ambientLight',
    };
    return !!nativeModules[moduleMap[sensor]];
  }

  async function captureWiFi(): Promise<WiFiScanResult[]> {
    ensureInitialized();
    if (!nativeModules.wifi) {
      throw new Error('WiFi native module not available');
    }

    const rawResults = await nativeModules.wifi.scan();

    // PRIVACY: Hash SSIDs, never store raw SSID or BSSID
    return rawResults.map(result => ({
      ssidHash: _hashSSID(result.ssid),
      rssi: result.rssi,
      frequency: result.frequency,
      channel: result.channel,
      security: result.security,
      estimatedDistance: estimateDistanceFromRSSI(result.rssi, result.frequency),
    }));
  }

  async function captureBluetooth(): Promise<BluetoothEnvironment> {
    ensureInitialized();
    if (!nativeModules.bluetooth) {
      throw new Error('Bluetooth native module not available');
    }

    const env = await nativeModules.bluetooth.scanEnvironment();

    // PRIVACY: Return aggregate only. The native module itself must
    // ensure no individual device IDs are exposed. We enforce this
    // by only taking the aggregate fields.
    return {
      deviceCount: env.deviceCount,
      aggregateRSSI: env.aggregateRSSI,
      typeDistribution: { ...env.typeDistribution },
    };
  }

  async function captureGPS(): Promise<GPSMultipath> {
    ensureInitialized();
    if (!nativeModules.gps) {
      throw new Error('GPS native module not available');
    }

    const pos = await nativeModules.gps.getCurrentPosition();

    // PRIVACY: We intentionally do NOT return lat/lon in GPSMultipath.
    // The geo grid is attached separately via snapToGeoGrid in the
    // SensorReading.geoGrid field at capture time.
    return {
      accuracy: pos.accuracy,
      verticalAccuracy: pos.verticalAccuracy,
      speed: pos.speed,
      bearing: pos.bearing,
      altitude: pos.altitude,
      multipathIndicator: pos.multipathIndicator,
    };
  }

  async function captureBarometric(): Promise<SensorReading> {
    ensureInitialized();
    if (!nativeModules.barometer) {
      throw new Error('Barometer native module not available');
    }

    const data = await nativeModules.barometer.read();
    const geoGrid = await getGeoGridIfAvailable();

    return {
      sensor: 'barometric',
      timestamp: Date.now(),
      values: {
        pressure: data.pressure,
        relativeAltitude: data.relativeAltitude,
      },
      geoGrid,
    };
  }

  async function captureMagnetometer(): Promise<SensorReading> {
    ensureInitialized();
    if (!nativeModules.magnetometer) {
      throw new Error('Magnetometer native module not available');
    }

    const data = await nativeModules.magnetometer.read();
    const geoGrid = await getGeoGridIfAvailable();

    return {
      sensor: 'magnetometer',
      timestamp: Date.now(),
      values: { x: data.x, y: data.y, z: data.z },
      geoGrid,
    };
  }

  async function captureAccelerometer(durationMs: number): Promise<SensorReading> {
    ensureInitialized();
    if (!nativeModules.accelerometer) {
      throw new Error('Accelerometer native module not available');
    }

    const data = await nativeModules.accelerometer.readDuration(durationMs);
    const geoGrid = await getGeoGridIfAvailable();

    return {
      sensor: 'accelerometer',
      timestamp: Date.now(),
      values: {
        x: data.x,
        y: data.y,
        z: data.z,
        magnitude: data.magnitude,
      },
      geoGrid,
    };
  }

  async function captureAmbientLight(): Promise<SensorReading> {
    ensureInitialized();
    if (!nativeModules.ambientLight) {
      throw new Error('Ambient light native module not available');
    }

    const data = await nativeModules.ambientLight.read();
    const geoGrid = await getGeoGridIfAvailable();

    return {
      sensor: 'ambient_light',
      timestamp: Date.now(),
      values: { lux: data.lux },
      geoGrid,
    };
  }

  async function getGeoGridIfAvailable(): Promise<GeoGrid | undefined> {
    if (!nativeModules.gps || !_capabilities?.gps) {
      return undefined;
    }
    try {
      const pos = await nativeModules.gps.getCurrentPosition();
      return snapToGeoGrid(pos.latitude, pos.longitude);
    } catch {
      return undefined;
    }
  }

  async function captureAll(): Promise<SensorReading[]> {
    ensureInitialized();
    const readings: SensorReading[] = [];
    const available = getAvailableSensors();

    // Capture each sensor independently — failures don't block others
    const captures: Array<Promise<void>> = [];

    if (available.includes('wifi') && nativeModules.wifi) {
      captures.push(
        captureWiFi()
          .then(results => {
            readings.push({
              sensor: 'wifi',
              timestamp: Date.now(),
              values: {
                networkCount: results.length,
                avgRSSI: results.length > 0
                  ? results.reduce((sum, r) => sum + r.rssi, 0) / results.length
                  : 0,
              },
            });
          })
          .catch(() => { /* sensor failure — continue */ })
      );
    }

    if (available.includes('bluetooth') && nativeModules.bluetooth) {
      captures.push(
        captureBluetooth()
          .then(env => {
            readings.push({
              sensor: 'bluetooth',
              timestamp: Date.now(),
              values: {
                deviceCount: env.deviceCount,
                aggregateRSSI: env.aggregateRSSI,
              },
            });
          })
          .catch(() => { /* sensor failure — continue */ })
      );
    }

    if (available.includes('gps') && nativeModules.gps) {
      captures.push(
        (async () => {
          try {
            const gps = await captureGPS();
            const pos = await nativeModules.gps!.getCurrentPosition();
            const geoGrid = snapToGeoGrid(pos.latitude, pos.longitude);
            readings.push({
              sensor: 'gps',
              timestamp: Date.now(),
              values: {
                accuracy: gps.accuracy,
                speed: gps.speed,
                bearing: gps.bearing,
                altitude: gps.altitude,
              },
              geoGrid,
            });
          } catch {
            /* sensor failure — continue */
          }
        })()
      );
    }

    if (available.includes('barometric') && nativeModules.barometer) {
      captures.push(
        captureBarometric()
          .then(reading => { readings.push(reading); })
          .catch(() => { /* sensor failure — continue */ })
      );
    }

    if (available.includes('magnetometer') && nativeModules.magnetometer) {
      captures.push(
        captureMagnetometer()
          .then(reading => { readings.push(reading); })
          .catch(() => { /* sensor failure — continue */ })
      );
    }

    if (available.includes('accelerometer') && nativeModules.accelerometer) {
      captures.push(
        captureAccelerometer(100)
          .then(reading => { readings.push(reading); })
          .catch(() => { /* sensor failure — continue */ })
      );
    }

    if (available.includes('ambient_light') && nativeModules.ambientLight) {
      captures.push(
        captureAmbientLight()
          .then(reading => { readings.push(reading); })
          .catch(() => { /* sensor failure — continue */ })
      );
    }

    await Promise.all(captures);
    return readings;
  }

  function getAvailableSensors(): SensorType[] {
    ensureInitialized();
    const allSensors: SensorType[] = [
      'wifi', 'bluetooth', 'gps', 'barometric',
      'magnetometer', 'accelerometer', 'gyroscope', 'ambient_light',
    ];

    return allSensors.filter(s => isSensorAvailable(s) && hasNativeModule(s));
  }

  function setSamplingRate(multiplier: number): void {
    if (multiplier <= 0) {
      throw new Error('Sampling rate multiplier must be positive');
    }
    _samplingMultiplier = multiplier;
  }

  function getSamplingIntervalMs(): number {
    return FOUNDATION_SAMPLING_INTERVAL_MS * _samplingMultiplier;
  }

  return {
    initialize(capabilities: HardwareCapabilities): void {
      _capabilities = capabilities;
      _initialized = true;
    },
    captureAll,
    captureWiFi,
    captureBluetooth,
    captureGPS,
    captureBarometric,
    captureMagnetometer,
    captureAccelerometer,
    captureAmbientLight,
    getAvailableSensors,
    setSamplingRate,
    getSamplingIntervalMs,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function estimateDistanceFromRSSI(rssi: number, frequencyMHz: number): number {
  // Free-space path loss model
  // distance = 10 ^ ((27.55 - (20 * log10(freq)) + abs(rssi)) / 20)
  const exp = (27.55 - 20 * Math.log10(frequencyMHz) + Math.abs(rssi)) / 20;
  return Math.round(Math.pow(10, exp) * 100) / 100;
}
