// Concord Mobile — Shield: Content Scanner
// Scans DTUs for threats before lattice ingestion.
// Pattern matching against threat signatures.
// Performance target: 100 DTUs/second minimum.

import {
  DTU,
  ThreatSignature,
  ScanResult,
  ThreatMatch,
} from '../../utils/types';
import {
  SHIELD_SCAN_BATCH_SIZE,
  SHIELD_SIGNATURE_VERSION,
} from '../../utils/constants';

// ── Content Scanner Interface ────────────────────────────────────────────────

export interface ContentScanner {
  scan(dtu: DTU): ScanResult;
  scanBatch(dtus: DTU[]): ScanResult[];
  updateSignatures(signatures: ThreatSignature[]): void;
  getSignatureCount(): number;
  getSignatureVersion(): number;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createContentScanner(initialSignatures?: ThreatSignature[]): ContentScanner {
  let _signatures: ThreatSignature[] = initialSignatures ? [...initialSignatures] : [];
  let _signatureVersion = SHIELD_SIGNATURE_VERSION;
  // Pre-compiled regex cache for performance
  let _compiledPatterns: Map<string, RegExp> = new Map();

  // Build regex cache from current signatures
  function rebuildPatternCache(): void {
    _compiledPatterns = new Map();
    for (const sig of _signatures) {
      try {
        _compiledPatterns.set(sig.id, new RegExp(sig.pattern, 'gi'));
      } catch {
        // Invalid pattern — skip but log
        // In production this would go to a logger
      }
    }
  }

  // Initialize pattern cache
  rebuildPatternCache();

  function contentToString(content: Uint8Array): string {
    try {
      const decoder = new TextDecoder();
      return decoder.decode(content);
    } catch {
      // Binary content — convert to hex for pattern matching
      return Array.from(content).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }

  function scan(dtu: DTU): ScanResult {
    const startTime = performance.now();
    const threats: ThreatMatch[] = [];
    const contentStr = contentToString(dtu.content);

    for (const sig of _signatures) {
      const pattern = _compiledPatterns.get(sig.id);
      if (!pattern) continue;

      // Reset regex state for reuse
      pattern.lastIndex = 0;
      const match = pattern.exec(contentStr);

      if (match) {
        threats.push({
          signatureId: sig.id,
          severity: sig.severity,
          category: sig.category,
          matchLocation: match.index,
          confidence: calculateConfidence(sig, match[0], contentStr),
        });
      }
    }

    const scanDurationMs = performance.now() - startTime;

    return {
      dtuId: dtu.id,
      clean: threats.length === 0,
      threats,
      scannedAt: Date.now(),
      scanDurationMs,
    };
  }

  function scanBatch(dtus: DTU[]): ScanResult[] {
    const results: ScanResult[] = [];

    // Process in batches of SHIELD_SCAN_BATCH_SIZE
    for (let i = 0; i < dtus.length; i += SHIELD_SCAN_BATCH_SIZE) {
      const batch = dtus.slice(i, i + SHIELD_SCAN_BATCH_SIZE);
      for (const dtu of batch) {
        results.push(scan(dtu));
      }
    }

    return results;
  }

  function updateSignatures(signatures: ThreatSignature[]): void {
    // Merge: newer versions replace older ones, new signatures are added
    const sigMap = new Map<string, ThreatSignature>();
    for (const existing of _signatures) {
      sigMap.set(existing.id, existing);
    }
    for (const incoming of signatures) {
      const existing = sigMap.get(incoming.id);
      if (!existing || incoming.version > existing.version) {
        sigMap.set(incoming.id, incoming);
      }
    }

    _signatures = Array.from(sigMap.values());

    // Update version to the highest signature version
    _signatureVersion = _signatures.reduce(
      (max, sig) => Math.max(max, sig.version),
      SHIELD_SIGNATURE_VERSION
    );

    rebuildPatternCache();
  }

  function getSignatureCount(): number {
    return _signatures.length;
  }

  function getSignatureVersion(): number {
    return _signatureVersion;
  }

  return {
    scan,
    scanBatch,
    updateSignatures,
    getSignatureCount,
    getSignatureVersion,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calculateConfidence(
  signature: ThreatSignature,
  matchedText: string,
  fullContent: string,
): number {
  // Confidence based on:
  // 1. Match length relative to pattern (longer matches = higher confidence)
  // 2. Severity of the signature (higher severity = higher base confidence)
  const lengthRatio = Math.min(matchedText.length / Math.max(fullContent.length, 1), 1);
  const severityFactor = signature.severity / 10;
  const baseConfidence = 0.5 + (severityFactor * 0.3) + (lengthRatio * 0.2);
  return Math.min(Math.round(baseConfidence * 100) / 100, 1.0);
}
