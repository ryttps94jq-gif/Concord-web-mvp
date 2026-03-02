/**
 * Foundation Intelligence — Test Suite
 *
 * Tests for the three-tier intelligence architecture:
 *   - Sovereign classifier (pattern matching, tier routing, ambiguity handling)
 *   - Tier 1 public intelligence (7 categories, DTU creation, retrieval)
 *   - Tier 2 research partition (applications, access control, lineage)
 *   - Tier 3 sovereign vault (isolation, no data exposure, metadata only)
 *   - Full classification pipeline
 *   - Chat intent detection
 *   - Metrics and heartbeat
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

// ── Constants ──────────────────────────────────────────────────────────────

describe("Constants", () => {
  it("defines three tiers", () => {
    assert.equal(TIERS.PUBLIC, "PUBLIC");
    assert.equal(TIERS.RESEARCH, "RESEARCH");
    assert.equal(TIERS.SOVEREIGN, "SOVEREIGN");
  });

  it("defines three classifications", () => {
    assert.equal(CLASSIFICATIONS.OPEN, "OPEN");
    assert.equal(CLASSIFICATIONS.RESTRICTED, "RESTRICTED");
    assert.equal(CLASSIFICATIONS.ABSOLUTE, "ABSOLUTE");
  });

  it("defines 7 public categories", () => {
    assert.equal(PUBLIC_CATEGORIES.length, 7);
    assert.ok(PUBLIC_CATEGORIES.includes("weather"));
    assert.ok(PUBLIC_CATEGORIES.includes("geology"));
    assert.ok(PUBLIC_CATEGORIES.includes("energy"));
    assert.ok(PUBLIC_CATEGORIES.includes("ocean"));
    assert.ok(PUBLIC_CATEGORIES.includes("seismic"));
    assert.ok(PUBLIC_CATEGORIES.includes("agriculture"));
    assert.ok(PUBLIC_CATEGORIES.includes("environment"));
  });

  it("defines 5 research categories", () => {
    assert.equal(RESEARCH_CATEGORIES.length, 5);
    assert.ok(RESEARCH_CATEGORIES.includes("cross_medium_synthesis"));
    assert.ok(RESEARCH_CATEGORIES.includes("historical_archaeology"));
    assert.ok(RESEARCH_CATEGORIES.includes("deep_geological"));
    assert.ok(RESEARCH_CATEGORIES.includes("advanced_atmospheric"));
    assert.ok(RESEARCH_CATEGORIES.includes("marine_deep"));
  });

  it("defines 6 sovereign categories", () => {
    assert.equal(SOVEREIGN_CATEGORIES.length, 6);
    assert.ok(SOVEREIGN_CATEGORIES.includes("military_installation"));
    assert.ok(SOVEREIGN_CATEGORIES.includes("naval_movement"));
    assert.ok(SOVEREIGN_CATEGORIES.includes("nuclear_facility"));
    assert.ok(SOVEREIGN_CATEGORIES.includes("infrastructure_vulnerability"));
    assert.ok(SOVEREIGN_CATEGORIES.includes("population_behavioral"));
    assert.ok(SOVEREIGN_CATEGORIES.includes("communication_topology"));
  });

  it("frozen arrays are immutable", () => {
    assert.equal(Object.isFrozen(PUBLIC_CATEGORIES), true);
    assert.equal(Object.isFrozen(RESEARCH_CATEGORIES), true);
    assert.equal(Object.isFrozen(SOVEREIGN_CATEGORIES), true);
  });
});

// ── Sovereign Classifier ────────────────────────────────────────────────────

describe("Sovereign Classifier", () => {
  it("classifies null data as public", () => {
    const result = classifySignal(null);
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.sovereignMatch, false);
  });

  it("classifies benign weather data as public", () => {
    const result = classifySignal({
      category: "weather",
      summary: "Temperature reading from radio propagation analysis",
      measurements: { temperature: 22.5, humidity: 65 },
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "weather");
    assert.equal(result.sovereignMatch, false);
  });

  it("classifies military signals as sovereign", () => {
    const result = classifySignal({
      summary: "High power radar installation detected at military base with weapons signatures",
      measurements: { signal_strength: -30, frequency: 9400 },
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "military_installation");
    assert.equal(result.sovereignMatch, true);
  });

  it("classifies nuclear facility patterns as sovereign", () => {
    const result = classifySignal({
      summary: "Nuclear reactor enrichment facility detected with radiation artifact signatures",
      measurements: { power_level: 100 },
      energyLevel: 60,
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "nuclear_facility");
    assert.equal(result.sovereignMatch, true);
  });

  it("classifies naval movement as sovereign", () => {
    const result = classifySignal({
      summary: "Submarine detected via undersea cable disturbance and VLF communication naval fleet movement",
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "naval_movement");
    assert.equal(result.sovereignMatch, true);
  });

  it("classifies infrastructure vulnerabilities as sovereign", () => {
    const result = classifySignal({
      summary: "SCADA unprotected control system exposed with vulnerability exploit potential and critical infrastructure leak",
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "infrastructure_vulnerability");
    assert.equal(result.sovereignMatch, true);
  });

  it("classifies population behavioral patterns as sovereign", () => {
    const result = classifySignal({
      summary: "Population tracking mass surveillance behavioral aggregate detected",
      populationScale: 50000,
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "population_behavioral");
    assert.equal(result.sovereignMatch, true);
  });

  it("classifies communication topology as sovereign", () => {
    const result = classifySignal({
      summary: "Government network intelligence agency classified comm diplomatic channel command structure encrypted topology multi hop classified",
    });
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.category, "communication_topology");
    assert.equal(result.sovereignMatch, true);
  });

  it("errs on the side of caution — ambiguous data goes UP", () => {
    // Just enough military keywords to be ambiguous (above sensitivity but below sovereign threshold)
    const result = classifySignal({
      summary: "Unusual radar pattern detected near military facility",
    });
    // Should be upgraded to sovereign due to caution principle
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.sovereignMatch, true);
  });

  it("classifies research-level data correctly", () => {
    const result = classifySignal({
      summary: "Cross-medium synthesis multi-signal correlation analysis of ionospheric patterns",
      mediaCount: 3,
    });
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.researchMatch, true);
  });

  it("detects deep geological research patterns", () => {
    const result = classifySignal({
      summary: "Aquifer mineral deposit subsurface detail tectonic mapping",
      precision: 0.9,
    });
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.category, "deep_geological");
  });

  it("classifies geology category for public data", () => {
    const result = classifySignal({
      category: "geology",
      summary: "General terrain analysis",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "geology");
  });

  it("classifies energy category for public data", () => {
    const result = classifySignal({
      category: "energy",
      summary: "Grid load analysis",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "energy");
  });

  it("classifies ocean monitoring as public", () => {
    const result = classifySignal({
      category: "ocean",
      summary: "Sea state observation from coastal sensors",
    });
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "ocean");
  });

  it("updates classifier stats", () => {
    classifySignal({ category: "weather", summary: "Temperature reading" });
    classifySignal({ summary: "Nuclear reactor enrichment facility radiation artifact" });

    const status = getClassifierStatus();
    assert.equal(status.stats.totalClassified, 2);
    assert.ok(status.stats.routedPublic >= 1);
  });
});

// ── Tier Routing ────────────────────────────────────────────────────────────

describe("Tier Routing", () => {
  it("routes sovereign data to vault — no DTU created", () => {
    const classification = { tier: TIERS.SOVEREIGN, category: "military_installation", confidence: 0.8 };
    const result = routeIntelligence({ summary: "classified" }, classification);

    assert.equal(result.routed, true);
    assert.equal(result.tier, TIERS.SOVEREIGN);
    assert.equal(result.dtuCreated, false);
    assert.equal(result.latticeEntry, false);
  });

  it("routes research data to restricted partition with DTU", () => {
    const classification = { tier: TIERS.RESEARCH, category: "deep_geological", confidence: 0.7 };
    const result = routeIntelligence({ summary: "research data" }, classification);

    assert.equal(result.routed, true);
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.dtuCreated, true);
    assert.equal(result.partition, "restricted");
    assert.notEqual(result.dtu, undefined);
    assert.equal(result.dtu.lineage_tracking, "enforced");
  });

  it("routes public data to standard lattice with DTU", () => {
    const classification = { tier: TIERS.PUBLIC, category: "weather", confidence: 0.9 };
    const result = routeIntelligence({ summary: "weather data" }, classification);

    assert.equal(result.routed, true);
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.dtuCreated, true);
    assert.equal(result.partition, "standard");
    assert.notEqual(result.dtu, undefined);
    assert.equal(result.dtu.commercially_licensable, true);
  });

  it("returns null for null classification", () => {
    assert.equal(routeIntelligence({}, null), null);
  });

  it("increments sovereign vault count", () => {
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "nuclear_facility" });
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "nuclear_facility" });
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });

    const status = getSovereignVaultStatus();
    assert.equal(status.count, 3);
    assert.equal(status.categories.nuclear_facility, 2);
    assert.equal(status.categories.military_installation, 1);
  });
});

// ── DTU Creation ────────────────────────────────────────────────────────────

describe("Public DTU Creation", () => {
  it("creates public DTU with correct schema", () => {
    const dtu = createPublicDTU(
      { summary: "Weather data", measurements: { temp: 22 }, sources: 5 },
      { category: "weather", confidence: 0.9 }
    );

    assert.match(dtu.id, /^pub_intel_/);
    assert.equal(dtu.type, "FOUNDATION_INTEL");
    assert.equal(dtu.tier, TIERS.PUBLIC);
    assert.equal(dtu.category, "weather");
    assert.equal(dtu.classification, CLASSIFICATIONS.OPEN);
    assert.equal(dtu.commercially_licensable, true);
    assert.equal(dtu.confidence, 0.9);
    assert.equal(dtu.sources, 5);
    assert.equal(dtu.scope, "global");
    assert.ok(dtu.tags.includes("public"));
    assert.ok(dtu.tags.includes("weather"));
    assert.notEqual(dtu.coverage_area, undefined);
    assert.notEqual(dtu.temporal_range, undefined);
  });

  it("clamps confidence between 0 and 1", () => {
    const dtu = createPublicDTU({}, { category: "weather", confidence: 5.0 });
    assert.equal(dtu.confidence, 1);
  });
});

describe("Research DTU Creation", () => {
  it("creates research DTU with correct schema", () => {
    const dtu = createResearchDTU(
      { summary: "Cross-medium data", methodology: "foundation_synthesis" },
      { category: "cross_medium_synthesis", confidence: 0.7 }
    );

    assert.match(dtu.id, /^res_intel_/);
    assert.equal(dtu.type, "FOUNDATION_INTEL");
    assert.equal(dtu.tier, TIERS.RESEARCH);
    assert.equal(dtu.category, "cross_medium_synthesis");
    assert.equal(dtu.classification, CLASSIFICATIONS.RESTRICTED);
    assert.equal(dtu.access_required, "governance_approved");
    assert.equal(dtu.lineage_tracking, "enforced");
    assert.equal(dtu.transfer_prohibited, true);
    assert.equal(dtu.usage_agreement, "no_weaponization_no_resale_no_transfer");
    assert.equal(dtu.scope, "restricted");
  });
});

// ── Full Pipeline ───────────────────────────────────────────────────────────

describe("Full Classification Pipeline", () => {
  it("rejects when classifier not active", () => {
    const result = processSignalIntelligence({ summary: "test" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "classifier_not_active");
  });

  it("processes public intelligence after initialization", async () => {
    await initializeIntelligence({});
    const result = processSignalIntelligence({
      category: "weather",
      summary: "Temperature and pressure readings from radio propagation",
    });

    assert.equal(result.ok, true);
    assert.equal(result.classification.tier, TIERS.PUBLIC);
    assert.equal(result.routing.dtuCreated, true);
  });

  it("processes sovereign intelligence — no DTU created", async () => {
    await initializeIntelligence({});
    const result = processSignalIntelligence({
      summary: "Nuclear reactor enrichment facility detected with radiation artifact high power",
      energyLevel: 100,
    });

    assert.equal(result.ok, true);
    assert.equal(result.classification.tier, TIERS.SOVEREIGN);
    assert.equal(result.routing.dtuCreated, false);
    assert.equal(result.routing.latticeEntry, false);
  });

  it("rejects null signal data", async () => {
    await initializeIntelligence({});
    const result = processSignalIntelligence(null);
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_signal_data");
  });
});

// ── Research Access Management ──────────────────────────────────────────────

describe("Research Applications", () => {
  it("submits a research application", () => {
    const result = submitResearchApplication(
      "researcher_001", "MIT", "Climate study", ["cross_medium_synthesis"]
    );
    assert.equal(result.ok, true);
    assert.match(result.applicationId, /^research_app_/);
    assert.equal(result.status, "pending");
  });

  it("retrieves application status", () => {
    const app = submitResearchApplication("researcher_002", "Stanford", "Geology", ["deep_geological"]);
    const status = getResearchApplicationStatus(app.applicationId);
    assert.equal(status.ok, true);
    assert.equal(status.application.status, "pending");
    assert.equal(status.application.institution, "Stanford");
  });

  it("returns error for unknown application", () => {
    const result = getResearchApplicationStatus("nonexistent");
    assert.equal(result.ok, false);
    assert.equal(result.error, "application_not_found");
  });

  it("approves application and grants access", () => {
    const app = submitResearchApplication("researcher_003", "Oxford", "Marine study", ["marine_deep"]);
    const review = reviewResearchApplication(app.applicationId, true, "council");

    assert.equal(review.ok, true);
    assert.equal(review.status, "approved");
    assert.equal(hasResearchAccess("researcher_003", "marine_deep"), true);
  });

  it("denies application — no access granted", () => {
    const app = submitResearchApplication("researcher_004", "Unknown", "Suspicious", []);
    reviewResearchApplication(app.applicationId, false, "council");

    assert.equal(hasResearchAccess("researcher_004"), false);
  });

  it("prevents double review", () => {
    const app = submitResearchApplication("researcher_005", "ETH", "Study", []);
    reviewResearchApplication(app.applicationId, true, "council");
    const secondReview = reviewResearchApplication(app.applicationId, false, "council");

    assert.equal(secondReview.ok, false);
    assert.equal(secondReview.error, "already_reviewed");
  });

  it("revokes research access", () => {
    const app = submitResearchApplication("researcher_006", "Caltech", "Study", ["advanced_atmospheric"]);
    reviewResearchApplication(app.applicationId, true, "council");

    assert.equal(hasResearchAccess("researcher_006"), true);
    revokeResearchAccess("researcher_006");
    assert.equal(hasResearchAccess("researcher_006"), false);
  });

  it("revoke returns false for non-existent researcher", () => {
    const result = revokeResearchAccess("nonexistent");
    assert.equal(result.ok, true);
    assert.equal(result.revoked, false);
  });
});

// ── Public Intelligence Retrieval ───────────────────────────────────────────

describe("Public Intelligence Retrieval", () => {
  beforeEach(async () => {
    await initializeIntelligence({});
  });

  it("returns empty list for new category", () => {
    const result = getPublicIntelligence("weather");
    assert.equal(result.ok, true);
    assert.equal(result.tier, TIERS.PUBLIC);
    assert.equal(result.category, "weather");
    assert.equal(result.count, 0);
  });

  it("rejects invalid category", () => {
    const result = getPublicIntelligence("invalid_category");
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_category");
    assert.deepEqual(result.validCategories, PUBLIC_CATEGORIES);
  });

  it("returns data after processing", () => {
    processSignalIntelligence({ category: "weather", summary: "Temp reading" });
    processSignalIntelligence({ category: "weather", summary: "Pressure reading" });

    const result = getPublicIntelligence("weather");
    assert.equal(result.ok, true);
    assert.equal(result.count, 2);
    assert.equal(result.data[0].type, "FOUNDATION_INTEL");
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      processSignalIntelligence({ category: "seismic", summary: `Seismic reading ${i}` });
    }

    const result = getPublicIntelligence("seismic", 5);
    assert.equal(result.count, 5);
  });

  it("returns all category summaries", () => {
    processSignalIntelligence({ category: "weather", summary: "test" });
    processSignalIntelligence({ category: "geology", summary: "test" });

    const result = getAllPublicCategories();
    assert.equal(result.ok, true);
    assert.equal(result.categories.weather.count, 1);
    assert.equal(result.categories.geology.count, 1);
    assert.equal(result.categories.ocean.count, 0);
  });
});

// ── Research Intelligence Retrieval ─────────────────────────────────────────

describe("Research Intelligence Retrieval", () => {
  beforeEach(async () => {
    await initializeIntelligence({});
  });

  it("denies access without approval", () => {
    const result = getResearchIntelligence("unauthorized_user", "cross_medium_synthesis");
    assert.equal(result.ok, false);
    assert.equal(result.error, "access_denied");
  });

  it("grants access after approval", () => {
    const app = submitResearchApplication("approved_researcher", "MIT", "Study", ["cross_medium_synthesis"]);
    reviewResearchApplication(app.applicationId, true, "council");

    // Add research data
    processSignalIntelligence({
      summary: "Cross-medium synthesis multi-signal correlation analysis",
      mediaCount: 3,
    });

    const result = getResearchIntelligence("approved_researcher", "cross_medium_synthesis");
    assert.equal(result.ok, true);
    assert.equal(result.tier, TIERS.RESEARCH);
    assert.equal(result.lineage_tracking, "enforced");
  });

  it("provides synthesis shorthand", () => {
    const app = submitResearchApplication("synth_researcher", "ETH", "Synthesis", ["cross_medium_synthesis"]);
    reviewResearchApplication(app.applicationId, true, "council");

    const result = getResearchSynthesis("synth_researcher");
    assert.equal(result.ok, true);
  });

  it("provides archive shorthand", () => {
    const app = submitResearchApplication("archive_researcher", "Oxford", "History", ["historical_archaeology"]);
    reviewResearchApplication(app.applicationId, true, "council");

    const result = getResearchArchive("archive_researcher");
    assert.equal(result.ok, true);
  });
});

// ── Sovereign Vault ─────────────────────────────────────────────────────────

describe("Sovereign Vault", () => {
  it("reports isolation status", () => {
    const status = getSovereignVaultStatus();
    assert.equal(status.exists, true);
    assert.equal(status.isolated, true);
    assert.equal(status.latticeConnected, false);
    assert.equal(status.apiAccessible, false);
    assert.equal(status.count, 0);
  });

  it("tracks metadata only — no data exposure", () => {
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });

    const status = getSovereignVaultStatus();
    assert.equal(status.count, 1);
    assert.equal(status.categories.military_installation, 1);
    // No data field — only counts
    assert.ok(!Object.prototype.hasOwnProperty.call(status, "data"));
  });

  it("accumulates across categories", async () => {
    await initializeIntelligence({});

    processSignalIntelligence({ summary: "Military base weapons radar installation detected" });
    processSignalIntelligence({ summary: "Nuclear reactor enrichment facility radiation artifact" });
    processSignalIntelligence({ summary: "Submarine naval fleet undersea cable disturbance VLF communication" });

    const status = getSovereignVaultStatus();
    assert.equal(status.count, 3);
  });
});

// ── Classifier Management ───────────────────────────────────────────────────

describe("Classifier Management", () => {
  it("returns classifier status", () => {
    const status = getClassifierStatus();
    assert.equal(status.active, false); // Not initialized yet
    assert.deepEqual(status.sovereignCategories, SOVEREIGN_CATEGORIES);
    assert.deepEqual(status.researchCategories, RESEARCH_CATEGORIES);
    assert.deepEqual(status.publicCategories, PUBLIC_CATEGORIES);
  });

  it("reports active after initialization", async () => {
    await initializeIntelligence({});
    const status = getClassifierStatus();
    assert.equal(status.active, true);
  });

  it("updates thresholds", () => {
    const result = updateClassifierThresholds(0.4, 0.7);
    assert.equal(result.ok, true);
    assert.equal(result.sensitivity, 0.4);
    assert.equal(result.sovereign, 0.7);
  });

  it("clamps thresholds to valid range", () => {
    const result = updateClassifierThresholds(0.01, 1.5);
    assert.equal(result.sensitivity, 0.1); // min 0.1
    assert.equal(result.sovereign, 1.0);   // max 1.0
  });
});

// ── Chat Intent Detection ───────────────────────────────────────────────────

describe("Chat Intent Detection", () => {
  it("returns false for empty input", () => {
    assert.equal(detectIntelIntent("").isIntelRequest, false);
    assert.equal(detectIntelIntent(null).isIntelRequest, false);
  });

  it("detects weather intelligence requests", () => {
    const result = detectIntelIntent("Show me the weather intelligence data");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "weather");
  });

  it("detects geological survey requests", () => {
    const result = detectIntelIntent("What geological survey data is available?");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "geology");
  });

  it("detects energy intelligence requests", () => {
    const result = detectIntelIntent("Show energy intelligence distribution");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "energy");
  });

  it("detects ocean monitoring requests", () => {
    const result = detectIntelIntent("What ocean monitoring intel is available?");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "ocean");
  });

  it("detects seismic monitoring requests", () => {
    const result = detectIntelIntent("Show seismic activity readings");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "seismic");
  });

  it("detects agriculture requests", () => {
    const result = detectIntelIntent("What agricultural data do you have?");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "agriculture");
  });

  it("detects environment assessment requests", () => {
    const result = detectIntelIntent("Show environment intelligence assessment");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "environment");
  });

  it("detects classifier status requests", () => {
    const result = detectIntelIntent("What is the intelligence classifier status?");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "classifier_status");
  });

  it("detects research access requests", () => {
    const result = detectIntelIntent("How do I get research access to data?");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "research_status");
  });

  it("detects sovereign vault status requests", () => {
    const result = detectIntelIntent("What is the sovereign vault status?");
    assert.equal(result.isIntelRequest, true);
    assert.equal(result.action, "sovereign_status");
  });

  it("does not match unrelated queries", () => {
    assert.equal(detectIntelIntent("How do I make a sandwich?").isIntelRequest, false);
    assert.equal(detectIntelIntent("Tell me a joke").isIntelRequest, false);
  });
});

// ── Metrics ─────────────────────────────────────────────────────────────────

describe("Intelligence Metrics", () => {
  it("returns comprehensive metrics", async () => {
    await initializeIntelligence({});
    processSignalIntelligence({ category: "weather", summary: "Temp reading" });

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.initialized, true);
    assert.equal(metrics.classifierActive, true);
    assert.ok(metrics.classifier.totalClassified >= 1);
    assert.notEqual(metrics.tiers.public, undefined);
    assert.notEqual(metrics.tiers.research, undefined);
    assert.notEqual(metrics.tiers.sovereign, undefined);
    assert.equal(metrics.tiers.sovereign.isolated, true);
    assert.equal(metrics.tiers.sovereign.apiAccessible, false);
    assert.ok(metrics.stats.totalIntelDTUsCreated >= 1);
    assert.ok(metrics.uptime >= 0);
  });
});

// ── Heartbeat ───────────────────────────────────────────────────────────────

describe("Intelligence Heartbeat", () => {
  it("runs without error", async () => {
    await initializeIntelligence({});
    await intelligenceHeartbeatTick({}, 1);
  });
});

// ── Initialization ──────────────────────────────────────────────────────────

describe("Initialization", () => {
  it("initializes successfully", async () => {
    const result = await initializeIntelligence({});
    assert.equal(result.ok, true);
    assert.equal(result.classifierActive, true);
    assert.deepEqual(result.tiers, [TIERS.PUBLIC, TIERS.RESEARCH, TIERS.SOVEREIGN]);
    assert.deepEqual(result.publicCategories, PUBLIC_CATEGORIES);
    assert.deepEqual(result.researchCategories, RESEARCH_CATEGORIES);
    // Sovereign categories count only — don't expose names
    assert.equal(result.sovereignCategories, 6);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeIntelligence({});
    const result = await initializeIntelligence({});
    assert.equal(result.ok, true);
    assert.equal(result.alreadyInitialized, true);
  });
});

// ── State Reset ─────────────────────────────────────────────────────────────

describe("State Reset", () => {
  it("resets all state", async () => {
    await initializeIntelligence({});
    processSignalIntelligence({ category: "weather", summary: "test" });

    _resetIntelligenceState();

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.initialized, false);
    assert.equal(metrics.classifierActive, false);
    assert.equal(metrics.stats.totalIntelDTUsCreated, 0);
  });
});

// ── Cross-Module Integration ────────────────────────────────────────────────

describe("Cross-Module Integration", () => {
  beforeEach(async () => {
    await initializeIntelligence({});
  });

  it("full pipeline: classify → route → retrieve for public weather", () => {
    const result = processSignalIntelligence({
      category: "weather",
      summary: "Temperature 22.5°C from radio propagation",
      measurements: { temperature: 22.5 },
      sources: 3,
    });

    assert.equal(result.ok, true);
    assert.equal(result.classification.tier, TIERS.PUBLIC);

    const weather = getPublicIntelligence("weather");
    assert.equal(weather.ok, true);
    assert.equal(weather.count, 1);
    assert.equal(weather.data[0].commercially_licensable, true);
  });

  it("full pipeline: classify → route → quarantine for sovereign", () => {
    const result = processSignalIntelligence({
      summary: "Military base radar weapons installation detected with high power encrypted burst jamming",
    });

    assert.equal(result.ok, true);
    assert.equal(result.classification.tier, TIERS.SOVEREIGN);
    assert.equal(result.routing.dtuCreated, false);

    // Public weather should be empty — sovereign data never enters public
    const weather = getPublicIntelligence("weather");
    assert.equal(weather.count, 0);

    // Vault tracks count only
    const vault = getSovereignVaultStatus();
    assert.equal(vault.count, 1);
  });

  it("full pipeline: classify → route → restrict for research", () => {
    const result = processSignalIntelligence({
      summary: "Cross-medium synthesis multi-signal correlation discovered new ionospheric pattern",
      mediaCount: 4,
    });

    assert.equal(result.ok, true);
    assert.equal(result.classification.tier, TIERS.RESEARCH);
    assert.equal(result.routing.dtu.lineage_tracking, "enforced");
    assert.equal(result.routing.dtu.transfer_prohibited, true);

    // Unauthorized access denied
    const data = getResearchIntelligence("random_user");
    assert.equal(data.ok, false);
  });

  it("processes multiple categories in sequence", () => {
    processSignalIntelligence({ category: "weather", summary: "temp" });
    processSignalIntelligence({ category: "geology", summary: "terrain geological" });
    processSignalIntelligence({ category: "seismic", summary: "tremor seismic" });
    processSignalIntelligence({ summary: "Nuclear reactor radiation enrichment facility artifact" });

    const metrics = getIntelligenceMetrics();
    assert.equal(metrics.stats.totalPublicDTUs, 3);
    assert.equal(metrics.stats.sovereignInterceptions, 1);
    assert.equal(metrics.classifier.totalClassified, 4);
  });
});
