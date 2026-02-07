'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Users, Plus, Terminal, GitFork, Activity, Play } from 'lucide-react';

interface Entity {
  id: string;
  name: string;
  type: 'worker' | 'researcher' | 'guardian' | 'architect';
  status: 'active' | 'idle' | 'suspended';
  workspace: string;
  forks: number;
  createdAt: string;
  lastActive: string;
}

export default function EntityLensPage() {
  useLensNav('entity');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState<Entity['type']>('worker');
  const [terminalEntity, setTerminalEntity] = useState<string | null>(null);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);

  // Fetch entities from backend
  const { data: entitiesData, isLoading } = useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const res = await api.get('/api/entities');
      return res.data;
    },
  });

  const entities: Entity[] = entitiesData?.entities || [];

  const createEntity = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await api.post('/api/entities', data);
      return res.data;
    },
    onSuccess: () => {
      setShowCreate(false);
      setNewEntityName('');
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });

  const forkEntity = useMutation({
    mutationFn: async (entityId: string) => {
      const res = await api.post(`/api/entities/${entityId}/fork`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });

  const executeTerminal = useMutation({
    mutationFn: async (data: { entityId: string; command: string }) => {
      const res = await api.post('/api/entity/terminal', data);
      return res.data;
    },
    onSuccess: (data) => {
      setTerminalOutput(prev => [
        ...prev,
        `$ ${terminalCommand}`,
        data.output || data.error || JSON.stringify(data)
      ]);
      setTerminalCommand('');
    },
    onError: (err: Record<string, unknown>) => {
      setTerminalOutput(prev => [
        ...prev,
        `$ ${terminalCommand}`,
        `Error: ${err.message || 'Command failed'}`
      ]);
    },
  });

  const typeColors = {
    worker: 'text-neon-blue bg-neon-blue/20',
    researcher: 'text-neon-purple bg-neon-purple/20',
    guardian: 'text-neon-green bg-neon-green/20',
    architect: 'text-neon-cyan bg-neon-cyan/20',
  };

  const statusColors = {
    active: 'bg-neon-green',
    idle: 'bg-yellow-500',
    suspended: 'bg-neon-pink',
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-xl font-bold">Entity Lens</h1>
            <p className="text-sm text-gray-400">
              Create and manage swarm entities with terminal access
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-neon purple"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Spawn Entity
        </button>
      </header>

      {/* Create Entity Form */}
      {showCreate && (
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold">Spawn New Entity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Entity Name</label>
              <input
                type="text"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                placeholder="e.g., Research Beta"
                className="input-lattice w-full"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Entity Type</label>
              <select
                value={newEntityType}
                onChange={(e) => setNewEntityType(e.target.value as Entity['type'])}
                className="input-lattice w-full"
              >
                <option value="worker">Worker - Task execution</option>
                <option value="researcher">Researcher - DTU synthesis</option>
                <option value="guardian">Guardian - Security & invariants</option>
                <option value="architect">Architect - System evolution</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => createEntity.mutate({ name: newEntityName, type: newEntityType })}
            disabled={!newEntityName || createEntity.isPending}
            className="btn-neon green"
          >
            {createEntity.isPending ? 'Spawning...' : 'Spawn Entity'}
          </button>
        </div>
      )}

      {/* Terminal Modal */}
      {terminalEntity && (
        <div className="panel p-4 space-y-4 border-2 border-neon-cyan">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neon-cyan" />
              Terminal: {entities.find(e => e.id === terminalEntity)?.name}
            </h3>
            <button
              onClick={() => {
                setTerminalEntity(null);
                setTerminalOutput([]);
              }}
              className="text-gray-400 hover:text-white"
            >
              X
            </button>
          </div>
          <div className="bg-black rounded p-3 h-48 overflow-y-auto font-mono text-sm text-neon-green">
            {terminalOutput.length === 0 ? (
              <p className="text-gray-500">Terminal ready. Entity has council-gated access to system commands.</p>
            ) : (
              terminalOutput.map((line, i) => (
                <div key={i} className={line.startsWith('$') ? 'text-white' : ''}>{line}</div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={terminalCommand}
              onChange={(e) => setTerminalCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && terminalCommand.trim()) {
                  executeTerminal.mutate({ entityId: terminalEntity, command: terminalCommand });
                }
              }}
              placeholder="Enter command..."
              className="input-lattice flex-1 font-mono"
            />
            <button
              onClick={() => {
                if (terminalCommand.trim()) {
                  executeTerminal.mutate({ entityId: terminalEntity, command: terminalCommand });
                }
              }}
              disabled={!terminalCommand.trim() || executeTerminal.isPending}
              className="btn-neon cyan"
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Users className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{entities.length}</p>
          <p className="text-sm text-gray-400">Total Entities</p>
        </div>
        <div className="lens-card">
          <Activity className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{entities.filter((e) => e.status === 'active').length}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="lens-card">
          <GitFork className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{entities.reduce((s, e) => s + e.forks, 0)}</p>
          <p className="text-sm text-gray-400">Total Forks</p>
        </div>
        <div className="lens-card">
          <Terminal className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{new Set(entities.map((e) => e.workspace)).size}</p>
          <p className="text-sm text-gray-400">Workspaces</p>
        </div>
      </div>

      {/* Entity Grid */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-neon-blue" />
          Entity Registry
        </h2>
        {isLoading ? (
          <p className="text-gray-400">Loading entities...</p>
        ) : entities.length === 0 ? (
          <p className="text-gray-400">No entities spawned yet. Click "Spawn Entity" to create one.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entities.map((entity) => (
              <div key={entity.id} className="lens-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{entity.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{entity.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[entity.status]}`} />
                    <span className={`text-xs px-2 py-0.5 rounded ${typeColors[entity.type]}`}>
                      {entity.type}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Workspace</p>
                    <p className="font-mono">{entity.workspace}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Forks</p>
                    <p className="font-bold text-neon-purple">{entity.forks}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setTerminalEntity(entity.id)}
                    className="btn-neon text-xs flex-1"
                  >
                    <Terminal className="w-3 h-3 mr-1 inline" />
                    Terminal
                  </button>
                  <button
                    onClick={() => forkEntity.mutate(entity.id)}
                    disabled={forkEntity.isPending}
                    className="btn-neon text-xs flex-1"
                  >
                    <GitFork className="w-3 h-3 mr-1 inline" />
                    Fork
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
