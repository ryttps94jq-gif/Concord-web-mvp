'use client';

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Loader2, Save, Download, Trash2, Undo, Redo, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamically import Excalidraw (client-side only)
const Excalidraw = dynamic(
  async () => {
    const mod = await import('@excalidraw/excalidraw');
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-lattice-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
          <p className="text-sm text-gray-400">Loading whiteboard...</p>
        </div>
      </div>
    )
  }
);

interface ExcalidrawWrapperProps {
  initialData?: any;
  onChange?: (elements: any[], appState: any) => void;
  onSave?: (data: { elements: any[]; appState: any }) => void;
  readOnly?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
  gridMode?: boolean;
  showToolbar?: boolean;
}

export interface ExcalidrawRef {
  getElements: () => any[];
  getAppState: () => any;
  exportToBlob: () => Promise<Blob>;
  exportToSvg: () => Promise<SVGSVGElement>;
  resetScene: () => void;
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const ExcalidrawWrapper = forwardRef<ExcalidrawRef, ExcalidrawWrapperProps>(({
  initialData,
  onChange,
  onSave,
  readOnly = false,
  className,
  theme = 'dark',
  gridMode = true,
  showToolbar = true
}, ref) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getElements: () => excalidrawAPI?.getSceneElements() ?? [],
    getAppState: () => excalidrawAPI?.getAppState() ?? {},
    exportToBlob: async () => {
      if (!excalidrawAPI) throw new Error('Excalidraw not initialized');
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      return exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles()
      });
    },
    exportToSvg: async () => {
      if (!excalidrawAPI) throw new Error('Excalidraw not initialized');
      const { exportToSvg } = await import('@excalidraw/excalidraw');
      return exportToSvg({
        elements: excalidrawAPI.getSceneElements(),
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles()
      });
    },
    resetScene: () => excalidrawAPI?.resetScene(),
    undo: () => excalidrawAPI?.undo(),
    redo: () => excalidrawAPI?.redo(),
    zoomIn: () => excalidrawAPI?.zoom({ value: excalidrawAPI.getAppState().zoom.value * 1.2 }),
    zoomOut: () => excalidrawAPI?.zoom({ value: excalidrawAPI.getAppState().zoom.value / 1.2 }),
    resetZoom: () => excalidrawAPI?.resetZoom()
  }), [excalidrawAPI]);

  const handleChange = useCallback((elements: readonly any[], appState: any) => {
    setHasUnsavedChanges(true);
    onChange?.([...elements], appState);
  }, [onChange]);

  const handleSave = useCallback(async () => {
    if (!excalidrawAPI || !onSave) return;

    setIsSaving(true);
    try {
      await onSave({
        elements: excalidrawAPI.getSceneElements(),
        appState: excalidrawAPI.getAppState()
      });
      setHasUnsavedChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [excalidrawAPI, onSave]);

  const handleExportPNG = useCallback(async () => {
    if (!excalidrawAPI) return;

    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: { ...excalidrawAPI.getAppState(), exportWithDarkMode: theme === 'dark' },
        files: excalidrawAPI.getFiles()
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'whiteboard.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [excalidrawAPI, theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className={cn('relative h-full w-full', className)}>
      {/* Custom toolbar */}
      {showToolbar && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Unsaved indicator */}
          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-400 mr-2">Unsaved changes</span>
          )}

          <div className="flex items-center gap-1 p-1 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg">
            <button
              onClick={() => excalidrawAPI?.undo()}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              onClick={() => excalidrawAPI?.redo()}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-lattice-border mx-1" />
            <button
              onClick={() => excalidrawAPI?.resetScene()}
              className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
              title="Clear canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg">
            <button
              onClick={handleExportPNG}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Export as PNG"
            >
              <Download className="w-4 h-4" />
            </button>
            {onSave && (
              <button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className={cn(
                  'p-1.5 transition-colors',
                  hasUnsavedChanges
                    ? 'text-neon-cyan hover:text-neon-cyan/80'
                    : 'text-gray-600'
                )}
                title="Save"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Excalidraw canvas */}
      <Excalidraw
        excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        theme={theme}
        gridModeEnabled={gridMode}
        UIOptions={{
          canvasActions: {
            loadScene: true,
            export: { saveFileToDisk: true },
            saveToActiveFile: false,
            clearCanvas: true,
            changeViewBackgroundColor: true
          }
        }}
      />
    </div>
  );
});

ExcalidrawWrapper.displayName = 'ExcalidrawWrapper';

// Collaborative whiteboard with presence
interface CollaborativeWhiteboardProps extends ExcalidrawWrapperProps {
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
}

export function CollaborativeWhiteboard({
  roomId,
  userId,
  userName,
  userColor,
  ...props
}: CollaborativeWhiteboardProps) {
  const [collaborators, setCollaborators] = useState<Map<string, { name: string; color: string; pointer: { x: number; y: number } }>>(new Map());

  // In a real implementation, this would connect to a WebSocket for real-time sync
  useEffect(() => {
    // Connect to collaboration server
    console.log(`Joining room: ${roomId} as ${userName}`);

    // Simulate other users
    const fakeCollaborators = new Map([
      ['user-2', { name: 'Alice', color: '#22d3ee', pointer: { x: 300, y: 200 } }],
      ['user-3', { name: 'Bob', color: '#a855f7', pointer: { x: 500, y: 350 } }]
    ]);
    setCollaborators(fakeCollaborators);

    return () => {
      // Disconnect from collaboration server
      console.log(`Leaving room: ${roomId}`);
    };
  }, [roomId, userName]);

  return (
    <div className="relative h-full w-full">
      {/* Collaborator cursors */}
      {Array.from(collaborators.entries()).map(([id, collab]) => (
        <motion.div
          key={id}
          animate={{ x: collab.pointer.x, y: collab.pointer.y }}
          className="absolute pointer-events-none z-50"
          style={{ left: 0, top: 0 }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: collab.color }}
          >
            <path
              d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.94a.5.5 0 0 0 .35-.85L6.35 2.79a.5.5 0 0 0-.85.42z"
              fill="currentColor"
            />
          </svg>
          <span
            className="absolute left-5 top-5 px-1.5 py-0.5 text-[10px] text-white rounded whitespace-nowrap"
            style={{ backgroundColor: collab.color }}
          >
            {collab.name}
          </span>
        </motion.div>
      ))}

      {/* Active collaborators indicator */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-full">
        <div className="flex -space-x-1">
          {Array.from(collaborators.entries()).slice(0, 3).map(([id, collab]) => (
            <div
              key={id}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white ring-2 ring-lattice-bg"
              style={{ backgroundColor: collab.color }}
            >
              {collab.name.charAt(0)}
            </div>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {collaborators.size + 1} collaborating
        </span>
      </div>

      <ExcalidrawWrapper {...props} />
    </div>
  );
}
