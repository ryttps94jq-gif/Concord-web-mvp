/**
 * Universal Lens Compliance Framework Test Suite — v1.0
 *
 * Tests:
 *   - Lens classification constants
 *   - Compliance validator phases
 *   - Compliance runner (all 12 phases)
 *   - Lens registration and creator gate
 *   - Nightly audit system
 *   - Upgrade propagation
 *   - Protection mode enforcement checks
 *   - Culture isolation checks
 *   - API compatibility checks
 *   - Constitutional invariants (no coin rewards, creator override restrictions)
 *
 * Run: node --test server/tests/lens-compliance.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  LENS_CLASSIFICATION,
  LENS_INTERFACE,
  LENS_COMPLIANCE_VALIDATOR,
  LENS_COMPLIANCE_CONSTANTS,
  LENS_CREATOR_GATE,
  PENDING_UPGRADES,
} from "../lib/lens-compliance-constants.js";

import {
  runLensCompliance,
  runNightlyAudit,
  getAllActiveLenses,
  getLensById,
  registerLens,
  disableLens,
  enableLens,
  submitLensForCompliance,
  propagateUpgrade,
  getUpgradeStatus,
  getLatestComplianceResult,
  getComplianceHistory,
  getLatestAudit,
  getAuditHistory,
  getComplianceDashboard,
} from "../economy/lens-compliance.js";

// ── In-Memory SQLite Helper ─────────────────────────────────────────

let Database;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  // skip DB tests if sqlite not available
}

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE lens_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      classification TEXT NOT NULL
        CHECK (classification IN ('KNOWLEDGE','CREATIVE','SOCIAL','CULTURE','UTILITY','HYBRID')),
      version TEXT NOT NULL,
      protection_mode TEXT NOT NULL
        CHECK (protection_mode IN ('PROTECTED', 'OPEN', 'ISOLATED')),
      creator_id TEXT NOT NULL,
      creator_type TEXT NOT NULL DEFAULT 'system'
        CHECK (creator_type IN ('system', 'user', 'emergent')),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled', 'pending_review', 'pending_compliance')),
      federation_tiers_json TEXT NOT NULL DEFAULT '[]',
      artifact_types_json TEXT DEFAULT '[]',
      config_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      disabled_at TEXT,
      disabled_reason TEXT
    );

    CREATE INDEX idx_lens_classification ON lens_registry(classification);
    CREATE INDEX idx_lens_status ON lens_registry(status);
    CREATE INDEX idx_lens_creator ON lens_registry(creator_id);

    CREATE TABLE lens_compliance_results (
      id TEXT PRIMARY KEY,
      lens_id TEXT NOT NULL,
      lens_version TEXT NOT NULL,
      classification TEXT NOT NULL,
      passed BOOLEAN NOT NULL,
      total_checks INTEGER NOT NULL,
      passed_checks INTEGER NOT NULL,
      failed_checks INTEGER NOT NULL,
      warnings INTEGER NOT NULL DEFAULT 0,
      results_json TEXT NOT NULL,
      validated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lens_id) REFERENCES lens_registry(id)
    );

    CREATE INDEX idx_compliance_lens ON lens_compliance_results(lens_id, validated_at);
    CREATE INDEX idx_compliance_passed ON lens_compliance_results(passed, validated_at);

    CREATE TABLE lens_audits (
      id TEXT PRIMARY KEY,
      total_lenses INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      failed INTEGER NOT NULL,
      warnings INTEGER NOT NULL DEFAULT 0,
      failures_json TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL
    );

    CREATE TABLE lens_upgrades (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      required_by TEXT NOT NULL,
      new_checks TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE lens_upgrade_status (
      upgrade_id TEXT NOT NULL,
      lens_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'needs_update'
        CHECK (status IN ('compliant', 'needs_update', 'disabled')),
      failures_json TEXT,
      deadline TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      PRIMARY KEY (upgrade_id, lens_id),
      FOREIGN KEY (upgrade_id) REFERENCES lens_upgrades(id),
      FOREIGN KEY (lens_id) REFERENCES lens_registry(id)
    );
  `);

  return db;
}

// ── Test Lens Factories ─────────────────────────────────────────────

function createKnowledgeLens(overrides = {}) {
  return {
    id: "test_research",
    name: "Test Research",
    icon: "flask",
    classification: "KNOWLEDGE",
    version: "1.0.0",
    protectionMode: "OPEN",
    protection_mode: "OPEN",
    federationTiers: ["regional", "national", "global"],
    federation_tiers: ["regional", "national", "global"],
    searchable: true,
    filters: { sort: ["newest", "most_cited"] },
    dtuBridge: {
      render: (dtu) => ({ text: dtu.humanLayer?.summary }),
      create: (input) => ({
        id: `test_${Date.now()}`,
        humanLayer: { summary: input.content || "test" },
        coreLayer: { type: "research" },
      }),
      validate: (dtu) => ({ valid: !!dtu.humanLayer }),
      layersUsed: ["human", "core", "machine"],
    },
    marketplace: {
      listable: true,
      pricingModel: "variable",
      oneTapPurchase: true,
    },
    export: {
      exportable: true,
      exportFormat: (dtu) => Buffer.from(JSON.stringify(dtu)),
      dtuFileEncode: (dtu) => {
        const header = Buffer.alloc(48);
        header.write("CDTU", 0);
        header.writeUInt16LE(1, 4);
        header[6] = 0x06; // display_research
        const body = Buffer.from(JSON.stringify(dtu));
        return Buffer.concat([header, body]);
      },
      dtuFileDecode: (buf) => {
        const body = buf.slice(48);
        return JSON.parse(body.toString());
      },
    },
    vault: { sharedVault: true },
    cascade: { derivativeTypes: ["expansion", "translation"] },
    ...overrides,
  };
}

function createCreativeLens(overrides = {}) {
  return {
    id: "test_music",
    name: "Test Music",
    icon: "music-note",
    classification: "CREATIVE",
    version: "1.0.0",
    protectionMode: "PROTECTED",
    protection_mode: "PROTECTED",
    federationTiers: ["regional", "national", "global"],
    federation_tiers: ["regional", "national", "global"],
    searchable: true,
    filters: { genre: true, sort: ["trending", "newest"] },
    dtuBridge: {
      render: (dtu) => ({ text: dtu.humanLayer?.summary }),
      create: (input) => ({
        id: `test_${Date.now()}`,
        humanLayer: { summary: input.content || "test track" },
        coreLayer: { type: "music" },
        artifactLayer: { data: Buffer.from("audio_data"), mimeType: "audio/mp3" },
      }),
      validate: (dtu) => ({ valid: !!dtu.humanLayer && !!dtu.artifactLayer }),
      layersUsed: ["human", "core", "artifact"],
    },
    marketplace: {
      listable: true,
      pricingModel: "fixed",
      oneTapPurchase: true,
    },
    export: {
      exportable: true,
      exportFormat: (dtu) => dtu.artifactLayer?.data,
      dtuFileEncode: (dtu) => {
        const header = Buffer.alloc(48);
        header.write("CDTU", 0);
        header.writeUInt16LE(1, 4);
        header[6] = 0x01; // play_audio
        const body = Buffer.from(JSON.stringify(dtu));
        return Buffer.concat([header, body]);
      },
      dtuFileDecode: (buf) => {
        const body = buf.slice(48);
        return JSON.parse(body.toString());
      },
    },
    vault: { sharedVault: true },
    cascade: {
      derivativeTypes: ["remix", "sample", "cover"],
      declarationFlow: () => ({ ok: true }),
    },
    contentModes: {
      full_song: { protection: "FULL" },
      preview: { protection: "FULL", maxDurationSeconds: 60 },
      purchased: { protection: "LICENSED", exportable: true },
    },
    preview: { supportsPreview: true, previewGenerator: () => Buffer.from("preview"), previewConstraints: { maxDurationSeconds: 60 } },
    artistryIntegration: { supportsArtistry: false },
    artifactTypes: ["audio/mp3", "audio/wav", "audio/flac"],
    xpReporting: {
      onSale: () => ({ xp: 50 }),
      onDerivative: () => ({ xp: 100 }),
      onPromotion: () => ({ xp: 500 }),
    },
    ...overrides,
  };
}

function createCultureLens(overrides = {}) {
  return {
    id: "culture",
    name: "Culture",
    icon: "globe-heart",
    classification: "CULTURE",
    version: "1.0.0",
    protectionMode: "ISOLATED",
    protection_mode: "ISOLATED",
    federationTiers: ["regional", "national"],
    federation_tiers: ["regional", "national"],
    searchable: false,
    filters: { sort: ["newest", "oldest"] },
    dtuBridge: {
      render: (dtu) => ({ text: dtu.humanLayer?.summary }),
      create: (input) => ({
        id: `culture_${Date.now()}`,
        humanLayer: { summary: input.content || "culture post" },
      }),
      validate: (dtu) => ({ valid: !!dtu.humanLayer }),
      layersUsed: ["human"],
    },
    isolation: {
      crossLensVisibility: false,
      promotionPathway: "NONE",
      citationEnabled: false,
      derivativeEnabled: false,
      exportEnabled: false,
      marketplaceEnabled: false,
      searchExternalEnabled: false,
      metaDerivationIncluded: false,
      consolidationIncluded: false,
    },
    gating: {
      postPermission: "declared_residents_only",
      viewPermission: "declared_residents_only_until_merge",
    },
    feedOrder: "CHRONOLOGICAL_ONLY",
    algorithmicRanking: false,
    mergeReady: {
      freezeContent: () => ({ ok: true }),
      indexForGlobal: () => ({ ok: true }),
    },
    emergentPolicy: { canView: true, canPost: false },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Lens Classification Constants", () => {
  it("defines all six lens classes", () => {
    const classes = Object.keys(LENS_CLASSIFICATION.classes);
    assert.deepStrictEqual(classes.sort(), ["CREATIVE", "CULTURE", "HYBRID", "KNOWLEDGE", "SOCIAL", "UTILITY"]);
  });

  it("KNOWLEDGE class has correct defaults", () => {
    const k = LENS_CLASSIFICATION.classes.KNOWLEDGE;
    assert.strictEqual(k.requiresArtifactLayer, false);
    assert.strictEqual(k.marketplaceEligible, true);
    assert.strictEqual(k.protectionDefault, "OPEN");
    assert.strictEqual(k.cultureLens, false);
  });

  it("CREATIVE class requires artifact layer", () => {
    const c = LENS_CLASSIFICATION.classes.CREATIVE;
    assert.strictEqual(c.requiresArtifactLayer, true);
    assert.strictEqual(c.protectionDefault, "PROTECTED");
    assert.strictEqual(c.creativeMarketplace, true);
  });

  it("CULTURE class is isolated", () => {
    const c = LENS_CLASSIFICATION.classes.CULTURE;
    assert.strictEqual(c.protectionDefault, "ISOLATED");
    assert.strictEqual(c.marketplaceEligible, false);
    assert.strictEqual(c.exportable, false);
    assert.strictEqual(c.cultureLens, true);
  });

  it("SOCIAL class is not marketplace eligible", () => {
    const s = LENS_CLASSIFICATION.classes.SOCIAL;
    assert.strictEqual(s.marketplaceEligible, false);
    assert.strictEqual(s.exportable, false);
  });
});

describe("Compliance Validator Constants", () => {
  it("has 12 validation phases", () => {
    assert.strictEqual(LENS_COMPLIANCE_VALIDATOR.phases.length, 12);
  });

  it("all phases have name, description, and checks", () => {
    for (const phase of LENS_COMPLIANCE_VALIDATOR.phases) {
      assert.ok(phase.name, `Phase missing name`);
      assert.ok(phase.description, `Phase ${phase.name} missing description`);
      assert.ok(Array.isArray(phase.checks), `Phase ${phase.name} missing checks array`);
      assert.ok(phase.checks.length > 0, `Phase ${phase.name} has no checks`);
    }
  });

  it("marketplace phase only applies to KNOWLEDGE, CREATIVE, HYBRID", () => {
    const mp = LENS_COMPLIANCE_VALIDATOR.phases.find(p => p.name === "marketplace");
    assert.deepStrictEqual(mp.appliesTo, ["KNOWLEDGE", "CREATIVE", "HYBRID"]);
  });

  it("culture_isolation phase only applies to CULTURE", () => {
    const ci = LENS_COMPLIANCE_VALIDATOR.phases.find(p => p.name === "culture_isolation");
    assert.deepStrictEqual(ci.appliesTo, ["CULTURE"]);
  });

  it("creative phase only applies to CREATIVE and HYBRID", () => {
    const cr = LENS_COMPLIANCE_VALIDATOR.phases.find(p => p.name === "creative");
    assert.deepStrictEqual(cr.appliesTo, ["CREATIVE", "HYBRID"]);
  });

  it("has all required triggers", () => {
    const t = LENS_COMPLIANCE_VALIDATOR.triggers;
    assert.strictEqual(t.onLensCreate, true);
    assert.strictEqual(t.onLensUpdate, true);
    assert.strictEqual(t.nightlyAudit, true);
    assert.strictEqual(t.onSystemUpgrade, true);
    assert.strictEqual(t.manual, true);
  });
});

describe("Compliance Constants", () => {
  it("has correct council vote requirements", () => {
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.REGIONAL_LENS_VOTES, 3);
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.NATIONAL_LENS_VOTES, 5);
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.GLOBAL_LENS_VOTES, 7);
  });

  it("has correct lens limits", () => {
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.MAX_LENSES_PER_USER, 10);
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.MAX_LENSES_PER_EMERGENT, 5);
  });

  it("has all six classes", () => {
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.CLASSES.length, 6);
  });

  it("nightly audit at 3 AM", () => {
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.NIGHTLY_AUDIT_HOUR, 3);
  });

  it("upgrade grace period is 30 days", () => {
    assert.strictEqual(LENS_COMPLIANCE_CONSTANTS.UPGRADE_GRACE_PERIOD_DAYS, 30);
  });
});

describe("Creator Gate Constants", () => {
  it("failed lens cannot go live", () => {
    assert.strictEqual(LENS_CREATOR_GATE.failedLensPolicy.canGoLive, false);
  });

  it("retries are allowed and unlimited", () => {
    assert.strictEqual(LENS_CREATOR_GATE.failedLensPolicy.retryAllowed, true);
    assert.strictEqual(LENS_CREATOR_GATE.failedLensPolicy.retryLimit, null);
  });

  it("live failure triggers immediate disable", () => {
    assert.strictEqual(LENS_CREATOR_GATE.liveFailurePolicy.action, "immediate_disable");
  });
});

describe("Pending Upgrades", () => {
  it("has four pending upgrades", () => {
    assert.strictEqual(PENDING_UPGRADES.length, 4);
  });

  it("DTU File Format upgrade applies to marketplace lenses", () => {
    const dtu = PENDING_UPGRADES.find(u => u.name === "DTU File Format Support");
    assert.deepStrictEqual(dtu.appliesTo, ["KNOWLEDGE", "CREATIVE", "HYBRID"]);
  });

  it("API Billing upgrade applies to all classes", () => {
    const api = PENDING_UPGRADES.find(u => u.name === "API Billing Compatibility");
    assert.strictEqual(api.appliesTo.length, 6);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// COMPLIANCE RUNNER TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Compliance Runner", () => {
  it("validates a well-formed KNOWLEDGE lens — all phases pass", () => {
    const lens = createKnowledgeLens();
    const result = runLensCompliance(lens, null);
    assert.strictEqual(result.lensId, "test_research");
    assert.strictEqual(result.classification, "KNOWLEDGE");
    assert.ok(result.totalChecks > 0, "Should have run checks");
    // Structure and DTU bridge should pass
    const structurePhase = result.phases.find(p => p.name === "structure");
    assert.ok(structurePhase.passed, "Structure phase should pass");
    const bridgePhase = result.phases.find(p => p.name === "dtu_bridge");
    assert.ok(bridgePhase.passed, "DTU bridge phase should pass");
  });

  it("validates a well-formed CREATIVE lens", () => {
    const lens = createCreativeLens();
    const result = runLensCompliance(lens, null);
    assert.strictEqual(result.classification, "CREATIVE");
    const creativePhase = result.phases.find(p => p.name === "creative");
    assert.ok(creativePhase, "Creative phase should exist for CREATIVE lens");
    assert.ok(creativePhase.passed, "Creative phase should pass");
  });

  it("validates a CULTURE lens with full isolation checks", () => {
    const lens = createCultureLens();
    const result = runLensCompliance(lens, null);
    assert.strictEqual(result.classification, "CULTURE");
    const culturePhase = result.phases.find(p => p.name === "culture_isolation");
    assert.ok(culturePhase, "Culture isolation phase should exist");
    assert.ok(culturePhase.passed, "Culture isolation should pass");
    // Marketplace and creative should be skipped
    const mpPhase = result.phases.find(p => p.name === "marketplace");
    assert.strictEqual(mpPhase.status, "skipped");
    const crPhase = result.phases.find(p => p.name === "creative");
    assert.strictEqual(crPhase.status, "skipped");
  });

  it("skips culture_isolation for non-CULTURE lenses", () => {
    const lens = createKnowledgeLens();
    const result = runLensCompliance(lens, null);
    const culturePhase = result.phases.find(p => p.name === "culture_isolation");
    assert.strictEqual(culturePhase.status, "skipped");
  });

  it("fails lens with missing id", () => {
    const lens = createKnowledgeLens({ id: "" });
    const result = runLensCompliance(lens, null);
    const structurePhase = result.phases.find(p => p.name === "structure");
    const idCheck = structurePhase.checks.find(c => c.name === "has_id");
    assert.strictEqual(idCheck.status, "failed");
  });

  it("fails lens with invalid classification", () => {
    const lens = createKnowledgeLens({ classification: "INVALID" });
    const result = runLensCompliance(lens, null);
    const structurePhase = result.phases.find(p => p.name === "structure");
    const classCheck = structurePhase.checks.find(c => c.name === "has_classification");
    assert.strictEqual(classCheck.status, "failed");
  });

  it("detects DTU round-trip failure", () => {
    const lens = createKnowledgeLens({
      dtuBridge: {
        render: () => null, // fails
        create: () => null, // fails
        validate: () => ({ valid: false, errors: ["broken"] }),
        layersUsed: ["human"],
      },
    });
    const result = runLensCompliance(lens, null);
    const bridgePhase = result.phases.find(p => p.name === "dtu_bridge");
    const roundtrip = bridgePhase.checks.find(c => c.name === "roundtrip_integrity");
    assert.strictEqual(roundtrip.status, "failed");
  });

  it("detects missing CDTU magic bytes", () => {
    const lens = createKnowledgeLens({
      export: {
        ...createKnowledgeLens().export,
        dtuFileEncode: () => {
          const buf = Buffer.alloc(48);
          buf.write("BAAD", 0); // wrong magic
          return buf;
        },
        dtuFileDecode: (buf) => JSON.parse(buf.slice(48).toString() || "{}"),
      },
    });
    const result = runLensCompliance(lens, null);
    const fmtPhase = result.phases.find(p => p.name === "dtu_file_format");
    const magicCheck = fmtPhase.checks.find(c => c.name === "magic_bytes_correct");
    assert.strictEqual(magicCheck.status, "failed");
  });

  it("constitutional: no coin rewards in quest triggers", () => {
    const lens = createKnowledgeLens({
      questEvents: [
        { questId: "bad_quest", reward: { coinReward: 100, xp: 50 } },
      ],
    });
    const result = runLensCompliance(lens, null);
    const questPhase = result.phases.find(p => p.name === "quests");
    const coinCheck = questPhase.checks.find(c => c.name === "no_coin_rewards_in_quest_triggers");
    assert.strictEqual(coinCheck.status, "failed");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DATABASE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Lens Registry (DB)", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("registers a new lens", () => {
    const result = registerLens(db, {
      name: "Test Lens",
      classification: "KNOWLEDGE",
      version: "1.0.0",
      protection_mode: "OPEN",
      creator_id: "user_123",
      creator_type: "user",
      federation_tiers: ["regional"],
    });
    assert.ok(result.ok);
    assert.ok(result.lensId);
    assert.strictEqual(result.status, "pending_compliance");
  });

  it("rejects invalid classification", () => {
    const result = registerLens(db, {
      name: "Bad Lens",
      classification: "INVALID",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "invalid_classification");
  });

  it("enforces user lens limit", () => {
    for (let i = 0; i < LENS_COMPLIANCE_CONSTANTS.MAX_LENSES_PER_USER; i++) {
      registerLens(db, {
        id: `lens_${i}`,
        name: `Lens ${i}`,
        classification: "KNOWLEDGE",
        creator_id: "user_limited",
        creator_type: "user",
      });
    }
    const result = registerLens(db, {
      name: "One Too Many",
      classification: "KNOWLEDGE",
      creator_id: "user_limited",
      creator_type: "user",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "lens_limit_exceeded");
  });

  it("enforces emergent lens limit", () => {
    for (let i = 0; i < LENS_COMPLIANCE_CONSTANTS.MAX_LENSES_PER_EMERGENT; i++) {
      registerLens(db, {
        id: `elens_${i}`,
        name: `E-Lens ${i}`,
        classification: "KNOWLEDGE",
        creator_id: "emergent_1",
        creator_type: "emergent",
      });
    }
    const result = registerLens(db, {
      name: "Emergent Overflow",
      classification: "KNOWLEDGE",
      creator_id: "emergent_1",
      creator_type: "emergent",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "lens_limit_exceeded");
  });

  it("retrieves lens by ID", () => {
    registerLens(db, {
      id: "findme",
      name: "Find Me",
      classification: "CREATIVE",
      protection_mode: "PROTECTED",
      creator_id: "system",
    });
    // Need to set status to active for getAllActiveLenses
    db.prepare("UPDATE lens_registry SET status = 'active' WHERE id = 'findme'").run();
    const lens = getLensById(db, "findme");
    assert.ok(lens);
    assert.strictEqual(lens.name, "Find Me");
    assert.strictEqual(lens.classification, "CREATIVE");
  });

  it("disables and enables lens", () => {
    registerLens(db, { id: "toggle", name: "Toggle", classification: "UTILITY", creator_id: "system" });
    disableLens("toggle", "test_reason", "test_audit", db);
    const disabled = getLensById(db, "toggle");
    assert.strictEqual(disabled.status, "disabled");

    enableLens("toggle", db);
    const enabled = getLensById(db, "toggle");
    assert.strictEqual(enabled.status, "active");
  });
});

describe("Compliance Runner with DB", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("stores compliance results in database", () => {
    registerLens(db, { id: "test_research", name: "Research", classification: "KNOWLEDGE", creator_id: "system" });
    const lens = createKnowledgeLens();
    const result = runLensCompliance(lens, db);
    assert.ok(result.totalChecks > 0);

    const stored = getLatestComplianceResult(db, "test_research");
    assert.ok(stored);
    assert.strictEqual(stored.lens_id, "test_research");
  });

  it("compliance history accumulates", () => {
    registerLens(db, { id: "history_lens", name: "History", classification: "KNOWLEDGE", creator_id: "system" });
    const lens = createKnowledgeLens({ id: "history_lens" });
    runLensCompliance(lens, db);
    runLensCompliance(lens, db);
    runLensCompliance(lens, db);

    const history = getComplianceHistory(db, "history_lens");
    assert.strictEqual(history.length, 3);
  });
});

describe("Nightly Audit", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("audits all active lenses", () => {
    registerLens(db, { id: "lens_a", name: "A", classification: "KNOWLEDGE", creator_id: "system" });
    registerLens(db, { id: "lens_b", name: "B", classification: "CREATIVE", creator_id: "system" });
    db.prepare("UPDATE lens_registry SET status = 'active'").run();

    const result = runNightlyAudit(db);
    assert.strictEqual(result.totalLenses, 2);
    assert.ok(result.completedAt);
  });

  it("stores audit results", () => {
    registerLens(db, { id: "audit_lens", name: "Audit", classification: "UTILITY", creator_id: "system" });
    db.prepare("UPDATE lens_registry SET status = 'active'").run();

    runNightlyAudit(db);
    const latest = getLatestAudit(db);
    assert.ok(latest);
    assert.strictEqual(latest.total_lenses, 1);
  });
});

describe("Upgrade Propagation", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("propagates upgrade to active lenses", () => {
    registerLens(db, { id: "upg_lens", name: "Upgrade", classification: "KNOWLEDGE", creator_id: "system" });
    db.prepare("UPDATE lens_registry SET status = 'active'").run();

    const result = propagateUpgrade(db, {
      name: "Test Upgrade",
      description: "Testing upgrade propagation",
      newChecks: ["has_id", "has_name"],
      appliesTo: ["KNOWLEDGE"],
    });

    assert.ok(result.ok);
    assert.strictEqual(result.totalLenses, 1);
  });

  it("retrieves upgrade status", () => {
    registerLens(db, { id: "status_lens", name: "Status", classification: "CREATIVE", creator_id: "system" });
    db.prepare("UPDATE lens_registry SET status = 'active'").run();

    const prop = propagateUpgrade(db, {
      name: "Status Check",
      description: "Testing status retrieval",
      newChecks: ["has_version"],
      appliesTo: ["CREATIVE"],
    });

    const status = getUpgradeStatus(db, prop.upgradeId);
    assert.ok(status);
    assert.strictEqual(status.name, "Status Check");
    assert.ok(Array.isArray(status.lensStatuses));
  });
});

describe("Compliance Dashboard", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("returns dashboard summary", () => {
    registerLens(db, { id: "d1", name: "D1", classification: "KNOWLEDGE", creator_id: "system" });
    registerLens(db, { id: "d2", name: "D2", classification: "CREATIVE", creator_id: "system" });
    db.prepare("UPDATE lens_registry SET status = 'active' WHERE id = 'd1'").run();

    const dashboard = getComplianceDashboard(db);
    assert.ok(dashboard.ok);
    assert.strictEqual(dashboard.lenses.total, 2);
    assert.strictEqual(dashboard.lenses.active, 1);
    assert.strictEqual(dashboard.validatorPhases, 12);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CONSTITUTIONAL INVARIANT TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Constitutional Invariants", () => {
  it("ISOLATED protection cannot be overridden", () => {
    const lens = createCultureLens({
      creatorOverride: { ISOLATED_to_anything: true },
    });
    const result = runLensCompliance(lens, null);
    const protPhase = result.phases.find(p => p.name === "protection");
    const overrideCheck = protPhase.checks.find(c => c.name === "creator_cannot_override_isolated");
    assert.strictEqual(overrideCheck.status, "failed");
  });

  it("culture lens blocks all external access", () => {
    const lens = createCultureLens({
      isolation: {
        crossLensVisibility: true, // VIOLATION
        promotionPathway: "NONE",
        citationEnabled: false,
        derivativeEnabled: false,
        exportEnabled: false,
        marketplaceEnabled: false,
        searchExternalEnabled: false,
        metaDerivationIncluded: false,
        consolidationIncluded: false,
      },
    });
    const result = runLensCompliance(lens, null);
    const culturePhase = result.phases.find(p => p.name === "culture_isolation");
    const visCheck = culturePhase.checks.find(c => c.name === "no_cross_lens_visibility");
    assert.strictEqual(visCheck.status, "failed");
  });

  it("culture feed must be chronological only", () => {
    const lens = createCultureLens({ feedOrder: "ALGORITHMIC" });
    const result = runLensCompliance(lens, null);
    const culturePhase = result.phases.find(p => p.name === "culture_isolation");
    const feedCheck = culturePhase.checks.find(c => c.name === "feed_is_chronological_only");
    assert.strictEqual(feedCheck.status, "failed");
  });
});
