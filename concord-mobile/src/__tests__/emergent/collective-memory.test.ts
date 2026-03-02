import {
  buildCollectiveSnapshot,
  computeDiversityScore,
  identifyKnowledgeGaps,
  prioritizeSync,
} from '../../emergent/collective-memory';
import type {
  DTUStore,
  CollectiveSnapshot,
  KnowledgeGap,
} from '../../emergent/collective-memory';
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

function makeSnapshot(overrides: Partial<CollectiveSnapshot> = {}): CollectiveSnapshot {
  return {
    nodeId: overrides.nodeId ?? 'test-node',
    createdAt: overrides.createdAt ?? Date.now(),
    totalDTUs: overrides.totalDTUs ?? 0,
    topTags: overrides.topTags ?? [],
    typeDistribution: overrides.typeDistribution ?? [],
    geoCoverage: overrides.geoCoverage ?? { gridCells: 0, boundingBox: null },
    temporalCoverage: overrides.temporalCoverage ?? {
      earliestTimestamp: 0,
      latestTimestamp: 0,
      spanMs: 0,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('collective-memory', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  // ── buildCollectiveSnapshot ──────────────────────────────────────────────

  describe('buildCollectiveSnapshot', () => {
    it('returns a snapshot with zero DTUs for an empty store', () => {
      const store = makeStore([]);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.totalDTUs).toBe(0);
      expect(snapshot.topTags).toEqual([]);
      expect(snapshot.typeDistribution).toEqual([]);
      expect(snapshot.geoCoverage.gridCells).toBe(0);
      expect(snapshot.geoCoverage.boundingBox).toBeNull();
      expect(snapshot.temporalCoverage.spanMs).toBe(0);
    });

    it('counts total DTUs correctly', () => {
      const dtus = Array.from({ length: 10 }, () => makeDTU({ type: 0x0001 }));
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.totalDTUs).toBe(10);
    });

    it('computes top tags sorted by frequency', () => {
      const dtus = [
        makeDTU({ tags: ['alpha', 'beta'], type: 0x0001 }),
        makeDTU({ tags: ['alpha', 'gamma'], type: 0x0001 }),
        makeDTU({ tags: ['alpha'], type: 0x0001 }),
        makeDTU({ tags: ['beta'], type: 0x0001 }),
      ];
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.topTags.length).toBeGreaterThanOrEqual(3);
      expect(snapshot.topTags[0].tag).toBe('alpha');
      expect(snapshot.topTags[0].count).toBe(3);
      expect(snapshot.topTags[1].tag).toBe('beta');
      expect(snapshot.topTags[1].count).toBe(2);
    });

    it('computes type distribution with relay counts', () => {
      const dtus = [
        makeDTU({ type: 0x0001, relayCount: 2 }),
        makeDTU({ type: 0x0001, relayCount: 4 }),
        makeDTU({ type: 0x0002, relayCount: 6 }),
      ];
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      const textType = snapshot.typeDistribution.find((td) => td.type === 0x0001);
      const knowledgeType = snapshot.typeDistribution.find((td) => td.type === 0x0002);

      expect(textType).toBeDefined();
      expect(textType!.count).toBe(2);
      expect(textType!.avgRelayCount).toBe(3); // (2+4)/2

      expect(knowledgeType).toBeDefined();
      expect(knowledgeType!.count).toBe(1);
      expect(knowledgeType!.avgRelayCount).toBe(6);
    });

    it('sorts type distribution by count descending', () => {
      const dtus = [
        ...Array.from({ length: 5 }, () => makeDTU({ type: 0x0002 })),
        ...Array.from({ length: 3 }, () => makeDTU({ type: 0x0001 })),
        ...Array.from({ length: 8 }, () => makeDTU({ type: 0x0003 })),
      ];
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.typeDistribution[0].type).toBe(0x0003);
      expect(snapshot.typeDistribution[0].count).toBe(8);
    });

    it('computes geographic coverage with bounding box', () => {
      const dtus = [
        makeDTU({ type: 0x0001, geoGrid: { lat: 40.0, lon: -74.0 } }),
        makeDTU({ type: 0x0001, geoGrid: { lat: 41.0, lon: -73.0 } }),
        makeDTU({ type: 0x0001, geoGrid: { lat: 39.0, lon: -75.0 } }),
      ];
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.geoCoverage.gridCells).toBeGreaterThan(0);
      expect(snapshot.geoCoverage.boundingBox).not.toBeNull();
      expect(snapshot.geoCoverage.boundingBox!.minLat).toBe(39.0);
      expect(snapshot.geoCoverage.boundingBox!.maxLat).toBe(41.0);
      expect(snapshot.geoCoverage.boundingBox!.minLon).toBe(-75.0);
      expect(snapshot.geoCoverage.boundingBox!.maxLon).toBe(-73.0);
    });

    it('returns null bounding box when no DTUs have geo data', () => {
      const dtus = [makeDTU({ type: 0x0001 }), makeDTU({ type: 0x0001 })];
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.geoCoverage.boundingBox).toBeNull();
      expect(snapshot.geoCoverage.gridCells).toBe(0);
    });

    it('computes temporal coverage span', () => {
      const dtus = [
        makeDTU({ type: 0x0001, timestamp: 1000000 }),
        makeDTU({ type: 0x0001, timestamp: 2000000 }),
        makeDTU({ type: 0x0001, timestamp: 5000000 }),
      ];
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.temporalCoverage.earliestTimestamp).toBe(1000000);
      expect(snapshot.temporalCoverage.latestTimestamp).toBe(5000000);
      expect(snapshot.temporalCoverage.spanMs).toBe(4000000);
    });

    it('sets createdAt to approximately now', () => {
      const before = Date.now();
      const snapshot = buildCollectiveSnapshot(makeStore([]));
      const after = Date.now();

      expect(snapshot.createdAt).toBeGreaterThanOrEqual(before);
      expect(snapshot.createdAt).toBeLessThanOrEqual(after);
    });

    it('does not double-count DTUs present in multiple type queries', () => {
      // If a DTU appears in getByType for its type, it should only be counted once
      const dtus = Array.from({ length: 5 }, () => makeDTU({ type: 0x0001 }));
      const store = makeStore(dtus);
      const snapshot = buildCollectiveSnapshot(store);

      expect(snapshot.totalDTUs).toBe(5);
    });
  });

  // ── computeDiversityScore ────────────────────────────────────────────────

  describe('computeDiversityScore', () => {
    it('returns 0 for an empty snapshot', () => {
      const snapshot = makeSnapshot({ totalDTUs: 0 });
      expect(computeDiversityScore(snapshot)).toBe(0);
    });

    it('returns higher score for evenly distributed types', () => {
      const even = makeSnapshot({
        totalDTUs: 40,
        typeDistribution: [
          { type: 0x0001 as any, count: 10, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 10, avgRelayCount: 1 },
          { type: 0x0003 as any, count: 10, avgRelayCount: 1 },
          { type: 0x0004 as any, count: 10, avgRelayCount: 1 },
        ],
        geoCoverage: { gridCells: 10, boundingBox: { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 } },
        temporalCoverage: { earliestTimestamp: 0, latestTimestamp: 3600000, spanMs: 3600000 },
      });

      const skewed = makeSnapshot({
        totalDTUs: 40,
        typeDistribution: [
          { type: 0x0001 as any, count: 37, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 1, avgRelayCount: 1 },
          { type: 0x0003 as any, count: 1, avgRelayCount: 1 },
          { type: 0x0004 as any, count: 1, avgRelayCount: 1 },
        ],
        geoCoverage: { gridCells: 10, boundingBox: { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 } },
        temporalCoverage: { earliestTimestamp: 0, latestTimestamp: 3600000, spanMs: 3600000 },
      });

      expect(computeDiversityScore(even)).toBeGreaterThan(
        computeDiversityScore(skewed),
      );
    });

    it('returns higher score for more geographic coverage', () => {
      const wideGeo = makeSnapshot({
        totalDTUs: 10,
        typeDistribution: [{ type: 0x0001 as any, count: 10, avgRelayCount: 1 }],
        geoCoverage: { gridCells: 50, boundingBox: { minLat: 0, maxLat: 10, minLon: 0, maxLon: 10 } },
        temporalCoverage: { earliestTimestamp: 0, latestTimestamp: 1000, spanMs: 1000 },
      });

      const narrowGeo = makeSnapshot({
        totalDTUs: 10,
        typeDistribution: [{ type: 0x0001 as any, count: 10, avgRelayCount: 1 }],
        geoCoverage: { gridCells: 1, boundingBox: { minLat: 0, maxLat: 0.01, minLon: 0, maxLon: 0.01 } },
        temporalCoverage: { earliestTimestamp: 0, latestTimestamp: 1000, spanMs: 1000 },
      });

      expect(computeDiversityScore(wideGeo)).toBeGreaterThan(
        computeDiversityScore(narrowGeo),
      );
    });

    it('returns higher score for wider temporal coverage', () => {
      const wideTime = makeSnapshot({
        totalDTUs: 10,
        typeDistribution: [{ type: 0x0001 as any, count: 10, avgRelayCount: 1 }],
        geoCoverage: { gridCells: 5, boundingBox: { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 } },
        temporalCoverage: { earliestTimestamp: 0, latestTimestamp: 86400000, spanMs: 86400000 }, // 24h
      });

      const narrowTime = makeSnapshot({
        totalDTUs: 10,
        typeDistribution: [{ type: 0x0001 as any, count: 10, avgRelayCount: 1 }],
        geoCoverage: { gridCells: 5, boundingBox: { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 } },
        temporalCoverage: { earliestTimestamp: 0, latestTimestamp: 1000, spanMs: 1000 }, // 1s
      });

      expect(computeDiversityScore(wideTime)).toBeGreaterThan(
        computeDiversityScore(narrowTime),
      );
    });

    it('returns score between 0 and 1', () => {
      const snapshot = makeSnapshot({
        totalDTUs: 1000,
        typeDistribution: Array.from({ length: 10 }, (_, i) => ({
          type: (i + 1) as any,
          count: 100,
          avgRelayCount: 5,
        })),
        geoCoverage: { gridCells: 200, boundingBox: { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 } },
        temporalCoverage: { earliestTimestamp: 0, latestTimestamp: 86400000 * 2, spanMs: 86400000 * 2 },
      });

      const score = computeDiversityScore(snapshot);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('handles single type distribution correctly', () => {
      const snapshot = makeSnapshot({
        totalDTUs: 10,
        typeDistribution: [{ type: 0x0001 as any, count: 10, avgRelayCount: 1 }],
      });

      // Single type = 0 type entropy
      const score = computeDiversityScore(snapshot);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  // ── identifyKnowledgeGaps ────────────────────────────────────────────────

  describe('identifyKnowledgeGaps', () => {
    it('returns empty array when there are no peer snapshots', () => {
      const local = makeSnapshot({ totalDTUs: 10 });
      const gaps = identifyKnowledgeGaps(local, []);
      expect(gaps).toEqual([]);
    });

    it('identifies type gaps when peers have types local node lacks', () => {
      const local = makeSnapshot({
        totalDTUs: 10,
        typeDistribution: [
          { type: 0x0001 as any, count: 10, avgRelayCount: 1 },
        ],
      });

      const peer = makeSnapshot({
        totalDTUs: 20,
        typeDistribution: [
          { type: 0x0001 as any, count: 10, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 10, avgRelayCount: 2 },
        ],
      });

      const gaps = identifyKnowledgeGaps(local, [peer]);
      const typeGaps = gaps.filter((g) => g.kind === 'type_gap');
      expect(typeGaps.length).toBeGreaterThanOrEqual(1);
      expect(typeGaps[0].description).toContain('0002');
    });

    it('identifies tag gaps when peers have tags local node lacks', () => {
      const local = makeSnapshot({
        totalDTUs: 10,
        topTags: [{ tag: 'alpha', count: 10 }],
      });

      const peer = makeSnapshot({
        totalDTUs: 20,
        topTags: [
          { tag: 'alpha', count: 10 },
          { tag: 'beta', count: 8 },
        ],
      });

      const gaps = identifyKnowledgeGaps(local, [peer]);
      const tagGaps = gaps.filter((g) => g.kind === 'tag_gap');
      expect(tagGaps.length).toBeGreaterThanOrEqual(1);
      expect(tagGaps[0].description).toContain('beta');
    });

    it('identifies geo gaps when peers cover areas local node does not', () => {
      const local = makeSnapshot({
        totalDTUs: 10,
        geoCoverage: {
          gridCells: 5,
          boundingBox: { minLat: 40.0, maxLat: 41.0, minLon: -74.0, maxLon: -73.0 },
        },
      });

      const peer = makeSnapshot({
        totalDTUs: 20,
        geoCoverage: {
          gridCells: 20,
          boundingBox: { minLat: 38.0, maxLat: 43.0, minLon: -76.0, maxLon: -71.0 },
        },
      });

      const gaps = identifyKnowledgeGaps(local, [peer]);
      const geoGaps = gaps.filter((g) => g.kind === 'geo_gap');
      expect(geoGaps.length).toBeGreaterThanOrEqual(1);
    });

    it('identifies geo gap when local has no geo data but peers do', () => {
      const local = makeSnapshot({
        totalDTUs: 5,
        geoCoverage: { gridCells: 0, boundingBox: null },
      });

      const peer = makeSnapshot({
        totalDTUs: 10,
        geoCoverage: {
          gridCells: 10,
          boundingBox: { minLat: 30.0, maxLat: 35.0, minLon: -80.0, maxLon: -75.0 },
        },
      });

      const gaps = identifyKnowledgeGaps(local, [peer]);
      const geoGaps = gaps.filter((g) => g.kind === 'geo_gap');
      expect(geoGaps.length).toBe(1);
      expect(geoGaps[0].severity).toBe(1.0);
    });

    it('identifies temporal gaps when peers have wider time coverage', () => {
      const local = makeSnapshot({
        totalDTUs: 10,
        temporalCoverage: {
          earliestTimestamp: 5000000,
          latestTimestamp: 10000000,
          spanMs: 5000000,
        },
      });

      const peer = makeSnapshot({
        totalDTUs: 20,
        temporalCoverage: {
          earliestTimestamp: 1000000,
          latestTimestamp: 15000000,
          spanMs: 14000000,
        },
      });

      const gaps = identifyKnowledgeGaps(local, [peer]);
      const temporalGaps = gaps.filter((g) => g.kind === 'temporal_gap');
      expect(temporalGaps.length).toBeGreaterThanOrEqual(1);
    });

    it('assigns severity between 0 and 1 for all gaps', () => {
      const local = makeSnapshot({
        totalDTUs: 5,
        typeDistribution: [{ type: 0x0001 as any, count: 5, avgRelayCount: 1 }],
        topTags: [{ tag: 'x', count: 2 }],
        geoCoverage: {
          gridCells: 1,
          boundingBox: { minLat: 40.0, maxLat: 40.1, minLon: -74.0, maxLon: -73.9 },
        },
        temporalCoverage: { earliestTimestamp: 5000, latestTimestamp: 10000, spanMs: 5000 },
      });

      const peer = makeSnapshot({
        totalDTUs: 100,
        typeDistribution: [
          { type: 0x0001 as any, count: 20, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 30, avgRelayCount: 2 },
          { type: 0x0003 as any, count: 50, avgRelayCount: 3 },
        ],
        topTags: [
          { tag: 'x', count: 10 },
          { tag: 'y', count: 20 },
          { tag: 'z', count: 15 },
        ],
        geoCoverage: {
          gridCells: 50,
          boundingBox: { minLat: 35.0, maxLat: 45.0, minLon: -80.0, maxLon: -70.0 },
        },
        temporalCoverage: { earliestTimestamp: 1000, latestTimestamp: 50000, spanMs: 49000 },
      });

      const gaps = identifyKnowledgeGaps(local, [peer]);
      for (const gap of gaps) {
        expect(gap.severity).toBeGreaterThanOrEqual(0);
        expect(gap.severity).toBeLessThanOrEqual(1);
      }
    });

    it('handles multiple peer snapshots by averaging', () => {
      const local = makeSnapshot({
        totalDTUs: 5,
        typeDistribution: [{ type: 0x0001 as any, count: 5, avgRelayCount: 1 }],
      });

      const peer1 = makeSnapshot({
        totalDTUs: 20,
        typeDistribution: [
          { type: 0x0001 as any, count: 10, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 10, avgRelayCount: 2 },
        ],
      });

      const peer2 = makeSnapshot({
        totalDTUs: 30,
        typeDistribution: [
          { type: 0x0001 as any, count: 10, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 20, avgRelayCount: 3 },
        ],
      });

      const gaps = identifyKnowledgeGaps(local, [peer1, peer2]);
      const typeGaps = gaps.filter((g) => g.kind === 'type_gap');
      expect(typeGaps.length).toBeGreaterThanOrEqual(1);
      // avgPeerCount for type 0x0002 should be (10+20)/2 = 15
      const gap = typeGaps.find((g) => (g.details as any).type === 0x0002);
      expect(gap).toBeDefined();
      expect((gap!.details as any).avgPeerCount).toBe(15);
    });

    it('does not flag type gaps when local has similar counts', () => {
      const local = makeSnapshot({
        totalDTUs: 10,
        typeDistribution: [
          { type: 0x0001 as any, count: 5, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 5, avgRelayCount: 1 },
        ],
      });

      const peer = makeSnapshot({
        totalDTUs: 12,
        typeDistribution: [
          { type: 0x0001 as any, count: 6, avgRelayCount: 1 },
          { type: 0x0002 as any, count: 6, avgRelayCount: 1 },
        ],
      });

      const gaps = identifyKnowledgeGaps(local, [peer]);
      const typeGaps = gaps.filter((g) => g.kind === 'type_gap');
      expect(typeGaps).toHaveLength(0);
    });
  });

  // ── prioritizeSync ───────────────────────────────────────────────────────

  describe('prioritizeSync', () => {
    it('returns empty array for empty input', () => {
      expect(prioritizeSync([])).toEqual([]);
    });

    it('sorts gaps by severity descending', () => {
      const gaps: KnowledgeGap[] = [
        { kind: 'tag_gap', description: 'low', severity: 0.2, details: {} },
        { kind: 'type_gap', description: 'high', severity: 0.9, details: {} },
        { kind: 'geo_gap', description: 'mid', severity: 0.5, details: {} },
      ];

      const sorted = prioritizeSync(gaps);
      expect(sorted[0].severity).toBe(0.9);
      expect(sorted[1].severity).toBe(0.5);
      expect(sorted[2].severity).toBe(0.2);
    });

    it('uses kind priority as tiebreaker when severities are equal', () => {
      const gaps: KnowledgeGap[] = [
        { kind: 'tag_gap', description: 'tag', severity: 0.5, details: {} },
        { kind: 'type_gap', description: 'type', severity: 0.5, details: {} },
        { kind: 'geo_gap', description: 'geo', severity: 0.5, details: {} },
        { kind: 'temporal_gap', description: 'temporal', severity: 0.5, details: {} },
      ];

      const sorted = prioritizeSync(gaps);
      expect(sorted[0].kind).toBe('type_gap');
      expect(sorted[1].kind).toBe('geo_gap');
      expect(sorted[2].kind).toBe('temporal_gap');
      expect(sorted[3].kind).toBe('tag_gap');
    });

    it('does not mutate the original array', () => {
      const gaps: KnowledgeGap[] = [
        { kind: 'tag_gap', description: 'a', severity: 0.3, details: {} },
        { kind: 'type_gap', description: 'b', severity: 0.8, details: {} },
      ];

      const original = [...gaps];
      prioritizeSync(gaps);

      expect(gaps[0].kind).toBe(original[0].kind);
      expect(gaps[1].kind).toBe(original[1].kind);
    });

    it('handles single gap', () => {
      const gaps: KnowledgeGap[] = [
        { kind: 'geo_gap', description: 'only', severity: 0.7, details: {} },
      ];

      const sorted = prioritizeSync(gaps);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].kind).toBe('geo_gap');
    });

    it('preserves all gap data through sorting', () => {
      const gaps: KnowledgeGap[] = [
        {
          kind: 'type_gap',
          description: 'missing type 0x0005',
          severity: 0.8,
          details: { type: 0x0005, localCount: 0, avgPeerCount: 15 },
        },
        {
          kind: 'tag_gap',
          description: 'missing tag "health"',
          severity: 0.6,
          details: { tag: 'health', localCount: 1, avgPeerCount: 12 },
        },
      ];

      const sorted = prioritizeSync(gaps);
      expect(sorted[0].details).toEqual({ type: 0x0005, localCount: 0, avgPeerCount: 15 });
      expect(sorted[1].details).toEqual({ tag: 'health', localCount: 1, avgPeerCount: 12 });
    });
  });
});
