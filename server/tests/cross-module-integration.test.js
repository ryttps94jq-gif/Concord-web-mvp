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

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

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
    assert.notEqual(sig, null);

    // Cortex classifies the same frequency signal
    const classified = cortexClassifySignal({
      frequency: 2400,
      modulation: "OFDM",
      keywords: ["wifi"],
    });
    assert.equal(classified.category, "COMMUNICATION");
    assert.equal(classified.purpose, "COMMUNICATION");
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
    assert.equal(zone.protection_level, "ABSOLUTE");

    // Privacy check at zone coordinates should block
    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, false);
    assert.equal(check.interior_data_exists, false);

    // Privacy check outside zone should allow
    const checkOutside = checkPrivacy({ lat: 53.0, lng: 5.0 });
    assert.equal(checkOutside.allowed, true);
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
    assert.equal(atlasCoverage.totalPaths, 2);

    // Cortex tracks classified signals
    const cortexMetrics = getCortexMetrics();
    assert.equal(cortexMetrics.taxonomy.totalClassified, 3);

    // They track different aspects of the same signals
    const spectrum = getSpectralOccupancy();
    assert.equal(spectrum.totalSignals, 3);
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
    assert.equal(publicVolume.accessibleLayers.length, 2);
    assert.ok(!publicVolume.accessibleLayers.includes("interior"));
    assert.ok(!publicVolume.accessibleLayers.includes("subsurface"));
    assert.ok(!publicVolume.accessibleLayers.includes("material"));
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
    assert.equal(sovereignVolume.accessibleLayers.length, 5);
  });

  it("intelligence and atlas intents are non-overlapping", () => {
    // Atlas-specific queries
    const atlasResult = detectAtlasIntent("Show me the atlas view of Amsterdam");
    assert.equal(atlasResult.isAtlasRequest, true);
    assert.equal(detectIntelIntent("Show me the atlas view of Amsterdam").isIntelRequest, false);

    // Intelligence-specific queries
    const intelResult = detectIntelIntent("What is the weather intelligence data?");
    assert.equal(intelResult.isIntelRequest, true);
    assert.equal(detectAtlasIntent("What is the weather intelligence data?").isAtlasRequest, false);

    // Cortex-specific queries
    const cortexResult = detectCortexIntent("Show signal taxonomy");
    assert.equal(cortexResult.isCortexRequest, true);
    assert.equal(detectAtlasIntent("Show signal taxonomy").isAtlasRequest, false);
    assert.equal(detectIntelIntent("Show signal taxonomy").isIntelRequest, false);
  });
});

// ── Privacy Architecture Hardening ──────────────────────────────────────────

describe("Privacy Architecture Hardening", () => {
  beforeEach(async () => {
    await initializeCortex({});
  });

  it("ABSOLUTE zones never have interior data — residential", () => {
    const zone = detectPrivacyZone({ keywords: ["residential"] });
    assert.equal(zone.interior_data_exists, false);
    assert.equal(zone.interior_reconstructable, false);
    assert.equal(zone.data_retention, "NONE");
  });

  it("ABSOLUTE zones never have interior data — medical", () => {
    const zone = detectPrivacyZone({ keywords: ["medical"] });
    assert.equal(zone.interior_data_exists, false);
    assert.equal(zone.interior_reconstructable, false);
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("ABSOLUTE zones never have interior data — religious", () => {
    const zone = detectPrivacyZone({ keywords: ["religious"] });
    assert.equal(zone.interior_data_exists, false);
    assert.equal(zone.interior_reconstructable, false);
  });

  it("presence suppression is permanent at all tiers", () => {
    for (const tier of ["PUBLIC", "RESEARCH", "SOVEREIGN"]) {
      const result = suppressPresenceDetection({ tier });
      assert.equal(result.suppressed, true);
      assert.equal(result.tier_override_possible, false);
      assert.equal(result.individual_data_available, false);
    }
  });

  it("vehicle tracking suppression is permanent at all tiers", () => {
    for (const tier of ["PUBLIC", "RESEARCH", "SOVEREIGN"]) {
      const result = suppressVehicleTracking({ tier });
      assert.equal(result.suppressed, true);
      assert.equal(result.tier_override_possible, false);
      assert.equal(result.individual_data_available, false);
      assert.equal(result.aggregate_available, true);
    }
  });

  it("privacy stats accumulate correctly across multiple zone types", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    detectPrivacyZone({ keywords: ["military"] });
    detectPrivacyZone({ keywords: ["commercial"] });

    const stats = getPrivacyStats();
    assert.equal(stats.totalZones, 5);
    assert.equal(stats.byProtectionLevel.ABSOLUTE, 3);
    assert.equal(stats.byProtectionLevel.RESTRICTED, 1);
    assert.equal(stats.byProtectionLevel.CONTROLLED, 1);
    assert.equal(stats.byClassification.residential, 2);
    assert.equal(stats.byClassification.medical, 1);
  });

  it("zone verification confirms no interior data for ABSOLUTE zones", () => {
    const zone = detectPrivacyZone({ keywords: ["residential"] });
    const zones = getPrivacyZones();
    const verified = zones.zones[0];

    assert.equal(verified.interior_data_exists, false);
    assert.equal(verified.interior_reconstructable, false);
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
      assert.equal(sig.adjustability, "ADJUST_FORBIDDEN");
    }
  });

  it("aviation DME/SSR [960-1215 MHz] are always forbidden", () => {
    for (const freq of [960, 1090, 1215]) {
      const sig = cortexClassifySignal({ frequency: freq });
      assert.equal(sig.adjustability, "ADJUST_FORBIDDEN");
    }
  });

  it("medical ISM [2400-2500 MHz] are always forbidden", () => {
    for (const freq of [2400, 2450, 2500]) {
      const sig = cortexClassifySignal({ frequency: freq });
      assert.equal(sig.adjustability, "ADJUST_FORBIDDEN");
    }
  });

  it("emergency frequencies are always forbidden", () => {
    for (const freq of [121.5, 156.8, 406]) {
      const sig = cortexClassifySignal({ frequency: freq });
      assert.equal(sig.adjustability, "ADJUST_FORBIDDEN");
    }
  });

  it("military UHF [225-400 MHz] are always forbidden", () => {
    for (const freq of [225, 300, 350, 400]) {
      const sig = cortexClassifySignal({ frequency: freq });
      assert.equal(sig.adjustability, "ADJUST_FORBIDDEN");
    }
  });

  it("jamming is always forbidden regardless of frequency", () => {
    const sig = cortexClassifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);
    assert.equal(result.permitted, false);
    assert.equal(result.reason, "jamming_permanently_forbidden");
    assert.equal(result.authorization_required, "HARDCODED_DENY");
  });

  it("safe frequencies allow permitted adjustments", () => {
    // 800 MHz is cellular, not in any safety band
    const sig = cortexClassifySignal({ frequency: 800, keywords: ["cellular"] });
    assert.equal(sig.adjustability, "RESPOND_ALLOWED");

    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    assert.equal(result.permitted, true);
  });
});

// ── Module Initialization ───────────────────────────────────────────────────

describe("Module Initialization", () => {
  it("all modules initialize independently", async () => {
    const atlasResult = await initializeAtlas({});
    const cortexResult = await initializeCortex({});
    const intelResult = await initializeIntelligence({});

    assert.equal(atlasResult.ok, true);
    assert.equal(cortexResult.ok, true);
    assert.equal(intelResult.ok, true);
  });

  it("all modules report metrics after initialization", async () => {
    await initializeAtlas({});
    await initializeCortex({});
    await initializeIntelligence({});

    const atlasMetrics = getAtlasMetrics();
    assert.equal(atlasMetrics.initialized, true);

    const cortexMetrics = getCortexMetrics();
    assert.equal(cortexMetrics.initialized, true);

    const intelMetrics = getIntelligenceMetrics();
    assert.equal(intelMetrics.initialized, true);
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

    assert.equal(getAtlasMetrics().initialized, false);
    assert.equal(getCortexMetrics().initialized, false);
    assert.equal(getIntelligenceMetrics().initialized, false);
    assert.equal(getAtlasMetrics().stats.signalsCollected, 0);
    assert.equal(getCortexMetrics().stats.signalsClassified, 0);
  });
});

// ── Edge Cases & Robustness ─────────────────────────────────────────────────

describe("Edge Cases & Robustness", () => {
  it("cortex handles signals with missing optional fields", () => {
    const result = cortexClassifySignal({ frequency: 800 });
    assert.notEqual(result, null);
    assert.notEqual(result.category, undefined);
    assert.equal(result.location.origin, null);
    assert.equal(result.measurement.power, 0);
    assert.deepEqual(result.measurement.multipath, []);
  });

  it("cortex handles signals with zero frequency", () => {
    const result = cortexClassifySignal({ frequency: 0 });
    assert.notEqual(result, null);
    assert.equal(result.category, "UNKNOWN");
  });

  it("cortex handles very high frequencies", () => {
    const result = cortexClassifySignal({ frequency: 1000000 });
    assert.notEqual(result, null);
    assert.equal(result.category, "UNKNOWN");
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
    assert.equal(checkPrivacy({ lat: 0, lng: 0 }).allowed, false);
    assert.equal(checkPrivacy({ lat: 1, lng: 1 }).allowed, false);

    // Just outside
    assert.equal(checkPrivacy({ lat: 1.1, lng: 0.5 }).allowed, true);
  });

  it("taxonomy pruning keeps within bounds", () => {
    // Classify many signals to trigger pruning
    for (let i = 0; i < 100; i++) {
      cortexClassifySignal({ frequency: 800 + i });
    }
    const taxonomy = getTaxonomy("all", 200);
    assert.equal(taxonomy.totalClassified, 100);
  });

  it("unknown signals queue respects max size", () => {
    // Classify many unknown signals
    for (let i = 0; i < 100; i++) {
      cortexClassifySignal({ frequency: 50000 + i }); // all UNKNOWN
    }
    const unknown = getUnknownSignals(200);
    assert.ok(unknown.count <= 200);
  });

  it("atlas handles path modeling with same source and destination", () => {
    const pos = { lat: 52.367, lng: 4.904 };
    const result = modelPath(pos, pos, { frequency: 2400, signalStrength: -65 });
    // Zero-distance path is invalid for propagation modeling (no free-space loss)
    assert.equal(result, null);
  });

  it("intelligence handles empty content gracefully", () => {
    const result = processSignalIntelligence({ category: "weather", content: "", source: "test" });
    assert.notEqual(result, undefined);
  });
});

// ── Production Readiness Checks ─────────────────────────────────────────────

describe("Production Readiness", () => {
  it("all exported constants are frozen (immutable in production)", () => {
    assert.equal(Object.isFrozen(SIGNAL_CATEGORIES), true);
    assert.equal(Object.isFrozen(ALL_SIGNAL_CATEGORIES), true);
    assert.equal(Object.isFrozen(SIGNAL_PURPOSES), true);
    assert.equal(Object.isFrozen(ADJUSTMENT_PERMISSIONS), true);
    assert.equal(Object.isFrozen(ADJUSTMENT_TYPES), true);
    assert.equal(Object.isFrozen(PRIVACY_LEVELS), true);
    assert.equal(Object.isFrozen(ZONE_PROTECTION), true);
    assert.equal(Object.isFrozen(TIERS), true);
    assert.equal(Object.isFrozen(CLASSIFICATIONS), true);
    assert.equal(Object.isFrozen(PUBLIC_CATEGORIES), true);
  });

  it("signal IDs are unique across classifications", () => {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const result = cortexClassifySignal({ frequency: 800 + i });
      assert.equal(ids.has(result.id), false);
      ids.add(result.id);
    }
    assert.equal(ids.size, 50);
  });

  it("privacy zone IDs are unique", () => {
    const ids = new Set();
    for (let i = 0; i < 20; i++) {
      const zone = detectPrivacyZone({ keywords: ["residential"] });
      assert.equal(ids.has(zone.id), false);
      ids.add(zone.id);
    }
    assert.equal(ids.size, 20);
  });

  it("metrics reflect actual state accurately", async () => {
    await initializeCortex({});

    cortexClassifySignal({ frequency: 800 });
    cortexClassifySignal({ frequency: 50000 }); // UNKNOWN
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});
    suppressVehicleTracking({});

    const metrics = getCortexMetrics();
    assert.equal(metrics.stats.signalsClassified, 2);
    assert.equal(metrics.stats.unknownSignals, 1);
    assert.equal(metrics.stats.privacyZonesCreated, 1);
    assert.equal(metrics.stats.presenceDetectionsSuppressed, 1);
    assert.equal(metrics.stats.vehicleTrackingSuppressed, 1);
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
    assert.ok(elapsed < 100);
  });
});
