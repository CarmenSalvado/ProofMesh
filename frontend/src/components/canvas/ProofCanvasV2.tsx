"use client";

import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer2,
  Hand,
  GitBranch,
  Plus,
} from "lucide-react";
import { CanvasNode, CanvasEdge, Collaborator, NODE_TYPE_CONFIG, STATUS_CONFIG } from "./types";
import { CanvasNodeItem } from "./CanvasNodeItem";

interface ProofCanvasV2Props {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeCreate?: (node?: Partial<CanvasNode>) => void;
  onEdgeCreate?: (from: string, to: string) => void;
  collaborators?: Collaborator[];
  readOnly?: boolean;
}

type Tool = "select" | "pan" | "connect";

function getEdgePath(from: CanvasNode, to: CanvasNode): { path: string } {
  const fromWidth = from.width || 260;
  const fromHeight = from.height || 140;
  const toWidth = to.width || 260;
  const toHeight = to.height || 140;
  
  // Calculate centers
  const fromCenterX = from.x + fromWidth / 2;
  const fromCenterY = from.y + fromHeight / 2;
  const toCenterX = to.x + toWidth / 2;
  const toCenterY = to.y + toHeight / 2;
  
  // Calculate the angle between centers
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  const angle = Math.atan2(dy, dx);
  
  // Determine exit point from source node
  let fromX: number, fromY: number;
  // Determine entry point to target node  
  let toX: number, toY: number;
  
  // Use angle to determine which edges to use
  // Divide into 4 quadrants based on 45 degree angles
  const PI = Math.PI;
  
  if (angle > -PI/4 && angle <= PI/4) {
    // Target is to the right
    fromX = from.x + fromWidth;
    fromY = fromCenterY;
    toX = to.x;
    toY = toCenterY;
  } else if (angle > PI/4 && angle <= 3*PI/4) {
    // Target is below
    fromX = fromCenterX;
    fromY = from.y + fromHeight;
    toX = toCenterX;
    toY = to.y;
  } else if (angle > -3*PI/4 && angle <= -PI/4) {
    // Target is above
    fromX = fromCenterX;
    fromY = from.y;
    toX = toCenterX;
    toY = to.y + toHeight;
  } else {
    // Target is to the left
    fromX = from.x;
    fromY = fromCenterY;
    toX = to.x + toWidth;
    toY = toCenterY;
  }
  
  // Offset the end point for arrow visibility
  const edx = toX - fromX;
  const edy = toY - fromY;
  const len = Math.sqrt(edx * edx + edy * edy);
  const arrowOffset = 12;
  const endX = len > arrowOffset ? toX - (edx / len) * arrowOffset : toX;
  const endY = len > arrowOffset ? toY - (edy / len) * arrowOffset : toY;
  
  // Create smooth bezier curve
  const isVertical = Math.abs(dy) > Math.abs(dx);
  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;
  
  const tension = 0.5;
  if (isVertical) {
    const cpOffset = Math.abs(endY - fromY) * tension;
    cp1x = fromX;
    cp1y = fromY + (endY > fromY ? cpOffset : -cpOffset);
    cp2x = endX;
    cp2y = endY + (endY > fromY ? -cpOffset : cpOffset);
  } else {
    const cpOffset = Math.abs(endX - fromX) * tension;
    cp1x = fromX + (endX > fromX ? cpOffset : -cpOffset);
    cp1y = fromY;
    cp2x = endX + (endX > fromX ? -cpOffset : cpOffset);
    cp2y = endY;
  }
  
  return {
    path: `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
  };
}

export function ProofCanvasV2({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  onNodeMove,
  onNodeDoubleClick,
  onNodeCreate,
  onEdgeCreate,
  collaborators = [],
  readOnly = false,
}: ProofCanvasV2Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  
  // Use refs for drag to avoid re-renders during drag
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const draggedNodeIdRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Create node map for edge lookups, with drag position override
  const nodeMap = useMemo(() => {
    const map = new Map(nodes.map((n) => [n.id, n]));
    // If dragging, create a modified node with the drag position
    if (draggedNode && dragPos) {
      const originalNode = map.get(draggedNode);
      if (originalNode) {
        map.set(draggedNode, { ...originalNode, x: dragPos.x, y: dragPos.y });
      }
    }
    return map;
  }, [nodes, draggedNode, dragPos]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.2, 0.25));
  }, []);

  const handleFit = useCallback(() => {
    if (nodes.length === 0) {
      setZoom(1);
      setPan({ x: 50, y: 50 });
      return;
    }

    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + (n.width || 260)));
    const maxY = Math.max(...nodes.map((n) => n.y + (n.height || 140)));

    const width = maxX - minX + 100;
    const height = maxY - minY + 100;

    const canvasWidth = canvasRef.current?.clientWidth || 800;
    const canvasHeight = canvasRef.current?.clientHeight || 600;

    const scaleX = canvasWidth / width;
    const scaleY = canvasHeight / height;
    const scale = Math.min(scaleX, scaleY, 1.5);

    setZoom(scale);
    setPan({
      x: (canvasWidth - width * scale) / 2 - minX * scale + 50,
      y: (canvasHeight - height * scale) / 2 - minY * scale + 50,
    });
  }, [nodes]);

  // Wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((z) => Math.max(0.25, Math.min(3, z * delta)));
      } else {
        setPan((p) => ({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        }));
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      if (tool === "pan") {
        setIsPanning(true);
        e.preventDefault();
      } else if (tool === "select") {
        // Clicking on canvas background clears selection
        if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains("canvas-bg")) {
          onNodeSelect(null);
        }
      }
    },
    [tool, onNodeSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // Track mouse position for connection line
      if (connectingFrom) {
        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasY = (e.clientY - rect.top - pan.y) / zoom;
        setMousePos({ x: canvasX, y: canvasY });
      }
      
      if (isPanning) {
        setPan((p) => ({
          x: p.x + e.movementX,
          y: p.y + e.movementY,
        }));
      } else if (isDraggingRef.current && dragNodeRef.current) {
        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasY = (e.clientY - rect.top - pan.y) / zoom;
        const newX = Math.max(0, canvasX - dragOffsetRef.current.x);
        const newY = Math.max(0, canvasY - dragOffsetRef.current.y);
        
        // Direct DOM manipulation for the node element
        dragNodeRef.current.style.left = `${newX}px`;
        dragNodeRef.current.style.top = `${newY}px`;
        dragStartPosRef.current = { x: newX, y: newY };
        
        // Throttle state updates for edge rendering using RAF
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          setDragPos({ x: newX, y: newY });
        });
      }
    },
    [isPanning, zoom, pan, connectingFrom]
  );

  const handleMouseUp = useCallback(() => {
    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    // Commit the drag position to state only on mouse up
    if (isDraggingRef.current && draggedNodeIdRef.current && onNodeMove) {
      onNodeMove(draggedNodeIdRef.current, dragStartPosRef.current.x, dragStartPosRef.current.y);
    }
    
    setIsPanning(false);
    setDraggedNode(null);
    setDragPos(null);
    isDraggingRef.current = false;
    dragNodeRef.current = null;
    draggedNodeIdRef.current = null;
    
    if (connectingFrom) {
      setConnectingFrom(null);
    }
  }, [connectingFrom, onNodeMove]);

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (tool === "connect") {
        setConnectingFrom(node.id);
      } else if (tool === "select" && !readOnly) {
        onNodeSelect(node.id);
        setDraggedNode(node.id);
        isDraggingRef.current = true;
        draggedNodeIdRef.current = node.id;
        
        // Find the node element and store ref
        const nodeElement = (e.target as HTMLElement).closest('[data-node-id]') as HTMLDivElement;
        dragNodeRef.current = nodeElement;
        
        // Store the initial offset for accurate dragging
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const canvasX = (e.clientX - rect.left - pan.x) / zoom;
          const canvasY = (e.clientY - rect.top - pan.y) / zoom;
          dragOffsetRef.current = {
            x: canvasX - node.x,
            y: canvasY - node.y,
          };
          dragStartPosRef.current = { x: node.x, y: node.y };
        }
      } else {
        onNodeSelect(node.id);
      }
    },
    [tool, readOnly, onNodeSelect, pan, zoom]
  );

  const handleNodeConnectionStart = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      e.preventDefault();
      e.stopPropagation();
      setConnectingFrom(node.id);
    },
    []
  );

  const handleNodeMouseUp = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      if (connectingFrom && connectingFrom !== node.id && onEdgeCreate) {
        onEdgeCreate(connectingFrom, node.id);
      }
      setConnectingFrom(null);
    },
    [connectingFrom, onEdgeCreate]
  );

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-full overflow-hidden bg-neutral-50 ${
        tool === "pan" ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid Background */}
      <div
        className="canvas-bg absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle, #d1d5db 1px, transparent 1px)
          `,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 flex items-center gap-1 bg-white border border-neutral-200 rounded-lg shadow-sm p-1 z-30">
        <button
          onClick={() => setTool("select")}
          className={`p-2 rounded-md transition-colors ${
            tool === "select"
              ? "bg-indigo-100 text-indigo-700"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
          title="Select (V)"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool("pan")}
          className={`p-2 rounded-md transition-colors ${
            tool === "pan"
              ? "bg-indigo-100 text-indigo-700"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
          title="Pan (H)"
        >
          <Hand className="w-4 h-4" />
        </button>
        {!readOnly && (
          <>
            <button
              onClick={() => setTool("connect")}
              className={`p-2 rounded-md transition-colors ${
                tool === "connect"
                  ? "bg-indigo-100 text-indigo-700"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
              title="Connect (C)"
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-neutral-200 mx-1" />
            <button
              onClick={() => onNodeCreate?.({})}
              className="p-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
              title="Add Node"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white border border-neutral-200 rounded-lg shadow-sm p-2 z-30">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="px-3 py-1 bg-neutral-100 rounded text-xs font-mono text-neutral-700 min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-neutral-200" />
        <button
          onClick={handleFit}
          className="p-1.5 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
          title="Fit to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Transform Container */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* SVG for Edges */}
        <svg className="absolute inset-0 w-[10000px] h-[10000px] pointer-events-none overflow-visible">
          <defs>
            <marker
              id="arrowhead-uses"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
            <marker
              id="arrowhead-implies"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
            </marker>
          </defs>
          
          {edges.map((edge) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) return null;

            const strokeColor = edge.type === "implies" ? "#6366f1" : "#94a3b8";
            const markerId = edge.type === "implies" ? "arrowhead-implies" : "arrowhead-uses";
            const { path } = getEdgePath(fromNode, toNode);

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeDasharray={edge.type === "references" ? "4,4" : undefined}
                  markerEnd={`url(#${markerId})`}
                />
                {edge.label && (
                  <text
                    x={(fromNode.x + toNode.x + (fromNode.width || 260)) / 2}
                    y={(fromNode.y + toNode.y + (fromNode.height || 140)) / 2}
                    fontSize="10"
                    fill="#64748b"
                    textAnchor="middle"
                    className="pointer-events-none"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Connection line being drawn */}
          {connectingFrom && (() => {
            const fromNode = nodeMap.get(connectingFrom);
            if (!fromNode) return null;
            
            const fromWidth = fromNode.width || 260;
            const fromHeight = fromNode.height || 140;
            const fromCenterX = fromNode.x + fromWidth / 2;
            const fromCenterY = fromNode.y + fromHeight / 2;
            
            // Determine which edge to start from based on mouse position
            let fromX: number, fromY: number;
            if (mousePos.y > fromCenterY + fromHeight / 2) {
              // Mouse below: exit from bottom
              fromX = fromCenterX;
              fromY = fromNode.y + fromHeight;
            } else if (mousePos.y < fromCenterY - fromHeight / 2) {
              // Mouse above: exit from top
              fromX = fromCenterX;
              fromY = fromNode.y;
            } else if (mousePos.x > fromCenterX) {
              // Mouse to the right
              fromX = fromNode.x + fromWidth;
              fromY = fromCenterY;
            } else {
              // Mouse to the left
              fromX = fromNode.x;
              fromY = fromCenterY;
            }
            
            return (
              <>
                <path
                  d={`M ${fromX} ${fromY} L ${mousePos.x} ${mousePos.y}`}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                  className="pointer-events-none"
                />
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r="6"
                  fill="#22c55e"
                  className="pointer-events-none"
                />
              </>
            );
          })()}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <CanvasNodeItem
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            isDragging={draggedNode === node.id}
            isConnecting={connectingFrom === node.id}
            onMouseDown={(e: React.MouseEvent) => handleNodeMouseDown(e, node)}
            onMouseUp={(e: React.MouseEvent) => handleNodeMouseUp(e, node)}
            onDoubleClick={() => onNodeDoubleClick?.(node.id)}
            onConnectionStart={(e: React.MouseEvent) => handleNodeConnectionStart(e, node)}
          />
        ))}

        {/* Collaborator Cursors */}
        {collaborators.map((collab) => (
          <div
            key={collab.id}
            className="absolute pointer-events-none transition-all duration-150 ease-out"
            style={{ left: collab.x, top: collab.y }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5.65 12.46L6.87 19.75C7 20.49 7.9 20.78 8.45 20.23L13.8 14.89C14.14 14.54 14.14 13.98 13.8 13.64L8.45 8.29C7.9 7.74 7 8.04 6.87 8.77L5.65 16.07"
                fill={collab.color}
              />
            </svg>
            <span
              className="absolute left-4 top-4 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm"
              style={{ backgroundColor: collab.color, color: "white" }}
            >
              {collab.name}
            </span>
          </div>
        ))}
      </div>

      {/* Minimap */}
      <div className="absolute bottom-4 right-4 w-36 h-24 bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-lg shadow-sm overflow-hidden z-30">
        <div className="px-2 py-1 text-[9px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
          Overview
        </div>
        <div className="relative w-full h-[calc(100%-20px)] p-1">
          {nodes.map((node) => {
            const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.note;
            return (
              <div
                key={node.id}
                className={`absolute rounded-sm ${config.bgColor}`}
                style={{
                  left: `${Math.max(0, Math.min(95, (node.x / 2500) * 100))}%`,
                  top: `${Math.max(0, Math.min(90, (node.y / 1800) * 100))}%`,
                  width: "6px",
                  height: "4px",
                }}
              />
            );
          })}
          <div
            className="absolute border border-indigo-500 bg-indigo-500/10 rounded-sm"
            style={{
              left: `${Math.max(0, (-pan.x / 2500 / zoom) * 100)}%`,
              top: `${Math.max(0, (-pan.y / 1800 / zoom) * 100)}%`,
              width: `${Math.min(100, (100 / zoom) * 0.8)}%`,
              height: `${Math.min(100, (100 / zoom) * 0.8)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
