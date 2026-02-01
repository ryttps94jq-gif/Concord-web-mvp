'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { MessageSquare, GitBranch } from 'lucide-react';

export default function ThreadLensPage() {
  useLensNav('thread');

  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get('/api/state/latest').then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧵</span>
        <div>
          <h1 className="text-xl font-bold">Thread Lens</h1>
          <p className="text-sm text-gray-400">
            Branching conversation threads with lineage tracking
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread Tree */}
        <div className="lg:col-span-2 panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-neon-purple" />
            Thread Tree
          </h2>
          <div className="min-h-[400px] flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-neon-purple/30" />
              <p>Start a conversation in Chat Lens to create threads</p>
            </div>
          </div>
        </div>

        {/* Thread Info */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4">Active Threads</h2>
          <div className="space-y-2">
            <p className="text-gray-500 text-sm">
              Session: {sessions?.sessionId || 'default'}
            </p>
            <p className="text-gray-500 text-sm">
              Messages: {sessions?.lastMessages?.length || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
