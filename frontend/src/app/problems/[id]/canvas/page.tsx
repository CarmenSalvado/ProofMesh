"use client";

import { use, useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getProblem,
  getLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
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
import { ProofCanvasV2 } from "@/components/canvas/ProofCanvasV2";
import { AgentIntelligencePanel } from "@/components/canvas/AgentIntelligencePanel";
import { CanvasSidebar } from "@/components/canvas/CanvasSidebar";
import { AddNodeModal, NewNodeData } from "@/components/canvas/AddNodeModal";
import { EditNodeModal } from "@/components/canvas/EditNodeModal";
import { CanvasNode, CanvasEdge } from "@/components/canvas/types";

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
  const collaboration = useOptionalCollaboration();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [positions, setPositions] = useState<PositionMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [agentPanelCollapsed, setAgentPanelCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newNodePosition, setNewNodePosition] = useState({ x: 200, y: 200 });
  const positionUpdateTimeout = useRef<NodeJS.Timeout | null>(null);

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
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setEditModalOpen(true);
  }, []);

  const handleItemClick = useCallback((itemId: string) => {
    setSelectedNodeId(itemId);
  }, []);

  // Handle node movement with debounced position saving
  const handleNodeMove = useCallback(
    (nodeId: string, x: number, y: number) => {
      setPositions((prev) => {
        const next = { ...prev, [nodeId]: { x, y } };

        // Debounce saving to localStorage
        if (positionUpdateTimeout.current) {
          clearTimeout(positionUpdateTimeout.current);
        }
        positionUpdateTimeout.current = setTimeout(() => {
          savePositions(problemId, next);
        }, 500);

        return next;
      });

      // Broadcast move to collaborators
      collaboration?.sendNodeMove?.(nodeId, x, y);
    },
    [problemId, collaboration]
  );

  // Handle creating a new node
  const handleCreateNode = useCallback(
    async (data: NewNodeData) => {
      const newItem = await createLibraryItem(problemId, {
        title: data.title,
        kind: data.type as LibraryItem["kind"],
        content: data.content,
        formula: data.formula,
        dependencies: data.dependencies,
      });

      // Add to local state
      setLibraryItems((prev) => [newItem, ...prev]);

      // Set position for new node
      setPositions((prev) => {
        const next = { ...prev, [newItem.id]: newNodePosition };
        savePositions(problemId, next);
        return next;
      });

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
    [problemId, newNodePosition, collaboration]
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

  // Handle updating a node
  const handleUpdateNode = useCallback(
    async (
      nodeId: string,
      data: { title: string; content: string; formula?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED" }
    ) => {
      const updatedItem = await updateLibraryItem(problemId, nodeId, data);

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
      await deleteLibraryItem(problemId, nodeId);

      // Remove from local state
      setLibraryItems((prev) => prev.filter((item) => item.id !== nodeId));
      setPositions((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        savePositions(problemId, next);
        return next;
      });

      // Clear selection
      setSelectedNodeId(null);
      setEditModalOpen(false);

      // Broadcast to collaborators
      collaboration?.sendNodeDelete?.(nodeId);
    },
    [problemId, collaboration]
  );

  // Handle creating an edge (dependency)
  const handleEdgeCreate = useCallback(
    async (fromId: string, toId: string) => {
      const targetItem = libraryItems.find((item) => item.id === toId);
      if (!targetItem) return;

      // Don't add duplicate dependencies
      if (targetItem.dependencies?.includes(fromId)) return;

      // Add dependency to the target item
      const newDeps = [...(targetItem.dependencies || []), fromId];
      await updateLibraryItem(problemId, toId, { dependencies: newDeps });

      // Reload to get updated dependencies
      loadData();

      // Broadcast to collaborators
      collaboration?.sendEdgeCreate?.({ from: fromId, to: toId, type: "uses" });
    },
    [problemId, libraryItems, loadData, collaboration]
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
          onAddItem={() => handleOpenAddModal()}
        />

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <ProofCanvasV2
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onNodeSelect={handleNodeSelect}
            onNodeMove={handleNodeMove}
            onNodeDoubleClick={handleNodeDoubleClick}
            onNodeCreate={() => handleOpenAddModal()}
            onEdgeCreate={handleEdgeCreate}
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
        </div>

        {/* Right Panel - Agent Intelligence */}
        <AgentIntelligencePanel
          selectedNode={selectedNode}
          collaboratorCount={collaboration?.users.length || 0}
          isConnected={collaboration?.isConnected || false}
          collapsed={agentPanelCollapsed}
          onToggle={() => setAgentPanelCollapsed(!agentPanelCollapsed)}
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

      {/* Edit Node Modal */}
      <EditNodeModal
        node={selectedNode}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleUpdateNode}
        onDelete={handleDeleteNode}
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
