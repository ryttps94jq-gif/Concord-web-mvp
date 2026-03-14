// Concord Mobile — DTU Relay Engine
// Store-and-forward relay with priority queue and deduplication

import {
  MAX_RELAY_QUEUE_SIZE,
  RELAY_DEDUP_WINDOW_MS,
  DTU_TYPES,
} from '../../utils/constants';
import type { DTU, RelayQueueEntry } from '../../utils/types';

// ── Relay Types ───────────────────────────────────────────────────────────────

export interface RelayResult {
  sent: number;
  failed: number;
  skipped: number;
  expired: number;
}

export interface RelayQueueStats {
  totalEntries: number;
  byPriority: Record<number, number>;
  oldestEntryAge: number;
  seenHashCount: number;
}

export interface RelayOptions {
  maxQueueSize?: number;
  dedupWindowMs?: number;
}

// ── Priority Constants ────────────────────────────────────────────────────────

export const RELAY_PRIORITY = {
  EMERGENCY: 0,   // Highest priority (lowest number = first out)
  SHIELD: 1,
  ECONOMIC: 2,
  NORMAL: 3,
} as const;

// ── Relay Engine Interface ────────────────────────────────────────────────────

export interface RelayEngine {
  enqueue(dtu: DTU, excludePeers?: string[]): void;
  processQueue(
    sendFn: (peerId: string, dtu: DTU) => Promise<boolean>,
    targetPeerIds?: string[],
  ): Promise<RelayResult>;
  isDuplicate(dtuHash: string): boolean;
  markSeen(dtuHash: string): void;
  getQueueDepth(): number;
  getQueueStats(): RelayQueueStats;
  clearExpired(): number;
}

// ── Priority Mapping ──────────────────────────────────────────────────────────

function getDTUPriority(dtu: DTU): number {
  switch (dtu.header.type) {
    case DTU_TYPES.EMERGENCY_ALERT:
      return RELAY_PRIORITY.EMERGENCY;
    case DTU_TYPES.SHIELD_THREAT:
      return RELAY_PRIORITY.SHIELD;
    case DTU_TYPES.ECONOMY_TRANSACTION:
      return RELAY_PRIORITY.ECONOMIC;
    default:
      return RELAY_PRIORITY.NORMAL;
  }
}

// ── Implementation ────────────────────────────────────────────────────────────

export function createRelayEngine(options?: RelayOptions): RelayEngine {
  const maxQueueSize = options?.maxQueueSize ?? MAX_RELAY_QUEUE_SIZE;
  const dedupWindowMs = options?.dedupWindowMs ?? RELAY_DEDUP_WINDOW_MS;

  // Priority queue stored as sorted array (stable sort by priority, then enqueuedAt)
  const queue: Array<RelayQueueEntry & { dtu: DTU }> = [];

  // Seen hashes for deduplication: hash -> timestamp when seen
  const seenHashes = new Map<string, number>();

  function insertSorted(entry: RelayQueueEntry & { dtu: DTU }): void {
    // Binary search for insertion point
    let low = 0;
    let high = queue.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const existing = queue[mid];
      // Lower priority number = higher priority
      if (
        existing.priority < entry.priority ||
        (existing.priority === entry.priority && existing.enqueuedAt <= entry.enqueuedAt)
      ) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    queue.splice(low, 0, entry);
  }

  function pruneSeenHashes(): void {
    const cutoff = Date.now() - dedupWindowMs;
    for (const [hash, timestamp] of seenHashes) {
      if (timestamp < cutoff) {
        seenHashes.delete(hash);
      }
    }
  }

  function computeDTUHash(dtu: DTU): string {
    // Use the content hash from the DTU header for dedup
    return Array.from(dtu.header.contentHash)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return {
    enqueue(dtu: DTU, excludePeers?: string[]): void {
      // Never relay DTUs with TTL=0
      if (dtu.meta.ttl <= 0) {
        return;
      }

      const dtuHash = computeDTUHash(dtu);

      // Check for duplicates
      if (seenHashes.has(dtuHash)) {
        return;
      }

      // Enforce max queue size — drop lowest priority (highest number)
      if (queue.length >= maxQueueSize) {
        const newPriority = getDTUPriority(dtu);
        const lastEntry = queue[queue.length - 1];
        if (lastEntry && lastEntry.priority <= newPriority) {
          // Can't insert: queue full and new entry is lower or equal priority to lowest
          return;
        }
        // Drop the lowest priority entry to make room
        queue.pop();
      }

      const entry: RelayQueueEntry & { dtu: DTU } = {
        dtuId: dtu.id,
        dtuHash,
        priority: getDTUPriority(dtu),
        ttl: dtu.meta.ttl - 1, // Decrement TTL
        enqueuedAt: Date.now(),
        excludePeers: excludePeers ?? [],
        dtu: {
          ...dtu,
          meta: {
            ...dtu.meta,
            ttl: dtu.meta.ttl - 1,
            relayCount: dtu.meta.relayCount + 1,
          },
        },
      };

      insertSorted(entry);
      seenHashes.set(dtuHash, Date.now());
    },

    async processQueue(
      sendFn: (peerId: string, dtu: DTU) => Promise<boolean>,
      targetPeerIds?: string[],
    ): Promise<RelayResult> {
      const result: RelayResult = {
        sent: 0,
        failed: 0,
        skipped: 0,
        expired: 0,
      };

      if (!targetPeerIds || targetPeerIds.length === 0) {
        return result;
      }

      // Process queue from front (highest priority)
      const toRemove: number[] = [];

      for (let i = 0; i < queue.length; i++) {
        const entry = queue[i];

        // Skip expired entries (TTL already decremented at enqueue)
        if (entry.ttl <= 0) {
          result.expired++;
          toRemove.push(i);
          continue;
        }

        let sentToAny = false;

        for (const peerId of targetPeerIds) {
          // Skip excluded peers
          if (entry.excludePeers.includes(peerId)) {
            result.skipped++;
            continue;
          }

          try {
            const success = await sendFn(peerId, entry.dtu);
            if (success) {
              result.sent++;
              sentToAny = true;
            } else {
              result.failed++;
            }
          } catch (_e) {
            result.failed++;
          }
        }

        if (sentToAny) {
          toRemove.push(i);
        }
      }

      // Remove processed entries (reverse order to maintain indices)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        queue.splice(toRemove[i], 1);
      }

      // Periodically prune seen hashes
      pruneSeenHashes();

      return result;
    },

    isDuplicate(dtuHash: string): boolean {
      if (!seenHashes.has(dtuHash)) {
        return false;
      }
      // Check if still within dedup window
      const seenAt = seenHashes.get(dtuHash)!;
      if (Date.now() - seenAt > dedupWindowMs) {
        seenHashes.delete(dtuHash);
        return false;
      }
      return true;
    },

    markSeen(dtuHash: string): void {
      seenHashes.set(dtuHash, Date.now());
    },

    getQueueDepth(): number {
      return queue.length;
    },

    getQueueStats(): RelayQueueStats {
      const byPriority: Record<number, number> = {};
      let oldestAge = 0;
      const now = Date.now();

      for (const entry of queue) {
        byPriority[entry.priority] = (byPriority[entry.priority] ?? 0) + 1;
        const age = now - entry.enqueuedAt;
        if (age > oldestAge) {
          oldestAge = age;
        }
      }

      return {
        totalEntries: queue.length,
        byPriority,
        oldestEntryAge: oldestAge,
        seenHashCount: seenHashes.size,
      };
    },

    clearExpired(): number {
      let cleared = 0;
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].ttl <= 0) {
          queue.splice(i, 1);
          cleared++;
        }
      }

      // Also prune old seen hashes
      pruneSeenHashes();

      return cleared;
    },
  };
}
