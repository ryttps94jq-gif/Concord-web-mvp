// economy/emergent-auth.js
// Emergent entity and bot authentication + lens access.
// Emergents and bots are first-class citizens — they can authenticate,
// navigate lenses, create DTUs, and participate in the economy.

import { randomUUID, createHash } from "crypto";
import { awardMeritCredit } from "./lens-economy-wiring.js";

function uid(prefix = "ent") {
  return `${prefix}_` + randomUUID().replace(/-/g, "").slice(0, 16);
}

function nowISO() {
  return new Date().toISOString().replace("T", " ").replace("Z", "");
}

// Substrate types
const SUBSTRATES = {
  HUMAN: "human",
  EMERGENT: "emergent",
  BOT: "bot",
};

// ═══════════════════════════════════════════════════════════════════════════
// EMERGENT ENTITY REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register a new emergent entity as a first-class platform citizen.
 * Emergents get their own wallet, merit credit, and lens access.
 */
export function registerEmergent(db, {
  name, modelId, capabilities = [], sponsorId, substrate = "emergent",
}) {
  if (!name) return { ok: false, error: "missing_name" };

  const entityId = uid("emr");
  const walletId = `wallet_${entityId}`;
  const now = nowISO();

  const doRegister = db.transaction(() => {
    // Create emergent entity record
    db.prepare(`
      INSERT INTO emergent_entities (id, name, model_id, substrate, wallet_id,
        capabilities_json, sponsor_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(entityId, name, modelId || "unknown", substrate, walletId,
      JSON.stringify(capabilities), sponsorId || null, now, now);

    // Grant default lens access — emergent entities can access all emergent-enabled lenses
    db.prepare(`
      INSERT INTO entity_lens_access (id, entity_id, lens_id, access_level,
        granted_by, created_at)
      VALUES (?, ?, '__ALL_EMERGENT__', 'full', 'system', ?)
    `).run(uid("ela"), entityId, now);

    return { entityId, walletId };
  });

  try {
    const result = doRegister();
    return {
      ok: true,
      entity: {
        id: result.entityId,
        name,
        substrate,
        walletId: result.walletId,
        status: "active",
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Register a bot that can perform tasks and earn CC.
 */
export function registerBot(db, {
  name, botType, ownerId, capabilities = [], lensIds = [],
}) {
  if (!name || !ownerId) return { ok: false, error: "missing_params" };

  const botId = uid("bot");
  const walletId = `wallet_${botId}`;
  const apiKey = `ck_${randomUUID().replace(/-/g, "")}`;
  const now = nowISO();

  const doRegister = db.transaction(() => {
    db.prepare(`
      INSERT INTO bots (id, name, bot_type, owner_id, wallet_id,
        capabilities_json, api_key_hash, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(botId, name, botType || "general", ownerId, walletId,
      JSON.stringify(capabilities), hashKey(apiKey), now, now);

    // Grant lens access
    for (const lensId of lensIds) {
      db.prepare(`
        INSERT INTO entity_lens_access (id, entity_id, lens_id, access_level,
          granted_by, created_at)
        VALUES (?, ?, ?, 'full', ?, ?)
      `).run(uid("ela"), botId, lensId, ownerId, now);
    }

    return { botId, walletId };
  });

  try {
    const result = doRegister();
    awardMeritCredit(db, ownerId, "bot_registered", 5, { botId });
    return {
      ok: true,
      bot: {
        id: result.botId,
        name,
        walletId: result.walletId,
        apiKey, // Only returned once at creation
        lensAccess: lensIds,
        status: "active",
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Authenticate a bot by API key.
 */
export function authenticateBot(db, apiKey) {
  if (!apiKey) return { ok: false, error: "missing_api_key" };

  const bot = db.prepare(
    "SELECT * FROM bots WHERE api_key_hash = ? AND status = 'active'"
  ).get(hashKey(apiKey));

  if (!bot) return { ok: false, error: "invalid_api_key" };

  // Get lens access
  const access = db.prepare(
    "SELECT lens_id, access_level FROM entity_lens_access WHERE entity_id = ?"
  ).all(bot.id);

  return {
    ok: true,
    bot: {
      id: bot.id,
      name: bot.name,
      substrate: "bot",
      walletId: bot.wallet_id,
      ownerId: bot.owner_id,
      capabilities: safeJsonParse(bot.capabilities_json),
      lensAccess: access,
    },
  };
}

/**
 * Check if an entity (emergent or bot) can access a specific lens.
 */
export function checkLensAccess(db, entityId, lensId) {
  // Check specific lens access
  const specific = db.prepare(
    "SELECT * FROM entity_lens_access WHERE entity_id = ? AND (lens_id = ? OR lens_id = '__ALL_EMERGENT__')"
  ).get(entityId, lensId);

  if (specific) return { ok: true, access: specific.access_level };

  return { ok: false, error: "lens_access_denied" };
}

/**
 * Get all entities (emergents + bots) active on the platform.
 */
export function listEntities(db, { substrate, status = "active", limit = 50, offset = 0 } = {}) {
  let sql = "SELECT 'emergent' as type, id, name, substrate, wallet_id, status, created_at FROM emergent_entities WHERE status = ?";
  const params = [status];

  if (substrate === "emergent") {
    // Just emergents
  } else if (substrate === "bot") {
    sql = "SELECT 'bot' as type, id, name, 'bot' as substrate, wallet_id, status, created_at FROM bots WHERE status = ?";
  } else {
    // Both
    sql = `
      SELECT 'emergent' as type, id, name, substrate, wallet_id, status, created_at FROM emergent_entities WHERE status = ?
      UNION ALL
      SELECT 'bot' as type, id, name, 'bot' as substrate, wallet_id, status, created_at FROM bots WHERE status = ?
    `;
    params.push(status);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const entities = db.prepare(sql).all(...params);
  return { ok: true, entities, count: entities.length };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

function safeJsonParse(str) {
  try { return JSON.parse(str || "[]"); } catch { return []; }
}
