'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Brain, Play, Square, Activity, Database, Cpu, Settings } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'generation';
  status: 'ready' | 'training' | 'failed';
  accuracy?: number;
  lastTrained?: string;
}

export default function MLLensPage() {
  useLensNav('ml');

  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [inputData, setInputData] = useState('');

  const { data: models } = useQuery({
    queryKey: ['ml-models'],
    queryFn: () => api.get('/api/ml/models').then((r) => r.data),
  });

  const { data: trainingJobs } = useQuery({
    queryKey: ['ml-jobs'],
    queryFn: () => api.get('/api/ml/jobs').then((r) => r.data),
  });

  const { data: metrics } = useQuery({
    queryKey: ['ml-metrics'],
    queryFn: () => api.get('/api/ml/metrics').then((r) => r.data),
  });

  const runInference = useMutation({
    mutationFn: (payload: { modelId: string; input: string }) =>
      api.post('/api/ml/infer', payload),
  });

  const startTraining = useMutation({
    mutationFn: (modelId: string) => api.post(`/api/ml/train/${modelId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-jobs'] });
    },
  });

  const statusColors = {
    ready: 'bg-neon-green/20 text-neon-green',
    training: 'bg-neon-blue/20 text-neon-blue animate-pulse',
    failed: 'bg-neon-pink/20 text-neon-pink',
  };

  const typeColors = {
    classification: 'text-neon-purple',
    regression: 'text-neon-blue',
    clustering: 'text-neon-cyan',
    generation: 'text-neon-pink',
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-xl font-bold">ML Lens</h1>
            <p className="text-sm text-gray-400">
              Machine learning model management and inference
            </p>
          </div>
        </div>
      </header>

      {/* System Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Cpu className="w-6 h-6 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{metrics?.gpuUsage || 0}%</p>
          <p className="text-sm text-gray-400">GPU Usage</p>
        </div>
        <div className="lens-card">
          <Database className="w-6 h-6 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{metrics?.memoryUsage || 0}%</p>
          <p className="text-sm text-gray-400">Memory</p>
        </div>
        <div className="lens-card">
          <Brain className="w-6 h-6 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{models?.models?.length || 0}</p>
          <p className="text-sm text-gray-400">Models</p>
        </div>
        <div className="lens-card">
          <Activity className="w-6 h-6 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{trainingJobs?.active || 0}</p>
          <p className="text-sm text-gray-400">Active Jobs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Models List */}
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-neon-purple" />
            Available Models
          </h3>
          <div className="space-y-2">
            {models?.models?.map((model: Model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`w-full text-left lens-card ${
                  selectedModel === model.id ? 'border-neon-cyan' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{model.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[model.status]}`}>
                    {model.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={typeColors[model.type]}>{model.type}</span>
                  {model.accuracy !== undefined && (
                    <span className="text-gray-400">
                      {(model.accuracy * 100).toFixed(1)}% acc
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Inference Panel */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Play className="w-4 h-4 text-neon-green" />
            Inference
          </h3>

          {selectedModel ? (
            <>
              <div className="lens-card">
                <p className="text-sm text-gray-400 mb-1">Selected Model</p>
                <p className="font-medium">
                  {models?.models?.find((m: Model) => m.id === selectedModel)?.name}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Input Data (JSON)</label>
                <textarea
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                  placeholder='{"features": [1.0, 2.0, 3.0]}'
                  className="input-lattice font-mono text-sm h-32 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    runInference.mutate({ modelId: selectedModel, input: inputData })
                  }
                  disabled={!inputData || runInference.isPending}
                  className="btn-neon purple flex-1"
                >
                  <Play className="w-4 h-4 mr-2 inline" />
                  {runInference.isPending ? 'Running...' : 'Run Inference'}
                </button>
                <button
                  onClick={() => startTraining.mutate(selectedModel)}
                  disabled={startTraining.isPending}
                  className="btn-neon"
                >
                  <Settings className="w-4 h-4 mr-2 inline" />
                  Train
                </button>
              </div>

              {runInference.data && (
                <div className="lens-card">
                  <p className="text-sm text-gray-400 mb-2">Output</p>
                  <pre className="text-sm font-mono text-neon-green overflow-auto">
                    {JSON.stringify(runInference.data, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a model to run inference</p>
            </div>
          )}
        </div>
      </div>

      {/* Training Jobs */}
      <div className="panel p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-neon-blue" />
          Training Jobs
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-lattice-border">
                <th className="pb-2">Model</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Progress</th>
                <th className="pb-2">Started</th>
                <th className="pb-2">ETA</th>
              </tr>
            </thead>
            <tbody>
              {trainingJobs?.jobs?.map((job: any) => (
                <tr key={job.id} className="border-b border-lattice-border/50">
                  <td className="py-3 font-medium">{job.modelName}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded ${statusColors[job.status]}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-lattice-deep rounded-full">
                        <div
                          className="h-full bg-neon-blue rounded-full"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{job.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-sm text-gray-400">
                    {new Date(job.startedAt).toLocaleString()}
                  </td>
                  <td className="py-3 text-sm text-gray-400">{job.eta || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
