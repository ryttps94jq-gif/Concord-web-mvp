// migrations/004_ledger_idempotency.js
// Add ref_id column to economy_ledger for purchase idempotency.
// All entries in a single settlement batch share the same ref_id.
// A unique partial index prevents duplicate processing.

export function up(db) {
  db.exec(`
    -- Add ref_id column for idempotency (nullable — legacy rows won't have one)
    ALTER TABLE economy_ledger ADD COLUMN ref_id TEXT;

    -- Unique partial index: only one settlement per ref_id
    -- The "role = 'debit'" filter ensures only one constraint check per batch
    -- (a batch has debit + credit + fee + royalties, all sharing the same ref_id,
    --  but we only enforce uniqueness on the debit entry to avoid false conflicts)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_ref_id_debit
      ON economy_ledger(ref_id)
      WHERE ref_id IS NOT NULL AND json_extract(metadata_json, '$.role') = 'debit';
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_ledger_ref_id_debit;
    -- SQLite doesn't support DROP COLUMN before 3.35.0, so we leave the column
  `);
}
