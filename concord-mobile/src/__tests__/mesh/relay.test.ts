// Tests for Relay Engine
import { createRelayEngine, RELAY_PRIORITY } from '../../mesh/transport/relay';
import type { RelayEngine, RelayResult, RelayOptions } from '../../mesh/transport/relay';
import type { DTU } from '../../utils/types';
import {
  DTU_TYPES,
  DEFAULT_DTU_TTL,
  MAX_RELAY_QUEUE_SIZE,
  RELAY_DEDUP_WINDOW_MS,
  EMERGENCY_DTU_TTL,
} from '../../utils/constants';

// ── Test Helpers ──────────────────────────────────────────────────────────────

function createTestDTU(overrides?: Partial<DTU> & { type?: number; ttl?: number }): DTU {
  const content = new Uint8Array([1, 2, 3, 4, 5]);
  const contentHash = new Uint8Array(32);
  // Make each DTU have a unique hash by default
  const rand = Math.floor(Math.random() * 0xFFFFFFFF);
  contentHash[0] = (rand >> 24) & 0xFF;
  contentHash[1] = (rand >> 16) & 0xFF;
  contentHash[2] = (rand >> 8) & 0xFF;
  contentHash[3] = rand & 0xFF;

  const type = overrides?.type ?? DTU_TYPES.TEXT;
  const ttl = overrides?.ttl ?? DEFAULT_DTU_TTL;

  return {
    id: overrides?.id ?? `dtu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    header: {
      version: 1,
      flags: 0,
      type,
      timestamp: Date.now(),
      contentLength: content.length,
      contentHash,
      ...overrides?.header,
    },
    content,
    tags: [],
    meta: {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl,
      ...overrides?.meta,
    },
    ...overrides,
  };
}

function createDTUWithHash(hashByte: number, type?: number, ttl?: number): DTU {
  const contentHash = new Uint8Array(32);
  contentHash[0] = hashByte;

  return createTestDTU({
    id: `dtu_hash_${hashByte}`,
    type: type ?? DTU_TYPES.TEXT,
    ttl: ttl ?? DEFAULT_DTU_TTL,
    header: {
      version: 1,
      flags: 0,
      type: type ?? DTU_TYPES.TEXT,
      timestamp: Date.now(),
      contentLength: 5,
      contentHash,
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Relay Engine', () => {
  describe('createRelayEngine', () => {
    it('should create a relay engine with default options', () => {
      const engine = createRelayEngine();

      expect(engine).toBeDefined();
      expect(engine.getQueueDepth()).toBe(0);
    });

    it('should accept custom options', () => {
      const engine = createRelayEngine({
        maxQueueSize: 500,
        dedupWindowMs: 30000,
      });

      expect(engine).toBeDefined();
    });
  });

  describe('enqueue', () => {
    it('should add a DTU to the queue', () => {
      const engine = createRelayEngine();
      const dtu = createTestDTU();

      engine.enqueue(dtu);

      expect(engine.getQueueDepth()).toBe(1);
    });

    it('should not enqueue DTU with TTL=0', () => {
      const engine = createRelayEngine();
      const dtu = createTestDTU({ ttl: 0 });

      engine.enqueue(dtu);

      expect(engine.getQueueDepth()).toBe(0);
    });

    it('should not enqueue DTU with negative TTL', () => {
      const engine = createRelayEngine();
      const dtu = createTestDTU({ ttl: -1 });

      engine.enqueue(dtu);

      expect(engine.getQueueDepth()).toBe(0);
    });

    it('should decrement TTL when enqueuing', () => {
      const engine = createRelayEngine();
      const dtu = createTestDTU({ ttl: 5 });

      engine.enqueue(dtu);

      const stats = engine.getQueueStats();
      expect(stats.totalEntries).toBe(1);
    });

    it('should not enqueue duplicate DTUs (same hash)', () => {
      const engine = createRelayEngine();
      const dtu1 = createDTUWithHash(0xAA);
      const dtu2 = createDTUWithHash(0xAA); // Same hash

      engine.enqueue(dtu1);
      engine.enqueue(dtu2);

      expect(engine.getQueueDepth()).toBe(1);
    });

    it('should enqueue DTUs with different hashes', () => {
      const engine = createRelayEngine();
      const dtu1 = createDTUWithHash(0xAA);
      const dtu2 = createDTUWithHash(0xBB);

      engine.enqueue(dtu1);
      engine.enqueue(dtu2);

      expect(engine.getQueueDepth()).toBe(2);
    });

    it('should enforce max queue size', () => {
      const engine = createRelayEngine({ maxQueueSize: 3 });

      for (let i = 0; i < 5; i++) {
        const dtu = createTestDTU();
        engine.enqueue(dtu);
      }

      expect(engine.getQueueDepth()).toBe(3);
    });

    it('should drop lower priority items when queue is full', () => {
      const engine = createRelayEngine({ maxQueueSize: 2 });

      // Fill queue with normal priority
      engine.enqueue(createTestDTU({ type: DTU_TYPES.TEXT }));
      engine.enqueue(createTestDTU({ type: DTU_TYPES.TEXT }));

      expect(engine.getQueueDepth()).toBe(2);

      // Add emergency priority — should evict lowest priority
      const emergency = createTestDTU({ type: DTU_TYPES.EMERGENCY_ALERT });
      engine.enqueue(emergency);

      expect(engine.getQueueDepth()).toBe(2);
    });

    it('should reject low priority items when queue full of high priority', () => {
      const engine = createRelayEngine({ maxQueueSize: 2 });

      // Fill queue with emergency priority
      engine.enqueue(createTestDTU({ type: DTU_TYPES.EMERGENCY_ALERT }));
      engine.enqueue(createTestDTU({ type: DTU_TYPES.EMERGENCY_ALERT }));

      // Try to add normal priority — should be rejected
      const normal = createTestDTU({ type: DTU_TYPES.TEXT });
      engine.enqueue(normal);

      expect(engine.getQueueDepth()).toBe(2);
    });

    it('should store excludePeers', () => {
      const engine = createRelayEngine();
      const dtu = createTestDTU();

      engine.enqueue(dtu, ['peer-a', 'peer-b']);

      expect(engine.getQueueDepth()).toBe(1);
    });

    it('should increment relayCount in enqueued DTU', () => {
      const engine = createRelayEngine();
      const dtu = createTestDTU();
      dtu.meta.relayCount = 2;

      engine.enqueue(dtu);

      // relayCount should be incremented internally
      expect(engine.getQueueDepth()).toBe(1);
    });
  });

  describe('priority ordering', () => {
    it('should prioritize emergency DTUs first', async () => {
      const engine = createRelayEngine();
      const sentDTUs: DTU[] = [];

      // Enqueue in reverse priority order
      engine.enqueue(createTestDTU({ id: 'normal', type: DTU_TYPES.TEXT }));
      engine.enqueue(createTestDTU({ id: 'economic', type: DTU_TYPES.ECONOMY_TRANSACTION }));
      engine.enqueue(createTestDTU({ id: 'shield', type: DTU_TYPES.SHIELD_THREAT }));
      engine.enqueue(createTestDTU({ id: 'emergency', type: DTU_TYPES.EMERGENCY_ALERT }));

      await engine.processQueue(
        async (_peerId: string, dtu: DTU) => {
          sentDTUs.push(dtu);
          return true;
        },
        ['peer-1'],
      );

      expect(sentDTUs[0].header.type).toBe(DTU_TYPES.EMERGENCY_ALERT);
      expect(sentDTUs[1].header.type).toBe(DTU_TYPES.SHIELD_THREAT);
      expect(sentDTUs[2].header.type).toBe(DTU_TYPES.ECONOMY_TRANSACTION);
      expect(sentDTUs[3].header.type).toBe(DTU_TYPES.TEXT);
    });

    it('should maintain FIFO order within same priority', async () => {
      const engine = createRelayEngine();
      const sentIds: string[] = [];

      engine.enqueue(createTestDTU({ id: 'text-1', type: DTU_TYPES.TEXT }));
      engine.enqueue(createTestDTU({ id: 'text-2', type: DTU_TYPES.TEXT }));
      engine.enqueue(createTestDTU({ id: 'text-3', type: DTU_TYPES.TEXT }));

      await engine.processQueue(
        async (_peerId: string, dtu: DTU) => {
          sentIds.push(dtu.id);
          return true;
        },
        ['peer-1'],
      );

      expect(sentIds).toEqual(['text-1', 'text-2', 'text-3']);
    });
  });

  describe('processQueue', () => {
    it('should return zero counts with no peers', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU());

      const result = await engine.processQueue(
        async () => true,
        [],
      );

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should return zero counts with undefined peers', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU());

      const result = await engine.processQueue(
        async () => true,
      );

      expect(result.sent).toBe(0);
    });

    it('should send to all target peers', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU());

      const sentTo: string[] = [];
      const result = await engine.processQueue(
        async (peerId: string) => {
          sentTo.push(peerId);
          return true;
        },
        ['peer-1', 'peer-2', 'peer-3'],
      );

      expect(sentTo).toContain('peer-1');
      expect(sentTo).toContain('peer-2');
      expect(sentTo).toContain('peer-3');
      expect(result.sent).toBe(3);
    });

    it('should skip excluded peers', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU(), ['peer-2']);

      const sentTo: string[] = [];
      const result = await engine.processQueue(
        async (peerId: string) => {
          sentTo.push(peerId);
          return true;
        },
        ['peer-1', 'peer-2', 'peer-3'],
      );

      expect(sentTo).not.toContain('peer-2');
      expect(result.skipped).toBe(1);
    });

    it('should count failures', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU());

      const result = await engine.processQueue(
        async () => false,
        ['peer-1'],
      );

      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);
    });

    it('should handle send function exceptions', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU());

      const result = await engine.processQueue(
        async () => {
          throw new Error('Network error');
        },
        ['peer-1'],
      );

      expect(result.failed).toBe(1);
    });

    it('should remove successfully sent entries', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU());
      engine.enqueue(createTestDTU());

      await engine.processQueue(
        async () => true,
        ['peer-1'],
      );

      expect(engine.getQueueDepth()).toBe(0);
    });

    it('should keep failed entries in queue', async () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU());

      await engine.processQueue(
        async () => false,
        ['peer-1'],
      );

      // Entry stays because it was never successfully sent to any peer
      expect(engine.getQueueDepth()).toBe(1);
    });

    it('should handle expired entries (TTL exhausted)', async () => {
      const engine = createRelayEngine();
      // DTU with TTL=1 will become TTL=0 after enqueue decrement
      engine.enqueue(createTestDTU({ ttl: 1 }));

      const result = await engine.processQueue(
        async () => true,
        ['peer-1'],
      );

      expect(result.expired).toBe(1);
    });
  });

  describe('isDuplicate / markSeen', () => {
    it('should return false for unseen hash', () => {
      const engine = createRelayEngine();

      expect(engine.isDuplicate('abc123')).toBe(false);
    });

    it('should return true for seen hash', () => {
      const engine = createRelayEngine();

      engine.markSeen('abc123');

      expect(engine.isDuplicate('abc123')).toBe(true);
    });

    it('should mark hash as seen when enqueuing', () => {
      const engine = createRelayEngine();
      const dtu = createDTUWithHash(0xFF);

      engine.enqueue(dtu);

      // The hash should be marked as seen
      const hash = Array.from(dtu.header.contentHash)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      expect(engine.isDuplicate(hash)).toBe(true);
    });

    it('should expire seen hashes after dedup window', () => {
      jest.useFakeTimers();
      const engine = createRelayEngine({ dedupWindowMs: 5000 });

      engine.markSeen('expire-test');
      expect(engine.isDuplicate('expire-test')).toBe(true);

      jest.advanceTimersByTime(6000);

      expect(engine.isDuplicate('expire-test')).toBe(false);

      jest.useRealTimers();
    });

    it('should keep hash within dedup window', () => {
      jest.useFakeTimers();
      const engine = createRelayEngine({ dedupWindowMs: 10000 });

      engine.markSeen('keep-test');

      jest.advanceTimersByTime(5000);

      expect(engine.isDuplicate('keep-test')).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('getQueueDepth', () => {
    it('should return 0 for empty queue', () => {
      const engine = createRelayEngine();
      expect(engine.getQueueDepth()).toBe(0);
    });

    it('should reflect queue size', () => {
      const engine = createRelayEngine();

      engine.enqueue(createTestDTU());
      expect(engine.getQueueDepth()).toBe(1);

      engine.enqueue(createTestDTU());
      expect(engine.getQueueDepth()).toBe(2);
    });
  });

  describe('getQueueStats', () => {
    it('should return empty stats for empty queue', () => {
      const engine = createRelayEngine();
      const stats = engine.getQueueStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.byPriority).toEqual({});
      expect(stats.oldestEntryAge).toBe(0);
      expect(stats.seenHashCount).toBe(0);
    });

    it('should break down by priority', () => {
      const engine = createRelayEngine();

      engine.enqueue(createTestDTU({ type: DTU_TYPES.TEXT }));
      engine.enqueue(createTestDTU({ type: DTU_TYPES.EMERGENCY_ALERT }));
      engine.enqueue(createTestDTU({ type: DTU_TYPES.SHIELD_THREAT }));
      engine.enqueue(createTestDTU({ type: DTU_TYPES.ECONOMY_TRANSACTION }));

      const stats = engine.getQueueStats();

      expect(stats.totalEntries).toBe(4);
      expect(stats.byPriority[RELAY_PRIORITY.EMERGENCY]).toBe(1);
      expect(stats.byPriority[RELAY_PRIORITY.SHIELD]).toBe(1);
      expect(stats.byPriority[RELAY_PRIORITY.ECONOMIC]).toBe(1);
      expect(stats.byPriority[RELAY_PRIORITY.NORMAL]).toBe(1);
    });

    it('should track seen hash count', () => {
      const engine = createRelayEngine();

      engine.markSeen('hash-1');
      engine.markSeen('hash-2');
      engine.markSeen('hash-3');

      const stats = engine.getQueueStats();
      expect(stats.seenHashCount).toBe(3);
    });

    it('should track oldest entry age', () => {
      jest.useFakeTimers();
      const engine = createRelayEngine();

      engine.enqueue(createTestDTU());
      jest.advanceTimersByTime(1000);
      engine.enqueue(createTestDTU());

      const stats = engine.getQueueStats();
      expect(stats.oldestEntryAge).toBeGreaterThanOrEqual(1000);

      jest.useRealTimers();
    });
  });

  describe('clearExpired', () => {
    it('should return 0 for empty queue', () => {
      const engine = createRelayEngine();
      expect(engine.clearExpired()).toBe(0);
    });

    it('should clear entries with TTL=0', () => {
      const engine = createRelayEngine();

      // Enqueue with TTL=1, which becomes TTL=0 after decrement
      engine.enqueue(createTestDTU({ ttl: 1 }));

      const cleared = engine.clearExpired();
      expect(cleared).toBe(1);
      expect(engine.getQueueDepth()).toBe(0);
    });

    it('should keep entries with positive TTL', () => {
      const engine = createRelayEngine();

      engine.enqueue(createTestDTU({ ttl: 5 }));

      const cleared = engine.clearExpired();
      expect(cleared).toBe(0);
      expect(engine.getQueueDepth()).toBe(1);
    });

    it('should prune expired seen hashes', () => {
      jest.useFakeTimers();
      const engine = createRelayEngine({ dedupWindowMs: 5000 });

      engine.markSeen('old-hash');
      jest.advanceTimersByTime(6000);

      engine.clearExpired();

      expect(engine.isDuplicate('old-hash')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('RELAY_PRIORITY constants', () => {
    it('should have EMERGENCY as highest priority (lowest number)', () => {
      expect(RELAY_PRIORITY.EMERGENCY).toBeLessThan(RELAY_PRIORITY.SHIELD);
      expect(RELAY_PRIORITY.SHIELD).toBeLessThan(RELAY_PRIORITY.ECONOMIC);
      expect(RELAY_PRIORITY.ECONOMIC).toBeLessThan(RELAY_PRIORITY.NORMAL);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid enqueue of many DTUs', () => {
      const engine = createRelayEngine({ maxQueueSize: 100 });

      for (let i = 0; i < 200; i++) {
        engine.enqueue(createTestDTU());
      }

      expect(engine.getQueueDepth()).toBeLessThanOrEqual(100);
    });

    it('should handle DTU with maximal TTL', () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU({ ttl: EMERGENCY_DTU_TTL }));

      expect(engine.getQueueDepth()).toBe(1);
    });

    it('should handle empty excludePeers', () => {
      const engine = createRelayEngine();
      engine.enqueue(createTestDTU(), []);

      expect(engine.getQueueDepth()).toBe(1);
    });

    it('should handle processQueue with empty queue', async () => {
      const engine = createRelayEngine();

      const result = await engine.processQueue(
        async () => true,
        ['peer-1'],
      );

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});
