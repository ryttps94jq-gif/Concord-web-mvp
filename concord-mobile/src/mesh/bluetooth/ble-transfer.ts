// Concord Mobile — BLE Transfer
// Chunked DTU transfer over BLE GATT characteristics

import {
  BLE_MTU_DEFAULT,
  CONCORD_BLE_SERVICE_UUID,
  CONCORD_BLE_DTU_HEADER_CHAR,
  CONCORD_BLE_DTU_CONTENT_CHAR,
} from '../../utils/constants';
import { toBase64, fromBase64, toHex } from '../../utils/crypto';
import type { DTU, BLETransferChunk, BLETransferSession } from '../../utils/types';
import type { BLEManager } from './ble-advertiser';

// ── Transfer Types ────────────────────────────────────────────────────────────

export interface TransferResult {
  success: boolean;
  dtuId: string;
  bytesTransferred: number;
  durationMs: number;
  chunks: number;
  error?: string;
}

export interface BLETransfer {
  sendDTU(peerId: string, dtu: DTU): Promise<TransferResult>;
  onDTUReceived(callback: (dtu: DTU, peerId: string) => void): void;
  getActiveTransfers(): BLETransferSession[];
  cancelTransfer(dtuId: string): void;
}

// ── Serialization Helpers ─────────────────────────────────────────────────────

export function serializeDTU(dtu: DTU): Uint8Array {
  const json = JSON.stringify({
    id: dtu.id,
    header: {
      version: dtu.header.version,
      flags: dtu.header.flags,
      type: dtu.header.type,
      timestamp: dtu.header.timestamp,
      contentLength: dtu.header.contentLength,
      contentHash: toHex(dtu.header.contentHash),
    },
    content: toBase64(dtu.content),
    signature: dtu.signature ? toBase64(dtu.signature) : null,
    tags: dtu.tags,
    meta: {
      ...dtu.meta,
    },
    lineage: dtu.lineage ?? null,
  });
  const encoder = new TextEncoder();
  return encoder.encode(json);
}

export function deserializeDTU(data: Uint8Array): DTU {
  const decoder = new TextDecoder();
  const json = decoder.decode(data);
  const parsed = JSON.parse(json);

  const contentHashBytes = new Uint8Array(
    (parsed.header.contentHash as string)
      .match(/.{2}/g)!
      .map((byte: string) => parseInt(byte, 16)),
  );

  return {
    id: parsed.id,
    header: {
      version: parsed.header.version,
      flags: parsed.header.flags,
      type: parsed.header.type,
      timestamp: parsed.header.timestamp,
      contentLength: parsed.header.contentLength,
      contentHash: contentHashBytes,
    },
    content: fromBase64(parsed.content),
    signature: parsed.signature ? fromBase64(parsed.signature) : undefined,
    tags: parsed.tags,
    meta: parsed.meta,
    lineage: parsed.lineage ?? undefined,
  };
}

// ── Chunking ──────────────────────────────────────────────────────────────────

export function chunkData(
  dtuId: string,
  data: Uint8Array,
  mtu: number = BLE_MTU_DEFAULT,
): BLETransferChunk[] {
  // Reserve bytes for chunk metadata envelope
  const CHUNK_OVERHEAD = 20; // sequenceNumber, totalChunks, dtuId prefix, isHeader flag
  const chunkPayloadSize = mtu - CHUNK_OVERHEAD;

  if (chunkPayloadSize <= 0) {
    throw new Error(`MTU ${mtu} too small for chunking (overhead is ${CHUNK_OVERHEAD} bytes)`);
  }

  const totalChunks = Math.ceil(data.length / chunkPayloadSize);
  const chunks: BLETransferChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkPayloadSize;
    const end = Math.min(start + chunkPayloadSize, data.length);
    chunks.push({
      sequenceNumber: i,
      totalChunks,
      dtuId,
      data: data.slice(start, end),
      isHeader: i === 0,
    });
  }

  return chunks;
}

export function reassembleChunks(
  session: BLETransferSession,
): Uint8Array | null {
  if (session.receivedChunks.size !== session.totalChunks) {
    return null; // Not all chunks received yet
  }

  let totalSize = 0;
  for (const chunk of session.receivedChunks.values()) {
    totalSize += chunk.length;
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (let i = 0; i < session.totalChunks; i++) {
    const chunk = session.receivedChunks.get(i);
    if (!chunk) {
      return null; // Missing chunk
    }
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// ── Chunk Serialization (for GATT writes) ─────────────────────────────────────

export function serializeChunk(chunk: BLETransferChunk): string {
  const envelope = JSON.stringify({
    seq: chunk.sequenceNumber,
    total: chunk.totalChunks,
    dtuId: chunk.dtuId,
    isHeader: chunk.isHeader,
    data: toBase64(chunk.data),
  });
  return toBase64(new TextEncoder().encode(envelope));
}

export function deserializeChunk(base64Value: string): BLETransferChunk {
  const decoded = new TextDecoder().decode(fromBase64(base64Value));
  const parsed = JSON.parse(decoded);
  return {
    sequenceNumber: parsed.seq,
    totalChunks: parsed.total,
    dtuId: parsed.dtuId,
    isHeader: parsed.isHeader,
    data: fromBase64(parsed.data),
  };
}

// ── Implementation ────────────────────────────────────────────────────────────

export function createBLETransfer(bleManager: BLEManager): BLETransfer {
  const activeSessions = new Map<string, BLETransferSession>();
  const receiveCallbacks: Array<(dtu: DTU, peerId: string) => void> = [];
  return {
    async sendDTU(peerId: string, dtu: DTU): Promise<TransferResult> {
      const startTime = Date.now();
      const serialized = serializeDTU(dtu);
      const chunks = chunkData(dtu.id, serialized);
      let bytesTransferred = 0;

      if (!bleManager.writeCharacteristicForDevice) {
        return {
          success: false,
          dtuId: dtu.id,
          bytesTransferred: 0,
          durationMs: Date.now() - startTime,
          chunks: 0,
          error: 'Write characteristic not supported',
        };
      }

      // Track as active session
      const sessionKey = `${peerId}:${dtu.id}`;
      const session: BLETransferSession = {
        dtuId: dtu.id,
        peerId,
        totalChunks: chunks.length,
        receivedChunks: new Map(),
        startedAt: startTime,
        lastChunkAt: startTime,
      };
      activeSessions.set(sessionKey, session);

      try {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const charUUID = chunk.isHeader
            ? CONCORD_BLE_DTU_HEADER_CHAR
            : CONCORD_BLE_DTU_CONTENT_CHAR;

          const chunkBase64 = serializeChunk(chunk);

          await bleManager.writeCharacteristicForDevice(
            peerId,
            CONCORD_BLE_SERVICE_UUID,
            charUUID,
            chunkBase64,
          );

          bytesTransferred += chunk.data.length;
          session.receivedChunks.set(i, chunk.data);
          session.lastChunkAt = Date.now();
        }

        activeSessions.delete(sessionKey);

        return {
          success: true,
          dtuId: dtu.id,
          bytesTransferred,
          durationMs: Date.now() - startTime,
          chunks: chunks.length,
        };
      } catch (error) {
        activeSessions.delete(sessionKey);

        return {
          success: false,
          dtuId: dtu.id,
          bytesTransferred,
          durationMs: Date.now() - startTime,
          chunks: chunks.length,
          error: error instanceof Error ? error.message : 'Unknown transfer error',
        };
      }
    },

    onDTUReceived(callback: (dtu: DTU, peerId: string) => void): void {
      receiveCallbacks.push(callback);
    },

    getActiveTransfers(): BLETransferSession[] {
      return Array.from(activeSessions.values());
    },

    cancelTransfer(dtuId: string): void {
      for (const [key, session] of activeSessions) {
        if (session.dtuId === dtuId) {
          activeSessions.delete(key);
        }
      }
    },
  };
}
