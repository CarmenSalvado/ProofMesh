"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bot, MessageSquare, Link2, ExternalLink, FileText, AlertCircle } from "lucide-react";
import { CanvasNode, NODE_TYPE_CONFIG, STATUS_CONFIG } from "./types";

interface CanvasNodeItemProps {
  node: CanvasNode;
  isSelected: boolean;
  isMultiSelected?: boolean;
  isDragging?: boolean;
  isConnecting?: boolean;
  problemId?: string;
  anchorStatus?: { hasAnchors: boolean; isStale: boolean; count: number };
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onConnectionStart?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onOpenInEditor?: (node: CanvasNode) => void;
  onOpenComments?: (nodeId: string) => void;
}

export function CanvasNodeItem({
  node,
  isSelected,
  isMultiSelected = false,
  isDragging = false,
  isConnecting = false,
  problemId,
  anchorStatus,
  onMouseDown,
  onMouseUp,
  onDoubleClick,
  onConnectionStart,
  onContextMenu,
  onOpenInEditor,
  onOpenComments,
}: CanvasNodeItemProps) {
  const router = useRouter();
  const typeConfig = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.NOTE;
  const statusConfig = STATUS_CONFIG[node.status] || STATUS_CONFIG.DRAFT;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    onMouseDown(e);
  }, [onMouseDown]);

  const handleConnectionHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onConnectionStart?.(e);
  }, [onConnectionStart]);

  const handleOpenInEditor = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenInEditor) {
      onOpenInEditor(node);
    } else if (problemId) {
      // Deep link to lab view with this node's content
      router.push(`/problems/${problemId}/lab?nodeId=${node.id}`);
    }
  }, [node, problemId, router, onOpenInEditor]);

  return (
    <div
      data-node-id={node.id}
      className={`absolute rounded-xl border cursor-pointer group select-none
        ${typeConfig.bgColor} ${typeConfig.borderColor}
        ${isSelected ? "ring-2 ring-indigo-500 ring-offset-1 shadow-lg z-40" : "hover:shadow-md"}
        ${isMultiSelected ? "ring-2 ring-emerald-500 ring-offset-1 z-30" : ""}
        ${isDragging ? "shadow-xl cursor-grabbing z-50" : ""}
        ${isConnecting ? "ring-2 ring-emerald-500" : ""}
      `}
      style={{
        left: node.x,
        top: node.y,
        width: node.width || 260,
        minHeight: node.height || 140,
        userSelect: "none",
        WebkitUserSelect: "none",
        willChange: isDragging ? "left, top" : "auto",
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={onMouseUp}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e);
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={onContextMenu}
      draggable={false}
    >
      {/* Document Anchor Badge */}
      {anchorStatus?.hasAnchors && (
        <div 
          className={`absolute -top-2 -right-2 z-50 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium shadow-sm ${
            anchorStatus.isStale 
              ? "bg-amber-100 text-amber-700 border border-amber-300" 
              : "bg-emerald-100 text-emerald-700 border border-emerald-300"
          }`}
          title={anchorStatus.isStale ? "Document anchor is outdated" : `Linked to ${anchorStatus.count} document section(s)`}
        >
          {anchorStatus.isStale ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <FileText className="w-3 h-3" />
          )}
          <span>{anchorStatus.count}</span>
        </div>
      )}
      
      {/* Node Header */}
      <div className={`px-4 py-2.5 border-b ${typeConfig.borderColor} flex items-center justify-between rounded-t-xl`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
          {node.id && (
            <span className="text-[9px] font-mono text-neutral-400/80">
              #{node.id.slice(0, 6)}
            </span>
          )}
        </div>
        
        {/* Status Badge */}
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
          <span>{statusConfig.icon}</span>
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {/* Node Title */}
      <div className="px-4 py-3">
        <h4 className="text-sm font-semibold text-neutral-900 mb-1 line-clamp-2">
          {node.title}
        </h4>
        
        {/* Formula if present */}
        {node.formula && (
          <div className="mt-2 px-2 py-1.5 bg-white/60 rounded-md border border-neutral-200/50">
            <code className="text-xs font-mono text-neutral-700 break-all">
              {node.formula.length > 50 ? node.formula.slice(0, 50) + "..." : node.formula}
            </code>
          </div>
        )}
        
        {/* Content preview */}
        {node.content && !node.formula && (
          <p className="text-xs text-neutral-600 line-clamp-2 mt-1">
            {node.content}
          </p>
        )}
      </div>

      {/* Node Footer */}
      <div className={`px-4 py-2 border-t ${typeConfig.borderColor} flex items-center justify-between rounded-b-xl`}>
        <div className="flex items-center gap-2">
          {/* Agent Badge */}
          {node.agentId && (
            <div className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
              <Bot className="w-3 h-3" />
              <span className="font-medium">Agent</span>
            </div>
          )}
          
          {/* Authors */}
          {node.authors && node.authors.length > 0 && !node.agentId && (
            <span className="text-[10px] text-neutral-400">
              {node.authors[0]}
            </span>
          )}
        </div>
        
        {/* Dependencies indicator */}
        <div className="flex items-center gap-2">
          {node.dependencies && node.dependencies.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-neutral-400 bg-white/50 px-1.5 py-0.5 rounded-full">
              <Link2 className="w-3 h-3" />
              <span>{node.dependencies.length}</span>
            </div>
          )}
          
          {/* Actions on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <button 
              className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              onClick={handleOpenInEditor}
              title="Open in Editor"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
            <button 
              className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenComments?.(node.id);
              }}
              title="Comments"
            >
              <MessageSquare className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Connection Handle - Bottom */}
      <div 
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-neutral-300 rounded-full opacity-0 group-hover:opacity-100 cursor-crosshair hover:border-emerald-500 hover:bg-emerald-50 z-10"
        title="Drag to connect"
        onMouseDown={handleConnectionHandleMouseDown}
      />
      
      {/* Connection Handle - Top */}
      <div 
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-neutral-300 rounded-full opacity-0 group-hover:opacity-100 cursor-crosshair hover:border-emerald-500 hover:bg-emerald-50 z-10"
        title="Connect from here"
        onMouseDown={handleConnectionHandleMouseDown}
      />
    </div>
  );
}
