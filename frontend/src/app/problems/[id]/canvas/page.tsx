"use client";

import { use, useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  getProblem,
  getLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  listWorkspaceContents,
  commitToDocument,
  getNodeAnchorStatus,
  Problem,
  LibraryItem,
} from "@/lib/api";
import {
  ChevronLeft,
  Share2,
  Wifi,
  WifiOff,
  Settings,
  RefreshCw,
} from "lucide-react";
import {
  CollaborationProvider,
  useOptionalCollaboration,
  PresenceAvatars,
} from "@/components/collaboration";
import { ProofCanvasV2, type ProofCanvasHandle } from "@/components/canvas/ProofCanvasV2";
import { FloatingAIBar } from "@/components/canvas/FloatingAIBar";
import { CanvasSidebar } from "@/components/canvas/CanvasSidebar";
import { AddNodeModal, NewNodeData } from "@/components/canvas/AddNodeModal";
import { CommitToDocumentModal } from "@/components/canvas/CommitToDocumentModal";
import { NodeDetailPanel } from "@/components/canvas/NodeDetailPanel";
import { CanvasNode, CanvasEdge } from "@/components/canvas/types";
import { useCanvasHistory } from "@/hooks/useCanvasHistory";

// Store positions locally (keyed by item id)
type PositionMap = Record<string, { x: number; y: number }>;

const POSITIONS_STORAGE_KEY = "proofmesh_canvas_positions";

function loadPositions(problemId: string): PositionMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(`${POSITIONS_STORAGE_KEY}_${problemId}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function savePositions(problemId: string, positions: PositionMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${POSITIONS_STORAGE_KEY}_${problemId}`, JSON.stringify(positions));
  } catch {
    // Ignore storage errors
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function CanvasPageContent({ problemId }: { problemId: string }) {
  const { user, getToken } = useAuth();
  const router = useRouter();
  const collaboration = useOptionalCollaboration();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [positions, setPositions] = useState<PositionMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [nodeAnchorStatus, setNodeAnchorStatus] = useState<Map<string, { hasAnchors: boolean; isStale: boolean; count: number }>>(new Map());
  const [aiBarVisible, setAiBarVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [detailPanelNodeId, setDetailPanelNodeId] = useState<string | null>(null);
  const [newNodePosition, setNewNodePosition] = useState({ x: 200, y: 200 });
  const positionUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<ProofCanvasHandle | null>(null);

  // History management for undo/redo
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    recordCreate,
    recordDelete,
    recordMultiDelete,
    recordUpdate,
    recordMove,
    recordEdgeChange,
  } = useCanvasHistory(libraryItems, positions);

  // Convert library items to canvas nodes
  const { nodes, edges } = useMemo(() => {
    const canvasNodes: CanvasNode[] = libraryItems.map((item, index) => {
      // Use stored position or calculate default
      const storedPos = positions[item.id];
      const defaultX = 150 + (index % 4) * 280;
      const defaultY = 100 + Math.floor(index / 4) * 200;

      return {
        id: item.id,
        type: item.kind,
        title: item.title,
        content: item.content,
        formula: item.formula || undefined,
        leanCode: item.lean_code || undefined,
        x: storedPos?.x ?? defaultX,
        y: storedPos?.y ?? defaultY,
        width: 260,
        height: 140,
        status: item.status as "PROPOSED" | "VERIFIED" | "REJECTED",
        dependencies: item.dependencies || [],
        authors: item.authors?.map(a => a.name || a.id) || [],
        agentId: item.authors?.find(a => a.type === "agent")?.id,
      };
    });

    // Create edges from dependencies
    const canvasEdges: CanvasEdge[] = [];
    libraryItems.forEach((item) => {
      (item.dependencies || []).forEach((depId) => {
        canvasEdges.push({
          id: `${depId}-${item.id}`,
          from: depId,
          to: item.id,
          type: "uses",
        });
      });
    });

    return { nodes: canvasNodes, edges: canvasEdges };
  }, [libraryItems, positions]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [problemData, libraryData] = await Promise.all([
        getProblem(problemId),
        getLibraryItems(problemId),
      ]);
      setProblem(problemData);
      setLibraryItems(libraryData.items);
      setPositions(loadPositions(problemId));

      // Load anchor status for all nodes
      if (libraryData.items.length > 0) {
        try {
          const statuses = await getNodeAnchorStatus(libraryData.items.map(i => i.id));
          const statusMap = new Map<string, { hasAnchors: boolean; isStale: boolean; count: number }>();
          for (const status of statuses) {
            statusMap.set(status.node_id, {
              hasAnchors: status.has_anchors,
              isStale: status.is_stale,
              count: status.anchor_count,
            });
          }
          setNodeAnchorStatus(statusMap);
        } catch (err) {
          console.error("Failed to load anchor status:", err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load problem");
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/problems/${problemId}/canvas`;
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch {
      console.error("Failed to copy");
    }
  }, [problemId]);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    // Clear multi-selection when single-selecting
    if (nodeId) {
      setSelectedNodeIds((prev) => {
        if (prev.size > 1 && prev.has(nodeId)) return prev;
        return new Set();
      });
    }
  }, []);

  const handleMultiSelect = useCallback((nodeIds: Set<string>) => {
    setSelectedNodeIds(nodeIds);
    // If multi-selecting, clear single selection
    if (nodeIds.size > 0) {
      setSelectedNodeId(null);
    }
  }, []);

  const handleOpenCommitModal = useCallback((nodeIds: string[]) => {
    // Add the node IDs to selection and open modal
    setSelectedNodeIds(new Set(nodeIds));
    setCommitModalOpen(true);
  }, []);

  const handleCommitToDocument = useCallback(async (data: {
    workspaceFileId: string;
    sectionTitle: string;
    format: "markdown" | "latex";
  }) => {
    if (selectedNodeIds.size === 0) return;

    try {
      const result = await commitToDocument(problemId, {
        node_ids: Array.from(selectedNodeIds),
        workspace_file_path: data.workspaceFileId, // Use path instead of UUID
        section_title: data.sectionTitle,
        format: data.format,
      });

      // Update anchor status for committed nodes
      const newStatusMap = new Map(nodeAnchorStatus);
      for (const anchor of result.anchors) {
        const existing = newStatusMap.get(anchor.library_item_id);
        newStatusMap.set(anchor.library_item_id, {
          hasAnchors: true,
          isStale: anchor.is_stale,
          count: (existing?.count || 0) + 1,
        });
      }
      setNodeAnchorStatus(newStatusMap);

      // Clear selection
      setSelectedNodeIds(new Set());
      setCommitModalOpen(false);

      // Navigate to the lab with the generated content
      router.push(`/problems/${problemId}/lab?file=${encodeURIComponent(data.workspaceFileId)}`);
    } catch (err) {
      console.error("Failed to commit to document:", err);
      throw err;
    }
  }, [problemId, selectedNodeIds, nodeAnchorStatus, router]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setDetailPanelNodeId(nodeId);
  }, []);

  const handleOpenComments = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setDetailPanelNodeId(nodeId);
  }, []);

  const handleItemClick = useCallback((itemId: string) => {
    setSelectedNodeId(itemId);
  }, []);

  // Handle node movement with debounced position saving
  const handleNodeMove = useCallback(
    (nodeId: string, x: number, y: number) => {
      const currentPos = positions[nodeId];
      if (currentPos && currentPos.x === x && currentPos.y === y) return;
      const beforePositions = positions;
      const afterPositions = { ...positions, [nodeId]: { x, y } };

      // Update local positions
      setPositions(afterPositions);

      // Debounce saving to localStorage
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
      }
      positionUpdateTimeout.current = setTimeout(() => {
        savePositions(problemId, afterPositions);
      }, 500);

      // Record history for move
      recordMove(libraryItems, libraryItems, beforePositions, afterPositions, 1);

      // Broadcast move to collaborators
      collaboration?.sendNodeMove?.(nodeId, x, y);
    },
    [problemId, collaboration, positions, recordMove, libraryItems]
  );

  const handleNodesMove = useCallback(
    (positionsUpdate: Record<string, { x: number; y: number }>) => {
      const ids = Object.keys(positionsUpdate).filter((id) => {
        const currentPos = positions[id];
        const nextPos = positionsUpdate[id];
        if (!nextPos) return false;
        return !currentPos || currentPos.x !== nextPos.x || currentPos.y !== nextPos.y;
      });
      if (ids.length === 0) return;

      const beforePositions = positions;
      const afterPositions = { ...positions };
      ids.forEach((id) => {
        afterPositions[id] = positionsUpdate[id];
      });

      setPositions(afterPositions);

      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
      }
      positionUpdateTimeout.current = setTimeout(() => {
        savePositions(problemId, afterPositions);
      }, 500);

      recordMove(libraryItems, libraryItems, beforePositions, afterPositions, ids.length);

      ids.forEach((id) => {
        const pos = positionsUpdate[id];
        if (pos) collaboration?.sendNodeMove?.(id, pos.x, pos.y);
      });
    },
    [problemId, collaboration, positions, recordMove, libraryItems]
  );

  // Handle creating a new node
  const handleCreateNode = useCallback(
    async (data: NewNodeData) => {
      const beforeItems = [...libraryItems];
      const beforePositions = { ...positions };

      const newItem = await createLibraryItem(problemId, {
        title: data.title,
        kind: data.type as LibraryItem["kind"],
        content: data.content,
        formula: data.formula,
        lean_code: data.leanCode,
        dependencies: data.dependencies,
      });

      // Add to local state
      const afterItems = [newItem, ...libraryItems];
      setLibraryItems(afterItems);

      // Set position for new node
      const afterPositions = { ...positions, [newItem.id]: newNodePosition };
      setPositions(afterPositions);
      savePositions(problemId, afterPositions);

      // Record for undo
      recordCreate(beforeItems, afterItems, beforePositions, afterPositions, newItem.title);

      // Broadcast to collaborators
      collaboration?.sendNodeCreate?.({
        id: newItem.id,
        type: newItem.kind,
        title: newItem.title,
        content: newItem.content,
        x: newNodePosition.x,
        y: newNodePosition.y,
        status: newItem.status,
        dependencies: newItem.dependencies || [],
      });

      // Select the new node
      setSelectedNodeId(newItem.id);
    },
    [problemId, newNodePosition, collaboration, libraryItems, positions, recordCreate]
  );

  // Handle opening add modal from canvas
  const handleOpenAddModal = useCallback((position?: { x: number; y: number }) => {
    if (position) {
      setNewNodePosition(position);
    } else {
      // Default position in center-ish of visible area
      setNewNodePosition({ x: 300, y: 200 });
    }
    setAddModalOpen(true);
  }, []);

  // Handle quick node creation from inline editor (no modal)
  const handleQuickCreateNode = useCallback(
    async (nodeData?: Partial<CanvasNode>) => {
      if (!nodeData?.title) {
        // If no data, open modal instead
        handleOpenAddModal(nodeData ? { x: nodeData.x || 300, y: nodeData.y || 200 } : undefined);
        return;
      }

      try {
        const beforeItems = [...libraryItems];
        const beforePositions = { ...positions };

        const newItem = await createLibraryItem(problemId, {
          title: nodeData.title,
          kind: (nodeData.type?.toUpperCase() || "NOTE") as LibraryItem["kind"],
          content: nodeData.content || "",
          formula: nodeData.formula,
          lean_code: nodeData.leanCode,
          dependencies: nodeData.dependencies || [],
        });

        const afterItems = [newItem, ...libraryItems];
        setLibraryItems(afterItems);

        const pos = { x: nodeData.x || 300, y: nodeData.y || 200 };
        const afterPositions = { ...positions, [newItem.id]: pos };
        setPositions(afterPositions);
        savePositions(problemId, afterPositions);

        // Record for undo
        recordCreate(beforeItems, afterItems, beforePositions, afterPositions, newItem.title);

        collaboration?.sendNodeCreate?.({
          id: newItem.id,
          type: newItem.kind,
          title: newItem.title,
          content: newItem.content,
          x: pos.x,
          y: pos.y,
          status: newItem.status,
          dependencies: newItem.dependencies || [],
        });

        setSelectedNodeId(newItem.id);
      } catch (err) {
        console.error("Failed to create node:", err);
      }
    },
    [problemId, collaboration, handleOpenAddModal, libraryItems, positions, recordCreate]
  );

  // Handle quick update from context menu (type/status changes)
  const handleQuickUpdateNode = useCallback(
    async (nodeId: string, updates: Partial<CanvasNode>) => {
      try {
        const currentItem = libraryItems.find((item) => item.id === nodeId);
        if (!currentItem) return;

        const updateData: Parameters<typeof updateLibraryItem>[2] = {};

        if (updates.status) {
          // Status is already uppercase from CanvasNode
          updateData.status = updates.status as "PROPOSED" | "VERIFIED" | "REJECTED";
        }
        if (updates.title) {
          updateData.title = updates.title;
        }
        if (updates.content) {
          updateData.content = updates.content;
        }
        if (updates.formula !== undefined) {
          updateData.formula = updates.formula;
        }
        if (updates.leanCode !== undefined) {
          updateData.lean_code = updates.leanCode;
        }

        const updatedItem = await updateLibraryItem(problemId, nodeId, updateData);

        setLibraryItems((prev) =>
          prev.map((item) => (item.id === nodeId ? updatedItem : item))
        );

        const pos = positions[nodeId] || { x: 200, y: 200 };
        collaboration?.sendNodeUpdate?.({
          id: updatedItem.id,
          type: updatedItem.kind,
          title: updatedItem.title,
          content: updatedItem.content,
          x: pos.x,
          y: pos.y,
          status: updatedItem.status,
          dependencies: updatedItem.dependencies || [],
        });
      } catch (err) {
        console.error("Failed to update node:", err);
      }
    },
    [problemId, libraryItems, positions, collaboration]
  );

  // Handle updating a node
  const handleUpdateNode = useCallback(
    async (
      nodeId: string,
      data: { title: string; content: string; formula?: string; leanCode?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED" }
    ) => {
      // Status is already uppercase, pass directly
      // Convert leanCode to lean_code for API
      const apiData: any = {
        title: data.title,
        content: data.content,
        formula: data.formula,
        status: data.status,
      };
      if (data.leanCode !== undefined) {
        apiData.lean_code = data.leanCode;
      }
      const updatedItem = await updateLibraryItem(problemId, nodeId, apiData);

      // Update local state
      setLibraryItems((prev) =>
        prev.map((item) => (item.id === nodeId ? updatedItem : item))
      );

      // Broadcast to collaborators
      const pos = positions[nodeId] || { x: 200, y: 200 };
      collaboration?.sendNodeUpdate?.({
        id: updatedItem.id,
        type: updatedItem.kind,
        title: updatedItem.title,
        content: updatedItem.content,
        x: pos.x,
        y: pos.y,
        status: updatedItem.status,
        dependencies: updatedItem.dependencies || [],
      });
    },
    [problemId, positions, collaboration]
  );

  // Handle deleting a node
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      const deletedItem = libraryItems.find(item => item.id === nodeId);
      const beforeItems = [...libraryItems];
      const beforePositions = { ...positions };

      await deleteLibraryItem(problemId, nodeId);

      // Remove from local state
      const afterItems = libraryItems.filter((item) => item.id !== nodeId);
      setLibraryItems(afterItems);

      const afterPositions = { ...positions };
      delete afterPositions[nodeId];
      setPositions(afterPositions);
      savePositions(problemId, afterPositions);

      // Record for undo
      if (deletedItem) {
        recordDelete(beforeItems, afterItems, beforePositions, afterPositions, deletedItem.title);
      }

      // Clear selection
      setSelectedNodeId(null);
      setDetailPanelNodeId(null);

      // Broadcast to collaborators
      collaboration?.sendNodeDelete?.(nodeId);
    },
    [problemId, collaboration, libraryItems, positions, recordDelete]
  );

  // Handle multi-delete
  const handleMultiDelete = useCallback(
    async (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;

      const beforeItems = [...libraryItems];
      const beforePositions = { ...positions };

      // Delete all in parallel
      await Promise.all(nodeIds.map(id => deleteLibraryItem(problemId, id)));

      // Update local state
      const afterItems = libraryItems.filter(item => !nodeIds.includes(item.id));
      setLibraryItems(afterItems);

      const afterPositions = { ...positions };
      nodeIds.forEach(id => delete afterPositions[id]);
      setPositions(afterPositions);
      savePositions(problemId, afterPositions);

      // Record for undo
      recordMultiDelete(beforeItems, afterItems, beforePositions, afterPositions, nodeIds.length);

      // Clear selection
      setSelectedNodeId(null);
      setSelectedNodeIds(new Set());

      // Broadcast to collaborators
      nodeIds.forEach(id => collaboration?.sendNodeDelete?.(id));
    },
    [problemId, collaboration, libraryItems, positions, recordMultiDelete]
  );

  // Handle undo
  const applyPositionsSnapshot = useCallback((nextPositions: Record<string, { x: number; y: number }>) => {
    setPositions(nextPositions);
    savePositions(problemId, nextPositions);
  }, [problemId]);

  const handleUndo = useCallback(async () => {
    const result = undo();
    if (!result) return;
    const { action, state } = result;
    const targetPositions = state.positions;

    // If it was a move, we only need to restore positions locally
    if (action.type === "move") {
      applyPositionsSnapshot(targetPositions);
      return;
    }

    // Sync with server - recreate deleted items or delete created items
    const currentIds = new Set(libraryItems.map(i => i.id));
    const targetIds = new Set(state.libraryItems.map(i => i.id));

    // Items to recreate (in target but not current)
    const toRecreate = state.libraryItems.filter(i => !currentIds.has(i.id));
    // Items to delete (in current but not target)
    const toDelete = libraryItems.filter(i => !targetIds.has(i.id));

    // Delete items that shouldn't exist
    await Promise.all(toDelete.map(item => deleteLibraryItem(problemId, item.id).catch(() => { })));

    // Recreate items that should exist
    for (const item of toRecreate) {
      try {
        await createLibraryItem(problemId, {
          title: item.title,
          kind: item.kind,
          content: item.content,
          formula: item.formula || undefined,
          dependencies: item.dependencies || [],
        });
      } catch (err) {
        console.error("Failed to recreate item during undo:", err);
      }
    }

    // Reload to sync state
    await loadData();
    applyPositionsSnapshot(targetPositions);
  }, [undo, libraryItems, problemId, loadData, applyPositionsSnapshot]);

  // Handle redo  
  const handleRedo = useCallback(async () => {
    const result = redo();
    if (!result) return;
    const { action, state } = result;
    const targetPositions = state.positions;

    if (action.type === "move") {
      applyPositionsSnapshot(targetPositions);
      return;
    }

    // Sync with server
    const currentIds = new Set(libraryItems.map(i => i.id));
    const targetIds = new Set(state.libraryItems.map(i => i.id));

    // Items to recreate
    const toRecreate = state.libraryItems.filter(i => !currentIds.has(i.id));
    // Items to delete
    const toDelete = libraryItems.filter(i => !targetIds.has(i.id));

    await Promise.all(toDelete.map(item => deleteLibraryItem(problemId, item.id).catch(() => { })));

    for (const item of toRecreate) {
      try {
        await createLibraryItem(problemId, {
          title: item.title,
          kind: item.kind,
          content: item.content,
          formula: item.formula || undefined,
          dependencies: item.dependencies || [],
        });
      } catch (err) {
        console.error("Failed to recreate item during redo:", err);
      }
    }

    await loadData();
    applyPositionsSnapshot(targetPositions);
  }, [redo, libraryItems, problemId, loadData, applyPositionsSnapshot]);

  // Handle creating an edge (dependency)
  const handleEdgeCreate = useCallback(
    async (fromId: string, toId: string) => {
      const targetItem = libraryItems.find((item) => item.id === toId);
      if (!targetItem) return;

      // Don't add duplicate dependencies
      if (targetItem.dependencies?.includes(fromId)) return;

      // Add dependency to the target item
      const newDeps = [...(targetItem.dependencies || []), fromId];

      // Update local state immediately (optimistic update)
      setLibraryItems((prev) =>
        prev.map((item) =>
          item.id === toId ? { ...item, dependencies: newDeps } : item
        )
      );

      // Persist to server in background
      updateLibraryItem(problemId, toId, { dependencies: newDeps }).catch(() => {
        // Revert on error
        setLibraryItems((prev) =>
          prev.map((item) =>
            item.id === toId ? { ...item, dependencies: targetItem.dependencies } : item
          )
        );
      });

      // Broadcast to collaborators
      collaboration?.sendEdgeCreate?.({ from: fromId, to: toId, type: "uses" });
    },
    [problemId, libraryItems, collaboration]
  );

  // Handle deleting an edge (dependency)
  const handleEdgeDelete = useCallback(
    async (edgeId: string) => {
      // Edge id format is "fromId-toId" or just find it in edges
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const targetItem = libraryItems.find((item) => item.id === edge.to);
      if (!targetItem || !targetItem.dependencies) return;

      // Remove the dependency
      const newDeps = targetItem.dependencies.filter((dep) => dep !== edge.from);

      // Update local state immediately (optimistic update)
      setLibraryItems((prev) =>
        prev.map((item) =>
          item.id === edge.to ? { ...item, dependencies: newDeps } : item
        )
      );

      // Persist to server in background
      updateLibraryItem(problemId, edge.to, { dependencies: newDeps }).catch(() => {
        // Revert on error
        setLibraryItems((prev) =>
          prev.map((item) =>
            item.id === edge.to ? { ...item, dependencies: targetItem.dependencies } : item
          )
        );
      });
    },
    [problemId, libraryItems, edges]
  );

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50 h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          <span className="text-sm text-neutral-500">Loading canvas...</span>
        </div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50 h-screen">
        <div className="text-center">
          <h1 className="text-xl font-medium text-neutral-900 mb-2">Error</h1>
          <p className="text-sm text-neutral-500 mb-4">{error || "Problem not found"}</p>
          <Link href="/dashboard" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href={`/problems/${problemId}`}
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="w-px h-6 bg-neutral-200" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">ProofMesh</span>
            <span className="text-neutral-300">/</span>
            <span className="text-sm text-neutral-400">Projects</span>
            <span className="text-neutral-300">/</span>
            <span className="text-sm font-medium text-neutral-900">{problem.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh */}
          <button
            onClick={loadData}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {collaboration?.isConnected ? (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Wifi className="w-4 h-4" />
                <span className="text-xs font-medium">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-neutral-400">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs">Offline</span>
              </div>
            )}
          </div>

          {/* Collaborators */}
          {collaboration && collaboration.users.length > 0 && (
            <PresenceAvatars maxDisplay={3} />
          )}

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            {shareStatus === "copied" ? "Copied!" : "Share"}
          </button>

          {/* Settings */}
          <button className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <CanvasSidebar
          items={libraryItems}
          selectedItemId={selectedNodeId}
          onItemClick={handleItemClick}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onAddItem={() => {
            if (canvasRef.current) {
              canvasRef.current.openInlineEditorAtCenter();
            } else {
              handleOpenAddModal();
            }
          }}
        />

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <ProofCanvasV2
            ref={canvasRef}
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            onNodeSelect={handleNodeSelect}
            onMultiSelect={handleMultiSelect}
            onNodeMove={handleNodeMove}
            onNodesMove={handleNodesMove}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeCreate={handleQuickCreateNode}
            onNodeUpdate={handleQuickUpdateNode}
            onNodeDelete={handleDeleteNode}
            onMultiDelete={handleMultiDelete}
            onEdgeCreate={handleEdgeCreate}
            onEdgeDelete={handleEdgeDelete}
            onCommitToDocument={handleOpenCommitModal}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onOpenComments={handleOpenComments}
            nodeAnchorStatus={nodeAnchorStatus}
            collaborators={
              collaboration?.users.map((u) => ({
                id: String(u.user_id),
                name: u.display_name || u.username,
                color: u.avatar_color,
                x: u.cursor_x || 0,
                y: u.cursor_y || 0,
              })) || []
            }
          />

          {/* Node Detail Panel (Edit + Comments) */}
          {detailPanelNodeId && nodes.find(n => n.id === detailPanelNodeId) && (
            <NodeDetailPanel
              node={nodes.find(n => n.id === detailPanelNodeId)!}
              problemId={problemId}
              onClose={() => setDetailPanelNodeId(null)}
              onSave={handleUpdateNode}
              onDelete={handleDeleteNode}
            />
          )}
        </div>

        {/* Floating AI Bar */}
        <FloatingAIBar
          problemId={problemId}
          selectedNode={selectedNode}
          selectedNodes={Array.from(selectedNodeIds).map(id => nodes.find(n => n.id === id)).filter(Boolean) as CanvasNode[]}
          isVisible={aiBarVisible}
          onToggle={() => setAiBarVisible(!aiBarVisible)}
          onCreateNode={(data: { type: string; title: string; content: string; formula?: string; x?: number; y?: number; dependencies?: string[] }) => handleCreateNode({ ...data, dependencies: data.dependencies || [] })}
          onUpdateNode={(nodeId: string, updates: { formula?: string; leanCode?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED" }) => handleQuickUpdateNode(nodeId, updates)}
        />
      </div>

      {/* Add Node Modal */}
      <AddNodeModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSubmit={handleCreateNode}
        existingNodes={nodes.map((n) => ({ id: n.id, title: n.title, type: n.type }))}
        defaultPosition={newNodePosition}
      />

      {/* Commit to Document Modal */}
      <CommitToDocumentModal
        isOpen={commitModalOpen}
        problemId={problemId}
        selectedNodeCount={selectedNodeIds.size}
        onClose={() => setCommitModalOpen(false)}
        onSubmit={handleCommitToDocument}
      />
    </div>
  );
}

export default function CanvasPage({ params }: PageProps) {
  const { id: problemId } = use(params);
  const { getToken, isLoading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getToken());
  }, [getToken]);

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50 h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <CollaborationProvider problemId={problemId} token={token}>
      <CanvasPageContent problemId={problemId} />
    </CollaborationProvider>
  );
}
