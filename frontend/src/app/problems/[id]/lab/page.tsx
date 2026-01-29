"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Editor, { type Monaco } from "@monaco-editor/react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
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
  Image,
  Loader,
  Mic,
  Play,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  compileLatexProject,
  deleteLatexPath,
  fetchLatexOutputLog,
  fetchLatexOutputPdf,
  getLatexFile,
  getProblem,
  listLatexFiles,
  putLatexFile,
  renameLatexPath,
  type LatexFileInfo,
  type LatexFileResponse,
  type Problem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

const AUTO_COMPILE_DELAY = 5000;
const SAVE_DEBOUNCE = 800;
const DEFAULT_MAIN = "main.tex";

const LATEX_LANGUAGE_ID = "latex";

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

const PDF_WORKER_SRC = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
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
  const [autoCompileAt, setAutoCompileAt] = useState<number | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [logOpen, setLogOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(480);
  const [logHeight, setLogHeight] = useState(160);
  const [aiHeight, setAiHeight] = useState(240);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string; timestamp: string }[]
  >(() => [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Panel de edición listo. Puedes solicitar revisiones, insertar citas o ajustar el estilo del documento.",
        timestamp: "Ahora",
      },
  ]);

  const saveTimeoutRef = useRef<number | null>(null);
  const compileTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const activeRequestRef = useRef<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const dragRef = useRef<{
    type: "left" | "right" | "log" | "ai" | null;
    startX: number;
    startY: number;
    leftWidth: number;
    rightWidth: number;
    logHeight: number;
    aiHeight: number;
  } | null>(null);


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
      .some((lang) => lang.id === LATEX_LANGUAGE_ID);

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

    monaco.editor.defineTheme("proofmesh-latex", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6B7280" },
        { token: "keyword", foreground: "93C5FD" },
        { token: "string", foreground: "FBBF24" },
        { token: "delimiter", foreground: "9CA3AF" },
      ],
      colors: {
        "editor.background": "#080808",
        "editorLineNumber.foreground": "#3F3F46",
        "editorCursor.foreground": "#F5F5F5",
        "editor.selectionBackground": "#3B82F63A",
      },
    });
  }, []);

  const handleEditorMount = useCallback((editor: any, monaco: Monaco) => {
    monaco.editor.setTheme("proofmesh-latex");
    const model = editor?.getModel?.();
    if (model) {
      monaco.editor.setModelLanguage(model, LATEX_LANGUAGE_ID);
    }
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

  const handleSendAi = useCallback(() => {
    const trimmed = aiInput.trim();
    if (!trimmed) return;
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setAiMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-user`, role: "user", content: trimmed, timestamp },
      {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: "Análisis en curso. Puedo proponer cambios y aplicar fixes en el editor.",
        timestamp,
      },
    ]);
    setAiInput("");
  }, [aiInput]);

  useEffect(() => {
    loadProblem();
  }, [loadProblem]);

  useEffect(() => {
    if (!workspaceReady) return;
    refreshFiles();
  }, [workspaceReady, refreshFiles]);

  useEffect(() => {
    if (!workspaceReady || !activePath) return;
    loadFile(activePath);
  }, [workspaceReady, activePath, loadFile]);

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
    const getLimits = () => {
      const collapsedLeft = 40;
      const collapsedRight = 40;
      const minCenter = 360;
      const available = window.innerWidth;
      const left = leftOpen ? leftWidth + 1 : collapsedLeft;
      const right = rightOpen ? rightWidth + 1 : collapsedRight;
      const maxLeft = Math.max(200, available - right - minCenter);
      const maxRight = Math.max(320, available - left - minCenter);
      return { maxLeft, maxRight };
    };

    const handleMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { maxLeft, maxRight } = getLimits();
      if (drag.type === "left") {
        const next = clamp(drag.leftWidth + (event.clientX - drag.startX), 200, maxLeft);
        setLeftWidth(next);
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
      if (drag.type === "ai") {
        const next = clamp(drag.aiHeight - (event.clientY - drag.startY), 180, 380);
        setAiHeight(next);
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
      const { maxLeft, maxRight } = getLimits();
      setLeftWidth((prev) => clamp(prev, 200, maxLeft));
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
  }, [leftOpen, rightOpen, leftWidth, rightWidth]);

  const renderCreateRow = useCallback(
    (parent: string, depth: number) => {
      if (!createTarget || createTarget.parent !== parent) return null;
      const padding = 8 + depth * 12;
      return (
        <div
          className="flex items-center gap-2 px-2 py-1"
          style={{ paddingLeft: padding }}
        >
          <div className="text-[11px] text-neutral-500">
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
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 placeholder-neutral-600 outline-none"
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
              className={`w-full flex items-center gap-1.5 py-1 text-xs text-left rounded px-2 group ${
                node.path === "" ? "text-neutral-500" : "text-neutral-300"
              }`}
              style={{ paddingLeft: padding }}
            >
              <button
                type="button"
                onClick={() => toggleDir(node.path)}
                className="flex items-center gap-1.5 flex-1"
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Folder size={12} className="text-neutral-500" />
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
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-[11px] text-neutral-200"
                  />
                ) : (
                  <span>{node.name || "root"}</span>
                )}
              </button>
              {!isRenaming && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleCreateFile(node.path)}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                    title="New file"
                  >
                    <FilePlus size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateFolder(node.path)}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                    title="New folder"
                  >
                    <FolderPlus size={12} />
                  </button>
                  {node.path && (
                    <>
                      <button
                        type="button"
                        onClick={() => startRename(node.path)}
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(node.path)}
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
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
                className="flex items-center gap-2 px-2 py-1 text-[11px] text-neutral-500"
                style={{ paddingLeft: padding + 12 }}
              >
                <span>Delete folder?</span>
                <button
                  type="button"
                  onClick={() => handleDeleteFile(node.path, true)}
                  className="px-2 py-0.5 rounded bg-neutral-100 text-black text-[10px]"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="px-2 py-0.5 rounded border border-neutral-800 text-[10px]"
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
          className={`w-full flex items-center gap-1.5 py-1 text-xs rounded px-2 hover:bg-neutral-900 group ${
            activePath === node.path ? "bg-neutral-900 text-white" : "text-neutral-400"
          }`}
          style={{ paddingLeft: padding }}
        >
          <button
            type="button"
            onClick={() => handleSelectFile(node.path)}
            className="flex items-center gap-1.5 flex-1 min-w-0"
          >
            <Icon size={12} className="text-neutral-500" />
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
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-[11px] text-neutral-200"
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </button>
          {!isRenaming && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => startRename(node.path)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                title="Rename"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => startDelete(node.path)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
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
                className="px-2 py-0.5 rounded bg-neutral-100 text-black text-[10px]"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={cancelDelete}
                className="px-2 py-0.5 rounded border border-neutral-800 text-[10px]"
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
    <main className="workspace-shell h-screen w-screen overflow-hidden flex flex-col text-sm selection:bg-indigo-500/30 selection:text-indigo-200">
      <header className="h-12 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 glass-panel z-20">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-5 h-5 bg-neutral-200 rounded flex items-center justify-center text-black">
              <Infinity size={14} />
            </div>
            <span className="font-semibold tracking-tight text-neutral-200 text-base">ProofMesh</span>
          </Link>

          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-colors">
            <span className="text-xs font-medium">{problem?.title || "Problem"}</span>
            <ChevronRight size={12} />
            <span className="text-xs font-medium text-neutral-200">LaTeX Workspace</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runCompile("manual")}
            disabled={!canEdit}
            className="px-3 py-1 rounded text-xs font-medium bg-neutral-100 text-black hover:bg-neutral-300 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Play size={12} />
            Compile
          </button>
          <button
            type="button"
            onClick={loadPdf}
            className="p-1 rounded hover:bg-neutral-900 text-neutral-400"
            title="Refresh PDF"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {!leftOpen && (
          <div className="w-10 bg-neutral-950 border-r border-neutral-800 flex flex-col items-center py-3">
            <button
              type="button"
              onClick={() => setLeftOpen(true)}
              className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200"
              title="Show files"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {leftOpen && (
          <>
            <aside
              className="bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0 hidden md:flex"
              style={{ width: leftWidth, flex: "0 0 auto" }}
            >
          <div className="p-4 border-b border-neutral-900">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Files</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCreateFile("")}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="New file"
                >
                  <FilePlus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateFolder("")}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="New folder"
                >
                  <FolderPlus size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="Upload asset"
                >
                  <Upload size={14} />
                </button>
                <button
                  type="button"
                  onClick={refreshFiles}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setLeftOpen(false)}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                  title="Collapse files"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>
            {!canEdit && <p className="mt-2 text-[10px] text-neutral-600">Read-only</p>}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {renderCreateRow("", 0)}
            {fileTree?.children?.length ? (
              fileTree.children.map((child) => renderNode(child, 0))
            ) : (
              <div className="px-2 py-2 text-[11px] text-neutral-500">No files yet</div>
            )}
          </div>

          <div className="p-3 border-t border-neutral-900 flex items-center gap-2 text-[10px] text-neutral-500">
            <span className="uppercase tracking-wider">Auto-compile</span>
            {autoCompileAt ? (
              <span className="text-neutral-300">scheduled</span>
            ) : (
              <span>idle</span>
            )}
          </div>
        </aside>
        <div
          className="w-1 bg-neutral-900/80 hover:bg-neutral-800 cursor-col-resize hidden md:block"
          onMouseDown={(event) => {
            dragRef.current = {
              type: "left",
              startX: event.clientX,
              startY: event.clientY,
              leftWidth,
              rightWidth,
              logHeight,
              aiHeight,
            };
          }}
        />
          </>
        )}

        <section className="flex-1 flex overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col border-r border-neutral-900 bg-[#080808] min-w-0">
            <div className="h-10 px-4 flex items-center justify-between border-b border-neutral-900">
              <div className="flex items-center gap-2 text-xs text-neutral-400 min-w-0 flex-1">
                <FileText size={12} />
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {openTabs.map((tab) => (
                    <div
                      key={tab}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        tab === activePath
                          ? "border-neutral-600 bg-neutral-900 text-neutral-100"
                          : "border-neutral-800 bg-neutral-950 text-neutral-500"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActivePath(tab)}
                        className="truncate max-w-[140px]"
                      >
                        {tab}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCloseTab(tab)}
                        className="text-neutral-500 hover:text-neutral-200"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                {fileLoading && <Loader size={12} className="animate-spin" />}
              </div>
              <div className="flex items-center gap-2 text-xs">
                {saveState === "saving" && (
                  <span className="text-neutral-500">Saving...</span>
                )}
                {saveState === "saved" && (
                  <span className="text-emerald-400">Saved</span>
                )}
                {saveState === "error" && (
                  <span className="text-red-400">Save error</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {binaryPreview ? (
                <div className="h-full flex items-center justify-center text-neutral-500 text-sm p-6">
                  {binaryPreview.content_type?.startsWith("image/") && binaryPreview.content_base64 ? (
                    <img
                      src={`data:${binaryPreview.content_type};base64,${binaryPreview.content_base64}`}
                      alt={binaryPreview.path}
                      className="max-h-full max-w-full object-contain rounded border border-neutral-800"
                    />
                  ) : (
                    <div>
                      <p className="text-neutral-300">Binary file</p>
                      <p className="text-xs text-neutral-500">Download via file list.</p>
                    </div>
                  )}
                </div>
              ) : (
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
                    minimap: { enabled: false },
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    renderLineHighlight: "all",
                    readOnly: !canEdit,
                  }}
                />
              )}
            </div>

            {aiOpen ? (
              <>
                <div
                  className="h-2 w-full cursor-row-resize bg-neutral-900/70"
                  onMouseDown={(event) => {
                    dragRef.current = {
                      type: "ai",
                      startX: event.clientX,
                      startY: event.clientY,
                      leftWidth,
                      rightWidth,
                      logHeight,
                      aiHeight,
                    };
                  }}
                />
                <div
                  className="border-t border-neutral-900 bg-[#121316]"
                  style={{ height: aiHeight }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80">
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
                      <span className="text-neutral-200 font-medium">Review Panel</span>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Workspace</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                      <span className="px-2 py-1 rounded-full bg-neutral-900/80 border border-neutral-800">
                        Context: {activePath}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAiOpen(false)}
                        className="px-2 py-1 rounded-full border border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200"
                      >
                        Collapse
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col h-[calc(100%-52px)]">
                    <div className="px-4 py-3 text-[11px] text-neutral-500 border-b border-neutral-900">
                      Estoy obteniendo el contenido del archivo {activePath}.
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 text-[11px] text-neutral-400">
                          <span className="uppercase tracking-[0.2em]">Proposed changes</span>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                            <button className="hover:text-neutral-200">Undo all</button>
                            <button className="hover:text-neutral-200">Keep all</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 text-neutral-400">
                            <span className="text-neutral-500">{activePath}:77</span>
                            <span className="text-neutral-300 italic">Ejemplo chulo</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-emerald-400">+1</span>
                            <span className="text-rose-400">-2</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 px-3 py-2 text-xs text-neutral-300">
                        Se reemplazó el ejemplo seleccionado por uno más llamativo que genera una
                        figura con TikZ en una sola columna.
                      </div>

                      <div className="space-y-2">
                        {aiMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                              message.role === "user"
                                ? "bg-neutral-800 text-neutral-100 ml-6"
                                : "bg-neutral-900/60 text-neutral-300 border border-neutral-800"
                            }`}
                          >
                            <div className="text-[10px] text-neutral-500 mb-1">{message.timestamp}</div>
                            {message.content}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2">
                        <input
                          value={aiInput}
                          onChange={(event) => setAiInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              handleSendAi();
                            }
                          }}
                          placeholder="Request edits, add citations, or rewrite…"
                          className="flex-1 bg-transparent text-xs text-neutral-200 placeholder-neutral-600 outline-none"
                        />
                        <div className="flex items-center gap-2 text-neutral-500">
                          <button type="button" className="p-1 rounded hover:bg-neutral-800">
                            <Image size={14} />
                          </button>
                          <button type="button" className="p-1 rounded hover:bg-neutral-800">
                            <Mic size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={handleSendAi}
                            className="p-1 rounded hover:bg-neutral-800 text-neutral-200"
                          >
                            <Send size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="border-t border-neutral-900 bg-[#121316] h-8 flex items-center justify-between px-4 text-xs text-neutral-500">
                <span>Review Panel</span>
                <button
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-200"
                >
                  Open
                </button>
              </div>
            )}
          </div>

          {rightOpen && (
            <div
              className="w-1 bg-neutral-900/80 hover:bg-neutral-800 cursor-col-resize"
              onMouseDown={(event) => {
                dragRef.current = {
                  type: "right",
                  startX: event.clientX,
                  startY: event.clientY,
                  leftWidth,
                  rightWidth,
                  logHeight,
                  aiHeight,
                };
              }}
            />
          )}

          {rightOpen ? (
          <div
            className="bg-neutral-950 flex flex-col min-w-0"
            style={{ width: rightWidth, flex: "0 0 auto" }}
          >
            <div className="h-10 px-4 flex items-center justify-between border-b border-neutral-900">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="text-neutral-200">Preview</span>
                {compileState === "running" && <Loader size={12} className="animate-spin" />}
                {compileState === "success" && <CheckCircle size={12} className="text-emerald-400" />}
                {compileState === "error" && <AlertTriangle size={12} className="text-red-400" />}
                {compileState === "timeout" && <AlertTriangle size={12} className="text-amber-400" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={!canPreview || pdfPage <= 1}
                  className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[11px] text-neutral-500 w-12 text-center">{pageLabel}</span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={!canPreview || pdfPage >= pdfPages}
                  className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="Next page"
                >
                  <ChevronRight size={14} />
                </button>
                <div className="w-px h-4 bg-neutral-800 mx-1" />
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={!canPreview || pdfZoom <= 0.5}
                  className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="Zoom out"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  disabled={!canPreview}
                  className="px-2 py-1 rounded text-[10px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 disabled:opacity-40"
                  title="Reset zoom"
                >
                  {Math.round(pdfZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={!canPreview || pdfZoom >= 2.5}
                  className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="Zoom in"
                >
                  <ZoomIn size={14} />
                </button>
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    download={`proofmesh-${problemId}.pdf`}
                    className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200"
                    title="Download PDF"
                  >
                    <Download size={14} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => startDelete(activePath)}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="Delete file"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRightOpen(false)}
                  className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200"
                  title="Collapse preview"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#0e0e0f] overflow-auto relative">
              {pdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">
                  Rendering PDF...
                </div>
              )}
              {canPreview ? (
                <div className="min-h-full flex justify-center px-6 py-6">
                  <div className="bg-white shadow-[0_15px_45px_rgba(0,0,0,0.35)] rounded-sm overflow-hidden">
                    <canvas ref={pdfCanvasRef} className="block bg-white" />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                  No PDF yet
                </div>
              )}
            </div>

            {logOpen ? (
              <>
                <div
                  className="h-2 w-full cursor-row-resize bg-neutral-900/70"
                  onMouseDown={(event) => {
                    dragRef.current = {
                      type: "log",
                      startX: event.clientX,
                      startY: event.clientY,
                      leftWidth,
                      rightWidth,
                      logHeight,
                      aiHeight,
                    };
                  }}
                />
                <div className="border-t border-neutral-900 bg-[#0b0b0b]" style={{ height: logHeight }}>
                  <div className="px-3 py-2 text-xs text-neutral-400 border-b border-neutral-900 flex items-center justify-between">
                    <span>Compiler log</span>
                    <button
                      type="button"
                      onClick={() => setLogOpen(false)}
                      className="text-[10px] text-neutral-500 hover:text-neutral-200"
                    >
                      Collapse
                    </button>
                  </div>
                  <pre className="h-[calc(100%-28px)] overflow-y-auto text-[11px] text-neutral-500 px-3 py-2 whitespace-pre-wrap">
                    {compileLog || "No logs yet."}
                  </pre>
                </div>
              </>
            ) : (
              <div className="border-t border-neutral-900 bg-[#0b0b0b] h-8 flex items-center justify-between px-3 text-xs text-neutral-500">
                <span>Compiler log</span>
                <button
                  type="button"
                  onClick={() => setLogOpen(true)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-200"
                >
                  Open
                </button>
              </div>
            )}
          </div>
          ) : (
            <div className="w-10 bg-neutral-950 border-l border-neutral-800 flex flex-col items-center py-3">
              <button
                type="button"
                onClick={() => setRightOpen(true)}
                className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-neutral-200"
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
    </main>
  );
}
