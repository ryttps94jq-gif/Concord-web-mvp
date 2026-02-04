'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { PenTool, Plus, Link2, Maximize2 } from 'lucide-react';

export default function WhiteboardLensPage() {
  useLensNav('whiteboard');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: whiteboards, isLoading } = useQuery({
    queryKey: ['whiteboards'],
    queryFn: () => api.get('/api/whiteboards').then(r => r.data),
  });

  const { data: selectedWb } = useQuery({
    queryKey: ['whiteboard', selectedId],
    queryFn: () => api.get(`/api/whiteboard/${selectedId}`).then(r => r.data),
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; linkedDtus: string[] }) =>
      api.post('/api/whiteboard', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whiteboards'] });
      setSelectedId(res.data.dtuId);
      setShowCreate(false);
    },
  });

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PenTool className="w-8 h-8 text-neon-pink" />
          <div>
            <h1 className="text-xl font-bold">Whiteboard</h1>
            <p className="text-sm text-gray-400">
              Visual diagramming with DTU linking (Excalidraw-ready)
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Whiteboard
        </button>
      </header>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Whiteboard List */}
        <div className="w-64 space-y-3 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-400">Whiteboards ({whiteboards?.count || 0})</h2>
          {isLoading ? (
            <div className="text-gray-500 text-sm">Loading...</div>
          ) : (
            whiteboards?.whiteboards?.map((wb: any) => (
              <div
                key={wb.id}
                onClick={() => setSelectedId(wb.id)}
                className={`panel p-3 cursor-pointer hover:border-neon-pink/50 transition-colors ${selectedId === wb.id ? 'border-neon-pink' : ''}`}
              >
                <h3 className="font-medium truncate">{wb.title}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                  <span>{wb.elementCount} elements</span>
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    {wb.linkedDtuCount}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 panel p-4 flex flex-col">
          {selectedWb ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{selectedWb.whiteboard?.title}</h2>
                <button className="p-2 hover:bg-lattice-surface rounded">
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 bg-lattice-surface rounded-lg flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <PenTool className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Excalidraw canvas integration ready</p>
                  <p className="text-sm mt-1">{selectedWb.whiteboard?.elements?.length || 0} elements</p>
                  <p className="text-xs mt-2 text-gray-600">
                    Linked to {selectedWb.linkedDtus?.length || 0} DTUs
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <PenTool className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select or create a whiteboard</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold">Create Whiteboard</h2>
            <CreateWhiteboardForm
              onClose={() => setShowCreate(false)}
              onCreate={(data: { title: string; linkedDtus: string[] }) => createMutation.mutate(data)}
              creating={createMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreateWhiteboardForm({ onClose, onCreate, creating }: any) {
  const [title, setTitle] = useState('');

  return (
    <>
      <input
        type="text"
        placeholder="Whiteboard Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded"
      />
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={() => onCreate({ title, linkedDtus: [] })}
          disabled={creating || !title}
          className="btn-primary"
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </>
  );
}
