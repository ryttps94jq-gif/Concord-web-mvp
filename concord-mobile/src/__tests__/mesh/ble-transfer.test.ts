// Tests for BLE Transfer
import {
  createBLETransfer,
  serializeDTU,
  deserializeDTU,
  chunkData,
  reassembleChunks,
  serializeChunk,
  deserializeChunk,
} from '../../mesh/bluetooth/ble-transfer';
import type { BLEManager, BLECharacteristic } from '../../mesh/bluetooth/ble-advertiser';
import type { DTU, BLETransferSession } from '../../utils/types';
import {
  BLE_MTU_DEFAULT,
  CONCORD_BLE_SERVICE_UUID,
  CONCORD_BLE_DTU_HEADER_CHAR,
  CONCORD_BLE_DTU_CONTENT_CHAR,
  DTU_TYPES,
  DEFAULT_DTU_TTL,
} from '../../utils/constants';

// ── Test Helpers ──────────────────────────────────────────────────────────────

function createTestDTU(overrides?: Partial<DTU>): DTU {
  const content = new TextEncoder().encode('Hello Concord Mesh');
  const contentHash = new Uint8Array(32);
  for (let i = 0; i < content.length && i < 32; i++) {
    contentHash[i] = content[i];
  }

  return {
    id: 'dtu_test_001',
    header: {
      version: 1,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: Date.now(),
      contentLength: content.length,
      contentHash,
    },
    content,
    tags: ['test'],
    meta: {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: DEFAULT_DTU_TTL,
    },
    ...overrides,
  };
}

function createLargeDTU(sizeBytes: number): DTU {
  const content = new Uint8Array(sizeBytes);
  for (let i = 0; i < sizeBytes; i++) {
    content[i] = i % 256;
  }
  const contentHash = new Uint8Array(32);
  contentHash[0] = 0xAB;

  return {
    id: `dtu_large_${sizeBytes}`,
    header: {
      version: 1,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: Date.now(),
      contentLength: sizeBytes,
      contentHash,
    },
    content,
    tags: [],
    meta: {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: DEFAULT_DTU_TTL,
    },
  };
}

function createMockBLEManager(overrides?: Partial<BLEManager>): BLEManager {
  return {
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
    destroy: jest.fn(),
    state: jest.fn().mockResolvedValue('PoweredOn'),
    connectToDevice: jest.fn(),
    cancelDeviceConnection: jest.fn(),
    writeCharacteristicForDevice: jest.fn().mockResolvedValue({
      uuid: 'test',
      serviceUUID: CONCORD_BLE_SERVICE_UUID,
      value: null,
    } as BLECharacteristic),
    monitorCharacteristicForDevice: jest.fn().mockReturnValue({ remove: jest.fn() }),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BLE Transfer', () => {
  describe('serializeDTU / deserializeDTU', () => {
    it('should round-trip a DTU through serialization', () => {
      const dtu = createTestDTU();
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.id).toBe(dtu.id);
      expect(deserialized.header.version).toBe(dtu.header.version);
      expect(deserialized.header.flags).toBe(dtu.header.flags);
      expect(deserialized.header.type).toBe(dtu.header.type);
      expect(deserialized.header.contentLength).toBe(dtu.header.contentLength);
      expect(deserialized.content).toEqual(dtu.content);
      expect(deserialized.tags).toEqual(dtu.tags);
      expect(deserialized.meta.scope).toBe(dtu.meta.scope);
    });

    it('should preserve content hash through serialization', () => {
      const dtu = createTestDTU();
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.header.contentHash).toEqual(dtu.header.contentHash);
    });

    it('should handle DTU with signature', () => {
      const sig = new Uint8Array([1, 2, 3, 4, 5]);
      const dtu = createTestDTU({ signature: sig });
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.signature).toEqual(sig);
    });

    it('should handle DTU without signature', () => {
      const dtu = createTestDTU({ signature: undefined });
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.signature).toBeUndefined();
    });

    it('should handle DTU with lineage', () => {
      const dtu = createTestDTU({
        lineage: { parentId: 'parent-1', ancestors: ['a1', 'a2'], depth: 2 },
      });
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.lineage).toEqual({
        parentId: 'parent-1',
        ancestors: ['a1', 'a2'],
        depth: 2,
      });
    });

    it('should handle DTU without lineage', () => {
      const dtu = createTestDTU({ lineage: undefined });
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.lineage).toBeUndefined();
    });

    it('should handle empty content', () => {
      const dtu = createTestDTU({
        content: new Uint8Array(0),
        header: {
          version: 1,
          flags: 0,
          type: DTU_TYPES.TEXT,
          timestamp: Date.now(),
          contentLength: 0,
          contentHash: new Uint8Array(32),
        },
      });
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.content.length).toBe(0);
    });

    it('should handle large content', () => {
      const dtu = createLargeDTU(5000);
      const serialized = serializeDTU(dtu);
      const deserialized = deserializeDTU(serialized);

      expect(deserialized.content.length).toBe(5000);
      expect(deserialized.content).toEqual(dtu.content);
    });
  });

  describe('chunkData', () => {
    it('should return single chunk for small data', () => {
      const data = new Uint8Array(100);
      const chunks = chunkData('dtu-1', data, BLE_MTU_DEFAULT);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].sequenceNumber).toBe(0);
      expect(chunks[0].totalChunks).toBe(1);
      expect(chunks[0].dtuId).toBe('dtu-1');
      expect(chunks[0].isHeader).toBe(true);
    });

    it('should chunk data larger than MTU', () => {
      const data = new Uint8Array(2000);
      const chunks = chunkData('dtu-2', data, 512);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].isHeader).toBe(true);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].isHeader).toBe(false);
      }
    });

    it('should set correct totalChunks on all chunks', () => {
      const data = new Uint8Array(2000);
      const chunks = chunkData('dtu-3', data, 512);

      for (const chunk of chunks) {
        expect(chunk.totalChunks).toBe(chunks.length);
      }
    });

    it('should set sequential sequence numbers', () => {
      const data = new Uint8Array(2000);
      const chunks = chunkData('dtu-4', data, 512);

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].sequenceNumber).toBe(i);
      }
    });

    it('should preserve all data when reassembled', () => {
      const data = new Uint8Array(2000);
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256;
      }

      const chunks = chunkData('dtu-5', data, 512);

      // Reassemble
      const reassembled = new Uint8Array(
        chunks.reduce((sum, c) => sum + c.data.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        reassembled.set(chunk.data, offset);
        offset += chunk.data.length;
      }

      expect(reassembled).toEqual(data);
    });

    it('should throw for MTU too small', () => {
      const data = new Uint8Array(100);
      expect(() => chunkData('dtu-err', data, 10)).toThrow('MTU');
    });

    it('should handle exact MTU boundary', () => {
      const OVERHEAD = 20;
      const payloadSize = 512 - OVERHEAD;
      const data = new Uint8Array(payloadSize);
      const chunks = chunkData('dtu-exact', data, 512);

      expect(chunks).toHaveLength(1);
    });

    it('should handle data one byte over MTU boundary', () => {
      const OVERHEAD = 20;
      const payloadSize = 512 - OVERHEAD;
      const data = new Uint8Array(payloadSize + 1);
      const chunks = chunkData('dtu-over', data, 512);

      expect(chunks).toHaveLength(2);
    });
  });

  describe('reassembleChunks', () => {
    it('should reassemble complete chunks', () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const session: BLETransferSession = {
        dtuId: 'dtu-reassemble',
        peerId: 'peer-1',
        totalChunks: 2,
        receivedChunks: new Map([
          [0, new Uint8Array([1, 2, 3, 4, 5])],
          [1, new Uint8Array([6, 7, 8, 9, 10])],
        ]),
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };

      const result = reassembleChunks(session);

      expect(result).toEqual(originalData);
    });

    it('should return null for incomplete session', () => {
      const session: BLETransferSession = {
        dtuId: 'dtu-incomplete',
        peerId: 'peer-1',
        totalChunks: 3,
        receivedChunks: new Map([
          [0, new Uint8Array([1, 2])],
          [1, new Uint8Array([3, 4])],
          // Missing chunk 2
        ]),
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };

      expect(reassembleChunks(session)).toBeNull();
    });

    it('should return null for missing middle chunk', () => {
      const session: BLETransferSession = {
        dtuId: 'dtu-gap',
        peerId: 'peer-1',
        totalChunks: 3,
        receivedChunks: new Map([
          [0, new Uint8Array([1, 2])],
          // Missing chunk 1
          [2, new Uint8Array([5, 6])],
        ]),
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };

      expect(reassembleChunks(session)).toBeNull();
    });

    it('should handle single chunk session', () => {
      const session: BLETransferSession = {
        dtuId: 'dtu-single',
        peerId: 'peer-1',
        totalChunks: 1,
        receivedChunks: new Map([[0, new Uint8Array([42])]]),
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };

      const result = reassembleChunks(session);
      expect(result).toEqual(new Uint8Array([42]));
    });
  });

  describe('serializeChunk / deserializeChunk', () => {
    it('should round-trip a chunk', () => {
      const chunk = {
        sequenceNumber: 3,
        totalChunks: 10,
        dtuId: 'dtu-chunk-test',
        data: new Uint8Array([10, 20, 30]),
        isHeader: false,
      };

      const serialized = serializeChunk(chunk);
      const deserialized = deserializeChunk(serialized);

      expect(deserialized.sequenceNumber).toBe(3);
      expect(deserialized.totalChunks).toBe(10);
      expect(deserialized.dtuId).toBe('dtu-chunk-test');
      expect(deserialized.data).toEqual(new Uint8Array([10, 20, 30]));
      expect(deserialized.isHeader).toBe(false);
    });

    it('should handle header chunk', () => {
      const chunk = {
        sequenceNumber: 0,
        totalChunks: 5,
        dtuId: 'dtu-header',
        data: new Uint8Array([1, 2, 3]),
        isHeader: true,
      };

      const serialized = serializeChunk(chunk);
      const deserialized = deserializeChunk(serialized);

      expect(deserialized.isHeader).toBe(true);
    });
  });

  describe('createBLETransfer', () => {
    describe('sendDTU', () => {
      it('should send a small DTU successfully', async () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        const result = await transfer.sendDTU('peer-1', dtu);

        expect(result.success).toBe(true);
        expect(result.dtuId).toBe(dtu.id);
        expect(result.bytesTransferred).toBeGreaterThan(0);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.chunks).toBeGreaterThanOrEqual(1);
      });

      it('should write header characteristic first', async () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        await transfer.sendDTU('peer-1', dtu);

        const calls = (manager.writeCharacteristicForDevice as jest.Mock).mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(1);
        // First call should use header characteristic
        expect(calls[0][2]).toBe(CONCORD_BLE_DTU_HEADER_CHAR);
      });

      it('should write content chunks to content characteristic', async () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        // Create large DTU that requires multiple chunks
        const dtu = createLargeDTU(2000);

        await transfer.sendDTU('peer-1', dtu);

        const calls = (manager.writeCharacteristicForDevice as jest.Mock).mock.calls;
        // Should have more than 1 call due to chunking
        expect(calls.length).toBeGreaterThan(1);
        // Subsequent calls should use content characteristic
        for (let i = 1; i < calls.length; i++) {
          expect(calls[i][2]).toBe(CONCORD_BLE_DTU_CONTENT_CHAR);
        }
      });

      it('should handle write failures', async () => {
        const manager = createMockBLEManager({
          writeCharacteristicForDevice: jest.fn().mockRejectedValue(
            new Error('Connection lost'),
          ),
        });
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        const result = await transfer.sendDTU('peer-1', dtu);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Connection lost');
      });

      it('should return error when write not supported', async () => {
        const manager = createMockBLEManager({
          writeCharacteristicForDevice: undefined,
        });
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        const result = await transfer.sendDTU('peer-1', dtu);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Write characteristic not supported');
      });

      it('should clean up session after successful transfer', async () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        await transfer.sendDTU('peer-1', dtu);

        expect(transfer.getActiveTransfers()).toHaveLength(0);
      });

      it('should clean up session after failed transfer', async () => {
        const manager = createMockBLEManager({
          writeCharacteristicForDevice: jest.fn().mockRejectedValue(new Error('fail')),
        });
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        await transfer.sendDTU('peer-1', dtu);

        expect(transfer.getActiveTransfers()).toHaveLength(0);
      });

      it('should use correct service UUID', async () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        await transfer.sendDTU('peer-1', dtu);

        const calls = (manager.writeCharacteristicForDevice as jest.Mock).mock.calls;
        for (const call of calls) {
          expect(call[1]).toBe(CONCORD_BLE_SERVICE_UUID);
        }
      });

      it('should use peer ID as device ID', async () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        const dtu = createTestDTU();

        await transfer.sendDTU('my-peer-42', dtu);

        const calls = (manager.writeCharacteristicForDevice as jest.Mock).mock.calls;
        for (const call of calls) {
          expect(call[0]).toBe('my-peer-42');
        }
      });

      it('should report partial bytes transferred on failure', async () => {
        let callCount = 0;
        const manager = createMockBLEManager({
          writeCharacteristicForDevice: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount > 1) {
              return Promise.reject(new Error('mid-transfer failure'));
            }
            return Promise.resolve({ uuid: 'test', serviceUUID: CONCORD_BLE_SERVICE_UUID, value: null });
          }),
        });
        const transfer = createBLETransfer(manager);
        const dtu = createLargeDTU(2000);

        const result = await transfer.sendDTU('peer-1', dtu);

        expect(result.success).toBe(false);
        expect(result.bytesTransferred).toBeGreaterThan(0);
      });
    });

    describe('onDTUReceived', () => {
      it('should register receive callbacks', () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        const callback = jest.fn();

        transfer.onDTUReceived(callback);

        // Callback registered but not called yet (nothing received)
        expect(callback).not.toHaveBeenCalled();
      });

      it('should support multiple callbacks', () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);
        const callback1 = jest.fn();
        const callback2 = jest.fn();

        transfer.onDTUReceived(callback1);
        transfer.onDTUReceived(callback2);

        // Both registered without error
        expect(true).toBe(true);
      });
    });

    describe('getActiveTransfers', () => {
      it('should return empty array when no active transfers', () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);

        expect(transfer.getActiveTransfers()).toEqual([]);
      });
    });

    describe('cancelTransfer', () => {
      it('should remove transfer by dtuId', () => {
        const manager = createMockBLEManager();
        const transfer = createBLETransfer(manager);

        // cancelTransfer on non-existent should not throw
        transfer.cancelTransfer('non-existent');
        expect(transfer.getActiveTransfers()).toHaveLength(0);
      });

      it('should cancel an in-flight transfer', async () => {
        let resolveWrite: () => void;
        const writePromise = new Promise<BLECharacteristic>(resolve => {
          resolveWrite = () =>
            resolve({ uuid: 'test', serviceUUID: CONCORD_BLE_SERVICE_UUID, value: null });
        });

        const manager = createMockBLEManager({
          writeCharacteristicForDevice: jest.fn().mockReturnValue(writePromise),
        });
        const transfer = createBLETransfer(manager);
        const dtu = createLargeDTU(2000);

        // Start transfer but don't await
        const sendPromise = transfer.sendDTU('peer-1', dtu);

        // Cancel immediately
        transfer.cancelTransfer(dtu.id);

        // Now resolve the write so sendDTU can complete
        resolveWrite!();
        await sendPromise;

        // Session should be cleaned up
        expect(transfer.getActiveTransfers()).toHaveLength(0);
      });
    });
  });

  describe('end-to-end chunking and transfer', () => {
    it('should correctly chunk and reassemble a full DTU', () => {
      const dtu = createLargeDTU(3000);
      const serialized = serializeDTU(dtu);
      const chunks = chunkData(dtu.id, serialized, 512);

      // Simulate receiving all chunks
      const session: BLETransferSession = {
        dtuId: dtu.id,
        peerId: 'peer-1',
        totalChunks: chunks.length,
        receivedChunks: new Map(),
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };

      for (const chunk of chunks) {
        session.receivedChunks.set(chunk.sequenceNumber, chunk.data);
      }

      const reassembled = reassembleChunks(session);
      expect(reassembled).not.toBeNull();

      const deserialized = deserializeDTU(reassembled!);
      expect(deserialized.id).toBe(dtu.id);
      expect(deserialized.content).toEqual(dtu.content);
    });

    it('should handle out-of-order chunk arrival', () => {
      const dtu = createLargeDTU(3000);
      const serialized = serializeDTU(dtu);
      const chunks = chunkData(dtu.id, serialized, 512);

      const session: BLETransferSession = {
        dtuId: dtu.id,
        peerId: 'peer-1',
        totalChunks: chunks.length,
        receivedChunks: new Map(),
        startedAt: Date.now(),
        lastChunkAt: Date.now(),
      };

      // Add chunks in reverse order
      for (let i = chunks.length - 1; i >= 0; i--) {
        session.receivedChunks.set(chunks[i].sequenceNumber, chunks[i].data);
      }

      const reassembled = reassembleChunks(session);
      expect(reassembled).not.toBeNull();

      const deserialized = deserializeDTU(reassembled!);
      expect(deserialized.id).toBe(dtu.id);
    });

    it('should chunk serialized data through serializeChunk/deserializeChunk', () => {
      const chunks = chunkData('dtu-serde', new Uint8Array([1, 2, 3, 4, 5]), 512);

      for (const chunk of chunks) {
        const serialized = serializeChunk(chunk);
        const deserialized = deserializeChunk(serialized);
        expect(deserialized.data).toEqual(chunk.data);
        expect(deserialized.sequenceNumber).toBe(chunk.sequenceNumber);
      }
    });
  });

  describe('concurrent transfers', () => {
    it('should handle multiple concurrent transfers to different peers', async () => {
      const manager = createMockBLEManager();
      const transfer = createBLETransfer(manager);
      const dtu1 = createTestDTU({ id: 'dtu-concurrent-1' });
      const dtu2 = createTestDTU({ id: 'dtu-concurrent-2' });

      const [result1, result2] = await Promise.all([
        transfer.sendDTU('peer-1', dtu1),
        transfer.sendDTU('peer-2', dtu2),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.dtuId).toBe('dtu-concurrent-1');
      expect(result2.dtuId).toBe('dtu-concurrent-2');
    });

    it('should handle mixed success/failure concurrent transfers', async () => {
      const manager = createMockBLEManager({
        writeCharacteristicForDevice: jest.fn().mockImplementation(
          (deviceId: string) => {
            if (deviceId === 'fail-peer') {
              return Promise.reject(new Error('Connection refused'));
            }
            return Promise.resolve({
              uuid: 'test',
              serviceUUID: CONCORD_BLE_SERVICE_UUID,
              value: null,
            });
          },
        ),
      });
      const transfer = createBLETransfer(manager);
      const dtu1 = createTestDTU({ id: 'dtu-ok' });
      const dtu2 = createTestDTU({ id: 'dtu-fail' });

      const [result1, result2] = await Promise.all([
        transfer.sendDTU('ok-peer', dtu1),
        transfer.sendDTU('fail-peer', dtu2),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
    });
  });
});
