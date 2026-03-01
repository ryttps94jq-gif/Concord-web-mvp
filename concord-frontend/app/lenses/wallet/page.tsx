'use client';

/**
 * Wallet & Billing Page -- /lenses/wallet
 *
 * Full wallet/billing page with:
 * - Balance card with sparkline
 * - Buy CC section with presets and custom amount
 * - Withdraw section (Connect-gated)
 * - Transaction history with tabbed filtering and infinite scroll
 * - Earnings summary for creators
 */

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Coins,
  CreditCard,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  DollarSign,
  History,
  Award,
  Gift,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  Loader2,
  ChevronRight,
  Sparkles,
  BarChart3,
  Calendar,
  Filter,
} from 'lucide-react';
import { useLensNav } from '@/hooks/useLensNav';
import { api, apiHelpers } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { ds } from '@/lib/design-system';
import { PurchaseFlow } from '@/components/wallet/PurchaseFlow';
import { WithdrawFlow } from '@/components/wallet/WithdrawFlow';

// ── Constants ────────────────────────────────────────────────────────────────

const TRANSACTION_TABS = [
  { id: 'all', label: 'All', icon: History },
  { id: 'purchase', label: 'Purchases', icon: CreditCard },
  { id: 'tip', label: 'Tips', icon: Gift },
  { id: 'withdrawal', label: 'Withdrawals', icon: ArrowDownToLine },
  { id: 'earning', label: 'Earnings', icon: Award },
] as const;

const TX_PAGE_SIZE = 25;

// ── Types ────────────────────────────────────────────────────────────────────

interface BalanceData {
  balance: number;
  totalCredits: number;
  totalDebits: number;
  tokens?: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee?: number;
  net?: number;
  from?: string;
  to?: string;
  description?: string;
  status?: string;
  created_at: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

interface TransactionPage {
  transactions?: Transaction[];
  items?: Transaction[];
  history?: Transaction[];
  total?: number;
  hasMore?: boolean;
  nextOffset?: number;
}

interface ConnectStatus {
  connected: boolean;
  stripeAccountId?: string;
  onboardingComplete?: boolean;
}

interface EarningsSummary {
  totalEarned: number;
  tips: number;
  bounties: number;
  sales: number;
  thisMonth: number;
  lastMonth: number;
}

type TabId = (typeof TRANSACTION_TABS)[number]['id'];

// ── Inner component (uses useSearchParams) ───────────────────────────────────

function WalletPageInner() {
  useLensNav('wallet');
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [showPurchase, setShowPurchase] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check for Stripe return params
  const isStripeReturn =
    searchParams.get('success') === 'true' ||
    searchParams.get('canceled') === 'true';

  // ── Queries ──────────────────────────────────────────────────────────────

  // Balance
  const {
    data: balanceData,
    isLoading: balanceLoading,
  } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () =>
      api.get('/api/billing/balance').then((r) => r.data as BalanceData),
    refetchInterval: 15000,
    retry: false,
  });

  const balance = balanceData?.balance ?? balanceData?.tokens ?? 0;
  const totalCredits = balanceData?.totalCredits ?? 0;
  const totalDebits = balanceData?.totalDebits ?? 0;

  // Stripe Connect status
  const { data: connectStatus } = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: () =>
      apiHelpers.economy.connectStatus().then((r) => r.data as ConnectStatus),
    retry: false,
  });

  // Transaction history with infinite scroll
  const {
    data: txPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: txLoading,
  } = useInfiniteQuery({
    queryKey: ['wallet-transactions', activeTab],
    queryFn: ({ pageParam = 0 }) =>
      api
        .get('/api/billing/transactions', {
          params: {
            type: activeTab === 'all' ? undefined : activeTab,
            limit: TX_PAGE_SIZE,
            offset: pageParam,
          },
        })
        .then((r) => r.data as TransactionPage),
    getNextPageParam: (lastPage, allPages) => {
      const items =
        lastPage.transactions || lastPage.items || lastPage.history || [];
      if (items.length < TX_PAGE_SIZE) return undefined;
      return allPages.reduce(
        (sum, page) =>
          sum +
          (page.transactions || page.items || page.history || []).length,
        0
      );
    },
    initialPageParam: 0,
    retry: false,
  });

  // Flatten all transaction pages
  const transactions = useMemo(() => {
    if (!txPages?.pages) return [];
    return txPages.pages.flatMap(
      (page) => page.transactions || page.items || page.history || []
    );
  }, [txPages]);

  // Withdrawals for status display
  const { data: withdrawalsData } = useQuery({
    queryKey: ['wallet-withdrawals'],
    queryFn: () =>
      api
        .get('/api/billing/withdrawals')
        .then(
          (r) =>
            r.data as { withdrawals?: Array<{ id: string; amount: number; fee: number; net: number; status: string; created_at: string }>; items?: Array<{ id: string; amount: number; fee: number; net: number; status: string; created_at: string }> }
        ),
    retry: false,
  });

  // Earnings summary (derived from transaction data)
  const earnings = useMemo<EarningsSummary>(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const earningTypes = new Set(['tip', 'earning', 'reward', 'bounty', 'sale', 'credit']);

    let totalEarned = 0;
    let tips = 0;
    let bounties = 0;
    let sales = 0;
    let thisMonth = 0;
    let lastMonth = 0;

    for (const tx of transactions) {
      if (!earningTypes.has(tx.type) || tx.amount <= 0) continue;

      totalEarned += tx.amount;
      const txDate = new Date(tx.created_at || tx.timestamp || '');

      if (tx.type === 'tip') tips += tx.amount;
      if (tx.type === 'bounty') bounties += tx.amount;
      if (tx.type === 'sale') sales += tx.amount;

      if (txDate >= thisMonthStart) thisMonth += tx.amount;
      else if (txDate >= lastMonthStart && txDate < thisMonthStart)
        lastMonth += tx.amount;
    }

    // Also use totalCredits from balance endpoint as a fallback
    if (totalEarned === 0 && totalCredits > 0) {
      totalEarned = totalCredits;
    }

    return { totalEarned, tips, bounties, sales, thisMonth, lastMonth };
  }, [transactions, totalCredits]);

  // ── Infinite Scroll ────────────────────────────────────────────────────────

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        },
        { threshold: 0.1 }
      );

      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  // ── Sparkline Data ─────────────────────────────────────────────────────────

  const sparklineData = useMemo(() => {
    // Build a simple balance-over-time from recent transactions
    const recent = [...transactions].reverse().slice(0, 20);
    if (recent.length < 2) return null;

    let runningBalance = balance;
    // Walk backwards from current balance to reconstruct history
    const points: number[] = [balance];
    for (const tx of [...transactions].slice(0, 19)) {
      runningBalance -= tx.amount;
      points.unshift(runningBalance);
    }

    return points;
  }, [transactions, balance]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePurchaseSuccess = useCallback(
    (_tokens: number) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['economy-balance'] });
    },
    [queryClient]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={cn(ds.pageContainer, 'max-w-6xl mx-auto')} ref={scrollRef}>
      {/* Page Header */}
      <div className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <div className="text-neon-cyan">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className={ds.heading1}>Wallet & Billing</h1>
        </div>
      </div>

      {/* ── Balance Card ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-lattice-surface via-lattice-surface to-lattice-elevated border border-lattice-border rounded-2xl p-6"
      >
        {/* Background glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-neon-blue/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-neon-purple/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Balance Display */}
          <div className="space-y-2">
            <p className="text-sm text-gray-400 uppercase tracking-wider">
              CC Balance
            </p>
            <div className="flex items-baseline gap-3">
              {balanceLoading ? (
                <div className="h-10 w-40 bg-lattice-elevated animate-pulse rounded-lg" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Coins className="w-8 h-8 text-neon-green" />
                    <span className="text-4xl font-mono font-bold text-white">
                      {balance.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-lg text-gray-400 font-mono">CC</span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              {balance.toLocaleString()}.00 USD
            </p>

            {/* Sparkline */}
            {sparklineData && sparklineData.length > 2 && (
              <div className="mt-3">
                <Sparkline data={sparklineData} />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPurchase(true)}
              className={cn(
                ds.btnBase,
                'px-5 py-3 bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:opacity-90 focus:ring-neon-blue shadow-neon-blue'
              )}
            >
              <CreditCard className="w-5 h-5" />
              Buy CC
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowWithdraw(true)}
              className={cn(
                ds.btnBase,
                'px-5 py-3 bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green/30 focus:ring-neon-green'
              )}
            >
              <ArrowDownToLine className="w-5 h-5" />
              Withdraw
            </motion.button>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="relative mt-6 pt-6 border-t border-lattice-border grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickStat
            label="Total Credits"
            value={totalCredits}
            icon={<ArrowDownRight className="w-4 h-4 text-neon-green" />}
            color="text-neon-green"
          />
          <QuickStat
            label="Total Debits"
            value={totalDebits}
            icon={<ArrowUpRight className="w-4 h-4 text-red-400" />}
            color="text-red-400"
          />
          <QuickStat
            label="This Month"
            value={earnings.thisMonth}
            icon={<Calendar className="w-4 h-4 text-neon-blue" />}
            color="text-neon-blue"
          />
          <QuickStat
            label="Payout Status"
            value={connectStatus?.onboardingComplete ? 'Active' : 'Not Set Up'}
            icon={
              connectStatus?.onboardingComplete ? (
                <Sparkles className="w-4 h-4 text-neon-green" />
              ) : (
                <ArrowUpFromLine className="w-4 h-4 text-gray-500" />
              )
            }
            color={
              connectStatus?.onboardingComplete
                ? 'text-neon-green'
                : 'text-gray-400'
            }
            isText
          />
        </div>
      </motion.div>

      {/* ── Main Content Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Buy + Withdraw */}
        <div className="lg:col-span-1 space-y-6">
          {/* Buy CC Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={ds.panel}
          >
            <PurchaseFlow
              mode="inline"
              onSuccess={handlePurchaseSuccess}
            />
          </motion.div>

          {/* Earnings Summary Card (for creators) */}
          {(earnings.totalEarned > 0 || totalCredits > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={ds.panel}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-neon-purple" />
                  <h3 className={ds.heading3}>Earnings Summary</h3>
                </div>

                {/* Total Earned */}
                <div className="bg-lattice-deep rounded-lg p-4 border border-lattice-border">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Total Earned
                  </p>
                  <p className="text-2xl font-mono font-bold text-neon-green mt-1">
                    {earnings.totalEarned.toLocaleString()} CC
                  </p>
                </div>

                {/* Breakdown */}
                <div className="space-y-2">
                  <EarningRow
                    label="Tips Received"
                    amount={earnings.tips}
                    icon={<Gift className="w-4 h-4 text-neon-pink" />}
                  />
                  <EarningRow
                    label="Bounty Rewards"
                    amount={earnings.bounties}
                    icon={<Target className="w-4 h-4 text-amber-400" />}
                  />
                  <EarningRow
                    label="Sales"
                    amount={earnings.sales}
                    icon={<DollarSign className="w-4 h-4 text-neon-green" />}
                  />
                </div>

                {/* Month Comparison */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-lattice-border">
                  <div className="bg-lattice-deep rounded-lg p-3 border border-lattice-border">
                    <p className="text-xs text-gray-500">This Month</p>
                    <p className="text-lg font-mono font-bold text-white mt-1">
                      {earnings.thisMonth.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-lattice-deep rounded-lg p-3 border border-lattice-border">
                    <p className="text-xs text-gray-500">Last Month</p>
                    <p className="text-lg font-mono font-bold text-gray-400 mt-1">
                      {earnings.lastMonth.toLocaleString()}
                    </p>
                  </div>
                  {earnings.lastMonth > 0 && (
                    <div className="col-span-2">
                      <MonthComparison
                        thisMonth={earnings.thisMonth}
                        lastMonth={earnings.lastMonth}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2"
        >
          <div className={cn(ds.panel, 'p-0')}>
            {/* Tab Bar */}
            <div className="flex gap-1 border-b border-lattice-border px-4 pt-4 overflow-x-auto">
              {TRANSACTION_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                      isActive
                        ? 'text-neon-cyan border-neon-cyan'
                        : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Transaction List */}
            <div className="p-4">
              {txLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 bg-lattice-deep animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-8 h-8 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">No transactions found</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {activeTab !== 'all'
                      ? 'Try the "All" tab to see all transactions'
                      : 'Your transaction history will appear here'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {transactions.map((tx, i) => (
                    <TransactionRow key={tx.id || i} tx={tx} />
                  ))}

                  {/* Infinite scroll sentinel */}
                  {hasNextPage && (
                    <div ref={loadMoreRef} className="py-4 text-center">
                      {isFetchingNextPage ? (
                        <Loader2 className="w-5 h-5 mx-auto text-neon-blue animate-spin" />
                      ) : (
                        <span className="text-xs text-gray-600">
                          Scroll for more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* Stripe Return Handler (shown inline at top when returning) */}
      <AnimatePresence>
        {isStripeReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => {
                // Clear params by navigating to clean URL
                window.history.replaceState({}, '', '/lenses/wallet');
              }}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl p-6"
            >
              <PurchaseFlow
                mode="inline"
                onSuccess={handlePurchaseSuccess}
                onClose={() => {
                  window.history.replaceState({}, '', '/lenses/wallet');
                  window.location.reload();
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {showPurchase && (
          <PurchaseFlow
            mode="modal"
            onClose={() => setShowPurchase(false)}
            onSuccess={handlePurchaseSuccess}
          />
        )}
      </AnimatePresence>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdraw && (
          <WithdrawFlow
            mode="modal"
            onClose={() => setShowWithdraw(false)}
            balance={balance}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
              queryClient.invalidateQueries({
                queryKey: ['wallet-transactions'],
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Wallet Page (wrapped with Suspense for useSearchParams) ──────────────────

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <div className={cn(ds.pageContainer, 'max-w-6xl mx-auto')}>
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="w-7 h-7 text-neon-cyan" />
            <h1 className={ds.heading1}>Wallet & Billing</h1>
          </div>
          <div className="h-48 bg-lattice-surface border border-lattice-border rounded-2xl animate-pulse" />
        </div>
      }
    >
      <WalletPageInner />
    </Suspense>
  );
}

// ── Sub-Components ───────────────────────────────────────────────────────────

/** Quick stat cell used in the balance card */
function QuickStat({
  label,
  value,
  icon,
  color,
  isText = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex items-center gap-2">
        {icon}
        <span className={cn('font-mono font-medium', color)}>
          {isText
            ? value
            : typeof value === 'number'
            ? value.toLocaleString()
            : value}
        </span>
      </div>
    </div>
  );
}

/** Single transaction row */
function TransactionRow({ tx }: { tx: Transaction }) {
  const isPositive = tx.amount > 0;
  const typeIcons: Record<string, React.ReactNode> = {
    purchase: <CreditCard className="w-4 h-4 text-neon-blue" />,
    tip: <Gift className="w-4 h-4 text-neon-pink" />,
    withdrawal: <ArrowDownToLine className="w-4 h-4 text-amber-400" />,
    earning: <Award className="w-4 h-4 text-neon-green" />,
    reward: <Sparkles className="w-4 h-4 text-neon-purple" />,
    credit: <ArrowDownRight className="w-4 h-4 text-neon-green" />,
    debit: <ArrowUpRight className="w-4 h-4 text-red-400" />,
    transfer: <Repeat className="w-4 h-4 text-neon-blue" />,
    bounty: <Target className="w-4 h-4 text-amber-400" />,
    sale: <DollarSign className="w-4 h-4 text-neon-green" />,
    fee: <BarChart3 className="w-4 h-4 text-gray-500" />,
  };

  const statusColors: Record<string, string> = {
    complete: 'text-neon-green',
    completed: 'text-neon-green',
    pending: 'text-amber-400',
    processing: 'text-neon-blue',
    failed: 'text-red-400',
    reversed: 'text-gray-500',
    canceled: 'text-gray-500',
  };

  const dateStr = tx.created_at || tx.timestamp || '';
  const date = dateStr ? new Date(dateStr) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-lattice-deep/50 transition-colors group"
    >
      {/* Icon */}
      <div className="flex-shrink-0 p-2 rounded-lg bg-lattice-deep border border-lattice-border group-hover:border-lattice-border/80">
        {typeIcons[tx.type] || <Coins className="w-4 h-4 text-gray-400" />}
      </div>

      {/* Description */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate">
          {tx.description || formatTxType(tx.type)}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {date && (
            <span className="text-xs text-gray-500">
              {date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year:
                  date.getFullYear() !== new Date().getFullYear()
                    ? 'numeric'
                    : undefined,
              })}
              {' '}
              {date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          {tx.status && (
            <span
              className={cn(
                'text-xs capitalize',
                statusColors[tx.status] || 'text-gray-500'
              )}
            >
              {tx.status}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="flex-shrink-0 text-right">
        <span
          className={cn(
            'text-sm font-mono font-medium',
            isPositive ? 'text-neon-green' : 'text-red-400'
          )}
        >
          {isPositive ? '+' : ''}
          {tx.amount.toLocaleString()} CC
        </span>
        {tx.fee && tx.fee > 0 && (
          <p className="text-xs text-gray-600 font-mono">
            fee: {tx.fee.toLocaleString()}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Format transaction type to readable string */
function formatTxType(type: string): string {
  const map: Record<string, string> = {
    purchase: 'Token Purchase',
    tip: 'Tip',
    withdrawal: 'Withdrawal',
    earning: 'Earning',
    reward: 'Reward',
    credit: 'Credit',
    debit: 'Debit',
    transfer: 'Transfer',
    bounty: 'Bounty Reward',
    sale: 'Sale',
    fee: 'Fee',
    TOKEN_PURCHASE: 'Token Purchase',
    WITHDRAWAL: 'Withdrawal',
    TIP: 'Tip',
    FEE: 'Fee',
    TRANSFER: 'Transfer',
  };
  return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Earnings breakdown row */
function EarningRow({
  label,
  amount,
  icon,
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <span className="text-sm font-mono text-white">
        {amount.toLocaleString()} CC
      </span>
    </div>
  );
}

/** Month-over-month comparison indicator */
function MonthComparison({
  thisMonth,
  lastMonth,
}: {
  thisMonth: number;
  lastMonth: number;
}) {
  if (lastMonth === 0) return null;

  const change = ((thisMonth - lastMonth) / lastMonth) * 100;
  const isUp = change >= 0;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-xs',
        isUp ? 'text-neon-green' : 'text-red-400'
      )}
    >
      {isUp ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      <span>
        {isUp ? '+' : ''}
        {change.toFixed(1)}% vs last month
      </span>
    </div>
  );
}

/** Mini sparkline chart for balance history */
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;

  const width = 120;
  const height = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  // Determine trend color
  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Area fill */}
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor={isUp ? '#22c55e' : '#ef4444'}
            stopOpacity="0.3"
          />
          <stop
            offset="100%"
            stopColor={isUp ? '#22c55e' : '#ef4444'}
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#sparkline-fill)"
      />
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r="2"
          fill={isUp ? '#22c55e' : '#ef4444'}
        />
      )}
    </svg>
  );
}
