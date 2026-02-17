// migrations/005_purchases_table.js
// Purchase state machine table — tracks every purchase through its lifecycle.
// Enables reconciliation, dispute handling, and crash recovery.

export const id = "005";
export const name = "purchases_table";

export function up(db) {
  db.exec(`
    -- Purchase lifecycle state machine.
    -- Each purchase progresses through states; never deleted, only transitioned.
    CREATE TABLE IF NOT EXISTS purchases (
      id              TEXT PRIMARY KEY,
      purchase_id     TEXT NOT NULL UNIQUE,
      buyer_id        TEXT NOT NULL,
      seller_id       TEXT NOT NULL,
      listing_id      TEXT NOT NULL,
      listing_type    TEXT,
      license_type    TEXT,
      amount          REAL NOT NULL CHECK(amount >= 0),
      source          TEXT NOT NULL DEFAULT 'artistry',

      status          TEXT NOT NULL DEFAULT 'CREATED' CHECK(status IN (
        'CREATED','PAYMENT_PENDING','PAID','SETTLED','FULFILLED',
        'FAILED','REFUNDED','CHARGEBACK','DISPUTED'
      )),

      -- Settlement references
      settlement_batch_id TEXT,
      ref_id              TEXT,
      license_id          TEXT,
      stripe_session_id   TEXT,
      stripe_event_id     TEXT,

      -- Fee/royalty breakdown (snapshot at time of settlement)
      marketplace_fee     REAL DEFAULT 0,
      seller_net          REAL DEFAULT 0,
      total_royalties     REAL DEFAULT 0,
      royalty_details_json TEXT DEFAULT '[]',

      -- Lifecycle tracking
      error_message     TEXT,
      retry_count       INTEGER NOT NULL DEFAULT 0,
      last_retry_at     TEXT,
      resolved_by       TEXT,
      resolved_at       TEXT,
      resolution_notes  TEXT,

      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_buyer    ON purchases(buyer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_purchases_seller   ON purchases(seller_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_purchases_status   ON purchases(status);
    CREATE INDEX IF NOT EXISTS idx_purchases_listing  ON purchases(listing_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_ref      ON purchases(ref_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_purchase_id ON purchases(purchase_id);

    -- Purchase status history — append-only log of every state transition.
    CREATE TABLE IF NOT EXISTS purchase_status_history (
      id          TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      from_status TEXT,
      to_status   TEXT NOT NULL,
      reason      TEXT,
      actor       TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_psh_purchase ON purchase_status_history(purchase_id, created_at);
  `);
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS purchase_status_history;
    DROP TABLE IF EXISTS purchases;
  `);
}
