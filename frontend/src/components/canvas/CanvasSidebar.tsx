"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  FileText,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  BookOpen,
  Lightbulb,
  FlaskConical,
  FileCode,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  Edit2,
  Trash2,
} from "lucide-react";
import { LibraryItem } from "@/lib/api";
import { NODE_TYPE_CONFIG, STATUS_CONFIG, type CanvasBlock } from "./types";

interface CanvasSidebarProps {
  items: LibraryItem[];
  selectedItemId: string | null;
  onItemClick: (itemId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onAddItem?: () => void;
  blocks?: CanvasBlock[];
  selectedBlockId?: string | null;
  selectedNodeCount?: number;
  onBlockSelect?: (blockId: string) => void;
  onCreateBlock?: (name: string, nodeIds?: string[]) => void;
  onRenameBlock?: (blockId: string, name: string) => void;
  onDeleteBlock?: (blockId: string) => void;
}

const KIND_ICONS: Record<string, typeof FileText> = {
  DEFINITION: BookOpen,
  LEMMA: FileCode,
  THEOREM: FlaskConical,
  CLAIM: Lightbulb,
  IDEA: Lightbulb,
  RESOURCE: FolderOpen,
  NOTE: FileText,
  CONTENT: FileText,
  COUNTEREXAMPLE: AlertCircle,
  COMPUTATION: FileCode,
  FORMAL_TEST: FileCode,
};

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  VERIFIED: CheckCircle,
  PROPOSED: Clock,
  REJECTED: AlertCircle,
};

interface GroupedItems {
  definitions: LibraryItem[];
  lemmas: LibraryItem[];
  theorems: LibraryItem[];
  other: LibraryItem[];
}

export function CanvasSidebar({
  items,
  selectedItemId,
  onItemClick,
  collapsed,
  onToggle,
  onAddItem,
  blocks = [],
  selectedBlockId = null,
  selectedNodeCount = 0,
  onBlockSelect,
  onCreateBlock,
  onRenameBlock,
  onDeleteBlock,
}: CanvasSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["definitions", "lemmas", "theorems", "other"])
  );
  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [blockName, setBlockName] = useState("");
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.kind.toLowerCase().includes(q) ||
        item.content?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const groupedItems = useMemo<GroupedItems>(() => {
    const groups: GroupedItems = {
      definitions: [],
      lemmas: [],
      theorems: [],
      other: [],
    };

    filteredItems.forEach((item) => {
      if (item.kind === "DEFINITION") {
        groups.definitions.push(item);
      } else if (item.kind === "LEMMA") {
        groups.lemmas.push(item);
      } else if (item.kind === "THEOREM") {
        groups.theorems.push(item);
      } else {
        groups.other.push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  if (collapsed) {
    return (
      <div className="w-12 bg-white border-r border-neutral-200 flex flex-col items-center py-3 gap-2 shrink-0">
        <button
          onClick={onToggle}
          className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          title="Expand sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-neutral-200" />
        {blocks.length > 0 && (
          <div className="flex flex-col gap-1">
            {blocks.slice(0, 5).map((block) => (
              <button
                key={block.id}
                onClick={() => onBlockSelect?.(block.id)}
                className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
                  selectedBlockId === block.id
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
                title={block.name}
              >
                <Layers className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
        {/* Mini item indicators */}
        <div className="flex flex-col gap-1">
          {items.slice(0, 8).map((item) => {
            const config = NODE_TYPE_CONFIG[item.kind] || NODE_TYPE_CONFIG.note;
            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item.id)}
                className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
                  selectedItemId === item.id
                    ? "bg-indigo-100 text-indigo-700"
                    : `${config.bgColor} ${config.color} hover:ring-1 ring-neutral-300`
                }`}
                title={item.title}
              >
                {item.kind.charAt(0).toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white border-r border-neutral-200 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-neutral-100 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Library Items</h3>
          <button
            onClick={onToggle}
            className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Blocks */}
      <div className="border-b border-neutral-100 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-700">Blocks</span>
            <span className="text-[10px] text-neutral-400">{blocks.length}</span>
          </div>
          <button
            onClick={() => setIsCreatingBlock(true)}
            disabled={selectedNodeCount === 0}
            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded disabled:opacity-40"
            title={selectedNodeCount === 0 ? "Select nodes to create a block" : "Create block"}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isCreatingBlock && (
          <div className="flex items-center gap-2 mb-2">
            <input
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (blockName.trim() && selectedNodeCount > 0) {
                    onCreateBlock?.(blockName);
                    setBlockName("");
                    setIsCreatingBlock(false);
                  }
                } else if (e.key === "Escape") {
                  setBlockName("");
                  setIsCreatingBlock(false);
                }
              }}
              placeholder="Block name"
              className="flex-1 px-2 py-1 text-xs border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              onClick={() => {
                if (blockName.trim() && selectedNodeCount > 0) {
                  onCreateBlock?.(blockName);
                  setBlockName("");
                  setIsCreatingBlock(false);
                }
              }}
              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md"
            >
              Add
            </button>
          </div>
        )}

        {blocks.length === 0 ? (
          <p className="text-[11px] text-neutral-400">
            Select nodes and create a block.
          </p>
        ) : (
          <div className="space-y-1">
            {blocks.map((block) => {
              const isSelected = selectedBlockId === block.id;
              const isEditing = editingBlockId === block.id;
              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                    isSelected ? "bg-indigo-50 border border-indigo-200" : "hover:bg-neutral-50 border border-transparent"
                  }`}
                >
                  <button
                    onClick={() => onBlockSelect?.(block.id)}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    <span className="text-[11px] text-neutral-500">{block.nodeIds.length}</span>
                    {isEditing ? (
                      <input
                        value={editingBlockName}
                        onChange={(e) => setEditingBlockName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editingBlockName.trim()) {
                              onRenameBlock?.(block.id, editingBlockName);
                            }
                            setEditingBlockId(null);
                          } else if (e.key === "Escape") {
                            setEditingBlockId(null);
                          }
                        }}
                        onBlur={() => {
                          if (editingBlockName.trim()) {
                            onRenameBlock?.(block.id, editingBlockName);
                          }
                          setEditingBlockId(null);
                        }}
                        className="flex-1 text-xs bg-white border border-neutral-200 rounded px-1 py-0.5"
                        autoFocus
                      />
                    ) : (
                      <span className={`text-xs font-medium ${isSelected ? "text-indigo-900" : "text-neutral-700"}`}>
                        {block.name}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingBlockId(block.id);
                        setEditingBlockName(block.name);
                      }}
                      className="p-1 text-neutral-400 hover:text-neutral-600"
                      title="Rename block"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteBlock?.(block.id)}
                      className="p-1 text-neutral-400 hover:text-red-500"
                      title="Delete block"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-2">
        {(["definitions", "lemmas", "theorems", "other"] as const).map((groupKey) => {
          const groupItems = groupedItems[groupKey];
          if (groupItems.length === 0) return null;

          const isExpanded = expandedGroups.has(groupKey);
          const groupLabels: Record<string, string> = {
            definitions: "Definitions",
            lemmas: "Lemmas",
            theorems: "Theorems",
            other: "Other Items",
          };

          return (
            <div key={groupKey} className="mb-2">
              <button
                onClick={() => toggleGroup(groupKey)}
                className="flex items-center gap-1 w-full px-2 py-1.5 text-left hover:bg-neutral-50 rounded-md transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                )}
                <span className="text-xs font-medium text-neutral-600">
                  {groupLabels[groupKey]}
                </span>
                <span className="ml-auto text-[10px] text-neutral-400">
                  {groupItems.length}
                </span>
              </button>

              {isExpanded && (
                <div className="ml-2 mt-1 space-y-0.5">
                  {groupItems.map((item) => {
                    const config = NODE_TYPE_CONFIG[item.kind] || NODE_TYPE_CONFIG.note;
                    const KindIcon = KIND_ICONS[item.kind] || FileText;
                    const StatusIcon = STATUS_ICONS[item.status] || Clock;
                    const isSelected = selectedItemId === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onItemClick(item.id)}
                        className={`flex items-start gap-2 w-full px-2 py-2 rounded-md text-left transition-colors ${
                          isSelected
                            ? "bg-indigo-50 border border-indigo-200"
                            : "hover:bg-neutral-50 border border-transparent"
                        }`}
                      >
                        <div className={`p-1 rounded shrink-0 ${config.bgColor}`}>
                          <KindIcon className={`w-3 h-3 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-medium truncate ${
                              isSelected ? "text-indigo-900" : "text-neutral-900"
                            }`}>
                              {item.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] uppercase font-medium ${config.color}`}>
                              {item.kind}
                            </span>
                            <StatusIcon
                              className={`w-3 h-3 ${
                                item.status === "VERIFIED"
                                  ? "text-emerald-500"
                                  : item.status === "REJECTED"
                                  ? "text-red-500"
                                  : "text-neutral-400"
                              }`}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="py-8 text-center">
            <FileText className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-xs text-neutral-500">
              {searchQuery ? "No items match your search" : "No library items yet"}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-neutral-100 shrink-0">
        <button
          onClick={onAddItem}
          className="flex items-center justify-center gap-1.5 w-full py-2 bg-neutral-900 text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </button>
      </div>
    </div>
  );
}
