"use client";

import { useState, useCallback } from "react";
import { CanvasNode } from "@/components/canvas/types";

export interface UseEdgeInteractionOptions {
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  onEdgeCreate?: (from: string, to: string) => void;
  onEdgeDelete?: (edgeId: string) => void;
  onNodeSelect: (nodeId: string | null) => void;
}

export interface UseEdgeInteractionReturn {
  selectedEdgeId: string | null;
  connectingFrom: string | null;
  mousePos: { x: number; y: number };
  setSelectedEdgeId: (edgeId: string | null) => void;
  startConnection: (e: React.MouseEvent, node: CanvasNode) => void;
  updateConnection: (e: React.MouseEvent) => void;
  finishConnection: (targetNode?: CanvasNode) => void;
  cancelConnection: () => void;
  handleEdgeClick: (e: React.MouseEvent, edgeId: string) => void;
  deleteSelectedEdge: () => void;
}

export function useEdgeInteraction({
  screenToCanvas,
  onEdgeCreate,
  onEdgeDelete,
  onNodeSelect,
}: UseEdgeInteractionOptions): UseEdgeInteractionReturn {
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const startConnection = useCallback(
    (e: React.MouseEvent, node: CanvasNode) => {
      e.preventDefault();
      e.stopPropagation();
      setConnectingFrom(node.id);
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      setMousePos(canvasCoords);
    },
    [screenToCanvas]
  );

  const updateConnection = useCallback(
    (e: React.MouseEvent) => {
      if (!connectingFrom) return;
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      setMousePos(canvasCoords);
    },
    [connectingFrom, screenToCanvas]
  );

  const finishConnection = useCallback(
    (targetNode?: CanvasNode) => {
      if (connectingFrom && targetNode && connectingFrom !== targetNode.id && onEdgeCreate) {
        onEdgeCreate(connectingFrom, targetNode.id);
      }
      setConnectingFrom(null);
    },
    [connectingFrom, onEdgeCreate]
  );

  const cancelConnection = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  const handleEdgeClick = useCallback(
    (e: React.MouseEvent, edgeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedEdgeId(edgeId);
      onNodeSelect(null);
    },
    [onNodeSelect]
  );

  const deleteSelectedEdge = useCallback(() => {
    if (selectedEdgeId && onEdgeDelete) {
      onEdgeDelete(selectedEdgeId);
      setSelectedEdgeId(null);
    }
  }, [selectedEdgeId, onEdgeDelete]);

  return {
    selectedEdgeId,
    connectingFrom,
    mousePos,
    setSelectedEdgeId,
    startConnection,
    updateConnection,
    finishConnection,
    cancelConnection,
    handleEdgeClick,
    deleteSelectedEdge,
  };
}
