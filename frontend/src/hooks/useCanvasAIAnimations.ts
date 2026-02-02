"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { NodeStateType, CanvasAIEvent } from "@/lib/types";
import { connectCanvasAIWebSocket } from "@/lib/api";
import type { NodeAnimationState as ComponentAnimationState } from "@/components/canvas";

export interface NodeAnimationState {
  nodeId: string | null;
  tempNodeId: string | null;
  state: NodeStateType;
  message?: string;
  progress?: number;
  expiresAt?: number;
}

// Convert from API state type to component animation state
function stateTypeToAnimationState(state: NodeStateType): ComponentAnimationState {
  switch (state) {
    case NodeStateType.THINKING:
      return "thinking";
    case NodeStateType.GENERATING:
      return "generating";
    case NodeStateType.VERIFYING:
      return "verifying";
    case NodeStateType.COMPLETE:
      return "success";
    case NodeStateType.ERROR:
      return "error";
    default:
      return "idle";
  }
}

interface UseCanvasAIAnimationsOptions {
  problemId: string;
  onNodeCreated?: (node: Record<string, unknown>) => void;
  onEdgeCreated?: (edge: Record<string, unknown>) => void;
  onRunCompleted?: (runId: string, status: string) => void;
}

export function useCanvasAIAnimations({
  problemId,
  onNodeCreated,
  onEdgeCreated,
  onRunCompleted,
}: UseCanvasAIAnimationsOptions) {
  const [nodeStates, setNodeStates] = useState<Map<string, NodeAnimationState>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<{ close: () => void } | null>(null);
  const cleanupTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Get the animation state for a specific node
  const getNodeState = useCallback((nodeId: string): NodeAnimationState | undefined => {
    return nodeStates.get(nodeId) || nodeStates.get(`temp:${nodeId}`);
  }, [nodeStates]);

  // Check if a node is currently being worked on
  const isNodeActive = useCallback((nodeId: string): boolean => {
    const state = getNodeState(nodeId);
    if (!state) return false;
    return state.state !== NodeStateType.IDLE && state.state !== NodeStateType.COMPLETE;
  }, [getNodeState]);

  // Manually set node state (for optimistic updates)
  const setNodeState = useCallback((
    nodeId: string | null,
    tempNodeId: string | null,
    state: NodeStateType,
    data?: { message?: string; progress?: number }
  ) => {
    const key = nodeId || `temp:${tempNodeId}`;
    if (!key) return;

    setNodeStates((prev) => {
      const next = new Map(prev);
      
      if (state === NodeStateType.IDLE) {
        next.delete(key);
      } else {
        next.set(key, {
          nodeId,
          tempNodeId,
          state,
          message: data?.message,
          progress: data?.progress,
        });
      }
      
      return next;
    });

    // Auto-clear complete state after animation
    if (state === NodeStateType.COMPLETE) {
      const timer = setTimeout(() => {
        setNodeStates((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      }, 2000); // Keep complete state visible for 2 seconds

      cleanupTimersRef.current.set(key, timer);
    }
  }, []);

  // Clear all animation states
  const clearAllStates = useCallback(() => {
    setNodeStates(new Map());
    cleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
    cleanupTimersRef.current.clear();
  }, []);

  // Handle WebSocket events - use refs for callbacks to avoid recreating
  const onNodeCreatedRef = useRef(onNodeCreated);
  const onEdgeCreatedRef = useRef(onEdgeCreated);
  const onRunCompletedRef = useRef(onRunCompleted);

  useEffect(() => {
    onNodeCreatedRef.current = onNodeCreated;
    onEdgeCreatedRef.current = onEdgeCreated;
    onRunCompletedRef.current = onRunCompleted;
  }, [onNodeCreated, onEdgeCreated, onRunCompleted]);

  // Handle WebSocket events - stable reference
  const handleEvent = useCallback((event: CanvasAIEvent) => {
    switch (event.event_type) {
      case "node_state":
        setNodeState(
          event.node_id || null,
          event.temp_node_id || null,
          event.state,
          event.state_data as { message?: string; progress?: number }
        );
        break;

      case "node_created":
        // Update temp node to real node ID
        if (event.node && typeof event.node === "object" && "id" in event.node) {
          const node = event.node as Record<string, unknown>;
          const nodeId = node.id as string;
          
          // Remove temp state if exists
          setNodeStates((prev) => {
            const next = new Map(prev);
            // Find and remove any temp state that matches
            for (const [key, state] of next.entries()) {
              if (key.startsWith("temp:") && state.tempNodeId) {
                next.delete(key);
                // Add with real node ID as complete
                next.set(nodeId, {
                  nodeId,
                  tempNodeId: null,
                  state: NodeStateType.COMPLETE,
                });
                break;
              }
            }
            return next;
          });

          onNodeCreatedRef.current?.(node);
        }
        break;

      case "edge_created":
        if (event.edge) {
          onEdgeCreatedRef.current?.(event.edge);
        }
        break;

      case "run_completed":
        // Clear all states for this run
        clearAllStates();
        onRunCompletedRef.current?.(event.run_id, event.status);
        break;
    }
  }, [setNodeState, clearAllStates]);

  // Connect WebSocket with reconnection logic
  useEffect(() => {
    if (!problemId) return;

    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      try {
        const ws = connectCanvasAIWebSocket(
          problemId,
          handleEvent,
          () => {
            // WebSocket errors are common (e.g., server not ready, no auth)
            // Silently handle and let reconnection logic take over
            setIsConnected(false);
          },
          () => {
            setIsConnected(false);
            
            // Attempt reconnection with exponential backoff
            if (mounted && reconnectAttempts < maxReconnectAttempts) {
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
              reconnectAttempts++;
              console.log(`Canvas AI WebSocket reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
              
              reconnectTimeout = setTimeout(connect, delay);
            }
          }
        );

        wsRef.current = ws;
        setIsConnected(true);
        reconnectAttempts = 0; // Reset on successful connection
      } catch (error) {
        console.error("Failed to create Canvas AI WebSocket:", error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      clearAllStates();
    };
  }, [problemId, handleEvent]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      cleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return {
    nodeStates,
    getNodeState,
    isNodeActive,
    setNodeState,
    clearAllStates,
    isConnected,
    // Convert to format expected by ProofCanvasV2
    nodeAnimationStatesForCanvas: useMemo(() => {
      const map = new Map<string, ComponentAnimationState>();
      for (const [key, state] of nodeStates.entries()) {
        // Use actual nodeId if available, otherwise use the key
        const nodeId = state.nodeId || key;
        // Skip temp keys that don't have a real nodeId yet
        if (!nodeId.startsWith("temp:")) {
          map.set(nodeId, stateTypeToAnimationState(state.state));
        }
      }
      return map;
    }, [nodeStates]),
  };
}

// Helper hook to get animation class for a node
export function useNodeAnimationClass(
  nodeId: string,
  nodeStates: Map<string, NodeAnimationState>
): string {
  const state = nodeStates.get(nodeId);
  
  if (!state) return "";
  
  switch (state.state) {
    case NodeStateType.THINKING:
      return "animate-pulse ring-2 ring-purple-400/50";
    case NodeStateType.GENERATING:
      return "ring-2 ring-blue-400/50";
    case NodeStateType.VERIFYING:
      return "ring-2 ring-emerald-400/50";
    case NodeStateType.COMPLETE:
      return "ring-2 ring-emerald-500";
    case NodeStateType.ERROR:
      return "ring-2 ring-red-500";
    default:
      return "";
  }
}
