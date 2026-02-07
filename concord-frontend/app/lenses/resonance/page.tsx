'use client';

import { useState, useEffect, useRef } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ResonanceEmpireGraph } from '@/components/graphs/ResonanceEmpireGraph';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Waves,
  Activity,
  Zap,
  Heart,
  Brain,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Bell,
  BarChart3,
  LineChart,
  PieChart,
  EyeOff
} from 'lucide-react';

type TimeRange = '1h' | '24h' | '7d' | '30d';
type ViewMode = 'dashboard' | 'metrics' | 'graph' | 'alerts';

interface HealthMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
  threshold: { warning: number; critical: number };
  history: number[];
}

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  metric: string;
  value: number;
  timestamp: Date;
  acknowledged: boolean;
}

const MOCK_ALERTS: Alert[] = [
  { id: 'a1', type: 'warning', message: 'Contradiction load approaching threshold', metric: 'contradictionLoad', value: 0.18, timestamp: new Date(Date.now() - 3600000), acknowledged: false },
  { id: 'a2', type: 'info', message: 'Homeostasis improved by 5%', metric: 'homeostasis', value: 0.85, timestamp: new Date(Date.now() - 7200000), acknowledged: true },
  { id: 'a3', type: 'critical', message: 'Acute stress spike detected', metric: 'stressAcute', value: 0.72, timestamp: new Date(Date.now() - 1800000), acknowledged: false },
];

export default function ResonanceLensPage() {
  useLensNav('resonance');

  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [showAlerts, setShowAlerts] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: growth, refetch: _refetchGrowth } = useQuery({
    queryKey: ['growth'],
    queryFn: () => api.get('/api/growth').then((r) => r.data),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: metrics, refetch: _refetchMetrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.get('/api/metrics').then((r) => r.data),
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const homeostasis = growth?.growth?.homeostasis || 0;
  const bioAge = growth?.growth?.bioAge || 0;
  const coherence = metrics?.metrics?.coherenceAvg || 0;
  const continuity = metrics?.metrics?.continuityAvg || 0;
  const stressAcute = growth?.growth?.stress?.acute || 0;
  const stressChronic = growth?.growth?.stress?.chronic || 0;
  const repairRate = growth?.growth?.maintenance?.repairRate || 0.5;
  const _contradictionLoad = growth?.growth?.functionalDecline?.contradictionLoad || 0;

  const healthMetrics: HealthMetric[] = [
    {
      id: 'homeostasis',
      name: 'Homeostasis',
      value: homeostasis,
      unit: '%',
      trend: homeostasis > 0.7 ? 'up' : homeostasis < 0.5 ? 'down' : 'stable',
      status: homeostasis > 0.7 ? 'healthy' : homeostasis > 0.4 ? 'warning' : 'critical',
      threshold: { warning: 0.5, critical: 0.3 },
      history: Array.from({ length: 24 }, () => Math.random() * 0.3 + 0.6),
    },
    {
      id: 'coherence',
      name: 'Coherence',
      value: coherence,
      unit: '%',
      trend: 'stable',
      status: coherence > 0.6 ? 'healthy' : coherence > 0.3 ? 'warning' : 'critical',
      threshold: { warning: 0.4, critical: 0.2 },
      history: Array.from({ length: 24 }, () => Math.random() * 0.2 + 0.5),
    },
    {
      id: 'continuity',
      name: 'Continuity',
      value: continuity,
      unit: '%',
      trend: 'up',
      status: continuity > 0.5 ? 'healthy' : continuity > 0.3 ? 'warning' : 'critical',
      threshold: { warning: 0.35, critical: 0.2 },
      history: Array.from({ length: 24 }, () => Math.random() * 0.25 + 0.45),
    },
    {
      id: 'stressAcute',
      name: 'Acute Stress',
      value: stressAcute,
      unit: '%',
      trend: stressAcute < 0.3 ? 'down' : 'up',
      status: stressAcute < 0.3 ? 'healthy' : stressAcute < 0.6 ? 'warning' : 'critical',
      threshold: { warning: 0.4, critical: 0.7 },
      history: Array.from({ length: 24 }, () => Math.random() * 0.4 + 0.1),
    },
    {
      id: 'stressChronic',
      name: 'Chronic Stress',
      value: stressChronic,
      unit: '%',
      trend: stressChronic < 0.2 ? 'down' : 'stable',
      status: stressChronic < 0.2 ? 'healthy' : stressChronic < 0.4 ? 'warning' : 'critical',
      threshold: { warning: 0.25, critical: 0.5 },
      history: Array.from({ length: 24 }, () => Math.random() * 0.2 + 0.1),
    },
    {
      id: 'repairRate',
      name: 'Repair Rate',
      value: repairRate,
      unit: '%',
      trend: repairRate > 0.5 ? 'up' : 'stable',
      status: repairRate > 0.5 ? 'healthy' : repairRate > 0.3 ? 'warning' : 'critical',
      threshold: { warning: 0.35, critical: 0.2 },
      history: Array.from({ length: 24 }, () => Math.random() * 0.3 + 0.4),
    },
  ];

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  const acknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  // Animated pulse visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewMode !== 'dashboard') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2 - 20;

      // Draw resonance rings
      for (let i = 0; i < 5; i++) {
        const radius = maxRadius * (0.2 + i * 0.2);
        const alpha = 0.1 + Math.sin(time * 0.02 + i) * 0.05;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw pulsing core
      const pulseSize = 30 + Math.sin(time * 0.05) * 10;
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, pulseSize
      );
      gradient.addColorStop(0, `rgba(0, 212, 255, ${0.8 + homeostasis * 0.2})`);
      gradient.addColorStop(0.5, `rgba(168, 85, 247, ${0.4 + coherence * 0.3})`);
      gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw metric indicators
      healthMetrics.slice(0, 6).forEach((metric, idx) => {
        const angle = (idx / 6) * Math.PI * 2 - Math.PI / 2;
        const indicatorRadius = maxRadius * 0.7;
        const x = centerX + Math.cos(angle) * indicatorRadius;
        const y = centerY + Math.sin(angle) * indicatorRadius;

        const color = metric.status === 'healthy'
          ? 'rgba(34, 197, 94, 0.8)'
          : metric.status === 'warning'
          ? 'rgba(234, 179, 8, 0.8)'
          : 'rgba(239, 68, 68, 0.8)';

        ctx.beginPath();
        ctx.arc(x, y, 8 + metric.value * 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      time++;
      animationId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [viewMode, homeostasis, coherence, healthMetrics]);

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-400/20 border-green-400/30';
      case 'warning': return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30';
      case 'critical': return 'text-red-400 bg-red-400/20 border-red-400/30';
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-lattice-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌊</span>
          <div>
            <h1 className="text-xl font-bold">Resonance Lens</h1>
            <p className="text-sm text-gray-400">
              System coherence, homeostasis, and lattice health monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Time Range */}
          <div className="flex items-center gap-1 bg-lattice-surface rounded-lg p-1">
            {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  timeRange === range
                    ? 'bg-neon-cyan text-black font-medium'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 bg-lattice-surface rounded-lg p-1">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'dashboard' ? 'bg-lattice-elevated text-neon-cyan' : 'text-gray-400'
              }`}
              title="Dashboard"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('metrics')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'metrics' ? 'bg-lattice-elevated text-neon-cyan' : 'text-gray-400'
              }`}
              title="Metrics"
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'graph' ? 'bg-lattice-elevated text-neon-cyan' : 'text-gray-400'
              }`}
              title="Graph"
            >
              <PieChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('alerts')}
              className={`p-2 rounded-md transition-colors relative ${
                viewMode === 'alerts' ? 'bg-lattice-elevated text-neon-cyan' : 'text-gray-400'
              }`}
              title="Alerts"
            >
              <Bell className="w-4 h-4" />
              {unacknowledgedAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unacknowledgedAlerts.length}
                </span>
              )}
            </button>
          </div>

          {/* Controls */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg transition-colors ${
              autoRefresh ? 'bg-neon-green/20 text-neon-green' : 'bg-lattice-elevated text-gray-400'
            }`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {viewMode === 'dashboard' && (
            <div className="space-y-6">
              {/* Primary Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <PrimaryMetricCard
                  icon={<Heart className="w-6 h-6" />}
                  label="Homeostasis"
                  value={homeostasis}
                  color="green"
                  description="Overall system balance"
                />
                <PrimaryMetricCard
                  icon={<Brain className="w-6 h-6" />}
                  label="Coherence"
                  value={coherence}
                  color="blue"
                  description="Knowledge graph coherence"
                />
                <PrimaryMetricCard
                  icon={<Zap className="w-6 h-6" />}
                  label="Continuity"
                  value={continuity}
                  color="purple"
                  description="Temporal consistency"
                />
                <PrimaryMetricCard
                  icon={<Activity className="w-6 h-6" />}
                  label="Bio Age"
                  value={bioAge / 100}
                  color="cyan"
                  description={`${bioAge.toFixed(1)} days`}
                  showAsRaw
                  rawValue={bioAge.toFixed(1)}
                />
              </div>

              {/* Resonance Visualization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="panel p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Waves className="w-4 h-4 text-neon-cyan" />
                    Resonance Pulse
                  </h3>
                  <div className="h-[300px] relative">
                    <canvas ref={canvasRef} className="w-full h-full" />
                  </div>
                </div>

                <div className="panel p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-neon-purple" />
                    Health Indicators
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {healthMetrics.map((metric) => (
                      <div
                        key={metric.id}
                        className={`p-3 rounded-lg border ${getStatusColor(metric.status)}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{metric.name}</span>
                          {getTrendIcon(metric.trend)}
                        </div>
                        <p className="text-2xl font-bold font-mono">
                          {(metric.value * 100).toFixed(1)}{metric.unit}
                        </p>
                        {/* Mini sparkline */}
                        <div className="h-8 flex items-end gap-0.5 mt-2">
                          {metric.history.slice(-12).map((v, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-current opacity-40 rounded-t"
                              style={{ height: `${v * 100}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resonance Field Graph */}
              <div className="panel p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-neon-cyan" />
                  Resonance Field
                </h3>
                <div className="h-[400px]">
                  <ResonanceEmpireGraph />
                </div>
              </div>
            </div>
          )}

          {viewMode === 'metrics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthMetrics.map((metric) => (
                  <motion.div
                    key={metric.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="panel p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">{metric.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metric.status)}`}>
                        {metric.status}
                      </span>
                    </div>
                    <p className="text-4xl font-bold font-mono mb-4">
                      {(metric.value * 100).toFixed(1)}
                      <span className="text-lg text-gray-400">{metric.unit}</span>
                    </p>
                    <div className="h-20 flex items-end gap-1">
                      {metric.history.map((v, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-t transition-all ${
                            metric.status === 'healthy'
                              ? 'bg-green-500/60'
                              : metric.status === 'warning'
                              ? 'bg-yellow-500/60'
                              : 'bg-red-500/60'
                          }`}
                          style={{ height: `${v * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                      <span>Threshold: {(metric.threshold.warning * 100).toFixed(0)}%</span>
                      <span className="flex items-center gap-1">
                        {getTrendIcon(metric.trend)}
                        {metric.trend}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'graph' && (
            <div className="panel p-4 h-[calc(100vh-12rem)]">
              <ResonanceEmpireGraph />
            </div>
          )}

          {viewMode === 'alerts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">System Alerts</h2>
                <button
                  onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })))}
                  className="text-sm text-neon-cyan hover:underline"
                >
                  Acknowledge All
                </button>
              </div>

              {alerts.length === 0 ? (
                <div className="panel p-12 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No alerts to display</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`panel p-4 border-l-4 ${
                        alert.type === 'critical'
                          ? 'border-l-red-500'
                          : alert.type === 'warning'
                          ? 'border-l-yellow-500'
                          : 'border-l-blue-500'
                      } ${alert.acknowledged ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            className={`w-5 h-5 mt-0.5 ${
                              alert.type === 'critical'
                                ? 'text-red-500'
                                : alert.type === 'warning'
                                ? 'text-yellow-500'
                                : 'text-blue-500'
                            }`}
                          />
                          <div>
                            <p className="font-medium">{alert.message}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {alert.metric}: {(alert.value * 100).toFixed(1)}% · {alert.timestamp.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="text-sm text-neon-cyan hover:underline"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Alerts Sidebar */}
        <AnimatePresence>
          {showAlerts && viewMode !== 'alerts' && unacknowledgedAlerts.length > 0 && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-lattice-border bg-lattice-surface/50 overflow-hidden"
            >
              <div className="w-70 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-neon-yellow" />
                    Active Alerts
                  </h3>
                  <button
                    onClick={() => setShowAlerts(false)}
                    className="p-1 rounded hover:bg-lattice-elevated text-gray-400"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {unacknowledgedAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border ${
                        alert.type === 'critical'
                          ? 'border-red-500/30 bg-red-500/10'
                          : alert.type === 'warning'
                          ? 'border-yellow-500/30 bg-yellow-500/10'
                          : 'border-blue-500/30 bg-blue-500/10'
                      }`}
                    >
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {alert.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PrimaryMetricCard({
  icon,
  label,
  value,
  color,
  description,
  showAsRaw,
  rawValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'green' | 'blue' | 'purple' | 'cyan';
  description: string;
  showAsRaw?: boolean;
  rawValue?: string;
}) {
  const colorClasses = {
    green: 'text-sovereignty-locked bg-sovereignty-locked/20 border-sovereignty-locked/30',
    blue: 'text-neon-blue bg-neon-blue/20 border-neon-blue/30',
    purple: 'text-neon-purple bg-neon-purple/20 border-neon-purple/30',
    cyan: 'text-neon-cyan bg-neon-cyan/20 border-neon-cyan/30',
  };

  const percentage = Math.min(100, Math.max(0, value * 100));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`panel p-4 border ${colorClasses[color]}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className={colorClasses[color].split(' ')[0]}>{icon}</span>
      </div>
      <p className="text-3xl font-bold font-mono mb-2">
        {showAsRaw && rawValue ? rawValue : `${percentage.toFixed(1)}%`}
      </p>
      <div className="h-2 bg-lattice-deep rounded-full overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full ${colorClasses[color].split(' ')[1].replace('/20', '')}`}
        />
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </motion.div>
  );
}
