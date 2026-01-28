"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, ChevronDown } from "lucide-react";

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
  { value: "NOTE", label: "Note", color: "bg-neutral-400", border: "border-neutral-300" },
  { value: "DEFINITION", label: "Definition", color: "bg-sky-400", border: "border-sky-300" },
  { value: "LEMMA", label: "Lemma", color: "bg-emerald-400", border: "border-emerald-300" },
  { value: "THEOREM", label: "Theorem", color: "bg-purple-400", border: "border-purple-300" },
];

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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && title.trim()) {
        e.preventDefault();
        onSubmit({ title: title.trim(), type, x: position.x, y: position.y });
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Cycle through types
        const idx = QUICK_TYPES.findIndex((t) => t.value === type);
        const nextIdx = (idx + 1) % QUICK_TYPES.length;
        setType(QUICK_TYPES[nextIdx].value);
      }
    },
    [title, type, position, onSubmit]
  );

  const selectedType = QUICK_TYPES.find((t) => t.value === type) || QUICK_TYPES[0];

  return (
    <div
      ref={containerRef}
      className="absolute z-50 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -50%)" }}
    >
      <div className={`w-72 rounded-lg border-2 shadow-xl bg-white overflow-hidden ${selectedType.border}`}>
        {/* Type selector */}
        <div className="px-3 py-2 border-b border-neutral-100 bg-neutral-50">
          <div className="relative">
            <button
              onClick={() => setShowTypes(!showTypes)}
              className="flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${selectedType.color}`} />
              {selectedType.label}
              <ChevronDown className={`w-3 h-3 ${showTypes ? "rotate-180" : ""}`} />
            </button>
            
            {showTypes && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                {QUICK_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setType(t.value);
                      setShowTypes(false);
                      inputRef.current?.focus();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-neutral-50 ${
                      type === t.value ? "bg-neutral-100 font-medium" : ""
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
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
    </div>
  );
}
