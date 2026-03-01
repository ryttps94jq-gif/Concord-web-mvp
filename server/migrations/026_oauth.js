/**
 * Migration 026 — OAuth Connections
 *
 * Adds the oauth_connections table for storing Google/Apple OAuth
 * provider links to user accounts. Enables one-click sign-in/sign-up
 * alongside the existing email/password authentication.
 *
 * Also makes password_hash nullable in users table to support
 * OAuth-only accounts (users who sign up via Google/Apple without
 * setting a password).
 */

export function up(db) {
  // ── OAuth Connections ─────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, provider_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Indexes for common lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_oauth_user_id ON oauth_connections(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_oauth_provider_uid ON oauth_connections(provider, provider_user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_oauth_email ON oauth_connections(email)`);
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS oauth_connections");
  db.exec("DROP INDEX IF EXISTS idx_oauth_user_id");
  db.exec("DROP INDEX IF EXISTS idx_oauth_provider_uid");
  db.exec("DROP INDEX IF EXISTS idx_oauth_email");
}
