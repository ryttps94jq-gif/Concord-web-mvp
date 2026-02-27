/**
 * Migration 015 — Lens & Culture System
 *
 * Tables:
 *  - culture_dtus              Isolated culture substrate
 *  - culture_reflections       Responses to culture DTUs
 *  - culture_resonance         Human resonance (not likes)
 *  - great_merge               Singleton merge state
 *  - sovereign_biomonitor      Vital sign readings
 *  - grief_protocol            Singleton grief state
 *  - lens_protection           Per-artifact lens protection mode
 *  - artifact_exports          Export tracking (analytics only)
 *  - lens_registry             Registered lenses with DTU bridge declarations
 */

export function up(db) {
  db.exec(`
    -- Culture DTU substrate (isolated)
    CREATE TABLE IF NOT EXISTS culture_dtus (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      culture_tier TEXT NOT NULL
        CHECK (culture_tier IN ('regional', 'national')),
      regional TEXT NOT NULL,
      national TEXT NOT NULL,

      -- Content
      content_type TEXT NOT NULL
        CHECK (content_type IN ('text','image','audio','video','mixed')),
      title TEXT,
      body TEXT,
      media_json TEXT DEFAULT '[]',
      tags_json TEXT DEFAULT '[]',
      mood TEXT,

      -- Engagement
      resonance_count INTEGER DEFAULT 0,
      reflection_count INTEGER DEFAULT 0,

      -- Merge tracking
      merge_included INTEGER DEFAULT 0,
      merged_at TEXT,
      global_culture_id TEXT,

      -- Immutability
      frozen INTEGER DEFAULT 0,
      frozen_at TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_culture_regional
      ON culture_dtus(regional, culture_tier);
    CREATE INDEX IF NOT EXISTS idx_culture_national
      ON culture_dtus(national, culture_tier);
    CREATE INDEX IF NOT EXISTS idx_culture_created
      ON culture_dtus(created_at);
    CREATE INDEX IF NOT EXISTS idx_culture_creator
      ON culture_dtus(creator_id);

    -- Culture reflections (responses to culture DTUs)
    CREATE TABLE IF NOT EXISTS culture_reflections (
      id TEXT PRIMARY KEY,
      culture_dtu_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      body TEXT NOT NULL,
      media_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (culture_dtu_id) REFERENCES culture_dtus(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reflections_dtu
      ON culture_reflections(culture_dtu_id);

    -- Culture resonance (not likes — resonance)
    CREATE TABLE IF NOT EXISTS culture_resonance (
      culture_dtu_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (culture_dtu_id, user_id),
      FOREIGN KEY (culture_dtu_id) REFERENCES culture_dtus(id)
    );

    -- Great Merge tracking (singleton)
    CREATE TABLE IF NOT EXISTS great_merge (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      launch_date TEXT NOT NULL,
      merge_date TEXT NOT NULL,
      status TEXT DEFAULT 'countdown'
        CHECK (status IN ('countdown', 'merging', 'complete')),
      phase TEXT DEFAULT 'pre_merge'
        CHECK (phase IN ('pre_merge', 'unveiling', 'weaving', 'understanding', 'complete')),
      phase_started_at TEXT,
      completed_at TEXT,
      total_regional_cultures INTEGER DEFAULT 0,
      total_national_cultures INTEGER DEFAULT 0,
      total_culture_dtus INTEGER DEFAULT 0
    );

    -- Sovereign biomonitor (future hardware integration)
    CREATE TABLE IF NOT EXISTS sovereign_biomonitor (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      alert_level TEXT NOT NULL DEFAULT 'green'
        CHECK (alert_level IN ('green', 'yellow', 'orange', 'red')),
      heart_rate REAL,
      blood_oxygen REAL,
      body_temperature REAL,
      movement_detected INTEGER,
      raw_data_json TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_biomonitor_level
      ON sovereign_biomonitor(alert_level, timestamp);

    -- Grief protocol state (singleton)
    CREATE TABLE IF NOT EXISTS grief_protocol (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      status TEXT DEFAULT 'inactive'
        CHECK (status IN ('inactive', 'activated', 'grief_period', 'transition', 'complete')),
      activated_at TEXT,
      activated_by TEXT,
      grief_period_end TEXT,
      transition_end TEXT,
      completed_at TEXT,
      steward_declarations_json TEXT DEFAULT '[]'
    );

    -- Lens protection registry
    CREATE TABLE IF NOT EXISTS lens_protection (
      artifact_id TEXT NOT NULL,
      lens_id TEXT NOT NULL,
      protection_mode TEXT NOT NULL
        CHECK (protection_mode IN ('PROTECTED', 'OPEN', 'ISOLATED')),
      creator_override INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (artifact_id, lens_id)
    );

    -- Artifact exports tracking (analytics only, no restriction)
    CREATE TABLE IF NOT EXISTS artifact_exports (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      exported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_exports_artifact
      ON artifact_exports(artifact_id);
    CREATE INDEX IF NOT EXISTS idx_exports_user
      ON artifact_exports(user_id);

    -- Lens registry — tracks registered lenses and their DTU bridge declarations
    CREATE TABLE IF NOT EXISTS lens_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      protection_mode TEXT NOT NULL DEFAULT 'PROTECTED'
        CHECK (protection_mode IN ('PROTECTED', 'OPEN', 'ISOLATED')),
      layers_used_json TEXT NOT NULL DEFAULT '["human","core"]',
      supported_artifact_types_json TEXT NOT NULL DEFAULT '[]',
      publishable_scopes_json TEXT NOT NULL DEFAULT '[]',
      federation_tiers_json TEXT NOT NULL DEFAULT '[]',
      bridge_validated INTEGER DEFAULT 0,
      validation_errors_json TEXT DEFAULT '[]',
      is_system INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS lens_registry;
    DROP TABLE IF EXISTS artifact_exports;
    DROP TABLE IF EXISTS lens_protection;
    DROP TABLE IF EXISTS grief_protocol;
    DROP TABLE IF EXISTS sovereign_biomonitor;
    DROP TABLE IF EXISTS great_merge;
    DROP TABLE IF EXISTS culture_resonance;
    DROP TABLE IF EXISTS culture_reflections;
    DROP TABLE IF EXISTS culture_dtus;
  `);
}
