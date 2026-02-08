'use client';

import { useState, useRef, useEffect } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Bell,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Star,
  X,
  ExternalLink,
  AlertTriangle,
  Lock,
  ArrowRight,
  LineChart,
  CandlestickChart,
  BarChart2,
  Layers,
  Newspaper
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: 'crypto' | 'stock' | 'dtu' | 'nft' | 'commodity';
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap?: number;
  holdings: number;
  value: number;
  avgBuyPrice: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
  sparkline?: number[];
  isFavorite?: boolean;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'stake' | 'reward';
  asset: string;
  symbol: string;
  amount: number;
  price: number;
  value: number;
  fee?: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  txHash?: string;
}

interface Order {
  id: string;
  type: 'limit' | 'market' | 'stop';
  side: 'buy' | 'sell';
  asset: string;
  symbol: string;
  amount: number;
  price?: number;
  stopPrice?: number;
  filled: number;
  status: 'open' | 'partial' | 'filled' | 'cancelled';
  createdAt: string;
}

interface PriceAlert {
  id: string;
  asset: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  active: boolean;
}

interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  assets: string[];
}

type TimeRange = '1H' | '24H' | '7D' | '30D' | '90D' | '1Y' | 'ALL';
type ViewMode = 'overview' | 'portfolio' | 'trade' | 'orders' | 'alerts' | 'news';
type ChartType = 'line' | 'candle' | 'area';

const INITIAL_ASSETS: Asset[] = [
  { id: '1', symbol: 'DTU', name: 'Concord DTU Token', type: 'dtu', price: 42.5, change24h: 3.25, changePercent24h: 8.28, volume24h: 15000000, marketCap: 425000000, holdings: 1250, value: 53125, avgBuyPrice: 35.2, pnl: 9125, pnlPercent: 20.74, allocation: 45, sparkline: [38, 39, 41, 40, 42, 43, 42.5] },
  { id: '2', symbol: 'ETH', name: 'Ethereum', type: 'crypto', price: 3450.00, change24h: -85.50, changePercent24h: -2.42, volume24h: 12000000000, marketCap: 415000000000, holdings: 5.5, value: 18975, avgBuyPrice: 3200, pnl: 1375, pnlPercent: 7.81, allocation: 16, sparkline: [3500, 3520, 3480, 3450, 3400, 3420, 3450] },
  { id: '3', symbol: 'BTC', name: 'Bitcoin', type: 'crypto', price: 67500.00, change24h: 1250.00, changePercent24h: 1.89, volume24h: 28000000000, marketCap: 1320000000000, holdings: 0.25, value: 16875, avgBuyPrice: 62000, pnl: 1375, pnlPercent: 8.87, allocation: 14, sparkline: [66000, 66500, 67000, 67200, 67800, 67500, 67500] },
  { id: '4', symbol: 'SOL', name: 'Solana', type: 'crypto', price: 175.50, change24h: 12.30, changePercent24h: 7.54, volume24h: 3500000000, marketCap: 75000000000, holdings: 85, value: 14917.5, avgBuyPrice: 145, pnl: 2592.5, pnlPercent: 21.03, allocation: 13, sparkline: [160, 165, 168, 172, 178, 176, 175.5] },
  { id: '5', symbol: 'NVDA', name: 'NVIDIA Corp', type: 'stock', price: 875.25, change24h: 28.50, changePercent24h: 3.37, volume24h: 45000000, marketCap: 2160000000000, holdings: 15, value: 13128.75, avgBuyPrice: 750, pnl: 1878.75, pnlPercent: 16.69, allocation: 11, sparkline: [840, 850, 855, 860, 870, 878, 875.25] },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'buy', asset: 'Concord DTU Token', symbol: 'DTU', amount: 500, price: 38.5, value: 19250, fee: 25, timestamp: '2024-01-15T10:30:00Z', status: 'completed' },
  { id: '2', type: 'sell', asset: 'Ethereum', symbol: 'ETH', amount: 2, price: 3520, value: 7040, fee: 15, timestamp: '2024-01-14T15:45:00Z', status: 'completed' },
  { id: '3', type: 'stake', asset: 'Solana', symbol: 'SOL', amount: 50, price: 168, value: 8400, timestamp: '2024-01-13T09:00:00Z', status: 'completed' },
  { id: '4', type: 'reward', asset: 'Concord DTU Token', symbol: 'DTU', amount: 25, price: 42.5, value: 1062.5, timestamp: '2024-01-12T00:00:00Z', status: 'completed' },
  { id: '5', type: 'transfer', asset: 'Bitcoin', symbol: 'BTC', amount: 0.1, price: 67000, value: 6700, fee: 5, timestamp: '2024-01-11T18:20:00Z', status: 'completed' },
];

const INITIAL_ORDERS: Order[] = [
  { id: '1', type: 'limit', side: 'buy', asset: 'Ethereum', symbol: 'ETH', amount: 2, price: 3200, filled: 0, status: 'open', createdAt: '2024-01-15T12:00:00Z' },
  { id: '2', type: 'stop', side: 'sell', asset: 'Bitcoin', symbol: 'BTC', amount: 0.1, stopPrice: 60000, filled: 0, status: 'open', createdAt: '2024-01-14T10:00:00Z' },
  { id: '3', type: 'limit', side: 'buy', asset: 'Concord DTU Token', symbol: 'DTU', amount: 200, price: 40, filled: 150, status: 'partial', createdAt: '2024-01-13T08:00:00Z' },
];

const INITIAL_ALERTS: PriceAlert[] = [
  { id: '1', asset: 'Bitcoin', symbol: 'BTC', condition: 'above', price: 70000, active: true },
  { id: '2', asset: 'Ethereum', symbol: 'ETH', condition: 'below', price: 3000, active: true },
  { id: '3', asset: 'Concord DTU Token', symbol: 'DTU', condition: 'above', price: 50, active: true },
];

const INITIAL_NEWS: NewsItem[] = [
  { id: '1', title: 'DTU Token Reaches New All-Time High After Major Partnership', source: 'CryptoNews', timestamp: '2024-01-15T14:00:00Z', sentiment: 'positive', assets: ['DTU'] },
  { id: '2', title: 'Federal Reserve Signals Potential Rate Cuts in 2024', source: 'Bloomberg', timestamp: '2024-01-15T12:30:00Z', sentiment: 'positive', assets: ['BTC', 'ETH', 'SOL'] },
  { id: '3', title: 'NVIDIA Reports Record Quarterly Revenue Driven by AI Demand', source: 'Reuters', timestamp: '2024-01-15T10:00:00Z', sentiment: 'positive', assets: ['NVDA'] },
  { id: '4', title: 'Ethereum Gas Fees Spike Amid NFT Market Surge', source: 'CoinDesk', timestamp: '2024-01-15T08:00:00Z', sentiment: 'neutral', assets: ['ETH'] },
];

export default function FinanceLensPage() {
  useLensNav('finance');
  const _queryClient = useQueryClient();
  const { items: assetItems } = useLensData<Asset>('finance', 'asset', {
    seed: INITIAL_ASSETS.map(a => ({ title: a.name, data: a as unknown as Record<string, unknown> })),
  });
  const { items: txItems } = useLensData<Transaction>('finance', 'transaction', {
    seed: INITIAL_TRANSACTIONS.map(t => ({ title: t.type, data: t as unknown as Record<string, unknown> })),
  });
  const _assets: Asset[] = assetItems.length > 0 ? assetItems.map(i => ({ ...(i.data as unknown as Asset), id: i.id })) : INITIAL_ASSETS;
  const _transactions: Transaction[] = txItems.length > 0 ? txItems.map(i => ({ ...(i.data as unknown as Transaction), id: i.id })) : INITIAL_TRANSACTIONS;
  const chartRef = useRef<HTMLCanvasElement>(null);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showBalances, setShowBalances] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Trading state
  const [tradeAsset, setTradeAsset] = useState('DTU');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradePrice, setTradePrice] = useState('');

  // Computed values
  const totalValue = INITIAL_ASSETS.reduce((sum, a) => sum + a.value, 0);
  const totalPnl = INITIAL_ASSETS.reduce((sum, a) => sum + a.pnl, 0);
  const totalPnlPercent = (totalPnl / (totalValue - totalPnl)) * 100;

  // Chart rendering
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, width, height);

    // Generate chart data
    const dataPoints = 100;
    const data: number[] = [];
    let value = totalValue * 0.85;

    for (let i = 0; i < dataPoints; i++) {
      value = value + (Math.random() - 0.45) * (totalValue * 0.02);
      value = Math.max(value, totalValue * 0.7);
      value = Math.min(value, totalValue * 1.1);
      data.push(value);
    }
    data[data.length - 1] = totalValue;

    const minVal = Math.min(...data) * 0.95;
    const maxVal = Math.max(...data) * 1.05;
    const range = maxVal - minVal;

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
      const y = padding + ((height - padding * 2) / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      const val = maxVal - (range / 5) * i;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`$${(val / 1000).toFixed(1)}k`, padding - 5, y + 4);
    }

    if (chartType === 'line' || chartType === 'area') {
      // Draw area fill
      if (chartType === 'area') {
        const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

        ctx.beginPath();
        ctx.moveTo(padding, height - padding);

        for (let i = 0; i < data.length; i++) {
          const x = padding + (i / (data.length - 1)) * (width - padding * 2);
          const y = padding + ((maxVal - data[i]) / range) * (height - padding * 2);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width - padding, height - padding);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw line
      const lineGradient = ctx.createLinearGradient(0, 0, width, 0);
      lineGradient.addColorStop(0, '#00d4ff');
      lineGradient.addColorStop(0.5, '#7c3aed');
      lineGradient.addColorStop(1, '#00d4ff');

      ctx.beginPath();
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 2;

      for (let i = 0; i < data.length; i++) {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = padding + ((maxVal - data[i]) / range) * (height - padding * 2);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();

      // Draw current value dot
      const lastX = width - padding;
      const lastY = padding + ((maxVal - data[data.length - 1]) / range) * (height - padding * 2);

      ctx.beginPath();
      ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4ff';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (chartType === 'candle') {
      // Draw candlesticks
      const candleWidth = (width - padding * 2) / 20 - 4;

      for (let i = 0; i < 20; i++) {
        const baseIndex = Math.floor((i / 20) * data.length);
        const open = data[baseIndex];
        const close = data[Math.min(baseIndex + 5, data.length - 1)];
        const high = Math.max(open, close) * (1 + Math.random() * 0.02);
        const low = Math.min(open, close) * (1 - Math.random() * 0.02);

        const x = padding + (i / 19) * (width - padding * 2);
        const openY = padding + ((maxVal - open) / range) * (height - padding * 2);
        const closeY = padding + ((maxVal - close) / range) * (height - padding * 2);
        const highY = padding + ((maxVal - high) / range) * (height - padding * 2);
        const lowY = padding + ((maxVal - low) / range) * (height - padding * 2);

        const isGreen = close >= open;
        ctx.fillStyle = isGreen ? '#22c55e' : '#ef4444';
        ctx.strokeStyle = isGreen ? '#22c55e' : '#ef4444';

        // Wick
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Body
        ctx.fillRect(
          x - candleWidth / 2,
          Math.min(openY, closeY),
          candleWidth,
          Math.abs(closeY - openY) || 2
        );
      }
    }
  }, [timeRange, chartType, totalValue]);

  const formatCurrency = (value: number, compact = false) => {
    if (compact) {
      if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const renderMiniSparkline = (data: number[]) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 80;
    const height = 24;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const isPositive = data[data.length - 1] >= data[0];

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? '#22c55e' : '#ef4444'}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lens-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Balance</span>
            <button onClick={() => setShowBalances(!showBalances)} className="text-gray-400 hover:text-white">
              {showBalances ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-3xl font-bold">
            {showBalances ? formatCurrency(totalValue) : '••••••'}
          </p>
          <div className={cn('flex items-center gap-1 mt-1 text-sm', totalPnlPercent >= 0 ? 'text-green-400' : 'text-red-400')}>
            {totalPnlPercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{showBalances ? formatCurrency(totalPnl) : '••••'}</span>
            <span>({formatPercent(totalPnlPercent)})</span>
          </div>
        </div>

        <div className="lens-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-400">Best Performer</span>
          </div>
          <p className="text-xl font-bold">{INITIAL_ASSETS.sort((a, b) => b.pnlPercent - a.pnlPercent)[0].symbol}</p>
          <p className="text-green-400 text-sm">+{INITIAL_ASSETS.sort((a, b) => b.pnlPercent - a.pnlPercent)[0].pnlPercent.toFixed(2)}%</p>
        </div>

        <div className="lens-card">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-neon-blue" />
            <span className="text-sm text-gray-400">24h Volume</span>
          </div>
          <p className="text-xl font-bold">
            {formatCurrency(INITIAL_ASSETS.reduce((sum, a) => sum + a.volume24h, 0), true)}
          </p>
          <p className="text-gray-400 text-sm">Across all assets</p>
        </div>

        <div className="lens-card">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-neon-yellow" />
            <span className="text-sm text-gray-400">Active Alerts</span>
          </div>
          <p className="text-xl font-bold">{INITIAL_ALERTS.filter(a => a.active).length}</p>
          <p className="text-gray-400 text-sm">{INITIAL_ORDERS.filter(o => o.status === 'open').length} open orders</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Portfolio Performance</h2>
            <p className="text-sm text-gray-400">Total value over time</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-lattice-deep rounded-lg p-1">
              {(['line', 'area', 'candle'] as ChartType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={cn(
                    'p-2 rounded-md transition-colors',
                    chartType === type ? 'bg-lattice-elevated text-neon-cyan' : 'text-gray-500 hover:text-white'
                  )}
                >
                  {type === 'line' && <LineChart className="w-4 h-4" />}
                  {type === 'area' && <BarChart2 className="w-4 h-4" />}
                  {type === 'candle' && <CandlestickChart className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {(['1H', '24H', '7D', '30D', '90D', '1Y', 'ALL'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm transition-colors',
                    timeRange === range
                      ? 'bg-neon-cyan/20 text-neon-cyan'
                      : 'text-gray-400 hover:text-white'
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative h-80">
          <canvas
            ref={chartRef}
            width={1000}
            height={320}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings */}
        <div className="lg:col-span-2 panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Holdings</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets..."
                  className="pl-9 pr-4 py-1.5 bg-lattice-deep rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-neon-cyan w-48"
                />
              </div>
              <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-lattice-border">
                  <th className="pb-3 font-medium">Asset</th>
                  <th className="pb-3 font-medium">Price</th>
                  <th className="pb-3 font-medium">24h</th>
                  <th className="pb-3 font-medium hidden md:table-cell">Chart</th>
                  <th className="pb-3 font-medium text-right">Holdings</th>
                  <th className="pb-3 font-medium text-right">Value</th>
                  <th className="pb-3 font-medium text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {INITIAL_ASSETS
                  .filter(a => a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || a.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="border-b border-lattice-border/50 hover:bg-lattice-elevated/50 cursor-pointer transition-colors"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                          asset.type === 'dtu' && 'bg-neon-cyan/20 text-neon-cyan',
                          asset.type === 'crypto' && 'bg-neon-purple/20 text-neon-purple',
                          asset.type === 'stock' && 'bg-neon-green/20 text-neon-green'
                        )}>
                          {asset.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium">{asset.symbol}</p>
                          <p className="text-xs text-gray-400">{asset.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 font-mono">{formatCurrency(asset.price)}</td>
                    <td className={cn('py-4', asset.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400')}>
                      <div className="flex items-center gap-1">
                        {asset.changePercent24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {formatPercent(asset.changePercent24h)}
                      </div>
                    </td>
                    <td className="py-4 hidden md:table-cell">
                      {asset.sparkline && renderMiniSparkline(asset.sparkline)}
                    </td>
                    <td className="py-4 text-right font-mono">
                      {showBalances ? asset.holdings.toLocaleString() : '••••'}
                    </td>
                    <td className="py-4 text-right font-mono">
                      {showBalances ? formatCurrency(asset.value) : '••••••'}
                    </td>
                    <td className={cn('py-4 text-right', asset.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {showBalances ? (
                        <div>
                          <p>{formatCurrency(asset.pnl)}</p>
                          <p className="text-xs">{formatPercent(asset.pnlPercent)}</p>
                        </div>
                      ) : '••••'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Allocation */}
        <div className="panel p-4">
          <h3 className="font-semibold mb-4">Asset Allocation</h3>

          <div className="relative w-full aspect-square max-w-[200px] mx-auto mb-6">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {(() => {
                let offset = 0;
                return INITIAL_ASSETS.map((asset, i) => {
                  const circumference = 2 * Math.PI * 40;
                  const strokeDasharray = (asset.allocation / 100) * circumference;
                  const strokeDashoffset = -offset;
                  offset += strokeDasharray;

                  const colors = ['#00d4ff', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444'];

                  return (
                    <circle
                      key={asset.id}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={colors[i % colors.length]}
                      strokeWidth="12"
                      strokeDasharray={`${strokeDasharray} ${circumference}`}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500"
                    />
                  );
                });
              })()}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold">{INITIAL_ASSETS.length}</p>
                <p className="text-xs text-gray-400">Assets</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {INITIAL_ASSETS.map((asset, i) => {
              const colors = ['bg-neon-cyan', 'bg-neon-purple', 'bg-green-500', 'bg-amber-500', 'bg-red-500'];
              return (
                <div key={asset.id} className="flex items-center gap-3">
                  <div className={cn('w-3 h-3 rounded-full', colors[i % colors.length])} />
                  <span className="flex-1 text-sm">{asset.symbol}</span>
                  <span className="text-sm text-gray-400">{asset.allocation}%</span>
                  <span className="text-sm font-mono">
                    {showBalances ? formatCurrency(asset.value, true) : '••••'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Transactions + News */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transactions */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Transactions</h3>
            <button className="text-sm text-neon-cyan hover:underline">View all</button>
          </div>

          <div className="space-y-3">
            {INITIAL_TRANSACTIONS.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 p-3 rounded-lg bg-lattice-deep/50">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  tx.type === 'buy' && 'bg-green-500/20 text-green-400',
                  tx.type === 'sell' && 'bg-red-500/20 text-red-400',
                  tx.type === 'transfer' && 'bg-blue-500/20 text-blue-400',
                  tx.type === 'stake' && 'bg-purple-500/20 text-purple-400',
                  tx.type === 'reward' && 'bg-yellow-500/20 text-yellow-400'
                )}>
                  {tx.type === 'buy' && <ArrowDownRight className="w-5 h-5" />}
                  {tx.type === 'sell' && <ArrowUpRight className="w-5 h-5" />}
                  {tx.type === 'transfer' && <ArrowRight className="w-5 h-5" />}
                  {tx.type === 'stake' && <Lock className="w-5 h-5" />}
                  {tx.type === 'reward' && <Star className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{tx.type}</p>
                    <span className="text-sm text-gray-400">{tx.symbol}</span>
                  </div>
                  <p className="text-xs text-gray-400">{formatTime(tx.timestamp)}</p>
                </div>
                <div className="text-right">
                  <p className={cn('font-mono', tx.type === 'sell' ? 'text-green-400' : '')}>
                    {tx.type === 'sell' ? '+' : ''}{formatCurrency(tx.value)}
                  </p>
                  <p className="text-xs text-gray-400">{tx.amount} {tx.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* News */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-neon-cyan" />
              Market News
            </h3>
            <button className="text-sm text-neon-cyan hover:underline">More</button>
          </div>

          <div className="space-y-3">
            {INITIAL_NEWS.map((news) => (
              <div key={news.id} className="p-3 rounded-lg bg-lattice-deep/50 hover:bg-lattice-elevated/50 cursor-pointer transition-colors">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-2',
                    news.sentiment === 'positive' && 'bg-green-400',
                    news.sentiment === 'negative' && 'bg-red-400',
                    news.sentiment === 'neutral' && 'bg-gray-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">{news.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{news.source}</span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-400">{formatTime(news.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {news.assets.map((asset) => (
                        <span key={asset} className="px-2 py-0.5 bg-lattice-elevated rounded text-xs">
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrade = () => {
    const selectedTradingAsset = INITIAL_ASSETS.find(a => a.symbol === tradeAsset) || INITIAL_ASSETS[0];
    const estimatedValue = parseFloat(tradeAmount || '0') * (orderType === 'market' ? selectedTradingAsset.price : parseFloat(tradePrice || '0'));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Book / Chart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <select
                  value={tradeAsset}
                  onChange={(e) => setTradeAsset(e.target.value)}
                  className="bg-lattice-deep rounded-lg px-4 py-2 font-semibold focus:outline-none focus:ring-1 focus:ring-neon-cyan"
                >
                  {INITIAL_ASSETS.map((asset) => (
                    <option key={asset.id} value={asset.symbol}>
                      {asset.symbol}/USD
                    </option>
                  ))}
                </select>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(selectedTradingAsset.price)}</p>
                  <p className={cn('text-sm', selectedTradingAsset.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {formatPercent(selectedTradingAsset.changePercent24h)} today
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(['1H', '24H', '7D', '30D'] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      'px-3 py-1 rounded text-sm',
                      timeRange === range ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400'
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64">
              <canvas ref={chartRef} width={800} height={256} className="w-full h-full" />
            </div>
          </div>

          {/* Order Book */}
          <div className="panel p-4">
            <h3 className="font-semibold mb-4">Order Book</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Bids */}
              <div>
                <div className="text-xs text-gray-400 mb-2 flex justify-between">
                  <span>Price (USD)</span>
                  <span>Amount ({tradeAsset})</span>
                </div>
                {Array.from({ length: 8 }).map((_, i) => {
                  const price = selectedTradingAsset.price * (1 - (i + 1) * 0.001);
                  const amount = Math.random() * 100 + 10;
                  const depth = Math.random() * 100;

                  return (
                    <div key={i} className="relative flex justify-between text-sm py-1">
                      <div
                        className="absolute inset-0 bg-green-500/10"
                        style={{ width: `${depth}%` }}
                      />
                      <span className="relative text-green-400 font-mono">{formatCurrency(price)}</span>
                      <span className="relative text-gray-400 font-mono">{amount.toFixed(4)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Asks */}
              <div>
                <div className="text-xs text-gray-400 mb-2 flex justify-between">
                  <span>Price (USD)</span>
                  <span>Amount ({tradeAsset})</span>
                </div>
                {Array.from({ length: 8 }).map((_, i) => {
                  const price = selectedTradingAsset.price * (1 + (i + 1) * 0.001);
                  const amount = Math.random() * 100 + 10;
                  const depth = Math.random() * 100;

                  return (
                    <div key={i} className="relative flex justify-between text-sm py-1">
                      <div
                        className="absolute inset-0 right-0 bg-red-500/10"
                        style={{ width: `${depth}%`, marginLeft: 'auto' }}
                      />
                      <span className="relative text-red-400 font-mono">{formatCurrency(price)}</span>
                      <span className="relative text-gray-400 font-mono">{amount.toFixed(4)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Order Form */}
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setTradeSide('buy')}
              className={cn(
                'flex-1 py-3 rounded-lg font-semibold transition-colors',
                tradeSide === 'buy'
                  ? 'bg-green-500 text-white'
                  : 'bg-lattice-deep text-gray-400 hover:text-white'
              )}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeSide('sell')}
              className={cn(
                'flex-1 py-3 rounded-lg font-semibold transition-colors',
                tradeSide === 'sell'
                  ? 'bg-red-500 text-white'
                  : 'bg-lattice-deep text-gray-400 hover:text-white'
              )}
            >
              Sell
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Order Type</label>
              <div className="flex items-center gap-2">
                {(['market', 'limit', 'stop'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm capitalize',
                      orderType === type
                        ? 'bg-neon-cyan/20 text-neon-cyan'
                        : 'bg-lattice-deep text-gray-400'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {orderType !== 'market' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  {orderType === 'limit' ? 'Limit Price' : 'Stop Price'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={tradePrice}
                    onChange={(e) => setTradePrice(e.target.value)}
                    placeholder={selectedTradingAsset.price.toString()}
                    className="w-full pl-8 pr-4 py-3 bg-lattice-deep rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-cyan font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pr-20 py-3 bg-lattice-deep rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-cyan font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {tradeAsset}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setTradeAmount((selectedTradingAsset.holdings * pct / 100).toString())}
                    className="flex-1 py-1 text-xs bg-lattice-deep rounded hover:bg-lattice-elevated"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-lattice-border">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Available</span>
                <span>{showBalances ? `${selectedTradingAsset.holdings.toFixed(4)} ${tradeAsset}` : '••••'}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-400">Estimated Value</span>
                <span className="font-mono">{formatCurrency(estimatedValue)}</span>
              </div>

              <button
                className={cn(
                  'w-full py-4 rounded-lg font-bold text-lg transition-colors',
                  tradeSide === 'buy'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                )}
              >
                {tradeSide === 'buy' ? 'Buy' : 'Sell'} {tradeAsset}
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 pt-4 border-t border-lattice-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">24h High</span>
              <span className="text-green-400 font-mono">
                {formatCurrency(selectedTradingAsset.price * 1.05)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">24h Low</span>
              <span className="text-red-400 font-mono">
                {formatCurrency(selectedTradingAsset.price * 0.95)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">24h Volume</span>
              <span className="font-mono">{formatCurrency(selectedTradingAsset.volume24h, true)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Market Cap</span>
              <span className="font-mono">{formatCurrency(selectedTradingAsset.marketCap || 0, true)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOrders = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Open Orders</h2>
        <button className="btn-neon">
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </button>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-lattice-deep text-left text-xs text-gray-400">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Pair</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Side</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Filled</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_ORDERS.map((order) => (
              <tr key={order.id} className="border-t border-lattice-border hover:bg-lattice-elevated/30">
                <td className="px-4 py-4 text-sm text-gray-400">{formatTime(order.createdAt)}</td>
                <td className="px-4 py-4 font-medium">{order.symbol}/USD</td>
                <td className="px-4 py-4 capitalize text-sm">{order.type}</td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    order.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  )}>
                    {order.side.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-4 font-mono text-sm">
                  {order.price ? formatCurrency(order.price) : order.stopPrice ? `Stop: ${formatCurrency(order.stopPrice)}` : 'Market'}
                </td>
                <td className="px-4 py-4 font-mono text-sm">{order.amount}</td>
                <td className="px-4 py-4">
                  <div className="w-20 h-2 bg-lattice-deep rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-cyan"
                      style={{ width: `${(order.filled / order.amount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{((order.filled / order.amount) * 100).toFixed(0)}%</span>
                </td>
                <td className="px-4 py-4">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs',
                    order.status === 'open' && 'bg-yellow-500/20 text-yellow-400',
                    order.status === 'partial' && 'bg-blue-500/20 text-blue-400',
                    order.status === 'filled' && 'bg-green-500/20 text-green-400',
                    order.status === 'cancelled' && 'bg-gray-500/20 text-gray-400'
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <button className="p-2 rounded hover:bg-lattice-elevated text-gray-400 hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Price Alerts</h2>
        <button className="btn-neon">
          <Plus className="w-4 h-4 mr-2" />
          New Alert
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INITIAL_ALERTS.map((alert) => {
          const asset = INITIAL_ASSETS.find(a => a.symbol === alert.symbol);
          const triggered = alert.condition === 'above'
            ? (asset?.price || 0) >= alert.price
            : (asset?.price || 0) <= alert.price;

          return (
            <div key={alert.id} className={cn(
              'panel p-4',
              triggered && 'ring-2 ring-neon-yellow'
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neon-cyan/20 flex items-center justify-center text-neon-cyan font-bold">
                    {alert.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium">{alert.symbol}</p>
                    <p className="text-xs text-gray-400">{alert.asset}</p>
                  </div>
                </div>
                <button className={cn(
                  'p-2 rounded-lg',
                  alert.active ? 'text-neon-green' : 'text-gray-500'
                )}>
                  {alert.active ? <Bell className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {alert.condition === 'above' ? (
                  <ArrowUpRight className="w-5 h-5 text-green-400" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-400" />
                )}
                <span className="text-sm text-gray-400">
                  Price goes {alert.condition}
                </span>
                <span className="font-mono font-bold">{formatCurrency(alert.price)}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Current:</span>
                <span className="font-mono">{formatCurrency(asset?.price || 0)}</span>
              </div>

              {triggered && (
                <div className="mt-3 p-2 bg-neon-yellow/10 rounded text-neon-yellow text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Alert triggered!
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">💰</span>
          <div>
            <h1 className="text-xl font-bold">Finance Lens</h1>
            <p className="text-sm text-gray-400">Portfolio tracking & trading dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400">
            <Download className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="flex items-center gap-2 border-b border-lattice-border pb-4">
        {([
          { id: 'overview', label: 'Overview', icon: PieChart },
          { id: 'trade', label: 'Trade', icon: Activity },
          { id: 'orders', label: 'Orders', icon: Layers },
          { id: 'alerts', label: 'Alerts', icon: Bell },
          { id: 'news', label: 'News', icon: Newspaper },
        ] as const).map((item) => (
          <button
            key={item.id}
            onClick={() => setViewMode(item.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              viewMode === item.id
                ? 'bg-neon-cyan/20 text-neon-cyan'
                : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      {viewMode === 'overview' && renderOverview()}
      {viewMode === 'trade' && renderTrade()}
      {viewMode === 'orders' && renderOrders()}
      {viewMode === 'alerts' && renderAlerts()}
      {viewMode === 'news' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Market News & Analysis</h2>
          <div className="grid gap-4">
            {INITIAL_NEWS.map((news) => (
              <div key={news.id} className="panel p-4 hover:bg-lattice-elevated/50 cursor-pointer transition-colors">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-1 h-full min-h-[60px] rounded-full',
                    news.sentiment === 'positive' && 'bg-green-400',
                    news.sentiment === 'negative' && 'bg-red-400',
                    news.sentiment === 'neutral' && 'bg-gray-400'
                  )} />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{news.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
                      <span>{news.source}</span>
                      <span>·</span>
                      <span>{formatTime(news.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {news.assets.map((asset) => (
                        <span key={asset} className="px-2 py-1 bg-lattice-deep rounded text-xs font-medium">
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-lattice-surface border border-lattice-border rounded-xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-neon-cyan/20 flex items-center justify-center text-neon-cyan text-xl font-bold">
                    {selectedAsset.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedAsset.name}</h2>
                    <p className="text-gray-400">{selectedAsset.symbol}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedAsset(null)} className="p-2 rounded-lg hover:bg-lattice-elevated">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-lattice-deep rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Current Price</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedAsset.price)}</p>
                  <p className={cn('text-sm', selectedAsset.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {formatPercent(selectedAsset.changePercent24h)} today
                  </p>
                </div>
                <div className="p-3 bg-lattice-deep rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Your Holdings</p>
                  <p className="text-xl font-bold">{showBalances ? selectedAsset.holdings.toLocaleString() : '••••'}</p>
                  <p className="text-sm text-gray-400">
                    {showBalances ? formatCurrency(selectedAsset.value) : '••••'}
                  </p>
                </div>
                <div className="p-3 bg-lattice-deep rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Avg Buy Price</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedAsset.avgBuyPrice)}</p>
                </div>
                <div className="p-3 bg-lattice-deep rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Total P&L</p>
                  <p className={cn('text-xl font-bold', selectedAsset.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {showBalances ? formatCurrency(selectedAsset.pnl) : '••••'}
                  </p>
                  <p className={cn('text-sm', selectedAsset.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {formatPercent(selectedAsset.pnlPercent)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setTradeAsset(selectedAsset.symbol);
                    setTradeSide('buy');
                    setViewMode('trade');
                    setSelectedAsset(null);
                  }}
                  className="flex-1 py-3 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600"
                >
                  Buy
                </button>
                <button
                  onClick={() => {
                    setTradeAsset(selectedAsset.symbol);
                    setTradeSide('sell');
                    setViewMode('trade');
                    setSelectedAsset(null);
                  }}
                  className="flex-1 py-3 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600"
                >
                  Sell
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
