/**
 * Migration 023 — Lens Features
 *
 * Stores the complete feature specification for each lens, including
 * Concord Coin integration, DTU economics, merit credit, compression,
 * preview system, remix/citation economy, crew attribution, USB integration,
 * bot/emergent access, and cross-lens economics.
 *
 * Each feature is a row linked to a lens, enabling per-feature querying,
 * status tracking, and cross-lens feature discovery.
 */

export function up(db) {
  db.exec(`
    -- Lens features — detailed feature specs per lens
    CREATE TABLE IF NOT EXISTS lens_features (
      id TEXT PRIMARY KEY,
      lens_id TEXT NOT NULL,
      feature_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL
        CHECK (category IN (
          'economy','marketplace','creation','governance','analysis',
          'collaboration','infrastructure','research','safety','intelligence'
        )),
      integrations_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','beta','planned','deprecated')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(lens_id, feature_id)
    );

    -- Lens feature summary — aggregate stats per lens
    CREATE TABLE IF NOT EXISTS lens_feature_summary (
      lens_id TEXT PRIMARY KEY,
      lens_number INTEGER NOT NULL,
      category TEXT NOT NULL,
      feature_count INTEGER NOT NULL DEFAULT 0,
      economic_integrations_json TEXT NOT NULL DEFAULT '[]',
      emergent_access INTEGER NOT NULL DEFAULT 0,
      bot_access INTEGER NOT NULL DEFAULT 0,
      usb_integration INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lf_lens_id ON lens_features(lens_id);
    CREATE INDEX IF NOT EXISTS idx_lf_category ON lens_features(category);
    CREATE INDEX IF NOT EXISTS idx_lf_status ON lens_features(status);
    CREATE INDEX IF NOT EXISTS idx_lf_feature_id ON lens_features(feature_id);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS lens_features;
    DROP TABLE IF EXISTS lens_feature_summary;
  `);
}
