'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Brain, Network, Activity, Layers } from 'lucide-react';

export default function NeuroLensPage() {
  useLensNav('neuro');
  const [networkType, setNetworkType] = useState('feedforward');

  const networks = [
    { id: 'feedforward', name: 'Feedforward', neurons: 128, layers: 4, accuracy: 0.92 },
    { id: 'recurrent', name: 'Recurrent', neurons: 64, layers: 3, accuracy: 0.88 },
    { id: 'transformer', name: 'Transformer', neurons: 256, layers: 6, accuracy: 0.95 },
  ];

  const selectedNetwork = networks.find((n) => n.id === networkType);

  const dtuNeurons = [
    { id: 'n-001', activation: 0.85, connections: 12, type: 'input' },
    { id: 'n-002', activation: 0.72, connections: 8, type: 'hidden' },
    { id: 'n-003', activation: 0.91, connections: 15, type: 'hidden' },
    { id: 'n-004', activation: 0.68, connections: 5, type: 'output' },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h1 className="text-xl font-bold">Neuro Lens</h1>
          <p className="text-sm text-gray-400">
            Neural network models with DTUs as neurons
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Brain className="w-5 h-5 text-neon-pink mb-2" />
          <p className="text-2xl font-bold">{selectedNetwork?.neurons}</p>
          <p className="text-sm text-gray-400">Neurons</p>
        </div>
        <div className="lens-card">
          <Layers className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{selectedNetwork?.layers}</p>
          <p className="text-sm text-gray-400">Layers</p>
        </div>
        <div className="lens-card">
          <Network className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{dtuNeurons.reduce((s, n) => s + n.connections, 0)}</p>
          <p className="text-sm text-gray-400">Connections</p>
        </div>
        <div className="lens-card">
          <Activity className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{((selectedNetwork?.accuracy || 0) * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Accuracy</p>
        </div>
      </div>

      {/* Network Selector */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Network className="w-4 h-4 text-neon-blue" />
          Network Architecture
        </h2>
        <div className="flex gap-2 mb-4">
          {networks.map((net) => (
            <button
              key={net.id}
              onClick={() => setNetworkType(net.id)}
              className={`px-4 py-2 rounded-lg ${
                networkType === net.id
                  ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                  : 'bg-lattice-surface text-gray-400'
              }`}
            >
              {net.name}
            </button>
          ))}
        </div>
      </div>

      {/* DTU Neurons */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4 text-neon-pink" />
          DTU-Neuron Mappings
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dtuNeurons.map((neuron) => (
            <div key={neuron.id} className="lens-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs">{neuron.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  neuron.type === 'input' ? 'bg-neon-green/20 text-neon-green' :
                  neuron.type === 'output' ? 'bg-neon-pink/20 text-neon-pink' :
                  'bg-neon-blue/20 text-neon-blue'
                }`}>
                  {neuron.type}
                </span>
              </div>
              <div className="mb-2">
                <p className="text-xs text-gray-400 mb-1">Activation</p>
                <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon-cyan"
                    style={{ width: `${neuron.activation * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">{neuron.connections} connections</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
