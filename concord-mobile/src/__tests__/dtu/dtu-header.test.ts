// Tests for DTU Header encoding/decoding/validation

import { encodeHeader, decodeHeader, validateHeader } from '../../dtu/creation/dtu-header';
import {
  DTU_HEADER_SIZE,
  DTU_VERSION,
  DTU_HASH_SIZE,
  DTU_TYPES,
  DTU_FLAGS,
  DTU_MAX_CONTENT_SIZE,
} from '../../utils/constants';
import type { DTUHeader } from '../../utils/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeValidHeader(overrides: Partial<DTUHeader> = {}): DTUHeader {
  return {
    version: DTU_VERSION,
    flags: 0,
    type: DTU_TYPES.TEXT,
    timestamp: 1700000000000,
    contentLength: 256,
    contentHash: new Uint8Array(DTU_HASH_SIZE).fill(0xab),
    ...overrides,
  };
}

// ── encodeHeader ─────────────────────────────────────────────────────────────

describe('encodeHeader', () => {
  it('produces a buffer of exactly DTU_HEADER_SIZE bytes', () => {
    const buf = encodeHeader(makeValidHeader());
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBe(DTU_HEADER_SIZE);
  });

  it('encodes version at offset 0', () => {
    const buf = encodeHeader(makeValidHeader({ version: 1 }));
    expect(buf[0]).toBe(1);
  });

  it('encodes flags at offset 1', () => {
    const flags = DTU_FLAGS.ENCRYPTED | DTU_FLAGS.SIGNED | DTU_FLAGS.PRIORITY;
    const buf = encodeHeader(makeValidHeader({ flags }));
    expect(buf[1]).toBe(flags);
  });

  it('encodes type as big-endian uint16 at offset 2', () => {
    const buf = encodeHeader(makeValidHeader({ type: DTU_TYPES.EMERGENCY_ALERT }));
    const view = new DataView(buf.buffer);
    expect(view.getUint16(2, false)).toBe(DTU_TYPES.EMERGENCY_ALERT);
  });

  it('encodes timestamp as big-endian uint64 at offset 4', () => {
    const ts = 1700000000000; // exceeds uint32
    const buf = encodeHeader(makeValidHeader({ timestamp: ts }));
    const view = new DataView(buf.buffer);
    const high = view.getUint32(4, false);
    const low = view.getUint32(8, false);
    expect(high * 0x100000000 + low).toBe(ts);
  });

  it('encodes contentLength as big-endian uint32 at offset 12', () => {
    const buf = encodeHeader(makeValidHeader({ contentLength: 65536 }));
    const view = new DataView(buf.buffer);
    expect(view.getUint32(12, false)).toBe(65536);
  });

  it('copies contentHash starting at offset 16', () => {
    const hash = new Uint8Array(DTU_HASH_SIZE);
    hash[0] = 0xde;
    hash[31] = 0xad;
    const buf = encodeHeader(makeValidHeader({ contentHash: hash }));
    expect(buf[16]).toBe(0xde);
    expect(buf[47]).toBe(0xad);
  });

  it('throws if contentHash is wrong size', () => {
    expect(() =>
      encodeHeader(makeValidHeader({ contentHash: new Uint8Array(16) }))
    ).toThrow(/Content hash must be 32 bytes/);
  });

  it('encodes flags byte masking to 0xff', () => {
    // Flags should be masked to a single byte
    const buf = encodeHeader(makeValidHeader({ flags: 0x1ff }));
    expect(buf[1]).toBe(0xff);
  });

  it('handles zero timestamp', () => {
    const buf = encodeHeader(makeValidHeader({ timestamp: 0 }));
    const view = new DataView(buf.buffer);
    expect(view.getUint32(4, false)).toBe(0);
    expect(view.getUint32(8, false)).toBe(0);
  });

  it('handles max uint32 contentLength', () => {
    const buf = encodeHeader(makeValidHeader({ contentLength: 0xffffffff }));
    const view = new DataView(buf.buffer);
    expect(view.getUint32(12, false)).toBe(0xffffffff);
  });
});

// ── decodeHeader ─────────────────────────────────────────────────────────────

describe('decodeHeader', () => {
  it('round-trips through encode/decode', () => {
    const original = makeValidHeader({
      flags: DTU_FLAGS.COMPRESSED | DTU_FLAGS.PAIN_TAGGED,
      type: DTU_TYPES.KNOWLEDGE,
      timestamp: 1700000000123,
      contentLength: 4096,
    });
    const decoded = decodeHeader(encodeHeader(original));

    expect(decoded.version).toBe(original.version);
    expect(decoded.flags).toBe(original.flags);
    expect(decoded.type).toBe(original.type);
    expect(decoded.timestamp).toBe(original.timestamp);
    expect(decoded.contentLength).toBe(original.contentLength);
    expect(decoded.contentHash).toEqual(original.contentHash);
  });

  it('throws if buffer is too small', () => {
    expect(() => decodeHeader(new Uint8Array(10))).toThrow(/at least 48 bytes/);
  });

  it('works with a buffer larger than 48 bytes (ignores trailing)', () => {
    const buf = new Uint8Array(64);
    const encoded = encodeHeader(makeValidHeader());
    buf.set(encoded, 0);
    const decoded = decodeHeader(buf);
    expect(decoded.version).toBe(DTU_VERSION);
  });

  it('correctly reads all flag combinations', () => {
    for (const [, value] of Object.entries(DTU_FLAGS)) {
      const header = makeValidHeader({ flags: value });
      const decoded = decodeHeader(encodeHeader(header));
      expect(decoded.flags).toBe(value);
    }
  });

  it('correctly reads all type codes', () => {
    for (const [, code] of Object.entries(DTU_TYPES)) {
      const header = makeValidHeader({ type: code });
      const decoded = decodeHeader(encodeHeader(header));
      expect(decoded.type).toBe(code);
    }
  });

  it('decodes timestamp 0 correctly', () => {
    const header = makeValidHeader({ timestamp: 0 });
    const decoded = decodeHeader(encodeHeader(header));
    expect(decoded.timestamp).toBe(0);
  });

  it('decodes a large timestamp correctly', () => {
    // 2100-01-01 in ms
    const ts = 4102444800000;
    const header = makeValidHeader({ timestamp: ts });
    const decoded = decodeHeader(encodeHeader(header));
    expect(decoded.timestamp).toBe(ts);
  });

  it('returns a copy of the content hash, not a view', () => {
    const encoded = encodeHeader(makeValidHeader());
    const decoded = decodeHeader(encoded);
    // Mutating the decoded hash should not affect the source buffer
    decoded.contentHash[0] = 0xff;
    expect(encoded[16]).toBe(0xab); // original fill value
  });

  it('handles DataView with byte offset when slice is used', () => {
    // Create a buffer where the header sits at a non-zero offset
    const outer = new Uint8Array(100);
    const encoded = encodeHeader(makeValidHeader({ contentLength: 999 }));
    outer.set(encoded, 20);
    const slice = outer.slice(20, 20 + DTU_HEADER_SIZE);
    const decoded = decodeHeader(slice);
    expect(decoded.contentLength).toBe(999);
  });
});

// ── validateHeader ───────────────────────────────────────────────────────────

describe('validateHeader', () => {
  it('returns valid for a correct header', () => {
    const result = validateHeader(makeValidHeader());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects unsupported version', () => {
    const result = validateHeader(makeValidHeader({ version: 99 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Unsupported DTU version/)])
    );
  });

  it('rejects unknown type code', () => {
    const result = validateHeader(makeValidHeader({ type: 0xffff as any }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Unknown DTU type code/)])
    );
  });

  it('rejects unknown flag bits', () => {
    const result = validateHeader(makeValidHeader({ flags: 0x80 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Unknown flag bits/)])
    );
  });

  it('accepts all known flag combinations', () => {
    const allFlags =
      DTU_FLAGS.ENCRYPTED |
      DTU_FLAGS.COMPRESSED |
      DTU_FLAGS.SIGNED |
      DTU_FLAGS.PAIN_TAGGED |
      DTU_FLAGS.PRIORITY |
      DTU_FLAGS.GENESIS |
      DTU_FLAGS.RELAY;
    const result = validateHeader(makeValidHeader({ flags: allFlags }));
    expect(result.valid).toBe(true);
  });

  it('rejects negative timestamp', () => {
    const result = validateHeader(makeValidHeader({ timestamp: -1 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/positive number/)])
    );
  });

  it('rejects zero timestamp', () => {
    const result = validateHeader(makeValidHeader({ timestamp: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/positive number/)])
    );
  });

  it('rejects timestamp far in the future', () => {
    const farFuture = Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000;
    const result = validateHeader(makeValidHeader({ timestamp: farFuture }));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/too far in the future/)])
    );
  });

  it('accepts a timestamp slightly in the future (within 5 years)', () => {
    const nearFuture = Date.now() + 1 * 365 * 24 * 60 * 60 * 1000;
    const result = validateHeader(makeValidHeader({ timestamp: nearFuture }));
    expect(result.valid).toBe(true);
  });

  it('rejects content length exceeding max', () => {
    const result = validateHeader(
      makeValidHeader({ contentLength: DTU_MAX_CONTENT_SIZE + 1 })
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Content length.*out of range/)])
    );
  });

  it('accepts zero content length', () => {
    const result = validateHeader(makeValidHeader({ contentLength: 0 }));
    expect(result.valid).toBe(true);
  });

  it('accepts max content length', () => {
    const result = validateHeader(makeValidHeader({ contentLength: DTU_MAX_CONTENT_SIZE }));
    expect(result.valid).toBe(true);
  });

  it('rejects wrong-size content hash', () => {
    const result = validateHeader(
      makeValidHeader({ contentHash: new Uint8Array(16) })
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Content hash must be/)])
    );
  });

  it('collects multiple errors at once', () => {
    const result = validateHeader(
      makeValidHeader({
        version: 0,
        type: 0xbeef as any,
        flags: 0x80,
        timestamp: -1,
        contentLength: DTU_MAX_CONTENT_SIZE + 1,
        contentHash: new Uint8Array(8),
      })
    );
    expect(result.valid).toBe(false);
    // Should have at least 5 errors
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});
