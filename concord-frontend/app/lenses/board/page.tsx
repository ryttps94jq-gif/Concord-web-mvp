'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Layout, Plus, MoreHorizontal, GripVertical } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
}

const columns = [
  { id: 'todo', name: 'To Do', color: 'text-gray-400' },
  { id: 'in_progress', name: 'In Progress', color: 'text-neon-blue' },
  { id: 'review', name: 'Review', color: 'text-neon-purple' },
  { id: 'done', name: 'Done', color: 'text-neon-green' },
];

export default function BoardLensPage() {
  useLensNav('board');

  const queryClient = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const { data: tasks } = useQuery({
    queryKey: ['board-tasks'],
    queryFn: () => api.get('/api/board/tasks').then((r) => r.data),
  });

  const createTask = useMutation({
    mutationFn: (title: string) =>
      api.post('/api/board/tasks', { title, status: 'todo' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-tasks'] });
      setNewTaskTitle('');
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/board/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board-tasks'] });
    },
  });

  const getTasksByStatus = (status: string) =>
    tasks?.tasks?.filter((t: Task) => t.status === status) || [];

  const priorityColors = {
    low: 'bg-gray-500/20 text-gray-400',
    medium: 'bg-neon-blue/20 text-neon-blue',
    high: 'bg-neon-pink/20 text-neon-pink',
  };

  return (
    <div className="p-6 space-y-6 h-full">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h1 className="text-xl font-bold">Board Lens</h1>
            <p className="text-sm text-gray-400">
              Kanban-style task management
            </p>
          </div>
        </div>
      </header>

      {/* Quick Add */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newTaskTitle && createTask.mutate(newTaskTitle)}
          placeholder="Quick add task..."
          className="input-lattice flex-1"
        />
        <button
          onClick={() => newTaskTitle && createTask.mutate(newTaskTitle)}
          disabled={!newTaskTitle || createTask.isPending}
          className="btn-neon purple"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
        {columns.map((column) => (
          <div
            key={column.id}
            className="panel p-4 flex flex-col min-h-[400px]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold ${column.color}`}>
                {column.name}
              </h3>
              <span className="text-xs bg-lattice-elevated px-2 py-1 rounded">
                {getTasksByStatus(column.id).length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-auto">
              {getTasksByStatus(column.id).map((task: Task) => (
                <div
                  key={task.id}
                  className="lens-card cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('taskId');
                    updateTaskStatus.mutate({ id: taskId, status: column.id });
                  }}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            priorityColors[task.priority]
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                    <button className="text-gray-500 hover:text-white">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Drop zone indicator */}
            <div
              className="mt-2 border-2 border-dashed border-lattice-border rounded-lg p-4 text-center text-gray-500 text-sm opacity-0 hover:opacity-100 transition-opacity"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-neon-blue', 'opacity-100');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-neon-blue', 'opacity-100');
              }}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('taskId');
                updateTaskStatus.mutate({ id: taskId, status: column.id });
                e.currentTarget.classList.remove('border-neon-blue', 'opacity-100');
              }}
            >
              Drop here
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
