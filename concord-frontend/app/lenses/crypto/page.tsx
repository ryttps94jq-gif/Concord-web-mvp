'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState, useCallback } from 'react';
import {
import { UniversalActions } from '@/components/lens/UniversalActions';
  Coins, TrendingUp, TrendingDown, Lock, RefreshCw, ArrowRightLeft,
  Wallet, Loader2, Plus, Send, ArrowDownLeft, ArrowUpRight,
  Eye, EyeOff, Copy, Check, X, Settings, BarChart3
} from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChainData {
  chainId: string;
  name: string;
  symbol: string;
  balance: number;
  price: number;
}

interface TransactionData {
  type: 'earn' | 'spend' | 'transfer';
  amount: number;
  symbol: string;
  description: string;
  timestamp: string;
  to?: string;
  from?: string;
}

interface WalletData {
  name: string;
  address: string;
  chainId: string;
  isDefault: boolean;
}

type CryptoTab = 'portfolio' | 'transactions' | 'wallets';

// ── Component ─────────────────────────────────────────────────────────────────

export default function CryptoLensPage() {
  useLensNav('crypto');

  const [activeTab, setActiveTab] = useState<CryptoTab>('portfolio');
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [transacting, setTransacting] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'earn' | 'spend' | 'transfer'>('all');
  const [showSendModal, setShowSendModal] = useState(false);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showAddChain, setShowAddChain] = useState(false);

  // Send form
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [sendDescription, setSendDescription] = useState('');

  // Add wallet form
  const [walletName, setWalletName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletChainId, setWalletChainId] = useState('');

  // Add chain form
  const [chainName, setChainName] = useState('');
  const [chainSymbol, setChainSymbol] = useState('');

  // ── Data hooks ────────────────────────────────────────────────────────────

  const {
    items: chainItems,
    isLoading: chainsLoading,
    isError,
    error,
    refetch,
    create: createChain,
    update: updateChain,
  } = useLensData<ChainData>('crypto', 'chain', { seed: [] });

  const {
    items: txItems,
    isLoading: txLoading,
    isError: isError2,
    error: error2,
    refetch: refetch2,
    create: createTransaction,
  } = useLensData<TransactionData>('crypto', 'transaction', { seed: [] });

  const {
    items: walletItems,
    isLoading: walletsLoading,
    isError: isError3,
    error: error3,
    refetch: refetch3,
    create: createWallet,
    remove: removeWallet,
  } = useLensData<WalletData>('crypto', 'wallet', { seed: [] });

  // ── Derived data ──────────────────────────────────────────────────────────

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
    to: item.data.to,
    from: item.data.from,
  }));

  const wallets = walletItems.map(item => ({
    id: item.id,
    name: item.data.name || item.title,
    address: item.data.address || '',
    chainId: item.data.chainId || '',
    isDefault: item.data.isDefault ?? false,
  }));

  const selectedChainData = chains.find(c => c.id === selectedChain) || chains[0] || null;

  const totalPortfolioValue = chains.reduce((sum, c) => sum + c.balance * c.price, 0);

  const filteredTransactions = transactions
    .filter(tx => txFilter === 'all' || tx.type === txFilter)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const isLoading = chainsLoading || txLoading || walletsLoading;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleEarn = useCallback(async () => {
    if (!selectedChainData) return;
    setTransacting(true);
    try {
      await apiHelpers.credits.earn('default', 10, 'manual-earn');
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
      await updateChain(selectedChainData._lensId, {
        data: {
          ...chainItems.find(c => c.id === selectedChainData._lensId)?.data,
          balance: selectedChainData.balance + 10,
        } as unknown as Partial<ChainData>,
      });
    } catch {
      // Will reflect actual state on next refetch
    } finally {
      setTransacting(false);
    }
  }, [selectedChainData, chainItems, createTransaction, updateChain]);

  const handleSpend = useCallback(async () => {
    if (!selectedChainData || selectedChainData.balance < 5) return;
    setTransacting(true);
    try {
      await apiHelpers.credits.spend('default', 5, 'manual-spend');
      await createTransaction({
        title: `Spent 5 ${selectedChainData.symbol}`,
        data: {
          type: 'spend',
          amount: 5,
          symbol: selectedChainData.symbol,
          description: 'Manual spend',
          timestamp: new Date().toISOString(),
        } as unknown as Partial<TransactionData>,
        meta: { tags: ['spend', selectedChainData.symbol], status: 'completed' },
      });
      await updateChain(selectedChainData._lensId, {
        data: {
          ...chainItems.find(c => c.id === selectedChainData._lensId)?.data,
          balance: selectedChainData.balance - 5,
        } as unknown as Partial<ChainData>,
      });
    } catch {
      // Errors handled silently
    } finally {
      setTransacting(false);
    }
  }, [selectedChainData, chainItems, createTransaction, updateChain]);

  const handleSend = useCallback(async () => {
    if (!selectedChainData || !sendAmount || !sendTo) return;
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedChainData.balance) return;
    setTransacting(true);
    try {
      await createTransaction({
        title: `Sent ${amount} ${selectedChainData.symbol} to ${sendTo}`,
        data: {
          type: 'transfer',
          amount,
          symbol: selectedChainData.symbol,
          description: sendDescription || `Transfer to ${sendTo}`,
          timestamp: new Date().toISOString(),
          to: sendTo,
        } as unknown as Partial<TransactionData>,
        meta: { tags: ['transfer', selectedChainData.symbol], status: 'completed' },
      });
      await updateChain(selectedChainData._lensId, {
        data: {
          ...chainItems.find(c => c.id === selectedChainData._lensId)?.data,
          balance: selectedChainData.balance - amount,
        } as unknown as Partial<ChainData>,
      });
      setSendAmount('');
      setSendTo('');
      setSendDescription('');
      setShowSendModal(false);
    } catch {
      // Errors handled silently
    } finally {
      setTransacting(false);
    }
  }, [selectedChainData, sendAmount, sendTo, sendDescription, chainItems, createTransaction, updateChain]);

  const handleAddWallet = useCallback(async () => {
    if (!walletName || !walletAddress) return;
    try {
      await createWallet({
        title: walletName,
        data: {
          name: walletName,
          address: walletAddress,
          chainId: walletChainId || 'concord',
          isDefault: wallets.length === 0,
        } as unknown as Partial<WalletData>,
        meta: { tags: ['wallet'], status: 'active' },
      });
      setWalletName('');
      setWalletAddress('');
      setWalletChainId('');
      setShowAddWallet(false);
    } catch {
      // Errors handled silently
    }
  }, [walletName, walletAddress, walletChainId, wallets.length, createWallet]);

  const handleAddChain = useCallback(async () => {
    if (!chainName || !chainSymbol) return;
    try {
      const chainId = chainName.toLowerCase().replace(/\s+/g, '-');
      await createChain({
        title: chainName,
        data: {
          chainId,
          name: chainName,
          symbol: chainSymbol.toUpperCase(),
          balance: 0,
          price: 1,
        } as unknown as Partial<ChainData>,
        meta: { tags: ['chain'], status: 'active' },
      });
      setChainName('');
      setChainSymbol('');
      setShowAddChain(false);
    } catch {
      // Errors handled silently
    }
  }, [chainName, chainSymbol, createChain]);

  const handleCopyAddress = useCallback((address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  }, []);

  const handleDeleteWallet = useCallback(async (id: string) => {
    try {
      await removeWallet(id);
    } catch {
      // Errors handled silently
    }
  }, [removeWallet]);

  // ── Error / Loading ───────────────────────────────────────────────────────

  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState
          error={error?.message || error2?.message || error3?.message}
          onRetry={() => { refetch(); refetch2(); refetch3(); }}
        />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 border border-green-500/30 flex items-center justify-center">
            <Coins className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Crypto Lens</h1>
            <p className="text-sm text-gray-400">
              Portfolio management, transactions, and wallet controls
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            title={showBalances ? 'Hide balances' : 'Show balances'}
          >
            {showBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { refetch(); refetch2(); refetch3(); }}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="crypto" artifactId={items[0]?.id} compact />
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading crypto data...
        </div>
      ) : (
        <>
          {/* Portfolio Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="lens-card">
              <Wallet className="w-5 h-5 text-neon-green mb-2" />
              <p className="text-2xl font-bold">
                {showBalances ? `$${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '****'}
              </p>
              <p className="text-sm text-gray-400">Total Portfolio Value</p>
            </div>
            <div className="lens-card">
              <BarChart3 className="w-5 h-5 text-neon-blue mb-2" />
              <p className="text-2xl font-bold">{chains.length}</p>
              <p className="text-sm text-gray-400">Chains</p>
            </div>
            <div className="lens-card">
              <ArrowRightLeft className="w-5 h-5 text-neon-purple mb-2" />
              <p className="text-2xl font-bold">{transactions.length}</p>
              <p className="text-sm text-gray-400">Transactions</p>
            </div>
            <div className="lens-card">
              <Lock className="w-5 h-5 text-neon-cyan mb-2" />
              <p className="text-2xl font-bold">{wallets.length}</p>
              <p className="text-sm text-gray-400">Wallets</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-lattice-border">
            {([
              { key: 'portfolio' as CryptoTab, label: 'Portfolio', icon: <TrendingUp className="w-4 h-4" /> },
              { key: 'transactions' as CryptoTab, label: 'Transactions', icon: <ArrowRightLeft className="w-4 h-4" /> },
              { key: 'wallets' as CryptoTab, label: 'Wallets', icon: <Wallet className="w-4 h-4" /> },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-neon-green text-neon-green'
                    : 'border-transparent text-gray-400 hover:text-white'
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'portfolio' && (
            <div className="space-y-4">
              {/* Chain Selector & Actions */}
              <div className="panel p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Coins className="w-4 h-4 text-neon-green" />
                    Chain Holdings
                  </h2>
                  <button
                    onClick={() => setShowAddChain(true)}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Chain
                  </button>
                </div>
                {chains.length === 0 ? (
                  <div className="text-center py-8">
                    <Coins className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-500">No chains configured.</p>
                    <p className="text-sm text-gray-600 mt-1">Add a chain to start tracking your portfolio.</p>
                    <button
                      onClick={() => setShowAddChain(true)}
                      className="mt-3 btn-neon green text-sm"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      Add Your First Chain
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {chains.map(chain => (
                        <button
                          key={chain.id}
                          onClick={() => setSelectedChain(chain.id)}
                          className={cn(
                            'lens-card text-left transition-all',
                            selectedChain === chain.id || (!selectedChain && chain === chains[0])
                              ? 'border-neon-green ring-1 ring-neon-green'
                              : ''
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold">{chain.name}</p>
                            <span className="text-xs px-2 py-0.5 rounded bg-lattice-surface text-gray-400">
                              {chain.symbol}
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-neon-green">
                            {showBalances ? `${chain.balance.toLocaleString()} ${chain.symbol}` : '****'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {showBalances
                              ? `$${(chain.balance * chain.price).toLocaleString(undefined, { minimumFractionDigits: 2 })} @ $${chain.price}`
                              : '****'}
                          </p>
                        </button>
                      ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={handleEarn}
                        disabled={transacting || !selectedChainData}
                        className="btn-neon green flex items-center gap-2 disabled:opacity-50"
                      >
                        {transacting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
                        Earn 10 {selectedChainData?.symbol || 'CC'}
                      </button>
                      <button
                        onClick={handleSpend}
                        disabled={transacting || !selectedChainData || (selectedChainData?.balance ?? 0) < 5}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-neon-pink/20 text-neon-pink border border-neon-pink/30 hover:bg-neon-pink/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Spend 5 {selectedChainData?.symbol || 'CC'}
                      </button>
                      <button
                        onClick={() => setShowSendModal(true)}
                        disabled={!selectedChainData || (selectedChainData?.balance ?? 0) <= 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Send
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Price Display */}
              {chains.length > 0 && (
                <div className="panel p-4">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-neon-blue" />
                    Price Overview
                  </h2>
                  <div className="space-y-3">
                    {chains.map(chain => (
                      <div key={chain.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neon-green/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-neon-green">{chain.symbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <p className="font-medium">{chain.name}</p>
                            <p className="text-xs text-gray-500">{chain.symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold">${chain.price.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">
                            Holdings: {showBalances ? `$${(chain.balance * chain.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '****'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Transaction Filters */}
              <div className="flex gap-2">
                {(['all', 'earn', 'spend', 'transfer'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm capitalize transition-colors',
                      txFilter === f
                        ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                        : 'bg-lattice-surface text-gray-400 hover:text-white'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Transaction History */}
              <div className="panel p-4">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-neon-blue" />
                  Transaction History
                  <span className="text-xs text-gray-500 font-normal">({filteredTransactions.length})</span>
                </h2>
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-500">No transactions found.</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {txFilter !== 'all' ? 'Try changing the filter or ' : ''}Start by earning some tokens.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTransactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            tx.type === 'earn' ? 'bg-neon-green/20' : tx.type === 'spend' ? 'bg-neon-pink/20' : 'bg-neon-blue/20'
                          )}>
                            {tx.type === 'earn' && <ArrowDownLeft className="w-4 h-4 text-neon-green" />}
                            {tx.type === 'spend' && <ArrowUpRight className="w-4 h-4 text-neon-pink" />}
                            {tx.type === 'transfer' && <Send className="w-4 h-4 text-neon-blue" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{tx.description}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{new Date(tx.timestamp).toLocaleString()}</span>
                              {tx.to && <span>To: {tx.to}</span>}
                            </div>
                          </div>
                        </div>
                        <span className={cn(
                          'font-mono font-semibold',
                          tx.type === 'earn' ? 'text-neon-green' : tx.type === 'spend' ? 'text-neon-pink' : 'text-neon-blue'
                        )}>
                          {tx.type === 'earn' ? '+' : '-'}{tx.amount} {tx.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'wallets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-neon-purple" />
                  Wallet Management
                </h2>
                <button
                  onClick={() => setShowAddWallet(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-neon-green/20 text-neon-green rounded-lg hover:bg-neon-green/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Wallet
                </button>
              </div>

              {wallets.length === 0 ? (
                <div className="panel p-8 text-center">
                  <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-500">No wallets configured.</p>
                  <p className="text-sm text-gray-600 mt-1">Add a wallet to manage your addresses.</p>
                  <button
                    onClick={() => setShowAddWallet(true)}
                    className="mt-3 btn-neon green text-sm"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Add Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {wallets.map(wallet => (
                    <div key={wallet.id} className="panel p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-neon-purple" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{wallet.name}</h3>
                            {wallet.isDefault && (
                              <span className="text-xs px-2 py-0.5 rounded bg-neon-green/20 text-neon-green">Default</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono truncate max-w-sm">{wallet.address}</p>
                          <p className="text-xs text-gray-500">Chain: {wallet.chainId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyAddress(wallet.address)}
                          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                          title="Copy address"
                        >
                          {copiedAddress === wallet.address ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteWallet(wallet.id)}
                          className="p-2 text-gray-400 hover:text-neon-pink transition-colors rounded-lg hover:bg-neon-pink/10"
                          title="Remove wallet"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Send Modal */}
      {showSendModal && selectedChainData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSendModal(false)}>
          <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Send {selectedChainData.symbol}</h2>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-400">
              Available: {showBalances ? `${selectedChainData.balance} ${selectedChainData.symbol}` : '****'}
            </p>
            <input
              type="text"
              placeholder="Recipient address or name"
              value={sendTo}
              onChange={e => setSendTo(e.target.value)}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <input
              type="number"
              placeholder="Amount"
              value={sendAmount}
              onChange={e => setSendAmount(e.target.value)}
              max={selectedChainData.balance}
              min={0}
              step="any"
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={sendDescription}
              onChange={e => setSendDescription(e.target.value)}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white bg-lattice-surface">Cancel</button>
              <button
                onClick={handleSend}
                disabled={transacting || !sendTo || !sendAmount || parseFloat(sendAmount) <= 0 || parseFloat(sendAmount) > selectedChainData.balance}
                className="px-4 py-2 rounded-lg text-sm bg-neon-blue text-white hover:bg-neon-blue/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {transacting && <Loader2 className="w-4 h-4 animate-spin" />}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Wallet Modal */}
      {showAddWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddWallet(false)}>
          <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Wallet</h2>
              <button onClick={() => setShowAddWallet(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input
              type="text"
              placeholder="Wallet Name"
              value={walletName}
              onChange={e => setWalletName(e.target.value)}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <input
              type="text"
              placeholder="Wallet Address"
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value)}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <input
              type="text"
              placeholder="Chain ID (e.g., concord)"
              value={walletChainId}
              onChange={e => setWalletChainId(e.target.value)}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddWallet(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white bg-lattice-surface">Cancel</button>
              <button
                onClick={handleAddWallet}
                disabled={!walletName || !walletAddress}
                className="px-4 py-2 rounded-lg text-sm bg-neon-green text-white hover:bg-neon-green/80 disabled:opacity-50"
              >
                Add Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Chain Modal */}
      {showAddChain && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddChain(false)}>
          <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Chain</h2>
              <button onClick={() => setShowAddChain(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <input
              type="text"
              placeholder="Chain Name (e.g., Concord Credits)"
              value={chainName}
              onChange={e => setChainName(e.target.value)}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <input
              type="text"
              placeholder="Symbol (e.g., CC)"
              value={chainSymbol}
              onChange={e => setChainSymbol(e.target.value)}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded text-sm"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAddChain(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white bg-lattice-surface">Cancel</button>
              <button
                onClick={handleAddChain}
                disabled={!chainName || !chainSymbol}
                className="px-4 py-2 rounded-lg text-sm bg-neon-green text-white hover:bg-neon-green/80 disabled:opacity-50"
              >
                Add Chain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
