/**
 * Migration 011: Federation Hierarchy Tiers
 *
 * Implements the Concord Federation Hierarchy Spec v1.0:
 *   - Nationals registry (country-level sovereign entities)
 *   - Regions registry (city/metro areas within nationals)
 *   - CRI instances registry (physical Concord Regional Instances)
 *   - User location declarations (self-declared, never scraped)
 *   - DTU location + federation tier tags
 *   - Marketplace listing location tags for local-first purchasing
 *   - Federation escalation log (knowledge resolution audit trail)
 *   - User location history (audit-only, never exposed)
 *   - Entity location / CRI home base tracking
 */

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════
    -- National registry (Tier 2)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS nationals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country_code TEXT NOT NULL UNIQUE,
      compliance_json TEXT NOT NULL DEFAULT '{}',
      steward_council_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════════════════════════
    -- Region registry (Tier 1)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      national_id TEXT NOT NULL,
      timezone TEXT,
      cri_count INTEGER DEFAULT 0,
      user_count INTEGER DEFAULT 0,
      entity_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (national_id) REFERENCES nationals(id)
    );

    CREATE INDEX IF NOT EXISTS idx_regions_national
      ON regions(national_id);

    -- ═══════════════════════════════════════════════════
    -- CRI instances (physical Concord Regional Instances)
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS cri_instances (
      id TEXT PRIMARY KEY,
      regional_id TEXT NOT NULL,
      national_id TEXT NOT NULL,
      area_description TEXT,
      capabilities_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','maintenance','offline')),
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_heartbeat TEXT,
      FOREIGN KEY (regional_id) REFERENCES regions(id),
      FOREIGN KEY (national_id) REFERENCES nationals(id)
    );

    CREATE INDEX IF NOT EXISTS idx_cri_regional
      ON cri_instances(regional_id);
    CREATE INDEX IF NOT EXISTS idx_cri_national
      ON cri_instances(national_id);
    CREATE INDEX IF NOT EXISTS idx_cri_status
      ON cri_instances(status);

    -- ═══════════════════════════════════════════════════
    -- User location declarations
    -- ═══════════════════════════════════════════════════

    ALTER TABLE users ADD COLUMN declared_regional TEXT;
    ALTER TABLE users ADD COLUMN declared_national TEXT;
    ALTER TABLE users ADD COLUMN location_declared_at TEXT;

    -- User location change history (audit-only, never exposed)
    CREATE TABLE IF NOT EXISTS user_location_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      previous_regional TEXT,
      previous_national TEXT,
      changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_location_history_user
      ON user_location_history(user_id);

    -- ═══════════════════════════════════════════════════
    -- DTU location & federation tier tags
    -- ═══════════════════════════════════════════════════

    ALTER TABLE dtus ADD COLUMN location_regional TEXT;
    ALTER TABLE dtus ADD COLUMN location_national TEXT;
    ALTER TABLE dtus ADD COLUMN federation_tier TEXT DEFAULT 'local'
      CHECK (federation_tier IN ('local','regional','national','global'));

    CREATE INDEX IF NOT EXISTS idx_dtus_location_regional
      ON dtus(location_regional);
    CREATE INDEX IF NOT EXISTS idx_dtus_location_national
      ON dtus(location_national);
    CREATE INDEX IF NOT EXISTS idx_dtus_federation_tier
      ON dtus(federation_tier);

    -- DTU federation promotion history
    CREATE TABLE IF NOT EXISTS dtu_federation_history (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      from_tier TEXT NOT NULL,
      to_tier TEXT NOT NULL,
      promoted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reason TEXT,
      FOREIGN KEY (dtu_id) REFERENCES dtus(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_dtu_fed_history_dtu
      ON dtu_federation_history(dtu_id);

    -- ═══════════════════════════════════════════════════
    -- Marketplace listing location tags
    -- ═══════════════════════════════════════════════════

    ALTER TABLE marketplace_economy_listings ADD COLUMN location_regional TEXT;
    ALTER TABLE marketplace_economy_listings ADD COLUMN location_national TEXT;

    CREATE INDEX IF NOT EXISTS idx_mel_location_regional
      ON marketplace_economy_listings(location_regional);
    CREATE INDEX IF NOT EXISTS idx_mel_location_national
      ON marketplace_economy_listings(location_national);

    -- ═══════════════════════════════════════════════════
    -- Federation escalation log
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS federation_escalations (
      id TEXT PRIMARY KEY,
      query_hash TEXT NOT NULL,
      from_tier TEXT NOT NULL,
      to_tier TEXT NOT NULL,
      regional TEXT,
      national TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_escalations_tier
      ON federation_escalations(from_tier, to_tier);
    CREATE INDEX IF NOT EXISTS idx_escalations_regional
      ON federation_escalations(regional);

    -- ═══════════════════════════════════════════════════
    -- Entity location / CRI home base
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS entity_home_base (
      entity_id TEXT PRIMARY KEY,
      cri_id TEXT NOT NULL,
      regional TEXT NOT NULL,
      national TEXT NOT NULL,
      arrived_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cri_id) REFERENCES cri_instances(id)
    );

    CREATE TABLE IF NOT EXISTS entity_transfer_history (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      from_cri TEXT NOT NULL,
      to_cri TEXT NOT NULL,
      from_regional TEXT NOT NULL,
      to_regional TEXT NOT NULL,
      transferred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_entity_transfer_entity
      ON entity_transfer_history(entity_id);

    -- ═══════════════════════════════════════════════════
    -- Federation peering config
    -- ═══════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS federation_peers (
      id TEXT PRIMARY KEY,
      peer_type TEXT NOT NULL
        CHECK (peer_type IN ('regional_sibling','national_peer','tier_escalation')),
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      sharing_policy TEXT NOT NULL DEFAULT 'pull_on_demand',
      economic_isolation INTEGER NOT NULL DEFAULT 1,
      compliance_layer INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_fed_peers_from
      ON federation_peers(from_id);
    CREATE INDEX IF NOT EXISTS idx_fed_peers_to
      ON federation_peers(to_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS federation_peers;
    DROP TABLE IF EXISTS entity_transfer_history;
    DROP TABLE IF EXISTS entity_home_base;
    DROP TABLE IF EXISTS federation_escalations;
    DROP TABLE IF EXISTS dtu_federation_history;
    DROP TABLE IF EXISTS user_location_history;
    DROP TABLE IF EXISTS cri_instances;
    DROP TABLE IF EXISTS regions;
    DROP TABLE IF EXISTS nationals;
  `);
  // Note: ALTER TABLE DROP COLUMN not supported in older SQLite.
  // The added columns on users, dtus, marketplace_economy_listings
  // will remain but are harmless if unused.
}
