// economy/fees.js
// Fee schedule and calculation. All fees flow to the PLATFORM_ACCOUNT.

export const FEES = {
  TOKEN_PURCHASE: 0.0146,
  TRANSFER: 0.0146,
  WITHDRAWAL: 0.0146,
  MARKETPLACE_PURCHASE: 0.05,
  ROYALTY_PAYOUT: 0,
  musicDistribution: 0.05,
  artDistribution: 0.05,
};

export const PLATFORM_ACCOUNT_ID = "__PLATFORM__";

/**
 * Calculate fee for a transaction type and amount.
 * @param {string} type — transaction type
 * @param {number} amount — gross amount
 * @returns {{ fee: number, net: number }}
 */
export function calculateFee(type, amount) {
  const rate = FEES[type] ?? 0;
  const fee = Math.round(amount * rate * 100) / 100;
  const net = Math.round((amount - fee) * 100) / 100;
  return { fee, net, rate };
}
