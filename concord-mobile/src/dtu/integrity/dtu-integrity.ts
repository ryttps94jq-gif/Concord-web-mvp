// Concord Mobile — DTU Integrity Verification
// Verifies DTU content hashes, header validity, signatures, and generates integrity envelopes

import {
  DTU_FLAGS,
} from '../../utils/constants';
import type { DTU } from '../../utils/types';
import { sha256, constantTimeEqual, toHex, getCryptoProvider, crc32 } from '../../utils/crypto';
import { encodeHeader, validateHeader as validateHeaderFields } from '../creation/dtu-header';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DTUIntegrityEnvelope {
  dtuId: string;
  contentHash: string;       // hex-encoded SHA-256 of content
  headerChecksum: number;    // CRC32 of the encoded 48-byte header
  signature?: string;        // hex-encoded signature
  signedBy?: string;         // hex-encoded public key
  isValid: boolean;
  verifiedAt: number;        // timestamp
}

export interface VerificationResult {
  valid: boolean;
  contentMatch: boolean;
  headerValid: boolean;
  signatureValid?: boolean;
  errors: string[];
}

// ── Generate integrity envelope ──────────────────────────────────────────────

/**
 * Generate an integrity envelope for a DTU.
 * The envelope summarises the hash, checksum, and optional signature
 * so that downstream consumers can quickly verify provenance.
 */
export async function generateIntegrity(dtu: DTU): Promise<DTUIntegrityEnvelope> {
  const contentHash = await sha256(dtu.content);
  const headerBytes = encodeHeader(dtu.header);
  const headerChecksum = crc32(headerBytes);

  const envelope: DTUIntegrityEnvelope = {
    dtuId: dtu.id,
    contentHash: toHex(contentHash),
    headerChecksum,
    isValid: true,
    verifiedAt: Date.now(),
  };

  if (dtu.signature) {
    envelope.signature = toHex(dtu.signature);
  }
  if (dtu.meta.creatorKey) {
    envelope.signedBy = dtu.meta.creatorKey;
  }

  return envelope;
}

// ── Full verification ────────────────────────────────────────────────────────

/**
 * Verify a DTU against its integrity envelope.
 */
export async function verifyIntegrity(
  dtu: DTU,
  envelope: DTUIntegrityEnvelope
): Promise<VerificationResult> {
  const errors: string[] = [];

  // 1. ID match
  if (dtu.id !== envelope.dtuId) {
    errors.push(`DTU ID mismatch: expected ${envelope.dtuId}, got ${dtu.id}`);
  }

  // 2. Content hash
  const contentMatch = await verifyContentHash(dtu);
  if (!contentMatch) {
    errors.push('Content hash does not match header');
  }

  // Verify content hash matches envelope
  const computedHash = await sha256(dtu.content);
  const envelopeHashMatch = toHex(computedHash) === envelope.contentHash;
  if (!envelopeHashMatch) {
    errors.push('Content hash does not match envelope');
  }

  // 3. Header validation
  const headerResult = verifyHeader(dtu);
  if (!headerResult.valid) {
    errors.push(...headerResult.errors);
  }

  // 4. Header checksum
  const headerBytes = encodeHeader(dtu.header);
  const headerChecksum = crc32(headerBytes);
  if (headerChecksum !== envelope.headerChecksum) {
    errors.push(
      `Header checksum mismatch: expected ${envelope.headerChecksum}, got ${headerChecksum}`
    );
  }

  // 5. Signature (optional)
  let signatureValid: boolean | undefined;
  if (dtu.header.flags & DTU_FLAGS.SIGNED) {
    if (!dtu.signature) {
      errors.push('DTU is marked as signed but has no signature');
      signatureValid = false;
    }
    // Signature verification is done externally via verifySignature if public key is available
  }

  const valid = errors.length === 0;

  return {
    valid,
    contentMatch: contentMatch && envelopeHashMatch,
    headerValid: headerResult.valid,
    signatureValid,
    errors,
  };
}

// ── Header verification ──────────────────────────────────────────────────────

/**
 * Verify that the DTU's header is structurally valid and consistent with the content.
 */
export function verifyHeader(dtu: DTU): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Structural validation
  const headerValidation = validateHeaderFields(dtu.header);
  if (!headerValidation.valid) {
    errors.push(...headerValidation.errors);
  }

  // Content length consistency
  if (dtu.header.contentLength !== dtu.content.length) {
    errors.push(
      `Header contentLength (${dtu.header.contentLength}) does not match actual content length (${dtu.content.length})`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ── Content hash verification ────────────────────────────────────────────────

/**
 * Verify that the SHA-256 of the content matches the hash stored in the header.
 */
export async function verifyContentHash(dtu: DTU): Promise<boolean> {
  const computed = await sha256(dtu.content);
  return constantTimeEqual(computed, dtu.header.contentHash);
}

// ── Signature verification ───────────────────────────────────────────────────

/**
 * Verify the Ed25519 signature of a DTU.
 * The signed message is the concatenation of the encoded header and content.
 */
export async function verifySignature(
  dtu: DTU,
  publicKey: Uint8Array
): Promise<boolean> {
  if (!dtu.signature) {
    return false;
  }

  const provider = getCryptoProvider();
  const headerBytes = encodeHeader(dtu.header);

  // The signed message is header || content
  const message = new Uint8Array(headerBytes.length + dtu.content.length);
  message.set(headerBytes, 0);
  message.set(dtu.content, headerBytes.length);

  return provider.ed25519Verify(message, dtu.signature, publicKey);
}
