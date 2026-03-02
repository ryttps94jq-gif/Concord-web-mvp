// Concord Mobile — BLE Advertiser
// Advertises the Concord mesh service over Bluetooth Low Energy

import { CONCORD_BLE_SERVICE_UUID } from '../../utils/constants';

// ── BLE Manager Interface (matches react-native-ble-plx subset) ──────────────
export interface BLEManager {
  startDeviceScan(
    serviceUUIDs: string[] | null,
    options: Record<string, unknown> | null,
    listener: (error: Error | null, device: BLEDevice | null) => void,
  ): void;
  stopDeviceScan(): void;
  destroy(): void;
  state(): Promise<string>;
  // Advertising (platform-dependent; Android supports via native modules)
  startAdvertising?(serviceUUID: string, localName: string): Promise<void>;
  stopAdvertising?(): Promise<void>;
  // GATT server capabilities
  addService?(serviceUUID: string, characteristics: BLECharacteristicConfig[]): Promise<void>;
  removeService?(serviceUUID: string): Promise<void>;
  // Connection
  connectToDevice(deviceId: string, options?: Record<string, unknown>): Promise<BLEDevice>;
  cancelDeviceConnection(deviceId: string): Promise<BLEDevice>;
  // Read/write
  writeCharacteristicForDevice?(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    valueBase64: string,
  ): Promise<BLECharacteristic>;
  monitorCharacteristicForDevice?(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: Error | null, characteristic: BLECharacteristic | null) => void,
  ): { remove(): void };
}

export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  serviceUUIDs: string[] | null;
  localName: string | null;
  manufacturerData: string | null;
}

export interface BLECharacteristic {
  uuid: string;
  serviceUUID: string;
  value: string | null;
}

export interface BLECharacteristicConfig {
  uuid: string;
  properties: string[];
  permissions: string[];
}

// ── BLE Advertiser Interface ──────────────────────────────────────────────────

export interface BLEAdvertiser {
  start(): Promise<void>;
  stop(): Promise<void>;
  isAdvertising(): boolean;
  getServiceUUID(): string;
}

// ── Implementation ────────────────────────────────────────────────────────────

export function createBLEAdvertiser(bleManager: BLEManager): BLEAdvertiser {
  let advertising = false;

  return {
    async start(): Promise<void> {
      if (advertising) {
        return; // Already advertising, no-op
      }

      const state = await bleManager.state();
      if (state !== 'PoweredOn') {
        throw new Error(`BLE not ready: state is "${state}". Expected "PoweredOn".`);
      }

      if (!bleManager.startAdvertising) {
        throw new Error(
          'BLE advertising not supported on this platform. ' +
          'Ensure native advertising module is available.',
        );
      }

      await bleManager.startAdvertising(CONCORD_BLE_SERVICE_UUID, 'Concord');
      advertising = true;
    },

    async stop(): Promise<void> {
      if (!advertising) {
        return; // Not advertising, no-op
      }

      if (bleManager.stopAdvertising) {
        await bleManager.stopAdvertising();
      }

      advertising = false;
    },

    isAdvertising(): boolean {
      return advertising;
    },

    getServiceUUID(): string {
      return CONCORD_BLE_SERVICE_UUID;
    },
  };
}
