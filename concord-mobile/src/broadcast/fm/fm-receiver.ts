// Concord Mobile — FM Subcarrier DTU Receiver
// Decodes Concord DTUs embedded in FM radio subcarrier data.
// Uses BPSK/DBPSK modulation in the 57kHz SCA subcarrier band.

import type { BroadcastDTU, DTU, DTUHeader } from '../../utils/types';
import {
  DTU_HEADER_SIZE,
  DTU_HEADER_OFFSETS,
  DTU_HASH_SIZE,
} from '../../utils/constants';

// ── FM Radio Module Interface ────────────────────────────────────────────────

export interface FMRadioModule {
  isAvailable(): boolean;
  startListening(frequency: number, onSamples: (samples: Float32Array) => void): Promise<void>;
  stopListening(): Promise<void>;
  isListening(): boolean;
  getSignalStrength(): number;
}

// ── FM Receiver Interface ────────────────────────────────────────────────────

export interface FMReceiver {
  isHardwareAvailable(): boolean;
  startReceiving(onDTU: (dtu: BroadcastDTU) => void): Promise<void>;
  stopReceiving(): Promise<void>;
  isReceiving(): boolean;
  decodeSubcarrier(audioSamples: Float32Array): DTU | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SUBCARRIER_FREQUENCY = 57000;     // 57kHz SCA band
const SAMPLE_RATE = 192000;             // High sample rate for subcarrier
const PREAMBLE_SEQUENCE = [1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // 16-bit sync
const SYMBOL_RATE = 1187.5;             // baud rate (half of 2375 RDS rate)
const SAMPLES_PER_SYMBOL = Math.floor(SAMPLE_RATE / SYMBOL_RATE);
const MIN_SIGNAL_THRESHOLD = 0.05;      // Minimum amplitude to consider valid
const CRC_POLYNOMIAL = 0x1021;          // CRC-16-CCITT

// ── CRC-16 ───────────────────────────────────────────────────────────────────

function crc16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ CRC_POLYNOMIAL) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

// ── DBPSK Demodulation ───────────────────────────────────────────────────────

function demodulateDBPSK(
  samples: Float32Array,
  startIndex: number,
  numBits: number
): { bits: number[]; confidence: number } {
  const bits: number[] = [];
  let totalConfidence = 0;
  let prevPhase = 0;

  for (let i = 0; i < numBits; i++) {
    const sampleStart = startIndex + i * SAMPLES_PER_SYMBOL;
    const sampleEnd = Math.min(sampleStart + SAMPLES_PER_SYMBOL, samples.length);

    if (sampleEnd > samples.length) {
      return { bits, confidence: bits.length > 0 ? totalConfidence / bits.length : 0 };
    }

    // Compute phase using correlation with subcarrier
    let sumI = 0;
    let sumQ = 0;
    for (let s = sampleStart; s < sampleEnd; s++) {
      const t = s / SAMPLE_RATE;
      const angle = 2 * Math.PI * SUBCARRIER_FREQUENCY * t;
      sumI += samples[s] * Math.cos(angle);
      sumQ += samples[s] * Math.sin(angle);
    }

    const phase = Math.atan2(sumQ, sumI);
    const amplitude = Math.sqrt(sumI * sumI + sumQ * sumQ) / (sampleEnd - sampleStart);

    // DBPSK: bit is determined by phase change
    const phaseDiff = phase - prevPhase;
    const normalizedDiff = ((phaseDiff + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

    if (Math.abs(normalizedDiff) > Math.PI / 2) {
      bits.push(1); // Phase change = 1
    } else {
      bits.push(0); // No phase change = 0
    }

    totalConfidence += amplitude > MIN_SIGNAL_THRESHOLD ? amplitude : 0;
    prevPhase = phase;
  }

  return {
    bits,
    confidence: bits.length > 0 ? totalConfidence / bits.length : 0,
  };
}

// ── Preamble Detection ───────────────────────────────────────────────────────

function findPreamble(samples: Float32Array): number {
  // Slide through samples looking for the preamble sequence
  const maxSearch = samples.length - (PREAMBLE_SEQUENCE.length + DTU_HEADER_SIZE * 8) * SAMPLES_PER_SYMBOL;

  for (let i = 0; i < maxSearch; i += Math.floor(SAMPLES_PER_SYMBOL / 2)) {
    const { bits, confidence } = demodulateDBPSK(samples, i, PREAMBLE_SEQUENCE.length);

    if (confidence < MIN_SIGNAL_THRESHOLD) continue;

    // Check if demodulated bits match preamble
    let matches = 0;
    for (let j = 0; j < PREAMBLE_SEQUENCE.length; j++) {
      if (bits[j] === PREAMBLE_SEQUENCE[j]) matches++;
    }

    // Allow up to 2 bit errors in preamble
    if (matches >= PREAMBLE_SEQUENCE.length - 2) {
      return i + PREAMBLE_SEQUENCE.length * SAMPLES_PER_SYMBOL;
    }
  }

  return -1;
}

// ── Bits to Bytes ────────────────────────────────────────────────────────────

function bitsToBytes(bits: number[]): Uint8Array {
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i * 8 + j] & 1);
    }
    bytes[i] = byte;
  }
  return bytes;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createFMReceiver(radioModule: FMRadioModule): FMReceiver {
  let receiving = false;
  let dtuCallback: ((dtu: BroadcastDTU) => void) | null = null;
  const DEFAULT_FREQUENCY = 87.5; // MHz - default FM frequency

  function isHardwareAvailable(): boolean {
    return radioModule.isAvailable();
  }

  async function startReceiving(onDTU: (dtu: BroadcastDTU) => void): Promise<void> {
    if (receiving) {
      throw new Error('Already receiving');
    }

    if (!radioModule.isAvailable()) {
      throw new Error('FM radio hardware not available');
    }

    dtuCallback = onDTU;
    receiving = true;

    await radioModule.startListening(DEFAULT_FREQUENCY, (samples) => {
      try {
        const dtu = decodeSubcarrier(samples);
        if (dtu && dtuCallback) {
          const broadcastDTU: BroadcastDTU = {
            dtu,
            source: 'fm',
            receivedAt: Date.now(),
            signalStrength: radioModule.getSignalStrength(),
          };
          dtuCallback(broadcastDTU);
        }
      } catch {
        // Decoding errors are expected with noisy FM signals — skip silently
      }
    });
  }

  async function stopReceiving(): Promise<void> {
    if (!receiving) return;

    await radioModule.stopListening();
    receiving = false;
    dtuCallback = null;
  }

  function isReceiving(): boolean {
    return receiving && radioModule.isListening();
  }

  function decodeSubcarrier(audioSamples: Float32Array): DTU | null {
    if (audioSamples.length < SAMPLES_PER_SYMBOL * (PREAMBLE_SEQUENCE.length + DTU_HEADER_SIZE * 8)) {
      return null;
    }

    // Step 1: Find preamble
    const dataStart = findPreamble(audioSamples);
    if (dataStart < 0) {
      return null;
    }

    // Step 2: Demodulate header bits
    const headerBitCount = DTU_HEADER_SIZE * 8;
    const { bits: headerBits, confidence } = demodulateDBPSK(
      audioSamples, dataStart, headerBitCount + 16  // +16 for CRC
    );

    if (confidence < MIN_SIGNAL_THRESHOLD) {
      return null;
    }

    if (headerBits.length < headerBitCount + 16) {
      return null;
    }

    // Step 3: Convert to bytes
    const headerBytes = bitsToBytes(headerBits.slice(0, headerBitCount));
    const crcBytes = bitsToBytes(headerBits.slice(headerBitCount, headerBitCount + 16));

    // Step 4: Verify CRC
    const expectedCRC = (crcBytes[0] << 8) | crcBytes[1];
    const computedCRC = crc16(headerBytes);
    if (expectedCRC !== computedCRC) {
      return null;
    }

    // Step 5: Parse header
    const view = new DataView(headerBytes.buffer);
    const version = headerBytes[DTU_HEADER_OFFSETS.VERSION];
    const flags = headerBytes[DTU_HEADER_OFFSETS.FLAGS];
    const type = view.getUint16(DTU_HEADER_OFFSETS.TYPE, false);
    const timestampHigh = view.getUint32(DTU_HEADER_OFFSETS.TIMESTAMP, false);
    const timestampLow = view.getUint32(DTU_HEADER_OFFSETS.TIMESTAMP + 4, false);
    const timestamp = timestampHigh * 0x100000000 + timestampLow;
    const contentLength = view.getUint32(DTU_HEADER_OFFSETS.CONTENT_LENGTH, false);
    const contentHash = headerBytes.slice(
      DTU_HEADER_OFFSETS.CONTENT_HASH,
      DTU_HEADER_OFFSETS.CONTENT_HASH + DTU_HASH_SIZE
    );

    const header: DTUHeader = {
      version,
      flags,
      type: type as DTUHeader['type'],
      timestamp,
      contentLength,
      contentHash,
    };

    // Step 6: Demodulate content
    const contentStart = dataStart + (headerBitCount + 16) * SAMPLES_PER_SYMBOL;
    const contentBitCount = contentLength * 8;

    if (contentStart + contentBitCount * SAMPLES_PER_SYMBOL > audioSamples.length) {
      return null; // Not enough samples for content
    }

    const { bits: contentBits } = demodulateDBPSK(audioSamples, contentStart, contentBitCount);
    if (contentBits.length < contentBitCount) {
      return null;
    }

    const content = bitsToBytes(contentBits.slice(0, contentBitCount));

    // Step 7: Build DTU
    const dtuId = Array.from(contentHash.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const dtu: DTU = {
      id: `fm_${dtuId}`,
      header,
      content,
      tags: [],
      meta: {
        scope: 'regional',
        published: true,
        painTagged: false,
        crpiScore: 0,
        originTransport: 5, // RF transport
        relayCount: 0,
        ttl: 7,
        receivedAt: Date.now(),
      },
    };

    return dtu;
  }

  return {
    isHardwareAvailable,
    startReceiving,
    stopReceiving,
    isReceiving,
    decodeSubcarrier,
  };
}

// Export constants for testing
export {
  SUBCARRIER_FREQUENCY,
  SAMPLE_RATE,
  PREAMBLE_SEQUENCE,
  SYMBOL_RATE,
  SAMPLES_PER_SYMBOL,
  MIN_SIGNAL_THRESHOLD,
  crc16,
  bitsToBytes,
  findPreamble,
  demodulateDBPSK,
};
