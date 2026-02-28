/**
 * Migration 022 — Marketplace Lens Registry
 *
 * Complete 112-lens marketplace specification table with DTU types,
 * economics, citation rules, cross-lens references, and disruption data.
 *
 * This table stores the full marketplace definition for every lens,
 * complementing the existing lens_registry (015) and lens compliance (019)
 * tables with marketplace-specific economics and DTU catalog data.
 */

export function up(db) {
  db.exec(`
    -- Marketplace lens registry — full 112-lens catalog
    CREATE TABLE IF NOT EXISTS marketplace_lens_registry (
      id TEXT PRIMARY KEY,
      lens_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      lens_number INTEGER NOT NULL UNIQUE,
      category TEXT NOT NULL,
      classification TEXT NOT NULL
        CHECK (classification IN ('KNOWLEDGE','CREATIVE','SOCIAL','CULTURE','UTILITY','HYBRID')),
      icon TEXT,

      -- Sub-tabs for lenses with multiple views
      sub_tabs_json TEXT NOT NULL DEFAULT '[]',

      -- Marketplace DTU catalog: array of { type, description, price: { min, max, unit } }
      marketplace_dtus_json TEXT NOT NULL DEFAULT '[]',

      -- Economics: { description, creatorShare, platformFee, ... }
      economics_json TEXT NOT NULL DEFAULT '{}',

      -- Citation rules: { description, cascadeEnabled }
      citation_rules_json TEXT NOT NULL DEFAULT '{}',

      -- Cross-lens references: array of lens_id strings
      cross_lens_refs_json TEXT NOT NULL DEFAULT '[]',

      -- Unique value proposition
      unique_value TEXT,

      -- Industries disrupted: array of strings
      industries_disrupted_json TEXT NOT NULL DEFAULT '[]',

      -- Preview strategy for marketplace content
      preview_strategy TEXT NOT NULL DEFAULT 'structural_summary',

      -- Default protection mode
      protection_default TEXT NOT NULL DEFAULT 'OPEN'
        CHECK (protection_default IN ('PROTECTED', 'OPEN', 'ISOLATED')),

      -- Federation tiers this lens participates in
      federation_tiers_json TEXT NOT NULL DEFAULT '[]',

      -- DTU layers this lens reads/writes
      layers_used_json TEXT NOT NULL DEFAULT '[]',

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mplr_category
      ON marketplace_lens_registry(category);
    CREATE INDEX IF NOT EXISTS idx_mplr_classification
      ON marketplace_lens_registry(classification);
    CREATE INDEX IF NOT EXISTS idx_mplr_lens_number
      ON marketplace_lens_registry(lens_number);
    CREATE INDEX IF NOT EXISTS idx_mplr_protection
      ON marketplace_lens_registry(protection_default);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS marketplace_lens_registry;
  `);
}
