// Concord Mobile — WiFi Direct Manager
// WiFi Direct group formation and data transfer for mesh sync

import {
  WIFI_DIRECT_GROUP_TIMEOUT_MS,
} from '../../utils/constants';
import type { WiFiDirectGroup } from '../../utils/types';

// ── External Module Interface ────────────────────────────────────────────────

export interface WiFiP2PModule {
  initialize(): Promise<void>;
  startDiscoveringPeers(): Promise<string>;
  stopDiscoveringPeers(): Promise<void>;
  getAvailablePeers(): Promise<WiFiP2PPeer[]>;
  connect(peerAddress: string): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionInfo(): Promise<WiFiP2PInfo>;
  sendMessage(message: string): Promise<void>;
  sendFile(uri: string): Promise<void>;
  receiveMessage(): Promise<string>;
  getGroupInfo(): Promise<WiFiP2PGroupInfo | null>;
}

export interface WiFiP2PPeer {
  deviceName: string;
  deviceAddress: string;
  isGroupOwner: boolean;
  status: number;
}

export interface WiFiP2PInfo {
  groupFormed: boolean;
  isGroupOwner: boolean;
  groupOwnerAddress: string;
}

export interface WiFiP2PGroupInfo {
  networkName: string;
  isGroupOwner: boolean;
  ownerAddress: string;
  clients: string[];
}

// ── Battery Info for Owner Selection ─────────────────────────────────────────

export interface BatteryInfo {
  level: number; // 0.0 - 1.0
}

// ── WiFi Direct Manager Interface ────────────────────────────────────────────

export interface WiFiDirectManager {
  discoverPeers(): Promise<string[]>;
  connect(peerAddress: string): Promise<WiFiDirectGroup>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getGroup(): WiFiDirectGroup | null;
  sendData(data: Uint8Array): Promise<number>;
  onDataReceived(callback: (data: Uint8Array, sender: string) => void): void;
  getConnectionInfo(): { isOwner: boolean; ownerAddress: string } | null;
}

// ── Helper: Encode/Decode Binary Data for Transport ──────────────────────────

export function encodeDataForTransport(data: Uint8Array): string {
  // Use a length-prefixed hex encoding for reliable transport
  const hexChars: string[] = [];
  for (let i = 0; i < data.length; i++) {
    hexChars.push(data[i].toString(16).padStart(2, '0'));
  }
  return `CONCORD:${data.length}:${hexChars.join('')}`;
}

export function decodeDataFromTransport(message: string): Uint8Array | null {
  if (!message.startsWith('CONCORD:')) {
    return null;
  }
  const parts = message.split(':');
  if (parts.length !== 3) {
    return null;
  }
  const length = parseInt(parts[1], 10);
  if (isNaN(length) || length < 0) {
    return null;
  }
  const hex = parts[2];
  if (hex.length !== length * 2) {
    return null;
  }
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createWiFiDirectManager(
  wifiP2P: WiFiP2PModule,
  getBattery?: () => BatteryInfo,
): WiFiDirectManager {
  let connected = false;
  let currentGroup: WiFiDirectGroup | null = null;
  let connectionInfo: { isOwner: boolean; ownerAddress: string } | null = null;
  const dataCallbacks: Array<(data: Uint8Array, sender: string) => void> = [];
  let listeningInterval: ReturnType<typeof setInterval> | null = null;

  function startListening(): void {
    if (listeningInterval) return;
    listeningInterval = setInterval(async () => {
      if (!connected) return;
      try {
        const message = await wifiP2P.receiveMessage();
        if (message) {
          const decoded = decodeDataFromTransport(message);
          if (decoded) {
            const sender = connectionInfo?.ownerAddress ?? 'unknown';
            for (const cb of dataCallbacks) {
              cb(decoded, sender);
            }
          }
        }
      } catch (_e) {
        // No data available, continue polling
      }
    }, 100);
  }

  function stopListening(): void {
    if (listeningInterval) {
      clearInterval(listeningInterval);
      listeningInterval = null;
    }
  }

  return {
    async discoverPeers(): Promise<string[]> {
      await wifiP2P.initialize();
      await wifiP2P.startDiscoveringPeers();

      // Wait a bounded time for peer discovery
      const startTime = Date.now();
      let peers: WiFiP2PPeer[] = [];

      while (Date.now() - startTime < WIFI_DIRECT_GROUP_TIMEOUT_MS) {
        peers = await wifiP2P.getAvailablePeers();
        if (peers.length > 0) break;
        // Brief delay between polls
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await wifiP2P.stopDiscoveringPeers();
      return peers.map(p => p.deviceAddress);
    },

    async connect(peerAddress: string): Promise<WiFiDirectGroup> {
      if (connected) {
        throw new Error('Already connected to a WiFi Direct group');
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('WiFi Direct connection timed out')),
          WIFI_DIRECT_GROUP_TIMEOUT_MS,
        );
      });

      try {
        await Promise.race([
          wifiP2P.connect(peerAddress),
          timeoutPromise,
        ]);

        const info = await wifiP2P.getConnectionInfo();
        if (!info.groupFormed) {
          throw new Error('WiFi Direct group formation failed');
        }

        const groupInfo = await wifiP2P.getGroupInfo();
        const isOwner = info.isGroupOwner;

        // Group owner selection: device with lower battery never becomes owner
        if (isOwner && getBattery) {
          const battery = getBattery();
          if (battery.level < 0.2) {
            // Low battery device should not be owner - disconnect and retry
            await wifiP2P.disconnect();
            throw new Error(
              'Low battery device cannot be group owner. Retry with BLE fallback.',
            );
          }
        }

        currentGroup = {
          isOwner,
          ownerAddress: info.groupOwnerAddress,
          members: groupInfo?.clients ?? [peerAddress],
          ssid: groupInfo?.networkName ?? '',
        };

        connectionInfo = {
          isOwner,
          ownerAddress: info.groupOwnerAddress,
        };

        connected = true;
        startListening();
        return currentGroup;
      } catch (error) {
        connected = false;
        currentGroup = null;
        connectionInfo = null;
        throw error;
      }
    },

    async disconnect(): Promise<void> {
      stopListening();
      if (connected) {
        try {
          await wifiP2P.disconnect();
        } finally {
          connected = false;
          currentGroup = null;
          connectionInfo = null;
        }
      }
    },

    isConnected(): boolean {
      return connected;
    },

    getGroup(): WiFiDirectGroup | null {
      return currentGroup;
    },

    async sendData(data: Uint8Array): Promise<number> {
      if (!connected) {
        throw new Error('Not connected to WiFi Direct group');
      }
      const encoded = encodeDataForTransport(data);
      await wifiP2P.sendMessage(encoded);
      return data.length;
    },

    onDataReceived(callback: (data: Uint8Array, sender: string) => void): void {
      dataCallbacks.push(callback);
    },

    getConnectionInfo(): { isOwner: boolean; ownerAddress: string } | null {
      return connectionInfo;
    },
  };
}
