'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { Loading } from '@/components/common/Loading';
import { useState } from 'react';
import { Heart, Scale, Brain, MessageSquare, Shield } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface FrameworkData {
  name: string;
  desc: string;
  weight: number;
}

interface MoralDTUData {
  framework: string;
  position: string;
  weight: number;
}

const SEED_FRAMEWORKS = [
  {
    title: 'Utilitarianism',
    data: { name: 'Utilitarianism', desc: 'Greatest good for greatest number', weight: 0.3 },
  },
  {
    title: 'Deontology',
    data: { name: 'Deontology', desc: 'Duty-based ethics', weight: 0.25 },
  },
  {
    title: 'Virtue Ethics',
    data: { name: 'Virtue Ethics', desc: 'Character-based approach', weight: 0.25 },
  },
  {
    title: 'Care Ethics',
    data: { name: 'Care Ethics', desc: 'Relationship-centered', weight: 0.2 },
  },
];

const SEED_MORAL_DTUS = [
  {
    title: 'Maximize aggregate wellbeing',
    data: { framework: 'Utilitarianism', position: 'Maximize aggregate wellbeing', weight: 0.85 },
  },
  {
    title: 'Respect rational autonomy',
    data: { framework: 'Deontology', position: 'Respect rational autonomy', weight: 0.78 },
  },
  {
    title: 'Cultivate practical wisdom',
    data: { framework: 'Virtue Ethics', position: 'Cultivate practical wisdom', weight: 0.82 },
  },
];

export default function EthicsLensPage() {
  useLensNav('ethics');
  const [dilemma, setDilemma] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const { items: frameworkItems, isLoading: frameworksLoading, isError, error, refetch } = useLensData<FrameworkData>(
    'ethics',
    'framework',
    { seed: SEED_FRAMEWORKS }
  );

  const { items: moralDTUItems, isLoading: moralDTUsLoading, isError: isError2, error: error2, refetch: refetch2 } = useLensData<MoralDTUData>(
    'ethics',
    'moral-dtu',
    { seed: SEED_MORAL_DTUS }
  );

  // Map lens items to the shapes used in rendering
  const frameworks = frameworkItems.map((item) => ({
    id: item.id,
    name: item.title || item.data?.name || '',
    desc: item.data?.desc || '',
    weight: item.data?.weight ?? 0,
  }));

  const moralDTUs = moralDTUItems.map((item) => ({
    id: item.id,
    framework: item.data?.framework || '',
    position: item.data?.position || item.title || '',
    weight: item.data?.weight ?? 0,
  }));

  const handleAnalyzeDilemma = async () => {
    if (!dilemma.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const { data } = await apiHelpers.chat.ask(dilemma, 'ethics');
      const responseText =
        data?.answer || data?.response || data?.message || JSON.stringify(data);
      setAnalysisResult(responseText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setAnalysisResult(`Analysis failed: ${errorMessage}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const isLoading = frameworksLoading || moralDTUsLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loading text="Loading ethics frameworks..." />
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
          onClick={handleAnalyzeDilemma}
          disabled={analyzing || !dilemma}
          className="btn-neon purple w-full"
        >
          {analyzing ? 'Analyzing across frameworks...' : 'Analyze Dilemma'}
        </button>

        {/* Analysis Result */}
        {analysisResult && (
          <div className="mt-4 p-4 bg-lattice-deep rounded-lg border border-neon-purple/20">
            <h3 className="text-sm font-semibold text-neon-purple mb-2">Analysis Result</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{analysisResult}</p>
          </div>
        )}
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
