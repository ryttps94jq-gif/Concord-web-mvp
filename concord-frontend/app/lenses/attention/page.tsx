'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import {
  Eye, Plus, Play, CheckCircle2,
  Layers, Clock, Zap, BarChart3
} from 'lucide-react';

interface Thread {
  id: string;
  type: string;
  priority: number;
  status: string;
  description: string;
  createdAt: string;
}

export default function AttentionLensPage() {
  useLensNav('attention');

  const queryClient = useQueryClient();
  const [newType, setNewType] = useState('reasoning');
  const [newPriority, setNewPriority] = useState('0.5');
  const [newDesc, setNewDesc] = useState('');

  const { data: status } = useQuery({
    queryKey: ['attention-status'],
    queryFn: () => apiHelpers.attention.status().then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: threads } = useQuery({
    queryKey: ['attention-threads'],
    queryFn: () => apiHelpers.attention.threads().then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: queue } = useQuery({
    queryKey: ['attention-queue'],
    queryFn: () => apiHelpers.attention.queue().then((r) => r.data),
  });

  const createThread = useMutation({
    mutationFn: () => apiHelpers.attention.createThread({
      type: newType,
      priority: parseFloat(newPriority),
      description: newDesc,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attention-threads'] });
      queryClient.invalidateQueries({ queryKey: ['attention-status'] });
      setNewDesc('');
    },
  });

  const completeThread = useMutation({
    mutationFn: (threadId: string) => apiHelpers.attention.completeThread({ threadId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attention-threads'] });
      queryClient.invalidateQueries({ queryKey: ['attention-status'] });
    },
  });

  const threadList: Thread[] = threads?.threads || [];
  const activeThreads = status?.activeThreads || [];
  const stats = status?.stats || {};
  const queueData = queue?.queue || [];
  const completedData = queue?.completed || [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">👁️</span>
        <div>
          <h1 className="text-xl font-bold">Attention & Cognition Lens</h1>
          <p className="text-sm text-gray-400">
            Parallel reasoning threads, focus management, and cognitive scheduling
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Eye className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{status?.focus ? 'Focused' : 'Idle'}</p>
          <p className="text-sm text-gray-400">Focus State</p>
        </div>
        <div className="lens-card">
          <Play className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{activeThreads.length}</p>
          <p className="text-sm text-gray-400">Active Threads</p>
        </div>
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">{status?.queueLength || 0}</p>
          <p className="text-sm text-gray-400">Queued</p>
        </div>
        <div className="lens-card">
          <BarChart3 className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{stats.threadsCompleted || 0}</p>
          <p className="text-sm text-gray-400">Completed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Thread */}
        <div className="panel p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-neon-purple" /> New Cognitive Thread
          </h2>
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="input-lattice w-full">
            <option value="reasoning">Reasoning</option>
            <option value="analysis">Analysis</option>
            <option value="creative">Creative</option>
            <option value="memory-search">Memory Search</option>
            <option value="planning">Planning</option>
          </select>
          <input type="number" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
            min="0" max="1" step="0.1" placeholder="Priority (0-1)" className="input-lattice w-full" />
          <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Thread description..." className="input-lattice w-full" />
          <button onClick={() => createThread.mutate()} disabled={!newDesc || createThread.isPending}
            className="btn-neon purple w-full">
            {createThread.isPending ? 'Creating...' : 'Create Thread'}
          </button>

          <div className="border-t border-lattice-border pt-3 mt-3 space-y-2 text-sm">
            <p className="text-gray-400">Stats</p>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total created</span>
              <span className="text-gray-300">{stats.threadsCreated || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Interruptions</span>
              <span className="text-yellow-400">{stats.interruptions || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Background tasks</span>
              <span className="text-gray-300">{status?.backgroundTasks || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Avg focus duration</span>
              <span className="text-gray-300">{stats.avgFocusDurationMs ? `${(stats.avgFocusDurationMs / 1000).toFixed(1)}s` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Active Threads */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-neon-cyan" /> All Threads
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {threadList.map((t) => (
              <div key={t.id} className="lens-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      t.status === 'active' ? 'bg-neon-green animate-pulse' :
                      t.status === 'pending' ? 'bg-yellow-400' :
                      t.status === 'interrupted' ? 'bg-red-400' : 'bg-gray-500'
                    }`} />
                    <span className="font-medium text-sm">{t.type}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-lattice-surface text-gray-400">
                    P:{t.priority.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">{t.description}</p>
                {t.status === 'active' && (
                  <button onClick={() => completeThread.mutate(t.id)}
                    className="mt-2 text-xs text-neon-green flex items-center gap-1 hover:underline">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </button>
                )}
              </div>
            ))}
            {threadList.length === 0 && (
              <p className="text-center py-4 text-gray-500 text-sm">No active threads</p>
            )}
          </div>
        </div>

        {/* Queue + Completed */}
        <div className="panel p-4 space-y-4">
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-neon-yellow" /> Queue
            </h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {queueData.length > 0 ? queueData.map((q: any, i: number) => (
                <div key={i} className="flex justify-between text-xs text-gray-400">
                  <span>{q.threadId?.slice(0, 12)}</span>
                  <span>P:{q.priority?.toFixed(1)}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-500">Queue empty</p>
              )}
            </div>
          </div>

          <div className="border-t border-lattice-border pt-3">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-green" /> Recently Completed
            </h2>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {completedData.length > 0 ? completedData.map((c: any, i: number) => (
                <div key={i} className="lens-card text-xs">
                  <span className="text-gray-300">{c.type}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-500">None yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
