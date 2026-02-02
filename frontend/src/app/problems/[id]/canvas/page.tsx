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
  getCanvasBlocks,
  createCanvasBlock,
  updateCanvasBlock,
  deleteCanvasBlock,
  Problem,
  LibraryItem,
  CanvasBlock,
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
import { CanvasNode, CanvasEdge, CanvasBlock as LocalCanvasBlock } from "@/components/canvas/types";
import { useCanvasHistory } from "@/hooks/useCanvasHistory";
import { useCanvasAIAnimations } from "@/hooks/useCanvasAIAnimations";

// Store positions locally (keyed by item id)
type PositionMap = Record<string, { x: number; y: number }>;

const POSITIONS_STORAGE_KEY = "proofmesh_canvas_positions";
const BLOCKS_STORAGE_KEY = "proofmesh_canvas_blocks";

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

function loadBlocks(problemId: string): CanvasBlock[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`${BLOCKS_STORAGE_KEY}_${problemId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveBlocks(problemId: string, blocks: CanvasBlock[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${BLOCKS_STORAGE_KEY}_${problemId}`, JSON.stringify(blocks));
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
  const [blocks, setBlocks] = useState<LocalCanvasBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
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

  // AI animation states for nodes - stable callbacks
  const handleNodeCreated = useCallback((node: Record<string, unknown>) => {
    // Refresh library items when AI creates a new node
    console.log("[CanvasPage] AI created node:", node);
    // TODO: Reload library items or add optimistically
  }, []);

  const handleRunCompleted = useCallback((runId: string, status: string) => {
    console.log("[CanvasPage] AI run completed:", runId, status);
  }, []);

  const { nodeAnimationStatesForCanvas, isConnected: aiWebSocketConnected } = useCanvasAIAnimations({
    problemId,
    onNodeCreated: handleNodeCreated,
    onRunCompleted: handleRunCompleted,
  });

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
      // Use backend position or calculate default
      const backendPos = item.x !== null && item.y !== null ? { x: item.x, y: item.y } : null;
      const defaultX = 150 + (index % 4) * 280;
      const defaultY = 100 + Math.floor(index / 4) * 200;

      return {
        id: item.id,
        type: item.kind,
        title: item.title,
        content: item.content,
        formula: item.formula || undefined,
        leanCode: item.lean_code || undefined,
        x: backendPos?.x ?? defaultX,
        y: backendPos?.y ?? defaultY,
        width: 260,
        height: 140,
        status: item.status as "PROPOSED" | "VERIFIED" | "REJECTED",
        dependencies: item.dependencies || [],
        authors: item.authors?.map(a => ({
          type: a.type as "human" | "agent",
          id: a.id,
          name: a.name,
          avatar_url: a.avatar_url,
        })) || [],
        agentId: item.authors?.find(a => a.type === "agent")?.id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
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
      const [problemData, libraryData, blocksData] = await Promise.all([
        getProblem(problemId),
        getLibraryItems(problemId),
        getCanvasBlocks(problemId).catch(() => []), // Fallback to empty array if API fails
      ]);
      setProblem(problemData);
      setLibraryItems(libraryData.items);
      // Convert API blocks to local format
      setBlocks(blocksData.map(b => ({
        id: b.id,
        name: b.name,
        nodeIds: b.node_ids,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      })));

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
    if (libraryItems.length === 0) return;
    const existingIds = new Set(libraryItems.map((item) => item.id));
    setBlocks((prev) => {
      let changed = false;
      const next = prev
        .map((block) => {
          const filtered = block.nodeIds.filter((id) => existingIds.has(id));
          if (filtered.length !== block.nodeIds.length) {
            changed = true;
            return { ...block, nodeIds: filtered, updatedAt: new Date().toISOString() };
          }
          return block;
        })
        .filter((block) => {
          if (block.nodeIds.length > 0) return true;
          changed = true;
          return false;
        });

      // If blocks changed, update them in the backend
      if (changed) {
        // Update each modified block in the backend
        const blocksToUpdate = next.filter(b => {
          const original = prev.find(p => p.id === b.id);
          return original && (original.nodeIds.length !== b.nodeIds.length);
        });
        
        blocksToUpdate.forEach(async (block) => {
          try {
            await updateCanvasBlock(problemId, block.id, {
              node_ids: block.nodeIds,
            });
          } catch (err) {
            console.error("Failed to update block:", err);
          }
        });
        
        if (selectedBlockId && !next.find((b) => b.id === selectedBlockId)) {
          setSelectedBlockId(null);
        }
      }
      return next;
    });
  }, [libraryItems, problemId, selectedBlockId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Register collaboration handlers for receiving real-time updates from other users
  useEffect(() => {
    if (!collaboration) return;

    collaboration.registerCallbacks({
      // When another user creates a node
      onNodeCreate: (node, fromUser) => {
        console.log(`[Collaboration] Node created by user ${fromUser}:`, node.id);
        // Fetch fresh data from backend to get the full LibraryItem
        // (the CanvasNode from WS doesn't have all fields)
        loadData();
      },

      // When another user updates a node
      onNodeUpdate: (node, fromUser) => {
        console.log(`[Collaboration] Node updated by user ${fromUser}:`, node.id);
        // Update local state optimistically for simple fields, then sync
        setLibraryItems((prev) => {
          const exists = prev.some((item) => item.id === node.id);
          if (exists) {
            return prev.map((item) =>
              item.id === node.id
                ? {
                    ...item,
                    title: node.title,
                    content: node.content || item.content,
                    status: node.status as LibraryItem["status"],
                    dependencies: node.dependencies,
                    x: node.x,
                    y: node.y,
                  }
                : item
            );
          }
          // If node doesn't exist locally, fetch fresh
          loadData();
          return prev;
        });
      },

      // When another user deletes a node
      onNodeDelete: (nodeId, fromUser) => {
        console.log(`[Collaboration] Node deleted by user ${fromUser}:`, nodeId);
        setLibraryItems((prev) => prev.filter((item) => item.id !== nodeId));
        // Clear selection if the deleted node was selected
        if (selectedNodeId === nodeId) {
          setSelectedNodeId(null);
          setDetailPanelNodeId(null);
        }
        setSelectedNodeIds((prev) => {
          if (prev.has(nodeId)) {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          }
          return prev;
        });
      },

      // When another user moves a node - update position directly for smooth animation
      onNodeMove: (nodeId, x, y, fromUser) => {
        // Update position directly via DOM for smooth movement
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
        if (nodeEl) {
          nodeEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
        
        // Also update state for consistency
        setLibraryItems((prev) =>
          prev.map((item) =>
            item.id === nodeId ? { ...item, x, y } : item
          )
        );
      },

      // When another user creates an edge
      onEdgeCreate: (edge, fromUser) => {
        console.log(`[Collaboration] Edge created by user ${fromUser}:`, edge);
        // Update dependencies in the target node
        setLibraryItems((prev) =>
          prev.map((item) => {
            if (item.id === edge.to && !item.dependencies?.includes(edge.from)) {
              return {
                ...item,
                dependencies: [...(item.dependencies || []), edge.from],
              };
            }
            return item;
          })
        );
      },

      // When another user deletes an edge
      onEdgeDelete: (from, to, fromUser) => {
        console.log(`[Collaboration] Edge deleted by user ${fromUser}:`, from, "->", to);
        // Remove dependency from the target node
        setLibraryItems((prev) =>
          prev.map((item) => {
            if (item.id === to && item.dependencies?.includes(from)) {
              return {
                ...item,
                dependencies: item.dependencies.filter((dep) => dep !== from),
              };
            }
            return item;
          })
        );
      },
    });

    return () => {
      collaboration.unregisterCallbacks();
    };
  }, [collaboration, loadData, selectedNodeId]);

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
    if (nodeId !== null) {
      setSelectedBlockId(null);
    }
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
    if (nodeIds.size > 0) {
      setSelectedBlockId(null);
    }
    // If multi-selecting, clear single selection
    if (nodeIds.size > 0) {
      setSelectedNodeId(null);
    }
  }, []);

  const handleCreateBlock = useCallback(async (name: string, nodeIdsOverride?: string[]) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nodeIds = nodeIdsOverride ?? (
      selectedNodeIds.size > 0
        ? Array.from(selectedNodeIds)
        : selectedNodeId
          ? [selectedNodeId]
          : []
    );
    if (nodeIds.length === 0) return;
    
    try {
      const apiBlock = await createCanvasBlock(problemId, {
        name: trimmed,
        node_ids: nodeIds,
      });
      
      // Convert to local format
      const newBlock: LocalCanvasBlock = {
        id: apiBlock.id,
        name: apiBlock.name,
        nodeIds: apiBlock.node_ids,
        createdAt: apiBlock.created_at,
        updatedAt: apiBlock.updated_at,
      };
      
      setBlocks((prev) => {
        const next = [newBlock, ...prev];
        return next;
      });
      setSelectedBlockId(newBlock.id);
      setSelectedNodeId(null);
      setSelectedNodeIds(new Set(nodeIds));
    } catch (err) {
      console.error("Failed to create block:", err);
    }
  }, [problemId, selectedNodeId, selectedNodeIds]);

  const handleSelectBlock = useCallback((blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    setSelectedBlockId(blockId);
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set(block.nodeIds));
  }, [blocks]);

  const handleRenameBlock = useCallback(async (blockId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    try {
      const apiBlock = await updateCanvasBlock(problemId, blockId, {
        name: trimmed,
      });
      
      // Convert to local format
      setBlocks((prev) => {
        const next = prev.map((block) =>
          block.id === blockId
            ? {
                ...block,
                name: apiBlock.name,
                updatedAt: apiBlock.updated_at,
              }
            : block
        );
        return next;
      });
    } catch (err) {
      console.error("Failed to rename block:", err);
    }
  }, [problemId]);

  const handleDeleteBlock = useCallback(async (blockId: string) => {
    try {
      await deleteCanvasBlock(problemId, blockId);
      setBlocks((prev) => {
        const next = prev.filter((block) => block.id !== blockId);
        return next;
      });
      if (selectedBlockId === blockId) {
        setSelectedBlockId(null);
      }
    } catch (err) {
      console.error("Failed to delete block:", err);
    }
  }, [problemId, selectedBlockId]);

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
    handleNodeSelect(itemId);
  }, [handleNodeSelect]);

  // Handle node movement with debounced position saving to backend
  const handleNodeMove = useCallback(
    (nodeId: string, x: number, y: number) => {
      const currentItem = libraryItems.find(item => item.id === nodeId);
      if (!currentItem) return;

      // Only update if position changed (handle null case)
      if (currentItem.x !== null && currentItem.y !== null && currentItem.x === x && currentItem.y === y) return;

      // Update local state immediately (optimistic update)
      setLibraryItems(prev =>
        prev.map(item => item.id === nodeId ? { ...item, x, y } : item)
      );

      // Debounce saving to backend
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
      }
      positionUpdateTimeout.current = setTimeout(() => {
        updateLibraryItem(problemId, nodeId, { x, y }).catch(err => {
          console.error("Failed to save position:", err);
          // Revert on error by reloading
          loadData();
        });
      }, 500);

      // Broadcast move to collaborators
      collaboration?.sendNodeMove?.(nodeId, x, y);
    },
    [problemId, collaboration, libraryItems, loadData]
  );

  const handleNodesMove = useCallback(
    (positionsUpdate: Record<string, { x: number; y: number }>) => {
      const ids = Object.keys(positionsUpdate).filter((id) => {
        const currentItem = libraryItems.find(item => item.id === id);
        if (!currentItem) return false;
        const nextPos = positionsUpdate[id];
        if (!nextPos) return false;
        // Check if position actually changed
        const currentX = currentItem.x ?? 0;
        const currentY = currentItem.y ?? 0;
        return currentX !== nextPos.x || currentY !== nextPos.y;
      });
      if (ids.length === 0) return;

      // Update local state immediately (optimistic update)
      const updatedItems = libraryItems.map(item => {
        const pos = positionsUpdate[item.id];
        if (pos && ids.includes(item.id)) {
          return { ...item, x: pos.x, y: pos.y };
        }
        return item;
      });
      setLibraryItems(updatedItems);

      // Debounce saving to backend
      if (positionUpdateTimeout.current) {
        clearTimeout(positionUpdateTimeout.current);
      }
      positionUpdateTimeout.current = setTimeout(() => {
        // Save all positions in parallel
        Promise.all(
          ids.map(id => {
            const pos = positionsUpdate[id];
            if (pos) {
              return updateLibraryItem(problemId, id, { x: pos.x, y: pos.y }).catch(err => {
                console.error(`Failed to save position for ${id}:`, err);
              });
            }
            return Promise.resolve();
          })
        ).catch(err => {
          console.error("Failed to save positions:", err);
          // Reload on error
          loadData();
        });
      }, 500);

      // Broadcast to collaborators
      ids.forEach((id) => {
        const pos = positionsUpdate[id];
        if (pos) collaboration?.sendNodeMove?.(id, pos.x, pos.y);
      });
    },
    [problemId, collaboration, libraryItems, loadData]
  );

  // Handle creating a new node
  const handleCreateNode = useCallback(
    async (data: NewNodeData) => {
      const nodePosition = data.x !== undefined && data.y !== undefined
        ? { x: data.x, y: data.y }
        : newNodePosition;

      const newItem = await createLibraryItem(problemId, {
        title: data.title,
        kind: data.type as LibraryItem["kind"],
        content: data.content,
        formula: data.formula,
        lean_code: data.leanCode,
        dependencies: data.dependencies,
        authors: data.authors,
        source: data.source,
      });

      // Record for undo/redo
      const beforeItems = [...libraryItems];
      const afterItems = [{ ...newItem, x: nodePosition.x, y: nodePosition.y }, ...beforeItems];
      const newPositions = { ...positions, [newItem.id]: nodePosition };
      recordCreate(beforeItems, afterItems, positions, newPositions, newItem.title);

      // Add to local state
      setLibraryItems(afterItems);

      // Broadcast to collaborators
      collaboration?.sendNodeCreate?.({
        id: newItem.id,
        type: newItem.kind,
        title: newItem.title,
        content: newItem.content,
        x: nodePosition.x,
        y: nodePosition.y,
        status: newItem.status,
        dependencies: newItem.dependencies || [],
      });

      // Select the new node
      setSelectedNodeId(newItem.id);
      return newItem;
    },
    [problemId, newNodePosition, collaboration, positions, libraryItems, recordCreate]
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
        const newItem = await createLibraryItem(problemId, {
          title: nodeData.title,
          kind: (nodeData.type?.toUpperCase() || "NOTE") as LibraryItem["kind"],
          content: nodeData.content || "",
          formula: nodeData.formula,
          lean_code: nodeData.leanCode,
          dependencies: nodeData.dependencies || [],
        });

        const pos = { x: nodeData.x || 300, y: nodeData.y || 200 };
        
        // Record for undo/redo
        const beforeItems = [...libraryItems];
        const afterItems = [{ ...newItem, x: pos.x, y: pos.y }, ...beforeItems];
        const newPositions = { ...positions, [newItem.id]: pos };
        recordCreate(beforeItems, afterItems, positions, newPositions, newItem.title);
        
        setLibraryItems(afterItems);

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
    [problemId, collaboration, handleOpenAddModal, positions, libraryItems, recordCreate]
  );

  // Handle quick update from context menu (type/status changes)
  const handleQuickUpdateNode = useCallback(
    async (nodeId: string, updates: Partial<CanvasNode> & { verification?: { method: string; logs: string; status: string } }) => {
      try {
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
        if (updates.verification !== undefined) {
          updateData.verification = updates.verification;
        }
        if (updates.dependencies !== undefined) {
          updateData.dependencies = updates.dependencies;
        }

        const updatedItem = await updateLibraryItem(problemId, nodeId, updateData);

        setLibraryItems((prev) => {
          const exists = prev.some((item) => item.id === nodeId);
          return exists
            ? prev.map((item) => (item.id === nodeId ? updatedItem : item))
            : [updatedItem, ...prev];
        });

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
      data: { title: string; content: string; formula?: string; leanCode?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED"; verification?: { method: string; logs: string; status: string } }
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
      if (data.verification !== undefined) {
        apiData.verification = data.verification;
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
      const afterPositions = { ...positions };
      delete afterPositions[nodeId];
      
      // Record for undo/redo
      if (deletedItem) {
        recordDelete(beforeItems, afterItems, beforePositions, afterPositions, deletedItem.title);
      }
      
      setLibraryItems(afterItems);

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
      const afterPositions = { ...positions };
      nodeIds.forEach(id => delete afterPositions[id]);
      
      // Record for undo/redo
      recordMultiDelete(beforeItems, afterItems, beforePositions, afterPositions, nodeIds.length);
      
      setLibraryItems(afterItems);

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
    setLibraryItems(prev =>
      prev.map(item => {
        const pos = nextPositions[item.id];
        return pos ? { ...item, x: pos.x, y: pos.y } : item;
      })
    );
  }, []);

  const handleUndo = useCallback(async () => {
    const result = undo();
    if (!result) return;
    const { action, state } = result;
    const targetPositions = state.positions;

    // For moves, restore positions from backend data
    if (action.type === "move") {
      await loadData();
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

    // For moves, restore positions from backend data
    if (action.type === "move") {
      await loadData();
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
  const blockSelectionCount = useMemo(() => {
    if (selectedNodeIds.size > 0) return selectedNodeIds.size;
    return selectedNodeId ? 1 : 0;
  }, [selectedNodeIds, selectedNodeId]);

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
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          selectedNodeCount={blockSelectionCount}
          onBlockSelect={handleSelectBlock}
          onCreateBlock={handleCreateBlock}
          onRenameBlock={handleRenameBlock}
          onDeleteBlock={handleDeleteBlock}
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
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onNodeSelect={handleNodeSelect}
            onMultiSelect={handleMultiSelect}
            onBlockSelect={handleSelectBlock}
            onCreateBlock={handleCreateBlock}
            onDeleteBlock={handleDeleteBlock}
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
            onCursorMove={(x, y) => {
              collaboration?.sendCursorMove?.(x, y, `canvas:${problemId}`);
            }}
            collaborators={
              collaboration?.users.map((u) => {
                // Get cursor position from the cursors Map (more up-to-date)
                const cursorPos = collaboration.cursors.get(u.user_id);
                return {
                  id: String(u.user_id),
                  name: u.display_name || u.username,
                  color: u.avatar_color,
                  x: cursorPos?.x ?? u.cursor_x ?? 0,
                  y: cursorPos?.y ?? u.cursor_y ?? 0,
                };
              }) || []
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
          onCreateNode={(data: { type: string; title: string; content: string; formula?: string; x?: number; y?: number; dependencies?: string[]; authors?: Array<{ type: "human" | "agent"; id: string; name?: string }>; source?: { file_path?: string; cell_id?: string; agent_run_id?: string } }) => handleCreateNode({ ...data, dependencies: data.dependencies || [] })}
          onUpdateNode={(nodeId: string, updates: { formula?: string; leanCode?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED"; verification?: { method: string; logs: string; status: string }; dependencies?: string[] }) => handleQuickUpdateNode(nodeId, updates)}
          onCreateBlock={handleCreateBlock}
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
