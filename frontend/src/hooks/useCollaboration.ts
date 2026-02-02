/**
 * useCollaboration - Real-time collaboration hook for ProofMesh workspaces
 */

import { useEffect, useRef, useState, useCallback } from "react";

// Message types matching backend
export enum MessageType {
  JOIN = "join",
  LEAVE = "leave",
  PRESENCE = "presence",
  CURSOR_MOVE = "cursor_move",
  SELECTION = "selection",
  DOC_SYNC = "doc_sync",
  DOC_EDIT = "doc_edit",
  DOC_SAVE = "doc_save",
  CANVAS_SYNC = "canvas_sync",
  NODE_CREATE = "node_create",
  NODE_UPDATE = "node_update",
  NODE_DELETE = "node_delete",
  NODE_MOVE = "node_move",
  EDGE_CREATE = "edge_create",
  EDGE_DELETE = "edge_delete",
  ERROR = "error",
  ACK = "ack",
}

export interface UserPresence {
  user_id: string | number;  // Backend sends string, but we handle both
  username: string;
  display_name?: string;
  avatar_color: string;
  cursor_x?: number;
  cursor_y?: number;
  selection_start?: number;
  selection_end?: number;
  active_file?: string;
  last_active: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  char_pos?: number;
  line?: number;
  column?: number;
}

export interface CanvasNode {
  id: string;
  type: string;
  title: string;
  content?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  status: string;
  dependencies: string[];
}

export interface CanvasEdge {
  from: string;
  to: string;
  type: string;
}

export interface CollaborationMessage {
  type: MessageType;
  [key: string]: unknown;
}

interface UseCollaborationOptions {
  problemId: string;
  token: string | null;
  onDocumentSync?: (path: string, content: string, fromUser: number) => void;
  onDocumentEdit?: (edit: { path: string; operation: string; position: number; text?: string; length?: number }, fromUser: number) => void;
  onCanvasSync?: (nodes: CanvasNode[], edges: CanvasEdge[], fromUser: number) => void;
  onNodeCreate?: (node: CanvasNode, fromUser: number) => void;
  onNodeUpdate?: (node: CanvasNode, fromUser: number) => void;
  onNodeDelete?: (nodeId: string, fromUser: number) => void;
  onNodeMove?: (nodeId: string, x: number, y: number, fromUser: number) => void;
  onEdgeCreate?: (edge: CanvasEdge, fromUser: number) => void;
  onEdgeDelete?: (from: string, to: string, fromUser: number) => void;
}

export function useCollaboration({
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
}: UseCollaborationOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [cursors, setCursors] = useState<Map<string | number, { x: number; y: number; file?: string }>>(new Map());
  const [selections, setSelections] = useState<Map<string | number, { start: number; end: number; file?: string }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isMountedRef = useRef(false);
  
  // Callback refs to avoid stale closures
  const onDocumentSyncRef = useRef(onDocumentSync);
  const onDocumentEditRef = useRef(onDocumentEdit);
  const onCanvasSyncRef = useRef(onCanvasSync);
  const onNodeCreateRef = useRef(onNodeCreate);
  const onNodeUpdateRef = useRef(onNodeUpdate);
  const onNodeDeleteRef = useRef(onNodeDelete);
  const onNodeMoveRef = useRef(onNodeMove);
  const onEdgeCreateRef = useRef(onEdgeCreate);
  const onEdgeDeleteRef = useRef(onEdgeDelete);
  
  useEffect(() => {
    onDocumentSyncRef.current = onDocumentSync;
    onDocumentEditRef.current = onDocumentEdit;
    onCanvasSyncRef.current = onCanvasSync;
    onNodeCreateRef.current = onNodeCreate;
    onNodeUpdateRef.current = onNodeUpdate;
    onNodeDeleteRef.current = onNodeDelete;
    onNodeMoveRef.current = onNodeMove;
    onEdgeCreateRef.current = onEdgeCreate;
    onEdgeDeleteRef.current = onEdgeDelete;
  }, [onDocumentSync, onDocumentEdit, onCanvasSync, onNodeCreate, onNodeUpdate, onNodeDelete, onNodeMove, onEdgeCreate, onEdgeDelete]);

  const connect = useCallback(() => {
    if (!token || !problemId) return;
    if (!isMountedRef.current) return;
    
    // Don't create a new connection if already connected or connecting
    if (wsRef.current && 
        (wsRef.current.readyState === WebSocket.OPEN || 
         wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiHost = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") || "localhost:8080";
    const wsUrl = `${wsProtocol}//${apiHost}/ws/collaborate/${problemId}?token=${token}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      if (!isMountedRef.current) {
        ws.close(1000, "Component unmounted during connection");
        return;
      }
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };
    
    ws.onclose = (event) => {
      setIsConnected(false);
      wsRef.current = null;
      
      // Attempt reconnection if not intentional close and still mounted
      if (event.code !== 1000 && isMountedRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          connect();
        }, delay);
      }
    };
    
    ws.onerror = () => {
      setError("Connection error");
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as CollaborationMessage;
        handleMessage(message);
      } catch (err) {
        console.error("Failed to parse collaboration message:", err);
      }
    };
  }, [token, problemId]);

  const handleMessage = useCallback((message: CollaborationMessage) => {
    switch (message.type) {
      case MessageType.PRESENCE:
        setUsers((message.users as UserPresence[]) || []);
        break;
        
      case MessageType.CURSOR_MOVE:
        setCursors((prev) => {
          const next = new Map(prev);
          const userId = message.user_id as string | number;
          next.set(userId, {
            x: message.cursor_x as number,
            y: message.cursor_y as number,
            file: message.active_file as string | undefined,
          });
          return next;
        });
        break;
        
      case MessageType.SELECTION:
        setSelections((prev) => {
          const next = new Map(prev);
          const userId = message.user_id as string | number;
          if (message.selection_start !== undefined && message.selection_end !== undefined) {
            next.set(userId, {
              start: message.selection_start as number,
              end: message.selection_end as number,
              file: message.active_file as string | undefined,
            });
          } else {
            next.delete(userId);
          }
          return next;
        });
        break;
        
      case MessageType.DOC_SYNC:
        onDocumentSyncRef.current?.(
          message.path as string,
          message.content as string,
          message.from_user as number
        );
        break;
        
      case MessageType.DOC_EDIT:
        onDocumentEditRef.current?.(
          message.edit as { path: string; operation: string; position: number; text?: string; length?: number },
          message.from_user as number
        );
        break;
        
      case MessageType.CANVAS_SYNC:
        onCanvasSyncRef.current?.(
          message.nodes as CanvasNode[],
          message.edges as CanvasEdge[],
          message.from_user as number
        );
        break;
        
      case MessageType.NODE_CREATE:
        onNodeCreateRef.current?.(
          message.node as CanvasNode,
          message.from_user as number
        );
        break;
        
      case MessageType.NODE_UPDATE:
        onNodeUpdateRef.current?.(
          message.node as CanvasNode,
          message.from_user as number
        );
        break;
        
      case MessageType.NODE_DELETE:
        onNodeDeleteRef.current?.(
          message.node_id as string,
          message.from_user as number
        );
        break;
        
      case MessageType.NODE_MOVE:
        onNodeMoveRef.current?.(
          message.node_id as string,
          message.x as number,
          message.y as number,
          message.from_user as number
        );
        break;
        
      case MessageType.EDGE_CREATE:
        onEdgeCreateRef.current?.(
          message.edge as CanvasEdge,
          message.from_user as number
        );
        break;
        
      case MessageType.EDGE_DELETE:
        onEdgeDeleteRef.current?.(
          message.from as string,
          message.to as string,
          message.from_user as number
        );
        break;
        
      case MessageType.ERROR:
        setError(message.message as string);
        break;
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Small delay to avoid React Strict Mode race condition
    const connectTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, 50);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(connectTimeout);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Only close if actually connected or connecting
        if (wsRef.current.readyState === WebSocket.OPEN || 
            wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close(1000, "Component unmounting");
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Send functions
  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendCursorMove = useCallback((x: number, y: number, filePath?: string) => {
    send({
      type: MessageType.CURSOR_MOVE,
      x,
      y,
      file_path: filePath,
    });
  }, [send]);

  const sendSelection = useCallback((start: number | null, end: number | null, filePath?: string) => {
    send({
      type: MessageType.SELECTION,
      start,
      end,
      file_path: filePath,
    });
  }, [send]);

  const sendDocumentSync = useCallback((path: string, content: string) => {
    send({
      type: MessageType.DOC_SYNC,
      path,
      content,
    });
  }, [send]);

  const sendDocumentEdit = useCallback((edit: {
    path: string;
    operation: string;
    position: number;
    text?: string;
    length?: number;
  }) => {
    send({
      type: MessageType.DOC_EDIT,
      edit,
    });
  }, [send]);

  const sendCanvasSync = useCallback((nodes: CanvasNode[], edges: CanvasEdge[]) => {
    send({
      type: MessageType.CANVAS_SYNC,
      nodes,
      edges,
    });
  }, [send]);

  const sendNodeCreate = useCallback((node: CanvasNode) => {
    send({
      type: MessageType.NODE_CREATE,
      node,
    });
  }, [send]);

  const sendNodeUpdate = useCallback((node: CanvasNode) => {
    send({
      type: MessageType.NODE_UPDATE,
      node,
    });
  }, [send]);

  const sendNodeDelete = useCallback((nodeId: string) => {
    send({
      type: MessageType.NODE_DELETE,
      node_id: nodeId,
    });
  }, [send]);

  const sendNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    send({
      type: MessageType.NODE_MOVE,
      node_id: nodeId,
      x,
      y,
    });
  }, [send]);

  const sendEdgeCreate = useCallback((edge: { from: string; to: string; type?: string }) => {
    send({
      type: MessageType.EDGE_CREATE,
      edge,
    });
  }, [send]);

  const sendEdgeDelete = useCallback((from: string, to: string) => {
    send({
      type: MessageType.EDGE_DELETE,
      from,
      to,
    });
  }, [send]);

  // Get user by ID helper
  const getUserById = useCallback((userId: string | number): UserPresence | undefined => {
    return users.find((u) => String(u.user_id) === String(userId));
  }, [users]);

  return {
    // State
    isConnected,
    users,
    cursors,
    selections,
    error,
    
    // Helpers
    getUserById,
    
    // Send functions
    sendCursorMove,
    sendSelection,
    sendDocumentSync,
    sendDocumentEdit,
    sendCanvasSync,
    sendNodeCreate,
    sendNodeUpdate,
    sendNodeDelete,
    sendNodeMove,
    sendEdgeCreate,
    sendEdgeDelete,
    
    // Reconnect
    reconnect: connect,
  };
}
