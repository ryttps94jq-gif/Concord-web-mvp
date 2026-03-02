// Tests for Lattice Sync
// Tests Merkle root computation, diff calculation, and sync protocol

import {
  createLatticeSync,
  buildMerkleRoot,
  serializeSyncMessage,
  deserializeSyncMessage,
  serializeDTUForSync,
  deserializeDTUFromSync,
} from '../../mesh/wifi-direct/lattice-sync';
import type { DTUStore, LatticeSyncResult } from '../../mesh/wifi-direct/lattice-sync';
import type { WiFiDirectManager } from '../../mesh/wifi-direct/wifi-direct-manager';
import type { DTU, LatticeSyncState } from '../../utils/types';
import { DTU_TYPES, DTU_VERSION } from '../../utils/constants';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeDTU(id: string, content: string = 'test'): DTU {
  const contentBytes = new TextEncoder().encode(content);
  return {
    id,
    header: {
      version: DTU_VERSION,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: Date.now(),
      contentLength: contentBytes.length,
      contentHash: new Uint8Array(32).fill(0xAB),
    },
    content: contentBytes,
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

function createMockStore(dtus: DTU[]): DTUStore {
  const store = new Map<string, DTU>();
  for (const dtu of dtus) {
    store.set(dtu.id, dtu);
  }

  return {
    getAllIds: jest.fn().mockImplementation(async () => Array.from(store.keys())),
    getDTU: jest.fn().mockImplementation(async (id: string) => store.get(id) ?? null),
    putDTU: jest.fn().mockImplementation(async (dtu: DTU) => {
      store.set(dtu.id, dtu);
    }),
    getCount: jest.fn().mockImplementation(async () => store.size),
  };
}

function createMockPeer(options?: {
  remoteIds?: string[];
  remoteDTUs?: DTU[];
}): WiFiDirectManager {
  const sentData: Uint8Array[] = [];
  const dataCallbacks: Array<(data: Uint8Array, sender: string) => void> = [];
  const opts = options ?? {};

  return {
    discoverPeers: jest.fn().mockResolvedValue([]),
    connect: jest.fn().mockResolvedValue({
      isOwner: false,
      ownerAddress: '192.168.49.1',
      members: [],
      ssid: 'test',
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    getGroup: jest.fn().mockReturnValue(null),
    sendData: jest.fn().mockImplementation(async (data: Uint8Array) => {
      sentData.push(data);

      // Simulate peer response when we send our ID list
      const msg = deserializeSyncMessage(data);
      if (msg && msg.type === 'id-list') {
        // Respond with remote ID list
        const remoteIds = opts.remoteIds ?? [];
        const response = serializeSyncMessage('id-list', JSON.stringify(remoteIds));
        setTimeout(() => {
          for (const cb of dataCallbacks) {
            cb(response, '192.168.49.1');
          }
        }, 10);
      }

      // Simulate sending DTU data when requested
      if (msg && msg.type === 'sync-complete') {
        // No additional response needed
      }

      return data.length;
    }),
    onDataReceived: jest.fn().mockImplementation((cb: (data: Uint8Array, sender: string) => void) => {
      dataCallbacks.push(cb);
    }),
    getConnectionInfo: jest.fn().mockReturnValue({ isOwner: false, ownerAddress: '192.168.49.1' }),
  };
}

// ── buildMerkleRoot ──────────────────────────────────────────────────────────

describe('buildMerkleRoot', () => {
  it('returns zero hash for empty list', () => {
    expect(buildMerkleRoot([])).toBe('00000000');
  });

  it('returns a deterministic hash for single ID', () => {
    const root = buildMerkleRoot(['dtu_001']);
    expect(typeof root).toBe('string');
    expect(root.length).toBe(8); // 4 bytes as hex
    // Same input, same output
    expect(buildMerkleRoot(['dtu_001'])).toBe(root);
  });

  it('returns different roots for different ID sets', () => {
    const root1 = buildMerkleRoot(['dtu_001', 'dtu_002']);
    const root2 = buildMerkleRoot(['dtu_001', 'dtu_003']);
    expect(root1).not.toBe(root2);
  });

  it('returns same root regardless of input order (sorted internally)', () => {
    const root1 = buildMerkleRoot(['dtu_002', 'dtu_001', 'dtu_003']);
    const root2 = buildMerkleRoot(['dtu_001', 'dtu_002', 'dtu_003']);
    expect(root1).toBe(root2);
  });

  it('handles odd number of IDs', () => {
    const root = buildMerkleRoot(['a', 'b', 'c']);
    expect(typeof root).toBe('string');
    expect(root.length).toBe(8);
  });

  it('handles power-of-two number of IDs', () => {
    const root = buildMerkleRoot(['a', 'b', 'c', 'd']);
    expect(typeof root).toBe('string');
    expect(root.length).toBe(8);
  });

  it('handles large number of IDs', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `dtu_${i.toString().padStart(6, '0')}`);
    const root = buildMerkleRoot(ids);
    expect(typeof root).toBe('string');
    expect(root.length).toBe(8);
    // Deterministic
    expect(buildMerkleRoot(ids)).toBe(root);
  });

  it('adding an ID changes the root', () => {
    const root1 = buildMerkleRoot(['a', 'b']);
    const root2 = buildMerkleRoot(['a', 'b', 'c']);
    expect(root1).not.toBe(root2);
  });

  it('removing an ID changes the root', () => {
    const root1 = buildMerkleRoot(['a', 'b', 'c']);
    const root2 = buildMerkleRoot(['a', 'b']);
    expect(root1).not.toBe(root2);
  });
});

// ── serializeSyncMessage / deserializeSyncMessage ────────────────────────────

describe('serializeSyncMessage / deserializeSyncMessage', () => {
  it('round-trips a merkle-root message', () => {
    const msg = serializeSyncMessage('merkle-root', 'abcdef01');
    const parsed = deserializeSyncMessage(msg);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('merkle-root');
    expect(parsed!.payload).toBe('abcdef01');
  });

  it('round-trips an id-list message', () => {
    const ids = JSON.stringify(['dtu_001', 'dtu_002']);
    const msg = serializeSyncMessage('id-list', ids);
    const parsed = deserializeSyncMessage(msg);
    expect(parsed).not.toBeNull();
    expect(JSON.parse(parsed!.payload)).toEqual(['dtu_001', 'dtu_002']);
  });

  it('round-trips a sync-complete message', () => {
    const msg = serializeSyncMessage('sync-complete', '');
    const parsed = deserializeSyncMessage(msg);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('sync-complete');
  });

  it('returns null for invalid data', () => {
    expect(deserializeSyncMessage(new Uint8Array([0, 1, 2]))).toBeNull();
  });

  it('returns null for valid JSON without required fields', () => {
    const data = new TextEncoder().encode(JSON.stringify({ foo: 'bar' }));
    expect(deserializeSyncMessage(data)).toBeNull();
  });
});

// ── serializeDTUForSync / deserializeDTUFromSync ─────────────────────────────

describe('serializeDTUForSync / deserializeDTUFromSync', () => {
  it('round-trips a DTU', () => {
    const original = makeDTU('dtu_test_001', 'hello world');
    const serialized = serializeDTUForSync(original);
    const restored = deserializeDTUFromSync(serialized);

    expect(restored).not.toBeNull();
    expect(restored!.id).toBe(original.id);
    expect(restored!.header.version).toBe(original.header.version);
    expect(restored!.header.flags).toBe(original.header.flags);
    expect(restored!.header.type).toBe(original.header.type);
    expect(restored!.content).toEqual(original.content);
    expect(restored!.tags).toEqual(original.tags);
  });

  it('preserves content hash', () => {
    const original = makeDTU('dtu_hash_test');
    const serialized = serializeDTUForSync(original);
    const restored = deserializeDTUFromSync(serialized);

    expect(restored!.header.contentHash).toEqual(original.header.contentHash);
  });

  it('returns null for invalid JSON', () => {
    expect(deserializeDTUFromSync('not valid json{')).toBeNull();
  });

  it('handles DTU with lineage', () => {
    const original = makeDTU('dtu_lineage');
    original.lineage = { parentId: 'parent_001', ancestors: ['parent_001'], depth: 1 };
    const serialized = serializeDTUForSync(original);
    const restored = deserializeDTUFromSync(serialized);

    expect(restored!.lineage).toEqual(original.lineage);
  });
});

// ── createLatticeSync ────────────────────────────────────────────────────────

describe('createLatticeSync', () => {
  describe('computeMerkleRoot', () => {
    it('computes root for a set of IDs', async () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const root = await sync.computeMerkleRoot(['a', 'b', 'c']);
      expect(typeof root).toBe('string');
      expect(root.length).toBe(8);
    });

    it('returns zero hash for empty list', async () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const root = await sync.computeMerkleRoot([]);
      expect(root).toBe('00000000');
    });
  });

  describe('computeDiff', () => {
    it('correctly identifies missing DTUs on both sides', () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const localIds = ['a', 'b', 'c'];
      const remoteIds = ['b', 'c', 'd', 'e'];
      const remoteRoot = buildMerkleRoot(remoteIds);

      const diff = sync.computeDiff(localIds, remoteRoot, remoteIds);

      expect(diff.missingLocal).toEqual(['d', 'e']);
      expect(diff.missingRemote).toEqual(['a']);
    });

    it('returns empty diffs when sets are identical', () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const ids = ['a', 'b', 'c'];
      const root = buildMerkleRoot(ids);

      const diff = sync.computeDiff(ids, root, ids);
      expect(diff.missingLocal).toEqual([]);
      expect(diff.missingRemote).toEqual([]);
    });

    it('identifies all remote IDs as missing when local is empty', () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const remoteIds = ['a', 'b', 'c'];
      const remoteRoot = buildMerkleRoot(remoteIds);

      const diff = sync.computeDiff([], remoteRoot, remoteIds);
      expect(diff.missingLocal).toEqual(['a', 'b', 'c']);
      expect(diff.missingRemote).toEqual([]);
    });

    it('identifies all local IDs as missing remote when remote is empty', () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const localIds = ['x', 'y', 'z'];
      const diff = sync.computeDiff(localIds, '00000000', []);
      expect(diff.missingLocal).toEqual([]);
      expect(diff.missingRemote).toEqual(['x', 'y', 'z']);
    });

    it('handles large diff sets efficiently', () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const localIds = Array.from({ length: 500 }, (_, i) => `local_${i}`);
      const remoteIds = Array.from({ length: 500 }, (_, i) => `remote_${i}`);
      // Add some overlap
      const sharedIds = Array.from({ length: 100 }, (_, i) => `shared_${i}`);

      const diff = sync.computeDiff(
        [...localIds, ...sharedIds],
        'anyroot',
        [...remoteIds, ...sharedIds],
      );

      expect(diff.missingLocal.length).toBe(500); // remote-only
      expect(diff.missingRemote.length).toBe(500); // local-only
    });
  });

  describe('sync', () => {
    it('returns success with zero counts when roots match', async () => {
      const dtus = [makeDTU('a'), makeDTU('b')];
      const store = createMockStore(dtus);
      const sync = createLatticeSync(store);

      const localIds = dtus.map(d => d.id);
      const matchingRoot = buildMerkleRoot(localIds);

      const peer = createMockPeer();
      const result = await sync.sync(peer, store, matchingRoot);

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(0);
      expect(result.receivedCount).toBe(0);
      expect(result.finalLocalCount).toBe(2);
    });

    it('sends DTUs that peer is missing', async () => {
      const localDTUs = [makeDTU('local_1'), makeDTU('shared_1')];
      const store = createMockStore(localDTUs);
      const sync = createLatticeSync(store);

      // Remote only has shared_1
      const remoteIds = ['shared_1'];
      const remoteRoot = buildMerkleRoot(remoteIds);
      const peer = createMockPeer({ remoteIds });

      const result = await sync.sync(peer, store, remoteRoot);

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(1); // local_1 sent to peer
      expect(peer.sendData).toHaveBeenCalled();
    });

    it('reports correct final local count', async () => {
      const dtus = [makeDTU('a'), makeDTU('b'), makeDTU('c')];
      const store = createMockStore(dtus);
      const sync = createLatticeSync(store);

      const root = buildMerkleRoot(dtus.map(d => d.id));
      const peer = createMockPeer();

      const result = await sync.sync(peer, store, root);
      expect(result.finalLocalCount).toBe(3);
    });

    it('reports duration in milliseconds', async () => {
      const dtus = [makeDTU('x')];
      const store = createMockStore(dtus);
      const sync = createLatticeSync(store);

      const root = buildMerkleRoot(['x']);
      const peer = createMockPeer();

      const result = await sync.sync(peer, store, root);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles sync failure gracefully', async () => {
      const store = createMockStore([makeDTU('a')]);
      const sync = createLatticeSync(store);

      const peer = createMockPeer();
      // Make peer.sendData throw
      (peer.sendData as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await sync.sync(peer, store, 'differentroot');
      expect(result.success).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSyncState', () => {
    it('returns initial sync state', () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const state = sync.getSyncState();
      expect(state.localMerkleRoot).toBe('00000000');
      expect(state.remoteMerkleRoot).toBe('00000000');
      expect(state.missingLocal).toEqual([]);
      expect(state.missingRemote).toEqual([]);
      expect(state.syncProgress).toBe(0);
    });

    it('returns a copy (not a reference)', () => {
      const store = createMockStore([]);
      const sync = createLatticeSync(store);

      const state1 = sync.getSyncState();
      const state2 = sync.getSyncState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it('updates sync state after sync with matching roots', async () => {
      const dtus = [makeDTU('a')];
      const store = createMockStore(dtus);
      const sync = createLatticeSync(store);

      const root = buildMerkleRoot(['a']);
      const peer = createMockPeer();
      await sync.sync(peer, store, root);

      const state = sync.getSyncState();
      expect(state.syncProgress).toBe(1.0);
      expect(state.localMerkleRoot).toBe(root);
      expect(state.remoteMerkleRoot).toBe(root);
    });
  });
});
