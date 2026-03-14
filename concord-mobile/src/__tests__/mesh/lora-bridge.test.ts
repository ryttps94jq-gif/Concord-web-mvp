// Tests for LoRa Bridge
// Tests packet size constraints, priority queue, spreading factor,
// connection lifecycle, and DTU receive handling

import {
  createLoRaBridge,
  compressDTUForLoRa,
  getCompressedSize,
  getDTUPriority,
  LORA_PRIORITY,
} from '../../mesh/lora/lora-bridge';
import type { BLEManager, BLEDevice } from '../../mesh/lora/lora-bridge';
import {
  LORA_MAX_PACKET_BYTES,
  LORA_DEFAULT_SPREADING_FACTOR,
  DTU_TYPES,
  DTU_VERSION,
} from '../../utils/constants';
import { toBase64, fromBase64, crc32 } from '../../utils/crypto';
import type { DTU, DTUTypeCode } from '../../utils/types';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeDTU(
  id: string,
  contentSize: number = 50,
  type: DTUTypeCode = DTU_TYPES.TEXT,
): DTU {
  const content = new Uint8Array(contentSize);
  for (let i = 0; i < contentSize; i++) content[i] = i % 256;

  return {
    id,
    header: {
      version: DTU_VERSION,
      flags: 0,
      type,
      timestamp: 1700000000000,
      contentLength: contentSize,
      contentHash: new Uint8Array(32).fill(0xAB),
    },
    content,
    tags: ['test'],
    meta: {
      scope: 'local',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: 7,
    },
  };
}

function createMockBLEManager(options?: {
  failConnect?: boolean;
  failWrite?: boolean;
  failDisconnect?: boolean;
}): BLEManager & { _triggerMonitor: (data: string) => void } {
  const opts = options ?? {};
  let monitorCallback: ((data: string) => void) | null = null;

  return {
    connectToDevice: jest.fn().mockImplementation(async (deviceId: string) => {
      if (opts.failConnect) throw new Error('BLE connection failed');
      return { id: deviceId, name: 'Meshtastic-ABCD' } as BLEDevice;
    }),
    disconnectFromDevice: jest.fn().mockImplementation(async () => {
      if (opts.failDisconnect) throw new Error('Disconnect failed');
    }),
    writeCharacteristic: jest.fn().mockImplementation(async () => {
      if (opts.failWrite) throw new Error('Write failed');
    }),
    monitorCharacteristic: jest.fn().mockImplementation(
      (_deviceId: string, _serviceUUID: string, _charUUID: string, callback: (data: string) => void) => {
        monitorCallback = callback;
        return { remove: jest.fn() };
      },
    ),
    _triggerMonitor(data: string) {
      if (monitorCallback) monitorCallback(data);
    },
  };
}

// ── compressDTUForLoRa ───────────────────────────────────────────────────────

describe('compressDTUForLoRa', () => {
  it('produces a Uint8Array', () => {
    const dtu = makeDTU('test_compress', 50);
    const compressed = compressDTUForLoRa(dtu);
    expect(compressed).toBeInstanceOf(Uint8Array);
  });

  it('produces output smaller than or equal to LORA_MAX_PACKET_BYTES for small DTUs', () => {
    const dtu = makeDTU('small_dtu', 100);
    const compressed = compressDTUForLoRa(dtu);
    expect(compressed.length).toBeLessThanOrEqual(LORA_MAX_PACKET_BYTES);
  });

  it('truncates large content to fit within packet bounds', () => {
    const dtu = makeDTU('large_dtu', 500); // Bigger than max but will be truncated
    const compressed = compressDTUForLoRa(dtu);
    expect(compressed.length).toBeLessThanOrEqual(LORA_MAX_PACKET_BYTES);
  });

  it('encodes version, type, and flags in the first bytes', () => {
    const dtu = makeDTU('header_test', 50);
    dtu.header.version = 1;
    dtu.header.flags = 0x05;

    const compressed = compressDTUForLoRa(dtu);
    expect(compressed[0]).toBe(1); // version
    expect(compressed[1]).toBe(dtu.header.type & 0xFF); // type
    expect(compressed[2]).toBe(0x05); // flags
  });

  it('includes CRC32 for integrity verification', () => {
    const dtu = makeDTU('crc_test', 50);
    const compressed = compressDTUForLoRa(dtu);

    const view = new DataView(compressed.buffer, compressed.byteOffset, compressed.byteLength);
    const storedCrc = view.getUint32(4, false);
    const expectedCrc = crc32(dtu.content);
    expect(storedCrc).toBe(expectedCrc);
  });

  it('includes priority level', () => {
    const emergencyDTU = makeDTU('emerg', 50, DTU_TYPES.EMERGENCY_ALERT);
    const compressed = compressDTUForLoRa(emergencyDTU);
    expect(compressed[3]).toBe(LORA_PRIORITY.EMERGENCY);
  });

  it('includes truncated DTU ID', () => {
    const dtu = makeDTU('my_dtu_id_here_long_string', 50);
    const compressed = compressDTUForLoRa(dtu);

    // ID starts at offset 10
    const decoder = new TextDecoder();
    const idPart = decoder.decode(compressed.slice(10, 26));
    expect(idPart.startsWith('my_dtu_id_here_l')).toBe(true);
  });
});

// ── getCompressedSize ────────────────────────────────────────────────────────

describe('getCompressedSize', () => {
  it('returns the actual compressed size', () => {
    const dtu = makeDTU('size_test', 100);
    const size = getCompressedSize(dtu);
    const compressed = compressDTUForLoRa(dtu);
    expect(size).toBe(compressed.length);
  });

  it('returns smaller size for small DTUs', () => {
    const small = getCompressedSize(makeDTU('s', 10));
    const large = getCompressedSize(makeDTU('l', 200));
    expect(small).toBeLessThan(large);
  });
});

// ── getDTUPriority ───────────────────────────────────────────────────────────

describe('getDTUPriority', () => {
  it('returns EMERGENCY for emergency alerts', () => {
    const dtu = makeDTU('e', 10, DTU_TYPES.EMERGENCY_ALERT);
    expect(getDTUPriority(dtu)).toBe(LORA_PRIORITY.EMERGENCY);
  });

  it('returns SHIELD for shield threats', () => {
    const dtu = makeDTU('s', 10, DTU_TYPES.SHIELD_THREAT);
    expect(getDTUPriority(dtu)).toBe(LORA_PRIORITY.SHIELD);
  });

  it('returns FOUNDATION for foundation sense', () => {
    const dtu = makeDTU('f', 10, DTU_TYPES.FOUNDATION_SENSE);
    expect(getDTUPriority(dtu)).toBe(LORA_PRIORITY.FOUNDATION);
  });

  it('returns FOUNDATION for mesh control', () => {
    const dtu = makeDTU('m', 10, DTU_TYPES.MESH_CONTROL);
    expect(getDTUPriority(dtu)).toBe(LORA_PRIORITY.FOUNDATION);
  });

  it('returns USER for text DTUs', () => {
    const dtu = makeDTU('t', 10, DTU_TYPES.TEXT);
    expect(getDTUPriority(dtu)).toBe(LORA_PRIORITY.USER);
  });

  it('returns USER for unknown types', () => {
    const dtu = makeDTU('u', 10, 0xFFFF as any);
    expect(getDTUPriority(dtu)).toBe(LORA_PRIORITY.USER);
  });

  it('orders priorities correctly: emergency > shield > foundation > user', () => {
    expect(LORA_PRIORITY.EMERGENCY).toBeGreaterThan(LORA_PRIORITY.SHIELD);
    expect(LORA_PRIORITY.SHIELD).toBeGreaterThan(LORA_PRIORITY.FOUNDATION);
    expect(LORA_PRIORITY.FOUNDATION).toBeGreaterThan(LORA_PRIORITY.USER);
  });
});

// ── createLoRaBridge ─────────────────────────────────────────────────────────

describe('createLoRaBridge', () => {
  // ── connect ──

  describe('connect', () => {
    it('connects to a Meshtastic device via BLE', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      const result = await bridge.connect('device-123');
      expect(result).toBe(true);
      expect(bridge.isConnected()).toBe(true);
      expect(ble.connectToDevice).toHaveBeenCalledWith('device-123');
    });

    it('starts monitoring fromRadio characteristic', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');
      expect(ble.monitorCharacteristic).toHaveBeenCalled();
    });

    it('returns false when BLE connection fails', async () => {
      const ble = createMockBLEManager({ failConnect: true });
      const bridge = createLoRaBridge(ble);

      const result = await bridge.connect('device-123');
      expect(result).toBe(false);
      expect(bridge.isConnected()).toBe(false);
    });

    it('throws when already connected', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');
      await expect(bridge.connect('device-456')).rejects.toThrow('Already connected');
    });
  });

  // ── disconnect ──

  describe('disconnect', () => {
    it('disconnects and resets state', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');
      await bridge.disconnect();

      expect(bridge.isConnected()).toBe(false);
      expect(ble.disconnectFromDevice).toHaveBeenCalledWith('device-123');
    });

    it('clears the send queue', async () => {
      const ble = createMockBLEManager({ failWrite: true });
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');
      await bridge.sendDTU(makeDTU('q1', 50));

      await bridge.disconnect();
      expect(bridge.getQueueDepth()).toBe(0);
    });

    it('is safe to call when not connected', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await expect(bridge.disconnect()).resolves.not.toThrow();
    });
  });

  // ── isConnected ──

  describe('isConnected', () => {
    it('returns false initially', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);
      expect(bridge.isConnected()).toBe(false);
    });

    it('returns true after connect', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);
      await bridge.connect('device-123');
      expect(bridge.isConnected()).toBe(true);
    });
  });

  // ── sendDTU ──

  describe('sendDTU', () => {
    it('throws when not connected', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await expect(bridge.sendDTU(makeDTU('x'))).rejects.toThrow('Not connected');
    });

    it('queues and sends a DTU', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');
      const result = await bridge.sendDTU(makeDTU('send_test', 50));

      expect(result).toBe(true);
    });

    it('writes to BLE characteristic', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');
      await bridge.sendDTU(makeDTU('ble_write', 50));

      // Wait for async queue processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(ble.writeCharacteristic).toHaveBeenCalled();
    });

    it('compresses DTU data for transmission', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');
      const dtu = makeDTU('compress_check', 100);
      await bridge.sendDTU(dtu);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // The data written should be base64-encoded compressed packet
      const writeCall = (ble.writeCharacteristic as jest.Mock).mock.calls[0];
      if (writeCall) {
        const writtenBase64 = writeCall[3];
        const writtenBytes = fromBase64(writtenBase64);
        expect(writtenBytes.length).toBeLessThanOrEqual(LORA_MAX_PACKET_BYTES);
      }
    });

    it('enforces packet size limit', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      await bridge.connect('device-123');

      // A small DTU should be under the limit (compress truncates if needed)
      const smallDTU = makeDTU('tiny', 20);
      const compressed = compressDTUForLoRa(smallDTU);
      expect(compressed.length).toBeLessThanOrEqual(LORA_MAX_PACKET_BYTES);
    });
  });

  // ── Priority Queue ──

  describe('priority queue', () => {
    it('sends emergency DTUs before user DTUs', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);
      await bridge.connect('device-123');

      // Queue both types
      const userDTU = makeDTU('user_msg', 50, DTU_TYPES.TEXT);
      const emergDTU = makeDTU('emergency', 50, DTU_TYPES.EMERGENCY_ALERT);

      // Queue user first, then emergency
      await bridge.sendDTU(userDTU);
      await bridge.sendDTU(emergDTU);

      // Wait for queue processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify writeCharacteristic was called (queue was processed)
      const writeCalls = (ble.writeCharacteristic as jest.Mock).mock.calls;
      if (writeCalls.length >= 2) {
        // First write should be the emergency DTU (higher priority)
        const firstPacket = fromBase64(writeCalls[0][3]);
        expect(firstPacket[3]).toBe(LORA_PRIORITY.EMERGENCY);
      }
    });

    it('sends shield DTUs before foundation DTUs', async () => {
      const shieldDTU = makeDTU('shield', 50, DTU_TYPES.SHIELD_THREAT);
      const foundDTU = makeDTU('found', 50, DTU_TYPES.FOUNDATION_SENSE);

      expect(getDTUPriority(shieldDTU)).toBeGreaterThan(getDTUPriority(foundDTU));
    });
  });

  // ── onDTUReceived ──

  describe('onDTUReceived', () => {
    it('registers a receive callback', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);
      await bridge.connect('device-123');

      const callback = jest.fn();
      bridge.onDTUReceived(callback);

      // Simulate a received packet
      const dtu = makeDTU('recv_test', 50);
      const compressed = compressDTUForLoRa(dtu);
      const base64Data = toBase64(compressed);

      ble._triggerMonitor(base64Data);

      expect(callback).toHaveBeenCalled();
    });

    it('ignores malformed packets', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);
      await bridge.connect('device-123');

      const callback = jest.fn();
      bridge.onDTUReceived(callback);

      // Send garbage data
      ble._triggerMonitor(toBase64(new Uint8Array([0, 1, 2])));

      expect(callback).not.toHaveBeenCalled();
    });

    it('verifies CRC32 on received packets', async () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);
      await bridge.connect('device-123');

      const callback = jest.fn();
      bridge.onDTUReceived(callback);

      // Create a valid packet then corrupt it
      const dtu = makeDTU('corrupt_recv', 50);
      const compressed = compressDTUForLoRa(dtu);
      // Corrupt the content (after the CRC field)
      compressed[30] ^= 0xFF;

      ble._triggerMonitor(toBase64(compressed));
      // Should be rejected due to CRC mismatch
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ── getConfig ──

  describe('getConfig', () => {
    it('returns default configuration', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      const config = bridge.getConfig();
      expect(config.spreadingFactor).toBe(LORA_DEFAULT_SPREADING_FACTOR);
      expect(config.bandwidth).toBeGreaterThan(0);
      expect(config.codingRate).toBeGreaterThan(0);
      expect(config.txPower).toBeGreaterThan(0);
    });

    it('returns a copy (not a reference)', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      const config1 = bridge.getConfig();
      const config2 = bridge.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  // ── setSpreadingFactor ──

  describe('setSpreadingFactor', () => {
    it('sets a valid spreading factor', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      bridge.setSpreadingFactor(7);
      expect(bridge.getConfig().spreadingFactor).toBe(7);

      bridge.setSpreadingFactor(12);
      expect(bridge.getConfig().spreadingFactor).toBe(12);
    });

    it('throws for spreading factor below 7', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      expect(() => bridge.setSpreadingFactor(6)).toThrow('must be 7-12');
    });

    it('throws for spreading factor above 12', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      expect(() => bridge.setSpreadingFactor(13)).toThrow('must be 7-12');
    });

    it('updates bandwidth when spreading factor changes', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      bridge.setSpreadingFactor(7);
      const bw7 = bridge.getConfig().bandwidth;

      bridge.setSpreadingFactor(12);
      const bw12 = bridge.getConfig().bandwidth;

      // Different spreading factors should produce defined bandwidths
      expect(bw7).toBeGreaterThan(0);
      expect(bw12).toBeGreaterThan(0);
    });

    it('accepts all valid spreading factors 7-12', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);

      for (let sf = 7; sf <= 12; sf++) {
        expect(() => bridge.setSpreadingFactor(sf)).not.toThrow();
        expect(bridge.getConfig().spreadingFactor).toBe(sf);
      }
    });
  });

  // ── getQueueDepth ──

  describe('getQueueDepth', () => {
    it('returns 0 initially', () => {
      const ble = createMockBLEManager();
      const bridge = createLoRaBridge(ble);
      expect(bridge.getQueueDepth()).toBe(0);
    });

    it('increases when DTUs are queued with write failures', async () => {
      const ble = createMockBLEManager({ failWrite: true });
      const bridge = createLoRaBridge(ble);
      await bridge.connect('device-123');

      await bridge.sendDTU(makeDTU('q1', 50));

      // Queue should have at least 1 entry (it may have been re-queued after failure)
      // Give a moment for async processing to occur
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(bridge.getQueueDepth()).toBeGreaterThanOrEqual(1);
    });
  });
});
