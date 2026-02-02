"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useRef,
  useCallback,
  useEffect,
  useState,
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

// Callback types for collaboration events
export interface CollaborationCallbacks {
  onNodeCreate?: (node: CanvasNode, fromUser: number) => void;
  onNodeUpdate?: (node: CanvasNode, fromUser: number) => void;
  onNodeDelete?: (nodeId: string, fromUser: number) => void;
  onNodeMove?: (nodeId: string, x: number, y: number, fromUser: number) => void;
  onEdgeCreate?: (edge: CanvasEdge, fromUser: number) => void;
  onEdgeDelete?: (from: string, to: string, fromUser: number) => void;
  onCanvasSync?: (nodes: CanvasNode[], edges: CanvasEdge[], fromUser: number) => void;
  onDocumentSync?: (path: string, content: string, fromUser: number) => void;
  onDocumentEdit?: (edit: { path: string; operation: string; position: number; text?: string; length?: number }, fromUser: number) => void;
}

interface CollaborationContextValue {
  // Connection state
  isConnected: boolean;
  error: string | null;
  
  // Presence
  users: UserPresence[];
  cursors: Map<string | number, { x: number; y: number; file?: string }>;
  selections: Map<string | number, { start: number; end: number; file?: string }>;
  
  // Helpers
  getUserById: (userId: string | number) => UserPresence | undefined;
  
  // Register callbacks dynamically (for components that need to receive collaboration events)
  registerCallbacks: (callbacks: CollaborationCallbacks) => void;
  unregisterCallbacks: () => void;
  
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
}

export function CollaborationProvider({
  children,
  problemId,
  token,
}: CollaborationProviderProps) {
  // Use refs for dynamic callback registration
  const callbacksRef = useRef<CollaborationCallbacks>({});
  const [, forceUpdate] = useState(0);

  // Wrap callbacks to use ref
  const onNodeCreate = useCallback((node: CanvasNode, fromUser: number) => {
    callbacksRef.current.onNodeCreate?.(node, fromUser);
  }, []);

  const onNodeUpdate = useCallback((node: CanvasNode, fromUser: number) => {
    callbacksRef.current.onNodeUpdate?.(node, fromUser);
  }, []);

  const onNodeDelete = useCallback((nodeId: string, fromUser: number) => {
    callbacksRef.current.onNodeDelete?.(nodeId, fromUser);
  }, []);

  const onNodeMove = useCallback((nodeId: string, x: number, y: number, fromUser: number) => {
    callbacksRef.current.onNodeMove?.(nodeId, x, y, fromUser);
  }, []);

  const onEdgeCreate = useCallback((edge: CanvasEdge, fromUser: number) => {
    callbacksRef.current.onEdgeCreate?.(edge, fromUser);
  }, []);

  const onEdgeDelete = useCallback((from: string, to: string, fromUser: number) => {
    callbacksRef.current.onEdgeDelete?.(from, to, fromUser);
  }, []);

  const onCanvasSync = useCallback((nodes: CanvasNode[], edges: CanvasEdge[], fromUser: number) => {
    callbacksRef.current.onCanvasSync?.(nodes, edges, fromUser);
  }, []);

  const onDocumentSync = useCallback((path: string, content: string, fromUser: number) => {
    callbacksRef.current.onDocumentSync?.(path, content, fromUser);
  }, []);

  const onDocumentEdit = useCallback((edit: { path: string; operation: string; position: number; text?: string; length?: number }, fromUser: number) => {
    callbacksRef.current.onDocumentEdit?.(edit, fromUser);
  }, []);

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

  // Register callbacks dynamically
  const registerCallbacks = useCallback((callbacks: CollaborationCallbacks) => {
    callbacksRef.current = { ...callbacksRef.current, ...callbacks };
  }, []);

  const unregisterCallbacks = useCallback(() => {
    callbacksRef.current = {};
  }, []);

  const contextValue: CollaborationContextValue = {
    ...collaboration,
    registerCallbacks,
    unregisterCallbacks,
  };

  return (
    <CollaborationContext.Provider value={contextValue}>
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
