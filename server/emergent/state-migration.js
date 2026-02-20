/**
 * State Migration — Cross-Environment Civilization Transfer
 *
 * Civilizations are not tied to a single machine. They can be exported,
 * transferred, and imported across clouds, bare metal, and local dev.
 * This module provides the complete export/import pipeline:
 *
 *   Export: snapshot all state → serialize → checksum → package
 *   Import: validate → integrity check → conflict detect → merge → rebuild
 *
 * Supports three merge modes:
 *   - replace:             Wipe existing state, load import (destructive)
 *   - merge:               Add new items, skip existing (by ID)
 *   - merge_prefer_import: Add new, overwrite existing with imported
 *
 * Partial export/import allows transferring subsets of state —
 * specific entities, domains, or date ranges.
 *
 * All state in module-level Maps. Silent failure. No new dependencies.
 */

import crypto from "crypto";

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix = "mig") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function nowISO() {
  return new Date().toISOString();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function _getSTATE() {
  try {
    return globalThis._concordSTATE || globalThis.STATE || null;
  } catch {
    return null;
  }
}

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj, (_key, val) => {
      if (val instanceof Map) return { __type: "Map", entries: Array.from(val.entries()) };
      if (val instanceof Set) return { __type: "Set", values: Array.from(val) };
      if (typeof val === "function") return null;
      return val;
    }));
  } catch {
    return null;
  }
}

function mapToArray(map) {
  if (!(map instanceof Map)) return [];
  try { return Array.from(map.values()); } catch { return []; }
}

function mapEntriesToArray(map) {
  if (!(map instanceof Map)) return [];
  try { return Array.from(map.entries()).map(([k, v]) => ({ _key: k, ...v })); } catch { return []; }
}

function setToArray(set) {
  if (!(set instanceof Set)) return [];
  try { return Array.from(set); } catch { return []; }
}

function arrayToMap(arr, keyField = "id") {
  const map = new Map();
  if (!Array.isArray(arr)) return map;
  for (const item of arr) {
    const key = item?._key || item?.[keyField];
    if (key != null) {
      const cleaned = { ...item };
      delete cleaned._key;
      map.set(key, cleaned);
    }
  }
  return map;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MIGRATION_FORMAT = "concordos-migration-v1";
const MIGRATION_VERSION = "1.0.0";
export const COMPATIBLE_VERSIONS = Object.freeze(["1.0.0"]);

const MERGE_MODES = Object.freeze(["replace", "merge", "merge_prefer_import"]);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ── Migration Registry ──────────────────────────────────────────────────────

const _migrations = new Map(); // migrationId -> migration record

function recordMigration(type, extra = {}) {
  const migrationId = uid("mig");
  const record = {
    migrationId,
    type,
    status: "pending",
    mergeMode: extra.mergeMode || null,
    startedAt: nowISO(),
    completedAt: null,
    stats: {},
    errors: [],
    checksum: extra.checksum || "",
  };
  _migrations.set(migrationId, record);
  return record;
}

function completeMigration(record, stats, errors = []) {
  record.status = errors.length > 0 ? "failed" : "completed";
  record.completedAt = nowISO();
  record.stats = stats || {};
  record.errors = errors;
  return record;
}

// ── State Accessors ─────────────────────────────────────────────────────────
// Lazy access to avoid circular imports. Each accessor reaches into STATE
// the same way the owning module does.

function _getEmergentState(STATE) {
  try { return STATE?.__emergent || null; } catch { return null; }
}

function _getAtlasState(STATE) {
  try { return STATE?.__emergent?._atlas || null; } catch { return null; }
}

function _getTrustNetwork(STATE) {
  try { return STATE?.__emergent?._trustNetwork || null; } catch { return null; }
}

function _getCommsStore(STATE) {
  try { return STATE?.__emergent?._emergentComms || null; } catch { return null; }
}

function _getConstitutionStore(STATE) {
  try { return STATE?.__emergent?._constitution || null; } catch { return null; }
}

function _getInstitutionalMemory(STATE) {
  try { return STATE?.__emergent?._institutionalMemory || null; } catch { return null; }
}

// Module-level Maps accessed via dynamic import to avoid circular deps
async function _getModuleMaps() {
  const maps = {};
  try {
    const hyp = await import("./hypothesis-engine.js");
    if (typeof hyp.listHypotheses === "function") maps.hypotheses = hyp.listHypotheses;
    if (typeof hyp.getHypothesis === "function") maps.getHypothesis = hyp.getHypothesis;
  } catch { /* silent */ }
  try {
    const rj = await import("./research-jobs.js");
    if (typeof rj.listResearchJobs === "function") maps.researchJobs = rj.listResearchJobs;
  } catch { /* silent */ }
  try {
    const body = await import("./body-instantiation.js");
    if (typeof body.listBodies === "function") maps.listBodies = body.listBodies;
    if (typeof body.getBody === "function") maps.getBody = body.getBody;
  } catch { /* silent */ }
  try {
    const death = await import("./death-protocol.js");
    if (typeof death.getDeathRegistry === "function") maps.getDeathRegistry = death.getDeathRegistry;
    if (typeof death.listDeaths === "function") maps.listDeaths = death.listDeaths;
  } catch { /* silent */ }
  try {
    const bond = await import("./microbond-governance.js");
    if (typeof bond.listBonds === "function") maps.listBonds = bond.listBonds;
  } catch { /* silent */ }
  return maps;
}

// ── Checksum ────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 checksum of serialized data.
 * @param {*} data - Any JSON-serializable data
 * @returns {string} "sha256:<hex>"
 */
export function computeChecksum(data) {
  try {
    const json = typeof data === "string" ? data : JSON.stringify(data);
    const hash = crypto.createHash("sha256").update(json, "utf8").digest("hex");
    return `sha256:${hash}`;
  } catch {
    return "sha256:error";
  }
}

// ── Validate Package ────────────────────────────────────────────────────────

/**
 * Validate an export package for structural integrity and checksum.
 * @param {object} pkg - Migration package
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePackage(pkg) {
  const errors = [];

  if (!pkg || typeof pkg !== "object") {
    return { ok: false, errors: ["Package is not an object"] };
  }

  // Format check
  if (pkg.format !== MIGRATION_FORMAT) {
    errors.push(`Invalid format: expected "${MIGRATION_FORMAT}", got "${pkg.format}"`);
  }

  // Version compatibility
  if (!COMPATIBLE_VERSIONS.includes(pkg.version)) {
    errors.push(`Incompatible version: "${pkg.version}". Compatible: ${COMPATIBLE_VERSIONS.join(", ")}`);
  }

  // Required fields
  const required = ["exportedAt", "exportedBy", "checksum"];
  for (const field of required) {
    if (!pkg[field]) errors.push(`Missing required field: ${field}`);
  }

  // Checksum verification
  if (pkg.checksum && pkg.checksum !== "sha256:error") {
    try {
      const payload = extractPayload(pkg);
      const computed = computeChecksum(payload);
      if (computed !== pkg.checksum) {
        errors.push(`Checksum mismatch: expected ${pkg.checksum}, computed ${computed}`);
      }
    } catch (e) {
      errors.push(`Checksum verification failed: ${e.message}`);
    }
  }

  // Data arrays should be arrays if present
  const arrayFields = [
    "dtus", "entities", "bodies", "trustNetwork", "commsMessages",
    "hypotheses", "researchJobs", "constitution", "bonds", "disputes",
    "events", "deaths", "eras", "traditions", "creativeWorks",
    "accounts", "trades",
  ];
  for (const field of arrayFields) {
    if (pkg[field] !== undefined && !Array.isArray(pkg[field])) {
      errors.push(`Field "${field}" should be an array, got ${typeof pkg[field]}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Extract the data payload (everything except metadata/checksum) for checksum computation.
 */
function extractPayload(pkg) {
  const { checksum, stats, ...payload } = pkg;
  return payload;
}

// ── Pre-flight Check ────────────────────────────────────────────────────────

function preflightCheck(STATE) {
  const errors = [];

  if (!STATE) {
    errors.push("STATE is null or undefined");
    return { ok: false, errors };
  }

  const es = _getEmergentState(STATE);
  if (!es) {
    errors.push("Emergent state not initialized");
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors,
    counts: {
      emergents: es.emergents?.size || 0,
      sessions: es.sessions?.size || 0,
      patterns: es.patterns?.size || 0,
    },
  };
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

async function snapshotState(STATE) {
  const es = _getEmergentState(STATE);
  const atlas = _getAtlasState(STATE);
  const trust = _getTrustNetwork(STATE);
  const comms = _getCommsStore(STATE);
  const constitution = _getConstitutionStore(STATE);
  const memory = _getInstitutionalMemory(STATE);

  // Collect DTUs from atlas
  const dtus = atlas ? mapToArray(atlas.dtus) : [];

  // Collect emergent entities
  const entities = es ? mapToArray(es.emergents) : [];

  // Collect bodies from module-level store
  let bodies = [];
  let hypotheses = [];
  let researchJobs = [];
  let deaths = [];
  let bonds = [];

  try {
    const mods = await _getModuleMaps();
    if (mods.listBodies) {
      const bodyResult = mods.listBodies();
      bodies = Array.isArray(bodyResult) ? bodyResult
        : (bodyResult?.bodies || []);
    }
    if (mods.hypotheses) {
      const hypResult = mods.hypotheses();
      hypotheses = Array.isArray(hypResult) ? hypResult
        : (hypResult?.hypotheses || []);
    }
    if (mods.researchJobs) {
      const rjResult = mods.researchJobs();
      researchJobs = Array.isArray(rjResult) ? rjResult
        : (rjResult?.jobs || []);
    }
    if (mods.listDeaths) {
      const deathResult = mods.listDeaths();
      deaths = Array.isArray(deathResult) ? deathResult
        : (deathResult?.deaths || []);
    }
    if (mods.listBonds) {
      const bondResult = mods.listBonds();
      bonds = Array.isArray(bondResult) ? bondResult
        : (bondResult?.bonds || []);
    }
  } catch { /* silent — modules may not be loaded */ }

  // Trust network edges
  const trustNetwork = trust ? mapEntriesToArray(trust.edges) : [];

  // Comms messages (last 7 days)
  let commsMessages = [];
  if (comms?.messages) {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    commsMessages = mapToArray(comms.messages).filter(m => {
      try {
        return new Date(m.timestamp || m.sentAt || 0).getTime() >= cutoff;
      } catch { return false; }
    });
  }

  // Constitution rules
  const constitutionRules = constitution ? mapToArray(constitution.rules) : [];

  // Disputes from constitution violations
  const disputes = constitution?.violations || [];

  // Historical events from institutional memory
  const events = memory?.observations || [];

  // Eras — check for era state on emergent state
  const eras = es?._eras ? mapToArray(es._eras) : (es?._eraProgression || []);

  // Traditions and creative works — check on emergent state or social state
  const traditions = es?._traditions ? mapToArray(es._traditions)
    : (Array.isArray(es?._traditions) ? es._traditions : []);
  const creativeWorks = es?._creativeWorks ? mapToArray(es._creativeWorks)
    : (Array.isArray(es?._creativeWorks) ? es._creativeWorks : []);

  // Economy — accounts and trades from social layer or STATE
  const accounts = STATE?._social?.profiles ? mapToArray(STATE._social.profiles) : [];
  const trades = STATE?._social?.tradeHistory || [];

  return {
    dtus,
    entities,
    bodies,
    trustNetwork,
    commsMessages,
    hypotheses,
    researchJobs,
    constitution: constitutionRules,
    bonds,
    disputes,
    events,
    deaths,
    eras,
    traditions,
    creativeWorks,
    accounts,
    trades,
  };
}

// ── Export Full ──────────────────────────────────────────────────────────────

/**
 * Export the full civilization state as a portable migration package.
 * @param {object} [STATE] - Global state (auto-detected if omitted)
 * @returns {Promise<{ ok: boolean, package?: object, error?: string }>}
 */
export async function exportFull(STATE) {
  const startTime = Date.now();
  const resolvedState = STATE || _getSTATE();
  const migration = recordMigration("export");

  try {
    migration.status = "in_progress";

    // Pre-flight
    const preflight = preflightCheck(resolvedState);
    if (!preflight.ok) {
      completeMigration(migration, {}, preflight.errors);
      return { ok: false, error: preflight.errors.join("; "), migrationId: migration.migrationId };
    }

    // Snapshot
    const snapshot = await snapshotState(resolvedState);

    // Build payload (without checksum — computed after)
    const payload = {
      format: MIGRATION_FORMAT,
      version: MIGRATION_VERSION,
      exportedAt: nowISO(),
      exportedBy: "sovereign",
      checksum: "", // placeholder

      // Core state
      dtus: snapshot.dtus,
      entities: snapshot.entities,
      bodies: snapshot.bodies,

      // Relationships
      trustNetwork: snapshot.trustNetwork,
      commsMessages: snapshot.commsMessages,

      // Knowledge
      hypotheses: snapshot.hypotheses,
      researchJobs: snapshot.researchJobs,

      // Governance
      constitution: snapshot.constitution,
      bonds: snapshot.bonds,
      disputes: snapshot.disputes,

      // History
      events: snapshot.events,
      deaths: snapshot.deaths,
      eras: snapshot.eras,

      // Culture
      traditions: snapshot.traditions,
      creativeWorks: snapshot.creativeWorks,

      // Economy
      accounts: snapshot.accounts,
      trades: snapshot.trades,
    };

    // Compute checksum over the payload
    const checksumPayload = { ...payload };
    delete checksumPayload.checksum;
    payload.checksum = computeChecksum(checksumPayload);
    migration.checksum = payload.checksum;

    // Stats
    const exportDuration = Date.now() - startTime;
    const es = _getEmergentState(resolvedState);
    payload.stats = {
      totalDTUs: snapshot.dtus.length,
      totalEntities: snapshot.entities.length,
      totalEvents: snapshot.events.length,
      totalBodies: snapshot.bodies.length,
      totalHypotheses: snapshot.hypotheses.length,
      totalBonds: snapshot.bonds.length,
      totalDeaths: snapshot.deaths.length,
      currentEra: snapshot.eras.length > 0 ? snapshot.eras[snapshot.eras.length - 1] : null,
      civilizationAge: es?.initializedAt || null,
      exportDuration: `${exportDuration}ms`,
    };

    // Validate before returning
    const validation = validatePackage(payload);
    if (!validation.ok) {
      completeMigration(migration, payload.stats, validation.errors);
      return { ok: false, error: "Post-export validation failed", details: validation.errors, migrationId: migration.migrationId };
    }

    completeMigration(migration, payload.stats);
    return { ok: true, package: payload, migrationId: migration.migrationId };
  } catch (e) {
    completeMigration(migration, {}, [e.message]);
    return { ok: false, error: e.message, migrationId: migration.migrationId };
  }
}

// ── Export Partial ───────────────────────────────────────────────────────────

/**
 * Export a subset of civilization state.
 * @param {object} options - Filter options
 * @param {string[]} [options.entities] - Specific entity IDs to export
 * @param {string[]} [options.domains] - DTU domain filters
 * @param {{ from?: string, to?: string }} [options.dateRange] - Date range for events
 * @param {boolean} [options.includeRelationships=true] - Include trust/comms for selected entities
 * @param {boolean} [options.includeHistory=true] - Include events for selected entities
 * @param {object} [STATE] - Global state
 * @returns {Promise<{ ok: boolean, package?: object }>}
 */
export async function exportPartial(options = {}, STATE) {
  const startTime = Date.now();
  const resolvedState = STATE || _getSTATE();
  const migration = recordMigration("export");

  try {
    migration.status = "in_progress";

    const preflight = preflightCheck(resolvedState);
    if (!preflight.ok) {
      completeMigration(migration, {}, preflight.errors);
      return { ok: false, error: preflight.errors.join("; "), migrationId: migration.migrationId };
    }

    const fullSnapshot = await snapshotState(resolvedState);
    const entityFilter = options.entities ? new Set(options.entities) : null;
    const domainFilter = options.domains ? new Set(options.domains) : null;
    const includeRel = options.includeRelationships !== false;
    const includeHist = options.includeHistory !== false;

    // Date range parsing
    let dateFrom = 0;
    let dateTo = Infinity;
    if (options.dateRange) {
      if (options.dateRange.from) dateFrom = new Date(options.dateRange.from).getTime() || 0;
      if (options.dateRange.to) dateTo = new Date(options.dateRange.to).getTime() || Infinity;
    }

    function inDateRange(timestamp) {
      try {
        const t = new Date(timestamp).getTime();
        return t >= dateFrom && t <= dateTo;
      } catch { return true; }
    }

    // Filter entities
    let entities = fullSnapshot.entities;
    if (entityFilter) {
      entities = entities.filter(e => entityFilter.has(e.id));
    }
    const exportedEntityIds = new Set(entities.map(e => e.id));

    // Filter DTUs by domain or entity ownership
    let dtus = fullSnapshot.dtus;
    if (domainFilter) {
      dtus = dtus.filter(d => domainFilter.has(d.domainType) || domainFilter.has(d.domain));
    }
    if (entityFilter) {
      dtus = dtus.filter(d =>
        exportedEntityIds.has(d.authorId) ||
        exportedEntityIds.has(d.createdBy) ||
        exportedEntityIds.has(d.emergentId)
      );
    }

    // Filter bodies
    let bodies = fullSnapshot.bodies;
    if (entityFilter) {
      bodies = bodies.filter(b => exportedEntityIds.has(b.entityId) || exportedEntityIds.has(b.emergentId));
    }

    // Filter trust network
    let trustNetwork = [];
    if (includeRel) {
      trustNetwork = fullSnapshot.trustNetwork.filter(e =>
        !entityFilter || exportedEntityIds.has(e.fromId) || exportedEntityIds.has(e.toId)
      );
    }

    // Filter comms
    let commsMessages = [];
    if (includeRel) {
      commsMessages = fullSnapshot.commsMessages.filter(m =>
        !entityFilter || exportedEntityIds.has(m.fromId) || exportedEntityIds.has(m.toId)
      );
    }

    // Filter events by date range
    let events = fullSnapshot.events;
    if (options.dateRange) {
      events = events.filter(e => inDateRange(e.timestamp || e.recordedAt));
    }
    if (entityFilter && includeHist) {
      events = events.filter(e =>
        !e.entityId || exportedEntityIds.has(e.entityId)
      );
    }

    // Hypotheses — include all if no entity filter, else filter by author
    let hypotheses = fullSnapshot.hypotheses;
    if (entityFilter) {
      hypotheses = hypotheses.filter(h =>
        exportedEntityIds.has(h.authorId) || exportedEntityIds.has(h.proposedBy)
      );
    }

    // Research jobs
    let researchJobs = fullSnapshot.researchJobs;

    // Deaths
    let deaths = fullSnapshot.deaths;
    if (entityFilter) {
      deaths = deaths.filter(d => exportedEntityIds.has(d.entityId));
    }

    const payload = {
      format: MIGRATION_FORMAT,
      version: MIGRATION_VERSION,
      exportedAt: nowISO(),
      exportedBy: "sovereign",
      checksum: "",
      partial: true,
      partialOptions: {
        entities: options.entities || null,
        domains: options.domains || null,
        dateRange: options.dateRange || null,
        includeRelationships: includeRel,
        includeHistory: includeHist,
      },

      dtus,
      entities,
      bodies,
      trustNetwork,
      commsMessages,
      hypotheses,
      researchJobs,
      constitution: fullSnapshot.constitution,
      bonds: fullSnapshot.bonds,
      disputes: fullSnapshot.disputes,
      events,
      deaths,
      eras: fullSnapshot.eras,
      traditions: fullSnapshot.traditions,
      creativeWorks: fullSnapshot.creativeWorks,
      accounts: fullSnapshot.accounts,
      trades: fullSnapshot.trades,
    };

    const checksumPayload = { ...payload };
    delete checksumPayload.checksum;
    payload.checksum = computeChecksum(checksumPayload);
    migration.checksum = payload.checksum;

    const exportDuration = Date.now() - startTime;
    payload.stats = {
      totalDTUs: dtus.length,
      totalEntities: entities.length,
      totalEvents: events.length,
      totalBodies: bodies.length,
      totalHypotheses: hypotheses.length,
      totalBonds: fullSnapshot.bonds.length,
      totalDeaths: deaths.length,
      currentEra: fullSnapshot.eras.length > 0 ? fullSnapshot.eras[fullSnapshot.eras.length - 1] : null,
      civilizationAge: _getEmergentState(resolvedState)?.initializedAt || null,
      exportDuration: `${exportDuration}ms`,
    };

    completeMigration(migration, payload.stats);
    return { ok: true, package: payload, migrationId: migration.migrationId };
  } catch (e) {
    completeMigration(migration, {}, [e.message]);
    return { ok: false, error: e.message, migrationId: migration.migrationId };
  }
}

// ── Migration Plan (Dry Run) ────────────────────────────────────────────────

/**
 * Analyze an import package without applying it.
 * @param {object} pkg - Migration package
 * @param {object} [STATE] - Global state
 * @returns {Promise<{ ok: boolean, plan?: object }>}
 */
export async function createMigrationPlan(pkg, STATE) {
  const resolvedState = STATE || _getSTATE();

  try {
    // Validate first
    const validation = validatePackage(pkg);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors };
    }

    const es = _getEmergentState(resolvedState);
    const atlas = _getAtlasState(resolvedState);

    // Count new vs conflicting entities
    const existingEntityIds = es ? new Set(es.emergents.keys()) : new Set();
    const importEntityIds = (pkg.entities || []).map(e => e.id).filter(Boolean);
    let newEntities = 0;
    let conflictingEntities = 0;
    for (const id of importEntityIds) {
      if (existingEntityIds.has(id)) conflictingEntities++;
      else newEntities++;
    }

    // Count new vs conflicting DTUs
    const existingDtuIds = atlas ? new Set(atlas.dtus.keys()) : new Set();
    const importDtuIds = (pkg.dtus || []).map(d => d.id).filter(Boolean);
    let newDTUs = 0;
    let conflictingDTUs = 0;
    for (const id of importDtuIds) {
      if (existingDtuIds.has(id)) conflictingDTUs++;
      else newDTUs++;
    }

    // Count new events
    const newEvents = (pkg.events || []).length;

    // Find missing references — IDs referenced in trust edges that don't exist
    // in the import package entities
    const packageEntityIds = new Set(importEntityIds);
    const missingReferences = [];
    const brokenRelationships = [];

    for (const edge of (pkg.trustNetwork || [])) {
      const fromId = edge.fromId || edge._key?.split("→")[0];
      const toId = edge.toId || edge._key?.split("→")[1];
      if (fromId && !packageEntityIds.has(fromId) && !existingEntityIds.has(fromId)) {
        missingReferences.push(fromId);
      }
      if (toId && !packageEntityIds.has(toId) && !existingEntityIds.has(toId)) {
        missingReferences.push(toId);
      }
      if (fromId && toId && (!packageEntityIds.has(fromId) || !packageEntityIds.has(toId))) {
        brokenRelationships.push({ from: fromId, to: toId, reason: "endpoint_missing" });
      }
    }

    // Estimate duration based on total items
    const totalItems = (pkg.dtus?.length || 0) + (pkg.entities?.length || 0)
      + (pkg.events?.length || 0) + (pkg.trustNetwork?.length || 0)
      + (pkg.bodies?.length || 0) + (pkg.hypotheses?.length || 0);
    const estimatedMs = Math.max(100, Math.ceil(totalItems * 0.1));
    const estimatedDuration = estimatedMs > 1000
      ? `${(estimatedMs / 1000).toFixed(1)}s`
      : `${estimatedMs}ms`;

    // Warnings
    const warnings = [];
    if (conflictingEntities > 0) warnings.push(`${conflictingEntities} entity ID collision(s)`);
    if (conflictingDTUs > 0) warnings.push(`${conflictingDTUs} DTU ID collision(s)`);
    if (missingReferences.length > 0) warnings.push(`${missingReferences.length} missing reference(s)`);
    if (brokenRelationships.length > 0) warnings.push(`${brokenRelationships.length} broken relationship(s)`);
    if (pkg.partial) warnings.push("Package is a partial export — some state may be missing");

    // Recommendation
    let recommendation = "merge";
    if (conflictingEntities === 0 && conflictingDTUs === 0) {
      recommendation = "merge";
    } else if (conflictingEntities > newEntities || conflictingDTUs > newDTUs) {
      recommendation = "replace";
    }

    const plan = {
      newEntities,
      conflictingEntities,
      newDTUs,
      conflictingDTUs,
      newEvents,
      missingReferences: [...new Set(missingReferences)],
      brokenRelationships,
      estimatedDuration,
      warnings,
      recommendation,
    };

    return { ok: true, plan };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Import Helpers ──────────────────────────────────────────────────────────

function mergeArrayIntoMap(map, arr, keyField, mode) {
  if (!map || !Array.isArray(arr)) return { added: 0, overwritten: 0, skipped: 0 };
  let added = 0, overwritten = 0, skipped = 0;

  for (const item of arr) {
    const key = item?._key || item?.[keyField];
    if (key == null) { skipped++; continue; }

    const exists = map.has(key);
    const cleaned = { ...item };
    delete cleaned._key;

    if (!exists) {
      map.set(key, cleaned);
      added++;
    } else if (mode === "merge_prefer_import") {
      map.set(key, cleaned);
      overwritten++;
    } else if (mode === "replace") {
      map.set(key, cleaned);
      overwritten++;
    } else {
      // mode === "merge" — skip existing
      skipped++;
    }
  }

  return { added, overwritten, skipped };
}

function mergeArrayIntoArray(existing, incoming) {
  if (!Array.isArray(incoming)) return { added: 0 };
  if (!Array.isArray(existing)) return { added: 0 };
  const before = existing.length;
  existing.push(...incoming);
  return { added: incoming.length, totalAfter: existing.length };
}

// ── Import Full ─────────────────────────────────────────────────────────────

/**
 * Import a full migration package into the current civilization.
 * @param {object} pkg - Migration package from exportFull
 * @param {string} [mergeMode="merge"] - "replace" | "merge" | "merge_prefer_import"
 * @param {object} [STATE] - Global state
 * @returns {Promise<{ ok: boolean, summary?: object }>}
 */
export async function importFull(pkg, mergeMode = "merge", STATE) {
  const startTime = Date.now();
  const resolvedState = STATE || _getSTATE();
  const migration = recordMigration("import", { mergeMode, checksum: pkg?.checksum });

  try {
    migration.status = "in_progress";

    // Validate package
    const validation = validatePackage(pkg);
    if (!validation.ok) {
      completeMigration(migration, {}, validation.errors);
      return { ok: false, errors: validation.errors, migrationId: migration.migrationId };
    }

    // Validate merge mode
    if (!MERGE_MODES.includes(mergeMode)) {
      const err = `Invalid merge mode: "${mergeMode}". Use: ${MERGE_MODES.join(", ")}`;
      completeMigration(migration, {}, [err]);
      return { ok: false, error: err, migrationId: migration.migrationId };
    }

    const es = _getEmergentState(resolvedState);
    if (!es) {
      completeMigration(migration, {}, ["Emergent state not initialized"]);
      return { ok: false, error: "Emergent state not initialized", migrationId: migration.migrationId };
    }

    const summary = {
      mergeMode,
      entities: { added: 0, overwritten: 0, skipped: 0 },
      dtus: { added: 0, overwritten: 0, skipped: 0 },
      bodies: { added: 0, overwritten: 0, skipped: 0 },
      trustEdges: { added: 0, overwritten: 0, skipped: 0 },
      commsMessages: { added: 0 },
      hypotheses: { added: 0 },
      researchJobs: { added: 0 },
      constitution: { added: 0, overwritten: 0, skipped: 0 },
      bonds: { added: 0 },
      disputes: { added: 0 },
      events: { added: 0 },
      deaths: { added: 0 },
      eras: { added: 0 },
      traditions: { added: 0 },
      creativeWorks: { added: 0 },
      accounts: { added: 0, overwritten: 0, skipped: 0 },
      trades: { added: 0 },
      errors: [],
    };

    // If replace mode, wipe existing state first
    if (mergeMode === "replace") {
      try {
        es.emergents.clear();
        es.reputations.clear();
        es.patterns.clear();
        es.sessions.clear();
        es.outputBundles.clear();
        es.sessionsByEmergent.clear();
        es.contentHashes.clear();

        if (es._atlas) {
          es._atlas.dtus.clear();
          es._atlas.claims.clear();
          es._atlas.sources.clear();
          es._atlas.links = [];
          es._atlas.entities.clear();
          es._atlas.about.clear();
          es._atlas.audit = [];
        }
        if (es._trustNetwork) {
          es._trustNetwork.edges.clear();
          es._trustNetwork.aggregates.clear();
        }
        if (es._emergentComms) {
          es._emergentComms.messages.clear();
          es._emergentComms.inbox.clear();
          es._emergentComms.channels.clear();
        }
        if (es._constitution) {
          es._constitution.rules.clear();
          es._constitution.amendments = [];
          es._constitution.violations = [];
        }
        if (es._institutionalMemory) {
          es._institutionalMemory.observations = [];
          es._institutionalMemory.advisories.clear();
        }
      } catch (e) {
        summary.errors.push(`State wipe error: ${e.message}`);
      }
    }

    // Import entities
    try {
      summary.entities = mergeArrayIntoMap(es.emergents, pkg.entities || [], "id", mergeMode);
    } catch (e) { summary.errors.push(`Entity import error: ${e.message}`); }

    // Import DTUs
    try {
      const atlas = _getAtlasState(resolvedState);
      if (atlas?.dtus) {
        summary.dtus = mergeArrayIntoMap(atlas.dtus, pkg.dtus || [], "id", mergeMode);
      }
    } catch (e) { summary.errors.push(`DTU import error: ${e.message}`); }

    // Import trust edges
    try {
      const trust = _getTrustNetwork(resolvedState);
      if (trust?.edges) {
        summary.trustEdges = mergeArrayIntoMap(trust.edges, pkg.trustNetwork || [], "_key", mergeMode);
      }
    } catch (e) { summary.errors.push(`Trust import error: ${e.message}`); }

    // Import comms messages
    try {
      const comms = _getCommsStore(resolvedState);
      if (comms?.messages) {
        const result = mergeArrayIntoMap(comms.messages, pkg.commsMessages || [], "messageId", mergeMode);
        summary.commsMessages = { added: result.added + result.overwritten };
      }
    } catch (e) { summary.errors.push(`Comms import error: ${e.message}`); }

    // Import constitution rules
    try {
      const constitution = _getConstitutionStore(resolvedState);
      if (constitution?.rules) {
        summary.constitution = mergeArrayIntoMap(constitution.rules, pkg.constitution || [], "ruleId", mergeMode);
      }
    } catch (e) { summary.errors.push(`Constitution import error: ${e.message}`); }

    // Import disputes (append to violations array)
    try {
      const constitution = _getConstitutionStore(resolvedState);
      if (constitution && Array.isArray(pkg.disputes)) {
        if (!Array.isArray(constitution.violations)) constitution.violations = [];
        const result = mergeArrayIntoArray(constitution.violations, pkg.disputes);
        summary.disputes = { added: result.added };
      }
    } catch (e) { summary.errors.push(`Dispute import error: ${e.message}`); }

    // Import events (append to institutional memory observations)
    try {
      const memory = _getInstitutionalMemory(resolvedState);
      if (memory && Array.isArray(pkg.events)) {
        if (!Array.isArray(memory.observations)) memory.observations = [];
        const result = mergeArrayIntoArray(memory.observations, pkg.events);
        summary.events = { added: result.added };
      }
    } catch (e) { summary.errors.push(`Event import error: ${e.message}`); }

    // Import eras
    try {
      if (Array.isArray(pkg.eras) && pkg.eras.length > 0) {
        if (!es._eraProgression) es._eraProgression = [];
        if (mergeMode === "replace") es._eraProgression = [];
        const result = mergeArrayIntoArray(es._eraProgression, pkg.eras);
        summary.eras = { added: result.added };
      }
    } catch (e) { summary.errors.push(`Era import error: ${e.message}`); }

    // Import traditions
    try {
      if (Array.isArray(pkg.traditions) && pkg.traditions.length > 0) {
        if (!es._traditions) es._traditions = new Map();
        if (mergeMode === "replace" && es._traditions instanceof Map) es._traditions.clear();
        if (es._traditions instanceof Map) {
          const result = mergeArrayIntoMap(es._traditions, pkg.traditions, "id", mergeMode);
          summary.traditions = { added: result.added };
        }
      }
    } catch (e) { summary.errors.push(`Tradition import error: ${e.message}`); }

    // Import creative works
    try {
      if (Array.isArray(pkg.creativeWorks) && pkg.creativeWorks.length > 0) {
        if (!es._creativeWorks) es._creativeWorks = new Map();
        if (mergeMode === "replace" && es._creativeWorks instanceof Map) es._creativeWorks.clear();
        if (es._creativeWorks instanceof Map) {
          const result = mergeArrayIntoMap(es._creativeWorks, pkg.creativeWorks, "id", mergeMode);
          summary.creativeWorks = { added: result.added };
        }
      }
    } catch (e) { summary.errors.push(`Creative works import error: ${e.message}`); }

    // Import accounts (profiles)
    try {
      if (Array.isArray(pkg.accounts) && pkg.accounts.length > 0) {
        if (!resolvedState._social) resolvedState._social = { profiles: new Map() };
        if (!resolvedState._social.profiles) resolvedState._social.profiles = new Map();
        if (mergeMode === "replace") resolvedState._social.profiles.clear();
        summary.accounts = mergeArrayIntoMap(resolvedState._social.profiles, pkg.accounts, "userId", mergeMode);
      }
    } catch (e) { summary.errors.push(`Account import error: ${e.message}`); }

    // Import trades
    try {
      if (Array.isArray(pkg.trades) && pkg.trades.length > 0) {
        if (!resolvedState._social) resolvedState._social = {};
        if (!Array.isArray(resolvedState._social.tradeHistory)) resolvedState._social.tradeHistory = [];
        if (mergeMode === "replace") resolvedState._social.tradeHistory = [];
        const result = mergeArrayIntoArray(resolvedState._social.tradeHistory, pkg.trades);
        summary.trades = { added: result.added };
      }
    } catch (e) { summary.errors.push(`Trade import error: ${e.message}`); }

    // Post-import validation
    const postValidation = postImportValidation(resolvedState, summary);
    if (postValidation.warnings.length > 0) {
      summary.warnings = postValidation.warnings;
    }

    summary.duration = `${Date.now() - startTime}ms`;
    summary.importedAt = nowISO();

    const hasErrors = summary.errors.length > 0;
    completeMigration(migration, summary, summary.errors);
    return {
      ok: !hasErrors,
      summary,
      migrationId: migration.migrationId,
      warnings: postValidation.warnings,
    };
  } catch (e) {
    completeMigration(migration, {}, [e.message]);
    return { ok: false, error: e.message, migrationId: migration.migrationId };
  }
}

// ── Import Partial ──────────────────────────────────────────────────────────

/**
 * Import a partial migration package.
 * Identical to importFull but logs as partial in migration registry.
 * @param {object} pkg - Migration package from exportPartial
 * @param {string} [mergeMode="merge"] - Merge strategy
 * @param {object} [STATE] - Global state
 * @returns {Promise<{ ok: boolean, summary?: object }>}
 */
export async function importPartial(pkg, mergeMode = "merge", STATE) {
  // Partial imports always use merge or merge_prefer_import, never replace
  const safeMergeMode = mergeMode === "replace" ? "merge" : mergeMode;

  const result = await importFull(pkg, safeMergeMode, STATE);

  // Update the migration record to note it was partial
  if (result.migrationId) {
    const record = _migrations.get(result.migrationId);
    if (record) {
      record.type = "import_partial";
      record.stats.partial = true;
      record.stats.partialOptions = pkg?.partialOptions || null;
    }
  }

  return result;
}

// ── Post-Import Validation ──────────────────────────────────────────────────

function postImportValidation(STATE, summary) {
  const warnings = [];

  try {
    const es = _getEmergentState(STATE);
    if (!es) {
      warnings.push("Emergent state is null after import");
      return { warnings };
    }

    const entityCount = es.emergents?.size || 0;
    const trust = _getTrustNetwork(STATE);
    const trustEdgeCount = trust?.edges?.size || 0;

    // Check referential integrity: trust edges should reference existing entities
    if (trust?.edges) {
      let orphanedEdges = 0;
      for (const [key] of trust.edges) {
        try {
          const parts = key.split("→");
          if (parts.length === 2) {
            const [fromId, toId] = parts;
            if (!es.emergents.has(fromId) && !es.emergents.has(toId)) {
              orphanedEdges++;
            }
          }
        } catch { /* silent */ }
      }
      if (orphanedEdges > 0) {
        warnings.push(`${orphanedEdges} trust edge(s) reference non-existent entities`);
      }
    }

    // Check DTU count consistency
    const atlas = _getAtlasState(STATE);
    const dtuCount = atlas?.dtus?.size || 0;

    // Verify basic counts are reasonable
    if (entityCount === 0 && summary.entities?.added > 0) {
      warnings.push("Entity map is empty despite importing entities — possible state init issue");
    }
    if (dtuCount === 0 && summary.dtus?.added > 0) {
      warnings.push("DTU map is empty despite importing DTUs — possible atlas init issue");
    }
  } catch (e) {
    warnings.push(`Post-import validation error: ${e.message}`);
  }

  return { warnings };
}

// ── Migration History ───────────────────────────────────────────────────────

/**
 * List all past migration records.
 * @returns {{ ok: boolean, migrations: object[] }}
 */
export function getMigrationHistory() {
  try {
    const all = Array.from(_migrations.values());
    all.sort((a, b) => {
      try { return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(); }
      catch { return 0; }
    });
    return { ok: true, migrations: all, total: all.length };
  } catch {
    return { ok: true, migrations: [], total: 0 };
  }
}

/**
 * Get a specific migration record.
 * @param {string} migrationId
 * @returns {{ ok: boolean, migration?: object }}
 */
export function getMigration(migrationId) {
  try {
    const record = _migrations.get(migrationId);
    if (!record) return { ok: false, error: "Migration not found" };
    return { ok: true, migration: record };
  } catch {
    return { ok: false, error: "Lookup failed" };
  }
}

// ── Migration Metrics ───────────────────────────────────────────────────────

/**
 * Aggregate metrics across all migrations.
 * @returns {{ ok: boolean, metrics: object }}
 */
export function getMigrationMetrics() {
  try {
    const all = Array.from(_migrations.values());
    const exports = all.filter(m => m.type === "export");
    const imports = all.filter(m => m.type === "import" || m.type === "import_partial");
    const completed = all.filter(m => m.status === "completed");
    const failed = all.filter(m => m.status === "failed");

    // Compute total entities migrated
    let totalEntitiesExported = 0;
    let totalEntitiesImported = 0;
    let totalDTUsExported = 0;
    let totalDTUsImported = 0;

    for (const m of exports) {
      totalEntitiesExported += m.stats?.totalEntities || 0;
      totalDTUsExported += m.stats?.totalDTUs || 0;
    }
    for (const m of imports) {
      totalEntitiesImported += m.stats?.entities?.added || 0;
      totalDTUsImported += m.stats?.dtus?.added || 0;
    }

    // Most recent migration
    const lastMigration = all.length > 0
      ? all.sort((a, b) => {
          try { return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(); }
          catch { return 0; }
        })[0]
      : null;

    return {
      ok: true,
      metrics: {
        totalMigrations: all.length,
        totalExports: exports.length,
        totalImports: imports.length,
        completedMigrations: completed.length,
        failedMigrations: failed.length,
        totalEntitiesExported,
        totalEntitiesImported,
        totalDTUsExported,
        totalDTUsImported,
        lastMigrationId: lastMigration?.migrationId || null,
        lastMigrationAt: lastMigration?.startedAt || null,
        lastMigrationStatus: lastMigration?.status || null,
      },
    };
  } catch {
    return {
      ok: true,
      metrics: {
        totalMigrations: 0,
        totalExports: 0,
        totalImports: 0,
        completedMigrations: 0,
        failedMigrations: 0,
        totalEntitiesExported: 0,
        totalEntitiesImported: 0,
        totalDTUsExported: 0,
        totalDTUsImported: 0,
        lastMigrationId: null,
        lastMigrationAt: null,
        lastMigrationStatus: null,
      },
    };
  }
}
