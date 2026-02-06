'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Plus, Play, Power, Activity, Clock,
  Settings, Zap, Users
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  type?: string;
  enabled?: boolean;
  config?: any;
  lastTick?: string;
  status?: string;
}

export default function AgentsLensPage() {
  useLensNav('agents');

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('general');

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiHelpers.agents.list().then((r) => r.data),
    refetchInterval: 5000,
  });

  const createAgent = useMutation({
    mutationFn: () => apiHelpers.agents.create({ name: newName, type: newType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setShowCreate(false);
      setNewName('');
    },
  });

  const enableAgent = useMutation({
    mutationFn: (id: string) => apiHelpers.agents.enable(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const tickAgent = useMutation({
    mutationFn: (id: string) => apiHelpers.agents.tick(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const agents: Agent[] = agentsData?.agents || agentsData || [];
  const activeCount = agents.filter((a) => a.enabled).length;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-xl font-bold">Agents Lens</h1>
            <p className="text-sm text-gray-400">
              Autonomous agents — create, enable, tick, and monitor
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-neon purple flex items-center gap-1 text-sm"
        >
          <Plus className="w-3 h-3" /> New Agent
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Bot className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{agents.length}</p>
          <p className="text-sm text-gray-400">Total Agents</p>
        </div>
        <div className="lens-card">
          <Power className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{activeCount}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="lens-card">
          <Activity className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{agents.length - activeCount}</p>
          <p className="text-sm text-gray-400">Dormant</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-sm text-gray-400">Ticks/min</p>
        </div>
      </div>

      {/* Create Agent */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="panel p-4 space-y-3"
        >
          <h2 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-neon-purple" /> Create Agent
          </h2>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Agent name..."
            className="input-lattice w-full"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="input-lattice w-full"
          >
            <option value="general">General</option>
            <option value="research">Research</option>
            <option value="critic">Critic</option>
            <option value="synthesizer">Synthesizer</option>
            <option value="monitor">Monitor</option>
          </select>
          <button
            onClick={() => createAgent.mutate()}
            disabled={!newName || createAgent.isPending}
            className="btn-neon purple w-full"
          >
            {createAgent.isPending ? 'Creating...' : 'Create Agent'}
          </button>
        </motion.div>
      )}

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="col-span-full panel p-12 text-center text-gray-500">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No agents yet. Create your first autonomous agent!</p>
          </div>
        ) : (
          agents.map((agent) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`panel p-4 border-l-4 ${
                agent.enabled ? 'border-l-green-500' : 'border-l-gray-500'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{agent.name}</h3>
                  <span className="text-xs text-gray-400">{agent.type || 'general'}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  agent.enabled
                    ? 'bg-green-400/20 text-green-400'
                    : 'bg-gray-400/20 text-gray-400'
                }`}>
                  {agent.enabled ? 'Active' : 'Dormant'}
                </span>
              </div>

              {agent.lastTick && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                  <Clock className="w-3 h-3" />
                  Last tick: {new Date(agent.lastTick).toLocaleString()}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => enableAgent.mutate(agent.id)}
                  className={`flex-1 btn-neon text-xs flex items-center justify-center gap-1 ${
                    agent.enabled ? '' : 'purple'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  {agent.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => tickAgent.mutate(agent.id)}
                  disabled={!agent.enabled}
                  className="flex-1 btn-neon text-xs flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3" /> Tick
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
