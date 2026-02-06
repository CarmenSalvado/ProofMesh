"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Send,
  MessageSquare,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  Edit3,
  Save,
  History,
  Sparkles,
  Activity,
  Play,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { CanvasNode, NODE_TYPE_CONFIG } from "./types";
import { AuthorAvatar } from "./AuthorAvatar";
import { NodeContributors } from "./NodeContributors";
import { ActivityTimeline, ActivityEntry } from "./ActivityTimeline";
import { executeComputationNode, verifyLeanCode } from "@/lib/api";

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

interface LeanVerificationResult {
  success: boolean;
  log: string;
  error?: string;
}

const STATUS_OPTIONS = [
  { value: "PROPOSED", label: "Proposed", icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { value: "VERIFIED", label: "Verified", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { value: "REJECTED", label: "Rejected", icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
] as const;

const LEAN_NODE_TYPES = new Set(["FORMAL_TEST", "LEMMA", "THEOREM", "CLAIM", "DEFINITION", "COUNTEREXAMPLE"]);
const FORMULA_NODE_TYPES = new Set(["DEFINITION", "LEMMA", "THEOREM", "CLAIM", "COUNTEREXAMPLE"]);

function extractCodeFence(input: string, language: string): string {
  const regex = new RegExp("```" + language + "\\n([\\s\\S]*?)```", "i");
  const match = input.match(regex);
  if (!match || !match[1]) return "";
  return match[1].trim();
}

function defaultComputationCode(content: string): string {
  const fenced = extractCodeFence(content, "python") || extractCodeFence(content, "py");
  if (fenced) return fenced;
  if (content.trim().length > 0) return content;
  return "print('hello from computation node')";
}

function stripComputationCodeFromContent(content: string): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (!trimmed) return "";
  const withoutPythonFence = trimmed
    .replace(/```python[\s\S]*?```/gi, "")
    .replace(/```py[\s\S]*?```/gi, "");
  return withoutPythonFence.trim();
}

function buildComputationContent(notes: string, code: string): string {
  const trimmedNotes = notes.trim();
  const trimmedCode = code.trim();
  if (!trimmedNotes && !trimmedCode) return "```python\nprint('')\n```";
  if (!trimmedNotes) return `\`\`\`python\n${trimmedCode}\n\`\`\``;
  if (!trimmedCode) return trimmedNotes;
  return `${trimmedNotes}\n\n\`\`\`python\n${trimmedCode}\n\`\`\``;
}

function parseComputationVerification(
  verification?: Record<string, unknown> | null
): {
  success: boolean;
  stdout: string;
  stderr: string;
  error: string | null;
  duration_ms: number;
} | null {
  if (!verification) return null;
  const history = Array.isArray(verification.history) ? verification.history : [];
  const lastHistory = history.length > 0 ? history[history.length - 1] : null;
  const run = (lastHistory && typeof lastHistory === "object" ? lastHistory : verification) as Record<string, unknown>;
  const status = String(run.status ?? verification.status ?? "");
  if (!status) return null;
  const durationMs = Number(run.duration_ms ?? verification.duration_ms ?? 0) || 0;
  return {
    success: status === "pass",
    stdout: String(run.stdout ?? verification.stdout ?? ""),
    stderr: String(run.stderr ?? verification.stderr ?? ""),
    error: (run.error ?? verification.error ?? null) as string | null,
    duration_ms: durationMs,
  };
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.closest('[data-no-shortcuts="true"]')) return true;
  if (element.closest(".monaco-editor")) return true;
  if (element.isContentEditable) return true;
  const tagName = element.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
  const role = element.getAttribute("role");
  return role === "textbox" || role === "combobox";
};

function defaultLeanCode(node: CanvasNode): string {
  if (node.leanCode?.trim()) return node.leanCode.trim();
  const fenced = extractCodeFence(node.content || "", "lean");
  return fenced;
}

export function NodeDetailPanel({
  node,
  problemId,
  onClose,
  onSave,
  onDelete,
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "comments" | "traceability">("edit");

  const nodeType = (node.type || "NOTE").toUpperCase();
  const isComputation = nodeType === "COMPUTATION";
  const isLeanNode = LEAN_NODE_TYPES.has(nodeType);
  const showFormula = FORMULA_NODE_TYPES.has(nodeType);

  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content || "");
  const [formula, setFormula] = useState(node.formula || "");
  const [leanCode, setLeanCode] = useState(defaultLeanCode(node));
  const [pythonCode, setPythonCode] = useState(defaultComputationCode(node.content || ""));
  const [computationNotes, setComputationNotes] = useState(stripComputationCodeFromContent(node.content || ""));
  const [status, setStatus] = useState<"PROPOSED" | "VERIFIED" | "REJECTED">(
    node.status as "PROPOSED" | "VERIFIED" | "REJECTED"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [isExecutingPython, setIsExecutingPython] = useState(false);
  const [pythonExecution, setPythonExecution] = useState<{
    success: boolean;
    stdout: string;
    stderr: string;
    error: string | null;
    duration_ms: number;
  } | null>(null);

  const [isVerifyingLean, setIsVerifyingLean] = useState(false);
  const [leanVerification, setLeanVerification] = useState<LeanVerificationResult | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const typeConfig = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.NOTE;

  useEffect(() => {
    const nextContent = node.content || "";
    const nextLean = defaultLeanCode(node);
    const nextPython = defaultComputationCode(nextContent);
    const nextNotes = stripComputationCodeFromContent(nextContent);

    setTitle(node.title);
    setContent(nextContent);
    setFormula(node.formula || "");
    setLeanCode(nextLean);
    setPythonCode(nextPython);
    setComputationNotes(nextNotes);
    setStatus(node.status as "PROPOSED" | "VERIFIED" | "REJECTED");
    setPythonExecution(parseComputationVerification(node.verification));
    setLeanVerification(null);
  }, [node]);

  useEffect(() => {
    const baseContent = node.content || "";
    const baseLean = defaultLeanCode(node);
    const basePython = defaultComputationCode(baseContent);
    const baseNotes = stripComputationCodeFromContent(baseContent);

    const changed =
      title !== node.title ||
      status !== node.status ||
      (showFormula && formula !== (node.formula || "")) ||
      (isComputation ? (pythonCode !== basePython || computationNotes !== baseNotes) : content !== baseContent) ||
      (isLeanNode && leanCode !== baseLean);

    setHasChanges(changed);
  }, [
    title,
    status,
    formula,
    pythonCode,
    content,
    leanCode,
    computationNotes,
    node,
    isComputation,
    isLeanNode,
    showFormula,
  ]);

  const buildSavePayload = useCallback(() => {
    const computationContent = buildComputationContent(computationNotes, pythonCode);
    const contentValue = isComputation ? computationContent : content;
    const payloadContent = contentValue.trim();
    return {
      title: title.trim(),
      content: payloadContent || (isComputation ? "```python\nprint('')\n```" : ""),
      formula: showFormula ? formula.trim() || undefined : undefined,
      leanCode: isLeanNode ? leanCode.trim() || undefined : undefined,
      status,
    };
  }, [title, content, formula, leanCode, status, isComputation, isLeanNode, showFormula, pythonCode, computationNotes]);

  const handleSave = useCallback(async () => {
    const payload = buildSavePayload();
    if (!payload.title || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(node.id, payload);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  }, [node.id, onSave, isSaving, buildSavePayload]);

  const handleRunComputation = useCallback(async () => {
    if (!isComputation || !pythonCode.trim() || isExecutingPython) return;

    setIsExecutingPython(true);
    try {
      const result = await executeComputationNode(problemId, node.id, { code: pythonCode });
      setPythonExecution({
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        error: result.error,
        duration_ms: result.duration_ms,
      });

      const nextStatus: "PROPOSED" | "VERIFIED" = result.success ? "VERIFIED" : "PROPOSED";
      setStatus(nextStatus);

      await onSave(node.id, {
        ...buildSavePayload(),
        content: buildComputationContent(computationNotes, pythonCode),
        status: nextStatus,
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to execute computation:", error);
    } finally {
      setIsExecutingPython(false);
    }
  }, [isComputation, pythonCode, isExecutingPython, problemId, node.id, onSave, buildSavePayload, computationNotes]);

  const handleVerifyLean = useCallback(async () => {
    if (!isLeanNode || !leanCode.trim() || isVerifyingLean) return;

    setIsVerifyingLean(true);
    try {
      const result = await verifyLeanCode({
        problem_id: problemId,
        lean_code: leanCode,
      });

      const normalized: LeanVerificationResult = {
        success: result.success,
        log: result.log,
        error: result.error || undefined,
      };
      setLeanVerification(normalized);

      const logs = result.log || result.error || "";
      const nextStatus: "PROPOSED" | "VERIFIED" = result.success ? "VERIFIED" : "PROPOSED";
      setStatus(nextStatus);

      await onSave(node.id, {
        ...buildSavePayload(),
        leanCode,
        status: nextStatus,
        verification: {
          method: "lean4",
          logs,
          status: result.success ? "pass" : "fail",
        },
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to verify Lean:", error);
    } finally {
      setIsVerifyingLean(false);
    }
  }, [isLeanNode, leanCode, isVerifyingLean, problemId, node.id, onSave, buildSavePayload]);

  const loadComments = useCallback(async () => {
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
  }, [problemId, node.id]);

  const loadActivities = useCallback(async () => {
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
  }, [problemId, node.id]);

  useEffect(() => {
    loadComments();
    loadActivities();
  }, [node.id, loadComments, loadActivities]);

  useEffect(() => {
    if (activeTab === "comments") {
      loadComments();
    } else if (activeTab === "traceability") {
      loadActivities();
    }
  }, [activeTab, loadComments, loadActivities]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

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

  const creator = node.authors?.find((a) => a.type === "human");
  const hasAgent = node.authors?.some((a) => a.type === "agent");

  return (
    <motion.div
      className="absolute right-0 top-0 bottom-0 w-[460px] bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${typeConfig.color.replace("text-", "bg-")}`} />
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {typeConfig.label}
          </span>

          {creator && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-neutral-200">
              <AuthorAvatar author={creator} size="xs" showTooltip={false} />
              <span className="text-xs text-neutral-500">{creator.name || "Unknown"}</span>
            </div>
          )}

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
              {tab.count > 0 && (
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
              <div>
                <textarea
                  value={title}
                  data-no-shortcuts="true"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title"
                  rows={1}
                  className="w-full text-lg font-semibold text-neutral-900 bg-transparent border-none outline-none resize-none placeholder:text-neutral-300 focus:ring-0"
                  style={{ minHeight: "32px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {STATUS_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = status === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setStatus(option.value)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                        isSelected
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

              {isComputation ? (
                <>
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                      Notes (Markdown)
                    </label>
                    <textarea
                      value={computationNotes}
                      data-no-shortcuts="true"
                      onChange={(e) => setComputationNotes(e.target.value)}
                      placeholder="Short explanation of what this computation does..."
                      rows={3}
                      className="w-full text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-y transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                      Python Code
                    </label>
                    <div className="border border-neutral-200 rounded-lg overflow-hidden" data-no-shortcuts="true">
                      <Editor
                        height="240px"
                        defaultLanguage="python"
                        value={pythonCode}
                        onChange={(value) => setPythonCode(value || "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          wordWrap: "on",
                          automaticLayout: true,
                          tabSize: 4,
                        }}
                        theme="vs-light"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleRunComputation}
                      disabled={isExecutingPython || !pythonCode.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
                    >
                      {isExecutingPython ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Run Python
                    </button>
                  </div>

                  {pythonExecution && (
                    <div className="space-y-2">
                      <div className={`text-xs font-medium ${pythonExecution.success ? "text-emerald-600" : "text-red-600"}`}>
                        {pythonExecution.success ? "Execution succeeded" : "Execution failed"} ({pythonExecution.duration_ms} ms)
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Stdout</div>
                        <pre className="text-xs bg-neutral-900 text-neutral-100 rounded-lg p-2 overflow-auto max-h-40">{pythonExecution.stdout || "(empty)"}</pre>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Stderr</div>
                        <pre className="text-xs bg-neutral-900 text-rose-200 rounded-lg p-2 overflow-auto max-h-32">{pythonExecution.stderr || pythonExecution.error || "(empty)"}</pre>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                      {isLeanNode ? "Statement / Notes" : "Content"}
                    </label>
                    <textarea
                      value={content}
                      data-no-shortcuts="true"
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Describe the node content..."
                      rows={5}
                      className="w-full text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none transition-all"
                    />
                  </div>

                  {showFormula && (
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                        Formula (LaTeX)
                      </label>
                      <input
                        type="text"
                        value={formula}
                        data-no-shortcuts="true"
                        onChange={(e) => setFormula(e.target.value)}
                        placeholder="e.g., \\sum_{i=1}^n a_i"
                        className="w-full text-sm font-mono text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                      />
                    </div>
                  )}

                  {isLeanNode && (
                    <>
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                          Lean Code
                        </label>
                        <div className="border border-neutral-200 rounded-lg overflow-hidden" data-no-shortcuts="true">
                          <Editor
                            height="240px"
                            defaultLanguage="lean"
                            value={leanCode}
                            onChange={(value) => setLeanCode(value || "")}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              wordWrap: "on",
                              automaticLayout: true,
                              tabSize: 2,
                            }}
                            theme="vs-light"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleVerifyLean}
                          disabled={isVerifyingLean || !leanCode.trim()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isVerifyingLean ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <ShieldCheck className="w-3 h-3" />
                          )}
                          Verify Lean
                        </button>
                      </div>

                      {leanVerification && (
                        <div className="space-y-2">
                          <div className={`text-xs font-medium ${leanVerification.success ? "text-emerald-600" : "text-red-600"}`}>
                            {leanVerification.success ? "Lean verification passed" : "Lean verification failed"}
                          </div>
                          <div>
                            <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">Verifier Log</div>
                            <pre className="text-xs bg-neutral-900 text-neutral-100 rounded-lg p-2 overflow-auto max-h-40">{leanVerification.log || leanVerification.error || "(empty)"}</pre>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

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

              <form onSubmit={handleSubmitComment} className="p-3 border-t border-neutral-100 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newComment}
                    data-no-shortcuts="true"
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
            <motion.div
              className="flex flex-col h-full"
              key="traceability"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
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

              <div className="p-4 border-b border-neutral-100 bg-white">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <TerminalSquare className="w-3.5 h-3.5" />
                  Technical Context
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-neutral-200 p-2">
                    <div className="text-neutral-400">Node Type</div>
                    <div className="text-neutral-700 font-medium">{nodeType}</div>
                  </div>
                  <div className="rounded-lg border border-neutral-200 p-2">
                    <div className="text-neutral-400">Lean Support</div>
                    <div className="text-neutral-700 font-medium">{isLeanNode ? "Yes" : "No"}</div>
                  </div>
                </div>
              </div>

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
