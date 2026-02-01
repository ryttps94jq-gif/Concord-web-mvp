'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Glasses, Camera, Layers, Box, Scan, Settings } from 'lucide-react';

export default function ARLensPage() {
  useLensNav('ar');

  const [arEnabled, setArEnabled] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const { data: arStatus } = useQuery({
    queryKey: ['ar-status'],
    queryFn: () => api.get('/api/ar/status').then((r) => r.data),
  });

  const { data: arLayers } = useQuery({
    queryKey: ['ar-layers'],
    queryFn: () => api.get('/api/ar/layers').then((r) => r.data),
  });

  const layers = [
    { id: 'dtu-overlay', name: 'DTU Overlay', description: 'Visualize DTUs in space', icon: '💭' },
    { id: 'resonance-field', name: 'Resonance Field', description: 'Show system coherence waves', icon: '🌊' },
    { id: 'lattice-grid', name: 'Lattice Grid', description: 'Display structural connections', icon: '🔗' },
    { id: 'temporal-markers', name: 'Temporal Markers', description: 'Time-based annotations', icon: '⏰' },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥽</span>
          <div>
            <h1 className="text-xl font-bold">AR Lens</h1>
            <p className="text-sm text-gray-400">
              Augmented reality overlay for DTU visualization
            </p>
          </div>
        </div>
        <button
          onClick={() => setArEnabled(!arEnabled)}
          className={`btn-neon ${arEnabled ? 'pink' : 'purple'}`}
        >
          {arEnabled ? (
            <>
              <Camera className="w-4 h-4 mr-2 inline" />
              Stop AR
            </>
          ) : (
            <>
              <Glasses className="w-4 h-4 mr-2 inline" />
              Start AR
            </>
          )}
        </button>
      </header>

      {/* AR Viewport */}
      <div className="panel p-4">
        <div className="graph-container relative overflow-hidden">
          {arEnabled ? (
            <div className="absolute inset-0 bg-gradient-to-br from-neon-purple/10 to-neon-blue/10 flex items-center justify-center">
              <div className="text-center">
                <Scan className="w-24 h-24 mx-auto text-neon-cyan animate-pulse mb-4" />
                <p className="text-lg font-medium">AR Mode Active</p>
                <p className="text-sm text-gray-400">
                  Camera feed would render here
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Glasses className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Enable AR to begin visualization</p>
              </div>
            </div>
          )}

          {/* AR Status Overlay */}
          {arEnabled && (
            <>
              <div className="absolute top-4 left-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-400">Status</p>
                <p className="text-sm font-medium text-neon-green">Tracking</p>
              </div>
              <div className="absolute top-4 right-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-400">FPS</p>
                <p className="text-sm font-mono">60</p>
              </div>
              <div className="absolute bottom-4 left-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-400">Active Layers</p>
                <p className="text-sm font-medium">
                  {layers.filter((l) => arLayers?.active?.includes(l.id)).length}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AR Layers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {layers.map((layer) => {
          const isActive = arLayers?.active?.includes(layer.id);
          return (
            <button
              key={layer.id}
              onClick={() => setSelectedLayer(layer.id)}
              className={`lens-card text-left ${
                isActive ? 'border-neon-cyan' : ''
              } ${selectedLayer === layer.id ? 'glow-blue' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{layer.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{layer.name}</h4>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        isActive
                          ? 'bg-neon-green/20 text-neon-green'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{layer.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* AR Settings */}
      <div className="panel p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4 text-neon-purple" />
          AR Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Render Quality</label>
            <select className="input-lattice">
              <option value="low">Low (Better Performance)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Better Quality)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Tracking Mode</label>
            <select className="input-lattice">
              <option value="world">World Tracking</option>
              <option value="face">Face Tracking</option>
              <option value="image">Image Tracking</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">DTU Density</label>
            <input
              type="range"
              min="1"
              max="100"
              defaultValue="50"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Opacity</label>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="75"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
