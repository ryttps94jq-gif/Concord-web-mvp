/**
 * Foundation Emergency — Disaster-Proof Communication
 *
 * When everything else fails, Concord keeps working. This module ensures
 * communication survives any disaster scenario. Auto-detects disasters,
 * activates emergency mode, shifts channel priorities, enables mandatory
 * relay, and maintains offline knowledge cache.
 *
 * Rules:
 *   1. Emergency DTUs get Shield-level priority.
 *   2. All nodes become mandatory relays during emergency.
 *   3. Power conservation in disaster zones.
 *   4. Offline knowledge cache always available.
 */

import crypto from "crypto";

function uid(prefix = "emergency") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }

// ── Constants ───────────────────────────────────────────────────────────────

export const EMERGENCY_SUBTYPES = Object.freeze([
  "alert", "status", "resource", "medical", "coordination", "evacuation",
]);

export const EMERGENCY_SEVERITY = Object.freeze({
  ADVISORY:  { min: 1, max: 3 },
  WARNING:   { min: 4, max: 6 },
  EMERGENCY: { min: 7, max: 8 },
  CRITICAL:  { min: 9, max: 10 },
});

export const OFFLINE_CACHE_CATEGORIES = Object.freeze([
  "medical_procedures", "first_aid", "water_purification",
  "shelter_construction", "navigation", "radio_communication",
]);

// ── Module State ────────────────────────────────────────────────────────────

const _emergencyState = {
  initialized: false,
  activeEmergencies: new Map(),  // emergencyId → emergency data
  emergencyMode: false,
  affectedAreas: [],
  alerts: [],
  offlineCache: new Map(),       // category → DTU[]
  coordinationMesh: new Map(),   // nodeId → status
  stats: {
    totalAlerts: 0,
    activeEmergencies: 0,
    emergencyModeActivations: 0,
    nodesCoordinated: 0,
    lastAlertAt: null,
    uptime: Date.now(),
  },
};

// ── Emergency DTU Creation ──────────────────────────────────────────────────

export function createEmergencyDTU(opts) {
  const now = nowISO();
  const subtype = EMERGENCY_SUBTYPES.includes(opts.subtype) ? opts.subtype : "alert";
  const severity = clamp(opts.severity || 5, 1, 10);

  return {
    id: uid("emg"),
    type: "EMERGENCY",
    subtype,
    severity,
    created: now,
    source: opts.source || "foundation-emergency",
    source_node: opts.source_node || null,
    affected_area: opts.affected_area || null,
    content: {
      situation: opts.situation || "",
      resources_available: opts.resources_available || {},
      resources_needed: opts.resources_needed || {},
      shelter_locations: opts.shelter_locations || [],
      medical_info: opts.medical_info || {},
      evacuation_routes: opts.evacuation_routes || [],
    },
    verified: opts.verified ?? false,
    relay_count: 0,
    tags: ["foundation", "emergency", subtype, "pain_memory"],
    scope: "global",
    crpiScore: clamp(severity / 10, 0.5, 1.0),
  };
}

// ── Emergency Activation ────────────────────────────────────────────────────

export function triggerEmergency(data, STATE) {
  if (!data) return { ok: false, error: "no_data" };

  const dtu = createEmergencyDTU({
    subtype: "alert",
    severity: data.severity || 7,
    situation: data.situation,
    affected_area: data.affected_area,
    source_node: data.source_node,
    resources_available: data.resources_available,
    resources_needed: data.resources_needed,
    shelter_locations: data.shelter_locations,
    medical_info: data.medical_info,
    evacuation_routes: data.evacuation_routes,
    verified: data.verified || false,
  });

  _emergencyState.activeEmergencies.set(dtu.id, {
    dtu,
    activatedAt: nowISO(),
    status: "active",
    nodesInvolved: 0,
    relayCount: 0,
  });

  _emergencyState.alerts.push(dtu);
  if (_emergencyState.alerts.length > 200) {
    _emergencyState.alerts = _emergencyState.alerts.slice(-150);
  }

  if (dtu.affected_area) {
    _emergencyState.affectedAreas.push(dtu.affected_area);
  }

  // Activate emergency mode if severity >= 7
  if (dtu.severity >= EMERGENCY_SEVERITY.EMERGENCY.min) {
    _emergencyState.emergencyMode = true;
    _emergencyState.stats.emergencyModeActivations++;
  }

  if (STATE?.dtus) STATE.dtus.set(dtu.id, dtu);

  _emergencyState.stats.totalAlerts++;
  _emergencyState.stats.activeEmergencies = _emergencyState.activeEmergencies.size;
  _emergencyState.stats.lastAlertAt = nowISO();

  return { ok: true, emergency: dtu, emergencyMode: _emergencyState.emergencyMode };
}

// ── Coordination ────────────────────────────────────────────────────────────

export function reportNodeStatus(nodeId, status) {
  if (!nodeId) return null;

  const entry = {
    nodeId,
    powerLevel: status.powerLevel ?? null,
    personnelCount: status.personnelCount ?? null,
    resources: status.resources || {},
    medicalNeeds: status.medicalNeeds || [],
    reportedAt: nowISO(),
  };

  _emergencyState.coordinationMesh.set(nodeId, entry);
  _emergencyState.stats.nodesCoordinated = _emergencyState.coordinationMesh.size;

  return entry;
}

export function getCoordinationStatus() {
  const nodes = [..._emergencyState.coordinationMesh.values()];
  return {
    totalNodes: nodes.length,
    nodes: nodes.slice(0, 100),
    emergencyMode: _emergencyState.emergencyMode,
    activeEmergencies: _emergencyState.activeEmergencies.size,
  };
}

// ── Emergency Resolution ────────────────────────────────────────────────────

export function resolveEmergency(emergencyId) {
  const emergency = _emergencyState.activeEmergencies.get(emergencyId);
  if (!emergency) return { ok: false, error: "not_found" };

  emergency.status = "resolved";
  emergency.resolvedAt = nowISO();
  _emergencyState.activeEmergencies.delete(emergencyId);
  _emergencyState.stats.activeEmergencies = _emergencyState.activeEmergencies.size;

  // Deactivate emergency mode if no more active emergencies
  if (_emergencyState.activeEmergencies.size === 0) {
    _emergencyState.emergencyMode = false;
  }

  return { ok: true, resolved: emergencyId };
}

// ── Offline Knowledge Cache ─────────────────────────────────────────────────

export function addToOfflineCache(category, dtu) {
  if (!category || !dtu) return false;
  if (!_emergencyState.offlineCache.has(category)) {
    _emergencyState.offlineCache.set(category, []);
  }
  _emergencyState.offlineCache.get(category).push(dtu);
  return true;
}

export function getOfflineCache(category) {
  if (category) return _emergencyState.offlineCache.get(category) || [];
  const all = {};
  for (const [cat, dtus] of _emergencyState.offlineCache) {
    all[cat] = dtus.length;
  }
  return all;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getEmergencyMetrics() {
  return {
    initialized: _emergencyState.initialized,
    emergencyMode: _emergencyState.emergencyMode,
    activeEmergencies: _emergencyState.activeEmergencies.size,
    alertCount: _emergencyState.alerts.length,
    coordinatedNodes: _emergencyState.coordinationMesh.size,
    offlineCacheCategories: _emergencyState.offlineCache.size,
    stats: { ..._emergencyState.stats },
    uptime: Date.now() - _emergencyState.stats.uptime,
  };
}

export function getActiveEmergencies() {
  return [..._emergencyState.activeEmergencies.values()];
}

export function getRecentAlerts(limit = 50) {
  return _emergencyState.alerts.slice(-limit);
}

export function getEmergencyStatus() {
  return {
    emergencyMode: _emergencyState.emergencyMode,
    activeCount: _emergencyState.activeEmergencies.size,
    affectedAreas: _emergencyState.affectedAreas.slice(-10),
    coordinatedNodes: _emergencyState.coordinationMesh.size,
  };
}

// ── Initialization ──────────────────────────────────────────────────────────

export async function initializeEmergency(STATE) {
  if (_emergencyState.initialized) return { ok: true, alreadyInitialized: true };

  let indexed = 0;
  if (STATE?.dtus) {
    for (const [, dtu] of STATE.dtus) {
      if (dtu.type === "EMERGENCY") {
        _emergencyState.alerts.push(dtu);
        indexed++;
      }
    }
  }

  // Pre-populate offline cache categories
  for (const cat of OFFLINE_CACHE_CATEGORIES) {
    if (!_emergencyState.offlineCache.has(cat)) {
      _emergencyState.offlineCache.set(cat, []);
    }
  }

  _emergencyState.initialized = true;
  _emergencyState.stats.uptime = Date.now();
  return { ok: true, indexed };
}

export function _resetEmergencyState() {
  _emergencyState.initialized = false;
  _emergencyState.activeEmergencies.clear();
  _emergencyState.emergencyMode = false;
  _emergencyState.affectedAreas = [];
  _emergencyState.alerts = [];
  _emergencyState.offlineCache.clear();
  _emergencyState.coordinationMesh.clear();
  _emergencyState.stats = {
    totalAlerts: 0, activeEmergencies: 0, emergencyModeActivations: 0,
    nodesCoordinated: 0, lastAlertAt: null, uptime: Date.now(),
  };
}
