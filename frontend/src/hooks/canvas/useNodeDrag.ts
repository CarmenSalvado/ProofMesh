"use client";

import { useRef, useState, useCallback } from "react";
import { CanvasNode } from "@/components/canvas/types";

export interface DragState {
  nodeId: string | null;
  pos: { x: number; y: number } | null;
  delta: { x: number; y: number } | null;
  multiIds: string[] | null;
}

export interface UseNodeDragOptions {
  nodes: CanvasNode[];
  selectedNodeIds: Set<string>;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onNodesMove?: (positions: Record<string, { x: number; y: number }>) => void;
  readOnly?: boolean;
}

export interface UseNodeDragReturn {
  draggedNode: string | null;
  dragPos: { x: number; y: number } | null;
  dragDelta: { x: number; y: number } | null;
  multiDraggingIds: string[] | null;
  isDragging: boolean;
  startNodeDrag: (e: React.MouseEvent, node: CanvasNode) => void;
  updateNodeDrag: (e: React.MouseEvent) => void;
  finishNodeDrag: () => void;
  startBlockDrag: (
    e: React.MouseEvent,
    nodeIds: string[],
    nodeMap: Map<string, CanvasNode>
  ) => void;
  getMultiDragPositions: () => Map<string, { x: number; y: number }> | null;
  multiDragStartPositionsRef: React.RefObject<Record<string, { x: number; y: number }>>;
}

export function useNodeDrag({
  nodes,
  selectedNodeIds,
  screenToCanvas,
  onNodeMove,
  onNodesMove,
  readOnly = false,
}: UseNodeDragOptions): UseNodeDragReturn {
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null);
  const [multiDraggingIds, setMultiDraggingIds] = useState<string[] | null>(null);

  const isDraggingRef = useRef(false);
  const draggedNodeIdRef = useRef<string | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const dragOriginPosRef = useRef({ x: 0, y: 0 });
  const multiDraggingRef = useRef(false);
  const multiDraggingIdsRef = useRef<string[]>([]);
  const multiDragStartPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const groupDraggingRef = useRef(false);
  const groupDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const startNodeDrag = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      if (readOnly) return;

      setDraggedNode(node.id);
      isDraggingRef.current = true;
      draggedNodeIdRef.current = node.id;

      const nodeElement = (e.target as HTMLElement).closest("[data-node-id]") as HTMLDivElement;
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
    [readOnly, screenToCanvas, selectedNodeIds, nodes]
  );

  const startBlockDrag = useCallback(
    (e: React.MouseEvent, nodeIds: string[], nodeMap: Map<string, CanvasNode>) => {
      if (readOnly || nodeIds.length === 0) return;

      const primaryNode = nodeMap.get(nodeIds[0]);
      if (!primaryNode) return;

      const startPositions: Record<string, { x: number; y: number }> = {};
      nodeIds.forEach((id) => {
        const node = nodeMap.get(id);
        if (node) {
          startPositions[id] = { x: node.x, y: node.y };
        }
      });

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
    [readOnly, screenToCanvas]
  );

  const updateNodeDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return;

      if (groupDraggingRef.current) {
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
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
          }
          rafRef.current = requestAnimationFrame(() => {
            setDragDelta(delta);
          });
        }
        return;
      }

      if (dragNodeRef.current) {
        const canvasCoords = screenToCanvas(e.clientX, e.clientY);
        const newX = canvasCoords.x - dragOffsetRef.current.x;
        const newY = canvasCoords.y - dragOffsetRef.current.y;

        dragNodeRef.current.style.left = `${newX}px`;
        dragNodeRef.current.style.top = `${newY}px`;
        dragStartPosRef.current = { x: newX, y: newY };
        const delta = {
          x: newX - dragOriginPosRef.current.x,
          y: newY - dragOriginPosRef.current.y,
        };

        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          setDragPos({ x: newX, y: newY });
          if (multiDraggingRef.current) {
            setDragDelta(delta);
          }
        });
      }
    },
    [screenToCanvas]
  );

  const finishNodeDrag = useCallback(() => {
    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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
  }, [onNodeMove, onNodesMove]);

  const getMultiDragPositions = useCallback(() => {
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

  return {
    draggedNode,
    dragPos,
    dragDelta,
    multiDraggingIds,
    isDragging: isDraggingRef.current,
    startNodeDrag,
    updateNodeDrag,
    finishNodeDrag,
    startBlockDrag,
    getMultiDragPositions,
    multiDragStartPositionsRef,
  };
}
