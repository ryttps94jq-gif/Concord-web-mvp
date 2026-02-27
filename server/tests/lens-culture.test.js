/**
 * Lens & Culture Test Suite — v1.3
 *
 * Tests:
 *   - Lens constants (Music, Art, Video, Code, Culture)
 *   - Lens protection system (PROTECTED, OPEN, ISOLATED modes)
 *   - Culture DTU posting with regional/national gating
 *   - Emergent cannot post to culture (CONSTITUTIONAL)
 *   - Resonance and reflections
 *   - Chronological feed ordering (no algorithmic ranking)
 *   - One-tap purchase flow
 *   - Artifact export with license verification
 *   - Sovereign biomonitor (alert levels, thresholds)
 *   - Grief protocol lifecycle (activate → grief_period → transition → complete)
 *   - Great Merge (init, countdown, phase advancement, DTU freezing)
 *   - Lens DTU Bridge declarations
 *   - Lens validator checks
 *   - Lens registration and validation
 *   - Culture isolation invariants (CONSTITUTIONAL)
 *
 * Run: node --test server/tests/lens-culture.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  MUSIC_LENS, MUSIC_PROTECTION, ONE_TAP_PURCHASE, ARTIFACT_EXPORT,
  ARTISTRY_SCOPE, ARTIST_STRATEGY,
  CULTURE_LENS, CULTURE_GATING, CULTURE_HEARTBEAT, CULTURE_RESTRICTIONS,
  GREAT_MERGE, POST_MERGE_RULES,
  SOVEREIGN_BIOMONITOR, GRIEF_PROTOCOL,
  LENS_PROTECTION_SYSTEM, LENS_DTU_BRIDGE, LENS_VALIDATOR,
  SYSTEM_LENS_DECLARATIONS,
  ART_LENS, VIDEO_LENS, CODE_LENS,
  LENS_CONSTANTS,
} from "../lib/lens-culture-constants.js";

import {
  postCultureDTU, getCultureDTU, browseCulture,
  resonateCulture, reflectOnCulture, getReflections,
  setLensProtection, getLensProtection, checkProtectionAllows,
  oneTapPurchase, exportArtifact, getExportHistory,
  recordBiomonitorReading, getLatestBiomonitorReading, getBiomonitorHistory,
  initGriefProtocol, activateGriefProtocol, getGriefProtocolStatus, transitionGriefPhase,
  initGreatMerge, getGreatMergeStatus, advanceMergePhase,
  registerLens, getLens, listLenses, registerSystemLenses,
} from "../economy/lens-culture.js";

import { publishArtifact, purchaseArtifact } from "../economy/creative-marketplace.js";

// ── In-Memory SQLite Helper ─────────────────────────────────────────────

let Database;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  // skip tests if sqlite not available
}

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      declared_regional TEXT,
      declared_national TEXT
    );

    CREATE TABLE IF NOT EXISTS economy_ledger (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      from_user_id TEXT,
      to_user_id TEXT,
      amount REAL NOT NULL CHECK(amount > 0),
      fee REAL NOT NULL DEFAULT 0 CHECK(fee >= 0),
      net REAL NOT NULL CHECK(net > 0),
      status TEXT NOT NULL DEFAULT 'complete',
      ref_id TEXT,
      metadata_json TEXT DEFAULT '{}',
      request_id TEXT,
      ip TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK(from_user_id IS NOT NULL OR to_user_id IS NOT NULL)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_ref_id
      ON economy_ledger(ref_id) WHERE ref_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS fee_distributions (
      id TEXT PRIMARY KEY,
      source_tx_id TEXT NOT NULL,
      total_fee REAL NOT NULL,
      reserves_amount REAL NOT NULL,
      operating_amount REAL NOT NULL,
      payroll_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT,
      category TEXT,
      action TEXT,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      path TEXT,
      method TEXT,
      status_code INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Creative marketplace tables (needed for purchase/export tests)
    CREATE TABLE creative_artifacts (
      id TEXT PRIMARY KEY,
      dtu_id TEXT,
      creator_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      genre TEXT,
      medium TEXT,
      language TEXT,
      duration_seconds INTEGER,
      width INTEGER,
      height INTEGER,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT NOT NULL,
      preview_path TEXT,
      location_regional TEXT,
      location_national TEXT,
      federation_tier TEXT DEFAULT 'regional'
        CHECK (federation_tier IN ('local','regional','national','global')),
      license_type TEXT DEFAULT 'standard'
        CHECK (license_type IN ('standard','exclusive','custom')),
      license_json TEXT NOT NULL DEFAULT '{}',
      is_derivative INTEGER DEFAULT 0,
      lineage_depth INTEGER DEFAULT 0,
      marketplace_status TEXT DEFAULT 'draft'
        CHECK (marketplace_status IN ('draft','active','paused','rejected_duplicate','delisted')),
      price REAL,
      purchase_count INTEGER DEFAULT 0,
      derivative_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      dedup_verified INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE creative_artifact_derivatives (
      id TEXT PRIMARY KEY,
      child_artifact_id TEXT NOT NULL,
      parent_artifact_id TEXT NOT NULL,
      derivative_type TEXT NOT NULL,
      generation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (child_artifact_id) REFERENCES creative_artifacts(id),
      FOREIGN KEY (parent_artifact_id) REFERENCES creative_artifacts(id),
      UNIQUE(child_artifact_id, parent_artifact_id)
    );

    CREATE TABLE creative_usage_licenses (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      licensee_id TEXT NOT NULL,
      license_type TEXT NOT NULL,
      status TEXT DEFAULT 'active'
        CHECK (status IN ('active','revoked','expired')),
      purchase_price REAL NOT NULL,
      purchase_id TEXT,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      FOREIGN KEY (artifact_id) REFERENCES creative_artifacts(id)
    );

    CREATE TABLE creative_royalty_cascade_ledger (
      id TEXT PRIMARY KEY,
      triggering_purchase_id TEXT NOT NULL,
      triggering_artifact_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      recipient_artifact_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Lens & culture tables (from migration 015)
    CREATE TABLE culture_dtus (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      culture_tier TEXT NOT NULL
        CHECK (culture_tier IN ('regional', 'national')),
      regional TEXT NOT NULL,
      national TEXT NOT NULL,
      content_type TEXT NOT NULL
        CHECK (content_type IN ('text','image','audio','video','mixed')),
      title TEXT,
      body TEXT,
      media_json TEXT DEFAULT '[]',
      tags_json TEXT DEFAULT '[]',
      mood TEXT,
      resonance_count INTEGER DEFAULT 0,
      reflection_count INTEGER DEFAULT 0,
      merge_included INTEGER DEFAULT 0,
      merged_at TEXT,
      global_culture_id TEXT,
      frozen INTEGER DEFAULT 0,
      frozen_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE culture_reflections (
      id TEXT PRIMARY KEY,
      culture_dtu_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      body TEXT NOT NULL,
      media_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (culture_dtu_id) REFERENCES culture_dtus(id)
    );

    CREATE TABLE culture_resonance (
      culture_dtu_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (culture_dtu_id, user_id),
      FOREIGN KEY (culture_dtu_id) REFERENCES culture_dtus(id)
    );

    CREATE TABLE great_merge (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      launch_date TEXT NOT NULL,
      merge_date TEXT NOT NULL,
      status TEXT DEFAULT 'countdown'
        CHECK (status IN ('countdown', 'merging', 'complete')),
      phase TEXT DEFAULT 'pre_merge'
        CHECK (phase IN ('pre_merge', 'unveiling', 'weaving', 'understanding', 'complete')),
      phase_started_at TEXT,
      completed_at TEXT,
      total_regional_cultures INTEGER DEFAULT 0,
      total_national_cultures INTEGER DEFAULT 0,
      total_culture_dtus INTEGER DEFAULT 0
    );

    CREATE TABLE sovereign_biomonitor (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      alert_level TEXT NOT NULL DEFAULT 'green'
        CHECK (alert_level IN ('green', 'yellow', 'orange', 'red')),
      heart_rate REAL,
      blood_oxygen REAL,
      body_temperature REAL,
      movement_detected INTEGER,
      raw_data_json TEXT,
      notes TEXT
    );

    CREATE TABLE grief_protocol (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      status TEXT DEFAULT 'inactive'
        CHECK (status IN ('inactive', 'activated', 'grief_period', 'transition', 'complete')),
      activated_at TEXT,
      activated_by TEXT,
      grief_period_end TEXT,
      transition_end TEXT,
      completed_at TEXT,
      steward_declarations_json TEXT DEFAULT '[]'
    );

    CREATE TABLE lens_protection (
      artifact_id TEXT NOT NULL,
      lens_id TEXT NOT NULL,
      protection_mode TEXT NOT NULL
        CHECK (protection_mode IN ('PROTECTED', 'OPEN', 'ISOLATED')),
      creator_override INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (artifact_id, lens_id)
    );

    CREATE TABLE artifact_exports (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      exported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE lens_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      protection_mode TEXT NOT NULL DEFAULT 'PROTECTED'
        CHECK (protection_mode IN ('PROTECTED', 'OPEN', 'ISOLATED')),
      layers_used_json TEXT NOT NULL DEFAULT '["human","core"]',
      supported_artifact_types_json TEXT NOT NULL DEFAULT '[]',
      publishable_scopes_json TEXT NOT NULL DEFAULT '[]',
      federation_tiers_json TEXT NOT NULL DEFAULT '[]',
      bridge_validated INTEGER DEFAULT 0,
      validation_errors_json TEXT DEFAULT '[]',
      is_system INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function seedUsers(db) {
  db.prepare(`INSERT INTO users (id, username, email, declared_regional, declared_national) VALUES (?, ?, ?, ?, ?)`)
    .run("user1", "lagos_resident", "u1@lagos.ng", "lagos", "nigeria");
  db.prepare(`INSERT INTO users (id, username, email, declared_regional, declared_national) VALUES (?, ?, ?, ?, ?)`)
    .run("user2", "nairobi_resident", "u2@nairobi.ke", "nairobi", "kenya");
  db.prepare(`INSERT INTO users (id, username, email, declared_regional, declared_national) VALUES (?, ?, ?, ?, ?)`)
    .run("user3", "lagos_neighbor", "u3@lagos.ng", "lagos", "nigeria");
  db.prepare(`INSERT INTO users (id, username, email, role, declared_regional, declared_national) VALUES (?, ?, ?, ?, ?, ?)`)
    .run("emergent1", "atlas_entity", "atlas@concord.ai", "emergent", "lagos", "nigeria");
  db.prepare(`INSERT INTO users (id, username, email, declared_regional, declared_national) VALUES (?, ?, ?, ?, ?)`)
    .run("buyer1", "buyer_one", "buyer1@test.com", "lagos", "nigeria");

  // Seed buyer balance
  db.prepare(`INSERT INTO economy_ledger (id, type, from_user_id, to_user_id, amount, fee, net, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("seed_b1", "MINT", null, "buyer1", 10000, 0, 10000, "complete");
}

function publishTestBeat(db) {
  return publishArtifact(db, {
    creatorId: "user1",
    type: "beat",
    title: "Lagos Sunset Beat",
    description: "An Afrobeats instrumental with heavy percussion and synth melodies. Perfect for rap or vocals.",
    filePath: "/uploads/beat_001.wav",
    fileSize: 50 * 1024 * 1024,
    fileHash: "abc123hash456",
    price: 50,
    creative: { genre: "afrobeats", tags: ["afrobeats"] },
    license: { type: "standard" },
  });
}

// ═════════════════════════════════════════════════════════════════════════
// CONSTANTS TESTS
// ═════════════════════════════════════════════════════════════════════════

describe("Lens Constants", () => {
  it("MUSIC_LENS has correct content modes", () => {
    assert.ok(MUSIC_LENS.contentModes.full_song);
    assert.ok(MUSIC_LENS.contentModes.preview);
    assert.ok(MUSIC_LENS.contentModes.purchased);
    assert.equal(MUSIC_LENS.contentModes.full_song.protection, "FULL");
    assert.equal(MUSIC_LENS.contentModes.purchased.protection, "LICENSED");
    assert.equal(MUSIC_LENS.contentModes.purchased.exportable, true);
  });

  it("MUSIC_LENS playback allows streaming but not download", () => {
    assert.equal(MUSIC_LENS.playback.inLensStreaming, true);
    assert.equal(MUSIC_LENS.playback.download, false);
  });

  it("MUSIC_PROTECTION blocks citation, derivative, export without purchase", () => {
    assert.ok(MUSIC_PROTECTION.protectedActions.includes("citation"));
    assert.ok(MUSIC_PROTECTION.protectedActions.includes("derivative_creation"));
    assert.ok(MUSIC_PROTECTION.protectedActions.includes("export"));
    assert.equal(MUSIC_PROTECTION.unlockTrigger, "marketplace_purchase");
  });

  it("ART_LENS defaults to PROTECTED", () => {
    assert.equal(ART_LENS.contentModes.full.protection, "FULL");
    assert.equal(ART_LENS.contentModes.preview.previewType, "low_resolution");
    assert.equal(ART_LENS.oneTapPurchase, true);
  });

  it("CODE_LENS defaults to OPEN (code culture is sharing)", () => {
    assert.equal(CODE_LENS.contentModes.full.protection, "OPEN");
    assert.equal(CODE_LENS.contentModes.full.citable, true);
  });

  it("CULTURE_LENS isolation is ABSOLUTE", () => {
    assert.equal(CULTURE_LENS.corePrinciples.isolation, "ABSOLUTE");
    assert.equal(CULTURE_LENS.corePrinciples.promotionPathway, "NONE");
    assert.equal(CULTURE_LENS.corePrinciples.crossTierInfluence, "FORBIDDEN");
    assert.ok(CULTURE_LENS.corePrinciples.neverInfluences.includes("entity_training"));
  });

  it("CULTURE_GATING locks global until Great Merge", () => {
    assert.equal(CULTURE_GATING.global.status, "LOCKED");
    assert.equal(CULTURE_GATING.global.unlocksAt, "GREAT_MERGE_DATE");
    assert.equal(CULTURE_GATING.regional.crossRegionalPosting, "FORBIDDEN");
  });

  it("CULTURE_HEARTBEAT is chronological ONLY", () => {
    assert.equal(CULTURE_HEARTBEAT.feedAlgorithm, "CHRONOLOGICAL_ONLY");
    assert.equal(CULTURE_HEARTBEAT.engagementInfluenceOnDisplay, "ZERO");
    assert.equal(CULTURE_HEARTBEAT.tickActions.autogenerate, false);
    assert.equal(CULTURE_HEARTBEAT.tickActions.consolidate, false);
  });

  it("CULTURE_RESTRICTIONS blocks all cross-system influence", () => {
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("influence_knowledge_substrate"));
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("appear_on_marketplace"));
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("be_promoted_to_any_tier"));
    assert.equal(CULTURE_RESTRICTIONS.emergentPolicy.canPost, false);
    assert.equal(CULTURE_RESTRICTIONS.emergentPolicy.canLearnFrom, false);
  });

  it("GREAT_MERGE has 5-year countdown and 3 phases", () => {
    assert.equal(GREAT_MERGE.countdown.duration.years, 5);
    assert.ok(GREAT_MERGE.mergeProcess.phase1);
    assert.ok(GREAT_MERGE.mergeProcess.phase2);
    assert.ok(GREAT_MERGE.mergeProcess.phase3);
    assert.equal(GREAT_MERGE.mergeProcess.phase1.name, "The Unveiling");
    assert.equal(GREAT_MERGE.mergeProcess.phase3.emergentPosting, "FORBIDDEN_FOREVER");
  });

  it("POST_MERGE_RULES keeps culture isolated FOREVER", () => {
    assert.equal(POST_MERGE_RULES.isolation.knowledgeInfluence, "FORBIDDEN_FOREVER");
    assert.equal(POST_MERGE_RULES.isolation.classification, "PROTECTED_HUMAN_MEMORY");
  });

  it("SOVEREIGN_BIOMONITOR has correct thresholds", () => {
    assert.equal(SOVEREIGN_BIOMONITOR.inputs.heartRate.critical_low, 30);
    assert.equal(SOVEREIGN_BIOMONITOR.inputs.heartRate.critical_high, 200);
    assert.equal(SOVEREIGN_BIOMONITOR.inputs.bloodOxygen.critical_low, 85);
    assert.equal(SOVEREIGN_BIOMONITOR.alertLevels.red.concordAction, "activate_grief_protocol");
  });

  it("GRIEF_PROTOCOL is IMMUTABLE tier", () => {
    assert.equal(GRIEF_PROTOCOL.tier, "IMMUTABLE");
    assert.equal(GRIEF_PROTOCOL.sovereignLastDTU.authority, 1.0);
    assert.equal(GRIEF_PROTOCOL.sovereignLastDTU.forgettable, false);
    assert.equal(GRIEF_PROTOCOL.postGrief.succession.newSovereign, "NONE");
    assert.equal(GRIEF_PROTOCOL.postGrief.succession.governanceModel, "steward_council_collective");
  });

  it("LENS_PROTECTION_SYSTEM has 3 modes with correct properties", () => {
    assert.equal(LENS_PROTECTION_SYSTEM.modes.PROTECTED.citation, false);
    assert.equal(LENS_PROTECTION_SYSTEM.modes.OPEN.citation, true);
    assert.equal(LENS_PROTECTION_SYSTEM.modes.ISOLATED.citation, false);
    assert.equal(LENS_PROTECTION_SYSTEM.modes.ISOLATED.purchaseUnlocks, false);
    assert.equal(LENS_PROTECTION_SYSTEM.lensDefaults.music, "PROTECTED");
    assert.equal(LENS_PROTECTION_SYSTEM.lensDefaults.code, "OPEN");
    assert.equal(LENS_PROTECTION_SYSTEM.lensDefaults.culture, "ISOLATED");
    assert.equal(LENS_PROTECTION_SYSTEM.lensDefaults.creatorOverride.ISOLATED_to_anything, false);
  });

  it("ARTISTRY_SCOPE has open policies for citation and derivative", () => {
    assert.equal(ARTISTRY_SCOPE.citationPolicy, "open_without_purchase");
    assert.equal(ARTISTRY_SCOPE.derivativePolicy, "open_with_cascade");
    assert.equal(ARTISTRY_SCOPE.exportPolicy, "purchase_required");
  });

  it("ARTIFACT_EXPORT has no DRM and no limits", () => {
    assert.ok(ARTIFACT_EXPORT.definition.includes("No DRM"));
    assert.equal(ARTIFACT_EXPORT.redownloadable, true);
    assert.equal(ARTIFACT_EXPORT.exportLimit, null);
  });

  it("ONE_TAP_PURCHASE does not interrupt playback", () => {
    assert.equal(ONE_TAP_PURCHASE.ui.interruptPlayback, false);
    assert.equal(ONE_TAP_PURCHASE.ui.confirmationStyle, "inline_badge");
  });

  it("LENS_CONSTANTS has correct values", () => {
    assert.equal(LENS_CONSTANTS.PREVIEW_MIN_SECONDS, 15);
    assert.equal(LENS_CONSTANTS.PREVIEW_MAX_SECONDS, 60);
    assert.equal(LENS_CONSTANTS.GREAT_MERGE_COUNTDOWN_YEARS, 5);
    assert.equal(LENS_CONSTANTS.GRIEF_MIN_DAYS, 30);
    assert.equal(LENS_CONSTANTS.GRIEF_MAX_DAYS, 180);
    assert.equal(LENS_CONSTANTS.GRIEF_HEARTBEAT_MULTIPLIER, 0.25);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// DTU BRIDGE & VALIDATOR CONSTANTS
// ═════════════════════════════════════════════════════════════════════════

describe("DTU Bridge & Validator", () => {
  it("LENS_DTU_BRIDGE declares required methods", () => {
    assert.ok(LENS_DTU_BRIDGE.required.render);
    assert.ok(LENS_DTU_BRIDGE.required.create);
    assert.ok(LENS_DTU_BRIDGE.required.protectionMode);
    assert.ok(LENS_DTU_BRIDGE.required.export);
    assert.ok(LENS_DTU_BRIDGE.required.purchase);
  });

  it("LENS_DTU_BRIDGE declares 4 DTU layers", () => {
    assert.ok(LENS_DTU_BRIDGE.layerDefinitions.human);
    assert.ok(LENS_DTU_BRIDGE.layerDefinitions.core);
    assert.ok(LENS_DTU_BRIDGE.layerDefinitions.machine);
    assert.ok(LENS_DTU_BRIDGE.layerDefinitions.artifact);
  });

  it("LENS_VALIDATOR has 9 checks, all required", () => {
    assert.equal(LENS_VALIDATOR.checks.length, 9);
    for (const check of LENS_VALIDATOR.checks) {
      assert.equal(check.required, true);
      assert.ok(check.name);
      assert.ok(check.description);
    }
  });

  it("SYSTEM_LENS_DECLARATIONS covers 6 built-in lenses", () => {
    const lenses = Object.keys(SYSTEM_LENS_DECLARATIONS);
    assert.equal(lenses.length, 6);
    assert.ok(lenses.includes("music"));
    assert.ok(lenses.includes("art"));
    assert.ok(lenses.includes("video"));
    assert.ok(lenses.includes("code"));
    assert.ok(lenses.includes("research"));
    assert.ok(lenses.includes("culture"));
  });

  it("music lens uses human, core, artifact layers", () => {
    const music = SYSTEM_LENS_DECLARATIONS.music;
    assert.deepEqual(music.layersUsed, ["human", "core", "artifact"]);
    assert.equal(music.protectionMode, "PROTECTED");
  });

  it("code lens uses human, core, machine, artifact layers", () => {
    const code = SYSTEM_LENS_DECLARATIONS.code;
    assert.deepEqual(code.layersUsed, ["human", "core", "machine", "artifact"]);
    assert.equal(code.protectionMode, "OPEN");
  });

  it("culture lens uses ONLY human layer", () => {
    const culture = SYSTEM_LENS_DECLARATIONS.culture;
    assert.deepEqual(culture.layersUsed, ["human"]);
    assert.equal(culture.protectionMode, "ISOLATED");
    assert.deepEqual(culture.publishableScopes, ["regional", "national"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// CULTURE DTU TESTS
// ═════════════════════════════════════════════════════════════════════════

describe("Culture DTU Posting", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("posts a regional culture DTU", () => {
    const result = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "regional",
      contentType: "text",
      title: "Lagos Morning Market",
      body: "The smell of suya at 6am. The vendors calling. The colors.",
      tags: ["morning", "market", "lagos"],
      mood: "nostalgic",
    });
    assert.equal(result.ok, true);
    assert.ok(result.cultureDTU.id.startsWith("cd_"));
    assert.equal(result.cultureDTU.cultureTier, "regional");
    assert.equal(result.cultureDTU.regional, "lagos");
    assert.equal(result.cultureDTU.national, "nigeria");
    assert.equal(result.cultureDTU.resonanceCount, 0);
  });

  it("posts a national culture DTU", () => {
    const result = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "national",
      contentType: "mixed",
      body: "Nigeria celebrates independence day",
      media: [{ type: "image", path: "/culture/independence.jpg", size: 5000000 }],
    });
    assert.equal(result.ok, true);
    assert.equal(result.cultureDTU.cultureTier, "national");
    assert.equal(result.cultureDTU.national, "nigeria");
  });

  it("rejects emergent posting to culture — CONSTITUTIONAL", () => {
    const result = postCultureDTU(db, {
      creatorId: "emergent1",
      cultureTier: "regional",
      contentType: "text",
      body: "I want to post culture",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "emergent_cannot_post_culture");
  });

  it("rejects posting without declared location", () => {
    db.prepare(`INSERT INTO users (id, username, email) VALUES (?, ?, ?)`)
      .run("noplace", "nomad", "nomad@test.com");
    const result = postCultureDTU(db, {
      creatorId: "noplace",
      cultureTier: "regional",
      contentType: "text",
      body: "Where am I?",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_declared_location");
  });

  it("rejects empty content", () => {
    const result = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "regional",
      contentType: "text",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "empty_content");
  });

  it("rejects invalid culture tier", () => {
    const result = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "global",
      contentType: "text",
      body: "Not yet",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_culture_tier");
  });

  it("rejects too many media attachments", () => {
    const media = Array.from({ length: 11 }, (_, i) => ({ type: "image", path: `/img${i}.jpg`, size: 1000 }));
    const result = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "regional",
      contentType: "mixed",
      body: "too many",
      media,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "too_many_media");
  });

  it("retrieves a posted culture DTU", () => {
    const posted = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "regional",
      contentType: "text",
      body: "Test post",
    });
    const dtu = getCultureDTU(db, posted.cultureDTU.id);
    assert.equal(dtu.id, posted.cultureDTU.id);
    assert.equal(dtu.body, "Test post");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// CULTURE GATING TESTS
// ═════════════════════════════════════════════════════════════════════════

describe("Culture Gating", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("blocks viewing of regional culture by non-residents (pre-merge)", () => {
    const posted = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "regional",
      contentType: "text",
      body: "Lagos only",
    });
    // user2 is in nairobi, should be blocked
    const view = getCultureDTU(db, posted.cultureDTU.id, { viewerId: "user2" });
    assert.equal(view.restricted, true);
    assert.equal(view.error, "not_your_region");
  });

  it("allows viewing by same-region resident", () => {
    const posted = postCultureDTU(db, {
      creatorId: "user1",
      cultureTier: "regional",
      contentType: "text",
      body: "Lagos vibes",
    });
    // user3 is also in lagos
    const view = getCultureDTU(db, posted.cultureDTU.id, { viewerId: "user3" });
    assert.ok(!view.restricted);
    assert.equal(view.body, "Lagos vibes");
  });

  it("browsing enforces regional gating (pre-merge)", () => {
    postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Lagos post" });
    const result = browseCulture(db, { cultureTier: "regional", regional: "lagos", viewerId: "user2" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "not_your_region");
  });

  it("browsing allows same-region residents", () => {
    postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Lagos post 1" });
    postCultureDTU(db, { creatorId: "user3", cultureTier: "regional", contentType: "text", body: "Lagos post 2" });
    const result = browseCulture(db, { cultureTier: "regional", regional: "lagos", viewerId: "user1" });
    assert.equal(result.ok, true);
    assert.equal(result.cultureDTUs.length, 2);
  });

  it("browse returns chronological order (newest first by default)", () => {
    const first = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "First" });
    // Manually set earlier timestamp so ordering is deterministic
    db.prepare("UPDATE culture_dtus SET created_at = '2025-01-01 00:00:00' WHERE id = ?").run(first.cultureDTU.id);
    postCultureDTU(db, { creatorId: "user3", cultureTier: "regional", contentType: "text", body: "Second" });
    const result = browseCulture(db, { cultureTier: "regional", regional: "lagos", viewerId: "user1", sort: "newest" });
    assert.equal(result.ok, true);
    assert.equal(result.cultureDTUs[0].body, "Second");
    assert.equal(result.cultureDTUs[1].body, "First");
  });

  it("browse supports oldest-first ordering", () => {
    const first = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "First" });
    db.prepare("UPDATE culture_dtus SET created_at = '2025-01-01 00:00:00' WHERE id = ?").run(first.cultureDTU.id);
    postCultureDTU(db, { creatorId: "user3", cultureTier: "regional", contentType: "text", body: "Second" });
    const result = browseCulture(db, { cultureTier: "regional", regional: "lagos", viewerId: "user1", sort: "oldest" });
    assert.equal(result.ok, true);
    assert.equal(result.cultureDTUs[0].body, "First");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// RESONANCE & REFLECTIONS
// ═════════════════════════════════════════════════════════════════════════

describe("Resonance & Reflections", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("allows same-region resident to resonate", () => {
    const posted = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Beautiful day" });
    const result = resonateCulture(db, { userId: "user3", dtuId: posted.cultureDTU.id });
    assert.equal(result.ok, true);
    assert.equal(result.resonanceCount, 1);
  });

  it("blocks resonance from non-resident", () => {
    const posted = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Lagos only" });
    const result = resonateCulture(db, { userId: "user2", dtuId: posted.cultureDTU.id });
    assert.equal(result.ok, false);
    assert.equal(result.error, "not_your_region");
  });

  it("prevents double resonance", () => {
    const posted = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Once only" });
    resonateCulture(db, { userId: "user3", dtuId: posted.cultureDTU.id });
    const result = resonateCulture(db, { userId: "user3", dtuId: posted.cultureDTU.id });
    assert.equal(result.ok, false);
    assert.equal(result.error, "already_resonated");
  });

  it("allows reflections from same-region residents", () => {
    const posted = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Discuss this" });
    const result = reflectOnCulture(db, {
      userId: "user3",
      dtuId: posted.cultureDTU.id,
      body: "This resonates deeply",
    });
    assert.equal(result.ok, true);
    assert.ok(result.reflection.id.startsWith("cr_"));
    assert.equal(result.reflectionCount, 1);
  });

  it("retrieves reflections for a DTU", () => {
    const posted = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Reflect" });
    reflectOnCulture(db, { userId: "user3", dtuId: posted.cultureDTU.id, body: "Reflection 1" });
    reflectOnCulture(db, { userId: "user1", dtuId: posted.cultureDTU.id, body: "Reflection 2" });
    const result = getReflections(db, posted.cultureDTU.id);
    assert.equal(result.ok, true);
    assert.equal(result.reflections.length, 2);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LENS PROTECTION
// ═════════════════════════════════════════════════════════════════════════

describe("Lens Protection System", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("sets protection mode for an artifact in a lens", () => {
    const result = setLensProtection(db, {
      artifactId: "art1", lensId: "music", protectionMode: "PROTECTED",
    });
    assert.equal(result.ok, true);
    assert.equal(result.protectionMode, "PROTECTED");
  });

  it("gets protection mode — falls back to lens default", () => {
    const protection = getLensProtection(db, "unknown_art", "music");
    assert.equal(protection.protectionMode, "PROTECTED");
    assert.equal(protection.isOverride, false);
  });

  it("allows creator to override PROTECTED to OPEN", () => {
    const result = setLensProtection(db, {
      artifactId: "art1", lensId: "music", protectionMode: "OPEN", creatorId: "user1",
    });
    assert.equal(result.ok, true);
    assert.equal(result.isOverride, true);
  });

  it("rejects overriding culture lens — ISOLATED forever", () => {
    const result = setLensProtection(db, {
      artifactId: "art1", lensId: "culture", protectionMode: "OPEN",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "culture_lens_isolated_forever");
  });

  it("checkProtectionAllows blocks citation on PROTECTED without purchase", () => {
    setLensProtection(db, { artifactId: "art1", lensId: "music", protectionMode: "PROTECTED" });
    const result = checkProtectionAllows(db, {
      artifactId: "art1", lensId: "music", action: "citation",
    });
    assert.equal(result.allowed, false);
  });

  it("checkProtectionAllows allows citation on OPEN lens", () => {
    setLensProtection(db, { artifactId: "art1", lensId: "code", protectionMode: "OPEN" });
    const result = checkProtectionAllows(db, {
      artifactId: "art1", lensId: "code", action: "citation",
    });
    assert.equal(result.allowed, true);
  });

  it("checkProtectionAllows allows export with active license", () => {
    const published = publishTestBeat(db);
    const artifactId = published.artifact.id;
    purchaseArtifact(db, { buyerId: "buyer1", artifactId });
    setLensProtection(db, { artifactId, lensId: "music", protectionMode: "PROTECTED" });

    const result = checkProtectionAllows(db, {
      artifactId, lensId: "music", action: "export", userId: "buyer1",
    });
    assert.equal(result.allowed, true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// ARTIFACT EXPORT
// ═════════════════════════════════════════════════════════════════════════

describe("Artifact Export", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("exports artifact with active license", () => {
    const published = publishTestBeat(db);
    const artifactId = published.artifact.id;
    purchaseArtifact(db, { buyerId: "buyer1", artifactId });

    const result = exportArtifact(db, { userId: "buyer1", artifactId });
    assert.equal(result.ok, true);
    assert.ok(result.exportId.startsWith("exp_"));
    assert.equal(result.artifactType, "beat");
  });

  it("rejects export without license", () => {
    const published = publishTestBeat(db);
    const result = exportArtifact(db, { userId: "buyer1", artifactId: published.artifact.id });
    assert.equal(result.ok, false);
    assert.equal(result.error, "no_active_license");
  });

  it("tracks export history", () => {
    const published = publishTestBeat(db);
    const artifactId = published.artifact.id;
    purchaseArtifact(db, { buyerId: "buyer1", artifactId });
    exportArtifact(db, { userId: "buyer1", artifactId });
    exportArtifact(db, { userId: "buyer1", artifactId });

    const history = getExportHistory(db, { userId: "buyer1" });
    assert.equal(history.ok, true);
    assert.equal(history.exports.length, 2);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// SOVEREIGN BIOMONITOR
// ═════════════════════════════════════════════════════════════════════════

describe("Sovereign Biomonitor", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("records green reading for normal vitals", () => {
    const result = recordBiomonitorReading(db, {
      heartRate: 72, bloodOxygen: 98, bodyTemperature: 98.6, movementDetected: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.reading.alertLevel, "green");
    assert.equal(result.stewardNotification, false);
  });

  it("records red reading for critical vitals", () => {
    const result = recordBiomonitorReading(db, {
      heartRate: 25, bloodOxygen: 80, bodyTemperature: 92,
    });
    assert.equal(result.ok, true);
    assert.equal(result.reading.alertLevel, "red");
    assert.equal(result.stewardNotification, true);
    assert.equal(result.concordAction, "activate_grief_protocol");
  });

  it("records yellow for approaching-critical vitals", () => {
    const result = recordBiomonitorReading(db, {
      heartRate: 45, bloodOxygen: 95, bodyTemperature: 98.6,
    });
    assert.equal(result.ok, true);
    assert.ok(["yellow", "orange"].includes(result.reading.alertLevel));
  });

  it("retrieves latest reading", () => {
    recordBiomonitorReading(db, { heartRate: 72, bloodOxygen: 98, bodyTemperature: 98.6 });
    const latest = getLatestBiomonitorReading(db);
    assert.ok(latest);
    assert.equal(latest.heartRate, 72);
    assert.equal(latest.alertLevel, "green");
  });

  it("gets history filtered by alert level", () => {
    recordBiomonitorReading(db, { heartRate: 72, bloodOxygen: 98, bodyTemperature: 98.6 });
    recordBiomonitorReading(db, { heartRate: 25, bloodOxygen: 80 });
    const history = getBiomonitorHistory(db, { alertLevel: "red" });
    assert.equal(history.ok, true);
    assert.ok(history.readings.length >= 1);
    for (const r of history.readings) {
      assert.equal(r.alertLevel, "red");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// GRIEF PROTOCOL
// ═════════════════════════════════════════════════════════════════════════

describe("Grief Protocol", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("initializes grief protocol as inactive", () => {
    const result = initGriefProtocol(db);
    assert.equal(result.ok, true);
    assert.equal(result.status, "inactive");
  });

  it("activates grief protocol via biomonitor_red", () => {
    initGriefProtocol(db);
    const result = activateGriefProtocol(db, { activatedBy: "biomonitor_red" });
    assert.equal(result.ok, true);
    assert.equal(result.status, "activated");
    assert.ok(result.griefPeriodEnd);
    assert.ok(result.systemBehavior.heartbeatMultiplier === 0.25);
    assert.ok(result.sovereignLastDTU.authority === 1.0);
  });

  it("activates via steward_council_unanimous", () => {
    initGriefProtocol(db);
    const result = activateGriefProtocol(db, { activatedBy: "steward_council_unanimous" });
    assert.equal(result.ok, true);
    assert.equal(result.status, "activated");
  });

  it("rejects invalid activation trigger", () => {
    initGriefProtocol(db);
    const result = activateGriefProtocol(db, { activatedBy: "random_trigger" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_activation_trigger");
  });

  it("rejects double activation", () => {
    initGriefProtocol(db);
    activateGriefProtocol(db, { activatedBy: "biomonitor_red" });
    const result = activateGriefProtocol(db, { activatedBy: "biomonitor_red" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "grief_already_active");
  });

  it("gets grief protocol status", () => {
    initGriefProtocol(db);
    activateGriefProtocol(db, { activatedBy: "biomonitor_red" });
    const status = getGriefProtocolStatus(db);
    assert.equal(status.ok, true);
    assert.equal(status.status, "activated");
    assert.equal(status.activatedBy, "biomonitor_red");
  });

  it("transitions through full lifecycle", () => {
    initGriefProtocol(db);
    activateGriefProtocol(db, { activatedBy: "steward_council_unanimous" });

    const t1 = transitionGriefPhase(db, { targetPhase: "grief_period" });
    assert.equal(t1.ok, true);
    assert.equal(t1.status, "grief_period");

    const t2 = transitionGriefPhase(db, { targetPhase: "transition" });
    assert.equal(t2.ok, true);
    assert.equal(t2.status, "transition");
    assert.ok(t2.transitionEnd);

    const t3 = transitionGriefPhase(db, { targetPhase: "complete" });
    assert.equal(t3.ok, true);
    assert.equal(t3.status, "complete");
    assert.ok(t3.completedAt);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// GREAT MERGE
// ═════════════════════════════════════════════════════════════════════════

describe("Great Merge", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("initializes the Great Merge with 5-year countdown", () => {
    const result = initGreatMerge(db, { launchDate: "2026-01-01 00:00:00" });
    assert.equal(result.ok, true);
    assert.ok(result.mergeDate.startsWith("2031"));
    assert.equal(result.status, "countdown");
  });

  it("gets merge status with countdown", () => {
    initGreatMerge(db, { launchDate: "2026-01-01 00:00:00" });
    const status = getGreatMergeStatus(db);
    assert.equal(status.ok, true);
    assert.equal(status.status, "countdown");
    assert.equal(status.phase, "pre_merge");
    assert.ok(status.countdown.days > 0);
    assert.ok(status.countdown.remainingMs > 0);
  });

  it("advances to The Unveiling — freezes and includes all culture DTUs", () => {
    initGreatMerge(db, { launchDate: "2021-01-01 00:00:00" });
    // Post some culture
    postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Pre-merge memory" });
    postCultureDTU(db, { creatorId: "user1", cultureTier: "national", contentType: "text", body: "National memory" });

    const result = advanceMergePhase(db, { targetPhase: "unveiling" });
    assert.equal(result.ok, true);
    assert.equal(result.phase, "unveiling");
    assert.equal(result.stats.totalCultureDTUs, 2);

    // Verify DTUs are frozen and merge-included
    const dtu = db.prepare("SELECT * FROM culture_dtus LIMIT 1").get();
    assert.equal(dtu.frozen, 1);
    assert.equal(dtu.merge_included, 1);
  });

  it("advances through all phases to complete", () => {
    initGreatMerge(db, { launchDate: "2021-01-01 00:00:00" });
    postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Memory" });

    advanceMergePhase(db, { targetPhase: "unveiling" });
    advanceMergePhase(db, { targetPhase: "weaving" });
    advanceMergePhase(db, { targetPhase: "understanding" });
    const result = advanceMergePhase(db, { targetPhase: "complete" });

    assert.equal(result.ok, true);
    assert.equal(result.phase, "complete");

    const status = getGreatMergeStatus(db);
    assert.equal(status.status, "complete");
  });

  it("after merge, cross-region viewing is allowed", () => {
    initGreatMerge(db, { launchDate: "2021-01-01 00:00:00" });
    const posted = postCultureDTU(db, { creatorId: "user1", cultureTier: "regional", contentType: "text", body: "Lagos memory" });
    advanceMergePhase(db, { targetPhase: "unveiling" });

    // user2 (nairobi) can now view lagos culture
    const view = getCultureDTU(db, posted.cultureDTU.id, { viewerId: "user2" });
    assert.ok(!view.restricted);
    assert.equal(view.body, "Lagos memory");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// LENS REGISTRATION & VALIDATION
// ═════════════════════════════════════════════════════════════════════════

describe("Lens Registration", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); seedUsers(db); });

  it("registers a custom lens with valid declarations", () => {
    const result = registerLens(db, {
      name: "photography",
      icon: "camera",
      protectionMode: "PROTECTED",
      layersUsed: ["human", "core", "artifact"],
      supportedArtifactTypes: ["photograph", "photo_series"],
      publishableScopes: ["regional", "national"],
      federationTiers: ["regional", "national"],
      createdBy: "user1",
    });
    assert.equal(result.ok, true);
    assert.ok(result.lens.id.startsWith("lens_"));
    assert.equal(result.lens.name, "photography");
    assert.equal(result.lens.bridgeValidated, true);
    assert.equal(result.lens.validationErrors.length, 0);
  });

  it("rejects duplicate lens names", () => {
    registerLens(db, { name: "test_lens", protectionMode: "OPEN", layersUsed: ["human"], supportedArtifactTypes: [], publishableScopes: [], federationTiers: [] });
    const result = registerLens(db, { name: "test_lens", protectionMode: "OPEN", layersUsed: ["human"], supportedArtifactTypes: [], publishableScopes: [], federationTiers: [] });
    assert.equal(result.ok, false);
    assert.equal(result.error, "lens_name_exists");
  });

  it("rejects invalid protection mode", () => {
    const result = registerLens(db, { name: "bad", protectionMode: "INVALID", layersUsed: ["human"] });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_protection_mode");
  });

  it("rejects invalid layer names", () => {
    const result = registerLens(db, { name: "bad2", protectionMode: "OPEN", layersUsed: ["quantum"] });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_layer");
  });

  it("registers all system lenses", () => {
    const result = registerSystemLenses(db);
    assert.equal(result.ok, true);
    assert.equal(result.results.length, 6);
    for (const r of result.results) {
      assert.equal(r.status, "registered");
    }
  });

  it("system lenses are marked as isSystem", () => {
    registerSystemLenses(db);
    const music = getLens(db, "music");
    assert.ok(music);
    assert.equal(music.isSystem, true);
    assert.equal(music.protectionMode, "PROTECTED");
  });

  it("lists all registered lenses", () => {
    registerSystemLenses(db);
    registerLens(db, { name: "custom1", protectionMode: "OPEN", layersUsed: ["human"], supportedArtifactTypes: [], publishableScopes: [], federationTiers: [], createdBy: "user1" });
    const result = listLenses(db);
    assert.equal(result.ok, true);
    assert.equal(result.lenses.length, 7); // 6 system + 1 custom
  });

  it("filters lenses by system vs user-created", () => {
    registerSystemLenses(db);
    registerLens(db, { name: "custom_lens", protectionMode: "PROTECTED", layersUsed: ["human", "artifact"], supportedArtifactTypes: ["painting"], publishableScopes: ["regional"], federationTiers: ["regional"], createdBy: "user1" });

    const systemOnly = listLenses(db, { isSystem: true });
    assert.equal(systemOnly.lenses.length, 6);

    const userOnly = listLenses(db, { isSystem: false });
    assert.equal(userOnly.lenses.length, 1);
    assert.equal(userOnly.lenses[0].name, "custom_lens");
  });

  it("skips already-registered system lenses on re-registration", () => {
    registerSystemLenses(db);
    const result = registerSystemLenses(db);
    assert.equal(result.ok, true);
    for (const r of result.results) {
      assert.equal(r.status, "already_registered");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// CULTURE ISOLATION INVARIANTS
// ═════════════════════════════════════════════════════════════════════════

describe("Culture Isolation Invariants — CONSTITUTIONAL", () => {
  it("culture CANNOT appear on marketplace", () => {
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("appear_on_marketplace"));
  });

  it("culture CANNOT generate royalties", () => {
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("generate_royalties"));
  });

  it("culture CANNOT be cited by knowledge or artistry DTUs", () => {
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("be_cited_by_knowledge_dtus"));
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("be_cited_by_artistry_dtus"));
  });

  it("culture CANNOT influence entity behavior", () => {
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("influence_entity_behavior"));
  });

  it("culture CANNOT be exported before merge", () => {
    assert.ok(CULTURE_RESTRICTIONS.cannotDo.includes("be_exported_before_merge"));
  });

  it("culture IS protected human memory forever", () => {
    assert.equal(POST_MERGE_RULES.isolation.classification, "PROTECTED_HUMAN_MEMORY");
    assert.equal(POST_MERGE_RULES.isolation.knowledgeInfluence, "FORBIDDEN_FOREVER");
  });

  it("grief protocol succession: no new sovereign, steward council governs", () => {
    assert.equal(GRIEF_PROTOCOL.postGrief.succession.newSovereign, "NONE");
    assert.equal(GRIEF_PROTOCOL.postGrief.succession.governanceModel, "steward_council_collective");
    assert.equal(GRIEF_PROTOCOL.postGrief.succession.constitutionalAuthority, "supreme");
  });

  it("must-continue services during grief include all critical systems", () => {
    const mustContinue = GRIEF_PROTOCOL.griefPeriod.systemBehavior.mustContinue;
    assert.ok(mustContinue.includes("backing_account_integrity"));
    assert.ok(mustContinue.includes("coin_peg_maintenance"));
    assert.ok(mustContinue.includes("user_withdrawals"));
    assert.ok(mustContinue.includes("constitutional_enforcement"));
  });
});
