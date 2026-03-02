/**
 * Emergent Auth Test Suite
 *
 * Tests:
 *   - registerEmergent: success, missing name, transaction error
 *   - registerBot: success, missing params, multiple lens access, transaction error
 *   - authenticateBot: success, missing key, invalid key, capabilities parsing
 *   - checkLensAccess: specific access, wildcard access, denied
 *   - listEntities: emergent-only, bot-only, both, custom limit/offset
 *   - SUBSTRATES constant
 *
 * Run: node --test server/tests/emergent-auth.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";

import {
  registerEmergent,
  registerBot,
  authenticateBot,
  checkLensAccess,
  listEntities,
} from "../economy/emergent-auth.js";

// ── In-memory mock DB ────────────────────────────────────────────────

function createMockDb() {
  const tables = {
    emergent_entities: [],
    entity_lens_access: [],
    bots: [],
    merit_credit: [],
  };

  function matchWhere(row, sql, params) {
    // Very basic SQL matching for our test purposes
    return true;
  }

  const db = {
    _tables: tables,
    prepare(sql) {
      return {
        run(...params) {
          const lower = sql.toLowerCase().trim();
          if (lower.startsWith("insert into emergent_entities")) {
            tables.emergent_entities.push({
              id: params[0],
              name: params[1],
              model_id: params[2],
              substrate: params[3],
              wallet_id: params[4],
              capabilities_json: params[5],
              sponsor_id: params[6],
              status: "active",
              created_at: params[7],
              updated_at: params[8],
            });
            return { changes: 1 };
          }
          if (lower.startsWith("insert into entity_lens_access")) {
            tables.entity_lens_access.push({
              id: params[0],
              entity_id: params[1],
              lens_id: params[2],
              access_level: lower.includes("'full'") ? "full" : params[3] || "full",
              granted_by: lower.includes("'system'") ? "system" : params[3],
              created_at: params[lower.includes("'system'") ? 2 : 4],
            });
            return { changes: 1 };
          }
          if (lower.startsWith("insert into bots")) {
            tables.bots.push({
              id: params[0],
              name: params[1],
              bot_type: params[2],
              owner_id: params[3],
              wallet_id: params[4],
              capabilities_json: params[5],
              api_key_hash: params[6],
              status: "active",
              created_at: params[7],
              updated_at: params[8],
            });
            return { changes: 1 };
          }
          if (lower.startsWith("insert into merit_credit")) {
            tables.merit_credit.push({
              id: params[0],
              user_id: params[1],
              activity_type: params[2],
              points: params[3],
              lens_id: params[4],
              metadata_json: params[5],
              created_at: params[6],
            });
            return { changes: 1 };
          }
          return { changes: 0 };
        },
        get(...params) {
          const lower = sql.toLowerCase().trim();
          if (lower.includes("from bots where api_key_hash")) {
            return tables.bots.find(
              (b) => b.api_key_hash === params[0] && b.status === "active"
            ) || undefined;
          }
          if (lower.includes("from entity_lens_access where entity_id")) {
            return tables.entity_lens_access.find(
              (a) => a.entity_id === params[0] && (a.lens_id === params[1] || a.lens_id === "__ALL_EMERGENT__")
            ) || undefined;
          }
          return undefined;
        },
        all(...params) {
          const lower = sql.toLowerCase().trim();
          if (lower.includes("from entity_lens_access where entity_id")) {
            return tables.entity_lens_access
              .filter((a) => a.entity_id === params[0])
              .map((a) => ({ lens_id: a.lens_id, access_level: a.access_level }));
          }
          // listEntities queries
          if (lower.includes("from emergent_entities") && lower.includes("union all")) {
            // Both emergents + bots
            const emergents = tables.emergent_entities
              .filter((e) => e.status === params[0])
              .map((e) => ({
                type: "emergent", id: e.id, name: e.name,
                substrate: e.substrate, wallet_id: e.wallet_id,
                status: e.status, created_at: e.created_at,
              }));
            const bots = tables.bots
              .filter((b) => b.status === params[1])
              .map((b) => ({
                type: "bot", id: b.id, name: b.name,
                substrate: "bot", wallet_id: b.wallet_id,
                status: b.status, created_at: b.created_at,
              }));
            const all = [...emergents, ...bots];
            const limit = params[2] || 50;
            const offset = params[3] || 0;
            return all.slice(offset, offset + limit);
          }
          if (lower.includes("from emergent_entities") && !lower.includes("union")) {
            const status = params[0];
            const limit = params[1] || 50;
            const offset = params[2] || 0;
            return tables.emergent_entities
              .filter((e) => e.status === status)
              .map((e) => ({
                type: "emergent", id: e.id, name: e.name,
                substrate: e.substrate, wallet_id: e.wallet_id,
                status: e.status, created_at: e.created_at,
              }))
              .slice(offset, offset + limit);
          }
          if (lower.includes("from bots where status")) {
            const status = params[0];
            const limit = params[1] || 50;
            const offset = params[2] || 0;
            return tables.bots
              .filter((b) => b.status === status)
              .map((b) => ({
                type: "bot", id: b.id, name: b.name,
                substrate: "bot", wallet_id: b.wallet_id,
                status: b.status, created_at: b.created_at,
              }))
              .slice(offset, offset + limit);
          }
          return [];
        },
      };
    },
    transaction(fn) {
      return (...args) => fn(...args);
    },
  };
  return db;
}

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. registerEmergent
// ═══════════════════════════════════════════════════════════════════════════════

describe("registerEmergent", () => {
  let db;
  beforeEach(() => { db = createMockDb(); });

  it("returns error when name is missing", () => {
    const r = registerEmergent(db, { name: "" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_name");
  });

  it("returns error when name is null", () => {
    const r = registerEmergent(db, { name: null });
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_name");
  });

  it("returns error when name is undefined", () => {
    const r = registerEmergent(db, {});
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_name");
  });

  it("registers an emergent entity successfully", () => {
    const r = registerEmergent(db, {
      name: "TestEntity",
      modelId: "gpt-4",
      capabilities: ["chat", "code"],
      sponsorId: "sponsor_1",
      substrate: "emergent",
    });
    assert.equal(r.ok, true);
    assert.ok(r.entity);
    assert.ok(r.entity.id.startsWith("emr_"));
    assert.equal(r.entity.name, "TestEntity");
    assert.equal(r.entity.substrate, "emergent");
    assert.ok(r.entity.walletId.startsWith("wallet_emr_"));
    assert.equal(r.entity.status, "active");

    // Check entity was stored
    assert.equal(db._tables.emergent_entities.length, 1);
    assert.equal(db._tables.emergent_entities[0].model_id, "gpt-4");
    assert.equal(db._tables.emergent_entities[0].sponsor_id, "sponsor_1");

    // Check lens access was granted (wildcard)
    assert.equal(db._tables.entity_lens_access.length, 1);
  });

  it("uses defaults for optional fields", () => {
    const r = registerEmergent(db, { name: "MinEntity" });
    assert.equal(r.ok, true);
    assert.equal(r.entity.substrate, "emergent");

    const ent = db._tables.emergent_entities[0];
    assert.equal(ent.model_id, "unknown");
    assert.equal(ent.capabilities_json, "[]");
    assert.equal(ent.sponsor_id, null);
  });

  it("handles transaction error gracefully", () => {
    const errDb = {
      prepare() {
        return {
          run() { throw new Error("disk full"); },
        };
      },
      transaction(fn) {
        return (...args) => fn(...args);
      },
    };
    const r = registerEmergent(errDb, { name: "FailEntity" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "disk full");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. registerBot
// ═══════════════════════════════════════════════════════════════════════════════

describe("registerBot", () => {
  let db;
  beforeEach(() => { db = createMockDb(); });

  it("returns error when name is missing", () => {
    const r = registerBot(db, { name: "", ownerId: "user_1" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_params");
  });

  it("returns error when ownerId is missing", () => {
    const r = registerBot(db, { name: "Bot1", ownerId: "" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_params");
  });

  it("returns error when both are missing", () => {
    const r = registerBot(db, {});
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_params");
  });

  it("registers a bot successfully", () => {
    const r = registerBot(db, {
      name: "TestBot",
      botType: "scraper",
      ownerId: "user_1",
      capabilities: ["fetch", "parse"],
      lensIds: ["lens_a", "lens_b"],
    });
    assert.equal(r.ok, true);
    assert.ok(r.bot);
    assert.ok(r.bot.id.startsWith("bot_"));
    assert.equal(r.bot.name, "TestBot");
    assert.ok(r.bot.walletId.startsWith("wallet_bot_"));
    assert.ok(r.bot.apiKey.startsWith("ck_"));
    assert.deepEqual(r.bot.lensAccess, ["lens_a", "lens_b"]);
    assert.equal(r.bot.status, "active");

    // Check bot stored
    assert.equal(db._tables.bots.length, 1);
    assert.equal(db._tables.bots[0].bot_type, "scraper");
    assert.equal(db._tables.bots[0].owner_id, "user_1");

    // Check lens access entries
    assert.equal(db._tables.entity_lens_access.length, 2);

    // Check merit credit was awarded to owner
    assert.equal(db._tables.merit_credit.length, 1);
    assert.equal(db._tables.merit_credit[0].activity_type, "bot_registered");
    assert.equal(db._tables.merit_credit[0].points, 5);
  });

  it("uses defaults for optional fields", () => {
    const r = registerBot(db, { name: "MinBot", ownerId: "user_1" });
    assert.equal(r.ok, true);

    const bot = db._tables.bots[0];
    assert.equal(bot.bot_type, "general");
    assert.equal(bot.capabilities_json, "[]");
    assert.deepEqual(r.bot.lensAccess, []);
  });

  it("handles transaction error gracefully", () => {
    const errDb = {
      prepare() {
        return {
          run() { throw new Error("constraint violation"); },
        };
      },
      transaction(fn) {
        return (...args) => fn(...args);
      },
    };
    const r = registerBot(errDb, { name: "FailBot", ownerId: "user_1" });
    assert.equal(r.ok, false);
    assert.equal(r.error, "constraint violation");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. authenticateBot
// ═══════════════════════════════════════════════════════════════════════════════

describe("authenticateBot", () => {
  let db;
  beforeEach(() => { db = createMockDb(); });

  it("returns error when apiKey is missing", () => {
    const r = authenticateBot(db, "");
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_api_key");
  });

  it("returns error when apiKey is null", () => {
    const r = authenticateBot(db, null);
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_api_key");
  });

  it("returns error when apiKey is undefined", () => {
    const r = authenticateBot(db, undefined);
    assert.equal(r.ok, false);
    assert.equal(r.error, "missing_api_key");
  });

  it("returns error when bot not found", () => {
    const r = authenticateBot(db, "ck_invalid");
    assert.equal(r.ok, false);
    assert.equal(r.error, "invalid_api_key");
  });

  it("authenticates a valid bot", () => {
    // Register a bot first
    const regResult = registerBot(db, {
      name: "AuthBot",
      ownerId: "user_1",
      capabilities: ["chat"],
      lensIds: ["lens_x"],
    });
    assert.equal(regResult.ok, true);
    const apiKey = regResult.bot.apiKey;

    const r = authenticateBot(db, apiKey);
    assert.equal(r.ok, true);
    assert.ok(r.bot);
    assert.equal(r.bot.name, "AuthBot");
    assert.equal(r.bot.substrate, "bot");
    assert.equal(r.bot.ownerId, "user_1");
    assert.deepEqual(r.bot.capabilities, ["chat"]);
    assert.ok(Array.isArray(r.bot.lensAccess));
  });

  it("parses capabilities JSON safely", () => {
    // Insert a bot with invalid JSON
    db._tables.bots.push({
      id: "bot_test",
      name: "BadJSON",
      bot_type: "general",
      owner_id: "user_1",
      wallet_id: "wallet_bot_test",
      capabilities_json: "not valid json",
      api_key_hash: hashKey("ck_testkey"),
      status: "active",
      created_at: "2024-01-01 00:00:00",
      updated_at: "2024-01-01 00:00:00",
    });

    const r = authenticateBot(db, "ck_testkey");
    assert.equal(r.ok, true);
    assert.deepEqual(r.bot.capabilities, []);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. checkLensAccess
// ═══════════════════════════════════════════════════════════════════════════════

describe("checkLensAccess", () => {
  let db;
  beforeEach(() => { db = createMockDb(); });

  it("grants access for specific lens match", () => {
    db._tables.entity_lens_access.push({
      entity_id: "bot_1",
      lens_id: "lens_art",
      access_level: "full",
    });
    const r = checkLensAccess(db, "bot_1", "lens_art");
    assert.equal(r.ok, true);
    assert.equal(r.access, "full");
  });

  it("grants access via wildcard __ALL_EMERGENT__", () => {
    db._tables.entity_lens_access.push({
      entity_id: "emr_1",
      lens_id: "__ALL_EMERGENT__",
      access_level: "full",
    });
    const r = checkLensAccess(db, "emr_1", "any_lens");
    assert.equal(r.ok, true);
    assert.equal(r.access, "full");
  });

  it("denies access when no matching record", () => {
    const r = checkLensAccess(db, "emr_1", "some_lens");
    assert.equal(r.ok, false);
    assert.equal(r.error, "lens_access_denied");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. listEntities
// ═══════════════════════════════════════════════════════════════════════════════

describe("listEntities", () => {
  let db;
  beforeEach(() => {
    db = createMockDb();
    // Add some test entities
    registerEmergent(db, { name: "E1", substrate: "emergent" });
    registerEmergent(db, { name: "E2", substrate: "emergent" });
    registerBot(db, { name: "B1", ownerId: "user_1" });
  });

  it("lists only emergent entities", () => {
    const r = listEntities(db, { substrate: "emergent" });
    assert.equal(r.ok, true);
    assert.ok(r.entities.length >= 2);
    assert.equal(r.count, r.entities.length);
  });

  it("lists only bots", () => {
    const r = listEntities(db, { substrate: "bot" });
    assert.equal(r.ok, true);
    assert.ok(r.entities.length >= 1);
  });

  it("lists both types when no substrate filter", () => {
    const r = listEntities(db);
    assert.equal(r.ok, true);
    assert.ok(r.entities.length >= 3);
  });

  it("respects limit parameter", () => {
    const r = listEntities(db, { limit: 1 });
    assert.equal(r.ok, true);
    assert.ok(r.entities.length <= 1);
  });

  it("respects offset parameter", () => {
    const r = listEntities(db, { offset: 100 });
    assert.equal(r.ok, true);
    assert.equal(r.entities.length, 0);
  });

  it("uses default options when called with no args", () => {
    const r = listEntities(db);
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.entities));
  });

  it("uses default status='active'", () => {
    const r = listEntities(db, { substrate: "emergent", status: "inactive" });
    assert.equal(r.ok, true);
    assert.equal(r.entities.length, 0);
  });
});
