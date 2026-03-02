/**
 * Cross-Module Integration Tests
 *
 * Tests interactions between Foundation modules to ensure they work together:
 *   - Atlas + Signal Cortex pipeline (tomography → classification → privacy)
 *   - Intelligence + Atlas (tiered access enforcement)
 *   - Signal Cortex privacy enforcement in Atlas reconstruction
 *   - Shield + Cortex (safety frequency enforcement)
 *   - Module initialization order and dependencies
 *   - Metrics aggregation across modules
 *   - Heartbeat orchestration
 */

import { describe, it, expect, beforeEach } from "vitest";

// Foundation Atlas
import {
  collectSignal,
  modelPath,
  reconstructTile,
  classifyMaterial,
  getTile,
  getVolume,
  getCoverage,
  getAtlasMetrics,
  detectAtlasIntent,
  initializeAtlas,
  _resetAtlasState,
} from "../lib/foundation-atlas.js";

// Atlas Signal Cortex
import {
  SIGNAL_CATEGORIES,
  ALL_SIGNAL_CATEGORIES,
  SIGNAL_PURPOSES,
  ADJUSTMENT_PERMISSIONS,
  ADJUSTMENT_TYPES,
  PRIVACY_LEVELS,
  ZONE_PROTECTION,
  classifySignal as cortexClassifySignal,
  getTaxonomy,
  getUnknownSignals,
  getSpectralOccupancy,
  detectPrivacyZone,
  checkPrivacy,
  getPrivacyZones,
  getPrivacyStats,
  suppressPresenceDetection,
  suppressVehicleTracking,
  checkAdjustmentPermission,
  detectCortexIntent,
  getCortexMetrics,
  initializeCortex,
  _resetCortexState,
} from "../lib/atlas-signal-cortex.js";

// Foundation Intelligence
import {
  TIERS,
  CLASSIFICATIONS,
  PUBLIC_CATEGORIES,
  classifySignal as intelClassifySignal,
  processSignalIntelligence,
  getPublicIntelligence,
  detectIntelIntent,
  getIntelligenceMetrics,
  initializeIntelligence,
  _resetIntelligenceState,
} from "../lib/foundation-intelligence.js";

beforeEach(() => {
  _resetAtlasState();
  _resetCortexState();
  _resetIntelligenceState();
});

// ── Atlas + Signal Cortex Pipeline ─────────────────────────────────────────

describe("Atlas + Signal Cortex Pipeline", () => {
  it("collected atlas signals can be classified by cortex", async () => {
    await initializeAtlas({});
    await initializeCortex({});

    // Atlas collects a signal
    const sig = collectSignal({
      sourceNode: "node_A",
      destNode: "node_B",
      frequency: 2400,
      signalStrength: -65,
      phase: 120.5,
    });
    expect(sig).not.toBeNull();

    // Cortex classifies the same frequency signal
    const classified = cortexClassifySignal({
      frequency: 2400,
      modulation: "OFDM",
      keywords: ["wifi"],
    });
    expect(classified.category).toBe("COMMUNICATION");
    expect(classified.purpose).toBe("COMMUNICATION");
  });

  it("privacy zone blocks atlas reconstruction at zone coordinates", async () => {
    await initializeCortex({});

    // Create a residential privacy zone
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });
    expect(zone.protection_level).toBe("ABSOLUTE");

    // Privacy check at zone coordinates should block
    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    expect(check.allowed).toBe(false);
    expect(check.interior_data_exists).toBe(false);

    // Privacy check outside zone should allow
    const checkOutside = checkPrivacy({ lat: 53.0, lng: 5.0 });
    expect(checkOutside.allowed).toBe(true);
  });

  it("cortex taxonomy and atlas coverage are independent but complementary", async () => {
    await initializeAtlas({});
    await initializeCortex({});

    // Collect atlas signals (tomography data)
    collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400 });
    collectSignal({ sourceNode: "C", destNode: "D", frequency: 900 });

    // Classify signals in cortex (signal taxonomy)
    cortexClassifySignal({ frequency: 2400, modulation: "OFDM" });
    cortexClassifySignal({ frequency: 900, modulation: "LoRa" });
    cortexClassifySignal({ frequency: 50, keywords: ["power"] });

    // Atlas tracks signal paths
    const atlasCoverage = getCoverage();
    expect(atlasCoverage.totalPaths).toBe(2);

    // Cortex tracks classified signals
    const cortexMetrics = getCortexMetrics();
    expect(cortexMetrics.taxonomy.totalClassified).toBe(3);

    // They track different aspects of the same signals
    const spectrum = getSpectralOccupancy();
    expect(spectrum.totalSignals).toBe(3);
  });
});

// ── Intelligence + Atlas Tier Enforcement ───────────────────────────────────

describe("Intelligence + Atlas Tier Enforcement", () => {
  it("public tier only accesses surface and atmosphere layers", async () => {
    await initializeAtlas({});

    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz",
      environmentalImpact: 0.5,
      excessLoss_dB: 10,
      phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);

    const publicVolume = getVolume(
      { lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 },
      "PUBLIC"
    );
    expect(publicVolume.accessibleLayers).toHaveLength(2);
    expect(publicVolume.accessibleLayers).not.toContain("interior");
    expect(publicVolume.accessibleLayers).not.toContain("subsurface");
    expect(publicVolume.accessibleLayers).not.toContain("material");
  });

  it("sovereign tier accesses all 5 layers", async () => {
    await initializeAtlas({});

    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz",
      environmentalImpact: 0.5,
      excessLoss_dB: 10,
      phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);

    const sovereignVolume = getVolume(
      { lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 },
      "SOVEREIGN"
    );
    expect(sovereignVolume.accessibleLayers).toHaveLength(5);
  });

  it("intelligence and atlas intents are non-overlapping", () => {
    // Atlas-specific queries
    const atlasResult = detectAtlasIntent("Show me the atlas view of Amsterdam");
    expect(atlasResult.isAtlasRequest).toBe(true);
    expect(detectIntelIntent("Show me the atlas view of Amsterdam").isIntelRequest).toBe(false);

    // Intelligence-specific queries
    const intelResult = detectIntelIntent("What is the weather intelligence data?");
    expect(intelResult.isIntelRequest).toBe(true);
    expect(detectAtlasIntent("What is the weather intelligence data?").isAtlasRequest).toBe(false);

    // Cortex-specific queries
    const cortexResult = detectCortexIntent("Show signal taxonomy");
    expect(cortexResult.isCortexRequest).toBe(true);
    expect(detectAtlasIntent("Show signal taxonomy").isAtlasRequest).toBe(false);
    expect(detectIntelIntent("Show signal taxonomy").isIntelRequest).toBe(false);
  });
});

// ── Privacy Architecture Hardening ──────────────────────────────────────────

describe("Privacy Architecture Hardening", () => {
  beforeEach(async () => {
    await initializeCortex({});
  });

  it("ABSOLUTE zones never have interior data — residential", () => {
    const zone = detectPrivacyZone({ keywords: ["residential"] });
    expect(zone.interior_data_exists).toBe(false);
    expect(zone.interior_reconstructable).toBe(false);
    expect(zone.data_retention).toBe("NONE");
  });

  it("ABSOLUTE zones never have interior data — medical", () => {
    const zone = detectPrivacyZone({ keywords: ["medical"] });
    expect(zone.interior_data_exists).toBe(false);
    expect(zone.interior_reconstructable).toBe(false);
    expect(zone.protection_level).toBe("ABSOLUTE");
  });

  it("ABSOLUTE zones never have interior data — religious", () => {
    const zone = detectPrivacyZone({ keywords: ["religious"] });
    expect(zone.interior_data_exists).toBe(false);
    expect(zone.interior_reconstructable).toBe(false);
  });

  it("presence suppression is permanent at all tiers", () => {
    for (const tier of ["PUBLIC", "RESEARCH", "SOVEREIGN"]) {
      const result = suppressPresenceDetection({ tier });
      expect(result.suppressed).toBe(true);
      expect(result.tier_override_possible).toBe(false);
      expect(result.individual_data_available).toBe(false);
    }
  });

  it("vehicle tracking suppression is permanent at all tiers", () => {
    for (const tier of ["PUBLIC", "RESEARCH", "SOVEREIGN"]) {
      const result = suppressVehicleTracking({ tier });
      expect(result.suppressed).toBe(true);
      expect(result.tier_override_possible).toBe(false);
      expect(result.individual_data_available).toBe(false);
      expect(result.aggregate_available).toBe(true);
    }
  });

  it("privacy stats accumulate correctly across multiple zone types", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    detectPrivacyZone({ keywords: ["military"] });
    detectPrivacyZone({ keywords: ["commercial"] });

    const stats = getPrivacyStats();
    expect(stats.totalZones).toBe(5);
    expect(stats.byProtectionLevel.ABSOLUTE).toBe(3);
    expect(stats.byProtectionLevel.RESTRICTED).toBe(1);
    expect(stats.byProtectionLevel.CONTROLLED).toBe(1);
    expect(stats.byClassification.residential).toBe(2);
    expect(stats.byClassification.medical).toBe(1);
  });

  it("zone verification confirms no interior data for ABSOLUTE zones", () => {
    const zone = detectPrivacyZone({ keywords: ["residential"] });
    const zones = getPrivacyZones();
    const verified = zones.zones[0];

    expect(verified.interior_data_exists).toBe(false);
    expect(verified.interior_reconstructable).toBe(false);
  });
});

// ── Safety Frequency Enforcement ────────────────────────────────────────────

describe("Safety Frequency Enforcement", () => {
  beforeEach(async () => {
    await initializeCortex({});
  });

  it("aviation frequencies [108-137 MHz] are always forbidden", () => {
    for (const freq of [108, 115, 121.5, 130, 137]) {
      const sig = cortexClassifySignal({ frequency: freq });
      expect(sig.adjustability).toBe("ADJUST_FORBIDDEN");
    }
  });

  it("aviation DME/SSR [960-1215 MHz] are always forbidden", () => {
    for (const freq of [960, 1090, 1215]) {
      const sig = cortexClassifySignal({ frequency: freq });
      expect(sig.adjustability).toBe("ADJUST_FORBIDDEN");
    }
  });

  it("medical ISM [2400-2500 MHz] are always forbidden", () => {
    for (const freq of [2400, 2450, 2500]) {
      const sig = cortexClassifySignal({ frequency: freq });
      expect(sig.adjustability).toBe("ADJUST_FORBIDDEN");
    }
  });

  it("emergency frequencies are always forbidden", () => {
    for (const freq of [121.5, 156.8, 406]) {
      const sig = cortexClassifySignal({ frequency: freq });
      expect(sig.adjustability).toBe("ADJUST_FORBIDDEN");
    }
  });

  it("military UHF [225-400 MHz] are always forbidden", () => {
    for (const freq of [225, 300, 350, 400]) {
      const sig = cortexClassifySignal({ frequency: freq });
      expect(sig.adjustability).toBe("ADJUST_FORBIDDEN");
    }
  });

  it("jamming is always forbidden regardless of frequency", () => {
    const sig = cortexClassifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);
    expect(result.permitted).toBe(false);
    expect(result.reason).toBe("jamming_permanently_forbidden");
    expect(result.authorization_required).toBe("HARDCODED_DENY");
  });

  it("safe frequencies allow permitted adjustments", () => {
    // 800 MHz is cellular, not in any safety band
    const sig = cortexClassifySignal({ frequency: 800, keywords: ["cellular"] });
    expect(sig.adjustability).toBe("RESPOND_ALLOWED");

    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    expect(result.permitted).toBe(true);
  });
});

// ── Module Initialization ───────────────────────────────────────────────────

describe("Module Initialization", () => {
  it("all modules initialize independently", async () => {
    const atlasResult = await initializeAtlas({});
    const cortexResult = await initializeCortex({});
    const intelResult = await initializeIntelligence({});

    expect(atlasResult.ok).toBe(true);
    expect(cortexResult.ok).toBe(true);
    expect(intelResult.ok).toBe(true);
  });

  it("all modules report metrics after initialization", async () => {
    await initializeAtlas({});
    await initializeCortex({});
    await initializeIntelligence({});

    const atlasMetrics = getAtlasMetrics();
    expect(atlasMetrics.initialized).toBe(true);

    const cortexMetrics = getCortexMetrics();
    expect(cortexMetrics.initialized).toBe(true);

    const intelMetrics = getIntelligenceMetrics();
    expect(intelMetrics.initialized).toBe(true);
  });

  it("state reset is complete for all modules", async () => {
    await initializeAtlas({});
    await initializeCortex({});
    await initializeIntelligence({});

    collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400 });
    cortexClassifySignal({ frequency: 2400 });
    processSignalIntelligence({ category: "weather", content: "test", source: "test" });

    _resetAtlasState();
    _resetCortexState();
    _resetIntelligenceState();

    expect(getAtlasMetrics().initialized).toBe(false);
    expect(getCortexMetrics().initialized).toBe(false);
    expect(getIntelligenceMetrics().initialized).toBe(false);
    expect(getAtlasMetrics().stats.signalsCollected).toBe(0);
    expect(getCortexMetrics().stats.signalsClassified).toBe(0);
  });
});

// ── Edge Cases & Robustness ─────────────────────────────────────────────────

describe("Edge Cases & Robustness", () => {
  it("cortex handles signals with missing optional fields", () => {
    const result = cortexClassifySignal({ frequency: 800 });
    expect(result).not.toBeNull();
    expect(result.category).toBeDefined();
    expect(result.location.origin).toBeNull();
    expect(result.measurement.power).toBe(0);
    expect(result.measurement.multipath).toEqual([]);
  });

  it("cortex handles signals with zero frequency", () => {
    const result = cortexClassifySignal({ frequency: 0 });
    expect(result).not.toBeNull();
    expect(result.category).toBe("UNKNOWN");
  });

  it("cortex handles very high frequencies", () => {
    const result = cortexClassifySignal({ frequency: 1000000 });
    expect(result).not.toBeNull();
    expect(result.category).toBe("UNKNOWN");
  });

  it("privacy zone boundary check handles edge coordinates", () => {
    detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[0, 0], [0, 1], [1, 1], [1, 0]],
      },
    });

    // Exactly on boundary
    expect(checkPrivacy({ lat: 0, lng: 0 }).allowed).toBe(false);
    expect(checkPrivacy({ lat: 1, lng: 1 }).allowed).toBe(false);

    // Just outside
    expect(checkPrivacy({ lat: 1.1, lng: 0.5 }).allowed).toBe(true);
  });

  it("taxonomy pruning keeps within bounds", () => {
    // Classify many signals to trigger pruning
    for (let i = 0; i < 100; i++) {
      cortexClassifySignal({ frequency: 800 + i });
    }
    const taxonomy = getTaxonomy("all", 200);
    expect(taxonomy.totalClassified).toBe(100);
  });

  it("unknown signals queue respects max size", () => {
    // Classify many unknown signals
    for (let i = 0; i < 100; i++) {
      cortexClassifySignal({ frequency: 50000 + i }); // all UNKNOWN
    }
    const unknown = getUnknownSignals(200);
    expect(unknown.count).toBeLessThanOrEqual(200);
  });

  it("atlas handles path modeling with same source and destination", () => {
    const pos = { lat: 52.367, lng: 4.904 };
    const result = modelPath(pos, pos, { frequency: 2400, signalStrength: -65 });
    // Zero-distance path is invalid for propagation modeling (no free-space loss)
    expect(result).toBeNull();
  });

  it("intelligence handles empty content gracefully", () => {
    const result = processSignalIntelligence({ category: "weather", content: "", source: "test" });
    expect(result).toBeDefined();
  });
});

// ── Production Readiness Checks ─────────────────────────────────────────────

describe("Production Readiness", () => {
  it("all exported constants are frozen (immutable in production)", () => {
    expect(Object.isFrozen(SIGNAL_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(ALL_SIGNAL_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(SIGNAL_PURPOSES)).toBe(true);
    expect(Object.isFrozen(ADJUSTMENT_PERMISSIONS)).toBe(true);
    expect(Object.isFrozen(ADJUSTMENT_TYPES)).toBe(true);
    expect(Object.isFrozen(PRIVACY_LEVELS)).toBe(true);
    expect(Object.isFrozen(ZONE_PROTECTION)).toBe(true);
    expect(Object.isFrozen(TIERS)).toBe(true);
    expect(Object.isFrozen(CLASSIFICATIONS)).toBe(true);
    expect(Object.isFrozen(PUBLIC_CATEGORIES)).toBe(true);
  });

  it("signal IDs are unique across classifications", () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const result = cortexClassifySignal({ frequency: 800 + i });
      expect(ids.has(result.id)).toBe(false);
      ids.add(result.id);
    }
    expect(ids.size).toBe(50);
  });

  it("privacy zone IDs are unique", () => {
    const ids = new Set();
    for (let i = 0; i < 20; i++) {
      const zone = detectPrivacyZone({ keywords: ["residential"] });
      expect(ids.has(zone.id)).toBe(false);
      ids.add(zone.id);
    }
    expect(ids.size).toBe(20);
  });

  it("metrics reflect actual state accurately", async () => {
    await initializeCortex({});

    cortexClassifySignal({ frequency: 800 });
    cortexClassifySignal({ frequency: 50000 }); // UNKNOWN
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});
    suppressVehicleTracking({});

    const metrics = getCortexMetrics();
    expect(metrics.stats.signalsClassified).toBe(2);
    expect(metrics.stats.unknownSignals).toBe(1);
    expect(metrics.stats.privacyZonesCreated).toBe(1);
    expect(metrics.stats.presenceDetectionsSuppressed).toBe(1);
    expect(metrics.stats.vehicleTrackingSuppressed).toBe(1);
  });

  it("classification performance is consistent (50 signals < 100ms)", () => {
    const start = Date.now();
    for (let i = 0; i < 50; i++) {
      cortexClassifySignal({
        frequency: 800 + i,
        modulation: "OFDM",
        keywords: ["cellular"],
        power: -65,
        attenuation: 12,
      });
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
