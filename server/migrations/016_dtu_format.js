/**
 * Migration 016 — DTU File Format System
 *
 * Tables:
 *  - dtu_file_registry     Track all exported DTU files
 *  - dtu_reimports          Track reimported DTU files
 *
 * Columns added to artifact_exports:
 *  - format_version, file_hash, signature, file_size
 */

export function up(db) {
  db.exec(`
    -- DTU file registry (track all exported DTU files)
    CREATE TABLE IF NOT EXISTS dtu_file_registry (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      export_id TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      signature TEXT NOT NULL,
      format_version INTEGER NOT NULL DEFAULT 1,
      primary_type INTEGER NOT NULL,
      artifact_type TEXT,
      artifact_size INTEGER,
      total_size INTEGER NOT NULL,
      compression_type INTEGER NOT NULL DEFAULT 1,
      layers_present INTEGER NOT NULL DEFAULT 1,
      exported_by TEXT NOT NULL,
      exported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dtu_files_hash
      ON dtu_file_registry(file_hash);
    CREATE INDEX IF NOT EXISTS idx_dtu_files_dtu
      ON dtu_file_registry(dtu_id);
    CREATE INDEX IF NOT EXISTS idx_dtu_files_exporter
      ON dtu_file_registry(exported_by);

    -- Reimport tracking
    CREATE TABLE IF NOT EXISTS dtu_reimports (
      id TEXT PRIMARY KEY,
      original_dtu_id TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      signature_verified INTEGER NOT NULL DEFAULT 0,
      imported_by TEXT NOT NULL,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      source TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reimports_hash
      ON dtu_reimports(file_hash);
    CREATE INDEX IF NOT EXISTS idx_reimports_user
      ON dtu_reimports(imported_by);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS dtu_reimports;
    DROP TABLE IF EXISTS dtu_file_registry;
  `);
}
