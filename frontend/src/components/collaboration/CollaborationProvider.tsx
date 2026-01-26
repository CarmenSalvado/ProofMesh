"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  useCollaboration,
  UserPresence,
  CanvasNode,
  CanvasEdge,
  MessageType,
} from "@/hooks/useCollaboration";

export { MessageType };
export type { UserPresence, CanvasNode, CanvasEdge };

interface CollaborationContextValue {
  // Connection state
  isConnected: boolean;
  error: string | null;
  
  // Presence
  users: UserPresence[];
  cursors: Map<number, { x: number; y: number; file?: string }>;
  selections: Map<number, { start: number; end: number; file?: string }>;
  
  // Helpers
  getUserById: (userId: number) => UserPresence | undefined;
  
  // Send functions
  sendCursorMove: (x: number, y: number, filePath?: string) => void;
  sendSelection: (start: number | null, end: number | null, filePath?: string) => void;
  sendDocumentSync: (path: string, content: string) => void;
  sendDocumentEdit: (edit: {
    path: string;
    operation: string;
    position: number;
    text?: string;
    length?: number;
  }) => void;
  sendCanvasSync: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  sendNodeCreate: (node: CanvasNode) => void;
  sendNodeUpdate: (node: CanvasNode) => void;
  sendNodeDelete: (nodeId: string) => void;
  sendNodeMove: (nodeId: string, x: number, y: number) => void;
  sendEdgeCreate: (edge: { from: string; to: string; type?: string }) => void;
  sendEdgeDelete: (from: string, to: string) => void;
  
  // Reconnect
  reconnect: () => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

interface CollaborationProviderProps {
  children: ReactNode;
  problemId: string;
  token: string | null;
  onDocumentSync?: (path: string, content: string, fromUser: number) => void;
  onDocumentEdit?: (
    edit: { path: string; operation: string; position: number; text?: string; length?: number },
    fromUser: number
  ) => void;
  onCanvasSync?: (nodes: CanvasNode[], edges: CanvasEdge[], fromUser: number) => void;
  onNodeCreate?: (node: CanvasNode, fromUser: number) => void;
  onNodeUpdate?: (node: CanvasNode, fromUser: number) => void;
  onNodeDelete?: (nodeId: string, fromUser: number) => void;
  onNodeMove?: (nodeId: string, x: number, y: number, fromUser: number) => void;
  onEdgeCreate?: (edge: CanvasEdge, fromUser: number) => void;
  onEdgeDelete?: (from: string, to: string, fromUser: number) => void;
}

export function CollaborationProvider({
  children,
  problemId,
  token,
  onDocumentSync,
  onDocumentEdit,
  onCanvasSync,
  onNodeCreate,
  onNodeUpdate,
  onNodeDelete,
  onNodeMove,
  onEdgeCreate,
  onEdgeDelete,
}: CollaborationProviderProps) {
  const collaboration = useCollaboration({
    problemId,
    token,
    onDocumentSync,
    onDocumentEdit,
    onCanvasSync,
    onNodeCreate,
    onNodeUpdate,
    onNodeDelete,
    onNodeMove,
    onEdgeCreate,
    onEdgeDelete,
  });

  return (
    <CollaborationContext.Provider value={collaboration}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaborationContext(): CollaborationContextValue {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error("useCollaborationContext must be used within a CollaborationProvider");
  }
  return context;
}

// Optional hook that returns null if not in provider (for optional collaboration)
export function useOptionalCollaboration(): CollaborationContextValue | null {
  return useContext(CollaborationContext);
}
