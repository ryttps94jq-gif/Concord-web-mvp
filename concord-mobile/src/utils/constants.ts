// Concord Mobile — Core Constants

// ── DTU Constants ──────────────────────────────────────────────────────────────
export const DTU_HEADER_SIZE = 48;
export const DTU_VERSION = 1;
export const DTU_MAX_CONTENT_SIZE = 1024 * 1024; // 1MB max DTU content
export const DTU_HASH_ALGORITHM = 'sha256';
export const DTU_HASH_SIZE = 32; // SHA-256 produces 32 bytes
export const DTU_GENESIS_SEED_COUNT = 2001;

// DTU header field offsets (48-byte header)
export const DTU_HEADER_OFFSETS = {
  VERSION: 0,         // 1 byte  — DTU format version
  FLAGS: 1,           // 1 byte  — bitfield: encrypted, compressed, signed, pain-tagged, priority
  TYPE: 2,            // 2 bytes — DTU type code (uint16)
  TIMESTAMP: 4,       // 8 bytes — creation timestamp (uint64 ms since epoch)
  CONTENT_LENGTH: 12, // 4 bytes — content length in bytes (uint32)
  CONTENT_HASH: 16,   // 32 bytes — SHA-256 of content
} as const;

// DTU type codes
export const DTU_TYPES = {
  TEXT: 0x0001,
  KNOWLEDGE: 0x0002,
  LENS: 0x0003,
  FOUNDATION_SENSE: 0x0004,
  SHIELD_THREAT: 0x0005,
  ECONOMY_TRANSACTION: 0x0006,
  IDENTITY_ASSERTION: 0x0007,
  MESH_CONTROL: 0x0008,
  EMERGENCY_ALERT: 0x0009,
  CREATIVE_WORK: 0x000A,
  ATLAS_SIGNAL: 0x000B,
  LINEAGE_REF: 0x000C,
  BROADCAST_RELAY: 0x000D,
  SENSOR_READING: 0x000E,
} as const;

// DTU flag bits
export const DTU_FLAGS = {
  ENCRYPTED: 0x01,
  COMPRESSED: 0x02,
  SIGNED: 0x04,
  PAIN_TAGGED: 0x08,
  PRIORITY: 0x10,
  GENESIS: 0x20,
  RELAY: 0x40,
} as const;

// ── Mesh Constants ─────────────────────────────────────────────────────────────
export const CONCORD_BLE_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
export const CONCORD_BLE_DTU_HEADER_CHAR = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
export const CONCORD_BLE_DTU_CONTENT_CHAR = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
export const CONCORD_BLE_CONTROL_CHAR = '6E400004-B5A3-F393-E0A9-E50E24DCCA9E';

export const BLE_MTU_DEFAULT = 512;
export const BLE_SCAN_INTERVAL_MS = 5000;
export const BLE_DISCOVERY_TIMEOUT_MS = 30000;

export const WIFI_DIRECT_PORT = 8988;
export const WIFI_DIRECT_GROUP_TIMEOUT_MS = 30000;

export const NFC_MAX_PAYLOAD_BYTES = 32768; // 32KB NDEF limit

export const LORA_MAX_PACKET_BYTES = 256;
export const LORA_DEFAULT_SPREADING_FACTOR = 10;

// ── Mesh Relay ─────────────────────────────────────────────────────────────────
export const DEFAULT_DTU_TTL = 7;
export const PRIORITY_DTU_TTL = 15;
export const EMERGENCY_DTU_TTL = 25;
export const MAX_RELAY_QUEUE_SIZE = 1000;
export const RELAY_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Heartbeat ──────────────────────────────────────────────────────────────────
export const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
export const HEARTBEAT_LOW_BATTERY_INTERVAL_MS = 30000; // 30 seconds at <30%
export const HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS = 60000; // 60 seconds at <15%
export const HEARTBEAT_DORMANT_BATTERY_THRESHOLD = 5; // mesh dormant at <5%

// ── Foundation Sense ───────────────────────────────────────────────────────────
export const FOUNDATION_GEO_GRID_METERS = 100; // approximate area, not exact
export const FOUNDATION_MAX_DTUS_PER_DAY = 10000;
export const FOUNDATION_SENSOR_MAX_DTU_BYTES = 500;
export const FOUNDATION_SAMPLING_INTERVAL_MS = 15000; // aligned with heartbeat
export const FOUNDATION_LOW_BATTERY_MULTIPLIER = 2; // double interval below 20%

// ── Economy ────────────────────────────────────────────────────────────────────
export const COIN_DECIMALS = 8;
export const MIN_TRANSFER_AMOUNT = 0.00000001;
export const MAX_OFFLINE_TRANSFER_AMOUNT = 100; // risk window for offline
export const TRANSACTION_NONCE_BYTES = 16;

// ── Identity ───────────────────────────────────────────────────────────────────
export const IDENTITY_KEY_ALGORITHM = 'Ed25519';
export const IDENTITY_KEY_SIZE = 32;
export const IDENTITY_SIGNATURE_SIZE = 64;

// ── Shield ─────────────────────────────────────────────────────────────────────
export const SHIELD_SCAN_BATCH_SIZE = 100;
export const SHIELD_QUARANTINE_MAX_SIZE = 10000;
export const SHIELD_SIGNATURE_VERSION = 1;

// ── Brain ──────────────────────────────────────────────────────────────────────
export const BRAIN_DEFAULT_MODEL_SIZE_MB = 800; // ~1B 4-bit quantized
export const BRAIN_MAX_CONTEXT_TOKENS = 2048;
export const BRAIN_INFERENCE_TIMEOUT_MS = 30000;
export const BRAIN_MAX_MEMORY_MB = 200;

// ── Storage ────────────────────────────────────────────────────────────────────
export const STORAGE_DTU_PRUNING_AGE_DAYS = 30;
export const STORAGE_MAX_APP_SIZE_MB = 500;
export const STORAGE_DB_NAME = 'concord_lattice.db';
export const STORAGE_DB_VERSION = 1;

// ── Transport Layer IDs ────────────────────────────────────────────────────────
export const TRANSPORT_LAYERS = {
  INTERNET: 1,
  WIFI_DIRECT: 2,
  BLUETOOTH: 3,
  LORA: 4,
  RF: 5,
  TELEPHONE: 6,
  NFC: 7,
} as const;
