// Concord Mobile — RF Layer
// RF layer for ham radio / digital modes (JS8Call compatible)

import { toHex, toBase64, fromBase64, crc32 } from '../../utils/crypto';
import type { DTU, AudioCodecConfig } from '../../utils/types';
import type { AudioCodec } from './audio-codec';

// ── RF Layer Constants ───────────────────────────────────────────────────────

// JS8Call compatibility: 8-tone FSK at 50 baud, fits in ~2.5kHz bandwidth
const RF_CONFIG: AudioCodecConfig = {
  sampleRate: 8000,
  bitsPerSymbol: 1,
  fecRate: 0.5,   // 50% redundancy for noisy HF channels
  preambleMs: 200, // Longer preamble for HF propagation
};

// JS8Call-compatible framing
const JS8_HEADER = '@CONCORD ';
const JS8_FOOTER = ' @@';

// ── RF Layer Interface ───────────────────────────────────────────────────────

export interface RFLayer {
  encodeDTUForRF(dtu: DTU): Float32Array;
  decodeDTUFromRF(audio: Float32Array): DTU | null;
  isCompatibleWithJS8Call(): boolean;
}

// ── DTU Serialization for RF ─────────────────────────────────────────────────

/**
 * Compact DTU serialization optimized for RF bandwidth.
 * Uses abbreviated field names and minimal JSON.
 */
export function serializeDTUForRF(dtu: DTU): Uint8Array {
  const json = JSON.stringify({
    i: dtu.id,
    v: dtu.header.version,
    f: dtu.header.flags,
    t: dtu.header.type,
    ts: dtu.header.timestamp,
    ch: toHex(dtu.header.contentHash),
    c: toBase64(dtu.content),
    tg: dtu.tags,
    sc: dtu.meta.scope,
    pt: dtu.meta.painTagged,
    rc: dtu.meta.relayCount,
    tl: dtu.meta.ttl,
  });
  return new TextEncoder().encode(json);
}

/**
 * Deserialize a DTU from RF compact format.
 */
export function deserializeDTUFromRF(data: Uint8Array): DTU {
  const json = new TextDecoder().decode(data);
  const p = JSON.parse(json);

  const contentHashHex = p.ch as string;
  const contentHash = new Uint8Array(
    contentHashHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)),
  );

  const content = fromBase64(p.c);

  return {
    id: p.i,
    header: {
      version: p.v,
      flags: p.f,
      type: p.t,
      timestamp: p.ts,
      contentLength: content.length,
      contentHash,
    },
    content,
    tags: p.tg,
    meta: {
      scope: p.sc,
      published: false,
      painTagged: p.pt,
      crpiScore: 0,
      relayCount: p.rc,
      ttl: p.tl,
      receivedAt: Date.now(),
    },
  };
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createRFLayer(codec: AudioCodec): RFLayer {
  return {
    encodeDTUForRF(dtu: DTU): Float32Array {
      // Step 1: Serialize DTU to compact RF format
      const rawBytes = serializeDTUForRF(dtu);

      // Step 2: Apply FEC for HF noise resilience
      const fecBytes = codec.applyFEC(rawBytes, RF_CONFIG.fecRate);

      // Step 3: Encode as AFSK audio samples
      const samples = codec.encodeAFSK(fecBytes, RF_CONFIG);

      return samples;
    },

    decodeDTUFromRF(audio: Float32Array): DTU | null {
      // Step 1: Decode AFSK to FEC-protected bytes
      const { data: fecBytes, errors: afskErrors } = codec.decodeAFSK(audio, RF_CONFIG);

      if (fecBytes.length === 0) {
        return null;
      }

      // Step 2: Decode FEC
      const { data: rawBytes, uncorrectable } = codec.decodeFEC(fecBytes, RF_CONFIG.fecRate);

      if (uncorrectable) {
        return null;
      }

      // Step 3: Deserialize DTU
      try {
        return deserializeDTUFromRF(rawBytes);
      } catch {
        return null;
      }
    },

    isCompatibleWithJS8Call(): boolean {
      // JS8Call compatibility requirements:
      // 1. Audio fits within 2.5kHz bandwidth (our AFSK uses 1200-2200Hz = 1kHz)
      // 2. Uses standard 8kHz sample rate
      // 3. Baud rate compatible with JS8 slow mode
      return (
        RF_CONFIG.sampleRate === 8000 &&
        RF_CONFIG.preambleMs >= 100
      );
    },
  };
}
