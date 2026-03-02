// Concord Mobile — Shield: Signature Sync
// Syncs threat signatures over the mesh network.
// Signatures are distributed as DTUs, enabling offline threat detection updates
// through peer-to-peer propagation.

import {
  DTU,
  DTUHeader,
  DTUMeta,
  ThreatSignature,
} from '../../utils/types';
import {
  DTU_VERSION,
  DTU_TYPES,
  DTU_FLAGS,
  SHIELD_SIGNATURE_VERSION,
} from '../../utils/constants';
import { generateId } from '../../utils/crypto';

// ── Signature Sync Interface ─────────────────────────────────────────────────

export interface SignatureSync {
  createSignatureDTU(signatures: ThreatSignature[]): DTU;
  parseSignatureDTU(dtu: DTU): ThreatSignature[];
  mergeSignatures(existing: ThreatSignature[], incoming: ThreatSignature[]): ThreatSignature[];
  getLatestVersion(): number;
}

// ── Signature DTU Content Format ─────────────────────────────────────────────
// Signatures are serialized as JSON with a version envelope:
// {
//   version: number,
//   updatedAt: number,
//   signatures: ThreatSignature[]
// }

interface SignaturePayload {
  version: number;
  updatedAt: number;
  signatures: ThreatSignature[];
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createSignatureSync(): SignatureSync {
  let _latestVersion = SHIELD_SIGNATURE_VERSION;

  function createSignatureDTU(signatures: ThreatSignature[]): DTU {
    const payload: SignaturePayload = {
      version: _latestVersion,
      updatedAt: Date.now(),
      signatures,
    };

    const encoder = new TextEncoder();
    const content = encoder.encode(JSON.stringify(payload));

    // Update local version tracking
    const maxSigVersion = signatures.reduce(
      (max, sig) => Math.max(max, sig.version),
      _latestVersion
    );
    _latestVersion = maxSigVersion;

    const header: DTUHeader = {
      version: DTU_VERSION,
      flags: DTU_FLAGS.PRIORITY,
      type: DTU_TYPES.SHIELD_THREAT,
      timestamp: Date.now(),
      contentLength: content.length,
      contentHash: new Uint8Array(32), // Would be computed by DTUForge in production
    };

    const meta: DTUMeta = {
      scope: 'global',
      published: true,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: 15, // High TTL for signature propagation
    };

    return {
      id: generateId('sig'),
      header,
      content,
      tags: ['shield', 'signatures', 'threat-db'],
      meta,
    };
  }

  function parseSignatureDTU(dtu: DTU): ThreatSignature[] {
    if (dtu.header.type !== DTU_TYPES.SHIELD_THREAT) {
      return [];
    }

    try {
      const decoder = new TextDecoder();
      const jsonStr = decoder.decode(dtu.content);
      const payload: SignaturePayload = JSON.parse(jsonStr);

      if (!payload.signatures || !Array.isArray(payload.signatures)) {
        return [];
      }

      // Validate each signature has required fields
      return payload.signatures.filter(sig =>
        sig.id &&
        typeof sig.version === 'number' &&
        typeof sig.pattern === 'string' &&
        typeof sig.severity === 'number' &&
        typeof sig.category === 'string'
      );
    } catch {
      return [];
    }
  }

  function mergeSignatures(
    existing: ThreatSignature[],
    incoming: ThreatSignature[],
  ): ThreatSignature[] {
    const merged = new Map<string, ThreatSignature>();

    // Add all existing signatures
    for (const sig of existing) {
      merged.set(sig.id, sig);
    }

    // Merge incoming: only accept newer versions
    for (const sig of incoming) {
      const current = merged.get(sig.id);
      if (!current || sig.version > current.version) {
        merged.set(sig.id, sig);
      }
    }

    const result = Array.from(merged.values());

    // Update latest version
    _latestVersion = result.reduce(
      (max, sig) => Math.max(max, sig.version),
      _latestVersion
    );

    return result;
  }

  function getLatestVersion(): number {
    return _latestVersion;
  }

  return {
    createSignatureDTU,
    parseSignatureDTU,
    mergeSignatures,
    getLatestVersion,
  };
}
