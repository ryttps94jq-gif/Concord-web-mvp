/**
 * Migration 012: Federation Hierarchy v1.1 Addendum
 *
 * Adds schema for:
 *   - Tier-specific content tracking (promotion audit trail)
 *   - XP and quest tracking per user per tier
 *   - Quest completions
 *   - Materialized leaderboards
 *   - Knowledge race seasons
 *   - User federation preferences
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- Tier-specific content tracking
    -- Tracks DTU promotion through tiers with audit data
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS tier_content (
      id TEXT PRIMARY KEY,
      original_content_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL
        CHECK (federation_tier IN ('regional','national','global')),
      promoted_from_tier TEXT,
      promoted_at TEXT,
      promoted_by TEXT,
      authority_at_promotion REAL,
      citation_count_at_promotion INTEGER,
      FOREIGN KEY (original_content_id) REFERENCES dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tier_content_tier
      ON tier_content(federation_tier);
    CREATE INDEX IF NOT EXISTS idx_tier_content_original
      ON tier_content(original_content_id);

    -- ═══════════════════════════════════════════════════
    -- XP tracking per user per tier per season
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS user_xp (
      user_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      total_xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      season TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, federation_tier, COALESCE(regional,''), COALESCE(national,''), COALESCE(season,''))
    );

    -- ═══════════════════════════════════════════════════
    -- Quest completions
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS quest_completions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      xp_awarded INTEGER,
      coin_awarded REAL,
      badge_awarded TEXT,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, quest_id, federation_tier)
    );

    CREATE INDEX IF NOT EXISTS idx_quest_user
      ON quest_completions(user_id);
    CREATE INDEX IF NOT EXISTS idx_quest_tier
      ON quest_completions(federation_tier);

    -- ═══════════════════════════════════════════════════
    -- Materialized leaderboards (for performance)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS leaderboards (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      category TEXT NOT NULL,
      season TEXT,
      rankings_json TEXT NOT NULL DEFAULT '[]',
      computed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_leaderboards_scope
      ON leaderboards(scope, scope_id, category, season);

    -- ═══════════════════════════════════════════════════
    -- Knowledge race seasons
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS race_seasons (
      id TEXT PRIMARY KEY,
      season_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active'
        CHECK (status IN ('upcoming','active','completed')),
      rewards_distributed INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_race_seasons_status
      ON race_seasons(status);

    -- ═══════════════════════════════════════════════════
    -- User federation preferences
    -- ═══════════════════════════════════════════════════

    ALTER TABLE users ADD COLUMN federation_preferences_json TEXT
      DEFAULT '{"participateInRegional":true,"participateInNational":true,"participateInGlobal":false,"autoPromotionCandidate":true,"requirePromotionConsent":false,"interactWithEmergents":true,"interactWithOtherRegionals":true,"interactWithOtherNationals":false,"sellToRegional":true,"sellToNational":true,"sellToGlobal":true,"buyFromRegional":true,"buyFromNational":true,"buyFromGlobal":true}';
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS race_seasons;
    DROP TABLE IF EXISTS leaderboards;
    DROP TABLE IF EXISTS quest_completions;
    DROP TABLE IF EXISTS user_xp;
    DROP TABLE IF EXISTS tier_content;
  `);
}
