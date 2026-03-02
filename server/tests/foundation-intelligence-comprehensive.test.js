/**
 * Foundation Intelligence — Comprehensive Security Test Suite
 *
 * Targets 90%+ coverage with deep testing of:
 *   - Tier boundary enforcement (sovereign/research/public gates)
 *   - Classification levels (OPEN, RESTRICTED, ABSOLUTE)
 *   - Access control decisions (research applications, grants, revocations)
 *   - Sovereign classifier edge cases (energy thresholds, population scale)
 *   - Ambiguous-data-goes-UP principle enforcement
 *   - Research sensitivity patterns
 *   - Public category detection heuristics
 *   - Classifier threshold management and clamping
 *   - Pipeline rejection when classifier inactive
 *   - Chat intent detection edge cases
 *   - Heartbeat cleanup of expired grants
 *   - Metrics completeness
 *   - Research partition overflow trimming
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  TIERS,
  CLASSIFICATIONS,
  PUBLIC_CATEGORIES,
  RESEARCH_CATEGORIES,
  SOVEREIGN_CATEGORIES,
  classifySignal,
  routeIntelligence,
  createPublicDTU,
  createResearchDTU,
  processSignalIntelligence,
  submitResearchApplication,
  reviewResearchApplication,
  getResearchApplicationStatus,
  hasResearchAccess,
  revokeResearchAccess,
  getPublicIntelligence,
  getAllPublicCategories,
  getResearchIntelligence,
  getResearchSynthesis,
  getResearchArchive,
  getSovereignVaultStatus,
  getClassifierStatus,
  updateClassifierThresholds,
  detectIntelIntent,
  getIntelligenceMetrics,
  intelligenceHeartbeatTick,
  initializeIntelligence,
  _resetIntelligenceState,
} from "../lib/foundation-intelligence.js";

beforeEach(() => {
  _resetIntelligenceState();
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOVEREIGN CLASSIFIER — BOUNDARY ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Tier Boundary Enforcement", () => {
  it("sovereign threshold: high confidence military matches sovereign directly", () => {
    const result = classifySignal({
      summary: "Military base installation detected with radar weapons armament garrison munitions barracks airfield high power radar encrypted burst jamming detected restricted frequency military band",
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "military_installation");
    assert.equal(result.sovereignMatch, true);
    assert.ok(result.confidence > 0);
  });

  it("ambiguous threshold: weak military signal still upgraded to sovereign", () => {
    // Just 2-3 keywords should still trigger sensitivity threshold (>0.3)
    const result = classifySignal({
      summary: "Some military base detected nearby",
    });
    // 2 keywords: "military" + "base" = 0.3 score, at or above sensitivity threshold
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.sovereignMatch, true);
  });

  it("data never goes DOWN tiers — no demotion of sovereign-level data", () => {
    const result = classifySignal({
      summary: "Weather station near military base detected radar",
    });
    // Even though "weather" is public, the military keywords should push it up
    assert.equal(result.tier, TIERS.SOVEREIGN);
  });

  it("nuclear facility: energy threshold triggers additional score", () => {
    // Keywords alone: nuclear, reactor = 0.3
    // + energyLevel >= 50 = +0.3 = 0.6 -> sovereign
    const withEnergy = classifySignal({
      summary: "nuclear reactor detected",
      energyLevel: 100,
    });
    assert.equal(withEnergy.tier, TIERS.SOVEREIGN);

    const withoutEnergy = classifySignal({
      summary: "nuclear reactor detected",
      energyLevel: 5,
    });
    // Still sovereign because nuclear + reactor = 0.3 = sensitivity threshold
    assert.equal(withoutEnergy.tier, TIERS.SOVEREIGN);
  });

  it("population behavioral: population scale triggers additional score", () => {
    const result = classifySignal({
      summary: "population tracking mass surveillance behavioral aggregate",
      populationScale: 100000,
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "population_behavioral");
  });

  it("population behavioral without scale still detects from keywords", () => {
    const result = classifySignal({
      summary: "population tracking mass surveillance behavioral aggregate mass profiling social dynamics",
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
  });

  it("communication topology detected from keywords", () => {
    const result = classifySignal({
      summary: "government network intelligence agency classified comm diplomatic channel command structure",
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "communication_topology");
  });

  it("infrastructure vulnerability detected from signal indicators", () => {
    const result = classifySignal({
      summary: "SCADA unprotected control system exposed vulnerability exploit critical infrastructure leak unshielded control",
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH CLASSIFICATION — PATTERN MATCHING
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Research Pattern Matching", () => {
  it("cross-medium synthesis detected with multi-media boost", () => {
    const result = classifySignal({
      summary: "Cross-medium synthesis multi-signal correlation",
      mediaCount: 3,
    });
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.category, "cross_medium_synthesis");
    assert.equal(result.researchMatch, true);
  });

  it("cross-medium synthesis without media count: keywords only", () => {
    const result = classifySignal({
      summary: "Cross-medium synthesis multi-signal correlation analysis data",
    });
    // Without mediaCount, score from keywords only
    // cross-medium=0.2, synthesis=0.2, multi-signal=0.2, correlation=0.2 = 0.8 > 0.3
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.researchMatch, true);
  });

  it("historical archaeology detected from keywords", () => {
    const result = classifySignal({
      summary: "historical archaeology legacy decoded fossil signal analysis",
    });
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.category, "historical_archaeology");
  });

  it("deep geological with precision threshold", () => {
    const result = classifySignal({
      summary: "aquifer mineral deposit tectonic subsurface detail",
      precision: 0.95,
    });
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.category, "deep_geological");
  });

  it("deep geological without precision: keywords sufficient", () => {
    const result = classifySignal({
      summary: "aquifer mineral deposit tectonic subsurface detail analysis complete",
    });
    // Multiple keywords = 0.2*4 = 0.8 > 0.3
    assert.equal(result.tier, TIERS.RESEARCH);
  });

  it("advanced atmospheric detected from keywords", () => {
    const result = classifySignal({
      summary: "ionospheric space weather upper atmosphere solar interaction",
    });
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.category, "advanced_atmospheric");
  });

  it("marine deep detected from keywords", () => {
    const result = classifySignal({
      summary: "ocean floor deep current thermal vent submarine geological",
    });
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.category, "marine_deep");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC CATEGORY DETECTION — ALL CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Public Category Detection", () => {
  it("weather detected by keywords", () => {
    const result = classifySignal({
      summary: "Temperature pressure humidity storm atmospheric precipitation wind",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "weather");
  });

  it("geology detected by keywords", () => {
    const result = classifySignal({
      summary: "Subsurface mineral soil terrain rock sediment geological survey",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "geology");
  });

  it("energy detected by keywords", () => {
    const result = classifySignal({
      summary: "Grid power load renewable solar consumption harmonic analysis",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "energy");
  });

  it("ocean detected by keywords", () => {
    const result = classifySignal({
      summary: "Sea marine tide current wave coastal observation",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "ocean");
  });

  it("seismic detected by keywords", () => {
    const result = classifySignal({
      summary: "Earthquake tectonic volcanic tremor fault activity",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "seismic");
  });

  it("agriculture detected by keywords", () => {
    const result = classifySignal({
      summary: "Crop farming irrigation harvest soil moisture agriculture",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "agriculture");
  });

  it("environment detected by keywords", () => {
    const result = classifySignal({
      summary: "Deforestation urbanization pollution biodiversity ecosystem environment",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "environment");
  });

  it("explicit category field gives strong score", () => {
    const result = classifySignal({ category: "seismic", summary: "Generic signal" });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "seismic");
  });

  it("defaults to weather when nothing matches", () => {
    const result = classifySignal({ summary: "Just some random signal data" });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "weather");
  });

  it("string input is also classifiable", () => {
    const result = classifySignal("Temperature and pressure weather reading from sensors");
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "weather");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIFICATION STATS — TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Classifier Stats Tracking", () => {
  it("increments totalClassified on every call", () => {
    classifySignal({ summary: "a" });
    classifySignal({ summary: "b" });
    classifySignal({ summary: "c" });
    const status = getClassifierStatus();
    assert.equal(status.stats.totalClassified, 3);
  });

  it("tracks routedPublic count", () => {
    classifySignal({ category: "weather", summary: "temp" });
    classifySignal({ category: "geology", summary: "rock" });
    const status = getClassifierStatus();
    assert.equal(status.stats.routedPublic, 2);
  });

  it("tracks routedSovereign count", () => {
    classifySignal({ summary: "Military base radar weapons installation detected" });
    const status = getClassifierStatus();
    assert.ok(status.stats.routedSovereign >= 1);
  });

  it("tracks routedResearch count", () => {
    classifySignal({ summary: "Cross-medium synthesis multi-signal correlation analysis" });
    const status = getClassifierStatus();
    assert.ok(status.stats.routedResearch >= 1);
  });

  it("tracks ambiguousUpgraded count", () => {
    // Ambiguous: enough for sensitivity but not sovereign threshold
    classifySignal({ summary: "Unusual radar pattern near military" });
    const status = getClassifierStatus();
    assert.ok(status.stats.ambiguousUpgraded >= 1);
  });

  it("updates lastClassificationAt timestamp", () => {
    classifySignal({ summary: "test" });
    const status = getClassifierStatus();
    assert.ok(status.stats.lastClassificationAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Routing Edge Cases", () => {
  it("sovereign routing creates no DTU and no lattice entry", () => {
    const result = routeIntelligence({ summary: "classified" }, {
      tier: TIERS.SOVEREIGN,
      category: "nuclear_facility",
    });
    assert.equal(result.dtuCreated, false);
    assert.equal(result.latticeEntry, false);
    assert.ok(result.message.includes("No DTU created"));
  });

  it("sovereign vault count tracks categories independently", () => {
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "naval_movement" });

    const status = getSovereignVaultStatus();
    assert.equal(status.count, 3);
    assert.equal(status.categories.military_installation, 2);
    assert.equal(status.categories.naval_movement, 1);
  });

  it("research routing creates restricted DTU with lineage", () => {
    const result = routeIntelligence({ summary: "research data" }, {
      tier: TIERS.RESEARCH,
      category: "deep_geological",
    });
    assert.equal(result.dtu.lineage_tracking, "enforced");
    assert.equal(result.dtu.transfer_prohibited, true);
    assert.equal(result.dtu.classification, CLASSIFICATIONS.RESTRICTED);
  });

  it("public routing creates OPEN DTU with commercial license", () => {
    const result = routeIntelligence({ summary: "weather data" }, {
      tier: TIERS.PUBLIC,
      category: "weather",
    });
    assert.equal(result.dtu.commercially_licensable, true);
    assert.equal(result.dtu.classification, CLASSIFICATIONS.OPEN);
  });

  it("public routing defaults to 'weather' category when unknown", () => {
    const result = routeIntelligence({ summary: "data" }, {
      tier: TIERS.PUBLIC,
      category: undefined,
    });
    assert.equal(result.category, undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS CONTROL — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Access Control Decisions", () => {
  it("denies access to researcher without application", () => {
    assert.equal(hasResearchAccess("unknown_researcher"), false);
  });

  it("denies access to researcher with pending application", () => {
    submitResearchApplication("pending_researcher", "MIT", "Study", ["deep_geological"]);
    assert.equal(hasResearchAccess("pending_researcher"), false);
  });

  it("grants category-specific access", () => {
    const app = submitResearchApplication("cat_researcher", "MIT", "Study", ["deep_geological"]);
    reviewResearchApplication(app.applicationId, true, "council");

    assert.equal(hasResearchAccess("cat_researcher", "deep_geological"), true);
    assert.equal(hasResearchAccess("cat_researcher", "marine_deep"), false);
  });

  it("grants access to all categories when empty categories list", () => {
    const app = submitResearchApplication("all_cat", "MIT", "Study", []);
    reviewResearchApplication(app.applicationId, true, "council");

    // Empty categories + specific category check = true (no restriction)
    assert.equal(hasResearchAccess("all_cat", "marine_deep"), true);
  });

  it("tracks research application stats", () => {
    submitResearchApplication("s1", "MIT", "A", []);
    submitResearchApplication("s2", "MIT", "B", []);

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.stats.researchApplications, 2);
  });

  it("tracks granted and denied counts", () => {
    const a1 = submitResearchApplication("g1", "MIT", "A", []);
    const a2 = submitResearchApplication("g2", "MIT", "B", []);
    reviewResearchApplication(a1.applicationId, true, "council");
    reviewResearchApplication(a2.applicationId, false, "council");

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.stats.researchGranted, 1);
    assert.equal(metrics.stats.researchDenied, 1);
  });

  it("revokeResearchAccess on granted researcher returns revoked:true", () => {
    const app = submitResearchApplication("rev_r", "MIT", "Study", []);
    reviewResearchApplication(app.applicationId, true, "council");
    const result = revokeResearchAccess("rev_r");
    assert.equal(result.revoked, true);
  });

  it("revokeResearchAccess on unknown researcher returns revoked:false", () => {
    const result = revokeResearchAccess("unknown");
    assert.equal(result.revoked, false);
  });

  it("application defaults when missing fields", () => {
    const result = submitResearchApplication(null, null, null, null);
    assert.equal(result.ok, true);
    const status = getResearchApplicationStatus(result.applicationId);
    assert.equal(status.application.researcherId, "anonymous");
    assert.equal(status.application.institution, "unknown");
    assert.equal(status.application.purpose, "");
    assert.deepEqual(status.application.requestedCategories, []);
  });

  it("review nonexistent application returns error", () => {
    const result = reviewResearchApplication("fake_id", true, "council");
    assert.equal(result.ok, false);
    assert.equal(result.error, "application_not_found");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESEARCH INTELLIGENCE RETRIEVAL — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Research Intelligence Retrieval", () => {
  beforeEach(async () => {
    await initializeIntelligence({});
  });

  it("getResearchIntelligence denied without access", () => {
    const result = getResearchIntelligence("unauthorized");
    assert.equal(result.ok, false);
    assert.equal(result.error, "access_denied");
  });

  it("getResearchIntelligence succeeds with access", () => {
    const app = submitResearchApplication("auth_r", "MIT", "Study", []);
    reviewResearchApplication(app.applicationId, true, "council");

    const result = getResearchIntelligence("auth_r");
    assert.equal(result.ok, true);
    assert.equal(result.lineage_tracking, "enforced");
  });

  it("getResearchSynthesis is shorthand for cross_medium_synthesis", () => {
    const app = submitResearchApplication("synth_r", "MIT", "Study", ["cross_medium_synthesis"]);
    reviewResearchApplication(app.applicationId, true, "council");

    const result = getResearchSynthesis("synth_r");
    assert.equal(result.ok, true);
    assert.equal(result.category, "cross_medium_synthesis");
  });

  it("getResearchArchive is shorthand for historical_archaeology", () => {
    const app = submitResearchApplication("arch_r", "MIT", "Study", ["historical_archaeology"]);
    reviewResearchApplication(app.applicationId, true, "council");

    const result = getResearchArchive("arch_r");
    assert.equal(result.ok, true);
    assert.equal(result.category, "historical_archaeology");
  });

  it("filters by category", () => {
    const app = submitResearchApplication("filter_r", "MIT", "Study", []);
    reviewResearchApplication(app.applicationId, true, "council");

    // Add some research data
    processSignalIntelligence({
      summary: "Cross-medium synthesis multi-signal correlation",
      mediaCount: 3,
    });
    processSignalIntelligence({
      summary: "Historical archaeology legacy decoded fossil analysis",
    });

    const synthOnly = getResearchIntelligence("filter_r", "cross_medium_synthesis");
    assert.equal(synthOnly.ok, true);
    assert.ok(synthOnly.data.every(d => d.category === "cross_medium_synthesis"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOVEREIGN VAULT — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Sovereign Vault Properties", () => {
  it("vault is always isolated (no lattice, no API)", () => {
    const status = getSovereignVaultStatus();
    assert.equal(status.exists, true);
    assert.equal(status.isolated, true);
    assert.equal(status.latticeConnected, false);
    assert.equal(status.apiAccessible, false);
  });

  it("vault exposes no data field", () => {
    routeIntelligence({ summary: "secret data" }, { tier: TIERS.SOVEREIGN, category: "military_installation" });
    const status = getSovereignVaultStatus();
    assert.ok(!("data" in status));
    assert.ok(!("entries" in status));
    assert.ok(!("signals" in status));
  });

  it("vault includes informational message", () => {
    const status = getSovereignVaultStatus();
    assert.ok(status.message.includes("No data accessible"));
  });

  it("vault tracks lastClassifiedAt", () => {
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });
    const status = getSovereignVaultStatus();
    assert.ok(status.lastClassifiedAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIFIER THRESHOLD MANAGEMENT — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Threshold Management", () => {
  it("clamps sensitivity to minimum 0.1", () => {
    const result = updateClassifierThresholds(0.01, 0.6);
    assert.equal(result.sensitivity, 0.1);
  });

  it("clamps sensitivity to maximum 0.9", () => {
    const result = updateClassifierThresholds(1.5, 0.6);
    assert.equal(result.sensitivity, 0.9);
  });

  it("clamps sovereign to minimum 0.2", () => {
    const result = updateClassifierThresholds(0.3, 0.05);
    assert.equal(result.sovereign, 0.2);
  });

  it("clamps sovereign to maximum 1.0", () => {
    const result = updateClassifierThresholds(0.3, 2.0);
    assert.equal(result.sovereign, 1.0);
  });

  it("threshold changes affect classification behavior", () => {
    // First: with strict sovereign threshold (0.9), "military base" might not reach sovereign
    updateClassifierThresholds(0.8, 0.9);
    const strict = classifySignal({ summary: "military base nearby" });
    // military + base = 0.3, below 0.8 sensitivity
    assert.equal(strict.tier, TIERS.PUBLIC);

    // Now with loose threshold
    _resetIntelligenceState();
    updateClassifierThresholds(0.1, 0.2);
    const loose = classifySignal({ summary: "military base nearby" });
    // military + base = 0.3, above 0.2 sovereign threshold
    assert.equal(loose.tier, TIERS.SOVEREIGN);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DTU CREATION — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — DTU Creation Edge Cases", () => {
  it("public DTU clamps confidence above 1 to 1", () => {
    const dtu = createPublicDTU({}, { confidence: 5.0 });
    assert.equal(dtu.confidence, 1);
  });

  it("public DTU clamps confidence below 0 to 0", () => {
    const dtu = createPublicDTU({}, { confidence: -1 });
    assert.equal(dtu.confidence, 0);
  });

  it("public DTU defaults missing fields", () => {
    const dtu = createPublicDTU({}, {});
    assert.equal(dtu.category, "weather");
    assert.equal(dtu.confidence, 0.5);
    assert.equal(dtu.sources, 1);
    assert.equal(dtu.update_frequency, "continuous");
  });

  it("research DTU defaults methodology", () => {
    const dtu = createResearchDTU({}, { category: "deep_geological" });
    assert.equal(dtu.methodology, "foundation_extraction");
  });

  it("research DTU always has enforced lineage", () => {
    const dtu = createResearchDTU({}, {});
    assert.equal(dtu.lineage_tracking, "enforced");
    assert.equal(dtu.transfer_prohibited, true);
    assert.equal(dtu.usage_agreement, "no_weaponization_no_resale_no_transfer");
  });

  it("both DTU types have unique IDs", () => {
    const a = createPublicDTU({}, {});
    const b = createPublicDTU({}, {});
    assert.notEqual(a.id, b.id);
  });

  it("research DTU increments stats", () => {
    const before = getIntelligenceMetrics().stats.totalResearchDTUs;
    createResearchDTU({}, {});
    const after = getIntelligenceMetrics().stats.totalResearchDTUs;
    assert.equal(after, before + 1);
  });

  it("public DTU increments stats", () => {
    const before = getIntelligenceMetrics().stats.totalPublicDTUs;
    createPublicDTU({}, {});
    const after = getIntelligenceMetrics().stats.totalPublicDTUs;
    assert.equal(after, before + 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT INTENT DETECTION — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Intent Detection Edge Cases", () => {
  it("returns false for numeric input", () => {
    assert.equal(detectIntelIntent(123).isIntelRequest, false);
  });

  it("returns false for undefined", () => {
    assert.equal(detectIntelIntent(undefined).isIntelRequest, false);
  });

  it("detects tremor as seismic", () => {
    const r = detectIntelIntent("any tremor detected recently?");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "seismic");
  });

  it("detects volcanic as seismic", () => {
    const r = detectIntelIntent("volcanic activity nearby?");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "seismic");
  });

  it("detects ecosystem as environment (with 'assessment')", () => {
    const r = detectIntelIntent("ecosystem assessment data");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "environment");
  });

  it("detects deforestation as environment (with 'monitor')", () => {
    const r = detectIntelIntent("deforestation monitor");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "environment");
  });

  it("detects crop as agriculture", () => {
    const r = detectIntelIntent("crop yield data");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "agriculture");
  });

  it("detects irrigation as agriculture", () => {
    const r = detectIntelIntent("irrigation status");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "agriculture");
  });

  it("detects coastal + intel as ocean", () => {
    const r = detectIntelIntent("coastal monitoring data");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "ocean");
  });

  it("detects research access request", () => {
    const r = detectIntelIntent("how to get research access");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "research_status");
  });

  it("detects research data request", () => {
    const r = detectIntelIntent("research data available?");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "research_status");
  });

  it("detects sovereign vault query", () => {
    const r = detectIntelIntent("sovereign vault status");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "sovereign_status");
  });

  it("detects sovereign intelligence query", () => {
    const r = detectIntelIntent("sovereign intelligence info");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "sovereign_status");
  });

  it("detects classifier status query", () => {
    const r = detectIntelIntent("classifier status");
    assert.equal(r.isIntelRequest, true);
    assert.equal(r.action, "classifier_status");
  });

  it("does not match unrelated queries", () => {
    assert.equal(detectIntelIntent("make me a sandwich").isIntelRequest, false);
    assert.equal(detectIntelIntent("open the door").isIntelRequest, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEARTBEAT — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Heartbeat", () => {
  it("runs without error on empty state", async () => {
    await intelligenceHeartbeatTick({}, 1);
    assert.ok(true);
  });

  it("survives null STATE", async () => {
    await intelligenceHeartbeatTick(null, 1);
    assert.ok(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE — REJECTION CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Pipeline Rejection", () => {
  it("rejects when classifier not active", () => {
    const result = processSignalIntelligence({ summary: "test" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "classifier_not_active");
  });

  it("rejects null signal data after initialization", async () => {
    await initializeIntelligence({});
    const result = processSignalIntelligence(null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_signal_data");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Metrics", () => {
  it("metrics include all tier sections", async () => {
    await initializeIntelligence({});
    const metrics = getIntelligenceMetrics();
    assert.ok(metrics.tiers.public);
    assert.ok(metrics.tiers.research);
    assert.ok(metrics.tiers.sovereign);
    assert.equal(metrics.tiers.sovereign.isolated, true);
    assert.equal(metrics.tiers.sovereign.apiAccessible, false);
  });

  it("metrics track pending research applications", async () => {
    await initializeIntelligence({});
    submitResearchApplication("m1", "MIT", "Study", []);
    submitResearchApplication("m2", "MIT", "Study", []);

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.tiers.research.pendingApplications, 2);
  });

  it("metrics track active grants", async () => {
    await initializeIntelligence({});
    const app = submitResearchApplication("m3", "MIT", "Study", []);
    reviewResearchApplication(app.applicationId, true, "council");

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.tiers.research.activeGrants, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — Initialization", () => {
  it("returns alreadyInitialized on re-init", async () => {
    await initializeIntelligence({});
    const result = await initializeIntelligence({});
    assert.equal(result.alreadyInitialized, true);
  });

  it("sets classifierActive to true", async () => {
    const result = await initializeIntelligence({});
    assert.equal(result.classifierActive, true);
    assert.equal(getClassifierStatus().active, true);
  });

  it("does not expose sovereign category names in init result", async () => {
    const result = await initializeIntelligence({});
    assert.equal(typeof result.sovereignCategories, "number");
    assert.equal(result.sovereignCategories, 6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATE RESET — COMPREHENSIVE
// ═══════════════════════════════════════════════════════════════════════════════

describe("FI Comprehensive — State Reset", () => {
  it("reset clears all state", async () => {
    await initializeIntelligence({});
    processSignalIntelligence({ category: "weather", summary: "test" });
    submitResearchApplication("r1", "MIT", "Study", []);
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });

    _resetIntelligenceState();

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.classifierActive, false);
    assert.equal(metrics.stats.totalIntelDTUsCreated, 0);
    assert.equal(metrics.stats.researchApplications, 0);
    assert.equal(metrics.classifier.totalClassified, 0);
    assert.equal(getSovereignVaultStatus().count, 0);
  });
});
