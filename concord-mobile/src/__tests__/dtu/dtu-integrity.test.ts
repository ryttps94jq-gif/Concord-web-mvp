// Tests for DTU Integrity verification

import {
  generateIntegrity,
  verifyIntegrity,
  verifyHeader,
  verifyContentHash,
  verifySignature,
  DTUIntegrityEnvelope,
} from '../../dtu/integrity/dtu-integrity';
import {
  DTU_VERSION,
  DTU_FLAGS,
  DTU_TYPES,
  DTU_HEADER_SIZE,
  DEFAULT_DTU_TTL,
} from '../../utils/constants';
import { setCryptoProvider, toHex, crc32 } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import { encodeHeader } from '../../dtu/creation/dtu-header';
import type { DTU, DTUHeader, DTUMeta } from '../../utils/types';

// ── Mock crypto ──────────────────────────────────────────────────────────────

// Deterministic mock: sha256 returns the xor-fill of input
const mockSha256 = jest.fn(async (data: Uint8Array) => {
  const xor = data.reduce((a, b) => a ^ b, 0);
  return new Uint8Array(32).fill(xor);
});

const mockEd25519Verify = jest.fn(async () => true);

const mockCryptoProvider: CryptoProvider = {
  sha256: mockSha256,
  hmacSha256: jest.fn(async () => new Uint8Array(32).fill(0xaa)),
  crc32: jest.fn(() => 0x12345678),
  randomBytes: jest.fn((size) => new Uint8Array(size).fill(0x42)),
  ed25519GenerateKeypair: jest.fn(async () => ({
    publicKey: new Uint8Array(32).fill(0x01),
    privateKey: new Uint8Array(64).fill(0x02),
  })),
  ed25519Sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
  ed25519Verify: mockEd25519Verify,
};

beforeAll(() => {
  setCryptoProvider(mockCryptoProvider);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContentHash(content: Uint8Array): Uint8Array {
  // Mirror mock sha256 behavior
  const xor = content.reduce((a, b) => a ^ b, 0);
  return new Uint8Array(32).fill(xor);
}

function makeValidDTU(overrides: Partial<DTU> = {}): DTU {
  const content = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
  const contentHash = makeContentHash(content);
  const header: DTUHeader = {
    version: DTU_VERSION,
    flags: 0,
    type: DTU_TYPES.TEXT,
    timestamp: Date.now(),
    contentLength: content.length,
    contentHash,
  };
  const meta: DTUMeta = {
    scope: 'local',
    published: false,
    painTagged: false,
    crpiScore: 0,
    relayCount: 0,
    ttl: DEFAULT_DTU_TTL,
  };
  return {
    id: 'dtu_test_001',
    header,
    content,
    tags: ['test'],
    meta,
    lineage: { parentId: null, ancestors: [], depth: 0 },
    ...overrides,
  };
}

async function makeValidEnvelope(dtu: DTU): Promise<DTUIntegrityEnvelope> {
  const computedHash = makeContentHash(dtu.content);
  const headerBytes = encodeHeader(dtu.header);
  const checksum = crc32(headerBytes);

  return {
    dtuId: dtu.id,
    contentHash: toHex(computedHash),
    headerChecksum: checksum,
    isValid: true,
    verifiedAt: Date.now(),
  };
}

// ── generateIntegrity ────────────────────────────────────────────────────────

describe('generateIntegrity', () => {
  it('generates an envelope with matching dtuId', async () => {
    const dtu = makeValidDTU();
    const envelope = await generateIntegrity(dtu);
    expect(envelope.dtuId).toBe(dtu.id);
  });

  it('computes contentHash via sha256', async () => {
    const dtu = makeValidDTU();
    const envelope = await generateIntegrity(dtu);
    expect(mockSha256).toHaveBeenCalledWith(dtu.content);
    const expectedHash = toHex(makeContentHash(dtu.content));
    expect(envelope.contentHash).toBe(expectedHash);
  });

  it('computes headerChecksum via crc32 of encoded header', async () => {
    const dtu = makeValidDTU();
    const envelope = await generateIntegrity(dtu);
    const headerBytes = encodeHeader(dtu.header);
    const expectedCrc = crc32(headerBytes);
    expect(envelope.headerChecksum).toBe(expectedCrc);
  });

  it('sets isValid to true', async () => {
    const envelope = await generateIntegrity(makeValidDTU());
    expect(envelope.isValid).toBe(true);
  });

  it('sets verifiedAt to approximately now', async () => {
    const before = Date.now();
    const envelope = await generateIntegrity(makeValidDTU());
    const after = Date.now();
    expect(envelope.verifiedAt).toBeGreaterThanOrEqual(before);
    expect(envelope.verifiedAt).toBeLessThanOrEqual(after);
  });

  it('includes signature when DTU has one', async () => {
    const sig = new Uint8Array(64).fill(0x55);
    const dtu = makeValidDTU({ signature: sig });
    const envelope = await generateIntegrity(dtu);
    expect(envelope.signature).toBe(toHex(sig));
  });

  it('does not include signature when DTU has none', async () => {
    const dtu = makeValidDTU();
    const envelope = await generateIntegrity(dtu);
    expect(envelope.signature).toBeUndefined();
  });

  it('includes signedBy when creatorKey is present', async () => {
    const dtu = makeValidDTU();
    dtu.meta.creatorKey = 'pk_alice';
    const envelope = await generateIntegrity(dtu);
    expect(envelope.signedBy).toBe('pk_alice');
  });

  it('does not include signedBy when creatorKey is absent', async () => {
    const dtu = makeValidDTU();
    delete dtu.meta.creatorKey;
    const envelope = await generateIntegrity(dtu);
    expect(envelope.signedBy).toBeUndefined();
  });
});

// ── verifyIntegrity ──────────────────────────────────────────────────────────

describe('verifyIntegrity', () => {
  it('returns valid for a correct DTU and envelope pair', async () => {
    const dtu = makeValidDTU();
    const envelope = await makeValidEnvelope(dtu);
    const result = await verifyIntegrity(dtu, envelope);
    expect(result.valid).toBe(true);
    expect(result.contentMatch).toBe(true);
    expect(result.headerValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects DTU ID mismatch', async () => {
    const dtu = makeValidDTU();
    const envelope = await makeValidEnvelope(dtu);
    envelope.dtuId = 'dtu_wrong_id';
    const result = await verifyIntegrity(dtu, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/ID mismatch/)])
    );
  });

  it('detects content hash mismatch with envelope', async () => {
    const dtu = makeValidDTU();
    const envelope = await makeValidEnvelope(dtu);
    envelope.contentHash = 'ff'.repeat(32); // wrong hash
    const result = await verifyIntegrity(dtu, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/does not match envelope/)])
    );
  });

  it('detects content hash mismatch with header', async () => {
    const dtu = makeValidDTU();
    // Corrupt the header hash
    dtu.header.contentHash = new Uint8Array(32).fill(0xff);
    const envelope = await makeValidEnvelope(dtu);
    // Fix envelope to match the recomputed hash so envelope check passes
    // but header check fails (header hash != sha256(content))
    const result = await verifyIntegrity(dtu, envelope);
    expect(result.contentMatch).toBe(false);
  });

  it('detects header checksum mismatch', async () => {
    const dtu = makeValidDTU();
    const envelope = await makeValidEnvelope(dtu);
    envelope.headerChecksum = 0xdeadbeef;
    const result = await verifyIntegrity(dtu, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/Header checksum mismatch/)])
    );
  });

  it('detects missing signature when SIGNED flag is set', async () => {
    const dtu = makeValidDTU();
    dtu.header.flags = DTU_FLAGS.SIGNED;
    // No signature set
    const envelope = await makeValidEnvelope(dtu);
    const result = await verifyIntegrity(dtu, envelope);
    expect(result.valid).toBe(false);
    expect(result.signatureValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/marked as signed but has no signature/)])
    );
  });

  it('detects invalid header (bad version)', async () => {
    const dtu = makeValidDTU();
    dtu.header.version = 99;
    const envelope = await makeValidEnvelope(dtu);
    const result = await verifyIntegrity(dtu, envelope);
    expect(result.valid).toBe(false);
    expect(result.headerValid).toBe(false);
  });

  it('collects all errors', async () => {
    const dtu = makeValidDTU();
    dtu.header.version = 99;
    dtu.header.flags = DTU_FLAGS.SIGNED; // no signature
    const envelope = await makeValidEnvelope(dtu);
    envelope.dtuId = 'dtu_wrong';
    envelope.contentHash = '00'.repeat(32);
    envelope.headerChecksum = 0;

    const result = await verifyIntegrity(dtu, envelope);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ── verifyHeader ─────────────────────────────────────────────────────────────

describe('verifyHeader', () => {
  it('returns valid for a correct DTU', () => {
    const dtu = makeValidDTU();
    const result = verifyHeader(dtu);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects content length mismatch', () => {
    const dtu = makeValidDTU();
    dtu.header.contentLength = 999;
    const result = verifyHeader(dtu);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/contentLength.*does not match/)])
    );
  });

  it('includes structural validation errors', () => {
    const dtu = makeValidDTU();
    dtu.header.version = 0;
    dtu.header.type = 0xffff as any;
    const result = verifyHeader(dtu);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('valid when content and header contentLength are both 0', () => {
    const content = new Uint8Array(0);
    const contentHash = makeContentHash(content);
    const dtu = makeValidDTU({
      content,
      header: {
        version: DTU_VERSION,
        flags: 0,
        type: DTU_TYPES.TEXT,
        timestamp: Date.now(),
        contentLength: 0,
        contentHash,
      },
    });
    const result = verifyHeader(dtu);
    expect(result.valid).toBe(true);
  });
});

// ── verifyContentHash ────────────────────────────────────────────────────────

describe('verifyContentHash', () => {
  it('returns true when content hash matches', async () => {
    const dtu = makeValidDTU();
    const result = await verifyContentHash(dtu);
    expect(result).toBe(true);
  });

  it('returns false when content hash does not match', async () => {
    const dtu = makeValidDTU();
    dtu.header.contentHash = new Uint8Array(32).fill(0xff);
    const result = await verifyContentHash(dtu);
    expect(result).toBe(false);
  });

  it('calls sha256 with the DTU content', async () => {
    const dtu = makeValidDTU();
    await verifyContentHash(dtu);
    expect(mockSha256).toHaveBeenCalledWith(dtu.content);
  });

  it('handles empty content', async () => {
    const content = new Uint8Array(0);
    const contentHash = makeContentHash(content);
    const dtu = makeValidDTU({
      content,
      header: {
        version: DTU_VERSION,
        flags: 0,
        type: DTU_TYPES.TEXT,
        timestamp: Date.now(),
        contentLength: 0,
        contentHash,
      },
    });
    const result = await verifyContentHash(dtu);
    expect(result).toBe(true);
  });
});

// ── verifySignature ──────────────────────────────────────────────────────────

describe('verifySignature', () => {
  it('returns false when DTU has no signature', async () => {
    const dtu = makeValidDTU();
    const pubKey = new Uint8Array(32).fill(0x01);
    const result = await verifySignature(dtu, pubKey);
    expect(result).toBe(false);
  });

  it('calls ed25519Verify with header || content', async () => {
    const sig = new Uint8Array(64).fill(0x55);
    const dtu = makeValidDTU({ signature: sig });
    const pubKey = new Uint8Array(32).fill(0x01);

    await verifySignature(dtu, pubKey);

    expect(mockEd25519Verify).toHaveBeenCalledTimes(1);
    const [message, passedSig, passedKey] = mockEd25519Verify.mock.calls[0] as any[];
    // message should be header (48 bytes) + content
    expect(message!.length).toBe(DTU_HEADER_SIZE + dtu.content.length);
    expect(passedSig).toBe(sig);
    expect(passedKey).toBe(pubKey);
  });

  it('returns true when signature is valid', async () => {
    mockEd25519Verify.mockResolvedValueOnce(true);
    const sig = new Uint8Array(64).fill(0x55);
    const dtu = makeValidDTU({ signature: sig });
    const pubKey = new Uint8Array(32).fill(0x01);
    const result = await verifySignature(dtu, pubKey);
    expect(result).toBe(true);
  });

  it('returns false when signature is invalid', async () => {
    mockEd25519Verify.mockResolvedValueOnce(false);
    const sig = new Uint8Array(64).fill(0x55);
    const dtu = makeValidDTU({ signature: sig });
    const pubKey = new Uint8Array(32).fill(0x01);
    const result = await verifySignature(dtu, pubKey);
    expect(result).toBe(false);
  });

  it('constructs message with correct header prefix', async () => {
    const sig = new Uint8Array(64).fill(0x55);
    const dtu = makeValidDTU({ signature: sig });
    const pubKey = new Uint8Array(32).fill(0x01);

    await verifySignature(dtu, pubKey);

    const [message] = mockEd25519Verify.mock.calls[0] as any[];
    const expectedHeader = encodeHeader(dtu.header);
    // First 48 bytes should match encoded header
    const headerPortion = message!.slice(0, DTU_HEADER_SIZE);
    expect(headerPortion).toEqual(expectedHeader);
  });

  it('constructs message with correct content suffix', async () => {
    const sig = new Uint8Array(64).fill(0x55);
    const dtu = makeValidDTU({ signature: sig });
    const pubKey = new Uint8Array(32).fill(0x01);

    await verifySignature(dtu, pubKey);

    const [message] = mockEd25519Verify.mock.calls[0] as any[];
    const contentPortion = message!.slice(DTU_HEADER_SIZE);
    expect(contentPortion).toEqual(dtu.content);
  });
});
