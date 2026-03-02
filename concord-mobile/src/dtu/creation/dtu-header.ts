// Concord Mobile — DTU Header Encoding/Decoding
// 48-byte binary header format for Data Transmission Units

import {
  DTU_HEADER_SIZE,
  DTU_VERSION,
  DTU_HEADER_OFFSETS,
  DTU_HASH_SIZE,
  DTU_MAX_CONTENT_SIZE,
  DTU_TYPES,
  DTU_FLAGS,
} from '../../utils/constants';
import type { DTUHeader, DTUTypeCode } from '../../utils/types';

// All valid type codes for validation
const VALID_TYPE_CODES: Set<number> = new Set(Object.values(DTU_TYPES));

// All valid flag bits OR'd together
const ALL_FLAGS_MASK =
  DTU_FLAGS.ENCRYPTED |
  DTU_FLAGS.COMPRESSED |
  DTU_FLAGS.SIGNED |
  DTU_FLAGS.PAIN_TAGGED |
  DTU_FLAGS.PRIORITY |
  DTU_FLAGS.GENESIS |
  DTU_FLAGS.RELAY;

/**
 * Encode a DTUHeader into a 48-byte Uint8Array.
 *
 * Layout:
 *   [0]      version       (uint8)
 *   [1]      flags         (uint8 bitfield)
 *   [2..3]   type          (uint16 big-endian)
 *   [4..11]  timestamp     (uint64 big-endian, written as two uint32s)
 *   [12..15] contentLength (uint32 big-endian)
 *   [16..47] contentHash   (32 bytes, SHA-256)
 */
export function encodeHeader(header: DTUHeader): Uint8Array {
  const buf = new Uint8Array(DTU_HEADER_SIZE);
  const view = new DataView(buf.buffer);

  // Version (1 byte)
  buf[DTU_HEADER_OFFSETS.VERSION] = header.version & 0xff;

  // Flags (1 byte)
  buf[DTU_HEADER_OFFSETS.FLAGS] = header.flags & 0xff;

  // Type (2 bytes, uint16 big-endian)
  view.setUint16(DTU_HEADER_OFFSETS.TYPE, header.type, false);

  // Timestamp (8 bytes, uint64 big-endian)
  // JavaScript numbers can safely represent timestamps up to 2^53-1.
  // We split into high 32 bits and low 32 bits.
  const timestampHigh = Math.floor(header.timestamp / 0x100000000) >>> 0;
  const timestampLow = (header.timestamp >>> 0) & 0xffffffff;
  view.setUint32(DTU_HEADER_OFFSETS.TIMESTAMP, timestampHigh, false);
  view.setUint32(DTU_HEADER_OFFSETS.TIMESTAMP + 4, timestampLow, false);

  // Content length (4 bytes, uint32 big-endian)
  view.setUint32(DTU_HEADER_OFFSETS.CONTENT_LENGTH, header.contentLength, false);

  // Content hash (32 bytes)
  if (header.contentHash.length !== DTU_HASH_SIZE) {
    throw new Error(
      `Content hash must be ${DTU_HASH_SIZE} bytes, got ${header.contentHash.length}`
    );
  }
  buf.set(header.contentHash, DTU_HEADER_OFFSETS.CONTENT_HASH);

  return buf;
}

/**
 * Decode a 48-byte Uint8Array into a DTUHeader.
 */
export function decodeHeader(bytes: Uint8Array): DTUHeader {
  if (bytes.length < DTU_HEADER_SIZE) {
    throw new Error(
      `Header must be at least ${DTU_HEADER_SIZE} bytes, got ${bytes.length}`
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const version = bytes[DTU_HEADER_OFFSETS.VERSION];
  const flags = bytes[DTU_HEADER_OFFSETS.FLAGS];
  const type = view.getUint16(DTU_HEADER_OFFSETS.TYPE, false) as DTUTypeCode;

  // Reconstruct 64-bit timestamp from two 32-bit halves
  const timestampHigh = view.getUint32(DTU_HEADER_OFFSETS.TIMESTAMP, false);
  const timestampLow = view.getUint32(DTU_HEADER_OFFSETS.TIMESTAMP + 4, false);
  const timestamp = timestampHigh * 0x100000000 + timestampLow;

  const contentLength = view.getUint32(DTU_HEADER_OFFSETS.CONTENT_LENGTH, false);

  const contentHash = new Uint8Array(DTU_HASH_SIZE);
  contentHash.set(
    bytes.slice(
      DTU_HEADER_OFFSETS.CONTENT_HASH,
      DTU_HEADER_OFFSETS.CONTENT_HASH + DTU_HASH_SIZE
    )
  );

  return { version, flags, type, timestamp, contentLength, contentHash };
}

/**
 * Validate a DTUHeader, returning a list of human-readable errors.
 */
export function validateHeader(header: DTUHeader): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Version check
  if (header.version !== DTU_VERSION) {
    errors.push(
      `Unsupported DTU version ${header.version}, expected ${DTU_VERSION}`
    );
  }

  // Type code check
  if (!VALID_TYPE_CODES.has(header.type)) {
    errors.push(`Unknown DTU type code 0x${header.type.toString(16).padStart(4, '0')}`);
  }

  // Flags – no unknown bits set
  if ((header.flags & ~ALL_FLAGS_MASK) !== 0) {
    errors.push(
      `Unknown flag bits set: 0x${(header.flags & ~ALL_FLAGS_MASK).toString(16).padStart(2, '0')}`
    );
  }

  // Timestamp sanity – must be positive and not absurdly in the future
  if (header.timestamp <= 0) {
    errors.push('Timestamp must be a positive number');
  } else {
    const fiveYearsFromNow = Date.now() + 5 * 365.25 * 24 * 60 * 60 * 1000;
    if (header.timestamp > fiveYearsFromNow) {
      errors.push('Timestamp is too far in the future');
    }
  }

  // Content length
  if (header.contentLength < 0 || header.contentLength > DTU_MAX_CONTENT_SIZE) {
    errors.push(
      `Content length ${header.contentLength} out of range (0..${DTU_MAX_CONTENT_SIZE})`
    );
  }

  // Content hash size
  if (header.contentHash.length !== DTU_HASH_SIZE) {
    errors.push(
      `Content hash must be ${DTU_HASH_SIZE} bytes, got ${header.contentHash.length}`
    );
  }

  return { valid: errors.length === 0, errors };
}
