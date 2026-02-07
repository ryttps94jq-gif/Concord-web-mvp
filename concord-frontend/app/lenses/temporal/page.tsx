'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  Clock,
  Calendar,
  ArrowRight,
  Play,
  Layers
} from 'lucide-react';

export default function TemporalLensPage() {
  useLensNav('temporal');

  const [scenario, setScenario] = useState('');
  const [timespan, setTimespan] = useState('1y');
  const [frameName, setFrameName] = useState('');
  const [frameStart, setFrameStart] = useState('');
  const [frameEnd, setFrameEnd] = useState('');
  const [results, setResults] = useState<unknown>(null);

  const { data: frames } = useQuery({
    queryKey: ['temporal-frames'],
    queryFn: () => apiHelpers.temporal.frames().then((r) => r.data),
  });

  const runSim = useMutation({
    mutationFn: () => apiHelpers.temporal.sim({ scenario, timespan }),
    onSuccess: (res) => setResults(res.data),
  });

  const createFrame = useMutation({
    mutationFn: () => apiHelpers.temporal.frame({ name: frameName, start: frameStart, end: frameEnd }),
    onSuccess: () => {
      setFrameName('');
      setFrameStart('');
      setFrameEnd('');
    },
  });

  const framesList = frames?.frames || frames || [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">⏳</span>
        <div>
          <h1 className="text-xl font-bold">Temporal Lens</h1>
          <p className="text-sm text-gray-400">
            Temporal reasoning — time frames, simulations, recency scoring
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{Array.isArray(framesList) ? framesList.length : 0}</p>
          <p className="text-sm text-gray-400">Time Frames</p>
        </div>
        <div className="lens-card">
          <Calendar className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-sm text-gray-400">Simulations</p>
        </div>
        <div className="lens-card">
          <Layers className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-sm text-gray-400">Validated Claims</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Temporal Simulation */}
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Play className="w-4 h-4 text-neon-purple" /> Temporal Simulation
            </h2>
            <textarea
              value={scenario} onChange={(e) => setScenario(e.target.value)}
              placeholder="Describe a scenario to simulate over time..."
              className="input-lattice w-full h-24 resize-none"
            />
            <select value={timespan} onChange={(e) => setTimespan(e.target.value)} className="input-lattice w-full">
              <option value="1w">1 Week</option>
              <option value="1m">1 Month</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
              <option value="5y">5 Years</option>
            </select>
            <button
              onClick={() => runSim.mutate()}
              disabled={!scenario || runSim.isPending}
              className="btn-neon purple w-full"
            >
              {runSim.isPending ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>

          {/* Create Time Frame */}
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neon-cyan" /> Create Time Frame
            </h2>
            <input type="text" value={frameName} onChange={(e) => setFrameName(e.target.value)}
              placeholder="Frame name..." className="input-lattice w-full" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={frameStart} onChange={(e) => setFrameStart(e.target.value)}
                className="input-lattice" />
              <input type="date" value={frameEnd} onChange={(e) => setFrameEnd(e.target.value)}
                className="input-lattice" />
            </div>
            <button
              onClick={() => createFrame.mutate()}
              disabled={!frameName || !frameStart || !frameEnd || createFrame.isPending}
              className="btn-neon w-full"
            >
              Create Frame
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {results && (
            <div className="panel p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-neon-green" /> Results
              </h2>
              <pre className="bg-lattice-surface p-3 rounded-lg whitespace-pre-wrap text-xs text-gray-300 font-mono max-h-64 overflow-y-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}

          <div className="panel p-4">
            <h2 className="font-semibold mb-3">Time Frames</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Array.isArray(framesList) && framesList.map((f: Record<string, unknown>, i: number) => (
                <div key={i} className="lens-card text-xs">
                  <p className="font-medium">{f.name}</p>
                  <p className="text-gray-400">{f.start} → {f.end}</p>
                </div>
              ))}
              {(!Array.isArray(framesList) || framesList.length === 0) && (
                <p className="text-center py-4 text-gray-500 text-sm">No time frames</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
