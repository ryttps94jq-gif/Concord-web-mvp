// Concord Mobile — Collective Memory
//
// Manages shared knowledge that emerges from mesh-wide DTU propagation.
// Builds local snapshots of what this node knows, computes diversity metrics,
// identifies knowledge gaps relative to peers, and prioritizes sync targets.

import type { DTU, DTUTypeCode } from '../utils/types';

// ── DTU Store Interface ──────────────────────────────────────────────────────

export interface DTUStore {
  getByType(type: number): DTU[];
  getByTags(tags: string[]): DTU[];
  size(): number;
}

// ── Local Types ──────────────────────────────────────────────────────────────

interface TagFrequency {
  tag: string;
  count: number;
}

interface TypeFrequency {
  type: DTUTypeCode;
  count: number;
  avgRelayCount: number;
}

interface GeoCoverage {
  gridCells: number;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } | null;
}

interface TemporalCoverage {
  earliestTimestamp: number;
  latestTimestamp: number;
  spanMs: number;
}

interface CollectiveSnapshot {
  nodeId: string;
  createdAt: number;
  totalDTUs: number;
  topTags: TagFrequency[];
  typeDistribution: TypeFrequency[];
  geoCoverage: GeoCoverage;
  temporalCoverage: TemporalCoverage;
}

type GapKind = 'type_gap' | 'tag_gap' | 'geo_gap' | 'temporal_gap';

interface KnowledgeGap {
  kind: GapKind;
  description: string;
  severity: number; // 0-1, higher = more important to fill
  details: Record<string, unknown>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TOP_TAGS = 20;
const MAX_TYPE_CODE = 0x000E; // highest known DTU type code
const LOCAL_NODE_ID = 'local'; // placeholder; real ID comes from identity module
const GEO_GRID_CELL_DEG = 0.001; // ~111m grid cells for coverage counting

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect all DTUs from the store by iterating over known type codes.
 */
function collectAllDTUs(store: DTUStore): DTU[] {
  const seen = new Set<string>();
  const result: DTU[] = [];

  for (let t = 1; t <= MAX_TYPE_CODE; t++) {
    const dtus = store.getByType(t);
    for (const dtu of dtus) {
      if (!seen.has(dtu.id)) {
        seen.add(dtu.id);
        result.push(dtu);
      }
    }
  }

  return result;
}

/**
 * Round a coordinate to a grid cell key for counting unique cells.
 */
function geoCellKey(lat: number, lon: number): string {
  const gLat = Math.floor(lat / GEO_GRID_CELL_DEG);
  const gLon = Math.floor(lon / GEO_GRID_CELL_DEG);
  return `${gLat}:${gLon}`;
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Build a summary snapshot of what the local node currently knows.
 *
 * The snapshot includes top tags, DTU type distribution with relay counts,
 * geographic coverage (number of distinct grid cells and bounding box),
 * and temporal coverage (earliest to latest timestamp).
 *
 * @param store - The local DTU store
 * @returns A CollectiveSnapshot summarizing local knowledge
 */
export function buildCollectiveSnapshot(store: DTUStore): CollectiveSnapshot {
  const allDTUs = collectAllDTUs(store);
  const now = Date.now();

  // Tag frequency
  const tagCounts = new Map<string, number>();
  for (const dtu of allDTUs) {
    for (const tag of dtu.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags: TagFrequency[] = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TOP_TAGS);

  // Type distribution
  const typeBuckets = new Map<number, { count: number; totalRelay: number }>();
  for (const dtu of allDTUs) {
    const t = dtu.header.type;
    const bucket = typeBuckets.get(t);
    if (bucket) {
      bucket.count++;
      bucket.totalRelay += dtu.meta.relayCount;
    } else {
      typeBuckets.set(t, { count: 1, totalRelay: dtu.meta.relayCount });
    }
  }
  const typeDistribution: TypeFrequency[] = Array.from(typeBuckets.entries())
    .map(([type, { count, totalRelay }]) => ({
      type: type as DTUTypeCode,
      count,
      avgRelayCount: count > 0 ? totalRelay / count : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Geographic coverage
  const geoCells = new Set<string>();
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let hasGeo = false;

  for (const dtu of allDTUs) {
    const geo = dtu.meta.geoGrid;
    if (!geo) continue;
    hasGeo = true;
    geoCells.add(geoCellKey(geo.lat, geo.lon));
    if (geo.lat < minLat) minLat = geo.lat;
    if (geo.lat > maxLat) maxLat = geo.lat;
    if (geo.lon < minLon) minLon = geo.lon;
    if (geo.lon > maxLon) maxLon = geo.lon;
  }

  const geoCoverage: GeoCoverage = {
    gridCells: geoCells.size,
    boundingBox: hasGeo
      ? { minLat, maxLat, minLon, maxLon }
      : null,
  };

  // Temporal coverage
  let earliest = Infinity;
  let latest = -Infinity;
  for (const dtu of allDTUs) {
    const ts = dtu.header.timestamp;
    if (ts < earliest) earliest = ts;
    if (ts > latest) latest = ts;
  }

  const temporalCoverage: TemporalCoverage =
    allDTUs.length > 0
      ? { earliestTimestamp: earliest, latestTimestamp: latest, spanMs: latest - earliest }
      : { earliestTimestamp: 0, latestTimestamp: 0, spanMs: 0 };

  return {
    nodeId: LOCAL_NODE_ID,
    createdAt: now,
    totalDTUs: allDTUs.length,
    topTags,
    typeDistribution,
    geoCoverage,
    temporalCoverage,
  };
}

/**
 * Compute a 0-1 diversity score measuring how diverse the local knowledge is.
 *
 * Diversity is evaluated across three dimensions:
 * - Type diversity: How evenly distributed are DTU types (Shannon entropy normalized)
 * - Geographic diversity: Number of distinct grid cells covered
 * - Temporal diversity: Span of timestamps relative to a reference window
 *
 * @param snapshot - A CollectiveSnapshot to evaluate
 * @returns A diversity score between 0 and 1
 */
export function computeDiversityScore(snapshot: CollectiveSnapshot): number {
  if (snapshot.totalDTUs === 0) return 0;

  // Type diversity — normalized Shannon entropy
  const total = snapshot.typeDistribution.reduce((s, t) => s + t.count, 0);
  let typeEntropy = 0;
  if (total > 0 && snapshot.typeDistribution.length > 1) {
    for (const td of snapshot.typeDistribution) {
      const p = td.count / total;
      if (p > 0) {
        typeEntropy -= p * Math.log2(p);
      }
    }
    const maxEntropy = Math.log2(snapshot.typeDistribution.length);
    typeEntropy = maxEntropy > 0 ? typeEntropy / maxEntropy : 0;
  }

  // Geographic diversity — number of grid cells normalized (log scale)
  // Reference: 100 cells is considered "good" diversity
  const geoDiversity = snapshot.geoCoverage.gridCells > 0
    ? Math.min(Math.log2(snapshot.geoCoverage.gridCells + 1) / Math.log2(101), 1.0)
    : 0;

  // Temporal diversity — span normalized to 24 hours
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const temporalDiversity = snapshot.temporalCoverage.spanMs > 0
    ? Math.min(snapshot.temporalCoverage.spanMs / ONE_DAY_MS, 1.0)
    : 0;

  // Weighted combination
  return typeEntropy * 0.4 + geoDiversity * 0.35 + temporalDiversity * 0.25;
}

/**
 * Compare the local snapshot against peer snapshots to identify knowledge gaps.
 *
 * Gaps are detected along four dimensions:
 * - Type gaps: DTU types that peers have but the local node has few or none
 * - Tag gaps: Tags prevalent in peer snapshots but rare locally
 * - Geo gaps: Geographic areas covered by peers but not locally
 * - Temporal gaps: Time periods where peers have data but we do not
 *
 * @param local - The local node's CollectiveSnapshot
 * @param peerSnapshots - Array of snapshots from mesh peers
 * @returns Array of KnowledgeGap objects describing areas of thin knowledge
 */
export function identifyKnowledgeGaps(
  local: CollectiveSnapshot,
  peerSnapshots: CollectiveSnapshot[],
): KnowledgeGap[] {
  if (peerSnapshots.length === 0) return [];

  const gaps: KnowledgeGap[] = [];

  // Build local lookup maps
  const localTypeCounts = new Map<number, number>();
  for (const td of local.typeDistribution) {
    localTypeCounts.set(td.type, td.count);
  }

  const localTagCounts = new Map<string, number>();
  for (const tf of local.topTags) {
    localTagCounts.set(tf.tag, tf.count);
  }

  // Aggregate peer data
  const peerTypeTotals = new Map<number, number>();
  const peerTagTotals = new Map<string, number>();
  let peerMinLat = Infinity;
  let peerMaxLat = -Infinity;
  let peerMinLon = Infinity;
  let peerMaxLon = -Infinity;
  let peerEarliest = Infinity;
  let peerLatest = -Infinity;
  let peerHasGeo = false;

  for (const peer of peerSnapshots) {
    for (const td of peer.typeDistribution) {
      peerTypeTotals.set(td.type, (peerTypeTotals.get(td.type) ?? 0) + td.count);
    }
    for (const tf of peer.topTags) {
      peerTagTotals.set(tf.tag, (peerTagTotals.get(tf.tag) ?? 0) + tf.count);
    }
    if (peer.geoCoverage.boundingBox) {
      peerHasGeo = true;
      const bb = peer.geoCoverage.boundingBox;
      if (bb.minLat < peerMinLat) peerMinLat = bb.minLat;
      if (bb.maxLat > peerMaxLat) peerMaxLat = bb.maxLat;
      if (bb.minLon < peerMinLon) peerMinLon = bb.minLon;
      if (bb.maxLon > peerMaxLon) peerMaxLon = bb.maxLon;
    }
    if (peer.temporalCoverage.earliestTimestamp < peerEarliest) {
      peerEarliest = peer.temporalCoverage.earliestTimestamp;
    }
    if (peer.temporalCoverage.latestTimestamp > peerLatest) {
      peerLatest = peer.temporalCoverage.latestTimestamp;
    }
  }

  // Type gaps: peer types that are underrepresented locally
  for (const [type, peerCount] of peerTypeTotals) {
    const localCount = localTypeCounts.get(type) ?? 0;
    const avgPeerCount = peerCount / peerSnapshots.length;
    if (avgPeerCount > 0 && localCount < avgPeerCount * 0.3) {
      const severity = Math.min((avgPeerCount - localCount) / avgPeerCount, 1.0);
      gaps.push({
        kind: 'type_gap',
        description: `DTU type 0x${type.toString(16).padStart(4, '0')}: local has ${localCount}, peers average ${avgPeerCount.toFixed(0)}`,
        severity,
        details: { type, localCount, avgPeerCount },
      });
    }
  }

  // Tag gaps: peer tags that are underrepresented locally
  for (const [tag, peerCount] of peerTagTotals) {
    const localCount = localTagCounts.get(tag) ?? 0;
    const avgPeerCount = peerCount / peerSnapshots.length;
    if (avgPeerCount > 2 && localCount < avgPeerCount * 0.3) {
      const severity = Math.min((avgPeerCount - localCount) / avgPeerCount, 1.0);
      gaps.push({
        kind: 'tag_gap',
        description: `Tag "${tag}": local has ${localCount}, peers average ${avgPeerCount.toFixed(0)}`,
        severity,
        details: { tag, localCount, avgPeerCount },
      });
    }
  }

  // Geo gap: peers cover areas we do not
  if (peerHasGeo) {
    const localBB = local.geoCoverage.boundingBox;
    if (!localBB) {
      gaps.push({
        kind: 'geo_gap',
        description: 'No geographic data locally; peers cover geographic areas',
        severity: 1.0,
        details: {
          peerBoundingBox: { minLat: peerMinLat, maxLat: peerMaxLat, minLon: peerMinLon, maxLon: peerMaxLon },
        },
      });
    } else {
      // Check if peer bounding box extends significantly beyond local
      const latGap = Math.max(0, localBB.minLat - peerMinLat) + Math.max(0, peerMaxLat - localBB.maxLat);
      const lonGap = Math.max(0, localBB.minLon - peerMinLon) + Math.max(0, peerMaxLon - localBB.maxLon);
      const localLatSpan = localBB.maxLat - localBB.minLat;
      const localLonSpan = localBB.maxLon - localBB.minLon;

      if (latGap > 0 || lonGap > 0) {
        const latSeverity = localLatSpan > 0 ? Math.min(latGap / localLatSpan, 1.0) : (latGap > 0 ? 1.0 : 0);
        const lonSeverity = localLonSpan > 0 ? Math.min(lonGap / localLonSpan, 1.0) : (lonGap > 0 ? 1.0 : 0);
        const severity = Math.max(latSeverity, lonSeverity);
        if (severity > 0.1) {
          gaps.push({
            kind: 'geo_gap',
            description: `Peers cover ${latGap.toFixed(4)} deg lat and ${lonGap.toFixed(4)} deg lon beyond local coverage`,
            severity,
            details: {
              latGap,
              lonGap,
              localBoundingBox: localBB,
              peerBoundingBox: { minLat: peerMinLat, maxLat: peerMaxLat, minLon: peerMinLon, maxLon: peerMaxLon },
            },
          });
        }
      }
    }
  }

  // Temporal gap: peers have data from time ranges we lack
  if (peerEarliest < Infinity && peerLatest > -Infinity) {
    const localEarliest = local.temporalCoverage.earliestTimestamp;
    const localLatest = local.temporalCoverage.latestTimestamp;
    const localSpan = local.temporalCoverage.spanMs;

    if (localSpan === 0 && local.totalDTUs === 0) {
      gaps.push({
        kind: 'temporal_gap',
        description: 'No temporal data locally; peers cover time ranges',
        severity: 1.0,
        details: { peerEarliest, peerLatest },
      });
    } else {
      const earlyGap = Math.max(0, localEarliest - peerEarliest);
      const lateGap = Math.max(0, peerLatest - localLatest);
      const totalGap = earlyGap + lateGap;
      if (totalGap > 0 && localSpan > 0) {
        const severity = Math.min(totalGap / localSpan, 1.0);
        if (severity > 0.1) {
          gaps.push({
            kind: 'temporal_gap',
            description: `Peers have data ${(earlyGap / 1000).toFixed(0)}s earlier and ${(lateGap / 1000).toFixed(0)}s later than local`,
            severity,
            details: { earlyGap, lateGap, localEarliest, localLatest, peerEarliest, peerLatest },
          });
        }
      }
    }
  }

  return gaps;
}

/**
 * Sort knowledge gaps by importance for targeted sync.
 *
 * Gaps are sorted by severity descending, with type gaps given slight
 * priority over tag gaps when severities are equal, since type diversity
 * is more structurally important than tag diversity.
 *
 * @param gaps - Array of KnowledgeGap objects to prioritize
 * @returns A new array sorted by sync priority (most important first)
 */
export function prioritizeSync(gaps: KnowledgeGap[]): KnowledgeGap[] {
  const kindPriority: Record<GapKind, number> = {
    type_gap: 4,
    geo_gap: 3,
    temporal_gap: 2,
    tag_gap: 1,
  };

  return [...gaps].sort((a, b) => {
    // Primary: severity descending
    const sevDiff = b.severity - a.severity;
    if (Math.abs(sevDiff) > 0.01) return sevDiff;
    // Secondary: kind priority descending
    return (kindPriority[b.kind] ?? 0) - (kindPriority[a.kind] ?? 0);
  });
}

// ── Re-export types for testing ──────────────────────────────────────────────
export type {
  CollectiveSnapshot,
  KnowledgeGap,
  GapKind,
  TagFrequency,
  TypeFrequency,
  GeoCoverage,
  TemporalCoverage,
};
