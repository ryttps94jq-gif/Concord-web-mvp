// Concord Mobile — BLE Scanner
// Scans for nearby Concord mesh peers over Bluetooth Low Energy

import {
  CONCORD_BLE_SERVICE_UUID,
  BLE_SCAN_INTERVAL_MS,
  BLE_DISCOVERY_TIMEOUT_MS,
  TRANSPORT_LAYERS,
} from '../../utils/constants';
import type { MeshPeer, PeerReputation, PeerCapabilities } from '../../utils/types';
import type { BLEManager, BLEDevice } from './ble-advertiser';

// ── Scanner Options ───────────────────────────────────────────────────────────

export interface ScanOptions {
  scanIntervalMs?: number;
  discoveryTimeoutMs?: number;
  allowDuplicates?: boolean;
}

// ── BLE Scanner Interface ─────────────────────────────────────────────────────

export interface BLEScanner {
  startScan(onPeerDiscovered: (peer: MeshPeer) => void): Promise<void>;
  stopScan(): Promise<void>;
  isScanning(): boolean;
  getDiscoveredPeers(): MeshPeer[];
  clearPeers(): void;
}

// ── Implementation ────────────────────────────────────────────────────────────

const DEFAULT_REPUTATION: PeerReputation = {
  validDTUs: 0,
  invalidDTUs: 0,
  totalRelays: 0,
  score: 0.5, // neutral starting reputation
};

const DEFAULT_CAPABILITIES: PeerCapabilities = {
  bluetooth: true,
  wifiDirect: false,
  nfc: false,
  lora: false,
  internet: false,
};

export function createBLEScanner(
  bleManager: BLEManager,
  options?: ScanOptions,
): BLEScanner {
  const scanInterval = options?.scanIntervalMs ?? BLE_SCAN_INTERVAL_MS;
  const discoveryTimeout = options?.discoveryTimeoutMs ?? BLE_DISCOVERY_TIMEOUT_MS;
  const allowDuplicates = options?.allowDuplicates ?? false;

  let scanning = false;
  const peers = new Map<string, MeshPeer>();
  let staleCheckTimer: ReturnType<typeof setInterval> | null = null;

  function deviceToPeer(device: BLEDevice): MeshPeer {
    return {
      id: device.id,
      publicKey: '', // Will be populated after handshake
      name: device.localName ?? device.name ?? undefined,
      transport: TRANSPORT_LAYERS.BLUETOOTH,
      rssi: device.rssi ?? -100,
      lastSeen: Date.now(),
      capabilities: { ...DEFAULT_CAPABILITIES },
      reputation: { ...DEFAULT_REPUTATION },
      authenticated: false,
    };
  }

  function isStale(peer: MeshPeer): boolean {
    return Date.now() - peer.lastSeen > discoveryTimeout;
  }

  function pruneStale(): void {
    const now = Date.now();
    for (const [id, peer] of peers) {
      if (now - peer.lastSeen > discoveryTimeout) {
        peers.delete(id);
      }
    }
  }

  return {
    async startScan(onPeerDiscovered: (peer: MeshPeer) => void): Promise<void> {
      if (scanning) {
        return; // Already scanning
      }

      const state = await bleManager.state();
      if (state !== 'PoweredOn') {
        throw new Error(`BLE not ready: state is "${state}". Expected "PoweredOn".`);
      }

      scanning = true;

      bleManager.startDeviceScan(
        [CONCORD_BLE_SERVICE_UUID],
        { allowDuplicates },
        (error: Error | null, device: BLEDevice | null) => {
          if (error) {
            // Scan error; stop scanning if fatal
            if (error.message?.includes('powered off') || error.message?.includes('unauthorized')) {
              scanning = false;
            }
            return;
          }

          if (!device) {
            return;
          }

          const existingPeer = peers.get(device.id);
          if (existingPeer) {
            // Update existing peer: refresh RSSI and lastSeen
            existingPeer.rssi = device.rssi ?? existingPeer.rssi;
            existingPeer.lastSeen = Date.now();
            if (device.localName || device.name) {
              existingPeer.name = device.localName ?? device.name ?? existingPeer.name;
            }
          } else {
            // New peer discovered
            const peer = deviceToPeer(device);
            peers.set(device.id, peer);
            onPeerDiscovered(peer);
          }
        },
      );

      // Set up periodic stale peer pruning
      staleCheckTimer = setInterval(pruneStale, scanInterval);
    },

    async stopScan(): Promise<void> {
      if (!scanning) {
        return;
      }

      bleManager.stopDeviceScan();
      scanning = false;

      if (staleCheckTimer !== null) {
        clearInterval(staleCheckTimer);
        staleCheckTimer = null;
      }
    },

    isScanning(): boolean {
      return scanning;
    },

    getDiscoveredPeers(): MeshPeer[] {
      // Return only non-stale peers
      const result: MeshPeer[] = [];
      for (const peer of peers.values()) {
        if (!isStale(peer)) {
          result.push(peer);
        }
      }
      return result;
    },

    clearPeers(): void {
      peers.clear();
    },
  };
}
