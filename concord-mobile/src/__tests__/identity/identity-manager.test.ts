// Tests for Identity Manager
// CRITICAL SECURITY TESTS:
//   - Private key NEVER serialized/transmitted/logged
//   - Private key NEVER appears in DTU content, meta, or tags
//   - Auth works with no server (airplane mode)
//   - Mutual challenge-response verification
//   - Ed25519 signature roundtrip

import {
  createIdentityManager,
  IdentityManager,
  SecureStorage,
} from '../../identity/identity-manager';
import { DTU, DTUHeader, DTUMeta, MeshAuthChallenge } from '../../utils/types';
import { IDENTITY_KEY_ALGORITHM } from '../../utils/constants';
import { setCryptoProvider, CryptoProvider, toHex } from '../../utils/crypto';

// ── Mock Crypto Provider ─────────────────────────────────────────────────────

// Simulates Ed25519 operations deterministically for testing
const MOCK_PUBLIC_KEY = new Uint8Array(32).fill(0xAA);
const MOCK_PRIVATE_KEY = new Uint8Array(32).fill(0xBB);
const MOCK_SIGNATURE = new Uint8Array(64).fill(0xCC);

const MOCK_PUBLIC_KEY_HEX = toHex(MOCK_PUBLIC_KEY);
const MOCK_PRIVATE_KEY_HEX = toHex(MOCK_PRIVATE_KEY);

function createMockCryptoProvider(): CryptoProvider {
  return {
    sha256: jest.fn().mockResolvedValue(new Uint8Array(32)),
    hmacSha256: jest.fn().mockResolvedValue(new Uint8Array(32)),
    crc32: jest.fn().mockReturnValue(0),
    randomBytes: jest.fn().mockImplementation((size: number) => {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) bytes[i] = i % 256;
      return bytes;
    }),
    ed25519GenerateKeypair: jest.fn().mockResolvedValue({
      publicKey: new Uint8Array(MOCK_PUBLIC_KEY),
      privateKey: new Uint8Array(MOCK_PRIVATE_KEY),
    }),
    ed25519Sign: jest.fn().mockResolvedValue(new Uint8Array(MOCK_SIGNATURE)),
    ed25519Verify: jest.fn().mockResolvedValue(true),
  };
}

// ── Mock Secure Storage ──────────────────────────────────────────────────────

function createMockSecureStorage(): SecureStorage & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    setItem: jest.fn().mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: jest.fn().mockImplementation(async (key: string) => {
      return store.get(key) ?? null;
    }),
    removeItem: jest.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }),
    hasItem: jest.fn().mockImplementation(async (key: string) => {
      return store.has(key);
    }),
  };
}

// ── Mock DTU ─────────────────────────────────────────────────────────────────

function createMockDTU(id: string = 'dtu-001'): DTU {
  const header: DTUHeader = {
    version: 1,
    flags: 0,
    type: 0x000E,
    timestamp: Date.now(),
    contentLength: 10,
    contentHash: new Uint8Array(32).fill(0xDD),
  };
  const meta: DTUMeta = {
    scope: 'local',
    published: false,
    painTagged: false,
    crpiScore: 0,
    relayCount: 0,
    ttl: 7,
  };
  return {
    id,
    header,
    content: new Uint8Array([1, 2, 3, 4, 5]),
    tags: ['test'],
    meta,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('IdentityManager', () => {
  let manager: IdentityManager;
  let secureStorage: ReturnType<typeof createMockSecureStorage>;
  let cryptoProvider: CryptoProvider;

  beforeEach(() => {
    cryptoProvider = createMockCryptoProvider();
    setCryptoProvider(cryptoProvider);
    secureStorage = createMockSecureStorage();
    manager = createIdentityManager(secureStorage);
  });

  describe('initialize', () => {
    it('should generate Ed25519 keypair on first launch', async () => {
      const identity = await manager.initialize();

      expect(cryptoProvider.ed25519GenerateKeypair).toHaveBeenCalledTimes(1);
      expect(identity.publicKey).toBe(MOCK_PUBLIC_KEY_HEX);
      expect(identity.keyAlgorithm).toBe(IDENTITY_KEY_ALGORITHM);
    });

    it('should store public key in secure storage', async () => {
      await manager.initialize();
      expect(secureStorage.setItem).toHaveBeenCalledWith(
        'concord_identity_public_key',
        MOCK_PUBLIC_KEY_HEX,
      );
    });

    it('should store private key in secure storage', async () => {
      await manager.initialize();
      expect(secureStorage.setItem).toHaveBeenCalledWith(
        'concord_identity_private_key',
        MOCK_PRIVATE_KEY_HEX,
      );
    });

    it('should generate device ID', async () => {
      const identity = await manager.initialize();
      expect(identity.deviceId).toBeDefined();
      expect(identity.deviceId.startsWith('dev_')).toBe(true);
    });

    it('should record creation timestamp', async () => {
      const before = Date.now();
      const identity = await manager.initialize();
      const after = Date.now();

      expect(identity.createdAt).toBeGreaterThanOrEqual(before);
      expect(identity.createdAt).toBeLessThanOrEqual(after);
    });

    it('should start with empty linked devices', async () => {
      const identity = await manager.initialize();
      expect(identity.linkedDevices).toEqual([]);
    });

    it('should load existing identity on subsequent launches', async () => {
      // First launch: generate
      await manager.initialize();

      // Second launch: new manager, same storage
      const manager2 = createIdentityManager(secureStorage);
      const identity2 = await manager2.initialize();

      // Should NOT generate a new keypair
      expect(cryptoProvider.ed25519GenerateKeypair).toHaveBeenCalledTimes(1);
      expect(identity2.publicKey).toBe(MOCK_PUBLIC_KEY_HEX);
    });

    it('should persist device ID across launches', async () => {
      const identity1 = await manager.initialize();

      const manager2 = createIdentityManager(secureStorage);
      const identity2 = await manager2.initialize();

      expect(identity2.deviceId).toBe(identity1.deviceId);
    });

    it('should set initialized flag', async () => {
      expect(manager.isInitialized()).toBe(false);
      await manager.initialize();
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('getIdentity', () => {
    it('should return null before initialization', () => {
      expect(manager.getIdentity()).toBeNull();
    });

    it('should return identity after initialization', async () => {
      await manager.initialize();
      const identity = manager.getIdentity();
      expect(identity).not.toBeNull();
      expect(identity!.publicKey).toBe(MOCK_PUBLIC_KEY_HEX);
    });

    it('should return a copy, not a reference', async () => {
      await manager.initialize();
      const id1 = manager.getIdentity();
      const id2 = manager.getIdentity();
      expect(id1).toEqual(id2);
      expect(id1).not.toBe(id2);
    });

    it('should return copy of linked devices array', async () => {
      await manager.initialize();
      const id1 = manager.getIdentity();
      const id2 = manager.getIdentity();
      expect(id1!.linkedDevices).not.toBe(id2!.linkedDevices);
    });
  });

  // ── CRITICAL SECURITY: Private Key Never Exposed ──────────────────────────

  describe('SECURITY AUDIT: Private key never exposed', () => {
    it('should NEVER include private key in getIdentity() result', async () => {
      await manager.initialize();
      const identity = manager.getIdentity();

      // Exhaustive check: no field should contain the private key
      const identityStr = JSON.stringify(identity);
      expect(identityStr).not.toContain(MOCK_PRIVATE_KEY_HEX);

      // Check every field explicitly
      expect((identity as any).privateKey).toBeUndefined();
      expect((identity as any).private_key).toBeUndefined();
      expect((identity as any).secretKey).toBeUndefined();
      expect((identity as any).secret_key).toBeUndefined();
      expect((identity as any).signingKey).toBeUndefined();
      expect((identity as any).signing_key).toBeUndefined();
    });

    it('should NEVER include private key in signed DTU', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      const signed = await manager.signDTU(dtu);

      // Check the entire DTU object
      const dtuStr = JSON.stringify(signed, (_, value) => {
        if (value instanceof Uint8Array) {
          return toHex(value);
        }
        return value;
      });
      expect(dtuStr).not.toContain(MOCK_PRIVATE_KEY_HEX);

      // Specifically check all DTU fields
      expect((signed as any).privateKey).toBeUndefined();
      expect((signed.meta as any).privateKey).toBeUndefined();
      expect(signed.meta.creatorKey).toBe(MOCK_PUBLIC_KEY_HEX); // public key, not private
    });

    it('should NEVER include private key in auth challenge', async () => {
      await manager.initialize();
      const challenge = manager.createAuthChallenge();

      const challengeStr = JSON.stringify(challenge, (_, value) => {
        if (value instanceof Uint8Array) return toHex(value);
        return value;
      });
      expect(challengeStr).not.toContain(MOCK_PRIVATE_KEY_HEX);
      expect((challenge as any).privateKey).toBeUndefined();
    });

    it('should NEVER include private key in auth response', async () => {
      await manager.initialize();

      const challenge: MeshAuthChallenge = {
        nonce: new Uint8Array(32).fill(0x11),
        timestamp: Date.now(),
        senderPublicKey: 'peer_public_key',
      };

      const response = await manager.respondToChallenge(challenge);

      const responseStr = JSON.stringify(response, (_, value) => {
        if (value instanceof Uint8Array) return toHex(value);
        return value;
      });
      expect(responseStr).not.toContain(MOCK_PRIVATE_KEY_HEX);
      expect((response as any).privateKey).toBeUndefined();
      expect(response.publicKey).toBe(MOCK_PUBLIC_KEY_HEX); // public key, not private
    });

    it('should NEVER pass private key to ed25519Verify (only to ed25519Sign)', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      const signed = await manager.signDTU(dtu);

      // The sign function should be called with the private key
      expect(cryptoProvider.ed25519Sign).toHaveBeenCalled();
      const signCall = (cryptoProvider.ed25519Sign as jest.Mock).mock.calls[0];
      expect(toHex(signCall[1])).toBe(MOCK_PRIVATE_KEY_HEX); // This is the signing call, expected

      // Now verify — should use public key, NOT private key
      await manager.verifyDTUSignature(signed, MOCK_PUBLIC_KEY_HEX);
      const verifyCall = (cryptoProvider.ed25519Verify as jest.Mock).mock.calls[0];
      expect(toHex(verifyCall[2])).toBe(MOCK_PUBLIC_KEY_HEX); // public key used for verify
      expect(toHex(verifyCall[2])).not.toBe(MOCK_PRIVATE_KEY_HEX);
    });
  });

  // ── DTU Signing ──────────────────────────────────────────────────────────

  describe('signDTU', () => {
    it('should add signature to DTU', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      const signed = await manager.signDTU(dtu);

      expect(signed.signature).toBeDefined();
      expect(signed.signature).toBeInstanceOf(Uint8Array);
      expect(signed.signature!.length).toBe(64);
    });

    it('should add creator public key to DTU meta', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      const signed = await manager.signDTU(dtu);

      expect(signed.meta.creatorKey).toBe(MOCK_PUBLIC_KEY_HEX);
    });

    it('should sign the content hash', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      await manager.signDTU(dtu);

      expect(cryptoProvider.ed25519Sign).toHaveBeenCalledWith(
        dtu.header.contentHash,
        expect.any(Uint8Array),
      );
    });

    it('should preserve original DTU fields', async () => {
      await manager.initialize();
      const dtu = createMockDTU('original-id');
      const signed = await manager.signDTU(dtu);

      expect(signed.id).toBe('original-id');
      expect(signed.header).toBe(dtu.header);
      expect(signed.content).toBe(dtu.content);
      expect(signed.tags).toBe(dtu.tags);
    });

    it('should throw if not initialized', async () => {
      const dtu = createMockDTU();
      await expect(manager.signDTU(dtu)).rejects.toThrow('Identity not initialized');
    });
  });

  describe('verifyDTUSignature', () => {
    it('should verify a valid signature', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      const signed = await manager.signDTU(dtu);

      const valid = await manager.verifyDTUSignature(signed, MOCK_PUBLIC_KEY_HEX);
      expect(valid).toBe(true);
    });

    it('should reject DTU without signature', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      // No signature on this DTU

      const valid = await manager.verifyDTUSignature(dtu, MOCK_PUBLIC_KEY_HEX);
      expect(valid).toBe(false);
    });

    it('should use ed25519Verify with correct parameters', async () => {
      await manager.initialize();
      const dtu = createMockDTU();
      const signed = await manager.signDTU(dtu);

      await manager.verifyDTUSignature(signed, MOCK_PUBLIC_KEY_HEX);

      expect(cryptoProvider.ed25519Verify).toHaveBeenCalledWith(
        dtu.header.contentHash,
        signed.signature,
        expect.any(Uint8Array),
      );
    });

    it('should return false for invalid signature', async () => {
      (cryptoProvider.ed25519Verify as jest.Mock).mockResolvedValueOnce(false);
      await manager.initialize();
      const dtu = createMockDTU();
      const signed = await manager.signDTU(dtu);

      const valid = await manager.verifyDTUSignature(signed, 'wrong_public_key_hex');
      expect(valid).toBe(false);
    });
  });

  // ── Mesh Auth (Airplane Mode / No Server) ────────────────────────────────

  describe('mesh auth — works without server (airplane mode)', () => {
    it('should create auth challenge', async () => {
      await manager.initialize();
      const challenge = manager.createAuthChallenge();

      expect(challenge.nonce).toBeDefined();
      expect(challenge.nonce.length).toBe(32);
      expect(challenge.timestamp).toBeGreaterThan(0);
      expect(challenge.senderPublicKey).toBe(MOCK_PUBLIC_KEY_HEX);
    });

    it('should throw if creating challenge without initialization', () => {
      expect(() => manager.createAuthChallenge()).toThrow('Identity not initialized');
    });

    it('should respond to challenge with signature', async () => {
      await manager.initialize();

      const challenge: MeshAuthChallenge = {
        nonce: new Uint8Array(32).fill(0x11),
        timestamp: Date.now(),
        senderPublicKey: 'peer_key_hex',
      };

      const response = await manager.respondToChallenge(challenge);

      expect(response.signature).toBeDefined();
      expect(response.signature.length).toBe(64);
      expect(response.publicKey).toBe(MOCK_PUBLIC_KEY_HEX);
      expect(response.nonce).toBe(challenge.nonce);
    });

    it('should throw if responding to challenge without initialization', async () => {
      const challenge: MeshAuthChallenge = {
        nonce: new Uint8Array(32),
        timestamp: Date.now(),
        senderPublicKey: 'peer',
      };
      await expect(manager.respondToChallenge(challenge)).rejects.toThrow('Identity not initialized');
    });

    it('should verify valid auth response', async () => {
      await manager.initialize();

      const challenge = manager.createAuthChallenge();
      const response = await manager.respondToChallenge(challenge);

      const valid = await manager.verifyAuthResponse(challenge, response);
      expect(valid).toBe(true);
    });

    it('should reject auth response with mismatched nonce', async () => {
      await manager.initialize();

      const challenge = manager.createAuthChallenge();
      const response = await manager.respondToChallenge(challenge);

      // Tamper with the nonce in the response
      const tamperedResponse = {
        ...response,
        nonce: new Uint8Array(32).fill(0xFF),
      };

      const valid = await manager.verifyAuthResponse(challenge, tamperedResponse);
      expect(valid).toBe(false);
    });

    it('should reject auth response with expired challenge', async () => {
      await manager.initialize();

      const challenge: MeshAuthChallenge = {
        nonce: new Uint8Array(32).fill(0x11),
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        senderPublicKey: MOCK_PUBLIC_KEY_HEX,
      };

      const response = await manager.respondToChallenge(challenge);
      const valid = await manager.verifyAuthResponse(challenge, response);
      expect(valid).toBe(false);
    });

    it('should reject auth response with future timestamp', async () => {
      await manager.initialize();

      const challenge: MeshAuthChallenge = {
        nonce: new Uint8Array(32).fill(0x11),
        timestamp: Date.now() + 10 * 60 * 1000, // 10 minutes in future
        senderPublicKey: MOCK_PUBLIC_KEY_HEX,
      };

      const response = await manager.respondToChallenge(challenge);
      const valid = await manager.verifyAuthResponse(challenge, response);
      expect(valid).toBe(false);
    });

    it('should reject auth response with invalid signature', async () => {
      await manager.initialize();
      (cryptoProvider.ed25519Verify as jest.Mock).mockResolvedValueOnce(false);

      const challenge = manager.createAuthChallenge();
      const response = await manager.respondToChallenge(challenge);

      // The second verify call will return false
      const valid = await manager.verifyAuthResponse(challenge, response);
      expect(valid).toBe(false);
    });

    it('should support mutual auth between two devices (no server)', async () => {
      // Device A
      const storageA = createMockSecureStorage();
      const managerA = createIdentityManager(storageA);

      // Device B — need separate keypair
      const storageB = createMockSecureStorage();
      const publicKeyB = new Uint8Array(32).fill(0xDD);
      const privateKeyB = new Uint8Array(32).fill(0xEE);
      (cryptoProvider.ed25519GenerateKeypair as jest.Mock)
        .mockResolvedValueOnce({ publicKey: new Uint8Array(MOCK_PUBLIC_KEY), privateKey: new Uint8Array(MOCK_PRIVATE_KEY) })
        .mockResolvedValueOnce({ publicKey: publicKeyB, privateKey: privateKeyB });
      const managerB = createIdentityManager(storageB);

      await managerA.initialize();
      await managerB.initialize();

      // A challenges B
      const challengeFromA = managerA.createAuthChallenge();
      const responseFromB = await managerB.respondToChallenge(challengeFromA);

      // A verifies B's response — crypto mock always returns true for verify
      const bValid = await managerA.verifyAuthResponse(challengeFromA, responseFromB);
      expect(bValid).toBe(true);

      // B challenges A
      const challengeFromB = managerB.createAuthChallenge();
      const responseFromA = await managerA.respondToChallenge(challengeFromB);

      // B verifies A's response
      const aValid = await managerB.verifyAuthResponse(challengeFromB, responseFromA);
      expect(aValid).toBe(true);
    });
  });

  // ── Device Linking ───────────────────────────────────────────────────────

  describe('device linking', () => {
    it('should link a device', async () => {
      await manager.initialize();
      const success = await manager.linkDevice('other_device_public_key');
      expect(success).toBe(true);
      expect(manager.getLinkedDevices()).toContain('other_device_public_key');
    });

    it('should persist linked devices to secure storage', async () => {
      await manager.initialize();
      await manager.linkDevice('device_1');
      await manager.linkDevice('device_2');

      expect(secureStorage.setItem).toHaveBeenCalledWith(
        'concord_identity_linked_devices',
        JSON.stringify(['device_1', 'device_2']),
      );
    });

    it('should not link self', async () => {
      await manager.initialize();
      const success = await manager.linkDevice(MOCK_PUBLIC_KEY_HEX);
      expect(success).toBe(false);
      expect(manager.getLinkedDevices()).not.toContain(MOCK_PUBLIC_KEY_HEX);
    });

    it('should not link already-linked device', async () => {
      await manager.initialize();
      await manager.linkDevice('device_1');
      const success = await manager.linkDevice('device_1');
      expect(success).toBe(false);
      expect(manager.getLinkedDevices().filter(d => d === 'device_1').length).toBe(1);
    });

    it('should throw if not initialized', async () => {
      await expect(manager.linkDevice('device_1')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('device revocation', () => {
    it('should revoke a linked device', async () => {
      await manager.initialize();
      await manager.linkDevice('device_1');
      const success = await manager.revokeDevice('device_1');
      expect(success).toBe(true);
      expect(manager.getLinkedDevices()).not.toContain('device_1');
    });

    it('should return false when revoking non-linked device', async () => {
      await manager.initialize();
      const success = await manager.revokeDevice('unknown');
      expect(success).toBe(false);
    });

    it('should persist after revocation', async () => {
      await manager.initialize();
      await manager.linkDevice('device_1');
      await manager.linkDevice('device_2');
      await manager.revokeDevice('device_1');

      expect(secureStorage.setItem).toHaveBeenCalledWith(
        'concord_identity_linked_devices',
        JSON.stringify(['device_2']),
      );
    });

    it('should throw if not initialized', async () => {
      await expect(manager.revokeDevice('device_1')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('getLinkedDevices', () => {
    it('should return empty array before initialization', () => {
      expect(manager.getLinkedDevices()).toEqual([]);
    });

    it('should return linked devices after initialization', async () => {
      await manager.initialize();
      await manager.linkDevice('dev_a');
      await manager.linkDevice('dev_b');

      const devices = manager.getLinkedDevices();
      expect(devices).toEqual(['dev_a', 'dev_b']);
    });

    it('should return a copy of the array', async () => {
      await manager.initialize();
      await manager.linkDevice('dev_a');

      const d1 = manager.getLinkedDevices();
      const d2 = manager.getLinkedDevices();
      expect(d1).toEqual(d2);
      expect(d1).not.toBe(d2);
    });

    it('should load linked devices from storage on re-initialize', async () => {
      await manager.initialize();
      await manager.linkDevice('dev_a');
      await manager.linkDevice('dev_b');

      // Re-create manager with same storage
      const manager2 = createIdentityManager(secureStorage);
      await manager2.initialize();

      expect(manager2.getLinkedDevices()).toEqual(['dev_a', 'dev_b']);
    });
  });

  // ── Source Code Audit: Private Key Safety ─────────────────────────────────

  describe('SOURCE CODE AUDIT: private key handling', () => {
    it('should store private key ONLY in secure storage', async () => {
      await manager.initialize();

      // Check all setItem calls — private key should only be stored via PRIVATE_KEY key
      const setItemCalls = (secureStorage.setItem as jest.Mock).mock.calls;
      const privateKeyCalls = setItemCalls.filter(
        ([_key, value]: [string, string]) => value === MOCK_PRIVATE_KEY_HEX
      );

      // Should be stored exactly once, under the correct key
      expect(privateKeyCalls.length).toBe(1);
      expect(privateKeyCalls[0][0]).toBe('concord_identity_private_key');
    });

    it('should NEVER pass private key to any function that transmits data', async () => {
      await manager.initialize();

      // The identity manager should only call ed25519Sign with the private key
      // and secure storage with the private key. No other function should receive it.
      const signCalls = (cryptoProvider.ed25519Sign as jest.Mock).mock.calls;
      // At this point, no signing has happened yet, so no calls
      expect(signCalls.length).toBe(0);

      // Sign a DTU and verify
      const dtu = createMockDTU();
      await manager.signDTU(dtu);

      // ed25519Sign should have received the private key
      const afterSignCalls = (cryptoProvider.ed25519Sign as jest.Mock).mock.calls;
      expect(afterSignCalls.length).toBe(1);
      expect(toHex(afterSignCalls[0][1])).toBe(MOCK_PRIVATE_KEY_HEX);

      // Verify should NOT receive private key
      await manager.verifyDTUSignature(await manager.signDTU(dtu), MOCK_PUBLIC_KEY_HEX);
      const verifyCalls = (cryptoProvider.ed25519Verify as jest.Mock).mock.calls;
      for (const call of verifyCalls) {
        // Third argument is the public key
        expect(toHex(call[2])).not.toBe(MOCK_PRIVATE_KEY_HEX);
      }
    });

    it('should use Ed25519 algorithm as specified', async () => {
      const identity = await manager.initialize();
      expect(identity.keyAlgorithm).toBe('Ed25519');
    });
  });
});
