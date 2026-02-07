'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch, Plus, CheckCircle2, ArrowRight, Brain,
  Search, ListTree, Workflow
} from 'lucide-react';

interface Chain {
  id: string;
  premise: string;
  type?: string;
  steps?: unknown[];
  conclusion?: string;
  status?: string;
  createdAt?: string;
}

export default function ReasoningLensPage() {
  useLensNav('reasoning');

  const queryClient = useQueryClient();
  const [newPremise, setNewPremise] = useState('');
  const [chainType, setChainType] = useState('deductive');
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [newStep, setNewStep] = useState('');

  const { data: chainsData, isLoading: _isLoading } = useQuery({
    queryKey: ['reasoning-chains'],
    queryFn: () => apiHelpers.reasoning.list().then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: statusData } = useQuery({
    queryKey: ['reasoning-status'],
    queryFn: () => apiHelpers.reasoning.status().then((r) => r.data),
  });

  const { data: traceData } = useQuery({
    queryKey: ['reasoning-trace', selectedChain],
    queryFn: () => selectedChain ? apiHelpers.reasoning.trace(selectedChain).then((r) => r.data) : null,
    enabled: !!selectedChain,
  });

  const createChain = useMutation({
    mutationFn: () => apiHelpers.reasoning.create({ premise: newPremise, type: chainType }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['reasoning-chains'] });
      setNewPremise('');
      const id = res.data?.chain?.id || res.data?.id;
      if (id) setSelectedChain(id);
    },
  });

  const addStep = useMutation({
    mutationFn: () => {
      if (!selectedChain) return Promise.reject('No chain selected');
      return apiHelpers.reasoning.addStep(selectedChain, { content: newStep });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reasoning-chains'] });
      queryClient.invalidateQueries({ queryKey: ['reasoning-trace', selectedChain] });
      setNewStep('');
    },
  });

  const concludeChain = useMutation({
    mutationFn: () => {
      if (!selectedChain) return Promise.reject('No chain selected');
      return apiHelpers.reasoning.conclude(selectedChain);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reasoning-chains'] });
      queryClient.invalidateQueries({ queryKey: ['reasoning-trace', selectedChain] });
    },
  });

  const chains: Chain[] = chainsData?.chains || chainsData || [];
  const status: Record<string, unknown> = statusData?.status || statusData || {};
  const trace: Record<string, unknown> = traceData?.trace || traceData || {};

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧠</span>
        <div>
          <h1 className="text-xl font-bold">Reasoning Lens</h1>
          <p className="text-sm text-gray-400">
            Reasoning chains — create, extend, validate, and trace logical arguments
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <GitBranch className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{chains.length}</p>
          <p className="text-sm text-gray-400">Chains</p>
        </div>
        <div className="lens-card">
          <ListTree className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{(status.totalSteps as number) || 0}</p>
          <p className="text-sm text-gray-400">Total Steps</p>
        </div>
        <div className="lens-card">
          <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{(status.concluded as number) || 0}</p>
          <p className="text-sm text-gray-400">Concluded</p>
        </div>
        <div className="lens-card">
          <Workflow className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{(status.validated as number) || 0}</p>
          <p className="text-sm text-gray-400">Validated</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chain Creator */}
        <div className="space-y-4">
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-neon-purple" />
              New Reasoning Chain
            </h2>
            <input
              type="text"
              value={newPremise}
              onChange={(e) => setNewPremise(e.target.value)}
              placeholder="Starting premise..."
              className="input-lattice w-full"
            />
            <select
              value={chainType}
              onChange={(e) => setChainType(e.target.value)}
              className="input-lattice w-full"
            >
              <option value="deductive">Deductive</option>
              <option value="inductive">Inductive</option>
              <option value="abductive">Abductive</option>
              <option value="analogical">Analogical</option>
            </select>
            <button
              onClick={() => createChain.mutate()}
              disabled={!newPremise || createChain.isPending}
              className="btn-neon purple w-full"
            >
              {createChain.isPending ? 'Creating...' : 'Create Chain'}
            </button>
          </div>

          {/* Chain List */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-neon-blue" />
              Chains
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`w-full text-left lens-card transition-colors ${
                    selectedChain === chain.id ? 'border-neon-cyan' : ''
                  }`}
                >
                  <p className="text-sm font-medium truncate">{chain.premise}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{chain.type || 'deductive'}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      chain.conclusion ? 'bg-green-400/20 text-green-400' : 'bg-blue-400/20 text-blue-400'
                    }`}>
                      {chain.conclusion ? 'concluded' : 'open'}
                    </span>
                  </div>
                </button>
              ))}
              {chains.length === 0 && (
                <p className="text-center py-4 text-gray-500 text-sm">No chains yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Chain Detail / Trace */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Search className="w-4 h-4 text-neon-green" />
            Chain Trace
          </h2>
          {selectedChain ? (
            <>
              {/* Trace visualization */}
              <div className="space-y-3">
                {(trace?.steps as Record<string, unknown>[] | undefined)?.map?.((step: Record<string, unknown>, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        step.validated ? 'bg-green-400/20 text-green-400' : 'bg-lattice-surface text-gray-400'
                      }`}>
                        {i + 1}
                      </div>
                      {i < ((trace.steps as unknown[] | undefined)?.length || 0) - 1 && (
                        <div className="w-0.5 h-6 bg-lattice-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 lens-card">
                      <p className="text-sm">{step.content as string}</p>
                      {Boolean(step.type) && (
                        <span className="text-xs text-gray-500 mt-1 block">{step.type as string}</span>
                      )}
                    </div>
                  </motion.div>
                )) || (
                  <p className="text-gray-500 text-sm">Loading trace...</p>
                )}

                {Boolean(trace?.conclusion) && (
                  <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/30">
                    <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Conclusion
                    </p>
                    <p className="text-sm mt-1">{trace.conclusion as string}</p>
                  </div>
                )}
              </div>

              {/* Add Step */}
              {!trace?.conclusion && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStep}
                    onChange={(e) => setNewStep(e.target.value)}
                    placeholder="Add reasoning step..."
                    className="input-lattice flex-1"
                  />
                  <button
                    onClick={() => addStep.mutate()}
                    disabled={!newStep || addStep.isPending}
                    className="btn-neon"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => concludeChain.mutate()}
                    disabled={concludeChain.isPending}
                    className="btn-neon purple"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Select or create a chain to view its reasoning trace</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
