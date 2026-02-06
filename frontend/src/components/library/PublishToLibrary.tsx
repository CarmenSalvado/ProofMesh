"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  BookOpen,
  Upload,
  X,
  Tag,
  FileText,
  Code,
  Lightbulb,
  Check,
  Loader2,
  Globe,
  Lock,
  ChevronDown,
} from "lucide-react";
import { createLibraryItem, LibraryItem } from "@/lib/api";

export type LibraryItemKind = LibraryItem["kind"];

interface PublishToLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  problemId: string;
  selectedText: string;
  selectedFormula?: string;
  onSuccess?: (itemId: string) => void;
}

const KIND_OPTIONS: { value: LibraryItemKind; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "LEMMA", label: "Lemma", icon: <FileText className="w-4 h-4" />, description: "A supporting result" },
  { value: "THEOREM", label: "Theorem", icon: <BookOpen className="w-4 h-4" />, description: "A major result" },
  { value: "DEFINITION", label: "Definition", icon: <Tag className="w-4 h-4" />, description: "A formal definition" },
  { value: "CLAIM", label: "Claim", icon: <Check className="w-4 h-4" />, description: "An assertion to prove" },
  { value: "NOTE", label: "Note", icon: <Lightbulb className="w-4 h-4" />, description: "A general note" },
  { value: "COMPUTATION", label: "Computation", icon: <Code className="w-4 h-4" />, description: "A calculation or computation" },
  { value: "FORMAL_TEST", label: "Formal Test", icon: <Code className="w-4 h-4" />, description: "Lean-focused verification artifact" },
];

export function PublishToLibraryModal({
  isOpen,
  onClose,
  problemId,
  selectedText,
  selectedFormula,
  onSuccess,
}: PublishToLibraryModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(selectedText);
  const [formula, setFormula] = useState(selectedFormula || "");
  const [kind, setKind] = useState<LibraryItemKind>("LEMMA");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKindDropdown, setShowKindDropdown] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const kindDropdownRef = useRef<HTMLDivElement>(null);

  // Update description when selectedText changes
  useEffect(() => {
    setDescription(selectedText);
  }, [selectedText]);

  useEffect(() => {
    if (selectedFormula) {
      setFormula(selectedFormula);
    }
  }, [selectedFormula]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (kindDropdownRef.current && !kindDropdownRef.current.contains(event.target as Node)) {
        setShowKindDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < 5) {
      setTags((prev) => [...prev, trimmedTag]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError("Please provide a title");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createLibraryItem(problemId, {
        title: title.trim(),
        kind,
        content: description.trim(),
        formula: formula.trim() || undefined,
      });

      onSuccess?.(result.id);
      onClose();
      
      // Reset form
      setTitle("");
      setDescription("");
      setFormula("");
      setKind("LEMMA");
      setTags([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setIsSubmitting(false);
    }
  }, [title, description, formula, kind, problemId, onSuccess, onClose]);

  if (!isOpen) return null;

  const selectedKind = KIND_OPTIONS.find((k) => k.value === kind)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fadeIn"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Upload className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  Publish to Library
                </h2>
                <p className="text-xs text-neutral-500">
                  Share this with the community
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Cauchy-Schwarz Inequality"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Kind selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Type
            </label>
            <div className="relative" ref={kindDropdownRef}>
              <button
                onClick={() => setShowKindDropdown(!showKindDropdown)}
                className="w-full flex items-center justify-between px-4 py-2.5 border border-neutral-200 rounded-xl text-sm hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-center gap-2">
                  {selectedKind.icon}
                  <span className="text-neutral-900">{selectedKind.label}</span>
                  <span className="text-neutral-400">—</span>
                  <span className="text-neutral-500">{selectedKind.description}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${showKindDropdown ? "rotate-180" : ""}`} />
              </button>

              {showKindDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
                  {KIND_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setKind(option.value);
                        setShowKindDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 transition-colors ${
                        kind === option.value ? "bg-indigo-50" : ""
                      }`}
                    >
                      <span className={kind === option.value ? "text-indigo-600" : "text-neutral-500"}>
                        {option.icon}
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${kind === option.value ? "text-indigo-600" : "text-neutral-900"}`}>
                          {option.label}
                        </p>
                        <p className="text-xs text-neutral-500">{option.description}</p>
                      </div>
                      {kind === option.value && (
                        <Check className="w-4 h-4 text-indigo-600 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Statement / Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="The mathematical statement or description..."
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Formula (Lean code) */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Lean 4 Code (optional)
            </label>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              rows={3}
              placeholder="theorem example : ∀ x : ℕ, x = x := by rfl"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-mono bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Tags (max 5)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="p-0.5 hover:bg-indigo-200 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                  className="px-3 py-2 bg-neutral-100 text-neutral-600 text-sm rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="w-5 h-5 text-emerald-500" />
              ) : (
                <Lock className="w-5 h-5 text-neutral-400" />
              )}
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {isPublic ? "Public" : "Private"}
                </p>
                <p className="text-xs text-neutral-500">
                  {isPublic
                    ? "Anyone can discover this item"
                    : "Only you can see this item"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isPublic ? "bg-emerald-500" : "bg-neutral-300"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  isPublic ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Publish
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Selection context menu component
interface SelectionContextMenuProps {
  position: { x: number; y: number } | null;
  selectedText: string;
  onPublish: () => void;
  onClose: () => void;
}

export function SelectionContextMenu({
  position,
  selectedText,
  onPublish,
  onClose,
}: SelectionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!position || !selectedText) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-neutral-200 rounded-xl shadow-xl py-1 min-w-[160px] animate-fadeIn"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        onClick={onPublish}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Publish to Library
      </button>
      <button
        onClick={() => {
          navigator.clipboard.writeText(selectedText);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
      >
        <FileText className="w-4 h-4" />
        Copy
      </button>
    </div>
  );
}
