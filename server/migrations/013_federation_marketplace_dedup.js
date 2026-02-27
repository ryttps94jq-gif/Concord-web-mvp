/**
 * Migration 013: Federation v1.1.1 — Marketplace Filters & Council Dedup
 *
 * Adds schema for:
 *   - Dedup review tracking (council-reviewed duplicate detection)
 *   - Marketplace dedup verification flag + rejection tracking
 *   - User marketplace filter preferences
 *   - User wealth recirculation preferences
 *   - Leaderboard entries (individual, for query performance)
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- Dedup review tracking
    -- Council reviews flagged marketplace submissions
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS dedup_reviews (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      target_tier TEXT NOT NULL,
      similar_items_json TEXT NOT NULL DEFAULT '[]',
      highest_similarity REAL,
      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected_duplicate','merged')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dedup_status
      ON dedup_reviews(status, target_tier);
    CREATE INDEX IF NOT EXISTS idx_dedup_content
      ON dedup_reviews(content_id);

    -- ═══════════════════════════════════════════════════
    -- Marketplace dedup verification
    -- ═══════════════════════════════════════════════════

    ALTER TABLE marketplace_economy_listings ADD COLUMN dedup_verified INTEGER DEFAULT 0;
    ALTER TABLE marketplace_economy_listings ADD COLUMN rejection_reason TEXT;
    ALTER TABLE marketplace_economy_listings ADD COLUMN similar_to TEXT;

    -- ═══════════════════════════════════════════════════
    -- User marketplace & wealth preferences
    -- ═══════════════════════════════════════════════════

    ALTER TABLE users ADD COLUMN marketplace_filters_json TEXT DEFAULT '{}';
    ALTER TABLE users ADD COLUMN wealth_preferences_json TEXT DEFAULT '{}';

    -- ═══════════════════════════════════════════════════
    -- Leaderboard entries (individual, for query perf)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      category TEXT NOT NULL,
      season TEXT,
      score REAL DEFAULT 0,
      rank INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, scope, scope_id, category, COALESCE(season,''))
    );

    CREATE INDEX IF NOT EXISTS idx_lb_entries_rank
      ON leaderboard_entries(scope, scope_id, category, rank);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS leaderboard_entries;
    DROP TABLE IF EXISTS dedup_reviews;
  `);
}
