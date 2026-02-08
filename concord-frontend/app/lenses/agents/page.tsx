'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Plus, Play, Power, Activity, Clock, Zap, Settings, Search,
  Terminal, Eye, ChevronRight, BarChart3,
  Code, Brain, Shield, Cpu,
  CheckCircle, XCircle,
  Workflow, Database,
  Layers, TrendingUp,
} from 'lucide-react';

// --- Types ---
interface Agent {
  id: string;
  name: string;
  type?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  lastTick?: string;
  status?: string;
  description?: string;
  goals?: string[];
  tools?: string[];
  memory?: { key: string; value: string; timestamp: string }[];
  logs?: { timestamp: string; level: string; message: string }[];
  tickCount?: number;
  successRate?: number;
  avgLatency?: number;
  createdAt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

type ViewMode = 'dashboard' | 'detail' | 'builder' | 'logs' | 'workflows';
type AgentFilter = 'all' | 'active' | 'dormant' | 'error';

// --- Demo Data ---
const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-001', name: 'Research Sentinel', type: 'research', enabled: true,
    description: 'Monitors external sources for new music theory research, production techniques, and industry trends. Synthesizes findings into DTUs.',
    goals: ['Monitor arxiv for audio ML papers', 'Track music production forums', 'Summarize findings weekly'],
    tools: ['web_search', 'dtu_create', 'summarize', 'classify'],
    status: 'running',
    tickCount: 1247, successRate: 96.3, avgLatency: 1.2,
    model: 'claude-sonnet-4-5-20250929', maxTokens: 4096, temperature: 0.3,
    createdAt: '2026-01-15T10:00:00Z', lastTick: '2026-02-07T14:30:00Z',
    memory: [
      { key: 'last_search_query', value: 'neural audio synthesis 2026', timestamp: '2026-02-07T14:30:00Z' },
      { key: 'papers_found_today', value: '3', timestamp: '2026-02-07T14:30:00Z' },
      { key: 'focus_topics', value: 'diffusion models, music generation, spatial audio', timestamp: '2026-02-06T09:00:00Z' },
    ],
    logs: [
      { timestamp: '2026-02-07T14:30:00Z', level: 'info', message: 'Tick completed: found 3 new papers on neural audio synthesis' },
      { timestamp: '2026-02-07T14:00:00Z', level: 'info', message: 'Scanning arxiv.org for recent audio ML publications' },
      { timestamp: '2026-02-07T13:45:00Z', level: 'warn', message: 'Rate limit approaching on web_search tool (80/100)' },
      { timestamp: '2026-02-07T12:00:00Z', level: 'info', message: 'Created DTU: "Diffusion Models for Music Generation - Survey 2026"' },
      { timestamp: '2026-02-07T10:00:00Z', level: 'info', message: 'Daily scan initiated' },
    ]
  },
  {
    id: 'agent-002', name: 'Harmony Critic', type: 'critic', enabled: true,
    description: 'Analyzes musical compositions for harmonic consistency, voice leading errors, and suggests improvements based on music theory rules.',
    goals: ['Review new compositions', 'Check voice leading rules', 'Suggest harmonic alternatives'],
    tools: ['dtu_read', 'music_analyze', 'score_harmony', 'suggest'],
    status: 'idle',
    tickCount: 834, successRate: 92.1, avgLatency: 2.8,
    model: 'claude-opus-4-6', maxTokens: 8192, temperature: 0.1,
    createdAt: '2026-01-20T08:00:00Z', lastTick: '2026-02-07T13:15:00Z',
    memory: [
      { key: 'compositions_reviewed', value: '47', timestamp: '2026-02-07T13:15:00Z' },
      { key: 'common_issues', value: 'parallel fifths, unresolved 7ths, weak cadences', timestamp: '2026-02-06T15:00:00Z' },
    ],
    logs: [
      { timestamp: '2026-02-07T13:15:00Z', level: 'info', message: 'Reviewed composition "Midnight Echoes" - 3 voice leading issues found' },
      { timestamp: '2026-02-07T11:00:00Z', level: 'info', message: 'Waiting for new compositions to review' },
    ]
  },
  {
    id: 'agent-003', name: 'Mix Engineer', type: 'synthesizer', enabled: true,
    description: 'Automated mixing assistant that analyzes frequency balance, stereo width, dynamics, and provides mixing suggestions for tracks.',
    goals: ['Analyze frequency spectrum', 'Check stereo balance', 'Suggest EQ curves', 'Monitor loudness standards'],
    tools: ['audio_analyze', 'eq_suggest', 'dynamics_check', 'lufs_measure'],
    status: 'running',
    tickCount: 562, successRate: 88.7, avgLatency: 3.5,
    model: 'claude-sonnet-4-5-20250929', maxTokens: 4096, temperature: 0.2,
    createdAt: '2026-01-25T12:00:00Z', lastTick: '2026-02-07T14:45:00Z',
    memory: [
      { key: 'current_project', value: 'Album: "Digital Horizons" - Track 7', timestamp: '2026-02-07T14:45:00Z' },
      { key: 'lufs_target', value: '-14 LUFS (streaming standard)', timestamp: '2026-02-01T10:00:00Z' },
    ],
    logs: [
      { timestamp: '2026-02-07T14:45:00Z', level: 'info', message: 'Analyzing Track 7 - frequency masking detected between bass and kick (60-100Hz)' },
      { timestamp: '2026-02-07T14:30:00Z', level: 'info', message: 'Stereo width analysis: vocals centered, guitars panned 60% L/R' },
      { timestamp: '2026-02-07T14:00:00Z', level: 'warn', message: 'Track 7 peak level at -0.3dB - recommend limiting to -1.0dB' },
    ]
  },
  {
    id: 'agent-004', name: 'Quality Monitor', type: 'monitor', enabled: false,
    description: 'System health watchdog that monitors DTU consistency, graph integrity, and performance metrics. Alerts on anomalies.',
    goals: ['Check DTU integrity hourly', 'Monitor graph consistency', 'Alert on performance degradation'],
    tools: ['db_query', 'graph_check', 'metric_read', 'alert_send'],
    status: 'dormant',
    tickCount: 2103, successRate: 99.1, avgLatency: 0.8,
    model: 'claude-haiku-4-5-20251001', maxTokens: 2048, temperature: 0.0,
    createdAt: '2026-01-10T06:00:00Z', lastTick: '2026-02-06T23:00:00Z',
    memory: [
      { key: 'last_alert', value: 'Graph node count spike: 15% increase in 1hr', timestamp: '2026-02-05T18:00:00Z' },
      { key: 'dtus_checked', value: '12847', timestamp: '2026-02-06T23:00:00Z' },
    ],
    logs: [
      { timestamp: '2026-02-06T23:00:00Z', level: 'info', message: 'Nightly integrity check complete: 12847 DTUs verified, 0 issues' },
      { timestamp: '2026-02-06T18:00:00Z', level: 'info', message: 'Hourly check: all metrics within normal range' },
    ]
  },
  {
    id: 'agent-005', name: 'Sample Curator', type: 'general', enabled: true,
    description: 'Discovers, categorizes, and tags audio samples from the library. Builds semantic connections between similar sounds.',
    goals: ['Tag unprocessed samples', 'Build similarity graph', 'Suggest sample chains for compositions'],
    tools: ['audio_fingerprint', 'tag_assign', 'graph_connect', 'dtu_update'],
    status: 'running',
    tickCount: 421, successRate: 94.5, avgLatency: 1.9,
    model: 'claude-sonnet-4-5-20250929', maxTokens: 4096, temperature: 0.4,
    createdAt: '2026-02-01T09:00:00Z', lastTick: '2026-02-07T14:50:00Z',
    memory: [
      { key: 'samples_processed', value: '1,832', timestamp: '2026-02-07T14:50:00Z' },
      { key: 'untagged_remaining', value: '247', timestamp: '2026-02-07T14:50:00Z' },
    ],
    logs: [
      { timestamp: '2026-02-07T14:50:00Z', level: 'info', message: 'Batch processed: 15 kick samples tagged (808, acoustic, layered)' },
      { timestamp: '2026-02-07T14:20:00Z', level: 'info', message: 'Built 8 new similarity edges in sample graph' },
      { timestamp: '2026-02-07T13:00:00Z', level: 'error', message: 'Failed to fingerprint sample_2847.wav - corrupt file header' },
    ]
  },
  {
    id: 'agent-006', name: 'Lyric Synthesizer', type: 'synthesizer', enabled: false,
    description: 'Generates lyrical ideas, rhyme schemes, and thematic concepts based on musical mood and genre context.',
    goals: ['Generate lyric drafts from themes', 'Build rhyme databases', 'Analyze syllable patterns'],
    tools: ['text_generate', 'rhyme_find', 'syllable_count', 'dtu_create'],
    status: 'dormant',
    tickCount: 156, successRate: 85.2, avgLatency: 4.1,
    model: 'claude-opus-4-6', maxTokens: 8192, temperature: 0.8,
    createdAt: '2026-02-03T14:00:00Z', lastTick: '2026-02-05T16:00:00Z',
    memory: [],
    logs: [
      { timestamp: '2026-02-05T16:00:00Z', level: 'info', message: 'Session ended: generated 12 lyric fragments for "Neon Dreams" project' },
    ]
  },
];

const AGENT_TYPES = [
  { id: 'general', label: 'General', icon: Bot, color: 'text-gray-400', description: 'Multi-purpose agent' },
  { id: 'research', label: 'Research', icon: Search, color: 'text-neon-cyan', description: 'Information gathering and synthesis' },
  { id: 'critic', label: 'Critic', icon: Eye, color: 'text-neon-purple', description: 'Analysis and quality review' },
  { id: 'synthesizer', label: 'Synthesizer', icon: Brain, color: 'text-neon-pink', description: 'Content generation and creation' },
  { id: 'monitor', label: 'Monitor', icon: Shield, color: 'text-neon-green', description: 'System health and alerts' },
  { id: 'orchestrator', label: 'Orchestrator', icon: Workflow, color: 'text-neon-yellow', description: 'Coordinates other agents' },
];

const AVAILABLE_TOOLS = [
  'web_search', 'dtu_create', 'dtu_read', 'dtu_update', 'summarize', 'classify',
  'music_analyze', 'score_harmony', 'suggest', 'audio_analyze', 'eq_suggest',
  'dynamics_check', 'lufs_measure', 'audio_fingerprint', 'tag_assign', 'graph_connect',
  'db_query', 'graph_check', 'metric_read', 'alert_send', 'text_generate',
  'rhyme_find', 'syllable_count', 'code_execute', 'file_read', 'file_write',
];

export default function AgentsLensPage() {
  useLensNav('agents');

  const queryClient = useQueryClient();
  const { items: _agentItems } = useLensData('agents', 'agent', {
    seed: INITIAL_AGENTS.map(a => ({ title: a.name, data: a as unknown as Record<string, unknown> })),
  });
  const [_view, setView] = useState<ViewMode>('dashboard');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<AgentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTab, setDetailTab] = useState<'overview' | 'logs' | 'memory' | 'config'>('overview');

  // Create form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('general');
  const [newDescription, setNewDescription] = useState('');
  const [newGoals, setNewGoals] = useState('');
  const [newTools, setNewTools] = useState<string[]>([]);
  const [newModel, setNewModel] = useState('claude-sonnet-4-5-20250929');
  const [newTemp, setNewTemp] = useState(0.3);
  const [newMaxTokens, setNewMaxTokens] = useState(4096);

  // API with fallback
  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiHelpers.agents.list().then((r) => r.data).catch(() => null),
    refetchInterval: 5000,
  });

  const createAgent = useMutation({
    mutationFn: () => apiHelpers.agents.create({ name: newName, type: newType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowCreate(false);
      resetCreateForm();
    },
    onError: () => { setShowCreate(false); },
  });

  const enableAgent = useMutation({
    mutationFn: (id: string) => apiHelpers.agents.enable(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const tickAgent = useMutation({
    mutationFn: (id: string) => apiHelpers.agents.tick(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const agents: Agent[] = useMemo(() => {
    const apiAgents = agentsData?.agents || (Array.isArray(agentsData) ? agentsData : []);
    return apiAgents.length > 0 ? apiAgents : INITIAL_AGENTS;
  }, [agentsData]);

  const filteredAgents = useMemo(() => {
    let list = agents;
    if (filter === 'active') list = list.filter(a => a.enabled);
    if (filter === 'dormant') list = list.filter(a => !a.enabled);
    if (filter === 'error') list = list.filter(a => a.status === 'error');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.type?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q));
    }
    return list;
  }, [agents, filter, searchQuery]);

  const activeCount = agents.filter(a => a.enabled).length;
  const totalTicks = agents.reduce((s, a) => s + (a.tickCount || 0), 0);
  const avgSuccess = agents.length > 0
    ? +(agents.reduce((s, a) => s + (a.successRate || 0), 0) / agents.length).toFixed(1) : 0;

  const resetCreateForm = () => {
    setNewName(''); setNewType('general'); setNewDescription('');
    setNewGoals(''); setNewTools([]); setNewModel('claude-sonnet-4-5-20250929');
    setNewTemp(0.3); setNewMaxTokens(4096);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'bg-green-400';
      case 'idle': return 'bg-yellow-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (agent: Agent) => {
    if (!agent.enabled) return 'Dormant';
    return agent.status === 'running' ? 'Running' : agent.status === 'error' ? 'Error' : 'Idle';
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const typeInfo = (type?: string) => AGENT_TYPES.find(t => t.id === type) || AGENT_TYPES[0];

  return (
    <div className="min-h-full bg-lattice-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-lattice-surface border-b border-lattice-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-7 h-7 text-neon-cyan" />
              <div>
                <h1 className="text-xl font-bold text-white">Agent Control Center</h1>
                <p className="text-xs text-gray-400">Create, orchestrate, and monitor autonomous agents</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedAgent && (
                <button
                  onClick={() => { setSelectedAgent(null); setView('dashboard'); }}
                  className="text-sm text-gray-400 hover:text-white flex items-center gap-1 mr-2"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>
              )}
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1 px-3 py-2 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" /> New Agent
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ===== DASHBOARD ===== */}
        {!selectedAgent && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="lens-card text-center">
                <Bot className="w-5 h-5 text-neon-blue mx-auto mb-1" />
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-xs text-gray-400">Total Agents</p>
              </div>
              <div className="lens-card text-center">
                <Power className="w-5 h-5 text-neon-green mx-auto mb-1" />
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-gray-400">Active</p>
              </div>
              <div className="lens-card text-center">
                <Zap className="w-5 h-5 text-neon-yellow mx-auto mb-1" />
                <p className="text-2xl font-bold">{totalTicks.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Total Ticks</p>
              </div>
              <div className="lens-card text-center">
                <TrendingUp className="w-5 h-5 text-neon-cyan mx-auto mb-1" />
                <p className="text-2xl font-bold">{avgSuccess}%</p>
                <p className="text-xs text-gray-400">Avg Success</p>
              </div>
              <div className="lens-card text-center">
                <Activity className="w-5 h-5 text-neon-purple mx-auto mb-1" />
                <p className="text-2xl font-bold">{agents.filter(a => a.status === 'running').length}</p>
                <p className="text-xs text-gray-400">Running Now</p>
              </div>
            </div>

            {/* Filters & search */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search agents..."
                  className="pl-10 pr-4 py-2 w-full bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-lattice-surface border border-lattice-border rounded-lg">
                {(['all', 'active', 'dormant', 'error'] as AgentFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                      filter === f ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? (
                <div className="col-span-full text-center py-12 text-gray-500">Loading agents...</div>
              ) : filteredAgents.length === 0 ? (
                <div className="col-span-full panel p-12 text-center">
                  <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 mb-2">No agents match your filter</p>
                  <button onClick={() => setShowCreate(true)} className="btn-neon purple text-sm">
                    Create your first agent
                  </button>
                </div>
              ) : (
                filteredAgents.map(agent => {
                  const ti = typeInfo(agent.type);
                  const TypeIcon = ti.icon;
                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.01 }}
                      className="panel overflow-hidden cursor-pointer group"
                      onClick={() => { setSelectedAgent(agent); setDetailTab('overview'); }}
                    >
                      {/* Status bar */}
                      <div className={`h-1 ${agent.enabled ? (agent.status === 'running' ? 'bg-green-500' : 'bg-yellow-500') : 'bg-gray-600'}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-lg bg-lattice-bg flex items-center justify-center ${ti.color}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white group-hover:text-neon-cyan transition-colors">{agent.name}</h3>
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider">{agent.type}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(agent.enabled ? agent.status : 'dormant')}`} />
                            <span className="text-xs text-gray-400">{getStatusLabel(agent)}</span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 mb-3 line-clamp-2">{agent.description || 'No description'}</p>

                        {/* Quick stats */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center p-1.5 bg-lattice-bg rounded">
                            <p className="text-xs font-bold text-white">{(agent.tickCount || 0).toLocaleString()}</p>
                            <p className="text-[9px] text-gray-500">Ticks</p>
                          </div>
                          <div className="text-center p-1.5 bg-lattice-bg rounded">
                            <p className="text-xs font-bold text-white">{agent.successRate || 0}%</p>
                            <p className="text-[9px] text-gray-500">Success</p>
                          </div>
                          <div className="text-center p-1.5 bg-lattice-bg rounded">
                            <p className="text-xs font-bold text-white">{agent.avgLatency || 0}s</p>
                            <p className="text-[9px] text-gray-500">Latency</p>
                          </div>
                        </div>

                        {/* Tools */}
                        {agent.tools && agent.tools.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-3">
                            {agent.tools.slice(0, 4).map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-neon-cyan/10 text-neon-cyan/70 rounded">{t}</span>
                            ))}
                            {agent.tools.length > 4 && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-lattice-bg text-gray-500 rounded">+{agent.tools.length - 4}</span>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-lattice-border">
                          <button
                            onClick={(e) => { e.stopPropagation(); enableAgent.mutate(agent.id); }}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors ${
                              agent.enabled
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            {agent.enabled ? 'Stop' : 'Start'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); tickAgent.mutate(agent.id); }}
                            disabled={!agent.enabled}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors disabled:opacity-30"
                          >
                            <Play className="w-3 h-3" /> Tick
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedAgent(agent); setDetailTab('logs'); }}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-lattice-bg text-gray-400 hover:text-white transition-colors"
                          >
                            <Terminal className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Recent activity feed */}
            <div className="panel p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Activity className="w-5 h-5 text-neon-cyan" />
                Recent Activity
              </h3>
              <div className="space-y-1">
                {agents
                  .flatMap(a => (a.logs || []).map(l => ({ ...l, agentName: a.name, agentId: a.id })))
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 10)
                  .map((log, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-lattice-border/30 last:border-0">
                      <span className="text-[10px] text-gray-600 font-mono w-16 flex-shrink-0 pt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`text-[10px] font-mono uppercase w-10 flex-shrink-0 pt-0.5 ${getLogColor(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-xs text-neon-cyan flex-shrink-0">{log.agentName}</span>
                      <span className="text-xs text-gray-400 flex-1">{log.message}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== AGENT DETAIL ===== */}
        {selectedAgent && (
          <div className="space-y-6">
            {/* Agent header */}
            <div className="panel p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-lattice-bg flex items-center justify-center ${typeInfo(selectedAgent.type).color}`}>
                    {(() => { const Icon = typeInfo(selectedAgent.type).icon; return <Icon className="w-7 h-7" />; })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">{selectedAgent.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedAgent.enabled ? selectedAgent.status : 'dormant')}`} />
                        {getStatusLabel(selectedAgent)}
                      </span>
                      <span className="text-xs text-gray-500">Type: {selectedAgent.type}</span>
                      <span className="text-xs text-gray-500">Created: {selectedAgent.createdAt ? new Date(selectedAgent.createdAt).toLocaleDateString() : 'Unknown'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => enableAgent.mutate(selectedAgent.id)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAgent.enabled
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                        : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    {selectedAgent.enabled ? 'Stop Agent' : 'Start Agent'}
                  </button>
                  <button
                    onClick={() => tickAgent.mutate(selectedAgent.id)}
                    disabled={!selectedAgent.enabled}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-colors disabled:opacity-30"
                  >
                    <Play className="w-4 h-4" /> Manual Tick
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-lattice-border">
              {[
                { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
                { id: 'logs' as const, label: 'Logs', icon: Terminal },
                { id: 'memory' as const, label: 'Memory', icon: Database },
                { id: 'config' as const, label: 'Configuration', icon: Settings },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                    detailTab === tab.id
                      ? 'border-neon-cyan text-neon-cyan'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {detailTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="lens-card text-center">
                    <Zap className="w-5 h-5 text-neon-yellow mx-auto mb-1" />
                    <p className="text-2xl font-bold">{(selectedAgent.tickCount || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Total Ticks</p>
                  </div>
                  <div className="lens-card text-center">
                    <CheckCircle className="w-5 h-5 text-neon-green mx-auto mb-1" />
                    <p className="text-2xl font-bold">{selectedAgent.successRate || 0}%</p>
                    <p className="text-xs text-gray-400">Success Rate</p>
                  </div>
                  <div className="lens-card text-center">
                    <Clock className="w-5 h-5 text-neon-blue mx-auto mb-1" />
                    <p className="text-2xl font-bold">{selectedAgent.avgLatency || 0}s</p>
                    <p className="text-xs text-gray-400">Avg Latency</p>
                  </div>
                  <div className="lens-card text-center">
                    <Activity className="w-5 h-5 text-neon-purple mx-auto mb-1" />
                    <p className="text-2xl font-bold">
                      {selectedAgent.lastTick ? new Date(selectedAgent.lastTick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">Last Tick</p>
                  </div>
                </div>

                {/* Goals */}
                {selectedAgent.goals && selectedAgent.goals.length > 0 && (
                  <div className="panel p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-neon-purple" /> Goals
                    </h3>
                    <div className="space-y-2">
                      {selectedAgent.goals.map((goal, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-neon-cyan mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-300">{goal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tools */}
                {selectedAgent.tools && selectedAgent.tools.length > 0 && (
                  <div className="panel p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                      <Code className="w-4 h-4 text-neon-green" /> Available Tools
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedAgent.tools.map(tool => (
                        <span key={tool} className="text-xs px-2.5 py-1.5 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 rounded-lg font-mono">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Logs tab */}
            {detailTab === 'logs' && (
              <div className="panel overflow-hidden">
                <div className="bg-lattice-bg/80 p-3 border-b border-lattice-border flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-mono">Execution Logs</span>
                  <button className="text-xs text-neon-cyan hover:underline">Clear</button>
                </div>
                <div className="p-2 font-mono text-xs space-y-0.5 max-h-[500px] overflow-y-auto bg-[#0a0a0f]">
                  {(selectedAgent.logs || []).length === 0 ? (
                    <p className="text-gray-600 p-4 text-center">No logs available</p>
                  ) : (
                    selectedAgent.logs?.map((log, i) => (
                      <div key={i} className="flex items-start gap-2 py-1 px-2 hover:bg-white/5 rounded">
                        <span className="text-gray-600 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`flex-shrink-0 uppercase w-12 ${getLogColor(log.level)}`}>
                          [{log.level}]
                        </span>
                        <span className="text-gray-300">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Memory tab */}
            {detailTab === 'memory' && (
              <div className="panel overflow-hidden">
                <div className="bg-lattice-bg/80 p-3 border-b border-lattice-border flex items-center justify-between">
                  <span className="text-xs text-gray-400">Agent Memory Store</span>
                  <span className="text-xs text-gray-500">{selectedAgent.memory?.length || 0} entries</span>
                </div>
                {(selectedAgent.memory || []).length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No memory entries yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-lattice-border/50">
                    {selectedAgent.memory?.map((mem, i) => (
                      <div key={i} className="p-3 hover:bg-lattice-surface/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-neon-cyan">{mem.key}</span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(mem.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{mem.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Config tab */}
            {detailTab === 'config' && (
              <div className="space-y-4">
                <div className="panel p-4">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-neon-cyan" /> Model Configuration
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-lattice-bg rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Model</p>
                      <p className="text-sm font-mono text-white">{selectedAgent.model || 'default'}</p>
                    </div>
                    <div className="p-3 bg-lattice-bg rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Max Tokens</p>
                      <p className="text-sm font-mono text-white">{selectedAgent.maxTokens || 4096}</p>
                    </div>
                    <div className="p-3 bg-lattice-bg rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Temperature</p>
                      <p className="text-sm font-mono text-white">{selectedAgent.temperature ?? 0.3}</p>
                    </div>
                  </div>
                </div>

                <div className="panel p-4">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-neon-purple" /> Agent Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-lattice-bg rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Agent ID</p>
                      <p className="text-sm font-mono text-white">{selectedAgent.id}</p>
                    </div>
                    <div className="p-3 bg-lattice-bg rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Type</p>
                      <p className="text-sm font-mono text-white capitalize">{selectedAgent.type}</p>
                    </div>
                    <div className="p-3 bg-lattice-bg rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Created</p>
                      <p className="text-sm font-mono text-white">
                        {selectedAgent.createdAt ? new Date(selectedAgent.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                    <div className="p-3 bg-lattice-bg rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Last Active</p>
                      <p className="text-sm font-mono text-white">
                        {selectedAgent.lastTick ? new Date(selectedAgent.lastTick).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== CREATE AGENT MODAL ===== */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-lattice-surface border border-lattice-border rounded-xl w-full max-w-2xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-neon-cyan" /> Create New Agent
                </h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Name & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Agent Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Research Sentinel"
                    className="input-lattice w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Type</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} className="input-lattice w-full">
                    {AGENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} — {t.description}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What does this agent do?"
                  className="input-lattice w-full h-20 resize-none"
                />
              </div>

              {/* Goals */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Goals (one per line)</label>
                <textarea
                  value={newGoals}
                  onChange={(e) => setNewGoals(e.target.value)}
                  placeholder="Monitor research papers&#10;Summarize findings&#10;Create DTUs from discoveries"
                  className="input-lattice w-full h-20 resize-none"
                />
              </div>

              {/* Tools */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Tools</label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TOOLS.map(tool => (
                    <button
                      key={tool}
                      onClick={() => setNewTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])}
                      className={`text-[11px] px-2 py-1 rounded-lg border transition-colors font-mono ${
                        newTools.includes(tool)
                          ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30'
                          : 'bg-lattice-bg text-gray-500 border-lattice-border hover:text-gray-300'
                      }`}
                    >
                      {tool}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model config */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Model</label>
                  <select value={newModel} onChange={(e) => setNewModel(e.target.value)} className="input-lattice w-full text-xs">
                    <option value="claude-opus-4-6">Opus 4.6</option>
                    <option value="claude-sonnet-4-5-20250929">Sonnet 4.5</option>
                    <option value="claude-haiku-4-5-20251001">Haiku 4.5</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Temperature: {newTemp}</label>
                  <input
                    type="range" min="0" max="1" step="0.1"
                    value={newTemp}
                    onChange={(e) => setNewTemp(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Max Tokens</label>
                  <select value={newMaxTokens} onChange={(e) => setNewMaxTokens(parseInt(e.target.value))} className="input-lattice w-full text-xs">
                    <option value="1024">1,024</option>
                    <option value="2048">2,048</option>
                    <option value="4096">4,096</option>
                    <option value="8192">8,192</option>
                    <option value="16384">16,384</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreate(false); resetCreateForm(); }}
                  className="flex-1 py-2.5 border border-lattice-border rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createAgent.mutate()}
                  disabled={!newName.trim() || createAgent.isPending}
                  className="flex-1 py-2.5 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90 transition-colors disabled:opacity-50"
                >
                  {createAgent.isPending ? 'Creating...' : 'Deploy Agent'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
