// economy/index.js
// Entry point for the Concord Economy System.
// Registers all economy + Stripe HTTP endpoints on the Express app.
// Includes: Concord Coin, royalty cascades, emergent accounts,
// marketplace, fee splitting, and treasury reconciliation.

import { registerEconomyRoutes } from "./routes.js";

/**
 * Register economy endpoints.
 * Called from server.js: registerEconomyEndpoints(app, db)
 */
export function registerEconomyEndpoints(app, db) {
  registerEconomyRoutes(app, db);
  console.log("[Concord Economy] All economy + Stripe + marketplace endpoints registered");
}

// Re-export core modules for direct use by other server modules
export { getBalance, hasSufficientBalance, getSystemBalanceSummary } from "./balances.js";
export { calculateFee, FEES, PLATFORM_ACCOUNT_ID, FEE_SPLIT, UNIVERSAL_FEE_RATE } from "./fees.js";
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

// New economic system modules
export { mintCoins, burnCoins, getTreasuryState, verifyTreasuryInvariant, getTreasuryEvents } from "./coin-service.js";
export {
  calculateGenerationalRate, registerCitation, getAncestorChain, distributeRoyalties,
  getCreatorRoyalties, getContentRoyalties, getDescendants,
  ROYALTY_FLOOR, DEFAULT_INITIAL_RATE, CONCORD_SYSTEM_ID,
} from "./royalty-cascade.js";
export {
  createEmergentAccount, transferToReserve, creditOperatingWallet, debitReserveAccount,
  getEmergentAccount, listEmergentAccounts, suspendEmergentAccount,
  isEmergentAccount, canWithdrawToFiat,
} from "./emergent-accounts.js";
export {
  createListing, purchaseListing, getListing, searchListings,
  delistListing, updateListingPrice, hashContent, generatePreview, checkWashTrading,
} from "./marketplace-service.js";
export { distributeFee, getFeeSplitBalances, getFeeDistributions } from "./fee-split.js";
export { runTreasuryReconciliation, getReconciliationHistory } from "./treasury-reconciliation.js";

// Creative Artifact Marketplace (Federation v1.2)
export {
  publishArtifact, publishDerivativeArtifact, purchaseArtifact,
  getArtifact, searchArtifacts, discoverLocalArtists, browseRegionArt,
  getDerivativeTree, rateArtifact,
  checkArtifactPromotionEligibility, promoteArtifact,
  awardCreativeXP, completeCreativeQuest, getCreativeXP, getCreativeQuestCompletions,
  getArtifactLicenses, getUserLicenses,
  getArtifactCascadeEarnings, getCreatorCascadeEarnings,
  pauseArtifact, resumeArtifact, delistArtifact, updateArtifactPrice,
} from "./creative-marketplace.js";
