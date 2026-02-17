// migrations/002_economy_tables.js
// Economy system tables: ledger (append-only), withdrawals (workflow).

export const id = "002";
export const name = "economy_tables";

export function up(db) {
  db.exec(`
    -- Append-only ledger: source of truth for all economic activity.
    -- Rows are NEVER updated or deleted.
    CREATE TABLE IF NOT EXISTS economy_ledger (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL CHECK(type IN (
        'TOKEN_PURCHASE','TRANSFER','MARKETPLACE_PURCHASE',
        'ROYALTY_PAYOUT','WITHDRAWAL','FEE','REVERSAL'
      )),
      from_user_id  TEXT,
      to_user_id    TEXT,
      amount        REAL NOT NULL CHECK(amount > 0),
      fee           REAL NOT NULL DEFAULT 0 CHECK(fee >= 0),
      net           REAL NOT NULL CHECK(net > 0),
      status        TEXT NOT NULL DEFAULT 'complete' CHECK(status IN ('pending','complete','reversed')),
      metadata_json TEXT DEFAULT '{}',
      request_id    TEXT,
      ip            TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK(from_user_id IS NOT NULL OR to_user_id IS NOT NULL)
    );

    CREATE INDEX IF NOT EXISTS idx_ledger_from   ON economy_ledger(from_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_to     ON economy_ledger(to_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ledger_type   ON economy_ledger(type);
    CREATE INDEX IF NOT EXISTS idx_ledger_status ON economy_ledger(status);
    CREATE INDEX IF NOT EXISTS idx_ledger_time   ON economy_ledger(created_at);

    -- Withdrawal requests with multi-step workflow.
    CREATE TABLE IF NOT EXISTS economy_withdrawals (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      amount        REAL NOT NULL CHECK(amount > 0),
      fee           REAL NOT NULL DEFAULT 0 CHECK(fee >= 0),
      net           REAL NOT NULL CHECK(net > 0),
      status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
        'pending','approved','processing','complete','rejected','cancelled'
      )),
      ledger_id     TEXT,
      reviewed_by   TEXT,
      reviewed_at   TEXT,
      processed_at  TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_withdrawals_user   ON economy_withdrawals(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON economy_withdrawals(status);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS economy_withdrawals;
    DROP TABLE IF EXISTS economy_ledger;
  `);
}
