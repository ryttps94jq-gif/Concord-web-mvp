'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Zap, Target, Users, Swords, Crown,
  Flame, TrendingUp, ShoppingBag, Lock, Unlock,
  ChevronRight, ChevronDown, Plus, X, Check, Clock,
  BarChart3, Sparkles, Gem, Music, Headphones,
  GitBranch, BookOpen, Cpu,
  Activity, ArrowUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MainTab = 'dashboard' | 'skills' | 'quests' | 'achievements' | 'leaderboard' | 'shop' | 'history';
type LeaderboardPeriod = 'weekly' | 'monthly' | 'alltime';
type QuestStatus = 'available' | 'accepted' | 'completed';
type SkillBranch = 'production' | 'theory' | 'engineering' | 'performance';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  xpReward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface Quest {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'daily' | 'weekly' | 'challenge';
  status: QuestStatus;
  timeLeft?: string;
}

interface LeaderboardPlayer {
  id: string;
  name: string;
  title: string;
  level: number;
  xp: number;
  achievements: number;
  isCurrentUser?: boolean;
}

interface SkillNode {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  xpCost: number;
  unlocked: boolean;
  requires?: string;
}

interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'badge' | 'title' | 'theme' | 'emote';
  cost: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  owned: boolean;
}

interface XpHistoryEntry {
  day: string;
  xp: number;
  label: string;
}

interface GameProfile {
  name: string;
  title: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  totalXpEarned: number;
  achievements: number;
  totalAchievements: number;
  streak: number;
  longestStreak: number;
  questsCompleted: number;
  challengesWon: number;
  joinDate: string;
  rank: number;
  completionRate: number;
  xpHistory: XpHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Initial state — empty; all data comes from the backend API
// ---------------------------------------------------------------------------

const INITIAL_PROFILE = {
  name: '',
  title: '',
  level: 1,
  xp: 0,
  nextLevelXp: 1000,
  totalXpEarned: 0,
  achievements: 0,
  totalAchievements: 0,
  streak: 0,
  longestStreak: 0,
  questsCompleted: 0,
  challengesWon: 0,
  joinDate: new Date().toISOString().slice(0, 10),
  rank: 0,
  completionRate: 0,
};

const INITIAL_XP_HISTORY: { day: string; xp: number; label: string }[] = [];

const INITIAL_ACHIEVEMENTS: Achievement[] = [];

const INITIAL_QUESTS: Quest[] = [];

const INITIAL_LEADERBOARD: LeaderboardPlayer[] = [];

const SKILL_TREES: Record<SkillBranch, { label: string; color: string; icon: typeof Music; nodes: SkillNode[] }> = {
  production: {
    label: 'Production',
    color: 'text-neon-purple',
    icon: Music,
    nodes: [
      { id: 'p1', name: 'Beat Making', description: 'Fundamentals of rhythm and groove', level: 0, maxLevel: 5, xpCost: 0, unlocked: true },
      { id: 'p2', name: 'Arrangement', description: 'Song structure and flow', level: 0, maxLevel: 5, xpCost: 200, unlocked: false, requires: 'p1' },
      { id: 'p3', name: 'Sampling', description: 'Creative sample manipulation', level: 0, maxLevel: 5, xpCost: 300, unlocked: false, requires: 'p1' },
      { id: 'p4', name: 'Vocal Production', description: 'Recording and processing vocals', level: 0, maxLevel: 5, xpCost: 400, unlocked: false, requires: 'p2' },
      { id: 'p5', name: 'Orchestration', description: 'Layering and instrumentation', level: 0, maxLevel: 5, xpCost: 500, unlocked: false, requires: 'p2' },
    ],
  },
  theory: {
    label: 'Theory',
    color: 'text-neon-cyan',
    icon: BookOpen,
    nodes: [
      { id: 't1', name: 'Scales & Modes', description: 'Musical scales and modal theory', level: 0, maxLevel: 5, xpCost: 0, unlocked: true },
      { id: 't2', name: 'Harmony', description: 'Chord progressions and voice leading', level: 0, maxLevel: 5, xpCost: 250, unlocked: false, requires: 't1' },
      { id: 't3', name: 'Ear Training', description: 'Interval and chord recognition', level: 0, maxLevel: 5, xpCost: 350, unlocked: false, requires: 't1' },
      { id: 't4', name: 'Counterpoint', description: 'Melodic independence and interplay', level: 0, maxLevel: 5, xpCost: 450, unlocked: false, requires: 't2' },
      { id: 't5', name: 'Orchestral Theory', description: 'Advanced harmonic and timbral concepts', level: 0, maxLevel: 5, xpCost: 600, unlocked: false, requires: 't4' },
    ],
  },
  engineering: {
    label: 'Engineering',
    color: 'text-neon-green',
    icon: Cpu,
    nodes: [
      { id: 'e1', name: 'EQ & Filtering', description: 'Spectral shaping and tone sculpting', level: 0, maxLevel: 5, xpCost: 0, unlocked: true },
      { id: 'e2', name: 'Compression', description: 'Dynamic range control', level: 0, maxLevel: 5, xpCost: 200, unlocked: false, requires: 'e1' },
      { id: 'e3', name: 'Spatial FX', description: 'Reverb, delay, and stereo imaging', level: 0, maxLevel: 5, xpCost: 300, unlocked: false, requires: 'e1' },
      { id: 'e4', name: 'Mastering', description: 'Final polish and loudness optimization', level: 0, maxLevel: 5, xpCost: 500, unlocked: false, requires: 'e2' },
      { id: 'e5', name: 'Synthesis', description: 'Subtractive, FM, wavetable, granular', level: 0, maxLevel: 5, xpCost: 400, unlocked: false, requires: 'e3' },
    ],
  },
  performance: {
    label: 'Performance',
    color: 'text-neon-pink',
    icon: Headphones,
    nodes: [
      { id: 'r1', name: 'Live Sets', description: 'Building and performing live sets', level: 0, maxLevel: 5, xpCost: 0, unlocked: true },
      { id: 'r2', name: 'DJ Mixing', description: 'Beatmatching, transitions, and reading a crowd', level: 0, maxLevel: 5, xpCost: 250, unlocked: false, requires: 'r1' },
      { id: 'r3', name: 'Improvisation', description: 'Real-time creative decision-making', level: 0, maxLevel: 5, xpCost: 350, unlocked: false, requires: 'r1' },
      { id: 'r4', name: 'Controllerism', description: 'Advanced MIDI controller techniques', level: 0, maxLevel: 5, xpCost: 450, unlocked: false, requires: 'r2' },
      { id: 'r5', name: 'Stage Presence', description: 'Audience engagement and showmanship', level: 0, maxLevel: 5, xpCost: 500, unlocked: false, requires: 'r3' },
    ],
  },
};

const SHOP_ITEMS: ShopItem[] = [
  { id: 's1', name: 'Vinyl Veteran Badge', description: 'Show your dedication to the craft', icon: '🏅', type: 'badge', cost: 500, rarity: 'common', owned: false },
  { id: 's2', name: 'Waveform Wanderer', description: 'Title: displayed next to your name', icon: '🌊', type: 'title', cost: 800, rarity: 'rare', owned: false },
  { id: 's3', name: 'Neon Grid Theme', description: 'Cyberpunk-inspired profile theme', icon: '🎆', type: 'theme', cost: 1200, rarity: 'rare', owned: false },
  { id: 's4', name: 'Golden Fader Badge', description: 'The mark of a true mix engineer', icon: '🏆', type: 'badge', cost: 2000, rarity: 'epic', owned: false },
  { id: 's5', name: 'Sub Bass Overlord', description: 'Title: for the low-end specialists', icon: '💀', type: 'title', cost: 1500, rarity: 'epic', owned: false },
  { id: 's6', name: 'Cosmic Producer', description: 'Title: out of this world', icon: '🚀', type: 'title', cost: 3000, rarity: 'legendary', owned: false },
  { id: 's7', name: 'Fire Emote', description: 'React with flames on community tracks', icon: '🔥', type: 'emote', cost: 300, rarity: 'common', owned: true },
  { id: 's8', name: 'Headphone Halo Badge', description: 'A radiant symbol of critical listening', icon: '😇', type: 'badge', cost: 1800, rarity: 'epic', owned: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rarityColor: Record<string, string> = {
  common: 'text-gray-400 border-gray-500/30',
  rare: 'text-neon-blue border-neon-blue/30',
  epic: 'text-neon-purple border-neon-purple/30',
  legendary: 'text-neon-yellow border-neon-yellow/30',
};

const difficultyStyle: Record<string, string> = {
  easy: 'bg-neon-green/20 text-neon-green',
  medium: 'bg-neon-blue/20 text-neon-blue',
  hard: 'bg-neon-pink/20 text-neon-pink',
};

function _xpForLevel(lv: number) {
  return lv * 1000 + (lv > 10 ? (lv - 10) * 500 : 0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GameLensPage() {
  useLensNav('game');

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [lbPeriod, setLbPeriod] = useState<LeaderboardPeriod>('alltime');
  const [shopItems, setShopItems] = useState<ShopItem[]>(SHOP_ITEMS);
  const [playerXp, setPlayerXp] = useState(0);
  const [expandedBranch, setExpandedBranch] = useState<SkillBranch | null>('production');
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [newChallenge, setNewChallenge] = useState({ name: '', description: '', difficulty: 'medium' as Quest['difficulty'], xpReward: 300 });
  const [unlockAnim, setUnlockAnim] = useState<string | null>(null);
  const [questFilter, setQuestFilter] = useState<'all' | 'daily' | 'weekly' | 'challenge'>('all');

  // Fetch achievements via useLensData (no /api/game/* backend exists)
  const { items: achievementItems, isLoading, isError: isError, error: error, refetch: refetch } = useLensData<Achievement>('game', 'achievement', { seed: [] });
  const achievements: Achievement[] = achievementItems.map(i => ({ ...(i.data as unknown as Achievement), id: i.id }));

  // Fetch challenges/quests via useLensData
  const { items: questItems, isError: isError2, error: error2, refetch: refetch2 } = useLensData<Quest>('game', 'quest', { seed: [] });
  const quests: Quest[] = questItems.map(i => ({ ...(i.data as unknown as Quest), id: i.id }));

  // Fetch profile via useLensData
  const { items: profileItems, isError: isError3, error: error3, refetch: refetch3 } = useLensData<Record<string, unknown>>('game', 'profile', { seed: [] });
  const profileData = profileItems.length > 0 ? profileItems[0].data : null;

  // Fetch leaderboard via useLensData
  const { items: leaderboardItems, isError: isError4, error: error4, refetch: refetch4 } = useLensData<Record<string, unknown>>('game', 'leaderboard', { seed: [] });
  const leaderboardData = leaderboardItems.map(i => i.data);

  // Sync profile data into local state when available
  useEffect(() => {
    if (profileData?.xp && profileData.xp !== playerXp) {
      setPlayerXp(profileData.xp as number);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData]);

  const { update: updateQuest } = useLensData<Quest>('game', 'quest', { noSeed: true });
  const completeQuestMutation = useMutation({
    mutationFn: (questId: string) => updateQuest(questId, { data: { status: 'completed' } as unknown as Partial<Quest> }),
    onSuccess: () => { refetch2(); refetch3(); },
    onError: (err) => {
      console.error('Failed to complete quest:', err instanceof Error ? err.message : err);
    },
  });

  // Local quest status overrides (optimistic UI)
  const [questStatusOverrides, setQuestStatusOverrides] = useState<Record<string, QuestStatus>>({});
  const effectiveQuests = useMemo(() =>
    quests.map(q => questStatusOverrides[q.id] ? { ...q, status: questStatusOverrides[q.id] } : q),
    [quests, questStatusOverrides]
  );

  // Quest flow
  const acceptQuest = useCallback((id: string) => {
    setQuestStatusOverrides(prev => ({ ...prev, [id]: 'accepted' as QuestStatus }));
  }, []);

  const completeQuest = useCallback((id: string) => {
    const quest = quests.find((q) => q.id === id);
    if (!quest) return;
    setQuestStatusOverrides(prev => ({ ...prev, [id]: 'completed' as QuestStatus }));
    setPlayerXp((prev) => prev + quest.xpReward);
    completeQuestMutation.mutate(id);
  }, [quests, completeQuestMutation]);

  // Shop purchase
  const purchaseItem = useCallback((id: string) => {
    const item = shopItems.find((i) => i.id === id);
    if (!item || item.owned || playerXp < item.cost) return;
    setShopItems((prev) => prev.map((i) => (i.id === id ? { ...i, owned: true } : i)));
    setPlayerXp((prev) => prev - item.cost);
  }, [shopItems, playerXp]);

  // Achievement unlock (optimistic UI - will refresh from API on next fetch)
  const [achievementOverrides, setAchievementOverrides] = useState<Record<string, boolean>>({});
  const effectiveAchievements = useMemo(() =>
    achievements.map(a => achievementOverrides[a.id] ? { ...a, unlocked: true, progress: a.maxProgress } : a),
    [achievements, achievementOverrides]
  );
  const triggerUnlock = useCallback((id: string) => {
    setAchievementOverrides(prev => ({ ...prev, [id]: true }));
    setUnlockAnim(id);
    const ach = achievements.find((a) => a.id === id);
    if (ach) setPlayerXp((prev) => prev + ach.xpReward);
    setTimeout(() => setUnlockAnim(null), 2000);
  }, [achievements]);

  // Create custom challenge (local-only, added to local quest list)
  const [localQuests, setLocalQuests] = useState<Quest[]>([]);
  const allQuests = useMemo(() => [...effectiveQuests, ...localQuests], [effectiveQuests, localQuests]);
  const submitChallenge = useCallback(() => {
    if (!newChallenge.name.trim()) return;
    const id = `q-custom-${Date.now()}`;
    setLocalQuests((prev) => [...prev, { id, name: newChallenge.name, description: newChallenge.description, icon: '🎯', xpReward: newChallenge.xpReward, difficulty: newChallenge.difficulty, type: 'challenge', status: 'available' }]);
    setNewChallenge({ name: '', description: '', difficulty: 'medium', xpReward: 300 });
    setShowCreateChallenge(false);
  }, [newChallenge]);

  // Computed
  const filteredQuests = useMemo(() => {
    if (questFilter === 'all') return allQuests;
    return allQuests.filter((q) => q.type === questFilter);
  }, [allQuests, questFilter]);

  const sortedLeaderboard = useMemo(() => {
    const apiPlayers = (leaderboardData || []) as unknown as LeaderboardPlayer[];
    return [...apiPlayers].sort((a: LeaderboardPlayer, b: LeaderboardPlayer) => b.xp - a.xp);
  }, [leaderboardData]);

  const profile = (profileData || { level: 1, xp: 0, nextLevelXp: 1000, totalXpEarned: 0, achievements: 0, totalAchievements: 0, streak: 0, longestStreak: 0, questsCompleted: 0, challengesWon: 0, completionRate: 0, rank: 0, xpHistory: [] }) as unknown as GameProfile;
  const xpHistory: XpHistoryEntry[] = (profile.xpHistory || []) as XpHistoryEntry[];
  const xpMax = Math.max(1, ...xpHistory.map((d: { xp: number }) => d.xp));
  const level = profile.level || 1;
  const progressPct = ((playerXp) / ((profile.nextLevelXp as number) || 1000)) * 100;

  const TABS: { id: MainTab; label: string; icon: typeof Trophy }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'skills', label: 'Skill Tree', icon: GitBranch },
    { id: 'quests', label: 'Quests', icon: Target },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'leaderboard', label: 'Leaderboard', icon: Users },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'history', label: 'XP History', icon: TrendingUp },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------


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

  if (isError || isError2 || isError3 || isError4) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message || error4?.message} onRetry={() => { refetch(); refetch2(); refetch3(); refetch4(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center">
            <Swords className="w-6 h-6 text-neon-purple" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Game Lens</h1>
            <p className="text-sm text-gray-400">Gamification platform &mdash; level up your music production skills</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-neon-yellow font-mono text-sm">
            <Zap className="w-4 h-4" />
            {playerXp.toLocaleString()} XP
          </div>
          <div className="flex items-center gap-1 text-neon-pink font-mono text-sm">
            <Flame className="w-4 h-4" />
            {profile.streak}d streak
          </div>
          <div className="flex items-center gap-1 text-neon-cyan font-mono text-sm">
            <Star className="w-4 h-4" />
            Lv {level}
          </div>
        </div>
      </header>

      {/* XP Progress Bar */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Progress to Level {level + 1}</span>
          <span className="text-sm font-mono text-white">{playerXp.toLocaleString()} / {(profile.nextLevelXp || 1000).toLocaleString()} XP</span>
        </div>
        <div className="h-3 bg-lattice-bg rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progressPct, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-lattice-border scrollbar-thin">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap text-sm',
                activeTab === tab.id ? 'bg-neon-purple/20 text-neon-purple border-b-2 border-neon-purple' : 'text-gray-400 hover:text-white',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* DASHBOARD TAB                                                      */}
      {/* ================================================================= */}
      {activeTab === 'dashboard' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Level', value: level, icon: Star, color: 'text-neon-purple' },
              { label: 'Total XP', value: (profile.totalXpEarned || playerXp).toLocaleString(), icon: Zap, color: 'text-neon-yellow' },
              { label: 'Achievements', value: `${profile.achievements || effectiveAchievements.filter(a => a.unlocked).length}/${profile.totalAchievements || effectiveAchievements.length}`, icon: Trophy, color: 'text-neon-green' },
              { label: 'Day Streak', value: profile.streak || 0, icon: Flame, color: 'text-neon-pink' },
            ].map((s) => (
              <div key={s.label} className="lens-card text-center">
                <s.icon className={cn('w-8 h-8 mx-auto mb-2', s.color)} />
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-sm text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Quests Done', value: profile.questsCompleted || quests.filter(q => q.status === 'completed').length, icon: Target, color: 'text-neon-cyan' },
              { label: 'Challenges Won', value: profile.challengesWon || 0, icon: Crown, color: 'text-neon-yellow' },
              { label: 'Completion Rate', value: `${profile.completionRate || 0}%`, icon: Activity, color: 'text-neon-green' },
              { label: 'Global Rank', value: `#${profile.rank || '--'}`, icon: ArrowUp, color: 'text-neon-blue' },
            ].map((s) => (
              <div key={s.label} className="lens-card text-center">
                <s.icon className={cn('w-6 h-6 mx-auto mb-1', s.color)} />
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Mini XP Chart on Dashboard */}
          <div className="panel p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">This Week&apos;s XP</h3>
            <div className="flex items-end gap-2 h-32">
              {xpHistory.map((d: XpHistoryEntry, dIndex: number) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500 font-mono">{d.xp}</span>
                  <motion.div
                    className="w-full rounded-t bg-gradient-to-t from-neon-purple to-neon-cyan"
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.xp / xpMax) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.05 * dIndex }}
                  />
                  <span className="text-xs text-gray-400">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Quests Preview */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">Active Quests</h3>
              <button onClick={() => setActiveTab('quests')} className="text-xs text-neon-cyan hover:underline">View all</button>
            </div>
            <div className="space-y-2">
              {quests.filter((q) => q.status === 'accepted').slice(0, 3).map((q) => (
                <div key={q.id} className="flex items-center justify-between bg-lattice-surface rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{q.icon}</span>
                    <span className="text-sm text-white">{q.name}</span>
                  </div>
                  <button onClick={() => completeQuest(q.id)} className="btn-neon text-xs py-1 px-3">Complete</button>
                </div>
              ))}
              {quests.filter((q) => q.status === 'accepted').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No active quests. Accept some from the Quests tab!</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* SKILL TREE TAB                                                     */}
      {/* ================================================================= */}
      {activeTab === 'skills' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-sm text-gray-400">Invest XP to unlock and upgrade skills across four branches.</p>
          {(Object.entries(SKILL_TREES) as [SkillBranch, typeof SKILL_TREES[SkillBranch]][]).map(([branch, data]) => {
            const BranchIcon = data.icon;
            const isExpanded = expandedBranch === branch;
            return (
              <div key={branch} className="panel overflow-hidden">
                <button
                  onClick={() => setExpandedBranch(isExpanded ? null : branch)}
                  className="w-full flex items-center justify-between p-4 hover:bg-lattice-surface/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BranchIcon className={cn('w-5 h-5', data.color)} />
                    <span className="font-semibold text-white">{data.label}</span>
                    <span className="text-xs text-gray-500">{data.nodes.filter((n) => n.unlocked).length}/{data.nodes.length} unlocked</span>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-lattice-border"
                    >
                      <div className="p-4 space-y-3">
                        {data.nodes.map((node) => (
                          <div key={node.id} className={cn('flex items-center gap-4 rounded-lg p-3', node.unlocked ? 'bg-lattice-surface' : 'bg-lattice-bg opacity-60')}>
                            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center border-2', node.unlocked ? 'border-neon-green bg-neon-green/10' : 'border-gray-600 bg-gray-800')}>
                              {node.unlocked ? <Unlock className="w-4 h-4 text-neon-green" /> : <Lock className="w-4 h-4 text-gray-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white text-sm">{node.name}</span>
                                {node.requires && <span className="text-[10px] text-gray-500">requires prev.</span>}
                              </div>
                              <p className="text-xs text-gray-400 truncate">{node.description}</p>
                              {/* Level pips */}
                              <div className="flex gap-1 mt-1">
                                {Array.from({ length: node.maxLevel }).map((_, i) => (
                                  <div key={i} className={cn('w-4 h-1.5 rounded-full', i < node.level ? 'bg-neon-green' : 'bg-gray-700')} />
                                ))}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono text-gray-400">Lv {node.level}/{node.maxLevel}</span>
                              {node.unlocked && node.level < node.maxLevel && (
                                <p className="text-[10px] text-neon-yellow mt-0.5">{node.xpCost} XP to upgrade</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* QUESTS TAB                                                         */}
      {/* ================================================================= */}
      {activeTab === 'quests' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Quest filter + create button */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1">
              {(['all', 'daily', 'weekly', 'challenge'] as const).map((f) => (
                <button key={f} onClick={() => setQuestFilter(f)} className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors', questFilter === f ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white')}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreateChallenge(true)} className="btn-neon text-sm py-1.5 px-4 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Create Challenge
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredQuests.map((quest) => (
              <motion.div
                key={quest.id}
                layout
                className={cn('lens-card', quest.status === 'completed' && 'opacity-50')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{quest.icon}</span>
                  <div className="flex items-center gap-2">
                    {quest.timeLeft && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{quest.timeLeft}</span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded', difficultyStyle[quest.difficulty])}>{quest.difficulty}</span>
                    <span className={cn('text-xs px-2 py-0.5 rounded', quest.type === 'daily' ? 'bg-neon-cyan/15 text-neon-cyan' : quest.type === 'weekly' ? 'bg-neon-purple/15 text-neon-purple' : 'bg-neon-yellow/15 text-neon-yellow')}>
                      {quest.type}
                    </span>
                  </div>
                </div>
                <h4 className="font-semibold text-white">{quest.name}</h4>
                <p className="text-sm text-gray-400 mt-1">{quest.description}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-lattice-border">
                  <span className="text-sm text-neon-yellow flex items-center gap-1"><Zap className="w-4 h-4" />+{quest.xpReward} XP</span>
                  {quest.status === 'available' && (
                    <button onClick={() => acceptQuest(quest.id)} className="btn-neon text-sm py-1 px-4">Accept</button>
                  )}
                  {quest.status === 'accepted' && (
                    <button onClick={() => completeQuest(quest.id)} className="btn-neon text-sm py-1 px-4 flex items-center gap-1"><Check className="w-3 h-3" />Complete</button>
                  )}
                  {quest.status === 'completed' && (
                    <span className="text-sm text-neon-green flex items-center gap-1"><Check className="w-4 h-4" />Done</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* ACHIEVEMENTS TAB                                                   */}
      {/* ================================================================= */}
      {activeTab === 'achievements' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <p className="text-sm text-gray-400">
            {effectiveAchievements.filter((a) => a.unlocked).length} of {effectiveAchievements.length} achievements unlocked
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {effectiveAchievements.map((ach) => (
              <motion.div
                key={ach.id}
                layout
                className={cn('lens-card relative overflow-hidden', ach.unlocked ? 'border-neon-green/40' : '')}
              >
                <AnimatePresence>
                  {unlockAnim === ach.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.5 }}
                      className="absolute inset-0 flex items-center justify-center bg-neon-green/10 backdrop-blur-sm z-10"
                    >
                      <div className="text-center">
                        <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.3, 1] }} transition={{ duration: 0.6 }}>
                          <Sparkles className="w-12 h-12 text-neon-yellow mx-auto" />
                        </motion.div>
                        <p className="text-neon-green font-bold mt-2">UNLOCKED!</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{ach.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white text-sm">{ach.name}</h4>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', rarityColor[ach.rarity])}>{ach.rarity}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{ach.description}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Category: {ach.category}</p>
                    {!ach.unlocked && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">Progress</span>
                          <span className="text-gray-300">{ach.progress}/{ach.maxProgress}</span>
                        </div>
                        <div className="h-1.5 bg-lattice-bg rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-neon-blue rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(ach.progress / ach.maxProgress) * 100}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-neon-yellow flex items-center gap-0.5"><Zap className="w-3 h-3" />+{ach.xpReward} XP</span>
                      {!ach.unlocked && ach.progress >= ach.maxProgress * 0.9 && (
                        <button onClick={() => triggerUnlock(ach.id)} className="text-[10px] text-neon-green hover:underline">Claim</button>
                      )}
                      {ach.unlocked && <Trophy className="w-4 h-4 text-neon-green" />}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* LEADERBOARD TAB                                                    */}
      {/* ================================================================= */}
      {activeTab === 'leaderboard' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex gap-2">
            {(['weekly', 'monthly', 'alltime'] as LeaderboardPeriod[]).map((p) => (
              <button key={p} onClick={() => setLbPeriod(p)} className={cn('px-4 py-1.5 rounded text-sm transition-colors', lbPeriod === p ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white')}>
                {p === 'alltime' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className="panel overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-lattice-border">
                  <th scope="col" className="pb-3 pt-4 px-4 w-16">Rank</th>
                  <th scope="col" className="pb-3 pt-4">Player</th>
                  <th scope="col" className="pb-3 pt-4 text-right hidden md:table-cell">Title</th>
                  <th scope="col" className="pb-3 pt-4 text-right">Level</th>
                  <th scope="col" className="pb-3 pt-4 text-right">Achievements</th>
                  <th scope="col" className="pb-3 pt-4 text-right pr-4">XP</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">No players on the leaderboard yet</td></tr>
                )}
                {sortedLeaderboard.map((player, index) => (
                  <motion.tr
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={cn('border-b border-lattice-border/30 transition-colors', player.isCurrentUser ? 'bg-neon-purple/10' : 'hover:bg-lattice-surface/50')}
                  >
                    <td className="py-3 px-4">
                      {index === 0 ? <Crown className="w-5 h-5 text-neon-yellow" /> : index === 1 ? <span className="text-gray-300 font-bold">2</span> : index === 2 ? <span className="text-amber-600 font-bold">3</span> : <span className="text-gray-500">#{index + 1}</span>}
                    </td>
                    <td className="py-3 font-medium text-white text-sm">
                      {player.name}
                      {player.isCurrentUser && <span className="ml-2 text-[10px] text-neon-cyan">(you)</span>}
                    </td>
                    <td className="py-3 text-right text-xs text-gray-400 hidden md:table-cell">{player.title}</td>
                    <td className="py-3 text-right text-sm">{player.level}</td>
                    <td className="py-3 text-right text-sm">{player.achievements}</td>
                    <td className="py-3 text-right pr-4 font-mono text-neon-blue text-sm">{player.xp.toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* SHOP TAB                                                           */}
      {/* ================================================================= */}
      {activeTab === 'shop' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Spend your hard-earned XP on badges, titles, themes, and emotes.</p>
            <div className="flex items-center gap-1 text-neon-yellow font-mono text-sm">
              <Gem className="w-4 h-4" /> {playerXp.toLocaleString()} XP available
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {shopItems.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.02 }}
                className={cn('lens-card flex flex-col', item.owned && 'border-neon-green/30')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">{item.icon}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', rarityColor[item.rarity])}>{item.rarity}</span>
                </div>
                <h4 className="font-semibold text-white text-sm">{item.name}</h4>
                <p className="text-xs text-gray-400 mt-1 flex-1">{item.description}</p>
                <span className="text-[10px] text-gray-500 mt-1 capitalize">{item.type}</span>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-lattice-border">
                  <span className="text-sm text-neon-yellow flex items-center gap-1"><Gem className="w-3 h-3" />{item.cost.toLocaleString()}</span>
                  {item.owned ? (
                    <span className="text-xs text-neon-green flex items-center gap-1"><Check className="w-3 h-3" />Owned</span>
                  ) : (
                    <button
                      onClick={() => purchaseItem(item.id)}
                      disabled={playerXp < item.cost}
                      className={cn('btn-neon text-xs py-1 px-3', playerXp < item.cost && 'opacity-40 cursor-not-allowed')}
                    >
                      Buy
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* XP HISTORY TAB                                                     */}
      {/* ================================================================= */}
      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Bar Chart */}
          <div className="panel p-6">
            <h3 className="font-semibold text-white mb-1">XP Earned This Week</h3>
            <p className="text-xs text-gray-400 mb-6">Total: {xpHistory.reduce((s: number, d: { xp: number }) => s + d.xp, 0).toLocaleString()} XP</p>
            <div className="flex items-end gap-3 h-48">
              {xpHistory.map((d: { day: string; xp: number }, i: number) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono">{d.xp}</span>
                  <motion.div
                    className="w-full rounded-t-md bg-gradient-to-t from-neon-purple via-neon-blue to-neon-cyan"
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.xp / xpMax) * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                  />
                  <span className="text-xs text-gray-300 font-medium">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-neon-yellow">{(profile.totalXpEarned || playerXp).toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Lifetime XP</p>
            </div>
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-neon-cyan">{Math.round(xpHistory.reduce((s: number, d: { xp: number }) => s + d.xp, 0) / Math.max(xpHistory.length, 1))}</p>
              <p className="text-xs text-gray-400 mt-1">Avg Daily XP</p>
            </div>
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-neon-green">{xpHistory.length > 0 ? Math.max(...xpHistory.map((d: { xp: number }) => d.xp)) : 0}</p>
              <p className="text-xs text-gray-400 mt-1">Best Day</p>
            </div>
            <div className="lens-card text-center">
              <p className="text-2xl font-bold text-neon-pink">{profile.longestStreak || 0}d</p>
              <p className="text-xs text-gray-400 mt-1">Longest Streak</p>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="panel p-4">
            <h3 className="font-semibold text-white mb-3">Recent Activity</h3>
            <div className="space-y-3">
              {[
                { time: '2h ago', text: 'Completed "Daily Mix Session" quest', xp: '+120 XP', color: 'text-neon-green' },
                { time: '5h ago', text: 'Unlocked "Plugin Collector" achievement', xp: '+350 XP', color: 'text-neon-yellow' },
                { time: '1d ago', text: 'Purchased "Fire Emote" from shop', xp: '-300 XP', color: 'text-neon-pink' },
                { time: '1d ago', text: 'Leveled up Compression skill to Lv 4', xp: '+200 XP', color: 'text-neon-cyan' },
                { time: '2d ago', text: 'Completed "Genre Explorer" weekly quest', xp: '+500 XP', color: 'text-neon-green' },
                { time: '3d ago', text: 'Reached Level 14', xp: 'Level up!', color: 'text-neon-purple' },
              ].map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-lattice-border/30 pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500 w-14 shrink-0">{entry.time}</span>
                    <span className="text-gray-300">{entry.text}</span>
                  </div>
                  <span className={cn('font-mono text-xs shrink-0', entry.color)}>{entry.xp}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* CREATE CHALLENGE MODAL                                             */}
      {/* ================================================================= */}
      <AnimatePresence>
        {showCreateChallenge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateChallenge(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="panel w-full max-w-lg p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Create Challenge</h2>
                <button onClick={() => setShowCreateChallenge(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Challenge Name</label>
                <input
                  value={newChallenge.name}
                  onChange={(e) => setNewChallenge((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. 808 Bass Marathon"
                  className="input-lattice w-full"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                <textarea
                  value={newChallenge.description}
                  onChange={(e) => setNewChallenge((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the challenge rules and goals..."
                  rows={3}
                  className="input-lattice w-full resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
                  <select
                    value={newChallenge.difficulty}
                    onChange={(e) => setNewChallenge((p) => ({ ...p, difficulty: e.target.value as Quest['difficulty'] }))}
                    className="input-lattice w-full"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">XP Reward</label>
                  <input
                    type="number"
                    value={newChallenge.xpReward}
                    onChange={(e) => setNewChallenge((p) => ({ ...p, xpReward: Number(e.target.value) }))}
                    min={50}
                    max={2000}
                    step={50}
                    className="input-lattice w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowCreateChallenge(false)} className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">Cancel</button>
                <button onClick={submitChallenge} disabled={!newChallenge.name.trim()} className={cn('btn-neon py-2 px-6', !newChallenge.name.trim() && 'opacity-40 cursor-not-allowed')}>
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
