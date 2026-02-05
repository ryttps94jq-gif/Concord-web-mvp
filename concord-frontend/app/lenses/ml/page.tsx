'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Play, Square, Activity, Database, Cpu, Settings, Plus, ChevronRight,
  BarChart2, TrendingUp, TrendingDown, Download, Upload, Trash2, RefreshCw,
  Zap, GitBranch, Layers, Target, Clock, CheckCircle, XCircle, AlertTriangle,
  Eye, Code, FileJson, Grid3X3, List, Search, Filter, ArrowRight, X, Copy,
  Save, Share2, Rocket, TestTube, Beaker, LineChart, PieChart, Box, Gauge
} from 'lucide-react';

// Types
interface Model {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'generation' | 'embedding' | 'transformer';
  framework: 'pytorch' | 'tensorflow' | 'sklearn' | 'custom';
  status: 'ready' | 'training' | 'failed' | 'deploying' | 'deployed';
  version: string;
  accuracy?: number;
  f1Score?: number;
  loss?: number;
  parameters: number;
  size: string;
  lastTrained?: string;
  description?: string;
  tags?: string[];
  deployedAt?: string;
  endpoint?: string;
}

interface Experiment {
  id: string;
  name: string;
  modelId: string;
  status: 'running' | 'completed' | 'failed' | 'queued';
  hyperparams: Record<string, any>;
  metrics: {
    epoch: number;
    trainLoss: number;
    valLoss: number;
    accuracy: number;
    learningRate: number;
  }[];
  startedAt: string;
  completedAt?: string;
  duration?: string;
}

interface Dataset {
  id: string;
  name: string;
  size: number;
  samples: number;
  features: number;
  type: 'tabular' | 'image' | 'text' | 'audio';
  splits: { train: number; val: number; test: number };
  createdAt: string;
}

interface Deployment {
  id: string;
  modelId: string;
  modelName: string;
  version: string;
  status: 'active' | 'inactive' | 'scaling';
  endpoint: string;
  replicas: number;
  requestsPerSec: number;
  avgLatency: number;
  errorRate: number;
  createdAt: string;
}

type Tab = 'models' | 'experiments' | 'datasets' | 'deployments' | 'playground';
type ViewMode = 'grid' | 'list';

// Mock data
const MOCK_MODELS: Model[] = [
  {
    id: 'model-1',
    name: 'DTU Classifier v3',
    type: 'classification',
    framework: 'pytorch',
    status: 'deployed',
    version: '3.2.1',
    accuracy: 0.942,
    f1Score: 0.938,
    loss: 0.156,
    parameters: 12500000,
    size: '48 MB',
    lastTrained: '2026-01-28',
    description: 'Multi-class classification model for DTU categorization',
    tags: ['production', 'classification', 'nlp'],
    deployedAt: '2026-01-29',
    endpoint: '/api/ml/infer/dtu-classifier'
  },
  {
    id: 'model-2',
    name: 'Embedding Model',
    type: 'embedding',
    framework: 'pytorch',
    status: 'ready',
    version: '2.0.0',
    accuracy: 0.891,
    parameters: 25000000,
    size: '95 MB',
    lastTrained: '2026-01-20',
    description: 'Dense vector embeddings for semantic search',
    tags: ['embeddings', 'search']
  },
  {
    id: 'model-3',
    name: 'Sentiment Analyzer',
    type: 'classification',
    framework: 'tensorflow',
    status: 'training',
    version: '1.5.0',
    parameters: 8000000,
    size: '32 MB',
    description: 'Real-time sentiment analysis for user content',
    tags: ['nlp', 'sentiment']
  },
  {
    id: 'model-4',
    name: 'Content Generator',
    type: 'generation',
    framework: 'pytorch',
    status: 'ready',
    version: '1.0.0',
    parameters: 175000000,
    size: '680 MB',
    lastTrained: '2026-01-15',
    description: 'GPT-style model for content generation',
    tags: ['generation', 'llm']
  },
  {
    id: 'model-5',
    name: 'Anomaly Detector',
    type: 'clustering',
    framework: 'sklearn',
    status: 'ready',
    version: '2.1.0',
    accuracy: 0.967,
    parameters: 50000,
    size: '2 MB',
    lastTrained: '2026-01-25',
    description: 'Isolation forest for anomaly detection',
    tags: ['anomaly', 'security']
  }
];

const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: 'exp-1',
    name: 'DTU Classifier Hypertuning',
    modelId: 'model-1',
    status: 'running',
    hyperparams: { learningRate: 0.001, batchSize: 32, epochs: 100, dropout: 0.3 },
    metrics: Array.from({ length: 45 }, (_, i) => ({
      epoch: i + 1,
      trainLoss: 2.5 - (i * 0.04) + Math.random() * 0.1,
      valLoss: 2.6 - (i * 0.035) + Math.random() * 0.15,
      accuracy: 0.3 + (i * 0.014) + Math.random() * 0.02,
      learningRate: 0.001 * Math.pow(0.95, Math.floor(i / 10))
    })),
    startedAt: '2026-02-05T10:30:00Z'
  },
  {
    id: 'exp-2',
    name: 'Embedding Model Fine-tune',
    modelId: 'model-2',
    status: 'completed',
    hyperparams: { learningRate: 0.0005, batchSize: 64, epochs: 50, embeddingDim: 768 },
    metrics: Array.from({ length: 50 }, (_, i) => ({
      epoch: i + 1,
      trainLoss: 1.8 - (i * 0.03),
      valLoss: 1.9 - (i * 0.028),
      accuracy: 0.5 + (i * 0.008),
      learningRate: 0.0005
    })),
    startedAt: '2026-02-04T14:00:00Z',
    completedAt: '2026-02-04T18:30:00Z',
    duration: '4h 30m'
  },
  {
    id: 'exp-3',
    name: 'Sentiment v2 Training',
    modelId: 'model-3',
    status: 'running',
    hyperparams: { learningRate: 0.002, batchSize: 16, epochs: 80, hiddenSize: 512 },
    metrics: Array.from({ length: 23 }, (_, i) => ({
      epoch: i + 1,
      trainLoss: 1.5 - (i * 0.05),
      valLoss: 1.6 - (i * 0.045),
      accuracy: 0.4 + (i * 0.02),
      learningRate: 0.002
    })),
    startedAt: '2026-02-05T08:00:00Z'
  }
];

const MOCK_DATASETS: Dataset[] = [
  { id: 'ds-1', name: 'DTU Training Set', size: 2.5, samples: 150000, features: 512, type: 'text', splits: { train: 0.8, val: 0.1, test: 0.1 }, createdAt: '2025-12-01' },
  { id: 'ds-2', name: 'Sentiment Corpus', size: 1.2, samples: 80000, features: 256, type: 'text', splits: { train: 0.7, val: 0.15, test: 0.15 }, createdAt: '2025-11-15' },
  { id: 'ds-3', name: 'Image Features', size: 5.8, samples: 50000, features: 2048, type: 'image', splits: { train: 0.85, val: 0.1, test: 0.05 }, createdAt: '2025-10-20' },
  { id: 'ds-4', name: 'Anomaly Samples', size: 0.3, samples: 10000, features: 64, type: 'tabular', splits: { train: 0.9, val: 0.05, test: 0.05 }, createdAt: '2026-01-10' }
];

const MOCK_DEPLOYMENTS: Deployment[] = [
  { id: 'dep-1', modelId: 'model-1', modelName: 'DTU Classifier v3', version: '3.2.1', status: 'active', endpoint: '/api/ml/infer/dtu-classifier', replicas: 3, requestsPerSec: 245, avgLatency: 42, errorRate: 0.2, createdAt: '2026-01-29' }
];

export default function MLLensPage() {
  useLensNav('ml');
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [tab, setTab] = useState<Tab>('models');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [showNewExperiment, setShowNewExperiment] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const [playgroundOutput, setPlaygroundOutput] = useState<any>(null);
  const [playgroundModel, setPlaygroundModel] = useState<string>('');

  // Queries
  const { data: modelsData } = useQuery({
    queryKey: ['ml-models'],
    queryFn: () => api.get('/api/ml/models').then(r => r.data).catch(() => ({ models: MOCK_MODELS })),
  });

  const { data: experimentsData } = useQuery({
    queryKey: ['ml-experiments'],
    queryFn: () => api.get('/api/ml/experiments').then(r => r.data).catch(() => ({ experiments: MOCK_EXPERIMENTS })),
  });

  const { data: metricsData } = useQuery({
    queryKey: ['ml-metrics'],
    queryFn: () => api.get('/api/ml/metrics').then(r => r.data).catch(() => ({
      gpuUsage: 67,
      memoryUsage: 54,
      totalInferences: 1248562,
      avgLatency: 38
    })),
    refetchInterval: 5000
  });

  // Mutations
  const runInference = useMutation({
    mutationFn: (payload: { modelId: string; input: string }) =>
      api.post('/api/ml/infer', payload).then(r => r.data).catch(() => ({
        prediction: Math.random() > 0.5 ? 'positive' : 'negative',
        confidence: 0.85 + Math.random() * 0.14,
        latency: 35 + Math.random() * 20
      })),
    onSuccess: (data) => setPlaygroundOutput(data)
  });

  const startTraining = useMutation({
    mutationFn: (config: any) => api.post('/api/ml/train', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ml-experiments'] });
      setShowNewExperiment(false);
    }
  });

  const deployModel = useMutation({
    mutationFn: (modelId: string) => api.post(`/api/ml/deploy/${modelId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ml-models'] })
  });

  // Data
  const models = modelsData?.models || MOCK_MODELS;
  const experiments = experimentsData?.experiments || MOCK_EXPERIMENTS;
  const datasets = MOCK_DATASETS;
  const deployments = MOCK_DEPLOYMENTS;
  const metrics = metricsData || { gpuUsage: 0, memoryUsage: 0, totalInferences: 0, avgLatency: 0 };

  // Filtered data
  const filteredModels = useMemo(() => {
    return models.filter((m: Model) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      m.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    );
  }, [models, search]);

  // Draw metrics chart
  useEffect(() => {
    if (tab !== 'experiments' || !selectedExperiment || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = selectedExperiment.metrics;
    if (data.length === 0) return;

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Find min/max
    const maxLoss = Math.max(...data.map(d => Math.max(d.trainLoss, d.valLoss)));
    const minLoss = Math.min(...data.map(d => Math.min(d.trainLoss, d.valLoss)));
    const maxEpoch = data.length;

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartH * i / 5);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    // Draw axes labels
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const val = maxLoss - ((maxLoss - minLoss) * i / 5);
      ctx.fillText(val.toFixed(2), padding.left - 5, padding.top + (chartH * i / 5) + 3);
    }

    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const epoch = Math.round(maxEpoch * i / 5);
      ctx.fillText(epoch.toString(), padding.left + (chartW * i / 5), h - 10);
    }

    // Draw train loss line
    ctx.beginPath();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    data.forEach((d, i) => {
      const x = padding.left + (i / (maxEpoch - 1)) * chartW;
      const y = padding.top + ((maxLoss - d.trainLoss) / (maxLoss - minLoss)) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw val loss line
    ctx.beginPath();
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    data.forEach((d, i) => {
      const x = padding.left + (i / (maxEpoch - 1)) * chartW;
      const y = padding.top + ((maxLoss - d.valLoss) / (maxLoss - minLoss)) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Legend
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(w - 100, 10, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('Train Loss', w - 85, 20);

    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(w - 100, 28, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText('Val Loss', w - 85, 38);
  }, [tab, selectedExperiment]);

  const statusConfig = {
    ready: { color: 'text-neon-green bg-neon-green/10', icon: CheckCircle },
    training: { color: 'text-neon-blue bg-neon-blue/10 animate-pulse', icon: RefreshCw },
    failed: { color: 'text-red-400 bg-red-400/10', icon: XCircle },
    deploying: { color: 'text-yellow-400 bg-yellow-400/10', icon: Rocket },
    deployed: { color: 'text-neon-purple bg-neon-purple/10', icon: Rocket },
    running: { color: 'text-neon-blue bg-neon-blue/10 animate-pulse', icon: Activity },
    completed: { color: 'text-neon-green bg-neon-green/10', icon: CheckCircle },
    queued: { color: 'text-gray-400 bg-gray-400/10', icon: Clock },
    active: { color: 'text-neon-green bg-neon-green/10', icon: CheckCircle },
    inactive: { color: 'text-gray-400 bg-gray-400/10', icon: Square },
    scaling: { color: 'text-yellow-400 bg-yellow-400/10', icon: TrendingUp }
  };

  const typeConfig: Record<string, { color: string; icon: any }> = {
    classification: { color: 'text-neon-purple', icon: Target },
    regression: { color: 'text-neon-blue', icon: TrendingUp },
    clustering: { color: 'text-neon-cyan', icon: Grid3X3 },
    generation: { color: 'text-neon-pink', icon: Zap },
    embedding: { color: 'text-neon-green', icon: Layers },
    transformer: { color: 'text-yellow-400', icon: Brain }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-xl font-bold">ML Lens</h1>
            <p className="text-sm text-gray-400">
              Machine learning model management, training & deployment
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewExperiment(true)}
            className="btn-neon purple flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Experiment
          </button>
        </div>
      </header>

      {/* System Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Cpu className="w-5 h-5" />}
          label="GPU Usage"
          value={`${metrics.gpuUsage}%`}
          trend={metrics.gpuUsage > 80 ? 'warning' : 'normal'}
          color="blue"
        />
        <MetricCard
          icon={<Database className="w-5 h-5" />}
          label="Memory"
          value={`${metrics.memoryUsage}%`}
          trend={metrics.memoryUsage > 80 ? 'warning' : 'normal'}
          color="purple"
        />
        <MetricCard
          icon={<Zap className="w-5 h-5" />}
          label="Total Inferences"
          value={metrics.totalInferences.toLocaleString()}
          color="cyan"
        />
        <MetricCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Latency"
          value={`${metrics.avgLatency}ms`}
          color="green"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-lattice-surface/50 p-1 rounded-lg w-fit">
        {[
          { id: 'models', label: 'Models', icon: Brain, badge: models.length },
          { id: 'experiments', label: 'Experiments', icon: Beaker, badge: experiments.filter((e: Experiment) => e.status === 'running').length },
          { id: 'datasets', label: 'Datasets', icon: Database },
          { id: 'deployments', label: 'Deployments', icon: Rocket, badge: deployments.filter(d => d.status === 'active').length },
          { id: 'playground', label: 'Playground', icon: TestTube }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              tab === t.id ? 'bg-neon-purple/20 text-neon-purple' : 'hover:bg-white/5'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`text-xs px-1.5 rounded ${
                t.id === 'experiments' && t.badge > 0 ? 'bg-neon-blue/30 text-neon-blue' : 'bg-neon-purple/30 text-neon-purple'
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Models Tab */}
      {tab === 'models' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg focus:border-neon-purple outline-none"
              />
            </div>
            <div className="flex items-center bg-lattice-surface border border-lattice-border rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'text-neon-purple' : 'text-gray-400'}`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'text-neon-purple' : 'text-gray-400'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Model Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModels.map((model: Model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  statusConfig={statusConfig}
                  typeConfig={typeConfig}
                  onSelect={() => setSelectedModel(model)}
                  onDeploy={() => deployModel.mutate(model.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredModels.map((model: Model) => (
                <ModelListItem
                  key={model.id}
                  model={model}
                  statusConfig={statusConfig}
                  typeConfig={typeConfig}
                  onSelect={() => setSelectedModel(model)}
                  onDeploy={() => deployModel.mutate(model.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Experiments Tab */}
      {tab === 'experiments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Experiment List */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Beaker className="w-4 h-4 text-neon-purple" />
              Experiments
            </h3>
            <div className="space-y-2">
              {experiments.map((exp: Experiment) => {
                const StatusIcon = statusConfig[exp.status]?.icon || Activity;
                return (
                  <button
                    key={exp.id}
                    onClick={() => setSelectedExperiment(exp)}
                    className={`w-full text-left panel p-4 transition-colors ${
                      selectedExperiment?.id === exp.id ? 'border-neon-purple' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{exp.name}</span>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${statusConfig[exp.status]?.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {exp.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-400">
                      <span>Epoch {exp.metrics.length}/{exp.hyperparams.epochs}</span>
                      {exp.duration && <span>{exp.duration}</span>}
                    </div>
                    <div className="mt-2 h-1 bg-lattice-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-purple transition-all"
                        style={{ width: `${(exp.metrics.length / exp.hyperparams.epochs) * 100}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Experiment Detail */}
          <div className="lg:col-span-2 space-y-4">
            {selectedExperiment ? (
              <>
                <div className="panel p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{selectedExperiment.name}</h3>
                    <div className="flex items-center gap-2">
                      {selectedExperiment.status === 'running' && (
                        <button className="btn-neon small pink">
                          <Square className="w-4 h-4 mr-1" /> Stop
                        </button>
                      )}
                      <button className="btn-neon small">
                        <Copy className="w-4 h-4 mr-1" /> Clone
                      </button>
                    </div>
                  </div>

                  {/* Hyperparameters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {Object.entries(selectedExperiment.hyperparams).map(([key, value]) => (
                      <div key={key} className="bg-lattice-surface p-3 rounded-lg">
                        <p className="text-xs text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="font-mono">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Current Metrics */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-neon-cyan">
                        {selectedExperiment.metrics[selectedExperiment.metrics.length - 1]?.trainLoss.toFixed(4) || '—'}
                      </p>
                      <p className="text-xs text-gray-400">Train Loss</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-neon-pink">
                        {selectedExperiment.metrics[selectedExperiment.metrics.length - 1]?.valLoss.toFixed(4) || '—'}
                      </p>
                      <p className="text-xs text-gray-400">Val Loss</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-neon-green">
                        {((selectedExperiment.metrics[selectedExperiment.metrics.length - 1]?.accuracy || 0) * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-400">Accuracy</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-neon-purple">
                        {selectedExperiment.metrics.length}
                      </p>
                      <p className="text-xs text-gray-400">Epoch</p>
                    </div>
                  </div>
                </div>

                {/* Training Chart */}
                <div className="panel p-4">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <LineChart className="w-4 h-4 text-neon-cyan" />
                    Training Progress
                  </h4>
                  <div className="relative aspect-[2/1] bg-lattice-surface rounded-lg">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={400}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="panel p-12 text-center text-gray-400">
                <Beaker className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select an experiment to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Datasets Tab */}
      {tab === 'datasets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Available Datasets</h3>
            <button className="btn-neon">
              <Upload className="w-4 h-4 mr-2" />
              Upload Dataset
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map(ds => (
              <div key={ds.id} className="panel p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{ds.name}</h4>
                  <span className="text-xs bg-lattice-surface px-2 py-1 rounded capitalize">{ds.type}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-gray-400">Samples</p>
                    <p className="font-mono">{ds.samples.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Features</p>
                    <p className="font-mono">{ds.features}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Size</p>
                    <p className="font-mono">{ds.size} GB</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 h-2 bg-neon-blue/30 rounded" style={{ width: `${ds.splits.train * 100}%` }} title={`Train: ${ds.splits.train * 100}%`} />
                  <div className="h-2 bg-neon-purple/30 rounded" style={{ width: `${ds.splits.val * 100}%` }} title={`Val: ${ds.splits.val * 100}%`} />
                  <div className="h-2 bg-neon-pink/30 rounded" style={{ width: `${ds.splits.test * 100}%` }} title={`Test: ${ds.splits.test * 100}%`} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Train {ds.splits.train * 100}%</span>
                  <span>Val {ds.splits.val * 100}%</span>
                  <span>Test {ds.splits.test * 100}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deployments Tab */}
      {tab === 'deployments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Active Deployments</h3>
          </div>

          {deployments.length === 0 ? (
            <div className="panel p-12 text-center text-gray-400">
              <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active deployments</p>
              <p className="text-sm mt-1">Deploy a model to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deployments.map(dep => (
                <div key={dep.id} className="panel p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold">{dep.modelName}</h4>
                      <p className="text-sm text-gray-400">v{dep.version}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-sm px-3 py-1 rounded ${statusConfig[dep.status]?.color}`}>
                      <CheckCircle className="w-4 h-4" />
                      {dep.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Endpoint</p>
                      <code className="text-xs text-neon-cyan">{dep.endpoint}</code>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Replicas</p>
                      <p className="font-mono">{dep.replicas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Req/sec</p>
                      <p className="font-mono text-neon-green">{dep.requestsPerSec}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Avg Latency</p>
                      <p className="font-mono">{dep.avgLatency}ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Error Rate</p>
                      <p className="font-mono text-neon-pink">{dep.errorRate}%</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn-neon small">Scale</button>
                    <button className="btn-neon small">Logs</button>
                    <button className="btn-neon small pink">Stop</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playground Tab */}
      {tab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TestTube className="w-4 h-4 text-neon-purple" />
              Inference Playground
            </h3>

            <div>
              <label className="text-sm text-gray-400 block mb-2">Select Model</label>
              <select
                value={playgroundModel}
                onChange={e => setPlaygroundModel(e.target.value)}
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg focus:border-neon-purple outline-none"
              >
                <option value="">Choose a model...</option>
                {models.filter((m: Model) => m.status === 'ready' || m.status === 'deployed').map((m: Model) => (
                  <option key={m.id} value={m.id}>{m.name} (v{m.version})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">Input Data</label>
              <textarea
                value={playgroundInput}
                onChange={e => setPlaygroundInput(e.target.value)}
                placeholder='{"text": "Your input here..."}'
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg h-48 font-mono text-sm focus:border-neon-purple outline-none resize-none"
              />
            </div>

            <button
              onClick={() => runInference.mutate({ modelId: playgroundModel, input: playgroundInput })}
              disabled={!playgroundModel || !playgroundInput || runInference.isPending}
              className="btn-neon purple w-full disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-2 inline" />
              {runInference.isPending ? 'Running Inference...' : 'Run Inference'}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Code className="w-4 h-4 text-neon-green" />
              Output
            </h3>

            <div className="panel p-4 h-[400px] overflow-auto">
              {playgroundOutput ? (
                <pre className="text-sm font-mono text-neon-green whitespace-pre-wrap">
                  {JSON.stringify(playgroundOutput, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FileJson className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Run inference to see output</p>
                  </div>
                </div>
              )}
            </div>

            {playgroundOutput && (
              <div className="flex gap-2">
                <button className="btn-neon small flex-1">
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </button>
                <button className="btn-neon small flex-1">
                  <Download className="w-4 h-4 mr-1" /> Export
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model Detail Modal */}
      <AnimatePresence>
        {selectedModel && (
          <ModelDetailModal
            model={selectedModel}
            onClose={() => setSelectedModel(null)}
            onDeploy={() => deployModel.mutate(selectedModel.id)}
            onTrain={() => { setSelectedModel(null); setShowNewExperiment(true); }}
            statusConfig={statusConfig}
            typeConfig={typeConfig}
          />
        )}
      </AnimatePresence>

      {/* New Experiment Modal */}
      <AnimatePresence>
        {showNewExperiment && (
          <NewExperimentModal
            models={models}
            datasets={datasets}
            onClose={() => setShowNewExperiment(false)}
            onSubmit={(config) => startTraining.mutate(config)}
            submitting={startTraining.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

function MetricCard({ icon, label, value, trend, color }: { icon: React.ReactNode; label: string; value: string; trend?: 'normal' | 'warning'; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'text-neon-blue bg-neon-blue/10',
    purple: 'text-neon-purple bg-neon-purple/10',
    cyan: 'text-neon-cyan bg-neon-cyan/10',
    green: 'text-neon-green bg-neon-green/10'
  };

  return (
    <div className="panel p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold ${trend === 'warning' ? 'text-yellow-400' : ''}`}>{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function ModelCard({ model, statusConfig, typeConfig, onSelect, onDeploy }: any) {
  const StatusIcon = statusConfig[model.status]?.icon || Activity;
  const TypeIcon = typeConfig[model.type]?.icon || Brain;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="panel p-4 cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TypeIcon className={`w-5 h-5 ${typeConfig[model.type]?.color}`} />
          <div>
            <h4 className="font-semibold">{model.name}</h4>
            <p className="text-xs text-gray-400">v{model.version}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${statusConfig[model.status]?.color}`}>
          <StatusIcon className="w-3 h-3" />
          {model.status}
        </span>
      </div>

      {model.description && (
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{model.description}</p>
      )}

      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
        {model.accuracy && (
          <div>
            <p className="text-xs text-gray-500">Accuracy</p>
            <p className="font-mono text-neon-green">{(model.accuracy * 100).toFixed(1)}%</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500">Params</p>
          <p className="font-mono">{(model.parameters / 1000000).toFixed(1)}M</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Size</p>
          <p className="font-mono">{model.size}</p>
        </div>
      </div>

      {model.tags && (
        <div className="flex flex-wrap gap-1">
          {model.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-xs bg-lattice-surface px-2 py-0.5 rounded text-gray-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ModelListItem({ model, statusConfig, typeConfig, onSelect, onDeploy }: any) {
  const StatusIcon = statusConfig[model.status]?.icon || Activity;
  const TypeIcon = typeConfig[model.type]?.icon || Brain;

  return (
    <div
      onClick={onSelect}
      className="panel p-4 flex items-center gap-4 cursor-pointer hover:border-neon-purple/50"
    >
      <TypeIcon className={`w-6 h-6 ${typeConfig[model.type]?.color}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{model.name}</span>
          <span className="text-xs text-gray-500">v{model.version}</span>
        </div>
        <p className="text-sm text-gray-400">{model.description}</p>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {model.accuracy && (
          <span className="text-neon-green">{(model.accuracy * 100).toFixed(1)}%</span>
        )}
        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${statusConfig[model.status]?.color}`}>
          <StatusIcon className="w-3 h-3" />
          {model.status}
        </span>
        {model.status === 'ready' && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeploy(); }}
            className="btn-neon small"
          >
            <Rocket className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ModelDetailModal({ model, onClose, onDeploy, onTrain, statusConfig, typeConfig }: any) {
  const StatusIcon = statusConfig[model.status]?.icon || Activity;
  const TypeIcon = typeConfig[model.type]?.icon || Brain;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-lattice-bg border border-lattice-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-lattice-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${typeConfig[model.type]?.color} bg-current/10`}>
                <TypeIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{model.name}</h2>
                <p className="text-gray-400">Version {model.version} · {model.framework}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <span className={`flex items-center gap-1 px-3 py-1 rounded ${statusConfig[model.status]?.color}`}>
              <StatusIcon className="w-4 h-4" />
              {model.status}
            </span>
            {model.status === 'ready' && (
              <>
                <button onClick={onDeploy} className="btn-neon purple">
                  <Rocket className="w-4 h-4 mr-2" /> Deploy
                </button>
                <button onClick={onTrain} className="btn-neon">
                  <RefreshCw className="w-4 h-4 mr-2" /> Retrain
                </button>
              </>
            )}
            {model.status === 'deployed' && model.endpoint && (
              <code className="text-xs bg-lattice-surface px-3 py-2 rounded text-neon-cyan">
                {model.endpoint}
              </code>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {model.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-gray-300">{model.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {model.accuracy && (
              <div className="bg-lattice-surface p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-neon-green">{(model.accuracy * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-400">Accuracy</p>
              </div>
            )}
            {model.f1Score && (
              <div className="bg-lattice-surface p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-neon-purple">{(model.f1Score * 100).toFixed(1)}%</p>
                <p className="text-xs text-gray-400">F1 Score</p>
              </div>
            )}
            {model.loss && (
              <div className="bg-lattice-surface p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-neon-cyan">{model.loss.toFixed(4)}</p>
                <p className="text-xs text-gray-400">Loss</p>
              </div>
            )}
            <div className="bg-lattice-surface p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{(model.parameters / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-gray-400">Parameters</p>
            </div>
          </div>

          {model.tags && (
            <div>
              <h3 className="font-semibold mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {model.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-lattice-surface rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Type</p>
              <p className="capitalize">{model.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Framework</p>
              <p className="capitalize">{model.framework}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Size</p>
              <p>{model.size}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Last Trained</p>
              <p>{model.lastTrained ? new Date(model.lastTrained).toLocaleDateString() : '—'}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewExperimentModal({ models, datasets, onClose, onSubmit, submitting }: any) {
  const [config, setConfig] = useState({
    name: '',
    modelId: '',
    datasetId: '',
    learningRate: 0.001,
    batchSize: 32,
    epochs: 50,
    optimizer: 'adam'
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-lattice-bg border border-lattice-border rounded-xl w-full max-w-lg p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New Experiment</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Experiment Name</label>
            <input
              type="text"
              value={config.name}
              onChange={e => setConfig({ ...config, name: e.target.value })}
              placeholder="My Experiment"
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Model</label>
              <select
                value={config.modelId}
                onChange={e => setConfig({ ...config, modelId: e.target.value })}
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none"
              >
                <option value="">Select model...</option>
                {models.map((m: Model) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Dataset</label>
              <select
                value={config.datasetId}
                onChange={e => setConfig({ ...config, datasetId: e.target.value })}
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none"
              >
                <option value="">Select dataset...</option>
                {datasets.map((d: Dataset) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Learning Rate</label>
              <input
                type="number"
                step="0.0001"
                value={config.learningRate}
                onChange={e => setConfig({ ...config, learningRate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Batch Size</label>
              <input
                type="number"
                value={config.batchSize}
                onChange={e => setConfig({ ...config, batchSize: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Epochs</label>
              <input
                type="number"
                value={config.epochs}
                onChange={e => setConfig({ ...config, epochs: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Optimizer</label>
              <select
                value={config.optimizer}
                onChange={e => setConfig({ ...config, optimizer: e.target.value })}
                className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded focus:border-neon-purple outline-none"
              >
                <option value="adam">Adam</option>
                <option value="sgd">SGD</option>
                <option value="rmsprop">RMSprop</option>
                <option value="adamw">AdamW</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-lattice-border">
          <button onClick={onClose} className="px-4 py-2 hover:bg-white/10 rounded">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(config)}
            disabled={submitting || !config.name || !config.modelId}
            className="btn-neon purple disabled:opacity-50"
          >
            {submitting ? 'Starting...' : 'Start Training'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
