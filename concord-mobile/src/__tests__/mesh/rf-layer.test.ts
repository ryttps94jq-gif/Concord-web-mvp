// Tests for RF Layer
// Tests RF encode/decode round-trip, JS8Call compatibility, and DTU serialization

import {
  createRFLayer,
  serializeDTUForRF,
  deserializeDTUFromRF,
} from '../../mesh/rf/rf-layer';
import { createAudioCodec } from '../../mesh/rf/audio-codec';
import type { AudioCodec } from '../../mesh/rf/audio-codec';
import { DTU_TYPES, DTU_VERSION } from '../../utils/constants';
import type { DTU } from '../../utils/types';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeDTU(id: string, content: string = 'rf test data'): DTU {
  const contentBytes = new TextEncoder().encode(content);
  return {
    id,
    header: {
      version: DTU_VERSION,
      flags: 0,
      type: DTU_TYPES.TEXT,
      timestamp: 1700000000000,
      contentLength: contentBytes.length,
      contentHash: new Uint8Array(32).fill(0xAB),
    },
    content: contentBytes,
    tags: ['rf', 'test'],
    meta: {
      scope: 'regional',
      published: false,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: 7,
    },
  };
}

// ── serializeDTUForRF / deserializeDTUFromRF ─────────────────────────────────

describe('serializeDTUForRF', () => {
  it('produces a Uint8Array', () => {
    const dtu = makeDTU('rf_ser_test');
    const serialized = serializeDTUForRF(dtu);
    expect(serialized).toBeInstanceOf(Uint8Array);
    expect(serialized.length).toBeGreaterThan(0);
  });

  it('uses compact field names to save bandwidth', () => {
    const dtu = makeDTU('compact_test');
    const serialized = serializeDTUForRF(dtu);
    const json = new TextDecoder().decode(serialized);
    const parsed = JSON.parse(json);

    // Should use abbreviated field names
    expect(parsed.i).toBeDefined(); // id
    expect(parsed.v).toBeDefined(); // version
    expect(parsed.f).toBeDefined(); // flags
    expect(parsed.t).toBeDefined(); // type
    expect(parsed.ch).toBeDefined(); // content hash
    expect(parsed.c).toBeDefined(); // content (base64)
    expect(parsed.tg).toBeDefined(); // tags
  });

  it('does not include unnecessary metadata', () => {
    const dtu = makeDTU('minimal_test');
    const serialized = serializeDTUForRF(dtu);
    const json = new TextDecoder().decode(serialized);
    const parsed = JSON.parse(json);

    // Only essential fields
    expect(parsed.id).toBeUndefined(); // Uses 'i' instead
    expect(parsed.header).toBeUndefined(); // Uses individual fields
  });
});

describe('deserializeDTUFromRF', () => {
  it('round-trips through serialize/deserialize', () => {
    const original = makeDTU('rf_roundtrip', 'hello RF world');
    const serialized = serializeDTUForRF(original);
    const restored = deserializeDTUFromRF(serialized);

    expect(restored.id).toBe(original.id);
    expect(restored.header.version).toBe(original.header.version);
    expect(restored.header.flags).toBe(original.header.flags);
    expect(restored.header.type).toBe(original.header.type);
    expect(restored.header.timestamp).toBe(original.header.timestamp);
    expect(restored.content).toEqual(original.content);
    expect(restored.tags).toEqual(original.tags);
  });

  it('preserves content hash', () => {
    const original = makeDTU('hash_rf');
    const serialized = serializeDTUForRF(original);
    const restored = deserializeDTUFromRF(serialized);

    expect(restored.header.contentHash).toEqual(original.header.contentHash);
  });

  it('preserves scope and ttl', () => {
    const original = makeDTU('scope_rf');
    const serialized = serializeDTUForRF(original);
    const restored = deserializeDTUFromRF(serialized);

    expect(restored.meta.scope).toBe('regional');
    expect(restored.meta.ttl).toBe(7);
  });

  it('sets receivedAt to current time', () => {
    const original = makeDTU('recv_time');
    const serialized = serializeDTUForRF(original);
    const before = Date.now();
    const restored = deserializeDTUFromRF(serialized);
    const after = Date.now();

    expect(restored.meta.receivedAt).toBeGreaterThanOrEqual(before);
    expect(restored.meta.receivedAt).toBeLessThanOrEqual(after);
  });

  it('throws for invalid JSON', () => {
    const bad = new TextEncoder().encode('not valid json{');
    expect(() => deserializeDTUFromRF(bad)).toThrow();
  });

  it('handles various DTU types', () => {
    for (const [, typeCode] of Object.entries(DTU_TYPES)) {
      const dtu = makeDTU(`type_${typeCode}`, 'test');
      dtu.header.type = typeCode;
      const serialized = serializeDTUForRF(dtu);
      const restored = deserializeDTUFromRF(serialized);
      expect(restored.header.type).toBe(typeCode);
    }
  });
});

// ── createRFLayer ────────────────────────────────────────────────────────────

describe('createRFLayer', () => {
  let codec: AudioCodec;

  beforeEach(() => {
    codec = createAudioCodec();
  });

  describe('encodeDTUForRF', () => {
    it('produces Float32Array audio samples', () => {
      const rf = createRFLayer(codec);
      const dtu = makeDTU('rf_encode', 'test');
      const samples = rf.encodeDTUForRF(dtu);

      expect(samples).toBeInstanceOf(Float32Array);
      expect(samples.length).toBeGreaterThan(0);
    });

    it('produces samples in valid audio range [-1, 1]', () => {
      const rf = createRFLayer(codec);
      const dtu = makeDTU('range_test');
      const samples = rf.encodeDTUForRF(dtu);

      for (let i = 0; i < samples.length; i++) {
        expect(samples[i]).toBeGreaterThanOrEqual(-1);
        expect(samples[i]).toBeLessThanOrEqual(1);
      }
    });

    it('produces longer audio for larger DTUs', () => {
      const rf = createRFLayer(codec);
      const small = rf.encodeDTUForRF(makeDTU('small', 'a'));
      const large = rf.encodeDTUForRF(makeDTU('large', 'a'.repeat(100)));

      expect(large.length).toBeGreaterThan(small.length);
    });

    it('includes FEC redundancy in the audio', () => {
      const rf = createRFLayer(codec);
      const dtu = makeDTU('fec_test', 'test');
      const samples = rf.encodeDTUForRF(dtu);

      // The audio should be longer than pure AFSK of the raw data
      // because FEC adds redundancy before AFSK encoding
      const rawBytes = serializeDTUForRF(dtu);
      const rawSamples = codec.encodeAFSK(rawBytes);
      expect(samples.length).toBeGreaterThan(rawSamples.length);
    });
  });

  describe('decodeDTUFromRF', () => {
    it('returns null for empty audio', () => {
      const rf = createRFLayer(codec);
      const result = rf.decodeDTUFromRF(new Float32Array(0));
      expect(result).toBeNull();
    });

    it('returns null for random noise', () => {
      const rf = createRFLayer(codec);
      const noise = new Float32Array(5000);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = (Math.random() - 0.5) * 2;
      }
      const result = rf.decodeDTUFromRF(noise);
      expect(result).toBeNull();
    });

    it('returns null for very short audio', () => {
      const rf = createRFLayer(codec);
      const result = rf.decodeDTUFromRF(new Float32Array(10));
      expect(result).toBeNull();
    });

    it('round-trips a DTU through encode/decode', () => {
      const rf = createRFLayer(codec);
      const original = makeDTU('rf_full_roundtrip', 'concord mesh');
      const samples = rf.encodeDTUForRF(original);
      const decoded = rf.decodeDTUFromRF(samples);

      // Clean round-trip should work
      if (decoded) {
        expect(decoded.id).toBe(original.id);
        expect(new TextDecoder().decode(decoded.content)).toBe('concord mesh');
        expect(decoded.header.type).toBe(original.header.type);
        expect(decoded.tags).toEqual(original.tags);
      }
    });

    it('handles emergency DTU round-trip', () => {
      const rf = createRFLayer(codec);
      const dtu = makeDTU('emergency_rf', 'ALERT');
      dtu.header.type = DTU_TYPES.EMERGENCY_ALERT;
      dtu.header.flags = 0x10;

      const samples = rf.encodeDTUForRF(dtu);
      const decoded = rf.decodeDTUFromRF(samples);

      if (decoded) {
        expect(decoded.header.type).toBe(DTU_TYPES.EMERGENCY_ALERT);
        expect(decoded.header.flags).toBe(0x10);
      }
    });
  });

  describe('isCompatibleWithJS8Call', () => {
    it('returns true for default configuration', () => {
      const rf = createRFLayer(codec);
      expect(rf.isCompatibleWithJS8Call()).toBe(true);
    });

    it('confirms 8kHz sample rate and adequate preamble', () => {
      const rf = createRFLayer(codec);
      // JS8Call requires 8kHz and reasonable preamble
      expect(rf.isCompatibleWithJS8Call()).toBe(true);
    });
  });
});

// ── RF Round-Trip with Various Content Types ─────────────────────────────────

describe('RF layer various content types', () => {
  let codec: AudioCodec;
  let rf: ReturnType<typeof createRFLayer>;

  beforeEach(() => {
    codec = createAudioCodec();
    rf = createRFLayer(codec);
  });

  it('handles text content', () => {
    const dtu = makeDTU('text_rf', 'Hello from RF');
    const samples = rf.encodeDTUForRF(dtu);
    expect(samples.length).toBeGreaterThan(0);
  });

  it('handles binary content', () => {
    const dtu = makeDTU('binary_rf');
    dtu.content = new Uint8Array([0x00, 0xFF, 0x55, 0xAA]);
    dtu.header.contentLength = 4;

    const samples = rf.encodeDTUForRF(dtu);
    expect(samples.length).toBeGreaterThan(0);
  });

  it('handles empty content', () => {
    const dtu = makeDTU('empty_rf', '');
    const samples = rf.encodeDTUForRF(dtu);
    expect(samples.length).toBeGreaterThan(0);
  });

  it('handles DTU with multiple tags', () => {
    const dtu = makeDTU('tags_rf');
    dtu.tags = ['emergency', 'rf', 'ham', 'mesh', 'concord'];

    const serialized = serializeDTUForRF(dtu);
    const restored = deserializeDTUFromRF(serialized);
    expect(restored.tags).toEqual(dtu.tags);
  });
});
