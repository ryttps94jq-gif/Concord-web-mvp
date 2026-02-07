'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Heart, Scale, Brain, MessageSquare, Shield } from 'lucide-react';

interface MoralDTU {
  id: string;
  framework: string;
  position: string;
  weight: number;
}

export default function EthicsLensPage() {
  useLensNav('ethics');
  const [dilemma, setDilemma] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const frameworks = [
    { id: 'util', name: 'Utilitarianism', desc: 'Greatest good for greatest number', weight: 0.3 },
    { id: 'deont', name: 'Deontology', desc: 'Duty-based ethics', weight: 0.25 },
    { id: 'virtue', name: 'Virtue Ethics', desc: 'Character-based approach', weight: 0.25 },
    { id: 'care', name: 'Care Ethics', desc: 'Relationship-centered', weight: 0.2 },
  ];

  const moralDTUs: MoralDTU[] = [
    { id: 'm-001', framework: 'Utilitarianism', position: 'Maximize aggregate wellbeing', weight: 0.85 },
    { id: 'm-002', framework: 'Deontology', position: 'Respect rational autonomy', weight: 0.78 },
    { id: 'm-003', framework: 'Virtue Ethics', position: 'Cultivate practical wisdom', weight: 0.82 },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">🧭</span>
        <div>
          <h1 className="text-xl font-bold">Ethics Lens</h1>
          <p className="text-sm text-gray-400">
            Invariant simulator for moral philosophy queues
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Scale className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{frameworks.length}</p>
          <p className="text-sm text-gray-400">Frameworks</p>
        </div>
        <div className="lens-card">
          <Brain className="w-5 h-5 text-neon-pink mb-2" />
          <p className="text-2xl font-bold">{moralDTUs.length}</p>
          <p className="text-sm text-gray-400">Moral DTUs</p>
        </div>
        <div className="lens-card">
          <Heart className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">88%</p>
          <p className="text-sm text-gray-400">Coherence</p>
        </div>
        <div className="lens-card">
          <Shield className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">Active</p>
          <p className="text-sm text-gray-400">Ethics Gate</p>
        </div>
      </div>

      {/* Dilemma Analyzer */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neon-purple" />
          Moral Dilemma Analyzer
        </h2>
        <textarea
          value={dilemma}
          onChange={(e) => setDilemma(e.target.value)}
          placeholder="Describe an ethical dilemma for multi-framework analysis..."
          className="input-lattice w-full h-24 resize-none mb-4"
        />
        <button
          onClick={() => {
            setAnalyzing(true);
            setTimeout(() => setAnalyzing(false), 1500);
          }}
          disabled={analyzing || !dilemma}
          className="btn-neon purple w-full"
        >
          {analyzing ? 'Analyzing across frameworks...' : 'Analyze Dilemma'}
        </button>
      </div>

      {/* Ethical Frameworks */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Scale className="w-4 h-4 text-neon-blue" />
          Active Frameworks
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {frameworks.map((fw) => (
            <div key={fw.id} className="lens-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{fw.name}</span>
                <span className="text-neon-cyan">{(fw.weight * 100).toFixed(0)}%</span>
              </div>
              <p className="text-sm text-gray-400 mb-2">{fw.desc}</p>
              <div className="h-2 bg-lattice-deep rounded-full overflow-hidden">
                <div className="h-full bg-neon-purple" style={{ width: `${fw.weight * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Moral DTUs */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4 text-neon-pink" />
          Moral DTU Queue
        </h2>
        <div className="space-y-3">
          {moralDTUs.map((dtu) => (
            <div key={dtu.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
              <div>
                <p className="font-medium">{dtu.position}</p>
                <p className="text-xs text-gray-500">{dtu.framework}</p>
              </div>
              <span className="text-neon-green font-mono">{(dtu.weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
