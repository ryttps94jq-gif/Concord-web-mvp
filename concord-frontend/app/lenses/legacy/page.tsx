'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Clock, Target, TrendingUp, Calendar, Milestone, Rocket } from 'lucide-react';

interface Milestone {
  year: number;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'future';
  confidence: number;
}

export default function LegacyLensPage() {
  useLensNav('legacy');
  const [bioAge] = useState(340); // years projected

  const milestones: Milestone[] = [
    { year: 2026, title: 'Foundation', description: 'Concord OS v1 launch, 50+ lenses', status: 'current', confidence: 1.0 },
    { year: 2030, title: 'Swarm Scaling', description: '10,000+ entities, distributed cognition', status: 'future', confidence: 0.85 },
    { year: 2050, title: 'Global Network', description: 'Federated Concord instances worldwide', status: 'future', confidence: 0.72 },
    { year: 2100, title: 'Centennial', description: 'Self-sustaining cognitive ecosystem', status: 'future', confidence: 0.58 },
    { year: 2200, title: 'Bicentennial', description: 'Multi-generational knowledge transfer', status: 'future', confidence: 0.42 },
    { year: 2400, title: '400-Year Vision', description: 'Complete founder intent realization', status: 'future', confidence: 0.25 },
  ];

  const currentYear = 2026;
  const _yearsToGo = 400 - (currentYear - 2026);

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
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-lattice-border" />

          <div className="space-y-6">
            {milestones.map((milestone) => (
              <div key={milestone.year} className="relative flex gap-4 pl-10">
                {/* Dot */}
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
