"use client";

import { useRef, useState, useCallback, RefObject } from "react";
import { CanvasNode } from "@/components/canvas/types";

export interface SelectionBoxState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface UseCanvasSelectionOptions {
  nodes: CanvasNode[];
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  onNodeSelect: (nodeId: string | null) => void;
  onMultiSelect?: (nodeIds: Set<string>) => void;
}

export interface UseCanvasSelectionReturn {
  selectedNodeIds: Set<string>;
  selectionBox: SelectionBoxState | null;
  isSelecting: boolean;
  setSelectedNodeIds: (ids: Set<string>) => void;
  startSelectionBox: (e: React.MouseEvent) => void;
  updateSelectionBox: (e: React.MouseEvent) => void;
  finishSelectionBox: () => void;
  toggleNodeSelection: (nodeId: string, isShift: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isSelectingRef: RefObject<boolean>;
  selectionStartRef: RefObject<{ x: number; y: number }>;
  mouseDownPosRef: RefObject<{ x: number; y: number }>;
}

export function useCanvasSelection({
  nodes,
  screenToCanvas,
  onNodeSelect,
  onMultiSelect,
}: UseCanvasSelectionOptions): UseCanvasSelectionReturn {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);

  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const selectionUpdateRef = useRef<number | null>(null);

  const startSelectionBox = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [screenToCanvas]
  );

  const updateSelectionBox = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelectingRef.current || !onMultiSelect) return;

      const canvasCoords = screenToCanvas(e.clientX, e.clientY);

      // Update selection box visual
      setSelectionBox((prev) =>
        prev
          ? {
              ...prev,
              endX: canvasCoords.x,
              endY: canvasCoords.y,
            }
          : null
      );

      // Only update selection if there's significant movement
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);

      if (dx > 3 || dy > 3) {
        // Throttle selection updates to improve performance (60fps)
        if (selectionUpdateRef.current === null) {
          selectionUpdateRef.current = requestAnimationFrame(() => {
            const startX = selectionStartRef.current.x;
            const startY = selectionStartRef.current.y;
            const minX = Math.min(startX, canvasCoords.x);
            const maxX = Math.max(startX, canvasCoords.x);
            const minY = Math.min(startY, canvasCoords.y);
            const maxY = Math.max(startY, canvasCoords.y);

            const newSelectedIds = new Set<string>();
            nodes.forEach((node) => {
              const nodeRight = node.x + (node.width || 260);
              const nodeBottom = node.y + (node.height || 140);
              if (node.x < maxX && nodeRight > minX && node.y < maxY && nodeBottom > minY) {
                newSelectedIds.add(node.id);
              }
            });
            onMultiSelect(newSelectedIds);
            setSelectedNodeIds(newSelectedIds);
            selectionUpdateRef.current = null;
          });
        }
      }
    },
    [nodes, screenToCanvas, onMultiSelect]
  );

  const finishSelectionBox = useCallback(() => {
    // Cancel any pending RAF
    if (selectionUpdateRef.current) {
      cancelAnimationFrame(selectionUpdateRef.current);
      selectionUpdateRef.current = null;
    }

    // Check if it was just a click (no significant movement)
    if (isSelectingRef.current && selectionBox) {
      const boxWidth = Math.abs(selectionBox.endX - selectionBox.startX);
      const boxHeight = Math.abs(selectionBox.endY - selectionBox.startY);

      // If the selection box is tiny (just a click), clear selection
      if (boxWidth < 5 && boxHeight < 5) {
        onMultiSelect?.(new Set());
        setSelectedNodeIds(new Set());
        onNodeSelect(null);
      }
    }

    isSelectingRef.current = false;
    setSelectionBox(null);
  }, [selectionBox, onMultiSelect, onNodeSelect]);

  const toggleNodeSelection = useCallback(
    (nodeId: string, isShift: boolean) => {
      if (isShift && onMultiSelect) {
        const newSelection = new Set(selectedNodeIds);
        if (newSelection.has(nodeId)) {
          newSelection.delete(nodeId);
        } else {
          newSelection.add(nodeId);
        }
        onMultiSelect(newSelection);
        setSelectedNodeIds(newSelection);
      } else {
        // Clear multi-selection on regular click if clicking a non-selected node
        if (selectedNodeIds.size > 0 && onMultiSelect && !selectedNodeIds.has(nodeId)) {
          onMultiSelect(new Set());
          setSelectedNodeIds(new Set());
        }
        onNodeSelect(nodeId);
      }
    },
    [selectedNodeIds, onMultiSelect, onNodeSelect]
  );

  const selectAll = useCallback(() => {
    if (onMultiSelect && nodes.length > 0) {
      const allIds = new Set(nodes.map((n) => n.id));
      onMultiSelect(allIds);
      setSelectedNodeIds(allIds);
    }
  }, [nodes, onMultiSelect]);

  const clearSelection = useCallback(() => {
    onMultiSelect?.(new Set());
    setSelectedNodeIds(new Set());
    onNodeSelect(null);
  }, [onMultiSelect, onNodeSelect]);

  return {
    selectedNodeIds,
    selectionBox,
    isSelecting: isSelectingRef.current,
    setSelectedNodeIds,
    startSelectionBox,
    updateSelectionBox,
    finishSelectionBox,
    toggleNodeSelection,
    selectAll,
    clearSelection,
    isSelectingRef,
    selectionStartRef,
    mouseDownPosRef,
  };
}
