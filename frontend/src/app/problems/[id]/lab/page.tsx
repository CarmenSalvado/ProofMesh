"use client";

import { use, useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Infinity,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  Share2,
  Search,
  Folder,
  FilePlus,
  FolderPlus,
  FileText,
  Hash,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { WorkspaceEditor, WorkspaceEditorHandle } from "@/components/workspace/WorkspaceEditor";
import { AgentStudioPanel } from "@/components/agents/AgentStudioPanel";
import {
  getProblem,
  getLibraryItems,
  getWorkspaceContent,
  listWorkspaceContents,
  createWorkspaceDirectory,
  deleteWorkspaceContent,
  renameWorkspaceContent,
  upsertWorkspaceContent,
  Problem,
  LibraryItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

type WorkspaceNode = {
  name: string;
  path: string;
  type: "directory" | "file" | "notebook";
  format?: string | null;
  children?: WorkspaceNode[];
};

const DEFAULT_WORKSPACE_PATH = "notes.md";

function buildFallbackMarkdown(title: string) {
  return `# ${title}

## Notes
`;
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "Edited recently";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return `Edited ${minutes}m ago`;
  if (hours < 24) return `Edited ${hours}h ago`;
  return `Edited ${days}d ago`;
}

export default function LabPage({ params }: PageProps) {
  const { id: problemId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [fileTree, setFileTree] = useState<WorkspaceNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set([""]));
  const [doc, setDoc] = useState<string | null>(null);
  const [docWritable, setDocWritable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const editorRef = useRef<WorkspaceEditorHandle | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [problemData, libraryData] = await Promise.all([
        getProblem(problemId),
        getLibraryItems(problemId),
      ]);
      setProblem(problemData);
      setLibraryItems(libraryData.items);
    } catch (err) {
      console.error("Failed to load problem:", err);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  const sanitizeSegment = useCallback((value: string) => {
    return value.trim().replace(/[\\/]/g, "-").replace(/\s+/g, "-");
  }, []);

  const normalizeFolder = useCallback((value: string) => {
    return value.trim().replace(/^\/+|\/+$/g, "");
  }, []);

  const isMarkdownFile = useCallback((node: WorkspaceNode) => {
    const name = node.name.toLowerCase();
    return (
      node.type === "file" &&
      (node.format === "markdown" || name.endsWith(".md") || name.endsWith(".markdown"))
    );
  }, []);

  const buildTree = useCallback(
    async (path = ""): Promise<WorkspaceNode> => {
      const entry = await listWorkspaceContents(problemId, path);
      const childrenRaw = Array.isArray(entry.content) ? entry.content : [];
      const children = await Promise.all(
        childrenRaw.map(async (child) => {
          if (child.type === "directory") {
            return buildTree(child.path);
          }
          return {
            name: child.name,
            path: child.path,
            type: child.type as WorkspaceNode["type"],
            format: child.format,
          };
        })
      );
      children.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "directory" ? -1 : 1;
      });
      return {
        name: entry.name || "",
        path: entry.path || "",
        type: "directory",
        children,
      };
    },
    [problemId]
  );

  const findNode = useCallback((node: WorkspaceNode, path: string): WorkspaceNode | null => {
    if (node.path === path) return node;
    if (!node.children) return null;
    for (const child of node.children) {
      const found = findNode(child, path);
      if (found) return found;
    }
    return null;
  }, []);

  const findFirstMarkdown = useCallback(
    (node: WorkspaceNode): string | null => {
      if (isMarkdownFile(node)) return node.path;
      if (!node.children) return null;
      for (const child of node.children) {
        const found = findFirstMarkdown(child);
        if (found) return found;
      }
      return null;
    },
    [isMarkdownFile]
  );

  const loadFileTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const tree = await buildTree("");
      const firstMarkdown = findFirstMarkdown(tree);
      if ((tree.children || []).length === 0 || !firstMarkdown) {
        const fallbackTitle = problem?.title || "Problem Notes";
        await upsertWorkspaceContent(
          problemId,
          DEFAULT_WORKSPACE_PATH,
          buildFallbackMarkdown(fallbackTitle)
        );
        const rebuilt = await buildTree("");
        setFileTree(rebuilt);
      } else {
        setFileTree(tree);
      }
    } catch (err) {
      console.error("Failed to load workspace files:", err);
      setDocError(err instanceof Error ? err.message : "Failed to load files");
      setFileTree(null);
    } finally {
      setTreeLoading(false);
    }
  }, [buildTree, problemId, problem?.title, findFirstMarkdown]);

  const loadDocument = useCallback(
    async (path: string) => {
      setDocLoading(true);
      setDocError(null);
      try {
        const content = await getWorkspaceContent(problemId, path);
        const text = typeof content.content === "string" ? content.content : "";
        setDoc(text);
        setDocWritable(content.writable);
        lastSavedRef.current = text;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load document";
        if (message.includes("File not found")) {
          try {
            const fileName = path.split("/").pop() || "notes";
            const fallbackTitle = fileName.replace(/\.md$/i, "");
            const created = await upsertWorkspaceContent(
              problemId,
              path,
              buildFallbackMarkdown(fallbackTitle || "Notes")
            );
            const createdText =
              typeof created.content === "string"
                ? created.content
                : buildFallbackMarkdown(fallbackTitle || "Notes");
            setDoc(createdText);
            setDocWritable(created.writable);
            lastSavedRef.current = createdText;
          } catch (createErr) {
            setDocError(
              createErr instanceof Error ? createErr.message : "Failed to create document"
            );
          }
        } else {
          setDocError(message);
        }
      } finally {
        setDocLoading(false);
      }
    },
    [problemId]
  );

  useEffect(() => {
    loadWorkspace();
    loadFileTree();
  }, [loadWorkspace, loadFileTree]);

  useEffect(() => {
    if (!fileTree || workspacePath) return;
    const requested = searchParams.get("file");
    const requestedPath = requested ? decodeURIComponent(requested) : null;
    if (requestedPath && findNode(fileTree, requestedPath)) {
      setWorkspacePath(requestedPath);
      return;
    }
    const first = findFirstMarkdown(fileTree);
    if (first) {
      setWorkspacePath(first);
    }
  }, [fileTree, workspacePath, searchParams, findNode, findFirstMarkdown]);

  useEffect(() => {
    if (!workspacePath) return;
    loadDocument(workspacePath);
  }, [workspacePath, loadDocument]);

  const handleMarkdownChange = useCallback((markdown: string) => {
    setDoc(markdown);
  }, []);

  useEffect(() => {
    if (!docWritable || doc === null || docLoading || !workspacePath) return;
    if (doc === lastSavedRef.current) return;

    setSaveState("saving");
    const timeout = setTimeout(async () => {
      try {
        await upsertWorkspaceContent(problemId, workspacePath, doc);
        lastSavedRef.current = doc;
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch (err) {
        console.error("Failed to save:", err);
        setSaveState("error");
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [doc, docWritable, docLoading, problemId, workspacePath]);

  const canEdit = useMemo(() => {
    return !!user && !!problem && problem.author.id === user.id;
  }, [user, problem]);

  const handleInsertMarkdown = useCallback(
    (markdown: string) => {
      if (!docWritable) return;
      if (editorRef.current) {
        editorRef.current.insertMarkdown(markdown);
        return;
      }
      setDoc((prev) => `${prev || ""}${markdown}`);
    },
    [docWritable]
  );

  const handleSelectFile = useCallback(
    (path: string) => {
      setWorkspacePath(path);
      router.replace(`/problems/${problemId}/lab?file=${encodeURIComponent(path)}`);
    },
    [router, problemId]
  );

  const handleCreateFile = useCallback(
    async (folderPath = "") => {
      if (!canEdit) return;
      const rawName = window.prompt("Markdown file name");
      if (!rawName) return;
      const cleaned = sanitizeSegment(rawName);
      const nameWithExt = cleaned.toLowerCase().endsWith(".md") ? cleaned : `${cleaned}.md`;
      const normalizedFolder = normalizeFolder(folderPath);
      try {
        const listing = await listWorkspaceContents(problemId, normalizedFolder);
        const existing = new Set(
          Array.isArray(listing.content) ? listing.content.map((entry) => entry.name) : []
        );
        let candidate = nameWithExt;
        let counter = 1;
        while (existing.has(candidate)) {
          const base = nameWithExt.replace(/\.md$/i, "");
          candidate = `${base}-${counter}.md`;
          counter += 1;
        }
        const path = normalizedFolder ? `${normalizedFolder}/${candidate}` : candidate;
        await upsertWorkspaceContent(
          problemId,
          path,
          buildFallbackMarkdown(candidate.replace(/\.md$/i, ""))
        );
        await loadFileTree();
        handleSelectFile(path);
      } catch (err) {
        setDocError(err instanceof Error ? err.message : "Failed to create file");
      }
    },
    [problemId, handleSelectFile, loadFileTree, normalizeFolder, sanitizeSegment, canEdit]
  );

  const handleCreateFolder = useCallback(
    async (folderPath = "") => {
      if (!canEdit) return;
      const rawName = window.prompt("Folder name");
      if (!rawName) return;
      const cleaned = sanitizeSegment(rawName);
      const normalizedFolder = normalizeFolder(folderPath);
      const path = normalizedFolder ? `${normalizedFolder}/${cleaned}` : cleaned;
      try {
        await createWorkspaceDirectory(problemId, path);
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });
        await loadFileTree();
      } catch (err) {
        setDocError(err instanceof Error ? err.message : "Failed to create folder");
      }
    },
    [problemId, loadFileTree, normalizeFolder, sanitizeSegment, canEdit]
  );

  const handleRenameEntry = useCallback(
    async (node: WorkspaceNode) => {
      if (!canEdit) return;
      const rawName = window.prompt("New name", node.name);
      if (!rawName || rawName === node.name) return;
      const cleaned = sanitizeSegment(rawName);
      const parentPath = node.path.split("/").slice(0, -1).join("/");
      const extension = node.type === "file" && node.name.includes(".")
        ? node.name.slice(node.name.lastIndexOf("."))
        : "";
      const nextName =
        node.type === "file" && !cleaned.includes(".") ? `${cleaned}${extension || ".md"}` : cleaned;
      const nextPath = parentPath ? `${parentPath}/${nextName}` : nextName;
      try {
        await renameWorkspaceContent(problemId, node.path, nextPath);
        if (workspacePath === node.path) {
          setWorkspacePath(nextPath);
        }
        if (node.type === "directory" && workspacePath?.startsWith(`${node.path}/`)) {
          const suffix = workspacePath.slice(node.path.length + 1);
          setWorkspacePath(`${nextPath}/${suffix}`);
        }
        setExpandedDirs((prev) => {
          if (!prev.has(node.path)) return prev;
          const next = new Set(prev);
          next.delete(node.path);
          next.add(nextPath);
          return next;
        });
        await loadFileTree();
      } catch (err) {
        setDocError(err instanceof Error ? err.message : "Failed to rename");
      }
    },
    [problemId, workspacePath, loadFileTree, sanitizeSegment, canEdit]
  );

  const handleDeleteEntry = useCallback(
    async (node: WorkspaceNode) => {
      if (!canEdit) return;
      const confirmed = window.confirm(`Delete "${node.name}"?`);
      if (!confirmed) return;
      try {
        await deleteWorkspaceContent(problemId, node.path);
        if (workspacePath === node.path) {
          setWorkspacePath(null);
          setDoc(null);
        }
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          next.delete(node.path);
          return next;
        });
        await loadFileTree();
        if (workspacePath === node.path && fileTree) {
          const refreshed = await buildTree("");
          const nextPath = findFirstMarkdown(refreshed);
          setFileTree(refreshed);
          if (nextPath) {
            setWorkspacePath(nextPath);
          }
        }
      } catch (err) {
        setDocError(err instanceof Error ? err.message : "Failed to delete");
      }
    },
    [problemId, workspacePath, loadFileTree, fileTree, buildTree, findFirstMarkdown, canEdit]
  );

  const toggleDirectory = useCallback((path: string) => {
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

  const groupedItems = useMemo(() => {
    const groups = {
      resources: [] as LibraryItem[],
      ideas: [] as LibraryItem[],
      lemmas: [] as LibraryItem[],
      contents: [] as LibraryItem[],
    };
    libraryItems.forEach((item) => {
      if (item.kind === "resource") {
        groups.resources.push(item);
      } else if (item.kind === "idea") {
        groups.ideas.push(item);
      } else if (["lemma", "theorem", "claim", "counterexample"].includes(item.kind)) {
        groups.lemmas.push(item);
      } else {
        groups.contents.push(item);
      }
    });
    return groups;
  }, [libraryItems]);

  const verifiedCount = useMemo(
    () => libraryItems.filter((item) => item.status === "verified").length,
    [libraryItems]
  );

  const editedLabel = useMemo(() => formatRelativeTime(problem?.updated_at), [problem]);
  const workspaceLabel = useMemo(() => {
    if (!workspacePath) return "Untitled file";
    const name = workspacePath.split("/").pop();
    return (name || workspacePath).replace(/\.md$/i, "");
  }, [workspacePath]);
  const contributorCount = useMemo(() => {
    const ids = new Set<string>();
    if (problem?.author) {
      ids.add(`human:${problem.author.id}`);
    }
    if (user) {
      ids.add(`human:${user.id}`);
    }
    libraryItems.forEach((item) => {
      item.authors?.forEach((author) => {
        ids.add(`${author.type}:${author.id}`);
      });
    });
    return ids.size;
  }, [problem, user, libraryItems]);

  const renderNode = useCallback(
    (node: WorkspaceNode, level = 0) => {
      const padding = `${level * 12 + 8}px`;
      if (node.type === "directory") {
        const isOpen = expandedDirs.has(node.path);
        return (
          <div key={node.path}>
            <div
              className="group flex items-center gap-2 py-1 px-2 text-[12px] rounded-[4px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 cursor-pointer transition-colors"
              style={{ paddingLeft: padding }}
              onClick={() => toggleDirectory(node.path)}
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Folder size={14} className="text-neutral-500" />
              <span className="truncate flex-1">{node.name || "Root"}</span>
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCreateFile(node.path);
                  }}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="New file"
                >
                  <FilePlus size={12} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCreateFolder(node.path);
                  }}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="New folder"
                >
                  <FolderPlus size={12} />
                </button>
                {node.path && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRenameEntry(node);
                    }}
                    disabled={!canEdit}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {node.path && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteEntry(node);
                    }}
                    disabled={!canEdit}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-red-300 disabled:opacity-40"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            {isOpen &&
              node.children?.map((child) => renderNode(child, level + 1))}
          </div>
        );
      }

      const isActive = workspacePath === node.path;
      const isMarkdown = isMarkdownFile(node);
      return (
        <div
          key={node.path}
          className={`group flex items-center gap-2 py-1 px-2 text-[12px] rounded-[4px] transition-colors ${
            isActive
              ? "bg-neutral-900 text-neutral-100"
              : isMarkdown
                ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 cursor-pointer"
                : "text-neutral-600 cursor-not-allowed"
          }`}
          style={{ paddingLeft: padding }}
          onClick={() => {
            if (!isMarkdown) return;
            handleSelectFile(node.path);
          }}
        >
          <FileText size={14} className={isActive ? "text-sky-300" : "text-neutral-500"} />
          <span className="truncate flex-1">{node.name}</span>
          <div className="hidden group-hover:flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleRenameEntry(node);
              }}
              disabled={!canEdit}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
              title="Rename"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteEntry(node);
              }}
              disabled={!canEdit}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-red-300 disabled:opacity-40"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      );
    },
    [
      expandedDirs,
      workspacePath,
      handleSelectFile,
      handleCreateFile,
      handleCreateFolder,
      handleRenameEntry,
      handleDeleteEntry,
      toggleDirectory,
      canEdit,
      isMarkdownFile,
    ]
  );

  if (loading && !problem) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-neutral-500">
        Loading problem files...
      </div>
    );
  }

  return (
    <main className="workspace-shell h-screen w-screen overflow-hidden flex flex-col text-sm selection:bg-indigo-500/30 selection:text-indigo-200">
      <header className="h-12 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 glass-panel z-20">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-5 h-5 bg-gradient-to-tr from-neutral-200 to-neutral-500 rounded flex items-center justify-center text-black">
              <Infinity size={14} />
            </div>
            <span className="font-semibold tracking-tight text-neutral-200 text-base">ProofMesh</span>
          </Link>

          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-colors">
            <span className="text-xs font-medium">{problem?.title || "Problem"}</span>
            <ChevronRight size={12} />
            <span className="text-xs font-medium text-neutral-200">{workspaceLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Users size={14} />
            <span>{contributorCount} contributors</span>
          </div>
          <button className="bg-neutral-100 text-black px-3 py-1 rounded text-xs font-medium hover:bg-neutral-300 transition-colors flex items-center gap-1.5">
            <Share2 size={12} />
            Share
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col hidden md:flex shrink-0">
          <div className="p-4 border-b border-neutral-900">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Files
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleCreateFile("")}
                  disabled={!canEdit}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
                  title="New markdown file"
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
                  onClick={loadFileTree}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                  title="Refresh"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            {!canEdit && (
              <p className="mt-2 text-[10px] text-neutral-600">Read-only files</p>
            )}
          </div>

          <div className="px-2 py-2 border-b border-neutral-900">
            {treeLoading ? (
              <div className="px-2 py-2 text-[11px] text-neutral-500">Loading files...</div>
            ) : fileTree && (fileTree.children || []).length > 0 ? (
              <div className="space-y-0.5">
                {fileTree.children?.map((child) => renderNode(child, 0))}
              </div>
            ) : (
              <div className="px-2 py-2 text-[11px] text-neutral-500">
                No files yet
              </div>
            )}
          </div>

          <div className="p-4 border-b border-neutral-900">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-neutral-500" size={14} />
              <input
                type="text"
                placeholder="Search knowledge..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded py-1.5 pl-8 pr-3 text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-6">
            {[
              { key: "resources", label: "Resources", icon: FileText, accent: "text-slate-400" },
              { key: "ideas", label: "Ideas", icon: FileText, accent: "text-fuchsia-400" },
              { key: "lemmas", label: "Lemmas", icon: Hash, accent: "text-emerald-400" },
              { key: "contents", label: "Contents", icon: FileText, accent: "text-cyan-400" },
            ].map((section) => {
              const items = groupedItems[section.key as keyof typeof groupedItems];
              const filteredItems = searchQuery
                ? items.filter((item) =>
                    item.title.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : items;
              const Icon = section.icon;
              return (
                <div key={section.key}>
                  <h3 className="px-2 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2">
                    {section.label}
                  </h3>
                  <ul className="space-y-0.5">
                    {filteredItems.length === 0 ? (
                      <li className="px-2 py-1.5 rounded text-neutral-500 text-xs">
                        {searchQuery ? "No matches" : `No ${section.label.toLowerCase()} yet`}
                      </li>
                    ) : (
                      filteredItems.slice(0, 6).map((item) => (
                        <li
                          key={item.id}
                          className="px-2 py-1.5 rounded hover:bg-neutral-900/50 text-neutral-400 hover:text-neutral-200 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Icon className={section.accent} size={14} />
                          <span className="truncate">{item.title}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-neutral-900 text-neutral-500 text-xs flex justify-between items-center">
            <span>{verifiedCount} Nodes verified</span>
            <CheckCircle size={14} />
          </div>
        </aside>

        <section className="flex-1 bg-[#080808] overflow-y-auto relative scroll-smooth">
          <div className="glow-point top-0 left-1/4 opacity-40" />

          <div className="max-w-[1100px] mx-auto py-12 px-8 min-h-screen">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-neutral-100 tracking-tight mb-4">
                {problem?.title || "Problem"}
              </h1>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {editedLabel}
                </span>
                <span className="w-1 h-1 rounded-full bg-neutral-700" />
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle size={12} /> {verifiedCount} Verified Blocks
                </span>
                {saveState === "saving" && (
                  <span className="text-[10px] text-indigo-300">Saving...</span>
                )}
                {saveState === "saved" && (
                  <span className="text-[10px] text-emerald-300">Saved</span>
                )}
                {saveState === "error" && (
                  <span className="text-[10px] text-red-400">Save failed</span>
                )}
              </div>
            </div>

            {docError && (
              <div className="mb-6 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                {docError}
              </div>
            )}

            {docLoading || doc === null ? (
              <div className="rounded border border-neutral-800 bg-neutral-900/30 p-6 text-neutral-500">
                Loading editor...
              </div>
            ) : (
              <WorkspaceEditor
                ref={editorRef}
                initialMarkdown={doc}
                onChange={handleMarkdownChange}
                readOnly={!docWritable}
              />
            )}
          </div>
        </section>

        <AgentStudioPanel
          problemId={problemId}
          context={doc || ""}
          onInsertMarkdown={handleInsertMarkdown}
          readOnly={!docWritable}
          filePath={workspacePath}
          connectedCount={contributorCount}
        />
      </div>

      <button
        className="fixed bottom-6 right-6 md:hidden bg-neutral-900/80 border border-neutral-700 text-neutral-200 px-3 py-2 rounded-full shadow-lg flex items-center gap-2"
        type="button"
      >
        <MoreHorizontal size={16} />
        Panels
      </button>
    </main>
  );
}
