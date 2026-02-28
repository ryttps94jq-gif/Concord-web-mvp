'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Atom, Zap, Waves, RotateCcw, Play, Shuffle, Loader2 } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { useMutation } from '@tanstack/react-query';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

interface SimResultData {
  qubits: number;
  result: string;
  gates: string[];
}

export default function QuantumLensPage() {
  useLensNav('quantum');
  const [qubits, setQubits] = useState(4);
  const [result, setResult] = useState<string | null>(null);
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('quantum');

  const { items: circuitItems, isLoading: circuitsLoading, isError: isError, error: error, refetch: refetch, create: saveResult } = useLensData<SimResultData>('quantum', 'sim-result', {
    seed: [],
  });

  const circuits = [
    { name: 'Hadamard', desc: 'Superposition gate', icon: '|H\u27E9' },
    { name: 'CNOT', desc: 'Entanglement gate', icon: '\u2295' },
    { name: 'Phase', desc: 'Rotation gate', icon: 'ei\u03B8' },
    { name: 'Measure', desc: 'Collapse state', icon: '\uD83D\uDCCA' },
  ];

  const runSimulation = useMutation({
    mutationFn: async () => {
      try {
        const { data } = await apiHelpers.chat.ask(
          `Simulate a ${qubits}-qubit quantum circuit with Hadamard and CNOT gates. Return a measurement outcome as a binary string of length ${qubits}.`,
          'quantum'
        );
        const reply = data?.reply || data?.response || '';
        // Extract a binary string from the response
        const binaryMatch = reply.match(/[01]{2,}/);
        if (binaryMatch) return binaryMatch[0].slice(0, qubits).padStart(qubits, '0');
      } catch {
        // Fallback to local simulation if backend unavailable
      }
      const outcomes = Array.from({ length: 2 ** qubits }, (_, i) =>
        i.toString(2).padStart(qubits, '0')
      );
      return outcomes[Math.floor(Math.random() * outcomes.length)];
    },
    onSuccess: (resultStr) => {
      setResult(resultStr);
      saveResult({
        title: `Sim ${new Date().toISOString().slice(0, 19)}`,
        data: { qubits, result: resultStr, gates: circuits.map((c) => c.name) },
      }).catch((err) => console.error('Failed to save simulation result:', err instanceof Error ? err.message : err));
    },
    onError: (err) => console.error('runSimulation failed:', err instanceof Error ? err.message : err),
  });

  const recentSims = circuitItems.slice(0, 5);


  if (circuitsLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-purple border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Initializing quantum circuits...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">\u269B\uFE0F</span>
        <div>
          <h1 className="text-xl font-bold">Quantum Lens</h1>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          <p className="text-sm text-gray-400">
            Quantum computing simulations and circuit builder
          </p>
        </div>
      </header>


      <RealtimeDataPanel domain="quantum" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <DTUExportButton domain="quantum" data={{}} compact />

      {/* AI Actions */}
      <UniversalActions domain="quantum" artifactId={circuitItems[0]?.id} compact />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Atom className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{qubits}</p>
          <p className="text-sm text-gray-400">Qubits</p>
        </div>
        <div className="lens-card">
          <Waves className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{2 ** qubits}</p>
          <p className="text-sm text-gray-400">States</p>
        </div>
        <div className="lens-card">
          <Shuffle className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{circuits.length}</p>
          <p className="text-sm text-gray-400">Gates</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{runSimulation.isPending ? '...' : 'Ready'}</p>
          <p className="text-sm text-gray-400">Status</p>
        </div>
      </div>

      {/* Circuit Builder */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Atom className="w-4 h-4 text-neon-purple" />
          Quantum Circuit
        </h2>
        <div className="flex gap-2 mb-4">
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Qubits:</span>
            <input
              type="range"
              min="1"
              max="8"
              value={qubits}
              onChange={(e) => setQubits(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono">{qubits}</span>
          </label>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {circuits.map((gate) => (
            <div key={gate.name} className="lens-card text-center p-3">
              <span className="text-2xl font-mono">{gate.icon}</span>
              <p className="text-xs font-medium mt-1">{gate.name}</p>
              <p className="text-xs text-gray-500">{gate.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runSimulation.mutate()}
            disabled={runSimulation.isPending}
            className="btn-neon purple flex-1"
          >
            {runSimulation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 inline animate-spin" />Simulating...</>
            ) : (
              <><Play className="w-4 h-4 mr-2 inline" />Run Circuit</>
            )}
          </button>
          <button onClick={() => setResult(null)} className="btn-neon">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="panel p-6 text-center">
          <h3 className="text-sm text-gray-400 mb-2">Measurement Result</h3>
          <p className="text-4xl font-mono text-neon-cyan tracking-widest">|{result}\u27E9</p>
          <p className="text-sm text-gray-500 mt-2">Collapsed from superposition</p>
        </div>
      )}

      {/* Recent Simulations */}
      {recentSims.length > 0 && (
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-green" />
            Recent Simulations
          </h2>
          <div className="space-y-2">
            {recentSims.map((sim) => (
              <div key={sim.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
                <div>
                  <span className="font-mono text-neon-cyan">|{sim.data.result}\u27E9</span>
                  <span className="text-xs text-gray-500 ml-2">{sim.data.qubits} qubits</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(sim.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
