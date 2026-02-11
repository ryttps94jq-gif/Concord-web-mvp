'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { Scale, Users, MessageSquare, Sparkles } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface Persona {
  id: string;
  name: string;
  style: string;
}

interface DTU {
  id: string;
  content: string;
  meta?: { title?: string };
  tags?: string[];
}

export default function CouncilLensPage() {
  useLensNav('council');
  const queryClient = useQueryClient();

  const [selectedDtuA, setSelectedDtuA] = useState<string>('');
  const [selectedDtuB, setSelectedDtuB] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [debateResult, setDebateResult] = useState<Record<string, unknown> | null>(null);

  // Fetch personas from backend: GET /api/personas
  const { data: personasData, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['personas'],
    queryFn: () => api.get('/api/personas').then((r) => r.data),
  });

  // Fetch DTUs for selection: GET /api/dtus
  const { data: dtusData, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['dtus'],
    queryFn: () => api.get('/api/dtus').then((r) => r.data),
  });

  // Council debate mutation: POST /api/council/debate
  const debateMutation = useMutation({
    mutationFn: async (params: { dtuA: string; dtuB: string; topic: string }) => {
      const dtuA = dtusData?.dtus?.find((d: DTU) => d.id === params.dtuA);
      const dtuB = dtusData?.dtus?.find((d: DTU) => d.id === params.dtuB);
      const res = await api.post('/api/council/debate', {
        dtuA: dtuA ? { id: dtuA.id, content: dtuA.content } : params.dtuA,
        dtuB: dtuB ? { id: dtuB.id, content: dtuB.content } : params.dtuB,
        topic: params.topic,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setDebateResult(data);
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
    },
  });

  // Lens artifact persistence layer
  const { isError: isError, error: error, refetch: refetch, items: _proposalArtifacts, create: _createProposal } = useLensData('council', 'proposal', { noSeed: true });

  const personas: Persona[] = personasData?.personas || [];
  const dtus: DTU[] = dtusData?.dtus?.slice(0, 50) || [];

  const handleStartDebate = () => {
    if (!selectedDtuA || !selectedDtuB) return;
    debateMutation.mutate({
      dtuA: selectedDtuA,
      dtuB: selectedDtuB,
      topic: topic || 'Synthesize these two perspectives',
    });
  };


  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🏛️</span>
        <div>
          <h1 className="text-xl font-bold">Council Lens</h1>
          <p className="text-sm text-gray-400">
            Debate DTUs with persona council to synthesize new knowledge
          </p>
        </div>
      </header>

      {/* Personas Panel */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-neon-purple" />
          Council Personas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {personas.map((persona) => (
            <div key={persona.id} className="lens-card">
              <p className="font-medium">{persona.name}</p>
              <p className="text-xs text-gray-400 mt-1">{persona.style}</p>
            </div>
          ))}
          {personas.length === 0 && (
            <p className="col-span-4 text-center text-gray-500 py-4">
              Loading personas...
            </p>
          )}
        </div>
      </div>

      {/* Debate Setup */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-neon-blue" />
          Start Council Debate
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">DTU A</label>
              <select
                value={selectedDtuA}
                onChange={(e) => setSelectedDtuA(e.target.value)}
                className="input-lattice w-full"
              >
                <option value="">Select first DTU...</option>
                {dtus.map((dtu) => (
                  <option key={dtu.id} value={dtu.id}>
                    {dtu.meta?.title || dtu.content?.slice(0, 50) || dtu.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">DTU B</label>
              <select
                value={selectedDtuB}
                onChange={(e) => setSelectedDtuB(e.target.value)}
                className="input-lattice w-full"
              >
                <option value="">Select second DTU...</option>
                {dtus.map((dtu) => (
                  <option key={dtu.id} value={dtu.id}>
                    {dtu.meta?.title || dtu.content?.slice(0, 50) || dtu.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Debate Topic (optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Reconcile these perspectives on..."
              className="input-lattice w-full"
            />
          </div>

          <button
            onClick={handleStartDebate}
            disabled={!selectedDtuA || !selectedDtuB || debateMutation.isPending}
            className="btn-neon purple w-full"
          >
            {debateMutation.isPending ? (
              'Council is debating...'
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2 inline" />
                Start Council Debate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Debate Results */}
      {debateResult && (
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-neon-green" />
            Debate Results
          </h2>

          {/* Turns */}
          {Boolean((debateResult.debate as Record<string, unknown> | undefined)?.turns) && (
            <div className="space-y-3 mb-6">
              {((debateResult.debate as Record<string, unknown>).turns as Record<string, unknown>[]).map((turn: Record<string, unknown>, i: number) => (
                <div
                  key={i}
                  className="p-3 bg-lattice-deep rounded-lg border-l-2 border-neon-purple"
                >
                  <p className="font-medium text-neon-purple text-sm">
                    {String(turn.personaName)}
                  </p>
                  <p className="text-sm mt-1 text-gray-300">{String(turn.text)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Synthesis */}
          {Boolean((debateResult.debate as Record<string, unknown> | undefined)?.synthesis) && (
            <div className="p-4 bg-neon-green/10 rounded-lg border border-neon-green/30">
              <h3 className="font-semibold text-neon-green mb-2">Synthesis</h3>
              <p className="text-sm whitespace-pre-wrap">
                {String((debateResult.debate as Record<string, unknown>).synthesis)}
              </p>
            </div>
          )}

          {/* Synthesis DTU Created */}
          {Boolean(debateResult.synthesisDTU) && (
            <div className="mt-4 p-3 bg-lattice-surface rounded-lg">
              <p className="text-xs text-gray-400">New DTU Created:</p>
              <p className="font-mono text-xs text-neon-cyan truncate">
                {String((debateResult.synthesisDTU as Record<string, unknown>).id)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent DTUs for quick reference */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4">Recent DTUs</h2>
        <div className="space-y-2 max-h-60 overflow-auto">
          {dtus.slice(0, 10).map((dtu) => (
            <div
              key={dtu.id}
              className="p-3 bg-lattice-deep rounded-lg text-sm"
            >
              <p className="font-medium truncate">
                {dtu.meta?.title || 'Untitled DTU'}
              </p>
              <p className="text-xs text-gray-400 truncate mt-1">
                {dtu.content?.slice(0, 100)}
              </p>
              <div className="flex gap-1 mt-2">
                {dtu.tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-lattice-surface rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
