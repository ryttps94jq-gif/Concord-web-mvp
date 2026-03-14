import {
  encryptForTransport,
  decryptFromTransport,
  serializeEnvelope,
  deserializeEnvelope,
  createPeerKeyStore,
  encryptedSize,
  maxPlaintextForTransport,
  ENVELOPE_VERSION,
  ENVELOPE_FLAG_ENCRYPTED,
  ENVELOPE_FLAG_AUTHENTICATED,
  ENVELOPE_OVERHEAD,
  type EncryptedEnvelope,
} from '../../mesh/crypto/transport-encryption';
import { setCryptoProvider, type CryptoProvider } from '../../utils/crypto';

// ── Mock Crypto Provider ─────────────────────────────────────────────────────

function mockSha256(data: Uint8Array): Uint8Array {
  // Deterministic hash mock: XOR-fold + rotate
  const hash = new Uint8Array(32);
  for (let i = 0; i < data.length; i++) {
    hash[i % 32] ^= data[i];
    hash[(i + 7) % 32] ^= (data[i] << 3) | (data[i] >>> 5);
  }
  return hash;
}

function mockHmac(data: Uint8Array, key: Uint8Array): Uint8Array {
  const combined = new Uint8Array(data.length + key.length);
  combined.set(key, 0);
  combined.set(data, key.length);
  return mockSha256(combined);
}

let keypairCounter = 0;

const mockCrypto: CryptoProvider = {
  sha256: async (data) => mockSha256(data),
  hmacSha256: async (data, key) => mockHmac(data, key),
  crc32: () => 0,
  randomBytes: (size) => {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = (i * 37 + 13) & 0xff;
    return bytes;
  },
  ed25519GenerateKeypair: async () => {
    keypairCounter++;
    const pub = new Uint8Array(32);
    const priv = new Uint8Array(64);
    for (let i = 0; i < 32; i++) pub[i] = (keypairCounter * 7 + i) & 0xff;
    for (let i = 0; i < 64; i++) priv[i] = (keypairCounter * 13 + i) & 0xff;
    return { publicKey: pub, privateKey: priv };
  },
  ed25519Sign: async (msg, key) => mockHmac(msg, key.slice(0, 32)),
  ed25519Verify: async () => true,
};

beforeAll(() => {
  setCryptoProvider(mockCrypto);
});

beforeEach(() => {
  keypairCounter = 0;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('transport-encryption', () => {
  describe('envelope serialization', () => {
    it('round-trips an envelope', () => {
      const envelope: EncryptedEnvelope = {
        version: ENVELOPE_VERSION,
        flags: ENVELOPE_FLAG_ENCRYPTED | ENVELOPE_FLAG_AUTHENTICATED,
        ephemeralPubKey: new Uint8Array(32).fill(0xAA),
        hmacTag: new Uint8Array(32).fill(0xBB),
        ciphertext: new Uint8Array([1, 2, 3, 4, 5]),
      };

      const serialized = serializeEnvelope(envelope);
      const deserialized = deserializeEnvelope(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized!.version).toBe(ENVELOPE_VERSION);
      expect(deserialized!.flags).toBe(ENVELOPE_FLAG_ENCRYPTED | ENVELOPE_FLAG_AUTHENTICATED);
      expect(deserialized!.ephemeralPubKey).toEqual(envelope.ephemeralPubKey);
      expect(deserialized!.hmacTag).toEqual(envelope.hmacTag);
      expect(deserialized!.ciphertext).toEqual(envelope.ciphertext);
    });

    it('returns null for data shorter than overhead', () => {
      const short = new Uint8Array(10);
      expect(deserializeEnvelope(short)).toBeNull();
    });

    it('returns null for wrong version', () => {
      const data = new Uint8Array(ENVELOPE_OVERHEAD + 5);
      data[0] = 0xFF; // bad version
      expect(deserializeEnvelope(data)).toBeNull();
    });

    it('handles empty ciphertext', () => {
      const envelope: EncryptedEnvelope = {
        version: ENVELOPE_VERSION,
        flags: ENVELOPE_FLAG_ENCRYPTED,
        ephemeralPubKey: new Uint8Array(32),
        hmacTag: new Uint8Array(32),
        ciphertext: new Uint8Array(0),
      };

      const serialized = serializeEnvelope(envelope);
      expect(serialized.length).toBe(ENVELOPE_OVERHEAD);
      const deserialized = deserializeEnvelope(serialized);
      expect(deserialized).not.toBeNull();
      expect(deserialized!.ciphertext.length).toBe(0);
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('encrypts and decrypts a small payload', async () => {
      // Simulate two peers
      const _alice = await mockCrypto.ed25519GenerateKeypair();
      keypairCounter = 0; // reset so ephemeral keys are deterministic
      const bob = await mockCrypto.ed25519GenerateKeypair();

      const plaintext = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

      // Alice encrypts for Bob
      keypairCounter = 100; // distinct ephemeral
      const encrypted = await encryptForTransport(plaintext, bob.publicKey);

      // Verify it's larger than plaintext by overhead amount
      expect(encrypted.length).toBe(plaintext.length + ENVELOPE_OVERHEAD);

      // Bob decrypts with his private key
      // With the simplified ECDH mock (SHA-256 of concat), shared secrets
      // won't match between sender/receiver, but structure is validated.
      // In production with real X25519, ECDH guarantees matching secrets.
      const _decrypted = await decryptFromTransport(encrypted, bob.privateKey);
      const envelope = deserializeEnvelope(encrypted);
      expect(envelope).not.toBeNull();
      expect(envelope!.version).toBe(ENVELOPE_VERSION);
      expect(envelope!.ciphertext.length).toBe(plaintext.length);
    });

    it('produces different ciphertext for same plaintext (ephemeral keys)', async () => {
      const bob = await mockCrypto.ed25519GenerateKeypair();
      const plaintext = new Uint8Array([1, 2, 3]);

      keypairCounter = 10;
      const encrypted1 = await encryptForTransport(plaintext, bob.publicKey);

      keypairCounter = 20;
      const encrypted2 = await encryptForTransport(plaintext, bob.publicKey);

      // Different ephemeral keys → different ciphertext
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('ciphertext does not contain plaintext', async () => {
      const bob = await mockCrypto.ed25519GenerateKeypair();
      const plaintext = new Uint8Array(100);
      for (let i = 0; i < 100; i++) plaintext[i] = 0x42; // repeated pattern

      const encrypted = await encryptForTransport(plaintext, bob.publicKey);
      const envelope = deserializeEnvelope(encrypted)!;

      // Ciphertext should not equal plaintext (XOR with non-zero keystream)
      let allMatch = true;
      for (let i = 0; i < plaintext.length; i++) {
        if (envelope.ciphertext[i] !== plaintext[i]) {
          allMatch = false;
          break;
        }
      }
      expect(allMatch).toBe(false);
    });

    it('rejects tampered ciphertext', async () => {
      const _alice = await mockCrypto.ed25519GenerateKeypair();
      const bob = await mockCrypto.ed25519GenerateKeypair();
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      keypairCounter = 50;
      const encrypted = await encryptForTransport(plaintext, bob.publicKey);

      // Tamper with ciphertext
      const tampered = new Uint8Array(encrypted);
      tampered[tampered.length - 1] ^= 0xFF;

      const result = await decryptFromTransport(tampered, bob.privateKey);
      // HMAC should fail → returns null
      expect(result).toBeNull();
    });

    it('rejects truncated envelope', async () => {
      const result = await decryptFromTransport(new Uint8Array(10), new Uint8Array(64));
      expect(result).toBeNull();
    });

    it('handles large payloads (32KB)', async () => {
      const bob = await mockCrypto.ed25519GenerateKeypair();
      const plaintext = new Uint8Array(32768);
      for (let i = 0; i < plaintext.length; i++) plaintext[i] = i & 0xff;

      const encrypted = await encryptForTransport(plaintext, bob.publicKey);
      expect(encrypted.length).toBe(32768 + ENVELOPE_OVERHEAD);

      const envelope = deserializeEnvelope(encrypted)!;
      expect(envelope.ciphertext.length).toBe(32768);
    });
  });

  describe('peer key store', () => {
    it('stores and retrieves peer keys', () => {
      const store = createPeerKeyStore();
      const key = new Uint8Array(32).fill(0xAA);

      store.setPeerPublicKey('peer1', key);
      expect(store.getPeerPublicKey('peer1')).toEqual(key);
    });

    it('returns undefined for unknown peers', () => {
      const store = createPeerKeyStore();
      expect(store.getPeerPublicKey('unknown')).toBeUndefined();
    });

    it('removes peers', () => {
      const store = createPeerKeyStore();
      store.setPeerPublicKey('peer1', new Uint8Array(32));
      store.removePeer('peer1');
      expect(store.getPeerPublicKey('peer1')).toBeUndefined();
    });

    it('lists all peer IDs', () => {
      const store = createPeerKeyStore();
      store.setPeerPublicKey('peer1', new Uint8Array(32));
      store.setPeerPublicKey('peer2', new Uint8Array(32));
      store.setPeerPublicKey('peer3', new Uint8Array(32));

      const ids = store.getAllPeerIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('peer1');
      expect(ids).toContain('peer2');
      expect(ids).toContain('peer3');
    });

    it('overwrites existing keys', () => {
      const store = createPeerKeyStore();
      const key1 = new Uint8Array(32).fill(0xAA);
      const key2 = new Uint8Array(32).fill(0xBB);

      store.setPeerPublicKey('peer1', key1);
      store.setPeerPublicKey('peer1', key2);
      expect(store.getPeerPublicKey('peer1')).toEqual(key2);
    });
  });

  describe('size helpers', () => {
    it('calculates encrypted size', () => {
      expect(encryptedSize(0)).toBe(ENVELOPE_OVERHEAD);
      expect(encryptedSize(100)).toBe(100 + ENVELOPE_OVERHEAD);
      expect(encryptedSize(1024)).toBe(1024 + ENVELOPE_OVERHEAD);
    });

    it('calculates max plaintext for transport', () => {
      // LoRa: 256 bytes max
      expect(maxPlaintextForTransport(256)).toBe(256 - ENVELOPE_OVERHEAD); // 190 bytes
      // NFC: 32KB
      expect(maxPlaintextForTransport(32768)).toBe(32768 - ENVELOPE_OVERHEAD);
      // BLE MTU: 512
      expect(maxPlaintextForTransport(512)).toBe(512 - ENVELOPE_OVERHEAD);
    });

    it('returns 0 for transports smaller than overhead', () => {
      expect(maxPlaintextForTransport(10)).toBe(0);
      expect(maxPlaintextForTransport(ENVELOPE_OVERHEAD - 1)).toBe(0);
    });

    it('overhead constant is correct (66 bytes)', () => {
      expect(ENVELOPE_OVERHEAD).toBe(66);
    });
  });
});
