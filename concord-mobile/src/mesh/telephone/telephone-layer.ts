// Concord Mobile — Telephone Layer
// V.92 modem-style encoding over voice call (landline or cellular)

import { toBase64, fromBase64, toHex } from '../../utils/crypto';
import type { DTU, AudioCodecConfig } from '../../utils/types';
import type { AudioCodec } from '../rf/audio-codec';

// ── Telephone Layer Constants ────────────────────────────────────────────────

// V.92 modem-style configuration optimized for voice channel
// - 8kHz sample rate (standard telephony)
// - Higher FEC rate for noisy phone lines
// - Shorter preamble than RF (better phone channel sync)
const TELEPHONE_CONFIG: AudioCodecConfig = {
  sampleRate: 8000,  // Standard telephony sample rate
  bitsPerSymbol: 1,
  fecRate: 0.5,      // 50% redundancy — phone lines can be noisy
  preambleMs: 150,   // V.92 negotiation preamble
};

// ── Telephone Layer Interface ────────────────────────────────────────────────

export interface TelephoneLayer {
  encodeDTUForCall(dtu: DTU): Float32Array;
  decodeDTUFromCall(audio: Float32Array): DTU | null;
  getModemConfig(): AudioCodecConfig;
}

// ── DTU Serialization for Telephone ──────────────────────────────────────────

/**
 * Compact DTU serialization for phone transmission.
 * Optimized for minimal size to reduce call duration.
 */
export function serializeDTUForPhone(dtu: DTU): Uint8Array {
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
 * Deserialize a DTU from phone compact format.
 */
export function deserializeDTUFromPhone(data: Uint8Array): DTU {
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

export function createTelephoneLayer(codec: AudioCodec): TelephoneLayer {
  return {
    encodeDTUForCall(dtu: DTU): Float32Array {
      // Step 1: Serialize DTU to compact format
      const rawBytes = serializeDTUForPhone(dtu);

      // Step 2: Apply FEC for phone-line noise resilience
      const fecBytes = codec.applyFEC(rawBytes, TELEPHONE_CONFIG.fecRate);

      // Step 3: Encode as AFSK audio samples (V.92 modem style)
      const samples = codec.encodeAFSK(fecBytes, TELEPHONE_CONFIG);

      return samples;
    },

    decodeDTUFromCall(audio: Float32Array): DTU | null {
      // Step 1: Decode AFSK from phone audio
      const { data: fecBytes } = codec.decodeAFSK(
        audio,
        TELEPHONE_CONFIG,
      );

      if (fecBytes.length === 0) {
        return null;
      }

      // Step 2: Decode FEC
      const { data: rawBytes, uncorrectable } = codec.decodeFEC(
        fecBytes,
        TELEPHONE_CONFIG.fecRate,
      );

      if (uncorrectable) {
        return null;
      }

      // Step 3: Deserialize DTU
      try {
        return deserializeDTUFromPhone(rawBytes);
      } catch {
        return null;
      }
    },

    getModemConfig(): AudioCodecConfig {
      return { ...TELEPHONE_CONFIG };
    },
  };
}
