// Concord Mobile — Audio Codec
// Shared audio codec for RF and telephone layers
// DTU <-> audio encoding with FEC (Forward Error Correction)

import { crc32, toBase64, fromBase64, toHex } from '../../utils/crypto';
import type { DTU, AudioCodecConfig, AudioEncodedDTU } from '../../utils/types';

// ── Default Configuration ────────────────────────────────────────────────────

const DEFAULT_CONFIG: AudioCodecConfig = {
  sampleRate: 8000, // 8kHz — survives AMR codec compression
  bitsPerSymbol: 1, // AFSK: 1 bit per symbol (binary FSK)
  fecRate: 0.5, // 50% redundancy for FEC
  preambleMs: 100, // 100ms preamble for synchronization
};

// ── AFSK Parameters ──────────────────────────────────────────────────────────

const AFSK_MARK_FREQ = 1200; // Hz — binary 1
const AFSK_SPACE_FREQ = 2200; // Hz — binary 0
const AFSK_BAUD_RATE = 300; // symbols/second — robust for voice channels
const AFSK_PREAMBLE_PATTERN = 0x7E; // HDLC flag for sync

// ── Audio Codec Interface ────────────────────────────────────────────────────

export interface AudioCodec {
  encode(dtu: DTU): AudioEncodedDTU;
  decode(audio: Float32Array): { dtu: DTU | null; errors: string[] };
  encodeAFSK(data: Uint8Array, config?: AudioCodecConfig): Float32Array;
  decodeAFSK(samples: Float32Array, config?: AudioCodecConfig): { data: Uint8Array; errors: string[] };
  applyFEC(data: Uint8Array, rate: number): Uint8Array;
  decodeFEC(data: Uint8Array, rate: number): { data: Uint8Array; corrected: number; uncorrectable: boolean };
}

// ── DTU Serialization for Audio ──────────────────────────────────────────────

function serializeDTUForAudio(dtu: DTU): Uint8Array {
  const json = JSON.stringify({
    id: dtu.id,
    h: {
      v: dtu.header.version,
      f: dtu.header.flags,
      t: dtu.header.type,
      ts: dtu.header.timestamp,
      cl: dtu.header.contentLength,
      ch: toHex(dtu.header.contentHash),
    },
    c: toBase64(dtu.content),
    tg: dtu.tags,
    m: dtu.meta,
  });
  return new TextEncoder().encode(json);
}

function deserializeDTUFromAudio(data: Uint8Array): DTU {
  const json = new TextDecoder().decode(data);
  const parsed = JSON.parse(json);

  const contentHashHex = parsed.h.ch as string;
  const contentHash = new Uint8Array(
    contentHashHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)),
  );

  return {
    id: parsed.id,
    header: {
      version: parsed.h.v,
      flags: parsed.h.f,
      type: parsed.h.t,
      timestamp: parsed.h.ts,
      contentLength: parsed.h.cl,
      contentHash,
    },
    content: fromBase64(parsed.c),
    tags: parsed.tg,
    meta: parsed.m,
  };
}

// ── FEC (Forward Error Correction) ───────────────────────────────────────────

/**
 * Apply Reed-Solomon-style forward error correction.
 *
 * The approach: for every block of data bytes, we append redundancy bytes.
 * The `rate` parameter controls the ratio: rate=0.5 means 50% overhead
 * (for every 2 data bytes, 1 redundancy byte is added).
 *
 * Redundancy encoding:
 * - Each block is protected by XOR-based parity bytes
 * - Interleaving: data bytes are interleaved with parity for burst error resilience
 *
 * Format:
 *   [4 bytes: original length] [4 bytes: CRC32 of original]
 *   [interleaved data + parity blocks]
 */
export function applyFEC(data: Uint8Array, rate: number): Uint8Array {
  if (rate <= 0 || rate > 1) {
    throw new Error('FEC rate must be between 0 (exclusive) and 1 (inclusive)');
  }

  const originalLength = data.length;
  const originalCrc = crc32(data);

  // Block size for parity computation
  const blockSize = Math.max(1, Math.ceil(1 / rate));
  const parityPerBlock = Math.max(1, Math.ceil(blockSize * rate));

  // Compute parity blocks
  const blocks: Uint8Array[] = [];
  const parityBlocks: Uint8Array[] = [];

  for (let i = 0; i < data.length; i += blockSize) {
    const block = data.slice(i, Math.min(i + blockSize, data.length));
    blocks.push(block);

    // Generate parity bytes using XOR combinations
    const parity = new Uint8Array(parityPerBlock);
    for (let j = 0; j < block.length; j++) {
      parity[j % parityPerBlock] ^= block[j];
      // Additional mixing for better error detection
      if (j + 1 < block.length) {
        parity[(j + 1) % parityPerBlock] ^= (block[j] << 1) | (block[j] >> 7);
      }
    }
    parityBlocks.push(parity);
  }

  // Assemble: header + interleaved (data block + parity block)
  const headerSize = 8; // 4 bytes length + 4 bytes CRC
  let totalSize = headerSize;
  for (let i = 0; i < blocks.length; i++) {
    totalSize += 2 + blocks[i].length + parityBlocks[i].length;
    // 2 bytes for block length prefix
  }

  const result = new Uint8Array(totalSize);
  const view = new DataView(result.buffer);

  // Write header
  view.setUint32(0, originalLength, false);
  view.setUint32(4, originalCrc, false);

  // Write interleaved blocks
  let offset = headerSize;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const parity = parityBlocks[i];

    // Block length (data portion)
    view.setUint16(offset, block.length, false);
    offset += 2;

    // Data bytes
    result.set(block, offset);
    offset += block.length;

    // Parity bytes
    result.set(parity, offset);
    offset += parity.length;
  }

  return result;
}

/**
 * Decode FEC-protected data, attempting to correct errors.
 *
 * Returns the original data, the number of corrected errors,
 * and whether uncorrectable errors were detected.
 */
export function decodeFEC(
  encoded: Uint8Array,
  rate: number,
): { data: Uint8Array; corrected: number; uncorrectable: boolean } {
  if (encoded.length < 8) {
    return { data: new Uint8Array(0), corrected: 0, uncorrectable: true };
  }

  const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
  const originalLength = view.getUint32(0, false);
  const originalCrc = view.getUint32(4, false);

  const blockSize = Math.max(1, Math.ceil(1 / rate));
  const parityPerBlock = Math.max(1, Math.ceil(blockSize * rate));

  // Extract blocks
  const dataChunks: Uint8Array[] = [];
  const parityChunks: Uint8Array[] = [];
  let offset = 8;
  let corrected = 0;

  while (offset < encoded.length) {
    if (offset + 2 > encoded.length) break;
    const blockLen = view.getUint16(offset, false);
    offset += 2;

    if (offset + blockLen + parityPerBlock > encoded.length) {
      // Truncated block - take what we can
      const available = encoded.length - offset;
      if (available > 0) {
        dataChunks.push(encoded.slice(offset, offset + Math.min(blockLen, available)));
      }
      break;
    }

    const block = encoded.slice(offset, offset + blockLen);
    offset += blockLen;

    const parity = encoded.slice(offset, offset + parityPerBlock);
    offset += parityPerBlock;

    // Verify parity
    const computedParity = new Uint8Array(parityPerBlock);
    for (let j = 0; j < block.length; j++) {
      computedParity[j % parityPerBlock] ^= block[j];
      if (j + 1 < block.length) {
        computedParity[(j + 1) % parityPerBlock] ^= (block[j] << 1) | (block[j] >> 7);
      }
    }

    // Check if parities match
    let parityMatch = true;
    for (let j = 0; j < parityPerBlock; j++) {
      if (computedParity[j] !== parity[j]) {
        parityMatch = false;
        break;
      }
    }

    if (!parityMatch) {
      // Attempt single-byte error correction using parity XOR
      const errorSyndrome = new Uint8Array(parityPerBlock);
      for (let j = 0; j < parityPerBlock; j++) {
        errorSyndrome[j] = computedParity[j] ^ parity[j];
      }

      // Try to locate and correct a single-byte error
      let correctedBlock = false;
      for (let pos = 0; pos < block.length; pos++) {
        // Try flipping each byte position
        const testBlock = new Uint8Array(block);
        testBlock[pos] ^= errorSyndrome[pos % parityPerBlock];

        const testParity = new Uint8Array(parityPerBlock);
        for (let j = 0; j < testBlock.length; j++) {
          testParity[j % parityPerBlock] ^= testBlock[j];
          if (j + 1 < testBlock.length) {
            testParity[(j + 1) % parityPerBlock] ^= (testBlock[j] << 1) | (testBlock[j] >> 7);
          }
        }

        let match = true;
        for (let j = 0; j < parityPerBlock; j++) {
          if (testParity[j] !== parity[j]) {
            match = false;
            break;
          }
        }

        if (match) {
          block.set(testBlock);
          corrected++;
          correctedBlock = true;
          break;
        }
      }

      if (!correctedBlock) {
        // Could not correct — count as error but still include data
        corrected += -1; // Will check at the end via CRC
      }
    }

    dataChunks.push(block);
    parityChunks.push(parity);
  }

  // Reassemble original data
  let totalLen = 0;
  for (const chunk of dataChunks) {
    totalLen += chunk.length;
  }

  const reassembled = new Uint8Array(Math.min(totalLen, originalLength));
  let writeOffset = 0;
  for (const chunk of dataChunks) {
    const bytesToCopy = Math.min(chunk.length, originalLength - writeOffset);
    if (bytesToCopy <= 0) break;
    reassembled.set(chunk.slice(0, bytesToCopy), writeOffset);
    writeOffset += bytesToCopy;
  }

  // Final CRC verification
  const finalCrc = crc32(reassembled);
  if (finalCrc !== originalCrc) {
    // Data is corrupt beyond recovery
    return { data: reassembled, corrected: Math.max(0, corrected), uncorrectable: true };
  }

  return { data: reassembled, corrected: Math.max(0, corrected), uncorrectable: false };
}

// ── AFSK Encoding/Decoding ───────────────────────────────────────────────────

/**
 * Encode binary data as AFSK (Audio Frequency Shift Keying) audio samples.
 *
 * Mark (1) = 1200 Hz, Space (0) = 2200 Hz
 * Each bit is encoded as a complete tone burst at the given baud rate.
 * Includes a preamble for receiver synchronization.
 */
export function encodeAFSK(
  data: Uint8Array,
  config: AudioCodecConfig = DEFAULT_CONFIG,
): Float32Array {
  const sampleRate = config.sampleRate;
  const samplesPerBit = Math.floor(sampleRate / AFSK_BAUD_RATE);
  const preambleSamples = Math.floor((config.preambleMs / 1000) * sampleRate);

  // Calculate total bits: preamble flags + data bits + CRC16 + end flag
  const preambleFlags = 8; // 8 preamble bytes
  const dataBits = data.length * 8;
  const crcBits = 16; // 16-bit CRC for frame integrity
  const endFlags = 8; // 1 end flag byte

  const totalBits = (preambleFlags * 8) + dataBits + crcBits + endFlags;
  const totalSamples = preambleSamples + (totalBits * samplesPerBit);

  const samples = new Float32Array(totalSamples);
  let sampleIndex = 0;
  let phase = 0;

  // Helper: write a single bit as a tone burst
  function writeBit(bit: number): void {
    const freq = bit === 1 ? AFSK_MARK_FREQ : AFSK_SPACE_FREQ;
    const phaseIncrement = (2 * Math.PI * freq) / sampleRate;

    for (let i = 0; i < samplesPerBit && sampleIndex < totalSamples; i++) {
      samples[sampleIndex++] = Math.sin(phase) * 0.8; // 80% amplitude
      phase += phaseIncrement;
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    }
  }

  // Helper: write a byte
  function writeByte(byte: number): void {
    for (let bit = 7; bit >= 0; bit--) {
      writeBit((byte >> bit) & 1);
    }
  }

  // Preamble: alternating tones for sync
  const preamblePhaseInc = (2 * Math.PI * AFSK_MARK_FREQ) / sampleRate;
  for (let i = 0; i < preambleSamples; i++) {
    samples[sampleIndex++] = Math.sin(phase) * 0.5;
    phase += preamblePhaseInc;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
  }

  // Preamble flags (HDLC pattern)
  for (let i = 0; i < preambleFlags; i++) {
    writeByte(AFSK_PREAMBLE_PATTERN);
  }

  // Data bytes
  for (let i = 0; i < data.length; i++) {
    writeByte(data[i]);
  }

  // CRC-16 (simple XOR-based for robustness)
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  writeByte((crc >> 8) & 0xFF);
  writeByte(crc & 0xFF);

  // End flag
  writeByte(AFSK_PREAMBLE_PATTERN);

  return samples.slice(0, sampleIndex);
}

/**
 * Decode AFSK audio samples back to binary data.
 *
 * Uses Goertzel algorithm for efficient single-frequency detection.
 */
export function decodeAFSK(
  samples: Float32Array,
  config: AudioCodecConfig = DEFAULT_CONFIG,
): { data: Uint8Array; errors: string[] } {
  const errors: string[] = [];
  const sampleRate = config.sampleRate;
  const samplesPerBit = Math.floor(sampleRate / AFSK_BAUD_RATE);
  const preambleSamples = Math.floor((config.preambleMs / 1000) * sampleRate);

  if (samples.length < preambleSamples + samplesPerBit * 8) {
    return { data: new Uint8Array(0), errors: ['Audio too short for AFSK decoding'] };
  }

  // Goertzel algorithm for frequency detection
  function goertzelMagnitude(
    buffer: Float32Array,
    startIdx: number,
    length: number,
    targetFreq: number,
  ): number {
    const k = Math.round((length * targetFreq) / sampleRate);
    const w = (2 * Math.PI * k) / length;
    const coeff = 2 * Math.cos(w);

    let s0 = 0;
    let s1 = 0;
    let s2 = 0;

    for (let i = 0; i < length && startIdx + i < buffer.length; i++) {
      s0 = buffer[startIdx + i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }

    return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
  }

  // Detect bits starting after preamble
  const bits: number[] = [];
  let sampleOffset = preambleSamples;

  while (sampleOffset + samplesPerBit <= samples.length) {
    const markMag = goertzelMagnitude(samples, sampleOffset, samplesPerBit, AFSK_MARK_FREQ);
    const spaceMag = goertzelMagnitude(samples, sampleOffset, samplesPerBit, AFSK_SPACE_FREQ);

    bits.push(markMag > spaceMag ? 1 : 0);
    sampleOffset += samplesPerBit;
  }

  // Find start of data (skip preamble flags: look for non-0x7E byte)
  let bitIndex = 0;

  // Skip preamble 0x7E patterns
  while (bitIndex + 8 <= bits.length) {
    let byte = 0;
    for (let i = 0; i < 8; i++) {
      byte = (byte << 1) | bits[bitIndex + i];
    }
    if (byte !== AFSK_PREAMBLE_PATTERN) break;
    bitIndex += 8;
  }

  // Extract data bytes until we hit end flag (0x7E) or run out of bits
  const dataBytes: number[] = [];
  while (bitIndex + 8 <= bits.length) {
    let byte = 0;
    for (let i = 0; i < 8; i++) {
      byte = (byte << 1) | bits[bitIndex + i];
    }

    // Check for end flag
    if (byte === AFSK_PREAMBLE_PATTERN && dataBytes.length > 2) {
      break;
    }

    dataBytes.push(byte);
    bitIndex += 8;
  }

  if (dataBytes.length < 3) {
    // Need at least 1 data byte + 2 CRC bytes
    return { data: new Uint8Array(0), errors: ['Insufficient data decoded from AFSK'] };
  }

  // Separate CRC from data
  const crcHigh = dataBytes[dataBytes.length - 2];
  const crcLow = dataBytes[dataBytes.length - 1];
  const receivedCrc = (crcHigh << 8) | crcLow;
  const payloadBytes = dataBytes.slice(0, dataBytes.length - 2);

  // Verify CRC
  let computedCrc = 0xFFFF;
  for (let i = 0; i < payloadBytes.length; i++) {
    computedCrc ^= payloadBytes[i];
    for (let j = 0; j < 8; j++) {
      if (computedCrc & 1) {
        computedCrc = (computedCrc >> 1) ^ 0xA001;
      } else {
        computedCrc >>= 1;
      }
    }
  }

  if (computedCrc !== receivedCrc) {
    errors.push('CRC mismatch in AFSK decoded data');
  }

  return { data: new Uint8Array(payloadBytes), errors };
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createAudioCodec(
  configOverrides?: Partial<AudioCodecConfig>,
): AudioCodec {
  const config: AudioCodecConfig = {
    ...DEFAULT_CONFIG,
    ...configOverrides,
  };

  return {
    encode(dtu: DTU): AudioEncodedDTU {
      // Step 1: Serialize DTU to bytes
      const rawBytes = serializeDTUForAudio(dtu);

      // Step 2: Apply FEC for error resilience
      const fecBytes = applyFEC(rawBytes, config.fecRate);

      // Step 3: Encode as AFSK audio
      const samples = encodeAFSK(fecBytes, config);

      const durationMs = (samples.length / config.sampleRate) * 1000;

      return {
        samples,
        durationMs,
        dtuId: dtu.id,
        fecRedundancy: config.fecRate,
      };
    },

    decode(audio: Float32Array): { dtu: DTU | null; errors: string[] } {
      const allErrors: string[] = [];

      // Step 1: Decode AFSK to bytes
      const { data: fecBytes, errors: afskErrors } = decodeAFSK(audio, config);
      allErrors.push(...afskErrors);

      if (fecBytes.length === 0) {
        return { dtu: null, errors: allErrors };
      }

      // Step 2: Decode FEC
      const { data: rawBytes, corrected, uncorrectable } = decodeFEC(fecBytes, config.fecRate);
      if (corrected > 0) {
        allErrors.push(`FEC corrected ${corrected} error(s)`);
      }
      if (uncorrectable) {
        allErrors.push('FEC detected uncorrectable errors');
        return { dtu: null, errors: allErrors };
      }

      // Step 3: Deserialize DTU
      try {
        const dtu = deserializeDTUFromAudio(rawBytes);
        return { dtu, errors: allErrors };
      } catch (e) {
        allErrors.push(`DTU deserialization failed: ${e instanceof Error ? e.message : 'unknown'}`);
        return { dtu: null, errors: allErrors };
      }
    },

    encodeAFSK(data: Uint8Array, cfgOverride?: AudioCodecConfig): Float32Array {
      return encodeAFSK(data, cfgOverride ?? config);
    },

    decodeAFSK(
      samples: Float32Array,
      cfgOverride?: AudioCodecConfig,
    ): { data: Uint8Array; errors: string[] } {
      return decodeAFSK(samples, cfgOverride ?? config);
    },

    applyFEC(data: Uint8Array, rate: number): Uint8Array {
      return applyFEC(data, rate);
    },

    decodeFEC(
      data: Uint8Array,
      rate: number,
    ): { data: Uint8Array; corrected: number; uncorrectable: boolean } {
      return decodeFEC(data, rate);
    },
  };
}
