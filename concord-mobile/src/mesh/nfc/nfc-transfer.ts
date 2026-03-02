// Concord Mobile — NFC Transfer
// NFC tap-to-share DTU transfer using NDEF records

import { NFC_MAX_PAYLOAD_BYTES } from '../../utils/constants';
import { toHex, toBase64, fromBase64, crc32 } from '../../utils/crypto';
import type { DTU, NDEFDTURecord } from '../../utils/types';

// ── External NFC Module Interface ────────────────────────────────────────────

export interface NFCManagerModule {
  isSupported(): Promise<boolean>;
  start(): Promise<void>;
  registerTagEvent(callback: (tag: NFCTag) => void): Promise<void>;
  unregisterTagEvent(): Promise<void>;
  writeNdefMessage(records: NFCNdefRecord[]): Promise<void>;
  requestTechnology(tech: string): Promise<void>;
  cancelTechnologyRequest(): Promise<void>;
}

export interface NFCTag {
  ndefMessage?: NFCNdefRecord[];
  id?: string;
}

export interface NFCNdefRecord {
  tnf: number; // Type Name Format
  type: string;
  id: string;
  payload: string; // base64 encoded
}

// ── NDEF Constants ───────────────────────────────────────────────────────────

const CONCORD_NDEF_TYPE = 'concord/dtu';
const CONCORD_NDEF_TNF = 0x04; // TNF_EXTERNAL_TYPE
const CONCORD_MAGIC_BYTES = new Uint8Array([0xC0, 0x4D]); // "CO" for Concord

// ── NFCTransfer Interface ────────────────────────────────────────────────────

export interface NFCTransfer {
  initialize(): Promise<boolean>;
  isSupported(): boolean;
  encodeDTU(dtu: DTU): NDEFDTURecord;
  decodeDTU(record: NDEFDTURecord): DTU;
  sendDTU(dtu: DTU): Promise<boolean>;
  sendBatch(dtus: DTU[]): Promise<{ sent: number; failed: number }>;
  startListening(onReceived: (dtu: DTU) => void): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): boolean;
}

// ── Serialization ────────────────────────────────────────────────────────────

/**
 * Serialize a DTU into a compact binary format for NFC NDEF payload.
 * Format:
 *   [2 bytes magic] [4 bytes CRC32] [JSON payload]
 */
export function serializeDTUForNFC(dtu: DTU): Uint8Array {
  const jsonStr = JSON.stringify({
    id: dtu.id,
    h: {
      v: dtu.header.version,
      f: dtu.header.flags,
      t: dtu.header.type,
      ts: dtu.header.timestamp,
      cl: dtu.header.contentLength,
      ch: toHex(dtu.header.contentHash),
    },
    c: toBase64(dtu.content),
    s: dtu.signature ? toBase64(dtu.signature) : null,
    tg: dtu.tags,
    m: dtu.meta,
    l: dtu.lineage ?? null,
  });

  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonStr);

  // Calculate CRC32 of the JSON content for integrity
  const checksum = crc32(jsonBytes);
  const checksumBytes = new Uint8Array(4);
  const view = new DataView(checksumBytes.buffer);
  view.setUint32(0, checksum, false);

  // Assemble: magic + checksum + json
  const result = new Uint8Array(2 + 4 + jsonBytes.length);
  result.set(CONCORD_MAGIC_BYTES, 0);
  result.set(checksumBytes, 2);
  result.set(jsonBytes, 6);
  return result;
}

/**
 * Deserialize a DTU from NFC NDEF binary payload.
 */
export function deserializeDTUFromNFC(data: Uint8Array): DTU {
  // Verify magic bytes
  if (data.length < 6 || data[0] !== 0xC0 || data[1] !== 0x4D) {
    throw new Error('Invalid Concord NFC record: bad magic bytes');
  }

  // Extract and verify checksum
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const storedChecksum = view.getUint32(2, false);
  const jsonBytes = data.slice(6);
  const computedChecksum = crc32(jsonBytes);

  if (storedChecksum !== computedChecksum) {
    throw new Error('NFC record integrity check failed: CRC32 mismatch');
  }

  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(jsonBytes);
  const parsed = JSON.parse(jsonStr);

  const contentHashHex = parsed.h.ch as string;
  const contentHash = new Uint8Array(
    contentHashHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)),
  );

  return {
    id: parsed.id,
    header: {
      version: parsed.h.v,
      flags: parsed.h.f,
      type: parsed.h.t,
      timestamp: parsed.h.ts,
      contentLength: parsed.h.cl,
      contentHash,
    },
    content: fromBase64(parsed.c),
    signature: parsed.s ? fromBase64(parsed.s) : undefined,
    tags: parsed.tg,
    meta: parsed.m,
    lineage: parsed.l ?? undefined,
  };
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createNFCTransfer(nfcManager: NFCManagerModule): NFCTransfer {
  let supported = false;
  let initialized = false;
  let listening = false;

  return {
    async initialize(): Promise<boolean> {
      try {
        supported = await nfcManager.isSupported();
        if (supported) {
          await nfcManager.start();
          initialized = true;
        }
        return supported;
      } catch {
        supported = false;
        initialized = false;
        return false;
      }
    },

    isSupported(): boolean {
      return supported;
    },

    encodeDTU(dtu: DTU): NDEFDTURecord {
      const payload = serializeDTUForNFC(dtu);

      if (payload.length > NFC_MAX_PAYLOAD_BYTES) {
        throw new Error(
          `DTU too large for NFC: ${payload.length} bytes exceeds ${NFC_MAX_PAYLOAD_BYTES} byte limit`,
        );
      }

      return {
        type: 'concord/dtu',
        id: dtu.id,
        header: payload.slice(0, Math.min(48, payload.length)),
        content: payload,
      };
    },

    decodeDTU(record: NDEFDTURecord): DTU {
      if (record.type !== 'concord/dtu') {
        throw new Error(`Not a Concord DTU record: type=${record.type}`);
      }
      return deserializeDTUFromNFC(record.content);
    },

    async sendDTU(dtu: DTU): Promise<boolean> {
      if (!initialized) {
        throw new Error('NFC not initialized. Call initialize() first.');
      }
      if (!supported) {
        throw new Error('NFC not supported on this device');
      }

      const payload = serializeDTUForNFC(dtu);
      if (payload.length > NFC_MAX_PAYLOAD_BYTES) {
        throw new Error(
          `DTU too large for NFC: ${payload.length} bytes exceeds ${NFC_MAX_PAYLOAD_BYTES} byte limit`,
        );
      }

      try {
        await nfcManager.requestTechnology('Ndef');
        await nfcManager.writeNdefMessage([
          {
            tnf: CONCORD_NDEF_TNF,
            type: CONCORD_NDEF_TYPE,
            id: dtu.id,
            payload: toBase64(payload),
          },
        ]);
        await nfcManager.cancelTechnologyRequest();
        return true;
      } catch {
        try {
          await nfcManager.cancelTechnologyRequest();
        } catch {
          // Ignore cleanup errors
        }
        return false;
      }
    },

    async sendBatch(dtus: DTU[]): Promise<{ sent: number; failed: number }> {
      if (!initialized) {
        throw new Error('NFC not initialized. Call initialize() first.');
      }
      if (!supported) {
        throw new Error('NFC not supported on this device');
      }

      let sent = 0;
      let failed = 0;

      // Batch sends DTUs sequentially in a single session
      try {
        await nfcManager.requestTechnology('Ndef');

        for (const dtu of dtus) {
          try {
            const payload = serializeDTUForNFC(dtu);
            if (payload.length > NFC_MAX_PAYLOAD_BYTES) {
              failed++;
              continue;
            }

            await nfcManager.writeNdefMessage([
              {
                tnf: CONCORD_NDEF_TNF,
                type: CONCORD_NDEF_TYPE,
                id: dtu.id,
                payload: toBase64(payload),
              },
            ]);
            sent++;
          } catch {
            failed++;
          }
        }

        await nfcManager.cancelTechnologyRequest();
      } catch {
        // Session-level failure: all remaining are failures
        failed += dtus.length - sent - failed;
        try {
          await nfcManager.cancelTechnologyRequest();
        } catch {
          // Ignore cleanup errors
        }
      }

      return { sent, failed };
    },

    async startListening(onReceived: (dtu: DTU) => void): Promise<void> {
      if (!initialized) {
        throw new Error('NFC not initialized. Call initialize() first.');
      }
      if (listening) {
        return;
      }

      await nfcManager.registerTagEvent((tag: NFCTag) => {
        if (!tag.ndefMessage) return;

        for (const record of tag.ndefMessage) {
          // Check if this is a Concord DTU record
          if (record.type !== CONCORD_NDEF_TYPE) {
            // Non-Concord NDEF records ignored gracefully
            continue;
          }

          try {
            const payloadBytes = fromBase64(record.payload);
            const dtu = deserializeDTUFromNFC(payloadBytes);
            onReceived(dtu);
          } catch {
            // Corrupt or malformed record, skip gracefully
          }
        }
      });

      listening = true;
    },

    async stopListening(): Promise<void> {
      if (!listening) return;
      try {
        await nfcManager.unregisterTagEvent();
      } finally {
        listening = false;
      }
    },

    isListening(): boolean {
      return listening;
    },
  };
}
