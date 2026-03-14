// Concord Mobile — Cryptographic Utilities
// Wraps react-native-crypto for DTU integrity, identity, and mesh auth

// Platform-agnostic crypto interface for testability
export interface CryptoProvider {
  sha256(data: Uint8Array): Promise<Uint8Array>;
  hmacSha256(data: Uint8Array, key: Uint8Array): Promise<Uint8Array>;
  crc32(data: Uint8Array): number;
  randomBytes(size: number): Uint8Array;
  ed25519GenerateKeypair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>;
  ed25519Sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
  ed25519Verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
}

// CRC32 lookup table (IEEE polynomial)
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Hex encoding/decoding
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Base64 encoding/decoding
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += BASE64_CHARS[a >> 2];
    result += BASE64_CHARS[((a & 3) << 4) | (b >> 4)];
    result += (i + 1 < bytes.length) ? BASE64_CHARS[((b & 15) << 2) | (c >> 6)] : '=';
    result += (i + 2 < bytes.length) ? BASE64_CHARS[c & 63] : '=';
  }
  return result;
}

export function fromBase64(str: string): Uint8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }
  let padding = 0;
  if (str.endsWith('==')) padding = 2;
  else if (str.endsWith('=')) padding = 1;
  const length = (str.length * 3) / 4 - padding;
  const bytes = new Uint8Array(length);
  let j = 0;
  for (let i = 0; i < str.length; i += 4) {
    const a = lookup[str.charCodeAt(i)];
    const b = lookup[str.charCodeAt(i + 1)];
    const c = lookup[str.charCodeAt(i + 2)];
    const d = lookup[str.charCodeAt(i + 3)];
    bytes[j++] = (a << 2) | (b >> 4);
    if (j < length) bytes[j++] = ((b & 15) << 4) | (c >> 2);
    if (j < length) bytes[j++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

// Constant-time comparison to prevent timing attacks
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// Generate a random ID string
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Array.from(randomBytesSync(8))
    .map(b => b.toString(36))
    .join('');
  return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
}

// Synchronous random bytes fallback (uses Math.random if native crypto unavailable)
function randomBytesSync(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without Web Crypto
    for (let i = 0; i < size; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

// UTF-8 encode/decode
export function encodeUTF8(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

export function decodeUTF8(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// Uint8Array concatenation
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Default crypto provider using react-native-crypto
// This will be replaced with actual native module calls at runtime
let _provider: CryptoProvider | null = null;

export function setCryptoProvider(provider: CryptoProvider): void {
  _provider = provider;
}

export function getCryptoProvider(): CryptoProvider {
  if (!_provider) {
    throw new Error('CryptoProvider not initialized. Call setCryptoProvider() at app startup.');
  }
  return _provider;
}

// Convenience wrappers
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return getCryptoProvider().sha256(data);
}

export async function hmacSha256(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  return getCryptoProvider().hmacSha256(data, key);
}

export function randomBytes(size: number): Uint8Array {
  if (_provider) {
    return _provider.randomBytes(size);
  }
  return randomBytesSync(size);
}
