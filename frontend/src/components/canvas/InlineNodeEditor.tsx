"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, X, ChevronDown } from "lucide-react";
import { NODE_TYPE_CONFIG } from "./types";

export interface QuickNodeData {
  title: string;
  type: string;
  x: number;
  y: number;
}

interface InlineNodeEditorProps {
  position: { x: number; y: number };
  initialTitle?: string;
  initialType?: string;
  onSubmit: (data: QuickNodeData) => void;
  onCancel: () => void;
}

const QUICK_TYPES = [
  "DEFINITION",
  "LEMMA",
  "THEOREM",
  "CLAIM",
  "NOTE",
  "COUNTEREXAMPLE",
  "COMPUTATION",
  "IDEA",
  "RESOURCE",
] as const;

const getTypeConfig = (value: string) =>
  NODE_TYPE_CONFIG[value] || NODE_TYPE_CONFIG.NOTE || NODE_TYPE_CONFIG.note;

const TYPE_DOT_COLOR: Record<string, string> = {
  DEFINITION: "bg-indigo-500",
  LEMMA: "bg-emerald-500",
  THEOREM: "bg-amber-500",
  CLAIM: "bg-blue-500",
  NOTE: "bg-neutral-500",
  COUNTEREXAMPLE: "bg-red-500",
  COMPUTATION: "bg-purple-500",
  IDEA: "bg-fuchsia-500",
  RESOURCE: "bg-slate-500",
};

const getTypeDotClass = (value: string) =>
  TYPE_DOT_COLOR[value] || "bg-neutral-500";

export function InlineNodeEditor({
  position,
  initialTitle = "",
  initialType = "NOTE",
  onSubmit,
  onCancel,
}: InlineNodeEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState(initialType);
  const [showTypes, setShowTypes] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typeButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        if (title.trim()) {
          onSubmit({ title: title.trim(), type, x: position.x, y: position.y });
        } else {
          onCancel();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [title, type, position, onSubmit, onCancel]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  useEffect(() => {
    if (!showTypes) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const rect = typeButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        left: rect.left,
        top: rect.bottom + 6,
        width: Math.max(160, rect.width),
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [showTypes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && title.trim()) {
        e.preventDefault();
        onSubmit({ title: title.trim(), type, x: position.x, y: position.y });
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Cycle through types
        const idx = QUICK_TYPES.findIndex((t) => t === type);
        const nextIdx = idx === -1 ? 0 : (idx + 1) % QUICK_TYPES.length;
        setType(QUICK_TYPES[nextIdx]);
      }
    },
    [title, type, position, onSubmit]
  );

  const selectedTypeConfig = getTypeConfig(type);

  return (
    <div
      ref={containerRef}
      className="absolute z-50 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -50%)" }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={`w-72 rounded-lg border-2 shadow-xl bg-white overflow-visible ${selectedTypeConfig.borderColor}`}>
        {/* Type selector */}
        <div className="px-3 py-2 border-b border-neutral-100 bg-neutral-50">
          <div className="relative">
            <button
              ref={typeButtonRef}
              onClick={() => setShowTypes(!showTypes)}
              className="flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${getTypeDotClass(type)} shadow-[0_0_0_1px_rgba(0,0,0,0.08)]`} />
              {selectedTypeConfig.label}
              <ChevronDown className={`w-3 h-3 ${showTypes ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Title input */}
        <div className="p-3">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a title and press Enter..."
            className="w-full bg-transparent text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
          <span className="text-[10px] text-neutral-400">
            ↵ create · Tab type · Esc cancel
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onCancel}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
              title="Cancel (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => title.trim() && onSubmit({ title: title.trim(), type, x: position.x, y: position.y })}
              disabled={!title.trim()}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              title="Create (Enter)"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showTypes && isMounted && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[200]"
              style={{ left: menuPosition.left, top: menuPosition.top, width: menuPosition.width }}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="bg-white border border-neutral-200 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto">
                {QUICK_TYPES.map((t) => {
                  const config = getTypeConfig(t);
                  const dotClass = getTypeDotClass(t);
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setType(t);
                        setShowTypes(false);
                        inputRef.current?.focus();
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-neutral-700 hover:bg-neutral-50 ${
                        type === t ? "bg-neutral-100 font-medium" : ""
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${dotClass} shadow-[0_0_0_1px_rgba(0,0,0,0.08)]`} />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
