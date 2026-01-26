"use client";

import { useCallback } from "react";
import { Bot, MessageSquare, Link2 } from "lucide-react";
import { CanvasNode, NODE_TYPE_CONFIG, STATUS_CONFIG } from "./types";

interface CanvasNodeItemProps {
  node: CanvasNode;
  isSelected: boolean;
  isDragging?: boolean;
  isConnecting?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onConnectionStart?: (e: React.MouseEvent) => void;
}

export function CanvasNodeItem({
  node,
  isSelected,
  isDragging = false,
  isConnecting = false,
  onMouseDown,
  onMouseUp,
  onDoubleClick,
  onConnectionStart,
}: CanvasNodeItemProps) {
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

  return (
    <div
      data-node-id={node.id}
      className={`absolute rounded-xl border-2 shadow-sm cursor-pointer group select-none
        ${typeConfig.bgColor} ${typeConfig.borderColor}
        ${isSelected ? "ring-2 ring-indigo-500 ring-offset-2 shadow-lg scale-[1.02]" : "hover:shadow-md"}
        ${isDragging ? "shadow-xl scale-[1.03] cursor-grabbing z-50" : ""}
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
      onDoubleClick={onDoubleClick}
      draggable={false}
    >
      {/* Node Header */}
      <div className={`px-4 py-3 border-b ${typeConfig.borderColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
          {node.id && (
            <span className="text-[9px] font-mono text-neutral-400">
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
      <div className={`px-4 py-2 border-t ${typeConfig.borderColor} flex items-center justify-between bg-white/30`}>
        <div className="flex items-center gap-2">
          {/* Agent Badge */}
          {node.agentId && (
            <div className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
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
            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
              <Link2 className="w-3 h-3" />
              <span>{node.dependencies.length}</span>
            </div>
          )}
          
          {/* Actions on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-white/50 rounded">
              <MessageSquare className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Connection Handle - Bottom */}
      <div 
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-neutral-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair hover:border-indigo-500 hover:bg-indigo-50 hover:scale-125 z-10"
        title="Drag to connect"
        onMouseDown={handleConnectionHandleMouseDown}
      />
      
      {/* Connection Handle - Top */}
      <div 
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-neutral-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair hover:border-indigo-500 hover:bg-indigo-50 hover:scale-125 z-10"
        title="Connect from here"
        onMouseDown={handleConnectionHandleMouseDown}
      />
    </div>
  );
}
