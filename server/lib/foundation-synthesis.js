/**
 * Foundation Synthesis — Cross-Medium Synthesis
 *
 * Analyzes data across all signal media simultaneously to find invariants.
 * Patterns that appear on radio AND telephone AND Bluetooth AND LoRa —
 * or patterns conspicuously absent on one medium. Each medium alone shows
 * noise. Together they show patterns.
 *
 * Rules:
 *   1. Multi-medium only. Single-medium patterns handled by Foundation Sense.
 *   2. High-novelty discoveries get elevated propagation priority.
 *   3. All synthesis results are DTUs for lattice meta-derivation.
 */

import crypto from "crypto";

function uid(prefix = "synthesis") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const CORRELATION_TYPES = Object.freeze([
  "temporal",      // Things happening at the same time across media
  "spatial",       // Same location, different media
  "spectral",      // Frequency relationships across media
  "anomalous",     // Correlated anomalies across media
  "absence",       // Pattern present on some media but absent on others
]);

export const MIN_MEDIA_FOR_SYNTHESIS = 2;

// ── Module State ────────────────────────────────────────────────────────────

const _synthesisState = {
  initialized: false,
  correlations: [],          // Discovered cross-medium correlations
  mediaBuffers: new Map(),   // channel → recent readings buffer
  insights: [],              // High-confidence derived insights
  stats: {
    totalCorrelations: 0,
    highNoveltyInsights: 0,
    mediaAnalyzed: 0,
    lastSynthesisAt: null,
    uptime: Date.now(),
  },
};

// ── Synthesis DTU Creation ──────────────────────────────────────────────────

export function createSynthesisDTU(opts) {
  const now = nowISO();
  const noveltyScore = clamp(opts.novelty_score || 0, 0, 1);

  return {
    id: uid("synthesis"),
    type: "SYNTHESIS",
    created: now,
    source: "foundation-synthesis",
    media_involved: opts.media_involved || [],
    correlation: {
      pattern_type: CORRELATION_TYPES.includes(opts.pattern_type) ? opts.pattern_type : "temporal",
      confidence: clamp(opts.confidence || 0, 0, 1),
      media_contributions: (opts.media_contributions || []).map(mc => ({
        channel: mc.channel,
        signal: mc.signal || "unknown",
        weight: clamp(mc.weight || 0, 0, 1),
      })),
      temporal_alignment: opts.temporal_alignment ?? null,
      spatial_alignment: opts.spatial_alignment ?? null,
    },
    derived_insight: opts.derived_insight || null,
    novelty_score: noveltyScore,
    tags: ["foundation", "synthesis", opts.pattern_type || "temporal"],
    scope: noveltyScore > 0.7 ? "global" : "local",
    crpiScore: clamp(noveltyScore * 0.8, 0.1, 0.9),
  };
}

// ── Media Buffer Management ─────────────────────────────────────────────────

export function addMediaReading(channel, reading) {
  if (!channel || !reading) return false;

  if (!_synthesisState.mediaBuffers.has(channel)) {
    _synthesisState.mediaBuffers.set(channel, []);
  }

  const buffer = _synthesisState.mediaBuffers.get(channel);
  buffer.push({
    ...reading,
    channel,
    bufferedAt: nowISO(),
  });

  // Cap buffer per channel
  if (buffer.length > 200) {
    _synthesisState.mediaBuffers.set(channel, buffer.slice(-150));
  }

  return true;
}

// ── Cross-Medium Analysis ───────────────────────────────────────────────────

export function runSynthesis(STATE) {
  const activeMedia = [..._synthesisState.mediaBuffers.keys()];
  if (activeMedia.length < MIN_MEDIA_FOR_SYNTHESIS) {
    return { ok: false, reason: "insufficient_media", mediaCount: activeMedia.length };
  }

  const correlations = [];

  // Temporal correlation: look for concurrent anomalies across media
  const timeWindow = 60000; // 1 minute window
  const now = Date.now();

  for (let i = 0; i < activeMedia.length; i++) {
    for (let j = i + 1; j < activeMedia.length; j++) {
      const bufA = _synthesisState.mediaBuffers.get(activeMedia[i]) || [];
      const bufB = _synthesisState.mediaBuffers.get(activeMedia[j]) || [];

      const recentA = bufA.filter(r => now - new Date(r.bufferedAt).getTime() < timeWindow);
      const recentB = bufB.filter(r => now - new Date(r.bufferedAt).getTime() < timeWindow);

      if (recentA.length > 0 && recentB.length > 0) {
        // Both media have recent readings — check for correlated anomalies
        const anomalyA = recentA.some(r => (r.anomaly_score || 0) > 2);
        const anomalyB = recentB.some(r => (r.anomaly_score || 0) > 2);

        if (anomalyA && anomalyB) {
          const dtu = createSynthesisDTU({
            media_involved: [activeMedia[i], activeMedia[j]],
            pattern_type: "anomalous",
            confidence: 0.6,
            media_contributions: [
              { channel: activeMedia[i], signal: "anomaly", weight: 0.5 },
              { channel: activeMedia[j], signal: "anomaly", weight: 0.5 },
            ],
            temporal_alignment: 0.9,
            derived_insight: `Correlated anomalies on ${activeMedia[i]} and ${activeMedia[j]}`,
            novelty_score: 0.7,
          });

          correlations.push(dtu);
          if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);
        }

        // Absence detection: one medium shows anomaly, other is clean
        if (anomalyA && !anomalyB) {
          const dtu = createSynthesisDTU({
            media_involved: [activeMedia[i], activeMedia[j]],
            pattern_type: "absence",
            confidence: 0.4,
            media_contributions: [
              { channel: activeMedia[i], signal: "anomaly_present", weight: 0.7 },
              { channel: activeMedia[j], signal: "anomaly_absent", weight: 0.3 },
            ],
            derived_insight: `Anomaly on ${activeMedia[i]} not reflected on ${activeMedia[j]}`,
            novelty_score: 0.5,
          });

          correlations.push(dtu);
          if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);
        }
      }
    }
  }

  // Store correlations
  for (const c of correlations) {
    _synthesisState.correlations.push(c);
    _synthesisState.stats.totalCorrelations++;
    if (c.novelty_score > 0.7) _synthesisState.stats.highNoveltyInsights++;
  }

  if (_synthesisState.correlations.length > 500) {
    _synthesisState.correlations = _synthesisState.correlations.slice(-400);
  }

  _synthesisState.stats.mediaAnalyzed = activeMedia.length;
  _synthesisState.stats.lastSynthesisAt = nowISO();

  return { ok: true, correlations: correlations.length, mediaAnalyzed: activeMedia.length };
}

// ── Query Functions ─────────────────────────────────────────────────────────

export function getCorrelations(limit = 50) {
  return _synthesisState.correlations.slice(-limit);
}

export function getSynthesisMetrics() {
  return {
    initialized: _synthesisState.initialized,
    correlationCount: _synthesisState.correlations.length,
    activeMediaChannels: _synthesisState.mediaBuffers.size,
    stats: { ..._synthesisState.stats },
    uptime: Date.now() - _synthesisState.stats.uptime,
  };
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeSynthesis(STATE) {
  if (_synthesisState.initialized) return { ok: true, alreadyInitialized: true };

  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "SYNTHESIS") {
        _synthesisState.correlations.push(dtu);
        indexed++;
      }
    }
  }

  _synthesisState.initialized = true;
  _synthesisState.stats.uptime = Date.now();
  return { ok: true, indexed };
}

export function _resetSynthesisState() {
  _synthesisState.initialized = false;
  _synthesisState.correlations = [];
  _synthesisState.mediaBuffers.clear();
  _synthesisState.insights = [];
  _synthesisState.stats = {
    totalCorrelations: 0, highNoveltyInsights: 0, mediaAnalyzed: 0,
    lastSynthesisAt: null, uptime: Date.now(),
  };
}
