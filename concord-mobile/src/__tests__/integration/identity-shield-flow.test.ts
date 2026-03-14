// Integration test: Identity creation -> content scanning -> quarantine flow
// Verifies that a newly created identity can sign DTUs, which are then scanned
// by the content scanner, and flagged DTUs are routed to quarantine.

import { createIdentityManager, SecureStorage } from '../../identity/identity-manager';
import { createContentScanner } from '../../shield/scanner/content-scanner';
import { createQuarantineManager } from '../../shield/quarantine/quarantine-manager';
import { createDTU } from '../../dtu/creation/dtu-forge';
import { useShieldStore } from '../../store/shield-store';
import { useIdentityStore } from '../../store/identity-store';
import { setCryptoProvider } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import type { ThreatSignature } from '../../utils/types';
import { DTU_TYPES } from '../../utils/constants';

// ── Mock crypto provider ────────────────────────────────────────────────────

const mockCryptoProvider: CryptoProvider = {
  sha256: jest.fn(async (data: Uint8Array) => {
    const xor = data.reduce((a, b) => a ^ b, 0);
    return new Uint8Array(32).fill(xor);
  }),
  hmacSha256: jest.fn(async () => new Uint8Array(32).fill(0xaa)),
  crc32: jest.fn(() => 0x12345678),
  randomBytes: jest.fn((size) => new Uint8Array(size).fill(0x42)),
  ed25519GenerateKeypair: jest.fn(async () => ({
    publicKey: new Uint8Array(32).fill(0x01),
    privateKey: new Uint8Array(64).fill(0x02),
  })),
  ed25519Sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
  ed25519Verify: jest.fn(async () => true),
};

// ── Mock secure storage ─────────────────────────────────────────────────────

function createMockSecureStorage(): SecureStorage {
  const store = new Map<string, string>();
  return {
    setItem: jest.fn(async (k, v) => { store.set(k, v); }),
    getItem: jest.fn(async (k) => store.get(k) ?? null),
    removeItem: jest.fn(async (k) => { store.delete(k); }),
    hasItem: jest.fn(async (k) => store.has(k)),
  };
}

// ── Test threat signatures ──────────────────────────────────────────────────

const malwareSignature: ThreatSignature = {
  id: 'sig_malware_001',
  version: 1,
  pattern: 'malicious_payload',
  severity: 8,
  category: 'malware',
  description: 'Known malicious payload pattern',
  updatedAt: Date.now(),
};

const phishingSignature: ThreatSignature = {
  id: 'sig_phish_001',
  version: 1,
  pattern: 'verify_your_account',
  severity: 6,
  category: 'phishing',
  description: 'Phishing link pattern',
  updatedAt: Date.now(),
};

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  setCryptoProvider(mockCryptoProvider);
});

beforeEach(() => {
  jest.clearAllMocks();
  useShieldStore.getState().reset();
  useIdentityStore.getState().reset();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Identity -> Content Scanning -> Quarantine flow', () => {
  it('initializes identity, signs a DTU, and scans it clean', async () => {
    // Step 1: Create and initialize identity
    const storage = createMockSecureStorage();
    const identityManager = createIdentityManager(storage);
    const identity = await identityManager.initialize();

    expect(identity.publicKey).toBeTruthy();
    expect(identity.deviceId).toMatch(/^dev_/);

    // Step 2: Store identity in the identity store
    useIdentityStore.getState().setIdentity(identity);
    expect(useIdentityStore.getState().isInitialized).toBe(true);

    // Step 3: Create a clean DTU and sign it
    const dtu = await createDTU({
      type: DTU_TYPES.TEXT,
      content: new TextEncoder().encode('This is a safe message with no threats.'),
      tags: ['text', 'safe'],
      scope: 'local',
      creatorKey: identity.publicKey,
    });
    const signedDTU = await identityManager.signDTU(dtu);
    expect(signedDTU.signature).toBeDefined();
    expect(signedDTU.meta.creatorKey).toBe(identity.publicKey);

    // Step 4: Scan the DTU with content scanner
    const scanner = createContentScanner([malwareSignature, phishingSignature]);
    const result = scanner.scan(signedDTU);

    expect(result.clean).toBe(true);
    expect(result.threats).toHaveLength(0);
  });

  it('detects a threat and quarantines the DTU', async () => {
    // Create a DTU with malicious content
    const maliciousDTU = await createDTU({
      type: DTU_TYPES.TEXT,
      content: new TextEncoder().encode('This contains a malicious_payload for testing.'),
      tags: ['text', 'untrusted'],
      scope: 'regional',
    });

    // Scan with content scanner
    const scanner = createContentScanner([malwareSignature, phishingSignature]);
    const result = scanner.scan(maliciousDTU);

    expect(result.clean).toBe(false);
    expect(result.threats.length).toBeGreaterThanOrEqual(1);
    expect(result.threats[0].category).toBe('malware');
    expect(result.threats[0].severity).toBe(8);

    // Quarantine the flagged DTU
    const quarantine = createQuarantineManager();
    quarantine.quarantine(maliciousDTU, 'Malware detected', result.threats);

    expect(quarantine.isQuarantined(maliciousDTU.id)).toBe(true);
    expect(quarantine.getQuarantinedCount()).toBe(1);

    // Update shield store
    useShieldStore.getState().addScanResult(result);
    expect(useShieldStore.getState().threatsDetected).toBe(1);
    expect(useShieldStore.getState().totalScanned).toBe(1);
  });

  it('releases a false-positive from quarantine', async () => {
    const benignDTU = await createDTU({
      type: DTU_TYPES.TEXT,
      content: new TextEncoder().encode('Please verify_your_account settings are correct.'),
      tags: ['support'],
      scope: 'local',
    });

    const scanner = createContentScanner([phishingSignature]);
    const result = scanner.scan(benignDTU);
    expect(result.clean).toBe(false);

    const quarantine = createQuarantineManager();
    quarantine.quarantine(benignDTU, 'Potential phishing', result.threats);
    expect(quarantine.isQuarantined(benignDTU.id)).toBe(true);

    // Release as false positive
    const released = quarantine.release(benignDTU.id);
    expect(released).toBeDefined();
    expect(released?.id).toBe(benignDTU.id);
    expect(quarantine.isQuarantined(benignDTU.id)).toBe(false);
    expect(quarantine.getQuarantinedCount()).toBe(0);
  });

  it('batch scans multiple DTUs and quarantines only threats', async () => {
    const safeDTU = await createDTU({
      type: DTU_TYPES.TEXT,
      content: new TextEncoder().encode('Safe content here.'),
      tags: ['safe'],
      scope: 'local',
    });
    const dangerousDTU = await createDTU({
      type: DTU_TYPES.TEXT,
      content: new TextEncoder().encode('Contains malicious_payload data.'),
      tags: ['untrusted'],
      scope: 'regional',
    });

    const scanner = createContentScanner([malwareSignature]);
    const results = scanner.scanBatch([safeDTU, dangerousDTU]);

    expect(results).toHaveLength(2);
    expect(results[0].clean).toBe(true);
    expect(results[1].clean).toBe(false);

    // Quarantine only the dangerous one
    const quarantine = createQuarantineManager();
    for (const result of results) {
      if (!result.clean) {
        const dtu = [safeDTU, dangerousDTU].find(d => d.id === result.dtuId)!;
        quarantine.quarantine(dtu, 'Threat detected', result.threats);
      }
    }

    expect(quarantine.isQuarantined(safeDTU.id)).toBe(false);
    expect(quarantine.isQuarantined(dangerousDTU.id)).toBe(true);
  });

  it('updates shield store signatures and rescans with new patterns', async () => {
    const dtu = await createDTU({
      type: DTU_TYPES.TEXT,
      content: new TextEncoder().encode('This contains a zero_day_exploit marker.'),
      tags: ['test'],
      scope: 'local',
    });

    // First scan with no signatures — should be clean
    const scanner = createContentScanner([]);
    const firstResult = scanner.scan(dtu);
    expect(firstResult.clean).toBe(true);

    // Update with new signatures
    const newSig: ThreatSignature = {
      id: 'sig_zeroday_001',
      version: 2,
      pattern: 'zero_day_exploit',
      severity: 10,
      category: 'exploit',
      description: 'Zero-day exploit marker',
      updatedAt: Date.now(),
    };
    scanner.updateSignatures([newSig]);
    expect(scanner.getSignatureCount()).toBe(1);

    // Rescan with updated signatures
    const secondResult = scanner.scan(dtu);
    expect(secondResult.clean).toBe(false);
    expect(secondResult.threats[0].category).toBe('exploit');
    expect(secondResult.threats[0].severity).toBe(10);

    // Update shield store
    useShieldStore.getState().mergeSignatures([newSig]);
    expect(useShieldStore.getState().signatures).toHaveLength(1);
    expect(useShieldStore.getState().signatureVersion).toBe(2);
  });

  it('verifies identity signature on a DTU before accepting it', async () => {
    const storage = createMockSecureStorage();
    const identityManager = createIdentityManager(storage);
    await identityManager.initialize();

    const dtu = await createDTU({
      type: DTU_TYPES.KNOWLEDGE,
      content: new TextEncoder().encode('Verified knowledge content'),
      tags: ['knowledge'],
      scope: 'global',
      signed: true,
    });

    const signedDTU = await identityManager.signDTU(dtu);
    const identity = identityManager.getIdentity()!;

    // Verify the signature
    const isValid = await identityManager.verifyDTUSignature(signedDTU, identity.publicKey);
    expect(isValid).toBe(true);

    // Scan the verified DTU
    const scanner = createContentScanner([malwareSignature]);
    const result = scanner.scan(signedDTU);
    expect(result.clean).toBe(true);
  });
});
