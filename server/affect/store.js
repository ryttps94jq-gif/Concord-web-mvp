/**
 * Concord ATS — Store
 * Session-level affective state storage with ring buffer event log.
 */

import { createState, createMomentum, resetState as engineReset } from "./engine.js";
import { EVENT_LOG_SIZE } from "./defaults.js";

/** @type {Map<string, { E: object, M: object, events: object[] }>} */
const sessions = new Map();

/**
 * Get or create the affective state for a session.
 * @param {string} sessionId
 * @returns {{ E: object, M: object, events: object[] }}
 */
export function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      E: createState(),
      M: createMomentum(),
      events: [],
    });
  }
  return sessions.get(sessionId);
}

/**
 * Get the affective state for a session (read-only copy).
 * Returns null if session doesn't exist.
 */
export function getState(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return { ...session.E };
}

/**
 * Log an event to the session's ring buffer.
 */
export function logEvent(sessionId, event) {
  const session = getSession(sessionId);
  session.events.push({
    ...event,
    ts: event.ts || Date.now(),
    id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });

  // Ring buffer: trim to max size
  if (session.events.length > EVENT_LOG_SIZE) {
    session.events = session.events.slice(-EVENT_LOG_SIZE);
  }
}

/**
 * Get recent events for a session.
 * @param {string} sessionId
 * @param {number} limit
 * @returns {object[]}
 */
export function getEvents(sessionId, limit = 50) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.events.slice(-limit);
}

/**
 * Reset a session's affective state.
 * @param {string} sessionId
 * @param {string} mode - "baseline" or "cooldown"
 */
export function resetSession(sessionId, mode = "baseline") {
  const { E, M } = engineReset(mode);
  const session = getSession(sessionId);
  session.E = E;
  session.M = M;
  // Keep event log for audit purposes
  logEvent(sessionId, {
    type: "CUSTOM",
    intensity: 0,
    polarity: 0,
    payload: { action: "reset", mode },
    source: { sessionId },
  });
  return { E: { ...E }, M: { ...M } };
}

/**
 * Delete a session entirely.
 */
export function deleteSession(sessionId) {
  return sessions.delete(sessionId);
}

/**
 * List all active session IDs.
 */
export function listSessions() {
  return Array.from(sessions.keys());
}

/**
 * Get session count (for metrics).
 */
export function sessionCount() {
  return sessions.size;
}

/**
 * Serialize all sessions for backup/persistence.
 */
export function serializeAll() {
  const out = {};
  for (const [id, session] of sessions) {
    out[id] = {
      E: { ...session.E },
      M: { ...session.M },
      events: session.events.slice(-100), // last 100 only for persistence
    };
  }
  return out;
}

/**
 * Restore sessions from serialized data.
 */
export function restoreAll(data) {
  if (!data || typeof data !== "object") return 0;
  let count = 0;
  for (const [id, session] of Object.entries(data)) {
    if (session.E && session.M) {
      sessions.set(id, {
        E: { ...session.E },
        M: { ...session.M },
        events: Array.isArray(session.events) ? session.events : [],
      });
      count++;
    }
  }
  return count;
}
