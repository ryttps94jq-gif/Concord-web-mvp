// Tests for NFC Transfer
// Tests encoding/decoding round-trip, oversized DTU rejection, batch transfer,
// non-Concord record handling, and listening lifecycle

import {
  createNFCTransfer,
  serializeDTUForNFC,
  deserializeDTUFromNFC,
} from '../../mesh/nfc/nfc-transfer';
import type {
  NFCManagerModule,
  NFCTag,
} from '../../mesh/nfc/nfc-transfer';
import { NFC_MAX_PAYLOAD_BYTES, DTU_TYPES, DTU_VERSION } from '../../utils/constants';
import { toBase64 } from '../../utils/crypto';
import type { DTU, NDEFDTURecord } from '../../utils/types';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeDTU(id: string, contentSize: number = 100): DTU {
  const content = new Uint8Array(contentSize);
  for (let i = 0; i < contentSize; i++) content[i] = i % 256;

  return {
    id,
    header: {
      version: DTU_VERSION,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: 1700000000000,
      contentLength: contentSize,
      contentHash: new Uint8Array(32).fill(0xAB),
    },
    content,
    tags: ['test'],
    meta: {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: 7,
    },
  };
}

function makeOversizedDTU(): DTU {
  // Create a DTU that when serialized exceeds NFC_MAX_PAYLOAD_BYTES
  return makeDTU('oversized', NFC_MAX_PAYLOAD_BYTES);
}

function createMockNFCManager(options?: {
  supported?: boolean;
  failWrite?: boolean;
  failStart?: boolean;
}): NFCManagerModule {
  const opts = options ?? {};
  let tagCallback: ((tag: NFCTag) => void) | null = null;

  return {
    isSupported: jest.fn().mockResolvedValue(opts.supported !== false),
    start: jest.fn().mockImplementation(async () => {
      if (opts.failStart) throw new Error('NFC start failed');
    }),
    registerTagEvent: jest.fn().mockImplementation(async (cb: (tag: NFCTag) => void) => {
      tagCallback = cb;
    }),
    unregisterTagEvent: jest.fn().mockResolvedValue(undefined),
    writeNdefMessage: jest.fn().mockImplementation(async () => {
      if (opts.failWrite) throw new Error('Write failed');
    }),
    requestTechnology: jest.fn().mockResolvedValue(undefined),
    cancelTechnologyRequest: jest.fn().mockResolvedValue(undefined),

    // Test helper to simulate a tag scan
    _simulateTag(tag: NFCTag) {
      if (tagCallback) tagCallback(tag);
    },
  } as any;
}

// ── serializeDTUForNFC / deserializeDTUFromNFC ───────────────────────────────

describe('serializeDTUForNFC / deserializeDTUFromNFC', () => {
  it('round-trips a DTU through serialization', () => {
    const original = makeDTU('nfc_test_001', 50);
    const serialized = serializeDTUForNFC(original);
    const restored = deserializeDTUFromNFC(serialized);

    expect(restored.id).toBe(original.id);
    expect(restored.header.version).toBe(original.header.version);
    expect(restored.header.flags).toBe(original.header.flags);
    expect(restored.header.type).toBe(original.header.type);
    expect(restored.header.timestamp).toBe(original.header.timestamp);
    expect(restored.header.contentLength).toBe(original.header.contentLength);
    expect(restored.content).toEqual(original.content);
    expect(restored.tags).toEqual(original.tags);
  });

  it('preserves content hash through round-trip', () => {
    const original = makeDTU('hash_test');
    const serialized = serializeDTUForNFC(original);
    const restored = deserializeDTUFromNFC(serialized);

    expect(restored.header.contentHash).toEqual(original.header.contentHash);
  });

  it('includes magic bytes at the start', () => {
    const dtu = makeDTU('magic_test');
    const serialized = serializeDTUForNFC(dtu);

    expect(serialized[0]).toBe(0xC0);
    expect(serialized[1]).toBe(0x4D);
  });

  it('includes CRC32 integrity check', () => {
    const dtu = makeDTU('crc_test');
    const serialized = serializeDTUForNFC(dtu);

    // CRC is at bytes 2-5
    const view = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength);
    const storedCrc = view.getUint32(2, false);
    expect(storedCrc).toBeGreaterThan(0);
  });

  it('detects corruption via CRC mismatch', () => {
    const dtu = makeDTU('corrupt_test');
    const serialized = serializeDTUForNFC(dtu);

    // Corrupt a data byte
    serialized[10] ^= 0xFF;

    expect(() => deserializeDTUFromNFC(serialized)).toThrow('CRC32 mismatch');
  });

  it('rejects data with bad magic bytes', () => {
    const bad = new Uint8Array(100);
    bad[0] = 0x00;
    bad[1] = 0x00;

    expect(() => deserializeDTUFromNFC(bad)).toThrow('bad magic bytes');
  });

  it('rejects data that is too short', () => {
    const short = new Uint8Array(3);
    short[0] = 0xC0;
    short[1] = 0x4D;

    expect(() => deserializeDTUFromNFC(short)).toThrow();
  });

  it('handles DTU with signature', () => {
    const original = makeDTU('sig_test');
    original.signature = new Uint8Array([1, 2, 3, 4, 5]);
    const serialized = serializeDTUForNFC(original);
    const restored = deserializeDTUFromNFC(serialized);

    expect(restored.signature).toEqual(original.signature);
  });

  it('handles DTU without signature', () => {
    const original = makeDTU('no_sig');
    original.signature = undefined;
    const serialized = serializeDTUForNFC(original);
    const restored = deserializeDTUFromNFC(serialized);

    expect(restored.signature).toBeUndefined();
  });
});

// ── createNFCTransfer ────────────────────────────────────────────────────────

describe('createNFCTransfer', () => {
  // ── initialize ──

  describe('initialize', () => {
    it('returns true when NFC is supported', async () => {
      const nfc = createMockNFCManager({ supported: true });
      const transfer = createNFCTransfer(nfc);

      const result = await transfer.initialize();
      expect(result).toBe(true);
      expect(nfc.isSupported).toHaveBeenCalled();
      expect(nfc.start).toHaveBeenCalled();
    });

    it('returns false when NFC is not supported', async () => {
      const nfc = createMockNFCManager({ supported: false });
      const transfer = createNFCTransfer(nfc);

      const result = await transfer.initialize();
      expect(result).toBe(false);
    });

    it('returns false when start throws', async () => {
      const nfc = createMockNFCManager({ failStart: true });
      const transfer = createNFCTransfer(nfc);

      const result = await transfer.initialize();
      expect(result).toBe(false);
    });
  });

  // ── isSupported ──

  describe('isSupported', () => {
    it('returns false before initialization', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      expect(transfer.isSupported()).toBe(false);
    });

    it('returns true after successful initialization', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();
      expect(transfer.isSupported()).toBe(true);
    });
  });

  // ── encodeDTU ──

  describe('encodeDTU', () => {
    it('encodes a DTU into an NDEFDTURecord', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      const dtu = makeDTU('encode_test', 50);
      const record = transfer.encodeDTU(dtu);

      expect(record.type).toBe('concord/dtu');
      expect(record.id).toBe('encode_test');
      expect(record.content).toBeInstanceOf(Uint8Array);
      expect(record.header).toBeInstanceOf(Uint8Array);
    });

    it('throws for oversized DTU', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      const oversized = makeOversizedDTU();
      expect(() => transfer.encodeDTU(oversized)).toThrow(/too large for NFC/);
    });

    it('includes size limit in error message', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      const oversized = makeOversizedDTU();
      expect(() => transfer.encodeDTU(oversized)).toThrow(
        new RegExp(`${NFC_MAX_PAYLOAD_BYTES}`),
      );
    });
  });

  // ── decodeDTU ──

  describe('decodeDTU', () => {
    it('decodes an NDEFDTURecord back to a DTU', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      const original = makeDTU('decode_test', 50);
      const record = transfer.encodeDTU(original);
      const restored = transfer.decodeDTU(record);

      expect(restored.id).toBe(original.id);
      expect(restored.content).toEqual(original.content);
    });

    it('round-trips encode/decode', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      const original = makeDTU('roundtrip_test', 200);
      const record = transfer.encodeDTU(original);
      const restored = transfer.decodeDTU(record);

      expect(restored.id).toBe(original.id);
      expect(restored.header.version).toBe(original.header.version);
      expect(restored.header.type).toBe(original.header.type);
      expect(restored.header.timestamp).toBe(original.header.timestamp);
      expect(restored.tags).toEqual(original.tags);
    });

    it('throws for non-Concord record type', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      const record: NDEFDTURecord = {
        type: 'other/type' as any,
        id: 'test',
        header: new Uint8Array(0),
        content: new Uint8Array(0),
      };

      expect(() => transfer.decodeDTU(record)).toThrow('Not a Concord DTU record');
    });
  });

  // ── sendDTU ──

  describe('sendDTU', () => {
    it('throws when not initialized', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      const dtu = makeDTU('send_test');
      await expect(transfer.sendDTU(dtu)).rejects.toThrow('not initialized');
    });

    it('sends a DTU successfully', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const dtu = makeDTU('send_ok', 50);
      const result = await transfer.sendDTU(dtu);

      expect(result).toBe(true);
      expect(nfc.requestTechnology).toHaveBeenCalledWith('Ndef');
      expect(nfc.writeNdefMessage).toHaveBeenCalled();
      expect(nfc.cancelTechnologyRequest).toHaveBeenCalled();
    });

    it('returns false when write fails', async () => {
      const nfc = createMockNFCManager({ failWrite: true });
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const dtu = makeDTU('send_fail', 50);
      const result = await transfer.sendDTU(dtu);

      expect(result).toBe(false);
    });

    it('throws for oversized DTU', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const oversized = makeOversizedDTU();
      await expect(transfer.sendDTU(oversized)).rejects.toThrow(/too large for NFC/);
    });

    it('calls cancelTechnologyRequest even on failure', async () => {
      const nfc = createMockNFCManager({ failWrite: true });
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      await transfer.sendDTU(makeDTU('cleanup_test', 50));
      expect(nfc.cancelTechnologyRequest).toHaveBeenCalled();
    });
  });

  // ── sendBatch ──

  describe('sendBatch', () => {
    it('throws when not initialized', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      await expect(transfer.sendBatch([makeDTU('a')])).rejects.toThrow('not initialized');
    });

    it('sends multiple DTUs sequentially', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const dtus = [makeDTU('batch_1', 50), makeDTU('batch_2', 50), makeDTU('batch_3', 50)];
      const result = await transfer.sendBatch(dtus);

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(nfc.writeNdefMessage).toHaveBeenCalledTimes(3);
    });

    it('counts oversized DTUs as failures', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const dtus = [makeDTU('small', 50), makeOversizedDTU(), makeDTU('small2', 50)];
      const result = await transfer.sendBatch(dtus);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('handles empty batch', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const result = await transfer.sendBatch([]);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('uses single NFC session for the whole batch', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const dtus = [makeDTU('s1', 50), makeDTU('s2', 50)];
      await transfer.sendBatch(dtus);

      // requestTechnology should be called once (batch session)
      expect(nfc.requestTechnology).toHaveBeenCalledTimes(1);
      expect(nfc.cancelTechnologyRequest).toHaveBeenCalledTimes(1);
    });

    it('handles write failure for individual DTUs in batch', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      let callCount = 0;
      (nfc.writeNdefMessage as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 2) throw new Error('Write failed');
      });

      const dtus = [makeDTU('b1', 50), makeDTU('b2', 50), makeDTU('b3', 50)];
      const result = await transfer.sendBatch(dtus);

      expect(result.sent).toBe(2); // First and third succeed
      expect(result.failed).toBe(1); // Second fails
    });
  });

  // ── startListening / stopListening ──

  describe('startListening', () => {
    it('throws when not initialized', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      await expect(transfer.startListening(() => {})).rejects.toThrow('not initialized');
    });

    it('sets listening state to true', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      expect(transfer.isListening()).toBe(false);
      await transfer.startListening(() => {});
      expect(transfer.isListening()).toBe(true);
    });

    it('receives DTU from scanned tag', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const receivedDTUs: DTU[] = [];
      await transfer.startListening((dtu) => receivedDTUs.push(dtu));

      // Simulate a tag with a Concord DTU record
      const testDTU = makeDTU('scanned_dtu', 50);
      const payload = serializeDTUForNFC(testDTU);

      (nfc as any)._simulateTag({
        ndefMessage: [
          {
            tnf: 0x04,
            type: 'concord/dtu',
            id: testDTU.id,
            payload: toBase64(payload),
          },
        ],
      });

      expect(receivedDTUs.length).toBe(1);
      expect(receivedDTUs[0].id).toBe('scanned_dtu');
    });

    it('ignores non-Concord NDEF records gracefully', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const receivedDTUs: DTU[] = [];
      await transfer.startListening((dtu) => receivedDTUs.push(dtu));

      (nfc as any)._simulateTag({
        ndefMessage: [
          {
            tnf: 0x01,
            type: 'text/plain',
            id: 'non-concord',
            payload: toBase64(new TextEncoder().encode('Hello')),
          },
        ],
      });

      expect(receivedDTUs.length).toBe(0);
    });

    it('ignores tags without NDEF messages', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const receivedDTUs: DTU[] = [];
      await transfer.startListening((dtu) => receivedDTUs.push(dtu));

      (nfc as any)._simulateTag({});
      expect(receivedDTUs.length).toBe(0);
    });

    it('handles corrupt NDEF payload gracefully', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      const receivedDTUs: DTU[] = [];
      await transfer.startListening((dtu) => receivedDTUs.push(dtu));

      (nfc as any)._simulateTag({
        ndefMessage: [
          {
            tnf: 0x04,
            type: 'concord/dtu',
            id: 'corrupt',
            payload: toBase64(new Uint8Array([0xC0, 0x4D, 0, 0, 0, 0, 0xFF, 0xFF])),
          },
        ],
      });

      // Should not crash, just skip the record
      expect(receivedDTUs.length).toBe(0);
    });

    it('does not re-register when already listening', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      await transfer.startListening(() => {});
      await transfer.startListening(() => {}); // Should be a no-op

      expect(nfc.registerTagEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopListening', () => {
    it('sets listening state to false', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      await transfer.startListening(() => {});
      expect(transfer.isListening()).toBe(true);

      await transfer.stopListening();
      expect(transfer.isListening()).toBe(false);
    });

    it('is safe to call when not listening', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);

      await expect(transfer.stopListening()).resolves.not.toThrow();
    });

    it('unregisters the tag event', async () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      await transfer.initialize();

      await transfer.startListening(() => {});
      await transfer.stopListening();

      expect(nfc.unregisterTagEvent).toHaveBeenCalled();
    });
  });

  // ── isListening ──

  describe('isListening', () => {
    it('returns false initially', () => {
      const nfc = createMockNFCManager();
      const transfer = createNFCTransfer(nfc);
      expect(transfer.isListening()).toBe(false);
    });
  });
});
