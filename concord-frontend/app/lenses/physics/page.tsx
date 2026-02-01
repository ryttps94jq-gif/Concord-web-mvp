'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Orbit, Play, Pause, RotateCcw, Settings, Gauge } from 'lucide-react';

export default function PhysicsLensPage() {
  useLensNav('physics');

  const [isRunning, setIsRunning] = useState(false);
  const [gravity, setGravity] = useState(9.8);
  const [friction, setFriction] = useState(0.1);

  const { data: simulation } = useQuery({
    queryKey: ['physics-sim'],
    queryFn: () => api.get('/api/physics/simulation').then((r) => r.data),
    refetchInterval: isRunning ? 100 : false,
  });

  const toggleSimulation = useMutation({
    mutationFn: (running: boolean) =>
      api.post('/api/physics/toggle', { running }),
    onSuccess: (_, running) => setIsRunning(running),
  });

  const resetSimulation = useMutation({
    mutationFn: () => api.post('/api/physics/reset'),
  });

  const updateParams = useMutation({
    mutationFn: (params: { gravity: number; friction: number }) =>
      api.post('/api/physics/params', params),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚛️</span>
          <div>
            <h1 className="text-xl font-bold">Physics Lens</h1>
            <p className="text-sm text-gray-400">
              Physics simulation and force visualization
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSimulation.mutate(!isRunning)}
            className={`btn-neon ${isRunning ? 'pink' : 'purple'}`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2 inline" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2 inline" />
                Start
              </>
            )}
          </button>
          <button
            onClick={() => resetSimulation.mutate()}
            className="btn-neon"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Simulation Canvas */}
        <div className="lg:col-span-3 panel p-4">
          <div className="graph-container relative">
            {/* Placeholder for physics canvas */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Orbit
                className={`w-32 h-32 text-neon-cyan ${
                  isRunning ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '3s' }}
              />
            </div>

            {/* Stats overlay */}
            <div className="absolute top-4 left-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
              <p className="text-xs text-gray-400">Bodies</p>
              <p className="text-lg font-mono text-neon-blue">
                {simulation?.bodies?.length || 0}
              </p>
            </div>

            <div className="absolute top-4 right-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
              <p className="text-xs text-gray-400">Time Step</p>
              <p className="text-lg font-mono text-neon-purple">
                {simulation?.timeStep || 0}
              </p>
            </div>

            <div className="absolute bottom-4 left-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
              <p className="text-xs text-gray-400">Total Energy</p>
              <p className="text-lg font-mono text-neon-green">
                {simulation?.totalEnergy?.toFixed(2) || '0.00'} J
              </p>
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-neon-purple" />
            Simulation Parameters
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">
                Gravity: {gravity.toFixed(1)} m/s²
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.1"
                value={gravity}
                onChange={(e) => setGravity(parseFloat(e.target.value))}
                onMouseUp={() => updateParams.mutate({ gravity, friction })}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">
                Friction: {friction.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={friction}
                onChange={(e) => setFriction(parseFloat(e.target.value))}
                onMouseUp={() => updateParams.mutate({ gravity, friction })}
                className="w-full"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-lattice-border">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-neon-green" />
              System Stats
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Kinetic Energy</span>
                <span className="font-mono">
                  {simulation?.kineticEnergy?.toFixed(2) || '0.00'} J
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Potential Energy</span>
                <span className="font-mono">
                  {simulation?.potentialEnergy?.toFixed(2) || '0.00'} J
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Momentum</span>
                <span className="font-mono">
                  {simulation?.momentum?.toFixed(2) || '0.00'} kg·m/s
                </span>
              </div>
            </div>
          </div>

          {/* Body List */}
          <div className="pt-4 border-t border-lattice-border">
            <h4 className="font-semibold mb-2">Bodies</h4>
            <div className="space-y-1 max-h-48 overflow-auto">
              {simulation?.bodies?.map((body: any) => (
                <div
                  key={body.id}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span className="text-gray-300">{body.name}</span>
                  <span className="text-xs text-gray-500">
                    {body.mass.toFixed(1)} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
