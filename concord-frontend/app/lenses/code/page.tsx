'use client';

import { useState } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Code2, Play, FileCode, Terminal } from 'lucide-react';

export default function CodeLensPage() {
  useLensNav('code');
  const [code, setCode] = useState('// Write or paste code here\n');
  const [output, setOutput] = useState('');

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/ask', {
        query: `Analyze this code and suggest improvements:\n\n${code}`,
        mode: 'debug',
      });
      return res.data;
    },
    onSuccess: (data) => {
      setOutput(data.answer || data.reply || 'No analysis available');
    },
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💻</span>
          <div>
            <h1 className="text-xl font-bold">Code Lens</h1>
            <p className="text-sm text-gray-400">
              Code analysis, generation, and wrapper studio
            </p>
          </div>
        </div>
        <button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="btn-neon flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          Analyze
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Editor */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-neon-blue" />
            Code Input
          </h2>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-[400px] bg-lattice-deep border border-lattice-border rounded-lg p-4 font-mono text-sm text-white resize-none focus:outline-none focus:border-neon-blue/50"
            placeholder="// Write or paste code here"
          />
        </div>

        {/* Output */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neon-green" />
            Analysis Output
          </h2>
          <div className="w-full h-[400px] bg-lattice-deep border border-lattice-border rounded-lg p-4 overflow-auto">
            {analyzeMutation.isPending ? (
              <div className="flex items-center gap-2 text-neon-blue">
                <div className="w-4 h-4 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </div>
            ) : (
              <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap">
                {output || 'Click "Analyze" to get code analysis'}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction icon={<Code2 className="w-5 h-5" />} label="Format Code" />
        <QuickAction icon={<FileCode className="w-5 h-5" />} label="Generate Tests" />
        <QuickAction icon={<Terminal className="w-5 h-5" />} label="Run Sandbox" />
        <QuickAction icon={<Play className="w-5 h-5" />} label="Create Wrapper" />
      </div>
    </div>
  );
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="lens-card flex items-center justify-center gap-2 py-4 hover:border-neon-blue/50">
      <span className="text-neon-blue">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
