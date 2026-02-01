'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart, BarChart3, Wallet } from 'lucide-react';

export default function FinanceLensPage() {
  useLensNav('finance');

  const [timeRange, setTimeRange] = useState('7d');

  const { data: portfolio } = useQuery({
    queryKey: ['finance-portfolio'],
    queryFn: () => api.get('/api/finance/portfolio').then((r) => r.data),
  });

  const { data: transactions } = useQuery({
    queryKey: ['finance-transactions', timeRange],
    queryFn: () =>
      api.get('/api/finance/transactions', { params: { range: timeRange } }).then((r) => r.data),
  });

  const { data: economy } = useQuery({
    queryKey: ['economy-status'],
    queryFn: () => api.get('/api/economy/status').then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <h1 className="text-xl font-bold">Finance Lens</h1>
            <p className="text-sm text-gray-400">
              DTU economy simulation and portfolio tracking
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {['24h', '7d', '30d', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm ${
                timeRange === range
                  ? 'bg-neon-green/20 text-neon-green'
                  : 'bg-lattice-surface text-gray-400 hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </header>

      {/* Portfolio Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <div className="flex items-center justify-between">
            <Wallet className="w-5 h-5 text-neon-blue" />
            <span
              className={`text-xs ${
                (portfolio?.change24h || 0) >= 0 ? 'text-neon-green' : 'text-neon-pink'
              }`}
            >
              {(portfolio?.change24h || 0) >= 0 ? '+' : ''}
              {portfolio?.change24h?.toFixed(2) || '0.00'}%
            </span>
          </div>
          <p className="text-2xl font-bold mt-2">
            {portfolio?.totalValue?.toLocaleString() || '0'} DTU
          </p>
          <p className="text-sm text-gray-400">Total Value</p>
        </div>

        <div className="lens-card">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-5 h-5 text-neon-green" />
          </div>
          <p className="text-2xl font-bold mt-2 text-neon-green">
            +{portfolio?.gains?.toLocaleString() || '0'}
          </p>
          <p className="text-sm text-gray-400">Total Gains</p>
        </div>

        <div className="lens-card">
          <div className="flex items-center justify-between">
            <BarChart3 className="w-5 h-5 text-neon-purple" />
          </div>
          <p className="text-2xl font-bold mt-2">
            {transactions?.count || 0}
          </p>
          <p className="text-sm text-gray-400">Transactions</p>
        </div>

        <div className="lens-card">
          <div className="flex items-center justify-between">
            <PieChart className="w-5 h-5 text-neon-cyan" />
          </div>
          <p className="text-2xl font-bold mt-2">
            {portfolio?.assets?.length || 0}
          </p>
          <p className="text-sm text-gray-400">Assets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Chart Placeholder */}
        <div className="lg:col-span-2 panel p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neon-green" />
            Portfolio Performance
          </h3>
          <div className="graph-container flex items-center justify-center">
            <div className="text-center text-gray-500">
              <BarChart3 className="w-16 h-16 mx-auto mb-2 opacity-50" />
              <p>Chart visualization would render here</p>
            </div>
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="panel p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-neon-purple" />
            Asset Allocation
          </h3>
          <div className="space-y-3">
            {portfolio?.assets?.map((asset: any) => (
              <div key={asset.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{asset.name}</span>
                  <span className="text-gray-400">{asset.allocation.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-neon-blue to-neon-purple"
                    style={{ width: `${asset.allocation}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="panel p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-neon-green" />
          Recent Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-lattice-border">
                <th className="pb-2">Type</th>
                <th className="pb-2">Asset</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Value</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions?.transactions?.slice(0, 10).map((tx: any) => (
                <tr key={tx.id} className="border-b border-lattice-border/50">
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        tx.type === 'buy'
                          ? 'bg-neon-green/20 text-neon-green'
                          : 'bg-neon-pink/20 text-neon-pink'
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-3 font-medium">{tx.asset}</td>
                  <td className="py-3 font-mono">{tx.amount}</td>
                  <td className="py-3 font-mono">{tx.value} DTU</td>
                  <td className="py-3 text-gray-400 text-sm">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
