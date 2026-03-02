// Concord Mobile — Hardware Capability Detection
// Detects available radios, sensors, and device characteristics

import { HardwareCapabilities } from './types';

// Native module interface for platform-specific hardware detection
export interface NativeDeviceInfo {
  hasBluetooth(): Promise<boolean>;
  hasBluetoothLE(): Promise<boolean>;
  hasWifiDirect(): Promise<boolean>;
  hasNFC(): Promise<boolean>;
  hasGPS(): Promise<boolean>;
  hasBarometer(): Promise<boolean>;
  hasMagnetometer(): Promise<boolean>;
  hasAccelerometer(): Promise<boolean>;
  hasGyroscope(): Promise<boolean>;
  hasAmbientLight(): Promise<boolean>;
  hasFMRadio(): Promise<boolean>;
  hasSecureEnclave(): Promise<boolean>;
  getTotalRAMGB(): Promise<number>;
  getAvailableStorageGB(): Promise<number>;
  getCPUCores(): Promise<number>;
  getPlatform(): 'ios' | 'android';
  getOSVersion(): Promise<string>;
}

let _nativeDeviceInfo: NativeDeviceInfo | null = null;

export function setNativeDeviceInfo(info: NativeDeviceInfo): void {
  _nativeDeviceInfo = info;
}

export function getNativeDeviceInfo(): NativeDeviceInfo {
  if (!_nativeDeviceInfo) {
    throw new Error('NativeDeviceInfo not initialized. Call setNativeDeviceInfo() at app startup.');
  }
  return _nativeDeviceInfo;
}

/**
 * Detect all hardware capabilities of the device.
 * Each capability is probed independently — a failure in one does not block others.
 */
export async function detectHardwareCapabilities(): Promise<HardwareCapabilities> {
  const native = getNativeDeviceInfo();

  const results = await Promise.allSettled([
    native.hasBluetooth(),
    native.hasBluetoothLE(),
    native.hasWifiDirect(),
    native.hasNFC(),
    native.hasGPS(),
    native.hasBarometer(),
    native.hasMagnetometer(),
    native.hasAccelerometer(),
    native.hasGyroscope(),
    native.hasAmbientLight(),
    native.hasFMRadio(),
    native.hasSecureEnclave(),
    native.getTotalRAMGB(),
    native.getAvailableStorageGB(),
    native.getCPUCores(),
    native.getOSVersion(),
  ]);

  function boolResult(index: number): boolean {
    const r = results[index];
    return r.status === 'fulfilled' ? r.value as boolean : false;
  }

  function numResult(index: number, fallback: number): number {
    const r = results[index];
    return r.status === 'fulfilled' ? r.value as number : fallback;
  }

  function strResult(index: number, fallback: string): string {
    const r = results[index];
    return r.status === 'fulfilled' ? r.value as string : fallback;
  }

  return {
    bluetooth: boolResult(0),
    bluetoothLE: boolResult(1),
    wifiDirect: boolResult(2),
    nfc: boolResult(3),
    gps: boolResult(4),
    barometer: boolResult(5),
    magnetometer: boolResult(6),
    accelerometer: boolResult(7),
    gyroscope: boolResult(8),
    ambientLight: boolResult(9),
    fmRadio: boolResult(10),
    secureEnclave: boolResult(11),
    totalRAMGB: numResult(12, 0),
    availableStorageGB: numResult(13, 0),
    cpuCores: numResult(14, 1),
    platform: native.getPlatform(),
    osVersion: strResult(15, 'unknown'),
  };
}

/**
 * Check if a specific hardware capability is available.
 */
export async function isCapabilityAvailable(
  capability: keyof HardwareCapabilities
): Promise<boolean> {
  const capabilities = await detectHardwareCapabilities();
  const value = capabilities[capability];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  // string capabilities (platform, osVersion) are always "available"
  return true;
}

/**
 * Determine graceful degradation messages for unavailable capabilities.
 * Returns a list of human-readable strings describing what is missing
 * but the app can still operate without.
 */
export function getGracefulDegradation(capabilities: HardwareCapabilities): string[] {
  const degradations: string[] = [];

  const capabilityMessages: Record<string, string> = {
    bluetooth: 'Bluetooth unavailable — BLE mesh transport disabled',
    bluetoothLE: 'Bluetooth LE unavailable — BLE mesh transport disabled',
    wifiDirect: 'WiFi Direct unavailable — WiFi P2P mesh transport disabled',
    nfc: 'NFC unavailable — tap-to-share disabled',
    gps: 'GPS unavailable — location-based features limited',
    barometer: 'Barometer unavailable — altitude sensing disabled',
    magnetometer: 'Magnetometer unavailable — compass heading disabled',
    accelerometer: 'Accelerometer unavailable — motion sensing disabled',
    gyroscope: 'Gyroscope unavailable — rotation sensing disabled',
    ambientLight: 'Ambient light sensor unavailable — light-based context disabled',
    fmRadio: 'FM radio unavailable — broadcast receive disabled',
    secureEnclave: 'Secure enclave unavailable — using software key storage',
  };

  for (const [key, message] of Object.entries(capabilityMessages)) {
    if (!capabilities[key as keyof HardwareCapabilities]) {
      degradations.push(message);
    }
  }

  if (capabilities.totalRAMGB < 2) {
    degradations.push('Low RAM — local AI model may be constrained');
  }

  if (capabilities.availableStorageGB < 1) {
    degradations.push('Low storage — DTU lattice capacity limited');
  }

  return degradations;
}
