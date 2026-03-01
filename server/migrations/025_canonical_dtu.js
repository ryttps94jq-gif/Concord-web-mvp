/**
 * Migration 025 — Canonical DTU Architecture
 *
 * Introduces the canonical deduplication layer, integrity verification,
 * and usage rights system. Every piece of content gets exactly ONE canonical
 * DTU representation. Duplicates resolve to the existing canonical via
 * SHA-256 content hashing.
 *
 * Tables created:
 *   - canonical_registry: maps content hashes to canonical DTU IDs
 *   - dtu_integrity: stores per-DTU integrity envelopes (hashes, signatures)
 *   - dtu_rights: comprehensive usage rights for each DTU
 *
 * Columns added to dtu_store:
 *   - content_hash: SHA-256 of normalized content
 *   - compressed_size: size after compression pipeline
 *   - rights_id: FK to dtu_rights table
 */

export function up(db) {
  // ── Canonical Registry ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS canonical_registry (
      content_hash TEXT PRIMARY KEY,
      canonical_dtu_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reference_count INTEGER DEFAULT 1,
      content_size INTEGER DEFAULT 0,
      compressed_size INTEGER DEFAULT 0,
      compression_ratio REAL DEFAULT 1.0
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canonical_dtu_id ON canonical_registry(canonical_dtu_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_canonical_created ON canonical_registry(created_at DESC)`);

  // ── DTU Integrity ───────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS dtu_integrity (
      dtu_id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      header_checksum TEXT,
      layer_checksums_json TEXT DEFAULT '{}',
      signature TEXT,
      signed_by TEXT,
      signed_at TEXT,
      verified_at TEXT,
      is_valid INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_integrity_hash ON dtu_integrity(content_hash)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_integrity_valid ON dtu_integrity(is_valid)`);

  // ── DTU Rights ──────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS dtu_rights (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL UNIQUE,
      creator_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      derivative_allowed INTEGER DEFAULT 1,
      commercial_allowed INTEGER DEFAULT 0,
      attribution_required INTEGER DEFAULT 1,
      scope TEXT DEFAULT 'local',
      license TEXT DEFAULT 'standard',
      expiration TEXT,
      transferable INTEGER DEFAULT 1,
      max_derivatives INTEGER DEFAULT -1,
      derivative_count INTEGER DEFAULT 0,
      revoked_users_json TEXT DEFAULT '[]',
      granted_users_json TEXT DEFAULT '[]',
      transfer_history_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rights_dtu ON dtu_rights(dtu_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rights_creator ON dtu_rights(creator_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rights_owner ON dtu_rights(owner_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_rights_scope ON dtu_rights(scope)`);

  // ── Add columns to dtu_store if they don't exist ────────────────────
  const dtuStoreCols = db.prepare("PRAGMA table_info(dtu_store)").all().map(c => c.name);
  if (!dtuStoreCols.includes("content_hash")) {
    db.exec("ALTER TABLE dtu_store ADD COLUMN content_hash TEXT");
  }
  if (!dtuStoreCols.includes("compressed_size")) {
    db.exec("ALTER TABLE dtu_store ADD COLUMN compressed_size INTEGER DEFAULT 0");
  }
  if (!dtuStoreCols.includes("rights_id")) {
    db.exec("ALTER TABLE dtu_store ADD COLUMN rights_id TEXT");
  }

  // Index on content_hash for fast canonical lookups
  db.exec("CREATE INDEX IF NOT EXISTS idx_dtu_store_content_hash ON dtu_store(content_hash)");
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS canonical_registry");
  db.exec("DROP TABLE IF EXISTS dtu_integrity");
  db.exec("DROP TABLE IF EXISTS dtu_rights");
  db.exec("DROP INDEX IF EXISTS idx_dtu_store_content_hash");
  // Note: SQLite does not support DROP COLUMN in older versions,
  // so we leave the added columns in place on rollback.
}
