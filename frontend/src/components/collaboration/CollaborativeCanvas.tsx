/**
 * @deprecated This component uses the legacy ProofCanvas. 
 * Collaboration is now handled directly in the canvas page with ProofCanvasV2.
 * See /app/problems/[id]/canvas/page.tsx for the current implementation.
 * This file will be removed in a future version.
 */
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ProofCanvas, CanvasNode, CanvasEdge, Collaborator } from "@/components/canvas/ProofCanvas";
import { useOptionalCollaboration, UserPresence, CanvasNode as CollabCanvasNode, CanvasEdge as CollabCanvasEdge } from "@/components/collaboration";

interface CollaborativeCanvasProps {
  problemId: string;
  initialNodes?: CanvasNode[];
  initialEdges?: CanvasEdge[];
  readOnly?: boolean;
  onNodeSelect?: (node: CanvasNode) => void;
}

// Convert UserPresence to Collaborator for ProofCanvas
function presenceToCollaborator(presence: UserPresence): Collaborator | null {
  if (presence.cursor_x === undefined || presence.cursor_y === undefined) {
    return null;
  }
  return {
    id: String(presence.user_id),
    name: presence.display_name || presence.username,
    color: presence.avatar_color,
    x: presence.cursor_x,
    y: presence.cursor_y,
  };
}

// Convert between canvas node types
function toLocalNode(node: CollabCanvasNode): CanvasNode {
  return {
    id: node.id,
    type: node.type as CanvasNode["type"],
    title: node.title,
    content: node.content,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    status: node.status as CanvasNode["status"],
    dependencies: node.dependencies,
  };
}

function toCollabNode(node: CanvasNode): CollabCanvasNode {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    content: node.content,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    status: node.status,
    dependencies: node.dependencies || [],
  };
}

export function CollaborativeCanvas({
  problemId,
  initialNodes = [],
  initialEdges = [],
  readOnly = false,
  onNodeSelect,
}: CollaborativeCanvasProps) {
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes);
  const [edges, setEdges] = useState<CanvasEdge[]>(initialEdges);
  const collaboration = useOptionalCollaboration();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Convert presence to collaborators
  const collaborators: Collaborator[] = [];
  if (collaboration) {
    collaboration.users.forEach((user) => {
      const collab = presenceToCollaborator(user);
      if (collab) {
        collaborators.push(collab);
      }
    });
  }

  // Handle cursor movement on canvas
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!collaboration?.isConnected || !canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      collaboration.sendCursorMove(x, y);
    },
    [collaboration]
  );

  // Node operations with collaboration sync
  const handleNodeCreate = useCallback(
    (type: CanvasNode["type"], x: number, y: number) => {
      const newNode: CanvasNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        title: `New ${type}`,
        x,
        y,
        status: "draft",
        dependencies: [],
      };
      
      setNodes((prev) => [...prev, newNode]);
      
      // Sync to collaborators
      if (collaboration?.isConnected) {
        collaboration.sendNodeCreate(toCollabNode(newNode));
      }
    },
    [collaboration]
  );

  const handleNodeMove = useCallback(
    (nodeId: string, x: number, y: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
      );
      
      // Sync to collaborators
      if (collaboration?.isConnected) {
        collaboration.sendNodeMove(nodeId, x, y);
      }
    },
    [collaboration]
  );

  const handleEdgeCreate = useCallback(
    (from: string, to: string) => {
      const newEdge: CanvasEdge = {
        from,
        to,
        type: "implies",
      };
      
      setEdges((prev) => [...prev, newEdge]);
      
      // Sync to collaborators
      if (collaboration?.isConnected) {
        collaboration.sendEdgeCreate({ from, to, type: "implies" });
      }
    },
    [collaboration]
  );

  // Listen for remote changes
  useEffect(() => {
    if (!collaboration) return;

    // Remote node created
    const handleRemoteNodeCreate = (node: CollabCanvasNode) => {
      setNodes((prev) => {
        if (prev.some((n) => n.id === node.id)) return prev;
        return [...prev, toLocalNode(node)];
      });
    };

    // Remote node moved
    const handleRemoteNodeMove = (nodeId: string, x: number, y: number) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
      );
    };

    // Remote node deleted
    const handleRemoteNodeDelete = (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.from !== nodeId && e.to !== nodeId));
    };

    // Remote edge created
    const handleRemoteEdgeCreate = (edge: CollabCanvasEdge) => {
      setEdges((prev) => {
        if (prev.some((e) => e.from === edge.from && e.to === edge.to)) return prev;
        return [...prev, { from: edge.from, to: edge.to, type: edge.type as CanvasEdge["type"] }];
      });
    };

    // Remote canvas sync
    const handleRemoteCanvasSync = (
      remoteNodes: CollabCanvasNode[],
      remoteEdges: CollabCanvasEdge[]
    ) => {
      setNodes(remoteNodes.map(toLocalNode));
      setEdges(
        remoteEdges.map((e) => ({
          from: e.from,
          to: e.to,
          type: e.type as CanvasEdge["type"],
        }))
      );
    };

    // These will be called via the CollaborationProvider callbacks
    // For now, sync full state on connection
    if (collaboration.isConnected && nodes.length > 0) {
      collaboration.sendCanvasSync(
        nodes.map(toCollabNode),
        edges.map((e) => ({ from: e.from, to: e.to, type: e.type }))
      );
    }
  }, [collaboration?.isConnected]);

  return (
    <div
      ref={canvasRef}
      className="w-full h-full"
      onMouseMove={handleCanvasMouseMove}
    >
      <ProofCanvas
        nodes={nodes}
        edges={edges}
        collaborators={collaborators}
        onNodeSelect={onNodeSelect}
        onNodeCreate={readOnly ? undefined : handleNodeCreate}
        onNodeMove={readOnly ? undefined : handleNodeMove}
        onEdgeCreate={readOnly ? undefined : handleEdgeCreate}
        readOnly={readOnly}
      />
    </div>
  );
}
