"use client";

import { useRef, useState, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  ZoomIn,
  ZoomOut,
  Plus,
  Undo2,
  Redo2,
  FileText,
  MousePointer2,
  Hand,
  Trash2,
} from "lucide-react";
import { CanvasNode, CanvasEdge, Collaborator, NODE_TYPE_CONFIG, type CanvasBlock } from "./types";
import { CanvasNodeItem } from "./CanvasNodeItem";
import { InlineNodeEditor, QuickNodeData } from "./InlineNodeEditor";
import { CanvasContextMenu } from "./CanvasContextMenu";

type CanvasMode = "cursor" | "hand";

interface ProofCanvasV2Props {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
  selectedNodeIds?: Set<string>;
  blocks?: CanvasBlock[];
  selectedBlockId?: string | null;
  onNodeSelect: (nodeId: string | null) => void;
  onMultiSelect?: (nodeIds: Set<string>) => void;
  onBlockSelect?: (blockId: string) => void;
  onCreateBlock?: (name: string, nodeIds?: string[]) => void;
  onDeleteBlock?: (blockId: string) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onNodesMove?: (positions: Record<string, { x: number; y: number }>) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onNodeCreate?: (node?: Partial<CanvasNode>) => void;
  onNodeUpdate?: (nodeId: string, updates: Partial<CanvasNode>) => void;
  onNodeDelete?: (nodeId: string) => void;
  onMultiDelete?: (nodeIds: string[]) => void;
  onEdgeCreate?: (from: string, to: string) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onCommitToDocument?: (nodeIds: string[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenComments?: (nodeId: string) => void;
  nodeAnchorStatus?: Map<string, { hasAnchors: boolean; isStale: boolean; count: number }>;
  collaborators?: Collaborator[];
  onCursorMove?: (x: number, y: number) => void;
  readOnly?: boolean;
  hideZoomControls?: boolean;
  hideMinimap?: boolean;
  hideHelpText?: boolean;
  disableInteraction?: boolean;
}

export interface ProofCanvasHandle {
  openInlineEditorAtCenter: () => void;
}

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

// Helper function to update edges during drag without React re-renders
function updateEdgesForDraggedNodes(
  draggedNodePositions: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, CanvasNode>
) {
  // Find all edges connected to dragged nodes
  const edgeGroups = document.querySelectorAll<SVGGElement>('[data-edge-id]');
  
  edgeGroups.forEach((edgeGroup) => {
    const fromId = edgeGroup.getAttribute('data-from-id');
    const toId = edgeGroup.getAttribute('data-to-id');
    if (!fromId || !toId) return;
    
    // Check if either end is being dragged
    const fromDragPos = draggedNodePositions.get(fromId);
    const toDragPos = draggedNodePositions.get(toId);
    
    if (!fromDragPos && !toDragPos) return; // Neither end is being dragged
    
    // Get the original nodes
    const fromNodeOriginal = nodeMap.get(fromId);
    const toNodeOriginal = nodeMap.get(toId);
    if (!fromNodeOriginal || !toNodeOriginal) return;
    
    // Create temporary node objects with updated positions
    const fromNode: CanvasNode = fromDragPos 
      ? { ...fromNodeOriginal, x: fromDragPos.x, y: fromDragPos.y }
      : fromNodeOriginal;
    const toNode: CanvasNode = toDragPos
      ? { ...toNodeOriginal, x: toDragPos.x, y: toDragPos.y }
      : toNodeOriginal;
    
    // Calculate new path
    const { path } = getEdgePath(fromNode, toNode);
    
    // Update all path elements in this edge group
    const paths = edgeGroup.querySelectorAll('path');
    paths.forEach((pathEl) => {
      pathEl.setAttribute('d', path);
    });
  });
}

// Helper function to update block bounds during drag
function updateBlocksForDraggedNodes(
  draggedNodePositions: Map<string, { x: number; y: number }>,
  blocks: CanvasBlock[],
  nodeMap: Map<string, CanvasNode>
) {
  blocks.forEach((block) => {
    // Check if any node in this block is being dragged
    const hasMovedNodes = block.nodeIds.some((id) => draggedNodePositions.has(id));
    if (!hasMovedNodes) return;
    
    // Calculate new bounds for this block
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    block.nodeIds.forEach((nodeId) => {
      const dragPos = draggedNodePositions.get(nodeId);
      const originalNode = nodeMap.get(nodeId);
      if (!originalNode) return;
      
      const x = dragPos ? dragPos.x : originalNode.x;
      const y = dragPos ? dragPos.y : originalNode.y;
      const width = originalNode.width || 260;
      const height = originalNode.height || 140;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });
    
    if (minX === Infinity) return; // No nodes found
    
    // Add padding
    const padding = 24;
    const newLeft = minX - padding;
    const newTop = minY - padding;
    const newWidth = maxX - minX + padding * 2;
    const newHeight = maxY - minY + padding * 2;
    
    // Update block element directly
    const blockEl = document.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement;
    if (blockEl) {
      blockEl.style.transform = `translate3d(${newLeft}px, ${newTop}px, 0)`;
      blockEl.style.width = `${newWidth}px`;
      blockEl.style.height = `${newHeight}px`;
    }
  });
}

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("Failed to read image"));
  reader.readAsDataURL(file);
});

export const ProofCanvasV2 = forwardRef<ProofCanvasHandle, ProofCanvasV2Props>(function ProofCanvasV2({
  nodes,
  edges,
  selectedNodeId,
  selectedNodeIds = new Set(),
  blocks = [],
  selectedBlockId = null,
  onNodeSelect,
  onMultiSelect,
  onBlockSelect,
  onCreateBlock,
  onDeleteBlock,
  onNodeMove,
  onNodesMove,
  onNodeDoubleClick,
  onNodeCreate,
  onNodeUpdate,
  onNodeDelete,
  onMultiDelete,
  onEdgeCreate,
  onEdgeDelete,
  onCommitToDocument,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenComments,
  nodeAnchorStatus,
  collaborators = [],
  onCursorMove,
  readOnly = false,
  hideZoomControls = false,
  hideMinimap = false,
  hideHelpText = false,
  disableInteraction = false,
}: ProofCanvasV2Props, ref) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 100, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null);
  const [multiDraggingIds, setMultiDraggingIds] = useState<string[] | null>(null);
  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set());
  
  // Canvas interaction mode: cursor (selection) or hand (pan)
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("cursor");
  
  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<CanvasNode[]>([]);
  
  // Inline editor state
  const [inlineEditor, setInlineEditor] = useState<{ x: number; y: number } | null>(null);

  // Group creation state
  const [groupDraft, setGroupDraft] = useState<{ x: number; y: number; nodeIds: string[] } | null>(null);
  const [groupName, setGroupName] = useState("");
  const groupDraftRef = useRef<HTMLDivElement | null>(null);
  const groupInputRef = useRef<HTMLInputElement | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: CanvasNode } | null>(null);
  
  // Edge context menu state
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  
  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  
  // Double-click detection
  const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null);
  
  // Track if mouse was clicked on edge
  const edgeClickRef = useRef<{ edgeId: string; x: number; y: number } | null>(null);
  
  // Drag refs
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragOriginPosRef = useRef({ x: 0, y: 0 });
  const multiDragStartPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const multiDragPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const multiDraggingRef = useRef(false);
  const multiDraggingIdsRef = useRef<string[]>([]);
  const isDraggingRef = useRef(false);
  const draggedNodeIdRef = useRef<string | null>(null);
  const groupDraggingRef = useRef(false);
  const groupDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedNodesRef = useRef(false);
  const newNodeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  
  // Auto-pan refs for edge dragging
  const autoPanRef = useRef<number | null>(null);
  const lastClientPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // Transform container ref for direct DOM manipulation (better performance)
  const transformContainerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 100, y: 80 });
  const zoomRef = useRef(1);
  
  // Throttle selection updates to improve performance
  const selectionUpdateRef = useRef<number | null>(null);
  
  // Throttle cursor broadcasts to collaborators (16ms = ~60fps)
  const cursorThrottleRef = useRef<number>(0);
  const CURSOR_THROTTLE_MS = 50; // 20 updates per second max

  // Create node map for edge lookups - during drag, edges are not updated for performance
  const nodeMap = useMemo(() => {
    const map = new Map(nodes.map((n) => [n.id, n]));
    return map;
  }, [nodes]);
  
  // Memoize edge paths to avoid recalculating on every render
  const edgePaths = useMemo(() => {
    const paths: Array<{ edge: CanvasEdge; path: string; fromNode: CanvasNode; toNode: CanvasNode }> = [];
    edges.forEach((edge) => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) return;
      
      const { path } = getEdgePath(fromNode, toNode);
      paths.push({ edge, path, fromNode, toNode });
    });
    return paths;
  }, [edges, nodeMap]);
  
  // Memoize minimap nodes to avoid recalculation
  const minimapNodes = useMemo(() => {
    return nodes.map((node) => ({
      id: node.id,
      left: Math.max(0, Math.min(95, (node.x / 2500) * 100)),
      top: Math.max(0, Math.min(90, (node.y / 1800) * 100)),
    }));
  }, [nodes]);

  // Memoize multi-drag positions for rendering
  const multiDragPositions = useMemo(() => {
    if (!multiDraggingIds || !dragDelta) return null;
    const map = new Map<string, { x: number; y: number }>();
    multiDraggingIds.forEach((id) => {
      const startPos = multiDragStartPositionsRef.current[id];
      if (startPos) {
        map.set(id, {
          x: startPos.x + dragDelta.x,
          y: startPos.y + dragDelta.y,
        });
      }
    });
    return map;
  }, [multiDraggingIds, dragDelta]);

  useEffect(() => {
    multiDragPositionsRef.current = multiDragPositions || new Map();
  }, [multiDragPositions]);

  useEffect(() => {
    if (!groupDraft) return;
    groupInputRef.current?.focus();
    groupInputRef.current?.select();
  }, [groupDraft]);

  useEffect(() => {
    if (!groupDraft) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (groupDraftRef.current && groupDraftRef.current.contains(e.target as Node)) return;
      if (groupName.trim() && onCreateBlock) {
        onCreateBlock(groupName.trim(), groupDraft.nodeIds);
      }
      setGroupDraft(null);
      setGroupName("");
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [groupDraft, groupName, onCreateBlock]);

  useEffect(() => {
    const currentIds = new Set(nodes.map((node) => node.id));
    if (!hasInitializedNodesRef.current) {
      hasInitializedNodesRef.current = true;
      prevNodeIdsRef.current = currentIds;
      return;
    }

    const prevIds = prevNodeIdsRef.current;
    const added = nodes.filter((node) => !prevIds.has(node.id));
    if (added.length > 0) {
      setNewNodeIds((prev) => {
        const next = new Set(prev);
        added.forEach((node) => next.add(node.id));
        return next;
      });
      added.forEach((node) => {
        const existing = newNodeTimeoutsRef.current.get(node.id);
        if (existing) clearTimeout(existing);
        const timeout = setTimeout(() => {
          setNewNodeIds((prev) => {
            const next = new Set(prev);
            next.delete(node.id);
            return next;
          });
          newNodeTimeoutsRef.current.delete(node.id);
        }, 700);
        newNodeTimeoutsRef.current.set(node.id, timeout);
      });
    }
    prevNodeIdsRef.current = currentIds;
  }, [nodes]);

  useEffect(() => {
    return () => {
      newNodeTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      newNodeTimeoutsRef.current.clear();
    };
  }, []);
  
  // Memoize minimap viewport
  const minimapViewport = useMemo(() => {
    return {
      left: Math.max(0, (-pan.x / 2500 / zoom) * 100),
      top: Math.max(0, (-pan.y / 1800 / zoom) * 100),
      width: Math.min(100, (100 / zoom) * 0.8),
      height: Math.min(100, (100 / zoom) * 0.8),
    };
  }, [pan, zoom]);

  // Direct zoom handlers - update DOM immediately, sync state after
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoomRef.current * 1.25, 3);
    zoomRef.current = newZoom;
    if (transformContainerRef.current) {
      transformContainerRef.current.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${newZoom})`;
    }
    setZoom(newZoom);
  }, []);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoomRef.current / 1.25, 0.25);
    zoomRef.current = newZoom;
    if (transformContainerRef.current) {
      transformContainerRef.current.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${newZoom})`;
    }
    setZoom(newZoom);
  }, []);

  const handleFit = useCallback(() => {
    if (nodes.length === 0) {
      zoomRef.current = 1;
      panRef.current = { x: 100, y: 80 };
      if (transformContainerRef.current) {
        transformContainerRef.current.style.transform = `translate3d(100px, 80px, 0) scale(1)`;
      }
      setZoom(1);
      setPan({ x: 100, y: 80 });
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

    const newPan = {
      x: (canvasWidth - width * scale) / 2 - minX * scale + 50,
      y: (canvasHeight - height * scale) / 2 - minY * scale + 50,
    };
    
    zoomRef.current = scale;
    panRef.current = newPan;
    if (transformContainerRef.current) {
      transformContainerRef.current.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0) scale(${scale})`;
    }
    setZoom(scale);
    setPan(newPan);
  }, [nodes]);

  const openInlineEditorAtCenter = useCallback(() => {
    if (readOnly) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setInlineEditor({ x: rect.width / 2, y: rect.height / 2 });
    }
  }, [readOnly]);

  useImperativeHandle(ref, () => ({
    openInlineEditorAtCenter,
  }), [openInlineEditorAtCenter]);

  // Update refs when state changes
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Helper to update transform container directly (for smooth animations)
  const updateTransformDirect = useCallback((newPan?: { x: number; y: number }, newZoom?: number) => {
    if (!transformContainerRef.current) return;
    const p = newPan ?? panRef.current;
    const z = newZoom ?? zoomRef.current;
    transformContainerRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${z})`;
  }, []);

  // Auto-pan when dragging near edges
  const EDGE_THRESHOLD = 60; // pixels from edge to start auto-pan
  const AUTO_PAN_SPEED = 12; // pixels per frame
  
  const startAutoPan = useCallback(() => {
    if (autoPanRef.current) return; // Already running
    
    const autoPanLoop = () => {
      const clientPos = lastClientPosRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      
      if (!clientPos || !rect || !isDraggingRef.current) {
        autoPanRef.current = null;
        return;
      }
      
      let panDx = 0;
      let panDy = 0;
      
      // Check proximity to edges
      const relX = clientPos.x - rect.left;
      const relY = clientPos.y - rect.top;
      
      if (relX < EDGE_THRESHOLD) {
        panDx = AUTO_PAN_SPEED * ((EDGE_THRESHOLD - relX) / EDGE_THRESHOLD);
      } else if (relX > rect.width - EDGE_THRESHOLD) {
        panDx = -AUTO_PAN_SPEED * ((relX - (rect.width - EDGE_THRESHOLD)) / EDGE_THRESHOLD);
      }
      
      if (relY < EDGE_THRESHOLD) {
        panDy = AUTO_PAN_SPEED * ((EDGE_THRESHOLD - relY) / EDGE_THRESHOLD);
      } else if (relY > rect.height - EDGE_THRESHOLD) {
        panDy = -AUTO_PAN_SPEED * ((relY - (rect.height - EDGE_THRESHOLD)) / EDGE_THRESHOLD);
      }
      
      if (panDx !== 0 || panDy !== 0) {
        // Update pan
        const newPan = {
          x: panRef.current.x + panDx,
          y: panRef.current.y + panDy,
        };
        panRef.current = newPan;
        updateTransformDirect(newPan);
        
        // Also move the dragged node(s) to compensate for pan
        const panDeltaCanvas = { x: -panDx / zoomRef.current, y: -panDy / zoomRef.current };
        
        if (groupDraggingRef.current && multiDraggingIdsRef.current.length > 0) {
          // Move all nodes in group
          const draggedPositions = new Map<string, { x: number; y: number }>();
          multiDraggingIdsRef.current.forEach((id) => {
            const nodeEl = document.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
            if (nodeEl) {
              const matrix = new DOMMatrix(getComputedStyle(nodeEl).transform);
              const newX = matrix.m41 + panDeltaCanvas.x;
              const newY = matrix.m42 + panDeltaCanvas.y;
              nodeEl.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
              draggedPositions.set(id, { x: newX, y: newY });
              
              // Update start positions for final commit
              const startPos = multiDragStartPositionsRef.current[id];
              if (startPos) {
                multiDragStartPositionsRef.current[id] = { x: newX, y: newY };
              }
            }
          });
          dragStartPosRef.current = {
            x: dragStartPosRef.current.x + panDeltaCanvas.x,
            y: dragStartPosRef.current.y + panDeltaCanvas.y,
          };
          updateEdgesForDraggedNodes(draggedPositions, nodeMap);
          updateBlocksForDraggedNodes(draggedPositions, blocks, nodeMap);
        } else if (dragNodeRef.current && draggedNodeIdRef.current) {
          // Move single node
          const matrix = new DOMMatrix(getComputedStyle(dragNodeRef.current).transform);
          const newX = matrix.m41 + panDeltaCanvas.x;
          const newY = matrix.m42 + panDeltaCanvas.y;
          dragNodeRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
          dragStartPosRef.current = { x: newX, y: newY };
          
          const draggedPositions = new Map<string, { x: number; y: number }>();
          draggedPositions.set(draggedNodeIdRef.current, { x: newX, y: newY });
          updateEdgesForDraggedNodes(draggedPositions, nodeMap);
          updateBlocksForDraggedNodes(draggedPositions, blocks, nodeMap);
        }
        
        autoPanRef.current = requestAnimationFrame(autoPanLoop);
      } else {
        autoPanRef.current = requestAnimationFrame(autoPanLoop);
      }
    };
    
    autoPanRef.current = requestAnimationFrame(autoPanLoop);
  }, [updateTransformDirect, nodeMap, blocks]);
  
  const stopAutoPan = useCallback(() => {
    if (autoPanRef.current) {
      cancelAnimationFrame(autoPanRef.current);
      autoPanRef.current = null;
    }
    lastClientPosRef.current = null;
  }, []);

  // Debounced state sync for zoom/pan
  const syncTimeoutRef = useRef<number | null>(null);
  const syncStateDebounced = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = window.setTimeout(() => {
      setZoom(zoomRef.current);
      setPan(panRef.current);
      syncTimeoutRef.current = null;
    }, 150);
  }, []);

  // Wheel zoom/pan - direct DOM manipulation for maximum performance
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (disableInteraction) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        const newZoom = Math.max(0.25, Math.min(3, zoomRef.current * delta));
        zoomRef.current = newZoom;
        updateTransformDirect(undefined, newZoom);
        syncStateDebounced();
      } else {
        const newPan = {
          x: panRef.current.x - e.deltaX,
          y: panRef.current.y - e.deltaY,
        };
        panRef.current = newPan;
        updateTransformDirect(newPan);
        syncStateDebounced();
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [updateTransformDirect, syncStateDebounced, disableInteraction]);

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - panRef.current.x) / zoomRef.current,
      y: (screenY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const canvasToScreen = useCallback((x: number, y: number) => {
    return {
      x: x * zoomRef.current + panRef.current.x,
      y: y * zoomRef.current + panRef.current.y,
    };
  }, []);

  const getNodesBounds = useCallback((ids: string[]) => {
    const nodesToMeasure = ids.map((id) => nodeMap.get(id)).filter(Boolean) as CanvasNode[];
    if (nodesToMeasure.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodesToMeasure.forEach((node) => {
      const width = node.width || 260;
      const height = node.height || 140;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + width);
      maxY = Math.max(maxY, node.y + height);
    });

    return { minX, minY, maxX, maxY };
  }, [nodeMap]);

  const openGroupCreator = useCallback((nodeIds: string[]) => {
    if (!onCreateBlock || nodeIds.length === 0) return;
    const bounds = getNodesBounds(nodeIds);
    if (!bounds) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const screenPos = canvasToScreen(centerX, centerY);
    setGroupDraft({ x: screenPos.x, y: screenPos.y, nodeIds });
    setGroupName("");
  }, [canvasToScreen, getNodesBounds, onCreateBlock]);

  const handleCreateGroup = useCallback(() => {
    if (!groupDraft || !onCreateBlock) return;
    const trimmed = groupName.trim();
    if (!trimmed) return;
    onCreateBlock(trimmed, groupDraft.nodeIds);
    setGroupDraft(null);
    setGroupName("");
  }, [groupDraft, groupName, onCreateBlock]);

  const handleCancelGroup = useCallback(() => {
    setGroupDraft(null);
    setGroupName("");
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (groupDraft) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleCancelGroup();
        }
        return;
      }

      // Don't handle if typing in input
      if ((e.target as HTMLElement).tagName === "INPUT" ||
          (e.target as HTMLElement).tagName === "TEXTAREA") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!readOnly) {
          e.preventDefault();
          // Delete selected edge first
          if (selectedEdgeId && onEdgeDelete) {
            onEdgeDelete(selectedEdgeId);
            setSelectedEdgeId(null);
          }
          // Multi-delete if multiple nodes selected
          else if (selectedNodeIds.size > 0 && onMultiDelete) {
            onMultiDelete(Array.from(selectedNodeIds));
            onMultiSelect?.(new Set());
          }
          // Single node delete
          else if (selectedNodeId && onNodeDelete) {
            onNodeDelete(selectedNodeId);
          }
        }
      } else if (e.key === "Escape") {
        onNodeSelect(null);
        onMultiSelect?.(new Set());
        setSelectedEdgeId(null);
        setInlineEditor(null);
        setContextMenu(null);
        setEdgeContextMenu(null);
        setConnectingFrom(null);
      } else if (e.key === "v" || e.key === "V") {
        // V = Cursor/Select mode
        if (!inlineEditor && !(e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          setCanvasMode("cursor");
        }
      } else if (e.key === "h" || e.key === "H") {
        // H = Hand/Pan mode
        if (!inlineEditor) {
          e.preventDefault();
          setCanvasMode("hand");
        }
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        handleFit();
      } else if (e.key === "n" || e.key === "N") {
        if (!readOnly && !inlineEditor) {
          e.preventDefault();
          openInlineEditorAtCenter();
        }
      } else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          // Ctrl+Shift+Z = Redo
          onRedo?.();
        } else {
          // Ctrl+Z = Undo
          onUndo?.();
        }
      } else if ((e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey)) {
        // Ctrl+Y = Redo (alternative)
        e.preventDefault();
        onRedo?.();
      } else if ((e.key === "g" || e.key === "G") && (e.ctrlKey || e.metaKey)) {
        // Ctrl+G = Group selected nodes
        if (!readOnly && onCreateBlock) {
          e.preventDefault();
          const nodeIds = selectedNodeIds.size > 0
            ? Array.from(selectedNodeIds)
            : selectedNodeId
              ? [selectedNodeId]
              : [];
          if (nodeIds.length > 0) {
            openGroupCreator(nodeIds);
          }
        }
      } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
        // Ctrl+A = Select all
        e.preventDefault();
        if (onMultiSelect && nodes.length > 0) {
          onMultiSelect(new Set(nodes.map(n => n.id)));
        }
      } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
        // Ctrl+C = Copy selected nodes
        e.preventDefault();
        const nodesToCopy: CanvasNode[] = [];
        if (selectedNodeIds.size > 0) {
          nodes.forEach(n => {
            if (selectedNodeIds.has(n.id)) nodesToCopy.push(n);
          });
        } else if (selectedNodeId) {
          const node = nodes.find(n => n.id === selectedNodeId);
          if (node) nodesToCopy.push(node);
        }
        if (nodesToCopy.length > 0) {
          setClipboard(nodesToCopy);
        }
      } else if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
        // Ctrl+V = Paste nodes
        if (!readOnly && clipboard.length > 0 && onNodeCreate) {
          e.preventDefault();
          // Find bounding box of clipboard nodes
          const minX = Math.min(...clipboard.map(n => n.x));
          const minY = Math.min(...clipboard.map(n => n.y));

          // Calculate paste offset (slightly offset from original)
          const pasteOffset = 40;

          // Create new nodes
          clipboard.forEach((node, index) => {
            onNodeCreate({
              ...node,
              id: undefined,
              x: node.x - minX + pasteOffset + (index * 10),
              y: node.y - minY + pasteOffset + (index * 10),
              title: `${node.title} (copy)`,
            });
          });
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [groupDraft, handleCancelGroup, selectedNodeId, selectedNodeIds, selectedEdgeId, onNodeDelete, onMultiDelete, onEdgeDelete, readOnly, handleFit, onNodeSelect, onMultiSelect, inlineEditor, onUndo, onRedo, nodes, clipboard, onNodeCreate, openInlineEditorAtCenter, onCreateBlock, openGroupCreator]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (readOnly || !onNodeCreate) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      e.preventDefault();

      const rect = canvasRef.current?.getBoundingClientRect();
      const fallbackScreen = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
      const screenPos = lastMousePosRef.current || fallbackScreen;
      const base = screenToCanvas(screenPos.x, screenPos.y);

      void (async () => {
        for (let index = 0; index < imageItems.length; index += 1) {
          const file = imageItems[index].getAsFile();
          if (!file) continue;
          const dataUrl = await readFileAsDataUrl(file);
          if (!dataUrl) continue;
          const title = file.name?.replace(/\.[^/.]+$/, "") || "Pasted Image";
          await Promise.resolve(onNodeCreate({
            type: "RESOURCE",
            title,
            content: `![${title}](${dataUrl})`,
            x: base.x + index * 40,
            y: base.y + index * 30,
          }));
        }
      })();
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [readOnly, onNodeCreate, screenToCanvas]);

  const blockLayouts = useMemo(() => {
    if (blocks.length === 0) return [];
    const padding = 24;
    return blocks.reduce((acc, block) => {
      const bounds = getNodesBounds(block.nodeIds);
      if (!bounds) return acc;
      acc.push({
        id: block.id,
        name: block.name,
        nodeIds: block.nodeIds,
        left: bounds.minX - padding,
        top: bounds.minY - padding,
        width: bounds.maxX - bounds.minX + padding * 2,
        height: bounds.maxY - bounds.minY + padding * 2,
      });
      return acc;
    }, [] as Array<{ id: string; name: string; nodeIds: string[]; left: number; top: number; width: number; height: number }>);
  }, [blocks, getNodesBounds]);

  // Handle double-click to create node
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const last = lastClickRef.current;
    
    // Check for double-click (within 300ms and 10px)
    if (last && 
        now - last.time < 300 && 
        Math.abs(e.clientX - last.x) < 10 && 
        Math.abs(e.clientY - last.y) < 10) {
      // Double click - open inline editor
      if (!readOnly) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setInlineEditor({ 
            x: e.clientX - rect.left,
            y: e.clientY - rect.top 
          });
        }
      }
      lastClickRef.current = null;
    } else {
      lastClickRef.current = { time: now, x: e.clientX, y: e.clientY };
    }
  }, [readOnly]);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, node?: CanvasNode) => {
    e.preventDefault();
    setEdgeContextMenu(null);
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  // Edge context menu handler
  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(null);
    setEdgeContextMenu({ x: e.clientX, y: e.clientY, edgeId });
  }, []);

  // Edge click handler - select immediately for instant feedback
  const handleEdgeClick = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Select edge immediately for instant feedback
    setSelectedEdgeId(edgeId);
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Mouse handlers - cursor mode = selection, hand mode = pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disableInteraction) return;
      if (e.button === 2) return; // Right click handled by context menu
      
      // Middle mouse button (wheel click) - always start panning
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
        return;
      }
      
      if (e.button !== 0) return;
      
      // Close any open menus
      setContextMenu(null);
      setEdgeContextMenu(null);
      setSelectedEdgeId(null);
      
      // Check if clicking on an edge (via the invisible wider path)
      const target = e.target as HTMLElement;
      const isEdgeClick = target.tagName === 'path' && 
                          target.getAttribute('fill') === 'none' && 
                          target.getAttribute('stroke') === 'transparent' &&
                          target.classList.contains('pointer-events-auto');
      
      // If clicking on edge, let edgeClick handle it
      if (isEdgeClick) {
        return;
      }
      
      const isCanvasBackground = target === canvasRef.current || 
                                  target.classList.contains("canvas-bg") ||
                                  target.closest('[data-canvas-bg]') !== null ||
                                  target.closest('svg') !== null;
      
      if (isCanvasBackground) {
        // Hand mode = pan
        if (canvasMode === "hand") {
          setIsPanning(true);
          panStartRef.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
          e.preventDefault();
          return;
        }
        
        // Cursor mode = start selection box (always, no shift needed)
        if (canvasMode === "cursor") {
          isSelectingRef.current = true;
          mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
          const canvasCoords = screenToCanvas(e.clientX, e.clientY);
          selectionStartRef.current = canvasCoords;
          setSelectionBox({
            startX: canvasCoords.x,
            startY: canvasCoords.y,
            endX: canvasCoords.x,
            endY: canvasCoords.y,
          });
          // Don't clear selection yet - wait to see if it's a click or drag
          e.preventDefault();
          return;
        }
      }
    },
    [pan, onNodeSelect, onMultiSelect, screenToCanvas, canvasMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      
      // Broadcast cursor position to collaborators (throttled)
      if (onCursorMove) {
        const now = Date.now();
        if (now - cursorThrottleRef.current >= CURSOR_THROTTLE_MS) {
          cursorThrottleRef.current = now;
          const canvasCoords = screenToCanvas(e.clientX, e.clientY);
          onCursorMove(canvasCoords.x, canvasCoords.y);
        }
      }
      
      // Track mouse for connection line
      if (connectingFrom) {
        const canvasCoords = screenToCanvas(e.clientX, e.clientY);
        setMousePos(canvasCoords);
      }
      
      // Selection box - update in real-time
      if (isSelectingRef.current && onMultiSelect) {
        const canvasCoords = screenToCanvas(e.clientX, e.clientY);
        
        // Update selection box visual (always update for smooth UI)
        setSelectionBox(prev => prev ? {
          ...prev,
          endX: canvasCoords.x,
          endY: canvasCoords.y,
        } : null);
        
        // Only update selection if there's significant movement
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        
        if (dx > 3 || dy > 3) {
          // Throttle selection updates to improve performance (60fps = 16.67ms)
          if (selectionUpdateRef.current === null) {
            selectionUpdateRef.current = requestAnimationFrame(() => {
              // Calculate selected nodes for visual feedback
              const startX = selectionStartRef.current.x;
              const startY = selectionStartRef.current.y;
              const minX = Math.min(startX, canvasCoords.x);
              const maxX = Math.max(startX, canvasCoords.x);
              const minY = Math.min(startY, canvasCoords.y);
              const maxY = Math.max(startY, canvasCoords.y);
              
              const selectedIds = new Set<string>();
              nodes.forEach(node => {
                const nodeRight = node.x + (node.width || 260);
                const nodeBottom = node.y + (node.height || 140);
                if (node.x < maxX && nodeRight > minX && node.y < maxY && nodeBottom > minY) {
                  selectedIds.add(node.id);
                }
              });
              onMultiSelect(selectedIds);
              selectionUpdateRef.current = null;
            });
          }
        }
        return;
      }

      if (groupDraggingRef.current && isDraggingRef.current) {
        // Track client position for auto-pan
        lastClientPosRef.current = { x: e.clientX, y: e.clientY };
        startAutoPan();
        
        const canvasCoords = screenToCanvas(e.clientX, e.clientY);
        const start = groupDragStartRef.current;
        if (start) {
          const delta = {
            x: canvasCoords.x - start.x,
            y: canvasCoords.y - start.y,
          };
          dragStartPosRef.current = {
            x: dragOriginPosRef.current.x + delta.x,
            y: dragOriginPosRef.current.y + delta.y,
          };
          
          // Build map of all dragged node positions for edge/block updates
          const draggedPositions = new Map<string, { x: number; y: number }>();
          
          // Update all nodes in the group directly via DOM
          multiDraggingIdsRef.current.forEach((id) => {
            const startPos = multiDragStartPositionsRef.current[id];
            if (startPos) {
              const newPos = { x: startPos.x + delta.x, y: startPos.y + delta.y };
              draggedPositions.set(id, newPos);
              const nodeEl = document.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
              if (nodeEl) {
                nodeEl.style.transform = `translate3d(${newPos.x}px, ${newPos.y}px, 0)`;
              }
            }
          });
          
          // Update edges connected to dragged nodes
          updateEdgesForDraggedNodes(draggedPositions, nodeMap);
          
          // Update blocks containing dragged nodes
          updateBlocksForDraggedNodes(draggedPositions, blocks, nodeMap);
        }
        return;
      }
      
      if (isPanning) {
        // Direct DOM manipulation for maximum pan smoothness
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        const newPan = {
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy,
        };
        panRef.current = newPan;
        updateTransformDirect(newPan);
      } else if (isDraggingRef.current && dragNodeRef.current) {
        // Track client position for auto-pan
        lastClientPosRef.current = { x: e.clientX, y: e.clientY };
        startAutoPan();
        
        const canvasCoords = screenToCanvas(e.clientX, e.clientY);
        const newX = canvasCoords.x - dragOffsetRef.current.x;
        const newY = canvasCoords.y - dragOffsetRef.current.y;
        
        // Use transform for GPU-accelerated dragging - NO React state updates during drag
        dragNodeRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
        dragStartPosRef.current = { x: newX, y: newY };
        
        // Build map of all dragged node positions for edge/block updates
        const draggedPositions = new Map<string, { x: number; y: number }>();
        if (draggedNodeIdRef.current) {
          draggedPositions.set(draggedNodeIdRef.current, { x: newX, y: newY });
        }
        
        // Update other dragged nodes directly via DOM (for multi-drag)
        if (multiDraggingRef.current && multiDraggingIdsRef.current.length > 0) {
          const delta = {
            x: newX - dragOriginPosRef.current.x,
            y: newY - dragOriginPosRef.current.y,
          };
          multiDraggingIdsRef.current.forEach((id) => {
            const startPos = multiDragStartPositionsRef.current[id];
            if (startPos) {
              const nodeNewPos = { x: startPos.x + delta.x, y: startPos.y + delta.y };
              draggedPositions.set(id, nodeNewPos);
              
              if (id !== draggedNodeIdRef.current) {
                const nodeEl = document.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
                if (nodeEl) {
                  nodeEl.style.transform = `translate3d(${nodeNewPos.x}px, ${nodeNewPos.y}px, 0)`;
                }
              }
            }
          });
        }
        
        // Update edges connected to dragged nodes
        updateEdgesForDraggedNodes(draggedPositions, nodeMap);
        
        // Update blocks containing dragged nodes
        updateBlocksForDraggedNodes(draggedPositions, blocks, nodeMap);
      }
    },
    [isPanning, connectingFrom, screenToCanvas, nodes, onMultiSelect, nodeMap, blocks, startAutoPan, onCursorMove]
  );

  const handleMouseUp = useCallback(() => {
    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    // Stop auto-pan
    stopAutoPan();
    
    // Cancel any pending selection update RAF
    if (selectionUpdateRef.current) {
      cancelAnimationFrame(selectionUpdateRef.current);
      selectionUpdateRef.current = null;
    }
    
    // Handle selection box completion
    if (isSelectingRef.current) {
      // Check if it was just a click (no significant movement)
      if (selectionBox) {
        const boxWidth = Math.abs(selectionBox.endX - selectionBox.startX);
        const boxHeight = Math.abs(selectionBox.endY - selectionBox.startY);
        
        // If the selection box is tiny (just a click), clear selection
        if (boxWidth < 5 && boxHeight < 5) {
          onMultiSelect?.(new Set());
          onNodeSelect(null);
        }
      }
      
      isSelectingRef.current = false;
      setSelectionBox(null);
    }
    
    // Handle edge click - only select if there was no significant movement
    if (edgeClickRef.current) {
      // For now, we'll always select the edge since we can't track movement here
      // The selection will be cleared only if there was actual selection or panning
      if (!isPanning && !isSelectingRef.current && !isDraggingRef.current) {
        setSelectedEdgeId(edgeClickRef.current.edgeId);
      }
      
      edgeClickRef.current = null;
    }
    
    // Commit the drag position to state only on mouse up
    if (isDraggingRef.current && draggedNodeIdRef.current) {
      if (multiDraggingRef.current && onNodesMove) {
        const updatedPositions: Record<string, { x: number; y: number }> = {};
        const delta = {
          x: dragStartPosRef.current.x - dragOriginPosRef.current.x,
          y: dragStartPosRef.current.y - dragOriginPosRef.current.y,
        };

        if (delta.x !== 0 || delta.y !== 0) {
          multiDraggingIdsRef.current.forEach((id) => {
            const startPos = multiDragStartPositionsRef.current[id];
            if (startPos) {
              updatedPositions[id] = {
                x: startPos.x + delta.x,
                y: startPos.y + delta.y,
              };
            }
          });
        }

        if (Object.keys(updatedPositions).length > 0) {
          onNodesMove(updatedPositions);
        } else if (onNodeMove) {
          onNodeMove(draggedNodeIdRef.current, dragStartPosRef.current.x, dragStartPosRef.current.y);
        }
      } else if (onNodeMove) {
        onNodeMove(draggedNodeIdRef.current, dragStartPosRef.current.x, dragStartPosRef.current.y);
      }
    }
    
    // Sync pan state after panning ends
    if (isPanning) {
      setPan(panRef.current);
    }
    
    setIsPanning(false);
    setDraggedNode(null);
    setDragPos(null);
    setDragDelta(null);
    setMultiDraggingIds(null);
    multiDraggingRef.current = false;
    multiDraggingIdsRef.current = [];
    isDraggingRef.current = false;
    dragNodeRef.current = null;
    draggedNodeIdRef.current = null;
    groupDraggingRef.current = false;
    groupDragStartRef.current = null;
    
    if (connectingFrom) {
      setConnectingFrom(null);
    }
  }, [connectingFrom, onNodeMove, selectionBox, onMultiSelect, onNodeSelect, stopAutoPan]);

  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, block: { id: string; nodeIds: string[] }) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      console.log("[Canvas] Block mouse down:", block.id, "nodes:", block.nodeIds);

      setContextMenu(null);
      setEdgeContextMenu(null);
      setSelectedEdgeId(null);

      if (onBlockSelect) {
        onBlockSelect(block.id);
      } else if (onMultiSelect && block.nodeIds.length > 0) {
        onMultiSelect(new Set(block.nodeIds));
      }

      if (readOnly) return;

      const nodeIds = block.nodeIds.filter((id) => nodeMap.has(id));
      console.log("[Canvas] Valid node IDs:", nodeIds);
      
      if (nodeIds.length === 0) {
        console.warn("[Canvas] No valid nodes in block, cannot drag");
        return;
      }

      const primaryNode = nodeMap.get(nodeIds[0]);
      if (!primaryNode) {
        console.warn("[Canvas] Primary node not found:", nodeIds[0]);
        return;
      }

      const startPositions: Record<string, { x: number; y: number }> = {};
      nodeIds.forEach((id) => {
        const node = nodeMap.get(id);
        if (node) {
          startPositions[id] = { x: node.x, y: node.y };
        }
      });

      console.log("[Canvas] Starting block drag with", nodeIds.length, "nodes");

      setMultiDraggingIds(nodeIds);
      multiDraggingRef.current = true;
      multiDraggingIdsRef.current = nodeIds;
      multiDragStartPositionsRef.current = startPositions;
      setDragDelta({ x: 0, y: 0 });

      isDraggingRef.current = true;
      draggedNodeIdRef.current = primaryNode.id;
      setDraggedNode(primaryNode.id);
      dragOriginPosRef.current = { x: primaryNode.x, y: primaryNode.y };
      dragStartPosRef.current = { x: primaryNode.x, y: primaryNode.y };
      dragNodeRef.current = null;

      groupDraggingRef.current = true;
      groupDragStartRef.current = screenToCanvas(e.clientX, e.clientY);
    },
    [nodeMap, onBlockSelect, onMultiSelect, readOnly, screenToCanvas]
  );

  // Node handlers
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      e.preventDefault();
      e.stopPropagation();
      
      // In hand mode, start panning instead of dragging nodes
      if (canvasMode === "hand") {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
        return;
      }
      
      if (readOnly) {
        onNodeSelect(node.id);
        return;
      }
      
      // Multi-select with Shift key
      if (e.shiftKey && onMultiSelect) {
        const newSelection = new Set(selectedNodeIds);
        if (newSelection.has(node.id)) {
          newSelection.delete(node.id);
        } else {
          newSelection.add(node.id);
        }
        onMultiSelect(newSelection);
        return;
      }
      
      // Clear multi-selection on regular click if clicking a non-selected node
      if (selectedNodeIds.size > 0 && onMultiSelect && !selectedNodeIds.has(node.id)) {
        onMultiSelect(new Set());
      }
      
      onNodeSelect(node.id);
      setDraggedNode(node.id);
      isDraggingRef.current = true;
      draggedNodeIdRef.current = node.id;
      
      const nodeElement = (e.target as HTMLElement).closest('[data-node-id]') as HTMLDivElement;
      dragNodeRef.current = nodeElement;
      
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      dragOffsetRef.current = {
        x: canvasCoords.x - node.x,
        y: canvasCoords.y - node.y,
      };
      dragStartPosRef.current = { x: node.x, y: node.y };
      dragOriginPosRef.current = { x: node.x, y: node.y };

      const isMultiDrag = selectedNodeIds.size > 1 && selectedNodeIds.has(node.id);
      if (isMultiDrag) {
        const ids = Array.from(selectedNodeIds);
        setMultiDraggingIds(ids);
        multiDraggingRef.current = true;
        multiDraggingIdsRef.current = ids;
        const startPositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          if (selectedNodeIds.has(n.id)) {
            startPositions[n.id] = { x: n.x, y: n.y };
          }
        });
        multiDragStartPositionsRef.current = startPositions;
        setDragDelta({ x: 0, y: 0 });
      } else {
        setMultiDraggingIds(null);
        setDragDelta(null);
        multiDraggingRef.current = false;
        multiDraggingIdsRef.current = [];
      }
    },
    [canvasMode, pan, readOnly, onNodeSelect, screenToCanvas, onMultiSelect, selectedNodeIds, nodes]
  );

  const handleNodeConnectionStart = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      e.preventDefault();
      e.stopPropagation();
      setConnectingFrom(node.id);
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      setMousePos(canvasCoords);
    },
    [screenToCanvas]
  );

  // Inline editor submit
  const handleInlineSubmit = useCallback((data: QuickNodeData) => {
    if (!inlineEditor) return;
    
    // Convert screen position to canvas coordinates
    const canvasCoords = screenToCanvas(
      inlineEditor.x + (canvasRef.current?.getBoundingClientRect().left || 0),
      inlineEditor.y + (canvasRef.current?.getBoundingClientRect().top || 0)
    );
    
    onNodeCreate?.({
      title: data.title,
      type: data.type,
      x: canvasCoords.x - 130, // Center the node
      y: canvasCoords.y - 70,
    });
    
    setInlineEditor(null);
  }, [inlineEditor, screenToCanvas, onNodeCreate]);

  // Context menu actions
  const handleAddNodeAt = useCallback((x: number, y: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setInlineEditor({ x: x - rect.left, y: y - rect.top });
    }
  }, []);

  const handleDuplicateNode = useCallback((node: CanvasNode) => {
    onNodeCreate?.({
      ...node,
      id: undefined,
      x: node.x + 30,
      y: node.y + 30,
      title: `${node.title} (copy)`,
    });
  }, [onNodeCreate]);

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
      className={`relative w-full h-full overflow-hidden bg-neutral-50 select-none ${
        isPanning ? "cursor-grabbing" : 
        connectingFrom ? "cursor-crosshair" : 
        canvasMode === "hand" ? "cursor-grab" : 
        "cursor-default"
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      onContextMenu={(e) => handleContextMenu(e)}
      onAuxClick={(e) => e.preventDefault()}
    >
      {/* Grid Background - pointer-events-auto to capture clicks */}
      <div
        className="canvas-bg absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle, rgba(148, 163, 184, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Simplified Toolbar - just Add and Undo/Redo */}
      {!readOnly && (
        <div 
          className="absolute top-4 left-4 flex items-center gap-1 bg-white border border-neutral-200 rounded-lg shadow-sm p-1.5 z-30"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* Mode toggle buttons */}
          <button
            onClick={() => setCanvasMode("cursor")}
            className={`p-2 rounded-md transition-colors ${
              canvasMode === "cursor" 
                ? "bg-neutral-900 text-white" 
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
            title="Select mode (V) - drag to select multiple nodes"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCanvasMode("hand")}
            className={`p-2 rounded-md transition-colors ${
              canvasMode === "hand" 
                ? "bg-neutral-900 text-white" 
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
            title="Hand mode (H) - drag to pan canvas"
          >
            <Hand className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-neutral-200/80" />
          
          <button
            onClick={openInlineEditorAtCenter}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
            title="Add Node (N)"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-medium">Add</span>
          </button>
          
          {/* Commit to Document button - shown when multiple nodes selected */}
          {selectedNodeIds.size > 0 && onCommitToDocument && (
            <>
              <div className="w-px h-6 bg-neutral-200/80" />
              <button
                onClick={() => onCommitToDocument(Array.from(selectedNodeIds))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Commit selected nodes to document"
              >
                <FileText className="w-4 h-4" />
                <span className="text-xs font-medium">Commit ({selectedNodeIds.size})</span>
              </button>
            </>
          )}
          
          <div className="w-px h-6 bg-neutral-200/80" />
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-colors ${
              canUndo 
                ? "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900" 
                : "text-neutral-300 cursor-not-allowed"
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition-colors ${
              canRedo 
                ? "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900" 
                : "text-neutral-300 cursor-not-allowed"
            }`}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Help hint */}
      {!hideHelpText && (
        <div 
          className="absolute top-4 right-4 text-[11px] text-neutral-500 bg-white px-3 py-1.5 rounded-md border border-neutral-200 shadow-sm z-30"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          Double-click to add · <kbd className="font-mono">V</kbd> select · <kbd className="font-mono">H</kbd> hand · <span className="font-mono">Ctrl/Cmd+G</span> group · Right-click for menu
        </div>
      )}

      {/* Zoom Controls - moved to bottom left */}
      {!hideZoomControls && (
        <div 
          className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/80 backdrop-blur-xl rounded-full shadow-lg shadow-black/5 p-1 z-30"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="px-2 py-0.5 text-[10px] font-medium text-neutral-500 min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </div>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-700 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          
        </div>
      )}

      {/* Transform Container */}
      <div
        ref={transformContainerRef}
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: 'transform',
        }}
      >
        {/* Blocks */}
        {blockLayouts.map((block) => {
          const isSelected = selectedBlockId === block.id;
          return (
            <div
              key={block.id}
              data-block-id={block.id}
              className={`absolute rounded-2xl border-2 ${
                isSelected
                  ? "border-indigo-400 bg-indigo-50/30"
                  : "border-neutral-200/80 bg-white/30 border-dashed"
              } select-none pointer-events-none`}
              style={{
                transform: `translate3d(${block.left}px, ${block.top}px, 0)`,
                width: block.width,
                height: block.height,
              }}
            >
              <div
                className={`absolute -top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${
                  isSelected ? "bg-indigo-600 text-white" : "bg-neutral-900 text-white"
                } ${readOnly ? "" : "cursor-grab active:cursor-grabbing"} pointer-events-auto`}
                onMouseDown={(e) => {
                  // Don't trigger drag if clicking on the delete button
                  if ((e.target as HTMLElement).closest('button')) {
                    return;
                  }
                  if (!readOnly) {
                    handleBlockMouseDown(e, block);
                  }
                }}
              >
                <span className="pointer-events-none">{block.name}</span>
                {!readOnly && isSelected && onDeleteBlock && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBlock(block.id);
                    }}
                    className="ml-1 rounded-full bg-white/20 p-0.5 hover:bg-white/30 pointer-events-auto"
                    title="Ungroup"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* SVG for Edges - reduced size for better performance */}
        <svg className="absolute inset-0 w-[5000px] h-[5000px] overflow-visible" style={{ willChange: 'transform' }}>
          <defs>
            {/* Gradient for smooth edges */}
            <linearGradient id="edge-gradient-uses" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="edge-gradient-implies" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="edge-gradient-selected" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
            </linearGradient>
            
            {/* Softer arrowheads */}
            <marker
              id="arrowhead-uses"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#94a3b8" />
            </marker>
            <marker
              id="arrowhead-implies"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#6366f1" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 3 L 0 6 L 2 3 Z" fill="#f43f5e" />
            </marker>
          </defs>
          
          {edgePaths.map(({ edge, path, fromNode, toNode }) => {
            const isSelected = selectedEdgeId === edge.id;
            const strokeColor = isSelected 
              ? "url(#edge-gradient-selected)" 
              : edge.type === "implies" 
                ? "url(#edge-gradient-implies)" 
                : "url(#edge-gradient-uses)";
            const markerId = isSelected 
              ? "arrowhead-selected" 
              : edge.type === "implies" 
                ? "arrowhead-implies" 
                : "arrowhead-uses";

            return (
              <g key={edge.id} data-edge-id={edge.id} data-from-id={edge.from} data-to-id={edge.to} className="cursor-pointer">
                {/* Invisible wider path for easier clicking */}
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  className="pointer-events-auto edge-hitbox"
                  onClick={(e) => handleEdgeClick(e, edge.id)}
                  onContextMenu={(e) => handleEdgeContextMenu(e, edge.id)}
                />
                {/* Glow effect for selected edge */}
                {isSelected && (
                  <path
                    d={path}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.2"
                    className="pointer-events-none edge-glow"
                  />
                )}
                {/* Visible edge - instant response */}
                <path
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? "2.5" : "1.5"}
                  strokeLinecap="round"
                  strokeDasharray={edge.type === "references" ? "6,4" : undefined}
                  markerEnd={`url(#${markerId})`}
                  className="pointer-events-none edge-line"
                />
                {edge.label && (() => {
                  // Calculate label position at the midpoint of the bezier curve
                  const fromWidth = fromNode.width || 260;
                  const fromHeight = fromNode.height || 140;
                  const fromCenterX = fromNode.x + fromWidth / 2;
                  const fromCenterY = fromNode.y + fromHeight / 2;
                  const toCenterX = toNode.x + (toNode.width || 260) / 2;
                  const toCenterY = toNode.y + (toNode.height || 140) / 2;
                  
                  // Parse the path to get control points
                  const pathMatch = path.match(/M\s+([\d.-]+)\s+([\d.-]+)\s+C\s+([\d.-]+)\s+([\d.-]+)\s*,\s*([\d.-]+)\s+([\d.-]+)\s*,\s*([\d.-]+)\s+([\d.-]+)/);
                  if (!pathMatch) return null;
                  
                  const [, startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY] = pathMatch.map(Number);
                  
                  // Calculate midpoint of bezier curve
                  const t = 0.5;
                  const midX = Math.pow(1-t, 3) * startX +
                    3 * Math.pow(1-t, 2) * t * cp1x +
                    3 * (1-t) * Math.pow(t, 2) * cp2x +
                    Math.pow(t, 3) * endX;
                  const midY = Math.pow(1-t, 3) * startY +
                    3 * Math.pow(1-t, 2) * t * cp1y +
                    3 * (1-t) * Math.pow(t, 2) * cp2y +
                    Math.pow(t, 3) * endY;
                  
                  return (
                    <text
                      x={midX}
                      y={midY - 5}
                      fontSize="10"
                      fill="#64748b"
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      style={{ textShadow: '0px 0px 2px rgba(255,255,255,0.8)' }}
                    >
                      {edge.label}
                    </text>
                  );
                })()}
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
                {/* Connection line */}
                <path
                  d={`M ${fromX} ${fromY} L ${mousePos.x} ${mousePos.y}`}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeDasharray="6,4"
                  className="pointer-events-none"
                />
                {/* Target indicator */}
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
            isSelected={selectedNodeId === node.id || selectedNodeIds.has(node.id)}
            isMultiSelected={false}
            isDragging={draggedNode === node.id}
            isConnecting={connectingFrom === node.id}
            isNew={newNodeIds.has(node.id)}
            anchorStatus={nodeAnchorStatus?.get(node.id)}
            onMouseDown={(e: React.MouseEvent) => handleNodeMouseDown(e, node)}
            onMouseUp={(e: React.MouseEvent) => handleNodeMouseUp(e, node)}
            onDoubleClick={() => onNodeDoubleClick?.(node.id)}
            onConnectionStart={(e: React.MouseEvent) => handleNodeConnectionStart(e, node)}
            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, node)}
            onOpenComments={onOpenComments}
          />
        ))}

        {/* Collaborator Cursors */}
        {collaborators.map((collab) => (
          <div
            key={collab.id}
            className="absolute pointer-events-none transition-transform duration-75 ease-out"
            style={{ 
              transform: `translate3d(${collab.x}px, ${collab.y}px, 0)`,
            }}
          >
            {/* Cursor pointer SVG */}
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none"
              className="drop-shadow-md"
              style={{ transform: 'translate(-2px, -2px)' }}
            >
              <path
                d="M4 4L12 20L14 14L20 12L4 4Z"
                fill={collab.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            <span
              className="absolute left-5 top-5 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm"
              style={{ backgroundColor: collab.color, color: "white" }}
            >
              {collab.name}
            </span>
          </div>
        ))}
        
        {/* Selection Box */}
        {selectionBox && (
          <div
            className="absolute border-2 border-neutral-400 bg-neutral-400/10 pointer-events-none rounded"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
            }}
          />
        )}
      </div>

      {/* Minimap */}
      {!hideMinimap && (
        <div 
          className="absolute bottom-24 right-4 w-36 h-24 bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden z-30"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[9px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
            Overview
          </div>
          <div className="relative w-full h-[calc(100%-20px)] p-1">
            {minimapNodes.map((node) => (
              <div
                key={node.id}
                className="absolute rounded-full bg-neutral-300/80"
                style={{
                  left: `${node.left}%`,
                  top: `${node.top}%`,
                  width: "4px",
                  height: "4px",
                }}
              />
            ))}
            <div
              className="absolute border border-indigo-500 bg-indigo-500/10 rounded-sm"
              style={{
                left: `${minimapViewport.left}%`,
                top: `${minimapViewport.top}%`,
                width: `${minimapViewport.width}%`,
                height: `${minimapViewport.height}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Inline Node Editor */}
      {inlineEditor && (
        <InlineNodeEditor
          position={inlineEditor}
          onSubmit={handleInlineSubmit}
          onCancel={() => setInlineEditor(null)}
        />
      )}

      {/* Group Creation */}
      {groupDraft && (
        <div
          ref={groupDraftRef}
          className="absolute z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: groupDraft.x, top: groupDraft.y, transform: "translate(-50%, -50%)" }}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="w-64 rounded-lg border border-neutral-200 bg-white shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-neutral-100 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              Create group
            </div>
            <div className="p-3">
              <input
                ref={groupInputRef}
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateGroup();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelGroup();
                  }
                }}
                placeholder="Group name"
                className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
            <div className="px-3 py-2 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">
                Enter create · Esc cancel
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCancelGroup}
                  className="px-2 py-1 text-[10px] text-neutral-500 hover:text-neutral-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim()}
                  className="px-2 py-1 text-[10px] font-semibold rounded bg-indigo-600 text-white disabled:opacity-40"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          selectedCount={selectedNodeIds.size}
          onClose={() => setContextMenu(null)}
          onAddNode={handleAddNodeAt}
          onEditNode={(node) => onNodeDoubleClick?.(node.id)}
          onDeleteNode={onNodeDelete}
          onDeleteSelected={() => onMultiDelete?.(Array.from(selectedNodeIds))}
          onChangeStatus={(id, status) => onNodeUpdate?.(id, { status: status as CanvasNode["status"] })}
          onChangeType={undefined}
          onStartConnect={(id) => setConnectingFrom(id)}
          onDuplicateNode={handleDuplicateNode}
          onOpenComments={onOpenComments}
          onFitView={handleFit}
        />
      )}
      
      {/* Edge Context Menu */}
      {edgeContextMenu && (
        <div
          className="fixed z-[100] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
        >
          <div className="bg-white border border-neutral-200 rounded-xl shadow-2xl py-1 min-w-[160px] overflow-hidden">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onEdgeDelete) {
                  onEdgeDelete(edgeContextMenu.edgeId);
                }
                setEdgeContextMenu(null);
                setSelectedEdgeId(null);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-red-600 hover:bg-red-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Connection</span>
              <span className="ml-auto text-[10px] text-neutral-400">⌫</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

ProofCanvasV2.displayName = "ProofCanvasV2";
