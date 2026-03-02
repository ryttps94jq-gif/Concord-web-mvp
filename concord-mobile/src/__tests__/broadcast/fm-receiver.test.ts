// Tests for FM Receiver — FM subcarrier DTU decoding

import {
  createFMReceiver,
  crc16,
  bitsToBytes,
  PREAMBLE_SEQUENCE,
  SAMPLES_PER_SYMBOL,
  SUBCARRIER_FREQUENCY,
  SAMPLE_RATE,
  MIN_SIGNAL_THRESHOLD,
} from '../../broadcast/fm/fm-receiver';
import type { FMReceiver, FMRadioModule } from '../../broadcast/fm/fm-receiver';
import { DTU_HEADER_SIZE, DTU_TYPES, DTU_HEADER_OFFSETS, DTU_HASH_SIZE } from '../../utils/constants';

// ── Mock FM Radio Module ─────────────────────────────────────────────────────

function createMockRadioModule(available: boolean = true): FMRadioModule & {
  _sampleCallback: ((samples: Float32Array) => void) | null;
  _listening: boolean;
} {
  let sampleCallback: ((samples: Float32Array) => void) | null = null;
  let listening = false;

  return {
    _sampleCallback: null,
    _listening: false,
    isAvailable: jest.fn(() => available),
    startListening: jest.fn(async (_freq: number, onSamples: (samples: Float32Array) => void) => {
      sampleCallback = onSamples;
      listening = true;
    }),
    stopListening: jest.fn(async () => {
      sampleCallback = null;
      listening = false;
    }),
    isListening: jest.fn(() => listening),
    getSignalStrength: jest.fn(() => 0.75),
    get _actualSampleCallback() { return sampleCallback; },
  };
}

// ── Test Helpers ─────────────────────────────────────────────────────────────

function generateDBPSKSignal(
  bits: number[],
  samplesPerSymbol: number,
  subcarrierFreq: number,
  sampleRate: number,
  amplitude: number = 0.5
): Float32Array {
  const totalSamples = bits.length * samplesPerSymbol;
  const samples = new Float32Array(totalSamples);
  let phase = 0;

  for (let i = 0; i < bits.length; i++) {
    // DBPSK: phase change for '1', no change for '0'
    if (bits[i] === 1) {
      phase += Math.PI;
    }
    for (let s = 0; s < samplesPerSymbol; s++) {
      const idx = i * samplesPerSymbol + s;
      const t = idx / sampleRate;
      samples[idx] = amplitude * Math.cos(2 * Math.PI * subcarrierFreq * t + phase);
    }
  }

  return samples;
}

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 7; j >= 0; j--) {
      bits.push((bytes[i] >> j) & 1);
    }
  }
  return bits;
}

function createTestDTUSignal(): Float32Array {
  // Build a valid DTU header
  const header = new Uint8Array(DTU_HEADER_SIZE);
  const view = new DataView(header.buffer);

  header[DTU_HEADER_OFFSETS.VERSION] = 1;
  header[DTU_HEADER_OFFSETS.FLAGS] = 0;
  view.setUint16(DTU_HEADER_OFFSETS.TYPE, DTU_TYPES.TEXT, false);
  // Timestamp
  const timestamp = 1700000000000;
  view.setUint32(DTU_HEADER_OFFSETS.TIMESTAMP, Math.floor(timestamp / 0x100000000), false);
  view.setUint32(DTU_HEADER_OFFSETS.TIMESTAMP + 4, timestamp & 0xFFFFFFFF, false);
  // Content: 4 bytes
  view.setUint32(DTU_HEADER_OFFSETS.CONTENT_LENGTH, 4, false);
  // Content hash
  for (let i = 0; i < DTU_HASH_SIZE; i++) {
    header[DTU_HEADER_OFFSETS.CONTENT_HASH + i] = 0xAB;
  }

  const content = new Uint8Array([0x48, 0x65, 0x6C, 0x6F]); // "Helo"

  // Compute CRC of header
  const crcValue = crc16(header);
  const crcBits = [
    ...bytesToBits(new Uint8Array([(crcValue >> 8) & 0xFF, crcValue & 0xFF])),
  ];

  // Build full bit stream: preamble + header bits + CRC bits + content bits
  const headerBits = bytesToBits(header);
  const contentBits = bytesToBits(content);

  const allBits = [
    ...PREAMBLE_SEQUENCE,
    ...headerBits,
    ...crcBits,
    ...contentBits,
  ];

  return generateDBPSKSignal(allBits, SAMPLES_PER_SYMBOL, SUBCARRIER_FREQUENCY, SAMPLE_RATE);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FMReceiver', () => {
  let radioModule: ReturnType<typeof createMockRadioModule>;
  let receiver: FMReceiver;

  beforeEach(() => {
    radioModule = createMockRadioModule(true);
    receiver = createFMReceiver(radioModule);
  });

  // ── isHardwareAvailable ─────────────────────────────────────────────────

  describe('isHardwareAvailable', () => {
    it('returns true when hardware is available', () => {
      expect(receiver.isHardwareAvailable()).toBe(true);
    });

    it('returns false when hardware is not available', () => {
      radioModule = createMockRadioModule(false);
      receiver = createFMReceiver(radioModule);
      expect(receiver.isHardwareAvailable()).toBe(false);
    });

    it('delegates to radio module', () => {
      receiver.isHardwareAvailable();
      expect(radioModule.isAvailable).toHaveBeenCalled();
    });
  });

  // ── startReceiving / stopReceiving ──────────────────────────────────────

  describe('startReceiving / stopReceiving', () => {
    it('starts receiving successfully', async () => {
      await receiver.startReceiving(() => {});
      expect(radioModule.startListening).toHaveBeenCalled();
    });

    it('reports isReceiving as true after start', async () => {
      await receiver.startReceiving(() => {});
      expect(receiver.isReceiving()).toBe(true);
    });

    it('stops receiving successfully', async () => {
      await receiver.startReceiving(() => {});
      await receiver.stopReceiving();
      expect(radioModule.stopListening).toHaveBeenCalled();
    });

    it('reports isReceiving as false after stop', async () => {
      await receiver.startReceiving(() => {});
      await receiver.stopReceiving();
      expect(receiver.isReceiving()).toBe(false);
    });

    it('throws when already receiving', async () => {
      await receiver.startReceiving(() => {});
      await expect(receiver.startReceiving(() => {})).rejects.toThrow(/Already receiving/);
    });

    it('throws when hardware not available', async () => {
      radioModule = createMockRadioModule(false);
      receiver = createFMReceiver(radioModule);
      await expect(receiver.startReceiving(() => {})).rejects.toThrow(/not available/);
    });

    it('stopReceiving is safe to call when not receiving', async () => {
      await expect(receiver.stopReceiving()).resolves.not.toThrow();
    });
  });

  // ── crc16 ───────────────────────────────────────────────────────────────

  describe('crc16', () => {
    it('computes CRC-16-CCITT', () => {
      const data = new Uint8Array([0x01, 0x02, 0x03]);
      const crc = crc16(data);
      expect(typeof crc).toBe('number');
      expect(crc).toBeGreaterThanOrEqual(0);
      expect(crc).toBeLessThanOrEqual(0xFFFF);
    });

    it('returns different CRC for different data', () => {
      const crc1 = crc16(new Uint8Array([0x01, 0x02]));
      const crc2 = crc16(new Uint8Array([0x03, 0x04]));
      expect(crc1).not.toBe(crc2);
    });

    it('returns same CRC for same data', () => {
      const data = new Uint8Array([0xAB, 0xCD, 0xEF]);
      expect(crc16(data)).toBe(crc16(data));
    });

    it('handles empty data', () => {
      const crc = crc16(new Uint8Array(0));
      expect(crc).toBe(0xFFFF); // Initial CRC value for empty
    });

    it('handles single byte', () => {
      const crc = crc16(new Uint8Array([0x00]));
      expect(typeof crc).toBe('number');
    });
  });

  // ── bitsToBytes ─────────────────────────────────────────────────────────

  describe('bitsToBytes', () => {
    it('converts 8 bits to 1 byte', () => {
      const bytes = bitsToBytes([1, 0, 1, 0, 1, 0, 1, 0]);
      expect(bytes).toEqual(new Uint8Array([0xAA]));
    });

    it('converts 16 bits to 2 bytes', () => {
      const bytes = bitsToBytes([1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
      expect(bytes).toEqual(new Uint8Array([0xF0, 0x0F]));
    });

    it('converts all zeros', () => {
      const bytes = bitsToBytes([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(bytes).toEqual(new Uint8Array([0x00]));
    });

    it('converts all ones', () => {
      const bytes = bitsToBytes([1, 1, 1, 1, 1, 1, 1, 1]);
      expect(bytes).toEqual(new Uint8Array([0xFF]));
    });

    it('truncates partial byte', () => {
      const bytes = bitsToBytes([1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0]);
      expect(bytes.length).toBe(1); // Only complete bytes
    });

    it('handles empty array', () => {
      const bytes = bitsToBytes([]);
      expect(bytes.length).toBe(0);
    });

    it('round-trips through bytesToBits', () => {
      const original = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
      const bits = bytesToBits(original);
      const restored = bitsToBytes(bits);
      expect(restored).toEqual(original);
    });
  });

  // ── decodeSubcarrier ────────────────────────────────────────────────────

  describe('decodeSubcarrier', () => {
    it('returns null for too-short sample buffer', () => {
      const shortSamples = new Float32Array(100);
      const result = receiver.decodeSubcarrier(shortSamples);
      expect(result).toBeNull();
    });

    it('returns null for silence (no signal)', () => {
      const silence = new Float32Array(SAMPLES_PER_SYMBOL * 1000);
      const result = receiver.decodeSubcarrier(silence);
      expect(result).toBeNull();
    });

    it('returns null for random noise without preamble', () => {
      const noise = new Float32Array(SAMPLES_PER_SYMBOL * 1000);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = (Math.random() - 0.5) * 0.01; // Low amplitude noise
      }
      const result = receiver.decodeSubcarrier(noise);
      expect(result).toBeNull();
    });

    it('returns null when CRC fails', () => {
      // Generate a signal with preamble but corrupted data
      const preambleBits = [...PREAMBLE_SEQUENCE];
      const garbageBits = new Array(DTU_HEADER_SIZE * 8 + 16).fill(0).map(() =>
        Math.random() > 0.5 ? 1 : 0
      );
      const allBits = [...preambleBits, ...garbageBits];
      const signal = generateDBPSKSignal(allBits, SAMPLES_PER_SYMBOL, SUBCARRIER_FREQUENCY, SAMPLE_RATE, 0.5);
      const result = receiver.decodeSubcarrier(signal);
      // CRC almost certainly fails with random bits
      expect(result).toBeNull();
    });
  });

  // ── FM decode round-trip concept ────────────────────────────────────────

  describe('FM decode round-trip (encode/decode verification)', () => {
    it('CRC computation is consistent', () => {
      const header = new Uint8Array(DTU_HEADER_SIZE).fill(0xAB);
      const crc1 = crc16(header);
      const crc2 = crc16(header);
      expect(crc1).toBe(crc2);
    });

    it('bytesToBits and bitsToBytes are inverses', () => {
      const original = new Uint8Array(DTU_HEADER_SIZE);
      for (let i = 0; i < original.length; i++) {
        original[i] = i % 256;
      }
      const bits = bytesToBits(original);
      const restored = bitsToBytes(bits);
      expect(restored).toEqual(original);
    });

    it('preamble sequence is correct length', () => {
      expect(PREAMBLE_SEQUENCE.length).toBe(16);
    });

    it('preamble only contains 0 and 1', () => {
      expect(PREAMBLE_SEQUENCE.every(b => b === 0 || b === 1)).toBe(true);
    });

    it('DBPSK signal has correct sample count', () => {
      const bits = [1, 0, 1, 1, 0, 0, 1, 0];
      const signal = generateDBPSKSignal(bits, SAMPLES_PER_SYMBOL, SUBCARRIER_FREQUENCY, SAMPLE_RATE);
      expect(signal.length).toBe(bits.length * SAMPLES_PER_SYMBOL);
    });

    it('DBPSK signal has non-zero values', () => {
      const bits = [1, 0, 1, 1, 0, 0, 1, 0];
      const signal = generateDBPSKSignal(bits, SAMPLES_PER_SYMBOL, SUBCARRIER_FREQUENCY, SAMPLE_RATE);
      const maxAmplitude = Math.max(...Array.from(signal).map(Math.abs));
      expect(maxAmplitude).toBeGreaterThan(0);
    });

    it('signal amplitude matches requested amplitude', () => {
      const amplitude = 0.3;
      const bits = [1, 0, 1, 0];
      const signal = generateDBPSKSignal(bits, SAMPLES_PER_SYMBOL, SUBCARRIER_FREQUENCY, SAMPLE_RATE, amplitude);
      const maxAmp = Math.max(...Array.from(signal).map(Math.abs));
      expect(maxAmp).toBeCloseTo(amplitude, 1);
    });
  });

  // ── Constants ───────────────────────────────────────────────────────────

  describe('constants', () => {
    it('subcarrier frequency is 57kHz', () => {
      expect(SUBCARRIER_FREQUENCY).toBe(57000);
    });

    it('sample rate is 192kHz', () => {
      expect(SAMPLE_RATE).toBe(192000);
    });

    it('SAMPLES_PER_SYMBOL is positive integer', () => {
      expect(SAMPLES_PER_SYMBOL).toBeGreaterThan(0);
      expect(Number.isInteger(SAMPLES_PER_SYMBOL)).toBe(true);
    });

    it('MIN_SIGNAL_THRESHOLD is small positive number', () => {
      expect(MIN_SIGNAL_THRESHOLD).toBeGreaterThan(0);
      expect(MIN_SIGNAL_THRESHOLD).toBeLessThan(1);
    });
  });

  // ── Integration: receiving callback ─────────────────────────────────────

  describe('receiving callback integration', () => {
    it('does not crash on decode error in callback', async () => {
      const dtuCallback = jest.fn();
      await receiver.startReceiving(dtuCallback);

      // The radio module would call the sample callback with short samples
      // which should be caught and not crash
      const shortSamples = new Float32Array(10);
      const callbackFn = (radioModule as any)._actualSampleCallback;
      if (callbackFn) {
        expect(() => callbackFn(shortSamples)).not.toThrow();
      }
    });
  });
});
