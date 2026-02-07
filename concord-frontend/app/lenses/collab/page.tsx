'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Users, Plus, GitMerge, Clock } from 'lucide-react';

export default function CollabLensPage() {
  useLensNav('collab');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['collab-sessions'],
    queryFn: () => api.get('/api/collab/sessions').then(r => r.data),
    refetchInterval: 5000,
  });

  const { data: dtus } = useQuery({
    queryKey: ['dtus-list'],
    queryFn: () => api.get('/api/dtus?limit=100').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { dtuId: string; mode: string }) =>
      api.post('/api/collab/session', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-sessions'] });
      setShowCreate(false);
    },
  });

  const joinMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api.post('/api/collab/join', { sessionId, userId: 'current-user' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collab-sessions'] }),
  });

  const mergeMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api.post('/api/collab/merge', { sessionId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collab-sessions'] }),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-neon-blue" />
          <div>
            <h1 className="text-xl font-bold">Real-Time Collaboration</h1>
            <p className="text-sm text-gray-400">
              Collaborate on DTUs with council-gated merges
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Session
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="lens-card">
          <p className="text-sm text-gray-400">Active Sessions</p>
          <p className="text-2xl font-bold text-neon-blue">{sessions?.count || 0}</p>
        </div>
        <div className="lens-card">
          <p className="text-sm text-gray-400">Total Participants</p>
          <p className="text-2xl font-bold text-neon-purple">
            {sessions?.sessions?.reduce((acc: number, s: Record<string, unknown>) => acc + (s.participantCount as number), 0) || 0}
          </p>
        </div>
        <div className="lens-card">
          <p className="text-sm text-gray-400">Pending Changes</p>
          <p className="text-2xl font-bold text-neon-cyan">
            {sessions?.sessions?.reduce((acc: number, s: Record<string, unknown>) => acc + (s.changeCount as number), 0) || 0}
          </p>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Active Sessions</h2>
        {isLoading ? (
          <div className="text-gray-400">Loading sessions...</div>
        ) : sessions?.sessions?.length === 0 ? (
          <div className="panel p-8 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No active collaboration sessions</p>
            <p className="text-sm">Create a new session to start collaborating</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions?.sessions?.map((session: Record<string, unknown>) => (
              <SessionCard
                key={session.id as string}
                session={session}
                onJoin={() => joinMutation.mutate(session.id as string)}
                onMerge={() => mergeMutation.mutate(session.id as string)}
                joining={joinMutation.isPending}
                merging={mergeMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreate={(data: { dtuId: string; mode: string }) => createMutation.mutate(data)}
          dtus={dtus?.dtus || []}
          creating={createMutation.isPending}
        />
      )}
    </div>
  );
}

function SessionCard({ session, onJoin, onMerge, joining, merging }: {
  session: Record<string, unknown>;
  onJoin: () => void;
  onMerge: () => void;
  joining: boolean;
  merging: boolean;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${(session.mode as string) === 'edit' ? 'bg-green-500' : 'bg-blue-500'}`} />
          <div>
            <h3 className="font-semibold">Session {(session.id as string).slice(-8)}</h3>
            <p className="text-xs text-gray-400">DTU: {(session.dtuId as string).slice(0, 20)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400 flex items-center gap-1">
            <Users className="w-4 h-4" />
            {String(session.participantCount)}
          </div>
          <div className="text-sm text-gray-400 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {String(session.changeCount)} changes
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={onJoin} disabled={joining} className="btn-secondary text-sm flex-1">
          {joining ? 'Joining...' : 'Join Session'}
        </button>
        <button onClick={onMerge} disabled={merging} className="btn-primary text-sm flex-1 flex items-center justify-center gap-1">
          <GitMerge className="w-4 h-4" />
          {merging ? 'Merging...' : 'Request Merge'}
        </button>
      </div>
    </div>
  );
}

function CreateSessionModal({ onClose, onCreate, dtus, creating }: {
  onClose: () => void;
  onCreate: (data: { dtuId: string; mode: string }) => void;
  dtus: Record<string, unknown>[];
  creating: boolean;
}) {
  const [form, setForm] = useState({ dtuId: '', mode: 'edit' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">Create Collaboration Session</h2>
        <select
          value={form.dtuId}
          onChange={(e) => setForm({ ...form, dtuId: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        >
          <option value="">Select DTU to collaborate on</option>
          {dtus.slice(0, 50).map((dtu: Record<string, unknown>) => (
            <option key={dtu.id as string} value={dtu.id as string}>{String(dtu.title)}</option>
          ))}
        </select>
        <select
          value={form.mode}
          onChange={(e) => setForm({ ...form, mode: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        >
          <option value="view">View Only</option>
          <option value="comment">Comment</option>
          <option value="edit">Edit</option>
        </select>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onCreate(form)}
            disabled={creating || !form.dtuId}
            className="btn-primary"
          >
            {creating ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
