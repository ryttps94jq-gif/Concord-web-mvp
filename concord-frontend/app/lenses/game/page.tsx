'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Trophy, Star, Zap, Target, Users } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

export default function GameLensPage() {
  useLensNav('game');

  const _queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'achievements' | 'leaderboard' | 'challenges'>('achievements');

  const { data: profile } = useQuery({
    queryKey: ['game-profile'],
    queryFn: () => api.get('/api/game/profile').then((r) => r.data),
  });

  const { data: achievements } = useQuery({
    queryKey: ['game-achievements'],
    queryFn: () => api.get('/api/game/achievements').then((r) => r.data),
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['game-leaderboard'],
    queryFn: () => api.get('/api/game/leaderboard').then((r) => r.data),
  });

  const { data: challenges } = useQuery({
    queryKey: ['game-challenges'],
    queryFn: () => api.get('/api/game/challenges').then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <div>
            <h1 className="text-xl font-bold">Game Lens</h1>
            <p className="text-sm text-gray-400">
              Gamification layer with achievements and challenges
            </p>
          </div>
        </div>
      </header>

      {/* Player Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card text-center">
          <Star className="w-8 h-8 mx-auto text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{profile?.level || 1}</p>
          <p className="text-sm text-gray-400">Level</p>
        </div>
        <div className="lens-card text-center">
          <Zap className="w-8 h-8 mx-auto text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{profile?.xp?.toLocaleString() || 0}</p>
          <p className="text-sm text-gray-400">XP</p>
        </div>
        <div className="lens-card text-center">
          <Trophy className="w-8 h-8 mx-auto text-neon-green mb-2" />
          <p className="text-2xl font-bold">{profile?.achievements || 0}</p>
          <p className="text-sm text-gray-400">Achievements</p>
        </div>
        <div className="lens-card text-center">
          <Target className="w-8 h-8 mx-auto text-neon-pink mb-2" />
          <p className="text-2xl font-bold">{profile?.streak || 0}</p>
          <p className="text-sm text-gray-400">Day Streak</p>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Progress to Level {(profile?.level || 1) + 1}</span>
          <span className="text-sm font-mono">
            {profile?.xp || 0} / {profile?.nextLevelXp || 1000} XP
          </span>
        </div>
        <div className="h-3 bg-lattice-deep rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink transition-all"
            style={{
              width: `${((profile?.xp || 0) / (profile?.nextLevelXp || 1000)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-lattice-border pb-2">
        {[
          { id: 'achievements', label: 'Achievements', icon: Trophy },
          { id: 'leaderboard', label: 'Leaderboard', icon: Users },
          { id: 'challenges', label: 'Challenges', icon: Target },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-neon-purple/20 text-neon-purple'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'achievements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements?.achievements?.map((achievement: Achievement) => (
            <div
              key={achievement.id}
              className={`lens-card ${
                achievement.unlocked ? 'border-neon-green' : 'opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{achievement.icon}</span>
                <div className="flex-1">
                  <h4 className="font-semibold">{achievement.name}</h4>
                  <p className="text-sm text-gray-400">{achievement.description}</p>
                  {!achievement.unlocked && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span>
                          {achievement.progress} / {achievement.maxProgress}
                        </span>
                      </div>
                      <div className="h-1 bg-lattice-deep rounded">
                        <div
                          className="h-full bg-neon-blue rounded"
                          style={{
                            width: `${(achievement.progress / achievement.maxProgress) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {achievement.unlocked && (
                  <Trophy className="w-5 h-5 text-neon-green flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="panel p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-lattice-border">
                <th className="pb-2 w-16">Rank</th>
                <th className="pb-2">Player</th>
                <th className="pb-2 text-right">Level</th>
                <th className="pb-2 text-right">XP</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard?.players?.map((player: Record<string, unknown>, index: number) => (
                <tr
                  key={player.id as string}
                  className={`border-b border-lattice-border/50 ${
                    player.isCurrentUser ? 'bg-neon-purple/10' : ''
                  }`}
                >
                  <td className="py-3">
                    {index < 3 ? (
                      <span className="text-xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span className="text-gray-400">#{index + 1}</span>
                    )}
                  </td>
                  <td className="py-3 font-medium">{String(player.name)}</td>
                  <td className="py-3 text-right">{String(player.level)}</td>
                  <td className="py-3 text-right font-mono text-neon-blue">
                    {(player.xp as number).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges?.challenges?.map((challenge: Record<string, unknown>) => (
            <div key={challenge.id as string} className="lens-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{String(challenge.icon)}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    (challenge.difficulty as string) === 'easy'
                      ? 'bg-neon-green/20 text-neon-green'
                      : (challenge.difficulty as string) === 'medium'
                      ? 'bg-neon-blue/20 text-neon-blue'
                      : 'bg-neon-pink/20 text-neon-pink'
                  }`}
                >
                  {String(challenge.difficulty)}
                </span>
              </div>
              <h4 className="font-semibold">{String(challenge.name)}</h4>
              <p className="text-sm text-gray-400 mt-1">{String(challenge.description)}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-lattice-border">
                <span className="text-sm text-neon-blue flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  +{String(challenge.xpReward)} XP
                </span>
                <button className="btn-neon text-sm py-1">Start</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
