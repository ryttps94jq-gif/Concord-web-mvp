// Concord Mobile — Wallet Hook

import { useCallback } from 'react';
import { useEconomyStore } from '../store/economy-store';
import type { CoinBalance, Transaction, TransactionType } from '../utils/types';

interface UseWalletResult {
  balance: CoinBalance;
  transactions: Transaction[];
  pendingCount: number;
  unpropagatedCount: number;
  getTransactionsByType: (type: TransactionType) => Transaction[];
}

export function useWallet(): UseWalletResult {
  const balance = useEconomyStore(s => s.balance);
  const transactions = useEconomyStore(s => s.transactions);
  const pendingTransactions = useEconomyStore(s => s.pendingTransactions);
  const getUnpropagated = useEconomyStore(s => s.getUnpropagated);
  const getTransactionsByType = useEconomyStore(s => s.getTransactionsByType);

  return {
    balance,
    transactions,
    pendingCount: pendingTransactions.length,
    unpropagatedCount: getUnpropagated().length,
    getTransactionsByType,
  };
}
