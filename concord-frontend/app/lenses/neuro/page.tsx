'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Brain, Network, Activity, Layers, Loader2 } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

interface NetworkData {
  name: string;
  neurons: number;
  layers: number;
  accuracy: number;
}

interface NeuronData {
  activation: number;
  connections: number;
  type: 'input' | 'hidden' | 'output';
}

const SEED_NETWORKS: { title: string; data: Record<string, unknown> }[] = [];

const SEED_NEURONS: { title: string; data: Record<string, unknown> }[] = [];

export default function NeuroLensPage() {
  useLensNav('neuro');
  const [networkType, setNetworkType] = useState('Feedforward');
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('neuro');

  const { items: networkItems, isLoading: networksLoading, isError, error, refetch } = useLensData<NetworkData>('neuro', 'network', {
    seed: SEED_NETWORKS,
  });
  const { items: neuronItems, isLoading: neuronsLoading, isError: isError2, error: error2, refetch: refetch2 } = useLensData<NeuronData>('neuro', 'neuron', {
    seed: SEED_NEURONS,
  });

  const networks = networkItems.map((item) => ({
    id: item.title || item.id,
    name: item.data.name || item.title,
    neurons: item.data.neurons,
    layers: item.data.layers,
    accuracy: item.data.accuracy,
  }));

  const dtuNeurons = neuronItems.map((item) => ({
    id: item.title || item.id,
    activation: item.data.activation,
    connections: item.data.connections,
    type: item.data.type,
  }));

  const selectedNetwork = networks.find((n) => n.name === networkType) || networks[0];

  if (networksLoading || neuronsLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neon-pink" />
        <span className="ml-3 text-gray-400">Loading neural networks...</span>
      </div>
    );
  }


  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h1 className="text-xl font-bold">Neuro Lens</h1>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          <p className="text-sm text-gray-400">
            Neural network models with DTUs as neurons
          </p>
        </div>
      </header>


      <RealtimeDataPanel domain="neuro" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <DTUExportButton domain="neuro" data={{}} compact />

      {/* AI Actions */}
      <UniversalActions domain="neuro" artifactId={networkItems[0]?.id} compact />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Brain className="w-5 h-5 text-neon-pink mb-2" />
          <p className="text-2xl font-bold">{selectedNetwork?.neurons ?? 0}</p>
          <p className="text-sm text-gray-400">Neurons</p>
        </div>
        <div className="lens-card">
          <Layers className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{selectedNetwork?.layers ?? 0}</p>
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
              onClick={() => setNetworkType(net.name)}
              className={`px-4 py-2 rounded-lg ${
                networkType === net.name
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
