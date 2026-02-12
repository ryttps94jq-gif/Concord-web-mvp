'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { Clock, Target, TrendingUp, Calendar, Milestone, Rocket, Loader2 } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { ErrorState } from '@/components/common/EmptyState';

interface MilestoneData {
  year: number;
  description: string;
  status: 'completed' | 'current' | 'future';
  confidence: number;
}

const SEED_MILESTONES: { title: string; data: Record<string, unknown> }[] = [];

export default function LegacyLensPage() {
  useLensNav('legacy');

  const { items: milestoneItems, isLoading, isError, error, refetch } = useLensData<MilestoneData>('legacy', 'milestone', {
    seed: SEED_MILESTONES,
  });

  const milestones = milestoneItems.map((item) => ({
    year: item.data.year,
    title: item.title,
    description: item.data.description,
    status: item.data.status,
    confidence: item.data.confidence,
  })).sort((a, b) => a.year - b.year);

  const currentYear = new Date().getFullYear();
  const bioAge = milestones.length > 0
    ? Math.max(...milestones.map((m) => m.year)) - currentYear
    : 340;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
        <span className="ml-3 text-gray-400">Loading legacy timeline...</span>
      </div>
    );
  }


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🏛️</span>
        <div>
          <h1 className="text-xl font-bold">Legacy Lens</h1>
          <p className="text-sm text-gray-400">
            400-year vision planner based on bioAge projections
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{bioAge}</p>
          <p className="text-sm text-gray-400">Projected Years</p>
        </div>
        <div className="lens-card">
          <Target className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">400</p>
          <p className="text-sm text-gray-400">Vision Horizon</p>
        </div>
        <div className="lens-card">
          <Milestone className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{milestones.length}</p>
          <p className="text-sm text-gray-400">Milestones</p>
        </div>
        <div className="lens-card">
          <TrendingUp className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{((bioAge / 400) * 100).toFixed(0)}%</p>
          <p className="text-sm text-gray-400">Progress</p>
        </div>
      </div>

      {/* Vision Timeline */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neon-purple" />
          400-Year Timeline
        </h2>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-lattice-border" />
          <div className="space-y-6">
            {milestones.map((milestone) => (
              <div key={milestone.year} className="relative flex gap-4 pl-10">
                <div
                  className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                    milestone.status === 'completed'
                      ? 'bg-neon-green border-neon-green'
                      : milestone.status === 'current'
                      ? 'bg-neon-blue border-neon-blue animate-pulse'
                      : 'bg-lattice-surface border-lattice-border'
                  }`}
                />
                <div className="flex-1 lens-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-neon-cyan">{milestone.year}</span>
                      <span className="font-semibold">{milestone.title}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        milestone.status === 'current'
                          ? 'bg-neon-blue/20 text-neon-blue'
                          : milestone.status === 'completed'
                          ? 'bg-neon-green/20 text-neon-green'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {milestone.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{milestone.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <div className="flex-1 h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-neon-green to-neon-blue"
                        style={{ width: `${milestone.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">
                      {(milestone.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Founder Intent */}
      <div className="panel p-4 border-l-4 border-neon-purple">
        <h3 className="font-semibold text-neon-purple mb-2 flex items-center gap-2">
          <Rocket className="w-4 h-4" />
          Founder Intent Structural
        </h3>
        <p className="text-sm text-gray-400">
          This lens embodies the 400-year vision: a self-sustaining cognitive system
          that preserves founder values through structural constraints, not runtime rules.
          The bioAge projection ({bioAge} years) indicates organism health and expected
          continuity based on current organ states and homeostasis levels.
        </p>
      </div>
    </div>
  );
}
