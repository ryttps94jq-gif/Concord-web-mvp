// Tests for Shield: Content Scanner
// Validates threat detection, batch scanning, signature management, and performance

import {
  createContentScanner,
  ContentScanner,
} from '../../shield/scanner/content-scanner';
import { DTU, ThreatSignature, DTUHeader, DTUMeta } from '../../utils/types';
import { SHIELD_SCAN_BATCH_SIZE, SHIELD_SIGNATURE_VERSION } from '../../utils/constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockDTU(id: string, content: string): DTU {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(content);
  const header: DTUHeader = {
    version: 1,
    flags: 0,
    type: 0x000E,
    timestamp: Date.now(),
    contentLength: encoded.length,
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
    content: encoded,
    tags: ['test'],
    meta,
  };
}

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
    description: `Test threat: ${id}`,
    updatedAt: Date.now(),
  };
}

// Mock performance.now if not available in test env
if (typeof performance === 'undefined') {
  (global as any).performance = {
    now: () => Date.now(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ContentScanner', () => {
  let scanner: ContentScanner;
  let signatures: ThreatSignature[];

  beforeEach(() => {
    signatures = [
      createThreatSignature('sig-001', 'malicious_payload', 8, 'malware'),
      createThreatSignature('sig-002', 'phishing_link', 6, 'phishing'),
      createThreatSignature('sig-003', 'exploit_code_\\d+', 9, 'exploit'),
      createThreatSignature('sig-004', 'spam_content', 3, 'spam'),
    ];
    scanner = createContentScanner(signatures);
  });

  describe('scan', () => {
    it('should return clean result for safe content', () => {
      const dtu = createMockDTU('dtu-001', 'This is perfectly safe sensor data');
      const result = scanner.scan(dtu);

      expect(result.clean).toBe(true);
      expect(result.threats.length).toBe(0);
      expect(result.dtuId).toBe('dtu-001');
      expect(result.scannedAt).toBeGreaterThan(0);
      expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should detect threat matching a signature pattern', () => {
      const dtu = createMockDTU('dtu-002', 'data contains malicious_payload here');
      const result = scanner.scan(dtu);

      expect(result.clean).toBe(false);
      expect(result.threats.length).toBe(1);
      expect(result.threats[0].signatureId).toBe('sig-001');
      expect(result.threats[0].severity).toBe(8);
      expect(result.threats[0].category).toBe('malware');
    });

    it('should detect multiple threats in one DTU', () => {
      const dtu = createMockDTU('dtu-003', 'malicious_payload with phishing_link content');
      const result = scanner.scan(dtu);

      expect(result.clean).toBe(false);
      expect(result.threats.length).toBe(2);
      const sigIds = result.threats.map(t => t.signatureId);
      expect(sigIds).toContain('sig-001');
      expect(sigIds).toContain('sig-002');
    });

    it('should detect regex-based patterns', () => {
      const dtu = createMockDTU('dtu-004', 'contains exploit_code_12345 in data');
      const result = scanner.scan(dtu);

      expect(result.clean).toBe(false);
      expect(result.threats.length).toBe(1);
      expect(result.threats[0].signatureId).toBe('sig-003');
      expect(result.threats[0].severity).toBe(9);
    });

    it('should report match location', () => {
      const content = 'prefix_malicious_payload_suffix';
      const dtu = createMockDTU('dtu-005', content);
      const result = scanner.scan(dtu);

      expect(result.threats[0].matchLocation).toBe(7); // index of 'malicious_payload'
    });

    it('should calculate confidence score', () => {
      const dtu = createMockDTU('dtu-006', 'malicious_payload');
      const result = scanner.scan(dtu);

      expect(result.threats[0].confidence).toBeGreaterThan(0);
      expect(result.threats[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should be case-insensitive', () => {
      const dtu = createMockDTU('dtu-007', 'MALICIOUS_PAYLOAD detected');
      const result = scanner.scan(dtu);

      expect(result.clean).toBe(false);
      expect(result.threats[0].signatureId).toBe('sig-001');
    });

    it('should handle empty content', () => {
      const dtu = createMockDTU('dtu-008', '');
      const result = scanner.scan(dtu);

      expect(result.clean).toBe(true);
      expect(result.threats.length).toBe(0);
    });

    it('should handle binary content', () => {
      const dtu = createMockDTU('dtu-009', 'safe data');
      // Replace content with binary data
      dtu.content = new Uint8Array([0x00, 0xFF, 0x80, 0x7F, 0x01]);

      const result = scanner.scan(dtu);
      // Should not crash on binary content
      expect(result.dtuId).toBe('dtu-009');
      expect(result.scannedAt).toBeGreaterThan(0);
    });

    it('should record scan duration', () => {
      const dtu = createMockDTU('dtu-010', 'some content');
      const result = scanner.scan(dtu);

      expect(typeof result.scanDurationMs).toBe('number');
      expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scanBatch', () => {
    it('should scan multiple DTUs', () => {
      const dtus = [
        createMockDTU('batch-001', 'safe content'),
        createMockDTU('batch-002', 'has malicious_payload'),
        createMockDTU('batch-003', 'also safe'),
      ];

      const results = scanner.scanBatch(dtus);

      expect(results.length).toBe(3);
      expect(results[0].clean).toBe(true);
      expect(results[1].clean).toBe(false);
      expect(results[2].clean).toBe(true);
    });

    it('should handle empty batch', () => {
      const results = scanner.scanBatch([]);
      expect(results).toEqual([]);
    });

    it('should process batches of SHIELD_SCAN_BATCH_SIZE', () => {
      const dtus = Array.from({ length: SHIELD_SCAN_BATCH_SIZE + 10 }, (_, i) =>
        createMockDTU(`batch-${i}`, 'safe data')
      );

      const results = scanner.scanBatch(dtus);
      expect(results.length).toBe(SHIELD_SCAN_BATCH_SIZE + 10);
    });

    it('should process 100 DTUs without performance issues', () => {
      const dtus = Array.from({ length: 100 }, (_, i) =>
        createMockDTU(`perf-${i}`, `sensor data reading ${i} with some content`)
      );

      const startTime = Date.now();
      const results = scanner.scanBatch(dtus);
      const elapsed = Date.now() - startTime;

      expect(results.length).toBe(100);
      // Should complete in under 1000ms (100 DTUs/second minimum)
      expect(elapsed).toBeLessThan(1000);
    });

    it('should correctly identify threats in batch', () => {
      const dtus = [
        createMockDTU('b-1', 'safe'),
        createMockDTU('b-2', 'malicious_payload here'),
        createMockDTU('b-3', 'phishing_link detected'),
        createMockDTU('b-4', 'exploit_code_999'),
        createMockDTU('b-5', 'also safe'),
      ];

      const results = scanner.scanBatch(dtus);
      expect(results[0].clean).toBe(true);
      expect(results[1].clean).toBe(false);
      expect(results[2].clean).toBe(false);
      expect(results[3].clean).toBe(false);
      expect(results[4].clean).toBe(true);
    });

    it('should preserve DTU IDs in scan results', () => {
      const dtus = [
        createMockDTU('id-aaa', 'content 1'),
        createMockDTU('id-bbb', 'content 2'),
      ];

      const results = scanner.scanBatch(dtus);
      expect(results[0].dtuId).toBe('id-aaa');
      expect(results[1].dtuId).toBe('id-bbb');
    });
  });

  describe('updateSignatures', () => {
    it('should add new signatures', () => {
      expect(scanner.getSignatureCount()).toBe(4);

      scanner.updateSignatures([
        createThreatSignature('sig-005', 'new_threat', 7, 'new_cat'),
      ]);

      expect(scanner.getSignatureCount()).toBe(5);
    });

    it('should update existing signatures with newer versions', () => {
      scanner.updateSignatures([
        createThreatSignature('sig-001', 'updated_pattern', 10, 'critical', 2),
      ]);

      expect(scanner.getSignatureCount()).toBe(4); // same count, updated in place

      // Verify the pattern was updated
      const dtu = createMockDTU('test', 'updated_pattern found');
      const result = scanner.scan(dtu);
      expect(result.clean).toBe(false);
      expect(result.threats[0].signatureId).toBe('sig-001');
      expect(result.threats[0].severity).toBe(10);
    });

    it('should not downgrade signatures to older versions', () => {
      // Current signatures are version 1
      scanner.updateSignatures([
        createThreatSignature('sig-001', 'should_not_replace', 1, 'malware', 0),
      ]);

      // Original pattern should still work
      const dtu = createMockDTU('test', 'malicious_payload here');
      const result = scanner.scan(dtu);
      expect(result.clean).toBe(false);
      expect(result.threats[0].signatureId).toBe('sig-001');
    });

    it('should update signature version number', () => {
      expect(scanner.getSignatureVersion()).toBe(SHIELD_SIGNATURE_VERSION);

      scanner.updateSignatures([
        createThreatSignature('sig-010', 'pattern', 5, 'cat', 5),
      ]);

      expect(scanner.getSignatureVersion()).toBe(5);
    });

    it('should handle invalid regex patterns gracefully', () => {
      // This should not throw
      scanner.updateSignatures([
        createThreatSignature('sig-bad', '([invalid', 5, 'bad'),
      ]);

      expect(scanner.getSignatureCount()).toBe(5);

      // Scanner should still work for valid patterns
      const dtu = createMockDTU('test', 'malicious_payload');
      const result = scanner.scan(dtu);
      expect(result.clean).toBe(false);
    });

    it('should rebuild pattern cache on update', () => {
      // Add new signature
      scanner.updateSignatures([
        createThreatSignature('sig-new', 'brand_new_threat', 7, 'new'),
      ]);

      // New pattern should be detected
      const dtu = createMockDTU('test', 'found brand_new_threat here');
      const result = scanner.scan(dtu);
      expect(result.clean).toBe(false);
      expect(result.threats[0].signatureId).toBe('sig-new');
    });
  });

  describe('getSignatureCount', () => {
    it('should return initial signature count', () => {
      expect(scanner.getSignatureCount()).toBe(4);
    });

    it('should return 0 when no signatures', () => {
      const empty = createContentScanner();
      expect(empty.getSignatureCount()).toBe(0);
    });

    it('should update after adding signatures', () => {
      scanner.updateSignatures([
        createThreatSignature('sig-a', 'a', 1, 'x'),
        createThreatSignature('sig-b', 'b', 1, 'x'),
      ]);
      expect(scanner.getSignatureCount()).toBe(6);
    });
  });

  describe('getSignatureVersion', () => {
    it('should return base version initially', () => {
      expect(scanner.getSignatureVersion()).toBe(SHIELD_SIGNATURE_VERSION);
    });

    it('should return highest version after updates', () => {
      scanner.updateSignatures([
        createThreatSignature('sig-v3', 'pat', 1, 'x', 3),
        createThreatSignature('sig-v7', 'pat2', 1, 'x', 7),
      ]);
      expect(scanner.getSignatureVersion()).toBe(7);
    });
  });

  describe('scanner with no signatures', () => {
    it('should mark all DTUs as clean', () => {
      const emptyScanner = createContentScanner();
      const dtu = createMockDTU('test', 'any content including malicious_payload');
      const result = emptyScanner.scan(dtu);

      expect(result.clean).toBe(true);
      expect(result.threats.length).toBe(0);
    });

    it('should work after adding signatures later', () => {
      const emptyScanner = createContentScanner();
      emptyScanner.updateSignatures([
        createThreatSignature('sig-late', 'dangerous', 8, 'malware'),
      ]);

      const dtu = createMockDTU('test', 'dangerous content here');
      const result = emptyScanner.scan(dtu);
      expect(result.clean).toBe(false);
    });
  });

  describe('performance', () => {
    it('should scan 100 DTUs in under 1 second', () => {
      const dtus = Array.from({ length: 100 }, (_, i) =>
        createMockDTU(`perf-${i}`, `This is a normal sensor reading number ${i} with temperature 22.${i} and humidity 55.${i}`)
      );

      const start = Date.now();
      const results = scanner.scanBatch(dtus);
      const elapsed = Date.now() - start;

      expect(results.length).toBe(100);
      expect(elapsed).toBeLessThan(1000);
      // All should be clean since content doesn't match signatures
      expect(results.every(r => r.clean)).toBe(true);
    });

    it('should handle large DTU content efficiently', () => {
      const largeContent = 'a'.repeat(10000) + 'malicious_payload' + 'b'.repeat(10000);
      const dtu = createMockDTU('large', largeContent);

      const start = Date.now();
      const result = scanner.scan(dtu);
      const elapsed = Date.now() - start;

      expect(result.clean).toBe(false);
      expect(elapsed).toBeLessThan(100); // single scan should be fast
    });

    it('should handle many signatures efficiently', () => {
      const manySignatures = Array.from({ length: 200 }, (_, i) =>
        createThreatSignature(`perf-sig-${i}`, `threat_pattern_${i}`, 5, 'test')
      );
      const bigScanner = createContentScanner(manySignatures);

      const dtu = createMockDTU('test', 'safe content');
      const start = Date.now();
      const result = bigScanner.scan(dtu);
      const elapsed = Date.now() - start;

      expect(result.clean).toBe(true);
      expect(elapsed).toBeLessThan(100);
    });
  });
});
