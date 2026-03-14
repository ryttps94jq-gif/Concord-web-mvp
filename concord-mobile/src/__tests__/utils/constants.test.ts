// Tests for constants.ts — verify all critical constants are defined and valid

import {
  DTU_HEADER_SIZE,
  DTU_VERSION,
  DTU_MAX_CONTENT_SIZE,
  DTU_HASH_SIZE,
  DTU_GENESIS_SEED_COUNT,
  DTU_HEADER_OFFSETS,
  DTU_TYPES,
  DTU_FLAGS,
  CONCORD_BLE_SERVICE_UUID,
  BLE_MTU_DEFAULT,
  NFC_MAX_PAYLOAD_BYTES,
  LORA_MAX_PACKET_BYTES,
  DEFAULT_DTU_TTL,
  PRIORITY_DTU_TTL,
  EMERGENCY_DTU_TTL,
  MAX_RELAY_QUEUE_SIZE,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_LOW_BATTERY_INTERVAL_MS,
  HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS,
  HEARTBEAT_DORMANT_BATTERY_THRESHOLD,
  FOUNDATION_GEO_GRID_METERS,
  FOUNDATION_MAX_DTUS_PER_DAY,
  FOUNDATION_SENSOR_MAX_DTU_BYTES,
  COIN_DECIMALS,
  MIN_TRANSFER_AMOUNT,
  MAX_OFFLINE_TRANSFER_AMOUNT,
  IDENTITY_KEY_ALGORITHM,
  IDENTITY_KEY_SIZE,
  IDENTITY_SIGNATURE_SIZE,
  TRANSPORT_LAYERS,
} from '../../utils/constants';

describe('DTU Constants', () => {
  test('DTU header is 48 bytes', () => {
    expect(DTU_HEADER_SIZE).toBe(48);
  });

  test('DTU version is 1', () => {
    expect(DTU_VERSION).toBe(1);
  });

  test('DTU max content 1MB', () => {
    expect(DTU_MAX_CONTENT_SIZE).toBe(1024 * 1024);
  });

  test('SHA-256 produces 32-byte hash', () => {
    expect(DTU_HASH_SIZE).toBe(32);
  });

  test('genesis seed count is 2001', () => {
    expect(DTU_GENESIS_SEED_COUNT).toBe(2001);
  });

  test('header offsets fit within 48 bytes', () => {
    const lastOffset = DTU_HEADER_OFFSETS.CONTENT_HASH;
    const lastSize = 32; // SHA-256
    expect(lastOffset + lastSize).toBe(48);
  });

  test('all DTU type codes are unique', () => {
    const values = Object.values(DTU_TYPES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  test('all DTU flag bits are distinct powers of 2', () => {
    const values = Object.values(DTU_FLAGS);
    for (const v of values) {
      expect(v & (v - 1)).toBe(0); // power of 2 check
      expect(v).toBeGreaterThan(0);
    }
    // All bits combined should have no overlap
    let combined = 0;
    for (const v of values) {
      expect(combined & v).toBe(0); // no overlap
      combined |= v;
    }
  });
});

describe('Mesh Constants', () => {
  test('BLE service UUID is valid format', () => {
    expect(CONCORD_BLE_SERVICE_UUID).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/
    );
  });

  test('BLE MTU is 512 bytes', () => {
    expect(BLE_MTU_DEFAULT).toBe(512);
  });

  test('NFC max payload is 32KB', () => {
    expect(NFC_MAX_PAYLOAD_BYTES).toBe(32768);
  });

  test('LoRa max packet is 256 bytes', () => {
    expect(LORA_MAX_PACKET_BYTES).toBe(256);
  });

  test('TTL values are increasing: default < priority < emergency', () => {
    expect(DEFAULT_DTU_TTL).toBeLessThan(PRIORITY_DTU_TTL);
    expect(PRIORITY_DTU_TTL).toBeLessThan(EMERGENCY_DTU_TTL);
  });

  test('relay queue has max size', () => {
    expect(MAX_RELAY_QUEUE_SIZE).toBeGreaterThan(0);
  });
});

describe('Heartbeat Constants', () => {
  test('heartbeat interval is 15 seconds', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(15000);
  });

  test('intervals increase with lower battery', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);
    expect(HEARTBEAT_LOW_BATTERY_INTERVAL_MS).toBeLessThan(HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);
  });

  test('dormant threshold is 5%', () => {
    expect(HEARTBEAT_DORMANT_BATTERY_THRESHOLD).toBe(5);
  });
});

describe('Foundation Sense Constants', () => {
  test('geo grid is 100 meters', () => {
    expect(FOUNDATION_GEO_GRID_METERS).toBe(100);
  });

  test('max 10,000 DTUs per day', () => {
    expect(FOUNDATION_MAX_DTUS_PER_DAY).toBe(10000);
  });

  test('sensor DTU max 500 bytes', () => {
    expect(FOUNDATION_SENSOR_MAX_DTU_BYTES).toBe(500);
  });
});

describe('Economy Constants', () => {
  test('coin has 8 decimal places', () => {
    expect(COIN_DECIMALS).toBe(8);
  });

  test('minimum transfer is positive', () => {
    expect(MIN_TRANSFER_AMOUNT).toBeGreaterThan(0);
  });

  test('max offline transfer is 100', () => {
    expect(MAX_OFFLINE_TRANSFER_AMOUNT).toBe(100);
  });
});

describe('Identity Constants', () => {
  test('Ed25519 algorithm', () => {
    expect(IDENTITY_KEY_ALGORITHM).toBe('Ed25519');
  });

  test('key size is 32 bytes', () => {
    expect(IDENTITY_KEY_SIZE).toBe(32);
  });

  test('signature size is 64 bytes', () => {
    expect(IDENTITY_SIGNATURE_SIZE).toBe(64);
  });
});

describe('Transport Layers', () => {
  test('7 transport layers defined', () => {
    expect(Object.keys(TRANSPORT_LAYERS).length).toBe(7);
  });

  test('all layer IDs are unique', () => {
    const values = Object.values(TRANSPORT_LAYERS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  test('layer IDs are 1-7', () => {
    const values = Object.values(TRANSPORT_LAYERS);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});
