/**
 * Migration 014: Creative Artifact Marketplace — Federation v1.2
 *
 * Adds schema for:
 *   - Creative artifacts (the marketplace items)
 *   - Artifact derivative tracking (parent/child lineage)
 *   - Usage licenses (not ownership — creator always retains IP)
 *   - Royalty cascade ledger (immutable audit trail)
 *   - Artifact ratings and reviews
 *   - Creative XP (separate from knowledge XP)
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- Creative Artifacts
    -- The core marketplace items. Each artifact is a
    -- creative work listed for usage-license sale.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS creative_artifacts (
      id TEXT PRIMARY KEY,
      dtu_id TEXT,
      creator_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      genre TEXT,
      medium TEXT,
      language TEXT,
      duration_seconds INTEGER,
      width INTEGER,
      height INTEGER,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT NOT NULL,
      preview_path TEXT,

      -- Location (inherited from creator at time of creation)
      location_regional TEXT,
      location_national TEXT,
      federation_tier TEXT DEFAULT 'regional'
        CHECK (federation_tier IN ('local','regional','national','global')),

      -- Licensing
      license_type TEXT DEFAULT 'standard'
        CHECK (license_type IN ('standard','exclusive','custom')),
      license_json TEXT NOT NULL DEFAULT '{}',

      -- Derivative tracking
      is_derivative INTEGER DEFAULT 0,
      lineage_depth INTEGER DEFAULT 0,

      -- Marketplace
      marketplace_status TEXT DEFAULT 'draft'
        CHECK (marketplace_status IN ('draft','active','paused','rejected_duplicate','delisted')),
      price REAL,
      purchase_count INTEGER DEFAULT 0,
      derivative_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      dedup_verified INTEGER DEFAULT 0,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_creator
      ON creative_artifacts(creator_id);
    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_type
      ON creative_artifacts(type);
    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_regional
      ON creative_artifacts(location_regional);
    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_national
      ON creative_artifacts(location_national);
    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_tier
      ON creative_artifacts(federation_tier);
    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_marketplace
      ON creative_artifacts(marketplace_status, federation_tier);
    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_hash
      ON creative_artifacts(file_hash);
    CREATE INDEX IF NOT EXISTS idx_creative_artifacts_genre
      ON creative_artifacts(genre);

    -- ═══════════════════════════════════════════════════
    -- Derivative parent tracking
    -- Each row links a child artifact to one of its
    -- parent artifacts with the derivative type.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS creative_artifact_derivatives (
      id TEXT PRIMARY KEY,
      child_artifact_id TEXT NOT NULL,
      parent_artifact_id TEXT NOT NULL,
      derivative_type TEXT NOT NULL,
      generation INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (child_artifact_id) REFERENCES creative_artifacts(id),
      FOREIGN KEY (parent_artifact_id) REFERENCES creative_artifacts(id),
      UNIQUE(child_artifact_id, parent_artifact_id)
    );

    CREATE INDEX IF NOT EXISTS idx_creative_deriv_child
      ON creative_artifact_derivatives(child_artifact_id);
    CREATE INDEX IF NOT EXISTS idx_creative_deriv_parent
      ON creative_artifact_derivatives(parent_artifact_id);

    -- ═══════════════════════════════════════════════════
    -- Usage licenses
    -- Not ownership! Creator always retains IP.
    -- Buyers get usage rights as defined by license.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS creative_usage_licenses (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      licensee_id TEXT NOT NULL,
      license_type TEXT NOT NULL,
      status TEXT DEFAULT 'active'
        CHECK (status IN ('active','revoked','expired')),
      purchase_price REAL NOT NULL,
      purchase_id TEXT,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      FOREIGN KEY (artifact_id) REFERENCES creative_artifacts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_creative_licenses_artifact
      ON creative_usage_licenses(artifact_id);
    CREATE INDEX IF NOT EXISTS idx_creative_licenses_licensee
      ON creative_usage_licenses(licensee_id);
    CREATE INDEX IF NOT EXISTS idx_creative_licenses_status
      ON creative_usage_licenses(status);

    -- ═══════════════════════════════════════════════════
    -- Royalty cascade ledger (immutable audit trail)
    -- Every royalty payment from derivative purchases
    -- is recorded here for full transparency.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS creative_royalty_cascade_ledger (
      id TEXT PRIMARY KEY,
      triggering_purchase_id TEXT NOT NULL,
      triggering_artifact_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      recipient_artifact_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_creative_cascade_recipient
      ON creative_royalty_cascade_ledger(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_creative_cascade_trigger
      ON creative_royalty_cascade_ledger(triggering_artifact_id);
    CREATE INDEX IF NOT EXISTS idx_creative_cascade_tier
      ON creative_royalty_cascade_ledger(federation_tier);

    -- ═══════════════════════════════════════════════════
    -- Artifact ratings
    -- Buyers can rate artifacts they've purchased.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS creative_artifact_ratings (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      rater_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(artifact_id, rater_id),
      FOREIGN KEY (artifact_id) REFERENCES creative_artifacts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_creative_ratings_artifact
      ON creative_artifact_ratings(artifact_id);

    -- ═══════════════════════════════════════════════════
    -- Creative XP (separate from knowledge XP)
    -- Tracks creative-specific XP per user per tier.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS creative_xp (
      user_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT NOT NULL DEFAULT '',
      national TEXT NOT NULL DEFAULT '',
      total_xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      season TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, federation_tier, regional, national, season)
    );

    CREATE INDEX IF NOT EXISTS idx_creative_xp_tier
      ON creative_xp(federation_tier);

    -- ═══════════════════════════════════════════════════
    -- Creative quest completions
    -- Tracks which creative quests users have completed.
    -- XP and badge rewards only — no coin rewards.
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS creative_quest_completions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      federation_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      xp_awarded INTEGER,
      badge_awarded TEXT,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, quest_id, federation_tier)
    );

    CREATE INDEX IF NOT EXISTS idx_creative_quest_user
      ON creative_quest_completions(user_id);
    CREATE INDEX IF NOT EXISTS idx_creative_quest_tier
      ON creative_quest_completions(federation_tier);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS creative_quest_completions;
    DROP TABLE IF EXISTS creative_xp;
    DROP TABLE IF EXISTS creative_artifact_ratings;
    DROP TABLE IF EXISTS creative_royalty_cascade_ledger;
    DROP TABLE IF EXISTS creative_usage_licenses;
    DROP TABLE IF EXISTS creative_artifact_derivatives;
    DROP TABLE IF EXISTS creative_artifacts;
  `);
}
