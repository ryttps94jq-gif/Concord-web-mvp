// Concord Mobile — Identity Manager (Signal Layer)
// Device identity using Ed25519 keypair.
//
// SECURITY INVARIANTS:
//   1. Private key NEVER leaves this module
//   2. Private key is NEVER serialized to any log, console, or error message
//   3. Private key is NEVER transmitted over any transport
//   4. Private key is NEVER included in any DTU content or metadata
//   5. Private key is stored ONLY in secure storage (Keychain/Keystore)
//   6. All signing operations happen in-memory; private key ref is not returned
//
// Mesh auth: mutual challenge-response (works with no server / airplane mode)
// Cross-device linking via cross-signing.

import {
  DTU,
  DeviceIdentity,
  MeshAuthChallenge,
  MeshAuthResponse,
} from '../utils/types';
import {
  IDENTITY_KEY_ALGORITHM,
} from '../utils/constants';
import {
  generateId,
  toHex,
  constantTimeEqual,
  getCryptoProvider,
} from '../utils/crypto';

// ── Secure Storage Interface ─────────────────────────────────────────────────
// Wraps platform secure storage (iOS Keychain / Android Keystore)

export interface SecureStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  hasItem(key: string): Promise<boolean>;
}

// Storage keys — only the public key and metadata are stored as strings.
// The private key is stored separately in secure storage.
const STORAGE_KEYS = {
  PUBLIC_KEY: 'concord_identity_public_key',
  PRIVATE_KEY: 'concord_identity_private_key',
  DEVICE_ID: 'concord_identity_device_id',
  CREATED_AT: 'concord_identity_created_at',
  LINKED_DEVICES: 'concord_identity_linked_devices',
} as const;

// ── Identity Manager Interface ───────────────────────────────────────────────

export interface IdentityManager {
  initialize(): Promise<DeviceIdentity>;
  getIdentity(): DeviceIdentity | null;
  isInitialized(): boolean;
  signDTU(dtu: DTU): Promise<DTU>;
  verifyDTUSignature(dtu: DTU, publicKey: string): Promise<boolean>;
  createAuthChallenge(): MeshAuthChallenge;
  respondToChallenge(challenge: MeshAuthChallenge): Promise<MeshAuthResponse>;
  verifyAuthResponse(challenge: MeshAuthChallenge, response: MeshAuthResponse): Promise<boolean>;
  linkDevice(otherPublicKey: string): Promise<boolean>;
  revokeDevice(publicKey: string): Promise<boolean>;
  getLinkedDevices(): string[];
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createIdentityManager(secureStorage: SecureStorage): IdentityManager {
  let _identity: DeviceIdentity | null = null;
  // Private key is kept in-memory ONLY during the session, loaded from secure storage.
  // It is NEVER exposed outside this closure.
  let _privateKey: Uint8Array | null = null;
  let _initialized = false;

  // ── Key Management (Private) ─────────────────────────────────────────────

  async function loadOrGenerateKeypair(): Promise<{
    publicKey: Uint8Array;
    privateKeyLoaded: boolean;
  }> {
    const crypto = getCryptoProvider();

    // Check for existing key
    const existingPub = await secureStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    const existingPriv = await secureStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);

    if (existingPub && existingPriv) {
      // Load existing keys
      const publicKey = hexToBytes(existingPub);
      _privateKey = hexToBytes(existingPriv);
      return { publicKey, privateKeyLoaded: true };
    }

    // Generate new keypair
    const keypair = await crypto.ed25519GenerateKeypair();
    _privateKey = keypair.privateKey;

    // Store in secure storage
    await secureStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, toHex(keypair.publicKey));
    // Private key stored in secure storage — NEVER logged or transmitted
    await secureStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, toHex(keypair.privateKey));

    return { publicKey: keypair.publicKey, privateKeyLoaded: true };
  }

  async function ensurePrivateKey(): Promise<Uint8Array> {
    if (!_privateKey) {
      const stored = await secureStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
      if (!stored) {
        throw new Error('Private key not available. Call initialize() first.');
      }
      _privateKey = hexToBytes(stored);
    }
    return _privateKey;
  }

  // ── Signing ──────────────────────────────────────────────────────────────

  async function signData(data: Uint8Array): Promise<Uint8Array> {
    const crypto = getCryptoProvider();
    const privKey = await ensurePrivateKey();
    return crypto.ed25519Sign(data, privKey);
  }

  async function verifySignature(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): Promise<boolean> {
    const crypto = getCryptoProvider();
    return crypto.ed25519Verify(data, signature, publicKey);
  }

  // ── Initialize ───────────────────────────────────────────────────────────

  async function initialize(): Promise<DeviceIdentity> {
    const { publicKey } = await loadOrGenerateKeypair();
    const publicKeyHex = toHex(publicKey);

    // Load or generate device ID
    let deviceId = await secureStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
      deviceId = generateId('dev');
      await secureStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }

    // Load or set created timestamp
    const createdAtStr = await secureStorage.getItem(STORAGE_KEYS.CREATED_AT);
    let createdAt: number;
    if (createdAtStr) {
      createdAt = parseInt(createdAtStr, 10);
    } else {
      createdAt = Date.now();
      await secureStorage.setItem(STORAGE_KEYS.CREATED_AT, createdAt.toString());
    }

    // Load linked devices
    const linkedDevicesStr = await secureStorage.getItem(STORAGE_KEYS.LINKED_DEVICES);
    const linkedDevices: string[] = linkedDevicesStr ? JSON.parse(linkedDevicesStr) : [];

    _identity = {
      publicKey: publicKeyHex,
      keyAlgorithm: IDENTITY_KEY_ALGORITHM,
      createdAt,
      deviceId,
      linkedDevices,
    };

    _initialized = true;
    return { ..._identity, linkedDevices: [..._identity.linkedDevices] };
  }

  // ── DTU Signing ──────────────────────────────────────────────────────────

  async function signDTU(dtu: DTU): Promise<DTU> {
    if (!_initialized || !_identity) {
      throw new Error('Identity not initialized. Call initialize() first.');
    }

    // Sign the content hash (the content integrity is already captured there)
    const signature = await signData(dtu.header.contentHash);

    // SECURITY: The returned DTU contains ONLY the signature and public key.
    // The private key is NEVER included in any DTU field.
    return {
      ...dtu,
      signature,
      meta: {
        ...dtu.meta,
        creatorKey: _identity.publicKey,
      },
    };
  }

  async function verifyDTUSignature(dtu: DTU, publicKey: string): Promise<boolean> {
    if (!dtu.signature) {
      return false;
    }

    const pubKeyBytes = hexToBytes(publicKey);
    return verifySignature(dtu.header.contentHash, dtu.signature, pubKeyBytes);
  }

  // ── Mesh Auth (Works Offline / No Server) ────────────────────────────────

  function createAuthChallenge(): MeshAuthChallenge {
    if (!_initialized || !_identity) {
      throw new Error('Identity not initialized. Call initialize() first.');
    }

    const crypto = getCryptoProvider();
    const nonce = crypto.randomBytes(32);

    return {
      nonce,
      timestamp: Date.now(),
      senderPublicKey: _identity.publicKey,
    };
  }

  async function respondToChallenge(challenge: MeshAuthChallenge): Promise<MeshAuthResponse> {
    if (!_initialized || !_identity) {
      throw new Error('Identity not initialized. Call initialize() first.');
    }

    // Sign the challenge nonce to prove identity
    // Concatenate nonce + timestamp + sender public key for the signed message
    const message = buildChallengeMessage(challenge);
    const signature = await signData(message);

    // SECURITY: Response contains ONLY the signature and public key.
    // No private key material is ever included.
    return {
      signature,
      publicKey: _identity.publicKey,
      nonce: challenge.nonce,
    };
  }

  async function verifyAuthResponse(
    challenge: MeshAuthChallenge,
    response: MeshAuthResponse,
  ): Promise<boolean> {
    // Verify the response was signed by the claimed public key
    // and matches our challenge nonce
    if (!constantTimeEqual(challenge.nonce, response.nonce)) {
      return false;
    }

    // Challenge must be recent (within 5 minutes)
    const age = Date.now() - challenge.timestamp;
    if (age > 5 * 60 * 1000 || age < 0) {
      return false;
    }

    // Reconstruct the signed message
    const message = buildChallengeMessage(challenge);
    const pubKeyBytes = hexToBytes(response.publicKey);
    return verifySignature(message, response.signature, pubKeyBytes);
  }

  // ── Device Linking ───────────────────────────────────────────────────────

  async function linkDevice(otherPublicKey: string): Promise<boolean> {
    if (!_initialized || !_identity) {
      throw new Error('Identity not initialized. Call initialize() first.');
    }

    // Cannot link to self
    if (otherPublicKey === _identity.publicKey) {
      return false;
    }

    // Cannot link already-linked device
    if (_identity.linkedDevices.includes(otherPublicKey)) {
      return false;
    }

    _identity.linkedDevices.push(otherPublicKey);
    await secureStorage.setItem(
      STORAGE_KEYS.LINKED_DEVICES,
      JSON.stringify(_identity.linkedDevices)
    );

    return true;
  }

  async function revokeDevice(publicKey: string): Promise<boolean> {
    if (!_initialized || !_identity) {
      throw new Error('Identity not initialized. Call initialize() first.');
    }

    const idx = _identity.linkedDevices.indexOf(publicKey);
    if (idx === -1) {
      return false;
    }

    _identity.linkedDevices.splice(idx, 1);
    await secureStorage.setItem(
      STORAGE_KEYS.LINKED_DEVICES,
      JSON.stringify(_identity.linkedDevices)
    );

    return true;
  }

  function getLinkedDevices(): string[] {
    if (!_identity) {
      return [];
    }
    return [..._identity.linkedDevices];
  }

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    initialize,
    getIdentity: () => _identity ? { ..._identity, linkedDevices: [..._identity.linkedDevices] } : null,
    isInitialized: () => _initialized,
    signDTU,
    verifyDTUSignature,
    createAuthChallenge,
    respondToChallenge,
    verifyAuthResponse,
    linkDevice,
    revokeDevice,
    getLinkedDevices,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function buildChallengeMessage(challenge: MeshAuthChallenge): Uint8Array {
  const encoder = new TextEncoder();
  const timestampBytes = encoder.encode(challenge.timestamp.toString());
  const senderKeyBytes = encoder.encode(challenge.senderPublicKey);

  const message = new Uint8Array(
    challenge.nonce.length + timestampBytes.length + senderKeyBytes.length
  );
  message.set(challenge.nonce, 0);
  message.set(timestampBytes, challenge.nonce.length);
  message.set(senderKeyBytes, challenge.nonce.length + timestampBytes.length);

  return message;
}
