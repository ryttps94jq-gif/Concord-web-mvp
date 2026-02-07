'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Wand2, Plus, Code, Eye, Trash2, Copy, Settings } from 'lucide-react';

interface CustomLens {
  id: string;
  name: string;
  description: string;
  config: object;
  createdAt: string;
  isActive: boolean;
}

export default function CustomLensPage() {
  useLensNav('custom');

  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [newLensName, setNewLensName] = useState('');
  const [newLensConfig, setNewLensConfig] = useState('{}');
  const [selectedLens, setSelectedLens] = useState<string | null>(null);

  const { data: customLenses } = useQuery({
    queryKey: ['custom-lenses'],
    queryFn: () => api.get('/api/lenses/custom').then((r) => r.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['lens-templates'],
    queryFn: () => api.get('/api/lenses/templates').then((r) => r.data),
  });

  const createLens = useMutation({
    mutationFn: (payload: { name: string; config: string }) =>
      api.post('/api/lenses/custom', {
        name: payload.name,
        config: JSON.parse(payload.config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-lenses'] });
      setShowBuilder(false);
      setNewLensName('');
      setNewLensConfig('{}');
    },
  });

  const deleteLens = useMutation({
    mutationFn: (id: string) => api.delete(`/api/lenses/custom/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-lenses'] });
      setSelectedLens(null);
    },
  });

  const toggleLens = useMutation({
    mutationFn: (id: string) => api.post(`/api/lenses/custom/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-lenses'] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔧</span>
          <div>
            <h1 className="text-xl font-bold">Custom Lens Builder</h1>
            <p className="text-sm text-gray-400">
              Create and manage custom lens configurations
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="btn-neon purple"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          New Lens
        </button>
      </header>

      {/* Lens Builder Modal */}
      {showBuilder && (
        <div className="panel p-4 space-y-4 border-neon-purple">
          <h3 className="font-semibold flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-neon-purple" />
            Create Custom Lens
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Lens Name</label>
              <input
                type="text"
                value={newLensName}
                onChange={(e) => setNewLensName(e.target.value)}
                placeholder="My Custom Lens"
                className="input-lattice"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">
                Configuration (JSON)
              </label>
              <textarea
                value={newLensConfig}
                onChange={(e) => setNewLensConfig(e.target.value)}
                placeholder='{"widgets": [], "layout": "grid"}'
                className="input-lattice font-mono text-sm h-40 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => createLens.mutate({ name: newLensName, config: newLensConfig })}
                disabled={!newLensName || createLens.isPending}
                className="btn-neon purple flex-1"
              >
                {createLens.isPending ? 'Creating...' : 'Create Lens'}
              </button>
              <button onClick={() => setShowBuilder(false)} className="btn-neon">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Custom Lenses List */}
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4 text-neon-blue" />
            Your Custom Lenses
          </h3>

          <div className="space-y-2">
            {customLenses?.lenses?.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                No custom lenses yet. Create your first one!
              </p>
            ) : (
              customLenses?.lenses?.map((lens: CustomLens) => (
                <button
                  key={lens.id}
                  onClick={() => setSelectedLens(lens.id)}
                  className={`w-full text-left lens-card ${
                    selectedLens === lens.id ? 'border-neon-cyan' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{lens.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        lens.isActive
                          ? 'bg-neon-green/20 text-neon-green'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {lens.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Created {new Date(lens.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Lens Detail / Preview */}
        <div className="lg:col-span-2 panel p-4 space-y-4">
          {selectedLens ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-neon-cyan" />
                  Lens Preview
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleLens.mutate(selectedLens)}
                    className="btn-neon text-sm"
                  >
                    {customLenses?.lenses?.find((l: CustomLens) => l.id === selectedLens)?.isActive
                      ? 'Deactivate'
                      : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteLens.mutate(selectedLens)}
                    className="btn-neon pink text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="graph-container flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Lens preview would render here</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Configuration</span>
                  <button className="text-gray-400 hover:text-white">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <pre className="bg-lattice-deep p-4 rounded-lg text-sm font-mono overflow-auto max-h-48">
                  {JSON.stringify(
                    customLenses?.lenses?.find((l: CustomLens) => l.id === selectedLens)?.config,
                    null,
                    2
                  )}
                </pre>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Wand2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a lens to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Templates */}
      <div className="panel p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Code className="w-4 h-4 text-neon-purple" />
          Lens Templates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.templates?.map((template: Record<string, unknown>) => (
            <div key={template.id as string} className="lens-card">
              <span className="text-2xl">{String(template.icon)}</span>
              <h4 className="font-semibold mt-2">{String(template.name)}</h4>
              <p className="text-sm text-gray-400 mt-1">{String(template.description)}</p>
              <button
                onClick={() => {
                  setNewLensName(template.name as string);
                  setNewLensConfig(JSON.stringify(template.config, null, 2));
                  setShowBuilder(true);
                }}
                className="btn-neon text-sm w-full mt-3"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
