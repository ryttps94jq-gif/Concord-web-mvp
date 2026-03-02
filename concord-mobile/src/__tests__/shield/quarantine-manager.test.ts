// Tests for Shield: Quarantine Manager
// Validates max size enforcement, eviction, release, and pruning

import {
  createQuarantineManager,
  QuarantineManager,
} from '../../shield/quarantine/quarantine-manager';
import { DTU, ThreatMatch, DTUHeader, DTUMeta } from '../../utils/types';
import { SHIELD_QUARANTINE_MAX_SIZE } from '../../utils/constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockDTU(id: string): DTU {
  const header: DTUHeader = {
    version: 1,
    flags: 0,
    type: 0x000E,
    timestamp: Date.now(),
    contentLength: 10,
    contentHash: new Uint8Array(32),
  };
  const meta: DTUMeta = {
    scope: 'local',
    published: false,
    painTagged: false,
    crpiScore: 0,
    relayCount: 0,
    ttl: 7,
  };
  return {
    id,
    header,
    content: new Uint8Array([1, 2, 3, 4, 5]),
    tags: ['test'],
    meta,
  };
}

function createMockThreats(count: number = 1): ThreatMatch[] {
  return Array.from({ length: count }, (_, i) => ({
    signatureId: `sig-${i}`,
    severity: 5 + i,
    category: 'malware',
    matchLocation: 0,
    confidence: 0.9,
  }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('QuarantineManager', () => {
  let manager: QuarantineManager;

  beforeEach(() => {
    manager = createQuarantineManager();
  });

  describe('quarantine', () => {
    it('should quarantine a DTU', () => {
      const dtu = createMockDTU('dtu-001');
      manager.quarantine(dtu, 'malware detected', createMockThreats());

      expect(manager.isQuarantined('dtu-001')).toBe(true);
      expect(manager.getQuarantinedCount()).toBe(1);
    });

    it('should store quarantine reason and threats', () => {
      const dtu = createMockDTU('dtu-001');
      const threats = createMockThreats(2);
      manager.quarantine(dtu, 'multiple threats', threats);

      const entries = manager.getQuarantined();
      expect(entries[0].reason).toBe('multiple threats');
      expect(entries[0].threats.length).toBe(2);
      expect(entries[0].threats[0].signatureId).toBe('sig-0');
      expect(entries[0].threats[1].signatureId).toBe('sig-1');
    });

    it('should record quarantine timestamp', () => {
      const before = Date.now();
      const dtu = createMockDTU('dtu-001');
      manager.quarantine(dtu, 'test', createMockThreats());
      const after = Date.now();

      const entries = manager.getQuarantined();
      expect(entries[0].quarantinedAt).toBeGreaterThanOrEqual(before);
      expect(entries[0].quarantinedAt).toBeLessThanOrEqual(after);
    });

    it('should set released to false on quarantine', () => {
      const dtu = createMockDTU('dtu-001');
      manager.quarantine(dtu, 'test', createMockThreats());

      const entries = manager.getQuarantined();
      expect(entries[0].released).toBe(false);
    });

    it('should quarantine multiple DTUs', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'reason 1', createMockThreats());
      manager.quarantine(createMockDTU('dtu-002'), 'reason 2', createMockThreats());
      manager.quarantine(createMockDTU('dtu-003'), 'reason 3', createMockThreats());

      expect(manager.getQuarantinedCount()).toBe(3);
    });

    it('should update existing quarantine record if re-quarantined', () => {
      const dtu = createMockDTU('dtu-001');
      manager.quarantine(dtu, 'first reason', createMockThreats());
      manager.quarantine(dtu, 'updated reason', createMockThreats(3));

      expect(manager.getQuarantinedCount()).toBe(1);
      const entries = manager.getQuarantined();
      expect(entries[0].reason).toBe('updated reason');
      expect(entries[0].threats.length).toBe(3);
    });
  });

  describe('max size enforcement', () => {
    it('should enforce max quarantine size', () => {
      const smallManager = createQuarantineManager(5);

      for (let i = 0; i < 10; i++) {
        smallManager.quarantine(
          createMockDTU(`dtu-${i}`),
          'test',
          createMockThreats()
        );
      }

      expect(smallManager.getQuarantinedCount()).toBeLessThanOrEqual(5);
    });

    it('should evict oldest entries when full', () => {
      const smallManager = createQuarantineManager(3);

      smallManager.quarantine(createMockDTU('dtu-oldest'), 'test', createMockThreats());
      smallManager.quarantine(createMockDTU('dtu-middle'), 'test', createMockThreats());
      smallManager.quarantine(createMockDTU('dtu-recent'), 'test', createMockThreats());

      // Adding a 4th should evict the oldest
      smallManager.quarantine(createMockDTU('dtu-newest'), 'test', createMockThreats());

      expect(smallManager.getQuarantinedCount()).toBe(3);
      expect(smallManager.isQuarantined('dtu-oldest')).toBe(false);
      expect(smallManager.isQuarantined('dtu-middle')).toBe(true);
      expect(smallManager.isQuarantined('dtu-recent')).toBe(true);
      expect(smallManager.isQuarantined('dtu-newest')).toBe(true);
    });

    it('should use default max size from constants', () => {
      // The default manager should use SHIELD_QUARANTINE_MAX_SIZE
      expect(SHIELD_QUARANTINE_MAX_SIZE).toBe(10000);
      // We can't easily fill 10,000 entries in a test, so just verify it doesn't crash
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      expect(manager.getQuarantinedCount()).toBe(1);
    });

    it('should handle max size of 1', () => {
      const tinyManager = createQuarantineManager(1);

      tinyManager.quarantine(createMockDTU('dtu-1'), 'test', createMockThreats());
      expect(tinyManager.getQuarantinedCount()).toBe(1);

      tinyManager.quarantine(createMockDTU('dtu-2'), 'test', createMockThreats());
      expect(tinyManager.getQuarantinedCount()).toBe(1);
      expect(tinyManager.isQuarantined('dtu-2')).toBe(true);
      expect(tinyManager.isQuarantined('dtu-1')).toBe(false);
    });
  });

  describe('release', () => {
    it('should release a quarantined DTU', () => {
      const dtu = createMockDTU('dtu-001');
      manager.quarantine(dtu, 'false positive', createMockThreats());

      const released = manager.release('dtu-001');

      expect(released).toBeDefined();
      expect(released!.id).toBe('dtu-001');
      expect(manager.isQuarantined('dtu-001')).toBe(false);
      expect(manager.getQuarantinedCount()).toBe(0);
    });

    it('should return undefined for non-existent DTU', () => {
      const released = manager.release('non-existent');
      expect(released).toBeUndefined();
    });

    it('should return the original DTU on release', () => {
      const dtu = createMockDTU('dtu-001');
      dtu.content = new Uint8Array([10, 20, 30, 40, 50]);
      manager.quarantine(dtu, 'test', createMockThreats());

      const released = manager.release('dtu-001');
      expect(released).toBeDefined();
      expect(released!.content).toEqual(new Uint8Array([10, 20, 30, 40, 50]));
    });

    it('should not be releasable twice', () => {
      const dtu = createMockDTU('dtu-001');
      manager.quarantine(dtu, 'test', createMockThreats());

      const first = manager.release('dtu-001');
      const second = manager.release('dtu-001');

      expect(first).toBeDefined();
      expect(second).toBeUndefined();
    });
  });

  describe('isQuarantined', () => {
    it('should return true for quarantined DTUs', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      expect(manager.isQuarantined('dtu-001')).toBe(true);
    });

    it('should return false for non-quarantined DTUs', () => {
      expect(manager.isQuarantined('unknown')).toBe(false);
    });

    it('should return false after release', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      manager.release('dtu-001');
      expect(manager.isQuarantined('dtu-001')).toBe(false);
    });

    it('should return false after clear', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      manager.clear();
      expect(manager.isQuarantined('dtu-001')).toBe(false);
    });
  });

  describe('getQuarantined', () => {
    it('should return empty array when no entries', () => {
      expect(manager.getQuarantined()).toEqual([]);
    });

    it('should return all quarantine entries', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'reason 1', createMockThreats());
      manager.quarantine(createMockDTU('dtu-002'), 'reason 2', createMockThreats());

      const entries = manager.getQuarantined();
      expect(entries.length).toBe(2);
      expect(entries.map(e => e.dtuId)).toContain('dtu-001');
      expect(entries.map(e => e.dtuId)).toContain('dtu-002');
    });

    it('should return copies, not references', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());

      const entries1 = manager.getQuarantined();
      const entries2 = manager.getQuarantined();

      // Should be equal but not the same reference
      expect(entries1[0]).toEqual(entries2[0]);
      expect(entries1[0]).not.toBe(entries2[0]);
    });
  });

  describe('getQuarantinedCount', () => {
    it('should return 0 initially', () => {
      expect(manager.getQuarantinedCount()).toBe(0);
    });

    it('should track count correctly', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      expect(manager.getQuarantinedCount()).toBe(1);

      manager.quarantine(createMockDTU('dtu-002'), 'test', createMockThreats());
      expect(manager.getQuarantinedCount()).toBe(2);

      manager.release('dtu-001');
      expect(manager.getQuarantinedCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      manager.quarantine(createMockDTU('dtu-002'), 'test', createMockThreats());
      manager.quarantine(createMockDTU('dtu-003'), 'test', createMockThreats());

      manager.clear();

      expect(manager.getQuarantinedCount()).toBe(0);
      expect(manager.getQuarantined()).toEqual([]);
      expect(manager.isQuarantined('dtu-001')).toBe(false);
    });

    it('should allow new quarantines after clear', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      manager.clear();

      manager.quarantine(createMockDTU('dtu-002'), 'test', createMockThreats());
      expect(manager.getQuarantinedCount()).toBe(1);
      expect(manager.isQuarantined('dtu-002')).toBe(true);
    });
  });

  describe('pruneOld', () => {
    it('should remove entries older than max age', () => {
      const dtu1 = createMockDTU('dtu-old');
      manager.quarantine(dtu1, 'test', createMockThreats());

      // Manually backdate the entry by getting and modifying
      const entries = manager.getQuarantined();
      // We can't easily backdate with the current API, so we test with a very large maxAgeDays
      const pruned = manager.pruneOld(0); // 0 days = prune everything

      // All entries should be pruned since they were just created (within "0 days ago" boundary)
      // Actually 0 days means cutoff = now, and quarantinedAt <= now, so all should be pruned
      expect(pruned).toBe(1);
      expect(manager.getQuarantinedCount()).toBe(0);
    });

    it('should keep recent entries', () => {
      manager.quarantine(createMockDTU('dtu-001'), 'test', createMockThreats());
      manager.quarantine(createMockDTU('dtu-002'), 'test', createMockThreats());

      // 30 days is well in the future for entries just created
      const pruned = manager.pruneOld(30);
      expect(pruned).toBe(0);
      expect(manager.getQuarantinedCount()).toBe(2);
    });

    it('should return count of pruned entries', () => {
      for (let i = 0; i < 5; i++) {
        manager.quarantine(createMockDTU(`dtu-${i}`), 'test', createMockThreats());
      }

      const pruned = manager.pruneOld(0);
      expect(pruned).toBe(5);
    });

    it('should handle empty quarantine', () => {
      const pruned = manager.pruneOld(7);
      expect(pruned).toBe(0);
    });
  });

  describe('threat data preservation', () => {
    it('should preserve threat match details in quarantine', () => {
      const threats: ThreatMatch[] = [
        {
          signatureId: 'sig-critical',
          severity: 10,
          category: 'exploit',
          matchLocation: 42,
          confidence: 0.99,
        },
      ];

      manager.quarantine(createMockDTU('dtu-001'), 'critical exploit', threats);
      const entries = manager.getQuarantined();

      expect(entries[0].threats[0].signatureId).toBe('sig-critical');
      expect(entries[0].threats[0].severity).toBe(10);
      expect(entries[0].threats[0].category).toBe('exploit');
      expect(entries[0].threats[0].matchLocation).toBe(42);
      expect(entries[0].threats[0].confidence).toBe(0.99);
    });

    it('should not mutate threats after quarantine', () => {
      const threats = createMockThreats(1);
      manager.quarantine(createMockDTU('dtu-001'), 'test', threats);

      // Mutate the original threats array
      threats[0].severity = 999;

      const entries = manager.getQuarantined();
      expect(entries[0].threats[0].severity).not.toBe(999);
    });
  });
});
