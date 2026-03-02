// Concord Mobile — Economy Store (Zustand)
// Manages coin balance, transactions, and marketplace state

import { create } from 'zustand';
import type { CoinBalance, Transaction, TransactionType, MarketplaceListing } from '../utils/types';

interface EconomyStore {
  // Balance
  balance: CoinBalance;
  setBalance: (balance: CoinBalance) => void;
  updateBalance: (updates: Partial<CoinBalance>) => void;

  // Transactions
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  markPropagated: (txId: string) => void;
  getTransaction: (id: string) => Transaction | undefined;
  getTransactionsByType: (type: TransactionType) => Transaction[];
  getUnpropagated: () => Transaction[];

  // Marketplace
  listings: MarketplaceListing[];
  cacheListings: (listings: MarketplaceListing[]) => void;
  getListingsByCategory: (category: string) => MarketplaceListing[];
  removeListing: (id: string) => void;
  listingCount: number;

  // Reset
  reset: () => void;
}

const initialBalance: CoinBalance = {
  available: 0,
  pending: 0,
  total: 0,
  lastUpdated: 0,
};

export const useEconomyStore = create<EconomyStore>((set, get) => ({
  balance: { ...initialBalance },
  transactions: [],
  pendingTransactions: [],
  listings: [],
  listingCount: 0,

  setBalance: (balance) => set({ balance }),

  updateBalance: (updates) => set(state => ({
    balance: { ...state.balance, ...updates, lastUpdated: Date.now() },
  })),

  addTransaction: (tx) => set(state => {
    // Idempotency: don't add duplicate transaction IDs
    if (state.transactions.some(t => t.id === tx.id)) return state;

    const transactions = [tx, ...state.transactions];
    const pendingTransactions = tx.status === 'pending'
      ? [tx, ...state.pendingTransactions]
      : state.pendingTransactions;

    // Update balance based on transaction
    const balance = { ...state.balance, lastUpdated: Date.now() };
    if (tx.status === 'confirmed') {
      balance.available = state.balance.available + tx.amount;
      balance.total = state.balance.total + tx.amount;
    } else if (tx.status === 'pending') {
      balance.pending = state.balance.pending + Math.abs(tx.amount);
    }

    return { transactions, pendingTransactions, balance };
  }),

  markPropagated: (txId) => set(state => ({
    transactions: state.transactions.map(tx =>
      tx.id === txId ? { ...tx, propagated: true } : tx
    ),
    pendingTransactions: state.pendingTransactions.filter(tx => tx.id !== txId),
  })),

  getTransaction: (id) => get().transactions.find(tx => tx.id === id),

  getTransactionsByType: (type) => get().transactions.filter(tx => tx.type === type),

  getUnpropagated: () => get().transactions.filter(tx => !tx.propagated),

  cacheListings: (listings) => set({
    listings,
    listingCount: listings.length,
  }),

  getListingsByCategory: (category) =>
    get().listings.filter(l => l.category === category && l.active),

  removeListing: (id) => set(state => {
    const listings = state.listings.filter(l => l.id !== id);
    return { listings, listingCount: listings.length };
  }),

  reset: () => set({
    balance: { ...initialBalance },
    transactions: [],
    pendingTransactions: [],
    listings: [],
    listingCount: 0,
  }),
}));
