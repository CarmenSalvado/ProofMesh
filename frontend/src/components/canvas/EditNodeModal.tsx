"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Save,
  Trash2,
  BookOpen,
  FileCode,
  FlaskConical,
  Lightbulb,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { NODE_TYPE_CONFIG, STATUS_CONFIG, CanvasNode } from "./types";

interface EditNodeModalProps {
  node: CanvasNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, data: {
    title: string;
    content: string;
    formula?: string;
    status?: "PROPOSED" | "VERIFIED" | "REJECTED";
  }) => Promise<void>;
  onDelete: (nodeId: string) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: "PROPOSED", label: "Proposed", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  { value: "VERIFIED", label: "Verified", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  { value: "REJECTED", label: "Rejected", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
];

export function EditNodeModal({
  node,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EditNodeModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [formula, setFormula] = useState("");
  const [status, setStatus] = useState<"PROPOSED" | "VERIFIED" | "REJECTED">("PROPOSED");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when node changes
  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setContent(node.content || "");
      setFormula(node.formula || "");
      setStatus(node.status as "PROPOSED" | "VERIFIED" | "REJECTED");
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [node]);

  const handleSave = useCallback(async () => {
    if (!node) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(node.id, {
        title: title.trim(),
        content: content.trim(),
        formula: formula.trim() || undefined,
        status,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }, [node, title, content, formula, status, onSave, onClose]);

  const handleDelete = useCallback(async () => {
    if (!node) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onDelete(node.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [node, onDelete, onClose]);

  if (!isOpen || !node) return null;

  const typeConfig = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.note;

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
              <FileCode className={`w-5 h-5 ${typeConfig.color}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Edit Node</h2>
              <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                <span className={`uppercase font-medium ${typeConfig.color}`}>{typeConfig.label}</span>
                <span>·</span>
                <span className="font-mono">#{node.id.slice(0, 8)}</span>
              </p>
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

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Status
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = status === option.value;
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatus(option.value as typeof status)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? `${option.bg} border-current ${option.color} ring-2 ring-offset-1 ring-indigo-500`
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delete Section */}
          <div className="pt-4 border-t border-neutral-200">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete this node
              </button>
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 mb-3">
                  Are you sure you want to delete this node? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm text-neutral-600 hover:bg-red-100 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
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
            onClick={handleSave}
            disabled={isSubmitting || !title.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
