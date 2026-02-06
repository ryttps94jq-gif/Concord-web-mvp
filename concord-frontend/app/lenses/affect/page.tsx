'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Activity, Shield, Brain, Zap, Battery,
  Users, RefreshCw, Send, AlertTriangle, TrendingUp,
  TrendingDown, Minus, BarChart3
} from 'lucide-react';

type AffectDim = { key: string; label: string; icon: React.ReactNode; color: string };

const DIMS: AffectDim[] = [
  { key: 'v', label: 'Valence', icon: <Heart className="w-4 h-4" />, color: 'text-pink-400' },
  { key: 'a', label: 'Arousal', icon: <Activity className="w-4 h-4" />, color: 'text-orange-400' },
  { key: 's', label: 'Stability', icon: <Shield className="w-4 h-4" />, color: 'text-green-400' },
  { key: 'c', label: 'Coherence', icon: <Brain className="w-4 h-4" />, color: 'text-blue-400' },
  { key: 'g', label: 'Agency', icon: <Zap className="w-4 h-4" />, color: 'text-purple-400' },
  { key: 't', label: 'Trust', icon: <Users className="w-4 h-4" />, color: 'text-cyan-400' },
  { key: 'f', label: 'Fatigue', icon: <Battery className="w-4 h-4" />, color: 'text-yellow-400' },
];

const EVENT_TYPES = [
  'USER_MESSAGE', 'SYSTEM_RESULT', 'ERROR', 'SUCCESS', 'TIMEOUT',
  'CONFLICT', 'SAFETY_BLOCK', 'GOAL_PROGRESS', 'TOOL_RESULT',
  'FEEDBACK', 'SESSION_START', 'SESSION_END', 'CUSTOM',
];

export default function AffectLensPage() {
  useLensNav('affect');

  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState('default');
  const [eventType, setEventType] = useState('USER_MESSAGE');
  const [intensity, setIntensity] = useState(0.5);
  const [polarity, setPolarity] = useState(0.0);

  const { data: state, isLoading: stateLoading } = useQuery({
    queryKey: ['affect-state', sessionId],
    queryFn: () => apiHelpers.affect.state(sessionId).then((r) => r.data),
    refetchInterval: 3000,
  });

  const { data: policy } = useQuery({
    queryKey: ['affect-policy', sessionId],
    queryFn: () => apiHelpers.affect.policy(sessionId).then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: health } = useQuery({
    queryKey: ['affect-health'],
    queryFn: () => apiHelpers.affect.health().then((r) => r.data),
  });

  const { data: events } = useQuery({
    queryKey: ['affect-events', sessionId],
    queryFn: () => apiHelpers.affect.events(sessionId).then((r) => r.data),
    refetchInterval: 5000,
  });

  const emitEvent = useMutation({
    mutationFn: () =>
      apiHelpers.affect.emit(sessionId, { type: eventType, intensity, polarity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affect-state', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['affect-policy', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['affect-events', sessionId] });
    },
  });

  const resetAffect = useMutation({
    mutationFn: (mode?: string) => apiHelpers.affect.reset(sessionId, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affect-state', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['affect-policy', sessionId] });
    },
  });

  const affectState = state?.state || state?.E || state || {};
  const policyData = policy?.policy || policy || {};

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💓</span>
          <div>
            <h1 className="text-xl font-bold">Affect Lens</h1>
            <p className="text-sm text-gray-400">
              Affect Translation Spine — 7D emotional state monitoring &amp; control
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="input-lattice w-40 text-sm"
            placeholder="Session ID"
          />
          <button
            onClick={() => resetAffect.mutate(undefined)}
            className="btn-neon flex items-center gap-1 text-sm"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
          <button
            onClick={() => resetAffect.mutate('cooldown')}
            className="btn-neon flex items-center gap-1 text-sm"
            title="Council-mandated cooldown"
          >
            <Shield className="w-3 h-3" /> Cooldown
          </button>
        </div>
      </header>

      {/* Health Banner */}
      {health && (
        <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
          health.healthy !== false
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {health.healthy !== false ? <Shield className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          ATS Health: {health.healthy !== false ? 'Operational' : 'Degraded'} — {health.sessions || 0} active sessions
        </div>
      )}

      {/* 7D State Visualization */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DIMS.map((dim) => {
          const val = affectState[dim.key] ?? 0.5;
          return (
            <motion.div
              key={dim.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel p-3"
            >
              <div className={`flex items-center gap-1 mb-2 ${dim.color}`}>
                {dim.icon}
                <span className="text-xs font-medium">{dim.label}</span>
              </div>
              <p className="text-2xl font-bold font-mono">{(val * 100).toFixed(1)}%</p>
              <div className="h-2 bg-lattice-deep rounded-full mt-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${val * 100}%` }}
                  className={`h-full rounded-full ${dim.color.replace('text-', 'bg-')}`}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Emitter */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Send className="w-4 h-4 text-neon-cyan" />
            Emit Affect Event
          </h2>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="input-lattice w-full"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Intensity: {intensity.toFixed(2)}
            </label>
            <input
              type="range" min="0" max="1" step="0.01"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Polarity: {polarity.toFixed(2)}
            </label>
            <input
              type="range" min="-1" max="1" step="0.01"
              value={polarity}
              onChange={(e) => setPolarity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <button
            onClick={() => emitEvent.mutate()}
            disabled={emitEvent.isPending}
            className="btn-neon purple w-full flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {emitEvent.isPending ? 'Emitting...' : 'Emit Event'}
          </button>
        </div>

        {/* Policy Output */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-neon-purple" />
            Active Policy
          </h2>
          {Object.entries(policyData).map(([category, values]) => (
            <div key={category}>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">{category}</h3>
              <div className="space-y-1">
                {typeof values === 'object' && values !== null && Object.entries(values as Record<string, number>).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{key}</span>
                    <span className="font-mono text-neon-cyan">
                      {typeof val === 'number' ? val.toFixed(3) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Event Log */}
        <div className="panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-neon-green" />
            Recent Events
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(events?.events || events || []).slice?.(-15)?.reverse?.()?.map?.((evt: any, i: number) => (
              <div key={i} className="lens-card text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium">{evt.type}</span>
                  <span className="text-gray-500">
                    i={evt.intensity?.toFixed(2)} p={evt.polarity?.toFixed(2)}
                  </span>
                </div>
              </div>
            )) || (
              <p className="text-center text-gray-500 py-4">No events yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
