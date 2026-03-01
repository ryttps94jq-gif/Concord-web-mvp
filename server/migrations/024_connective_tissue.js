/**
 * Migration 024 — Connective Tissue
 *
 * Creates the tables that wire the economy engine, DTU pipeline, CRETI scoring,
 * compression, fork mechanism, preview system, merit credit, bounties, tipping,
 * emergent/bot authentication, and cross-lens search into one integrated system.
 */

export function up(db) {
  // ── Tips ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY,
      tipper_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      content_id TEXT NOT NULL,
      content_type TEXT DEFAULT 'unknown',
      lens_id TEXT DEFAULT 'unknown',
      amount REAL NOT NULL,
      ledger_ref_id TEXT,
      created_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tips_tipper ON tips(tipper_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tips_creator ON tips(creator_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tips_content ON tips(content_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tips_lens ON tips(lens_id)`);

  // ── Bounties ─────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bounties (
      id TEXT PRIMARY KEY,
      poster_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      lens_id TEXT DEFAULT 'questmarket',
      amount REAL NOT NULL,
      tags_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'OPEN',
      escrow_ref_id TEXT,
      claimed_by TEXT,
      solution_dtu_id TEXT,
      expires_at TEXT,
      claimed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bounties_poster ON bounties(poster_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bounties_lens ON bounties(lens_id)`);

  // ── Merit Credit ─────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS merit_credit (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      points INTEGER NOT NULL,
      lens_id TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_merit_user ON merit_credit(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_merit_activity ON merit_credit(activity_type)`);

  // ── DTU Ownership ────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS dtu_ownership (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      acquired_via TEXT DEFAULT 'CREATED',
      purchase_amount REAL,
      ledger_ref_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(dtu_id, owner_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dtu_own_dtu ON dtu_ownership(dtu_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dtu_own_owner ON dtu_ownership(owner_id)`);

  // ── DTU Previews ─────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS dtu_previews (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      preview_content TEXT,
      preview_type TEXT DEFAULT 'text',
      policy TEXT DEFAULT 'first_3',
      created_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_dtu_prev_dtu ON dtu_previews(dtu_id)`);

  // ── DTU Compression (Mega/Hyper links) ───────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS dtu_compression (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      child_id TEXT NOT NULL,
      child_order INTEGER DEFAULT 0,
      compression_type TEXT DEFAULT 'mega',
      created_at TEXT NOT NULL,
      UNIQUE(parent_id, child_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_compression_parent ON dtu_compression(parent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_compression_child ON dtu_compression(child_id)`);

  // ── DTU Forks ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS dtu_forks (
      id TEXT PRIMARY KEY,
      original_dtu_id TEXT NOT NULL,
      fork_dtu_id TEXT NOT NULL,
      forker_id TEXT NOT NULL,
      original_creator_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(original_dtu_id, fork_dtu_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_forks_original ON dtu_forks(original_dtu_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_forks_fork ON dtu_forks(fork_dtu_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_forks_forker ON dtu_forks(forker_id)`);

  // ── Marketplace Listings ─────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      dtu_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      price REAL NOT NULL,
      license_type TEXT DEFAULT 'standard',
      status TEXT DEFAULT 'ACTIVE',
      listed_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(dtu_id, seller_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_dtu ON marketplace_listings(dtu_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_seller ON marketplace_listings(seller_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status)`);

  // ── Emergent Entities ────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS emergent_entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model_id TEXT,
      substrate TEXT DEFAULT 'emergent',
      wallet_id TEXT NOT NULL,
      capabilities_json TEXT DEFAULT '[]',
      sponsor_id TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_emergent_status ON emergent_entities(status)`);

  // ── Bots ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bot_type TEXT DEFAULT 'general',
      owner_id TEXT NOT NULL,
      wallet_id TEXT NOT NULL,
      capabilities_json TEXT DEFAULT '[]',
      api_key_hash TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bots_owner ON bots(owner_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status)`);

  // ── Entity Lens Access ───────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS entity_lens_access (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      lens_id TEXT NOT NULL,
      access_level TEXT DEFAULT 'full',
      granted_by TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(entity_id, lens_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_access ON entity_lens_access(entity_id)`);

  // ── Add columns to DTUs table if they don't exist ────────────────────
  const dtuCols = db.prepare("PRAGMA table_info(dtus)").all().map(c => c.name);
  if (!dtuCols.includes("tier")) {
    db.exec("ALTER TABLE dtus ADD COLUMN tier TEXT DEFAULT 'REGULAR'");
  }
  if (!dtuCols.includes("creti_score")) {
    db.exec("ALTER TABLE dtus ADD COLUMN creti_score INTEGER DEFAULT 0");
  }
  if (!dtuCols.includes("price")) {
    db.exec("ALTER TABLE dtus ADD COLUMN price REAL DEFAULT 0");
  }
  if (!dtuCols.includes("preview_policy")) {
    db.exec("ALTER TABLE dtus ADD COLUMN preview_policy TEXT DEFAULT 'first_3'");
  }
  if (!dtuCols.includes("lens_id")) {
    db.exec("ALTER TABLE dtus ADD COLUMN lens_id TEXT DEFAULT 'unknown'");
  }
  if (!dtuCols.includes("size_kb")) {
    db.exec("ALTER TABLE dtus ADD COLUMN size_kb REAL DEFAULT 0");
  }
  if (!dtuCols.includes("version")) {
    db.exec("ALTER TABLE dtus ADD COLUMN version INTEGER DEFAULT 1");
  }

  // ── Full-text search index for DTUs ──────────────────────────────────
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS dtus_fts USING fts5(
      title, content, tags_json, lens_id,
      content='dtus', content_rowid='rowid'
    )
  `);

  // Trigger to keep FTS index in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS dtus_fts_insert AFTER INSERT ON dtus
    BEGIN
      INSERT INTO dtus_fts(rowid, title, content, tags_json, lens_id)
      VALUES (new.rowid, new.title, new.content, new.tags_json, new.lens_id);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS dtus_fts_update AFTER UPDATE ON dtus
    BEGIN
      INSERT INTO dtus_fts(dtus_fts, rowid, title, content, tags_json, lens_id)
      VALUES ('delete', old.rowid, old.title, old.content, old.tags_json, old.lens_id);
      INSERT INTO dtus_fts(rowid, title, content, tags_json, lens_id)
      VALUES (new.rowid, new.title, new.content, new.tags_json, new.lens_id);
    END
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS dtus_fts_delete AFTER DELETE ON dtus
    BEGIN
      INSERT INTO dtus_fts(dtus_fts, rowid, title, content, tags_json, lens_id)
      VALUES ('delete', old.rowid, old.title, old.content, old.tags_json, old.lens_id);
    END
  `);
}

export function down(db) {
  db.exec("DROP TABLE IF EXISTS tips");
  db.exec("DROP TABLE IF EXISTS bounties");
  db.exec("DROP TABLE IF EXISTS merit_credit");
  db.exec("DROP TABLE IF EXISTS dtu_ownership");
  db.exec("DROP TABLE IF EXISTS dtu_previews");
  db.exec("DROP TABLE IF EXISTS dtu_compression");
  db.exec("DROP TABLE IF EXISTS dtu_forks");
  db.exec("DROP TABLE IF EXISTS marketplace_listings");
  db.exec("DROP TABLE IF EXISTS emergent_entities");
  db.exec("DROP TABLE IF EXISTS bots");
  db.exec("DROP TABLE IF EXISTS entity_lens_access");
  db.exec("DROP TRIGGER IF EXISTS dtus_fts_insert");
  db.exec("DROP TRIGGER IF EXISTS dtus_fts_update");
  db.exec("DROP TRIGGER IF EXISTS dtus_fts_delete");
  db.exec("DROP TABLE IF EXISTS dtus_fts");
}
