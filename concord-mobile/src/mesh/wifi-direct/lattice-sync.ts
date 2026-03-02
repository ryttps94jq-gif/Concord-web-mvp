// Concord Mobile — Lattice Sync
// Merkle-tree based lattice synchronization over WiFi Direct
// Only exchange the diff — minimum data transfer for maximum sync

import { crc32, toHex, concatBytes, encodeUTF8 } from '../../utils/crypto';
import type { DTU, LatticeSyncState } from '../../utils/types';
import type { WiFiDirectManager } from './wifi-direct-manager';

// ── DTU Store Interface ──────────────────────────────────────────────────────

export interface DTUStore {
  getAllIds(): Promise<string[]>;
  getDTU(id: string): Promise<DTU | null>;
  putDTU(dtu: DTU): Promise<void>;
  getCount(): Promise<number>;
}

// ── Sync Result ──────────────────────────────────────────────────────────────

export interface LatticeSyncResult {
  success: boolean;
  sentCount: number;
  receivedCount: number;
  finalLocalCount: number;
  durationMs: number;
}

// ── Lattice Sync Interface ───────────────────────────────────────────────────

export interface LatticeSync {
  computeMerkleRoot(dtuIds: string[]): Promise<string>;
  computeDiff(
    localIds: string[],
    remoteRoot: string,
    remoteIds: string[],
  ): { missingLocal: string[]; missingRemote: string[] };
  sync(
    peer: WiFiDirectManager,
    localStore: DTUStore,
    remoteMerkleRoot: string,
  ): Promise<LatticeSyncResult>;
  getSyncState(): LatticeSyncState;
}

// ── Merkle Tree Helpers ──────────────────────────────────────────────────────

/**
 * Hash a single leaf node using CRC32 (fast, suitable for sync comparison).
 * Returns hex string of the hash.
 */
function hashLeaf(id: string): string {
  const bytes = encodeUTF8(id);
  const hash = crc32(bytes);
  return hash.toString(16).padStart(8, '0');
}

/**
 * Combine two hash strings into a parent hash.
 */
function hashPair(left: string, right: string): string {
  const combined = encodeUTF8(left + right);
  const hash = crc32(combined);
  return hash.toString(16).padStart(8, '0');
}

/**
 * Build a Merkle root from a sorted list of IDs.
 * Returns the root hash as a hex string.
 */
export function buildMerkleRoot(ids: string[]): string {
  if (ids.length === 0) {
    return '00000000';
  }

  // Sort IDs for deterministic ordering
  const sorted = [...ids].sort();

  // Compute leaf hashes
  let level: string[] = sorted.map(hashLeaf);

  // Build tree bottom-up
  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        nextLevel.push(hashPair(level[i], level[i + 1]));
      } else {
        // Odd node: promote to next level
        nextLevel.push(level[i]);
      }
    }
    level = nextLevel;
  }

  return level[0];
}

// ── Serialization for Wire Transfer ──────────────────────────────────────────

export function serializeSyncMessage(
  type: 'merkle-root' | 'id-list' | 'dtu-data' | 'sync-complete',
  payload: string,
): Uint8Array {
  const message = JSON.stringify({ type, payload });
  return encodeUTF8(message);
}

export function deserializeSyncMessage(
  data: Uint8Array,
): { type: string; payload: string } | null {
  try {
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.type === 'string' && typeof parsed.payload === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ── DTU Wire Serialization ───────────────────────────────────────────────────

export function serializeDTUForSync(dtu: DTU): string {
  return JSON.stringify({
    id: dtu.id,
    header: {
      version: dtu.header.version,
      flags: dtu.header.flags,
      type: dtu.header.type,
      timestamp: dtu.header.timestamp,
      contentLength: dtu.header.contentLength,
      contentHash: toHex(dtu.header.contentHash),
    },
    content: Array.from(dtu.content),
    tags: dtu.tags,
    meta: dtu.meta,
    lineage: dtu.lineage ?? null,
  });
}

export function deserializeDTUFromSync(json: string): DTU | null {
  try {
    const parsed = JSON.parse(json);
    const contentHashHex = parsed.header.contentHash as string;
    const contentHash = new Uint8Array(
      contentHashHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)),
    );
    return {
      id: parsed.id,
      header: {
        version: parsed.header.version,
        flags: parsed.header.flags,
        type: parsed.header.type,
        timestamp: parsed.header.timestamp,
        contentLength: parsed.header.contentLength,
        contentHash,
      },
      content: new Uint8Array(parsed.content),
      tags: parsed.tags,
      meta: parsed.meta,
      lineage: parsed.lineage ?? undefined,
    };
  } catch {
    return null;
  }
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createLatticeSync(store: DTUStore): LatticeSync {
  let syncState: LatticeSyncState = {
    localMerkleRoot: '00000000',
    remoteMerkleRoot: '00000000',
    missingLocal: [],
    missingRemote: [],
    syncProgress: 0,
  };

  return {
    async computeMerkleRoot(dtuIds: string[]): Promise<string> {
      return buildMerkleRoot(dtuIds);
    },

    computeDiff(
      localIds: string[],
      remoteRoot: string,
      remoteIds: string[],
    ): { missingLocal: string[]; missingRemote: string[] } {
      const localSet = new Set(localIds);
      const remoteSet = new Set(remoteIds);

      // DTUs that the remote has but we don't
      const missingLocal = remoteIds.filter(id => !localSet.has(id));
      // DTUs that we have but the remote doesn't
      const missingRemote = localIds.filter(id => !remoteSet.has(id));

      return { missingLocal, missingRemote };
    },

    async sync(
      peer: WiFiDirectManager,
      localStore: DTUStore,
      remoteMerkleRoot: string,
    ): Promise<LatticeSyncResult> {
      const startTime = Date.now();
      let sentCount = 0;
      let receivedCount = 0;

      try {
        // Step 1: Get local state
        const localIds = await localStore.getAllIds();
        const localRoot = buildMerkleRoot(localIds);

        syncState = {
          ...syncState,
          localMerkleRoot: localRoot,
          remoteMerkleRoot: remoteMerkleRoot,
          syncProgress: 0.1,
        };

        // Step 2: If roots match, we're already in sync
        if (localRoot === remoteMerkleRoot) {
          const finalCount = await localStore.getCount();
          syncState = {
            ...syncState,
            missingLocal: [],
            missingRemote: [],
            syncProgress: 1.0,
          };
          return {
            success: true,
            sentCount: 0,
            receivedCount: 0,
            finalLocalCount: finalCount,
            durationMs: Date.now() - startTime,
          };
        }

        // Step 3: Send our ID list to the peer to request the diff
        const idListMessage = serializeSyncMessage('id-list', JSON.stringify(localIds));
        await peer.sendData(idListMessage);
        syncState = { ...syncState, syncProgress: 0.3 };

        // Step 4: Receive remote IDs via a data callback
        const remoteIds = await new Promise<string[]>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Sync timeout waiting for remote ID list')),
            30000,
          );

          peer.onDataReceived((data: Uint8Array) => {
            clearTimeout(timeout);
            const msg = deserializeSyncMessage(data);
            if (msg && msg.type === 'id-list') {
              try {
                resolve(JSON.parse(msg.payload));
              } catch {
                reject(new Error('Invalid remote ID list'));
              }
            }
          });
        });

        // Step 5: Compute the diff
        const localSet = new Set(localIds);
        const remoteSet = new Set(remoteIds);
        const missingLocal = remoteIds.filter(id => !localSet.has(id));
        const missingRemote = localIds.filter(id => !remoteSet.has(id));

        syncState = {
          ...syncState,
          missingLocal,
          missingRemote,
          syncProgress: 0.5,
        };

        // Step 6: Send DTUs they need
        for (const id of missingRemote) {
          const dtu = await localStore.getDTU(id);
          if (dtu) {
            const dtuMessage = serializeSyncMessage(
              'dtu-data',
              serializeDTUForSync(dtu),
            );
            await peer.sendData(dtuMessage);
            sentCount++;
          }
        }

        syncState = { ...syncState, syncProgress: 0.7 };

        // Step 7: Receive DTUs we need
        if (missingLocal.length > 0) {
          let remaining = missingLocal.length;

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error('Sync timeout waiting for DTU data')),
              30000,
            );

            peer.onDataReceived(async (data: Uint8Array) => {
              const msg = deserializeSyncMessage(data);
              if (msg && msg.type === 'dtu-data') {
                const dtu = deserializeDTUFromSync(msg.payload);
                if (dtu) {
                  await localStore.putDTU(dtu);
                  receivedCount++;
                  remaining--;

                  syncState = {
                    ...syncState,
                    syncProgress: 0.7 + (0.3 * (1 - remaining / missingLocal.length)),
                  };

                  if (remaining <= 0) {
                    clearTimeout(timeout);
                    resolve();
                  }
                }
              } else if (msg && msg.type === 'sync-complete') {
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        }

        // Step 8: Send sync-complete
        const completeMessage = serializeSyncMessage('sync-complete', '');
        await peer.sendData(completeMessage);

        const finalCount = await localStore.getCount();
        syncState = {
          ...syncState,
          syncProgress: 1.0,
          missingLocal: [],
          missingRemote: [],
        };

        return {
          success: true,
          sentCount,
          receivedCount,
          finalLocalCount: finalCount,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        const finalCount = await localStore.getCount();
        return {
          success: false,
          sentCount,
          receivedCount,
          finalLocalCount: finalCount,
          durationMs: Date.now() - startTime,
        };
      }
    },

    getSyncState(): LatticeSyncState {
      return { ...syncState };
    },
  };
}
