/**
 * Migration 019 — Universal Lens Compliance Framework
 *
 * Tables:
 *  - lens_registry              All active lenses (system, user, emergent)
 *  - lens_compliance_results    Per-lens per-run compliance results
 *  - lens_audits                Nightly audit results
 *  - lens_upgrades              Platform upgrade records
 *  - lens_upgrade_status        Per-lens upgrade compliance status
 */

export function up(db) {
  db.exec(`
    -- Lens registry (all active lenses)
    CREATE TABLE IF NOT EXISTS lens_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      classification TEXT NOT NULL
        CHECK (classification IN ('KNOWLEDGE','CREATIVE','SOCIAL','CULTURE','UTILITY','HYBRID')),
      version TEXT NOT NULL,
      protection_mode TEXT NOT NULL
        CHECK (protection_mode IN ('PROTECTED', 'OPEN', 'ISOLATED')),
      creator_id TEXT NOT NULL,
      creator_type TEXT NOT NULL DEFAULT 'system'
        CHECK (creator_type IN ('system', 'user', 'emergent')),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled', 'pending_review', 'pending_compliance')),
      federation_tiers_json TEXT NOT NULL DEFAULT '[]',
      artifact_types_json TEXT DEFAULT '[]',
      config_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      disabled_at TEXT,
      disabled_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_lens_classification
      ON lens_registry(classification);
    CREATE INDEX IF NOT EXISTS idx_lens_status
      ON lens_registry(status);
    CREATE INDEX IF NOT EXISTS idx_lens_creator
      ON lens_registry(creator_id);

    -- Compliance results (per lens per run)
    CREATE TABLE IF NOT EXISTS lens_compliance_results (
      id TEXT PRIMARY KEY,
      lens_id TEXT NOT NULL,
      lens_version TEXT NOT NULL,
      classification TEXT NOT NULL,
      passed BOOLEAN NOT NULL,
      total_checks INTEGER NOT NULL,
      passed_checks INTEGER NOT NULL,
      failed_checks INTEGER NOT NULL,
      warnings INTEGER NOT NULL DEFAULT 0,
      results_json TEXT NOT NULL,
      validated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lens_id) REFERENCES lens_registry(id)
    );

    CREATE INDEX IF NOT EXISTS idx_compliance_lens
      ON lens_compliance_results(lens_id, validated_at);
    CREATE INDEX IF NOT EXISTS idx_compliance_passed
      ON lens_compliance_results(passed, validated_at);

    -- Nightly audit results
    CREATE TABLE IF NOT EXISTS lens_audits (
      id TEXT PRIMARY KEY,
      total_lenses INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      failed INTEGER NOT NULL,
      warnings INTEGER NOT NULL DEFAULT 0,
      failures_json TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL
    );

    -- Upgrade propagation
    CREATE TABLE IF NOT EXISTS lens_upgrades (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      required_by TEXT NOT NULL,
      new_checks TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lens_upgrade_status (
      upgrade_id TEXT NOT NULL,
      lens_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'needs_update'
        CHECK (status IN ('compliant', 'needs_update', 'disabled')),
      failures_json TEXT,
      deadline TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      PRIMARY KEY (upgrade_id, lens_id),
      FOREIGN KEY (upgrade_id) REFERENCES lens_upgrades(id),
      FOREIGN KEY (lens_id) REFERENCES lens_registry(id)
    );
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS lens_upgrade_status;
    DROP TABLE IF EXISTS lens_upgrades;
    DROP TABLE IF EXISTS lens_audits;
    DROP TABLE IF EXISTS lens_compliance_results;
    DROP TABLE IF EXISTS lens_registry;
  `);
}
