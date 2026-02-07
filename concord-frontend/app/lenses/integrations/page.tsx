'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Plug, Webhook, Zap, Code, FileText, Plus, Trash2, Play, ToggleLeft, ToggleRight } from 'lucide-react';

export default function IntegrationsLensPage() {
  useLensNav('integrations');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'webhooks' | 'automations' | 'services'>('webhooks');
  const [showCreate, setShowCreate] = useState(false);

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/api/webhooks').then(r => r.data),
  });

  const { data: automations } = useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/api/automations').then(r => r.data),
  });

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/api/integrations').then(r => r.data),
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/api/webhooks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowCreate(false);
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.post(`/api/webhooks/${id}/toggle`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const runAutomationMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/automations/${id}/run`, {}),
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="w-8 h-8 text-neon-green" />
          <div>
            <h1 className="text-xl font-bold">Integrations</h1>
            <p className="text-sm text-gray-400">
              Webhooks, automations, and external services
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add {activeTab === 'webhooks' ? 'Webhook' : 'Automation'}
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-lattice-border">
        {[
          { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" />, count: webhooks?.count },
          { id: 'automations', label: 'Automations', icon: <Zap className="w-4 h-4" />, count: automations?.count },
          { id: 'services', label: 'Services', icon: <Plug className="w-4 h-4" />, count: integrations?.integrations?.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-neon-green text-neon-green'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className="text-xs bg-lattice-surface px-1.5 py-0.5 rounded">{tab.count || 0}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'webhooks' && (
        <div className="space-y-3">
          {webhooks?.webhooks?.length === 0 ? (
            <EmptyState icon={<Webhook />} message="No webhooks configured" />
          ) : (
            webhooks?.webhooks?.map((wh: Record<string, unknown>) => (
              <div key={wh.id as string} className="panel p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{String(wh.name)}</h3>
                  <p className="text-xs text-gray-400 truncate max-w-md">{String(wh.url)}</p>
                  <div className="flex gap-2 mt-1">
                    {(wh.events as string[])?.map((e: string) => (
                      <span key={e} className="text-xs bg-lattice-surface px-2 py-0.5 rounded">{e}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{String(wh.triggerCount)} triggers</span>
                  <button
                    onClick={() => toggleWebhookMutation.mutate({ id: wh.id as string, enabled: !(wh.enabled as boolean) })}
                    className="text-gray-400 hover:text-white"
                  >
                    {wh.enabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={() => deleteWebhookMutation.mutate(wh.id as string)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'automations' && (
        <div className="space-y-3">
          {automations?.automations?.length === 0 ? (
            <EmptyState icon={<Zap />} message="No automations configured" />
          ) : (
            automations?.automations?.map((auto: Record<string, unknown>) => (
              <div key={auto.id as string} className="panel p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{String(auto.name)}</h3>
                  <p className="text-xs text-gray-400">Trigger: {String(auto.trigger)} | Actions: {String(auto.actionCount)}</p>
                  <p className="text-xs text-gray-500 mt-1">Runs: {String(auto.runCount)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => runAutomationMutation.mutate(auto.id as string)}
                    disabled={runAutomationMutation.isPending}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <Play className="w-4 h-4" />
                    Run
                  </button>
                  <span className={`w-2 h-2 rounded-full ${auto.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations?.integrations?.map((svc: Record<string, unknown>) => (
            <div key={svc.id as string} className="panel p-4">
              <div className="flex items-center gap-3 mb-2">
                {(svc.id as string) === 'vscode' && <Code className="w-6 h-6 text-blue-400" />}
                {(svc.id as string) === 'obsidian' && <FileText className="w-6 h-6 text-purple-400" />}
                {(svc.id as string) === 'notion' && <FileText className="w-6 h-6 text-white" />}
                {!['vscode', 'obsidian', 'notion'].includes(svc.id as string) && <Plug className="w-6 h-6 text-gray-400" />}
                <div>
                  <h3 className="font-semibold">{String(svc.name)}</h3>
                  <span className={`text-xs ${(svc.status as string) === 'available' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {String(svc.status)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-400">{String(svc.description)}</p>
              <p className="text-xs text-gray-500 mt-2">Type: {String(svc.type)}</p>
            </div>
          ))}
        </div>
      )}

      {showCreate && activeTab === 'webhooks' && (
        <CreateWebhookModal
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createWebhookMutation.mutate(data)}
          creating={createWebhookMutation.isPending}
        />
      )}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="panel p-8 text-center text-gray-400">
      <div className="w-12 h-12 mx-auto mb-3 opacity-50">{icon}</div>
      <p>{message}</p>
    </div>
  );
}

function CreateWebhookModal({ onClose, onCreate, creating }: { onClose: () => void; onCreate: (data: Record<string, unknown>) => void; creating: boolean }) {
  const [form, setForm] = useState({ name: '', url: '', events: 'dtu.created' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">Create Webhook</h2>
        <input
          type="text"
          placeholder="Webhook Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        />
        <input
          type="text"
          placeholder="URL (https://...)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        />
        <input
          type="text"
          placeholder="Events (comma-separated)"
          value={form.events}
          onChange={(e) => setForm({ ...form, events: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onCreate({ ...form, events: form.events.split(',').map(e => e.trim()) })}
            disabled={creating || !form.name || !form.url}
            className="btn-primary"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
