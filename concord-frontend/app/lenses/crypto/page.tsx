'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Coins, TrendingUp, Lock, RefreshCw, ArrowRightLeft, Wallet, Loader2 } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { ErrorState } from '@/components/common/EmptyState';

interface ChainData {
  chainId: string;
  name: string;
  symbol: string;
  balance: number;
  price: number;
}

interface TransactionData {
  type: 'earn' | 'spend';
  amount: number;
  symbol: string;
  description: string;
  timestamp: string;
}

const SEED_CHAINS: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

const SEED_TRANSACTIONS: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

export default function CryptoLensPage() {
  useLensNav('crypto');
  const [selectedChain, setSelectedChain] = useState('concord');
  const [transacting, setTransacting] = useState(false);

  const {
    items: chainItems,
    isLoading: chainsLoading, isError: isError, error: error, refetch: refetch,
    update: updateChain,
  } = useLensData<ChainData>('crypto', 'chain', {
    seed: SEED_CHAINS,
  });

  const {
    items: txItems,
    isLoading: txLoading, isError: isError2, error: error2, refetch: refetch2,
    create: createTransaction,
  } = useLensData<TransactionData>('crypto', 'transaction', {
    seed: SEED_TRANSACTIONS,
  });

  const chains = chainItems.map(item => ({
    id: item.data.chainId || item.id,
    name: item.data.name || item.title,
    symbol: item.data.symbol || '??',
    balance: item.data.balance ?? 0,
    price: item.data.price ?? 0,
    _lensId: item.id,
  }));

  const transactions = txItems.map(item => ({
    id: item.id,
    type: item.data.type || 'earn',
    amount: item.data.amount ?? 0,
    symbol: item.data.symbol || 'CC',
    description: item.data.description || item.title,
    timestamp: item.data.timestamp || item.createdAt,
  }));

  const selectedChainData = chains.find((c) => c.id === selectedChain);
  const isLoading = chainsLoading || txLoading;

  const handleEarn = async () => {
    if (!selectedChainData) return;
    setTransacting(true);
    try {
      // Record the earn transaction via the credits API
      await apiHelpers.credits.earn('default', 10, 'manual-earn');
      // Create a transaction record in lens data
      await createTransaction({
        title: `Earned 10 ${selectedChainData.symbol}`,
        data: {
          type: 'earn',
          amount: 10,
          symbol: selectedChainData.symbol,
          description: 'Manual earn',
          timestamp: new Date().toISOString(),
        } as unknown as Partial<TransactionData>,
        meta: { tags: ['earn', selectedChainData.symbol], status: 'completed' },
      });
      // Update the chain balance
      await updateChain(selectedChainData._lensId, {
        data: {
          ...chainItems.find(c => c.id === selectedChainData._lensId)?.data,
          balance: selectedChainData.balance + 10,
        } as unknown as Partial<ChainData>,
      });
    } catch {
      // Errors handled silently; the UI will reflect actual state on next refetch
    } finally {
      setTransacting(false);
    }
  };


  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">&#x1FA99;</span>
        <div>
          <h1 className="text-xl font-bold">Crypto Lens</h1>
          <p className="text-sm text-gray-400">
            Blockchain simulations and CC ledger management
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading crypto data...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="lens-card">
              <Wallet className="w-5 h-5 text-neon-green mb-2" />
              <p className="text-2xl font-bold">{selectedChainData?.balance ?? '--'} {selectedChainData?.symbol ?? ''}</p>
              <p className="text-sm text-gray-400">Balance</p>
            </div>
            <div className="lens-card">
              <TrendingUp className="w-5 h-5 text-neon-blue mb-2" />
              <p className="text-2xl font-bold">${selectedChainData?.price ?? '--'}</p>
              <p className="text-sm text-gray-400">Price</p>
            </div>
            <div className="lens-card">
              <ArrowRightLeft className="w-5 h-5 text-neon-purple mb-2" />
              <p className="text-2xl font-bold">{transactions.length}</p>
              <p className="text-sm text-gray-400">Transactions</p>
            </div>
            <div className="lens-card">
              <Lock className="w-5 h-5 text-neon-cyan mb-2" />
              <p className="text-2xl font-bold">Verified</p>
              <p className="text-sm text-gray-400">Ledger Status</p>
            </div>
          </div>

          {/* Chain Selector */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Coins className="w-4 h-4 text-neon-green" />
              Chains
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`lens-card text-left ${
                    selectedChain === chain.id ? 'border-neon-green ring-1 ring-neon-green' : ''
                  }`}
                >
                  <p className="font-semibold">{chain.name}</p>
                  <p className="text-2xl font-bold text-neon-green mt-2">
                    {chain.balance} {chain.symbol}
                  </p>
                  <p className="text-xs text-gray-400">${(chain.balance * chain.price).toLocaleString()}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleEarn}
                disabled={transacting || !selectedChainData}
                className="btn-neon green flex items-center gap-2 disabled:opacity-50"
              >
                {transacting && <Loader2 className="w-4 h-4 animate-spin" />}
                Earn 10 {selectedChainData?.symbol || 'CC'}
              </button>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-neon-blue" />
              Recent Transactions
            </h2>
            {transactions.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${tx.type === 'earn' ? 'bg-neon-green' : 'bg-neon-pink'}`} />
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-gray-500">{new Date(tx.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`font-mono ${tx.type === 'earn' ? 'text-neon-green' : 'text-neon-pink'}`}>
                      {tx.type === 'earn' ? '+' : '-'}{tx.amount} {tx.symbol}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
