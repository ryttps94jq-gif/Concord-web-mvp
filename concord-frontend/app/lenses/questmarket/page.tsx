'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { Target, Trophy, Coins, Clock, Users } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';

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

  const { items: questItems, isLoading, isError: isError, error: error, refetch: refetch } = useLensData<Record<string, unknown>>('questmarket', 'quest', { seed: [], status: filter !== 'all' ? filter : undefined });
  const quests = questItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as Quest[];

  const { items: myQuestItems, isError: isError2, error: error2, refetch: refetch2 } = useLensData<Record<string, unknown>>('questmarket', 'my-quest', { seed: [] });
  const myQuests = myQuestItems.map(i => ({ id: i.id, title: i.title, ...(i.data || {}) })) as unknown as Record<string, unknown>[];

  const { update: updateQuest } = useLensData<Record<string, unknown>>('questmarket', 'quest', { noSeed: true });
  const claimQuest = useMutation({
    mutationFn: (questId: string) => updateQuest(questId, { data: { status: 'claimed', claimedAt: new Date().toISOString() } }),
    onSuccess: () => {
      refetch();
      refetch2();
    },
    onError: (err) => console.error('claimQuest failed:', err instanceof Error ? err.message : err),
  });

  const difficultyColors = {
    easy: 'bg-neon-green/20 text-neon-green border-neon-green/30',
    medium: 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
    hard: 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
    legendary: 'bg-neon-pink/20 text-neon-pink border-neon-pink/30 animate-pulse',
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

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
          <span className="font-bold">{myQuests?.filter((q: Record<string, unknown>) => q.status === 'completed').length || 0}</span>
          <span className="text-gray-400 text-sm">completed</span>
        </div>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="questmarket" artifactId={questItems[0]?.id} compact />
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
        {quests?.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-500">
            No quests available. Check back later!
          </p>
        ) : (
          quests?.map((quest: Quest) => (
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
