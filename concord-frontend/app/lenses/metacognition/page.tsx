'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  Eye,
  Brain,
  AlertTriangle,
  Target,
  BarChart3,
  Crosshair,
  Lightbulb,
  Send
} from 'lucide-react';

export default function MetacognitionLensPage() {
  useLensNav('metacognition');

  const queryClient = useQueryClient();
  const [predictionClaim, setPredictionClaim] = useState('');
  const [predictionConfidence, setPredictionConfidence] = useState(0.7);
  const [introspectFocus, setIntrospectFocus] = useState('');

  const { data: status } = useQuery({
    queryKey: ['metacognition-status'],
    queryFn: () => apiHelpers.metacognition.status().then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: blindspots } = useQuery({
    queryKey: ['metacognition-blindspots'],
    queryFn: () => apiHelpers.metacognition.blindspots().then((r) => r.data),
  });

  const { data: calibration } = useQuery({
    queryKey: ['metacognition-calibration'],
    queryFn: () => apiHelpers.metacognition.calibration().then((r) => r.data),
  });

  const { data: introspectionStatus } = useQuery({
    queryKey: ['metacognition-introspection'],
    queryFn: () => apiHelpers.metacognition.introspection().then((r) => r.data),
  });

  const makePrediction = useMutation({
    mutationFn: () =>
      apiHelpers.metacognition.predict({
        claim: predictionClaim,
        confidence: predictionConfidence,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metacognition-status'] });
      setPredictionClaim('');
    },
  });

  const runIntrospection = useMutation({
    mutationFn: () => apiHelpers.metacognition.introspect({ focus: introspectFocus || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metacognition-introspection'] });
    },
  });

  const spots = blindspots?.blindspots || blindspots || [];
  const cal = calibration?.calibration || calibration || {};
  const statusInfo = status?.status || status || {};

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🔍</span>
        <div>
          <h1 className="text-xl font-bold">Metacognition Lens</h1>
          <p className="text-sm text-gray-400">
            Self-awareness — blindspot detection, calibration, and introspection
          </p>
        </div>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Eye className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{statusInfo.predictions || 0}</p>
          <p className="text-sm text-gray-400">Predictions</p>
        </div>
        <div className="lens-card">
          <Target className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">
            {cal.accuracy ? `${(cal.accuracy * 100).toFixed(0)}%` : '—'}
          </p>
          <p className="text-sm text-gray-400">Calibration</p>
        </div>
        <div className="lens-card">
          <AlertTriangle className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">
            {Array.isArray(spots) ? spots.length : 0}
          </p>
          <p className="text-sm text-gray-400">Blindspots</p>
        </div>
        <div className="lens-card">
          <Brain className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{statusInfo.strategies || 0}</p>
          <p className="text-sm text-gray-400">Strategies</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prediction Tracker */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-neon-cyan" />
            Make a Prediction
          </h2>
          <input
            type="text"
            value={predictionClaim}
            onChange={(e) => setPredictionClaim(e.target.value)}
            placeholder="Prediction claim..."
            className="input-lattice w-full"
          />
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Confidence: {(predictionConfidence * 100).toFixed(0)}%
            </label>
            <input
              type="range" min="0.1" max="1" step="0.05"
              value={predictionConfidence}
              onChange={(e) => setPredictionConfidence(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <button
            onClick={() => makePrediction.mutate()}
            disabled={!predictionClaim || makePrediction.isPending}
            className="btn-neon purple w-full flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {makePrediction.isPending ? 'Recording...' : 'Record Prediction'}
          </button>
        </div>

        {/* Introspection */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-neon-yellow" />
            Introspection
          </h2>
          <input
            type="text"
            value={introspectFocus}
            onChange={(e) => setIntrospectFocus(e.target.value)}
            placeholder="Focus area (optional)..."
            className="input-lattice w-full"
          />
          <button
            onClick={() => runIntrospection.mutate()}
            disabled={runIntrospection.isPending}
            className="btn-neon w-full flex items-center justify-center gap-2"
          >
            <Brain className="w-4 h-4" />
            {runIntrospection.isPending ? 'Introspecting...' : 'Run Introspection'}
          </button>
          {introspectionStatus && (
            <div className="text-sm text-gray-300 bg-lattice-surface p-3 rounded-lg">
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(introspectionStatus, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Blindspots */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-neon-yellow" />
          Detected Blindspots
        </h2>
        {Array.isArray(spots) && spots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {spots.map((spot: Record<string, unknown>, i: number) => (
              <div key={i} className="lens-card border-l-4 border-l-yellow-500">
                <p className="font-medium text-sm">{spot.description || spot.domain || spot}</p>
                {spot.severity && (
                  <p className="text-xs text-gray-400 mt-1">Severity: {spot.severity}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-gray-500">
            No blindspots detected. Run introspection to discover new ones.
          </p>
        )}
      </div>

      {/* Calibration */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-neon-green" />
          Calibration Report
        </h2>
        {cal && Object.keys(cal).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(cal).map(([key, val]) => (
              <div key={key} className="lens-card">
                <p className="text-xs text-gray-400 uppercase">{key}</p>
                <p className="text-xl font-bold font-mono">
                  {typeof val === 'number' ? val.toFixed(3) : String(val)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-4 text-gray-500">
            Make predictions and resolve them to build calibration data.
          </p>
        )}
      </div>
    </div>
  );
}
