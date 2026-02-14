// economy/index.js
// Entry point for the Concord Economy System.
// Registers all economy HTTP endpoints on the Express app.

import { registerEconomyRoutes } from "./routes.js";

/**
 * Register economy endpoints.
 * Called from server.js: registerEconomyEndpoints(app, db)
 */
export function registerEconomyEndpoints(app, db) {
  registerEconomyRoutes(app, db);
  console.log("[Concord Economy] All economy endpoints registered");
}

// Re-export core modules for direct use by other server modules
export { getBalance, hasSufficientBalance } from "./balances.js";
export { calculateFee, FEES, PLATFORM_ACCOUNT_ID } from "./fees.js";
export { executeTransfer, executePurchase, executeMarketplacePurchase, executeReversal } from "./transfer.js";
export { recordTransaction, getTransactions } from "./ledger.js";
export { requestWithdrawal, processWithdrawal } from "./withdrawals.js";
