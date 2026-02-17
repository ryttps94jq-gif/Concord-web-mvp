// economy/index.js
// Entry point for the Concord Economy System.
// Registers all economy + Stripe HTTP endpoints on the Express app.

import { registerEconomyRoutes } from "./routes.js";

/**
 * Register economy endpoints.
 * Called from server.js: registerEconomyEndpoints(app, db)
 */
export function registerEconomyEndpoints(app, db) {
  registerEconomyRoutes(app, db);
  console.log("[Concord Economy] All economy + Stripe endpoints registered");
}

// Re-export core modules for direct use by other server modules
export { getBalance, hasSufficientBalance } from "./balances.js";
export { calculateFee, FEES, PLATFORM_ACCOUNT_ID } from "./fees.js";
export { executeTransfer, executePurchase, executeMarketplacePurchase, executeReversal } from "./transfer.js";
export { recordTransaction, recordTransactionBatch, getTransactions, generateTxId, checkRefIdProcessed } from "./ledger.js";
export { requestWithdrawal, processWithdrawal } from "./withdrawals.js";
export { adminOnly, authRequired, requireAdmin, requireUser } from "./guards.js";
export { economyAudit, auditCtx } from "./audit.js";
export { validateAmount, validateBalance } from "./validators.js";
export { STRIPE_ENABLED, createCheckoutSession, handleWebhook, createConnectOnboarding, getConnectStatus } from "./stripe.js";
export {
  createPurchase, transitionPurchase, recordSettlement, getPurchase,
  getPurchaseByRefId, getUserPurchases, findPurchasesByStatus, getPurchaseHistory, TRANSITIONS,
} from "./purchases.js";
export { runReconciliation, executeCorrection, getPurchaseReceipt, getReconciliationSummary } from "./reconciliation.js";
