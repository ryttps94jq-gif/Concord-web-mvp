// Concord Mobile — Emergent Pattern Detector
//
// Detects emergent patterns across DTUs in the local store, including
// temporal bursts, geographic clusters, and content similarity patterns
// that arise organically from mesh-wide DTU propagation.

import type { DTU, DTUTypeCode, GeoGrid } from '../utils/types';

// ── DTU Store Interface ──────────────────────────────────────────────────────
// Minimal read-only interface for accessing the local DTU store.

export interface DTUStore {
  getByType(type: number): DTU[];
  getByTags(tags: string[]): DTU[];
  size(): number;
}

// ── Local Types ──────────────────────────────────────────────────────────────

interface TemporalBurst {
  windowStart: number;
  windowEnd: number;
  count: number;
  rate: number; // DTUs per second within the window
  dominantType: DTUTypeCode | null;
  dominantTags: string[];
}

interface GeoCluster {
  centroid: GeoGrid;
  dtuCount: number;
  dtuIds: string[];
  radiusMeters: number;
  tags: string[];
  avgTimestamp: number;
}

type PatternKind = 'temporal_burst' | 'geo_cluster' | 'tag_convergence' | 'relay_cascade';

interface EmergentPattern {
  kind: PatternKind;
  detectedAt: number;
  confidence: number;
  sampleSize: number;
  summary: string;
  relatedDTUIds: string[];
  metadata: Record<string, unknown>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TEMPORAL_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_TEMPORAL_THRESHOLD = 10; // DTUs per window
const DEFAULT_GEO_RADIUS_METERS = 500;
const MIN_CLUSTER_SIZE = 3;
const TAG_CONVERGENCE_THRESHOLD = 5; // at least 5 DTUs sharing a tag
const RELAY_CASCADE_THRESHOLD = 3; // relay count above which we flag a cascade
const RECENCY_HALF_LIFE_MS = 60 * 60 * 1000; // 1 hour half-life for recency weighting
const MAX_PATTERNS_RETURNED = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect all DTUs from the store by iterating over known type codes.
 * This avoids needing an "all" accessor on the minimal DTUStore interface.
 */
function collectAllDTUs(store: DTUStore): DTU[] {
  const typeRange = 0x000E; // highest known type code
  const seen = new Set<string>();
  const result: DTU[] = [];

  for (let t = 1; t <= typeRange; t++) {
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
 * Compute a grid key for a GeoGrid, bucketing by approximate grid cell.
 */
function geoGridKey(geo: GeoGrid, cellSizeMeters: number): string {
  // Approximate: 1 degree lat ~ 111,320 m, 1 degree lon ~ 111,320 * cos(lat) m
  const latDeg = cellSizeMeters / 111320;
  const gridLat = Math.floor(geo.lat / latDeg);
  // Use the gridded latitude (not the raw lat) for the cos calculation
  // so that all points in the same lat band get consistent lon bucketing
  const roundedLat = gridLat * latDeg;
  const lonDeg = cellSizeMeters / (111320 * Math.cos((roundedLat * Math.PI) / 180));
  const gridLon = Math.floor(geo.lon / lonDeg);
  return `${gridLat},${gridLon}`;
}

/**
 * Compute the dominant type code from a list of DTUs.
 */
function dominantTypeCode(dtus: DTU[]): DTUTypeCode | null {
  if (dtus.length === 0) return null;
  const counts = new Map<number, number>();
  for (const dtu of dtus) {
    counts.set(dtu.header.type, (counts.get(dtu.header.type) ?? 0) + 1);
  }
  let maxCount = 0;
  let maxType: DTUTypeCode | null = null;
  for (const [type, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxType = type as DTUTypeCode;
    }
  }
  return maxType;
}

/**
 * Collect the most common tags from a list of DTUs.
 */
function topTags(dtus: DTU[], limit: number): string[] {
  const tagCounts = new Map<string, number>();
  for (const dtu of dtus) {
    for (const tag of dtu.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * Haversine distance between two GeoGrid points in meters.
 */
function haversineMeters(a: GeoGrid, b: GeoGrid): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Detect unusual spikes in DTU creation rate within a given time window.
 *
 * @param dtus - Array of DTUs to scan
 * @param windowMs - Duration of the sliding window in milliseconds
 * @param threshold - Minimum DTU count within the window to qualify as a burst
 * @returns A TemporalBurst descriptor if a burst is detected, or null
 */
export function detectTemporalBurst(
  dtus: DTU[],
  windowMs: number = DEFAULT_TEMPORAL_WINDOW_MS,
  threshold: number = DEFAULT_TEMPORAL_THRESHOLD,
): TemporalBurst | null {
  if (dtus.length < threshold) return null;

  const sorted = [...dtus].sort((a, b) => a.header.timestamp - b.header.timestamp);

  let bestStart = 0;
  let bestEnd = 0;
  let bestCount = 0;

  let left = 0;
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right].header.timestamp - sorted[left].header.timestamp > windowMs) {
      left++;
    }
    const count = right - left + 1;
    if (count > bestCount) {
      bestCount = count;
      bestStart = left;
      bestEnd = right;
    }
  }

  if (bestCount < threshold) return null;

  const windowDTUs = sorted.slice(bestStart, bestEnd + 1);
  const windowStart = windowDTUs[0].header.timestamp;
  const windowEnd = windowDTUs[windowDTUs.length - 1].header.timestamp;
  const durationSec = Math.max((windowEnd - windowStart) / 1000, 0.001);

  return {
    windowStart,
    windowEnd,
    count: bestCount,
    rate: bestCount / durationSec,
    dominantType: dominantTypeCode(windowDTUs),
    dominantTags: topTags(windowDTUs, 3),
  };
}

/**
 * Group DTUs by geographic proximity using a grid-based approach.
 *
 * DTUs that share the same geo-grid cell (sized by radiusMeters) are placed
 * in the same initial bucket. Buckets with fewer than MIN_CLUSTER_SIZE DTUs
 * are discarded.
 *
 * @param dtus - Array of DTUs to cluster
 * @param radiusMeters - Approximate radius for grid cells
 * @returns Array of GeoCluster objects
 */
export function detectGeoClusters(
  dtus: DTU[],
  radiusMeters: number = DEFAULT_GEO_RADIUS_METERS,
): GeoCluster[] {
  const buckets = new Map<string, DTU[]>();

  for (const dtu of dtus) {
    const geo = dtu.meta.geoGrid;
    if (!geo) continue;

    const key = geoGridKey(geo, radiusMeters);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(dtu);
    } else {
      buckets.set(key, [dtu]);
    }
  }

  const clusters: GeoCluster[] = [];

  for (const [, bucket] of buckets) {
    if (bucket.length < MIN_CLUSTER_SIZE) continue;

    // Compute centroid
    let sumLat = 0;
    let sumLon = 0;
    let sumTime = 0;
    const ids: string[] = [];
    const allTags = new Set<string>();

    for (const dtu of bucket) {
      const geo = dtu.meta.geoGrid!;
      sumLat += geo.lat;
      sumLon += geo.lon;
      sumTime += dtu.header.timestamp;
      ids.push(dtu.id);
      for (const tag of dtu.tags) allTags.add(tag);
    }

    const centroid: GeoGrid = {
      lat: sumLat / bucket.length,
      lon: sumLon / bucket.length,
    };

    // Compute actual max radius from centroid
    let maxDist = 0;
    for (const dtu of bucket) {
      const d = haversineMeters(centroid, dtu.meta.geoGrid!);
      if (d > maxDist) maxDist = d;
    }

    clusters.push({
      centroid,
      dtuCount: bucket.length,
      dtuIds: ids,
      radiusMeters: Math.max(maxDist, 1),
      tags: Array.from(allTags),
      avgTimestamp: sumTime / bucket.length,
    });
  }

  // Sort clusters by size descending
  clusters.sort((a, b) => b.dtuCount - a.dtuCount);

  return clusters;
}

/**
 * Compute a 0-1 confidence score for a detected pattern based on sample size,
 * recency of the data, and internal consistency.
 *
 * @param pattern - The emergent pattern to evaluate
 * @returns A confidence score between 0 and 1
 */
export function computePatternConfidence(pattern: EmergentPattern): number {
  const now = Date.now();

  // Factor 1: Sample size — more data = higher confidence (logarithmic scale)
  const sizeFactor = Math.min(Math.log2(pattern.sampleSize + 1) / 10, 1.0);

  // Factor 2: Recency — how recently was this pattern detected
  const ageMs = now - pattern.detectedAt;
  const recencyFactor = Math.pow(0.5, ageMs / RECENCY_HALF_LIFE_MS);

  // Factor 3: DTU density — how many related DTUs vs sample size
  const densityFactor =
    pattern.sampleSize > 0
      ? Math.min(pattern.relatedDTUIds.length / pattern.sampleSize, 1.0)
      : 0;

  // Weighted combination
  const raw = sizeFactor * 0.4 + recencyFactor * 0.35 + densityFactor * 0.25;

  return Math.max(0, Math.min(1, raw));
}

/**
 * Scan the DTU store for all detectable emergent patterns.
 *
 * This is the main entry point. It runs temporal burst detection, geographic
 * clustering, tag convergence analysis, and relay cascade detection, then
 * returns all patterns sorted by confidence.
 *
 * @param store - The local DTU store to scan
 * @returns Array of EmergentPattern objects, sorted by confidence descending
 */
export function detectPatterns(store: DTUStore): EmergentPattern[] {
  const allDTUs = collectAllDTUs(store);
  if (allDTUs.length === 0) return [];

  const now = Date.now();
  const patterns: EmergentPattern[] = [];

  // 1. Temporal burst detection
  const burst = detectTemporalBurst(allDTUs);
  if (burst) {
    const burstDTUs = allDTUs.filter(
      (d) => d.header.timestamp >= burst.windowStart && d.header.timestamp <= burst.windowEnd,
    );
    const pattern: EmergentPattern = {
      kind: 'temporal_burst',
      detectedAt: now,
      confidence: 0,
      sampleSize: allDTUs.length,
      summary: `Temporal burst: ${burst.count} DTUs in ${((burst.windowEnd - burst.windowStart) / 1000).toFixed(1)}s`,
      relatedDTUIds: burstDTUs.map((d) => d.id),
      metadata: {
        windowStart: burst.windowStart,
        windowEnd: burst.windowEnd,
        rate: burst.rate,
        dominantType: burst.dominantType,
        dominantTags: burst.dominantTags,
      },
    };
    pattern.confidence = computePatternConfidence(pattern);
    patterns.push(pattern);
  }

  // 2. Geographic clustering
  const geoClusters = detectGeoClusters(allDTUs);
  for (const cluster of geoClusters) {
    const pattern: EmergentPattern = {
      kind: 'geo_cluster',
      detectedAt: now,
      confidence: 0,
      sampleSize: allDTUs.length,
      summary: `Geo cluster: ${cluster.dtuCount} DTUs near (${cluster.centroid.lat.toFixed(4)}, ${cluster.centroid.lon.toFixed(4)})`,
      relatedDTUIds: cluster.dtuIds,
      metadata: {
        centroid: cluster.centroid,
        radiusMeters: cluster.radiusMeters,
        tags: cluster.tags,
        avgTimestamp: cluster.avgTimestamp,
      },
    };
    pattern.confidence = computePatternConfidence(pattern);
    patterns.push(pattern);
  }

  // 3. Tag convergence — detect tags that appear across many DTUs
  const tagCounts = new Map<string, string[]>();
  for (const dtu of allDTUs) {
    for (const tag of dtu.tags) {
      const ids = tagCounts.get(tag);
      if (ids) {
        ids.push(dtu.id);
      } else {
        tagCounts.set(tag, [dtu.id]);
      }
    }
  }
  for (const [tag, ids] of tagCounts) {
    if (ids.length >= TAG_CONVERGENCE_THRESHOLD) {
      const pattern: EmergentPattern = {
        kind: 'tag_convergence',
        detectedAt: now,
        confidence: 0,
        sampleSize: allDTUs.length,
        summary: `Tag convergence: "${tag}" appears in ${ids.length} DTUs`,
        relatedDTUIds: ids,
        metadata: { tag, count: ids.length },
      };
      pattern.confidence = computePatternConfidence(pattern);
      patterns.push(pattern);
    }
  }

  // 4. Relay cascade — DTUs with unusually high relay counts
  const highRelayDTUs = allDTUs.filter((d) => d.meta.relayCount >= RELAY_CASCADE_THRESHOLD);
  if (highRelayDTUs.length >= MIN_CLUSTER_SIZE) {
    const avgRelay =
      highRelayDTUs.reduce((sum, d) => sum + d.meta.relayCount, 0) / highRelayDTUs.length;
    const pattern: EmergentPattern = {
      kind: 'relay_cascade',
      detectedAt: now,
      confidence: 0,
      sampleSize: allDTUs.length,
      summary: `Relay cascade: ${highRelayDTUs.length} DTUs with avg relay count ${avgRelay.toFixed(1)}`,
      relatedDTUIds: highRelayDTUs.map((d) => d.id),
      metadata: { avgRelayCount: avgRelay, maxRelayCount: Math.max(...highRelayDTUs.map((d) => d.meta.relayCount)) },
    };
    pattern.confidence = computePatternConfidence(pattern);
    patterns.push(pattern);
  }

  // Sort by confidence descending and limit
  patterns.sort((a, b) => b.confidence - a.confidence);
  return patterns.slice(0, MAX_PATTERNS_RETURNED);
}

// ── Re-export types for testing ──────────────────────────────────────────────
export type { EmergentPattern, TemporalBurst, GeoCluster, PatternKind };
