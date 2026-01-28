"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FileText, FolderOpen, Loader2 } from "lucide-react";
import { listWorkspaceContents, WorkspaceContent } from "@/lib/api";

interface CommitToDocumentModalProps {
  isOpen: boolean;
  problemId: string;
  selectedNodeCount: number;
  onClose: () => void;
  onSubmit: (data: {
    workspaceFileId: string;
    sectionTitle: string;
    format: "markdown" | "latex";
  }) => void;
}

export function CommitToDocumentModal({
  isOpen,
  problemId,
  selectedNodeCount,
  onClose,
  onSubmit,
}: CommitToDocumentModalProps) {
  const [files, setFiles] = useState<WorkspaceContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [format, setFormat] = useState<"markdown" | "latex">("markdown");
  const [submitting, setSubmitting] = useState(false);

  // Load workspace files when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, problemId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await listWorkspaceContents(problemId, "");
      // Flatten to markdown files only
      const markdownFiles: WorkspaceContent[] = [];
      const processEntries = (entries: WorkspaceContent[]) => {
        for (const entry of entries) {
          if (entry.type === "file" && 
              (entry.name.endsWith(".md") || entry.name.endsWith(".tex") || entry.format === "markdown")) {
            markdownFiles.push(entry);
          }
        }
      };
      if (Array.isArray(result.content)) {
        processEntries(result.content);
      }
      setFiles(markdownFiles);
      if (markdownFiles.length > 0 && !selectedFileId) {
        setSelectedFileId(markdownFiles[0].path);
      }
    } catch (err) {
      console.error("Failed to load workspace files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedFileId || !sectionTitle.trim()) return;
    
    setSubmitting(true);
    try {
      await onSubmit({
        workspaceFileId: selectedFileId,
        sectionTitle: sectionTitle.trim(),
        format,
      });
      onClose();
    } catch (err) {
      console.error("Failed to commit to document:", err);
    } finally {
      setSubmitting(false);
    }
  }, [selectedFileId, sectionTitle, format, onSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Commit to Document</h2>
              <p className="text-sm text-neutral-500">{selectedNodeCount} nodes selected</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Section Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Section Title
            </label>
            <input
              type="text"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="e.g., Main Theorem Proof"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
            />
          </div>
          
          {/* Target Document */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Target Document
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading files...
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-neutral-500 py-2">
                <FolderOpen className="w-4 h-4" />
                No documents found. Create one in the Lab first.
              </div>
            ) : (
              <select
                value={selectedFileId || ""}
                onChange={(e) => setSelectedFileId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
              >
                {files.map((file) => (
                  <option key={file.path} value={file.path}>
                    {file.path}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Output Format
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormat("markdown")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  format === "markdown"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                    : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                Markdown
              </button>
              <button
                type="button"
                onClick={() => setFormat("latex")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  format === "latex"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                    : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                LaTeX
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFileId || !sectionTitle.trim() || submitting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Commit to Document
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
