'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  Lightbulb, Plus, Search, Database, ArrowRight, Brain
} from 'lucide-react';

export default function CommonsenseLensPage() {
  useLensNav('commonsense');

  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [relation, setRelation] = useState('is_a');
  const [object, setObject] = useState('');
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<any>(null);

  const { data: factsData } = useQuery({
    queryKey: ['commonsense-facts'],
    queryFn: () => apiHelpers.commonsense.facts().then((r) => r.data),
  });

  const { data: status } = useQuery({
    queryKey: ['commonsense-status'],
    queryFn: () => apiHelpers.commonsense.status().then((r) => r.data),
  });

  const addFact = useMutation({
    mutationFn: () => apiHelpers.commonsense.addFact({ subject, relation, object }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commonsense-facts'] });
      setSubject('');
      setObject('');
    },
  });

  const queryFacts = useMutation({
    mutationFn: () => apiHelpers.commonsense.query({ query: queryText }),
    onSuccess: (res) => setResults(res.data),
  });

  const facts = factsData?.facts || factsData || [];
  const statusInfo = status?.status || status || {};

  const relations = ['is_a', 'has_property', 'part_of', 'used_for', 'causes', 'capable_of', 'located_at'];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">💡</span>
        <div>
          <h1 className="text-xl font-bold">Commonsense Lens</h1>
          <p className="text-sm text-gray-400">
            Commonsense knowledge base — facts, relations, and everyday reasoning
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="lens-card">
          <Database className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{Array.isArray(facts) ? facts.length : 0}</p>
          <p className="text-sm text-gray-400">Facts</p>
        </div>
        <div className="lens-card">
          <Lightbulb className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">{statusInfo.relations || 0}</p>
          <p className="text-sm text-gray-400">Relations</p>
        </div>
        <div className="lens-card">
          <Brain className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{statusInfo.inferences || 0}</p>
          <p className="text-sm text-gray-400">Inferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Add Fact */}
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-neon-purple" /> Add Fact
            </h2>
            <input
              type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (e.g., 'dog')" className="input-lattice w-full"
            />
            <select value={relation} onChange={(e) => setRelation(e.target.value)} className="input-lattice w-full">
              {relations.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              type="text" value={object} onChange={(e) => setObject(e.target.value)}
              placeholder="Object (e.g., 'animal')" className="input-lattice w-full"
            />
            <button
              onClick={() => addFact.mutate()}
              disabled={!subject || !object || addFact.isPending}
              className="btn-neon purple w-full"
            >
              {addFact.isPending ? 'Adding...' : 'Add Fact'}
            </button>
          </div>

          {/* Query */}
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Search className="w-4 h-4 text-neon-cyan" /> Query
            </h2>
            <input
              type="text" value={queryText} onChange={(e) => setQueryText(e.target.value)}
              placeholder="Ask a commonsense question..." className="input-lattice w-full"
            />
            <button
              onClick={() => queryFacts.mutate()}
              disabled={!queryText || queryFacts.isPending}
              className="btn-neon w-full"
            >
              {queryFacts.isPending ? 'Querying...' : 'Query'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {results && (
            <div className="panel p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-neon-green" /> Results
              </h2>
              <pre className="bg-lattice-surface p-3 rounded-lg whitespace-pre-wrap text-xs text-gray-300 font-mono max-h-48 overflow-y-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}

          <div className="panel p-4">
            <h2 className="font-semibold mb-3">Recent Facts</h2>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {Array.isArray(facts) && facts.slice(-20).reverse().map((f: any, i: number) => (
                <div key={i} className="lens-card text-xs">
                  <span className="text-neon-cyan">{f.subject}</span>
                  <span className="text-gray-400 mx-1">{f.relation}</span>
                  <span className="text-neon-purple">{f.object}</span>
                </div>
              ))}
              {(!Array.isArray(facts) || facts.length === 0) && (
                <p className="text-center py-4 text-gray-500 text-sm">No facts yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
