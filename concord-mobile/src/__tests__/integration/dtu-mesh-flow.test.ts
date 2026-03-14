// Integration test: DTU creation -> mesh transfer -> store flow
// Verifies that a DTU forged with dtu-forge can be serialized for BLE transfer,
// chunked, reassembled, deserialized, and stored in the DTU store.

import { createDTU, CreateDTUOptions } from '../../dtu/creation/dtu-forge';
import { createDTUStore, SQLiteDatabase } from '../../dtu/store/dtu-store';
import {
  serializeDTU,
  deserializeDTU,
  chunkData,
  reassembleChunks,
} from '../../mesh/bluetooth/ble-transfer';
import { useMeshStore } from '../../store/mesh-store';
import { setCryptoProvider } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import { DTU_TYPES, TRANSPORT_LAYERS } from '../../utils/constants';
import type { BLETransferSession } from '../../utils/types';

// ── Mock crypto provider ────────────────────────────────────────────────────

const mockCryptoProvider: CryptoProvider = {
  sha256: jest.fn(async (data: Uint8Array) => {
    const xor = data.reduce((a, b) => a ^ b, 0);
    return new Uint8Array(32).fill(xor);
  }),
  hmacSha256: jest.fn(async () => new Uint8Array(32).fill(0xaa)),
  crc32: jest.fn(() => 0x12345678),
  randomBytes: jest.fn((size) => new Uint8Array(size).fill(0x42)),
  ed25519GenerateKeypair: jest.fn(async () => ({
    publicKey: new Uint8Array(32).fill(0x01),
    privateKey: new Uint8Array(64).fill(0x02),
  })),
  ed25519Sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
  ed25519Verify: jest.fn(async () => true),
};

// ── Mock SQLite database ────────────────────────────────────────────────────

function createMockDb(): SQLiteDatabase {
  const rows: any[] = [];
  return {
    executeSql: jest.fn(async (_sql: string, _params?: any[]) => ({
      rows: { length: rows.length, item: (i: number) => rows[i] },
    })),
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  setCryptoProvider(mockCryptoProvider);
});

beforeEach(() => {
  jest.clearAllMocks();
  useMeshStore.getState().reset();
});

function makeOpts(overrides: Partial<CreateDTUOptions> = {}): CreateDTUOptions {
  return {
    type: DTU_TYPES.TEXT,
    content: new TextEncoder().encode('Hello, Concord mesh network!'),
    tags: ['test', 'integration'],
    scope: 'local',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DTU -> Mesh Transfer -> Store flow', () => {
  it('forges a DTU, serializes, chunks, reassembles, and deserializes it intact', async () => {
    // Step 1: Create a DTU using the forge
    const originalDTU = await createDTU(makeOpts());
    expect(originalDTU.id).toMatch(/^dtu_/);

    // Step 2: Serialize the DTU for BLE transfer
    const serialized = serializeDTU(originalDTU);
    expect(serialized.length).toBeGreaterThan(0);

    // Step 3: Chunk the serialized data (simulating BLE MTU constraints)
    const chunks = chunkData(originalDTU.id, serialized, 128);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].isHeader).toBe(true);

    // Step 4: Simulate receiving all chunks and reassembling
    const session: BLETransferSession = {
      dtuId: originalDTU.id,
      peerId: 'peer_remote_1',
      totalChunks: chunks.length,
      receivedChunks: new Map(),
      startedAt: Date.now(),
      lastChunkAt: Date.now(),
    };
    for (const chunk of chunks) {
      session.receivedChunks.set(chunk.sequenceNumber, chunk.data);
    }

    const assembled = reassembleChunks(session);
    expect(assembled).not.toBeNull();

    // Step 5: Deserialize back to a DTU
    const receivedDTU = deserializeDTU(assembled!);
    expect(receivedDTU.id).toBe(originalDTU.id);
    expect(receivedDTU.header.type).toBe(DTU_TYPES.TEXT);
    expect(receivedDTU.tags).toEqual(['test', 'integration']);
    expect(receivedDTU.header.contentLength).toBe(originalDTU.header.contentLength);
  });

  it('stores a mesh-received DTU in the DTU store', async () => {
    const dtu = await createDTU(makeOpts({ tags: ['mesh', 'received'] }));
    const db = createMockDb();
    const store = createDTUStore(db);

    // Wait for schema initialization
    await new Promise(resolve => setTimeout(resolve, 10));

    // Store the received DTU
    store.set(dtu.id, dtu);
    expect(store.has(dtu.id)).toBe(true);

    const retrieved = store.get(dtu.id);
    expect(retrieved?.id).toBe(dtu.id);
    expect(retrieved?.tags).toEqual(['mesh', 'received']);
  });

  it('updates mesh store peer reputation after valid DTU receipt', async () => {
    const peer = {
      id: 'peer_sender',
      publicKey: 'pk_sender',
      transport: TRANSPORT_LAYERS.BLUETOOTH,
      rssi: -55,
      lastSeen: Date.now(),
      capabilities: {
        bluetooth: true, wifiDirect: false, nfc: false, lora: false, internet: false,
      },
      reputation: { validDTUs: 0, invalidDTUs: 0, totalRelays: 0, score: 0.5 },
      authenticated: true,
    };

    useMeshStore.getState().addPeer(peer);
    useMeshStore.getState().updatePeerReputation('peer_sender', true);

    const updated = useMeshStore.getState().peers.get('peer_sender');
    expect(updated?.reputation.validDTUs).toBe(1);
    expect(updated?.reputation.score).toBe(1);
  });

  it('tracks received DTU hash for relay deduplication via mesh store', async () => {
    const dtu = await createDTU(makeOpts());
    const dtuHash = Array.from(dtu.header.contentHash)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    useMeshStore.getState().addSeenHash(dtuHash);
    expect(useMeshStore.getState().hasSeenHash(dtuHash)).toBe(true);
    expect(useMeshStore.getState().hasSeenHash('unknown_hash')).toBe(false);
  });

  it('enqueues DTU for relay with correct priority in mesh store', async () => {
    const dtu = await createDTU(makeOpts({ priority: true }));
    const dtuHash = Array.from(dtu.header.contentHash)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    useMeshStore.getState().enqueueRelay({
      dtuId: dtu.id,
      dtuHash,
      priority: 10,
      ttl: dtu.meta.ttl,
      enqueuedAt: Date.now(),
      excludePeers: ['peer_sender'],
    });

    expect(useMeshStore.getState().relayQueue.length).toBe(1);
    expect(useMeshStore.getState().relayQueue[0].dtuId).toBe(dtu.id);
    expect(useMeshStore.getState().relayQueue[0].excludePeers).toContain('peer_sender');
  });

  it('handles roundtrip of DTU with signature through serialization', async () => {
    const dtu = await createDTU(makeOpts({ signed: true }));
    // Simulate an attached signature
    const signedDTU = { ...dtu, signature: new Uint8Array(64).fill(0xab) };

    const serialized = serializeDTU(signedDTU);
    const chunks = chunkData(signedDTU.id, serialized);

    const session: BLETransferSession = {
      dtuId: signedDTU.id,
      peerId: 'peer_2',
      totalChunks: chunks.length,
      receivedChunks: new Map(),
      startedAt: Date.now(),
      lastChunkAt: Date.now(),
    };
    for (const chunk of chunks) {
      session.receivedChunks.set(chunk.sequenceNumber, chunk.data);
    }

    const assembled = reassembleChunks(session);
    const restored = deserializeDTU(assembled!);

    expect(restored.signature).toBeDefined();
    expect(restored.signature!.length).toBe(64);
  });
});
