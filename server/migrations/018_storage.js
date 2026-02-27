/**
 * Migration 018 — Single-Origin Storage Model
 *
 * Tables:
 *  - artifact_vault            Hash-addressed flat storage for original artifacts
 *  - download_log              Lightweight download tracking
 *  - cri_cache                 CRI local cache tracking
 *  - regional_download_stats   Regional download analytics for CRI cache decisions
 */

export function up(db) {
  db.exec(`
    -- Artifact vault (single-origin storage)
    CREATE TABLE IF NOT EXISTS artifact_vault (
      hash TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      original_size INTEGER NOT NULL,
      compressed_size INTEGER NOT NULL,
      compression_type TEXT NOT NULL DEFAULT 'zstd',
      mime_type TEXT NOT NULL,
      reference_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_referenced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vault_refcount
      ON artifact_vault(reference_count);
    CREATE INDEX IF NOT EXISTS idx_vault_last_ref
      ON artifact_vault(last_referenced_at);

    -- Download log (lightweight, tracking only)
    CREATE TABLE IF NOT EXISTS download_log (
      id TEXT PRIMARY KEY,
      artifact_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      vault_hash TEXT,
      downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      file_size INTEGER,
      transfer_time_ms INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_downloads_artifact
      ON download_log(artifact_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_user
      ON download_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_time
      ON download_log(downloaded_at);

    -- CRI cache tracking
    CREATE TABLE IF NOT EXISTS cri_cache (
      cri_id TEXT NOT NULL,
      vault_hash TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_served TEXT,
      serve_count INTEGER DEFAULT 0,
      PRIMARY KEY (cri_id, vault_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_cri_cache_served
      ON cri_cache(last_served);

    -- Regional download analytics (for CRI cache decisions)
    CREATE TABLE IF NOT EXISTS regional_download_stats (
      artifact_id TEXT NOT NULL,
      regional TEXT NOT NULL,
      download_count INTEGER DEFAULT 0,
      last_downloaded TEXT,
      PRIMARY KEY (artifact_id, regional)
    );
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS regional_download_stats;
    DROP TABLE IF EXISTS cri_cache;
    DROP TABLE IF EXISTS download_log;
    DROP TABLE IF EXISTS artifact_vault;
  `);
}
