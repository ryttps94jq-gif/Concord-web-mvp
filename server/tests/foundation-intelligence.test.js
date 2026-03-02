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

import { describe, it, expect, beforeEach } from "vitest";

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
    expect(TIERS.PUBLIC).toBe("PUBLIC");
    expect(TIERS.RESEARCH).toBe("RESEARCH");
    expect(TIERS.SOVEREIGN).toBe("SOVEREIGN");
  });

  it("defines three classifications", () => {
    expect(CLASSIFICATIONS.OPEN).toBe("OPEN");
    expect(CLASSIFICATIONS.RESTRICTED).toBe("RESTRICTED");
    expect(CLASSIFICATIONS.ABSOLUTE).toBe("ABSOLUTE");
  });

  it("defines 7 public categories", () => {
    expect(PUBLIC_CATEGORIES).toHaveLength(7);
    expect(PUBLIC_CATEGORIES).toContain("weather");
    expect(PUBLIC_CATEGORIES).toContain("geology");
    expect(PUBLIC_CATEGORIES).toContain("energy");
    expect(PUBLIC_CATEGORIES).toContain("ocean");
    expect(PUBLIC_CATEGORIES).toContain("seismic");
    expect(PUBLIC_CATEGORIES).toContain("agriculture");
    expect(PUBLIC_CATEGORIES).toContain("environment");
  });

  it("defines 5 research categories", () => {
    expect(RESEARCH_CATEGORIES).toHaveLength(5);
    expect(RESEARCH_CATEGORIES).toContain("cross_medium_synthesis");
    expect(RESEARCH_CATEGORIES).toContain("historical_archaeology");
    expect(RESEARCH_CATEGORIES).toContain("deep_geological");
    expect(RESEARCH_CATEGORIES).toContain("advanced_atmospheric");
    expect(RESEARCH_CATEGORIES).toContain("marine_deep");
  });

  it("defines 6 sovereign categories", () => {
    expect(SOVEREIGN_CATEGORIES).toHaveLength(6);
    expect(SOVEREIGN_CATEGORIES).toContain("military_installation");
    expect(SOVEREIGN_CATEGORIES).toContain("naval_movement");
    expect(SOVEREIGN_CATEGORIES).toContain("nuclear_facility");
    expect(SOVEREIGN_CATEGORIES).toContain("infrastructure_vulnerability");
    expect(SOVEREIGN_CATEGORIES).toContain("population_behavioral");
    expect(SOVEREIGN_CATEGORIES).toContain("communication_topology");
  });

  it("frozen arrays are immutable", () => {
    expect(Object.isFrozen(PUBLIC_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(RESEARCH_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(SOVEREIGN_CATEGORIES)).toBe(true);
  });
});

// ── Sovereign Classifier ────────────────────────────────────────────────────

describe("Sovereign Classifier", () => {
  it("classifies null data as public", () => {
    const result = classifySignal(null);
    expect(result.tier).toBe(TIERS.PUBLIC);
    expect(result.sovereignMatch).toBe(false);
  });

  it("classifies benign weather data as public", () => {
    const result = classifySignal({
      category: "weather",
      summary: "Temperature reading from radio propagation analysis",
      measurements: { temperature: 22.5, humidity: 65 },
    });
    expect(result.tier).toBe(TIERS.PUBLIC);
    expect(result.category).toBe("weather");
    expect(result.sovereignMatch).toBe(false);
  });

  it("classifies military signals as sovereign", () => {
    const result = classifySignal({
      summary: "High power radar installation detected at military base with weapons signatures",
      measurements: { signal_strength: -30, frequency: 9400 },
    });
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.category).toBe("military_installation");
    expect(result.sovereignMatch).toBe(true);
  });

  it("classifies nuclear facility patterns as sovereign", () => {
    const result = classifySignal({
      summary: "Nuclear reactor enrichment facility detected with radiation artifact signatures",
      measurements: { power_level: 100 },
      energyLevel: 60,
    });
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.category).toBe("nuclear_facility");
    expect(result.sovereignMatch).toBe(true);
  });

  it("classifies naval movement as sovereign", () => {
    const result = classifySignal({
      summary: "Submarine detected via undersea cable disturbance and VLF communication naval fleet movement",
    });
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.category).toBe("naval_movement");
    expect(result.sovereignMatch).toBe(true);
  });

  it("classifies infrastructure vulnerabilities as sovereign", () => {
    const result = classifySignal({
      summary: "SCADA unprotected control system exposed with vulnerability exploit potential and critical infrastructure leak",
    });
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.category).toBe("infrastructure_vulnerability");
    expect(result.sovereignMatch).toBe(true);
  });

  it("classifies population behavioral patterns as sovereign", () => {
    const result = classifySignal({
      summary: "Population tracking mass surveillance behavioral aggregate detected",
      populationScale: 50000,
    });
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.category).toBe("population_behavioral");
    expect(result.sovereignMatch).toBe(true);
  });

  it("classifies communication topology as sovereign", () => {
    const result = classifySignal({
      summary: "Government network intelligence agency classified comm diplomatic channel command structure encrypted topology multi hop classified",
    });
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.category).toBe("communication_topology");
    expect(result.sovereignMatch).toBe(true);
  });

  it("errs on the side of caution — ambiguous data goes UP", () => {
    // Just enough military keywords to be ambiguous (above sensitivity but below sovereign threshold)
    const result = classifySignal({
      summary: "Unusual radar pattern detected near military facility",
    });
    // Should be upgraded to sovereign due to caution principle
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.sovereignMatch).toBe(true);
  });

  it("classifies research-level data correctly", () => {
    const result = classifySignal({
      summary: "Cross-medium synthesis multi-signal correlation analysis of ionospheric patterns",
      mediaCount: 3,
    });
    expect(result.tier).toBe(TIERS.RESEARCH);
    expect(result.researchMatch).toBe(true);
  });

  it("detects deep geological research patterns", () => {
    const result = classifySignal({
      summary: "Aquifer mineral deposit subsurface detail tectonic mapping",
      precision: 0.9,
    });
    expect(result.tier).toBe(TIERS.RESEARCH);
    expect(result.category).toBe("deep_geological");
  });

  it("classifies geology category for public data", () => {
    const result = classifySignal({
      category: "geology",
      summary: "General terrain analysis",
    });
    expect(result.tier).toBe(TIERS.PUBLIC);
    expect(result.category).toBe("geology");
  });

  it("classifies energy category for public data", () => {
    const result = classifySignal({
      category: "energy",
      summary: "Grid load analysis",
    });
    expect(result.tier).toBe(TIERS.PUBLIC);
    expect(result.category).toBe("energy");
  });

  it("classifies ocean monitoring as public", () => {
    const result = classifySignal({
      category: "ocean",
      summary: "Sea state observation from coastal sensors",
    });
    expect(result.tier).toBe(TIERS.PUBLIC);
    expect(result.category).toBe("ocean");
  });

  it("updates classifier stats", () => {
    classifySignal({ category: "weather", summary: "Temperature reading" });
    classifySignal({ summary: "Nuclear reactor enrichment facility radiation artifact" });

    const status = getClassifierStatus();
    expect(status.stats.totalClassified).toBe(2);
    expect(status.stats.routedPublic).toBeGreaterThanOrEqual(1);
  });
});

// ── Tier Routing ────────────────────────────────────────────────────────────

describe("Tier Routing", () => {
  it("routes sovereign data to vault — no DTU created", () => {
    const classification = { tier: TIERS.SOVEREIGN, category: "military_installation", confidence: 0.8 };
    const result = routeIntelligence({ summary: "classified" }, classification);

    expect(result.routed).toBe(true);
    expect(result.tier).toBe(TIERS.SOVEREIGN);
    expect(result.dtuCreated).toBe(false);
    expect(result.latticeEntry).toBe(false);
  });

  it("routes research data to restricted partition with DTU", () => {
    const classification = { tier: TIERS.RESEARCH, category: "deep_geological", confidence: 0.7 };
    const result = routeIntelligence({ summary: "research data" }, classification);

    expect(result.routed).toBe(true);
    expect(result.tier).toBe(TIERS.RESEARCH);
    expect(result.dtuCreated).toBe(true);
    expect(result.partition).toBe("restricted");
    expect(result.dtu).toBeDefined();
    expect(result.dtu.lineage_tracking).toBe("enforced");
  });

  it("routes public data to standard lattice with DTU", () => {
    const classification = { tier: TIERS.PUBLIC, category: "weather", confidence: 0.9 };
    const result = routeIntelligence({ summary: "weather data" }, classification);

    expect(result.routed).toBe(true);
    expect(result.tier).toBe(TIERS.PUBLIC);
    expect(result.dtuCreated).toBe(true);
    expect(result.partition).toBe("standard");
    expect(result.dtu).toBeDefined();
    expect(result.dtu.commercially_licensable).toBe(true);
  });

  it("returns null for null classification", () => {
    expect(routeIntelligence({}, null)).toBeNull();
  });

  it("increments sovereign vault count", () => {
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "nuclear_facility" });
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "nuclear_facility" });
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });

    const status = getSovereignVaultStatus();
    expect(status.count).toBe(3);
    expect(status.categories.nuclear_facility).toBe(2);
    expect(status.categories.military_installation).toBe(1);
  });
});

// ── DTU Creation ────────────────────────────────────────────────────────────

describe("Public DTU Creation", () => {
  it("creates public DTU with correct schema", () => {
    const dtu = createPublicDTU(
      { summary: "Weather data", measurements: { temp: 22 }, sources: 5 },
      { category: "weather", confidence: 0.9 }
    );

    expect(dtu.id).toMatch(/^pub_intel_/);
    expect(dtu.type).toBe("FOUNDATION_INTEL");
    expect(dtu.tier).toBe(TIERS.PUBLIC);
    expect(dtu.category).toBe("weather");
    expect(dtu.classification).toBe(CLASSIFICATIONS.OPEN);
    expect(dtu.commercially_licensable).toBe(true);
    expect(dtu.confidence).toBe(0.9);
    expect(dtu.sources).toBe(5);
    expect(dtu.scope).toBe("global");
    expect(dtu.tags).toContain("public");
    expect(dtu.tags).toContain("weather");
    expect(dtu.coverage_area).toBeDefined();
    expect(dtu.temporal_range).toBeDefined();
  });

  it("clamps confidence between 0 and 1", () => {
    const dtu = createPublicDTU({}, { category: "weather", confidence: 5.0 });
    expect(dtu.confidence).toBe(1);
  });
});

describe("Research DTU Creation", () => {
  it("creates research DTU with correct schema", () => {
    const dtu = createResearchDTU(
      { summary: "Cross-medium data", methodology: "foundation_synthesis" },
      { category: "cross_medium_synthesis", confidence: 0.7 }
    );

    expect(dtu.id).toMatch(/^res_intel_/);
    expect(dtu.type).toBe("FOUNDATION_INTEL");
    expect(dtu.tier).toBe(TIERS.RESEARCH);
    expect(dtu.category).toBe("cross_medium_synthesis");
    expect(dtu.classification).toBe(CLASSIFICATIONS.RESTRICTED);
    expect(dtu.access_required).toBe("governance_approved");
    expect(dtu.lineage_tracking).toBe("enforced");
    expect(dtu.transfer_prohibited).toBe(true);
    expect(dtu.usage_agreement).toBe("no_weaponization_no_resale_no_transfer");
    expect(dtu.scope).toBe("restricted");
  });
});

// ── Full Pipeline ───────────────────────────────────────────────────────────

describe("Full Classification Pipeline", () => {
  it("rejects when classifier not active", () => {
    const result = processSignalIntelligence({ summary: "test" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("classifier_not_active");
  });

  it("processes public intelligence after initialization", async () => {
    await initializeIntelligence({});
    const result = processSignalIntelligence({
      category: "weather",
      summary: "Temperature and pressure readings from radio propagation",
    });

    expect(result.ok).toBe(true);
    expect(result.classification.tier).toBe(TIERS.PUBLIC);
    expect(result.routing.dtuCreated).toBe(true);
  });

  it("processes sovereign intelligence — no DTU created", async () => {
    await initializeIntelligence({});
    const result = processSignalIntelligence({
      summary: "Nuclear reactor enrichment facility detected with radiation artifact high power",
      energyLevel: 100,
    });

    expect(result.ok).toBe(true);
    expect(result.classification.tier).toBe(TIERS.SOVEREIGN);
    expect(result.routing.dtuCreated).toBe(false);
    expect(result.routing.latticeEntry).toBe(false);
  });

  it("rejects null signal data", async () => {
    await initializeIntelligence({});
    const result = processSignalIntelligence(null);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_signal_data");
  });
});

// ── Research Access Management ──────────────────────────────────────────────

describe("Research Applications", () => {
  it("submits a research application", () => {
    const result = submitResearchApplication(
      "researcher_001", "MIT", "Climate study", ["cross_medium_synthesis"]
    );
    expect(result.ok).toBe(true);
    expect(result.applicationId).toMatch(/^research_app_/);
    expect(result.status).toBe("pending");
  });

  it("retrieves application status", () => {
    const app = submitResearchApplication("researcher_002", "Stanford", "Geology", ["deep_geological"]);
    const status = getResearchApplicationStatus(app.applicationId);
    expect(status.ok).toBe(true);
    expect(status.application.status).toBe("pending");
    expect(status.application.institution).toBe("Stanford");
  });

  it("returns error for unknown application", () => {
    const result = getResearchApplicationStatus("nonexistent");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("application_not_found");
  });

  it("approves application and grants access", () => {
    const app = submitResearchApplication("researcher_003", "Oxford", "Marine study", ["marine_deep"]);
    const review = reviewResearchApplication(app.applicationId, true, "council");

    expect(review.ok).toBe(true);
    expect(review.status).toBe("approved");
    expect(hasResearchAccess("researcher_003", "marine_deep")).toBe(true);
  });

  it("denies application — no access granted", () => {
    const app = submitResearchApplication("researcher_004", "Unknown", "Suspicious", []);
    reviewResearchApplication(app.applicationId, false, "council");

    expect(hasResearchAccess("researcher_004")).toBe(false);
  });

  it("prevents double review", () => {
    const app = submitResearchApplication("researcher_005", "ETH", "Study", []);
    reviewResearchApplication(app.applicationId, true, "council");
    const secondReview = reviewResearchApplication(app.applicationId, false, "council");

    expect(secondReview.ok).toBe(false);
    expect(secondReview.error).toBe("already_reviewed");
  });

  it("revokes research access", () => {
    const app = submitResearchApplication("researcher_006", "Caltech", "Study", ["advanced_atmospheric"]);
    reviewResearchApplication(app.applicationId, true, "council");

    expect(hasResearchAccess("researcher_006")).toBe(true);
    revokeResearchAccess("researcher_006");
    expect(hasResearchAccess("researcher_006")).toBe(false);
  });

  it("revoke returns false for non-existent researcher", () => {
    const result = revokeResearchAccess("nonexistent");
    expect(result.ok).toBe(true);
    expect(result.revoked).toBe(false);
  });
});

// ── Public Intelligence Retrieval ───────────────────────────────────────────

describe("Public Intelligence Retrieval", () => {
  beforeEach(async () => {
    await initializeIntelligence({});
  });

  it("returns empty list for new category", () => {
    const result = getPublicIntelligence("weather");
    expect(result.ok).toBe(true);
    expect(result.tier).toBe(TIERS.PUBLIC);
    expect(result.category).toBe("weather");
    expect(result.count).toBe(0);
  });

  it("rejects invalid category", () => {
    const result = getPublicIntelligence("invalid_category");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_category");
    expect(result.validCategories).toEqual(PUBLIC_CATEGORIES);
  });

  it("returns data after processing", () => {
    processSignalIntelligence({ category: "weather", summary: "Temp reading" });
    processSignalIntelligence({ category: "weather", summary: "Pressure reading" });

    const result = getPublicIntelligence("weather");
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(result.data[0].type).toBe("FOUNDATION_INTEL");
  });

  it("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      processSignalIntelligence({ category: "seismic", summary: `Seismic reading ${i}` });
    }

    const result = getPublicIntelligence("seismic", 5);
    expect(result.count).toBe(5);
  });

  it("returns all category summaries", () => {
    processSignalIntelligence({ category: "weather", summary: "test" });
    processSignalIntelligence({ category: "geology", summary: "test" });

    const result = getAllPublicCategories();
    expect(result.ok).toBe(true);
    expect(result.categories.weather.count).toBe(1);
    expect(result.categories.geology.count).toBe(1);
    expect(result.categories.ocean.count).toBe(0);
  });
});

// ── Research Intelligence Retrieval ─────────────────────────────────────────

describe("Research Intelligence Retrieval", () => {
  beforeEach(async () => {
    await initializeIntelligence({});
  });

  it("denies access without approval", () => {
    const result = getResearchIntelligence("unauthorized_user", "cross_medium_synthesis");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("access_denied");
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
    expect(result.ok).toBe(true);
    expect(result.tier).toBe(TIERS.RESEARCH);
    expect(result.lineage_tracking).toBe("enforced");
  });

  it("provides synthesis shorthand", () => {
    const app = submitResearchApplication("synth_researcher", "ETH", "Synthesis", ["cross_medium_synthesis"]);
    reviewResearchApplication(app.applicationId, true, "council");

    const result = getResearchSynthesis("synth_researcher");
    expect(result.ok).toBe(true);
  });

  it("provides archive shorthand", () => {
    const app = submitResearchApplication("archive_researcher", "Oxford", "History", ["historical_archaeology"]);
    reviewResearchApplication(app.applicationId, true, "council");

    const result = getResearchArchive("archive_researcher");
    expect(result.ok).toBe(true);
  });
});

// ── Sovereign Vault ─────────────────────────────────────────────────────────

describe("Sovereign Vault", () => {
  it("reports isolation status", () => {
    const status = getSovereignVaultStatus();
    expect(status.exists).toBe(true);
    expect(status.isolated).toBe(true);
    expect(status.latticeConnected).toBe(false);
    expect(status.apiAccessible).toBe(false);
    expect(status.count).toBe(0);
  });

  it("tracks metadata only — no data exposure", () => {
    routeIntelligence({}, { tier: TIERS.SOVEREIGN, category: "military_installation" });

    const status = getSovereignVaultStatus();
    expect(status.count).toBe(1);
    expect(status.categories.military_installation).toBe(1);
    // No data field — only counts
    expect(status).not.toHaveProperty("data");
  });

  it("accumulates across categories", async () => {
    await initializeIntelligence({});

    processSignalIntelligence({ summary: "Military base weapons radar installation detected" });
    processSignalIntelligence({ summary: "Nuclear reactor enrichment facility radiation artifact" });
    processSignalIntelligence({ summary: "Submarine naval fleet undersea cable disturbance VLF communication" });

    const status = getSovereignVaultStatus();
    expect(status.count).toBe(3);
  });
});

// ── Classifier Management ───────────────────────────────────────────────────

describe("Classifier Management", () => {
  it("returns classifier status", () => {
    const status = getClassifierStatus();
    expect(status.active).toBe(false); // Not initialized yet
    expect(status.sovereignCategories).toEqual(SOVEREIGN_CATEGORIES);
    expect(status.researchCategories).toEqual(RESEARCH_CATEGORIES);
    expect(status.publicCategories).toEqual(PUBLIC_CATEGORIES);
  });

  it("reports active after initialization", async () => {
    await initializeIntelligence({});
    const status = getClassifierStatus();
    expect(status.active).toBe(true);
  });

  it("updates thresholds", () => {
    const result = updateClassifierThresholds(0.4, 0.7);
    expect(result.ok).toBe(true);
    expect(result.sensitivity).toBe(0.4);
    expect(result.sovereign).toBe(0.7);
  });

  it("clamps thresholds to valid range", () => {
    const result = updateClassifierThresholds(0.01, 1.5);
    expect(result.sensitivity).toBe(0.1); // min 0.1
    expect(result.sovereign).toBe(1.0);   // max 1.0
  });
});

// ── Chat Intent Detection ───────────────────────────────────────────────────

describe("Chat Intent Detection", () => {
  it("returns false for empty input", () => {
    expect(detectIntelIntent("").isIntelRequest).toBe(false);
    expect(detectIntelIntent(null).isIntelRequest).toBe(false);
  });

  it("detects weather intelligence requests", () => {
    const result = detectIntelIntent("Show me the weather intelligence data");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("weather");
  });

  it("detects geological survey requests", () => {
    const result = detectIntelIntent("What geological survey data is available?");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("geology");
  });

  it("detects energy intelligence requests", () => {
    const result = detectIntelIntent("Show energy intelligence distribution");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("energy");
  });

  it("detects ocean monitoring requests", () => {
    const result = detectIntelIntent("What ocean monitoring intel is available?");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("ocean");
  });

  it("detects seismic monitoring requests", () => {
    const result = detectIntelIntent("Show seismic activity readings");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("seismic");
  });

  it("detects agriculture requests", () => {
    const result = detectIntelIntent("What agricultural data do you have?");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("agriculture");
  });

  it("detects environment assessment requests", () => {
    const result = detectIntelIntent("Show environment intelligence assessment");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("environment");
  });

  it("detects classifier status requests", () => {
    const result = detectIntelIntent("What is the intelligence classifier status?");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("classifier_status");
  });

  it("detects research access requests", () => {
    const result = detectIntelIntent("How do I get research access to data?");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("research_status");
  });

  it("detects sovereign vault status requests", () => {
    const result = detectIntelIntent("What is the sovereign vault status?");
    expect(result.isIntelRequest).toBe(true);
    expect(result.action).toBe("sovereign_status");
  });

  it("does not match unrelated queries", () => {
    expect(detectIntelIntent("How do I make a sandwich?").isIntelRequest).toBe(false);
    expect(detectIntelIntent("Tell me a joke").isIntelRequest).toBe(false);
  });
});

// ── Metrics ─────────────────────────────────────────────────────────────────

describe("Intelligence Metrics", () => {
  it("returns comprehensive metrics", async () => {
    await initializeIntelligence({});
    processSignalIntelligence({ category: "weather", summary: "Temp reading" });

    const metrics = getIntelligenceMetrics();
    expect(metrics.initialized).toBe(true);
    expect(metrics.classifierActive).toBe(true);
    expect(metrics.classifier.totalClassified).toBeGreaterThanOrEqual(1);
    expect(metrics.tiers.public).toBeDefined();
    expect(metrics.tiers.research).toBeDefined();
    expect(metrics.tiers.sovereign).toBeDefined();
    expect(metrics.tiers.sovereign.isolated).toBe(true);
    expect(metrics.tiers.sovereign.apiAccessible).toBe(false);
    expect(metrics.stats.totalIntelDTUsCreated).toBeGreaterThanOrEqual(1);
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ── Heartbeat ───────────────────────────────────────────────────────────────

describe("Intelligence Heartbeat", () => {
  it("runs without error", async () => {
    await initializeIntelligence({});
    await expect(intelligenceHeartbeatTick({}, 1)).resolves.not.toThrow();
  });
});

// ── Initialization ──────────────────────────────────────────────────────────

describe("Initialization", () => {
  it("initializes successfully", async () => {
    const result = await initializeIntelligence({});
    expect(result.ok).toBe(true);
    expect(result.classifierActive).toBe(true);
    expect(result.tiers).toEqual([TIERS.PUBLIC, TIERS.RESEARCH, TIERS.SOVEREIGN]);
    expect(result.publicCategories).toEqual(PUBLIC_CATEGORIES);
    expect(result.researchCategories).toEqual(RESEARCH_CATEGORIES);
    // Sovereign categories count only — don't expose names
    expect(result.sovereignCategories).toBe(6);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeIntelligence({});
    const result = await initializeIntelligence({});
    expect(result.ok).toBe(true);
    expect(result.alreadyInitialized).toBe(true);
  });
});

// ── State Reset ─────────────────────────────────────────────────────────────

describe("State Reset", () => {
  it("resets all state", async () => {
    await initializeIntelligence({});
    processSignalIntelligence({ category: "weather", summary: "test" });

    _resetIntelligenceState();

    const metrics = getIntelligenceMetrics();
    expect(metrics.initialized).toBe(false);
    expect(metrics.classifierActive).toBe(false);
    expect(metrics.stats.totalIntelDTUsCreated).toBe(0);
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

    expect(result.ok).toBe(true);
    expect(result.classification.tier).toBe(TIERS.PUBLIC);

    const weather = getPublicIntelligence("weather");
    expect(weather.ok).toBe(true);
    expect(weather.count).toBe(1);
    expect(weather.data[0].commercially_licensable).toBe(true);
  });

  it("full pipeline: classify → route → quarantine for sovereign", () => {
    const result = processSignalIntelligence({
      summary: "Military base radar weapons installation detected with high power encrypted burst jamming",
    });

    expect(result.ok).toBe(true);
    expect(result.classification.tier).toBe(TIERS.SOVEREIGN);
    expect(result.routing.dtuCreated).toBe(false);

    // Public weather should be empty — sovereign data never enters public
    const weather = getPublicIntelligence("weather");
    expect(weather.count).toBe(0);

    // Vault tracks count only
    const vault = getSovereignVaultStatus();
    expect(vault.count).toBe(1);
  });

  it("full pipeline: classify → route → restrict for research", () => {
    const result = processSignalIntelligence({
      summary: "Cross-medium synthesis multi-signal correlation discovered new ionospheric pattern",
      mediaCount: 4,
    });

    expect(result.ok).toBe(true);
    expect(result.classification.tier).toBe(TIERS.RESEARCH);
    expect(result.routing.dtu.lineage_tracking).toBe("enforced");
    expect(result.routing.dtu.transfer_prohibited).toBe(true);

    // Unauthorized access denied
    const data = getResearchIntelligence("random_user");
    expect(data.ok).toBe(false);
  });

  it("processes multiple categories in sequence", () => {
    processSignalIntelligence({ category: "weather", summary: "temp" });
    processSignalIntelligence({ category: "geology", summary: "terrain geological" });
    processSignalIntelligence({ category: "seismic", summary: "tremor seismic" });
    processSignalIntelligence({ summary: "Nuclear reactor radiation enrichment facility artifact" });

    const metrics = getIntelligenceMetrics();
    expect(metrics.stats.totalPublicDTUs).toBe(3);
    expect(metrics.stats.sovereignInterceptions).toBe(1);
    expect(metrics.classifier.totalClassified).toBe(4);
  });
});
