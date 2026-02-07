'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import { Clock, Zap, Activity, Play, Pause, RefreshCw } from 'lucide-react';

interface TickEvent {
  id: string;
  type: string;
  signal: number;
  stress: number;
  timestamp: string;
  organ?: string;
}

export default function TickLensPage() {
  useLensNav('tick');
  const [isLive, setIsLive] = useState(true);
  const [tickHistory, setTickHistory] = useState<TickEvent[]>([]);

  // Backend: GET /api/events for tick history
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/api/events').then((r) => r.data),
    refetchInterval: isLive ? 2000 : false,
  });

  // Simulate tick events from real events
  useEffect(() => {
    if (events?.events) {
      const ticks: TickEvent[] = events.events.slice(0, 50).map((e: Record<string, unknown>, i: number) => ({
        id: e.id || `tick-${i}`,
        type: e.type || 'kernel',
        signal: Math.random() * 0.8 + 0.2,
        stress: Math.random() * 0.3,
        timestamp: e.at || new Date().toISOString(),
        organ: ['growth_os', 'council_engine', 'dtu_forge', 'resonance_core'][i % 4],
      }));
      setTickHistory(ticks);
    }
  }, [events]);

  const avgSignal = tickHistory.length > 0
    ? tickHistory.reduce((s, t) => s + t.signal, 0) / tickHistory.length
    : 0;

  const avgStress = tickHistory.length > 0
    ? tickHistory.reduce((s, t) => s + t.stress, 0) / tickHistory.length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏱️</span>
          <div>
            <h1 className="text-xl font-bold">Tick Lens</h1>
            <p className="text-sm text-gray-400">
              Real-time kernel tick simulator and event feed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`btn-neon ${isLive ? 'green' : ''}`}
          >
            {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="ml-2">{isLive ? 'Live' : 'Paused'}</span>
          </button>
        </div>
      </header>

      {/* Tick Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{tickHistory.length}</p>
          <p className="text-sm text-gray-400">Total Ticks</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{(avgSignal * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Avg Signal</p>
        </div>
        <div className="lens-card">
          <Activity className="w-5 h-5 text-neon-pink mb-2" />
          <p className="text-2xl font-bold">{(avgStress * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Avg Stress</p>
        </div>
        <div className="lens-card">
          <RefreshCw className={`w-5 h-5 text-neon-cyan mb-2 ${isLive ? 'animate-spin' : ''}`} />
          <p className="text-2xl font-bold">{isLive ? '2s' : '—'}</p>
          <p className="text-sm text-gray-400">Refresh Rate</p>
        </div>
      </div>

      {/* Signal Wave Visualization */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-neon-blue" />
          Signal Wave
        </h2>
        <div className="h-32 flex items-end gap-1">
          {tickHistory.slice(0, 40).map((tick, _i) => (
            <div
              key={tick.id}
              className="flex-1 bg-gradient-to-t from-neon-blue to-neon-cyan rounded-t transition-all"
              style={{
                height: `${tick.signal * 100}%`,
                opacity: 0.5 + (tick.signal * 0.5),
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>Oldest</span>
          <span>Most Recent</span>
        </div>
      </div>

      {/* Tick Event Log */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-neon-purple" />
          Tick Event Log
        </h2>
        <div className="space-y-2 max-h-80 overflow-auto">
          {tickHistory.slice(0, 20).map((tick) => (
            <div
              key={tick.id}
              className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  tick.stress > 0.2 ? 'bg-neon-pink' : 'bg-neon-green'
                }`} />
                <div>
                  <p className="text-sm font-medium">{tick.type}</p>
                  <p className="text-xs text-gray-400">{tick.organ}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-neon-cyan">
                  {(tick.signal * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(tick.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
