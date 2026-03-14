// Concord Mobile — LoRa Bridge
// LoRa bridge via Meshtastic BLE serial connection

import {
  LORA_MAX_PACKET_BYTES,
  LORA_DEFAULT_SPREADING_FACTOR,
  DTU_TYPES,
} from '../../utils/constants';
import { toBase64, fromBase64, crc32 } from '../../utils/crypto';
import type { DTU, DTUTypeCode, LoRaConfig } from '../../utils/types';

// ── External BLE Manager Interface ───────────────────────────────────────────

export interface BLEManager {
  connectToDevice(deviceId: string): Promise<BLEDevice>;
  disconnectFromDevice(deviceId: string): Promise<void>;
  writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    data: string,
  ): Promise<void>;
  monitorCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    callback: (data: string) => void,
  ): { remove(): void };
}

export interface BLEDevice {
  id: string;
  name: string | null;
}

// ── Meshtastic BLE UUIDs ─────────────────────────────────────────────────────

const MESHTASTIC_SERVICE_UUID = '6ba1b218-15a8-461f-9fa8-5dcae273eafd';
const MESHTASTIC_TORADIO_UUID = 'f75c76d2-129e-4dad-a1dd-7866124401e7';
const MESHTASTIC_FROMRADIO_UUID = '2c55e69e-4993-11ed-b878-0242ac120002';

// ── Priority Levels (higher = more urgent) ───────────────────────────────────

export const LORA_PRIORITY = {
  EMERGENCY: 4,
  SHIELD: 3,
  FOUNDATION: 2,
  USER: 1,
} as const;

const DTU_TYPE_PRIORITY: Record<number, number> = {
  [DTU_TYPES.EMERGENCY_ALERT]: LORA_PRIORITY.EMERGENCY,
  [DTU_TYPES.SHIELD_THREAT]: LORA_PRIORITY.SHIELD,
  [DTU_TYPES.FOUNDATION_SENSE]: LORA_PRIORITY.FOUNDATION,
  [DTU_TYPES.MESH_CONTROL]: LORA_PRIORITY.FOUNDATION,
  [DTU_TYPES.TEXT]: LORA_PRIORITY.USER,
  [DTU_TYPES.KNOWLEDGE]: LORA_PRIORITY.USER,
  [DTU_TYPES.LENS]: LORA_PRIORITY.USER,
  [DTU_TYPES.ECONOMY_TRANSACTION]: LORA_PRIORITY.USER,
  [DTU_TYPES.IDENTITY_ASSERTION]: LORA_PRIORITY.USER,
  [DTU_TYPES.CREATIVE_WORK]: LORA_PRIORITY.USER,
  [DTU_TYPES.ATLAS_SIGNAL]: LORA_PRIORITY.USER,
  [DTU_TYPES.LINEAGE_REF]: LORA_PRIORITY.USER,
  [DTU_TYPES.BROADCAST_RELAY]: LORA_PRIORITY.USER,
  [DTU_TYPES.SENSOR_READING]: LORA_PRIORITY.FOUNDATION,
};

// ── LoRa Bandwidth Mapping ──────────────────────────────────────────────────

/**
 * Bandwidth adaptation: spreading factor determines range vs speed.
 * SF7  = short range, high bandwidth (~5.5 kbps)
 * SF12 = long range, low bandwidth (~0.3 kbps)
 */
const SF_BANDWIDTH_MAP: Record<number, number> = {
  7: 125000,
  8: 125000,
  9: 125000,
  10: 125000,
  11: 250000,
  12: 500000,
};

// ── DTU Compression for LoRa ─────────────────────────────────────────────────

/**
 * Compress a DTU into a compact binary packet for LoRa transmission.
 * Format:
 *   [1 byte version] [1 byte type] [1 byte flags] [1 byte priority]
 *   [4 bytes CRC32] [2 bytes content_length] [N bytes content_id (truncated to 16)]
 *   [remaining: compressed content]
 */
export function compressDTUForLoRa(dtu: DTU): Uint8Array {
  const idBytes = new TextEncoder().encode(dtu.id.slice(0, 16));
  const contentBytes = dtu.content;
  const priority = getDTUPriority(dtu);

  // Header: 4 fixed bytes + 4 CRC + 2 length + 16 id = 26 overhead
  const overhead = 4 + 4 + 2 + idBytes.length;
  const maxContent = LORA_MAX_PACKET_BYTES - overhead;

  const contentToSend = contentBytes.length <= maxContent
    ? contentBytes
    : contentBytes.slice(0, maxContent);

  const packet = new Uint8Array(overhead + contentToSend.length);
  const view = new DataView(packet.buffer);

  // Fixed header
  packet[0] = dtu.header.version;
  packet[1] = dtu.header.type & 0xFF;
  packet[2] = dtu.header.flags;
  packet[3] = priority;

  // CRC32 of the original content for integrity
  const checksum = crc32(dtu.content);
  view.setUint32(4, checksum, false);

  // Content length (original)
  view.setUint16(8, contentToSend.length, false);

  // ID (variable length, padded/truncated to match)
  packet.set(idBytes, 10);

  // Content
  packet.set(contentToSend, 10 + idBytes.length);

  return packet;
}

/**
 * Get the effective packet size of a compressed DTU.
 */
export function getCompressedSize(dtu: DTU): number {
  return compressDTUForLoRa(dtu).length;
}

/**
 * Get the priority level for a DTU based on its type.
 */
export function getDTUPriority(dtu: DTU): number {
  return DTU_TYPE_PRIORITY[dtu.header.type] ?? LORA_PRIORITY.USER;
}

// ── Queue Entry ──────────────────────────────────────────────────────────────

interface LoRaQueueEntry {
  dtu: DTU;
  priority: number;
  enqueuedAt: number;
  compressed: Uint8Array;
}

// ── LoRaBridge Interface ─────────────────────────────────────────────────────

export interface LoRaBridge {
  connect(deviceId: string): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sendDTU(dtu: DTU): Promise<boolean>;
  onDTUReceived(callback: (dtu: DTU) => void): void;
  getConfig(): LoRaConfig;
  setSpreadingFactor(sf: number): void;
  getQueueDepth(): number;
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createLoRaBridge(bleManager: BLEManager): LoRaBridge {
  let connected = false;
  let deviceId: string | null = null;
  let monitorSubscription: { remove(): void } | null = null;
  const receiveCallbacks: Array<(dtu: DTU) => void> = [];
  const sendQueue: LoRaQueueEntry[] = [];
  let processing = false;

  let config: LoRaConfig = {
    spreadingFactor: LORA_DEFAULT_SPREADING_FACTOR,
    bandwidth: SF_BANDWIDTH_MAP[LORA_DEFAULT_SPREADING_FACTOR] ?? 125000,
    codingRate: 5, // 4/5
    txPower: 20, // dBm
  };

  /**
   * Process the send queue in priority order.
   * Emergency > Shield > Foundation > User
   */
  async function processQueue(): Promise<void> {
    if (processing || !connected || !deviceId) return;
    processing = true;

    try {
      while (sendQueue.length > 0 && connected) {
        // Sort by priority (descending), then by enqueue time (ascending)
        sendQueue.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.enqueuedAt - b.enqueuedAt;
        });

        const entry = sendQueue.shift()!;
        const base64Data = toBase64(entry.compressed);

        try {
          await bleManager.writeCharacteristic(
            deviceId,
            MESHTASTIC_SERVICE_UUID,
            MESHTASTIC_TORADIO_UUID,
            base64Data,
          );
        } catch {
          // Write failed, re-queue with same priority
          sendQueue.unshift(entry);
          break;
        }
      }
    } finally {
      processing = false;
    }
  }

  return {
    async connect(devId: string): Promise<boolean> {
      if (connected) {
        throw new Error('Already connected to a LoRa device');
      }

      try {
        await bleManager.connectToDevice(devId);
        deviceId = devId;
        connected = true;

        // Start monitoring for incoming packets
        monitorSubscription = bleManager.monitorCharacteristic(
          devId,
          MESHTASTIC_SERVICE_UUID,
          MESHTASTIC_FROMRADIO_UUID,
          (data: string) => {
            try {
              const bytes = fromBase64(data);
              // Attempt to reconstruct a DTU from the LoRa packet
              // This is a simplified reconstruction; real Meshtastic uses protobuf
              if (bytes.length < 10) return;

              const version = bytes[0];
              const type = bytes[1];
              const flags = bytes[2];
              // bytes[3] is priority (unused in reconstruction)

              const packetView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
              const storedCrc = packetView.getUint32(4, false);
              const contentLength = packetView.getUint16(8, false);

              // Extract ID (next bytes up to content start)
              const decoder = new TextDecoder();
              const idEndOffset = Math.min(26, bytes.length);
              const idBytes = bytes.slice(10, idEndOffset);
              const id = decoder.decode(idBytes).replace(/\0/g, '');

              // Extract content
              const content = bytes.slice(idEndOffset, idEndOffset + contentLength);

              // Verify CRC
              const computedCrc = crc32(content);
              if (computedCrc !== storedCrc) return;

              const dtu: DTU = {
                id,
                header: {
                  version,
                  flags,
                  type: type as DTUTypeCode,
                  timestamp: Date.now(),
                  contentLength: content.length,
                  contentHash: new Uint8Array(32), // Placeholder; real hash computed by receiver
                },
                content,
                tags: [],
                meta: {
                  scope: 'regional',
                  published: false,
                  painTagged: false,
                  crpiScore: 0,
                  relayCount: 0,
                  ttl: 7,
                  receivedAt: Date.now(),
                },
              };

              for (const cb of receiveCallbacks) {
                cb(dtu);
              }
            } catch {
              // Malformed packet, ignore
            }
          },
        );

        return true;
      } catch {
        connected = false;
        deviceId = null;
        return false;
      }
    },

    async disconnect(): Promise<void> {
      if (monitorSubscription) {
        monitorSubscription.remove();
        monitorSubscription = null;
      }
      if (connected && deviceId) {
        try {
          await bleManager.disconnectFromDevice(deviceId);
        } finally {
          connected = false;
          deviceId = null;
          sendQueue.length = 0;
        }
      }
    },

    isConnected(): boolean {
      return connected;
    },

    async sendDTU(dtu: DTU): Promise<boolean> {
      if (!connected) {
        throw new Error('Not connected to LoRa device');
      }

      const compressed = compressDTUForLoRa(dtu);
      if (compressed.length > LORA_MAX_PACKET_BYTES) {
        throw new Error(
          `Compressed DTU (${compressed.length} bytes) exceeds LoRa max packet size (${LORA_MAX_PACKET_BYTES} bytes)`,
        );
      }

      const priority = getDTUPriority(dtu);

      sendQueue.push({
        dtu,
        priority,
        enqueuedAt: Date.now(),
        compressed,
      });

      // Trigger async queue processing
      processQueue().catch(() => {});
      return true;
    },

    onDTUReceived(callback: (dtu: DTU) => void): void {
      receiveCallbacks.push(callback);
    },

    getConfig(): LoRaConfig {
      return { ...config };
    },

    setSpreadingFactor(sf: number): void {
      if (sf < 7 || sf > 12) {
        throw new Error(`Spreading factor must be 7-12, got ${sf}`);
      }
      config = {
        ...config,
        spreadingFactor: sf,
        bandwidth: SF_BANDWIDTH_MAP[sf] ?? 125000,
      };
    },

    getQueueDepth(): number {
      return sendQueue.length;
    },
  };
}
