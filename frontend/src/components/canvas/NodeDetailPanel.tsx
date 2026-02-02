"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  MessageSquare,
  User,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  MoreHorizontal,
  Edit3,
  Check,
  Save,
  History,
  Users,
  Bot,
  Sparkles,
  GitCommit,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CanvasNode, NODE_TYPE_CONFIG } from "./types";
import { AuthorAvatar } from "./AuthorAvatar";
import { NodeContributors } from "./NodeContributors";
import { ActivityTimeline, ActivityEntry } from "./ActivityTimeline";

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  created_at: string;
  parent_id?: string;
}

interface NodeDetailPanelProps {
  node: CanvasNode;
  problemId: string;
  onClose: () => void;
  onSave: (nodeId: string, data: {
    title: string;
    content: string;
    formula?: string;
    leanCode?: string;
    status?: "PROPOSED" | "VERIFIED" | "REJECTED";
    verification?: { method: string; logs: string; status: string };
  }) => Promise<void>;
  onDelete: (nodeId: string) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: "PROPOSED", label: "Proposed", icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { value: "VERIFIED", label: "Verified", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { value: "REJECTED", label: "Rejected", icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
];

export function NodeDetailPanel({
  node,
  problemId,
  onClose,
  onSave,
  onDelete,
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "comments" | "traceability">("edit");

  // Edit state
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content || "");
  const [formula, setFormula] = useState(node.formula || "");
  const [leanCode, setLeanCode] = useState(node.leanCode || "");
  const [status, setStatus] = useState<"PROPOSED" | "VERIFIED" | "REJECTED">(
    node.status as "PROPOSED" | "VERIFIED" | "REJECTED"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Activity/Traceability state
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const typeConfig = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.NOTE;

  // Track changes
  useEffect(() => {
    const changed =
      title !== node.title ||
      content !== (node.content || "") ||
      formula !== (node.formula || "") ||
      leanCode !== (node.leanCode || "") ||
      status !== node.status;
    setHasChanges(changed);
  }, [title, content, formula, leanCode, status, node]);

  // Reset on node change
  useEffect(() => {
    setTitle(node.title);
    setContent(node.content || "");
    setFormula(node.formula || "");
    setLeanCode(node.leanCode || "");
    setStatus(node.status as "PROPOSED" | "VERIFIED" | "REJECTED");
  }, [node]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === "comments") {
      loadComments();
    } else if (activeTab === "traceability") {
      loadActivities();
    }
  }, [activeTab, node.id]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Define handleSave before it's used in autosave
  const handleSave = useCallback(async () => {
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(node.id, {
        title: title.trim(),
        content: content.trim(),
        formula: formula.trim() || undefined,
        leanCode: leanCode.trim() || undefined,
        status,
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [node.id, title, content, formula, leanCode, status, onSave, isSaving]);

  // Autosave changes (debounced)
  useEffect(() => {
    if (activeTab !== "edit") return;
    if (!hasChanges) return;
    if (!title.trim()) return;
    if (isSaving) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 800);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [title, content, formula, status, hasChanges, isSaving, activeTab, handleSave]);

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/problems/${problemId}/library/${node.id}/comments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        setComments(await response.json());
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const loadActivities = async () => {
    setLoadingActivities(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/problems/${problemId}/library/${node.id}/activity`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/problems/${problemId}/library/${node.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );
      if (response.ok) {
        const comment = await response.json();
        setComments([...comments, comment]);
        setNewComment("");
      } else {
        const errorText = await response.text();
        console.error("Comment post failed:", response.status, errorText);
      }
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleDelete = async () => {
    if (confirm("Delete this node? This cannot be undone.")) {
      await onDelete(node.id);
      onClose();
    }
  };

  // Get first human author as creator
  const creator = node.authors?.find(a => a.type === "human");
  const hasAgent = node.authors?.some(a => a.type === "agent");

  return (
    <motion.div
      ref={panelRef}
      className="absolute right-0 top-0 bottom-0 w-[420px] bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${typeConfig.color.replace("text-", "bg-")}`} />
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {typeConfig.label}
          </span>
          
          {/* Creator avatar */}
          {creator && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-neutral-200">
              <AuthorAvatar author={creator} size="xs" showTooltip={false} />
              <span className="text-xs text-neutral-500">{creator.name || "Unknown"}</span>
            </div>
          )}
          
          {/* AI indicator */}
          {hasAgent && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-50 border border-violet-200">
              <Sparkles className="w-2.5 h-2.5 text-violet-500" />
              <span className="text-[9px] font-medium text-violet-600">AI</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              Save
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-100">
        {[
          { id: "edit", label: "Edit", icon: Edit3 },
          { id: "comments", label: "Comments", icon: MessageSquare, count: comments.length },
          { id: "traceability", label: "Traceability", icon: History, count: activities.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-indigo-600"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count && tab.count > 0 && (
                <motion.span 
                  className="text-[10px] bg-neutral-200 text-neutral-600 px-1.5 rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  {tab.count}
                </motion.span>
              )}
            </span>
            {activeTab === tab.id && (
              <motion.div 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                layoutId="activeTab"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === "edit" ? (
          <motion.div 
            className="p-4 space-y-4"
            key="edit"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Title - Inline editable */}
            <div>
              <textarea
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                rows={1}
                className="w-full text-lg font-semibold text-neutral-900 bg-transparent border-none outline-none resize-none placeholder:text-neutral-300 focus:ring-0"
                style={{ minHeight: "32px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = target.scrollHeight + "px";
                }}
              />
            </div>

            {/* Status Pills */}
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = status === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setStatus(option.value as typeof status)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${isSelected
                      ? `${option.bg} ${option.color} ${option.border} border`
                      : "text-neutral-400 hover:bg-neutral-100"
                      }`}
                  >
                    <Icon className="w-3 h-3" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe the content..."
                rows={6}
                className="w-full text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all"
              />
            </div>

            {/* Formula */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                Formula (LaTeX)
              </label>
              <input
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="e.g., $x^2 + y^2 = z^2$"
                className="w-full text-sm font-mono text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              />
            </div>

            {/* Lean Code */}
            <div>
              <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                Lean Code
              </label>
              <textarea
                value={leanCode}
                onChange={(e) => setLeanCode(e.target.value)}
                placeholder="-- Lean 4 proof code&#10;theorem example : ∀ a b : ℕ, a + b = b + a := by&#10;  intro a b&#10;  ring"
                rows={5}
                className="w-full text-sm font-mono text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none transition-all"
              />
            </div>

            {/* Contributors Preview */}
            {node.authors && node.authors.length > 0 && (
              <div className="pt-4 border-t border-neutral-100">
                <NodeContributors 
                  authors={node.authors} 
                  createdAt={node.createdAt}
                  updatedAt={node.updatedAt}
                  showFullList
                />
              </div>
            )}

            {/* Delete */}
            <div className="pt-4 border-t border-neutral-100">
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete node
              </button>
            </div>
          </motion.div>
        ) : activeTab === "comments" ? (
          /* Comments Tab */
          <motion.div 
            className="flex flex-col h-full"
            key="comments"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingComments ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-neutral-300 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No comments yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Start the discussion</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="group">
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
                        {comment.author.avatar_url ? (
                          <img
                            src={comment.author.avatar_url}
                            alt={comment.author.username}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-medium text-indigo-600">
                            {comment.author.username[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-800">
                            {comment.author.username}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleSubmitComment} className="p-3 border-t border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 text-sm px-3 py-2 bg-white border border-neutral-200 rounded-full outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-neutral-900 placeholder:text-neutral-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingComment ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* Traceability Tab */
          <motion.div 
            className="flex flex-col h-full"
            key="traceability"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Contributors Summary */}
            {node.authors && node.authors.length > 0 && (
              <div className="p-4 border-b border-neutral-100 bg-neutral-50/50">
                <NodeContributors 
                  authors={node.authors} 
                  createdAt={node.createdAt}
                  updatedAt={node.updatedAt}
                  showFullList
                />
              </div>
            )}
            
            {/* Activity Timeline */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Activity History
              </h3>
              <ActivityTimeline 
                activities={activities} 
                isLoading={loadingActivities}
                emptyMessage="No activity recorded yet"
              />
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
