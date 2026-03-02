// Tests for crypto.ts

import {
  crc32,
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  constantTimeEqual,
  generateId,
  encodeUTF8,
  decodeUTF8,
  concatBytes,
} from '../../utils/crypto';

describe('crypto utilities', () => {
  describe('crc32', () => {
    test('computes CRC32 of empty input', () => {
      const result = crc32(new Uint8Array(0));
      expect(result).toBe(0);
    });

    test('computes CRC32 of known input', () => {
      const data = encodeUTF8('hello');
      const result = crc32(data);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    test('same input produces same hash', () => {
      const data = encodeUTF8('test data');
      expect(crc32(data)).toBe(crc32(data));
    });

    test('different input produces different hash', () => {
      const a = crc32(encodeUTF8('hello'));
      const b = crc32(encodeUTF8('world'));
      expect(a).not.toBe(b);
    });

    test('returns unsigned 32-bit integer', () => {
      const result = crc32(encodeUTF8('test'));
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
    });
  });

  describe('hex encoding', () => {
    test('toHex encodes bytes to hex string', () => {
      const bytes = new Uint8Array([0, 1, 15, 16, 255]);
      expect(toHex(bytes)).toBe('00010f10ff');
    });

    test('fromHex decodes hex string to bytes', () => {
      const bytes = fromHex('00010f10ff');
      expect(Array.from(bytes)).toEqual([0, 1, 15, 16, 255]);
    });

    test('round-trip preserves data', () => {
      const original = new Uint8Array([10, 20, 30, 40, 50]);
      const roundTripped = fromHex(toHex(original));
      expect(Array.from(roundTripped)).toEqual(Array.from(original));
    });

    test('toHex handles empty input', () => {
      expect(toHex(new Uint8Array(0))).toBe('');
    });

    test('fromHex handles empty input', () => {
      expect(fromHex('').length).toBe(0);
    });

    test('toHex pads single digit values', () => {
      expect(toHex(new Uint8Array([0]))).toBe('00');
      expect(toHex(new Uint8Array([9]))).toBe('09');
    });
  });

  describe('base64 encoding', () => {
    test('round-trip preserves data', () => {
      const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = toBase64(original);
      const decoded = fromBase64(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    test('toBase64 produces standard base64', () => {
      const data = encodeUTF8('Hello');
      const encoded = toBase64(data);
      expect(encoded).toBe('SGVsbG8=');
    });

    test('handles padding correctly', () => {
      // 1 byte → 4 chars with ==
      expect(toBase64(new Uint8Array([65]))).toBe('QQ==');
      // 2 bytes → 4 chars with =
      expect(toBase64(new Uint8Array([65, 66]))).toBe('QUI=');
      // 3 bytes → 4 chars, no padding
      expect(toBase64(new Uint8Array([65, 66, 67]))).toBe('QUJD');
    });

    test('handles empty input', () => {
      expect(toBase64(new Uint8Array(0))).toBe('');
    });

    test('round-trip with 48-byte DTU header size', () => {
      const header = new Uint8Array(48);
      for (let i = 0; i < 48; i++) header[i] = i;
      const decoded = fromBase64(toBase64(header));
      expect(Array.from(decoded)).toEqual(Array.from(header));
    });

    test('round-trip with large data', () => {
      const data = new Uint8Array(1024);
      for (let i = 0; i < 1024; i++) data[i] = i % 256;
      const decoded = fromBase64(toBase64(data));
      expect(Array.from(decoded)).toEqual(Array.from(data));
    });
  });

  describe('constantTimeEqual', () => {
    test('returns true for identical arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      expect(constantTimeEqual(a, b)).toBe(true);
    });

    test('returns false for different arrays', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      expect(constantTimeEqual(a, b)).toBe(false);
    });

    test('returns false for different lengths', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2]);
      expect(constantTimeEqual(a, b)).toBe(false);
    });

    test('returns true for empty arrays', () => {
      expect(constantTimeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
    });

    test('handles 32-byte hash comparison', () => {
      const a = new Uint8Array(32).fill(42);
      const b = new Uint8Array(32).fill(42);
      expect(constantTimeEqual(a, b)).toBe(true);

      b[31] = 43;
      expect(constantTimeEqual(a, b)).toBe(false);
    });
  });

  describe('generateId', () => {
    test('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    test('includes prefix when provided', () => {
      const id = generateId('dtu');
      expect(id.startsWith('dtu_')).toBe(true);
    });

    test('no prefix produces bare ID', () => {
      const id = generateId();
      expect(id).not.toContain('undefined');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('UTF-8 encoding', () => {
    test('round-trip preserves ASCII', () => {
      const text = 'Hello, World!';
      expect(decodeUTF8(encodeUTF8(text))).toBe(text);
    });

    test('round-trip preserves Unicode', () => {
      const text = 'Hello 🌍 Wörld';
      expect(decodeUTF8(encodeUTF8(text))).toBe(text);
    });

    test('handles empty string', () => {
      expect(decodeUTF8(encodeUTF8(''))).toBe('');
    });

    test('handles special characters', () => {
      const text = 'x² + y² = z²\n\tindented\r\n"quoted"';
      expect(decodeUTF8(encodeUTF8(text))).toBe(text);
    });
  });

  describe('concatBytes', () => {
    test('concatenates multiple arrays', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5]);
      const result = concatBytes(a, b, c);
      expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
    });

    test('handles empty arrays', () => {
      const a = new Uint8Array(0);
      const b = new Uint8Array([1, 2]);
      expect(Array.from(concatBytes(a, b))).toEqual([1, 2]);
    });

    test('handles single array', () => {
      const a = new Uint8Array([1, 2, 3]);
      expect(Array.from(concatBytes(a))).toEqual([1, 2, 3]);
    });

    test('handles no arrays', () => {
      expect(concatBytes().length).toBe(0);
    });

    test('produces correct total length', () => {
      const a = new Uint8Array(10);
      const b = new Uint8Array(20);
      const c = new Uint8Array(30);
      expect(concatBytes(a, b, c).length).toBe(60);
    });
  });
});
