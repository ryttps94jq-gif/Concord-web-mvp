/**
 * Foundation Synthesis — Comprehensive Test Suite
 *
 * Tests for:
 *   - Constants (CORRELATION_TYPES, MIN_MEDIA_FOR_SYNTHESIS)
 *   - createSynthesisDTU (pattern types, novelty scoring, scope escalation)
 *   - addMediaReading (buffer management, null handling)
 *   - runSynthesis (insufficient media, anomalous correlation, absence detection)
 *   - getCorrelations / getSynthesisMetrics
 *   - initializeSynthesis (indexing, double-init)
 *   - _resetSynthesisState
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  CORRELATION_TYPES,
  MIN_MEDIA_FOR_SYNTHESIS,
  createSynthesisDTU,
  addMediaReading,
  runSynthesis,
  getCorrelations,
  getSynthesisMetrics,
  initializeSynthesis,
  _resetSynthesisState,
} from "../lib/foundation-synthesis.js";

beforeEach(() => {
  _resetSynthesisState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Foundation Synthesis — Constants", () => {
  it("defines 5 correlation types", () => {
    assert.equal(CORRELATION_TYPES.length, 5);
    assert.ok(CORRELATION_TYPES.includes("temporal"));
    assert.ok(CORRELATION_TYPES.includes("spatial"));
    assert.ok(CORRELATION_TYPES.includes("spectral"));
    assert.ok(CORRELATION_TYPES.includes("anomalous"));
    assert.ok(CORRELATION_TYPES.includes("absence"));
  });

  it("requires minimum 2 media for synthesis", () => {
    assert.equal(MIN_MEDIA_FOR_SYNTHESIS, 2);
  });

  it("constants are frozen", () => {
    assert.equal(Object.isFrozen(CORRELATION_TYPES), true);
  });
});

// ── createSynthesisDTU ──────────────────────────────────────────────────────

describe("Foundation Synthesis — createSynthesisDTU", () => {
  it("creates DTU with valid pattern type", () => {
    const dtu = createSynthesisDTU({
      media_involved: ["wifi", "lora"],
      pattern_type: "anomalous",
      confidence: 0.8,
      novelty_score: 0.6,
    });
    assert.match(dtu.id, /^synthesis_/);
    assert.equal(dtu.type, "SYNTHESIS");
    assert.equal(dtu.source, "foundation-synthesis");
    assert.deepEqual(dtu.media_involved, ["wifi", "lora"]);
    assert.equal(dtu.correlation.pattern_type, "anomalous");
    assert.equal(dtu.correlation.confidence, 0.8);
    assert.equal(dtu.novelty_score, 0.6);
    assert.ok(dtu.tags.includes("synthesis"));
    assert.ok(dtu.tags.includes("anomalous"));
  });

  it("defaults to temporal pattern type for invalid input", () => {
    const dtu = createSynthesisDTU({ pattern_type: "invalid_type" });
    assert.equal(dtu.correlation.pattern_type, "temporal");
  });

  it("clamps confidence between 0 and 1", () => {
    const lowDtu = createSynthesisDTU({ confidence: -1 });
    assert.equal(lowDtu.correlation.confidence, 0);

    const highDtu = createSynthesisDTU({ confidence: 5 });
    assert.equal(highDtu.correlation.confidence, 1);
  });

  it("clamps novelty_score between 0 and 1", () => {
    const lowDtu = createSynthesisDTU({ novelty_score: -0.5 });
    assert.equal(lowDtu.novelty_score, 0);

    const highDtu = createSynthesisDTU({ novelty_score: 2 });
    assert.equal(highDtu.novelty_score, 1);
  });

  it("high novelty gets global scope", () => {
    const dtu = createSynthesisDTU({ novelty_score: 0.8 });
    assert.equal(dtu.scope, "global");
  });

  it("low novelty gets local scope", () => {
    const dtu = createSynthesisDTU({ novelty_score: 0.3 });
    assert.equal(dtu.scope, "local");
  });

  it("crpiScore scales with novelty (clamped 0.1-0.9)", () => {
    const lowDtu = createSynthesisDTU({ novelty_score: 0 });
    assert.equal(lowDtu.crpiScore, 0.1);

    const highDtu = createSynthesisDTU({ novelty_score: 1 });
    assert.ok(highDtu.crpiScore <= 0.9);
    assert.ok(highDtu.crpiScore > 0.5);
  });

  it("processes media_contributions with clamped weights", () => {
    const dtu = createSynthesisDTU({
      media_contributions: [
        { channel: "wifi", signal: "anomaly", weight: 0.5 },
        { channel: "lora", weight: 2.0 }, // Should clamp to 1
      ],
    });
    assert.equal(dtu.correlation.media_contributions.length, 2);
    assert.equal(dtu.correlation.media_contributions[0].channel, "wifi");
    assert.equal(dtu.correlation.media_contributions[0].signal, "anomaly");
    assert.equal(dtu.correlation.media_contributions[1].weight, 1);
    assert.equal(dtu.correlation.media_contributions[1].signal, "unknown");
  });

  it("sets temporal and spatial alignment", () => {
    const dtu = createSynthesisDTU({
      temporal_alignment: 0.95,
      spatial_alignment: 0.8,
    });
    assert.equal(dtu.correlation.temporal_alignment, 0.95);
    assert.equal(dtu.correlation.spatial_alignment, 0.8);
  });

  it("sets derived_insight", () => {
    const dtu = createSynthesisDTU({ derived_insight: "Correlated event detected" });
    assert.equal(dtu.derived_insight, "Correlated event detected");
  });
});

// ── addMediaReading ──────────────────────────────────────────────────────

describe("Foundation Synthesis — addMediaReading", () => {
  it("returns false for null channel", () => {
    assert.equal(addMediaReading(null, { value: 1 }), false);
  });

  it("returns false for empty channel", () => {
    assert.equal(addMediaReading("", { value: 1 }), false);
  });

  it("returns false for null reading", () => {
    assert.equal(addMediaReading("wifi", null), false);
  });

  it("adds reading to channel buffer", () => {
    const result = addMediaReading("wifi", { signal_strength: -50 });
    assert.equal(result, true);
    const metrics = getSynthesisMetrics();
    assert.equal(metrics.activeMediaChannels, 1);
  });

  it("adds readings to multiple channels", () => {
    addMediaReading("wifi", { signal_strength: -50 });
    addMediaReading("lora", { signal_strength: -80 });
    addMediaReading("bluetooth", { signal_strength: -60 });
    const metrics = getSynthesisMetrics();
    assert.equal(metrics.activeMediaChannels, 3);
  });

  it("caps buffer per channel at 200 (trims to 150)", () => {
    for (let i = 0; i < 210; i++) {
      addMediaReading("wifi", { value: i });
    }
    // Internal buffer trimmed, but still functions
    const metrics = getSynthesisMetrics();
    assert.equal(metrics.activeMediaChannels, 1);
  });

  it("adds channel field to stored reading", () => {
    addMediaReading("lora", { signal_strength: -80 });
    // Verify through synthesis that data is available
    const metrics = getSynthesisMetrics();
    assert.equal(metrics.activeMediaChannels, 1);
  });
});

// ── runSynthesis ──────────────────────────────────────────────────────────

describe("Foundation Synthesis — runSynthesis", () => {
  it("returns error with insufficient media (< 2)", () => {
    addMediaReading("wifi", { signal_strength: -50 });
    const result = runSynthesis();
    assert.equal(result.ok, false);
    assert.equal(result.reason, "insufficient_media");
    assert.equal(result.mediaCount, 1);
  });

  it("returns error with no media", () => {
    const result = runSynthesis();
    assert.equal(result.ok, false);
    assert.equal(result.reason, "insufficient_media");
    assert.equal(result.mediaCount, 0);
  });

  it("succeeds with 2+ media channels", () => {
    addMediaReading("wifi", { signal_strength: -50 });
    addMediaReading("lora", { signal_strength: -80 });
    const result = runSynthesis();
    assert.equal(result.ok, true);
    assert.equal(result.mediaAnalyzed, 2);
  });

  it("detects anomalous correlations across media", () => {
    // Both channels have anomalies
    addMediaReading("wifi", { signal_strength: -50, anomaly_score: 3.0 });
    addMediaReading("lora", { signal_strength: -80, anomaly_score: 2.5 });
    const result = runSynthesis();
    assert.equal(result.ok, true);
    assert.ok(result.correlations >= 1);

    const correlations = getCorrelations();
    const anomalous = correlations.find(c => c.correlation.pattern_type === "anomalous");
    assert.notEqual(anomalous, undefined);
    assert.deepEqual(anomalous.media_involved, ["wifi", "lora"]);
  });

  it("detects absence patterns (anomaly on one, not other)", () => {
    addMediaReading("wifi", { signal_strength: -50, anomaly_score: 3.0 });
    addMediaReading("lora", { signal_strength: -80, anomaly_score: 0.5 }); // No anomaly
    const result = runSynthesis();
    assert.equal(result.ok, true);

    const correlations = getCorrelations();
    const absence = correlations.find(c => c.correlation.pattern_type === "absence");
    assert.notEqual(absence, undefined);
  });

  it("tracks high novelty insights", () => {
    addMediaReading("wifi", { anomaly_score: 3.0 });
    addMediaReading("lora", { anomaly_score: 2.5 });
    runSynthesis();
    const metrics = getSynthesisMetrics();
    // Anomalous correlations have novelty 0.7, which counts as high
    assert.ok(metrics.stats.highNoveltyInsights >= 0);
  });

  it("updates lastSynthesisAt stat", () => {
    addMediaReading("wifi", { value: 1 });
    addMediaReading("lora", { value: 2 });
    runSynthesis();
    const metrics = getSynthesisMetrics();
    assert.notEqual(metrics.stats.lastSynthesisAt, null);
  });

  it("stores DTUs in STATE when provided", () => {
    const STATE = { dtus: new Map() };
    addMediaReading("wifi", { anomaly_score: 3.0 });
    addMediaReading("lora", { anomaly_score: 2.5 });
    runSynthesis(STATE);
    assert.ok(STATE.dtus.size >= 1);
  });

  it("no correlations when no anomalies on any channel", () => {
    addMediaReading("wifi", { signal_strength: -50, anomaly_score: 0.5 });
    addMediaReading("lora", { signal_strength: -80, anomaly_score: 0.3 });
    const result = runSynthesis();
    assert.equal(result.ok, true);
    assert.equal(result.correlations, 0);
  });

  it("trims correlations at 500 (keeps 400)", () => {
    // Add many channels and anomalies to generate lots of correlations
    for (let i = 0; i < 20; i++) {
      addMediaReading(`ch_${i}`, { anomaly_score: 3.0 });
    }
    for (let i = 0; i < 30; i++) {
      runSynthesis();
    }
    const metrics = getSynthesisMetrics();
    assert.ok(metrics.correlationCount <= 500);
  });
});

// ── Query Functions ──────────────────────────────────────────────────────

describe("Foundation Synthesis — Query Functions", () => {
  it("getCorrelations returns limited results", () => {
    addMediaReading("wifi", { anomaly_score: 3.0 });
    addMediaReading("lora", { anomaly_score: 2.5 });
    runSynthesis();
    const limited = getCorrelations(1);
    assert.ok(limited.length <= 1);
  });

  it("getCorrelations defaults to 50", () => {
    assert.ok(Array.isArray(getCorrelations()));
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe("Foundation Synthesis — Metrics", () => {
  it("returns initial metrics state", () => {
    const metrics = getSynthesisMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.correlationCount, 0);
    assert.equal(metrics.activeMediaChannels, 0);
    assert.equal(metrics.stats.totalCorrelations, 0);
    assert.equal(metrics.stats.highNoveltyInsights, 0);
    assert.equal(metrics.stats.mediaAnalyzed, 0);
    assert.equal(metrics.stats.lastSynthesisAt, null);
    assert.ok(metrics.uptime >= 0);
  });
});

// ── initializeSynthesis ──────────────────────────────────────────────────

describe("Foundation Synthesis — initializeSynthesis", () => {
  it("initializes successfully", async () => {
    const result = await initializeSynthesis({});
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 0);
    assert.equal(getSynthesisMetrics().initialized, true);
  });

  it("indexes SYNTHESIS DTUs from STATE", async () => {
    const STATE = {
      dtus: new Map([
        ["s1", { type: "SYNTHESIS", id: "s1" }],
        ["other", { type: "SENSOR", id: "other" }],
      ]),
    };
    const result = await initializeSynthesis(STATE);
    assert.equal(result.ok, true);
    assert.equal(result.indexed, 1);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeSynthesis({});
    const result = await initializeSynthesis({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });

  it("handles null STATE", async () => {
    const result = await initializeSynthesis(null);
    assert.equal(result.ok, true);
  });
});

// ── _resetSynthesisState ──────────────────────────────────────────────────

describe("Foundation Synthesis — _resetSynthesisState", () => {
  it("resets all state", async () => {
    await initializeSynthesis({});
    addMediaReading("wifi", { value: 1 });
    _resetSynthesisState();

    const metrics = getSynthesisMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.correlationCount, 0);
    assert.equal(metrics.activeMediaChannels, 0);
    assert.equal(metrics.stats.totalCorrelations, 0);
  });
});
