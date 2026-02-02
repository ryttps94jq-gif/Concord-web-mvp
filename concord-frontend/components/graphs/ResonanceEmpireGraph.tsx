'use client';

import { useEffect, useRef, useState } from 'react';

interface Node {
  id: string;
  label?: string;
  tier?: 'regular' | 'mega' | 'hyper' | 'shadow';
  resonance?: number;
  x?: number;
  y?: number;
}

interface Edge {
  source: string;
  target: string;
  weight?: number;
}

interface ResonanceEmpireGraphProps {
  nodes?: Node[];
  edges?: Edge[];
  onNodeClick?: (node: Node) => void;
  height?: number;
  showLabels?: boolean;
  fullHeight?: boolean;
}

const tierColors = {
  regular: '#00d4ff',
  mega: '#a855f7',
  hyper: '#ec4899',
  shadow: '#6b7280',
};

export function ResonanceEmpireGraph({
  nodes = [],
  edges = [],
  onNodeClick,
  height = 400,
  showLabels = false,
  fullHeight = false,
}: ResonanceEmpireGraphProps) {
  const effectiveHeight = fullHeight ? 600 : height;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: effectiveHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [effectiveHeight]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width * 2;
    canvas.height = dimensions.height * 2;
    ctx.scale(2, 2);

    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Position nodes if not already positioned
    const positionedNodes = nodes.map((node, i) => {
      if (node.x !== undefined && node.y !== undefined) return node;

      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
      return {
        ...node,
        x: dimensions.width / 2 + Math.cos(angle) * radius,
        y: dimensions.height / 2 + Math.sin(angle) * radius,
      };
    });

    // Draw edges
    ctx.strokeStyle = 'rgba(42, 42, 58, 0.6)';
    ctx.lineWidth = 1;
    edges.forEach((edge) => {
      const source = positionedNodes.find((n) => n.id === edge.source);
      const target = positionedNodes.find((n) => n.id === edge.target);
      if (source && target && source.x && source.y && target.x && target.y) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    positionedNodes.forEach((node) => {
      if (!node.x || !node.y) return;

      const color = tierColors[node.tier || 'regular'];
      const radius = node.tier === 'mega' ? 12 : node.tier === 'hyper' ? 14 : 8;

      // Glow effect
      const gradient = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        radius * 2
      );
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(node.x - radius * 2, node.y - radius * 2, radius * 4, radius * 4);

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Resonance ring
      if (node.resonance) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI * node.resonance);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      if (showLabels && node.label) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + radius + 14);
      }
    });

    // Hover tooltip
    if (hoveredNode && hoveredNode.x && hoveredNode.y) {
      ctx.fillStyle = '#1a1a24';
      ctx.strokeStyle = '#2a2a3a';
      ctx.lineWidth = 1;

      const tooltipWidth = 120;
      const tooltipHeight = 40;
      const tooltipX = hoveredNode.x - tooltipWidth / 2;
      const tooltipY = hoveredNode.y - 50;

      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hoveredNode.id.slice(0, 12) + '...', hoveredNode.x, tooltipY + 16);
      ctx.fillStyle = tierColors[hoveredNode.tier || 'regular'];
      ctx.fillText(hoveredNode.tier || 'regular', hoveredNode.x, tooltipY + 30);
    }
  }, [nodes, edges, dimensions, showLabels, hoveredNode]);

  // Mouse interactions
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const positionedNodes = nodes.map((node, i) => {
      if (node.x !== undefined && node.y !== undefined) return node;
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.min(dimensions.width, dimensions.height) * 0.35;
      return {
        ...node,
        x: dimensions.width / 2 + Math.cos(angle) * radius,
        y: dimensions.height / 2 + Math.sin(angle) * radius,
      };
    });

    const hovered = positionedNodes.find((node) => {
      if (!node.x || !node.y) return false;
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });

    setHoveredNode(hovered || null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode && onNodeClick) {
      onNodeClick(hoveredNode);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ width: dimensions.width, height: dimensions.height }}
        className="rounded-lg cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={handleClick}
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(tierColors).map(([tier, color]) => (
            <div key={tier} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-400 capitalize">{tier}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
