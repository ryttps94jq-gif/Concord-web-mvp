'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn, ZoomOut, RotateCcw, Search, Eye, EyeOff,
  Circle, X, Play, Pause, Settings, Download,
  Share2, GitBranch, ChevronRight, Copy, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GraphNode {
  id: string;
  label: string;
  tier: 'regular' | 'mega' | 'hyper' | 'shadow';
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  connections: number;
  tags: string[];
  createdAt: string;
  cluster?: number;
  content?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type?: 'parent' | 'sibling' | 'semantic' | 'temporal';
}

type LayoutMode = 'force' | 'radial' | 'hierarchical';
type ViewMode = 'default' | 'heatmap' | 'cluster';

const TIER_COLORS = {
  regular: { fill: '#00d4ff', glow: 'rgba(0, 212, 255, 0.5)', name: 'Regular' },
  mega: { fill: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)', name: 'MEGA' },
  hyper: { fill: '#ec4899', glow: 'rgba(236, 72, 153, 0.5)', name: 'HYPER' },
  shadow: { fill: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)', name: 'Shadow' },
};

const EDGE_COLORS = {
  parent: '#a855f7',
  sibling: '#00d4ff',
  semantic: '#22c55e',
  temporal: '#f59e0b',
};

const CLUSTER_COLORS = [
  '#00d4ff', '#a855f7', '#ec4899', '#22c55e', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
];

export default function GraphLensPage() {
  useLensNav('graph');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const nodesRef = useRef<GraphNode[]>([]);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTiers, setFilterTiers] = useState<Set<string>>(new Set(['regular', 'mega', 'hyper', 'shadow']));
  const [showLabels, setShowLabels] = useState(true);
  const [isSimulating, setIsSimulating] = useState(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [showSettings, setShowSettings] = useState(false);
  const [showPathfinder, setShowPathfinder] = useState(false);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [foundPath, setFoundPath] = useState<string[]>([]);
  const [showEdgeTypes, setShowEdgeTypes] = useState(true);
  const [clusterCount, setClusterCount] = useState(5);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  const [simParams, setSimParams] = useState({
    repulsion: 500,
    attraction: 0.01,
    damping: 0.9,
    centerGravity: 0.02,
    linkStrength: 0.3,
  });

  const { data: dtus } = useQuery({
    queryKey: ['dtus-graph'],
    queryFn: () => api.get('/api/dtus?limit=500').then((r) => r.data),
  });

  const { data: links } = useQuery({
    queryKey: ['links-graph'],
    queryFn: () => api.get('/api/links').then((r) => r.data).catch(() => ({ links: [] })),
  });

  const graphDistance = useCallback((start: string, end: string, adjacency: Map<string, Set<string>>): number => {
    if (start === end) return 0;
    const visited = new Set<string>([start]);
    const queue = [{ id: start, dist: 0 }];
    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      if (dist > 10) return Infinity;
      for (const neighbor of adjacency.get(id) || []) {
        if (neighbor === end) return dist + 1;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, dist: dist + 1 });
        }
      }
    }
    return Infinity;
  }, []);

  const assignClusters = useCallback((nodes: GraphNode[], linksList: any[], k: number) => {
    const adjacency = new Map<string, Set<string>>();
    nodes.forEach(n => adjacency.set(n.id, new Set()));
    linksList.forEach((l: any) => {
      adjacency.get(l.sourceId)?.add(l.targetId);
      adjacency.get(l.targetId)?.add(l.sourceId);
    });

    const sortedByConnections = [...nodes].sort((a, b) => b.connections - a.connections);
    const centroids = sortedByConnections.slice(0, k).map(n => n.id);

    nodes.forEach(node => {
      let minDist = Infinity;
      let cluster = 0;
      centroids.forEach((centroid, idx) => {
        const dist = graphDistance(node.id, centroid, adjacency);
        if (dist < minDist) {
          minDist = dist;
          cluster = idx;
        }
      });
      node.cluster = cluster;
    });
  }, [graphDistance]);

  const initializeGraphData = useCallback(() => {
    const dtuList = dtus?.dtus || [];
    const linkList = links?.links || [];
    const width = dimensions.width;
    const height = dimensions.height;

    const nodes: GraphNode[] = dtuList.map((dtu: any, i: number) => {
      let x, y;
      if (layoutMode === 'radial') {
        const angle = (2 * Math.PI * i) / dtuList.length;
        const radius = Math.min(width, height) * 0.35;
        x = width / 2 + Math.cos(angle) * radius;
        y = height / 2 + Math.sin(angle) * radius;
      } else if (layoutMode === 'hierarchical') {
        const tier = dtu.tier || 'regular';
        const tierOrder = { hyper: 0, mega: 1, regular: 2, shadow: 3 };
        const tierY = (tierOrder[tier as keyof typeof tierOrder] + 1) * (height / 5);
        x = (i % 10 + 1) * (width / 11);
        y = tierY + (Math.random() - 0.5) * 50;
      } else {
        x = width / 2 + (Math.random() - 0.5) * width * 0.6;
        y = height / 2 + (Math.random() - 0.5) * height * 0.6;
      }

      return {
        id: dtu.id,
        label: dtu.title || dtu.content?.slice(0, 30) || `DTU ${i}`,
        tier: dtu.tier || 'regular',
        x, y,
        vx: 0, vy: 0,
        fx: null, fy: null,
        connections: linkList.filter((l: any) => l.sourceId === dtu.id || l.targetId === dtu.id).length,
        tags: dtu.tags || [],
        createdAt: dtu.createdAt,
        content: dtu.content,
      } as GraphNode;
    });

    if (viewMode === 'cluster') {
      assignClusters(nodes, linkList, clusterCount);
    }

    nodesRef.current = nodes;
    return {
      nodes,
      edges: linkList.map((link: any) => ({
        source: link.sourceId,
        target: link.targetId,
        weight: link.weight || 0.5,
        type: link.type || 'semantic',
      })) as GraphEdge[]
    };
  }, [dtus, links, dimensions, layoutMode, viewMode, clusterCount, assignClusters]);

  const graphData = useMemo(() => initializeGraphData(), [initializeGraphData]);

  useEffect(() => {
    if (!isSimulating || layoutMode !== 'force') return;

    const simulate = () => {
      const nodes = nodesRef.current;
      const edges = graphData.edges;
      const width = dimensions.width;
      const height = dimensions.height;

      nodes.forEach((node, i) => {
        if (node.fx !== null) { node.x = node.fx; node.vx = 0; }
        if (node.fy !== null) { node.y = node.fy; node.vy = 0; }

        node.vx += (width / 2 - node.x) * simParams.centerGravity;
        node.vy += (height / 2 - node.y) * simParams.centerGravity;

        nodes.forEach((other, j) => {
          if (i === j) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = simParams.repulsion / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        });
      });

      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * simParams.attraction * simParams.linkStrength * (edge.weight + 0.5);

        source.vx += (dx / dist) * force;
        source.vy += (dy / dist) * force;
        target.vx -= (dx / dist) * force;
        target.vy -= (dy / dist) * force;
      });

      nodes.forEach(node => {
        if (node.fx === null) {
          node.vx *= simParams.damping;
          node.x += node.vx;
          node.x = Math.max(50, Math.min(width - 50, node.x));
        }
        if (node.fy === null) {
          node.vy *= simParams.damping;
          node.y += node.vy;
          node.y = Math.max(50, Math.min(height - 50, node.y));
        }
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isSimulating, layoutMode, graphData.edges, dimensions, simParams]);

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

  const findPath = useCallback((startId: string, endId: string): string[] => {
    if (!startId || !endId) return [];
    const adjacency = new Map<string, string[]>();
    graphData.edges.forEach(edge => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
      adjacency.get(edge.source)!.push(edge.target);
      adjacency.get(edge.target)!.push(edge.source);
    });

    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const node = path[path.length - 1];
      if (node === endId) return path;

      for (const neighbor of adjacency.get(node) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return [];
  }, [graphData.edges]);

  useEffect(() => {
    if (pathStart && pathEnd) {
      setFoundPath(findPath(pathStart, pathEnd));
    } else {
      setFoundPath([]);
    }
  }, [pathStart, pathEnd, findPath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const nodes = nodesRef.current;
      canvas.width = dimensions.width * 2;
      canvas.height = dimensions.height * 2;
      ctx.scale(2, 2);

      const bgGradient = ctx.createRadialGradient(
        dimensions.width / 2, dimensions.height / 2, 0,
        dimensions.width / 2, dimensions.height / 2, Math.max(dimensions.width, dimensions.height)
      );
      bgGradient.addColorStop(0, '#0f0f1a');
      bgGradient.addColorStop(1, '#0a0a0f');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      ctx.strokeStyle = 'rgba(100, 100, 150, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 50 * zoom;
      for (let x = (offset.x % gridSize); x < dimensions.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dimensions.height); ctx.stroke();
      }
      for (let y = (offset.y % gridSize); y < dimensions.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dimensions.width, y); ctx.stroke();
      }

      ctx.save();
      ctx.translate(dimensions.width / 2 + offset.x, dimensions.height / 2 + offset.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-dimensions.width / 2, -dimensions.height / 2);

      const filteredNodes = nodes.filter((n: GraphNode) =>
        filterTiers.has(n.tier) &&
        (!searchQuery || n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
      );
      const nodeIds = new Set(filteredNodes.map((n: GraphNode) => n.id));
      const pathSet = new Set(foundPath);

      graphData.edges.forEach((edge: GraphEdge) => {
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
        const source = filteredNodes.find((n: GraphNode) => n.id === edge.source);
        const target = filteredNodes.find((n: GraphNode) => n.id === edge.target);
        if (!source || !target) return;

        const isPathEdge = foundPath.length > 1 &&
          pathSet.has(edge.source) && pathSet.has(edge.target) &&
          Math.abs(foundPath.indexOf(edge.source) - foundPath.indexOf(edge.target)) === 1;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const curveOffset = Math.min(50, Math.sqrt(dx * dx + dy * dy) * 0.1);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ctrlX = midX - dy * curveOffset / dist;
        const ctrlY = midY + dx * curveOffset / dist;
        ctx.quadraticCurveTo(ctrlX, ctrlY, target.x, target.y);

        if (isPathEdge) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 10;
        } else if (showEdgeTypes && edge.type) {
          ctx.strokeStyle = EDGE_COLORS[edge.type as keyof typeof EDGE_COLORS] || 'rgba(100, 100, 150, 0.3)';
          ctx.lineWidth = 1 + edge.weight * 2;
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = `rgba(100, 100, 150, ${0.2 + edge.weight * 0.3})`;
          ctx.lineWidth = 1 + edge.weight;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      filteredNodes.forEach((node: GraphNode) => {
        const colors = TIER_COLORS[node.tier];
        let radius = node.tier === 'hyper' ? 18 : node.tier === 'mega' ? 14 : 10;
        if (viewMode === 'heatmap') radius = 8 + Math.min(node.connections * 2, 20);

        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isInPath = pathSet.has(node.id);
        const isPathEndpoint = node.id === pathStart || node.id === pathEnd;

        let fillColor = colors.fill;
        let glowColor = colors.glow;
        if (viewMode === 'cluster' && node.cluster !== undefined) {
          fillColor = CLUSTER_COLORS[node.cluster % CLUSTER_COLORS.length];
          glowColor = fillColor + '80';
        }

        if (isSelected || isHovered || isInPath) {
          const glowRadius = radius * (isPathEndpoint ? 4 : 3);
          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
          gradient.addColorStop(0, isInPath ? 'rgba(34, 197, 94, 0.6)' : glowColor);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.fillRect(node.x - glowRadius, node.y - glowRadius, glowRadius * 2, glowRadius * 2);
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();

        if (isSelected) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
        else if (isInPath) { ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 3; ctx.stroke(); }

        if (node.connections > 0 && !isInPath) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI * Math.min(node.connections / 10, 1));
          ctx.strokeStyle = fillColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        if (showLabels && (zoom > 0.5 || isSelected || isHovered)) {
          ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#9ca3af';
          ctx.font = `${Math.max(10, 12 / zoom)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(node.label.slice(0, 25) + (node.label.length > 25 ? '...' : ''), node.x, node.y + radius + 16);
        }
      });

      ctx.restore();

      const mmWidth = 180, mmHeight = 120;
      const mmX = dimensions.width - mmWidth - 10;
      const mmY = dimensions.height - mmHeight - 10;

      ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
      ctx.fillRect(mmX, mmY, mmWidth, mmHeight);
      ctx.strokeStyle = 'rgba(100, 100, 150, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(mmX, mmY, mmWidth, mmHeight);

      const scale = Math.min(mmWidth / dimensions.width, mmHeight / dimensions.height) * 0.8;
      filteredNodes.forEach((node: GraphNode) => {
        ctx.beginPath();
        const nodeColor = viewMode === 'cluster' && node.cluster !== undefined
          ? CLUSTER_COLORS[node.cluster % CLUSTER_COLORS.length]
          : TIER_COLORS[node.tier].fill;
        ctx.arc(mmX + mmWidth / 2 + (node.x - dimensions.width / 2) * scale, mmY + mmHeight / 2 + (node.y - dimensions.height / 2) * scale, 2, 0, 2 * Math.PI);
        ctx.fillStyle = nodeColor;
        ctx.fill();
      });

      const vpX = mmX + mmWidth / 2 - (offset.x * scale);
      const vpY = mmY + mmHeight / 2 - (offset.y * scale);
      const vpW = (dimensions.width / zoom) * scale;
      const vpH = (dimensions.height / zoom) * scale;
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
      ctx.strokeRect(vpX - vpW / 2, vpY - vpH / 2, vpW, vpH);

      if (isSimulating && layoutMode === 'force') requestAnimationFrame(render);
    };

    render();
  }, [graphData, dimensions, zoom, offset, filterTiers, searchQuery, showLabels, selectedNode, hoveredNode, foundPath, pathStart, pathEnd, viewMode, showEdgeTypes, isSimulating, layoutMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setContextMenu(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - dimensions.width / 2 - offset.x) / zoom + dimensions.width / 2;
    const y = (e.clientY - rect.top - dimensions.height / 2 - offset.y) / zoom + dimensions.height / 2;

    const nodes = nodesRef.current;
    const clickedNode = nodes.find((n: GraphNode) => {
      const radius = n.tier === 'hyper' ? 18 : n.tier === 'mega' ? 14 : 10;
      return Math.sqrt((x - n.x) ** 2 + (y - n.y) ** 2) < radius + 5;
    });

    if (clickedNode) {
      if (showPathfinder) {
        if (!pathStart) setPathStart(clickedNode.id);
        else if (!pathEnd && clickedNode.id !== pathStart) setPathEnd(clickedNode.id);
        else { setPathStart(clickedNode.id); setPathEnd(null); }
      } else {
        setSelectedNode(clickedNode);
        setDraggedNode(clickedNode);
        clickedNode.fx = clickedNode.x;
        clickedNode.fy = clickedNode.y;
      }
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - dimensions.width / 2 - offset.x) / zoom + dimensions.width / 2;
    const y = (e.clientY - rect.top - dimensions.height / 2 - offset.y) / zoom + dimensions.height / 2;

    if (draggedNode) {
      draggedNode.fx = x; draggedNode.fy = y;
      draggedNode.x = x; draggedNode.y = y;
      return;
    }

    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }

    const nodes = nodesRef.current;
    const hovered = nodes.find((n: GraphNode) => {
      const radius = n.tier === 'hyper' ? 18 : n.tier === 'mega' ? 14 : 10;
      return Math.sqrt((x - n.x) ** 2 + (y - n.y) ** 2) < radius + 5;
    });
    setHoveredNode(hovered || null);
  };

  const handleMouseUp = () => {
    if (draggedNode) { draggedNode.fx = null; draggedNode.fy = null; setDraggedNode(null); }
    setIsDragging(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - dimensions.width / 2 - offset.x) / zoom + dimensions.width / 2;
    const y = (e.clientY - rect.top - dimensions.height / 2 - offset.y) / zoom + dimensions.height / 2;

    const clickedNode = nodesRef.current.find((n: GraphNode) => {
      const radius = n.tier === 'hyper' ? 18 : n.tier === 'mega' ? 14 : 10;
      return Math.sqrt((x - n.x) ** 2 + (y - n.y) ** 2) < radius + 5;
    });

    if (clickedNode) setContextMenu({ x: e.clientX, y: e.clientY, node: clickedNode });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.1), 8));
  };

  const resetView = () => {
    setZoom(1); setOffset({ x: 0, y: 0 }); setSelectedNode(null);
    setPathStart(null); setPathEnd(null); setFoundPath([]);
  };

  const toggleTier = (tier: string) => {
    setFilterTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return next;
    });
  };

  const exportGraph = (format: 'png' | 'json') => {
    if (format === 'png') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `graph-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else {
      const data = { nodes: nodesRef.current.map(n => ({ id: n.id, label: n.label, tier: n.tier, tags: n.tags, x: n.x, y: n.y })), edges: graphData.edges };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = `graph-${new Date().toISOString().slice(0, 10)}.json`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
  };

  const stats = useMemo(() => {
    const nodes = nodesRef.current;
    const edges = graphData.edges;
    return {
      avgConnections: nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.connections, 0) / nodes.length : 0,
      density: nodes.length > 1 ? (edges.length / (nodes.length * (nodes.length - 1) / 2)) * 100 : 0,
      tierCounts: { regular: nodes.filter(n => n.tier === 'regular').length, mega: nodes.filter(n => n.tier === 'mega').length, hyper: nodes.filter(n => n.tier === 'hyper').length, shadow: nodes.filter(n => n.tier === 'shadow').length },
      nodeCount: nodes.length, edgeCount: edges.length
    };
  }, [graphData]);

  return (
    <div className="h-full flex bg-lattice-bg">
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ width: dimensions.width, height: dimensions.height }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} onContextMenu={handleContextMenu} />

        <div className="absolute top-4 left-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search nodes or tags..."
              className="pl-10 pr-4 py-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan w-72" />
          </div>

          <div className="flex gap-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg p-2">
            {Object.entries(TIER_COLORS).map(([tier, colors]) => (
              <button key={tier} onClick={() => toggleTier(tier)} className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors', filterTiers.has(tier) ? 'bg-lattice-bg text-white' : 'text-gray-500 hover:text-gray-300')}>
                <Circle className="w-3 h-3" fill={filterTiers.has(tier) ? colors.fill : 'transparent'} stroke={colors.fill} />{colors.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <select value={layoutMode} onChange={(e) => { setLayoutMode(e.target.value as LayoutMode); nodesRef.current = initializeGraphData().nodes; }}
              className="px-3 py-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg text-sm text-white">
              <option value="force">Force-Directed</option><option value="radial">Radial</option><option value="hierarchical">Hierarchical</option>
            </select>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="px-3 py-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg text-sm text-white">
              <option value="default">Default</option><option value="heatmap">Heatmap</option><option value="cluster">Clusters</option>
            </select>
          </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div className="bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg overflow-hidden">
            <button onClick={() => setZoom(z => Math.min(z * 1.2, 8))} className="p-2 hover:bg-lattice-bg transition-colors block w-full"><ZoomIn className="w-5 h-5 text-white mx-auto" /></button>
            <div className="px-2 py-1 text-xs text-center text-gray-400 border-y border-lattice-border">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} className="p-2 hover:bg-lattice-bg transition-colors block w-full"><ZoomOut className="w-5 h-5 text-white mx-auto" /></button>
          </div>
          <button onClick={resetView} className="p-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg hover:bg-lattice-bg" title="Reset"><RotateCcw className="w-5 h-5 text-white" /></button>
          <button onClick={() => setShowLabels(!showLabels)} className="p-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg hover:bg-lattice-bg" title="Labels">{showLabels ? <Eye className="w-5 h-5 text-neon-cyan" /> : <EyeOff className="w-5 h-5 text-gray-400" />}</button>
          <button onClick={() => setIsSimulating(!isSimulating)} className={cn("p-2 backdrop-blur border border-lattice-border rounded-lg", isSimulating ? "bg-neon-green/20 text-neon-green" : "bg-lattice-surface/90 text-gray-400")} title="Simulate">{isSimulating ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
          <button onClick={() => setShowPathfinder(!showPathfinder)} className={cn("p-2 backdrop-blur border border-lattice-border rounded-lg", showPathfinder ? "bg-neon-purple/20 text-neon-purple" : "bg-lattice-surface/90 text-gray-400")} title="Pathfinder"><GitBranch className="w-5 h-5" /></button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg hover:bg-lattice-bg" title="Settings"><Settings className="w-5 h-5 text-white" /></button>
          <div className="bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg overflow-hidden">
            <button onClick={() => exportGraph('png')} className="p-2 hover:bg-lattice-bg block w-full" title="PNG"><Download className="w-5 h-5 text-white mx-auto" /></button>
            <button onClick={() => exportGraph('json')} className="p-2 hover:bg-lattice-bg block w-full border-t border-lattice-border" title="JSON"><Share2 className="w-5 h-5 text-white mx-auto" /></button>
          </div>
        </div>

        <AnimatePresence>
          {showPathfinder && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-20 left-1/2 -translate-x-1/2 bg-lattice-surface/95 backdrop-blur border border-lattice-border rounded-lg p-4 w-80">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><GitBranch className="w-4 h-4 text-neon-purple" />Path Finder</h3>
              <p className="text-xs text-gray-400 mb-3">Click two nodes to find shortest path</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-neon-green" /><span className="text-sm text-gray-300">{pathStart ? nodesRef.current.find(n => n.id === pathStart)?.label || 'Start' : 'Click start node'}</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-neon-pink" /><span className="text-sm text-gray-300">{pathEnd ? nodesRef.current.find(n => n.id === pathEnd)?.label || 'End' : 'Click end node'}</span></div>
                {foundPath.length > 0 && <div className="mt-2 p-2 bg-lattice-bg rounded text-xs text-neon-green">Path found: {foundPath.length} nodes</div>}
                {pathStart && pathEnd && foundPath.length === 0 && <div className="mt-2 p-2 bg-lattice-bg rounded text-xs text-red-400">No path found</div>}
              </div>
              <button onClick={() => { setPathStart(null); setPathEnd(null); }} className="mt-3 w-full py-1.5 text-sm bg-lattice-bg text-gray-300 rounded hover:bg-lattice-elevated">Clear Path</button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute top-4 right-20 bg-lattice-surface/95 backdrop-blur border border-lattice-border rounded-lg p-4 w-64">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Settings className="w-4 h-4 text-gray-400" />Simulation Settings</h3>
              <div className="space-y-4">
                <div><label className="text-xs text-gray-400 block mb-1">Repulsion: {simParams.repulsion}</label><input type="range" min="100" max="1000" value={simParams.repulsion} onChange={e => setSimParams(p => ({ ...p, repulsion: +e.target.value }))} className="w-full" /></div>
                <div><label className="text-xs text-gray-400 block mb-1">Attraction: {simParams.attraction.toFixed(3)}</label><input type="range" min="0.001" max="0.05" step="0.001" value={simParams.attraction} onChange={e => setSimParams(p => ({ ...p, attraction: +e.target.value }))} className="w-full" /></div>
                <div><label className="text-xs text-gray-400 block mb-1">Damping: {simParams.damping.toFixed(2)}</label><input type="range" min="0.5" max="0.99" step="0.01" value={simParams.damping} onChange={e => setSimParams(p => ({ ...p, damping: +e.target.value }))} className="w-full" /></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={showEdgeTypes} onChange={e => setShowEdgeTypes(e.target.checked)} className="rounded" /><label className="text-xs text-gray-400">Show edge types</label></div>
                {viewMode === 'cluster' && <div><label className="text-xs text-gray-400 block mb-1">Clusters: {clusterCount}</label><input type="range" min="2" max="15" value={clusterCount} onChange={e => setClusterCount(+e.target.value)} className="w-full" /></div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-4 left-4 bg-lattice-surface/90 backdrop-blur border border-lattice-border rounded-lg p-4">
          <div className="grid grid-cols-4 gap-6 text-sm">
            <div><p className="text-gray-400">Nodes</p><p className="text-2xl font-bold text-white">{stats.nodeCount}</p></div>
            <div><p className="text-gray-400">Edges</p><p className="text-2xl font-bold text-white">{stats.edgeCount}</p></div>
            <div><p className="text-gray-400">Density</p><p className="text-2xl font-bold text-neon-cyan">{stats.density.toFixed(1)}%</p></div>
            <div><p className="text-gray-400">Avg Links</p><p className="text-2xl font-bold text-neon-purple">{stats.avgConnections.toFixed(1)}</p></div>
          </div>
          <div className="flex gap-4 mt-3 pt-3 border-t border-lattice-border">
            {Object.entries(stats.tierCounts).map(([tier, count]) => (<div key={tier} className="flex items-center gap-1"><Circle className="w-2 h-2" fill={TIER_COLORS[tier as keyof typeof TIER_COLORS].fill} stroke="none" /><span className="text-xs text-gray-400">{count}</span></div>))}
          </div>
        </div>

        <AnimatePresence>
          {contextMenu && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed bg-lattice-surface border border-lattice-border rounded-lg shadow-xl overflow-hidden z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
              <button onClick={() => { setSelectedNode(contextMenu.node); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-lattice-elevated flex items-center gap-2"><Eye className="w-4 h-4" /> View Details</button>
              <button onClick={() => { setPathStart(contextMenu.node.id); setShowPathfinder(true); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-lattice-elevated flex items-center gap-2"><GitBranch className="w-4 h-4" /> Set as Path Start</button>
              <button onClick={() => { navigator.clipboard.writeText(contextMenu.node.id); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-lattice-elevated flex items-center gap-2"><Copy className="w-4 h-4" /> Copy ID</button>
              <button onClick={() => { window.open(`/dtu/${contextMenu.node.id}`, '_blank'); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-sm hover:bg-lattice-elevated flex items-center gap-2 border-t border-lattice-border"><ExternalLink className="w-4 h-4" /> Open DTU</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedNode && (
          <motion.aside initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }} className="w-80 border-l border-lattice-border bg-lattice-surface p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Node Details</h2>
              <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-lattice-bg rounded"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-lattice-bg rounded-lg">
                <div className="flex items-center gap-3 mb-3"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: TIER_COLORS[selectedNode.tier].fill }} /><span className="text-xs text-gray-400 uppercase font-medium">{selectedNode.tier}</span></div>
                <h3 className="font-semibold text-white text-lg">{selectedNode.label}</h3>
                {selectedNode.content && <p className="text-sm text-gray-400 mt-2 line-clamp-4">{selectedNode.content}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-lattice-bg rounded-lg"><p className="text-xs text-gray-400">Connections</p><p className="text-xl font-bold text-neon-cyan">{selectedNode.connections}</p></div>
                <div className="p-3 bg-lattice-bg rounded-lg"><p className="text-xs text-gray-400">Created</p><p className="text-sm text-white">{new Date(selectedNode.createdAt).toLocaleDateString()}</p></div>
              </div>
              {viewMode === 'cluster' && selectedNode.cluster !== undefined && (
                <div className="p-3 bg-lattice-bg rounded-lg"><p className="text-xs text-gray-400">Cluster</p><div className="flex items-center gap-2 mt-1"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[selectedNode.cluster % CLUSTER_COLORS.length] }} /><span className="font-medium">Group {selectedNode.cluster + 1}</span></div></div>
              )}
              {selectedNode.tags.length > 0 && (
                <div><p className="text-xs text-gray-400 mb-2">Tags</p><div className="flex flex-wrap gap-2">{selectedNode.tags.map(tag => (<button key={tag} onClick={() => setSearchQuery(tag)} className="px-2 py-1 text-xs bg-lattice-bg rounded text-gray-300 hover:text-neon-cyan">#{tag}</button>))}</div></div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-2">Connected To</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).slice(0, 10).map(e => {
                    const otherId = e.source === selectedNode.id ? e.target : e.source;
                    const other = nodesRef.current.find(n => n.id === otherId);
                    if (!other) return null;
                    return (<button key={otherId} onClick={() => setSelectedNode(other)} className="w-full flex items-center gap-2 p-2 bg-lattice-bg rounded text-left hover:bg-lattice-elevated"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[other.tier].fill }} /><span className="text-sm text-gray-300 truncate flex-1">{other.label}</span><ChevronRight className="w-4 h-4 text-gray-500" /></button>);
                  })}
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-lattice-border">
                <button className="w-full py-2 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90">Open DTU</button>
                <button onClick={() => { setPathStart(selectedNode.id); setShowPathfinder(true); }} className="w-full py-2 bg-lattice-bg text-gray-300 rounded-lg hover:bg-lattice-elevated">Find Paths From Here</button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
