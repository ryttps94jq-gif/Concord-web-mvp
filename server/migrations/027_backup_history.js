/**
 * Migration 027 — Backup History
 *
 * Creates the backup_history table for tracking local and S3 backup operations.
 * Stores metadata about every backup run including size, duration, integrity
 * status, S3 upload details, and any errors encountered.
 *
 * Tables created:
 *   - backup_history: comprehensive backup run log
 */

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_history (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      db_size_bytes INTEGER,
      compressed_size_bytes INTEGER,
      artifacts_size_bytes INTEGER,
      s3_key TEXT,
      s3_etag TEXT,
      integrity_check TEXT,
      duration_ms INTEGER,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      metadata TEXT
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_backup_history_type ON backup_history(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_backup_history_started ON backup_history(started_at DESC)`);
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS backup_history");
}
