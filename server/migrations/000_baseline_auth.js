/**
 * Migration 000: Baseline auth & system tables.
 *
 * These tables were originally created inline inside initDatabase() in
 * server.js.  This migration captures them as a tracked baseline so that
 * every table in the database is managed through the migration system.
 *
 * Uses CREATE TABLE IF NOT EXISTS throughout so it is safe to run against
 * a database that already has these tables (i.e. existing deployments).
 *
 * Creates: users, api_keys, sessions, audit_log, state_snapshots
 */

export const id = "000";
export const name = "baseline_auth";

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- Users
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      scopes TEXT NOT NULL DEFAULT '["read","write"]',
      created_at TEXT NOT NULL,
      last_login_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- ═══════════════════════════════════════════════════
    -- API Keys
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '["read"]',
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

    -- ═══════════════════════════════════════════════════
    -- Sessions
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    -- ═══════════════════════════════════════════════════
    -- Audit Log
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      path TEXT,
      method TEXT,
      status_code INTEGER,
      details TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(category);

    -- ═══════════════════════════════════════════════════
    -- State Snapshots (persistence backend)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS state_snapshots (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      version TEXT,
      saved_at TEXT NOT NULL
    );
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS state_snapshots;
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS api_keys;
    DROP TABLE IF EXISTS users;
  `);
}
