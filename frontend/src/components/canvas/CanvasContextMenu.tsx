 "use client";

import { useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Link2,
  Edit3,
  CheckCircle,
  Circle,
  AlertCircle,
  Maximize2,
  Copy,
  FileText,
  BookOpen,
  Lightbulb,
  Award,
  MessageSquare,
} from "lucide-react";
import type { CanvasNode } from "./types";

interface ContextMenuProps {
  x: number;
  y: number;
  node?: CanvasNode;
  selectedCount?: number; // Number of selected nodes (for multi-selection)
  onClose: () => void;
  onAddNode: (x: number, y: number) => void;
  onEditNode?: (node: CanvasNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteSelected?: () => void; // Delete all selected nodes
  onChangeStatus?: (nodeId: string, status: string) => void;
  onChangeType?: (nodeId: string, type: string) => void;
  onStartConnect?: (nodeId: string) => void;
  onDuplicateNode?: (node: CanvasNode) => void;
  onOpenComments?: (nodeId: string) => void;
  onFitView?: () => void;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft", icon: Circle, color: "text-neutral-400" },
  { value: "EDITING", label: "Editing", icon: AlertCircle, color: "text-amber-500" },
  { value: "PROPOSED", label: "Proposed", icon: Circle, color: "text-blue-500" },
  { value: "VERIFIED", label: "Verified", icon: CheckCircle, color: "text-emerald-500" },
  { value: "REJECTED", label: "Rejected", icon: AlertCircle, color: "text-red-500" },
] as const;

const TYPE_OPTIONS = [
  { value: "NOTE", label: "Note", icon: FileText, color: "text-neutral-500" },
  { value: "DEFINITION", label: "Definition", icon: BookOpen, color: "text-sky-500" },
  { value: "LEMMA", label: "Lemma", icon: Lightbulb, color: "text-emerald-500" },
  { value: "THEOREM", label: "Theorem", icon: Award, color: "text-purple-500" },
];

export function CanvasContextMenu({
  x,
  y,
  node,
  selectedCount = 0,
  onClose,
  onAddNode,
  onEditNode,
  onDeleteNode,
  onDeleteSelected,
  onChangeStatus,
  onChangeType,
  onStartConnect,
  onDuplicateNode,
  onOpenComments,
  onFitView,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const isReadyRef = useRef(false);

  // Close on outside click - use timeout to prevent immediate close
  useEffect(() => {
    // Small delay to prevent the same click that opened the menu from closing it
    const readyTimeout = setTimeout(() => {
      isReadyRef.current = true;
    }, 100);

    const handleClickOutside = (e: MouseEvent) => {
      if (!isReadyRef.current) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    
    // Use click instead of mousedown to allow button clicks to work
    document.addEventListener("click", handleClickOutside, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      clearTimeout(readyTimeout);
      document.removeEventListener("click", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  const adjustedStyle = {
    left: x,
    top: y,
  };

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    danger = false,
    disabled = false,
    shortcut,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    shortcut?: string;
  }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
        onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left transition-all duration-150 ${
        danger
          ? "text-red-600 hover:bg-red-50 active:bg-red-100"
          : disabled
          ? "text-neutral-300 cursor-not-allowed"
          : "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-neutral-400">{shortcut}</span>}
    </button>
  );

  const Divider = () => <div className="my-1 border-t border-neutral-100" />;

  const SubMenu = ({
    label,
    icon: Icon,
    children,
  }: {
    label: string;
    icon: React.ElementType;
    children: React.ReactNode;
  }) => (
    <div className="relative group">
      <div className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-neutral-700 hover:bg-neutral-100 cursor-pointer transition-colors">
        <Icon className="w-3.5 h-3.5" />
        <span className="flex-1">{label}</span>
        <span className="text-neutral-400 text-[10px]">▸</span>
      </div>
      <div className="absolute left-full top-0 ml-1 hidden group-hover:block">
        <div className="bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-[150px]">
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] animate-in fade-in zoom-in-95 duration-100"
      style={adjustedStyle}
    >
      <div className="bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-[180px] overflow-hidden">
        {node ? (
          // Node context menu
          <>
            <MenuItem
              icon={Edit3}
              label="Edit Node"
              onClick={() => onEditNode?.(node)}
              shortcut="E"
            />
            <MenuItem
              icon={MessageSquare}
              label="Comments"
              onClick={() => onOpenComments?.(node.id)}
            />
            <MenuItem
              icon={Link2}
              label="Connect To..."
              onClick={() => onStartConnect?.(node.id)}
              shortcut="C"
            />
            <MenuItem
              icon={Copy}
              label="Duplicate"
              onClick={() => onDuplicateNode?.(node)}
              shortcut="⌘D"
            />
            
            <Divider />
            
            <SubMenu icon={Circle} label="Change Status">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChangeStatus?.(node.id, status.value);
                    onClose();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-neutral-100 active:bg-neutral-200 transition-colors ${
                    node.status === status.value ? "bg-neutral-100 font-medium" : ""
                  }`}
                >
                  <status.icon className={`w-3.5 h-3.5 ${status.color}`} />
                  {status.label}
                </button>
              ))}
            </SubMenu>
            
            {onChangeType && (
              <SubMenu icon={FileText} label="Change Type">
                {TYPE_OPTIONS.map((typeOpt) => (
                  <button
                    key={typeOpt.value}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChangeType(node.id, typeOpt.value);
                      onClose();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 transition-colors ${
                      node.type === typeOpt.value ? "bg-neutral-100 font-medium" : ""
                    }`}
                  >
                    <typeOpt.icon className={`w-3.5 h-3.5 ${typeOpt.color}`} />
                    {typeOpt.label}
                  </button>
                ))}
              </SubMenu>
            )}
            
            <Divider />
            
            {selectedCount > 1 ? (
              <MenuItem
                icon={Trash2}
                label={`Delete ${selectedCount} Nodes`}
                onClick={() => onDeleteSelected?.()}
                danger
                shortcut="⌫"
              />
            ) : (
              <MenuItem
                icon={Trash2}
                label="Delete Node"
                onClick={() => onDeleteNode?.(node.id)}
                danger
                shortcut="⌫"
              />
            )}
          </>
        ) : (
          // Canvas context menu
          <>
            <MenuItem
              icon={Plus}
              label="Add Node Here"
              onClick={() => onAddNode(x, y)}
              shortcut="N"
            />
            <Divider />
            <MenuItem
              icon={Maximize2}
              label="Fit to View"
              onClick={() => onFitView?.()}
              shortcut="F"
            />
          </>
        )}
      </div>
    </div>
  );
}
