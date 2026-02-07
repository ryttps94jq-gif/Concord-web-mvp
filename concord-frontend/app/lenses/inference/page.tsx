'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  GitMerge, Plus, ArrowRight, Database, Search, Zap
} from 'lucide-react';

export default function InferenceLensPage() {
  useLensNav('inference');

  const queryClient = useQueryClient();
  const [factInput, setFactInput] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [majorPremise, setMajorPremise] = useState('');
  const [minorPremise, setMinorPremise] = useState('');
  const [results, setResults] = useState<unknown>(null);
  const [tab, setTab] = useState<'facts' | 'query' | 'syllogism' | 'forward'>('facts');

  const { data: status } = useQuery({
    queryKey: ['inference-status'],
    queryFn: () => apiHelpers.inference.status().then((r) => r.data),
    refetchInterval: 15000,
  });

  const addFacts = useMutation({
    mutationFn: () => apiHelpers.inference.facts({ facts: factInput.split('\n').filter(Boolean) }),
    onSuccess: (res) => {
      setResults(res.data);
      queryClient.invalidateQueries({ queryKey: ['inference-status'] });
      setFactInput('');
    },
  });

  const runQuery = useMutation({
    mutationFn: () => apiHelpers.inference.query({ query: queryInput }),
    onSuccess: (res) => setResults(res.data),
  });

  const runSyllogism = useMutation({
    mutationFn: () => apiHelpers.inference.syllogism({ major: majorPremise, minor: minorPremise }),
    onSuccess: (res) => setResults(res.data),
  });

  const runForwardChain = useMutation({
    mutationFn: () => apiHelpers.inference.forwardChain({}),
    onSuccess: (res) => setResults(res.data),
  });

  const statusInfo = status?.status || status || {};

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🔗</span>
        <div>
          <h1 className="text-xl font-bold">Inference Lens</h1>
          <p className="text-sm text-gray-400">
            Logical inference engine — facts, rules, syllogisms, forward chaining
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Database className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{statusInfo.factCount || 0}</p>
          <p className="text-sm text-gray-400">Facts</p>
        </div>
        <div className="lens-card">
          <GitMerge className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{statusInfo.ruleCount || 0}</p>
          <p className="text-sm text-gray-400">Rules</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{statusInfo.inferences || 0}</p>
          <p className="text-sm text-gray-400">Inferences</p>
        </div>
        <div className="lens-card">
          <Search className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{statusInfo.queries || 0}</p>
          <p className="text-sm text-gray-400">Queries</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['facts', 'query', 'syllogism', 'forward'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setResults(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              tab === t
                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                : 'bg-lattice-surface text-gray-400'
            }`}
          >
            {t === 'forward' ? 'Forward Chain' : t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="panel p-4 space-y-4">
          {tab === 'facts' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-neon-purple" /> Add Facts
              </h2>
              <textarea
                value={factInput}
                onChange={(e) => setFactInput(e.target.value)}
                placeholder="Enter facts (one per line)..."
                className="input-lattice w-full h-40 resize-none font-mono text-sm"
              />
              <button
                onClick={() => addFacts.mutate()}
                disabled={!factInput || addFacts.isPending}
                className="btn-neon purple w-full"
              >
                {addFacts.isPending ? 'Adding...' : 'Add Facts'}
              </button>
            </>
          )}

          {tab === 'query' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <Search className="w-4 h-4 text-neon-cyan" /> Query Inference
              </h2>
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter query..."
                className="input-lattice w-full"
              />
              <button
                onClick={() => runQuery.mutate()}
                disabled={!queryInput || runQuery.isPending}
                className="btn-neon purple w-full"
              >
                {runQuery.isPending ? 'Querying...' : 'Run Query'}
              </button>
            </>
          )}

          {tab === 'syllogism' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-neon-purple" /> Syllogism
              </h2>
              <input
                type="text"
                value={majorPremise}
                onChange={(e) => setMajorPremise(e.target.value)}
                placeholder="Major premise: All X are Y"
                className="input-lattice w-full"
              />
              <input
                type="text"
                value={minorPremise}
                onChange={(e) => setMinorPremise(e.target.value)}
                placeholder="Minor premise: Z is X"
                className="input-lattice w-full"
              />
              <button
                onClick={() => runSyllogism.mutate()}
                disabled={!majorPremise || !minorPremise || runSyllogism.isPending}
                className="btn-neon purple w-full"
              >
                {runSyllogism.isPending ? 'Reasoning...' : 'Derive Conclusion'}
              </button>
            </>
          )}

          {tab === 'forward' && (
            <>
              <h2 className="font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-neon-green" /> Forward Chaining
              </h2>
              <p className="text-sm text-gray-400">
                Apply all known rules to derive new facts from the existing knowledge base.
              </p>
              <button
                onClick={() => runForwardChain.mutate()}
                disabled={runForwardChain.isPending}
                className="btn-neon purple w-full"
              >
                {runForwardChain.isPending ? 'Chaining...' : 'Run Forward Chain'}
              </button>
            </>
          )}
        </div>

        {/* Results Panel */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-neon-green" /> Results
          </h2>
          {results ? (
            <div className="bg-lattice-surface p-3 rounded-lg">
              <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono max-h-96 overflow-y-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-center py-12 text-gray-500">
              Run a query or operation to see results
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
