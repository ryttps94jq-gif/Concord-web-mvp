'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  Globe,
  Activity,
  Thermometer,
  Droplets,
  Eye,
  BarChart3
} from 'lucide-react';

export default function GroundingLensPage() {
  useLensNav('grounding');

  const queryClient = useQueryClient();
  const [sensorId, setSensorId] = useState('');
  const [readingValue, setReadingValue] = useState('');
  const [readingUnit, setReadingUnit] = useState('');
  const [groundDtuId, setGroundDtuId] = useState('');

  const { data: status } = useQuery({
    queryKey: ['grounding-status'],
    queryFn: () => apiHelpers.grounding.status().then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: sensors } = useQuery({
    queryKey: ['grounding-sensors'],
    queryFn: () => apiHelpers.grounding.sensors().then((r) => r.data),
  });

  const { data: readings } = useQuery({
    queryKey: ['grounding-readings'],
    queryFn: () => apiHelpers.grounding.readings().then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: context } = useQuery({
    queryKey: ['grounding-context'],
    queryFn: () => apiHelpers.grounding.context().then((r) => r.data),
  });

  const addReading = useMutation({
    mutationFn: () => apiHelpers.grounding.addReading({
      sensorId, value: parseFloat(readingValue), unit: readingUnit,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grounding-readings'] });
      setReadingValue('');
    },
  });

  const groundDtu = useMutation({
    mutationFn: () => apiHelpers.grounding.ground(groundDtuId),
    onSuccess: () => setGroundDtuId(''),
  });

  const sensorList = sensors?.sensors || sensors || [];
  const readingList = readings?.readings || readings || [];
  const statusInfo = status?.status || status || {};
  const contextInfo = context?.context || context || {};

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🌍</span>
        <div>
          <h1 className="text-xl font-bold">Grounding Lens</h1>
          <p className="text-sm text-gray-400">
            Embodied cognition — sensors, readings, and reality anchoring
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Activity className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{Array.isArray(sensorList) ? sensorList.length : 0}</p>
          <p className="text-sm text-gray-400">Sensors</p>
        </div>
        <div className="lens-card">
          <BarChart3 className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{Array.isArray(readingList) ? readingList.length : 0}</p>
          <p className="text-sm text-gray-400">Readings</p>
        </div>
        <div className="lens-card">
          <Globe className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{statusInfo.grounded || 0}</p>
          <p className="text-sm text-gray-400">Grounded DTUs</p>
        </div>
        <div className="lens-card">
          <Eye className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{statusInfo.pending || 0}</p>
          <p className="text-sm text-gray-400">Pending Actions</p>
        </div>
      </div>

      {/* Context */}
      {contextInfo && Object.keys(contextInfo).length > 0 && (
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-neon-cyan" /> Current Context
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(contextInfo).map(([key, val]) => (
              <div key={key} className="lens-card">
                <p className="text-xs text-gray-400 uppercase">{key}</p>
                <p className="text-sm font-mono">{String(val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Reading */}
        <div className="panel p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-neon-purple" /> Add Sensor Reading
          </h2>
          <select value={sensorId} onChange={(e) => setSensorId(e.target.value)} className="input-lattice w-full">
            <option value="">Select sensor...</option>
            {Array.isArray(sensorList) && sensorList.map((s: Record<string, unknown>) => (
              <option key={s.id || s} value={s.id || s}>{s.name || s.id || s}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={readingValue} onChange={(e) => setReadingValue(e.target.value)}
              placeholder="Value" className="input-lattice" />
            <input type="text" value={readingUnit} onChange={(e) => setReadingUnit(e.target.value)}
              placeholder="Unit (e.g., °C)" className="input-lattice" />
          </div>
          <button
            onClick={() => addReading.mutate()}
            disabled={!sensorId || !readingValue || addReading.isPending}
            className="btn-neon purple w-full"
          >
            {addReading.isPending ? 'Adding...' : 'Add Reading'}
          </button>

          {/* Ground DTU */}
          <div className="border-t border-lattice-border pt-3 mt-3">
            <h3 className="text-sm font-medium mb-2">Ground a DTU</h3>
            <div className="flex gap-2">
              <input type="text" value={groundDtuId} onChange={(e) => setGroundDtuId(e.target.value)}
                placeholder="DTU ID..." className="input-lattice flex-1" />
              <button
                onClick={() => groundDtu.mutate()}
                disabled={!groundDtuId || groundDtu.isPending}
                className="btn-neon"
              >
                Ground
              </button>
            </div>
          </div>
        </div>

        {/* Recent Readings */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-neon-blue" /> Recent Readings
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {Array.isArray(readingList) && readingList.slice(-20).reverse().map((r: Record<string, unknown>, i: number) => (
              <div key={i} className="lens-card text-xs flex items-center justify-between">
                <span className="font-mono text-neon-cyan">{r.sensorId || r.sensor}</span>
                <span>{r.value} {r.unit}</span>
                <span className="text-gray-500">{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ''}</span>
              </div>
            ))}
            {(!Array.isArray(readingList) || readingList.length === 0) && (
              <p className="text-center py-8 text-gray-500 text-sm">No readings yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
