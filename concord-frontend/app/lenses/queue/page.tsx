'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Inbox, Play, Trash2, Clock, Zap, Globe, FileText } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface QueueItem {
  id: string;
  type: string;
  content: string;
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
  status: 'pending' | 'processing' | 'completed';
}

export default function QueueLensPage() {
  useLensNav('queue');
  const queryClient = useQueryClient();
  const [selectedQueue, setSelectedQueue] = useState<'ingest' | 'autocrawl' | 'terminal'>('ingest');

  // Backend: GET /api/status for queue counts
  const { data: status, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
    refetchInterval: 5000,
  });

  // Backend: GET /api/jobs/status
  const { data: jobs, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['jobs-status'],
    queryFn: () => api.get('/api/jobs/status').then((r) => r.data),
  });

  // Mock queue items (would come from actual queue endpoints)
  const queueItems: Record<string, QueueItem[]> = {
    ingest: [
      { id: '1', type: 'text', content: 'Research paper on quantum computing', priority: 'high', createdAt: new Date().toISOString(), status: 'pending' },
      { id: '2', type: 'text', content: 'Meeting notes from council session', priority: 'normal', createdAt: new Date().toISOString(), status: 'pending' },
    ],
    autocrawl: [
      { id: '3', type: 'url', content: 'https://arxiv.org/abs/2401.00001', priority: 'high', createdAt: new Date().toISOString(), status: 'processing' },
    ],
    terminal: [
      { id: '4', type: 'command', content: 'entity_fork --workspace main', priority: 'normal', createdAt: new Date().toISOString(), status: 'pending' },
      { id: '5', type: 'proposal', content: 'Upgrade resonance core to v2', priority: 'high', createdAt: new Date().toISOString(), status: 'pending' },
    ],
  };

  const processItem = useMutation({
    mutationFn: async (_itemId: string) => {
      // Would call backend to process queue item
      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });

  const queues = [
    { key: 'ingest', label: 'Ingest Queue', icon: <FileText className="w-4 h-4" />, count: status?.queues?.ingest || 0 },
    { key: 'autocrawl', label: 'Autocrawl Queue', icon: <Globe className="w-4 h-4" />, count: status?.queues?.autocrawl || 0 },
    { key: 'terminal', label: 'Terminal Queue', icon: <Zap className="w-4 h-4" />, count: queueItems.terminal.length },
  ];


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
        <span className="text-2xl">📥</span>
        <div>
          <h1 className="text-xl font-bold">Queue Lens</h1>
          <p className="text-sm text-gray-400">
            Manage all system queues: ingest, crawl, terminal proposals
          </p>
        </div>
      </header>

      {/* Queue Tabs */}
      <div className="flex gap-2">
        {queues.map((q) => (
          <button
            key={q.key}
            onClick={() => setSelectedQueue(q.key as 'ingest' | 'autocrawl' | 'terminal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              selectedQueue === q.key
                ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                : 'bg-lattice-surface text-gray-400 hover:text-white'
            }`}
          >
            {q.icon}
            <span>{q.label}</span>
            <span className="ml-2 px-2 py-0.5 bg-lattice-elevated rounded text-xs">
              {q.count}
            </span>
          </button>
        ))}
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Inbox className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">
            {(status?.queues?.ingest || 0) + (status?.queues?.autocrawl || 0)}
          </p>
          <p className="text-sm text-gray-400">Total Queued</p>
        </div>
        <div className="lens-card">
          <Play className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">
            {Object.values(jobs?.jobs || {}).filter((j: unknown) => (j as Record<string, unknown>)?.enabled).length}
          </p>
          <p className="text-sm text-gray-400">Active Jobs</p>
        </div>
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">2m</p>
          <p className="text-sm text-gray-400">Heartbeat Interval</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{status?.llm?.enabled ? 'On' : 'Off'}</p>
          <p className="text-sm text-gray-400">LLM Processing</p>
        </div>
      </div>

      {/* Queue Items */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-neon-blue" />
          {queues.find((q) => q.key === selectedQueue)?.label} Items
        </h2>
        <div className="space-y-3">
          {queueItems[selectedQueue]?.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No items in queue. System is idle.
            </p>
          ) : (
            queueItems[selectedQueue]?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-lattice-deep rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.status === 'processing'
                        ? 'bg-neon-blue animate-pulse'
                        : item.status === 'completed'
                        ? 'bg-neon-green'
                        : 'bg-gray-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium">{item.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-lattice-surface rounded">
                        {item.type}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          item.priority === 'high'
                            ? 'bg-neon-pink/20 text-neon-pink'
                            : item.priority === 'low'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-neon-blue/20 text-neon-blue'
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => processItem.mutate(item.id)}
                    className="p-2 bg-neon-green/20 text-neon-green rounded-lg hover:bg-neon-green/30"
                    title="Process Now"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 bg-neon-pink/20 text-neon-pink rounded-lg hover:bg-neon-pink/30"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Job Controls */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4">Governor Jobs</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(jobs?.jobs || {}).map(([name, job]) => {
            const j = job as Record<string, unknown>;
            return (
            <div
              key={name}
              className={`lens-card flex items-center justify-between ${
                j?.enabled ? 'border-neon-green/30' : 'border-gray-600'
              }`}
            >
              <span className="capitalize">{name}</span>
              <span
                className={`w-3 h-3 rounded-full ${
                  j?.enabled ? 'bg-neon-green' : 'bg-gray-500'
                }`}
              />
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
