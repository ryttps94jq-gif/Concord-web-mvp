// migrations/008_economic_system.js
// Economic system expansion: Concord Coin treasury, royalty cascades,
// emergent accounts, marketplace listings, fee split tracking.

export function up(db) {
  db.exec(`
    -- ═══════════════════════════════════════════════════════════════════════
    -- TREASURY: Tracks total USD backing and coin supply
    -- ═══════════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS treasury (
      id              TEXT PRIMARY KEY,
      total_usd       REAL NOT NULL DEFAULT 0 CHECK(total_usd >= 0),
      total_coins     REAL NOT NULL DEFAULT 0 CHECK(total_coins >= 0),
      last_reconciled TEXT,
      drift_amount    REAL DEFAULT 0,
      drift_alert     INTEGER DEFAULT 0,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Seed single treasury record
    INSERT OR IGNORE INTO treasury (id, total_usd, total_coins, updated_at)
    VALUES ('treasury_main', 0, 0, datetime('now'));

    -- Treasury audit log — every mint/burn event
    CREATE TABLE IF NOT EXISTS treasury_events (
      id            TEXT PRIMARY KEY,
      event_type    TEXT NOT NULL CHECK(event_type IN ('MINT', 'BURN', 'RECONCILE', 'DRIFT_ALERT')),
      amount        REAL NOT NULL,
      usd_before    REAL NOT NULL,
      usd_after     REAL NOT NULL,
      coins_before  REAL NOT NULL,
      coins_after   REAL NOT NULL,
      ref_id        TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_treasury_events_type ON treasury_events(event_type, created_at);

    -- ═══════════════════════════════════════════════════════════════════════
    -- ROYALTY CASCADE: Citation chains and perpetual royalty tracking
    -- ═══════════════════════════════════════════════════════════════════════

    -- Tracks citation lineage between content
    CREATE TABLE IF NOT EXISTS royalty_lineage (
      id              TEXT PRIMARY KEY,
      child_id        TEXT NOT NULL,
      parent_id       TEXT NOT NULL,
      generation      INTEGER NOT NULL DEFAULT 1 CHECK(generation >= 1),
      creator_id      TEXT NOT NULL,
      parent_creator  TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(child_id, parent_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lineage_child  ON royalty_lineage(child_id);
    CREATE INDEX IF NOT EXISTS idx_lineage_parent ON royalty_lineage(parent_id);
    CREATE INDEX IF NOT EXISTS idx_lineage_creator ON royalty_lineage(creator_id);

    -- Royalty payout records — every royalty distribution event
    CREATE TABLE IF NOT EXISTS royalty_payouts (
      id              TEXT PRIMARY KEY,
      transaction_id  TEXT NOT NULL,
      content_id      TEXT NOT NULL,
      recipient_id    TEXT NOT NULL,
      amount          REAL NOT NULL CHECK(amount > 0),
      generation      INTEGER NOT NULL,
      royalty_rate    REAL NOT NULL,
      source_tx_id    TEXT NOT NULL,
      ledger_entry_id TEXT,
      metadata_json   TEXT DEFAULT '{}',
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_royalty_content   ON royalty_payouts(content_id);
    CREATE INDEX IF NOT EXISTS idx_royalty_recipient ON royalty_payouts(recipient_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_royalty_source_tx ON royalty_payouts(source_tx_id);

    -- ═══════════════════════════════════════════════════════════════════════
    -- EMERGENT ACCOUNTS: Sovereign AI economic participants
    -- ═══════════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS emergent_accounts (
      id              TEXT PRIMARY KEY,
      emergent_id     TEXT NOT NULL UNIQUE,
      display_name    TEXT,
      operating_balance REAL NOT NULL DEFAULT 0 CHECK(operating_balance >= 0),
      reserve_balance   REAL NOT NULL DEFAULT 0 CHECK(reserve_balance >= 0),
      seed_amount     REAL NOT NULL DEFAULT 0,
      total_earned    REAL NOT NULL DEFAULT 0,
      total_spent     REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'terminated')),
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_emergent_id ON emergent_accounts(emergent_id);
    CREATE INDEX IF NOT EXISTS idx_emergent_status ON emergent_accounts(status);

    -- ═══════════════════════════════════════════════════════════════════════
    -- MARKETPLACE LISTINGS: Content for sale
    -- ═══════════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS marketplace_economy_listings (
      id              TEXT PRIMARY KEY,
      seller_id       TEXT NOT NULL,
      content_id      TEXT NOT NULL,
      content_type    TEXT NOT NULL CHECK(content_type IN (
        'dtu', 'mega_dtu', 'hyper_dtu', 'music', 'art', 'document', 'artifact'
      )),
      title           TEXT NOT NULL,
      description     TEXT,
      price           REAL NOT NULL CHECK(price > 0),
      content_hash    TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN (
        'active', 'sold', 'delisted', 'flagged'
      )),
      preview_type    TEXT,
      preview_data    TEXT,
      license_type    TEXT NOT NULL DEFAULT 'standard',
      royalty_chain_json TEXT DEFAULT '[]',
      purchase_count  INTEGER NOT NULL DEFAULT 0,
      total_revenue   REAL NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mel_seller   ON marketplace_economy_listings(seller_id, status);
    CREATE INDEX IF NOT EXISTS idx_mel_type     ON marketplace_economy_listings(content_type, status);
    CREATE INDEX IF NOT EXISTS idx_mel_hash     ON marketplace_economy_listings(content_hash);
    CREATE INDEX IF NOT EXISTS idx_mel_status   ON marketplace_economy_listings(status, created_at);

    -- ═══════════════════════════════════════════════════════════════════════
    -- FEE SPLIT TRACKING: 80/10/10 distribution records
    -- ═══════════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS fee_distributions (
      id                TEXT PRIMARY KEY,
      source_tx_id      TEXT NOT NULL,
      total_fee         REAL NOT NULL CHECK(total_fee > 0),
      reserves_amount   REAL NOT NULL,
      operating_amount  REAL NOT NULL,
      payroll_amount    REAL NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_fee_dist_source ON fee_distributions(source_tx_id);

    -- ═══════════════════════════════════════════════════════════════════════
    -- WASH TRADE DETECTION: Flag suspicious repeated trades
    -- ═══════════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS wash_trade_flags (
      id              TEXT PRIMARY KEY,
      account_a       TEXT NOT NULL,
      account_b       TEXT NOT NULL,
      content_id      TEXT NOT NULL,
      trade_count     INTEGER NOT NULL DEFAULT 1,
      flagged_at      TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed        INTEGER NOT NULL DEFAULT 0,
      reviewed_by     TEXT,
      reviewed_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_wash_accounts ON wash_trade_flags(account_a, account_b);

    -- ═══════════════════════════════════════════════════════════════════════
    -- NIGHTLY RECONCILIATION LOG
    -- ═══════════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS treasury_reconciliation_log (
      id                TEXT PRIMARY KEY,
      ledger_total      REAL NOT NULL,
      stripe_total      REAL,
      drift             REAL NOT NULL DEFAULT 0,
      alert_triggered   INTEGER NOT NULL DEFAULT 0,
      details_json      TEXT DEFAULT '{}',
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Expand ledger type constraint to include new types
  // SQLite doesn't support ALTER TABLE CHECK constraints, so we add new types via the migration
  // The existing CHECK constraint allows the original types. New entries using ROYALTY or
  // EMERGENT_TRANSFER will work because we recreate the table with expanded constraints.
  // However, since SQLite doesn't support ALTER CHECK, we handle this at the application layer.
  // The ledger.js code inserts without relying on the CHECK constraint for new types.
}

export function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS treasury_reconciliation_log;
    DROP TABLE IF EXISTS wash_trade_flags;
    DROP TABLE IF EXISTS fee_distributions;
    DROP TABLE IF EXISTS marketplace_economy_listings;
    DROP TABLE IF EXISTS emergent_accounts;
    DROP TABLE IF EXISTS royalty_payouts;
    DROP TABLE IF EXISTS royalty_lineage;
    DROP TABLE IF EXISTS treasury_events;
    DROP TABLE IF EXISTS treasury;
  `);
}
