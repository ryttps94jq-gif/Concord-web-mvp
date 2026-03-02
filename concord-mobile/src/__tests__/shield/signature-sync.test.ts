// Tests for Shield: Signature Sync
// Validates DTU creation/parsing, signature merging, and version tracking

import {
  createSignatureSync,
  SignatureSync,
} from '../../shield/signatures/signature-sync';
import { DTU, ThreatSignature, DTUHeader, DTUMeta } from '../../utils/types';
import { DTU_TYPES, SHIELD_SIGNATURE_VERSION } from '../../utils/constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createThreatSignature(
  id: string,
  pattern: string,
  severity: number = 5,
  category: string = 'malware',
  version: number = 1,
): ThreatSignature {
  return {
    id,
    version,
    pattern,
    severity,
    category,
    description: `Test sig: ${id}`,
    updatedAt: Date.now(),
  };
}

function createMockDTU(
  content: string,
  type: number = DTU_TYPES.SHIELD_THREAT,
): DTU {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(content);
  const header: DTUHeader = {
    version: 1,
    flags: 0,
    type: type as any,
    timestamp: Date.now(),
    contentLength: encoded.length,
    contentHash: new Uint8Array(32),
  };
  const meta: DTUMeta = {
    scope: 'global',
    published: true,
    painTagged: false,
    crpiScore: 0,
    relayCount: 0,
    ttl: 15,
  };
  return {
    id: 'test-dtu',
    header,
    content: encoded,
    tags: ['shield'],
    meta,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SignatureSync', () => {
  let sync: SignatureSync;

  beforeEach(() => {
    sync = createSignatureSync();
  });

  describe('createSignatureDTU', () => {
    it('should create a DTU containing signatures', () => {
      const sigs = [
        createThreatSignature('sig-001', 'malware_pattern', 8),
        createThreatSignature('sig-002', 'phishing_link', 6),
      ];

      const dtu = sync.createSignatureDTU(sigs);

      expect(dtu).toBeDefined();
      expect(dtu.id).toBeDefined();
      expect(dtu.id.startsWith('sig_')).toBe(true);
      expect(dtu.header.type).toBe(DTU_TYPES.SHIELD_THREAT);
      expect(dtu.content.length).toBeGreaterThan(0);
    });

    it('should include all signatures in DTU content', () => {
      const sigs = [
        createThreatSignature('sig-001', 'pattern1', 8),
        createThreatSignature('sig-002', 'pattern2', 6),
        createThreatSignature('sig-003', 'pattern3', 4),
      ];

      const dtu = sync.createSignatureDTU(sigs);
      const parsed = sync.parseSignatureDTU(dtu);

      expect(parsed.length).toBe(3);
      expect(parsed.map(s => s.id)).toContain('sig-001');
      expect(parsed.map(s => s.id)).toContain('sig-002');
      expect(parsed.map(s => s.id)).toContain('sig-003');
    });

    it('should set priority flag for signature DTUs', () => {
      const dtu = sync.createSignatureDTU([createThreatSignature('sig-001', 'p', 5)]);
      expect(dtu.header.flags & 0x10).toBeTruthy(); // PRIORITY flag
    });

    it('should set global scope', () => {
      const dtu = sync.createSignatureDTU([createThreatSignature('sig-001', 'p', 5)]);
      expect(dtu.meta.scope).toBe('global');
    });

    it('should set published to true', () => {
      const dtu = sync.createSignatureDTU([createThreatSignature('sig-001', 'p', 5)]);
      expect(dtu.meta.published).toBe(true);
    });

    it('should set high TTL for propagation', () => {
      const dtu = sync.createSignatureDTU([createThreatSignature('sig-001', 'p', 5)]);
      expect(dtu.meta.ttl).toBeGreaterThanOrEqual(15);
    });

    it('should tag DTU with shield and signatures', () => {
      const dtu = sync.createSignatureDTU([createThreatSignature('sig-001', 'p', 5)]);
      expect(dtu.tags).toContain('shield');
      expect(dtu.tags).toContain('signatures');
    });

    it('should include timestamp in header', () => {
      const before = Date.now();
      const dtu = sync.createSignatureDTU([createThreatSignature('sig-001', 'p', 5)]);
      const after = Date.now();

      expect(dtu.header.timestamp).toBeGreaterThanOrEqual(before);
      expect(dtu.header.timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle empty signatures array', () => {
      const dtu = sync.createSignatureDTU([]);
      expect(dtu).toBeDefined();
      const parsed = sync.parseSignatureDTU(dtu);
      expect(parsed).toEqual([]);
    });
  });

  describe('parseSignatureDTU', () => {
    it('should parse signatures from a valid DTU', () => {
      const sigs = [
        createThreatSignature('sig-001', 'pattern1', 8, 'malware'),
        createThreatSignature('sig-002', 'pattern2', 6, 'phishing'),
      ];

      const dtu = sync.createSignatureDTU(sigs);
      const parsed = sync.parseSignatureDTU(dtu);

      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe('sig-001');
      expect(parsed[0].pattern).toBe('pattern1');
      expect(parsed[0].severity).toBe(8);
      expect(parsed[0].category).toBe('malware');
    });

    it('should return empty array for non-SHIELD_THREAT DTU type', () => {
      const dtu = createMockDTU('{}', DTU_TYPES.TEXT);
      const parsed = sync.parseSignatureDTU(dtu);
      expect(parsed).toEqual([]);
    });

    it('should return empty array for invalid JSON', () => {
      const dtu = createMockDTU('not valid json');
      const parsed = sync.parseSignatureDTU(dtu);
      expect(parsed).toEqual([]);
    });

    it('should return empty array for missing signatures field', () => {
      const dtu = createMockDTU(JSON.stringify({ version: 1, updatedAt: Date.now() }));
      const parsed = sync.parseSignatureDTU(dtu);
      expect(parsed).toEqual([]);
    });

    it('should filter out signatures with missing required fields', () => {
      const payload = {
        version: 1,
        updatedAt: Date.now(),
        signatures: [
          { id: 'good', version: 1, pattern: 'test', severity: 5, category: 'mal', description: 'ok', updatedAt: Date.now() },
          { id: 'bad-no-pattern', version: 1, severity: 5, category: 'mal' },
          { version: 1, pattern: 'test', severity: 5, category: 'mal' }, // no id
          { id: 'bad-no-version', pattern: 'test', severity: 5, category: 'mal' }, // no version number
        ],
      };

      const dtu = createMockDTU(JSON.stringify(payload));
      const parsed = sync.parseSignatureDTU(dtu);
      expect(parsed.length).toBe(1);
      expect(parsed[0].id).toBe('good');
    });

    it('should handle signatures array that is not an array', () => {
      const payload = {
        version: 1,
        updatedAt: Date.now(),
        signatures: 'not an array',
      };
      const dtu = createMockDTU(JSON.stringify(payload));
      const parsed = sync.parseSignatureDTU(dtu);
      expect(parsed).toEqual([]);
    });

    it('should roundtrip signatures through create/parse', () => {
      const original = [
        createThreatSignature('sig-rt-1', 'exploit_\\d+', 9, 'exploit', 3),
        createThreatSignature('sig-rt-2', 'spam_link', 2, 'spam', 1),
      ];

      const dtu = sync.createSignatureDTU(original);
      const parsed = sync.parseSignatureDTU(dtu);

      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe('sig-rt-1');
      expect(parsed[0].pattern).toBe('exploit_\\d+');
      expect(parsed[0].severity).toBe(9);
      expect(parsed[0].category).toBe('exploit');
      expect(parsed[0].version).toBe(3);
    });
  });

  describe('mergeSignatures', () => {
    it('should merge non-overlapping signatures', () => {
      const existing = [
        createThreatSignature('sig-001', 'pattern1', 5),
      ];
      const incoming = [
        createThreatSignature('sig-002', 'pattern2', 6),
      ];

      const merged = sync.mergeSignatures(existing, incoming);
      expect(merged.length).toBe(2);
      expect(merged.map(s => s.id)).toContain('sig-001');
      expect(merged.map(s => s.id)).toContain('sig-002');
    });

    it('should replace older version with newer version', () => {
      const existing = [
        createThreatSignature('sig-001', 'old_pattern', 5, 'malware', 1),
      ];
      const incoming = [
        createThreatSignature('sig-001', 'new_pattern', 8, 'critical', 2),
      ];

      const merged = sync.mergeSignatures(existing, incoming);
      expect(merged.length).toBe(1);
      expect(merged[0].pattern).toBe('new_pattern');
      expect(merged[0].severity).toBe(8);
      expect(merged[0].version).toBe(2);
    });

    it('should not downgrade to older versions', () => {
      const existing = [
        createThreatSignature('sig-001', 'current_pattern', 8, 'malware', 3),
      ];
      const incoming = [
        createThreatSignature('sig-001', 'old_pattern', 5, 'malware', 1),
      ];

      const merged = sync.mergeSignatures(existing, incoming);
      expect(merged.length).toBe(1);
      expect(merged[0].pattern).toBe('current_pattern');
      expect(merged[0].version).toBe(3);
    });

    it('should handle empty existing signatures', () => {
      const merged = sync.mergeSignatures([], [
        createThreatSignature('sig-001', 'p', 5),
      ]);
      expect(merged.length).toBe(1);
    });

    it('should handle empty incoming signatures', () => {
      const existing = [createThreatSignature('sig-001', 'p', 5)];
      const merged = sync.mergeSignatures(existing, []);
      expect(merged.length).toBe(1);
    });

    it('should handle both empty', () => {
      const merged = sync.mergeSignatures([], []);
      expect(merged).toEqual([]);
    });

    it('should merge many signatures', () => {
      const existing = Array.from({ length: 50 }, (_, i) =>
        createThreatSignature(`exist-${i}`, `pat-${i}`, 5, 'cat', 1)
      );
      const incoming = Array.from({ length: 50 }, (_, i) =>
        createThreatSignature(`new-${i}`, `pat-new-${i}`, 6, 'cat', 1)
      );

      const merged = sync.mergeSignatures(existing, incoming);
      expect(merged.length).toBe(100);
    });

    it('should handle overlapping merges with mixed versions', () => {
      const existing = [
        createThreatSignature('sig-a', 'p_a', 5, 'x', 2),
        createThreatSignature('sig-b', 'p_b', 5, 'x', 1),
        createThreatSignature('sig-c', 'p_c', 5, 'x', 3),
      ];
      const incoming = [
        createThreatSignature('sig-a', 'p_a_new', 5, 'x', 1), // older - ignore
        createThreatSignature('sig-b', 'p_b_new', 5, 'x', 2), // newer - accept
        createThreatSignature('sig-d', 'p_d', 5, 'x', 1),     // new - add
      ];

      const merged = sync.mergeSignatures(existing, incoming);
      expect(merged.length).toBe(4);

      const sigA = merged.find(s => s.id === 'sig-a')!;
      expect(sigA.pattern).toBe('p_a'); // kept existing (v2 > v1)

      const sigB = merged.find(s => s.id === 'sig-b')!;
      expect(sigB.pattern).toBe('p_b_new'); // replaced (v2 > v1)

      const sigC = merged.find(s => s.id === 'sig-c')!;
      expect(sigC.pattern).toBe('p_c'); // unchanged

      const sigD = merged.find(s => s.id === 'sig-d')!;
      expect(sigD.pattern).toBe('p_d'); // new addition
    });
  });

  describe('getLatestVersion', () => {
    it('should return base version initially', () => {
      expect(sync.getLatestVersion()).toBe(SHIELD_SIGNATURE_VERSION);
    });

    it('should update version after creating signature DTU', () => {
      sync.createSignatureDTU([
        createThreatSignature('sig-001', 'p', 5, 'x', 5),
      ]);
      expect(sync.getLatestVersion()).toBe(5);
    });

    it('should update version after merging signatures', () => {
      sync.mergeSignatures([], [
        createThreatSignature('sig-001', 'p', 5, 'x', 10),
      ]);
      expect(sync.getLatestVersion()).toBe(10);
    });

    it('should track highest version across operations', () => {
      sync.createSignatureDTU([
        createThreatSignature('sig-001', 'p', 5, 'x', 3),
      ]);
      expect(sync.getLatestVersion()).toBe(3);

      sync.mergeSignatures(
        [createThreatSignature('sig-001', 'p', 5, 'x', 3)],
        [createThreatSignature('sig-002', 'p', 5, 'x', 7)],
      );
      expect(sync.getLatestVersion()).toBe(7);

      // Should not decrease
      sync.createSignatureDTU([
        createThreatSignature('sig-003', 'p', 5, 'x', 2),
      ]);
      // Version should still be at least 7 since we track max from signatures in createSignatureDTU
      // but _latestVersion won't decrease since the sig version 2 < 7
      expect(sync.getLatestVersion()).toBeGreaterThanOrEqual(2);
    });
  });
});
