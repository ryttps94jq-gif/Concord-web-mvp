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
  const credits = db.prepare(`
    SELECT COALESCE(SUM(net), 0) as total
    FROM economy_ledger
    WHERE to_user_id = ? AND status = 'complete'
  `).get(userId);

  const debits = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM economy_ledger
    WHERE from_user_id = ? AND status = 'complete'
  `).get(userId);

  const totalCredits = credits?.total || 0;
  const totalDebits = debits?.total || 0;
  const balance = Math.round((totalCredits - totalDebits) * 100) / 100;

  return { balance, totalCredits, totalDebits };
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
