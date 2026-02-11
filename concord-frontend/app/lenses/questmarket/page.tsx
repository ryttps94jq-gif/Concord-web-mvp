'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Target, Trophy, Coins, Clock, Users } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface Quest {
  id: string;
  title: string;
  description: string;
  reward: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  deadline?: string;
  claimants: number;
  status: 'open' | 'in_progress' | 'completed';
}

export default function QuestmarketLensPage() {
  useLensNav('questmarket');

  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');

  const { data: quests, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['quests', filter],
    queryFn: () =>
      api.get('/api/quests', { params: { status: filter } }).then((r) => r.data),
  });

  const { data: myQuests, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['my-quests'],
    queryFn: () => api.get('/api/quests/mine').then((r) => r.data),
  });

  const claimQuest = useMutation({
    mutationFn: (questId: string) => api.post(`/api/quests/${questId}/claim`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quests'] });
      queryClient.invalidateQueries({ queryKey: ['my-quests'] });
    },
  });

  const difficultyColors = {
    easy: 'bg-neon-green/20 text-neon-green border-neon-green/30',
    medium: 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
    hard: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
    legendary: 'bg-neon-pink/20 text-neon-pink border-neon-pink/30 animate-pulse',
  };


  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <h1 className="text-xl font-bold">Questmarket Lens</h1>
            <p className="text-sm text-gray-400">
              Bounty board for DTU tasks and challenges
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-neon-green" />
          <span className="font-bold">{myQuests?.completed || 0}</span>
          <span className="text-gray-400 text-sm">completed</span>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'open', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              filter === status
                ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                : 'bg-lattice-surface text-gray-400 hover:text-white'
            }`}
          >
            {status.replace('_', ' ').charAt(0).toUpperCase() +
              status.replace('_', ' ').slice(1)}
          </button>
        ))}
      </div>

      {/* Quest Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quests?.quests?.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-500">
            No quests available. Check back later!
          </p>
        ) : (
          quests?.quests?.map((quest: Quest) => (
            <div
              key={quest.id}
              className="lens-card hover:glow-purple relative overflow-hidden"
            >
              {/* Difficulty Badge */}
              <div className="absolute top-2 right-2">
                <span
                  className={`text-xs px-2 py-1 rounded border ${
                    difficultyColors[quest.difficulty]
                  }`}
                >
                  {quest.difficulty}
                </span>
              </div>

              <Target className="w-8 h-8 text-neon-purple mb-3" />
              <h3 className="font-semibold mb-2 pr-16">{quest.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                {quest.description}
              </p>

              {/* Quest Meta */}
              <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {quest.claimants} claimants
                </span>
                {quest.deadline && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(quest.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Reward and Action */}
              <div className="flex items-center justify-between pt-3 border-t border-lattice-border">
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4 text-neon-green" />
                  <span className="font-bold text-neon-green">{quest.reward}</span>
                  <span className="text-xs text-gray-400">DTU</span>
                </div>
                {quest.status === 'open' && (
                  <button
                    onClick={() => claimQuest.mutate(quest.id)}
                    disabled={claimQuest.isPending}
                    className="btn-neon text-sm py-1"
                  >
                    Claim Quest
                  </button>
                )}
                {quest.status === 'in_progress' && (
                  <span className="text-xs text-neon-blue">In Progress</span>
                )}
                {quest.status === 'completed' && (
                  <span className="text-xs text-neon-green flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    Completed
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
