'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenTool, Plus, Link2, Maximize2, Square, Circle, Type, ArrowRight,
  MousePointer, Pencil, Trash2, Download, Undo2, Redo2, ZoomIn, ZoomOut,
  RotateCcw, Palette, Layers, X, Save, Settings, Grid3X3, Move
} from 'lucide-react';

type Tool = 'select' | 'draw' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'dtu';
type Element = {
  id: string;
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'freehand' | 'dtu';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  text?: string;
  dtuId?: string;
  dtuTitle?: string;
  stroke: string;
  fill: string;
  strokeWidth: number;
  rotation?: number;
};

const COLORS = ['#00d4ff', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#ef4444', '#ffffff', '#6b7280'];
const STROKE_WIDTHS = [1, 2, 4, 6, 8];

export default function WhiteboardLensPage() {
  useLensNav('whiteboard');
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedWbId, setSelectedWbId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<Element | null>(null);
  const [undoStack, setUndoStack] = useState<Element[][]>([]);
  const [redoStack, setRedoStack] = useState<Element[][]>([]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [strokeColor, setStrokeColor] = useState('#00d4ff');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [showGrid, setShowGrid] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDtuPicker, setShowDtuPicker] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);

  const { data: whiteboards, isLoading } = useQuery({
    queryKey: ['whiteboards'],
    queryFn: () => api.get('/api/whiteboards').then(r => r.data),
  });

  const { data: selectedWb } = useQuery({
    queryKey: ['whiteboard', selectedWbId],
    queryFn: () => api.get(`/api/whiteboard/${selectedWbId}`).then(r => r.data),
    enabled: !!selectedWbId,
  });

  const { data: dtus } = useQuery({
    queryKey: ['dtus-whiteboard'],
    queryFn: () => api.get('/api/dtus?limit=100').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; linkedDtus: string[] }) => api.post('/api/whiteboard', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whiteboards'] });
      setSelectedWbId(res.data.dtuId);
      setShowCreate(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { elements: Element[] }) => api.put(`/api/whiteboard/${selectedWbId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whiteboard', selectedWbId] }),
  });

  // Load elements when whiteboard changes
  useEffect(() => {
    if (selectedWb?.whiteboard?.elements) {
      setElements(selectedWb.whiteboard.elements);
    } else {
      setElements([]);
    }
  }, [selectedWb]);

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-50), [...elements]]);
    setRedoStack([]);
  }, [elements]);

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, [...elements]]);
    setUndoStack(u => u.slice(0, -1));
    setElements(prev);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, [...elements]]);
    setRedoStack(r => r.slice(0, -1));
    setElements(next);
  };

  const getCanvasCoords = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - offset.x) / zoom,
      y: (e.clientY - rect.top - offset.y) / zoom
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    if (tool === 'select') {
      const clicked = [...elements].reverse().find(el => {
        if (el.type === 'freehand' && el.points) {
          return el.points.some(p => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10);
        }
        const w = el.width || 100;
        const h = el.height || 50;
        return x >= el.x && x <= el.x + w && y >= el.y && y <= el.y + h;
      });
      setSelectedElement(clicked || null);
      if (clicked) {
        setIsDrawing(true);
        setCurrentElement({ ...clicked, x: x - clicked.x, y: y - clicked.y } as any);
      }
      return;
    }

    if (tool === 'text') {
      setTextPosition({ x, y });
      return;
    }

    if (tool === 'dtu') {
      setShowDtuPicker(true);
      setTextPosition({ x, y });
      return;
    }

    pushUndo();
    setIsDrawing(true);
    const newElement: Element = {
      id: `el_${Date.now()}`,
      type: tool === 'draw' ? 'freehand' : tool as any,
      x, y,
      width: 0, height: 0,
      points: tool === 'draw' ? [{ x, y }] : undefined,
      stroke: strokeColor,
      fill: fillColor,
      strokeWidth,
    };
    setCurrentElement(newElement);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (!isDrawing || !currentElement) return;
    const { x, y } = getCanvasCoords(e);

    if (tool === 'select' && selectedElement) {
      setElements(prev => prev.map(el =>
        el.id === selectedElement.id
          ? { ...el, x: x - (currentElement as any).x, y: y - (currentElement as any).y }
          : el
      ));
      return;
    }

    if (currentElement.type === 'freehand' && currentElement.points) {
      setCurrentElement({ ...currentElement, points: [...currentElement.points, { x, y }] });
    } else {
      setCurrentElement({
        ...currentElement,
        width: x - currentElement.x,
        height: y - currentElement.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'select') {
      pushUndo();
      return;
    }

    if (currentElement && (
      (currentElement.width && Math.abs(currentElement.width) > 5) ||
      (currentElement.height && Math.abs(currentElement.height) > 5) ||
      (currentElement.points && currentElement.points.length > 2)
    )) {
      // Normalize negative dimensions
      let normalized = { ...currentElement };
      if (normalized.width && normalized.width < 0) {
        normalized.x += normalized.width;
        normalized.width = Math.abs(normalized.width);
      }
      if (normalized.height && normalized.height < 0) {
        normalized.y += normalized.height;
        normalized.height = Math.abs(normalized.height);
      }
      setElements(prev => [...prev, normalized]);
    }
    setCurrentElement(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.25), 4));
  };

  const addText = () => {
    if (!textPosition || !textInput.trim()) return;
    pushUndo();
    setElements(prev => [...prev, {
      id: `el_${Date.now()}`,
      type: 'text',
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      stroke: strokeColor,
      fill: strokeColor,
      strokeWidth: 1,
      width: textInput.length * 12,
      height: 24,
    }]);
    setTextInput('');
    setTextPosition(null);
  };

  const addDtu = (dtu: any) => {
    if (!textPosition) return;
    pushUndo();
    setElements(prev => [...prev, {
      id: `el_${Date.now()}`,
      type: 'dtu',
      x: textPosition.x,
      y: textPosition.y,
      dtuId: dtu.id,
      dtuTitle: dtu.title || dtu.content?.slice(0, 30),
      stroke: '#a855f7',
      fill: 'rgba(168, 85, 247, 0.1)',
      strokeWidth: 2,
      width: 200,
      height: 80,
    }]);
    setShowDtuPicker(false);
    setTextPosition(null);
  };

  const deleteSelected = () => {
    if (!selectedElement) return;
    pushUndo();
    setElements(prev => prev.filter(el => el.id !== selectedElement.id));
    setSelectedElement(null);
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width * 2;
    canvas.height = dimensions.height * 2;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(100, 100, 150, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 20 * zoom;
      for (let x = (offset.x % gridSize); x < dimensions.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dimensions.height); ctx.stroke();
      }
      for (let y = (offset.y % gridSize); y < dimensions.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dimensions.width, y); ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    const drawElement = (el: Element, isPreview = false) => {
      ctx.strokeStyle = el.stroke;
      ctx.fillStyle = el.fill || 'transparent';
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const isSelected = selectedElement?.id === el.id;
      if (isSelected && !isPreview) {
        ctx.shadowColor = el.stroke;
        ctx.shadowBlur = 10;
      }

      switch (el.type) {
        case 'rectangle':
          if (el.fill && el.fill !== 'transparent') {
            ctx.fillRect(el.x, el.y, el.width || 0, el.height || 0);
          }
          ctx.strokeRect(el.x, el.y, el.width || 0, el.height || 0);
          break;

        case 'ellipse':
          ctx.beginPath();
          ctx.ellipse(
            el.x + (el.width || 0) / 2,
            el.y + (el.height || 0) / 2,
            Math.abs((el.width || 0) / 2),
            Math.abs((el.height || 0) / 2),
            0, 0, 2 * Math.PI
          );
          if (el.fill && el.fill !== 'transparent') ctx.fill();
          ctx.stroke();
          break;

        case 'line':
        case 'arrow':
          ctx.beginPath();
          ctx.moveTo(el.x, el.y);
          ctx.lineTo(el.x + (el.width || 0), el.y + (el.height || 0));
          ctx.stroke();
          if (el.type === 'arrow') {
            const angle = Math.atan2(el.height || 0, el.width || 0);
            const endX = el.x + (el.width || 0);
            const endY = el.y + (el.height || 0);
            const arrowSize = 12;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
          break;

        case 'freehand':
          if (el.points && el.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case 'text':
          ctx.font = '16px Inter, sans-serif';
          ctx.fillStyle = el.stroke;
          ctx.fillText(el.text || '', el.x, el.y + 16);
          break;

        case 'dtu':
          const gradient = ctx.createLinearGradient(el.x, el.y, el.x + (el.width || 200), el.y + (el.height || 80));
          gradient.addColorStop(0, 'rgba(168, 85, 247, 0.15)');
          gradient.addColorStop(1, 'rgba(0, 212, 255, 0.15)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width || 200, el.height || 80, 8);
          ctx.fill();
          ctx.strokeStyle = '#a855f7';
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px Inter, sans-serif';
          ctx.fillText(el.dtuTitle || 'DTU', el.x + 12, el.y + 28);
          ctx.fillStyle = '#9ca3af';
          ctx.font = '12px Inter, sans-serif';
          ctx.fillText(`ID: ${el.dtuId?.slice(0, 12)}...`, el.x + 12, el.y + 50);
          ctx.fillStyle = '#a855f7';
          ctx.fillText('Click to view', el.x + 12, el.y + 68);
          break;
      }

      ctx.shadowBlur = 0;

      // Selection box
      if (isSelected && !isPreview) {
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const padding = 8;
        ctx.strokeRect(
          el.x - padding,
          el.y - padding,
          (el.width || 100) + padding * 2,
          (el.height || 50) + padding * 2
        );
        ctx.setLineDash([]);
      }
    };

    // Draw elements
    elements.forEach(el => drawElement(el));

    // Draw current element preview
    if (currentElement && tool !== 'select') {
      ctx.globalAlpha = 0.7;
      drawElement(currentElement, true);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [elements, currentElement, selectedElement, dimensions, zoom, offset, showGrid, tool]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); redo(); }
      if (e.key === 'v') setTool('select');
      if (e.key === 'p') setTool('draw');
      if (e.key === 'r') setTool('rectangle');
      if (e.key === 'o') setTool('ellipse');
      if (e.key === 'l') setTool('line');
      if (e.key === 'a') setTool('arrow');
      if (e.key === 't') setTool('text');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement]);

  const tools: { id: Tool; icon: any; label: string; key: string }[] = [
    { id: 'select', icon: MousePointer, label: 'Select', key: 'V' },
    { id: 'draw', icon: Pencil, label: 'Draw', key: 'P' },
    { id: 'rectangle', icon: Square, label: 'Rectangle', key: 'R' },
    { id: 'ellipse', icon: Circle, label: 'Ellipse', key: 'O' },
    { id: 'line', icon: Move, label: 'Line', key: 'L' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow', key: 'A' },
    { id: 'text', icon: Type, label: 'Text', key: 'T' },
    { id: 'dtu', icon: Link2, label: 'Link DTU', key: 'D' },
  ];

  return (
    <div className="h-screen flex bg-lattice-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r border-lattice-border bg-lattice-surface p-4 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <PenTool className="w-6 h-6 text-neon-pink" />
          <h1 className="text-lg font-bold">Whiteboard</h1>
        </div>

        <button onClick={() => setShowCreate(true)} className="w-full py-2 bg-neon-pink text-black font-medium rounded-lg hover:bg-neon-pink/90 mb-4 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />New Board
        </button>

        <div className="flex-1 overflow-y-auto space-y-2">
          <p className="text-xs text-gray-400 mb-2">Whiteboards ({whiteboards?.count || 0})</p>
          {isLoading ? (
            <div className="text-gray-500 text-sm">Loading...</div>
          ) : (
            whiteboards?.whiteboards?.map((wb: any) => (
              <button key={wb.id} onClick={() => setSelectedWbId(wb.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedWbId === wb.id ? 'border-neon-pink bg-lattice-elevated' : 'border-lattice-border hover:border-neon-pink/50'}`}>
                <p className="font-medium truncate">{wb.title}</p>
                <p className="text-xs text-gray-400 mt-1">{wb.elementCount || 0} elements</p>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {selectedWbId ? (
          <>
            {/* Toolbar */}
            <div className="border-b border-lattice-border bg-lattice-surface/50 backdrop-blur p-2 flex items-center gap-2">
              <div className="flex items-center gap-1 bg-lattice-bg rounded-lg p-1">
                {tools.map(t => (
                  <button key={t.id} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}
                    className={`p-2 rounded-md transition-colors ${tool === t.id ? 'bg-neon-pink/20 text-neon-pink' : 'text-gray-400 hover:text-white'}`}>
                    <t.icon className="w-5 h-5" />
                  </button>
                ))}
              </div>

              <div className="w-px h-8 bg-lattice-border mx-2" />

              <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-2 rounded-lg border border-lattice-border hover:bg-lattice-elevated relative">
                <Palette className="w-5 h-5" style={{ color: strokeColor }} />
              </button>

              <div className="flex items-center gap-1 bg-lattice-bg rounded-lg p-1">
                {STROKE_WIDTHS.map(w => (
                  <button key={w} onClick={() => setStrokeWidth(w)}
                    className={`w-8 h-8 rounded flex items-center justify-center ${strokeWidth === w ? 'bg-lattice-elevated' : 'hover:bg-lattice-elevated'}`}>
                    <div className="rounded-full bg-current" style={{ width: w * 2, height: w * 2 }} />
                  </button>
                ))}
              </div>

              <div className="w-px h-8 bg-lattice-border mx-2" />

              <button onClick={undo} disabled={undoStack.length === 0} className="p-2 rounded-lg hover:bg-lattice-elevated disabled:opacity-30" title="Undo (Ctrl+Z)">
                <Undo2 className="w-5 h-5" />
              </button>
              <button onClick={redo} disabled={redoStack.length === 0} className="p-2 rounded-lg hover:bg-lattice-elevated disabled:opacity-30" title="Redo (Ctrl+Y)">
                <Redo2 className="w-5 h-5" />
              </button>
              <button onClick={deleteSelected} disabled={!selectedElement} className="p-2 rounded-lg hover:bg-lattice-elevated disabled:opacity-30 text-red-400" title="Delete">
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="w-px h-8 bg-lattice-border mx-2" />

              <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-lg ${showGrid ? 'bg-lattice-elevated text-neon-cyan' : 'hover:bg-lattice-elevated text-gray-400'}`}>
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button onClick={() => setZoom(z => Math.min(z * 1.2, 4))} className="p-2 rounded-lg hover:bg-lattice-elevated"><ZoomIn className="w-5 h-5" /></button>
              <span className="text-sm text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.25))} className="p-2 rounded-lg hover:bg-lattice-elevated"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="p-2 rounded-lg hover:bg-lattice-elevated"><RotateCcw className="w-5 h-5" /></button>

              <div className="flex-1" />

              <button onClick={() => saveMutation.mutate({ elements })} disabled={saveMutation.isPending} className="px-4 py-2 bg-lattice-elevated rounded-lg hover:bg-lattice-bg flex items-center gap-2 text-sm">
                <Save className="w-4 h-4" />{saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button onClick={exportCanvas} className="px-4 py-2 bg-lattice-elevated rounded-lg hover:bg-lattice-bg flex items-center gap-2 text-sm">
                <Download className="w-4 h-4" />Export
              </button>
            </div>

            {/* Canvas */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" style={{ width: dimensions.width, height: dimensions.height }}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} />

              {/* Color Picker */}
              <AnimatePresence>
                {showColorPicker && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="absolute top-16 left-48 bg-lattice-surface border border-lattice-border rounded-lg p-4 shadow-xl z-10">
                    <p className="text-xs text-gray-400 mb-2">Stroke</p>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => setStrokeColor(c)}
                          className={`w-8 h-8 rounded-lg border-2 ${strokeColor === c ? 'border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Fill</p>
                    <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => setFillColor('transparent')}
                        className={`w-8 h-8 rounded-lg border-2 ${fillColor === 'transparent' ? 'border-white' : 'border-transparent'} bg-transparent`}>
                        <X className="w-4 h-4 mx-auto text-gray-500" />
                      </button>
                      {COLORS.slice(0, 7).map(c => (
                        <button key={c} onClick={() => setFillColor(c + '40')}
                          className={`w-8 h-8 rounded-lg border-2 ${fillColor === c + '40' ? 'border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: c + '40' }} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Text Input */}
              <AnimatePresence>
                {textPosition && tool === 'text' && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute bg-lattice-surface border border-lattice-border rounded-lg p-3 shadow-xl"
                    style={{ left: textPosition.x * zoom + offset.x, top: textPosition.y * zoom + offset.y }}>
                    <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)} autoFocus placeholder="Enter text..."
                      onKeyDown={e => e.key === 'Enter' && addText()} className="px-3 py-2 bg-lattice-bg border border-lattice-border rounded text-sm w-48" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={addText} className="flex-1 py-1 bg-neon-cyan text-black rounded text-sm">Add</button>
                      <button onClick={() => setTextPosition(null)} className="flex-1 py-1 bg-lattice-bg rounded text-sm">Cancel</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* DTU Picker */}
              <AnimatePresence>
                {showDtuPicker && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                      className="bg-lattice-surface border border-lattice-border rounded-lg p-4 w-96 max-h-96 overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Link DTU</h3>
                        <button onClick={() => setShowDtuPicker(false)}><X className="w-5 h-5" /></button>
                      </div>
                      <div className="space-y-2">
                        {dtus?.dtus?.slice(0, 20).map((dtu: any) => (
                          <button key={dtu.id} onClick={() => addDtu(dtu)}
                            className="w-full text-left p-3 rounded-lg border border-lattice-border hover:border-neon-purple transition-colors">
                            <p className="font-medium truncate">{dtu.title || dtu.content?.slice(0, 40)}</p>
                            <p className="text-xs text-gray-400 mt-1">{dtu.tier} · {dtu.tags?.slice(0, 3).join(', ')}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <PenTool className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Select or create a whiteboard to start</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-lattice-bg border border-lattice-border rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">Create Whiteboard</h2>
              <CreateForm onClose={() => setShowCreate(false)} onCreate={(data) => createMutation.mutate(data)} creating={createMutation.isPending} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateForm({ onClose, onCreate, creating }: { onClose: () => void; onCreate: (data: { title: string; linkedDtus: string[] }) => void; creating: boolean }) {
  const [title, setTitle] = useState('');
  return (
    <>
      <input type="text" placeholder="Whiteboard Title" value={title} onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded mb-4" />
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-lattice-surface rounded-lg">Cancel</button>
        <button onClick={() => onCreate({ title, linkedDtus: [] })} disabled={creating || !title}
          className="px-4 py-2 bg-neon-pink text-black rounded-lg disabled:opacity-50">{creating ? 'Creating...' : 'Create'}</button>
      </div>
    </>
  );
}
