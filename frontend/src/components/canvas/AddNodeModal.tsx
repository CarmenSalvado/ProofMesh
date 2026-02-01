"use client";

import { useState, useCallback } from "react";
import {
  X,
  Plus,
  BookOpen,
  FileCode,
  FlaskConical,
  Lightbulb,
  FileText,
  AlertCircle,
} from "lucide-react";
import { NODE_TYPE_CONFIG } from "./types";

export interface NewNodeData {
  type: string;
  title: string;
  content: string;
  formula?: string;
  leanCode?: string;
  x?: number;
  y?: number;
  dependencies: string[];
  authors?: Array<{ type: "human" | "agent"; id: string; name?: string }>;
  source?: { file_path?: string; cell_id?: string; agent_run_id?: string };
}

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewNodeData) => Promise<{ id: string } | void>;
  existingNodes: Array<{ id: string; title: string; type: string }>;
  defaultPosition?: { x: number; y: number };
}

const NODE_TYPES = [
  { value: "DEFINITION", label: "Definition", icon: BookOpen },
  { value: "LEMMA", label: "Lemma", icon: FileCode },
  { value: "THEOREM", label: "Theorem", icon: FlaskConical },
  { value: "CLAIM", label: "Claim", icon: Lightbulb },
  { value: "NOTE", label: "Note", icon: FileText },
  { value: "COUNTEREXAMPLE", label: "Counterexample", icon: AlertCircle },
  { value: "COMPUTATION", label: "Computation", icon: FileCode },
  { value: "IDEA", label: "Idea", icon: Lightbulb },
  { value: "RESOURCE", label: "Resource", icon: FileText },
];

export function AddNodeModal({
  isOpen,
  onClose,
  onSubmit,
  existingNodes,
}: AddNodeModalProps) {
  const [type, setType] = useState("LEMMA");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [formula, setFormula] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        type,
        title: title.trim(),
        content: content.trim(),
        formula: formula.trim() || undefined,
        dependencies,
      });
      
      // Reset form
      setType("LEMMA");
      setTitle("");
      setContent("");
      setFormula("");
      setDependencies([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create node");
    } finally {
      setIsSubmitting(false);
    }
  }, [type, title, content, formula, dependencies, onSubmit, onClose]);

  const toggleDependency = useCallback((id: string) => {
    setDependencies((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }, []);

  if (!isOpen) return null;

  const typeConfig = NODE_TYPE_CONFIG[type] || NODE_TYPE_CONFIG.note;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
              <Plus className={`w-5 h-5 ${typeConfig.color}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Add New Node</h2>
              <p className="text-xs text-neutral-500">Create a new library item on the canvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Node Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {NODE_TYPES.map((nodeType) => {
                const Icon = nodeType.icon;
                const config = NODE_TYPE_CONFIG[nodeType.value] || NODE_TYPE_CONFIG.note;
                const isSelected = type === nodeType.value;
                
                return (
                  <button
                    key={nodeType.value}
                    type="button"
                    onClick={() => setType(nodeType.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? `${config.bgColor} ${config.borderColor} ${config.color} ring-2 ring-offset-1 ring-indigo-500`
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{nodeType.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Cauchy-Schwarz Inequality"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the mathematical content..."
              rows={4}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Formula */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Formula (LaTeX)
            </label>
            <input
              type="text"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g., \sum_{i=1}^n a_i b_i \leq \|a\| \|b\|"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Dependencies */}
          {existingNodes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Dependencies (uses these items)
              </label>
              <div className="max-h-32 overflow-y-auto border border-neutral-200 rounded-lg p-2 space-y-1">
                {existingNodes.map((node) => {
                  const nodeConfig = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.note;
                  const isSelected = dependencies.includes(node.id);
                  
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => toggleDependency(node.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700"
                          : "hover:bg-neutral-50 text-neutral-700"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? "bg-indigo-600 border-indigo-600" : "border-neutral-300"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[10px] uppercase font-medium ${nodeConfig.color}`}>
                        {node.type}
                      </span>
                      <span className="text-xs truncate">{node.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Node
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
