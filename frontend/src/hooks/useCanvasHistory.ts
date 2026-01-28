"use client";

import { useState, useCallback, useRef } from "react";
import { LibraryItem } from "@/lib/api";

interface HistoryState {
  libraryItems: LibraryItem[];
  positions: Record<string, { x: number; y: number }>;
}

interface HistoryAction {
  type: "create" | "delete" | "update" | "move" | "multi-delete" | "edge-create" | "edge-delete";
  description: string;
  undo: HistoryState;
  redo: HistoryState;
}

const MAX_HISTORY_SIZE = 50;

export function useCanvasHistory(
  initialItems: LibraryItem[],
  initialPositions: Record<string, { x: number; y: number }>
) {
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingRef = useRef(false);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const pushHistory = useCallback((action: HistoryAction) => {
    if (isUndoingRef.current) return;
    
    setHistory((prev) => {
      // Remove any future history if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(action);
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY_SIZE - 1));
  }, [historyIndex]);

  const undo = useCallback((): HistoryState | null => {
    if (!canUndo) return null;
    
    isUndoingRef.current = true;
    const action = history[historyIndex];
    setHistoryIndex((prev) => prev - 1);
    
    // Reset the flag after a tick
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
    
    return action.undo;
  }, [canUndo, history, historyIndex]);

  const redo = useCallback((): HistoryState | null => {
    if (!canRedo) return null;
    
    isUndoingRef.current = true;
    const action = history[historyIndex + 1];
    setHistoryIndex((prev) => prev + 1);
    
    // Reset the flag after a tick
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
    
    return action.redo;
  }, [canRedo, history, historyIndex]);

  const recordCreate = useCallback((
    beforeItems: LibraryItem[],
    afterItems: LibraryItem[],
    beforePositions: Record<string, { x: number; y: number }>,
    afterPositions: Record<string, { x: number; y: number }>,
    nodeTitle: string
  ) => {
    pushHistory({
      type: "create",
      description: `Create "${nodeTitle}"`,
      undo: { libraryItems: beforeItems, positions: beforePositions },
      redo: { libraryItems: afterItems, positions: afterPositions },
    });
  }, [pushHistory]);

  const recordDelete = useCallback((
    beforeItems: LibraryItem[],
    afterItems: LibraryItem[],
    beforePositions: Record<string, { x: number; y: number }>,
    afterPositions: Record<string, { x: number; y: number }>,
    nodeTitle: string
  ) => {
    pushHistory({
      type: "delete",
      description: `Delete "${nodeTitle}"`,
      undo: { libraryItems: beforeItems, positions: beforePositions },
      redo: { libraryItems: afterItems, positions: afterPositions },
    });
  }, [pushHistory]);

  const recordMultiDelete = useCallback((
    beforeItems: LibraryItem[],
    afterItems: LibraryItem[],
    beforePositions: Record<string, { x: number; y: number }>,
    afterPositions: Record<string, { x: number; y: number }>,
    count: number
  ) => {
    pushHistory({
      type: "multi-delete",
      description: `Delete ${count} nodes`,
      undo: { libraryItems: beforeItems, positions: beforePositions },
      redo: { libraryItems: afterItems, positions: afterPositions },
    });
  }, [pushHistory]);

  const recordUpdate = useCallback((
    beforeItems: LibraryItem[],
    afterItems: LibraryItem[],
    positions: Record<string, { x: number; y: number }>,
    nodeTitle: string
  ) => {
    pushHistory({
      type: "update",
      description: `Update "${nodeTitle}"`,
      undo: { libraryItems: beforeItems, positions },
      redo: { libraryItems: afterItems, positions },
    });
  }, [pushHistory]);

  const recordEdgeChange = useCallback((
    type: "edge-create" | "edge-delete",
    beforeItems: LibraryItem[],
    afterItems: LibraryItem[],
    positions: Record<string, { x: number; y: number }>
  ) => {
    pushHistory({
      type,
      description: type === "edge-create" ? "Create connection" : "Delete connection",
      undo: { libraryItems: beforeItems, positions },
      redo: { libraryItems: afterItems, positions },
    });
  }, [pushHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    recordCreate,
    recordDelete,
    recordMultiDelete,
    recordUpdate,
    recordEdgeChange,
    clearHistory,
    historyLength: history.length,
    currentIndex: historyIndex,
  };
}
