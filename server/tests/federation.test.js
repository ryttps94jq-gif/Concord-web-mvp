/**
 * Federation Hierarchy Test Suite
 *
 * Tests the four-tier federated knowledge and economic system:
 *   - National / Regional / CRI registry
 *   - User location declaration (no geolocation, self-declared)
 *   - Entity home base & transfer tracking
 *   - DTU location tagging & federation tier promotion (no demotion)
 *   - Marketplace local-first purchasing (strict for emergents)
 *   - Knowledge escalation & resolution
 *   - Federation peering
 *   - CRI heartbeat & stale detection
 *   - Economic flow summary
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  createNational, listNationals, getNational,
  createRegion, listRegions, getRegion,
  registerCRIInstance, recordCRIHeartbeat, markStaleCRIs, listCRIInstances,
  declareUserLocation, getUserLocation,
  setEntityHomeBase, getEntityHomeBase,
  tagDTULocation, promoteDTU,
  findListingsForEntity,
  resolveQuery,
  getEscalationStats,
  createPeer, listPeers,
  getEconomicFlowSummary,
  // v1.1
  federatedQuery,
  checkQualityGate, checkPromotionEligibility,
  recordTierContent, getContentTiers, getMultiTierRoyalties,
  awardXP, completeQuest, getUserXP, getUserQuestCompletions,
  createRaceSeason, getActiveSeason,
  getTierHeartbeat, getFederationFlowInvariant,
  updateFederationPreferences, getFederationPreferences,
  // v1.1.1
  createDedupReview, processDedupDecision, getPendingDedupReviews,
  getDedupProtocol, getIntegrityInvariants,
  updateMarketplaceFilters, getMarketplaceFilters,
  updateWealthPreferences, getWealthPreferences,
  updateLeaderboardEntry, getLeaderboard,
} from "../lib/federation.js";

import {
  FEDERATION, FEDERATION_FLOW, MARKETPLACE_PURCHASE_PRIORITY, PEERING_POLICIES,
  TIER_HEARTBEATS, TIER_QUALITY_GATES, CREATIVE_TIERS, TIER_QUESTS, KNOWLEDGE_RACE,
  DEFAULT_FEDERATION_PREFERENCES,
  DEDUP_PROTOCOL, INTEGRITY_INVARIANTS,
  DEFAULT_MARKETPLACE_FILTERS, DEFAULT_WEALTH_PREFERENCES,
} from "../lib/federation-constants.js";

// ── In-Memory SQLite Helper ─────────────────────────────────────────────────

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

  // Minimal users table
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      scopes TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      declared_regional TEXT,
      declared_national TEXT,
      location_declared_at TEXT,
      federation_preferences_json TEXT DEFAULT '{}',
      marketplace_filters_json TEXT DEFAULT '{}',
      wealth_preferences_json TEXT DEFAULT '{}'
    );
  `);

  // Minimal dtus table
  db.exec(`
    CREATE TABLE dtus (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      title TEXT NOT NULL DEFAULT 'Untitled',
      body_json TEXT NOT NULL DEFAULT '{}',
      tags_json TEXT NOT NULL DEFAULT '[]',
      visibility TEXT NOT NULL DEFAULT 'private',
      tier TEXT NOT NULL DEFAULT 'regular',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      location_regional TEXT,
      location_national TEXT,
      federation_tier TEXT DEFAULT 'local'
        CHECK (federation_tier IN ('local','regional','national','global'))
    );
  `);

  // Minimal marketplace_economy_listings
  db.exec(`
    CREATE TABLE marketplace_economy_listings (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      content_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      content_hash TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      preview_type TEXT,
      license_type TEXT NOT NULL DEFAULT 'standard',
      royalty_chain_json TEXT DEFAULT '[]',
      purchase_count INTEGER NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      location_regional TEXT,
      location_national TEXT,
      dedup_verified INTEGER DEFAULT 0,
      rejection_reason TEXT,
      similar_to TEXT
    );
  `);

  // Federation tables
  db.exec(`
    CREATE TABLE nationals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country_code TEXT NOT NULL UNIQUE,
      compliance_json TEXT NOT NULL DEFAULT '{}',
      steward_council_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE regions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      national_id TEXT NOT NULL,
      timezone TEXT,
      cri_count INTEGER DEFAULT 0,
      user_count INTEGER DEFAULT 0,
      entity_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (national_id) REFERENCES nationals(id)
    );

    CREATE TABLE cri_instances (
      id TEXT PRIMARY KEY,
      regional_id TEXT NOT NULL,
      national_id TEXT NOT NULL,
      area_description TEXT,
      capabilities_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','maintenance','offline')),
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_heartbeat TEXT,
      FOREIGN KEY (regional_id) REFERENCES regions(id),
      FOREIGN KEY (national_id) REFERENCES nationals(id)
    );

    CREATE TABLE user_location_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      previous_regional TEXT,
      previous_national TEXT,
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE dtu_federation_history (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      from_tier TEXT NOT NULL,
      to_tier TEXT NOT NULL,
      promoted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reason TEXT
    );

    CREATE TABLE federation_escalations (
      id TEXT PRIMARY KEY,
      query_hash TEXT NOT NULL,
      from_tier TEXT NOT NULL,
      to_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE entity_home_base (
      entity_id TEXT PRIMARY KEY,
      cri_id TEXT NOT NULL,
      regional TEXT NOT NULL,
      national TEXT NOT NULL,
      arrived_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE entity_transfer_history (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      from_cri TEXT NOT NULL,
      to_cri TEXT NOT NULL,
      from_regional TEXT NOT NULL,
      to_regional TEXT NOT NULL,
      transferred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE federation_peers (
      id TEXT PRIMARY KEY,
      peer_type TEXT NOT NULL
        CHECK (peer_type IN ('regional_sibling','national_peer','tier_escalation')),
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      sharing_policy TEXT NOT NULL DEFAULT 'pull_on_demand',
      economic_isolation INTEGER NOT NULL DEFAULT 1,
      compliance_layer INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- v1.1 tables
    CREATE TABLE tier_content (
      id TEXT PRIMARY KEY,
      original_content_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL
        CHECK (federation_tier IN ('regional','national','global')),
      promoted_from_tier TEXT,
      promoted_at TEXT,
      promoted_by TEXT,
      authority_at_promotion REAL,
      citation_count_at_promotion INTEGER
    );

    CREATE TABLE user_xp (
      user_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      total_xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      season TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, federation_tier, COALESCE(regional,''), COALESCE(national,''), COALESCE(season,''))
    );

    CREATE TABLE quest_completions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      xp_awarded INTEGER,
      coin_awarded REAL,
      badge_awarded TEXT,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, quest_id, federation_tier)
    );

    CREATE TABLE leaderboards (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      category TEXT NOT NULL,
      season TEXT,
      rankings_json TEXT NOT NULL DEFAULT '[]',
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE race_seasons (
      id TEXT PRIMARY KEY,
      season_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active'
        CHECK (status IN ('upcoming','active','completed')),
      rewards_distributed INTEGER DEFAULT 0
    );

    -- v1.1.1 tables
    CREATE TABLE dedup_reviews (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      target_tier TEXT NOT NULL,
      similar_items_json TEXT NOT NULL DEFAULT '[]',
      highest_similarity REAL,
      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected_duplicate','merged')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE leaderboard_entries (
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      category TEXT NOT NULL,
      season TEXT,
      score REAL DEFAULT 0,
      rank INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, scope, scope_id, category, COALESCE(season,''))
    );
  `);

  return db;
}

function seedUser(db, id = "usr_test1") {
  db.prepare("INSERT OR IGNORE INTO users (id, username, email) VALUES (?, ?, ?)").run(id, `user_${id}`, `${id}@test.com`);
  return id;
}

function seedDTU(db, id = "dtu_test1", ownerId = "usr_test1") {
  db.prepare("INSERT OR IGNORE INTO dtus (id, owner_user_id, title) VALUES (?, ?, ?)").run(id, ownerId, `Test DTU ${id}`);
  return id;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Federation Constants", () => {
  it("has correct tier order", () => {
    assert.deepEqual(FEDERATION.TIERS, ["local", "regional", "national", "global"]);
  });

  it("has emergent purchasing set to strict", () => {
    assert.equal(FEDERATION.EMERGENT_PURCHASING, "strict_local_first");
  });

  it("has human purchasing set to recommended", () => {
    assert.equal(FEDERATION.HUMAN_PURCHASING, "recommended_local_first");
  });

  it("has marketplace purchase priority for emergent and human", () => {
    assert.deepEqual(MARKETPLACE_PURCHASE_PRIORITY.EMERGENT, ["regional", "national", "global"]);
    assert.deepEqual(MARKETPLACE_PURCHASE_PRIORITY.HUMAN, ["regional", "national", "global"]);
  });

  it("has peering policy templates", () => {
    assert.equal(PEERING_POLICIES.REGIONAL_SIBLING.peerType, "regional_sibling");
    assert.equal(PEERING_POLICIES.NATIONAL_PEER.complianceLayer, true);
    assert.equal(PEERING_POLICIES.TIER_ESCALATION.demotion, "never");
  });
});

describe("National Registry", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("creates a national", () => {
    const r = createNational(db, { name: "United States", countryCode: "US" });
    assert.equal(r.ok, true);
    assert.equal(r.national.countryCode, "US");
    assert.ok(r.national.id.startsWith("nat_"));
  });

  it("rejects duplicate country codes", () => {
    createNational(db, { name: "United States", countryCode: "US" });
    const r = createNational(db, { name: "Also US", countryCode: "US" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "country_code_exists");
  });

  it("lists nationals", () => {
    createNational(db, { name: "United States", countryCode: "US" });
    createNational(db, { name: "Japan", countryCode: "JP" });
    const r = listNationals(db);
    assert.equal(r.ok, true);
    assert.equal(r.nationals.length, 2);
  });

  it("gets a national by id", () => {
    const { national } = createNational(db, { name: "Nigeria", countryCode: "NG" });
    const r = getNational(db, national.id);
    assert.equal(r.ok, true);
    assert.equal(r.national.name, "Nigeria");
  });

  it("returns not_found for missing national", () => {
    const r = getNational(db, "nat_nonexistent");
    assert.equal(r.ok, false);
    assert.equal(r.error, "not_found");
  });
});

describe("Regional Registry", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db, natId;
  beforeEach(() => {
    db = createTestDb();
    natId = createNational(db, { name: "US", countryCode: "US" }).national.id;
  });

  it("creates a region within a national", () => {
    const r = createRegion(db, { name: "Detroit", nationalId: natId, timezone: "America/Detroit" });
    assert.equal(r.ok, true);
    assert.ok(r.region.id.startsWith("reg_"));
    assert.equal(r.region.name, "Detroit");
  });

  it("rejects region with invalid national", () => {
    const r = createRegion(db, { name: "Nowhere", nationalId: "nat_fake" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "national_not_found");
  });

  it("lists regions filtered by national", () => {
    const jp = createNational(db, { name: "Japan", countryCode: "JP" }).national.id;
    createRegion(db, { name: "Detroit", nationalId: natId });
    createRegion(db, { name: "Tokyo", nationalId: jp });
    const r = listRegions(db, { nationalId: natId });
    assert.equal(r.regions.length, 1);
    assert.equal(r.regions[0].name, "Detroit");
  });
});

describe("CRI Instances", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db, natId, regId;
  beforeEach(() => {
    db = createTestDb();
    natId = createNational(db, { name: "US", countryCode: "US" }).national.id;
    regId = createRegion(db, { name: "Detroit", nationalId: natId }).region.id;
  });

  it("registers a CRI instance", () => {
    const r = registerCRIInstance(db, {
      regionalId: regId,
      nationalId: natId,
      areaDescription: "Detroit Metro",
      capabilities: { brainCount: 4, entityCapacity: 100, storageGB: 500, gpuAvailable: true },
    });
    assert.equal(r.ok, true);
    assert.ok(r.cri.id.startsWith("cri_"));
    assert.equal(r.cri.status, "active");
  });

  it("increments region CRI count on registration", () => {
    registerCRIInstance(db, { regionalId: regId, nationalId: natId });
    const reg = getRegion(db, regId);
    assert.equal(reg.region.criCount, 1);
  });

  it("records heartbeats", () => {
    const cri = registerCRIInstance(db, { regionalId: regId, nationalId: natId }).cri;
    const r = recordCRIHeartbeat(db, cri.id);
    assert.equal(r.ok, true);
  });

  it("marks stale CRIs as offline", () => {
    const cri = registerCRIInstance(db, { regionalId: regId, nationalId: natId }).cri;
    // Artificially make heartbeat old
    db.prepare("UPDATE cri_instances SET last_heartbeat = datetime('now', '-10 minutes') WHERE id = ?").run(cri.id);
    const r = markStaleCRIs(db);
    assert.equal(r.ok, true);
    assert.equal(r.markedOffline, 1);

    const instances = listCRIInstances(db, { status: "offline" });
    assert.equal(instances.instances.length, 1);
  });
});

describe("User Location Declaration", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db, userId;
  beforeEach(() => {
    db = createTestDb();
    userId = seedUser(db);
  });

  it("declares user location", () => {
    const r = declareUserLocation(db, { userId, regional: "detroit", national: "us" });
    assert.equal(r.ok, true);
    assert.equal(r.location.regional, "detroit");
    assert.equal(r.location.national, "us");
  });

  it("retrieves user location", () => {
    declareUserLocation(db, { userId, regional: "detroit", national: "us" });
    const r = getUserLocation(db, userId);
    assert.equal(r.ok, true);
    assert.equal(r.location.regional, "detroit");
  });

  it("tracks location history on change", () => {
    declareUserLocation(db, { userId, regional: "detroit", national: "us" });
    declareUserLocation(db, { userId, regional: "lagos", national: "ng" });

    const history = db.prepare("SELECT * FROM user_location_history WHERE user_id = ? ORDER BY changed_at").all(userId);
    assert.equal(history.length, 2);
    assert.equal(history[1].previous_regional, "detroit");
    assert.equal(history[1].regional, "lagos");
  });

  it("rejects missing user", () => {
    const r = declareUserLocation(db, { userId: "usr_fake", regional: "x", national: "y" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "user_not_found");
  });
});

describe("Entity Home Base", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db, natId, regId, criId;
  beforeEach(() => {
    db = createTestDb();
    natId = createNational(db, { name: "US", countryCode: "US" }).national.id;
    regId = createRegion(db, { name: "Detroit", nationalId: natId }).region.id;
    criId = registerCRIInstance(db, { regionalId: regId, nationalId: natId }).cri.id;
  });

  it("sets entity home base to a CRI", () => {
    const r = setEntityHomeBase(db, { entityId: "ent_001", criId });
    assert.equal(r.ok, true);
    assert.equal(r.homeBase.regional, regId);
    assert.equal(r.homeBase.national, natId);
  });

  it("tracks transfer when home base changes", () => {
    setEntityHomeBase(db, { entityId: "ent_001", criId });

    // Create second CRI in a different region
    const reg2 = createRegion(db, { name: "Chicago", nationalId: natId }).region.id;
    const cri2 = registerCRIInstance(db, { regionalId: reg2, nationalId: natId }).cri.id;

    setEntityHomeBase(db, { entityId: "ent_001", criId: cri2 });

    const transfers = db.prepare("SELECT * FROM entity_transfer_history WHERE entity_id = ?").all("ent_001");
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0].from_cri, criId);
    assert.equal(transfers[0].to_cri, cri2);
  });

  it("gets entity home base", () => {
    setEntityHomeBase(db, { entityId: "ent_002", criId });
    const r = getEntityHomeBase(db, "ent_002");
    assert.equal(r.ok, true);
    assert.equal(r.homeBase.criId, criId);
  });
});

describe("DTU Location & Federation Tier", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    seedUser(db);
    seedDTU(db);
  });

  it("tags a DTU with location", () => {
    const r = tagDTULocation(db, { dtuId: "dtu_test1", regional: "detroit", national: "us", federationTier: "local" });
    assert.equal(r.ok, true);
    assert.equal(r.regional, "detroit");
  });

  it("prevents re-tagging location (immutable after creation)", () => {
    tagDTULocation(db, { dtuId: "dtu_test1", regional: "detroit", national: "us" });
    const r = tagDTULocation(db, { dtuId: "dtu_test1", regional: "lagos", national: "ng" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "location_already_set");
  });

  it("promotes a DTU to a higher tier", () => {
    tagDTULocation(db, { dtuId: "dtu_test1", regional: "detroit", national: "us", federationTier: "local" });
    const r = promoteDTU(db, { dtuId: "dtu_test1", toTier: "regional", reason: "Council approved" });
    assert.equal(r.ok, true);
    assert.equal(r.fromTier, "local");
    assert.equal(r.toTier, "regional");
  });

  it("prevents demotion (once promoted, stays)", () => {
    tagDTULocation(db, { dtuId: "dtu_test1", regional: "detroit", national: "us", federationTier: "regional" });
    const r = promoteDTU(db, { dtuId: "dtu_test1", toTier: "local" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "cannot_demote");
  });

  it("records promotion history", () => {
    tagDTULocation(db, { dtuId: "dtu_test1", regional: "detroit", national: "us", federationTier: "local" });
    promoteDTU(db, { dtuId: "dtu_test1", toTier: "regional", reason: "quality" });
    promoteDTU(db, { dtuId: "dtu_test1", toTier: "national", reason: "cross-regional value" });

    const history = db.prepare("SELECT * FROM dtu_federation_history WHERE dtu_id = ? ORDER BY promoted_at").all("dtu_test1");
    assert.equal(history.length, 2);
    assert.equal(history[0].from_tier, "local");
    assert.equal(history[0].to_tier, "regional");
    assert.equal(history[1].from_tier, "regional");
    assert.equal(history[1].to_tier, "national");
  });
});

describe("Marketplace Local-First Purchasing", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db, natId, regId, criId;

  beforeEach(() => {
    db = createTestDb();
    natId = createNational(db, { name: "US", countryCode: "US" }).national.id;
    regId = createRegion(db, { name: "Detroit", nationalId: natId }).region.id;
    criId = registerCRIInstance(db, { regionalId: regId, nationalId: natId }).cri.id;
    setEntityHomeBase(db, { entityId: "ent_buyer", criId });

    // Seed listings at different tiers
    db.prepare(`INSERT INTO marketplace_economy_listings (id, seller_id, content_id, content_type, title, price, location_regional, location_national) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "lst_regional1", "usr_seller1", "dtu_r1", "dtu", "Regional Widget", 10, regId, natId
    );
    db.prepare(`INSERT INTO marketplace_economy_listings (id, seller_id, content_id, content_type, title, price, location_regional, location_national) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "lst_national1", "usr_seller2", "dtu_n1", "dtu", "National Widget", 20, null, natId
    );
    db.prepare(`INSERT INTO marketplace_economy_listings (id, seller_id, content_id, content_type, title, price, location_regional, location_national) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "lst_global1", "usr_seller3", "dtu_g1", "dtu", "Global Widget", 30, null, null
    );
  });

  it("emergent finds regional listings first (strict local-first)", () => {
    const r = findListingsForEntity(db, { entityId: "ent_buyer", isEmergent: true });
    assert.equal(r.ok, true);
    assert.equal(r.tier, "regional");
    assert.equal(r.results.length, 1);
    assert.equal(r.results[0].id, "lst_regional1");
  });

  it("emergent falls to national when regional empty", () => {
    // Remove regional listing
    db.prepare("DELETE FROM marketplace_economy_listings WHERE id = 'lst_regional1'").run();

    const r = findListingsForEntity(db, { entityId: "ent_buyer", isEmergent: true });
    assert.equal(r.ok, true);
    assert.equal(r.tier, "national");
    assert.equal(r.results.length, 1);
    assert.equal(r.results[0].id, "lst_national1");
  });

  it("emergent falls to global as last resort", () => {
    db.prepare("DELETE FROM marketplace_economy_listings WHERE id IN ('lst_regional1', 'lst_national1')").run();

    const r = findListingsForEntity(db, { entityId: "ent_buyer", isEmergent: true });
    assert.equal(r.ok, true);
    assert.equal(r.tier, "global");
    assert.equal(r.results.length, 1);
  });

  it("human search returns all listings (not enforced)", () => {
    const r = findListingsForEntity(db, { entityId: "ent_buyer", isEmergent: false });
    assert.equal(r.ok, true);
    assert.equal(r.results.length, 3);
  });
});

describe("Knowledge Resolution (Escalation)", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("resolves at current tier when sufficient", async () => {
    const searchFn = (query, tier) => ({ sufficient: tier === "local", results: ["answer"] });
    const r = await resolveQuery(db, { query: "test", currentTier: "local", searchFn });
    assert.equal(r.ok, true);
    assert.equal(r.resolvedAt, "local");
  });

  it("escalates through tiers when insufficient", async () => {
    const searchFn = (query, tier) => ({ sufficient: tier === "national", results: ["found it"] });
    const r = await resolveQuery(db, {
      query: "hard question",
      currentTier: "local",
      userLocation: { regional: "detroit", national: "us" },
      searchFn,
    });
    assert.equal(r.ok, true);
    assert.equal(r.resolvedAt, "national");

    // Check escalation was logged
    const escalations = db.prepare("SELECT * FROM federation_escalations").all();
    assert.equal(escalations.length, 1);
    assert.equal(escalations[0].from_tier, "local");
    assert.equal(escalations[0].to_tier, "national");
  });

  it("returns exhausted when no tier can answer", async () => {
    const searchFn = () => ({ sufficient: false, results: [] });
    const r = await resolveQuery(db, { query: "impossible", currentTier: "local", searchFn });
    assert.equal(r.ok, true);
    assert.equal(r.exhausted, true);
    assert.equal(r.resolvedAt, null);
  });
});

describe("Federation Peering", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("creates a peer relationship", () => {
    const r = createPeer(db, { peerType: "regional_sibling", fromId: "reg_1", toId: "reg_2" });
    assert.equal(r.ok, true);
    assert.ok(r.peer.id.startsWith("fpeer_"));
    assert.equal(r.peer.economicIsolation, true);
  });

  it("rejects invalid peer type", () => {
    const r = createPeer(db, { peerType: "invalid", fromId: "a", toId: "b" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_peer_type");
  });

  it("lists peers filtered by entity", () => {
    createPeer(db, { peerType: "regional_sibling", fromId: "reg_1", toId: "reg_2" });
    createPeer(db, { peerType: "national_peer", fromId: "nat_1", toId: "nat_2" });

    const r = listPeers(db, { entityId: "reg_1" });
    assert.equal(r.peers.length, 1);
    assert.equal(r.peers[0].peerType, "regional_sibling");
  });
});

describe("Escalation Stats", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("returns empty stats when no escalations", () => {
    const r = getEscalationStats(db);
    assert.equal(r.ok, true);
    assert.equal(r.stats.length, 0);
  });

  it("aggregates escalation stats", async () => {
    // Trigger escalations via resolveQuery
    const searchFn = (q, tier) => ({ sufficient: tier === "global", results: ["ok"] });
    await resolveQuery(db, { query: "q1", currentTier: "local", userLocation: { regional: "detroit" }, searchFn });
    await resolveQuery(db, { query: "q2", currentTier: "local", userLocation: { regional: "detroit" }, searchFn });

    const r = getEscalationStats(db);
    assert.equal(r.ok, true);
    assert.ok(r.stats.length > 0);
  });
});

describe("Economic Flow Summary", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("returns flow summary with listing counts", () => {
    const r = getEconomicFlowSummary(db);
    assert.equal(r.ok, true);
    assert.equal(typeof r.listings.regional, "number");
    assert.equal(typeof r.listings.national, "number");
    assert.equal(typeof r.listings.global, "number");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v1.1 TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("v1.1 — Federation Flow Invariant", () => {
  it("enforces UP_ONLY direction", () => {
    assert.equal(FEDERATION_FLOW.direction, "UP_ONLY");
    assert.equal(FEDERATION_FLOW.downwardSync, "FORBIDDEN");
    assert.equal(FEDERATION_FLOW.downwardAssist, "PULL_ONLY_ON_QUERY");
  });

  it("returns invariant via function", () => {
    const inv = getFederationFlowInvariant();
    assert.equal(inv.direction, "UP_ONLY");
    assert.equal(inv.downwardSync, "FORBIDDEN");
  });
});

describe("v1.1 — Tier Heartbeats", () => {
  it("local tier ticks fastest (15s)", () => {
    assert.equal(TIER_HEARTBEATS.local.tickIntervalMs, 15_000);
  });

  it("global tier ticks slowest (120s)", () => {
    assert.equal(TIER_HEARTBEATS.global.tickIntervalMs, 120_000);
  });

  it("regional has meta-derivation", () => {
    assert.equal(TIER_HEARTBEATS.regional.metaDerivationEvery, 100);
  });

  it("getTierHeartbeat returns config", () => {
    const config = getTierHeartbeat("national");
    assert.equal(config.tickIntervalMs, 60_000);
  });

  it("getTierHeartbeat returns null for unknown tier", () => {
    assert.equal(getTierHeartbeat("unknown"), null);
  });
});

describe("v1.1 — Quality Gates", () => {
  it("regional gate is easiest (minAuthority 0.15, no council)", () => {
    assert.equal(TIER_QUALITY_GATES.regional.minAuthorityScore, 0.15);
    assert.equal(TIER_QUALITY_GATES.regional.councilVotesRequired, 0);
  });

  it("global gate is hardest (minAuthority 0.70, 7 votes)", () => {
    assert.equal(TIER_QUALITY_GATES.global.minAuthorityScore, 0.70);
    assert.equal(TIER_QUALITY_GATES.global.councilVotesRequired, 7);
  });

  it("global only allows mega and hyper", () => {
    assert.equal(TIER_QUALITY_GATES.global.allowRegularTier, false);
    assert.equal(TIER_QUALITY_GATES.global.allowMegaTier, true);
    assert.equal(TIER_QUALITY_GATES.global.allowHyperTier, true);
  });

  it("checkQualityGate passes when requirements met", () => {
    const r = checkQualityGate({
      targetTier: "regional",
      authorityScore: 0.50,
      citationCount: 5,
      dtuTier: "regular",
    });
    assert.equal(r.ok, true);
    assert.equal(r.passed, true);
    assert.equal(r.failures.length, 0);
  });

  it("checkQualityGate fails when authority too low", () => {
    const r = checkQualityGate({
      targetTier: "national",
      authorityScore: 0.10,
      citationCount: 0,
      dtuTier: "regular",
    });
    assert.equal(r.ok, false);
    assert.ok(r.failures.length > 0);
    assert.ok(r.failures.some(f => f.gate === "minAuthorityScore"));
  });

  it("checkQualityGate rejects shadow at national", () => {
    const r = checkQualityGate({
      targetTier: "national",
      authorityScore: 0.80,
      citationCount: 10,
      dtuTier: "shadow",
    });
    assert.equal(r.ok, false);
    assert.ok(r.failures.some(f => f.gate === "tierAllowed"));
  });

  it("checkPromotionEligibility regional->national", () => {
    const r = checkPromotionEligibility({
      fromTier: "regional",
      authorityScore: 0.60,
      citationCount: 5,
      ageHours: 72,
    });
    assert.equal(r.ok, true);
    assert.equal(r.from, "regional");
    assert.equal(r.to, "national");
  });

  it("checkPromotionEligibility fails when too young", () => {
    const r = checkPromotionEligibility({
      fromTier: "regional",
      authorityScore: 0.60,
      citationCount: 5,
      ageHours: 12, // needs 48
    });
    assert.equal(r.ok, false);
    assert.ok(r.failures.some(f => f.gate === "minAgeHours"));
  });

  it("checkPromotionEligibility national->global needs cross-regional", () => {
    const r = checkPromotionEligibility({
      fromTier: "national",
      authorityScore: 0.80,
      citationCount: 15,
      ageHours: 800,
      crossRegionalPresence: 1, // needs 3
    });
    assert.equal(r.ok, false);
    assert.ok(r.failures.some(f => f.gate === "crossRegionalPresence"));
  });
});

describe("v1.1 — Creative Tiers", () => {
  it("has three creative tiers", () => {
    assert.ok(CREATIVE_TIERS.creative_regional);
    assert.ok(CREATIVE_TIERS.creative_national);
    assert.ok(CREATIVE_TIERS.creative_global);
  });

  it("creative_global needs 30 votes at 80% approval", () => {
    assert.equal(CREATIVE_TIERS.creative_global.minVotes, 30);
    assert.equal(CREATIVE_TIERS.creative_global.minApprovalRate, 0.80);
  });
});

describe("v1.1 — Federated Query (Ephemeral)", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("returns persisted=true when resolved at origin tier", async () => {
    const searchFn = (q, tier) => ({ sufficient: tier === "local", results: ["local answer"] });
    const r = await federatedQuery(db, { query: "test", originTier: "local", searchFn });
    assert.equal(r.ok, true);
    assert.equal(r.resolvedAt, "local");
    assert.equal(r.persisted, true);
  });

  it("returns ephemeral=true when resolved at higher tier", async () => {
    const searchFn = (q, tier) => ({ sufficient: tier === "national", results: ["national answer"] });
    const r = await federatedQuery(db, {
      query: "test",
      originTier: "local",
      userLocation: { regional: "detroit", national: "us" },
      searchFn,
    });
    assert.equal(r.ok, true);
    assert.equal(r.resolvedAt, "national");
    assert.equal(r.persisted, false);
    assert.equal(r.ephemeral, true);
    assert.equal(r.expiresAfter, "session");
  });

  it("returns exhausted when no tier answers", async () => {
    const searchFn = () => ({ sufficient: false, results: [] });
    const r = await federatedQuery(db, { query: "impossible", originTier: "local", searchFn });
    assert.equal(r.ok, true);
    assert.equal(r.exhausted, true);
  });
});

describe("v1.1 — Tier Content Tracking", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    seedUser(db);
    seedDTU(db);
  });

  it("records tier content on promotion", () => {
    const r = recordTierContent(db, {
      contentId: "dtu_test1",
      federationTier: "regional",
      promotedBy: "council_detroit",
      authorityScore: 0.45,
      citationCount: 5,
    });
    assert.equal(r.ok, true);
  });

  it("tracks content across multiple tiers", () => {
    recordTierContent(db, { contentId: "dtu_test1", federationTier: "regional" });
    recordTierContent(db, { contentId: "dtu_test1", federationTier: "national", promotedFromTier: "regional" });

    const r = getContentTiers(db, "dtu_test1");
    assert.equal(r.ok, true);
    assert.equal(r.tiers.length, 2);
    assert.deepEqual(r.tiersPresent, ["regional", "national"]);
  });
});

describe("v1.1 — Multi-Tier Royalties", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    seedUser(db);
    seedDTU(db);
    recordTierContent(db, { contentId: "dtu_test1", federationTier: "regional" });
    recordTierContent(db, { contentId: "dtu_test1", federationTier: "national", promotedFromTier: "regional" });
    recordTierContent(db, { contentId: "dtu_test1", federationTier: "global", promotedFromTier: "national" });
  });

  it("calculates multi-tier royalty streams", () => {
    const r = getMultiTierRoyalties(db, { creatorId: "usr_test1", contentId: "dtu_test1" });
    assert.equal(r.ok, true);
    assert.equal(r.totalStreams, 3);
    assert.deepEqual(r.tiersPresent, ["regional", "national", "global"]);
  });
});

describe("v1.1 — Quest & XP Engine", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    seedUser(db);
  });

  it("awards XP to a user", () => {
    const r = awardXP(db, { userId: "usr_test1", federationTier: "regional", xpAmount: 100 });
    assert.equal(r.ok, true);
    assert.equal(r.totalXp, 100);
    assert.equal(r.level, 2); // 100 XP = level 2 for regional
  });

  it("accumulates XP across awards", () => {
    awardXP(db, { userId: "usr_test1", federationTier: "regional", xpAmount: 100 });
    const r = awardXP(db, { userId: "usr_test1", federationTier: "regional", xpAmount: 250 });
    assert.equal(r.totalXp, 350);
    assert.equal(r.level, 3); // 350 XP = level 3 (300 threshold)
  });

  it("gets user XP", () => {
    awardXP(db, { userId: "usr_test1", federationTier: "regional", xpAmount: 500 });
    const r = getUserXP(db, { userId: "usr_test1", federationTier: "regional" });
    assert.equal(r.totalXp, 500);
  });

  it("completes a quest and awards XP", () => {
    const r = completeQuest(db, {
      userId: "usr_test1",
      questId: "regional_first_contribution",
      federationTier: "regional",
    });
    assert.equal(r.ok, true);
    assert.equal(r.xpAwarded, 50);
    assert.equal(r.coinAwarded, 5);
    assert.equal(r.badgeAwarded, "regional_contributor");

    // Verify XP was awarded
    const xp = getUserXP(db, { userId: "usr_test1", federationTier: "regional" });
    assert.equal(xp.totalXp, 50);
  });

  it("prevents double quest completion", () => {
    completeQuest(db, { userId: "usr_test1", questId: "regional_first_contribution", federationTier: "regional" });
    const r = completeQuest(db, { userId: "usr_test1", questId: "regional_first_contribution", federationTier: "regional" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "quest_already_completed");
  });

  it("tracks quest completions", () => {
    completeQuest(db, { userId: "usr_test1", questId: "regional_first_contribution", federationTier: "regional" });
    completeQuest(db, { userId: "usr_test1", questId: "regional_citation_chain", federationTier: "regional" });

    const r = getUserQuestCompletions(db, { userId: "usr_test1", federationTier: "regional" });
    assert.equal(r.ok, true);
    assert.equal(r.completions.length, 2);
  });
});

describe("v1.1 — Knowledge Race Seasons", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("creates a race season", () => {
    const r = createRaceSeason(db, { name: "Q1 2026", startDate: "2026-01-01", endDate: "2026-03-31" });
    assert.equal(r.ok, true);
    assert.equal(r.season.status, "upcoming");
  });

  it("gets active season", () => {
    db.prepare("INSERT INTO race_seasons (id, season_name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)").run(
      "s1", "Q1 2026", "2026-01-01", "2026-03-31", "active"
    );
    const r = getActiveSeason(db);
    assert.equal(r.ok, true);
    assert.equal(r.season.name, "Q1 2026");
  });

  it("returns null when no active season", () => {
    const r = getActiveSeason(db);
    assert.equal(r.ok, true);
    assert.equal(r.season, null);
  });
});

describe("v1.1 — Knowledge Race Constants", () => {
  it("has 10 leaderboard categories", () => {
    assert.equal(KNOWLEDGE_RACE.categories.length, 10);
  });

  it("has regional and national leaderboards", () => {
    assert.ok(KNOWLEDGE_RACE.leaderboards.regional);
    assert.ok(KNOWLEDGE_RACE.leaderboards.national);
  });

  it("seasons are 90 days", () => {
    assert.equal(KNOWLEDGE_RACE.seasons.durationDays, 90);
  });

  it("preserves badges across seasons", () => {
    assert.equal(KNOWLEDGE_RACE.seasons.preserveBadges, true);
  });
});

describe("v1.1 — Quest Definitions", () => {
  it("regional has 4 quests", () => {
    assert.equal(TIER_QUESTS.regional.questTypes.length, 4);
  });

  it("national has 4 quests", () => {
    assert.equal(TIER_QUESTS.national.questTypes.length, 4);
  });

  it("global has 3 quests", () => {
    assert.equal(TIER_QUESTS.global.questTypes.length, 3);
  });

  it("global meta-derivation quest rewards 10000 XP", () => {
    const quest = TIER_QUESTS.global.questTypes.find(q => q.id === "global_meta_derivation");
    assert.equal(quest.xpReward, 10000);
    assert.equal(quest.coinReward, 1000);
  });

  it("each tier has 5 XP levels", () => {
    assert.equal(TIER_QUESTS.regional.xpLevels.length, 5);
    assert.equal(TIER_QUESTS.national.xpLevels.length, 5);
    assert.equal(TIER_QUESTS.global.xpLevels.length, 5);
  });

  it("global top level is Civilization Elder at 100000 XP", () => {
    const topLevel = TIER_QUESTS.global.xpLevels[4];
    assert.equal(topLevel.title, "Civilization Elder");
    assert.equal(topLevel.xpRequired, 100000);
  });
});

describe("v1.1 — Default Federation Preferences", () => {
  it("global participation defaults to false (opt-in)", () => {
    assert.equal(DEFAULT_FEDERATION_PREFERENCES.participateInGlobal, false);
  });

  it("regional participation defaults to true", () => {
    assert.equal(DEFAULT_FEDERATION_PREFERENCES.participateInRegional, true);
  });

  it("auto-promotion candidate defaults to true", () => {
    assert.equal(DEFAULT_FEDERATION_PREFERENCES.autoPromotionCandidate, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// v1.1.1 TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe("v1.1.1 — Dedup Protocol Constants", () => {
  it("automated threshold is 0.90", () => {
    assert.equal(DEDUP_PROTOCOL.automated.similarityThreshold, 0.90);
  });

  it("regional needs 2 reviewers with 48h timeout", () => {
    assert.equal(DEDUP_PROTOCOL.council.regional.reviewersRequired, 2);
    assert.equal(DEDUP_PROTOCOL.council.regional.timeoutHours, 48);
  });

  it("global needs 5 reviewers, no auto-approve", () => {
    assert.equal(DEDUP_PROTOCOL.council.global.reviewersRequired, 5);
    assert.equal(DEDUP_PROTOCOL.council.global.autoApproveOnTimeout, false);
  });
});

describe("v1.1.1 — Integrity Invariants", () => {
  it("has 8 invariant rules", () => {
    assert.equal(INTEGRITY_INVARIANTS.rules.length, 8);
  });

  it("getIntegrityInvariants returns rules", () => {
    const inv = getIntegrityInvariants();
    assert.ok(inv.rules.length >= 8);
  });
});

describe("v1.1.1 — Council Dedup System", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("creates a dedup review", () => {
    const r = createDedupReview(db, {
      contentId: "lst_001",
      targetTier: "regional",
      similarItems: [{ id: "lst_existing", similarity: 0.92, title: "Similar Widget" }],
      highestSimilarity: 0.92,
    });
    assert.equal(r.ok, true);
    assert.equal(r.status, "held_for_review");
    assert.equal(r.dedupVerified, false);
    assert.equal(r.timeoutHours, 48);
  });

  it("lists pending reviews by tier", () => {
    createDedupReview(db, { contentId: "lst_001", targetTier: "regional", highestSimilarity: 0.92 });
    createDedupReview(db, { contentId: "lst_002", targetTier: "national", highestSimilarity: 0.95 });

    const r = getPendingDedupReviews(db, { targetTier: "regional" });
    assert.equal(r.ok, true);
    assert.equal(r.reviews.length, 1);
    assert.equal(r.reviews[0].targetTier, "regional");
  });

  it("processes approve decision", () => {
    const review = createDedupReview(db, { contentId: "lst_001", targetTier: "regional" });

    // Create the marketplace listing so it can be updated
    db.prepare(`INSERT INTO marketplace_economy_listings (id, seller_id, content_id, content_type, title, price) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("lst_001", "usr_1", "dtu_1", "dtu", "Widget", 10);

    const r = processDedupDecision(db, {
      reviewId: review.reviewId,
      decision: "approve",
      reviewerId: "council_member_1",
    });
    assert.equal(r.ok, true);
    assert.equal(r.decision, "approve");

    // Verify listing marked as dedup verified
    const listing = db.prepare("SELECT dedup_verified FROM marketplace_economy_listings WHERE id = ?").get("lst_001");
    assert.equal(listing.dedup_verified, 1);
  });

  it("processes reject_duplicate decision", () => {
    const review = createDedupReview(db, {
      contentId: "lst_002",
      targetTier: "national",
      similarItems: [{ id: "lst_existing" }],
    });

    db.prepare(`INSERT INTO marketplace_economy_listings (id, seller_id, content_id, content_type, title, price) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("lst_002", "usr_1", "dtu_2", "dtu", "Duplicate Widget", 10);

    const r = processDedupDecision(db, {
      reviewId: review.reviewId,
      decision: "reject_duplicate",
      reviewerId: "council_member_1",
    });
    assert.equal(r.ok, true);

    const listing = db.prepare("SELECT status, rejection_reason FROM marketplace_economy_listings WHERE id = ?").get("lst_002");
    assert.equal(listing.status, "flagged");
    assert.ok(listing.rejection_reason.includes("Duplicate"));
  });

  it("prevents double processing", () => {
    const review = createDedupReview(db, { contentId: "lst_003", targetTier: "regional" });
    db.prepare(`INSERT INTO marketplace_economy_listings (id, seller_id, content_id, content_type, title, price) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("lst_003", "usr_1", "dtu_3", "dtu", "Widget 3", 10);

    processDedupDecision(db, { reviewId: review.reviewId, decision: "approve", reviewerId: "cm1" });
    const r = processDedupDecision(db, { reviewId: review.reviewId, decision: "reject_duplicate", reviewerId: "cm2" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "review_already_processed");
  });
});

describe("v1.1.1 — Marketplace Filters", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db, userId;
  beforeEach(() => {
    db = createTestDb();
    userId = seedUser(db);
  });

  it("updates marketplace filters", () => {
    const r = updateMarketplaceFilters(db, {
      userId,
      filters: { buyingMode: "local_only", defaultSort: "most_cited" },
    });
    assert.equal(r.ok, true);
    assert.equal(r.filters.buyingMode, "local_only");
  });

  it("gets marketplace filters", () => {
    updateMarketplaceFilters(db, { userId, filters: { showGlobal: false } });
    const r = getMarketplaceFilters(db, userId);
    assert.equal(r.ok, true);
    assert.equal(r.filters.showGlobal, false);
  });

  it("merges filters on update", () => {
    updateMarketplaceFilters(db, { userId, filters: { buyingMode: "custom" } });
    updateMarketplaceFilters(db, { userId, filters: { defaultSort: "authority" } });
    const r = getMarketplaceFilters(db, userId);
    assert.equal(r.filters.buyingMode, "custom");
    assert.equal(r.filters.defaultSort, "authority");
  });
});

describe("v1.1.1 — Wealth Preferences", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db, userId;
  beforeEach(() => {
    db = createTestDb();
    userId = seedUser(db);
  });

  it("updates wealth preferences", () => {
    const r = updateWealthPreferences(db, {
      userId,
      preferences: { localReinvestmentPercent: 10, showOriginBadge: true },
    });
    assert.equal(r.ok, true);
    assert.equal(r.preferences.localReinvestmentPercent, 10);
  });

  it("gets wealth preferences", () => {
    updateWealthPreferences(db, { userId, preferences: { communityFundContribution: 5 } });
    const r = getWealthPreferences(db, userId);
    assert.equal(r.ok, true);
    assert.equal(r.preferences.communityFundContribution, 5);
  });
});

describe("v1.1.1 — Leaderboard Entries", { skip: !Database && "better-sqlite3 not available" }, () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it("creates a leaderboard entry", () => {
    const r = updateLeaderboardEntry(db, {
      userId: "usr_1", scope: "regional", scopeId: "reg_detroit",
      category: "total_xp", score: 1500, rank: 1,
    });
    assert.equal(r.ok, true);
    assert.equal(r.rank, 1);
  });

  it("updates existing leaderboard entry", () => {
    updateLeaderboardEntry(db, {
      userId: "usr_1", scope: "regional", scopeId: "reg_detroit",
      category: "total_xp", score: 1500, rank: 1,
    });
    updateLeaderboardEntry(db, {
      userId: "usr_1", scope: "regional", scopeId: "reg_detroit",
      category: "total_xp", score: 2000, rank: 1,
    });
    const lb = getLeaderboard(db, { scope: "regional", scopeId: "reg_detroit", category: "total_xp" });
    assert.equal(lb.entries.length, 1);
    assert.equal(lb.entries[0].score, 2000);
  });

  it("gets leaderboard sorted by rank", () => {
    updateLeaderboardEntry(db, { userId: "usr_1", scope: "regional", scopeId: "r1", category: "total_xp", score: 2000, rank: 1 });
    updateLeaderboardEntry(db, { userId: "usr_2", scope: "regional", scopeId: "r1", category: "total_xp", score: 1500, rank: 2 });
    updateLeaderboardEntry(db, { userId: "usr_3", scope: "regional", scopeId: "r1", category: "total_xp", score: 1000, rank: 3 });

    const lb = getLeaderboard(db, { scope: "regional", scopeId: "r1", category: "total_xp" });
    assert.equal(lb.ok, true);
    assert.equal(lb.entries.length, 3);
    assert.equal(lb.entries[0].userId, "usr_1");
    assert.equal(lb.entries[2].userId, "usr_3");
  });
});

describe("v1.1.1 — Default Marketplace Filters", () => {
  it("buying mode defaults to open", () => {
    assert.equal(DEFAULT_MARKETPLACE_FILTERS.buyingMode, "open");
  });

  it("shows all tiers by default", () => {
    assert.equal(DEFAULT_MARKETPLACE_FILTERS.showRegional, true);
    assert.equal(DEFAULT_MARKETPLACE_FILTERS.showNational, true);
    assert.equal(DEFAULT_MARKETPLACE_FILTERS.showGlobal, true);
  });

  it("default sort is relevance", () => {
    assert.equal(DEFAULT_MARKETPLACE_FILTERS.defaultSort, "relevance");
  });
});

describe("v1.1.1 — Default Wealth Preferences", () => {
  it("purchase priority is regional first", () => {
    assert.deepEqual(DEFAULT_WEALTH_PREFERENCES.purchasePriority, ["regional", "national", "global"]);
  });

  it("no local reinvestment by default", () => {
    assert.equal(DEFAULT_WEALTH_PREFERENCES.localReinvestmentPercent, 0);
  });

  it("shows origin badge by default", () => {
    assert.equal(DEFAULT_WEALTH_PREFERENCES.showOriginBadge, true);
  });
});
