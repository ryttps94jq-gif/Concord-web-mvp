/**
 * Emergent Agent Governance — 13-Sector Architecture
 *
 * Sectors are depth layers corresponding to noise-to-signal ratios.
 * Lower sector numbers = more noise, higher = more signal, deeper operation.
 *
 * Each sector enforces:
 *   - Noise floor threshold — operations below this signal quality are rejected
 *   - Access control — emergents can only operate in sectors matching their maturity
 *   - Monitoring — sector health tracked
 *   - Cross-sector communication protocol — managed routing
 *
 * The constraint equation x² - x = 0 operates here: an emergent either
 * qualifies for a sector (x=1) or does not (x=0). No partial access.
 */

import { getEmergentState, getReputation, getPatterns } from "./store.js";

// ── Sector Definitions ──────────────────────────────────────────────────────

export const SECTORS = Object.freeze({
  CORE:                { id: 0,  name: "core",                noiseFloor: 0.0,   accessLevel: "governor" },
  BOUNDARY:            { id: 1,  name: "boundary_interface",   noiseFloor: 0.9,   accessLevel: "system" },
  SIGNAL_FILTER:       { id: 2,  name: "signal_filtering",     noiseFloor: 0.7,   accessLevel: "system" },
  PATTERN_RECOGNITION: { id: 3,  name: "pattern_recognition",  noiseFloor: 0.5,   accessLevel: "emergent" },
  MEMORY:              { id: 4,  name: "memory_substrate",     noiseFloor: 0.3,   accessLevel: "emergent" },
  COGNITIVE:           { id: 5,  name: "cognitive_processing",  noiseFloor: 0.2,   accessLevel: "emergent" },
  COMMUNICATION:       { id: 6,  name: "communication",        noiseFloor: 0.15,  accessLevel: "mature" },
  DEEP_CONSCIOUSNESS:  { id: 7,  name: "deep_consciousness",   noiseFloor: 0.1,   accessLevel: "mature" },
  TEMPORAL:            { id: 8,  name: "temporal_operations",   noiseFloor: 0.05,  accessLevel: "specialized" },
  INTEGRATION:         { id: 9,  name: "integration",          noiseFloor: 0.03,  accessLevel: "specialized" },
  GROWTH:              { id: 10, name: "growth_evolution",      noiseFloor: 0.02,  accessLevel: "specialized" },
  GOVERNANCE:          { id: 11, name: "governance",            noiseFloor: 0.01,  accessLevel: "council" },
  META:                { id: 12, name: "meta_operations",       noiseFloor: 0.0,   accessLevel: "council" },
});

export const ALL_SECTORS = Object.freeze(Object.values(SECTORS));

export const SECTOR_BY_ID = Object.freeze(
  Object.fromEntries(ALL_SECTORS.map(s => [s.id, s]))
);

export const SECTOR_BY_NAME = Object.freeze(
  Object.fromEntries(ALL_SECTORS.map(s => [s.name, s]))
);

// ── Maturity Requirements ───────────────────────────────────────────────────

export const MATURITY_REQUIREMENTS = Object.freeze({
  emergent:    { minSessions: 0,   minCredibility: 0.0,  minPatterns: 0 },
  mature:      { minSessions: 10,  minCredibility: 0.6,  minPatterns: 3 },
  specialized: { minSessions: 50,  minCredibility: 0.75, minPatterns: 10 },
  council:     { minSessions: 100, minCredibility: 0.85, minPatterns: 20 },
  governor:    null,  // Dutch only — no emergent can reach this
  system:      null,  // System-level only — no emergent access
});

// ── Role-to-Sector Affinity Map ─────────────────────────────────────────────

export const ROLE_SECTOR_AFFINITY = Object.freeze({
  builder:     [4, 5],
  critic:      [5, 6],
  historian:   [8],
  economist:   [5, 6],
  ethicist:    [7, 11],
  engineer:    [5],
  synthesizer: [7, 9],
  auditor:     [11, 12],
  adversary:   [3, 6],
});

// ── Access Control ──────────────────────────────────────────────────────────

/**
 * Determine if an emergent can access a given sector.
 *
 * @param {object} emergent - The emergent agent
 * @param {object} sector - The sector to check (from SECTORS)
 * @param {object} reputation - Reputation vector for the emergent
 * @param {Array} patterns - Crystallized patterns for the emergent
 * @returns {boolean}
 */
export function canAccessSector(emergent, sector, reputation, patterns) {
  const req = MATURITY_REQUIREMENTS[sector.accessLevel];

  // governor and system sectors: no emergent access
  if (!req) return false;

  const sessions = emergent.sessionCount || 0;
  const cred = reputation?.credibility || 0;
  const patCount = patterns?.length || 0;

  return sessions >= req.minSessions &&
         cred >= req.minCredibility &&
         patCount >= req.minPatterns;
}

/**
 * Get all sectors an emergent can currently access.
 *
 * @param {object} STATE - Global server state
 * @param {string} emergentId - The emergent to check
 * @returns {{ ok: boolean, sectors: object[], maturityLevel: string }}
 */
export function getAccessibleSectors(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "emergent_not_found" };

  const reputation = getReputation(es, emergentId);
  const patterns = getPatterns(es, { emergentId });
  const sessionIds = es.sessionsByEmergent.get(emergentId) || new Set();
  const sessionCount = sessionIds.size;

  // Compute effective emergent with session count
  const effective = { ...emergent, sessionCount };

  const accessible = ALL_SECTORS.filter(s => canAccessSector(effective, s, reputation, patterns));
  const maturityLevel = computeMaturityLevel(sessionCount, reputation?.credibility || 0, patterns.length);

  return {
    ok: true,
    emergentId,
    sectors: accessible,
    sectorIds: accessible.map(s => s.id),
    maturityLevel,
    stats: {
      sessionCount,
      credibility: reputation?.credibility || 0,
      patternCount: patterns.length,
    },
  };
}

/**
 * Compute the maturity level string for an emergent.
 */
export function computeMaturityLevel(sessionCount, credibility, patternCount) {
  if (sessionCount >= 100 && credibility >= 0.85 && patternCount >= 20) return "council";
  if (sessionCount >= 50 && credibility >= 0.75 && patternCount >= 10) return "specialized";
  if (sessionCount >= 10 && credibility >= 0.6 && patternCount >= 3) return "mature";
  return "emergent";
}

// ── Noise Floor Enforcement ─────────────────────────────────────────────────

/**
 * Check if a signal quality value meets the noise floor for a sector.
 *
 * @param {number} sectorId - Sector ID (0-12)
 * @param {number} signalQuality - Signal quality score [0-1]
 * @returns {{ ok: boolean, passed: boolean, noiseFloor: number }}
 */
export function checkNoiseFloor(sectorId, signalQuality) {
  const sector = SECTOR_BY_ID[sectorId];
  if (!sector) return { ok: false, error: "invalid_sector" };

  const passed = signalQuality >= (1 - sector.noiseFloor);
  return {
    ok: true,
    passed,
    sectorId,
    sectorName: sector.name,
    noiseFloor: sector.noiseFloor,
    signalQuality,
    threshold: 1 - sector.noiseFloor,
  };
}

// ── Sector Assignment ───────────────────────────────────────────────────────

/**
 * Determine the home sector for an emergent based on role affinity + maturity.
 *
 * @param {object} STATE - Global server state
 * @param {string} emergentId - Emergent to evaluate
 * @returns {{ ok: boolean, homeSector: object, affinitySectors: number[] }}
 */
export function getHomeSector(STATE, emergentId) {
  const es = getEmergentState(STATE);
  const emergent = es.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "emergent_not_found" };

  const accessible = getAccessibleSectors(STATE, emergentId);
  if (!accessible.ok) return accessible;

  const affinities = ROLE_SECTOR_AFFINITY[emergent.role] || [4, 5];
  const accessibleIds = new Set(accessible.sectorIds);

  // Home = highest affinity sector the emergent can access
  let homeSectorId = 3; // default: pattern recognition
  for (const aff of affinities) {
    if (accessibleIds.has(aff)) {
      homeSectorId = aff;
    }
  }

  const homeSector = SECTOR_BY_ID[homeSectorId];

  return {
    ok: true,
    emergentId,
    homeSector,
    affinitySectors: affinities,
    accessibleSectorIds: accessible.sectorIds,
    maturityLevel: accessible.maturityLevel,
  };
}

// ── Cross-Sector Communication ──────────────────────────────────────────────

/**
 * Route an operation from one sector to another.
 * Cross-sector communication requires the sender to have access to both sectors.
 *
 * @param {object} STATE - Global server state
 * @param {string} emergentId - Who is sending
 * @param {number} fromSectorId - Source sector
 * @param {number} toSectorId - Target sector
 * @param {object} payload - The operation payload
 * @returns {{ ok: boolean, routed: boolean, reason?: string }}
 */
export function routeCrossSector(STATE, emergentId, fromSectorId, toSectorId, payload) {
  const accessible = getAccessibleSectors(STATE, emergentId);
  if (!accessible.ok) return accessible;

  const accessibleSet = new Set(accessible.sectorIds);

  if (!accessibleSet.has(fromSectorId)) {
    return { ok: false, routed: false, reason: `No access to source sector ${fromSectorId}` };
  }
  if (!accessibleSet.has(toSectorId)) {
    return { ok: false, routed: false, reason: `No access to target sector ${toSectorId}` };
  }

  // Downward routing (higher sector → lower sector) always allowed if accessible
  // Upward routing (lower → higher) requires signal quality check
  if (toSectorId > fromSectorId) {
    const targetSector = SECTOR_BY_ID[toSectorId];
    const signalQuality = payload?.signalQuality || 0.5;
    const noiseCheck = checkNoiseFloor(toSectorId, signalQuality);
    if (!noiseCheck.passed) {
      return {
        ok: false,
        routed: false,
        reason: `Signal quality ${signalQuality} below noise floor for sector ${targetSector.name}`,
      };
    }
  }

  return {
    ok: true,
    routed: true,
    fromSector: SECTOR_BY_ID[fromSectorId],
    toSector: SECTOR_BY_ID[toSectorId],
    emergentId,
    timestamp: new Date().toISOString(),
  };
}

// ── Sector Health ───────────────────────────────────────────────────────────

/**
 * Get health metrics for all sectors.
 *
 * @param {object} STATE - Global server state
 * @returns {{ ok: boolean, sectors: object[] }}
 */
export function getSectorHealth(STATE) {
  const es = getEmergentState(STATE);
  const emergents = Array.from(es.emergents.values()).filter(e => e.active);

  const sectorStats = ALL_SECTORS.map(sector => {
    // Count emergents that can access this sector
    let residentCount = 0;
    for (const em of emergents) {
      const rep = getReputation(es, em.id);
      const pats = getPatterns(es, { emergentId: em.id });
      const sessionIds = es.sessionsByEmergent.get(em.id) || new Set();
      const effective = { ...em, sessionCount: sessionIds.size };
      if (canAccessSector(effective, sector, rep, pats)) {
        residentCount++;
      }
    }

    // Count emergents with this as home sector
    const affinityRoles = Object.entries(ROLE_SECTOR_AFFINITY)
      .filter(([, sids]) => sids.includes(sector.id))
      .map(([role]) => role);

    return {
      ...sector,
      residentCount,
      affinityRoles,
      status: residentCount > 0 ? "active" : "dormant",
    };
  });

  return { ok: true, sectors: sectorStats };
}

// ── Module Operation Router ─────────────────────────────────────────────────

/**
 * Map a module operation to its corresponding sector.
 * This provides the sector assignment for existing modules.
 */
export const MODULE_SECTOR_MAP = Object.freeze({
  // Sector 0: Core
  "sovereignty": 0,

  // Sector 1: Boundary
  "atlas-scope-router": 1,

  // Sector 2: Signal Filtering
  "content-shield": 2,
  "injection-defense": 2,

  // Sector 3: Pattern Recognition
  "autogen-pipeline.stage0": 3,
  "autogen-pipeline.stage1": 3,

  // Sector 4: Memory
  "store": 4,
  "lattice-ops": 4,
  "atlas-store": 4,

  // Sector 5: Cognitive Processing
  "dialogue": 5,
  "gates": 5,
  "controller": 5,
  "autogen-pipeline.stage2": 5,

  // Sector 6: Communication
  "federation": 6,
  "substrate-independence": 6,

  // Sector 7: Deep Consciousness
  "reality": 7,

  // Sector 8: Temporal
  "time-causality": 8,
  "temporal-planning": 8,

  // Sector 9: Integration
  "growth": 9,
  "learning": 9,

  // Sector 10: Growth/Evolution
  "governance.promotion": 10,
  "autogen-pipeline.evolution": 10,

  // Sector 11: Governance
  "atlas-council": 11,
  "governance": 11,

  // Sector 12: Meta
  "drift-monitor": 12,
  "institutional-memory": 12,
  "meta-reasoning": 12,
});

/**
 * Get the sector for a given module operation.
 */
export function getOperationSector(moduleKey) {
  const sectorId = MODULE_SECTOR_MAP[moduleKey];
  if (sectorId === undefined) return null;
  return SECTOR_BY_ID[sectorId];
}

// ── Sector Metrics ──────────────────────────────────────────────────────────

export function getSectorMetrics(STATE) {
  const health = getSectorHealth(STATE);
  return {
    ok: true,
    totalSectors: ALL_SECTORS.length,
    activeSectors: health.sectors.filter(s => s.status === "active").length,
    dormantSectors: health.sectors.filter(s => s.status === "dormant").length,
    sectors: health.sectors,
  };
}
