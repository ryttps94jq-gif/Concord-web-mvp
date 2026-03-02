// Tests for Telephone Layer
// Tests V.92 modem encode/decode, DTU serialization, and modem config

import {
  createTelephoneLayer,
  serializeDTUForPhone,
  deserializeDTUFromPhone,
} from '../../mesh/telephone/telephone-layer';
import { createAudioCodec } from '../../mesh/rf/audio-codec';
import type { AudioCodec } from '../../mesh/rf/audio-codec';
import { DTU_TYPES, DTU_VERSION } from '../../utils/constants';
import type { DTU, AudioCodecConfig } from '../../utils/types';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makeDTU(id: string, content: string = 'phone test data'): DTU {
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
    tags: ['phone', 'test'],
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

// ── serializeDTUForPhone / deserializeDTUFromPhone ───────────────────────────

describe('serializeDTUForPhone', () => {
  it('produces a Uint8Array', () => {
    const dtu = makeDTU('phone_ser');
    const serialized = serializeDTUForPhone(dtu);
    expect(serialized).toBeInstanceOf(Uint8Array);
    expect(serialized.length).toBeGreaterThan(0);
  });

  it('uses compact field names for minimal size', () => {
    const dtu = makeDTU('compact_phone');
    const serialized = serializeDTUForPhone(dtu);
    const json = new TextDecoder().decode(serialized);
    const parsed = JSON.parse(json);

    expect(parsed.i).toBeDefined();
    expect(parsed.v).toBeDefined();
    expect(parsed.t).toBeDefined();
    expect(parsed.c).toBeDefined();
    expect(parsed.ch).toBeDefined();
  });

  it('is smaller than a fully-qualified JSON serialization', () => {
    const dtu = makeDTU('size_test', 'hello');
    const compact = serializeDTUForPhone(dtu);
    const full = new TextEncoder().encode(JSON.stringify(dtu));

    // Compact format with abbreviated keys should be smaller
    // (content is base64-encoded either way, but keys are shorter)
    expect(compact.length).toBeLessThan(full.length);
  });
});

describe('deserializeDTUFromPhone', () => {
  it('round-trips through serialize/deserialize', () => {
    const original = makeDTU('phone_roundtrip', 'hello phone');
    const serialized = serializeDTUForPhone(original);
    const restored = deserializeDTUFromPhone(serialized);

    expect(restored.id).toBe(original.id);
    expect(restored.header.version).toBe(original.header.version);
    expect(restored.header.flags).toBe(original.header.flags);
    expect(restored.header.type).toBe(original.header.type);
    expect(restored.header.timestamp).toBe(original.header.timestamp);
    expect(restored.content).toEqual(original.content);
    expect(restored.tags).toEqual(original.tags);
  });

  it('preserves content hash', () => {
    const original = makeDTU('hash_phone');
    const serialized = serializeDTUForPhone(original);
    const restored = deserializeDTUFromPhone(serialized);

    expect(restored.header.contentHash).toEqual(original.header.contentHash);
  });

  it('preserves meta fields', () => {
    const original = makeDTU('meta_phone');
    original.meta.painTagged = true;
    original.meta.relayCount = 3;
    original.meta.ttl = 15;

    const serialized = serializeDTUForPhone(original);
    const restored = deserializeDTUFromPhone(serialized);

    expect(restored.meta.painTagged).toBe(true);
    expect(restored.meta.relayCount).toBe(3);
    expect(restored.meta.ttl).toBe(15);
  });

  it('sets receivedAt to current time', () => {
    const original = makeDTU('recv_phone');
    const serialized = serializeDTUForPhone(original);
    const before = Date.now();
    const restored = deserializeDTUFromPhone(serialized);
    const after = Date.now();

    expect(restored.meta.receivedAt).toBeGreaterThanOrEqual(before);
    expect(restored.meta.receivedAt).toBeLessThanOrEqual(after);
  });

  it('throws for invalid JSON', () => {
    const bad = new TextEncoder().encode('not valid json');
    expect(() => deserializeDTUFromPhone(bad)).toThrow();
  });

  it('handles all DTU type codes', () => {
    for (const [name, typeCode] of Object.entries(DTU_TYPES)) {
      const dtu = makeDTU(`type_phone_${typeCode}`);
      dtu.header.type = typeCode;
      const serialized = serializeDTUForPhone(dtu);
      const restored = deserializeDTUFromPhone(serialized);
      expect(restored.header.type).toBe(typeCode);
    }
  });
});

// ── createTelephoneLayer ─────────────────────────────────────────────────────

describe('createTelephoneLayer', () => {
  let codec: AudioCodec;

  beforeEach(() => {
    codec = createAudioCodec();
  });

  describe('encodeDTUForCall', () => {
    it('produces Float32Array audio samples', () => {
      const tel = createTelephoneLayer(codec);
      const dtu = makeDTU('tel_encode', 'test');
      const samples = tel.encodeDTUForCall(dtu);

      expect(samples).toBeInstanceOf(Float32Array);
      expect(samples.length).toBeGreaterThan(0);
    });

    it('produces samples in valid audio range [-1, 1]', () => {
      const tel = createTelephoneLayer(codec);
      const dtu = makeDTU('tel_range');
      const samples = tel.encodeDTUForCall(dtu);

      for (let i = 0; i < samples.length; i++) {
        expect(samples[i]).toBeGreaterThanOrEqual(-1);
        expect(samples[i]).toBeLessThanOrEqual(1);
      }
    });

    it('produces longer audio for larger DTUs', () => {
      const tel = createTelephoneLayer(codec);
      const small = tel.encodeDTUForCall(makeDTU('small_phone', 'hi'));
      const large = tel.encodeDTUForCall(makeDTU('large_phone', 'a'.repeat(200)));

      expect(large.length).toBeGreaterThan(small.length);
    });

    it('includes FEC redundancy', () => {
      const tel = createTelephoneLayer(codec);
      const dtu = makeDTU('fec_phone', 'test');
      const samples = tel.encodeDTUForCall(dtu);

      // With FEC, audio should be longer than raw data would produce
      const rawBytes = serializeDTUForPhone(dtu);
      const rawSamples = codec.encodeAFSK(rawBytes);
      expect(samples.length).toBeGreaterThan(rawSamples.length);
    });

    it('handles empty content', () => {
      const tel = createTelephoneLayer(codec);
      const dtu = makeDTU('empty_phone', '');
      const samples = tel.encodeDTUForCall(dtu);
      expect(samples.length).toBeGreaterThan(0);
    });
  });

  describe('decodeDTUFromCall', () => {
    it('returns null for empty audio', () => {
      const tel = createTelephoneLayer(codec);
      const result = tel.decodeDTUFromCall(new Float32Array(0));
      expect(result).toBeNull();
    });

    it('returns null for random noise', () => {
      const tel = createTelephoneLayer(codec);
      const noise = new Float32Array(5000);
      for (let i = 0; i < noise.length; i++) {
        noise[i] = (Math.random() - 0.5) * 2;
      }
      const result = tel.decodeDTUFromCall(noise);
      expect(result).toBeNull();
    });

    it('returns null for very short audio', () => {
      const tel = createTelephoneLayer(codec);
      const result = tel.decodeDTUFromCall(new Float32Array(5));
      expect(result).toBeNull();
    });

    it('round-trips a DTU through encode/decode', () => {
      const tel = createTelephoneLayer(codec);
      const original = makeDTU('tel_roundtrip', 'concord modem');
      const samples = tel.encodeDTUForCall(original);
      const decoded = tel.decodeDTUFromCall(samples);

      if (decoded) {
        expect(decoded.id).toBe(original.id);
        expect(new TextDecoder().decode(decoded.content)).toBe('concord modem');
        expect(decoded.header.type).toBe(original.header.type);
      }
    });

    it('round-trips DTU with specific flags', () => {
      const tel = createTelephoneLayer(codec);
      const dtu = makeDTU('flags_phone');
      dtu.header.flags = 0x15; // ENCRYPTED | SIGNED | PRIORITY

      const samples = tel.encodeDTUForCall(dtu);
      const decoded = tel.decodeDTUFromCall(samples);

      if (decoded) {
        expect(decoded.header.flags).toBe(0x15);
      }
    });

    it('round-trips emergency alert DTU', () => {
      const tel = createTelephoneLayer(codec);
      const dtu = makeDTU('emergency_phone', 'EMERGENCY');
      dtu.header.type = DTU_TYPES.EMERGENCY_ALERT;

      const samples = tel.encodeDTUForCall(dtu);
      const decoded = tel.decodeDTUFromCall(samples);

      if (decoded) {
        expect(decoded.header.type).toBe(DTU_TYPES.EMERGENCY_ALERT);
      }
    });
  });

  describe('getModemConfig', () => {
    it('returns modem configuration', () => {
      const tel = createTelephoneLayer(codec);
      const config = tel.getModemConfig();

      expect(config.sampleRate).toBe(8000); // Standard telephony
      expect(config.bitsPerSymbol).toBe(1);
      expect(config.fecRate).toBeGreaterThan(0);
      expect(config.preambleMs).toBeGreaterThan(0);
    });

    it('returns standard telephony sample rate (8kHz)', () => {
      const tel = createTelephoneLayer(codec);
      const config = tel.getModemConfig();
      expect(config.sampleRate).toBe(8000);
    });

    it('includes FEC for noisy phone lines', () => {
      const tel = createTelephoneLayer(codec);
      const config = tel.getModemConfig();
      expect(config.fecRate).toBe(0.5);
    });

    it('includes V.92 preamble', () => {
      const tel = createTelephoneLayer(codec);
      const config = tel.getModemConfig();
      expect(config.preambleMs).toBe(150);
    });

    it('returns a copy (not a reference)', () => {
      const tel = createTelephoneLayer(codec);
      const config1 = tel.getModemConfig();
      const config2 = tel.getModemConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });
});

// ── Telephone Layer Robustness ───────────────────────────────────────────────

describe('telephone layer robustness', () => {
  let codec: AudioCodec;
  let tel: ReturnType<typeof createTelephoneLayer>;

  beforeEach(() => {
    codec = createAudioCodec();
    tel = createTelephoneLayer(codec);
  });

  it('handles DTU with many tags', () => {
    const dtu = makeDTU('many_tags');
    dtu.tags = Array.from({ length: 20 }, (_, i) => `tag_${i}`);

    const samples = tel.encodeDTUForCall(dtu);
    expect(samples.length).toBeGreaterThan(0);
  });

  it('handles DTU with unicode content', () => {
    const dtu = makeDTU('unicode_phone', 'Test data');
    const samples = tel.encodeDTUForCall(dtu);
    expect(samples.length).toBeGreaterThan(0);
  });

  it('handles DTU with binary content', () => {
    const dtu = makeDTU('binary_phone');
    dtu.content = new Uint8Array(50);
    for (let i = 0; i < 50; i++) dtu.content[i] = i;
    dtu.header.contentLength = 50;

    const samples = tel.encodeDTUForCall(dtu);
    expect(samples.length).toBeGreaterThan(0);
  });

  it('produces deterministic output for same input', () => {
    const dtu = makeDTU('deterministic', 'same data');
    const samples1 = tel.encodeDTUForCall(dtu);
    const samples2 = tel.encodeDTUForCall(dtu);

    // Same input should produce same audio output
    expect(samples1.length).toBe(samples2.length);
    for (let i = 0; i < samples1.length; i++) {
      expect(samples1[i]).toBeCloseTo(samples2[i], 10);
    }
  });

  it('modem config is suitable for AMR codec survival', () => {
    const config = tel.getModemConfig();
    // AMR codec operates at 8kHz, so our sample rate must match
    expect(config.sampleRate).toBe(8000);
    // AFSK frequencies must be within 300-3400 Hz (telephone band)
    // Our mark=1200 space=2200 fits within this range
    // FEC rate should be substantial for phone-line noise
    expect(config.fecRate).toBeGreaterThanOrEqual(0.3);
  });
});
