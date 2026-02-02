"use client";

import { useState, useCallback } from "react";
import { CanvasNode } from "@/components/canvas/types";

export interface UseCanvasClipboardOptions {
  nodes: CanvasNode[];
  selectedNodeIds: Set<string>;
  selectedNodeId: string | null;
  onNodeCreate?: (node: Partial<CanvasNode>) => void;
  readOnly?: boolean;
}

export interface UseCanvasClipboardReturn {
  clipboard: CanvasNode[];
  copy: () => void;
  paste: (offsetX?: number, offsetY?: number) => void;
  hasClipboard: boolean;
}

export function useCanvasClipboard({
  nodes,
  selectedNodeIds,
  selectedNodeId,
  onNodeCreate,
  readOnly = false,
}: UseCanvasClipboardOptions): UseCanvasClipboardReturn {
  const [clipboard, setClipboard] = useState<CanvasNode[]>([]);

  const copy = useCallback(() => {
    const nodesToCopy: CanvasNode[] = [];
    if (selectedNodeIds.size > 0) {
      nodes.forEach((n) => {
        if (selectedNodeIds.has(n.id)) nodesToCopy.push(n);
      });
    } else if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (node) nodesToCopy.push(node);
    }
    if (nodesToCopy.length > 0) {
      setClipboard(nodesToCopy);
    }
  }, [nodes, selectedNodeIds, selectedNodeId]);

  const paste = useCallback(
    (offsetX = 40, offsetY = 40) => {
      if (readOnly || clipboard.length === 0 || !onNodeCreate) return;

      // Find bounding box of clipboard nodes
      const minX = Math.min(...clipboard.map((n) => n.x));
      const minY = Math.min(...clipboard.map((n) => n.y));

      // Create new nodes with offset
      clipboard.forEach((node, index) => {
        onNodeCreate({
          ...node,
          id: undefined,
          x: node.x - minX + offsetX + index * 10,
          y: node.y - minY + offsetY + index * 10,
          title: `${node.title} (copy)`,
        });
      });
    },
    [readOnly, clipboard, onNodeCreate]
  );

  return {
    clipboard,
    copy,
    paste,
    hasClipboard: clipboard.length > 0,
  };
}
