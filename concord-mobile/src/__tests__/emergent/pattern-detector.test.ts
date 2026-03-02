import {
  detectPatterns,
  detectTemporalBurst,
  detectGeoClusters,
  computePatternConfidence,
} from '../../emergent/pattern-detector';
import type {
  DTUStore,
  EmergentPattern,
  TemporalBurst,
  GeoCluster,
} from '../../emergent/pattern-detector';
import type { DTU, DTUHeader, DTUMeta, GeoGrid } from '../../utils/types';

// ── Test Helpers ─────────────────────────────────────────────────────────────

let idCounter = 0;

function makeDTU(overrides: Partial<{
  id: string;
  type: number;
  timestamp: number;
  tags: string[];
  geoGrid: GeoGrid | undefined;
  relayCount: number;
  scope: 'local' | 'regional' | 'national' | 'global';
}> = {}): DTU {
  idCounter++;
  const id = overrides.id ?? `dtu-${idCounter}`;
  const type = overrides.type ?? 0x0001;
  const timestamp = overrides.timestamp ?? Date.now();
  const tags = overrides.tags ?? [];
  const geoGrid = overrides.geoGrid;
  const relayCount = overrides.relayCount ?? 0;
  const scope = overrides.scope ?? 'local';

  const header: DTUHeader = {
    version: 1,
    flags: 0,
    type: type as any,
    timestamp,
    contentLength: 10,
    contentHash: new Uint8Array(32),
  };

  const meta: DTUMeta = {
    scope,
    published: true,
    painTagged: false,
    crpiScore: 0.5,
    relayCount,
    ttl: 7,
    geoGrid,
  };

  return {
    id,
    header,
    content: new Uint8Array(10),
    tags,
    meta,
  };
}

function makeStore(dtus: DTU[]): DTUStore {
  return {
    getByType(type: number): DTU[] {
      return dtus.filter((d) => d.header.type === type);
    },
    getByTags(tags: string[]): DTU[] {
      return dtus.filter((d) => d.tags.some((t) => tags.includes(t)));
    },
    size(): number {
      return dtus.length;
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pattern-detector', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  // ── detectTemporalBurst ──────────────────────────────────────────────────

  describe('detectTemporalBurst', () => {
    it('returns null when there are no DTUs', () => {
      const result = detectTemporalBurst([], 60000, 5);
      expect(result).toBeNull();
    });

    it('returns null when DTU count is below threshold', () => {
      const dtus = Array.from({ length: 3 }, (_, i) =>
        makeDTU({ timestamp: 1000 + i * 100 }),
      );
      const result = detectTemporalBurst(dtus, 60000, 5);
      expect(result).toBeNull();
    });

    it('detects a temporal burst when DTUs are clustered in time', () => {
      const baseTime = 1000000;
      // 15 DTUs within a 10-second window
      const burstDTUs = Array.from({ length: 15 }, (_, i) =>
        makeDTU({ timestamp: baseTime + i * 500 }),
      );
      // 5 DTUs spread far apart (outside the window)
      const scatteredDTUs = Array.from({ length: 5 }, (_, i) =>
        makeDTU({ timestamp: baseTime + 300000 + i * 100000 }),
      );

      const allDTUs = [...burstDTUs, ...scatteredDTUs];
      const result = detectTemporalBurst(allDTUs, 10000, 10);

      expect(result).not.toBeNull();
      expect(result!.count).toBeGreaterThanOrEqual(10);
      expect(result!.rate).toBeGreaterThan(0);
      expect(result!.windowEnd - result!.windowStart).toBeLessThanOrEqual(10000);
    });

    it('identifies the dominant type within the burst window', () => {
      const baseTime = 5000000;
      const dtus = [
        ...Array.from({ length: 8 }, (_, i) =>
          makeDTU({ timestamp: baseTime + i * 100, type: 0x0002 }),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          makeDTU({ timestamp: baseTime + i * 100, type: 0x0001 }),
        ),
      ];

      const result = detectTemporalBurst(dtus, 5000, 10);
      expect(result).not.toBeNull();
      expect(result!.dominantType).toBe(0x0002);
    });

    it('identifies dominant tags within the burst window', () => {
      const baseTime = 9000000;
      const dtus = Array.from({ length: 12 }, (_, i) =>
        makeDTU({
          timestamp: baseTime + i * 50,
          tags: i < 8 ? ['emergency', 'alert'] : ['info'],
        }),
      );

      const result = detectTemporalBurst(dtus, 5000, 10);
      expect(result).not.toBeNull();
      expect(result!.dominantTags).toContain('emergency');
    });

    it('returns the best window when multiple bursts exist', () => {
      const baseTime = 1000000;
      // Small burst: 6 DTUs in 1 second
      const smallBurst = Array.from({ length: 6 }, (_, i) =>
        makeDTU({ timestamp: baseTime + i * 100 }),
      );
      // Large burst: 12 DTUs in 2 seconds
      const largeBurst = Array.from({ length: 12 }, (_, i) =>
        makeDTU({ timestamp: baseTime + 100000 + i * 150 }),
      );

      const allDTUs = [...smallBurst, ...largeBurst];
      const result = detectTemporalBurst(allDTUs, 5000, 5);

      expect(result).not.toBeNull();
      expect(result!.count).toBe(12);
    });

    it('handles DTUs all at the same timestamp', () => {
      const dtus = Array.from({ length: 10 }, () =>
        makeDTU({ timestamp: 5000000 }),
      );

      const result = detectTemporalBurst(dtus, 1000, 5);
      expect(result).not.toBeNull();
      expect(result!.count).toBe(10);
      expect(result!.windowStart).toBe(result!.windowEnd);
    });
  });

  // ── detectGeoClusters ────────────────────────────────────────────────────

  describe('detectGeoClusters', () => {
    it('returns empty array when no DTUs have geo data', () => {
      const dtus = Array.from({ length: 5 }, () => makeDTU());
      const result = detectGeoClusters(dtus, 500);
      expect(result).toEqual([]);
    });

    it('returns empty array when clusters are too small', () => {
      const dtus = [
        makeDTU({ geoGrid: { lat: 40.0, lon: -74.0 } }),
        makeDTU({ geoGrid: { lat: 40.0, lon: -74.0 } }),
      ];
      const result = detectGeoClusters(dtus, 500);
      // MIN_CLUSTER_SIZE is 3, so 2 DTUs should not form a cluster
      expect(result).toEqual([]);
    });

    it('detects a single geographic cluster', () => {
      const dtus = Array.from({ length: 5 }, (_, i) =>
        makeDTU({
          geoGrid: { lat: 40.0 + i * 0.0001, lon: -74.0 + i * 0.0001 },
          tags: ['cluster-a'],
        }),
      );

      const result = detectGeoClusters(dtus, 500);
      expect(result.length).toBeGreaterThanOrEqual(1);

      const cluster = result[0];
      expect(cluster.dtuCount).toBeGreaterThanOrEqual(3);
      expect(cluster.centroid.lat).toBeCloseTo(40.0, 1);
      expect(cluster.centroid.lon).toBeCloseTo(-74.0, 1);
      expect(cluster.tags).toContain('cluster-a');
    });

    it('detects multiple distinct geographic clusters', () => {
      // Cluster near NYC
      const nyc = Array.from({ length: 4 }, (_, i) =>
        makeDTU({
          geoGrid: { lat: 40.7128 + i * 0.0001, lon: -74.006 + i * 0.0001 },
        }),
      );
      // Cluster near London (far away)
      const london = Array.from({ length: 4 }, (_, i) =>
        makeDTU({
          geoGrid: { lat: 51.5074 + i * 0.0001, lon: -0.1278 + i * 0.0001 },
        }),
      );

      const result = detectGeoClusters([...nyc, ...london], 500);
      expect(result.length).toBe(2);
    });

    it('sorts clusters by size descending', () => {
      const large = Array.from({ length: 8 }, (_, i) =>
        makeDTU({
          geoGrid: { lat: 10.0 + i * 0.0001, lon: 20.0 + i * 0.0001 },
        }),
      );
      const small = Array.from({ length: 4 }, (_, i) =>
        makeDTU({
          geoGrid: { lat: 50.0 + i * 0.0001, lon: 60.0 + i * 0.0001 },
        }),
      );

      const result = detectGeoClusters([...small, ...large], 500);
      expect(result.length).toBe(2);
      expect(result[0].dtuCount).toBeGreaterThanOrEqual(result[1].dtuCount);
    });

    it('computes cluster radius from centroid', () => {
      const dtus = Array.from({ length: 5 }, (_, i) =>
        makeDTU({
          geoGrid: { lat: 35.0 + i * 0.001, lon: 139.0 + i * 0.001 },
        }),
      );

      const result = detectGeoClusters(dtus, 1000);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].radiusMeters).toBeGreaterThan(0);
    });

    it('collects all tags from DTUs in the cluster', () => {
      const dtus = [
        makeDTU({ geoGrid: { lat: 30.0, lon: 30.0 }, tags: ['alpha'] }),
        makeDTU({ geoGrid: { lat: 30.0, lon: 30.0 }, tags: ['beta'] }),
        makeDTU({ geoGrid: { lat: 30.0, lon: 30.0 }, tags: ['alpha', 'gamma'] }),
      ];

      const result = detectGeoClusters(dtus, 500);
      expect(result.length).toBe(1);
      expect(result[0].tags).toContain('alpha');
      expect(result[0].tags).toContain('beta');
      expect(result[0].tags).toContain('gamma');
    });
  });

  // ── computePatternConfidence ─────────────────────────────────────────────

  describe('computePatternConfidence', () => {
    it('returns 0 for a pattern with no sample size and old detection', () => {
      const pattern: EmergentPattern = {
        kind: 'temporal_burst',
        detectedAt: 0, // very old
        confidence: 0,
        sampleSize: 0,
        summary: 'test',
        relatedDTUIds: [],
        metadata: {},
      };

      const score = computePatternConfidence(pattern);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeCloseTo(0, 1);
    });

    it('returns higher confidence for larger sample sizes', () => {
      const now = Date.now();
      const small: EmergentPattern = {
        kind: 'geo_cluster',
        detectedAt: now,
        confidence: 0,
        sampleSize: 5,
        summary: 'test',
        relatedDTUIds: ['a', 'b', 'c'],
        metadata: {},
      };
      const large: EmergentPattern = {
        kind: 'geo_cluster',
        detectedAt: now,
        confidence: 0,
        sampleSize: 500,
        summary: 'test',
        relatedDTUIds: ['a', 'b', 'c', 'd', 'e'],
        metadata: {},
      };

      expect(computePatternConfidence(large)).toBeGreaterThan(
        computePatternConfidence(small),
      );
    });

    it('returns higher confidence for more recent patterns', () => {
      const now = Date.now();
      const recent: EmergentPattern = {
        kind: 'tag_convergence',
        detectedAt: now,
        confidence: 0,
        sampleSize: 50,
        summary: 'test',
        relatedDTUIds: Array.from({ length: 10 }, (_, i) => `id-${i}`),
        metadata: {},
      };
      const old: EmergentPattern = {
        kind: 'tag_convergence',
        detectedAt: now - 10 * 60 * 60 * 1000, // 10 hours ago
        confidence: 0,
        sampleSize: 50,
        summary: 'test',
        relatedDTUIds: Array.from({ length: 10 }, (_, i) => `id-${i}`),
        metadata: {},
      };

      expect(computePatternConfidence(recent)).toBeGreaterThan(
        computePatternConfidence(old),
      );
    });

    it('clamps confidence between 0 and 1', () => {
      const now = Date.now();
      const pattern: EmergentPattern = {
        kind: 'relay_cascade',
        detectedAt: now,
        confidence: 0,
        sampleSize: 100000,
        summary: 'test',
        relatedDTUIds: Array.from({ length: 1000 }, (_, i) => `id-${i}`),
        metadata: {},
      };

      const score = computePatternConfidence(pattern);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('considers related DTU density in scoring', () => {
      const now = Date.now();
      const dense: EmergentPattern = {
        kind: 'temporal_burst',
        detectedAt: now,
        confidence: 0,
        sampleSize: 10,
        summary: 'test',
        relatedDTUIds: Array.from({ length: 10 }, (_, i) => `id-${i}`),
        metadata: {},
      };
      const sparse: EmergentPattern = {
        kind: 'temporal_burst',
        detectedAt: now,
        confidence: 0,
        sampleSize: 10,
        summary: 'test',
        relatedDTUIds: ['id-1'],
        metadata: {},
      };

      expect(computePatternConfidence(dense)).toBeGreaterThan(
        computePatternConfidence(sparse),
      );
    });
  });

  // ── detectPatterns (full scan) ───────────────────────────────────────────

  describe('detectPatterns', () => {
    it('returns empty array for an empty store', () => {
      const store = makeStore([]);
      const result = detectPatterns(store);
      expect(result).toEqual([]);
    });

    it('detects temporal burst patterns from the store', () => {
      const baseTime = Date.now();
      const burstDTUs = Array.from({ length: 15 }, (_, i) =>
        makeDTU({ timestamp: baseTime + i * 100, type: 0x0001 }),
      );
      const store = makeStore(burstDTUs);
      const patterns = detectPatterns(store);

      const bursts = patterns.filter((p) => p.kind === 'temporal_burst');
      expect(bursts.length).toBeGreaterThanOrEqual(1);
    });

    it('detects geo cluster patterns from the store', () => {
      const dtus = Array.from({ length: 5 }, (_, i) =>
        makeDTU({
          geoGrid: { lat: 40.0 + i * 0.0001, lon: -74.0 + i * 0.0001 },
          type: 0x0001,
        }),
      );
      const store = makeStore(dtus);
      const patterns = detectPatterns(store);

      const geoClusters = patterns.filter((p) => p.kind === 'geo_cluster');
      expect(geoClusters.length).toBeGreaterThanOrEqual(1);
    });

    it('detects tag convergence patterns', () => {
      const dtus = Array.from({ length: 8 }, (_, i) =>
        makeDTU({
          tags: ['important-topic'],
          type: 0x0001,
          timestamp: Date.now() + i * 1000,
        }),
      );
      const store = makeStore(dtus);
      const patterns = detectPatterns(store);

      const tagPatterns = patterns.filter((p) => p.kind === 'tag_convergence');
      expect(tagPatterns.length).toBeGreaterThanOrEqual(1);
      expect(tagPatterns[0].summary).toContain('important-topic');
    });

    it('detects relay cascade patterns', () => {
      const dtus = Array.from({ length: 5 }, (_, i) =>
        makeDTU({
          relayCount: 5 + i,
          type: 0x0001,
          timestamp: Date.now() + i * 1000,
        }),
      );
      const store = makeStore(dtus);
      const patterns = detectPatterns(store);

      const cascades = patterns.filter((p) => p.kind === 'relay_cascade');
      expect(cascades.length).toBe(1);
      expect((cascades[0].metadata as any).avgRelayCount).toBeGreaterThan(0);
    });

    it('sorts patterns by confidence descending', () => {
      const baseTime = Date.now();
      // Mix of patterns: burst + tags + geo
      const dtus = [
        ...Array.from({ length: 15 }, (_, i) =>
          makeDTU({
            timestamp: baseTime + i * 100,
            type: 0x0001,
            tags: ['convergent-tag'],
            geoGrid: { lat: 40.0 + i * 0.0001, lon: -74.0 },
            relayCount: 5,
          }),
        ),
      ];

      const store = makeStore(dtus);
      const patterns = detectPatterns(store);

      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i - 1].confidence).toBeGreaterThanOrEqual(
          patterns[i].confidence,
        );
      }
    });

    it('includes related DTU IDs in each pattern', () => {
      const dtus = Array.from({ length: 6 }, (_, i) =>
        makeDTU({
          tags: ['shared-tag'],
          type: 0x0001,
          timestamp: Date.now() + i * 100,
        }),
      );
      const store = makeStore(dtus);
      const patterns = detectPatterns(store);

      for (const pattern of patterns) {
        expect(pattern.relatedDTUIds.length).toBeGreaterThan(0);
        for (const id of pattern.relatedDTUIds) {
          expect(typeof id).toBe('string');
        }
      }
    });

    it('handles store with single DTU without crashing', () => {
      const store = makeStore([makeDTU({ type: 0x0001 })]);
      const patterns = detectPatterns(store);
      // Single DTU should not trigger any patterns
      expect(patterns).toEqual([]);
    });

    it('handles DTUs across multiple types', () => {
      const baseTime = Date.now();
      const dtus = [
        ...Array.from({ length: 6 }, (_, i) =>
          makeDTU({ type: 0x0001, timestamp: baseTime + i * 50, tags: ['common'] }),
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          makeDTU({ type: 0x0002, timestamp: baseTime + i * 50, tags: ['common'] }),
        ),
      ];

      const store = makeStore(dtus);
      const patterns = detectPatterns(store);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });
});
