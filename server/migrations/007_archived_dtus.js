export const up = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS archived_dtus (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      tier TEXT,
      consolidated_into TEXT,
      archived_at TEXT NOT NULL,
      rehydrated_count INTEGER DEFAULT 0,
      last_rehydrated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_archived_consolidated
      ON archived_dtus(consolidated_into);
    CREATE INDEX IF NOT EXISTS idx_archived_tier
      ON archived_dtus(tier);
  `);
};

export const down = (db) => {
  db.exec(`DROP TABLE IF EXISTS archived_dtus`);
};
