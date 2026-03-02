// Tests for shield-store.ts

import { useShieldStore } from '../../store/shield-store';
import { SHIELD_QUARANTINE_MAX_SIZE } from '../../utils/constants';
import type { ThreatSignature, QuarantineEntry, ScanResult } from '../../utils/types';

function createSignature(overrides: Partial<ThreatSignature> = {}): ThreatSignature {
  return {
    id: `sig_${Math.random().toString(36).slice(2)}`,
    version: 1,
    pattern: 'malicious_pattern',
    severity: 5,
    category: 'malware',
    description: 'Test threat',
    updatedAt: Date.now(),
    ...overrides,
  };
}

function createQuarantineEntry(overrides: Partial<QuarantineEntry> = {}): QuarantineEntry {
  return {
    dtuId: `dtu_${Math.random().toString(36).slice(2)}`,
    reason: 'threat detected',
    threats: [{ signatureId: 'sig_1', severity: 5, category: 'malware', matchLocation: 0, confidence: 0.95 }],
    quarantinedAt: Date.now(),
    released: false,
    ...overrides,
  };
}

describe('useShieldStore', () => {
  beforeEach(() => {
    useShieldStore.getState().reset();
  });

  describe('threat signatures', () => {
    test('setSignatures stores signatures and computes version', () => {
      const sigs = [createSignature({ version: 3 }), createSignature({ version: 5 })];
      useShieldStore.getState().setSignatures(sigs);

      expect(useShieldStore.getState().signatures.length).toBe(2);
      expect(useShieldStore.getState().signatureVersion).toBe(5);
    });

    test('mergeSignatures keeps newer versions', () => {
      useShieldStore.getState().setSignatures([
        createSignature({ id: 'sig_1', version: 1 }),
        createSignature({ id: 'sig_2', version: 2 }),
      ]);

      useShieldStore.getState().mergeSignatures([
        createSignature({ id: 'sig_1', version: 3 }), // newer
        createSignature({ id: 'sig_3', version: 1 }), // new
      ]);

      const sigs = useShieldStore.getState().signatures;
      expect(sigs.length).toBe(3);
      const sig1 = sigs.find(s => s.id === 'sig_1');
      expect(sig1?.version).toBe(3);
    });

    test('mergeSignatures does not downgrade versions', () => {
      useShieldStore.getState().setSignatures([
        createSignature({ id: 'sig_1', version: 5 }),
      ]);

      useShieldStore.getState().mergeSignatures([
        createSignature({ id: 'sig_1', version: 2 }), // older — should be ignored
      ]);

      const sig1 = useShieldStore.getState().signatures.find(s => s.id === 'sig_1');
      expect(sig1?.version).toBe(5);
    });
  });

  describe('quarantine', () => {
    test('addToQuarantine adds entry', () => {
      const entry = createQuarantineEntry({ dtuId: 'dtu_1' });
      useShieldStore.getState().addToQuarantine(entry);

      expect(useShieldStore.getState().quarantineCount).toBe(1);
      expect(useShieldStore.getState().isQuarantined('dtu_1')).toBe(true);
    });

    test('addToQuarantine evicts oldest when at max size', () => {
      // Fill to max
      for (let i = 0; i < SHIELD_QUARANTINE_MAX_SIZE; i++) {
        useShieldStore.getState().addToQuarantine(
          createQuarantineEntry({ dtuId: `dtu_${i}`, quarantinedAt: 1000 + i })
        );
      }
      expect(useShieldStore.getState().quarantineCount).toBe(SHIELD_QUARANTINE_MAX_SIZE);

      // Add one more — oldest should be evicted
      useShieldStore.getState().addToQuarantine(
        createQuarantineEntry({ dtuId: 'dtu_new', quarantinedAt: Date.now() })
      );

      expect(useShieldStore.getState().quarantineCount).toBe(SHIELD_QUARANTINE_MAX_SIZE);
      expect(useShieldStore.getState().isQuarantined('dtu_0')).toBe(false); // oldest evicted
      expect(useShieldStore.getState().isQuarantined('dtu_new')).toBe(true);
    });

    test('releaseFromQuarantine removes and returns entry', () => {
      useShieldStore.getState().addToQuarantine(createQuarantineEntry({ dtuId: 'dtu_1' }));
      const released = useShieldStore.getState().releaseFromQuarantine('dtu_1');

      expect(released).toBeDefined();
      expect(released?.released).toBe(true);
      expect(useShieldStore.getState().isQuarantined('dtu_1')).toBe(false);
      expect(useShieldStore.getState().quarantineCount).toBe(0);
    });

    test('releaseFromQuarantine returns undefined for unknown', () => {
      expect(useShieldStore.getState().releaseFromQuarantine('nonexistent')).toBeUndefined();
    });

    test('getQuarantineEntries returns all entries', () => {
      useShieldStore.getState().addToQuarantine(createQuarantineEntry({ dtuId: 'dtu_1' }));
      useShieldStore.getState().addToQuarantine(createQuarantineEntry({ dtuId: 'dtu_2' }));

      const entries = useShieldStore.getState().getQuarantineEntries();
      expect(entries.length).toBe(2);
    });

    test('pruneQuarantine removes old entries', () => {
      const old = createQuarantineEntry({
        dtuId: 'dtu_old',
        quarantinedAt: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days ago
      });
      const fresh = createQuarantineEntry({
        dtuId: 'dtu_fresh',
        quarantinedAt: Date.now(),
      });

      useShieldStore.getState().addToQuarantine(old);
      useShieldStore.getState().addToQuarantine(fresh);

      const pruned = useShieldStore.getState().pruneQuarantine(30);
      expect(pruned).toBe(1);
      expect(useShieldStore.getState().quarantineCount).toBe(1);
      expect(useShieldStore.getState().isQuarantined('dtu_fresh')).toBe(true);
    });
  });

  describe('scan results', () => {
    test('addScanResult tracks results and counts', () => {
      const clean: ScanResult = {
        dtuId: 'dtu_1', clean: true, threats: [], scannedAt: Date.now(), scanDurationMs: 5,
      };
      const threat: ScanResult = {
        dtuId: 'dtu_2', clean: false,
        threats: [{ signatureId: 'sig_1', severity: 5, category: 'malware', matchLocation: 0, confidence: 0.9 }],
        scannedAt: Date.now(), scanDurationMs: 8,
      };

      useShieldStore.getState().addScanResult(clean);
      useShieldStore.getState().addScanResult(threat);

      expect(useShieldStore.getState().totalScanned).toBe(2);
      expect(useShieldStore.getState().threatsDetected).toBe(1);
    });

    test('recentScans capped at 1000', () => {
      for (let i = 0; i < 1100; i++) {
        useShieldStore.getState().addScanResult({
          dtuId: `dtu_${i}`, clean: true, threats: [], scannedAt: Date.now(), scanDurationMs: 1,
        });
      }
      expect(useShieldStore.getState().recentScans.length).toBe(1000);
    });

    test('getRecentScans respects limit', () => {
      for (let i = 0; i < 20; i++) {
        useShieldStore.getState().addScanResult({
          dtuId: `dtu_${i}`, clean: true, threats: [], scannedAt: Date.now(), scanDurationMs: 1,
        });
      }
      expect(useShieldStore.getState().getRecentScans(5).length).toBe(5);
    });
  });

  describe('reset', () => {
    test('resets all shield state', () => {
      useShieldStore.getState().setSignatures([createSignature()]);
      useShieldStore.getState().addToQuarantine(createQuarantineEntry());
      useShieldStore.getState().addScanResult({
        dtuId: 'dtu_1', clean: true, threats: [], scannedAt: Date.now(), scanDurationMs: 1,
      });

      useShieldStore.getState().reset();

      expect(useShieldStore.getState().signatures.length).toBe(0);
      expect(useShieldStore.getState().quarantineCount).toBe(0);
      expect(useShieldStore.getState().totalScanned).toBe(0);
    });
  });
});
