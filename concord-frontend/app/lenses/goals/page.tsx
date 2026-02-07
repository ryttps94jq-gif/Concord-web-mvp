'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  Plus,
  CheckCircle2,
  XCircle,
  Play,
  Clock,
  Sparkles
} from 'lucide-react';

interface Goal {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress: number;
  priority?: string;
  targetDate?: string;
  createdAt?: string;
}

export default function GoalsLensPage() {
  useLensNav('goals');

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [filter, setFilter] = useState<string>('all');

  const { data: goalsData, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => apiHelpers.goals.list().then((r) => r.data),
    refetchInterval: 10000,
  });

  const { data: _statusData } = useQuery({
    queryKey: ['goals-status'],
    queryFn: () => apiHelpers.goals.status().then((r) => r.data),
  });

  const createGoal = useMutation({
    mutationFn: () =>
      apiHelpers.goals.create({
        title: newTitle,
        description: newDescription,
        priority: newPriority,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowCreate(false);
      setNewTitle('');
      setNewDescription('');
    },
  });

  const completeGoal = useMutation({
    mutationFn: (goalId: string) => apiHelpers.goals.complete(goalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const activateGoal = useMutation({
    mutationFn: (goalId: string) => apiHelpers.goals.activate(goalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const abandonGoal = useMutation({
    mutationFn: (goalId: string) => apiHelpers.goals.abandon(goalId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const autoPropose = useMutation({
    mutationFn: () => apiHelpers.goals.autoPropose(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const goals: Goal[] = goalsData?.goals || goalsData || [];
  const filtered = filter === 'all' ? goals : goals.filter((g) => g.status === filter);

  const statusCounts = {
    active: goals.filter((g) => g.status === 'active').length,
    completed: goals.filter((g) => g.status === 'completed').length,
    proposed: goals.filter((g) => g.status === 'proposed').length,
    abandoned: goals.filter((g) => g.status === 'abandoned').length,
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'high': return 'text-red-400 bg-red-400/20';
      case 'low': return 'text-gray-400 bg-gray-400/20';
      default: return 'text-yellow-400 bg-yellow-400/20';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <h1 className="text-xl font-bold">Goals Lens</h1>
            <p className="text-sm text-gray-400">
              Goal lifecycle management — create, track, complete
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => autoPropose.mutate()}
            disabled={autoPropose.isPending}
            className="btn-neon flex items-center gap-1 text-sm"
          >
            <Sparkles className="w-3 h-3" />
            {autoPropose.isPending ? 'Proposing...' : 'Auto-Propose'}
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-neon purple flex items-center gap-1 text-sm"
          >
            <Plus className="w-3 h-3" /> New Goal
          </button>
        </div>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Play className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{statusCounts.active}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="lens-card">
          <CheckCircle2 className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{statusCounts.completed}</p>
          <p className="text-sm text-gray-400">Completed</p>
        </div>
        <div className="lens-card">
          <Clock className="w-5 h-5 text-neon-yellow mb-2" />
          <p className="text-2xl font-bold">{statusCounts.proposed}</p>
          <p className="text-sm text-gray-400">Proposed</p>
        </div>
        <div className="lens-card">
          <XCircle className="w-5 h-5 text-gray-500 mb-2" />
          <p className="text-2xl font-bold">{statusCounts.abandoned}</p>
          <p className="text-sm text-gray-400">Abandoned</p>
        </div>
      </div>

      {/* Create Goal Form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="panel p-4 space-y-3"
        >
          <h2 className="font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-neon-purple" />
            Create Goal
          </h2>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Goal title..."
            className="input-lattice w-full"
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)..."
            className="input-lattice w-full h-20 resize-none"
          />
          <div className="flex gap-2 items-center">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="input-lattice"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button
              onClick={() => createGoal.mutate()}
              disabled={!newTitle || createGoal.isPending}
              className="btn-neon purple flex-1"
            >
              {createGoal.isPending ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'active', 'proposed', 'completed', 'abandoned'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              filter === f
                ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                : 'bg-lattice-surface text-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Goals List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading goals...</div>
        ) : filtered.length === 0 ? (
          <div className="panel p-12 text-center text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No goals yet. Create one or use Auto-Propose!</p>
          </div>
        ) : (
          filtered.map((goal) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="panel p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{goal.title}</h3>
                    {goal.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(goal.priority)}`}>
                        {goal.priority}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      goal.status === 'active' ? 'bg-blue-400/20 text-blue-400' :
                      goal.status === 'completed' ? 'bg-green-400/20 text-green-400' :
                      goal.status === 'proposed' ? 'bg-yellow-400/20 text-yellow-400' :
                      'bg-gray-400/20 text-gray-400'
                    }`}>
                      {goal.status}
                    </span>
                  </div>
                  {goal.description && (
                    <p className="text-sm text-gray-400 mb-2">{goal.description}</p>
                  )}
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-lattice-deep rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-cyan rounded-full transition-all"
                        style={{ width: `${(goal.progress || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-mono">
                      {((goal.progress || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  {goal.status === 'proposed' && (
                    <button
                      onClick={() => activateGoal.mutate(goal.id)}
                      className="p-1.5 rounded hover:bg-blue-400/20 text-blue-400"
                      title="Activate"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {goal.status === 'active' && (
                    <button
                      onClick={() => completeGoal.mutate(goal.id)}
                      className="p-1.5 rounded hover:bg-green-400/20 text-green-400"
                      title="Complete"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {(goal.status === 'active' || goal.status === 'proposed') && (
                    <button
                      onClick={() => abandonGoal.mutate(goal.id)}
                      className="p-1.5 rounded hover:bg-red-400/20 text-red-400"
                      title="Abandon"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
