/**
 * Centralized Logging for Concord Cognitive Engine
 *
 * All logs from all sources streamed to one buffer.
 * Filterable by brain, severity, lens, and time.
 * Supports SSE streaming for live tailing.
 */

const LOG_BUFFER_MAX = 10000;
const logBuffer = [];

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * Log a structured entry.
 * @param {"error"|"warn"|"info"|"debug"} level
 * @param {string} source - e.g. 'conscious', 'subconscious', 'utility', 'server', 'frontend', 'heartbeat'
 * @param {string} message
 * @param {object} [meta={}]
 */
function log(level, source, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    meta,
    lens: meta.lens || null,
  };

  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.shift();

  // Also write to stdout for Docker logs
  const prefix = `[${entry.source}] [${level.toUpperCase()}]`;
  if (level === 'error') console.error(`${prefix} ${message}`);
  else if (level === 'warn') console.warn(`${prefix} ${message}`);
  else console.log(`${prefix} ${message}`);
}

/**
 * Query the log buffer with filters.
 * @param {object} filters
 * @param {"error"|"warn"|"info"|"debug"} [filters.level]
 * @param {string} [filters.source]
 * @param {string} [filters.lens]
 * @param {string} [filters.since] - ISO date string
 * @param {string} [filters.search] - Free text search
 * @param {number} [filters.limit=100]
 * @returns {object[]}
 */
function query(filters = {}) {
  let results = [...logBuffer];

  if (filters.level) {
    const maxLevel = LEVELS[filters.level] ?? 3;
    results = results.filter(e => LEVELS[e.level] <= maxLevel);
  }
  if (filters.source) {
    results = results.filter(e => e.source === filters.source);
  }
  if (filters.lens) {
    results = results.filter(e => e.lens === filters.lens);
  }
  if (filters.since) {
    const since = new Date(filters.since);
    results = results.filter(e => new Date(e.timestamp) >= since);
  }
  if (filters.search) {
    const term = filters.search.toLowerCase();
    results = results.filter(e => e.message.toLowerCase().includes(term));
  }

  return results.slice(-(filters.limit || 100));
}

/**
 * Get the raw buffer for SSE streaming.
 * @returns {object[]}
 */
function getBuffer() {
  return logBuffer;
}

export default {
  log,
  query,
  getBuffer,
  error: (source, msg, meta) => log('error', source, msg, meta),
  warn: (source, msg, meta) => log('warn', source, msg, meta),
  info: (source, msg, meta) => log('info', source, msg, meta),
  debug: (source, msg, meta) => log('debug', source, msg, meta),
};

export { log, query, getBuffer, LEVELS };
