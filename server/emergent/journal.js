/**
 * Emergent Agent Governance — Lattice Journal (Event-Sourced Log)
 *
 * Every lattice change becomes an append-only event:
 *   DTU_CREATED, DTU_UPDATED, EDGE_ADDED, EDGE_REMOVED,
 *   PROPOSAL_CREATED, PROPOSAL_COMMITTED, PROPOSAL_REJECTED,
 *   PROMOTED, ACTIVATION_CHANGED, etc.
 *
 * Perfect replay + debugging + "why did the lattice change?" for emergents and admins.
 * This is the event-sourced spine of lattice observability.
 */

import { getEmergentState } from "./store.js";

// ── Event Types ─────────────────────────────────────────────────────────────

export const JOURNAL_EVENTS = Object.freeze({
  // DTU lifecycle
  DTU_CREATED:          "DTU_CREATED",
  DTU_UPDATED:          "DTU_UPDATED",
  DTU_PROMOTED:         "DTU_PROMOTED",
  DTU_DEMOTED:          "DTU_DEMOTED",
  DTU_DELETED:          "DTU_DELETED",

  // Edge lifecycle
  EDGE_ADDED:           "EDGE_ADDED",
  EDGE_UPDATED:         "EDGE_UPDATED",
  EDGE_REMOVED:         "EDGE_REMOVED",

  // Proposal lifecycle
  PROPOSAL_CREATED:     "PROPOSAL_CREATED",
  PROPOSAL_COMMITTED:   "PROPOSAL_COMMITTED",
  PROPOSAL_REJECTED:    "PROPOSAL_REJECTED",

  // Emergent lifecycle
  EMERGENT_REGISTERED:  "EMERGENT_REGISTERED",
  EMERGENT_DEACTIVATED: "EMERGENT_DEACTIVATED",
  EMERGENT_SPECIALIZED: "EMERGENT_SPECIALIZED",

  // Session lifecycle
  SESSION_CREATED:      "SESSION_CREATED",
  SESSION_COMPLETED:    "SESSION_COMPLETED",
  TURN_ACCEPTED:        "TURN_ACCEPTED",
  TURN_REJECTED:        "TURN_REJECTED",

  // Growth events
  PATTERN_LEARNED:      "PATTERN_LEARNED",
  REPUTATION_CHANGED:   "REPUTATION_CHANGED",

  // Merge events
  MERGE_APPLIED:        "MERGE_APPLIED",
  MERGE_CONFLICT:       "MERGE_CONFLICT",
  CONFLICT_RESOLVED:    "CONFLICT_RESOLVED",

  // Activation events
  ACTIVATION_SPREAD:    "ACTIVATION_SPREAD",

  // System events
  SYSTEM_INIT:          "SYSTEM_INIT",
});

// ── Journal Store ───────────────────────────────────────────────────────────

let _journalSeq = 0;

/**
 * Get or initialize the journal.
 */
export function getJournal(STATE) {
  const es = getEmergentState(STATE);
  if (!es._journal) {
    es._journal = {
      events: [],                // append-only event log
      byType: new Map(),         // eventType -> [indices]
      byEntity: new Map(),       // entityId -> [indices]
      bySession: new Map(),      // sessionId -> [indices]

      // Compaction state
      compacted: 0,              // number of events that have been compacted
      snapshots: [],             // periodic state snapshots for fast replay

      metrics: {
        totalEvents: 0,
        eventsByType: {},
      },
    };
  }
  return es._journal;
}

// ── Journal Operations ──────────────────────────────────────────────────────

/**
 * Append an event to the journal.
 * This is the single entry point for all lattice mutations.
 *
 * @param {Object} STATE - Global server state
 * @param {string} eventType - One of JOURNAL_EVENTS
 * @param {Object} payload - Event payload
 * @param {Object} [meta] - Additional metadata
 * @returns {{ ok: boolean, event: Object }}
 */
export function appendEvent(STATE, eventType, payload = {}, meta = {}) {
  const journal = getJournal(STATE);

  const event = {
    seq: ++_journalSeq,
    type: eventType,
    payload,
    entityId: payload.dtuId || payload.edgeId || payload.emergentId
      || payload.sessionId || payload.proposalId || null,
    sessionId: payload.sessionId || meta.sessionId || null,
    actorId: meta.actorId || payload.proposedBy || payload.editedBy || null,
    timestamp: new Date().toISOString(),
    meta,
  };

  const index = journal.events.length;
  journal.events.push(event);

  // Update indices
  if (!journal.byType.has(eventType)) journal.byType.set(eventType, []);
  journal.byType.get(eventType).push(index);

  if (event.entityId) {
    if (!journal.byEntity.has(event.entityId)) journal.byEntity.set(event.entityId, []);
    journal.byEntity.get(event.entityId).push(index);
  }

  if (event.sessionId) {
    if (!journal.bySession.has(event.sessionId)) journal.bySession.set(event.sessionId, []);
    journal.bySession.get(event.sessionId).push(index);
  }

  // Update metrics
  journal.metrics.totalEvents++;
  journal.metrics.eventsByType[eventType] = (journal.metrics.eventsByType[eventType] || 0) + 1;

  return { ok: true, event };
}

// ── Query Operations ────────────────────────────────────────────────────────

/**
 * Get events by type.
 *
 * @param {Object} STATE - Global server state
 * @param {string} eventType - Event type to filter
 * @param {Object} [opts] - Query options
 * @returns {{ ok: boolean, events: Object[], count: number }}
 */
export function queryByType(STATE, eventType, opts = {}) {
  const journal = getJournal(STATE);
  const indices = journal.byType.get(eventType) || [];
  return resolveIndices(journal, indices, opts);
}

/**
 * Get events for a specific entity (DTU, edge, emergent, etc).
 *
 * @param {Object} STATE - Global server state
 * @param {string} entityId - Entity to look up
 * @param {Object} [opts] - Query options
 * @returns {{ ok: boolean, events: Object[], count: number }}
 */
export function queryByEntity(STATE, entityId, opts = {}) {
  const journal = getJournal(STATE);
  const indices = journal.byEntity.get(entityId) || [];
  return resolveIndices(journal, indices, opts);
}

/**
 * Get events for a session.
 *
 * @param {Object} STATE - Global server state
 * @param {string} sessionId - Session to look up
 * @param {Object} [opts] - Query options
 * @returns {{ ok: boolean, events: Object[], count: number }}
 */
export function queryBySession(STATE, sessionId, opts = {}) {
  const journal = getJournal(STATE);
  const indices = journal.bySession.get(sessionId) || [];
  return resolveIndices(journal, indices, opts);
}

/**
 * Get recent events (tail of the journal).
 *
 * @param {Object} STATE - Global server state
 * @param {number} [count=50] - Number of recent events
 * @returns {{ ok: boolean, events: Object[], count: number }}
 */
export function getRecentEvents(STATE, count = 50) {
  const journal = getJournal(STATE);
  const start = Math.max(0, journal.events.length - count);
  const events = journal.events.slice(start);
  return { ok: true, events, count: events.length, totalEvents: journal.events.length };
}

/**
 * Get the full event history for a DTU — "why did this DTU change?"
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - DTU to explain
 * @returns {{ ok: boolean, history: Object[] }}
 */
export function explainDTU(STATE, dtuId) {
  const journal = getJournal(STATE);
  const indices = journal.byEntity.get(dtuId) || [];

  const history = indices.map(i => journal.events[i]).filter(Boolean).map(e => ({
    seq: e.seq,
    type: e.type,
    actorId: e.actorId,
    timestamp: e.timestamp,
    summary: summarizeEvent(e),
  }));

  return { ok: true, dtuId, history, eventCount: history.length };
}

/**
 * Get journal metrics.
 */
export function getJournalMetrics(STATE) {
  const journal = getJournal(STATE);
  return {
    ok: true,
    totalEvents: journal.metrics.totalEvents,
    eventsByType: journal.metrics.eventsByType,
    trackedEntities: journal.byEntity.size,
    trackedSessions: journal.bySession.size,
    compacted: journal.compacted,
    snapshots: journal.snapshots.length,
  };
}

/**
 * Compact old events into a snapshot (keeps journal from growing unbounded).
 * Events older than the retention window are summarized.
 *
 * @param {Object} STATE - Global server state
 * @param {number} [retainCount=1000] - Keep the most recent N events
 * @returns {{ ok: boolean, compacted: number }}
 */
export function compactJournal(STATE, retainCount = 1000) {
  const journal = getJournal(STATE);

  if (journal.events.length <= retainCount) {
    return { ok: true, compacted: 0 };
  }

  const cutoff = journal.events.length - retainCount;

  // Create a snapshot summary of compacted events
  const compactedEvents = journal.events.slice(0, cutoff);
  const snapshot = {
    timestamp: new Date().toISOString(),
    eventRange: { from: compactedEvents[0]?.seq, to: compactedEvents[compactedEvents.length - 1]?.seq },
    eventCount: compactedEvents.length,
    typeSummary: {},
  };
  for (const e of compactedEvents) {
    snapshot.typeSummary[e.type] = (snapshot.typeSummary[e.type] || 0) + 1;
  }

  journal.snapshots.push(snapshot);
  journal.events = journal.events.slice(cutoff);
  journal.compacted += cutoff;

  // Rebuild indices (they reference positions, which have shifted)
  rebuildIndices(journal);

  return { ok: true, compacted: cutoff, snapshot };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveIndices(journal, indices, opts = {}) {
  const limit = Math.min(opts.limit || 100, 500);
  const offset = opts.offset || 0;

  const sliced = indices.slice(offset, offset + limit);
  const events = sliced.map(i => journal.events[i]).filter(Boolean);

  return { ok: true, events, count: events.length, total: indices.length };
}

function summarizeEvent(event) {
  switch (event.type) {
    case JOURNAL_EVENTS.DTU_CREATED:
      return `DTU created by ${event.actorId || "unknown"}`;
    case JOURNAL_EVENTS.DTU_UPDATED:
      return `DTU updated: ${Object.keys(event.payload.edits || {}).join(", ")}`;
    case JOURNAL_EVENTS.DTU_PROMOTED:
      return `DTU promoted to ${event.payload.tier || "unknown"} tier`;
    case JOURNAL_EVENTS.EDGE_ADDED:
      return `Edge added: ${event.payload.edgeType || "link"} to ${event.payload.targetId || "?"}`;
    case JOURNAL_EVENTS.PROPOSAL_CREATED:
      return `Proposal created by ${event.actorId || "unknown"}`;
    case JOURNAL_EVENTS.PROPOSAL_COMMITTED:
      return `Proposal committed by ${event.payload.committedBy || "governance"}`;
    case JOURNAL_EVENTS.PROPOSAL_REJECTED:
      return `Proposal rejected: ${event.payload.reason || ""}`;
    case JOURNAL_EVENTS.TURN_ACCEPTED:
      return `Turn accepted from ${event.actorId || "unknown"}`;
    case JOURNAL_EVENTS.TURN_REJECTED:
      return `Turn rejected: ${event.payload.blockingRule || "unknown rule"}`;
    case JOURNAL_EVENTS.REPUTATION_CHANGED:
      return `Reputation ${event.payload.direction || "updated"} for ${event.entityId}`;
    default:
      return event.type;
  }
}

function rebuildIndices(journal) {
  journal.byType.clear();
  journal.byEntity.clear();
  journal.bySession.clear();

  for (let i = 0; i < journal.events.length; i++) {
    const e = journal.events[i];

    if (!journal.byType.has(e.type)) journal.byType.set(e.type, []);
    journal.byType.get(e.type).push(i);

    if (e.entityId) {
      if (!journal.byEntity.has(e.entityId)) journal.byEntity.set(e.entityId, []);
      journal.byEntity.get(e.entityId).push(i);
    }

    if (e.sessionId) {
      if (!journal.bySession.has(e.sessionId)) journal.bySession.set(e.sessionId, []);
      journal.bySession.get(e.sessionId).push(i);
    }
  }
}
