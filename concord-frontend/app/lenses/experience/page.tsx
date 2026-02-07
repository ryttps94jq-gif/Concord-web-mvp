'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Share2, Edit3, Plus, Play, Music, Disc3,
  Palette, Trophy, Star, TrendingUp, Users, Heart,
  Clock, Target, Zap, Award, ShoppingBag, Calendar,
  MapPin, ExternalLink, Filter, GripVertical,
  Lightbulb, BarChart3, Flame, ChevronRight
} from 'lucide-react';

// --- Types ---

type TabId = 'portfolio' | 'skills' | 'history' | 'insights';
type PortfolioFilter = 'all' | 'tracks' | 'releases' | 'art' | 'collaborations';
type PortfolioItemType = 'track' | 'release' | 'art' | 'collaboration';

interface PortfolioItem {
  id: string;
  type: PortfolioItemType;
  title: string;
  subtitle: string;
  coverGradient: string;
  playCount?: number;
  trackCount?: number;
  medium?: string;
  genre: string;
  date: string;
  featured: boolean;
}

interface SkillData {
  id: string;
  name: string;
  category: 'technical' | 'creative' | 'business';
  level: number;
  maxLevel: number;
  xp: number;
  xpToNext: number;
  endorsements: number;
  linkedLens: string;
}

interface HistoryItem {
  id: string;
  type: 'track_created' | 'session_joined' | 'goal_completed' | 'skill_leveled' | 'item_sold';
  title: string;
  description: string;
  timestamp: string;
  group: 'today' | 'this_week' | 'this_month' | 'earlier';
}

interface InsightData {
  mostProductiveDay: string;
  favoriteGenre: string;
  collaborationScore: number;
  recommendations: string[];
  weeklyHeatmap: number[][];
}

// --- Demo Data ---

const PROFILE = {
  name: 'Alex Resonance',
  bio: 'Electronic music producer & sound designer. Crafting sonic landscapes since 2019.',
  location: 'Los Angeles, CA',
  genres: ['Electronic', 'Ambient', 'Lo-fi', 'Synthwave', 'Experimental'],
  stats: { tracks: 47, collaborations: 12, sales: 89, followers: 1340 },
  socials: [
    { label: 'SoundCloud', url: '#' },
    { label: 'Spotify', url: '#' },
    { label: 'Instagram', url: '#' },
    { label: 'Twitter', url: '#' },
  ],
};

const DEMO_PORTFOLIO: PortfolioItem[] = [
  { id: 'p1', type: 'track', title: 'Midnight Protocol', subtitle: 'Original Mix', coverGradient: 'from-purple-600 to-blue-500', playCount: 2840, genre: 'Synthwave', date: '2025-12-15', featured: true },
  { id: 'p2', type: 'release', title: 'Neon Drift EP', subtitle: '5 tracks', coverGradient: 'from-cyan-500 to-teal-400', trackCount: 5, genre: 'Electronic', date: '2025-11-20', featured: true },
  { id: 'p3', type: 'art', title: 'Waveform Series #3', subtitle: 'Generative Art', coverGradient: 'from-pink-500 to-orange-400', medium: 'Digital / Processing', genre: 'Visual', date: '2025-10-08', featured: false },
  { id: 'p4', type: 'track', title: 'Deep State', subtitle: 'Extended Mix', coverGradient: 'from-green-500 to-emerald-400', playCount: 1520, genre: 'Ambient', date: '2025-09-30', featured: false },
  { id: 'p5', type: 'collaboration', title: 'Echoes feat. Luna', subtitle: 'w/ Luna Wave', coverGradient: 'from-yellow-500 to-red-400', playCount: 4120, genre: 'Lo-fi', date: '2025-08-22', featured: true },
  { id: 'p6', type: 'track', title: 'Circuit Breaker', subtitle: 'Radio Edit', coverGradient: 'from-indigo-500 to-purple-400', playCount: 980, genre: 'Electronic', date: '2025-07-14', featured: false },
  { id: 'p7', type: 'release', title: 'Analog Dreams LP', subtitle: '12 tracks', coverGradient: 'from-rose-500 to-pink-400', trackCount: 12, genre: 'Synthwave', date: '2025-06-01', featured: true },
  { id: 'p8', type: 'art', title: 'Spectral Bloom', subtitle: 'Album Cover', coverGradient: 'from-amber-500 to-yellow-300', medium: 'Digital / Photoshop', genre: 'Visual', date: '2025-05-10', featured: false },
];

const DEMO_SKILLS: SkillData[] = [
  { id: 's1', name: 'Production', category: 'technical', level: 8, maxLevel: 10, xp: 720, xpToNext: 1000, endorsements: 24, linkedLens: 'voice' },
  { id: 's2', name: 'Mixing', category: 'technical', level: 7, maxLevel: 10, xp: 580, xpToNext: 800, endorsements: 18, linkedLens: 'collab' },
  { id: 's3', name: 'Mastering', category: 'technical', level: 5, maxLevel: 10, xp: 310, xpToNext: 600, endorsements: 9, linkedLens: 'invariant' },
  { id: 's4', name: 'Songwriting', category: 'creative', level: 6, maxLevel: 10, xp: 450, xpToNext: 700, endorsements: 15, linkedLens: 'commonsense' },
  { id: 's5', name: 'Sound Design', category: 'creative', level: 9, maxLevel: 10, xp: 880, xpToNext: 1000, endorsements: 31, linkedLens: 'entity' },
  { id: 's6', name: 'Arrangement', category: 'creative', level: 7, maxLevel: 10, xp: 620, xpToNext: 800, endorsements: 12, linkedLens: 'voice' },
];

const DEMO_HISTORY: HistoryItem[] = [
  { id: 'h1', type: 'track_created', title: 'Created "Midnight Protocol"', description: 'Synthwave track, 4:32 duration', timestamp: '2 hours ago', group: 'today' },
  { id: 'h2', type: 'skill_leveled', title: 'Sound Design leveled up!', description: 'Now level 9 - Expert tier', timestamp: '5 hours ago', group: 'today' },
  { id: 'h3', type: 'session_joined', title: 'Joined collab session', description: 'With Luna Wave - mixing session', timestamp: '8 hours ago', group: 'today' },
  { id: 'h4', type: 'item_sold', title: 'Sold "Neon Drift EP"', description: 'Digital download - $9.99', timestamp: '1 day ago', group: 'this_week' },
  { id: 'h5', type: 'goal_completed', title: 'Completed weekly goal', description: 'Produce 3 tracks this week', timestamp: '2 days ago', group: 'this_week' },
  { id: 'h6', type: 'track_created', title: 'Created "Deep State"', description: 'Ambient track, 6:15 duration', timestamp: '3 days ago', group: 'this_week' },
  { id: 'h7', type: 'session_joined', title: 'Joined feedback session', description: 'Community mix review', timestamp: '4 days ago', group: 'this_week' },
  { id: 'h8', type: 'item_sold', title: 'Sold "Circuit Breaker"', description: 'Licensing deal - $45.00', timestamp: '5 days ago', group: 'this_week' },
  { id: 'h9', type: 'skill_leveled', title: 'Mixing leveled up!', description: 'Now level 7 - Advanced tier', timestamp: '1 week ago', group: 'this_month' },
  { id: 'h10', type: 'track_created', title: 'Created "Echoes"', description: 'Lo-fi collaboration track', timestamp: '2 weeks ago', group: 'this_month' },
  { id: 'h11', type: 'goal_completed', title: 'Hit 1000 followers', description: 'Milestone achievement unlocked', timestamp: '2 weeks ago', group: 'this_month' },
  { id: 'h12', type: 'session_joined', title: 'Masterclass: EQ techniques', description: 'Attended advanced mixing workshop', timestamp: '3 weeks ago', group: 'this_month' },
  { id: 'h13', type: 'track_created', title: 'Created "Analog Dreams LP"', description: '12-track album release', timestamp: '2 months ago', group: 'earlier' },
  { id: 'h14', type: 'item_sold', title: 'Bulk sale: sample pack', description: '15 units sold - $74.85', timestamp: '3 months ago', group: 'earlier' },
  { id: 'h15', type: 'goal_completed', title: 'Completed sound design course', description: 'Advanced synthesis techniques', timestamp: '4 months ago', group: 'earlier' },
];

const DEMO_INSIGHTS: InsightData = {
  mostProductiveDay: 'Wednesday',
  favoriteGenre: 'Synthwave',
  collaborationScore: 78,
  recommendations: [
    'Try mastering -- your mixing skills are strong enough to level up',
    'Collaborate more in Lo-fi -- high engagement from your last collab',
    'Explore arrangement techniques to complement your sound design',
    'Consider releasing a sample pack -- your sound design endorsements are top-tier',
  ],
  weeklyHeatmap: [
    [3, 1, 4, 2],
    [2, 3, 1, 5],
    [5, 4, 3, 4],
    [1, 2, 5, 3],
    [4, 5, 2, 1],
    [2, 1, 3, 4],
    [0, 1, 0, 2],
  ],
};

// --- Radar Chart Helper ---

function radarPoints(skills: SkillData[], radius: number, cx: number, cy: number): string {
  const count = skills.length;
  return skills
    .map((s, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const r = (s.level / s.maxLevel) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function radarGridPoints(level: number, maxLevel: number, count: number, radius: number, cx: number, cy: number): string {
  return Array.from({ length: count })
    .map((_, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const r = (level / maxLevel) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function radarLabelPos(index: number, count: number, radius: number, cx: number, cy: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    x: cx + (radius + 18) * Math.cos(angle),
    y: cy + (radius + 18) * Math.sin(angle),
  };
}

// --- Heatmap helpers ---

const HEAT_COLORS = [
  'bg-gray-800',
  'bg-emerald-900/60',
  'bg-emerald-700/60',
  'bg-emerald-500/70',
  'bg-emerald-400/80',
  'bg-emerald-300',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// --- History icon mapping ---

function historyIcon(type: HistoryItem['type']) {
  switch (type) {
    case 'track_created': return <Music className="w-4 h-4 text-neon-purple" />;
    case 'session_joined': return <Users className="w-4 h-4 text-neon-cyan" />;
    case 'goal_completed': return <Target className="w-4 h-4 text-neon-green" />;
    case 'skill_leveled': return <TrendingUp className="w-4 h-4 text-neon-yellow" />;
    case 'item_sold': return <ShoppingBag className="w-4 h-4 text-pink-400" />;
  }
}

function groupLabel(group: HistoryItem['group']): string {
  switch (group) {
    case 'today': return 'Today';
    case 'this_week': return 'This Week';
    case 'this_month': return 'This Month';
    case 'earlier': return 'Earlier';
  }
}

// --- Category color ---

function categoryColor(cat: SkillData['category']): string {
  switch (cat) {
    case 'technical': return 'text-neon-cyan';
    case 'creative': return 'text-neon-purple';
    case 'business': return 'text-neon-yellow';
  }
}

function categoryBg(cat: SkillData['category']): string {
  switch (cat) {
    case 'technical': return 'bg-neon-cyan/20 text-neon-cyan';
    case 'creative': return 'bg-neon-purple/20 text-neon-purple';
    case 'business': return 'bg-neon-yellow/20 text-neon-yellow';
  }
}

// --- Portfolio type badge ---

function typeBadge(type: PortfolioItemType): { label: string; color: string } {
  switch (type) {
    case 'track': return { label: 'Track', color: 'bg-blue-500/20 text-blue-400' };
    case 'release': return { label: 'Release', color: 'bg-purple-500/20 text-purple-400' };
    case 'art': return { label: 'Art', color: 'bg-pink-500/20 text-pink-400' };
    case 'collaboration': return { label: 'Collab', color: 'bg-green-500/20 text-green-400' };
  }
}

// --- Animations ---

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const staggerParent = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// =====================================================================
// Main Component
// =====================================================================

export default function ExperienceLensPage() {
  useLensNav('experience');

  const [activeTab, setActiveTab] = useState<TabId>('portfolio');
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter>('all');

  // Fetch real data in background for future use
  useQuery({
    queryKey: ['experience-status'],
    queryFn: () => apiHelpers.experience.status().then((r) => r.data),
    refetchInterval: 15000,
  });

  // --- Derived data ---

  const filteredPortfolio = useMemo(() => {
    if (portfolioFilter === 'all') return DEMO_PORTFOLIO;
    if (portfolioFilter === 'collaborations') return DEMO_PORTFOLIO.filter((p) => p.type === 'collaboration');
    return DEMO_PORTFOLIO.filter((p) => p.type === portfolioFilter.slice(0, -1) as PortfolioItemType);
  }, [portfolioFilter]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryItem[]> = {};
    for (const item of DEMO_HISTORY) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, []);

  const skillsByCategory = useMemo(() => {
    const cats: Record<string, SkillData[]> = { technical: [], creative: [], business: [] };
    for (const s of DEMO_SKILLS) {
      cats[s.category].push(s);
    }
    return cats;
  }, []);

  const TABS: { id: TabId; label: string }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'skills', label: 'Skills' },
    { id: 'history', label: 'History' },
    { id: 'insights', label: 'Insights' },
  ];

  const FILTERS: { id: PortfolioFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tracks', label: 'Tracks' },
    { id: 'releases', label: 'Releases' },
    { id: 'art', label: 'Art' },
    { id: 'collaborations', label: 'Collaborations' },
  ];

  // --- Radar chart config ---
  const radarCx = 140;
  const radarCy = 140;
  const radarR = 100;
  const gridLevels = [2, 4, 6, 8, 10];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* ========== Header ========== */}
      <motion.header
        className="flex items-center justify-between"
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Creative Portfolio</h1>
            <p className="text-sm text-gray-400">Showcase your work, track your growth</p>
          </div>
        </div>
        <button className="btn-neon purple flex items-center gap-2 text-sm">
          <Share2 className="w-4 h-4" />
          Share Portfolio
        </button>
      </motion.header>

      {/* ========== Profile Section ========== */}
      <motion.section
        className="panel p-6"
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 via-cyan-400 to-pink-500 p-0.5">
              <div className="w-full h-full rounded-full bg-lattice-deep flex items-center justify-center text-3xl font-bold text-white">
                AR
              </div>
            </div>
            <button className="btn-neon text-xs flex items-center gap-1 px-3 py-1.5">
              <Edit3 className="w-3 h-3" />
              Edit Profile
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-lg font-bold">{PROFILE.name}</h2>
              <p className="text-sm text-gray-400">{PROFILE.bio}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {PROFILE.location}
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Tracks Produced', value: PROFILE.stats.tracks, icon: Music },
                { label: 'Collaborations', value: PROFILE.stats.collaborations, icon: Users },
                { label: 'Sales', value: PROFILE.stats.sales, icon: ShoppingBag },
                { label: 'Followers', value: PROFILE.stats.followers.toLocaleString(), icon: Heart },
              ].map((stat) => (
                <div key={stat.label} className="lens-card text-center py-2">
                  <stat.icon className="w-4 h-4 mx-auto mb-1 text-gray-400" />
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Genre tags */}
            <div className="flex flex-wrap gap-2">
              {PROFILE.genres.map((g) => (
                <span key={g} className="px-2.5 py-1 rounded-full text-xs bg-neon-purple/15 text-neon-purple border border-neon-purple/20">
                  {g}
                </span>
              ))}
            </div>

            {/* Social links */}
            <div className="flex gap-3">
              {PROFILE.socials.map((s) => (
                <a key={s.label} href={s.url} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ========== Tab Navigation ========== */}
      <div className="flex gap-1 border-b border-lattice-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-400"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ========== Tab Content ========== */}
      <AnimatePresence mode="wait">
        {/* ---------- Portfolio Tab ---------- */}
        {activeTab === 'portfolio' && (
          <motion.div
            key="portfolio"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={fadeUp}
            className="space-y-4"
          >
            {/* Filter row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setPortfolioFilter(f.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      portfolioFilter === f.id
                        ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                        : 'text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button className="btn-neon purple text-xs flex items-center gap-1">
                <Plus className="w-3 h-3" />
                Add to Portfolio
              </button>
            </div>

            {/* Portfolio grid */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              variants={staggerParent}
              initial="hidden"
              animate="visible"
            >
              {filteredPortfolio.map((item) => {
                const badge = typeBadge(item.type);
                return (
                  <motion.div
                    key={item.id}
                    variants={staggerChild}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="lens-card group cursor-pointer overflow-hidden"
                  >
                    {/* Cover art placeholder */}
                    <div className={`relative h-36 rounded-lg mb-3 bg-gradient-to-br ${item.coverGradient} flex items-center justify-center overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                      {item.type === 'track' || item.type === 'collaboration' ? (
                        <Play className="w-10 h-10 text-white/80 drop-shadow-lg group-hover:scale-110 transition-transform" />
                      ) : item.type === 'release' ? (
                        <Disc3 className="w-10 h-10 text-white/80 drop-shadow-lg group-hover:rotate-90 transition-transform duration-500" />
                      ) : (
                        <Palette className="w-10 h-10 text-white/80 drop-shadow-lg" />
                      )}
                      {item.featured && (
                        <div className="absolute top-2 right-2">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <GripVertical className="w-4 h-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{item.subtitle}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{item.genre}</span>
                        {item.playCount !== undefined && (
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {item.playCount.toLocaleString()}
                          </span>
                        )}
                        {item.trackCount !== undefined && (
                          <span>{item.trackCount} tracks</span>
                        )}
                        {item.medium !== undefined && (
                          <span>{item.medium}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600">{item.date}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}

        {/* ---------- Skills Tab ---------- */}
        {activeTab === 'skills' && (
          <motion.div
            key="skills"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={fadeUp}
            className="space-y-6"
          >
            {/* Radar Chart + Skill bars side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SVG Radar Chart */}
              <div className="panel p-4 flex flex-col items-center">
                <h3 className="text-sm font-semibold mb-3 self-start">Skill Radar</h3>
                <svg width="280" height="280" viewBox="0 0 280 280" className="overflow-visible">
                  {/* Grid rings */}
                  {gridLevels.map((lv) => (
                    <polygon
                      key={lv}
                      points={radarGridPoints(lv, 10, DEMO_SKILLS.length, radarR, radarCx, radarCy)}
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Axis lines */}
                  {DEMO_SKILLS.map((_, i) => {
                    const angle = (Math.PI * 2 * i) / DEMO_SKILLS.length - Math.PI / 2;
                    const ex = radarCx + radarR * Math.cos(angle);
                    const ey = radarCy + radarR * Math.sin(angle);
                    return (
                      <line
                        key={i}
                        x1={radarCx}
                        y1={radarCy}
                        x2={ex}
                        y2={ey}
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="1"
                      />
                    );
                  })}
                  {/* Filled area */}
                  <motion.polygon
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{ transformOrigin: `${radarCx}px ${radarCy}px` }}
                    points={radarPoints(DEMO_SKILLS, radarR, radarCx, radarCy)}
                    fill="rgba(168, 85, 247, 0.25)"
                    stroke="rgba(168, 85, 247, 0.8)"
                    strokeWidth="2"
                  />
                  {/* Dots at vertices */}
                  {DEMO_SKILLS.map((s, i) => {
                    const angle = (Math.PI * 2 * i) / DEMO_SKILLS.length - Math.PI / 2;
                    const r = (s.level / s.maxLevel) * radarR;
                    const dx = radarCx + r * Math.cos(angle);
                    const dy = radarCy + r * Math.sin(angle);
                    return (
                      <circle key={s.id} cx={dx} cy={dy} r="4" fill="#a855f7" stroke="white" strokeWidth="1.5" />
                    );
                  })}
                  {/* Labels */}
                  {DEMO_SKILLS.map((s, i) => {
                    const pos = radarLabelPos(i, DEMO_SKILLS.length, radarR, radarCx, radarCy);
                    return (
                      <text
                        key={s.id}
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[10px] fill-gray-400"
                      >
                        {s.name}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Individual skill bars */}
              <div className="panel p-4 space-y-4">
                <h3 className="text-sm font-semibold">Skill Levels</h3>
                <motion.div className="space-y-3" variants={staggerParent} initial="hidden" animate="visible">
                  {DEMO_SKILLS.map((skill) => (
                    <motion.div key={skill.id} variants={staggerChild} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{skill.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${categoryBg(skill.category)}`}>
                            {skill.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {skill.endorsements}
                          </span>
                          <span className="font-medium text-white">Lv {skill.level}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${(skill.level / skill.maxLevel) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>{skill.xp} / {skill.xpToNext} XP to next level</span>
                        <a href={`/lenses/${skill.linkedLens}`} className="flex items-center gap-0.5 text-neon-cyan hover:underline">
                          Practice <ChevronRight className="w-3 h-3" />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Skill categories */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['technical', 'creative', 'business'] as const).map((cat) => (
                <div key={cat} className="panel p-4">
                  <h4 className={`text-sm font-semibold capitalize mb-3 ${categoryColor(cat)}`}>
                    {cat === 'technical' ? 'Technical' : cat === 'creative' ? 'Creative' : 'Business'}
                  </h4>
                  <div className="space-y-2">
                    {(cat === 'technical'
                      ? ['DAW Proficiency', 'Mixing', 'Mastering']
                      : cat === 'creative'
                      ? ['Composition', 'Arrangement', 'Sound Design']
                      : ['Marketing', 'Networking', 'Branding']
                    ).map((subSkill) => {
                      const matched = skillsByCategory[cat].find(
                        (s) => s.name.toLowerCase() === subSkill.toLowerCase()
                      );
                      const level = matched ? matched.level : Math.floor(Math.random() * 5) + 2;
                      return (
                        <div key={subSkill} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">{subSkill}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  cat === 'technical'
                                    ? 'bg-neon-cyan'
                                    : cat === 'creative'
                                    ? 'bg-neon-purple'
                                    : 'bg-neon-yellow'
                                }`}
                                style={{ width: `${(level / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-gray-500 w-4 text-right">{level}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ---------- History Tab ---------- */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={fadeUp}
            className="space-y-6"
          >
            {(['today', 'this_week', 'this_month', 'earlier'] as const).map((group) => {
              const items = groupedHistory[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {groupLabel(group)}
                  </h3>
                  <motion.div
                    className="relative ml-4 border-l border-lattice-border pl-6 space-y-4"
                    variants={staggerParent}
                    initial="hidden"
                    animate="visible"
                  >
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        variants={staggerChild}
                        className="relative"
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[33px] top-1 w-6 h-6 rounded-full bg-lattice-deep border border-lattice-border flex items-center justify-center">
                          {historyIcon(item.type)}
                        </div>
                        <div className="lens-card">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                            </div>
                            <span className="text-[10px] text-gray-500 flex-shrink-0 ml-4 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.timestamp}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ---------- Insights Tab ---------- */}
        {activeTab === 'insights' && (
          <motion.div
            key="insights"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={fadeUp}
            className="space-y-6"
          >
            {/* Top stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="lens-card text-center py-4">
                <Flame className="w-6 h-6 mx-auto mb-2 text-orange-400" />
                <p className="text-lg font-bold">{DEMO_INSIGHTS.mostProductiveDay}</p>
                <p className="text-xs text-gray-400">Most Productive Day</p>
              </div>
              <div className="lens-card text-center py-4">
                <Music className="w-6 h-6 mx-auto mb-2 text-neon-purple" />
                <p className="text-lg font-bold">{DEMO_INSIGHTS.favoriteGenre}</p>
                <p className="text-xs text-gray-400">Favorite Genre</p>
              </div>
              <div className="lens-card text-center py-4">
                <Users className="w-6 h-6 mx-auto mb-2 text-neon-cyan" />
                <p className="text-lg font-bold">{DEMO_INSIGHTS.collaborationScore}%</p>
                <p className="text-xs text-gray-400">Collaboration Score</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly Activity Heatmap */}
              <div className="panel p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-neon-green" />
                  Weekly Activity Heatmap
                </h3>
                <div className="space-y-1.5">
                  {DEMO_INSIGHTS.weeklyHeatmap.map((row, dayIdx) => (
                    <div key={dayIdx} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-7">{DAY_LABELS[dayIdx]}</span>
                      <div className="flex gap-1.5">
                        {row.map((val, weekIdx) => (
                          <motion.div
                            key={weekIdx}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: dayIdx * 0.04 + weekIdx * 0.06, duration: 0.2 }}
                            className={`w-8 h-8 rounded-md ${HEAT_COLORS[val]} border border-white/5`}
                            title={`Week ${weekIdx + 1}: ${val} sessions`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-3 ml-9">
                    <span className="text-[10px] text-gray-500">Less</span>
                    {HEAT_COLORS.map((c, i) => (
                      <div key={i} className={`w-4 h-4 rounded-sm ${c} border border-white/5`} />
                    ))}
                    <span className="text-[10px] text-gray-500">More</span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="panel p-4">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-neon-yellow" />
                  Learning Recommendations
                </h3>
                <motion.div
                  className="space-y-3"
                  variants={staggerParent}
                  initial="hidden"
                  animate="visible"
                >
                  {DEMO_INSIGHTS.recommendations.map((rec, i) => (
                    <motion.div
                      key={i}
                      variants={staggerChild}
                      className="flex items-start gap-3 lens-card"
                    >
                      <div className="w-6 h-6 rounded-full bg-neon-yellow/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Zap className="w-3 h-3 text-neon-yellow" />
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{rec}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Additional insight cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lens-card">
                <Trophy className="w-5 h-5 text-neon-yellow mb-2" />
                <p className="text-sm font-semibold">Top 10%</p>
                <p className="text-xs text-gray-400">Sound Design ranking among peers</p>
              </div>
              <div className="lens-card">
                <TrendingUp className="w-5 h-5 text-neon-green mb-2" />
                <p className="text-sm font-semibold">+23% This Month</p>
                <p className="text-xs text-gray-400">Production output increase</p>
              </div>
              <div className="lens-card">
                <Target className="w-5 h-5 text-neon-cyan mb-2" />
                <p className="text-sm font-semibold">4 / 5 Goals</p>
                <p className="text-xs text-gray-400">Monthly goals completed</p>
              </div>
              <div className="lens-card">
                <Star className="w-5 h-5 text-pink-400 mb-2" />
                <p className="text-sm font-semibold">12 Endorsements</p>
                <p className="text-xs text-gray-400">Received this month</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
