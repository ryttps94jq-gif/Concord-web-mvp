/**
 * Atlas Signal Cortex — Test Suite
 *
 * Tests for signal classification, privacy architecture, and adjustment control:
 *   - Constants (categories, purposes, permissions, privacy, spatial)
 *   - Signal classification (5-property taxonomy)
 *   - Category identification (frequency, keyword, modulation matching)
 *   - Purpose classification
 *   - Adjustability determination
 *   - Signal taxonomy retrieval (taxonomy, unknown, anomalies, spectrum)
 *   - Privacy zone management (detection, classification, check, verify)
 *   - Presence & vehicle suppression (hardcoded at all tiers)
 *   - Signal adjustment permissions (safety checks, forbidden, permitted, restricted)
 *   - Chat intent detection
 *   - Metrics and heartbeat
 *   - Initialization and state reset
 *   - Full pipeline integration
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

// ── Constants ──────────────────────────────────────────────────────────────

describe("Constants", () => {
  it("defines 7 signal categories", () => {
    assert.equal(ALL_SIGNAL_CATEGORIES.length, 7);
    assert.ok(ALL_SIGNAL_CATEGORIES.includes("INFRASTRUCTURE"));
    assert.ok(ALL_SIGNAL_CATEGORIES.includes("COMMUNICATION"));
    assert.ok(ALL_SIGNAL_CATEGORIES.includes("NAVIGATION"));
    assert.ok(ALL_SIGNAL_CATEGORIES.includes("SCIENTIFIC"));
    assert.ok(ALL_SIGNAL_CATEGORIES.includes("BIOLOGICAL"));
    assert.ok(ALL_SIGNAL_CATEGORIES.includes("GEOLOGICAL"));
    assert.ok(ALL_SIGNAL_CATEGORIES.includes("UNKNOWN"));
  });

  it("defines 8 signal purposes", () => {
    assert.equal(ALL_SIGNAL_PURPOSES.length, 8);
    assert.ok(ALL_SIGNAL_PURPOSES.includes("UTILITY"));
    assert.ok(ALL_SIGNAL_PURPOSES.includes("COMMUNICATION"));
    assert.ok(ALL_SIGNAL_PURPOSES.includes("BEACON"));
    assert.ok(ALL_SIGNAL_PURPOSES.includes("MEASUREMENT"));
    assert.ok(ALL_SIGNAL_PURPOSES.includes("NATURAL"));
    assert.ok(ALL_SIGNAL_PURPOSES.includes("ARTIFACT"));
    assert.ok(ALL_SIGNAL_PURPOSES.includes("LEGACY"));
    assert.ok(ALL_SIGNAL_PURPOSES.includes("INTERFERENCE"));
  });

  it("defines 5 adjustment permissions", () => {
    assert.equal(ADJUSTMENT_PERMISSIONS.OBSERVE_ONLY, "OBSERVE_ONLY");
    assert.equal(ADJUSTMENT_PERMISSIONS.RESPOND_ALLOWED, "RESPOND_ALLOWED");
    assert.equal(ADJUSTMENT_PERMISSIONS.MODULATE_ALLOWED, "MODULATE_ALLOWED");
    assert.equal(ADJUSTMENT_PERMISSIONS.ADJUST_RESTRICTED, "ADJUST_RESTRICTED");
    assert.equal(ADJUSTMENT_PERMISSIONS.ADJUST_FORBIDDEN, "ADJUST_FORBIDDEN");
  });

  it("defines 7 adjustment types", () => {
    assert.equal(ADJUSTMENT_TYPES.GAMMA_MODULATION, "GAMMA_MODULATION");
    assert.equal(ADJUSTMENT_TYPES.MESH_OPTIMIZATION, "MESH_OPTIMIZATION");
    assert.equal(ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION, "EMERGENCY_AMPLIFICATION");
    assert.equal(ADJUSTMENT_TYPES.INFRASTRUCTURE_INTERACTION, "INFRASTRUCTURE_INTERACTION");
    assert.equal(ADJUSTMENT_TYPES.SPECTRUM_CLEARING, "SPECTRUM_CLEARING");
    assert.equal(ADJUSTMENT_TYPES.JAMMING, "JAMMING");
  });

  it("defines 4 privacy levels", () => {
    assert.equal(PRIVACY_LEVELS.ABSOLUTE, "ABSOLUTE");
    assert.equal(PRIVACY_LEVELS.RESTRICTED, "RESTRICTED");
    assert.equal(PRIVACY_LEVELS.CONTROLLED, "CONTROLLED");
    assert.equal(PRIVACY_LEVELS.OPEN, "OPEN");
  });

  it("defines zone classifications", () => {
    assert.equal(ZONE_CLASSIFICATIONS.RESIDENTIAL, "residential");
    assert.equal(ZONE_CLASSIFICATIONS.MEDICAL, "medical");
    assert.equal(ZONE_CLASSIFICATIONS.RELIGIOUS, "religious");
    assert.equal(ZONE_CLASSIFICATIONS.GOVERNMENT, "government");
    assert.equal(ZONE_CLASSIFICATIONS.MILITARY, "military");
    assert.equal(ZONE_CLASSIFICATIONS.COMMERCIAL, "commercial");
    assert.equal(ZONE_CLASSIFICATIONS.INDUSTRIAL, "industrial");
  });

  it("maps zones to protection levels", () => {
    assert.equal(ZONE_PROTECTION.residential, "ABSOLUTE");
    assert.equal(ZONE_PROTECTION.medical, "ABSOLUTE");
    assert.equal(ZONE_PROTECTION.religious, "ABSOLUTE");
    assert.equal(ZONE_PROTECTION.government, "RESTRICTED");
    assert.equal(ZONE_PROTECTION.military, "RESTRICTED");
    assert.equal(ZONE_PROTECTION.commercial, "CONTROLLED");
    assert.equal(ZONE_PROTECTION.industrial, "CONTROLLED");
    assert.equal(ZONE_PROTECTION.open_land, "OPEN");
    assert.equal(ZONE_PROTECTION.water, "OPEN");
    assert.equal(ZONE_PROTECTION.atmosphere, "OPEN");
  });

  it("defines override authority per level", () => {
    assert.equal(OVERRIDE_AUTHORITY.ABSOLUTE, "NONE");
    assert.equal(OVERRIDE_AUTHORITY.RESTRICTED, "NONE");
    assert.equal(OVERRIDE_AUTHORITY.CONTROLLED, "GOVERNANCE");
    assert.equal(OVERRIDE_AUTHORITY.OPEN, "NONE");
  });

  it("defines 9 spatial index levels", () => {
    assert.equal(SPATIAL_LEVELS.HEMISPHERE, 0);
    assert.equal(SPATIAL_LEVELS.BUILDING, 7);
    assert.equal(SPATIAL_LEVELS.ROOM, 8);
  });

  it("all constants are frozen", () => {
    assert.equal(Object.isFrozen(SIGNAL_CATEGORIES), true);
    assert.equal(Object.isFrozen(ALL_SIGNAL_CATEGORIES), true);
    assert.equal(Object.isFrozen(SIGNAL_PURPOSES), true);
    assert.equal(Object.isFrozen(ALL_SIGNAL_PURPOSES), true);
    assert.equal(Object.isFrozen(ADJUSTMENT_PERMISSIONS), true);
    assert.equal(Object.isFrozen(ADJUSTMENT_TYPES), true);
    assert.equal(Object.isFrozen(PRIVACY_LEVELS), true);
    assert.equal(Object.isFrozen(ZONE_CLASSIFICATIONS), true);
    assert.equal(Object.isFrozen(ZONE_PROTECTION), true);
    assert.equal(Object.isFrozen(OVERRIDE_AUTHORITY), true);
    assert.equal(Object.isFrozen(SPATIAL_LEVELS), true);
  });
});

// ── Signal Classification ──────────────────────────────────────────────────

describe("Signal Classification", () => {
  it("classifies a signal across all 5 properties", () => {
    const result = classifySignal({
      frequency: 2400,
      modulation: "OFDM",
      keywords: ["wifi"],
      origin: { lat: 52.37, lng: 4.90 },
      power: -65,
      attenuation: 12,
      phase_shift: 30,
    });

    assert.notEqual(result, null);
    assert.match(result.id, /^sig_/);
    assert.equal(result.category, "COMMUNICATION");
    assert.notEqual(result.location, undefined);
    assert.equal(result.purpose, "COMMUNICATION");
    assert.notEqual(result.measurement, undefined);
    assert.notEqual(result.adjustability, undefined);
    assert.notEqual(result.classified_at, undefined);
    assert.ok(result.tags.includes("cortex"));
    assert.ok(result.tags.includes("communication"));
  });

  it("returns null for null input", () => {
    assert.equal(classifySignal(null), null);
    assert.equal(classifySignal(undefined), null);
  });

  it("preserves signal identity properties", () => {
    const result = classifySignal({
      id: "my_sig_1",
      frequency: 900,
      modulation: "LoRa",
      bandwidth: 125,
      power_level: 14,
    });

    assert.equal(result.id, "my_sig_1");
    assert.equal(result.frequency, 900);
    assert.equal(result.modulation, "LoRa");
    assert.equal(result.bandwidth, 125);
    assert.equal(result.power_level, 14);
  });

  it("records location properties", () => {
    const result = classifySignal({
      frequency: 1200,
      origin: { lat: 10, lng: 20 },
      destination: { lat: 11, lng: 21 },
      path: [{ lat: 10.5, lng: 20.5 }],
      propagation_medium: ["air"],
      distance: 5000,
      transit_time: 16.7,
    });

    assert.deepEqual(result.location.origin, { lat: 10, lng: 20 });
    assert.deepEqual(result.location.destination, { lat: 11, lng: 21 });
    assert.equal(result.location.path.length, 1);
    assert.ok(result.location.propagation_medium.includes("air"));
    assert.equal(result.location.distance, 5000);
    assert.equal(result.location.transit_time, 16.7);
  });

  it("records measurement properties", () => {
    const result = classifySignal({
      frequency: 2400,
      power: -65,
      attenuation: 15,
      phase_shift: 45,
      frequency_drift: 0.05,
      multipath: [{ delay: 10 }],
    });

    assert.equal(result.measurement.power, -65);
    assert.equal(result.measurement.attenuation, 15);
    assert.equal(result.measurement.phase_shift, 45);
    assert.equal(result.measurement.frequency_drift, 0.05);
    assert.equal(result.measurement.multipath.length, 1);
  });

  it("updates classification stats", () => {
    classifySignal({ frequency: 2400 });
    classifySignal({ frequency: 900 });

    const metrics = getCortexMetrics();
    assert.equal(metrics.stats.signalsClassified, 2);
    assert.notEqual(metrics.stats.lastClassificationAt, null);
  });
});

// ── Category Identification ────────────────────────────────────────────────

describe("Category Identification", () => {
  it("identifies INFRASTRUCTURE by frequency (power line 50-60Hz)", () => {
    const result = classifySignal({ frequency: 50, keywords: ["power"] });
    assert.equal(result.category, "INFRASTRUCTURE");
  });

  it("identifies INFRASTRUCTURE by keyword", () => {
    const result = classifySignal({ frequency: 150, keywords: ["scada", "grid"] });
    assert.equal(result.category, "INFRASTRUCTURE");
  });

  it("identifies COMMUNICATION by frequency (cellular/WiFi)", () => {
    const result = classifySignal({ frequency: 2400, modulation: "OFDM" });
    assert.equal(result.category, "COMMUNICATION");
  });

  it("identifies COMMUNICATION by keyword", () => {
    const result = classifySignal({ frequency: 800, keywords: ["cellular", "bluetooth"] });
    assert.equal(result.category, "COMMUNICATION");
  });

  it("identifies NAVIGATION by frequency (GPS band)", () => {
    const result = classifySignal({ frequency: 1575, modulation: "BPSK" });
    assert.equal(result.category, "NAVIGATION");
  });

  it("identifies NAVIGATION by keyword", () => {
    const result = classifySignal({ frequency: 1200, keywords: ["gps", "navigation"] });
    assert.equal(result.category, "NAVIGATION");
  });

  it("identifies SCIENTIFIC by frequency (weather satellite)", () => {
    const result = classifySignal({ frequency: 137.5, keywords: ["weather"] });
    assert.equal(result.category, "SCIENTIFIC");
  });

  it("identifies BIOLOGICAL by frequency (ELF bioelectric)", () => {
    const result = classifySignal({ frequency: 10, keywords: ["neural", "bioelectric"] });
    assert.equal(result.category, "BIOLOGICAL");
  });

  it("identifies GEOLOGICAL by frequency and keyword", () => {
    const result = classifySignal({ frequency: 0.01, keywords: ["tectonic", "geological"] });
    assert.equal(result.category, "GEOLOGICAL");
  });

  it("classifies as UNKNOWN when no pattern matches", () => {
    const result = classifySignal({ frequency: 99999 });
    assert.equal(result.category, "UNKNOWN");
  });

  it("queues UNKNOWN signals", () => {
    classifySignal({ frequency: 99999 });
    classifySignal({ frequency: 88888 });

    const unknown = getUnknownSignals();
    assert.equal(unknown.count, 2);
    assert.equal(unknown.signals[0].category, "UNKNOWN");
  });

  it("matches keywords with underscores normalized to spaces", () => {
    const result = classifySignal({ frequency: 55, description: "water system monitor" });
    assert.equal(result.category, "INFRASTRUCTURE");
  });

  it("matches description text for classification", () => {
    const result = classifySignal({ frequency: 1300, description: "marine beacon signal" });
    assert.equal(result.category, "NAVIGATION");
  });

  it("uses modulation type for scoring", () => {
    const result = classifySignal({ frequency: 800, modulation: "GFSK", keywords: ["mesh"] });
    assert.equal(result.category, "COMMUNICATION");
  });
});

// ── Purpose Classification ─────────────────────────────────────────────────

describe("Purpose Classification", () => {
  it("maps INFRASTRUCTURE to UTILITY", () => {
    const result = classifySignal({ frequency: 50, keywords: ["power"] });
    assert.equal(result.purpose, "UTILITY");
  });

  it("maps COMMUNICATION to COMMUNICATION", () => {
    const result = classifySignal({ frequency: 2400, modulation: "OFDM" });
    assert.equal(result.purpose, "COMMUNICATION");
  });

  it("maps NAVIGATION to BEACON", () => {
    const result = classifySignal({ frequency: 1575, modulation: "BPSK" });
    assert.equal(result.purpose, "BEACON");
  });

  it("maps SCIENTIFIC to MEASUREMENT", () => {
    const result = classifySignal({ frequency: 137.5, keywords: ["weather"] });
    assert.equal(result.purpose, "MEASUREMENT");
  });

  it("maps BIOLOGICAL to NATURAL", () => {
    const result = classifySignal({ frequency: 10, keywords: ["neural"] });
    assert.equal(result.purpose, "NATURAL");
  });

  it("maps GEOLOGICAL to NATURAL", () => {
    const result = classifySignal({ frequency: 0.01, keywords: ["tectonic"] });
    assert.equal(result.purpose, "NATURAL");
  });

  it("detects legacy signals", () => {
    const result = classifySignal({ frequency: 2400, is_legacy: true });
    assert.equal(result.purpose, "LEGACY");
  });

  it("detects artifact signals", () => {
    const result = classifySignal({ frequency: 2400, description: "artifact from old system" });
    assert.equal(result.purpose, "ARTIFACT");
  });

  it("detects interference signals", () => {
    const result = classifySignal({ frequency: 2400, is_interference: true });
    assert.equal(result.purpose, "INTERFERENCE");
  });
});

// ── Adjustability Determination ────────────────────────────────────────────

describe("Adjustability Determination", () => {
  it("marks NAVIGATION as ADJUST_FORBIDDEN", () => {
    const result = classifySignal({ frequency: 1575, modulation: "BPSK" });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("marks BIOLOGICAL as OBSERVE_ONLY", () => {
    const result = classifySignal({ frequency: 10, keywords: ["neural"] });
    assert.equal(result.adjustability, "OBSERVE_ONLY");
  });

  it("marks INFRASTRUCTURE as ADJUST_RESTRICTED", () => {
    const result = classifySignal({ frequency: 50, keywords: ["power", "grid"] });
    assert.equal(result.adjustability, "ADJUST_RESTRICTED");
  });

  it("marks COMMUNICATION as RESPOND_ALLOWED", () => {
    const result = classifySignal({ frequency: 800, modulation: "OFDM", keywords: ["cellular"] });
    assert.equal(result.adjustability, "RESPOND_ALLOWED");
  });

  it("FORBIDS signals on aviation frequencies (108-137 MHz)", () => {
    const result = classifySignal({ frequency: 121.5 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("FORBIDS signals on medical frequencies (401-406 MHz)", () => {
    const result = classifySignal({ frequency: 403 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("FORBIDS signals on emergency frequencies (156.8 MHz)", () => {
    const result = classifySignal({ frequency: 156.8 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("FORBIDS signals on military frequencies (225-400 MHz)", () => {
    const result = classifySignal({ frequency: 300 });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });

  it("safety frequency check overrides category-based adjustability", () => {
    // 403 MHz is in medical range — even if communication frequency matches, should be FORBIDDEN
    const result = classifySignal({ frequency: 403, modulation: "OFDM", keywords: ["mesh"] });
    assert.equal(result.adjustability, "ADJUST_FORBIDDEN");
  });
});

// ── Signal Taxonomy Retrieval ──────────────────────────────────────────────

describe("Signal Taxonomy Retrieval", () => {
  beforeEach(() => {
    classifySignal({ frequency: 2400, modulation: "OFDM" });
    classifySignal({ frequency: 900, modulation: "LoRa" });
    classifySignal({ frequency: 50, keywords: ["power"] });
    classifySignal({ frequency: 99999 }); // UNKNOWN
  });

  it("retrieves full taxonomy", () => {
    const result = getTaxonomy("all");
    assert.equal(result.ok, true);
    assert.equal(result.totalClassified, 4);
    assert.equal(result.count, 4);
    assert.equal(result.signals.length, 4);
  });

  it("filters taxonomy by category", () => {
    const result = getTaxonomy("COMMUNICATION");
    assert.equal(result.ok, true);
    assert.equal(result.category, "COMMUNICATION");
    assert.equal(result.signals.every(s => s.category === "COMMUNICATION"), true);
  });

  it("respects limit parameter", () => {
    const result = getTaxonomy("all", 2);
    assert.equal(result.count, 2);
    assert.equal(result.signals.length, 2);
  });

  it("retrieves unknown signals", () => {
    const result = getUnknownSignals();
    assert.equal(result.ok, true);
    assert.equal(result.count, 1);
    assert.equal(result.signals[0].category, "UNKNOWN");
  });

  it("retrieves anomalies based on measurement thresholds", () => {
    classifySignal({ frequency: 2400, frequency_drift: 0.5, attenuation: 60 });

    const result = getAnomalies();
    assert.equal(result.ok, true);
    assert.ok(result.count >= 1);
  });

  it("returns spectral occupancy by band", () => {
    const result = getSpectralOccupancy();
    assert.equal(result.ok, true);
    assert.equal(result.totalSignals, 4);
    assert.notEqual(result.bands, undefined);
  });
});

// ── Privacy Zone Management ────────────────────────────────────────────────

describe("Privacy Zone Detection", () => {
  it("detects residential zone from signal profile", () => {
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      signals: [
        { category: "COMMUNICATION", frequency: 2400, description: "wifi" },
        { frequency: 2450, description: "bluetooth" },
      ],
    });

    assert.notEqual(zone, null);
    assert.match(zone.id, /^zone_/);
    assert.equal(zone.classification, "residential");
    assert.equal(zone.protection_level, "ABSOLUTE");
    assert.equal(zone.interior_data_exists, false);
    assert.equal(zone.interior_reconstructable, false);
    assert.equal(zone.data_retention, "NONE");
  });

  it("detects medical zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["medical", "hospital"] });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "medical");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("detects religious zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["church", "religious"] });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "religious");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("detects government zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["government", "embassy"] });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "government");
    assert.equal(zone.protection_level, "RESTRICTED");
  });

  it("detects military zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["military", "base"] });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "military");
    assert.equal(zone.protection_level, "RESTRICTED");
  });

  it("detects commercial zone from description", () => {
    const zone = detectPrivacyZone({ description: "commercial office building" });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "commercial");
    assert.equal(zone.protection_level, "CONTROLLED");
  });

  it("detects industrial zone from keywords", () => {
    const zone = detectPrivacyZone({ keywords: ["industrial", "factory"] });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "industrial");
    assert.equal(zone.protection_level, "CONTROLLED");
  });

  it("returns null for open zones (no protection needed)", () => {
    const zone = detectPrivacyZone({ classification: "open_land" });
    assert.equal(zone, null);
  });

  it("returns null for null input", () => {
    assert.equal(detectPrivacyZone(null), null);
  });

  it("aggressive residential detection — WiFi signals alone trigger protection", () => {
    const zone = detectPrivacyZone({
      signals: [
        { category: "COMMUNICATION", frequency: 2400 },
        { category: "COMMUNICATION", frequency: 5200 },
      ],
    });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "residential");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("when in doubt with signals present, classify as residential (protect by default)", () => {
    const zone = detectPrivacyZone({
      signals: [{ category: "UNKNOWN", frequency: 800 }],
    });
    assert.notEqual(zone, null);
    assert.equal(zone.classification, "residential");
    assert.equal(zone.protection_level, "ABSOLUTE");
  });

  it("uses explicit classification when provided", () => {
    const zone = detectPrivacyZone({ classification: "military" });
    assert.equal(zone.classification, "military");
    assert.equal(zone.protection_level, "RESTRICTED");
  });

  it("increments zone creation stats", () => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    assert.equal(getCortexMetrics().privacy.totalZones, 2);
  });
});

// ── Privacy Check (Pre-Reconstruction Gate) ────────────────────────────────

describe("Privacy Check", () => {
  it("blocks interior reconstruction in ABSOLUTE zones", () => {
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, false);
    assert.equal(check.protection_level, "ABSOLUTE");
    assert.equal(check.reason, "absolute_privacy_zone");
    assert.equal(check.interior_data_exists, false);
    assert.equal(check.interior_reconstructable, false);
  });

  it("blocks interior reconstruction in RESTRICTED zones", () => {
    detectPrivacyZone({
      keywords: ["military"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, false);
    assert.equal(check.protection_level, "RESTRICTED");
    assert.equal(check.reason, "restricted_zone_exterior_only");
  });

  it("allows CONTROLLED zones with governance requirement", () => {
    detectPrivacyZone({
      keywords: ["commercial"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    const check = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(check.allowed, true);
    assert.equal(check.protection_level, "CONTROLLED");
    assert.equal(check.requires_governance, true);
  });

  it("allows reconstruction outside any privacy zone", () => {
    const check = checkPrivacy({ lat: 0, lng: 0 });
    assert.equal(check.allowed, true);
    assert.equal(check.reason, "no_privacy_zone");
  });

  it("allows when no coordinates provided", () => {
    const check = checkPrivacy(null);
    assert.equal(check.allowed, true);
    assert.equal(check.reason, "no_coordinates");
  });

  it("increments privacy block stats for ABSOLUTE", () => {
    detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
    });

    checkPrivacy({ lat: 52.365, lng: 4.905 });
    checkPrivacy({ lat: 52.365, lng: 4.905 });

    const stats = getPrivacyStats();
    assert.equal(stats.blocksEnforced, 2);
  });

  it("updates lastPrivacyCheckAt timestamp", () => {
    checkPrivacy({ lat: 0, lng: 0 });
    const stats = getPrivacyStats();
    assert.notEqual(stats.lastPrivacyCheckAt, null);
  });
});

// ── Privacy Zone Retrieval ─────────────────────────────────────────────────

describe("Privacy Zone Retrieval", () => {
  beforeEach(() => {
    detectPrivacyZone({ keywords: ["residential"] });
    detectPrivacyZone({ keywords: ["medical"] });
    detectPrivacyZone({ keywords: ["military"] });
  });

  it("retrieves all privacy zones", () => {
    const result = getPrivacyZones();
    assert.equal(result.ok, true);
    assert.equal(result.count, 3);
    assert.equal(result.zones.length, 3);
  });

  it("respects limit", () => {
    const result = getPrivacyZones(2);
    assert.equal(result.zones.length, 2);
  });

  it("returns aggregate privacy stats", () => {
    const stats = getPrivacyStats();
    assert.equal(stats.ok, true);
    assert.equal(stats.totalZones, 3);
    assert.equal(stats.byProtectionLevel.ABSOLUTE, 2);
    assert.equal(stats.byProtectionLevel.RESTRICTED, 1);
    assert.equal(stats.byClassification.residential, 1);
    assert.equal(stats.byClassification.medical, 1);
    assert.equal(stats.byClassification.military, 1);
  });

  it("verifies a specific zone", () => {
    const zones = getPrivacyZones();
    const zoneId = zones.zones[0].id;

    const result = verifyPrivacyZone(zoneId);
    assert.equal(result.ok, true);
    assert.equal(result.integrity, "verified");
    assert.equal(result.interior_data_exists, false);
    assert.equal(result.interior_reconstructable, false);
    assert.notEqual(result.verified_at, undefined);
  });

  it("returns error for nonexistent zone", () => {
    const result = verifyPrivacyZone("nonexistent");
    assert.equal(result.ok, false);
    assert.equal(result.error, "zone_not_found");
  });
});

// ── Presence & Vehicle Suppression ─────────────────────────────────────────

describe("Presence Suppression", () => {
  it("always suppresses presence detection", () => {
    const result = suppressPresenceDetection({ tier: "SOVEREIGN" });
    assert.equal(result.suppressed, true);
    assert.equal(result.reason, "presence_detection_permanently_suppressed");
    assert.equal(result.tier_override_possible, false);
    assert.equal(result.individual_data_available, false);
  });

  it("suppresses for all tiers including sovereign", () => {
    assert.equal(suppressPresenceDetection({ tier: "PUBLIC" }).suppressed, true);
    assert.equal(suppressPresenceDetection({ tier: "RESEARCH" }).suppressed, true);
    assert.equal(suppressPresenceDetection({ tier: "SOVEREIGN" }).suppressed, true);
  });

  it("increments suppression counter", () => {
    suppressPresenceDetection({});
    suppressPresenceDetection({});
    suppressPresenceDetection({});

    assert.equal(getCortexMetrics().privacy.presenceSuppressed, 3);
  });
});

describe("Vehicle Tracking Suppression", () => {
  it("always suppresses vehicle tracking", () => {
    const result = suppressVehicleTracking({ tier: "SOVEREIGN" });
    assert.equal(result.suppressed, true);
    assert.equal(result.reason, "vehicle_tracking_permanently_suppressed");
    assert.equal(result.tier_override_possible, false);
    assert.equal(result.individual_data_available, false);
  });

  it("provides aggregate data only at road segment level", () => {
    const result = suppressVehicleTracking({});
    assert.equal(result.aggregate_available, true);
    assert.equal(result.aggregate_resolution, "road_segment");
  });

  it("increments vehicle suppression counter", () => {
    suppressVehicleTracking({});
    suppressVehicleTracking({});

    assert.equal(getCortexMetrics().privacy.vehicleSuppressed, 2);
  });
});

// ── Signal Adjustment Permissions ──────────────────────────────────────────

describe("Signal Adjustment Permissions", () => {
  it("returns error for missing parameters", () => {
    assert.equal(checkAdjustmentPermission(null, null).ok, false);
    assert.equal(checkAdjustmentPermission("sig1", null).ok, false);
    assert.equal(checkAdjustmentPermission(null, "JAMMING").ok, false);
  });

  it("PERMITS gamma modulation", () => {
    const sig = classifySignal({ frequency: 800, modulation: "OFDM", keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    assert.equal(result.ok, true);
    assert.equal(result.permitted, true);
    assert.equal(result.permission, "MODULATE_ALLOWED");
    assert.equal(result.authorization_required, "NONE");
  });

  it("PERMITS mesh optimization", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION);
    assert.equal(result.permitted, true);
  });

  it("PERMITS emergency amplification", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION);
    assert.equal(result.permitted, true);
  });

  it("PERMITS environmental harmonization", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.ENVIRONMENTAL_HARMONIZATION);
    assert.equal(result.permitted, true);
  });

  it("RESTRICTS infrastructure interaction (requires sovereign)", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.INFRASTRUCTURE_INTERACTION);

    assert.equal(result.ok, true);
    assert.equal(result.permitted, false);
    assert.equal(result.permission, "ADJUST_RESTRICTED");
    assert.equal(result.authorization_required, "SOVEREIGN");
  });

  it("RESTRICTS spectrum clearing (requires sovereign)", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.SPECTRUM_CLEARING);
    assert.equal(result.permitted, false);
    assert.equal(result.authorization_required, "SOVEREIGN");
  });

  it("FORBIDS jamming permanently", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);

    assert.equal(result.ok, true);
    assert.equal(result.permitted, false);
    assert.equal(result.permission, "ADJUST_FORBIDDEN");
    assert.equal(result.reason, "jamming_permanently_forbidden");
    assert.equal(result.authorization_required, "HARDCODED_DENY");
  });

  it("FORBIDS adjustment on aviation frequency signals", () => {
    const sig = classifySignal({ frequency: 121.5 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    assert.equal(result.permitted, false);
    assert.equal(result.permission, "ADJUST_FORBIDDEN");
    assert.equal(result.safety.affects_aviation, true);
    assert.equal(result.authorization_required, "HARDCODED_DENY");
  });

  it("FORBIDS adjustment on medical frequency signals", () => {
    const sig = classifySignal({ frequency: 403 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    assert.equal(result.permitted, false);
    assert.equal(result.safety.affects_medical, true);
    assert.equal(result.authorization_required, "HARDCODED_DENY");
  });

  it("FORBIDS adjustment on emergency frequency signals", () => {
    const sig = classifySignal({ frequency: 156.8 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    assert.equal(result.permitted, false);
    assert.equal(result.safety.affects_emergency, true);
  });

  it("FORBIDS adjustment on military frequency signals", () => {
    const sig = classifySignal({ frequency: 300 });
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    assert.equal(result.permitted, false);
    assert.equal(result.safety.affects_military, true);
  });

  it("safety check is non-overridable even for permitted types", () => {
    const sig = classifySignal({ frequency: 121.5 });
    // GAMMA_MODULATION is normally permitted, but 121.5 MHz is aviation guard frequency
    const result = checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    assert.equal(result.permitted, false);
    assert.equal(result.authorization_required, "HARDCODED_DENY");
  });

  it("tracks permitted adjustment count", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION);

    assert.equal(getCortexMetrics().adjustments.permitted, 2);
  });

  it("tracks forbidden adjustment count", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.JAMMING);

    const sig2 = classifySignal({ frequency: 121.5 });
    checkAdjustmentPermission(sig2.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);

    assert.equal(getCortexMetrics().adjustments.forbidden, 2);
  });

  it("returns OBSERVE_ONLY for unknown adjustment type", () => {
    const sig = classifySignal({ frequency: 800, keywords: ["cellular"] });
    const result = checkAdjustmentPermission(sig.id, "UNKNOWN_TYPE");
    assert.equal(result.permitted, false);
    assert.equal(result.permission, "OBSERVE_ONLY");
  });
});

// ── Chat Intent Detection ──────────────────────────────────────────────────

describe("Chat Intent Detection", () => {
  it("returns false for empty input", () => {
    assert.equal(detectCortexIntent("").isCortexRequest, false);
    assert.equal(detectCortexIntent(null).isCortexRequest, false);
    assert.equal(detectCortexIntent(undefined).isCortexRequest, false);
  });

  it("detects signal taxonomy queries", () => {
    assert.equal(detectCortexIntent("Show the signal taxonomy").isCortexRequest, true);
    assert.equal(detectCortexIntent("Signal classification tree").action, "taxonomy");
    assert.equal(detectCortexIntent("Classify this signal frequency").action, "taxonomy");
  });

  it("detects unknown signal queries", () => {
    assert.equal(detectCortexIntent("Show unknown signals").isCortexRequest, true);
    assert.equal(detectCortexIntent("List unclassified signals").action, "unknown");
    assert.equal(detectCortexIntent("Any unidentified frequency detected?").action, "unknown");
  });

  it("detects anomaly queries", () => {
    assert.equal(detectCortexIntent("Show anomalous signals").isCortexRequest, true);
    assert.equal(detectCortexIntent("Any unusual signal patterns?").action, "anomalies");
  });

  it("detects spectrum queries", () => {
    assert.equal(detectCortexIntent("Show spectrum occupancy").isCortexRequest, true);
    assert.equal(detectCortexIntent("Frequency band usage").action, "spectrum");
    assert.equal(detectCortexIntent("What is the spectral map?").action, "spectrum");
  });

  it("detects privacy zone queries", () => {
    assert.equal(detectCortexIntent("Show privacy zone status").isCortexRequest, true);
    assert.equal(detectCortexIntent("Privacy zone check").action, "privacy");
    assert.equal(detectCortexIntent("Privacy protection stats").action, "privacy");
  });

  it("detects signal adjustment queries", () => {
    assert.equal(detectCortexIntent("Can we adjust this signal?").isCortexRequest, true);
    assert.equal(detectCortexIntent("Modulate this signal frequency").action, "adjustment");
    assert.equal(detectCortexIntent("Signal control options").action, "adjustment");
  });

  it("does not match unrelated queries", () => {
    assert.equal(detectCortexIntent("What's the weather today?").isCortexRequest, false);
    assert.equal(detectCortexIntent("Show me the map").isCortexRequest, false);
    assert.equal(detectCortexIntent("Hello how are you").isCortexRequest, false);
  });
});

// ── Metrics ─────────────────────────────────────────────────────────────────

describe("Cortex Metrics", () => {
  it("returns comprehensive metrics", async () => {
    await initializeCortex({});
    classifySignal({ frequency: 2400 });
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});

    const metrics = getCortexMetrics();
    assert.equal(metrics.initialized, true);
    assert.equal(metrics.taxonomy.totalClassified, 1);
    assert.deepEqual(metrics.taxonomy.categories, ALL_SIGNAL_CATEGORIES);
    assert.equal(metrics.privacy.totalZones, 1);
    assert.equal(metrics.privacy.presenceSuppressed, 1);
    assert.ok(metrics.uptime >= 0);
  });

  it("tracks unknown queue size", () => {
    classifySignal({ frequency: 99999 });
    classifySignal({ frequency: 88888 });

    assert.equal(getCortexMetrics().taxonomy.unknownQueueSize, 2);
  });
});

// ── Heartbeat ───────────────────────────────────────────────────────────────

describe("Cortex Heartbeat", () => {
  it("runs without error", async () => {
    await initializeCortex({});
    await cortexHeartbeatTick({}, 1);
  });
});

// ── Initialization ──────────────────────────────────────────────────────────

describe("Initialization", () => {
  it("initializes successfully", async () => {
    const result = await initializeCortex({});
    assert.equal(result.ok, true);
    assert.deepEqual(result.signalCategories, ALL_SIGNAL_CATEGORIES);
    assert.deepEqual(result.signalPurposes, ALL_SIGNAL_PURPOSES);
    assert.deepEqual(result.privacyLevels, Object.values(PRIVACY_LEVELS));
    assert.deepEqual(result.adjustmentPermissions, Object.values(ADJUSTMENT_PERMISSIONS));
    assert.ok(result.message.includes("Signal Cortex initialized"));
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeCortex({});
    const result = await initializeCortex({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });
});

// ── State Reset ─────────────────────────────────────────────────────────────

describe("State Reset", () => {
  it("resets all state", async () => {
    await initializeCortex({});
    classifySignal({ frequency: 2400 });
    detectPrivacyZone({ keywords: ["residential"] });
    suppressPresenceDetection({});
    _resetCortexState();

    const metrics = getCortexMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.taxonomy.totalClassified, 0);
    assert.equal(metrics.privacy.totalZones, 0);
    assert.equal(metrics.privacy.presenceSuppressed, 0);
    assert.equal(metrics.stats.signalsClassified, 0);
  });
});

// ── Full Pipeline Integration ───────────────────────────────────────────────

describe("Full Pipeline Integration", () => {
  beforeEach(async () => {
    await initializeCortex({});
  });

  it("classify → detect zone → privacy check → adjustment check", () => {
    // Step 1: Classify signals in an area
    const sig1 = classifySignal({ frequency: 800, modulation: "OFDM", keywords: ["cellular"] });
    const sig2 = classifySignal({ frequency: 1800, keywords: ["cellular", "wifi"] });
    const sig3 = classifySignal({ frequency: 50, keywords: ["power", "grid"] });

    assert.equal(sig1.category, "COMMUNICATION");
    assert.equal(sig3.category, "INFRASTRUCTURE");

    // Step 2: Detect privacy zone from signal profile
    const zone = detectPrivacyZone({
      keywords: ["residential"],
      boundary: {
        type: "polygon",
        coordinates: [[52.36, 4.90], [52.36, 4.91], [52.37, 4.91], [52.37, 4.90]],
      },
      signals: [
        { category: "COMMUNICATION", frequency: 2400 },
        { frequency: 2450 },
      ],
    });

    assert.equal(zone.classification, "residential");
    assert.equal(zone.protection_level, "ABSOLUTE");

    // Step 3: Privacy check blocks interior reconstruction
    const privacyCheck = checkPrivacy({ lat: 52.365, lng: 4.905 });
    assert.equal(privacyCheck.allowed, false);
    assert.equal(privacyCheck.reason, "absolute_privacy_zone");

    // Step 4: Adjustment check
    const adj = checkAdjustmentPermission(sig1.id, ADJUSTMENT_TYPES.GAMMA_MODULATION);
    assert.equal(adj.permitted, true);

    // Verify metrics tracked everything
    const metrics = getCortexMetrics();
    assert.equal(metrics.stats.signalsClassified, 3);
    assert.equal(metrics.privacy.totalZones, 1);
    assert.equal(metrics.privacy.blocksEnforced, 1);
    assert.equal(metrics.adjustments.permitted, 1);
  });

  it("presence and vehicle suppression are absolute regardless of tier", () => {
    const presence = suppressPresenceDetection({ tier: "SOVEREIGN", data: { count: 5 } });
    assert.equal(presence.suppressed, true);
    assert.equal(presence.tier_override_possible, false);

    const vehicle = suppressVehicleTracking({ tier: "SOVEREIGN", data: { plates: ["A1"] } });
    assert.equal(vehicle.suppressed, true);
    assert.equal(vehicle.tier_override_possible, false);
    assert.equal(vehicle.aggregate_available, true);
  });

  it("safety frequencies are non-overridable for all adjustment types", () => {
    // Aviation guard freq — 121.5 MHz
    const sig = classifySignal({ frequency: 121.5 });

    // Even normally-permitted adjustments are forbidden on safety frequencies
    assert.equal(checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.GAMMA_MODULATION).permitted, false);
    assert.equal(checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.MESH_OPTIMIZATION).permitted, false);
    assert.equal(checkAdjustmentPermission(sig.id, ADJUSTMENT_TYPES.EMERGENCY_AMPLIFICATION).permitted, false);
  });

  it("taxonomy grows and is prunable", () => {
    // Classify many signals
    for (let i = 0; i < 50; i++) {
      classifySignal({ frequency: 800 + i, modulation: "OFDM" });
    }

    const taxonomy = getTaxonomy("all", 100);
    assert.equal(taxonomy.totalClassified, 50);
    assert.equal(taxonomy.signals.length, 50);
  });

  it("spectral occupancy reflects classified signals", () => {
    classifySignal({ frequency: 800 });   // LF/MF band
    classifySignal({ frequency: 50 });    // ELF/SLF band
    classifySignal({ frequency: 0.01 });  // ELF/SLF band

    const spectrum = getSpectralOccupancy();
    assert.equal(spectrum.totalSignals, 3);
    assert.ok(Object.keys(spectrum.bands).length >= 1);
  });
});
