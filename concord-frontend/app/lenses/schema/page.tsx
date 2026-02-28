'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { FileCode, Plus, Check, X } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

export default function SchemaLensPage() {
  useLensNav('schema');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('schema');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [validateData, setValidateData] = useState({ schemaName: '', data: '' });
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors?: { field: string; error: string }[] } | null>(null);

  const { items: schemaItems, isLoading, isError: isError, error: error, refetch: refetch, create: createSchemaItem } = useLensData<Record<string, unknown>>('schema', 'definition', { seed: [] });
  const schemas = schemaItems.map(i => ({ id: i.id, name: i.title, ...(i.data || {}) })) as unknown as Record<string, unknown>[];

  const createMutation = useMutation({
    mutationFn: (data: unknown) => createSchemaItem({ title: (data as Record<string, string>)?.name || 'schema', data: data as Record<string, unknown> }),
    onSuccess: () => {
      refetch();
      setShowCreate(false);
    },
    onError: (err) => {
      console.error('Schema creation failed:', err instanceof Error ? err.message : err);
    },
  });

  const validateMutation = useMutation({
    mutationFn: (data: { schemaName: string; data: unknown }) =>
      apiHelpers.lens.run('schema', data.schemaName, { action: 'validate', params: data }),
    onSuccess: (result) => setValidationResult(result.data),
    onError: (err) => {
      setValidationResult({ valid: false, errors: [{ field: 'API', error: err instanceof Error ? err.message : 'Validation request failed' }] });
    },
  });

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(validateData.data);
      validateMutation.mutate({ schemaName: validateData.schemaName, data: parsed });
    } catch {
      setValidationResult({ valid: false, errors: [{ field: 'JSON', error: 'Invalid JSON' }] });
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCode className="w-8 h-8 text-neon-cyan" />
          <div>
            <h1 className="text-xl font-bold">Dynamic Schemas</h1>
            <p className="text-sm text-gray-400">
              Create and manage DTU schema templates (CRETI enhanced)
            </p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="schema" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Schema
        </button>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="schema" artifactId={schemaItems[0]?.id} compact />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schema List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Schemas ({schemas?.length || 0})</h2>
          {isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {schemas?.map((schema: Record<string, unknown>) => (
                <SchemaCard key={(schema.id || schema.name) as string} schema={schema} />
              ))}
            </div>
          )}
        </div>

        {/* Validation Tester */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Schema Validator</h2>
          <div className="panel p-4 space-y-4">
            <select
              value={validateData.schemaName}
              onChange={(e) => setValidateData({ ...validateData, schemaName: e.target.value })}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
            >
              <option value="">Select Schema</option>
              {schemas?.map((s: Record<string, unknown>) => (
                <option key={s.name as string} value={s.name as string}>{s.name as string}</option>
              ))}
            </select>
            <textarea
              placeholder='{"field": "value"}'
              value={validateData.data}
              onChange={(e) => setValidateData({ ...validateData, data: e.target.value })}
              className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded h-32 font-mono text-sm"
            />
            <button
              onClick={handleValidate}
              disabled={!validateData.schemaName || !validateData.data || validateMutation.isPending}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validateMutation.isPending ? 'Validating...' : 'Validate'}
            </button>

            {validationResult && (
              <div className={`p-3 rounded ${validationResult.valid ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {validationResult.valid ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <X className="w-5 h-5 text-red-400" />
                  )}
                  <span className={validationResult.valid ? 'text-green-400' : 'text-red-400'}>
                    {validationResult.valid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                {(validationResult.errors as Array<{ field: string; error: string }> | undefined)?.length ? (
                  <ul className="text-sm text-red-300 space-y-1">
                    {(validationResult.errors as Array<{ field: string; error: string }>).map((err, i: number) => (
                      <li key={i}>{err.field}: {err.error}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateSchemaModal
          onClose={() => setShowCreate(false)}
          onCreate={(data: { name: string; kind: string; fields: Array<{ name: string; type: string; required: boolean }> }) => createMutation.mutate(data)}
          creating={createMutation.isPending}
        />
      )}
    </div>
  );
}

function SchemaCard({ schema }: { schema: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{schema.name as string}</h3>
          <p className="text-xs text-gray-400">Kind: {schema.kind as string} | Fields: {(schema.fields as unknown[])?.length || 0}</p>
        </div>
        <span className="text-xs text-gray-400">v{(schema.version as number) || 1}</span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-lattice-border">
          <h4 className="text-sm font-medium mb-2">Fields:</h4>
          <div className="space-y-1">
            {(schema.fields as Record<string, unknown>[])?.map((field: Record<string, unknown>) => (
              <div key={field.name as string} className="text-sm flex items-center gap-2">
                <span className="text-neon-cyan">{field.name as string}</span>
                <span className="text-gray-500">: {field.type as string}</span>
                {(field.required as boolean) && <span className="text-xs text-red-400">*</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateSchemaModal({ onClose, onCreate, creating }: { onClose: () => void; onCreate: (data: { name: string; kind: string; fields: { name: string; type: string; required: boolean }[] }) => void; creating: boolean }) {
  const [form, setForm] = useState({
    name: '',
    kind: '',
    fields: [{ name: '', type: 'string', required: false }]
  });

  const addField = () => {
    setForm({ ...form, fields: [...form.fields, { name: '', type: 'string', required: false }] });
  };

  const updateField = (idx: number, key: string, value: unknown) => {
    const fields = [...form.fields];
    fields[idx] = { ...fields[idx], [key]: value };
    setForm({ ...form, fields });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-bold">Create Schema</h2>
        <input
          type="text"
          placeholder="Schema Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        />
        <input
          type="text"
          placeholder="Kind (e.g., hypothesis, experiment)"
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
          className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Fields</h3>
            <button onClick={addField} className="text-xs text-neon-cyan">+ Add Field</button>
          </div>
          {form.fields.map((field, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                placeholder="Field name"
                value={field.name}
                onChange={(e) => updateField(idx, 'name', e.target.value)}
                className="flex-1 px-2 py-1 bg-lattice-surface border border-lattice-border rounded text-sm"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(idx, 'type', e.target.value)}
                className="px-2 py-1 bg-lattice-surface border border-lattice-border rounded text-sm"
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="array">array</option>
                <option value="reference">reference</option>
              </select>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(idx, 'required', e.target.checked)}
                />
                Req
              </label>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onCreate(form)}
            disabled={creating || !form.name || !form.kind}
            className="btn-primary"
          >
            {creating ? 'Creating...' : 'Create Schema'}
          </button>
        </div>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="schema"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>
    </div>
  );
}
