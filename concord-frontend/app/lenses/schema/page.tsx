'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { FileCode, Plus, Check, X, AlertCircle } from 'lucide-react';

export default function SchemaLensPage() {
  useLensNav('schema');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [validateData, setValidateData] = useState({ schemaName: '', data: '' });
  const [validationResult, setValidationResult] = useState<any>(null);

  const { data: schemas, isLoading } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => api.get('/api/schema').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/schema', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemas'] });
      setShowCreate(false);
    },
  });

  const validateMutation = useMutation({
    mutationFn: (data: { schemaName: string; data: any }) =>
      api.post('/api/schema/validate', data),
    onSuccess: (result) => setValidationResult(result.data),
  });

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(validateData.data);
      validateMutation.mutate({ schemaName: validateData.schemaName, data: parsed });
    } catch (e) {
      setValidationResult({ ok: false, valid: false, errors: [{ field: 'JSON', error: 'Invalid JSON' }] });
    }
  };

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
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Schema
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schema List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Available Schemas ({schemas?.count || 0})</h2>
          {isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {schemas?.schemas?.map((schema: any) => (
                <SchemaCard key={schema.id || schema.name} schema={schema} />
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
              {schemas?.schemas?.map((s: any) => (
                <option key={s.name} value={s.name}>{s.name}</option>
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
              disabled={!validateData.schemaName || !validateData.data}
              className="btn-primary w-full"
            >
              Validate
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
                {validationResult.errors?.length > 0 && (
                  <ul className="text-sm text-red-300 space-y-1">
                    {validationResult.errors.map((err: any, i: number) => (
                      <li key={i}>{err.field}: {err.error}</li>
                    ))}
                  </ul>
                )}
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

function SchemaCard({ schema }: { schema: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{schema.name}</h3>
          <p className="text-xs text-gray-400">Kind: {schema.kind} | Fields: {schema.fields?.length || 0}</p>
        </div>
        <span className="text-xs text-gray-400">v{schema.version || 1}</span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-lattice-border">
          <h4 className="text-sm font-medium mb-2">Fields:</h4>
          <div className="space-y-1">
            {schema.fields?.map((field: any) => (
              <div key={field.name} className="text-sm flex items-center gap-2">
                <span className="text-neon-cyan">{field.name}</span>
                <span className="text-gray-500">: {field.type}</span>
                {field.required && <span className="text-xs text-red-400">*</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateSchemaModal({ onClose, onCreate, creating }: any) {
  const [form, setForm] = useState({
    name: '',
    kind: '',
    fields: [{ name: '', type: 'string', required: false }]
  });

  const addField = () => {
    setForm({ ...form, fields: [...form.fields, { name: '', type: 'string', required: false }] });
  };

  const updateField = (idx: number, key: string, value: any) => {
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
      </div>
    </div>
  );
}
