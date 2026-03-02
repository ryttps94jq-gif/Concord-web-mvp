// Tests for DTU Forge — creation engine

import {
  createDTU,
  createFoundationDTU,
  createTransactionDTU,
  createThreatDTU,
  CreateDTUOptions,
} from '../../dtu/creation/dtu-forge';
import {
  DTU_VERSION,
  DTU_FLAGS,
  DTU_TYPES,
  DEFAULT_DTU_TTL,
  PRIORITY_DTU_TTL,
  EMERGENCY_DTU_TTL,
} from '../../utils/constants';
import { setCryptoProvider } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import type { SensorReading, Transaction, ThreatMatch } from '../../utils/types';

// ── Mock crypto provider ─────────────────────────────────────────────────────

const mockSha256 = jest.fn(async (data: Uint8Array) => {
  // Deterministic fake hash: fill 32 bytes with the xor of all input bytes
  const xor = data.reduce((a, b) => a ^ b, 0);
  return new Uint8Array(32).fill(xor);
});

const mockCryptoProvider: CryptoProvider = {
  sha256: mockSha256,
  hmacSha256: jest.fn(async (data, key) => new Uint8Array(32).fill(0xaa)),
  crc32: jest.fn(() => 0x12345678),
  randomBytes: jest.fn((size) => new Uint8Array(size).fill(0x42)),
  ed25519GenerateKeypair: jest.fn(async () => ({
    publicKey: new Uint8Array(32).fill(0x01),
    privateKey: new Uint8Array(64).fill(0x02),
  })),
  ed25519Sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
  ed25519Verify: jest.fn(async () => true),
};

beforeAll(() => {
  setCryptoProvider(mockCryptoProvider);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOpts(overrides: Partial<CreateDTUOptions> = {}): CreateDTUOptions {
  return {
    type: DTU_TYPES.TEXT,
    content: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
    tags: ['test'],
    scope: 'local',
    ...overrides,
  };
}

function makeSensorReading(overrides: Partial<SensorReading> = {}): SensorReading {
  return {
    sensor: 'gps',
    timestamp: Date.now(),
    values: { lat: 40.7128, lon: -74.006 },
    accuracy: 5,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn_001',
    type: 'transfer',
    amount: 10.5,
    fromKey: 'pk_sender',
    toKey: 'pk_receiver',
    timestamp: Date.now(),
    nonce: new Uint8Array(16).fill(0x01),
    balanceHash: 'abc123',
    signature: new Uint8Array(64).fill(0x02),
    status: 'pending',
    propagated: false,
    ...overrides,
  };
}

function makeThreatMatch(overrides: Partial<ThreatMatch> = {}): ThreatMatch {
  return {
    signatureId: 'sig_001',
    severity: 5,
    category: 'malware',
    matchLocation: 42,
    confidence: 0.95,
    ...overrides,
  };
}

// ── createDTU ────────────────────────────────────────────────────────────────

describe('createDTU', () => {
  it('generates an ID with dtu prefix', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.id).toMatch(/^dtu_/);
  });

  it('computes SHA-256 of content', async () => {
    const content = new Uint8Array([1, 2, 3]);
    await createDTU(makeOpts({ content }));
    expect(mockSha256).toHaveBeenCalledWith(content);
  });

  it('sets header version to DTU_VERSION', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.header.version).toBe(DTU_VERSION);
  });

  it('sets header type from options', async () => {
    const dtu = await createDTU(makeOpts({ type: DTU_TYPES.KNOWLEDGE }));
    expect(dtu.header.type).toBe(DTU_TYPES.KNOWLEDGE);
  });

  it('sets header timestamp to current time', async () => {
    const before = Date.now();
    const dtu = await createDTU(makeOpts());
    const after = Date.now();
    expect(dtu.header.timestamp).toBeGreaterThanOrEqual(before);
    expect(dtu.header.timestamp).toBeLessThanOrEqual(after);
  });

  it('sets header contentLength from content', async () => {
    const content = new Uint8Array(1024);
    const dtu = await createDTU(makeOpts({ content }));
    expect(dtu.header.contentLength).toBe(1024);
  });

  it('sets header contentHash from sha256 result', async () => {
    const content = new Uint8Array([0xff]);
    const dtu = await createDTU(makeOpts({ content }));
    // Our mock xors all bytes: 0xff xor initial 0 = 0xff
    expect(dtu.header.contentHash).toEqual(new Uint8Array(32).fill(0xff));
  });

  it('stores content on the DTU', async () => {
    const content = new Uint8Array([10, 20, 30]);
    const dtu = await createDTU(makeOpts({ content }));
    expect(dtu.content).toEqual(content);
  });

  it('stores tags on the DTU', async () => {
    const dtu = await createDTU(makeOpts({ tags: ['a', 'b', 'c'] }));
    expect(dtu.tags).toEqual(['a', 'b', 'c']);
  });

  // ── Flag tests ───────────────────────────────────────────────────────────

  it('sets no flags by default', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.header.flags).toBe(0);
  });

  it('sets ENCRYPTED flag', async () => {
    const dtu = await createDTU(makeOpts({ encrypted: true }));
    expect(dtu.header.flags & DTU_FLAGS.ENCRYPTED).toBeTruthy();
  });

  it('sets COMPRESSED flag', async () => {
    const dtu = await createDTU(makeOpts({ compressed: true }));
    expect(dtu.header.flags & DTU_FLAGS.COMPRESSED).toBeTruthy();
  });

  it('sets SIGNED flag', async () => {
    const dtu = await createDTU(makeOpts({ signed: true }));
    expect(dtu.header.flags & DTU_FLAGS.SIGNED).toBeTruthy();
  });

  it('sets PAIN_TAGGED flag', async () => {
    const dtu = await createDTU(makeOpts({ painTagged: true }));
    expect(dtu.header.flags & DTU_FLAGS.PAIN_TAGGED).toBeTruthy();
  });

  it('sets PRIORITY flag', async () => {
    const dtu = await createDTU(makeOpts({ priority: true }));
    expect(dtu.header.flags & DTU_FLAGS.PRIORITY).toBeTruthy();
  });

  it('sets GENESIS flag', async () => {
    const dtu = await createDTU(makeOpts({ genesis: true }));
    expect(dtu.header.flags & DTU_FLAGS.GENESIS).toBeTruthy();
  });

  it('sets RELAY flag', async () => {
    const dtu = await createDTU(makeOpts({ relay: true }));
    expect(dtu.header.flags & DTU_FLAGS.RELAY).toBeTruthy();
  });

  it('combines multiple flags', async () => {
    const dtu = await createDTU(
      makeOpts({ encrypted: true, signed: true, priority: true })
    );
    const expected = DTU_FLAGS.ENCRYPTED | DTU_FLAGS.SIGNED | DTU_FLAGS.PRIORITY;
    expect(dtu.header.flags).toBe(expected);
  });

  // ── Meta tests ───────────────────────────────────────────────────────────

  it('sets meta scope from options', async () => {
    const dtu = await createDTU(makeOpts({ scope: 'global' }));
    expect(dtu.meta.scope).toBe('global');
  });

  it('sets meta.published to false', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.meta.published).toBe(false);
  });

  it('sets meta.painTagged from options', async () => {
    const dtu = await createDTU(makeOpts({ painTagged: true }));
    expect(dtu.meta.painTagged).toBe(true);
  });

  it('defaults meta.painTagged to false', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.meta.painTagged).toBe(false);
  });

  it('sets meta.crpiScore to 0', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.meta.crpiScore).toBe(0);
  });

  it('sets meta.relayCount to 0', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.meta.relayCount).toBe(0);
  });

  it('sets meta.creatorKey from options', async () => {
    const dtu = await createDTU(makeOpts({ creatorKey: 'pk_test' }));
    expect(dtu.meta.creatorKey).toBe('pk_test');
  });

  it('sets meta.geoGrid from options', async () => {
    const geo = { lat: 40.71, lon: -74.01 };
    const dtu = await createDTU(makeOpts({ geoGrid: geo }));
    expect(dtu.meta.geoGrid).toEqual(geo);
  });

  // ── TTL tests ────────────────────────────────────────────────────────────

  it('uses DEFAULT_DTU_TTL normally', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.meta.ttl).toBe(DEFAULT_DTU_TTL);
  });

  it('uses PRIORITY_DTU_TTL when priority is true', async () => {
    const dtu = await createDTU(makeOpts({ priority: true }));
    expect(dtu.meta.ttl).toBe(PRIORITY_DTU_TTL);
  });

  it('uses EMERGENCY_DTU_TTL for emergency alerts', async () => {
    const dtu = await createDTU(
      makeOpts({ type: DTU_TYPES.EMERGENCY_ALERT })
    );
    expect(dtu.meta.ttl).toBe(EMERGENCY_DTU_TTL);
  });

  it('emergency TTL overrides priority TTL', async () => {
    const dtu = await createDTU(
      makeOpts({ type: DTU_TYPES.EMERGENCY_ALERT, priority: true })
    );
    expect(dtu.meta.ttl).toBe(EMERGENCY_DTU_TTL);
  });

  // ── Lineage tests ────────────────────────────────────────────────────────

  it('defaults lineage to root (no parent)', async () => {
    const dtu = await createDTU(makeOpts());
    expect(dtu.lineage).toEqual({ parentId: null, ancestors: [], depth: 0 });
  });

  it('uses provided lineage', async () => {
    const lineage = { parentId: 'dtu_parent', ancestors: ['dtu_parent'], depth: 1 };
    const dtu = await createDTU(makeOpts({ lineage }));
    expect(dtu.lineage).toEqual(lineage);
  });
});

// ── createFoundationDTU ──────────────────────────────────────────────────────

describe('createFoundationDTU', () => {
  it('creates a DTU with FOUNDATION_SENSE type', async () => {
    const dtu = await createFoundationDTU(makeSensorReading());
    expect(dtu.header.type).toBe(DTU_TYPES.FOUNDATION_SENSE);
  });

  it('encodes sensor reading as JSON content', async () => {
    const reading = makeSensorReading({ sensor: 'wifi' });
    const dtu = await createFoundationDTU(reading);
    const decoded = new TextDecoder().decode(dtu.content);
    const parsed = JSON.parse(decoded);
    expect(parsed.sensor).toBe('wifi');
  });

  it('includes sensor type in tags', async () => {
    const dtu = await createFoundationDTU(makeSensorReading({ sensor: 'barometric' }));
    expect(dtu.tags).toContain('barometric');
    expect(dtu.tags).toContain('foundation');
    expect(dtu.tags).toContain('sensor');
  });

  it('sets scope to local', async () => {
    const dtu = await createFoundationDTU(makeSensorReading());
    expect(dtu.meta.scope).toBe('local');
  });

  it('uses provided geoGrid over sensor geoGrid', async () => {
    const sensorGeo = { lat: 10, lon: 20 };
    const overrideGeo = { lat: 30, lon: 40 };
    const reading = makeSensorReading({ geoGrid: sensorGeo });
    const dtu = await createFoundationDTU(reading, overrideGeo);
    expect(dtu.meta.geoGrid).toEqual(overrideGeo);
  });

  it('falls back to sensor geoGrid when none provided', async () => {
    const sensorGeo = { lat: 10, lon: 20 };
    const reading = makeSensorReading({ geoGrid: sensorGeo });
    const dtu = await createFoundationDTU(reading);
    expect(dtu.meta.geoGrid).toEqual(sensorGeo);
  });

  it('has undefined geoGrid when neither provided', async () => {
    const reading = makeSensorReading();
    delete reading.geoGrid;
    const dtu = await createFoundationDTU(reading);
    expect(dtu.meta.geoGrid).toBeUndefined();
  });
});

// ── createTransactionDTU ─────────────────────────────────────────────────────

describe('createTransactionDTU', () => {
  it('creates a DTU with ECONOMY_TRANSACTION type', async () => {
    const dtu = await createTransactionDTU(makeTransaction());
    expect(dtu.header.type).toBe(DTU_TYPES.ECONOMY_TRANSACTION);
  });

  it('sets scope to global', async () => {
    const dtu = await createTransactionDTU(makeTransaction());
    expect(dtu.meta.scope).toBe('global');
  });

  it('sets signed and priority flags', async () => {
    const dtu = await createTransactionDTU(makeTransaction());
    expect(dtu.header.flags & DTU_FLAGS.SIGNED).toBeTruthy();
    expect(dtu.header.flags & DTU_FLAGS.PRIORITY).toBeTruthy();
  });

  it('includes transaction type in tags', async () => {
    const dtu = await createTransactionDTU(makeTransaction({ type: 'royalty' }));
    expect(dtu.tags).toContain('royalty');
    expect(dtu.tags).toContain('economy');
    expect(dtu.tags).toContain('transaction');
  });

  it('sets creatorKey to fromKey', async () => {
    const dtu = await createTransactionDTU(makeTransaction({ fromKey: 'pk_alice' }));
    expect(dtu.meta.creatorKey).toBe('pk_alice');
  });

  it('encodes transaction data as JSON content', async () => {
    const txn = makeTransaction({ amount: 99.5 });
    const dtu = await createTransactionDTU(txn);
    const decoded = new TextDecoder().decode(dtu.content);
    const parsed = JSON.parse(decoded);
    expect(parsed.amount).toBe(99.5);
    expect(parsed.id).toBe(txn.id);
  });

  it('uses PRIORITY_DTU_TTL', async () => {
    const dtu = await createTransactionDTU(makeTransaction());
    expect(dtu.meta.ttl).toBe(PRIORITY_DTU_TTL);
  });
});

// ── createThreatDTU ──────────────────────────────────────────────────────────

describe('createThreatDTU', () => {
  it('creates a DTU with SHIELD_THREAT type', async () => {
    const dtu = await createThreatDTU(makeThreatMatch(), 'dtu_source');
    expect(dtu.header.type).toBe(DTU_TYPES.SHIELD_THREAT);
  });

  it('sets scope to regional', async () => {
    const dtu = await createThreatDTU(makeThreatMatch(), 'dtu_source');
    expect(dtu.meta.scope).toBe('regional');
  });

  it('sets lineage with sourceDtuId as parent', async () => {
    const dtu = await createThreatDTU(makeThreatMatch(), 'dtu_abc');
    expect(dtu.lineage!.parentId).toBe('dtu_abc');
    expect(dtu.lineage!.ancestors).toContain('dtu_abc');
    expect(dtu.lineage!.depth).toBe(1);
  });

  it('includes category in tags', async () => {
    const dtu = await createThreatDTU(
      makeThreatMatch({ category: 'phishing' }),
      'dtu_src'
    );
    expect(dtu.tags).toContain('phishing');
    expect(dtu.tags).toContain('shield');
    expect(dtu.tags).toContain('threat');
  });

  it('pain-tags high severity threats (>= 7)', async () => {
    const dtu = await createThreatDTU(makeThreatMatch({ severity: 7 }), 'dtu_src');
    expect(dtu.meta.painTagged).toBe(true);
    expect(dtu.header.flags & DTU_FLAGS.PAIN_TAGGED).toBeTruthy();
  });

  it('does not pain-tag low severity threats (< 7)', async () => {
    const dtu = await createThreatDTU(makeThreatMatch({ severity: 6 }), 'dtu_src');
    expect(dtu.meta.painTagged).toBe(false);
  });

  it('sets priority for critical threats (>= 9)', async () => {
    const dtu = await createThreatDTU(makeThreatMatch({ severity: 9 }), 'dtu_src');
    expect(dtu.header.flags & DTU_FLAGS.PRIORITY).toBeTruthy();
  });

  it('does not set priority for severity < 9', async () => {
    const dtu = await createThreatDTU(makeThreatMatch({ severity: 8 }), 'dtu_src');
    expect(dtu.header.flags & DTU_FLAGS.PRIORITY).toBeFalsy();
  });

  it('encodes threat data including sourceDtuId in JSON content', async () => {
    const threat = makeThreatMatch({ signatureId: 'sig_test' });
    const dtu = await createThreatDTU(threat, 'dtu_source_id');
    const decoded = new TextDecoder().decode(dtu.content);
    const parsed = JSON.parse(decoded);
    expect(parsed.signatureId).toBe('sig_test');
    expect(parsed.sourceDtuId).toBe('dtu_source_id');
  });

  it('includes severity in tags', async () => {
    const dtu = await createThreatDTU(makeThreatMatch({ severity: 8 }), 'dtu_src');
    expect(dtu.tags).toContain('severity:8');
  });
});
