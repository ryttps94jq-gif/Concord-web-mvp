/**
 * Migration 029 — Conversational Initiative (Living Chat)
 *
 * Creates the tables that power Concord's proactive outreach system:
 *   - initiative_settings:  per-user preferences for initiative frequency, channels, quiet hours
 *   - initiatives:          log of every proactive message sent (trigger, score, status lifecycle)
 *   - initiative_backoff:   adaptive backoff when user ignores or dismisses initiatives
 *   - user_style_profile:   learned communication style (length, formality, emoji rate, vocab)
 */

export function up(db) {
  // ── Initiative Settings ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS initiative_settings (
      user_id TEXT PRIMARY KEY,
      max_per_day INTEGER NOT NULL DEFAULT 3,
      max_per_week INTEGER NOT NULL DEFAULT 10,
      quiet_start TEXT DEFAULT '22:00',
      quiet_end TEXT DEFAULT '08:00',
      allow_double_text INTEGER NOT NULL DEFAULT 1,
      channels_json TEXT NOT NULL DEFAULT '{"inApp":true,"push":false,"sms":false,"email":false}',
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // ── Initiatives ─────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS initiatives (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      score REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'pending',
      channel TEXT DEFAULT 'inApp',
      metadata_json TEXT DEFAULT '{}',
      delivered_at TEXT,
      read_at TEXT,
      responded_at TEXT,
      dismissed_at TEXT,
      created_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_initiatives_user ON initiatives(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_initiatives_trigger ON initiatives(trigger_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_initiatives_created ON initiatives(created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_initiatives_user_status ON initiatives(user_id, status)`);

  // ── Initiative Backoff ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS initiative_backoff (
      user_id TEXT PRIMARY KEY,
      ignored_count INTEGER NOT NULL DEFAULT 0,
      last_initiative_at TEXT,
      backoff_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // ── User Style Profile ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_style_profile (
      user_id TEXT PRIMARY KEY,
      avg_message_length REAL NOT NULL DEFAULT 0,
      formality_level REAL NOT NULL DEFAULT 0.5,
      emoji_rate REAL NOT NULL DEFAULT 0.0,
      vocabulary_json TEXT NOT NULL DEFAULT '{}',
      shared_context_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    )
  `);
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS initiative_settings");
  db.exec("DROP TABLE IF EXISTS initiatives");
  db.exec("DROP TABLE IF EXISTS initiative_backoff");
  db.exec("DROP TABLE IF EXISTS user_style_profile");
}
