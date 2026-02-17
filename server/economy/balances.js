// economy/balances.js
// Balances are NEVER stored — always derived from the ledger.
// balance = sum(credits) - sum(debits) for completed transactions.

/**
 * Compute balance for a user by scanning the ledger.
 * Credits = rows where to_user_id = userId (net amount received).
 * Debits  = rows where from_user_id = userId (amount sent, including fees).
 *
 * @param {object} db — better-sqlite3 instance
 * @param {string} userId
 * @returns {{ balance: number, totalCredits: number, totalDebits: number }}
 */
export function getBalance(db, userId) {
  // Use integer arithmetic (cents) to avoid floating-point drift.
  // CAST to INTEGER rounds at the DB level, then we divide by 100 for display.
  const credits = db.prepare(`
    SELECT COALESCE(SUM(CAST(ROUND(net * 100) AS INTEGER)), 0) as total_cents
    FROM economy_ledger
    WHERE to_user_id = ? AND status = 'complete'
  `).get(userId);

  const debits = db.prepare(`
    SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)), 0) as total_cents
    FROM economy_ledger
    WHERE from_user_id = ? AND status = 'complete'
  `).get(userId);

  const totalCreditsCents = credits?.total_cents || 0;
  const totalDebitsCents = debits?.total_cents || 0;
  const balanceCents = totalCreditsCents - totalDebitsCents;

  return {
    balance: balanceCents / 100,
    totalCredits: totalCreditsCents / 100,
    totalDebits: totalDebitsCents / 100,
  };
}

/**
 * Check if a user has sufficient balance for a given amount.
 */
export function hasSufficientBalance(db, userId, amount) {
  const { balance } = getBalance(db, userId);
  return balance >= amount;
}

/**
 * Get balances for multiple users at once (admin dashboard).
 */
export function getBalances(db, userIds) {
  const results = {};
  for (const userId of userIds) {
    results[userId] = getBalance(db, userId);
  }
  return results;
}

/**
 * Get the platform account balance.
 */
export function getPlatformBalance(db, platformAccountId) {
  return getBalance(db, platformAccountId);
}
