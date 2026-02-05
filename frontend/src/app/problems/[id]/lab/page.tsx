"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import Editor, { type Monaco } from "@monaco-editor/react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import { useChat } from "@ai-sdk/react";
import {
  AlertTriangle,
  ArrowUp,
  BrainCircuit,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Download,
  FileCode,
  FileImage,
  FileText,
  FilePlus,
  Folder,
  FolderPlus,
  Infinity,
  Loader,
  Paperclip,
  ImageIcon,
  Play,
  Pencil,
  RefreshCw,
  LayoutGrid,
  Zap,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Square, // Added import
  BookOpen,
} from "lucide-react";
import {
  compileLatexProject,
  deleteLatexPath,
  createLatexAiAction,
  createLatexAiMessage,
  createLatexAiRun,
  deleteLatexAiTempMessages,
  deleteLatexAiAction,
  getLatexAiMemory,
  fetchLatexOutputLog,
  fetchLatexOutputPdf,
  getLatexFile,
  getProblem,
  listLatexAiActions,
  listLatexAiMessages,
  listLatexAiRuns,
  listLatexFiles,
  mapLatexPdfToSource,
  appendLatexAiRunEdit,
  appendLatexAiRunStep,
  putLatexFile,
  renameLatexPath,
  getCanvasBlocks,
  updateLatexAiMemory,
  updateLatexAiRunSummary,
  updateLatexAiRun,
  getLibraryItems,
  type LatexFileInfo,
  type LatexFileResponse,
  type Problem,
  type CanvasBlock,
} from "@/lib/api";
import { LibraryItem } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface PageProps {
  params: Promise<{ id: string }>;
}

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

type MentionSuggestion = {
  insert: string;
  label: string;
  type: "file" | "node" | "block";
  description?: string;
  preview?: string;
};

const AUTO_COMPILE_DELAY = 5000;
const SAVE_DEBOUNCE = 800;
const DEFAULT_MAIN = "main.tex";
const DEFAULT_ACTIONS = [
  { id: "clarity", label: "Improve clarity", prompt: "Improve clarity and flow without changing meaning." },
  { id: "latex", label: "Fix LaTeX", prompt: "Fix LaTeX errors and improve formatting." },
  { id: "shorten", label: "Shorten", prompt: "Shorten this text while preserving meaning." },
  { id: "cite", label: "Add citation", prompt: "Add a citation placeholder where appropriate." },
];

const LATEX_LANGUAGE_ID = "latex";
const EDIT_INTENT_PATTERN =
  /(add|insert|append|update|edit|rewrite|replace|fix|refactor|delete|remove|change|improve|shorten|expand|format|reformat|summarize|summarise|prove|derive|section|subsection|seccion|equation|theorem|lemma|proof|corrig|corrige|corrigir|correg|cambia|modifica|anade|agrega|inserta|borra|elimina|quita|mejor|resume|resumir|acorta|amplia|create|write|draft|paper|article|document|crea|crear|genera|generar|redacta|redactar|escribe|escribir|paper|articulo|documento)/i;

const normalizeInstruction = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const isEditIntent = (value: string) => EDIT_INTENT_PATTERN.test(normalizeInstruction(value));

const countLines = (value?: string) => (value ? value.split("\n").length : 0);

const escapeLatexText = (value: string) =>
  value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");

const looksLikeLatex = (value: string) =>
  /\\[a-zA-Z]+|\\begin\{|\\end\{|\\\[|\\\]|\$\$|\$/.test(value);

const normalizeLatexText = (value: string) => {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return looksLikeLatex(trimmed) ? trimmed : escapeLatexText(trimmed);
};

const estimateRemovedLines = (edit: { start: { line: number; column: number }; end: { line: number; column: number } }) => {
  const isPoint =
    edit.start.line === edit.end.line && edit.start.column === edit.end.column;
  if (isPoint) return 0;
  return Math.max(1, edit.end.line - edit.start.line + 1);
};

const makeEditKey = (
  runId: string | null,
  filePath: string,
  edit: { start: { line: number; column: number }; end: { line: number; column: number }; text: string }
) =>
  `${runId || "local"}:${filePath}:${edit.start.line}:${edit.start.column}:${edit.end.line}:${edit.end.column}:${edit.text}`;

const getLastAssistantIndex = (
  messages: Array<{ role?: string | null }>
) => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "assistant") return i;
  }
  return -1;
};

const extractMentionQuery = (value: string) => {
  const match = value.match(/(?:^|\s)@([A-Za-z0-9._\\/-]*)$/);
  if (!match) return null;
  return match[1] || "";
};

const extractMentions = (value: string) => {
  const mentions = new Set<string>();
  if (!value) return [];
  const regex = /@([A-Za-z0-9._\\/-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    mentions.add(match[1]);
  }
  return Array.from(mentions);
};

const AI_MODEL_IDS = {
  flash: "gemini-3-flash-preview",
  thinking: "gemini-3-flash-preview-thinking",
} as const;

const removeMention = (value: string, path: string) => {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`@${escaped}\\b\\s*`, "g");
  return value.replace(regex, "").replace(/\s{2,}/g, " ").trimStart();
};


const latexMonarch = {
  tokenizer: {
    root: [
      [/%.*/, "comment"],
      [/\\begin\{[a-zA-Z*]+\}/, "keyword"],
      [/\\end\{[a-zA-Z*]+\}/, "keyword"],
      [/\\[a-zA-Z@]+/, "keyword"],
      [/\\./, "keyword"],
      [/\$[^$]*\$/, "string"],
      [/\\\[[^\]]*\\\]/, "string"],
      [/\\\([^)]+\\\)/, "string"],
      [/[{}\\[\\]]/, "delimiter"],
      [/\\(label|ref|cite|eqref)\b/, "type.identifier"],
    ],
  },
};

const PDF_WORKER_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function buildDefaultLatex(title: string) {
  return `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{${title}}
\\author{}
\\date{}

\\begin{document}
\\maketitle

\\section{Introduction}
Write your notes here.

\\end{document}
`;
}

function normalizePath(value: string) {
  return value.replace(/^\/+/, "").trim();
}

function isImagePath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext || "");
}

function fileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (isImagePath(path)) return FileImage;
  if (ext === "tex" || ext === "sty" || ext === "cls") return FileText;
  return FileCode;
}

function buildTree(files: LatexFileInfo[]): FileNode {
  const root: FileNode = { name: "", path: "", type: "directory", children: [] };
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;
    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      if (isLeaf && part === ".keep") {
        return;
      }
      if (!current.children) current.children = [];
      let node = current.children.find((child) => child.name === part);
      if (!node) {
        node = {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          type: isLeaf ? "file" : "directory",
          children: isLeaf ? undefined : [],
        };
        current.children.push(node);
      }
      if (!isLeaf) {
        current = node;
      }
    });
  }

  const sortNode = (node: FileNode) => {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "directory" ? -1 : 1;
    });
    node.children.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

export default function LabPage({ params }: PageProps) {
  const { id: problemId } = use(params);
  const { user } = useAuth();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [files, setFiles] = useState<LatexFileInfo[]>([]);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set([""]));
  const [activePath, setActivePath] = useState<string>(DEFAULT_MAIN);
  const [openTabs, setOpenTabs] = useState<string[]>([DEFAULT_MAIN]);
  const [createTarget, setCreateTarget] = useState<{
    type: "file" | "folder";
    parent: string;
  } | null>(null);
  const [createValue, setCreateValue] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [editorValue, setEditorValue] = useState<string>("");
  const [binaryPreview, setBinaryPreview] = useState<LatexFileResponse | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [compileState, setCompileState] = useState<"idle" | "running" | "success" | "error" | "timeout">("idle");
  const [compileLog, setCompileLog] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfSyncNotice, setPdfSyncNotice] = useState<string | null>(null);
  const [autoCompileAt, setAutoCompileAt] = useState<number | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(260);
  const [chatWidth, setChatWidth] = useState(360);
  const [rightWidth, setRightWidth] = useState(480);
  const [logHeight, setLogHeight] = useState(160);
  const [aiInput, setAiInput] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "sending" | "error">("idle");
  const [aiApplying, setAiApplying] = useState(false);
  const [aiThoughts, setAiThoughts] = useState<string[]>([]);
  const [aiMemory, setAiMemory] = useState("");
  const [aiRuns, setAiRuns] = useState<
    Array<{
      id: string;
      prompt: string;
      steps: string[];
      summary?: string;
      timestamp: string;
      edits: Array<{
        start: { line: number; column: number };
        end: { line: number; column: number };
        text: string;
      }>;
      filePath: string;
      selection: string;
    }>
  >([]);
  const [aiTab, setAiTab] = useState<"chat" | "context" | "edits" | "history" | "memory">("chat");
  const [aiContext, setAiContext] = useState<{
    filePath: string;
    selection: string;
    instruction: string;
  }>({ filePath: "", selection: "", instruction: "" });
  const [aiMessages, setAiMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string; runId?: string }>
  >([]);
  const [customActions, setCustomActions] = useState<Array<{ id: string; label: string; prompt: string }>>(
    DEFAULT_ACTIONS
  );
  const [newActionLabel, setNewActionLabel] = useState("");
  const [newActionPrompt, setNewActionPrompt] = useState("");
  const [selectionBox, setSelectionBox] = useState<{ top: number; left: number } | null>(null);
  const [aiHistory, setAiHistory] = useState<
    { id: string; timestamp: string; summary: string; content: string }[]
  >([]);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<"files" | "chats" | "knowledge">("files");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeSelection, setKnowledgeSelection] = useState<{ type: "node" | "block"; id: string } | null>(null);
  const [persistentChats, setPersistentChats] = useState<
    Array<{
      id: string;
      title: string;
      createdAt: string;
      messages: Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string }>;
    }>
  >([]);
  const [activePersistentChatId, setActivePersistentChatId] = useState<string | null>(null);
  const [tempChatOpen, setTempChatOpen] = useState(false);
  const [selectionContextLines, setSelectionContextLines] = useState<
    Array<{ line: number; text: string }>
  >([]);
  const [mentionOpen, setMentionOpen] = useState<"temp" | "persistent" | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [canvasNodes, setCanvasNodes] = useState<LibraryItem[]>([]);
  const [canvasNodesLoaded, setCanvasNodesLoaded] = useState(false);
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>([]);
  const [canvasBlocksLoaded, setCanvasBlocksLoaded] = useState(false);
  const [aiModelMode, setAiModelMode] = useState<"flash" | "thinking">("flash");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const selectionRangeLabel = useMemo(() => {
    if (selectionContextLines.length === 0) return null;
    const start = selectionContextLines[0]?.line;
    const end = selectionContextLines[selectionContextLines.length - 1]?.line;
    if (!start || !end) return null;
    const range = start === end ? `${start}` : `${start}-${end}`;
    return `${activePath}:${range}`;
  }, [selectionContextLines, activePath]);
  const [contextDismissed, setContextDismissed] = useState(false);
  const [aiChanges, setAiChanges] = useState<
    Array<{
      id: string;
      key: string;
      edit: { start: { line: number; column: number }; end: { line: number; column: number }; text: string };
      hasInsert: boolean;
      hasRemove: boolean;
      addedLines: number;
      removedLines: number;
      summary?: string;
      filePath: string;
      runId?: string;
      status?: "pending" | "accepted" | "rejected";
    }>
  >([]);
  const [aiChangeLog, setAiChangeLog] = useState<Record<string, typeof aiChanges>>({});
  const [tempMessageRunIds, setTempMessageRunIds] = useState<Record<string, string>>({});
  const tempPersistedIdsRef = useRef<Set<string>>(new Set());
  const [aiChangeIndex, setAiChangeIndex] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<{
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  } | null>(null);

  const saveTimeoutRef = useRef<number | null>(null);
  const compileTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadRef = useRef<HTMLInputElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const pdfViewportRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const pendingCursorRef = useRef<{ path: string; line: number; column: number } | null>(null);
  const completionProviderRef = useRef(false);
  const aiStreamAbortRef = useRef<AbortController | null>(null);
  const aiRunIdRef = useRef<string | null>(null);
  const aiPersistRef = useRef(false);
  const selectionAskRef = useRef<HTMLDivElement | null>(null);
  const aiMemorySaveRef = useRef<number | null>(null);
  const aiStoreLoadedRef = useRef(false);
  const aiDiffDecorationsRef = useRef<string[]>([]);
  const aiReviewSnapshotRef = useRef<string | null>(null);
  const aiReviewEditsRef = useRef<number>(0);
  const aiSeenEditsRef = useRef<Set<string>>(new Set());
  const dragRef = useRef<{
    type: "left" | "chat" | "right" | "log" | null;
    startX: number;
    startY: number;
    leftWidth: number;
    chatWidth: number;
    rightWidth: number;
    logHeight: number;
  } | null>(null);

  const toLocalTime = useCallback((value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  const aiModelId = aiModelMode === "thinking" ? AI_MODEL_IDS.thinking : AI_MODEL_IDS.flash;
  const selectionContextMeta = useMemo(() => {
    if (!selectionRangeLabel) return "";
    return selectionRangeLabel;
  }, [selectionRangeLabel]);
  const canvasNodesContext = useCallback(
    (ids: string[]) => {
      if (!ids.length) return "";
      const summarizeNode = (node: LibraryItem) => {
        const content = (node.content || "").replace(/\s+/g, " ").trim();
        const snippet = content.slice(0, 280);
        const suffix = content.length > 280 ? "…" : "";
        const verification = node.verification?.status ? `, verification: ${node.verification.status}` : "";
        return `${node.kind.toLowerCase()}: ${node.title} (status: ${node.status.toLowerCase()}${verification})\nContent: ${snippet}${suffix}`;
      };
      const lines = ids
        .map((id) => canvasNodes.find((node) => node.id === id))
        .filter(Boolean)
        .map((node) => summarizeNode(node as LibraryItem));
      if (!lines.length) return "";
      return `Canvas nodes selected:\n${lines.join("\n")}`;
    },
    [canvasNodes]
  );
  const canvasBlocksContext = useCallback(
    (ids: string[]) => {
      if (!ids.length) return "";
      const lines = ids
        .map((id) => canvasBlocks.find((block) => block.id === id))
        .filter(Boolean)
        .map((block) => {
          const nodes = block?.node_ids
            ?.map((nodeId) => canvasNodes.find((node) => node.id === nodeId))
            .filter(Boolean) as LibraryItem[];
          const nodeSummaries = nodes
            .slice(0, 5)
            .map((node) => {
              const content = (node.content || "").replace(/\s+/g, " ").trim();
              const snippet = content.slice(0, 180);
              const suffix = content.length > 180 ? "…" : "";
              return `- ${node.kind.toLowerCase()}: ${node.title}\n  ${snippet}${suffix}`;
            })
            .join("\n");
          const extra =
            nodes && nodes.length > 5 ? `\n  …and ${nodes.length - 5} more nodes` : "";
          return `Block "${block?.name}" (${block?.node_ids?.length || 0} nodes):\n${nodeSummaries}${extra}`;
        });
      if (!lines.length) return "";
      return `Canvas blocks selected:\n${lines.join("\n\n")}`;
    },
    [canvasBlocks, canvasNodes]
  );
  const activeChat = useMemo(
    () => persistentChats.find((chat) => chat.id === activePersistentChatId) || null,
    [persistentChats, activePersistentChatId]
  );
  const persistentChatKey = activePersistentChatId ?? "none";
  const {
    messages: persistentMessages,
    setMessages: setPersistentMessages,
    input: persistentInput,
    append: appendPersistent,
    setInput: setPersistentInput,
    isLoading: persistentLoading,
  } = useChat({
    api: "/api/latex-ai/chat",
    id: persistentChatKey,
    initialMessages:
      activeChat?.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(),
      })) ?? [],
  });

  const {
    messages: tempMessages,
    setMessages: setTempMessages,
    input: tempInput,
    append: appendTemp,
    setInput: setTempInput,
    isLoading: tempLoading,
  } = useChat({
    api: "/api/latex-ai/chat",
    id: "temp",
  });
  const persistentMentions = useMemo(() => extractMentions(persistentInput), [persistentInput]);
  const tempMentions = useMemo(() => extractMentions(tempInput), [tempInput]);

  const persistentMentionFiles = useMemo(
    () => persistentMentions.filter((item) => !item.startsWith("node-") && !item.startsWith("block-")),
    [persistentMentions]
  );
  const tempMentionFiles = useMemo(
    () => tempMentions.filter((item) => !item.startsWith("node-") && !item.startsWith("block-")),
    [tempMentions]
  );
  const persistentMentionNodes = useMemo(
    () =>
      persistentMentions
        .filter((item) => item.startsWith("node-"))
        .map((item) => item.replace(/^node-/, "")),
    [persistentMentions]
  );
  const tempMentionNodes = useMemo(
    () =>
      tempMentions
        .filter((item) => item.startsWith("node-"))
        .map((item) => item.replace(/^node-/, "")),
    [tempMentions]
  );
  const persistentMentionBlocks = useMemo(
    () =>
      persistentMentions
        .filter((item) => item.startsWith("block-"))
        .map((item) => item.replace(/^block-/, "")),
    [persistentMentions]
  );
  const tempMentionBlocks = useMemo(
    () =>
      tempMentions
        .filter((item) => item.startsWith("block-"))
        .map((item) => item.replace(/^block-/, "")),
    [tempMentions]
  );
  const attachedImagesMeta = useMemo(() => {
    if (attachedImages.length === 0) return "";
    return `Attached images: ${attachedImages.join(", ")}`;
  }, [attachedImages]);
  const lastTempAssistantIndex = getLastAssistantIndex(tempMessages);

  const handleClearTempChat = useCallback(() => {
    setTempMessages([]);
    setTempMessageRunIds({});
    tempPersistedIdsRef.current = new Set();
    void deleteLatexAiTempMessages(problemId).catch((error) => {
      console.warn("Failed to clear temp chat", error);
    });
  }, [setTempMessages, problemId]);

  const isUuid = useCallback(
    (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      ),
    []
  );

  const canEdit = useMemo(() => {
    if (!user || !problem) return false;
    return user.id === problem.author.id;
  }, [user, problem]);


  const loadProblem = useCallback(async () => {
    try {
      const data = await getProblem(problemId);
      setProblem(data);
      setWorkspaceReady(true);
    } catch (error) {
      console.error("Failed to load problem", error);
      setWorkspaceReady(false);
    }
  }, [problemId]);

  const refreshFiles = useCallback(async () => {
    if (!workspaceReady) return;
    try {
      const listing = await listLatexFiles(problemId);
      let nextFiles = listing.files;
      const hasMain = nextFiles.some((file) => file.path === DEFAULT_MAIN);
      if (!hasMain && canEdit) {
        const title = problem?.title || "Untitled";
        await putLatexFile(problemId, DEFAULT_MAIN, {
          content: buildDefaultLatex(title),
          content_type: "text/plain",
        });
        const reloaded = await listLatexFiles(problemId);
        nextFiles = reloaded.files;
      }
      setFiles(nextFiles);
      setFileTree(buildTree(nextFiles));
      if (!nextFiles.some((file) => file.path === activePath)) {
        setActivePath(hasMain ? DEFAULT_MAIN : (nextFiles[0]?.path || DEFAULT_MAIN));
      }
      setOpenTabs((prev) => {
        const next = new Set(prev);
        next.add(activePath || DEFAULT_MAIN);
        if (!hasMain && nextFiles[0]?.path) {
          next.add(nextFiles[0].path);
        }
        return Array.from(next);
      });
    } catch (error) {
      console.error("Failed to load LaTeX files", error);
    }
  }, [workspaceReady, problemId, canEdit, problem?.title, activePath]);

  const loadFile = useCallback(
    async (path: string) => {
      setFileLoading(true);
      setBinaryPreview(null);
      activeRequestRef.current = path;
      try {
        const file = await getLatexFile(problemId, path);
        if (activeRequestRef.current !== path) return;
        if (file.is_binary) {
          setBinaryPreview(file);
          setEditorValue("");
        } else {
          setEditorValue(file.content || "");
        }
        setSaveState("idle");
      } catch (error) {
        console.error("Failed to load file", error);
      } finally {
        if (activeRequestRef.current === path) {
          setFileLoading(false);
        }
      }
    },
    [problemId]
  );

  const loadPdf = useCallback(async () => {
    try {
      const blob = await fetchLatexOutputPdf(problemId);
      setPdfBlob(blob);
      const nextUrl = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
    } catch (error) {
      console.warn("No PDF yet", error);
      setPdfBlob(null);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [problemId]);

  const loadLog = useCallback(async () => {
    try {
      const log = await fetchLatexOutputLog(problemId);
      setCompileLog(log);
    } catch (error) {
      console.warn("No log yet", error);
    }
  }, [problemId]);

  const renderPdfPage = useCallback(
    async (pageNumber: number, zoom: number) => {
      const doc = pdfDocRef.current;
      const canvas = pdfCanvasRef.current;
      if (!doc || !canvas) return;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: zoom });
      pdfViewportRef.current = viewport;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
    },
    []
  );

  const runCompile = useCallback(
    async (source: "manual" | "auto") => {
      if (!canEdit) return;
      if (compileTimeoutRef.current) {
        window.clearTimeout(compileTimeoutRef.current);
      }
      if (pendingSaveRef.current) {
        try {
          await pendingSaveRef.current;
        } catch {
          // Ignore and attempt compile anyway
        }
      }
      setCompileState("running");
      setAutoCompileAt(null);
      try {
        const compileTarget =
          activePath && (activePath.endsWith(".tex") || activePath.endsWith(".ltx"))
            ? activePath
            : DEFAULT_MAIN;
        const response = await compileLatexProject(problemId, compileTarget);
        setCompileLog(response.log || "");
        if (response.status === "success") {
          setCompileState("success");
          await loadPdf();
        } else if (response.status === "timeout") {
          setCompileState("timeout");
        } else {
          setCompileState("error");
        }
        if (source === "manual") {
          await loadLog();
        }
      } catch (error) {
        setCompileState("error");
        setCompileLog(error instanceof Error ? error.message : "Failed to compile");
      }
    },
    [problemId, canEdit, loadPdf, loadLog, activePath]
  );

  const scheduleSave = useCallback(
    (nextValue: string) => {
      if (!canEdit || binaryPreview) return;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        setSaveState("saving");
        const savePromise = putLatexFile(problemId, activePath, {
          content: nextValue,
          content_type: "text/plain",
        })
          .then(() => {
            setSaveState("saved");
          })
          .catch((error) => {
            console.error("Failed to save", error);
            setSaveState("error");
          })
          .finally(() => {
            pendingSaveRef.current = null;
          });
        pendingSaveRef.current = savePromise;
      }, SAVE_DEBOUNCE);
    },
    [problemId, activePath, canEdit, binaryPreview]
  );

  const scheduleCompile = useCallback(() => {
    if (!canEdit) return;
    if (compileTimeoutRef.current) {
      window.clearTimeout(compileTimeoutRef.current);
    }
    const target = Date.now() + AUTO_COMPILE_DELAY;
    setAutoCompileAt(target);
    compileTimeoutRef.current = window.setTimeout(() => {
      runCompile("auto");
    }, AUTO_COMPILE_DELAY);
  }, [runCompile, canEdit]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const nextValue = value ?? "";
      setEditorValue(nextValue);
      setSaveState("saving");
      scheduleSave(nextValue);
      scheduleCompile();
    },
    [scheduleSave, scheduleCompile]
  );

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    const hasLatex = monaco.languages
      .getLanguages()
      .some((lang: { id: string }) => lang.id === LATEX_LANGUAGE_ID);

    if (!hasLatex) {
      monaco.languages.register({ id: LATEX_LANGUAGE_ID });
    }

    monaco.languages.setMonarchTokensProvider(LATEX_LANGUAGE_ID, latexMonarch as any);
    monaco.languages.setLanguageConfiguration(LATEX_LANGUAGE_ID, {
      comments: { lineComment: "%" },
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "\"", close: "\"" },
        { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "\"", close: "\"" },
        { open: "'", close: "'" },
      ],
    });

    if (!completionProviderRef.current) {
      completionProviderRef.current = true;
      monaco.languages.registerCompletionItemProvider(LATEX_LANGUAGE_ID, {
        triggerCharacters: ["\\", "{", "$"],
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
          const kind = monaco.languages.CompletionItemKind;

          const suggestions = [
            {
              label: "section",
              kind: kind.Function,
              insertText: "\\\\section{${1:Title}}\\n$0",
              range,
              insertTextRules: snippet,
            },
            {
              label: "subsection",
              kind: kind.Function,
              insertText: "\\\\subsection{${1:Title}}\\n$0",
              range,
              insertTextRules: snippet,
            },
            {
              label: "subsubsection",
              kind: kind.Function,
              insertText: "\\\\subsubsection{${1:Title}}\\n$0",
              range,
              insertTextRules: snippet,
            },
            {
              label: "begin...end",
              kind: kind.Snippet,
              insertText: "\\\\begin{${1:env}}\\n  $0\\n\\\\end{${1:env}}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "itemize",
              kind: kind.Snippet,
              insertText: "\\\\begin{itemize}\\n  \\\\item $0\\n\\\\end{itemize}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "enumerate",
              kind: kind.Snippet,
              insertText: "\\\\begin{enumerate}\\n  \\\\item $0\\n\\\\end{enumerate}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "align",
              kind: kind.Snippet,
              insertText: "\\\\begin{align}\\n  $0\\n\\\\end{align}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "equation",
              kind: kind.Snippet,
              insertText: "\\\\begin{equation}\\n  $0\\n\\\\end{equation}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "figure",
              kind: kind.Snippet,
              insertText:
                "\\\\begin{figure}[ht]\\n  \\\\centering\\n  \\\\includegraphics[width=${1:\\\\linewidth}]{${2:figura}}\\n  \\\\caption{${3:Caption}}\\n  \\\\label{fig:${4:label}}\\n\\\\end{figure}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "table",
              kind: kind.Snippet,
              insertText:
                "\\\\begin{table}[ht]\\n  \\\\centering\\n  \\\\caption{${1:Caption}}\\n  \\\\label{tab:${2:label}}\\n  \\\\begin{tabular}{${3:c}}\\n    $0\\n  \\\\end{tabular}\\n\\\\end{table}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "cite",
              kind: kind.Function,
              insertText: "\\\\cite{${1:key}}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "ref",
              kind: kind.Function,
              insertText: "\\\\ref{${1:label}}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "label",
              kind: kind.Function,
              insertText: "\\\\label{${1:label}}",
              range,
              insertTextRules: snippet,
            },
            {
              label: "inline math",
              kind: kind.Snippet,
              insertText: "$${1:}$$",
              range,
              insertTextRules: snippet,
            },
            {
              label: "display math",
              kind: kind.Snippet,
              insertText: "\\\\[\\n  $0\\n\\\\]",
              range,
              insertTextRules: snippet,
            },
          ];

          return { suggestions };
        },
      });
    }

    monaco.editor.defineTheme("proofmesh-latex", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "525252" },
        { token: "keyword", foreground: "7dd3fc" },
        { token: "string", foreground: "fcd34d" },
        { token: "delimiter", foreground: "737373" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
        "editorLineNumber.foreground": "#333333",
        "editorLineNumber.activeForeground": "#525252",
        "editorCursor.foreground": "#e5e5e5",
        "editorCursor.background": "#0a0a0a",
        "editor.selectionBackground": "rgba(180, 180, 180, 0.18)",
        "editor.inactiveSelectionBackground": "rgba(140, 140, 140, 0.1)",
        "editor.selectionHighlightBackground": "rgba(180, 180, 180, 0.12)",
        "editor.findMatchBackground": "rgba(180, 180, 180, 0.2)",
        "editor.findMatchHighlightBackground": "rgba(180, 180, 180, 0.12)",
        "editor.findRangeHighlightBackground": "rgba(180, 180, 180, 0.12)",
        "editor.wordHighlightBackground": "rgba(140, 140, 140, 0.18)",
        "editor.wordHighlightStrongBackground": "rgba(140, 140, 140, 0.25)",
        "editor.wordHighlightTextBackground": "rgba(140, 140, 140, 0.18)",
        "diffEditor.insertedTextBackground": "rgba(160, 160, 160, 0.12)",
        "diffEditor.insertedLineBackground": "rgba(160, 160, 160, 0.08)",
        "diffEditor.removedTextBackground": "rgba(160, 160, 160, 0.12)",
        "diffEditor.removedLineBackground": "rgba(160, 160, 160, 0.08)",
        "editor.lineHighlightBackground": "#0a0a0a",
        "editor.lineHighlightBorder": "#0a0a0a",
        "editor.rangeHighlightBackground": "#00000000",
        "editor.symbolHighlightBackground": "#00000000",
        "editorWhitespace.foreground": "#262626",
        "editorIndentGuide.background": "#1a1a1a",
        "editorIndentGuide.activeBackground": "#2a2a2a",
        "editorError.foreground": "#f87171",
        "editorError.background": "#00000000",
        "editorError.border": "#00000000",
        "editorWarning.foreground": "#fbbf24",
        "editorWarning.background": "#00000000",
        "editorWarning.border": "#00000000",
        "editorInfo.foreground": "#60a5fa",
        "editorInfo.background": "#00000000",
        "editorInfo.border": "#00000000",
        "editorHint.foreground": "#a3a3a3",
        "editorHint.background": "#00000000",
        "editorHint.border": "#00000000",
      },
    });
  }, []);

  const handleEditorMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.setTheme("proofmesh-latex");
    const model = editor?.getModel?.();
    if (model) {
      monaco.editor.setModelLanguage(model, LATEX_LANGUAGE_ID);
    }

    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        setSelectionBox(null);
        setSelectionContextLines([]);
        setContextDismissed(true);
        return;
      }
      const endPos = selection.getEndPosition();
      const coords = editor.getScrolledVisiblePosition(endPos);
      const domNode = editor.getDomNode();
      if (!coords || !domNode) return;
      const rect = domNode.getBoundingClientRect();
      setSelectionBox({
        top: rect.top + coords.top - 42,
        left: rect.left + coords.left - 20,
      });

      const model = editor.getModel?.();
      if (!model) return;
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      const lines: Array<{ line: number; text: string }> = [];
      for (let line = startLine; line <= endLine; line += 1) {
        const text = model.getLineContent(line).trim();
        lines.push({ line: line as number, text });
        if (lines.length >= 4) break;
      }
      const filtered = lines.filter((item) => item.text.length > 0);
      if (filtered.length > 0) {
        setSelectionContextLines(filtered);
        setContextDismissed(false);
      }
    });
  }, []);

  const handleSelectFile = useCallback(
    (path: string) => {
      if (path === activePath) return;
      setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
      setActivePath(path);
    },
    [activePath]
  );

  const submitCreate = useCallback(async () => {
    if (!createTarget) return;
    const raw = createValue.trim();
    if (!raw) {
      setCreateTarget(null);
      setCreateValue("");
      return;
    }
    const normalized = normalizePath(
      createTarget.parent ? `${createTarget.parent}/${raw}` : raw
    );
    if (!normalized || normalized.includes("..")) {
      setCreateTarget(null);
      setCreateValue("");
      return;
    }
    if (createTarget.type === "folder") {
      await putLatexFile(problemId, `${normalized}/.keep`, {
        content: "",
        content_type: "text/plain",
      });
    } else {
      await putLatexFile(problemId, normalized, { content: "", content_type: "text/plain" });
      setOpenTabs((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
      setActivePath(normalized);
    }
    setCreateTarget(null);
    setCreateValue("");
    await refreshFiles();
  }, [createTarget, createValue, problemId, refreshFiles]);

  const submitRename = useCallback(async () => {
    if (!renameTarget) return;
    const raw = renameValue.trim();
    if (!raw) {
      setRenameTarget(null);
      setRenameValue("");
      return;
    }
    const parent = renameTarget.includes("/")
      ? renameTarget.split("/").slice(0, -1).join("/")
      : "";
    const normalized = normalizePath(raw.includes("/") ? raw : parent ? `${parent}/${raw}` : raw);
    if (normalized === renameTarget) {
      setRenameTarget(null);
      setRenameValue("");
      return;
    }
    if (!normalized || normalized.includes("..")) {
      setRenameTarget(null);
      setRenameValue("");
      return;
    }
    await renameLatexPath(problemId, renameTarget, normalized);
    setOpenTabs((prev) => prev.map((tab) => (tab === renameTarget ? normalized : tab)));
    if (activePath === renameTarget) {
      setActivePath(normalized);
    }
    setRenameTarget(null);
    setRenameValue("");
    await refreshFiles();
  }, [renameTarget, renameValue, problemId, refreshFiles, activePath]);

  const handleCreateFile = useCallback(
    (parent: string) => {
      if (!canEdit) return;
      setCreateTarget({ type: "file", parent });
      setCreateValue("");
      setRenameTarget(null);
      setDeleteTarget(null);
    },
    [canEdit]
  );

  const handleCreateFolder = useCallback(
    (parent: string) => {
      if (!canEdit) return;
      setCreateTarget({ type: "folder", parent });
      setCreateValue("");
      setRenameTarget(null);
      setDeleteTarget(null);
    },
    [canEdit]
  );

  const handleDeleteFile = useCallback(
    async (path: string, isFolder: boolean) => {
      if (!canEdit) return;
      await deleteLatexPath(problemId, path, isFolder);
      setOpenTabs((prev) => prev.filter((tab) => tab !== path));
      if (activePath === path) {
        setActivePath(DEFAULT_MAIN);
      }
      setDeleteTarget(null);
      await refreshFiles();
    },
    [problemId, canEdit, refreshFiles, activePath]
  );

  const handleCloseTab = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const index = prev.indexOf(path);
        if (index === -1) return prev;
        const next = prev.filter((item) => item !== path);
        if (path === activePath) {
          const fallback = next[index - 1] || next[index] || next[0] || DEFAULT_MAIN;
          setActivePath(fallback);
        }
        return next.length ? next : [DEFAULT_MAIN];
      });
    },
    [activePath]
  );

  const handleCloseAllTabs = useCallback(() => {
    setOpenTabs([DEFAULT_MAIN]);
    setActivePath(DEFAULT_MAIN);
    setActivePersistentChatId(null);
  }, []);

  const startRename = useCallback((path: string) => {
    setRenameTarget(path);
    setRenameValue(path);
    setCreateTarget(null);
    setDeleteTarget(null);
  }, []);

  const cancelRename = useCallback(() => {
    setRenameTarget(null);
    setRenameValue("");
  }, []);

  const cancelCreate = useCallback(() => {
    setCreateTarget(null);
    setCreateValue("");
  }, []);

  const startDelete = useCallback((path: string) => {
    setDeleteTarget(path);
    setCreateTarget(null);
    setRenameTarget(null);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleUploadClick = useCallback(() => {
    if (!canEdit) return;
    uploadInputRef.current?.click();
  }, [canEdit]);

  const handleImageUploadClick = useCallback(() => {
    if (!canEdit) return;
    imageUploadRef.current?.click();
  }, [canEdit]);

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const basePath = normalizePath(
        activePath.includes("/") ? activePath.split("/").slice(0, -1).join("/") : "assets"
      );
      const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          const commaIndex = result.indexOf(",");
          if (commaIndex === -1) {
            reject(new Error("Failed to read file"));
            return;
          }
          resolve(result.slice(commaIndex + 1));
        };
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      await putLatexFile(problemId, fullPath, {
        content_base64: base64,
        content_type: file.type || "application/octet-stream",
      });
      event.target.value = "";
      await refreshFiles();
    },
    [problemId, refreshFiles]
  );

  const insertAtCursor = useCallback((text: string) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel?.();
    if (!editor || !monaco || !model) return;
    const selection = editor.getSelection?.();
    if (!selection) return;
    editor.executeEdits(
      "user-insert",
      [
        {
          range: selection,
          text,
          forceMoveMarkers: true,
        },
      ]
    );
    editor.focus?.();
  }, []);

  const ensureGraphicxPackage = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel?.();
    if (!editor || !monaco || !model) return;
    const value = model.getValue();
    if (value.includes("\\usepackage{graphicx}")) return;
    const lines = value.split("\n");
    const docClassIndex = lines.findIndex((line: string) => line.startsWith("\\documentclass"));
    const insertLine = docClassIndex >= 0 ? docClassIndex + 1 : 0;
    const range = new monaco.Range(insertLine + 1, 1, insertLine + 1, 1);
    editor.executeEdits("user-insert", [
      { range, text: "\\usepackage{graphicx}\n", forceMoveMarkers: true },
    ]);
  }, []);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file) return;
    const basePath = "assets";
    const fullPath = `${basePath}/${file.name}`;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const commaIndex = result.indexOf(",");
        if (commaIndex === -1) {
          reject(new Error("Failed to read file"));
          return;
        }
        resolve(result.slice(commaIndex + 1));
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
    await putLatexFile(problemId, fullPath, {
      content_base64: base64,
      content_type: file.type || "application/octet-stream",
    });
    await refreshFiles();
    ensureGraphicxPackage();
    insertAtCursor(`\\includegraphics[width=\\linewidth]{${fullPath}}\n`);
    setAttachedImages((prev) => (prev.includes(fullPath) ? prev : [...prev, fullPath]));
  }, [problemId, refreshFiles, ensureGraphicxPackage, insertAtCursor]);

  const getMentionSuggestions = useCallback(
    (query: string): MentionSuggestion[] => {
      const normalized = query.toLowerCase();
      const fileMatches: MentionSuggestion[] = files
        .map((file) => file.path)
        .filter((path) => path.toLowerCase().includes(normalized))
        .slice(0, 6)
        .map((path) => ({
          insert: path,
          label: path,
          type: "file" as const,
          description: "LaTeX file or asset",
        }));

      const blockMatches: MentionSuggestion[] = canvasBlocks
        .filter((block) => block.name.toLowerCase().includes(normalized))
        .slice(0, 4)
        .map((block) => {
          const nodes = block.node_ids
            .map((id) => canvasNodes.find((node) => node.id === id))
            .filter(Boolean) as LibraryItem[];
          const nodeTitles = nodes.slice(0, 3).map((node) => node.title).join(" • ");
          return {
            insert: `block-${block.id}`,
            label: block.name,
            type: "block" as const,
            description: `${nodes.length} nodes`,
            preview: nodeTitles || "No nodes",
          };
        });

      const nodeMatches: MentionSuggestion[] = canvasNodes
        .filter((node) => {
          const content = (node.content || "").toLowerCase();
          return (
            node.title.toLowerCase().includes(normalized) ||
            node.id.toLowerCase().includes(normalized) ||
            content.includes(normalized)
          );
        })
        .slice(0, 5)
        .map((node) => {
          const content = (node.content || "").replace(/\s+/g, " ").trim();
          const snippet = content.slice(0, 220);
          const suffix = content.length > 220 ? "…" : "";
          return {
            insert: `node-${node.id}`,
            label: node.title,
            type: "node" as const,
            description: `${node.kind.toLowerCase()} • status ${node.status.toLowerCase()}`,
            preview: snippet ? `${snippet}${suffix}` : undefined,
          };
        });

      return [...fileMatches, ...blockMatches, ...nodeMatches];
    },
    [files, canvasNodes, canvasBlocks]
  );

  const applyMention = useCallback(
    (value: string, suggestion: MentionSuggestion, setValue: (next: string) => void) => {
      const next = value.replace(/@([A-Za-z0-9._\\/-]*)$/, `@${suggestion.insert} `);
      setValue(next);
      setMentionOpen(null);
      setMentionQuery("");
      setMentionIndex(0);
    },
    []
  );

  const mentionSuggestions = useMemo(
    () => getMentionSuggestions(mentionQuery),
    [mentionQuery, getMentionSuggestions]
  );

  const buildMentionContext = useCallback(
    (mentions: string[]) => {
      const mentionFiles = mentions.filter((item) => !item.startsWith("node-") && !item.startsWith("block-"));
      const mentionNodes = mentions
        .filter((item) => item.startsWith("node-"))
        .map((item) => item.replace(/^node-/, ""));
      const mentionBlocks = mentions
        .filter((item) => item.startsWith("block-"))
        .map((item) => item.replace(/^block-/, ""));

      const parts = [
        selectionRangeLabel && !contextDismissed ? selectionContextMeta : "",
        canvasBlocksContext(mentionBlocks),
        canvasNodesContext(mentionNodes),
        mentionFiles.length ? `Mentioned files: ${mentionFiles.join(", ")}` : "",
        attachedImagesMeta,
        editorValue,
        selectionContextLines.map((item) => `L${item.line}: ${item.text}`).join("\n"),
      ];
      return parts.filter(Boolean).join("\n\n");
    },
    [
      selectionRangeLabel,
      contextDismissed,
      selectionContextMeta,
      canvasBlocksContext,
      canvasNodesContext,
      attachedImagesMeta,
      editorValue,
      selectionContextLines,
    ]
  );

  const filteredCanvasNodes = useMemo(() => {
    const query = knowledgeQuery.trim().toLowerCase();
    if (!query) return canvasNodes;
    return canvasNodes.filter((node) => {
      const content = (node.content || "").toLowerCase();
      return (
        node.title.toLowerCase().includes(query) ||
        node.kind.toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query) ||
        content.includes(query)
      );
    });
  }, [canvasNodes, knowledgeQuery]);

  const filteredCanvasBlocks = useMemo(() => {
    const query = knowledgeQuery.trim().toLowerCase();
    if (!query) return canvasBlocks;
    return canvasBlocks.filter((block) => {
      const nodeTitles = block.node_ids
        .map((id) => canvasNodes.find((node) => node.id === id))
        .filter(Boolean)
        .map((node) => (node as LibraryItem).title.toLowerCase())
        .join(" ");
      return block.name.toLowerCase().includes(query) || nodeTitles.includes(query);
    });
  }, [canvasBlocks, canvasNodes, knowledgeQuery]);

  useEffect(() => {
    if (!knowledgeSelection) return;
    if (knowledgeSelection.type === "node") {
      const exists = canvasNodes.some((node) => node.id === knowledgeSelection.id);
      if (!exists) setKnowledgeSelection(null);
      return;
    }
    const exists = canvasBlocks.some((block) => block.id === knowledgeSelection.id);
    if (!exists) setKnowledgeSelection(null);
  }, [knowledgeSelection, canvasNodes, canvasBlocks]);

  const knowledgeGraphLayout = useMemo(() => {
    const nodeById = new Map(filteredCanvasNodes.map((node) => [node.id, node]));
    const blockClusters = filteredCanvasBlocks
      .map((block) => {
        const nodeIds = block.node_ids.filter((id) => nodeById.has(id));
        return { id: block.id, name: block.name, nodeIds, isUnassigned: false };
      })
      .filter((block) => block.nodeIds.length > 0);

    const assigned = new Set<string>();
    blockClusters.forEach((block) => block.nodeIds.forEach((id) => assigned.add(id)));
    const unassigned = filteredCanvasNodes
      .filter((node) => !assigned.has(node.id))
      .map((node) => node.id);

    if (unassigned.length > 0) {
      blockClusters.push({
        id: "unassigned",
        name: "Unassigned",
        nodeIds: unassigned,
        isUnassigned: true,
      });
    }

    const clusters = blockClusters.length > 0
      ? blockClusters
      : filteredCanvasNodes.length > 0
        ? [{
          id: "all",
          name: "All Nodes",
          nodeIds: filteredCanvasNodes.map((node) => node.id),
          isUnassigned: true,
        }]
        : [];

    const MAP_WIDTH = 360;
    const MAP_HEIGHT = 240;
    const padding = 24;
    const columns = clusters.length > 4 ? 3 : clusters.length > 1 ? 2 : 1;
    const rows = Math.ceil(clusters.length / columns);
    const cellWidth = (MAP_WIDTH - padding * 2) / columns;
    const cellHeight = (MAP_HEIGHT - padding * 2) / rows;

    const positions = new Map<string, { x: number; y: number }>();
    const clusterPositions = clusters.map((cluster, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const centerX = padding + cellWidth * (col + 0.5);
      const centerY = padding + cellHeight * (row + 0.5);
      const radius = Math.min(cellWidth, cellHeight) * 0.42;
      const nodeCount = cluster.nodeIds.length;
      const nodeRadius = Math.min(radius * 0.75, 54);

      cluster.nodeIds.forEach((id, idx) => {
        if (nodeCount === 1) {
          positions.set(id, { x: centerX, y: centerY });
          return;
        }
        const angle = (idx / nodeCount) * Math.PI * 2;
        positions.set(id, {
          x: centerX + Math.cos(angle) * nodeRadius,
          y: centerY + Math.sin(angle) * nodeRadius,
        });
      });

      return {
        ...cluster,
        centerX,
        centerY,
        radius,
      };
    });

    const edges = filteredCanvasNodes.flatMap((node) =>
      (node.dependencies || [])
        .filter((dep) => positions.has(dep))
        .map((dep) => ({ from: dep, to: node.id }))
    );

    return {
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      clusters: clusterPositions,
      positions,
      edges,
    };
  }, [filteredCanvasNodes, filteredCanvasBlocks]);

  const getNodeColor = useCallback((node: LibraryItem) => {
    const kind = node.kind.toLowerCase();
    const palette: Record<string, string> = {
      lemma: "#60a5fa",
      theorem: "#f472b6",
      definition: "#34d399",
      axiom: "#fbbf24",
      claim: "#a78bfa",
      idea: "#38bdf8",
      content: "#fca5a5",
      note: "#9ca3af",
    };
    return palette[kind] || "#9ca3af";
  }, []);

  const getNodeStroke = useCallback((node: LibraryItem) => {
    const status = node.status.toLowerCase();
    if (status === "verified") return "#34d399";
    if (status === "rejected") return "#f87171";
    if (status === "proposed") return "#fbbf24";
    return "#3f3f46";
  }, []);

  const appendMentionToken = useCallback(
    (token: string) => {
      const apply = (prev: string) => {
        const trimmed = prev.replace(/\s+$/, "");
        return trimmed ? `${trimmed} @${token} ` : `@${token} `;
      };
      if (activePersistentChatId) {
        setPersistentInput((prev) => apply(prev));
        setMentionOpen("persistent");
        return;
      }
      setTempChatOpen(true);
      setTempInput((prev) => apply(prev));
      setMentionOpen("temp");
    },
    [activePersistentChatId, setPersistentInput, setTempInput, setTempChatOpen]
  );

  const buildNodeLatexSnippet = useCallback((node: LibraryItem) => {
    const title = escapeLatexText(node.title || "Untitled");
    const content = normalizeLatexText(node.content || "");
    const kind = (node.kind || "NOTE").toLowerCase();
    const status = (node.status || "PROPOSED").toLowerCase();
    const formula = node.formula ? node.formula.trim() : "";
    const formattedFormula = formula
      ? /\$|\\\[|\\\]/.test(formula)
        ? formula
        : `\\[\n${formula}\n\\]`
      : "";
    const parts = [
      `% canvas-node:${node.id}`,
      `% ${kind} (${status})`,
      `\\paragraph{${title}}`,
      content,
      formattedFormula,
      "",
    ];
    return `${parts.filter(Boolean).join("\n")}\n`;
  }, []);

  const buildBlockLatexSnippet = useCallback(
    (block: CanvasBlock) => {
      const name = escapeLatexText(block.name || "Canvas Block");
      const nodes = block.node_ids
        .map((id) => canvasNodes.find((node) => node.id === id))
        .filter(Boolean) as LibraryItem[];
      const items = nodes
        .map((node) => `\\item ${escapeLatexText(node.title)} (${node.kind.toLowerCase()})`)
        .join("\n");
      const parts = [
        `% canvas-block:${block.id}`,
        `\\subsection*{${name}}`,
        items ? "\\begin{itemize}\n" + items + "\n\\end{itemize}" : "",
        "",
      ];
      return `${parts.filter(Boolean).join("\n")}\n`;
    },
    [canvasNodes]
  );

  const refreshCanvasKnowledge = useCallback(async () => {
    try {
      const [blocks, nodes] = await Promise.all([
        getCanvasBlocks(problemId).catch(() => []),
        getLibraryItems(problemId),
      ]);
      setCanvasBlocks(blocks || []);
      setCanvasNodes(nodes.items || []);
      setCanvasBlocksLoaded(true);
      setCanvasNodesLoaded(true);
    } catch (error) {
      console.warn("Failed to refresh canvas knowledge", error);
    }
  }, [problemId]);

  const selectedKnowledgeNode = useMemo(() => {
    if (!knowledgeSelection || knowledgeSelection.type !== "node") return null;
    return canvasNodes.find((node) => node.id === knowledgeSelection.id) || null;
  }, [knowledgeSelection, canvasNodes]);

  const selectedKnowledgeBlock = useMemo(() => {
    if (!knowledgeSelection || knowledgeSelection.type !== "block") return null;
    return canvasBlocks.find((block) => block.id === knowledgeSelection.id) || null;
  }, [knowledgeSelection, canvasBlocks]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handlePrevPage = useCallback(() => {
    setPdfPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPdfPage((prev) => (pdfPages ? Math.min(pdfPages, prev + 1) : prev));
  }, [pdfPages]);

  const handleZoomIn = useCallback(() => {
    setPdfZoom((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPdfZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));
  }, []);

  const handleZoomReset = useCallback(() => {
    setPdfZoom(1);
  }, []);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<Error | null>(null);

  const handleCreatePersistentChat = useCallback(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const title = `New chat`;
    setPersistentChats((prev) => [
      ...prev,
      {
        id,
        title,
        createdAt,
        messages: [],
      },
    ]);
    setActivePersistentChatId(id);
    setLeftTab("chats");
  }, []);

  const parseNdjsonLine = useCallback((line: string) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }, []);

  const normalizeEdits = useCallback(
    (
      edits: Array<{ start: { line: number; column: number }; end: { line: number; column: number }; text: string }>,
      options?: { ignoreSelection?: boolean }
    ) =>
      edits
        .filter((edit) => edit && edit.start && edit.end)
        .map((edit) => ({
          ...edit,
          start: {
            line: Math.max(1, Number(edit.start.line || 1)),
            column: Math.max(1, Number(edit.start.column || 1)),
          },
          end: {
            line: Math.max(1, Number(edit.end.line || 1)),
            column: Math.max(1, Number(edit.end.column || 1)),
          },
        }))
        .filter((edit) => {
          // DEBUG: Log filtering logic
          if (options?.ignoreSelection || !pendingSelection) return true;
          const { startLine, startColumn, endLine, endColumn } = pendingSelection;

          // Safety: If selection is a single point (cursor), ignore it as a constraint
          if (startLine === endLine && startColumn === endColumn) return true;

          const withinStart =
            edit.start.line > startLine ||
            (edit.start.line === startLine && edit.start.column >= startColumn);
          const withinEnd =
            edit.end.line < endLine || (edit.end.line === endLine && edit.end.column <= endColumn);

          if (!withinStart || !withinEnd) {
            console.warn("Edit rejected by selection constraint", { edit, pendingSelection });
          }
          return withinStart && withinEnd;
        })
        .sort((a, b) => {
          if (a.start.line !== b.start.line) return b.start.line - a.start.line;
          return b.start.column - a.start.column;
        }),
    [pendingSelection]
  );

  const renderDiffDecorations = useCallback(
    (changes: typeof aiChanges, activeIndex: number) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const model = editor?.getModel?.();
      if (!editor || !monaco || !model) return;
      const decorations = changes.flatMap((change, index) => {
        const isActive = index === activeIndex;
        const edit = change.edit;
        const range = new monaco.Range(edit.start.line, edit.start.column, edit.end.line, edit.end.column);
        const isPureDelete = change.removedLines > 0 && !edit.text;
        const removed = isPureDelete
          ? [{
            range: new monaco.Range(edit.start.line, 1, edit.start.line, 1),
            options: {
              className: `pm-diff-removed${isActive ? " pm-diff-active" : ""}`,
              linesDecorationsClassName: "pm-diff-removed-gutter",
              isWholeLine: true,
            },
          }]
          : [];
        const added = edit.text
          ? (() => {
            const lines = edit.text.split("\n");
            const startLine = edit.start.line;
            const startColumn = edit.start.column;
            const endLine = startLine + lines.length - 1;
            const endColumn =
              lines.length === 1 ? startColumn + lines[0].length : lines[lines.length - 1].length + 1;
            return [{
              range: new monaco.Range(startLine, startColumn, endLine, endColumn),
              options: {
                className: `pm-diff-added${isActive ? " pm-diff-active" : ""}`,
                inlineClassName: `pm-diff-added-inline${isActive ? " pm-diff-active" : ""}`,
                linesDecorationsClassName: "pm-diff-added-gutter",
              },
            }];
          })()
          : [];
        return [...removed, ...added];
      });
      aiDiffDecorationsRef.current = editor.deltaDecorations(aiDiffDecorationsRef.current, decorations);
    },
    []
  );

  const clearDiffDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    aiDiffDecorationsRef.current = editor.deltaDecorations(aiDiffDecorationsRef.current, []);
  }, []);

  const clearSelectionContext = useCallback(() => {
    setSelectionContextLines([]);
    setContextDismissed(true);
  }, []);

  const applyEdits = useCallback(
    (edits: Array<{ start: { line: number; column: number }; end: { line: number; column: number }; text: string }>, summary?: string) => {
      const editor = editorRef.current;
      const model = editor?.getModel?.();
      const monaco = monacoRef.current;
      if (!editor || !model || !monaco || edits.length === 0) return false;

      const safeEdits = normalizeEdits(edits);

      if (safeEdits.length === 0) return false;

      if (!aiReviewSnapshotRef.current) {
        aiReviewSnapshotRef.current = model.getValue();
        aiReviewEditsRef.current = 0;
      }

      const removedLineCounts: number[] = [];
      const applyNowEdits: typeof safeEdits = [];

      safeEdits.forEach((edit, index) => {
        const range = new monaco.Range(
          edit.start.line,
          edit.start.column,
          edit.end.line,
          edit.end.column
        );
        const oldText = model.getValueInRange(range);
        removedLineCounts[index] = countLines(oldText);
        if (edit.text) {
          applyNowEdits.push(edit);
        }
      });

      if (applyNowEdits.length > 0) {
        editor.pushUndoStop?.();
        editor.executeEdits(
          "ai-edit",
          applyNowEdits.map((edit) => ({
            range: new monaco.Range(
              edit.start.line,
              edit.start.column,
              edit.end.line,
              edit.end.column
            ),
            text: edit.text ?? "",
            forceMoveMarkers: true,
          }))
        );
        editor.pushUndoStop?.();
      }
      const changeItems = safeEdits.map((edit, index) => {
        const addedLines = countLines(edit.text);
        const removedLines = removedLineCounts[index] || 0;
        const runId = aiRunIdRef.current;
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          key: makeEditKey(runId ?? null, activePath, edit),
          edit,
          hasInsert: addedLines > 0,
          hasRemove: removedLines > 0,
          addedLines,
          removedLines,
          summary,
          filePath: activePath,
          runId: runId || undefined,
          status: "pending" as const,
        };
      });
      setAiChanges((prev) => {
        const next = [...prev, ...changeItems];
        setAiChangeIndex(next.length - 1);
        return next;
      });
      if (aiRunIdRef.current) {
        setAiChangeLog((prev) => {
          const existing = prev[aiRunIdRef.current!] || [];
          return { ...prev, [aiRunIdRef.current!]: [...existing, ...changeItems] };
        });
      }
      aiReviewEditsRef.current += safeEdits.length;
      setAiReviewOpen(true);
      return true;
    },
    [normalizeEdits, activePath]
  );

  const applyEditsRaw = useCallback(
    (edits: Array<{ start: { line: number; column: number }; end: { line: number; column: number }; text: string }>) => {
      const editor = editorRef.current;
      const model = editor?.getModel?.();
      const monaco = monacoRef.current;
      if (!editor || !model || !monaco || edits.length === 0) return false;
      const safeEdits = normalizeEdits(edits, { ignoreSelection: true });
      if (safeEdits.length === 0) return false;
      editor.pushUndoStop?.();
      editor.executeEdits(
        "ai-edit",
        safeEdits.map((edit) => ({
          range: new monaco.Range(
            edit.start.line,
            edit.start.column,
            edit.end.line,
            edit.end.column
          ),
          text: edit.text ?? "",
          forceMoveMarkers: true,
        }))
      );
      editor.pushUndoStop?.();
      return true;
    },
    [normalizeEdits]
  );

  const snapshotVersion = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (!model) return;
    const content = model.getValue();
    const now = new Date();
    setAiHistory((prev) => [
      {
        id: `${Date.now()}`,
        timestamp: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        summary: "AI edit",
        content,
      },
      ...prev,
    ]);
  }, []);

  const runEdit = useCallback(
    async (instruction: string, options?: { forceEdit?: boolean }) => {
      const trimmed = instruction.trim();
      if (!trimmed || aiStatus === "sending") return;
      const forceEdit = Boolean(options?.forceEdit);

      const editor = editorRef.current;
      const model = editor?.getModel?.();
      const selection = editor?.getSelection?.();
      if (!editor || !model) return;

      const selectionText = selection ? model.getValueInRange(selection) : "";
      const content = model.getValue();
      const mentionContext = buildMentionContext(extractMentions(trimmed));

      setAiChanges([]);
      setAiChangeIndex(0);
      aiReviewSnapshotRef.current = null;
      aiReviewEditsRef.current = 0;
      aiSeenEditsRef.current = new Set();
      clearDiffDecorations();

      const isSelectionEmpty = selection?.isEmpty() ?? true;

      setPendingSelection(
        selection && !isSelectionEmpty
          ? {
            startLine: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLine: selection.endLineNumber,
            endColumn: selection.endColumn,
          }
          : null
      );

      snapshotVersion();
      setAiContext({
        filePath: activePath,
        selection: selectionText,
        instruction: trimmed,
      });
      setAiApplying(true);
      setAiStatus("sending");
      setAiInput("");
      setAiLoading(true);
      setAiError(null);
      setAiThoughts([]);

      let runId = "";
      let timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      try {
        const run = await createLatexAiRun(problemId, {
          prompt: trimmed,
          file_path: activePath,
          selection: selectionText || undefined,
        });
        runId = run.id;
        aiPersistRef.current = true;
        aiRunIdRef.current = runId;
        timestamp = toLocalTime(run.created_at) || timestamp;
        setAiRuns((prev) => [
          {
            id: runId,
            prompt: trimmed,
            steps: [],
            edits: [],
            filePath: activePath,
            selection: selectionText,
            timestamp,
            summary: run.summary || undefined,
          },
          ...prev,
        ]);
        setAiMessages((prev) => [
          ...prev,
          { id: `${runId}-user`, role: "user", content: trimmed, timestamp, runId },
        ]);
        void createLatexAiMessage(problemId, {
          role: "user",
          content: trimmed,
          run_id: runId,
        }).catch((error) => {
          console.warn("Failed to persist AI message", error);
        });
      } catch (error) {
        console.warn("AI store unavailable, falling back to local session", error);
        runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        aiPersistRef.current = false;
        aiRunIdRef.current = runId;
        setAiRuns((prev) => [
          {
            id: runId,
            prompt: trimmed,
            steps: [],
            edits: [],
            filePath: activePath,
            selection: selectionText,
            timestamp,
          },
          ...prev,
        ]);
        setAiMessages((prev) => [
          ...prev,
          { id: `${runId}-user`, role: "user", content: trimmed, timestamp, runId },
        ]);
      }

      aiStreamAbortRef.current?.abort();
      const controller = new AbortController();
      aiStreamAbortRef.current = controller;

      let failed = false;
      try {
        const response = await fetch("/api/latex-ai/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction: trimmed,
            file_path: activePath,
            selection: selectionText || undefined,
            content,
            memory: aiMemory || undefined,
            force_edit: forceEdit,
            model_id: aiModelId,
            context_files: mentionContext || undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(await response.text());
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let index = buffer.indexOf("\n");
          while (index !== -1) {
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + 1);
            if (line) {
              const payload = parseNdjsonLine(line);
              if (payload?.type === "comment" && payload.text) {
                const text = String(payload.text);
                if (text.startsWith("Thinking:")) {
                  setAiThoughts((prev) => [...prev, text.replace("Thinking:", "").trim()]);
                  continue;
                }
                const currentRunId = aiRunIdRef.current;
                const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                setAiMessages((prev) => [
                  ...prev,
                  {
                    id: `${aiRunIdRef.current}-assistant-${Date.now()}`,
                    role: "assistant",
                    content: text,
                    timestamp,
                    runId: aiRunIdRef.current || undefined,
                  },
                ]);
                // Sync with visible temp messages
                const tempMsgId = `${aiRunIdRef.current}-comment-${Date.now()}`;
                setTempMessages((prev) => [
                  ...prev,
                  {
                    id: tempMsgId,
                    role: "assistant",
                    content: text,
                    createdAt: new Date(),
                  },
                ]);
                if (aiRunIdRef.current) {
                  setTempMessageRunIds((prev) => ({ ...prev, [tempMsgId]: aiRunIdRef.current as string }));
                }
                setAiRuns((prev) =>
                  prev.map((run) =>
                    run.id === aiRunIdRef.current
                      ? { ...run, steps: [...run.steps, text] }
                      : run
                  )
                );
                if (currentRunId && aiPersistRef.current && isUuid(currentRunId)) {
                  // Sync with visible persistent messages
                  setPersistentMessages((prev) => [
                    ...prev,
                    {
                      id: `${aiRunIdRef.current}-comment-persistent-${Date.now()}`,
                      role: "assistant",
                      content: text,
                      createdAt: new Date(),
                    },
                  ]);
                  void createLatexAiMessage(problemId, {
                    role: "assistant",
                    content: text,
                    run_id: currentRunId,
                  }).catch((error) => {
                    console.warn("Failed to persist AI message", error);
                  });
                  void appendLatexAiRunStep(problemId, currentRunId, text).catch((error) => {
                    console.warn("Failed to persist AI step", error);
                  });
                }
              }
              if (payload?.type === "edit" && Array.isArray(payload.edits)) {
                const currentRunId = aiRunIdRef.current;
                const nextEdits = payload.edits.filter(
                  (edit: { start: { line: number; column: number }; end: { line: number; column: number }; text: string }) => {
                    const key = makeEditKey(currentRunId, activePath, edit);
                    if (aiSeenEditsRef.current.has(key)) return false;
                    aiSeenEditsRef.current.add(key);
                    return true;
                  }
                );
                if (nextEdits.length > 0) {
                  applyEdits(nextEdits);
                }
                setAiRuns((prev) =>
                  prev.map((run) =>
                    run.id === aiRunIdRef.current
                      ? { ...run, edits: [...run.edits, ...payload.edits] }
                      : run
                  )
                );
                if (currentRunId && aiPersistRef.current && isUuid(currentRunId)) {
                  payload.edits.forEach((edit: { start: { line: number; column: number }; end: { line: number; column: number }; text: string }) => {
                    void appendLatexAiRunEdit(problemId, currentRunId, edit.start, edit.end, edit.text).catch((error) => {
                      console.warn("Failed to persist AI edit", error);
                    });
                  });
                }
              }
              if (payload?.type === "summary" && payload.text) {
                const summary = String(payload.text);
                setAiRuns((prev) =>
                  prev.map((run) =>
                    run.id === aiRunIdRef.current ? { ...run, summary } : run
                  )
                );
                // Also update aiChanges for the current run if they exist
                setAiChanges((prev) =>
                  prev.map((change) =>
                    change.summary === undefined ? { ...change, summary } : change
                  )
                );
                setAiHistory((prev) => {
                  if (prev.length === 0) return prev;
                  const [first, ...rest] = prev;
                  return [{ ...first, summary }, ...rest];
                });
                const currentRunId = aiRunIdRef.current;
                if (currentRunId && aiPersistRef.current && isUuid(currentRunId)) {
                  void updateLatexAiRunSummary(problemId, currentRunId, summary).catch((error) => {
                    console.warn("Failed to persist AI summary", error);
                  });
                }
              }
              if (payload?.type === "result") {
                const { comment, summary, edits, updated_content } = payload;
                const currentRunId = aiRunIdRef.current;
                if (comment) {
                  // Final explanation
                  setAiMessages((prev) => {
                    const exists = prev.some(m => m.content === comment);
                    if (exists) return prev;
                    return [...prev, {
                      id: `${aiRunIdRef.current}-final-comment-${Date.now()}`,
                      role: "assistant",
                      content: comment,
                      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      runId: aiRunIdRef.current || undefined,
                    }];
                  });
                  const tempFinalId = `${aiRunIdRef.current}-final-temp-${Date.now()}`;
                  setTempMessages((prev) => {
                    const exists = prev.some(m => m.content === comment);
                    if (exists) return prev;
                    return [...prev, {
                      id: tempFinalId,
                      role: "assistant",
                      content: comment,
                      createdAt: new Date(),
                    }];
                  });
                  if (aiRunIdRef.current) {
                    setTempMessageRunIds((prev) => ({ ...prev, [tempFinalId]: aiRunIdRef.current as string }));
                  }
                  if (currentRunId && aiPersistRef.current && isUuid(currentRunId)) {
                    setPersistentMessages((prev) => {
                      const exists = prev.some(m => m.content === comment);
                      if (exists) return prev;
                      return [
                        ...prev,
                        {
                          id: `${aiRunIdRef.current}-final-comment-persistent-${Date.now()}`,
                          role: "assistant",
                          content: comment,
                          createdAt: new Date(),
                        },
                      ];
                    });
                    void createLatexAiMessage(problemId, {
                      role: "assistant",
                      content: comment,
                      run_id: currentRunId,
                    }).catch((error) => {
                      console.warn("Failed to persist AI message", error);
                    });
                  }
                }
                if (summary) {
                  setAiRuns((prev) => prev.map((run) => run.id === aiRunIdRef.current ? { ...run, summary } : run));
                  setAiChanges((prev) => prev.map((change) => change.summary === undefined ? { ...change, summary } : change));
                  setAiHistory((prev) => prev.length === 0 ? prev : [{ ...prev[0], summary }, ...prev.slice(1)]);
                }
                if (currentRunId && aiPersistRef.current && isUuid(currentRunId)) {
                  payload.edits.forEach((edit: { start: { line: number; column: number }; end: { line: number; column: number }; text: string }) => {
                    void appendLatexAiRunEdit(problemId, currentRunId, edit.start, edit.end, edit.text).catch((error) => {
                      console.warn("Failed to persist AI edit", error);
                    });
                  });
                }
                if (Array.isArray(edits) && edits.length > 0) {
                  const currentRunId = aiRunIdRef.current;
                  const nextEdits = edits.filter(
                    (edit: { start: { line: number; column: number }; end: { line: number; column: number }; text: string }) => {
                      const key = makeEditKey(currentRunId, activePath, edit);
                      if (aiSeenEditsRef.current.has(key)) return false;
                      aiSeenEditsRef.current.add(key);
                      return true;
                    }
                  );
                  if (nextEdits.length > 0) {
                    applyEdits(nextEdits);
                  }
                  setAiRuns((prev) => prev.map((run) => run.id === aiRunIdRef.current ? { ...run, edits: [...run.edits, ...edits] } : run));
                  const changeItems = nextEdits.map((edit, idx) => {
                    const addedLines = countLines(edit.text);
                    const removedLines = estimateRemovedLines(edit);
                    const runId = aiRunIdRef.current;
                    return {
                      id: `${aiRunIdRef.current}-edit-res-${idx}-${Date.now()}`,
                      key: makeEditKey(runId ?? null, activePath, edit),
                      edit,
                      hasInsert: addedLines > 0,
                      hasRemove: removedLines > 0,
                      addedLines,
                      removedLines,
                      summary: summary || undefined,
                      filePath: activePath,
                      runId: runId || undefined,
                      status: "pending" as const,
                    };
                  });
                  setAiChanges((prev) => [...prev, ...changeItems]);
                  if (aiRunIdRef.current) {
                    const runKey = aiRunIdRef.current;
                    setAiChangeLog((prev) => ({
                      ...prev,
                      [runKey]: [...(prev[runKey] || []), ...changeItems],
                    }));
                  }
                } else if (updated_content) {
                  const lines = editorValue.split("\n");
                  const endLine = Math.max(1, lines.length);
                  const endColumn = lines.length ? lines[lines.length - 1].length + 1 : 1;
                  const fallbackEdit = [{ start: { line: 1, column: 1 }, end: { line: endLine, column: endColumn }, text: String(updated_content) }];
                  applyEdits(fallbackEdit);
                  setAiRuns((prev) => prev.map((run) => run.id === aiRunIdRef.current ? { ...run, edits: [...run.edits, ...fallbackEdit] } : run));
                  const fallbackItem = (() => {
                    const addedLines = countLines(fallbackEdit[0].text);
                    const removedLines = estimateRemovedLines(fallbackEdit[0]);
                    const runId = aiRunIdRef.current;
                    return {
                      id: `${aiRunIdRef.current}-edit-fallback-${Date.now()}`,
                      key: makeEditKey(runId ?? null, activePath, fallbackEdit[0]),
                      edit: fallbackEdit[0],
                      hasInsert: addedLines > 0,
                      hasRemove: removedLines > 0,
                      addedLines,
                      removedLines,
                      summary: summary || undefined,
                      filePath: activePath,
                      runId: runId || undefined,
                      status: "pending" as const,
                    };
                  })();
                  setAiChanges((prev) => [...prev, fallbackItem]);
                  if (aiRunIdRef.current) {
                    const runKey = aiRunIdRef.current;
                    setAiChangeLog((prev) => ({
                      ...prev,
                      [runKey]: [...(prev[runKey] || []), fallbackItem],
                    }));
                  }
                }
              }
            }
            index = buffer.indexOf("\n");
          }
        }

        const tail = buffer.trim();
        if (tail) {
          const payload = parseNdjsonLine(tail);
          if (payload?.type === "comment" && payload.text) {
            const text = String(payload.text);
            const currentRunId = aiRunIdRef.current;
            if (text.startsWith("Thinking:")) {
              setAiThoughts((prev) => [...prev, text.replace("Thinking:", "").trim()]);
            } else {
              const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              setAiMessages((prev) => [
                ...prev,
                {
                  id: `${aiRunIdRef.current}-assistant-${Date.now()}`,
                  role: "assistant",
                  content: text,
                  timestamp,
                  runId: aiRunIdRef.current || undefined,
                },
              ]);
              // ... rest of tail logic ...
            }
            // Sync with visible temp messages
            const tempTailId = `${aiRunIdRef.current}-comment-tail-${Date.now()}`;
            setTempMessages((prev) => [
              ...prev,
              {
                id: tempTailId,
                role: "assistant",
                content: text,
                createdAt: new Date(),
              },
            ]);
            if (aiRunIdRef.current) {
              setTempMessageRunIds((prev) => ({ ...prev, [tempTailId]: aiRunIdRef.current as string }));
            }
            setAiRuns((prev) =>
              prev.map((run) =>
                run.id === aiRunIdRef.current ? { ...run, steps: [...run.steps, text] } : run
              )
            );
            if (currentRunId && aiPersistRef.current && isUuid(currentRunId)) {
              // Sync with visible persistent messages
              setPersistentMessages((prev) => [
                ...prev,
                {
                  id: `${aiRunIdRef.current}-comment-persistent-tail-${Date.now()}`,
                  role: "assistant",
                  content: text,
                  createdAt: new Date(),
                },
              ]);
              void createLatexAiMessage(problemId, {
                role: "assistant",
                content: text,
                run_id: currentRunId,
              }).catch((error) => {
                console.warn("Failed to persist AI message", error);
              });
              void appendLatexAiRunStep(problemId, currentRunId, text).catch((error) => {
                console.warn("Failed to persist AI step", error);
              });
            }
          }
          if (payload?.type === "result") {
            const { comment, summary, edits, updated_content } = payload;
            const currentRunId = aiRunIdRef.current;
            if (comment) {
              setAiMessages((prev) => {
                const exists = prev.some(m => m.content === comment);
                if (exists) return prev;
                return [...prev, {
                  id: `${aiRunIdRef.current}-final-comment-tail-${Date.now()}`,
                  role: "assistant",
                  content: comment,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  runId: aiRunIdRef.current || undefined,
                }];
              });
              const tempFinalTailId = `${aiRunIdRef.current}-final-temp-tail-${Date.now()}`;
              setTempMessages((prev) => {
                const exists = prev.some(m => m.content === comment);
                if (exists) return prev;
                return [...prev, {
                  id: tempFinalTailId,
                  role: "assistant",
                  content: comment,
                  createdAt: new Date(),
                }];
              });
              if (aiRunIdRef.current) {
                setTempMessageRunIds((prev) => ({ ...prev, [tempFinalTailId]: aiRunIdRef.current as string }));
              }
              if (currentRunId && aiPersistRef.current && isUuid(currentRunId)) {
                setPersistentMessages((prev) => {
                  const exists = prev.some(m => m.content === comment);
                  if (exists) return prev;
                  return [
                    ...prev,
                    {
                      id: `${aiRunIdRef.current}-final-comment-persistent-tail-${Date.now()}`,
                      role: "assistant",
                      content: comment,
                      createdAt: new Date(),
                    },
                  ];
                });
                void createLatexAiMessage(problemId, {
                  role: "assistant",
                  content: comment,
                  run_id: currentRunId,
                }).catch((error) => {
                  console.warn("Failed to persist AI message", error);
                });
              }
            }
            if (summary) {
              setAiRuns((prev) => prev.map((run) => run.id === aiRunIdRef.current ? { ...run, summary } : run));
              setAiChanges((prev) => prev.map((change) => change.summary === undefined ? { ...change, summary } : change));
            }
            if (Array.isArray(edits) && edits.length > 0) {
              const currentRunId = aiRunIdRef.current;
              const nextEdits = edits.filter(
                (edit: { start: { line: number; column: number }; end: { line: number; column: number }; text: string }) => {
                  const key = makeEditKey(currentRunId, activePath, edit);
                  if (aiSeenEditsRef.current.has(key)) return false;
                  aiSeenEditsRef.current.add(key);
                  return true;
                }
              );
              if (nextEdits.length > 0) {
                applyEdits(nextEdits);
              }
              setAiRuns((prev) => prev.map((run) => run.id === aiRunIdRef.current ? { ...run, edits: [...run.edits, ...edits] } : run));
              const changeItems = nextEdits.map((edit, idx) => {
                const addedLines = countLines(edit.text);
                const removedLines = estimateRemovedLines(edit);
                const runId = aiRunIdRef.current;
                return {
                  id: `${aiRunIdRef.current}-edit-res-tail-${idx}-${Date.now()}`,
                  key: makeEditKey(runId ?? null, activePath, edit),
                  edit,
                  hasInsert: addedLines > 0,
                  hasRemove: removedLines > 0,
                  addedLines,
                  removedLines,
                  summary: summary || undefined,
                  filePath: activePath,
                  runId: runId || undefined,
                  status: "pending" as const,
                };
              });
              setAiChanges((prev) => [...prev, ...changeItems]);
              if (aiRunIdRef.current) {
                const runKey = aiRunIdRef.current;
                setAiChangeLog((prev) => ({
                  ...prev,
                  [runKey]: [...(prev[runKey] || []), ...changeItems],
                }));
              }
            } else if (updated_content) {
              const lines = editorValue.split("\n");
              const endLine = Math.max(1, lines.length);
              const endColumn = lines.length ? lines[lines.length - 1].length + 1 : 1;
              const fallbackEdit = [{ start: { line: 1, column: 1 }, end: { line: endLine, column: endColumn }, text: String(updated_content) }];
              applyEdits(fallbackEdit);
              setAiRuns((prev) => prev.map((run) => run.id === aiRunIdRef.current ? { ...run, edits: [...run.edits, ...fallbackEdit] } : run));
              const fallbackItem = (() => {
                const addedLines = countLines(fallbackEdit[0].text);
                const removedLines = estimateRemovedLines(fallbackEdit[0]);
                const runId = aiRunIdRef.current;
                return {
                  id: `${aiRunIdRef.current}-edit-fallback-tail-${Date.now()}`,
                  key: makeEditKey(runId ?? null, activePath, fallbackEdit[0]),
                  edit: fallbackEdit[0],
                  hasInsert: addedLines > 0,
                  hasRemove: removedLines > 0,
                  addedLines,
                  removedLines,
                  summary: summary || undefined,
                  filePath: activePath,
                  runId: runId || undefined,
                  status: "pending" as const,
                };
              })();
              setAiChanges((prev) => [...prev, fallbackItem]);
              if (aiRunIdRef.current) {
                const runKey = aiRunIdRef.current;
                setAiChangeLog((prev) => ({
                  ...prev,
                  [runKey]: [...(prev[runKey] || []), fallbackItem],
                }));
              }
            }
          }
        }
      } catch (error) {
        console.error("AI request failed", error);
        setAiError(error as Error);
        setAiStatus("error");
        failed = true;
      } finally {
        setAiApplying(false);
        setAiLoading(false);
        setAiStatus(failed ? "error" : "idle");
        if (!failed) {
          try {
            const response = await fetch("/api/latex-ai/reflect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                memory: aiMemory,
                instruction: trimmed,
                summary: aiRuns.find((run) => run.id === aiRunIdRef.current)?.summary || "",
                messages: aiMessages.slice(-8),
              }),
            });
            if (response.ok) {
              const data = await response.json();
              if (typeof data.memory === "string") {
                setAiMemory(data.memory);
              }
            }
          } catch (error) {
            console.warn("Memory reflect failed", error);
          }
        }
      }
    },
    [
      aiStatus,
      activePath,
      aiMemory,
      snapshotVersion,
      applyEdits,
      parseNdjsonLine,
      aiMessages,
      aiRuns,
      problemId,
      toLocalTime,
      clearDiffDecorations,
      setPersistentMessages,
      isUuid,
      buildMentionContext,
      editorValue,
    ]
  );

  const handleSendAi = useCallback(async () => {
    await runEdit(aiInput);
  }, [aiInput, runEdit]);

  const handleSendPersistentChat = useCallback(async () => {
    const text = persistentInput.trim();
    if (!text || !activePersistentChatId) return;
    const mentions = extractMentions(text);
    const context = buildMentionContext(mentions);
    setPersistentInput("");
    setMentionOpen(null);
    setMentionQuery("");
    if (isEditIntent(text)) {
      setPersistentMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "user",
          content: text,
          createdAt: new Date(),
        },
      ]);
      await runEdit(text, { forceEdit: true });
      return;
    }
    await appendPersistent(
      { role: "user", content: text },
      {
        body: {
          file_path: activePath,
          model_id: aiModelId,
          context,
        },
      }
    );
  }, [
    persistentInput,
    activePersistentChatId,
    appendPersistent,
    setPersistentInput,
    runEdit,
    setPersistentMessages,
    activePath,
    aiModelId,
    buildMentionContext,
  ]);

  const handleStopAi = useCallback(() => {
    aiStreamAbortRef.current?.abort();
    setAiLoading(false);
    setAiApplying(false);
    setAiStatus("idle");
  }, []);

  const handleSendTempChat = useCallback(async () => {
    const text = tempInput.trim();
    if (!text) return;
    const mentions = extractMentions(text);
    const context = buildMentionContext(mentions);
    setTempInput(""); // Immediate reset
    setMentionOpen(null);
    setMentionQuery("");
    if (isEditIntent(text)) {
      setTempMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "user",
          content: text,
          createdAt: new Date(),
        },
      ]);
      await runEdit(text, { forceEdit: true });
      return;
    }
    await appendTemp(
      { role: "user", content: text },
      {
        body: {
          file_path: activePath,
          model_id: aiModelId,
          context,
        },
      }
    );
  }, [
    tempInput,
    appendTemp,
    runEdit,
    setTempMessages,
    activePath,
    aiModelId,
    buildMentionContext,
  ]);

  const handleAcceptSingle = useCallback((id: string) => {
    const accepted = aiChanges.find((item) => item.id === id);
    if (accepted?.runId) {
      updateLatexAiRun(problemId, accepted.runId, { status: "accepted" }).catch(err => console.warn("Failed to update run status", err));
    }

    setAiChanges((prev) => {
      const accepted = prev.find((item) => item.id === id);
      if (accepted && !accepted.edit.text) {
        applyEditsRaw([accepted.edit]);
      }
      const next = prev.filter((item) => item.id !== id);
      if (next.length === 0) {
        aiReviewSnapshotRef.current = null;
        clearDiffDecorations();
        setAiReviewOpen(false);
      }
      return next;
    });
    setAiChangeLog((prev) => {
      const accepted = aiChanges.find((item) => item.id === id);
      const acceptedKey = accepted?.key;
      const next: typeof prev = {};
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          acceptedKey && item.key === acceptedKey ? { ...item, status: "accepted" } : item
        );
      });
      return next;
    });
  }, [applyEditsRaw, clearDiffDecorations, problemId, aiChanges]);

  const handleRejectSingle = useCallback((id: string) => {
    const rejected = aiChanges.find((item) => item.id === id);
    if (rejected?.runId) {
      updateLatexAiRun(problemId, rejected.runId, { status: "rejected" }).catch(err => console.warn("Failed to update run status", err));
    }

    setAiChanges((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const editor = editorRef.current;
      const model = editor?.getModel?.();
      if (model && aiReviewSnapshotRef.current !== null) {
        editor.pushUndoStop?.();
        model.setValue(aiReviewSnapshotRef.current);
        applyEditsRaw(next.map((n) => n.edit));
        editor.pushUndoStop?.();
      }
      if (next.length === 0) {
        aiReviewSnapshotRef.current = null;
        clearDiffDecorations();
        setAiReviewOpen(false);
      }
      return next;
    });
    setAiChangeLog((prev) => {
      const rejected = aiChanges.find((item) => item.id === id);
      const rejectedKey = rejected?.key;
      const next: typeof prev = {};
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          rejectedKey && item.key === rejectedKey ? { ...item, status: "rejected" } : item
        );
      });
      return next;
    });
  }, [clearDiffDecorations, applyEditsRaw, problemId, aiChanges]);

  const handleAcceptAll = useCallback(() => {
    const runIds = Array.from(new Set(aiChanges.map((change) => change.runId).filter(Boolean))) as string[];
    runIds.forEach((runId) => {
      updateLatexAiRun(problemId, runId, { status: "accepted" }).catch(console.warn);
    });

    setAiChanges((prev) => {
      const deletions = prev
        .filter((change) => !change.edit.text)
        .map((change) => change.edit);
      if (deletions.length > 0) {
        applyEditsRaw(deletions);
      }
      return [];
    });
    setAiChangeLog((prev) => {
      const activeKeys = new Set(aiChanges.map((item) => item.key));
      const next: typeof prev = {};
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          item.status === "pending" && activeKeys.has(item.key) ? { ...item, status: "accepted" } : item
        );
      });
      return next;
    });
    aiReviewSnapshotRef.current = null;
    clearDiffDecorations();
    setAiReviewOpen(false);
  }, [applyEditsRaw, clearDiffDecorations, aiChanges, problemId]);

  const handleAcceptIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const runIds = Array.from(
      new Set(aiChanges.filter((item) => ids.includes(item.id)).map((item) => item.runId).filter(Boolean))
    ) as string[];
    runIds.forEach((runId) => {
      updateLatexAiRun(problemId, runId, { status: "accepted" }).catch(console.warn);
    });
    setAiChanges((prev) => {
      const idSet = new Set(ids);
      const accepted = prev.filter((item) => idSet.has(item.id));
      const deletions = accepted.filter((item) => !item.edit.text).map((item) => item.edit);
      if (deletions.length > 0) {
        applyEditsRaw(deletions);
      }
      const next = prev.filter((item) => !idSet.has(item.id));
      if (next.length === 0) {
        aiReviewSnapshotRef.current = null;
        clearDiffDecorations();
        setAiReviewOpen(false);
      }
      setAiChangeIndex((current) => Math.min(current, Math.max(0, next.length - 1)));
      return next;
    });
    setAiChangeLog((prev) => {
      const idSet = new Set(ids);
      const acceptedKeys = new Set(
        aiChanges.filter((item) => idSet.has(item.id)).map((item) => item.key)
      );
      const next: typeof prev = {};
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          acceptedKeys.has(item.key) ? { ...item, status: "accepted" } : item
        );
      });
      return next;
    });
  }, [aiChanges, applyEditsRaw, clearDiffDecorations, problemId]);

  const handleRejectIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const runIds = Array.from(
      new Set(aiChanges.filter((item) => ids.includes(item.id)).map((item) => item.runId).filter(Boolean))
    ) as string[];
    runIds.forEach((runId) => {
      updateLatexAiRun(problemId, runId, { status: "rejected" }).catch(console.warn);
    });
    setAiChanges((prev) => {
      const idSet = new Set(ids);
      const next = prev.filter((item) => !idSet.has(item.id));
      const editor = editorRef.current;
      const model = editor?.getModel?.();
      if (model && aiReviewSnapshotRef.current !== null) {
        editor.pushUndoStop?.();
        model.setValue(aiReviewSnapshotRef.current);
        applyEditsRaw(next.map((n) => n.edit));
        editor.pushUndoStop?.();
      }
      if (next.length === 0) {
        aiReviewSnapshotRef.current = null;
        clearDiffDecorations();
        setAiReviewOpen(false);
      }
      setAiChangeIndex((current) => Math.min(current, Math.max(0, next.length - 1)));
      return next;
    });
    setAiChangeLog((prev) => {
      const idSet = new Set(ids);
      const rejectedKeys = new Set(
        aiChanges.filter((item) => idSet.has(item.id)).map((item) => item.key)
      );
      const next: typeof prev = {};
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          rejectedKeys.has(item.key) ? { ...item, status: "rejected" } : item
        );
      });
      return next;
    });
  }, [aiChanges, applyEditsRaw, clearDiffDecorations, problemId]);

  const handleRejectAll = useCallback(() => {
    const runIds = Array.from(new Set(aiChanges.map((change) => change.runId).filter(Boolean))) as string[];
    runIds.forEach((runId) => {
      updateLatexAiRun(problemId, runId, { status: "rejected" }).catch(console.warn);
    });

    const editor = editorRef.current;
    const model = editor?.getModel?.();
    if (model && aiReviewSnapshotRef.current !== null) {
      editor.pushUndoStop?.();
      model.setValue(aiReviewSnapshotRef.current);
      editor.pushUndoStop?.();
    }
    setAiChanges([]);
    setAiChangeLog((prev) => {
      const activeKeys = new Set(aiChanges.map((item) => item.key));
      const next: typeof prev = {};
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          item.status === "pending" && activeKeys.has(item.key) ? { ...item, status: "rejected" } : item
        );
      });
      return next;
    });
    aiReviewSnapshotRef.current = null;
    clearDiffDecorations();
    setAiReviewOpen(false);
  }, [clearDiffDecorations, aiChanges, problemId]);

  const handleAcceptAiEdits = useCallback(() => {
    setAiChanges((prev) => {
      if (prev.length === 0) return prev;
      const current = prev[aiChangeIndex];
      if (current?.runId) {
        updateLatexAiRun(problemId, current.runId, { status: "accepted" }).catch(console.warn);
      }
      if (current && !current.edit.text) {
        applyEditsRaw([current.edit]);
      }
      const next = prev.filter((_, index) => index !== aiChangeIndex);
      aiReviewEditsRef.current = next.length;
      if (next.length === 0) {
        aiReviewSnapshotRef.current = null;
        clearDiffDecorations();
        setAiReviewOpen(false);
      } else {
        setAiChangeIndex(Math.min(aiChangeIndex, next.length - 1));
      }
      return next;
    });
    setAiChangeLog((prev) => {
      const next: typeof prev = {};
      const current = aiChanges[aiChangeIndex];
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          current && item.key === current.key ? { ...item, status: "accepted" } : item
        );
      });
      return next;
    });
  }, [aiChangeIndex, applyEditsRaw, clearDiffDecorations, aiChanges, problemId]);

  const handleRejectAiEdits = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel?.();
    const current = aiChanges[aiChangeIndex];
    if (current?.runId) {
      updateLatexAiRun(problemId, current.runId, { status: "rejected" }).catch(console.warn);
    }
    if (model && aiReviewSnapshotRef.current !== null) {
      editor.pushUndoStop?.();
      model.setValue(aiReviewSnapshotRef.current);
      editor.pushUndoStop?.();
    }
    setAiChanges((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((_, index) => index !== aiChangeIndex);
      if (next.length === 0) {
        aiReviewSnapshotRef.current = null;
        aiReviewEditsRef.current = 0;
        clearDiffDecorations();
        setAiReviewOpen(false);
        return next;
      }
      clearDiffDecorations();
      applyEditsRaw(next.map((item) => item.edit));
      aiReviewEditsRef.current = next.length;
      setAiChangeIndex(Math.min(aiChangeIndex, next.length - 1));
      return next;
    });
    setAiChangeLog((prev) => {
      const next: typeof prev = {};
      const current = aiChanges[aiChangeIndex];
      Object.entries(prev).forEach(([runId, items]) => {
        next[runId] = items.map((item) =>
          current && item.key === current.key ? { ...item, status: "rejected" } : item
        );
      });
      return next;
    });
  }, [aiChangeIndex, clearDiffDecorations, applyEditsRaw, aiChanges, problemId]);

  const focusAiChange = useCallback(
    (index: number) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco || aiChanges.length === 0) return;
      const change = aiChanges[index];
      if (!change || change.filePath !== activePath) return;
      const range = new monaco.Range(
        change.edit.start.line,
        change.edit.start.column,
        change.edit.end.line,
        change.edit.end.column
      );
      editor.revealRangeInCenter?.(range);
      editor.setSelection?.(range);
    },
    [aiChanges, activePath]
  );

  const handlePrevAiChange = useCallback(() => {
    setAiChangeIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextAiChange = useCallback(() => {
    setAiChangeIndex((prev) => Math.min(aiChanges.length - 1, prev + 1));
  }, [aiChanges.length]);

  const handlePdfClick = useCallback(
    async (event: MouseEvent<HTMLCanvasElement>) => {
      if (!pdfDocRef.current || !pdfCanvasRef.current || !pdfViewportRef.current) return;
      const rect = pdfCanvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

      const [pdfX, pdfY] = pdfViewportRef.current.convertToPdfPoint(x, y);
      try {
        const mapping = await mapLatexPdfToSource(problemId, pdfPage, pdfX, pdfY);
        setPdfSyncNotice(null);
        const normalized = normalizePath(mapping.path || "");
        if (!normalized) return;
        pendingCursorRef.current = {
          path: normalized,
          line: mapping.line,
          column: mapping.column ?? 1,
        };
        setOpenTabs((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
        setActivePath(normalized);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Sync unavailable. Compile again.";
        setPdfSyncNotice(message);
        console.warn("Synctex mapping failed", error);
      }
    },
    [problemId, pdfPage]
  );

  useEffect(() => {
    loadProblem();
  }, [loadProblem]);

  useEffect(() => {
    if (!workspaceReady) return;
    refreshFiles();
  }, [workspaceReady, refreshFiles]);

  useEffect(() => {
    if (canvasBlocksLoaded) return;
    getCanvasBlocks(problemId)
      .then((res) => {
        setCanvasBlocks(res || []);
      })
      .catch((error) => {
        console.warn("Failed to load canvas blocks for LaTeX context", error);
      })
      .finally(() => setCanvasBlocksLoaded(true));
  }, [problemId, canvasBlocksLoaded]);

  useEffect(() => {
    if (canvasNodesLoaded) return;
    getLibraryItems(problemId)
      .then((res) => {
        setCanvasNodes(res.items || []);
        setCanvasNodesLoaded(true);
      })
      .catch((error) => {
        console.warn("Failed to load canvas nodes for LaTeX context", error);
      });
  }, [problemId, canvasNodesLoaded]);

  useEffect(() => {
    if (!workspaceReady || !activePath) return;
    loadFile(activePath);
  }, [workspaceReady, activePath, loadFile]);

  useEffect(() => {
    if (!activePersistentChatId) return;
    setPersistentChats((prev) =>
      prev.map((chat) =>
        chat.id === activePersistentChatId
          ? {
            ...chat,
            messages: persistentMessages.map((msg) => ({
              id: msg.id || `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: msg.role as "user" | "assistant",
              content: msg.content,
              timestamp: msg.createdAt
                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            })),
          }
          : chat
      )
    );
  }, [persistentMessages, activePersistentChatId]);

  useEffect(() => {
    if (!aiReviewOpen) return;
    if (aiChanges.length === 0) {
      clearDiffDecorations();
      return;
    }
    renderDiffDecorations(aiChanges, aiChangeIndex);
  }, [aiChanges, aiChangeIndex, aiReviewOpen, renderDiffDecorations, clearDiffDecorations]);

  useEffect(() => {
    if (!aiReviewOpen || aiChanges.length === 0) return;
    focusAiChange(aiChangeIndex);
  }, [aiChangeIndex, aiReviewOpen, aiChanges.length, focusAiChange]);

  useEffect(() => {
    const pending = pendingCursorRef.current;
    if (!pending || pending.path !== activePath) return;
    const editor = editorRef.current;
    if (!editor) return;
    window.requestAnimationFrame(() => {
      editor.focus?.();
      editor.setPosition?.({ lineNumber: pending.line, column: pending.column || 1 });
      editor.revealPositionInCenter?.({ lineNumber: pending.line, column: pending.column || 1 });
    });
    pendingCursorRef.current = null;
  }, [activePath, editorValue]);

  useEffect(() => {
    if (!activePath) return;
    setOpenTabs((prev) => (prev.includes(activePath) ? prev : [...prev, activePath]));
  }, [activePath]);

  useEffect(() => {
    if (!workspaceReady) return;
    loadPdf();
    loadLog();
  }, [workspaceReady, loadPdf, loadLog]);

  useEffect(() => {
    if (!pdfBlob) {
      pdfDocRef.current = null;
      setPdfPages(0);
      setPdfPage(1);
      return;
    }
    let cancelled = false;
    setPdfLoading(true);
    pdfBlob
      .arrayBuffer()
      .then((buffer) => getDocument({ data: buffer }).promise)
      .then((doc) => {
        if (cancelled) return;
        pdfDocRef.current = doc;
        setPdfPages(doc.numPages);
        setPdfPage(1);
      })
      .catch((error) => {
        console.error("Failed to load PDF", error);
        pdfDocRef.current = null;
        setPdfPages(0);
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pdfBlob]);

  useEffect(() => {
    if (!pdfDocRef.current || pdfPages === 0) return;
    renderPdfPage(pdfPage, pdfZoom).catch((error) => {
      console.error("Failed to render PDF page", error);
    });
  }, [pdfPage, pdfZoom, pdfPages, renderPdfPage]);


  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      if (compileTimeoutRef.current) window.clearTimeout(compileTimeoutRef.current);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    aiStoreLoadedRef.current = false;
    setAiMessages([]);
    setAiRuns([]);
    setAiMemory("");
    setAiHistory([]);
    setCustomActions(DEFAULT_ACTIONS);
    tempPersistedIdsRef.current = new Set();
  }, [problemId]);

  useEffect(() => {
    if (!workspaceReady || !problemId || aiStoreLoadedRef.current) return;
    aiStoreLoadedRef.current = true;
    let cancelled = false;
    const loadAi = async () => {
      try {
        const [memoryResp, actionsResp, messagesResp, runsResp] = await Promise.all([
          getLatexAiMemory(problemId),
          listLatexAiActions(problemId),
          listLatexAiMessages(problemId, 400),
          listLatexAiRuns(problemId, 50),
        ]);
        if (cancelled) return;
        setAiMemory(memoryResp.memory || "");
        if (actionsResp.length > 0) {
          setCustomActions(
            actionsResp.map((action) => ({ id: action.id, label: action.label, prompt: action.prompt }))
          );
        } else {
          setCustomActions(DEFAULT_ACTIONS);
          Promise.all(
            DEFAULT_ACTIONS.map((action) =>
              createLatexAiAction(problemId, { label: action.label, prompt: action.prompt })
            )
          )
            .then((created) => {
              if (cancelled) return;
              if (created.length > 0) {
                setCustomActions(
                  created.map((action) => ({ id: action.id, label: action.label, prompt: action.prompt }))
                );
              }
            })
            .catch((error) => {
              console.warn("Failed to seed AI actions", error);
            });
        }
        setAiMessages(
          messagesResp.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: toLocalTime(msg.created_at) || "",
            runId: msg.run_id || undefined,
          }))
        );
        setAiRuns(
          runsResp.map((run) => ({
            id: run.id,
            prompt: run.prompt,
            steps: Array.isArray(run.steps) ? run.steps.map((step) => String(step)) : [],
            summary: run.summary || undefined,
            timestamp: toLocalTime(run.created_at) || "",
            edits: Array.isArray(run.edits) ? run.edits : [],
            filePath: run.file_path || "",
            selection: run.selection || "",
          }))
        );

        // Sync temp chat messages (messages not associated with a run)
        const tempFromServer = messagesResp
          .filter((msg) => !msg.run_id)
          .map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(msg.created_at),
          }));
        setTempMessages(tempFromServer);
        tempPersistedIdsRef.current = new Set(tempFromServer.map((msg) => msg.id));

        // Populate aiChanges from runs (pending only for active list, all for history)
        const allChanges: any[] = [];
        const changesByRun: Record<string, any[]> = {};
        runsResp.forEach((run) => {
          if (Array.isArray(run.edits) && run.edits.length > 0) {
            run.edits.forEach((edit, idx) => {
              const addedLines = countLines(edit.text);
              const removedLines = estimateRemovedLines(edit);
              const item = {
                id: `${run.id}-edit-${idx}`,
                key: makeEditKey(run.id, run.file_path || DEFAULT_MAIN, edit),
                edit,
                hasInsert: addedLines > 0,
                hasRemove: removedLines > 0,
                addedLines,
                removedLines,
                summary: run.summary || undefined,
                filePath: run.file_path || DEFAULT_MAIN,
                runId: run.id,
                status: run.status === "accepted" || run.status === "rejected" ? run.status : "pending",
              };
              if (item.status === "pending") {
                allChanges.push(item);
              }
              changesByRun[run.id] = [...(changesByRun[run.id] || []), item];
            });
          }
        });
        setAiChanges(allChanges);
        setAiChangeLog(changesByRun);
        if (allChanges.length > 0) {
          setAiReviewOpen(true);
          const model = editorRef.current?.getModel?.();
          if (model) {
            aiReviewSnapshotRef.current = model.getValue();
          }
        } else {
          setAiReviewOpen(false);
          aiReviewSnapshotRef.current = null;
        }
      } catch (error) {
        console.warn("Failed to load AI workspace", error);
      }
    };
    loadAi();
    return () => {
      cancelled = true;
    };
  }, [workspaceReady, problemId, toLocalTime]);

  useEffect(() => {
    if (!problemId) return;
    tempMessages.forEach((msg) => {
      if (!msg.id) return;
      if (tempPersistedIdsRef.current.has(msg.id)) return;
      if (tempMessageRunIds[msg.id]) return;
      tempPersistedIdsRef.current.add(msg.id);
      void createLatexAiMessage(problemId, {
        role: msg.role as "user" | "assistant",
        content: msg.content,
        run_id: null,
      }).catch((error) => {
        console.warn("Failed to persist temp chat message", error);
      });
    });
  }, [tempMessages, tempMessageRunIds, problemId]);

  useEffect(() => {
    if (typeof window === "undefined" || !problemId) return;
    if (aiMemorySaveRef.current) {
      window.clearTimeout(aiMemorySaveRef.current);
    }
    aiMemorySaveRef.current = window.setTimeout(() => {
      updateLatexAiMemory(problemId, aiMemory || null).catch((error) => {
        console.warn("Failed to save AI memory", error);
      });
    }, 800);
    return () => {
      if (aiMemorySaveRef.current) {
        window.clearTimeout(aiMemorySaveRef.current);
      }
    };
  }, [aiMemory, problemId]);

  useEffect(() => {
    const getLimits = () => {
      const collapsedLeft = 40;
      const collapsedChat = 40;
      const collapsedRight = 40;
      const minCenter = 420;
      const available = window.innerWidth;
      const left = leftOpen ? leftWidth + 1 : collapsedLeft;
      const chat = chatOpen ? chatWidth + 1 : collapsedChat;
      const right = rightOpen ? rightWidth + 1 : collapsedRight;
      const maxLeft = Math.max(200, available - chat - right - minCenter);
      const maxChat = Math.max(260, available - left - right - minCenter);
      const maxRight = Math.max(320, available - left - chat - minCenter);
      return { maxLeft, maxChat, maxRight };
    };

    const handleMove = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { maxLeft, maxChat, maxRight } = getLimits();
      if (drag.type === "left") {
        const next = clamp(drag.leftWidth + (event.clientX - drag.startX), 200, maxLeft);
        setLeftWidth(next);
        document.body.style.cursor = "col-resize";
      }
      if (drag.type === "chat") {
        const next = clamp(drag.chatWidth + (event.clientX - drag.startX), 260, maxChat);
        setChatWidth(next);
        document.body.style.cursor = "col-resize";
      }
      if (drag.type === "right") {
        const next = clamp(drag.rightWidth - (event.clientX - drag.startX), 320, maxRight);
        setRightWidth(next);
        document.body.style.cursor = "col-resize";
      }
      if (drag.type === "log") {
        const next = clamp(drag.logHeight - (event.clientY - drag.startY), 120, 320);
        setLogHeight(next);
        document.body.style.cursor = "row-resize";
      }
    };

    const handleUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = "";
      }
    };

    const handleResize = () => {
      const { maxLeft, maxChat, maxRight } = getLimits();
      setLeftWidth((prev) => clamp(prev, 200, maxLeft));
      setChatWidth((prev) => clamp(prev, 260, maxChat));
      setRightWidth((prev) => clamp(prev, 320, maxRight));
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("resize", handleResize);
    };
  }, [leftOpen, chatOpen, rightOpen, leftWidth, chatWidth, rightWidth]);

  const renderCreateRow = useCallback(
    (parent: string, depth: number) => {
      if (!createTarget || createTarget.parent !== parent) return null;
      const padding = 8 + depth * 12;
      return (
        <div
          className="flex items-center gap-2 px-2 py-1"
          style={{ paddingLeft: padding }}
        >
          <div className="text-[11px] text-neutral-600">
            {createTarget.type === "folder" ? "New folder" : "New file"}
          </div>
          <input
            autoFocus
            value={createValue}
            onChange={(event) => setCreateValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitCreate();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelCreate();
              }
            }}
            onBlur={() => {
              if (createValue.trim()) {
                submitCreate();
              } else {
                cancelCreate();
              }
            }}
            placeholder={createTarget.type === "folder" ? "folder-name" : "file.tex"}
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-2 py-1 text-xs text-neutral-300 placeholder-neutral-700 outline-none focus:border-[#404040] transition-colors"
          />
        </div>
      );
    },
    [createTarget, createValue, submitCreate, cancelCreate]
  );

  const renderNode = useCallback(
    (node: FileNode, depth: number) => {
      const padding = 8 + depth * 12;
      const isRenaming = renameTarget === node.path;
      const isDeleting = deleteTarget === node.path;
      if (node.type === "directory") {
        const expanded = expandedDirs.has(node.path);
        return (
          <div key={node.path}>
            <div
              className={`w-full flex items-center gap-1.5 py-1 text-xs text-left rounded-md px-2 group ${node.path === "" ? "text-neutral-600" : "text-neutral-400"
                }`}
              style={{ paddingLeft: padding }}
            >
              <button
                type="button"
                onClick={() => toggleDir(node.path)}
                className="flex items-center gap-1.5 flex-1"
              >
                {expanded ? <ChevronDown size={12} className="text-neutral-600" /> : <ChevronRight size={12} className="text-neutral-600" />}
                <Folder size={12} className="text-neutral-600" />
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitRename();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                    onBlur={() => {
                      if (renameValue.trim()) submitRename();
                      else cancelRename();
                    }}
                    className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-2 py-0.5 text-[11px] text-neutral-300 outline-none focus:border-[#404040]"
                  />
                ) : (
                  <span className="truncate">{node.name || "root"}</span>
                )}
              </button>
              {!isRenaming && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleCreateFile(node.path)}
                    className="p-1 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"
                    title="New file"
                  >
                    <FilePlus size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateFolder(node.path)}
                    className="p-1 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"
                    title="New folder"
                  >
                    <FolderPlus size={12} />
                  </button>
                  {node.path && (
                    <>
                      <button
                        type="button"
                        onClick={() => startRename(node.path)}
                        className="p-1 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(node.path)}
                        className="p-1 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {expanded && node.children && (
              <div>
                {node.children.map((child) => renderNode(child, depth + 1))}
              </div>
            )}
            {expanded && renderCreateRow(node.path, depth + 1)}
            {isDeleting && (
              <div
                className="flex items-center gap-2 px-2 py-1 text-[11px]"
                style={{ paddingLeft: padding + 12 }}
              >
                <span className="text-neutral-600">Delete folder?</span>
                <button
                  type="button"
                  onClick={() => handleDeleteFile(node.path, true)}
                  className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] hover:bg-red-500/30 transition-colors"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="px-2 py-0.5 rounded border border-[#2a2a2a] text-neutral-500 hover:text-neutral-300 text-[10px] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      }

      const Icon = fileIcon(node.path);
      return (
        <div
          key={node.path}
          className={`w-full flex items-center gap-1.5 py-1 text-xs rounded-md px-2 group ${activePath === node.path ? "bg-[#1a1a1a] text-neutral-200" : "text-neutral-500 hover:bg-[#141414] hover:text-neutral-300"
            } transition-colors`}
          style={{ paddingLeft: padding }}
        >
          <button
            type="button"
            onClick={() => handleSelectFile(node.path)}
            className="flex items-center gap-1.5 flex-1 min-w-0"
          >
            <Icon size={12} className={activePath === node.path ? "text-neutral-400" : "text-neutral-600"} />
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitRename();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
                onBlur={() => {
                  if (renameValue.trim()) submitRename();
                  else cancelRename();
                }}
                className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-2 py-0.5 text-[11px] text-neutral-300 outline-none focus:border-[#404040]"
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </button>
          {!isRenaming && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => startRename(node.path)}
                className="p-1 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"
                title="Rename"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => startDelete(node.path)}
                className="p-1 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
          {isDeleting && (
            <div className="flex items-center gap-2 ml-2">
              <button
                type="button"
                onClick={() => handleDeleteFile(node.path, false)}
                className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] hover:bg-red-500/30 transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={cancelDelete}
                className="px-2 py-0.5 rounded border border-[#2a2a2a] text-neutral-500 hover:text-neutral-300 text-[10px] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      );
    },
    [
      activePath,
      expandedDirs,
      handleSelectFile,
      toggleDir,
      createTarget,
      createValue,
      renameTarget,
      renameValue,
      deleteTarget,
      submitRename,
      cancelRename,
      handleCreateFile,
      handleCreateFolder,
      startRename,
      startDelete,
      cancelDelete,
      renderCreateRow,
      handleDeleteFile,
    ]
  );

  const canPreview = pdfPages > 0;
  const pageLabel = canPreview ? `${pdfPage} / ${pdfPages}` : "--";

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col text-sm selection:bg-indigo-500/20 selection:text-indigo-200 bg-[#0a0a0a] text-neutral-300">
      <header className="h-11 border-b border-[#1a1a1a] flex items-center justify-between px-4 shrink-0 z-20 bg-[#0a0a0a]">
        <div className="flex items-center gap-5">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-5 h-5 bg-neutral-700 rounded-sm flex items-center justify-center text-neutral-200 group-hover:bg-neutral-600 transition-colors">
              <span className="font-[var(--font-math)] italic text-[12px] leading-none logo-rho">&rho;</span>
            </div>
            <span className="font-medium tracking-tight text-neutral-400 text-sm group-hover:text-neutral-300 transition-colors">ProofMesh</span>
          </Link>

          <div className="h-3.5 w-px bg-[#252525]" />
          <div className="flex items-center gap-2 text-neutral-500">
            <span className="text-xs font-medium text-neutral-400">{problem?.title || "Problem"}</span>
            <ChevronRight size={12} className="text-neutral-600" />
            <span className="text-xs font-medium text-neutral-300">LaTeX Lab</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runCompile("manual")}
            disabled={!canEdit}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-100 text-black hover:bg-white disabled:opacity-40 flex items-center gap-1.5 transition-colors"
          >
            <Play size={12} fill="currentColor" />
            Compile
          </button>
          <Link
            href={`/problems/${problemId}/canvas`}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#2a2a2a] text-neutral-300 hover:text-white hover:border-[#3a3a3a] hover:bg-[#151515] flex items-center gap-1.5 transition-colors"
            title="Open Proof Canvas"
          >
            <LayoutGrid size={12} />
            Canvas
          </Link>
          <button
            type="button"
            onClick={loadPdf}
            className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Refresh PDF"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!leftOpen && (
          <div className="w-10 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col items-center py-3">
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"
              title="Show files"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {leftOpen && (
          <>
            <aside
              className="bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col shrink-0 hidden md:flex"
              style={{ width: leftWidth, flex: "0 0 auto" }}
            >
              <div className="p-3 space-y-3 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setLeftTab("files")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${leftTab === "files" ? "bg-[#1a1a1a] text-neutral-200" : "text-neutral-500 hover:text-neutral-300 hover:bg-[#151515]"}`}
                  >
                    Files
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab("chats")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${leftTab === "chats" ? "bg-[#1a1a1a] text-neutral-200" : "text-neutral-500 hover:text-neutral-300 hover:bg-[#151515]"}`}
                  >
                    Chats
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftTab("knowledge")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${leftTab === "knowledge" ? "bg-[#1a1a1a] text-neutral-200" : "text-neutral-500 hover:text-neutral-300 hover:bg-[#151515]"}`}
                  >
                    Knowledge
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setLeftOpen(false)}
                    className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 transition-colors"
                    title="Collapse"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>

                {leftTab === "files" && (
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">Files</h2>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleCreateFile("")}
                        disabled={!canEdit}
                        className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                        title="New file"
                      >
                        <FilePlus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateFolder("")}
                        disabled={!canEdit}
                        className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                        title="New folder"
                      >
                        <FolderPlus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        disabled={!canEdit}
                        className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                        title="Upload asset"
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={refreshFiles}
                        className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {leftTab === "chats" && (
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">Chats</h2>
                    <button
                      type="button"
                      onClick={handleCreatePersistentChat}
                      className="px-2.5 py-1 rounded-md bg-[#151515] hover:bg-[#1a1a1a] border border-[#252525] text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      New
                    </button>
                  </div>
                )}
                {leftTab === "knowledge" && (
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">Canvas Knowledge</h2>
                    <button
                      type="button"
                      onClick={refreshCanvasKnowledge}
                      className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 transition-colors"
                      title="Refresh canvas knowledge"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                )}
                {!canEdit && <p className="text-[10px] text-neutral-600">Read-only</p>}
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-2">
                {leftTab === "files" && (
                  <>
                    {renderCreateRow("", 0)}
                    {fileTree?.children?.length ? (
                      fileTree.children.map((child) => renderNode(child, 0))
                    ) : (
                      <div className="px-2 py-2 text-[11px] text-neutral-600">No files yet</div>
                    )}
                  </>
                )}
                {leftTab === "chats" && (
                  <div className="space-y-1.5">
                    {persistentChats.length === 0 ? (
                      <button
                        type="button"
                        onClick={handleCreatePersistentChat}
                        className="w-full text-left px-3 py-2.5 rounded-lg border border-[#252525] bg-[#0f0f0f] hover:bg-[#151515] text-[11px] text-neutral-400 hover:text-neutral-300 transition-colors"
                      >
                        Create your first chat
                      </button>
                    ) : (
                      persistentChats.map((chat) => (
                        <button
                          key={chat.id}
                          type="button"
                          onClick={() => {
                            setActivePersistentChatId(chat.id);
                            setLeftTab("chats");
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border text-[11px] transition-all ${activePersistentChatId === chat.id
                            ? "border-[#353535] bg-[#1a1a1a] text-neutral-200"
                            : "border-[#1f1f1f] bg-[#0f0f0f] text-neutral-500 hover:border-[#2a2a2a] hover:bg-[#141414]"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate font-medium">{chat.title}</span>
                            <span className="text-[10px] text-neutral-600">{chat.createdAt}</span>
                          </div>
                          <div className="text-[10px] text-neutral-600 truncate mt-0.5">
                            {chat.messages[chat.messages.length - 1]?.content || "No messages yet"}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {leftTab === "knowledge" && (
                  <div className="space-y-4">
                    <div className="px-1">
                      <div className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-lg px-2 py-1.5">
                        <BookOpen size={12} className="text-neutral-500" />
                        <input
                          value={knowledgeQuery}
                          onChange={(event) => setKnowledgeQuery(event.target.value)}
                          placeholder="Search nodes or blocks..."
                          className="flex-1 bg-transparent text-[11px] text-neutral-300 placeholder:text-neutral-600 outline-none"
                        />
                        {knowledgeQuery && (
                          <button
                            type="button"
                            onClick={() => setKnowledgeQuery("")}
                            className="text-neutral-600 hover:text-neutral-300 transition-colors"
                            title="Clear search"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mx-1 rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] px-2.5 py-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-600 mb-2">
                        <span>Knowledge Map</span>
                        <span>{filteredCanvasNodes.length} nodes</span>
                      </div>
                      {knowledgeGraphLayout.positions.size === 0 ? (
                        <div className="text-[11px] text-neutral-600 px-1 py-6 text-center">
                          No canvas knowledge yet
                        </div>
                      ) : (
                        <svg
                          viewBox={`0 0 ${knowledgeGraphLayout.width} ${knowledgeGraphLayout.height}`}
                          className="w-full h-[220px] rounded-md bg-[#080808] border border-[#151515]"
                          onClick={(event) => {
                            if (event.target === event.currentTarget) {
                              setKnowledgeSelection(null);
                            }
                          }}
                        >
                          {knowledgeGraphLayout.clusters.map((cluster) => (
                            <g key={`cluster-${cluster.id}`}>
                              <circle
                                cx={cluster.centerX}
                                cy={cluster.centerY}
                                r={cluster.radius}
                                fill={cluster.isUnassigned ? "rgba(63,63,70,0.08)" : "rgba(59,130,246,0.08)"}
                                stroke={cluster.isUnassigned ? "rgba(82,82,91,0.4)" : "rgba(59,130,246,0.35)"}
                                strokeDasharray={cluster.isUnassigned ? "4 4" : undefined}
                                onClick={(event) => {
                                  if (cluster.isUnassigned || cluster.id === "all") return;
                                  event.stopPropagation();
                                  setKnowledgeSelection({ type: "block", id: cluster.id });
                                }}
                              />
                              <text
                                x={cluster.centerX}
                                y={cluster.centerY - cluster.radius + 12}
                                textAnchor="middle"
                                className="fill-neutral-500 text-[8px] uppercase tracking-wide"
                              >
                                {cluster.name.slice(0, 18)}
                              </text>
                            </g>
                          ))}

                          {knowledgeGraphLayout.edges.map((edge, index) => {
                            const from = knowledgeGraphLayout.positions.get(edge.from);
                            const to = knowledgeGraphLayout.positions.get(edge.to);
                            if (!from || !to) return null;
                            return (
                              <line
                                key={`edge-${edge.from}-${edge.to}-${index}`}
                                x1={from.x}
                                y1={from.y}
                                x2={to.x}
                                y2={to.y}
                                stroke="rgba(100,116,139,0.35)"
                                strokeWidth={1}
                              />
                            );
                          })}

                          {filteredCanvasNodes.map((node) => {
                            const pos = knowledgeGraphLayout.positions.get(node.id);
                            if (!pos) return null;
                            const isSelected = knowledgeSelection?.type === "node" && knowledgeSelection.id === node.id;
                            return (
                              <g
                                key={`node-${node.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setKnowledgeSelection({ type: "node", id: node.id });
                                }}
                                className="cursor-pointer"
                              >
                                <circle
                                  cx={pos.x}
                                  cy={pos.y}
                                  r={isSelected ? 7.5 : 6}
                                  fill={getNodeColor(node)}
                                  stroke={getNodeStroke(node)}
                                  strokeWidth={isSelected ? 2 : 1}
                                />
                                <title>{`${node.title} (${node.kind.toLowerCase()})`}</title>
                              </g>
                            );
                          })}
                        </svg>
                      )}

                      {knowledgeSelection && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-neutral-500">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="uppercase">{knowledgeSelection.type}</span>
                            <span className="text-neutral-300 truncate">
                              {knowledgeSelection.type === "node"
                                ? selectedKnowledgeNode?.title || "Node"
                                : selectedKnowledgeBlock?.name || "Block"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (knowledgeSelection.type === "node" && selectedKnowledgeNode) {
                                  appendMentionToken(`node-${selectedKnowledgeNode.id}`);
                                  return;
                                }
                                if (knowledgeSelection.type === "block" && selectedKnowledgeBlock) {
                                  appendMentionToken(`block-${selectedKnowledgeBlock.id}`);
                                }
                              }}
                              className="px-1.5 py-0.5 rounded border border-[#242424] text-neutral-500 hover:text-neutral-200 hover:border-[#333333] transition-colors"
                            >
                              @
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!canEdit || !activePath) return;
                                if (knowledgeSelection.type === "node" && selectedKnowledgeNode) {
                                  insertAtCursor(buildNodeLatexSnippet(selectedKnowledgeNode));
                                } else if (knowledgeSelection.type === "block" && selectedKnowledgeBlock) {
                                  insertAtCursor(buildBlockLatexSnippet(selectedKnowledgeBlock));
                                }
                              }}
                              disabled={!canEdit || !activePath}
                              className="px-1.5 py-0.5 rounded border border-[#242424] text-neutral-500 hover:text-neutral-200 hover:border-[#333333] disabled:opacity-40 transition-colors"
                            >
                              Insert
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="px-2 text-[10px] uppercase tracking-wide text-neutral-600 flex items-center justify-between">
                        <span>Blocks</span>
                        <span>{filteredCanvasBlocks.length}</span>
                      </div>
                      {filteredCanvasBlocks.length === 0 ? (
                        <div className="px-2 text-[11px] text-neutral-600">No blocks found</div>
                      ) : (
                        filteredCanvasBlocks.map((block) => {
                          const nodes = block.node_ids
                            .map((id) => canvasNodes.find((node) => node.id === id))
                            .filter(Boolean) as LibraryItem[];
                          const preview = nodes.slice(0, 3).map((node) => node.title).join(" • ");
                          return (
                            <div
                              key={block.id}
                              className="mx-1 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] px-2.5 py-2 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Folder size={12} className="text-sky-400 shrink-0" />
                                  <span className="text-[11px] text-neutral-200 truncate">{block.name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => appendMentionToken(`block-${block.id}`)}
                                    className="px-1.5 py-0.5 text-[10px] rounded border border-[#242424] text-neutral-500 hover:text-neutral-200 hover:border-[#333333] transition-colors"
                                    title="Add to chat context"
                                  >
                                    @
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => insertAtCursor(buildBlockLatexSnippet(block))}
                                    disabled={!canEdit || !activePath}
                                    className="px-1.5 py-0.5 text-[10px] rounded border border-[#242424] text-neutral-500 hover:text-neutral-200 hover:border-[#333333] disabled:opacity-40 transition-colors"
                                    title="Insert into LaTeX"
                                  >
                                    Insert
                                  </button>
                                </div>
                              </div>
                              <div className="text-[10px] text-neutral-500">
                                {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
                                {preview ? ` • ${preview}` : ""}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="px-2 text-[10px] uppercase tracking-wide text-neutral-600 flex items-center justify-between">
                        <span>Nodes</span>
                        <span>{filteredCanvasNodes.length}</span>
                      </div>
                      {filteredCanvasNodes.length === 0 ? (
                        <div className="px-2 text-[11px] text-neutral-600">No nodes found</div>
                      ) : (
                        filteredCanvasNodes.map((node) => (
                          <div
                            key={node.id}
                            className="mx-1 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] px-2.5 py-2 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText size={12} className="text-emerald-500 shrink-0" />
                                <span className="text-[11px] text-neutral-200 truncate">{node.title}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => appendMentionToken(`node-${node.id}`)}
                                  className="px-1.5 py-0.5 text-[10px] rounded border border-[#242424] text-neutral-500 hover:text-neutral-200 hover:border-[#333333] transition-colors"
                                  title="Add to chat context"
                                >
                                  @
                                </button>
                                <button
                                  type="button"
                                  onClick={() => insertAtCursor(buildNodeLatexSnippet(node))}
                                  disabled={!canEdit || !activePath}
                                  className="px-1.5 py-0.5 text-[10px] rounded border border-[#242424] text-neutral-500 hover:text-neutral-200 hover:border-[#333333] disabled:opacity-40 transition-colors"
                                  title="Insert into LaTeX"
                                >
                                  Insert
                                </button>
                              </div>
                            </div>
                            <div className="text-[10px] text-neutral-500 flex items-center gap-2">
                              <span className="uppercase">{node.kind.toLowerCase()}</span>
                              <span className="text-neutral-700">•</span>
                              <span className="uppercase">{node.status.toLowerCase()}</span>
                            </div>
                            {node.content && (
                              <div className="text-[10px] text-neutral-600 line-clamp-3">
                                {node.content.slice(0, 160)}
                                {node.content.length > 160 ? "..." : ""}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-[#1a1a1a] flex items-center gap-2 text-[10px]">
                <span className="uppercase tracking-wider text-neutral-600">Auto-compile</span>
                {autoCompileAt ? (
                  <span className="text-neutral-400">scheduled</span>
                ) : (
                  <span className="text-neutral-700">idle</span>
                )}
              </div>
            </aside>
            <div
              className="w-1 bg-transparent hover:bg-[#252525] cursor-col-resize hidden md:block transition-colors"
              onMouseDown={(event) => {
                dragRef.current = {
                  type: "left",
                  startX: event.clientX,
                  startY: event.clientY,
                  leftWidth,
                  chatWidth,
                  rightWidth,
                  logHeight,
                };
              }}
            />
          </>
        )}

        {chatOpen && null}

        <section className="flex-1 flex overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col border-r border-[#1a1a1a] bg-[#0a0a0a] min-w-0">
            <div className="lab-tabs-header">
              <div className="lab-tabs">
                {openTabs.map((tab) => {
                  const Icon = fileIcon(tab);
                  const isActive = tab === activePath && !activePersistentChatId;
                  return (
                    <div
                      key={tab}
                      className={`lab-tab ${isActive ? "lab-tab--active" : ""}`}
                      onClick={() => {
                        setActivePersistentChatId(null);
                        setActivePath(tab);
                      }}
                    >
                      <Icon size={14} className="lab-tab__icon" />
                      <span className="lab-tab__name">{tab.split('/').pop()}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseTab(tab);
                        }}
                        className="lab-tab__close"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
                {activePersistentChatId && (
                  <div className="lab-tab lab-tab--active">
                    <FileText size={14} className="lab-tab__icon" />
                    <span className="lab-tab__name">
                      {persistentChats.find((chat) => chat.id === activePersistentChatId)?.title || "Chat"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePersistentChatId(null);
                      }}
                      className="lab-tab__close"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              <div className="lab-tabs-actions">
                {fileLoading && <Loader size={14} className="animate-spin text-neutral-600" />}
                <span className="text-[11px] text-neutral-600 px-2">
                  {saveState === "saving" && "Saving..."}
                  {saveState === "saved" && <span className="text-emerald-500">Saved</span>}
                  {saveState === "error" && <span className="text-red-400">Error</span>}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-0 relative">
              {activeChat ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div className="text-xl text-neutral-300 font-medium mb-3">Ready when you are!</div>
                    <div className="text-xs text-neutral-600 max-w-md">
                      Start a persistent chat tied to this workspace. Ask for edits, summaries, or ideas.
                    </div>
                  </div>
                  <div className="px-6 pb-6">
                    <div className="flex flex-wrap gap-2 justify-center mb-5">
                      <button className="px-3 py-1.5 rounded-full text-[11px] border border-[#252525] bg-[#111111] text-neutral-500 hover:text-neutral-300 hover:border-[#353535] transition-all">Add file</button>
                      <button className="px-3 py-1.5 rounded-full text-[11px] border border-[#252525] bg-[#111111] text-neutral-500 hover:text-neutral-300 hover:border-[#353535] transition-all">Summarize</button>
                    </div>
                    <div className="pm-context-line">
                      {!selectionRangeLabel || contextDismissed ? (
                        <span className="pm-context-item pm-context-file">
                          <FileCode size={12} />
                          {activePath}
                        </span>
                      ) : (
                        <span className="pm-context-item pm-context-selection">
                          <FileCode size={12} />
                          {selectionRangeLabel}
                          <button
                            type="button"
                            onClick={clearSelectionContext}
                            className="pm-context-remove"
                            aria-label="Remove selection context"
                          >
                            ×
                          </button>
                        </span>
                      )}
                      {persistentMentionFiles.map((path) => (
                        <span key={`mention-${path}`} className="pm-context-item pm-context-mention">
                          <FileText size={11} />
                          @{path}
                          <button
                            type="button"
                            onClick={() => setPersistentInput((prev) => removeMention(prev, path))}
                            className="pm-context-remove"
                            aria-label={`Remove @${path}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {attachedImages.map((path) => (
                        <span key={`image-${path}`} className="pm-context-item pm-context-image">
                          <ImageIcon size={11} />
                          {path}
                          <button
                            type="button"
                            onClick={() => setAttachedImages((prev) => prev.filter((item) => item !== path))}
                            className="pm-context-remove"
                            aria-label={`Remove ${path}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {persistentMentionBlocks
                        .map((blockId) => canvasBlocks.find((block) => block.id === blockId))
                        .filter((block): block is CanvasBlock => Boolean(block))
                        .map((block) => {
                          const nodes = block.node_ids
                            .map((id) => canvasNodes.find((node) => node.id === id))
                            .filter(Boolean) as LibraryItem[];
                          const titles = nodes.slice(0, 3).map((node) => node.title).join(" • ");
                          return (
                            <span key={`block-${block.id}`} className="pm-context-item pm-context-mention" title={titles || block.name}>
                              <Folder size={11} className="text-sky-400" />
                              <span className="truncate max-w-[150px]">
                                {block.name}
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
                              </span>
                              <span className="text-[10px] text-neutral-500 hidden sm:inline">
                                {titles || "No nodes"}
                              </span>
                            </span>
                          );
                        })}
                      {persistentMentionNodes
                        .map((nodeId) => canvasNodes.find((node) => node.id === nodeId))
                        .filter((node): node is LibraryItem => Boolean(node))
                        .map((node) => (
                          <span
                          key={`node-${node.id}`}
                          className="pm-context-item pm-context-mention"
                          title={node.content || undefined}
                        >
                          <FileText size={11} className="text-emerald-500" />
                          <span className="truncate max-w-[160px]">
                            {node.title} <span className="uppercase text-[9px] text-neutral-500">({node.kind.toLowerCase()})</span>
                          </span>
                          <span className="text-[10px] text-neutral-500 hidden sm:inline">
                            {node.content?.slice(0, 160) || "No content"}
                            {node.content && node.content.length > 160 ? "…" : ""}
                          </span>
                        </span>
                        ))}
                    </div>
                    <div className="relative group">
                      <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-zinc-700/20 via-zinc-600/10 to-zinc-700/20 blur opacity-10 group-hover:opacity-25 transition-opacity duration-300" />
                      <div className="relative flex flex-col w-full bg-[#09090b] border border-zinc-800 rounded-2xl shadow-xl shadow-black/40 focus-within:ring-1 focus-within:ring-zinc-700 focus-within:border-zinc-700 group-hover:border-zinc-700 group-hover:bg-[#0b0b0b] transition-colors duration-200">
                        <div className="relative px-2 pt-2">
                          <textarea
                            value={persistentInput}
                            onChange={(event) => {
                              const next = event.target.value;
                              setPersistentInput(next);
                              const query = extractMentionQuery(next);
                              if (query !== null) {
                                setMentionOpen("persistent");
                                setMentionQuery(query);
                                setMentionIndex(0);
                              } else {
                                setMentionOpen(null);
                                setMentionQuery("");
                              }
                            }}
                            onKeyDown={(event) => {
                              if (mentionOpen === "persistent") {
                                if (event.key === "ArrowDown") {
                                  event.preventDefault();
                                  const list = mentionSuggestions;
                                  const maxIndex = Math.max(list.length - 1, 0);
                                  setMentionIndex((prev) => Math.min(prev + 1, maxIndex));
                                  return;
                                }
                                if (event.key === "ArrowUp") {
                                  event.preventDefault();
                                  setMentionIndex((prev) => Math.max(prev - 1, 0));
                                  return;
                                }
                                if (event.key === "Enter") {
                                  const list = mentionSuggestions;
                                  if (list[mentionIndex]) {
                                    event.preventDefault();
                                    applyMention(persistentInput, list[mentionIndex], setPersistentInput);
                                    return;
                                  }
                                }
                                if (event.key === "Escape") {
                                  setMentionOpen(null);
                                  setMentionQuery("");
                                  return;
                                }
                              }
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                handleSendPersistentChat();
                              }
                            }}
                            placeholder="Ask anything..."
                            rows={2}
                            className="w-full bg-transparent text-sm font-light text-zinc-100 placeholder-zinc-600 p-4 min-h-[5rem] max-h-48 resize-none outline-none border-none leading-relaxed"
                          />
                          {mentionOpen === "persistent" && (
                            <div className="absolute bottom-4 left-4 right-4 bg-[#0f0f0f] border border-[#252525] rounded-md shadow-lg z-20 max-h-40 overflow-y-auto">
                              {mentionSuggestions.map((suggestion, index) => {
                                const badgeClass =
                                  suggestion.type === "node"
                                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                    : suggestion.type === "block"
                                      ? "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                                      : "bg-zinc-800 text-zinc-300 border border-zinc-700";
                                return (
                                  <button
                                    key={suggestion.insert}
                                    type="button"
                                    className={`w-full text-left px-3 py-2 text-[11px] ${index === mentionIndex ? "bg-[#1a1a1a] text-neutral-200" : "text-neutral-400 hover:bg-[#151515]"}`}
                                    onClick={() => applyMention(persistentInput, suggestion, setPersistentInput)}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-neutral-100">@{suggestion.insert}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${badgeClass}`}>
                                          {suggestion.type === "node" ? "Node" : suggestion.type === "block" ? "Block" : "File"}
                                        </span>
                                      </div>
                                      {suggestion.description && (
                                        <div className="text-[10px] text-neutral-500">{suggestion.description}</div>
                                      )}
                                      {suggestion.preview && (
                                        <div className="text-[10px] text-neutral-500 leading-snug whitespace-normal">
                                          {suggestion.preview}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                              {mentionSuggestions.length === 0 && (
                                <div className="px-3 py-2 text-[11px] text-neutral-600">No matches</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-3 pb-3 pt-1">
                          <div className="flex items-center p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setAiModelMode("flash")}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${aiModelMode === "flash"
                                ? "bg-zinc-800 shadow-sm border border-zinc-700/50 text-zinc-100"
                                : "text-zinc-500 hover:text-zinc-300"
                                }`}
                            >
                              <Zap size={12} className="text-amber-400" />
                              Flash
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiModelMode("thinking")}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${aiModelMode === "thinking"
                                ? "bg-zinc-800 shadow-sm border border-zinc-700/50 text-zinc-100"
                                : "text-zinc-500 hover:text-zinc-300"
                                }`}
                            >
                              <BrainCircuit size={12} />
                              Thinking
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleImageUploadClick}
                              className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
                              title="Upload image"
                            >
                              <Paperclip size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={handleSendPersistentChat}
                              className="group/send flex items-center justify-center p-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all active:scale-95"
                            >
                              <ArrowUp size={16} className="group-hover/send:-translate-y-0.5 group-hover/send:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                      {persistentMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-lg border px-3 py-2.5 text-[11px] ${msg.role === "user"
                            ? "border-[#2a2a2a] bg-[#1a1a1a] text-neutral-300"
                            : "border-[#252525] bg-[#0f0f0f] text-neutral-400"
                            }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-neutral-600 mb-1">
                            <span>{msg.role === "user" ? "You" : "Assistant"}</span>
                            <span>
                              {msg.createdAt
                                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : ""}
                            </span>
                          </div>
                          {msg.role === "assistant" ? (
                            <div className="pm-markdown">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      ))}
                      {(persistentLoading || aiLoading) && (
                        <div className="pm-thinking">
                          <span>Thinking</span>
                          <div className="pm-thinking__dots">
                            <div className="pm-thinking__dot" />
                            <div className="pm-thinking__dot" />
                            <div className="pm-thinking__dot" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : binaryPreview ? (
                <div className="h-full flex items-center justify-center text-neutral-600 text-sm p-6 pm-fade-in">
                  {binaryPreview.content_type?.startsWith("image/") && binaryPreview.content_base64 ? (
                    <img
                      src={`data:${binaryPreview.content_type};base64,${binaryPreview.content_base64}`}
                      alt={binaryPreview.path}
                      className="max-h-full max-w-full object-contain rounded-lg border border-[#2a2a2a] shadow-xl"
                    />
                  ) : (
                    <div className="text-center">
                      <p className="text-neutral-400 mb-1">Binary file</p>
                      <p className="text-xs text-neutral-600">Download via file list.</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Editor
                    height="100%"
                    theme="proofmesh-latex"
                    language={LATEX_LANGUAGE_ID}
                    beforeMount={handleBeforeMount}
                    onMount={handleEditorMount}
                    value={editorValue}
                    onChange={handleEditorChange}
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                      fontLigatures: true,
                      minimap: { enabled: false },
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      renderLineHighlight: "none",
                      quickSuggestions: { other: true, comments: false, strings: true },
                      suggestOnTriggerCharacters: true,
                      tabCompletion: "on",
                      readOnly: !canEdit,
                      padding: { top: 16, bottom: 16 },
                      lineNumbersMinChars: 3,
                      glyphMargin: false,
                      folding: true,
                      lineDecorationsWidth: 8,
                    }}
                  />
                  {tempChatOpen ? (
                    <div className="pm-temp-chat">
                      <div className="pm-temp-header">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleClearTempChat}
                            className="text-[10px] text-neutral-500 hover:text-neutral-300 px-2 py-0.5 rounded hover:bg-[#1a1a1a] transition-colors"
                            title="Clear chat"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setTempChatOpen(false)}
                            className="pm-review-icon"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="pm-temp-messages">
                      {tempMessages.map((msg, idx) => (
                        <div
                          key={msg.id}
                          className={`pm-chat-bubble ${msg.role === "user" ? "user" : "assistant"}`}
                        >
                          <div className="pm-chat-bubble__content">
                            {msg.role === "user" ? (
                              msg.content
                            ) : (
                              <div className="pm-markdown">
                                {aiLoading && aiThoughts.length > 0 && lastTempAssistantIndex === idx && (
                                  <details className="mb-2 rounded-md border border-[#252525] bg-[#0b0b0b] px-2 py-1.5">
                                    <summary className="cursor-pointer text-[10px] text-neutral-500">
                                      Thinking summary
                                    </summary>
                                    <div className="mt-2 space-y-1">
                                      {aiThoughts.map((thought, idx) => (
                                        <div key={idx} className="text-[10px] text-neutral-500">
                                          <div className="pm-markdown">
                                            <ReactMarkdown
                                              remarkPlugins={[remarkMath]}
                                              rehypePlugins={[rehypeKatex]}
                                            >
                                              {thought}
                                            </ReactMarkdown>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}
                                {(() => {
                                  const runIdForMsg = tempMessageRunIds[msg.id];
                                  const runChanges = runIdForMsg
                                    ? (aiChangeLog[runIdForMsg] || [])
                                    : (lastTempAssistantIndex === idx ? aiChanges : []);
                                  const visibleChanges = runChanges.filter((c) => c.filePath === activePath);
                                  const hasOtherFiles = runChanges.some((c) => c.filePath !== activePath);
                                  if (visibleChanges.length === 0 && !hasOtherFiles) return null;
                                  return (
                                    <div className="mb-2 rounded-md border border-[#252525] bg-[#0b0b0b] px-2 py-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="text-[10px] text-neutral-500">Proposed changes</div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleAcceptIds(visibleChanges.filter((c) => c.status !== "accepted").map((c) => c.id));
                                            }}
                                            className="text-[10px] text-emerald-500 hover:text-emerald-400 font-medium px-1 py-0.5 rounded hover:bg-emerald-500/10 transition-colors"
                                          >
                                            Accept file
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRejectIds(visibleChanges.filter((c) => c.status !== "rejected").map((c) => c.id));
                                            }}
                                            className="text-[10px] text-rose-500 hover:text-rose-400 font-medium px-1 py-0.5 rounded hover:bg-rose-500/10 transition-colors"
                                          >
                                            Reject file
                                          </button>
                                        </div>
                                      </div>
                                      {hasOtherFiles && (
                                        <div className="text-[10px] text-neutral-600 mt-1">
                                          There are pending changes in other files.
                                        </div>
                                      )}
                                      <div className="mt-2 space-y-1 max-h-28 overflow-y-auto pm-scrollbar-thin">
                                        {visibleChanges.map((change) => {
                                          const isActive = aiChanges.some((c) => c.key === change.key);
                                          return (
                                            <button
                                              key={change.id}
                                              type="button"
                                              className="w-full text-left rounded-md border border-transparent hover:border-[#2a2a2a] hover:bg-[#121212] px-2 py-1 transition-colors"
                                              onClick={() => {
                                                if (isActive) {
                                                  focusAiChange(aiChanges.findIndex((c) => c.key === change.key));
                                                }
                                              }}
                                            >
                                              <div className="flex items-center justify-between text-[10px] text-neutral-500">
                                                <span>{change.filePath.split('/').pop()}:{change.edit.start.line}</span>
                                                <span className="pm-proposed-diff">
                                                  <span className="pm-proposed-add">
                                                    +{change.addedLines ?? countLines(change.edit.text)}
                                                  </span>
                                                  <span className="pm-proposed-del">
                                                    -{change.removedLines ?? estimateRemovedLines(change.edit)}
                                                  </span>
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <div className="text-[10px] text-neutral-400 truncate">
                                                  {change.summary || "AI change"}
                                                </div>
                                                {change.status && change.status !== "pending" && (
                                                  <span className="text-[10px] text-neutral-500">
                                                    {change.status === "accepted" ? "Accepted" : "Rejected"}
                                                  </span>
                                                )}
                                                <div className="flex items-center gap-1">
                                                  <span
                                                    role="button"
                                                    aria-label="Accept this change"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (isActive) handleAcceptSingle(change.id);
                                                    }}
                                                    className={`p-1 rounded ${isActive ? "text-emerald-500 hover:bg-emerald-500/10" : "text-neutral-700 cursor-not-allowed"}`}
                                                  >
                                                    <Check size={12} />
                                                  </span>
                                                  <span
                                                    role="button"
                                                    aria-label="Reject this change"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (isActive) handleRejectSingle(change.id);
                                                    }}
                                                    className={`p-1 rounded ${isActive ? "text-rose-500 hover:bg-rose-500/10" : "text-neutral-700 cursor-not-allowed"}`}
                                                  >
                                                    <X size={12} />
                                                  </span>
                                                </div>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                                <ReactMarkdown
                                  remarkPlugins={[remarkMath]}
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(tempLoading || aiLoading) && (
                        <div className="pm-thinking">
                          <div className="flex items-center gap-2">
                            <span>Thinking</span>
                            <div className="pm-thinking__dots">
                              <div className="pm-thinking__dot" />
                              <div className="pm-thinking__dot" />
                              <div className="pm-thinking__dot" />
                            </div>
                          </div>
                          {aiThoughts.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {aiThoughts.map((thought, idx) => (
                                <div
                                  key={idx}
                                  className="text-[10px] text-neutral-500 animate-in fade-in slide-in-from-left-2 duration-300"
                                  style={{ opacity: 1 - Math.min(0.8, (aiThoughts.length - 1 - idx) * 0.12) }}
                                >
                                  <div className="pm-markdown">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkMath]}
                                      rehypePlugins={[rehypeKatex]}
                                    >
                                      {thought}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                      <div className="pm-context-line pm-context-line--compact">
                        {!selectionRangeLabel || contextDismissed ? (
                          <span className="pm-context-item pm-context-file">
                            <FileCode size={12} />
                            {activePath}
                          </span>
                        ) : (
                          <span className="pm-context-item pm-context-selection">
                            <FileCode size={12} />
                            {selectionRangeLabel}
                            <button
                              type="button"
                              onClick={clearSelectionContext}
                              className="pm-context-remove"
                              aria-label="Remove selection context"
                            >
                              ×
                            </button>
                          </span>
                        )}
                        {tempMentionFiles.map((path) => (
                          <span key={`mention-temp-${path}`} className="pm-context-item pm-context-mention">
                            <FileText size={11} />
                            @{path}
                            <button
                              type="button"
                              onClick={() => setTempInput((prev) => removeMention(prev, path))}
                              className="pm-context-remove"
                            aria-label={`Remove @${path}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                        {attachedImages.map((path) => (
                          <span key={`image-temp-${path}`} className="pm-context-item pm-context-image">
                            <ImageIcon size={11} />
                            {path}
                            <button
                              type="button"
                              onClick={() => setAttachedImages((prev) => prev.filter((item) => item !== path))}
                              className="pm-context-remove"
                            aria-label={`Remove ${path}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                        {tempMentionBlocks
                          .map((blockId) => canvasBlocks.find((block) => block.id === blockId))
                          .filter((block): block is CanvasBlock => Boolean(block))
                          .map((block) => {
                            const nodes = block.node_ids
                              .map((id) => canvasNodes.find((node) => node.id === id))
                              .filter(Boolean) as LibraryItem[];
                            const titles = nodes.slice(0, 3).map((node) => node.title).join(" • ");
                            return (
                              <span key={`block-temp-${block.id}`} className="pm-context-item pm-context-mention" title={titles || block.name}>
                                <Folder size={11} className="text-sky-400" />
                                <span className="truncate max-w-[150px]">
                                  {block.name}
                                </span>
                                <span className="text-[10px] text-neutral-500">
                                  {nodes.length} {nodes.length === 1 ? "node" : "nodes"}
                                </span>
                                <span className="text-[10px] text-neutral-500 hidden sm:inline">
                                  {titles || "No nodes"}
                                </span>
                              </span>
                            );
                          })}
                        {tempMentionNodes
                          .map((nodeId) => canvasNodes.find((node) => node.id === nodeId))
                          .filter((node): node is LibraryItem => Boolean(node))
                          .map((node) => (
                          <span
                            key={`node-temp-${node.id}`}
                            className="pm-context-item pm-context-mention"
                            title={node.content || undefined}
                          >
                            <FileText size={11} className="text-emerald-500" />
                            <span className="truncate max-w-[160px]">
                              {node.title} <span className="uppercase text-[9px] text-neutral-500">({node.kind.toLowerCase()})</span>
                            </span>
                            <span className="text-[10px] text-neutral-500 hidden sm:inline">
                              {node.content?.slice(0, 160) || "No content"}
                              {node.content && node.content.length > 160 ? "…" : ""}
                            </span>
                          </span>
                          ))}
                      </div>
                      <div className="relative group">
                        <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-zinc-700/20 via-zinc-600/10 to-zinc-700/20 blur opacity-10 group-hover:opacity-25 transition-opacity duration-300" />
                        <div className="relative flex flex-col w-full bg-[#09090b] border border-zinc-800 rounded-2xl shadow-xl shadow-black/40 focus-within:ring-1 focus-within:ring-zinc-700 focus-within:border-zinc-700 group-hover:border-zinc-700 group-hover:bg-[#0b0b0b] transition-colors duration-200">
                          <div className="relative px-2 pt-2">
                            <textarea
                              disabled={aiLoading}
                              value={tempInput}
                              onChange={(event) => {
                                const next = event.target.value;
                                setTempInput(next);
                                const query = extractMentionQuery(next);
                                if (query !== null) {
                                  setMentionOpen("temp");
                                  setMentionQuery(query);
                                  setMentionIndex(0);
                                } else {
                                  setMentionOpen(null);
                                  setMentionQuery("");
                                }
                              }}
                              onKeyDown={(event) => {
                                if (mentionOpen === "temp") {
                                  if (event.key === "ArrowDown") {
                                    event.preventDefault();
                                    const list = mentionSuggestions;
                                    const maxIndex = Math.max(list.length - 1, 0);
                                    setMentionIndex((prev) => Math.min(prev + 1, maxIndex));
                                    return;
                                  }
                                  if (event.key === "ArrowUp") {
                                    event.preventDefault();
                                    setMentionIndex((prev) => Math.max(prev - 1, 0));
                                    return;
                                  }
                                  if (event.key === "Enter") {
                                    const list = mentionSuggestions;
                                    if (list[mentionIndex]) {
                                      event.preventDefault();
                                      applyMention(tempInput, list[mentionIndex], setTempInput);
                                      return;
                                    }
                                  }
                                  if (event.key === "Escape") {
                                    setMentionOpen(null);
                                    setMentionQuery("");
                                    return;
                                  }
                                }
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  if (!aiLoading) handleSendTempChat();
                                }
                              }}
                              placeholder={aiLoading ? "Thinking..." : "Ask anything..."}
                              rows={2}
                              className={`w-full bg-transparent text-sm font-light text-zinc-100 placeholder-zinc-600 p-4 min-h-[5rem] max-h-48 resize-none outline-none border-none leading-relaxed ${aiLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                            />
                            {mentionOpen === "temp" && (
                              <div className="absolute bottom-4 left-4 right-4 bg-[#0f0f0f] border border-[#252525] rounded-md shadow-lg z-20 max-h-40 overflow-y-auto">
                                {mentionSuggestions.map((suggestion, index) => {
                                  const badgeClass =
                                    suggestion.type === "node"
                                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                      : suggestion.type === "block"
                                        ? "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                                        : "bg-zinc-800 text-zinc-300 border border-zinc-700";
                                  return (
                                    <button
                                      key={suggestion.insert}
                                      type="button"
                                      className={`w-full text-left px-3 py-2 text-[11px] ${index === mentionIndex ? "bg-[#1a1a1a] text-neutral-200" : "text-neutral-400 hover:bg-[#151515]"}`}
                                      onClick={() => applyMention(tempInput, suggestion, setTempInput)}
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-neutral-100">@{suggestion.insert}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${badgeClass}`}>
                                            {suggestion.type === "node" ? "Node" : suggestion.type === "block" ? "Block" : "File"}
                                          </span>
                                        </div>
                                        {suggestion.description && (
                                          <div className="text-[10px] text-neutral-500">{suggestion.description}</div>
                                        )}
                                        {suggestion.preview && (
                                          <div className="text-[10px] text-neutral-500 leading-snug whitespace-normal">
                                            {suggestion.preview}
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                                {mentionSuggestions.length === 0 && (
                                  <div className="px-3 py-2 text-[11px] text-neutral-600">No matches</div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between px-3 pb-3 pt-1">
                            <div className="flex items-center p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setAiModelMode("flash")}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${aiModelMode === "flash"
                                  ? "bg-zinc-800 shadow-sm border border-zinc-700/50 text-zinc-100"
                                  : "text-zinc-500 hover:text-zinc-300"
                                  }`}
                              >
                                <Zap size={12} className="text-amber-400" />
                                Flash
                              </button>
                              <button
                                type="button"
                                onClick={() => setAiModelMode("thinking")}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${aiModelMode === "thinking"
                                  ? "bg-zinc-800 shadow-sm border border-zinc-700/50 text-zinc-100"
                                  : "text-zinc-500 hover:text-zinc-300"
                                  }`}
                              >
                                <BrainCircuit size={12} />
                                Thinking
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              {aiLoading ? (
                                <button
                                  type="button"
                                  onClick={handleStopAi}
                                  className="p-2 text-rose-500 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-all"
                                  title="Stop generating"
                                >
                                  <Square size={14} fill="currentColor" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleImageUploadClick}
                                    className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
                                    title="Upload image"
                                  >
                                    <Paperclip size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSendTempChat}
                                    className="group/send flex items-center justify-center p-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all active:scale-95"
                                  >
                                    <ArrowUp size={16} className="group-hover/send:-translate-y-0.5 group-hover/send:translate-x-0.5 transition-transform" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTempChatOpen(true)}
                      className="pm-temp-toggle"
                    >
                      Open chat
                    </button>
                  )}
                  {aiReviewOpen && (
                    <div className="pm-review-bar">
                      <div className="pm-review-count">
                        {aiChanges.length === 0 ? "0/0" : `${aiChangeIndex + 1}/${aiChanges.length}`}
                      </div>
                      <div className="pm-review-nav">
                        <button
                          type="button"
                          onClick={handlePrevAiChange}
                          disabled={aiChangeIndex <= 0}
                          className="pm-review-icon"
                          aria-label="Previous change"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextAiChange}
                          disabled={aiChangeIndex >= aiChanges.length - 1}
                          className="pm-review-icon"
                          aria-label="Next change"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <div className="pm-review-actions">
                        <button
                          type="button"
                          onClick={handleAcceptAiEdits}
                          className="pm-review-accept"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={handleRejectAiEdits}
                          className="pm-review-reject"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {selectionBox && null}
            </div>

            {/* AI panel moved to chat column */}
          </div>

          {rightOpen && (
            <div
              className="w-1 bg-transparent hover:bg-[#252525] cursor-col-resize transition-colors"
              onMouseDown={(event) => {
                dragRef.current = {
                  type: "right",
                  startX: event.clientX,
                  startY: event.clientY,
                  leftWidth,
                  chatWidth,
                  rightWidth,
                  logHeight,
                };
              }}
            />
          )}

          {rightOpen ? (
            <div
              className="bg-[#0d0d0d] flex flex-col min-w-0 border-l border-[#1a1a1a]"
              style={{ width: rightWidth, flex: "0 0 auto" }}
            >
              <div className="h-10 px-3 flex items-center justify-between border-b border-[#1a1a1a] bg-[#0a0a0a]">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="text-neutral-300 font-medium">Preview</span>
                  {canPreview && <span className="text-[10px] text-neutral-600">click to jump to the code</span>}
                  {pdfSyncNotice && (
                    <span className="text-[10px] text-amber-500">{pdfSyncNotice}</span>
                  )}
                  {compileState === "running" && <Loader size={12} className="animate-spin text-neutral-500" />}
                  {compileState === "success" && <CheckCircle size={12} className="text-emerald-500" />}
                  {compileState === "error" && <AlertTriangle size={12} className="text-red-400" />}
                  {compileState === "timeout" && <AlertTriangle size={12} className="text-amber-500" />}
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={!canPreview || pdfPage <= 1}
                    className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[11px] text-neutral-600 w-12 text-center font-medium">{pageLabel}</span>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={!canPreview || pdfPage >= pdfPages}
                    className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                    title="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <div className="w-px h-4 bg-[#252525] mx-1.5" />
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={!canPreview || pdfZoom <= 0.5}
                    className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    disabled={!canPreview}
                    className="px-2 py-1 rounded-md text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-[#1a1a1a] disabled:opacity-40 transition-colors min-w-[44px]"
                    title="Reset zoom"
                  >
                    {Math.round(pdfZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={!canPreview || pdfZoom >= 2.5}
                    className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn size={14} />
                  </button>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      download={`proofmesh-${problemId}.pdf`}
                      className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 transition-colors"
                      title="Download PDF"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => startDelete(activePath)}
                    disabled={!canEdit}
                    className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
                    title="Delete file"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightOpen(false)}
                    className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-500 hover:text-neutral-300 transition-colors"
                    title="Collapse preview"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-[#0a0a0a] overflow-auto relative">
                {pdfLoading && (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
                    Rendering PDF...
                  </div>
                )}
                {canPreview ? (
                  <div className="min-h-full flex justify-center px-6 py-6">
                    <div className="bg-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden">
                      <canvas
                        ref={pdfCanvasRef}
                        onClick={handlePdfClick}
                        className="block bg-white cursor-crosshair"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-700 text-sm">
                    No PDF yet
                  </div>
                )}
              </div>

              {logOpen ? (
                <>
                  <div
                    className="h-2 w-full cursor-row-resize bg-transparent hover:bg-[#252525] transition-colors"
                    onMouseDown={(event) => {
                      dragRef.current = {
                        type: "log",
                        startX: event.clientX,
                        startY: event.clientY,
                        leftWidth,
                        chatWidth,
                        rightWidth,
                        logHeight,
                      };
                    }}
                  />
                  <div className="border-t border-[#1a1a1a] bg-[#0a0a0a]" style={{ height: logHeight }}>
                    <div className="px-3 py-2 text-xs text-neutral-500 border-b border-[#1a1a1a] flex items-center justify-between">
                      <span className="font-medium">Compiler log</span>
                      <button
                        type="button"
                        onClick={() => setLogOpen(false)}
                        className="text-[10px] text-neutral-600 hover:text-neutral-300 transition-colors"
                      >
                        Collapse
                      </button>
                    </div>
                    <pre className="h-[calc(100%-28px)] overflow-y-auto text-[11px] text-neutral-600 px-3 py-2 whitespace-pre-wrap font-mono">
                      {compileLog || "No logs yet."}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] h-8 flex items-center justify-between px-3 text-xs text-neutral-600">
                  <span>Compiler log</span>
                  <button
                    type="button"
                    onClick={() => setLogOpen(true)}
                    className="text-[10px] text-neutral-600 hover:text-neutral-300 transition-colors"
                  >
                    Open
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-10 bg-[#0a0a0a] border-l border-[#1a1a1a] flex flex-col items-center py-3">
              <button
                type="button"
                onClick={() => setRightOpen(true)}
                className="p-1.5 rounded-md hover:bg-[#1a1a1a] text-neutral-600 hover:text-neutral-300 transition-colors"
                title="Show preview"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </section>
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
      />
      <input
        ref={imageUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleImageUpload(file);
          }
          event.target.value = "";
        }}
      />
    </main>
  );
}
