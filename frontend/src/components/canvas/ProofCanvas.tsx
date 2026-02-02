/**
 * @deprecated This component is legacy and no longer actively used.
 * Use ProofCanvasV2 instead. This file will be removed in a future version.
 * The main canvas page (/problems/[id]/canvas) already uses ProofCanvasV2.
 */
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Plus,
  GitBranch,
  Share2,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Circle,
  ChevronRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Hand,
  MousePointer,
} from "lucide-react";

// Types
export interface CanvasNode {
  id: string;
  type: "axiom" | "lemma" | "theorem" | "claim" | "proof-step" | "note";
  title: string;
  content?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  status: "draft" | "pending" | "verified" | "error";
  dependencies?: string[]; // IDs of nodes this depends on
  author?: string;
}

export interface CanvasEdge {
  from: string;
  to: string;
  type: "implies" | "uses" | "contradicts" | "references";
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

const NODE_COLORS: Record<CanvasNode["type"], { bg: string; border: string; text: string }> = {
  axiom: { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-700" },
  lemma: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  theorem: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  claim: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
  "proof-step": { bg: "bg-neutral-50", border: "border-neutral-300", text: "text-neutral-700" },
  note: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600" },
};

const STATUS_ICONS: Record<CanvasNode["status"], { icon: typeof CheckCircle2; color: string }> = {
  draft: { icon: Circle, color: "text-neutral-400" },
  pending: { icon: AlertCircle, color: "text-amber-500" },
  verified: { icon: CheckCircle2, color: "text-emerald-500" },
  error: { icon: AlertCircle, color: "text-red-500" },
};

// Helper to calculate bezier curve for edges
function getEdgePath(from: CanvasNode, to: CanvasNode): string {
  const fromX = from.x + (from.width || 200) / 2;
  const fromY = from.y + (from.height || 80);
  const toX = to.x + (to.width || 200) / 2;
  const toY = to.y;

  const midY = (fromY + toY) / 2;
  const controlOffset = Math.abs(toY - fromY) * 0.3;

  return `M ${fromX} ${fromY} C ${fromX} ${fromY + controlOffset}, ${toX} ${toY - controlOffset}, ${toX} ${toY}`;
}

interface ProofCanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  collaborators?: Collaborator[];
  onNodeSelect?: (node: CanvasNode) => void;
  onNodeCreate?: (type: CanvasNode["type"], x: number, y: number) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onEdgeCreate?: (from: string, to: string) => void;
  readOnly?: boolean;
}

export function ProofCanvas({
  nodes,
  edges,
  collaborators = [],
  onNodeSelect,
  onNodeCreate,
  onNodeMove,
  onEdgeCreate,
  readOnly = false,
}: ProofCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"select" | "pan" | "connect">("select");

  // Get node by ID
  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNode>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Handle zooming
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.25, Math.min(2, z * delta)));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Handle panning
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (tool === "pan" || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [tool, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }
      if (draggingNodeId && onNodeMove) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
        const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
        onNodeMove(draggingNodeId, Math.round(x), Math.round(y));
      }
    },
    [isPanning, panStart, draggingNodeId, onNodeMove, pan, zoom, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNodeId(null);
  }, []);

  // Handle node interactions
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      e.stopPropagation();
      if (readOnly) return;

      if (tool === "select") {
        setSelectedNodeId(node.id);
        setDraggingNodeId(node.id);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = (e.clientX - rect.left - pan.x) / zoom;
          const mouseY = (e.clientY - rect.top - pan.y) / zoom;
          setDragOffset({ x: mouseX - node.x, y: mouseY - node.y });
        }
        onNodeSelect?.(node);
      }
    },
    [tool, readOnly, pan, zoom, onNodeSelect]
  );

  // Handle canvas click for creating nodes
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (tool !== "select" || readOnly) return;
      
      // Deselect if clicking on empty space
      if (e.target === canvasRef.current || (e.target as HTMLElement).closest(".canvas-bg")) {
        setSelectedNodeId(null);
      }
    },
    [tool, readOnly]
  );

  // Toolbar actions
  const handleZoomIn = () => setZoom((z) => Math.min(2, z * 1.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, z / 1.2));
  const handleFit = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral-50">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-neutral-200 p-1">
        <button
          onClick={() => setTool("select")}
          className={`p-2 rounded-md transition-colors ${
            tool === "select"
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
          title="Select"
        >
          <MousePointer className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool("pan")}
          className={`p-2 rounded-md transition-colors ${
            tool === "pan"
              ? "bg-neutral-900 text-white"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
          title="Pan"
        >
          <Hand className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-neutral-200 mx-1" />
        {!readOnly && (
          <>
            <button
              onClick={() => onNodeCreate?.("lemma", 400, 300)}
              className="p-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
              title="Add Node"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool("connect")}
              className={`p-2 rounded-md transition-colors ${
                tool === "connect"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              title="Connect Nodes"
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-neutral-200 mx-1" />
          </>
        )}
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-neutral-500 font-mono px-1 min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleFit}
          className="p-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
          title="Fit to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className={`w-full h-full ${tool === "pan" ? "cursor-grab" : "cursor-default"} ${
          isPanning ? "cursor-grabbing" : ""
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {/* Grid Background */}
        <div
          className="canvas-bg absolute inset-0 bg-grid-dots pointer-events-none"
          style={{
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Transform Container */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {/* SVG for Edges */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) return null;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  d={getEdgePath(fromNode, toNode)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  className="transition-all"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const colors = NODE_COLORS[node.type];
            const status = STATUS_ICONS[node.status];
            const StatusIcon = status.icon;
            const isSelected = selectedNodeId === node.id;

            return (
              <div
                key={node.id}
                className={`absolute rounded-lg border-2 shadow-sm transition-shadow cursor-pointer ${
                  colors.bg
                } ${colors.border} ${
                  isSelected ? "ring-2 ring-indigo-500 ring-offset-2 shadow-lg" : ""
                }`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width || 200,
                  minHeight: node.height || 80,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
              >
                {/* Node Header */}
                <div className={`px-3 py-2 border-b ${colors.border} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase ${colors.text}`}>
                      {node.type}
                    </span>
                  </div>
                  <StatusIcon className={`w-4 h-4 ${status.color}`} />
                </div>

                {/* Node Content */}
                <div className="p-3">
                  <h4 className="text-sm font-medium text-neutral-900 mb-1">{node.title}</h4>
                  {node.content && (
                    <p className="text-xs text-neutral-600 line-clamp-2">{node.content}</p>
                  )}
                </div>

                {/* Node Footer */}
                <div className="px-3 py-2 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400">
                    {node.author || "Anonymous"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button className="p-1 text-neutral-400 hover:text-neutral-600 rounded">
                      <MessageSquare className="w-3 h-3" />
                    </button>
                    <button className="p-1 text-neutral-400 hover:text-neutral-600 rounded">
                      <Share2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Collaborator Cursors */}
          {collaborators.map((collab) => (
            <div
              key={collab.id}
              className="absolute pointer-events-none transition-all duration-100"
              style={{ left: collab.x, top: collab.y }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-sm"
              >
                <path
                  d="M5.65376 12.4563L6.87303 19.7514C7.0031 20.4877 7.90327 20.7832 8.45194 20.2345L13.7998 14.8867C14.1448 14.5417 14.1448 13.9832 13.7998 13.6382L8.45194 8.29029C7.90327 7.74162 7.0031 8.03711 6.87303 8.77339L5.65376 16.0685"
                  fill={collab.color}
                />
              </svg>
              <span
                className="absolute left-5 top-5 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{ backgroundColor: collab.color, color: "white" }}
              >
                {collab.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Minimap (optional) */}
      <div className="absolute bottom-4 right-4 w-40 h-28 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-2 text-[10px] font-semibold text-neutral-500 border-b border-neutral-100">
          Overview
        </div>
        <div className="relative w-full h-full p-1">
          {nodes.map((node) => (
            <div
              key={node.id}
              className={`absolute rounded ${NODE_COLORS[node.type].bg}`}
              style={{
                left: `${(node.x / 2000) * 100}%`,
                top: `${(node.y / 1500) * 100}%`,
                width: "8px",
                height: "5px",
              }}
            />
          ))}
          <div
            className="absolute border-2 border-indigo-500 bg-indigo-500/10 rounded"
            style={{
              left: `${(-pan.x / 2000 / zoom) * 100}%`,
              top: `${(-pan.y / 1500 / zoom) * 100}%`,
              width: `${(100 / zoom)}%`,
              height: `${(100 / zoom)}%`,
            }}
          />
        </div>
      </div>

      {/* Collaboration Info */}
      {collaborators.length > 0 && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-lg px-3 py-2 shadow-sm">
          <div className="flex -space-x-2">
            {collaborators.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="w-6 h-6 rounded-full border-2 border-white text-[8px] font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: c.color }}
                title={c.name}
              >
                {c.name.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-xs text-neutral-600">
            {collaborators.length} editing
          </span>
        </div>
      )}
    </div>
  );
}
