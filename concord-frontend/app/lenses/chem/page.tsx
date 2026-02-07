'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Atom, Beaker, FlaskConical, Sparkles, Zap } from 'lucide-react';

interface Compound {
  id: string;
  name: string;
  formula: string;
  type: 'catalyst' | 'reagent' | 'product';
  stability: number;
}

interface Reaction {
  id: string;
  formula: string;
  timestamp: string;
  success: boolean;
}

export default function ChemLensPage() {
  useLensNav('chem');

  const queryClient = useQueryClient();
  const [selectedCompound, setSelectedCompound] = useState<string | null>(null);
  const [reactionInput, setReactionInput] = useState('');

  const { data: compounds } = useQuery({
    queryKey: ['chem-compounds'],
    queryFn: () => api.get('/api/chem/compounds').then((r) => r.data),
  });

  const { data: reactions } = useQuery({
    queryKey: ['chem-reactions'],
    queryFn: () => api.get('/api/chem/reactions').then((r) => r.data),
  });

  const runReaction = useMutation({
    mutationFn: (formula: string) => api.post('/api/chem/react', { formula }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chem-compounds'] });
      queryClient.invalidateQueries({ queryKey: ['chem-reactions'] });
      setReactionInput('');
    },
  });

  const typeColors = {
    catalyst: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
    reagent: 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
    product: 'bg-neon-green/20 text-neon-green border-neon-green/30',
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚗️</span>
          <div>
            <h1 className="text-xl font-bold">Chem Lens</h1>
            <p className="text-sm text-gray-400">
              Chemical reaction simulation and compound synthesis
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reaction Chamber */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-neon-purple" />
            Reaction Chamber
          </h3>

          <div className="graph-container flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/5 to-neon-blue/5" />
            <div className="text-center">
              <Beaker className="w-24 h-24 mx-auto text-neon-cyan animate-pulse" />
              <p className="text-gray-400 mt-4">
                Enter a reaction formula to simulate
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={reactionInput}
              onChange={(e) => setReactionInput(e.target.value)}
              placeholder="e.g., H2 + O2 → H2O"
              className="input-lattice flex-1 font-mono"
            />
            <button
              onClick={() => runReaction.mutate(reactionInput)}
              disabled={!reactionInput || runReaction.isPending}
              className="btn-neon purple"
            >
              <Zap className="w-4 h-4 mr-2 inline" />
              {runReaction.isPending ? 'Reacting...' : 'React'}
            </button>
          </div>
        </div>

        {/* Compound Library */}
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Atom className="w-4 h-4 text-neon-blue" />
            Compound Library
          </h3>

          <div className="space-y-2 max-h-[400px] overflow-auto">
            {compounds?.compounds?.map((compound: Compound) => (
              <button
                key={compound.id}
                onClick={() => setSelectedCompound(compound.id)}
                className={`w-full text-left lens-card ${
                  selectedCompound === compound.id ? 'border-neon-cyan' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{compound.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      typeColors[compound.type]
                    }`}
                  >
                    {compound.type}
                  </span>
                </div>
                <p className="font-mono text-sm text-gray-400">{compound.formula}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Stability:</span>
                  <div className="flex-1 h-1 bg-lattice-deep rounded">
                    <div
                      className={`h-full rounded ${
                        compound.stability > 0.7
                          ? 'bg-neon-green'
                          : compound.stability > 0.4
                          ? 'bg-neon-blue'
                          : 'bg-neon-pink'
                      }`}
                      style={{ width: `${compound.stability * 100}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Reactions */}
      <div className="panel p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-neon-green" />
          Recent Reactions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reactions?.reactions?.length === 0 ? (
            <p className="col-span-full text-center py-8 text-gray-500">
              No reactions yet. Try the reaction chamber!
            </p>
          ) : (
            reactions?.reactions?.slice(0, 6).map((reaction: Reaction) => (
              <div key={reaction.id} className="lens-card">
                <p className="font-mono text-sm mb-2">{reaction.formula}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    {new Date(reaction.timestamp).toLocaleString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded ${
                      reaction.success
                        ? 'bg-neon-green/20 text-neon-green'
                        : 'bg-neon-pink/20 text-neon-pink'
                    }`}
                  >
                    {reaction.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
