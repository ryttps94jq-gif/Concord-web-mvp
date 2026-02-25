'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { ds } from '@/lib/design-system';
import {
  Brain, Sparkles, Compass, TrendingUp, Zap,
  Moon, Globe, BarChart3, BookOpen, Target,
} from 'lucide-react';

type TabId = 'personality' | 'dreams' | 'stats';

const ARCHETYPE_COLORS: Record<string, string> = {
  analytical: 'text-neon-blue',
  creative: 'text-neon-purple',
  philosophical: 'text-neon-cyan',
  practical: 'text-neon-green',
  social: 'text-neon-pink',
  scientific: 'text-yellow-400',
};

const ARCHETYPE_ICONS: Record<string, React.ReactNode> = {
  analytical: <BarChart3 className="w-5 h-5" />,
  creative: <Sparkles className="w-5 h-5" />,
  philosophical: <BookOpen className="w-5 h-5" />,
  practical: <Target className="w-5 h-5" />,
  social: <Globe className="w-5 h-5" />,
  scientific: <Compass className="w-5 h-5" />,
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>('personality');

  const { data: personalityData, isLoading: personalityLoading } = useQuery({
    queryKey: ['personality'],
    queryFn: () => api.get('/api/universe/personality').then((r) => r.data),
    retry: 1,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['universe-stats'],
    queryFn: () => api.get('/api/universe/stats').then((r) => r.data),
    retry: 1,
  });

  const { data: dreamsData, isLoading: dreamsLoading } = useQuery({
    queryKey: ['dreams'],
    queryFn: () => api.get('/api/universe/dreams').then((r) => r.data),
    retry: 1,
  });

  const personality = personalityData?.personality;
  const stats = statsData?.universe || statsData;
  const dreams = dreamsData?.dreams || [];

  return (
    <div className="min-h-screen bg-lattice-void text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-lattice-surface/80 backdrop-blur border-b border-lattice-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Cognitive Profile</h1>
              <p className="text-xs text-gray-500">Your knowledge personality and dream log</p>
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className={ds.tabBar}>
            {([
              { id: 'personality' as TabId, label: 'Personality', icon: <Sparkles className="w-4 h-4" /> },
              { id: 'dreams' as TabId, label: 'Dream Log', icon: <Moon className="w-4 h-4" /> },
              { id: 'stats' as TabId, label: 'Universe Stats', icon: <TrendingUp className="w-4 h-4" /> },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? ds.tabActive('neon-purple') : ds.tabInactive}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'personality' && (
          <PersonalityTab personality={personality} loading={personalityLoading} />
        )}
        {activeTab === 'dreams' && (
          <DreamsTab dreams={dreams} loading={dreamsLoading} total={dreamsData?.total || 0} />
        )}
        {activeTab === 'stats' && (
          <StatsTab stats={stats} loading={statsLoading} />
        )}
      </main>
    </div>
  );
}

// ── Personality Tab ──────────────────────────────────────────────────────────

function PersonalityTab({ personality, loading }: { personality: Record<string, unknown> | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-neon-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!personality) {
    return (
      <div className={cn(ds.panel, 'text-center py-16')}>
        <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">No personality data yet</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Your cognitive profile will develop as you explore domains and create DTUs.
          Start chatting or browsing lenses to build your profile.
        </p>
      </div>
    );
  }

  const archetypeScores = (personality.archetypeScores || {}) as Record<string, number>;
  const topDomains = (personality.topDomains || []) as { domain: string; count: number }[];
  const leastExplored = (personality.leastExplored || []) as string[];
  const diversityScore = (personality.diversityScore || 0) as number;
  const description = (personality.description || '') as string;
  const totalDTUs = (personality.totalDTUs || 0) as number;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className={cn(ds.panel, 'bg-gradient-to-br from-lattice-surface to-lattice-deep')}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-neon-purple/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-7 h-7 text-neon-purple" />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-1">Your Cognitive Signature</h2>
            <p className="text-gray-300">{description}</p>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-gray-500"><Zap className="w-4 h-4 inline mr-1" />{totalDTUs} DTUs</span>
              <span className="text-gray-500"><Compass className="w-4 h-4 inline mr-1" />{diversityScore}% diversity</span>
            </div>
          </div>
        </div>
      </div>

      {/* Archetype Scores */}
      <div className={ds.panel}>
        <h3 className={cn(ds.heading3, 'mb-4')}>Archetype Distribution</h3>
        <div className="space-y-3">
          {Object.entries(archetypeScores)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([archetype, score]) => (
              <div key={archetype} className="flex items-center gap-3">
                <span className={cn('w-6', ARCHETYPE_COLORS[archetype] || 'text-gray-400')}>
                  {ARCHETYPE_ICONS[archetype] || <Zap className="w-5 h-5" />}
                </span>
                <span className="w-28 text-sm capitalize text-gray-300">{archetype}</span>
                <div className="flex-1 h-3 bg-lattice-deep rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      archetype === 'analytical' ? 'bg-neon-blue' :
                      archetype === 'creative' ? 'bg-neon-purple' :
                      archetype === 'philosophical' ? 'bg-neon-cyan' :
                      archetype === 'practical' ? 'bg-neon-green' :
                      archetype === 'social' ? 'bg-neon-pink' :
                      'bg-yellow-400'
                    )}
                    style={{ width: `${Math.min(score as number, 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-mono text-gray-400">{score}%</span>
              </div>
            ))}
        </div>
      </div>

      {/* Domains */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top domains */}
        <div className={ds.panel}>
          <h3 className={cn(ds.heading3, 'mb-3')}>Top Domains</h3>
          {topDomains.length === 0 ? (
            <p className={ds.textMuted}>No domain data yet</p>
          ) : (
            <div className="space-y-2">
              {topDomains.map((d, i) => (
                <div key={d.domain} className="flex items-center justify-between">
                  <span className="text-sm">
                    <span className="text-gray-500 mr-2">#{i + 1}</span>
                    <span className="text-gray-200">{d.domain}</span>
                  </span>
                  <span className="text-sm font-mono text-neon-cyan">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Least explored */}
        <div className={ds.panel}>
          <h3 className={cn(ds.heading3, 'mb-3')}>Unexplored Domains</h3>
          {leastExplored.length === 0 ? (
            <p className={ds.textMuted}>You've explored all domains!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {leastExplored.map((d) => (
                <span
                  key={d}
                  className="px-3 py-1 rounded-full border border-lattice-border bg-lattice-deep text-xs text-gray-400"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diversity Score */}
      <div className={ds.panel}>
        <h3 className={cn(ds.heading3, 'mb-2')}>Knowledge Diversity</h3>
        <p className={ds.textMuted}>Shannon entropy normalized across all lens domains</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex-1 h-4 bg-lattice-deep rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                diversityScore > 60 ? 'bg-neon-green' :
                diversityScore > 30 ? 'bg-neon-blue' :
                'bg-neon-purple'
              )}
              style={{ width: `${diversityScore}%` }}
            />
          </div>
          <span className="text-lg font-bold font-mono">{diversityScore}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Dreams Tab ───────────────────────────────────────────────────────────────

function DreamsTab({ dreams, loading, total }: { dreams: Record<string, unknown>[]; loading: boolean; total: number }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (dreams.length === 0) {
    return (
      <div className={cn(ds.panel, 'text-center py-16')}>
        <Moon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">No dreams yet</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          The Concord engine generates emergent DTUs while you're away — new ideas,
          pattern discoveries, and knowledge connections. They'll appear here as your "dream log."
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={ds.heading3}>
          <Moon className="w-5 h-5 inline mr-2 text-neon-cyan" />
          Recent Dreams ({total})
        </h2>
        <span className={ds.textMuted}>Auto-generated DTUs since your last session</span>
      </div>

      <div className="space-y-3">
        {dreams.map((dream) => {
          const d = dream as { id: string; title: string; tags: string[]; tier: string; createdAt: string; source: string; preview: string; fromGlobal?: boolean };
          return (
            <div
              key={d.id}
              className={cn(
                ds.panel,
                'hover:border-neon-cyan/30 transition-colors',
                d.fromGlobal && 'border-l-2 border-l-neon-blue/50'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-white">{d.title || 'Untitled Dream'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan">
                      {d.source}
                    </span>
                    {d.fromGlobal && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neon-blue/10 text-neon-blue">
                        global
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{d.tier}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}
                </span>
              </div>
              {d.preview && (
                <p className="text-sm text-gray-400 line-clamp-2">{d.preview}</p>
              )}
              {d.tags && d.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {d.tags.slice(0, 5).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-lattice-deep text-gray-500">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ stats, loading }: { stats: Record<string, unknown> | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats || !stats.ok) {
    return (
      <div className={cn(ds.panel, 'text-center py-16')}>
        <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">No universe initialized</h3>
        <p className="text-gray-500 text-sm">
          Initialize your universe from the onboarding page to see stats here.
        </p>
      </div>
    );
  }

  const s = stats as Record<string, unknown>;
  const localDTUCount = (s.localDTUCount || 0) as number;
  const syncedFromGlobal = (s.syncedFromGlobal || 0) as number;
  const domainDistribution = (s.domainDistribution || {}) as Record<string, number>;
  const domainEntries = Object.entries(domainDistribution).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Local DTUs" value={localDTUCount} color="blue" icon={<Zap className="w-5 h-5" />} />
        <StatCard label="Synced from Global" value={syncedFromGlobal} color="purple" icon={<Globe className="w-5 h-5" />} />
        <StatCard label="Domains Active" value={domainEntries.length} color="cyan" icon={<Compass className="w-5 h-5" />} />
        <StatCard label="Created" value={(s.createdAt as string)?.split('T')[0] || 'Unknown'} color="green" icon={<BookOpen className="w-5 h-5" />} />
      </div>

      {/* Domain distribution */}
      {domainEntries.length > 0 && (
        <div className={ds.panel}>
          <h3 className={cn(ds.heading3, 'mb-4')}>Domain Distribution</h3>
          <div className="space-y-2">
            {domainEntries.slice(0, 20).map(([domain, count]) => {
              const maxCount = domainEntries[0]?.[1] || 1;
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={domain} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-300 truncate">{domain}</span>
                  <div className="flex-1 h-2 bg-lattice-deep rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon-cyan rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-mono text-gray-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'text-neon-blue border-neon-blue/20 bg-neon-blue/5',
    purple: 'text-neon-purple border-neon-purple/20 bg-neon-purple/5',
    cyan: 'text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5',
    green: 'text-neon-green border-neon-green/20 bg-neon-green/5',
  };
  return (
    <div className={cn('rounded-xl border p-4', colors[color] || colors.blue)}>
      <div className="flex items-center gap-3">
        <span className="opacity-70">{icon}</span>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
