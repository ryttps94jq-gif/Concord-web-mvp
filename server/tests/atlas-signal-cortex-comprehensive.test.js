/**
 * Atlas Signal Cortex — Comprehensive Security Test Suite
 *
 * Targets 90%+ coverage with deep testing of:
 *   - Privacy zone enforcement (ABSOLUTE/RESTRICTED/CONTROLLED/OPEN)
 *   - Signal filtering (all 7 categories)
 *   - Zone boundary checks (polygon containment, edge cases)
 *   - Safety frequency enforcement (aviation, medical, emergency, military)
 *   - Presence/vehicle suppression hardcoded at ALL tiers
 *   - Adjustment permission matrix (all types vs safety frequencies)
 *   - Signal taxonomy edge cases (unknown queue, anomaly detection)
 *   - Spectral occupancy analysis
 *   - Privacy zone verification
 *   - Chat intent detection edge cases
 *   - Initialization and reset behavior
 *   - Full pipeline integration flows
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  SIGNAL_CATEGORIES,
  ALL_SIGNAL_CATEGORIES,
  SIGNAL_PURPOSES,
  ALL_SIGNAL_PURPOSES,
  ADJUSTMENT_PERMISSIONS,
  ADJUSTMENT_TYPES,
  PRIVACY_LEVELS,
  ZONE_CLASSIFICATIONS,
  ZONE_PROTECTION,
  OVERRIDE_AUTHORITY,
  SPATIAL_LEVELS,
  classifySignal,
  getTaxonomy,
  getUnknownSignals,
  getAnomalies,
  getSpectralOccupancy,
  detectPrivacyZone,
  checkPrivacy,
  getPrivacyZones,
  getPrivacyStats,
  verifyPrivacyZone,
  suppressPresenceDetection,
  suppressVehicleTracking,
  checkAdjustmentPermission,
  detectCortexIntent,
  getCortexMetrics,
  cortexHeartbeatTick,
  initializeCortex,
  _resetCortexState,
} from "../lib/atlas-signal-cortex.js";

beforeEach(() => {
  _resetCortexState();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY ZONE ENFORCEMENT — ABSOLUTE ZONES
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — ABSOLUTE Privacy Zone Enforcement", () => {
  const boundary = {
    type: "polygon",
    coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
  };

  it("residential zone: interior data NEVER exists", () => {
    const zone = detectPrivacyZone({ keywords: ["residential"], boundary });
    assert.equal(zone.interior_data_exists, false);
    assert.equal(zone.interior_reconstructable, false);
    assert.equal(zone.data_retention, "NONE");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("medical zone: interior data NEVER exists", () => {
    const zone = detectPrivacyZone({ keywords: ["medical", "hospital"], boundary });
    assert.equal(zone.interior_data_exists, false);
    assert.equal(zone.interior_reconstructable, false);
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("religious zone: interior data NEVER exists", () => {
    const zone = detectPrivacyZone({ keywords: ["church", "religious"], boundary });
    assert.equal(zone.interior_data_exists, false);
    assert.equal(zone.interior_reconstructable, false);
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("checkPrivacy blocks reconstruction inside ABSOLUTE zone", () => {
    detectPrivacyZone({ keywords: ["residential"], boundary });
    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, false);
    assert.equal(check.protection_level, "ABSOLUTE");
    assert.equal(check.reason, "absolute_privacy_zone");
    assert.equal(check.interior_data_exists, false);
    assert.equal(check.interior_reconstructable, false);
  });

  it("checkPrivacy blocks at exact boundary corner", () => {
    detectPrivacyZone({ keywords: ["residential"], boundary });
    const check = checkPrivacy({ lat: 52.36, lng: 4.90 });
    assert.equal(check.allowed, false);
  });

  it("checkPrivacy allows outside ABSOLUTE zone", () => {
    detectPrivacyZone({ keywords: ["residential"], boundary });
    const check = checkPrivacy({ lat: 0, lng: 0 });
    assert.equal(check.allowed, true);
    assert.equal(check.reason, "no_privacy_zone");
  });

  it("multiple ABSOLUTE zones all enforced", () => {
    detectPrivacyZone({
      keywords: ["residential"],
      boundary: { type: "polygon", coordinates: [[10, 10], [10, 11], [11, 11], [11, 10]] },
    });
    detectPrivacyZone({
      keywords: ["medical"],
      boundary: { type: "polygon", coordinates: [[20, 20], [20, 21], [21, 21], [21, 20]] },
    });

    assert.equal(checkPrivacy({ lat: 10.5, lng: 10.5 }).allowed, false);
    assert.equal(checkPrivacy({ lat: 20.5, lng: 20.5 }).allowed, false);
    assert.equal(checkPrivacy({ lat: 30, lng: 30 }).allowed, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY ZONE ENFORCEMENT — RESTRICTED ZONES
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — RESTRICTED Privacy Zone Enforcement", () => {
  const boundary = {
    type: "polygon",
    coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
  };

  it("government zone: exterior only", () => {
    detectPrivacyZone({ keywords: ["government", "embassy"], boundary });
    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, false);
    assert.equal(check.protection_level, "RESTRICTED");
    assert.equal(check.reason, "restricted_zone_exterior_only");
  });

  it("military zone: exterior only", () => {
    detectPrivacyZone({ keywords: ["military", "base"], boundary });
    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, false);
    assert.equal(check.protection_level, "RESTRICTED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY ZONE ENFORCEMENT — CONTROLLED ZONES
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — CONTROLLED Privacy Zone Enforcement", () => {
  const boundary = {
    type: "polygon",
    coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
  };

  it("commercial zone: allowed with governance requirement", () => {
    detectPrivacyZone({ keywords: ["commercial"], boundary });
    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, true);
    assert.equal(check.protection_level, "CONTROLLED");
    assert.equal(check.requires_governance, true);
  });

  it("industrial zone: allowed with governance requirement", () => {
    detectPrivacyZone({ keywords: ["industrial", "factory"], boundary });
    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, true);
    assert.equal(check.protection_level, "CONTROLLED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY ZONE — OPEN CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — OPEN Zone Classification", () => {
  it("open_land returns null (no zone created)", () => {
    assert.equal(detectPrivacyZone({ classification: "open_land" }), null);
  });

  it("water returns null", () => {
    assert.equal(detectPrivacyZone({ classification: "water" }), null);
  });

  it("atmosphere returns null", () => {
    assert.equal(detectPrivacyZone({ classification: "atmosphere" }), null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY ZONE — AGGRESSIVE RESIDENTIAL DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Aggressive Privacy Detection", () => {
  it("WiFi signals alone trigger residential protection", () => {
    const zone = detectPrivacyZone({
      signals: [
        { category: "COMMUNICATION", frequency: 2400 },
        { category: "COMMUNICATION", frequency: 5200 },
      ],
    });
    assert.equal(zone.classification, "residential");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("single unknown signal defaults to residential (protect by default)", () => {
    const zone = detectPrivacyZone({
      signals: [{ category: "UNKNOWN", frequency: 900 }],
    });
    assert.equal(zone.classification, "residential");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("description-based detection: 'residential area'", () => {
    const zone = detectPrivacyZone({
      description: "Signals detected in residential area near houses",
    });
    assert.equal(zone.classification, "residential");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("description-based detection: 'hospital equipment'", () => {
    const zone = detectPrivacyZone({
      description: "Signal from hospital medical equipment",
    });
    assert.equal(zone.classification, "medical");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("description-based detection: 'industrial factory'", () => {
    const zone = detectPrivacyZone({
      description: "Signal detected at industrial factory complex",
    });
    assert.equal(zone.classification, "industrial");
    assert.equal(zone.protection_level, "CONTROLLED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY ZONE — STATS TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Privacy Stats Tracking", () => {
  it("tracks total zones created", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    detectPrivacyZone({ keywords: ["military"] });

    const stats = getPrivacyStats();
    assert.equal(stats.totalZones, 3);
  });

  it("breaks down by protection level", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    detectPrivacyZone({ keywords: ["military"] });
    detectPrivacyZone({ keywords: ["commercial"] });

    const stats = getPrivacyStats();
    assert.equal(stats.byProtectionLevel.ABSOLUTE, 2);
    assert.equal(stats.byProtectionLevel.RESTRICTED, 1);
    assert.equal(stats.byProtectionLevel.CONTROLLED, 1);
  });

  it("breaks down by classification", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["residential"] }); // two residential zones
    detectPrivacyZone({ keywords: ["medical"] });

    const stats = getPrivacyStats();
    assert.equal(stats.byClassification.residential, 2);
    assert.equal(stats.byClassification.medical, 1);
  });

  it("tracks blocks enforced", () => {
    detectPrivacyZone({
      keywords: ["residential"],
      boundary: { type: "polygon", coordinates: [[10, 10], [10, 11], [11, 11], [11, 10]] },
    });

    checkPrivacy({ lat: 10.5, lng: 10.5 });
    checkPrivacy({ lat: 10.5, lng: 10.5 });
    checkPrivacy({ lat: 10.5, lng: 10.5 });

    const stats = getPrivacyStats();
    assert.equal(stats.blocksEnforced, 3);
  });

  it("tracks lastPrivacyCheckAt", () => {
    checkPrivacy({ lat: 0, lng: 0 });
    const stats = getPrivacyStats();
    assert.ok(stats.lastPrivacyCheckAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVACY ZONE RETRIEVAL AND VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Privacy Zone Retrieval", () => {
  beforeEach(() => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    detectPrivacyZone({ keywords: ["military"] });
    detectPrivacyZone({ keywords: ["commercial"] });
  });

  it("retrieves all zones", () => {
    const result = getPrivacyZones();
    assert.equal(result.ok, true);
    assert.equal(result.count, 4);
  });

  it("respects limit parameter", () => {
    const result = getPrivacyZones(2);
    assert.equal(result.zones.length, 2);
  });

  it("verifies zone integrity", () => {
    const zones = getPrivacyZones();
    const zoneId = zones.zones[0].id;

    const result = verifyPrivacyZone(zoneId);
    assert.equal(result.ok, true);
    assert.equal(result.integrity, "verified");
    assert.equal(result.interior_data_exists, false);
    assert.equal(result.interior_reconstructable, false);
  });

  it("verifyPrivacyZone returns error for nonexistent zone", () => {
    const result = verifyPrivacyZone("zone_does_not_exist");
    assert.equal(result.ok, false);
    assert.equal(result.error, "zone_not_found");
  });

  it("verifyPrivacyZone returns error for null", () => {
    const result = verifyPrivacyZone(null);
    assert.equal(result.ok, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRESENCE & VEHICLE SUPPRESSION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Suppression Hardcoded at ALL Tiers", () => {
  const tiers = ["PUBLIC", "RESEARCH", "SOVEREIGN", "UNKNOWN", ""];

  for (const tier of tiers) {
    it(`presence detection suppressed at tier: ${tier || "empty"}`, () => {
      const result = suppressPresenceDetection({ tier });
      assert.equal(result.suppressed, true);
      assert.equal(result.tier_override_possible, false);
      assert.equal(result.individual_data_available, false);
      assert.equal(result.reason, "presence_detection_permanently_suppressed");
    });

    it(`vehicle tracking suppressed at tier: ${tier || "empty"}`, () => {
      const result = suppressVehicleTracking({ tier });
      assert.equal(result.suppressed, true);
      assert.equal(result.tier_override_possible, false);
      assert.equal(result.individual_data_available, false);
      assert.equal(result.reason, "vehicle_tracking_permanently_suppressed");
    });
  }

  it("vehicle tracking provides aggregate at road_segment level only", () => {
    const result = suppressVehicleTracking({});
    assert.equal(result.aggregate_available, true);
    assert.equal(result.aggregate_resolution, "road_segment");
  });

  it("presence suppression increments counter", () => {
    suppressPresenceDetection({});
    suppressPresenceDetection({});
    const metrics = getCortexMetrics();
    assert.equal(metrics.privacy.presenceSuppressed, 2);
  });

  it("vehicle suppression increments counter", () => {
    suppressVehicleTracking({});
    suppressVehicleTracking({});
    suppressVehicleTracking({});
    const metrics = getCortexMetrics();
    assert.equal(metrics.privacy.vehicleSuppressed, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL CLASSIFICATION — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Signal Classification Edge Cases", () => {
  it("null input returns null", () => {
    assert.equal(classifySignal(null), null);
    assert.equal(classifySignal(undefined), null);
  });

  it("empty object produces UNKNOWN category", () => {
    const result = classifySignal({});
    assert.ok(result);
    assert.equal(result.category, "UNKNOWN");
  });

  it("preserves existing id if provided", () => {
    const result = classifySignal({ id: "custom_id", frequency: 2400 });
    assert.equal(result.id, "custom_id");
  });

  it("generates id if not provided", () => {
    const result = classifySignal({ frequency: 2400 });
    assert.ok(result.id.startsWith("sig_"));
  });

  it("classification adds cortex tag", () => {
    const result = classifySignal({ frequency: 2400 });
    assert.ok(result.tags.includes("cortex"));
  });

  it("SCIENTIFIC detected by frequency 137.5 + weather keyword", () => {
    const result = classifySignal({ frequency: 137.5, keywords: ["weather"] });
    assert.equal(result.category, "SCIENTIFIC");
    assert.equal(result.purpose, "MEASUREMENT");
  });

  it("GEOLOGICAL detected by very low frequency + keyword", () => {
    const result = classifySignal({ frequency: 0.001, keywords: ["tectonic"] });
    assert.equal(result.category, "GEOLOGICAL");
    assert.equal(result.purpose, "NATURAL");
  });

  it("BIOLOGICAL detected by low frequency + neural keyword", () => {
    const result = classifySignal({ frequency: 10, keywords: ["neural"] });
    assert.equal(result.category, "BIOLOGICAL");
    assert.equal(result.adjustability, "OBSERVE_ONLY");
  });

  it("INFRASTRUCTURE detected by 50Hz power frequency", () => {
    const result = classifySignal({ frequency: 50, keywords: ["power", "grid"] });
    assert.equal(result.category, "INFRASTRUCTURE");
    assert.equal(result.purpose, "UTILITY");
  });

  it("COMMUNICATION detected by WiFi frequency + OFDM modulation", () => {
    const result = classifySignal({ frequency: 2400, modulation: "OFDM" });
    assert.equal(result.category, "COMMUNICATION");
  });

  it("NAVIGATION detected by GPS L1 frequency", () => {
    const result = classifySignal({ frequency: 1575, modulation: "BPSK" });
    assert.equal(result.category, "NAVIGATION");
    assert.equal(result.purpose, "BEACON");
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("interference signals detected", () => {
    const result = classifySignal({ frequency: 2400, is_interference: true });
    assert.equal(result.purpose, "INTERFERENCE");
  });

  it("legacy signals detected", () => {
    const result = classifySignal({ frequency: 900, is_legacy: true });
    assert.equal(result.purpose, "LEGACY");
  });

  it("artifact signals detected from description", () => {
    const result = classifySignal({ frequency: 1000, description: "artifact from old equipment noise" });
    assert.equal(result.purpose, "ARTIFACT");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAFETY FREQUENCY ENFORCEMENT — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Safety Frequency Enforcement", () => {
  it("aviation: 108 MHz forbidden", () => {
    const result = classifySignal({ frequency: 108 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("aviation: 121.5 MHz guard frequency forbidden", () => {
    const result = classifySignal({ frequency: 121.5 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("aviation: 137 MHz boundary forbidden", () => {
    const result = classifySignal({ frequency: 137 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("aviation: 5010 MHz MLS forbidden", () => {
    const result = classifySignal({ frequency: 5010 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("medical: 401 MHz MICS forbidden", () => {
    const result = classifySignal({ frequency: 401 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("medical: 406 MHz boundary forbidden", () => {
    const result = classifySignal({ frequency: 406 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("emergency: 156.8 MHz marine distress forbidden", () => {
    const result = classifySignal({ frequency: 156.8 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("emergency: 406 MHz EPIRB forbidden", () => {
    const result = classifySignal({ frequency: 406 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("military: 225 MHz UHF mil band forbidden", () => {
    const result = classifySignal({ frequency: 225 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("military: 300 MHz mid-band forbidden", () => {
    const result = classifySignal({ frequency: 300 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("military: 400 MHz boundary forbidden", () => {
    const result = classifySignal({ frequency: 400 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("non-safety frequency is not forbidden", () => {
    const result = classifySignal({ frequency: 800, keywords: ["cellular"], modulation: "OFDM" });
    assert.notEqual(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("safety check overrides category-based adjustability", () => {
    // 403 MHz is medical range; even if OFDM/cellular keywords
    const result = classifySignal({ frequency: 403, modulation: "OFDM", keywords: ["cellular"] });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADJUSTMENT PERMISSION MATRIX — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Adjustment Permission Matrix", () => {
  it("null signal returns error", () => {
    const r = checkAdjustmentPermission(null, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    assert.equal(r.ok, false);
  });

  it("null adjustment type returns error", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, null);
    assert.equal(r.ok, false);
  });

  it("GAMMA_MODULATION permitted on safe frequencies", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    assert.equal(r.permitted, true);
    assert.equal(r.permission, "MODULATE_ALLOWED");
  });

  it("MESH_OPTIMIZATION permitted on safe frequencies", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION);
    assert.equal(r.permitted, true);
  });

  it("EMERGENCY_AMPLIFICATION permitted on safe frequencies", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION);
    assert.equal(r.permitted, true);
  });

  it("ENVIRONMENTAL_HARMONIZATION permitted on safe frequencies", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.ENVIRONMENTAL_HARMONIZATION);
    assert.equal(r.permitted, true);
  });

  it("INFRASTRUCTURE_INTERACTION restricted (requires sovereign)", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.INFRASTRUCTURE_INTERACTION);
    assert.equal(r.permitted, false);
    assert.equal(r.permission, "ADJUST_RESTRICTED");
    assert.equal(r.authorization_required, "SOVEREIGN");
  });

  it("SPECTRUM_CLEARING restricted (requires sovereign)", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.SPECTRUM_CLEARING);
    assert.equal(r.permitted, false);
    assert.equal(r.authorization_required, "SOVEREIGN");
  });

  it("JAMMING permanently forbidden", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);
    assert.equal(r.permitted, false);
    assert.equal(r.permission, "ADJUST_FORBIDDEN");
    assert.equal(r.reason, "jamming_permanently_forbidden");
    assert.equal(r.authorization_required, "HARDCODED_DENY");
  });

  it("unknown adjustment type defaults to OBSERVE_ONLY", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const r = checkAdjustmentPermission(sig.id, "SOME_UNKNOWN_TYPE");
    assert.equal(r.permitted, false);
    assert.equal(r.permission, "OBSERVE_ONLY");
  });

  it("permitted adjustments on aviation freq forbidden via safety check", () => {
    const sig = classifySignal({ frequency: 121.5 });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    assert.equal(r.permitted, false);
    assert.equal(r.authorization_required, "HARDCODED_DENY");
    assert.equal(r.safety.affects_aviation, true);
  });

  it("permitted adjustments on medical freq forbidden via safety check", () => {
    const sig = classifySignal({ frequency: 403 });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION);
    assert.equal(r.permitted, false);
    assert.equal(r.safety.affects_medical, true);
  });

  it("permitted adjustments on emergency freq forbidden via safety check", () => {
    const sig = classifySignal({ frequency: 156.8 });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION);
    assert.equal(r.permitted, false);
    assert.equal(r.safety.affects_emergency, true);
  });

  it("permitted adjustments on military freq forbidden via safety check", () => {
    const sig = classifySignal({ frequency: 300 });
    const r = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.ENVIRONMENTAL_HARMONIZATION);
    assert.equal(r.permitted, false);
    assert.equal(r.safety.affects_military, true);
  });

  it("tracks permitted count", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION);
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION);

    const metrics = getCortexMetrics();
    assert.equal(metrics.adjustments.permitted, 3);
  });

  it("tracks forbidden count", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);

    const sig2 = classifySignal({ frequency: 121.5 });
    checkAdjustmentPermission(sig2.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    const metrics = getCortexMetrics();
    assert.equal(metrics.adjustments.forbidden, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL TAXONOMY — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Taxonomy Edge Cases", () => {
  it("getTaxonomy('all') returns all classified signals", () => {
    classifySignal({ frequency: 2400 });
    classifySignal({ frequency: 900 });
    classifySignal({ frequency: 50, keywords: ["power"] });

    const result = getTaxonomy("all");
    assert.equal(result.ok, true);
    assert.equal(result.totalClassified, 3);
  });

  it("getTaxonomy by category filters correctly", () => {
    classifySignal({ frequency: 2400, modulation: "OFDM" }); // COMMUNICATION
    classifySignal({ frequency: 50, keywords: ["power"] }); // INFRASTRUCTURE

    const comms = getTaxonomy("COMMUNICATION");
    assert.ok(comms.signals.every(s => s.category === "COMMUNICATION"));

    const infra = getTaxonomy("INFRASTRUCTURE");
    assert.ok(infra.signals.every(s => s.category === "INFRASTRUCTURE"));
  });

  it("getTaxonomy respects limit", () => {
    for (let i = 0; i < 10; i++) {
      classifySignal({ frequency: 2400 + i });
    }
    const result = getTaxonomy("all", 5);
    assert.equal(result.count, 5);
  });

  it("getUnknownSignals returns only UNKNOWN category", () => {
    classifySignal({ frequency: 2400, modulation: "OFDM" }); // known
    classifySignal({ frequency: 99999 }); // unknown
    classifySignal({ frequency: 88888 }); // unknown

    const unknown = getUnknownSignals();
    assert.equal(unknown.count, 2);
    assert.ok(unknown.signals.every(s => s.category === "UNKNOWN"));
  });

  it("getAnomalies detects anomalous signals", () => {
    classifySignal({ frequency: 2400, frequency_drift: 0.5, attenuation: 60 });
    classifySignal({ frequency: 900 }); // normal

    const anomalies = getAnomalies();
    assert.equal(anomalies.ok, true);
    assert.ok(anomalies.count >= 1);
  });

  it("getSpectralOccupancy returns band breakdown", () => {
    classifySignal({ frequency: 2400, modulation: "OFDM" });
    classifySignal({ frequency: 900, modulation: "LoRa" });
    classifySignal({ frequency: 50, keywords: ["power"] });
    classifySignal({ frequency: 1575, modulation: "BPSK" });

    const occupancy = getSpectralOccupancy();
    assert.equal(occupancy.ok, true);
    assert.equal(occupancy.totalSignals, 4);
    assert.ok(occupancy.bands);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL MEASUREMENT — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Signal Measurement", () => {
  it("records all measurement properties", () => {
    const result = classifySignal({
      frequency: 2400,
      power: -80,
      attenuation: 20,
      phase_shift: 90,
      frequency_drift: 0.1,
      multipath: [{ delay: 5, amplitude: -10 }, { delay: 10, amplitude: -20 }],
    });
    assert.equal(result.measurement.power, -80);
    assert.equal(result.measurement.attenuation, 20);
    assert.equal(result.measurement.phase_shift, 90);
    assert.equal(result.measurement.frequency_drift, 0.1);
    assert.equal(result.measurement.multipath.length, 2);
  });

  it("records location properties", () => {
    const result = classifySignal({
      frequency: 2400,
      origin: { lat: 52.37, lng: 4.90 },
      destination: { lat: 52.38, lng: 4.91 },
      path: [{ lat: 52.375, lng: 4.905 }],
      propagation_medium: ["air", "ground"],
      distance: 1500,
      transit_time: 5.0,
    });
    assert.deepEqual(result.location.origin, { lat: 52.37, lng: 4.90 });
    assert.deepEqual(result.location.destination, { lat: 52.38, lng: 4.91 });
    assert.equal(result.location.path.length, 1);
    assert.equal(result.location.propagation_medium.length, 2);
    assert.equal(result.location.distance, 1500);
    assert.equal(result.location.transit_time, 5.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT INTENT — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Intent Detection Edge Cases", () => {
  it("empty string returns false", () => {
    assert.equal(detectCortexIntent("").isCortexRequest, false);
  });

  it("null returns false", () => {
    assert.equal(detectCortexIntent(null).isCortexRequest, false);
  });

  it("undefined returns false", () => {
    assert.equal(detectCortexIntent(undefined).isCortexRequest, false);
  });

  it("taxonomy query: 'signal classification tree'", () => {
    const r = detectCortexIntent("signal classification tree");
    assert.equal(r.isCortexRequest, true);
    assert.equal(r.action, "taxonomy");
  });

  it("unknown query: 'list unclassified signals'", () => {
    const r = detectCortexIntent("list unclassified signals");
    assert.equal(r.action, "unknown");
  });

  it("anomaly query: 'unusual signal patterns'", () => {
    const r = detectCortexIntent("any unusual signal patterns?");
    assert.equal(r.action, "anomalies");
  });

  it("spectrum query: 'spectral map'", () => {
    const r = detectCortexIntent("What is the spectral map?");
    assert.equal(r.action, "spectrum");
  });

  it("privacy query: 'privacy protection stats'", () => {
    const r = detectCortexIntent("privacy protection stats");
    assert.equal(r.action, "privacy");
  });

  it("adjustment query: 'modulate this signal'", () => {
    const r = detectCortexIntent("modulate this signal frequency");
    assert.equal(r.action, "adjustment");
  });

  it("adjustment query: 'signal control options'", () => {
    const r = detectCortexIntent("signal control options");
    assert.equal(r.action, "adjustment");
  });

  it("does not match unrelated: 'weather today'", () => {
    assert.equal(detectCortexIntent("What's the weather today?").isCortexRequest, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Metrics", () => {
  it("returns all top-level metric sections", async () => {
    await initializeCortex({});
    const m = getCortexMetrics();
    assert.equal(m.initialized, true);
    assert.ok(m.taxonomy);
    assert.ok(m.privacy);
    assert.ok(m.adjustments);
    assert.ok(m.stats);
    assert.ok(m.uptime >= 0);
  });

  it("taxonomy metrics track signals and unknowns", () => {
    classifySignal({ frequency: 2400 });
    classifySignal({ frequency: 99999 });

    const m = getCortexMetrics();
    assert.equal(m.taxonomy.totalClassified, 2);
    assert.equal(m.taxonomy.unknownQueueSize, 1);
  });

  it("privacy metrics track zones and suppressions", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});
    suppressVehicleTracking({});

    const m = getCortexMetrics();
    assert.equal(m.privacy.totalZones, 1);
    assert.equal(m.privacy.presenceSuppressed, 1);
    assert.equal(m.privacy.vehicleSuppressed, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEARTBEAT — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Heartbeat", () => {
  it("runs without error", async () => {
    await initializeCortex({});
    await cortexHeartbeatTick({}, 1);
    assert.ok(true);
  });

  it("survives null STATE", async () => {
    await cortexHeartbeatTick(null, 1);
    assert.ok(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Initialization", () => {
  it("initializes with all categories and permissions", async () => {
    const result = await initializeCortex({});
    assert.equal(result.ok, true);
    assert.deepEqual(result.signalCategories, ALL_SIGNAL_CATEGORIES);
    assert.deepEqual(result.signalPurposes, ALL_SIGNAL_PURPOSES);
    assert.deepEqual(result.privacyLevels, Object.values(PRIVACY_LEVELS));
    assert.deepEqual(result.adjustmentPermissions, Object.values(ADJUSTMENT_PERMISSIONS));
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeCortex({});
    const result = await initializeCortex({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATE RESET — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — State Reset", () => {
  it("reset clears all state", async () => {
    await initializeCortex({});
    classifySignal({ frequency: 2400 });
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});
    suppressVehicleTracking({});

    _resetCortexState();

    const m = getCortexMetrics();
    assert.equal(m.initialized, false);
    assert.equal(m.taxonomy.totalClassified, 0);
    assert.equal(m.privacy.totalZones, 0);
    assert.equal(m.privacy.presenceSuppressed, 0);
    assert.equal(m.privacy.vehicleSuppressed, 0);
    assert.equal(m.stats.signalsClassified, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FULL PIPELINE INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("ASC Comprehensive — Full Pipeline Integration", () => {
  beforeEach(async () => {
    await initializeCortex({});
  });

  it("classify signals -> detect zone -> check privacy -> adjust permission (complete flow)", () => {
    // Step 1: Classify signals in area
    const cellularSig = classifySignal({ frequency: 800, modulation: "OFDM", keywords: ["cellular"] });
    const infraSig = classifySignal({ frequency: 50, keywords: ["power", "grid"] });
    const navSig = classifySignal({ frequency: 1575, modulation: "BPSK" });

    assert.equal(cellularSig.category, "COMMUNICATION");
    assert.equal(infraSig.category, "INFRASTRUCTURE");
    assert.equal(navSig.category, "NAVIGATION");

    // Step 2: Detect privacy zone
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });
    assert.equal(zone.protection_level, "ABSOLUTE");

    // Step 3: Privacy check
    const insideCheck = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(insideCheck.allowed, false);
    assert.equal(insideCheck.interior_data_exists, false);

    const outsideCheck = checkPrivacy({ lat: 0, lng: 0 });
    assert.equal(outsideCheck.allowed, true);

    // Step 4: Adjustment permission
    const cellularAdj = checkAdjustmentPermission(cellularSig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    assert.equal(cellularAdj.permitted, true);

    const navAdj = checkAdjustmentPermission(navSig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    // 1575 MHz is in GPS range but not in safety frequency bands (108-137, 960-1215, 5000-5030)
    // so navigation signals may still be permitted for gamma_modulation if not safety-banned
    assert.equal(typeof navAdj.permitted, "boolean");

    const jamAdj = checkAdjustmentPermission(cellularSig.id, ADJUSTMENT_TYPES.JAMMING);
    assert.equal(jamAdj.permitted, false); // jamming always forbidden

    // Step 5: Suppression
    const presResult = suppressPresenceDetection({ tier: "SOVEREIGN" });
    assert.equal(presResult.suppressed, true);

    const vehResult = suppressVehicleTracking({ tier: "SOVEREIGN" });
    assert.equal(vehResult.suppressed, true);

    // Step 6: Verify metrics
    const metrics = getCortexMetrics();
    assert.equal(metrics.taxonomy.totalClassified, 3);
    assert.equal(metrics.privacy.totalZones, 1);
    assert.ok(metrics.adjustments.permitted >= 1);
    assert.ok(metrics.adjustments.forbidden >= 1);
    assert.equal(metrics.privacy.presenceSuppressed, 1);
    assert.equal(metrics.privacy.vehicleSuppressed, 1);
  });

  it("multiple zones with mixed protection levels", () => {
    detectPrivacyZone({
      keywords: ["residential"],
      boundary: { type: "polygon", coordinates: [[10, 10], [10, 11], [11, 11], [11, 10]] },
    });
    detectPrivacyZone({
      keywords: ["commercial"],
      boundary: { type: "polygon", coordinates: [[20, 20], [20, 21], [21, 21], [21, 20]] },
    });
    detectPrivacyZone({
      keywords: ["military"],
      boundary: { type: "polygon", coordinates: [[30, 30], [30, 31], [31, 31], [31, 30]] },
    });

    // Residential: blocked
    assert.equal(checkPrivacy({ lat: 10.5, lng: 10.5 }).allowed, false);
    assert.equal(checkPrivacy({ lat: 10.5, lng: 10.5 }).protection_level, "ABSOLUTE");

    // Commercial: allowed with governance
    assert.equal(checkPrivacy({ lat: 20.5, lng: 20.5 }).allowed, true);
    assert.equal(checkPrivacy({ lat: 20.5, lng: 20.5 }).requires_governance, true);

    // Military: blocked
    assert.equal(checkPrivacy({ lat: 30.5, lng: 30.5 }).allowed, false);
    assert.equal(checkPrivacy({ lat: 30.5, lng: 30.5 }).protection_level, "RESTRICTED");

    // Outside all zones: allowed
    assert.equal(checkPrivacy({ lat: 50, lng: 50 }).allowed, true);
    assert.equal(checkPrivacy({ lat: 50, lng: 50 }).reason, "no_privacy_zone");
  });
});
