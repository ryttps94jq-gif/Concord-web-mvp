'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  Shuffle, Search, ArrowRight, History, Layers, GitCompare
} from 'lucide-react';

export default function TransferLensPage() {
  useLensNav('transfer');

  const [sourceText, setSourceText] = useState('');
  const [targetDomain, setTargetDomain] = useState('');
  const [classifyText, setClassifyText] = useState('');
  const [results, setResults] = useState<unknown>(null);

  const { data: history } = useQuery({
    queryKey: ['transfer-history'],
    queryFn: () => apiHelpers.transfer.history().then((r) => r.data),
  });

  const findAnalogies = useMutation({
    mutationFn: () => apiHelpers.transfer.analogies({ source: sourceText, target: targetDomain || undefined }),
    onSuccess: (res) => setResults(res.data),
  });

  const classifyDomain = useMutation({
    mutationFn: () => apiHelpers.transfer.classifyDomain({ content: classifyText }),
    onSuccess: (res) => setResults(res.data),
  });

  const transfers = history?.transfers || history || [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🔄</span>
        <div>
          <h1 className="text-xl font-bold">Transfer Lens</h1>
          <p className="text-sm text-gray-400">
            Transfer learning — find analogies, classify domains, apply patterns across contexts
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="lens-card">
          <Shuffle className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{transfers.length}</p>
          <p className="text-sm text-gray-400">Transfers</p>
        </div>
        <div className="lens-card">
          <GitCompare className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-sm text-gray-400">Analogies Found</p>
        </div>
        <div className="lens-card">
          <Layers className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-sm text-gray-400">Domains</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Find Analogies */}
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Search className="w-4 h-4 text-neon-cyan" /> Find Analogies
            </h2>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Source concept or knowledge..."
              className="input-lattice w-full h-24 resize-none"
            />
            <input
              type="text"
              value={targetDomain}
              onChange={(e) => setTargetDomain(e.target.value)}
              placeholder="Target domain (optional)..."
              className="input-lattice w-full"
            />
            <button
              onClick={() => findAnalogies.mutate()}
              disabled={!sourceText || findAnalogies.isPending}
              className="btn-neon purple w-full"
            >
              {findAnalogies.isPending ? 'Searching...' : 'Find Analogies'}
            </button>
          </div>

          {/* Classify Domain */}
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-neon-green" /> Classify Domain
            </h2>
            <input
              type="text"
              value={classifyText}
              onChange={(e) => setClassifyText(e.target.value)}
              placeholder="Content to classify..."
              className="input-lattice w-full"
            />
            <button
              onClick={() => classifyDomain.mutate()}
              disabled={!classifyText || classifyDomain.isPending}
              className="btn-neon w-full"
            >
              {classifyDomain.isPending ? 'Classifying...' : 'Classify'}
            </button>
          </div>
        </div>

        {/* Results + History */}
        <div className="space-y-4">
          <div className="panel p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-neon-purple" /> Results
            </h2>
            {results ? (
              <pre className="bg-lattice-surface p-3 rounded-lg whitespace-pre-wrap text-xs text-gray-300 font-mono max-h-64 overflow-y-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            ) : (
              <p className="text-center py-8 text-gray-500 text-sm">Run an operation to see results</p>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-neon-blue" /> Transfer History
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transfers.length > 0 ? transfers.map((t: Record<string, unknown>, i: number) => (
                <div key={i} className="lens-card text-xs">
                  <p className="font-medium">{t.source || t.pattern}</p>
                  <p className="text-gray-400">{t.target || t.domain}</p>
                </div>
              )) : (
                <p className="text-center py-4 text-gray-500 text-sm">No transfers yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
