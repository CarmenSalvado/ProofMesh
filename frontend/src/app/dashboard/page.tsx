"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getProblems,
  Problem,
  getLibraryItems,
  LibraryItem,
  getCanvasBlocks,
  CanvasBlock,
  listLatexFiles,
  LatexFileInfo,
  getLatexFile,
  getSocialFeed,
  getSocialConnections,
  getSocialUsers,
  followUser,
  unfollowUser,
  SocialFeedItem,
  SocialUser,
  SocialConnectionsResponse,
  createDiscussion,
  getTrendingProblems,
  TrendingProblem,
  getPlatformStats,
  PlatformStats,
} from "@/lib/api";
import {
  TeamsSidebar,
  DiscussionsSidebar,
  PostAttachmentCard,
} from "@/components/social";
import { extractPostAttachments, serializePostContent, PostAttachment } from "@/lib/postAttachments";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  Plus,
  Users,
  Star,
  GitFork,
  MessageSquare,
  CheckCircle2,
  FileText,
  BookOpen,
  Lock,
  Globe,
  Sparkles,
  Filter,
  RefreshCw,
} from "lucide-react";

const FEED_META: Record<string, { label: string; color: string }> = {
  CREATED_PROBLEM: { label: "created", color: "text-indigo-600" },
  FORKED_PROBLEM: { label: "forked", color: "text-purple-600" },
  PUBLISHED_LIBRARY: { label: "published", color: "text-emerald-600" },
  UPDATED_LIBRARY: { label: "updated", color: "text-emerald-500" },
  VERIFIED_LIBRARY: { label: "verified", color: "text-emerald-700" },
  CREATED_WORKSPACE_FILE: { label: "added a file to", color: "text-neutral-600" },
  FOLLOWED_USER: { label: "connected with", color: "text-amber-600" },
  TEAM_INVITE: { label: "invited", color: "text-blue-600" },
  TEAM_JOIN: { label: "joined team", color: "text-blue-700" },
};

function parseTimestamp(iso?: string | null) {
  if (!iso) return null;
  let normalized = iso;
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized);
  if (!hasTimezone) {
    normalized = `${normalized}Z`;
  }
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? null : time;
}

function formatRelativeTime(iso?: string | null) {
  const then = parseTimestamp(iso);
  if (!then) return "just now";
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatAttachmentLabel(attachment: PostAttachment) {
  if (attachment.kind === "latex_fragment") {
    const range =
      attachment.line_start && attachment.line_end
        ? ` (${attachment.line_start}-${attachment.line_end})`
        : "";
    return `LaTeX: ${attachment.file_path}${range}`;
  }
  if (attachment.kind === "canvas_block") {
    return `Canvas block: ${attachment.block_name || "Untitled block"}`;
  }
  const count = attachment.node_ids?.length || attachment.node_titles?.length || 0;
  return `Canvas nodes: ${count || "multiple"} selected`;
}

function getNodeSnippet(node: LibraryItem) {
  const raw = (node.content || "").replace(/\s+/g, " ").trim();
  if (!raw) return "No preview available.";
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([]);
  const [suggestions, setSuggestions] = useState<SocialUser[]>([]);
  const [trending, setTrending] = useState<TrendingProblem[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [connections, setConnections] = useState<SocialConnectionsResponse | null>(null);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedTab, setFeedTab] = useState<"following" | "discover">("following");
  const [repoFilter, setRepoFilter] = useState("");
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [composerPulse, setComposerPulse] = useState(false);
  const [recentPostId, setRecentPostId] = useState<string | null>(null);
  const [postAttachments, setPostAttachments] = useState<PostAttachment[]>([]);
  const [canvasModalOpen, setCanvasModalOpen] = useState(false);
  const [latexModalOpen, setLatexModalOpen] = useState(false);
  const [canvasProblemId, setCanvasProblemId] = useState("");
  const [canvasMode, setCanvasMode] = useState<"block" | "nodes">("block");
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>([]);
  const [canvasNodes, setCanvasNodes] = useState<LibraryItem[]>([]);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [canvasFilter, setCanvasFilter] = useState("");
  const [latexProblemId, setLatexProblemId] = useState("");
  const [latexFiles, setLatexFiles] = useState<LatexFileInfo[]>([]);
  const [latexFilePath, setLatexFilePath] = useState("");
  const [latexContent, setLatexContent] = useState("");
  const [latexLoading, setLatexLoading] = useState(false);
  const [latexLineStart, setLatexLineStart] = useState(1);
  const [latexLineEnd, setLatexLineEnd] = useState(8);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [problemsData, feedData, usersData, trendingData, statsData, connectionsData] = await Promise.all([
        getProblems({ mine: true }),
        getSocialFeed({ scope: feedTab === "following" ? "network" : "global", limit: 20 }),
        getSocialUsers({ limit: 10 }),
        getTrendingProblems(5),
        getPlatformStats(),
        getSocialConnections(),
      ]);
      setProblems(problemsData.problems);
      setFeedItems(feedData.items);
      setSuggestions(usersData.users.filter((u) => u.id !== user.id && !u.is_following));
      setTrending(trendingData.problems);
      setStats(statsData);
      setConnections(connectionsData);
      setFollowingCount(connectionsData.total_following);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [user, feedTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!composerPulse) return;
    const timeout = setTimeout(() => setComposerPulse(false), 900);
    return () => clearTimeout(timeout);
  }, [composerPulse]);

  useEffect(() => {
    if (!recentPostId) return;
    const timeout = setTimeout(() => setRecentPostId(null), 5000);
    return () => clearTimeout(timeout);
  }, [recentPostId]);

  useEffect(() => {
    if (!canvasModalOpen) return;
    if (!canvasProblemId && problems.length > 0) {
      setCanvasProblemId(problems[0].id);
    }
  }, [canvasModalOpen, canvasProblemId, problems]);

  useEffect(() => {
    if (!canvasModalOpen || !canvasProblemId) return;
    let cancelled = false;
    setCanvasLoading(true);
    Promise.all([getCanvasBlocks(canvasProblemId).catch(() => []), getLibraryItems(canvasProblemId)])
      .then(([blocks, nodesResp]) => {
        if (cancelled) return;
        setCanvasBlocks(blocks);
        setCanvasNodes(nodesResp.items);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load canvas data", error);
        }
      })
      .finally(() => {
        if (!cancelled) setCanvasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canvasModalOpen, canvasProblemId]);

  useEffect(() => {
    if (!latexModalOpen) return;
    if (!latexProblemId && problems.length > 0) {
      setLatexProblemId(problems[0].id);
    }
  }, [latexModalOpen, latexProblemId, problems]);

  useEffect(() => {
    if (!latexModalOpen || !latexProblemId) return;
    let cancelled = false;
    setLatexLoading(true);
    listLatexFiles(latexProblemId)
      .then((listing) => {
        if (cancelled) return;
        const filtered = listing.files.filter((file) =>
          file.path.endsWith(".tex") || file.path.endsWith(".ltx")
        );
        setLatexFiles(filtered);
        if (!latexFilePath && filtered.length > 0) {
          setLatexFilePath(filtered[0].path);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load LaTeX files", error);
          setLatexFiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLatexLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [latexModalOpen, latexProblemId]);

  useEffect(() => {
    if (!latexModalOpen || !latexProblemId || !latexFilePath) return;
    let cancelled = false;
    setLatexLoading(true);
    getLatexFile(latexProblemId, latexFilePath)
      .then((file) => {
        if (cancelled) return;
        if (!file.is_binary) {
          setLatexContent(file.content || "");
        } else {
          setLatexContent("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load LaTeX file", error);
          setLatexContent("");
        }
      })
      .finally(() => {
        if (!cancelled) setLatexLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [latexModalOpen, latexProblemId, latexFilePath]);

  const handleFollow = async (userId: string) => {
    try {
      await followUser(userId);
      setSuggestions((prev) => prev.filter((u) => u.id !== userId));
      setFollowingCount((prev) => prev + 1);
      // Reload feed if we are on the "following" tab
      if (feedTab === "following") {
        const feedData = await getSocialFeed({ scope: "network", limit: 20 });
        setFeedItems(feedData.items);
      }
    } catch (err) {
      console.error("Follow failed", err);
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      await unfollowUser(userId);
      setConnections((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          following: prev.following.filter((u) => u.id !== userId),
          total_following: prev.total_following - 1,
        };
      });
      setFollowingCount((prev) => prev - 1);
      // Reload feed if we are on the "following" tab
      if (feedTab === "following") {
        const feedData = await getSocialFeed({ scope: "network", limit: 20 });
        setFeedItems(feedData.items);
      }
    } catch (err) {
      console.error("Unfollow failed", err);
    }
  };

  const removeAttachment = (index: number) => {
    setPostAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetCanvasModal = () => {
    setCanvasModalOpen(false);
    setCanvasMode("block");
    setCanvasFilter("");
    setSelectedBlockId(null);
    setSelectedNodeIds(new Set());
  };

  const resetLatexModal = () => {
    setLatexModalOpen(false);
    setLatexFilePath("");
    setLatexContent("");
    setLatexLineStart(1);
    setLatexLineEnd(8);
  };

  const handleCanvasAttach = () => {
    const problem = problems.find((p) => p.id === canvasProblemId);
    if (!problem) return;
    if (canvasMode === "block") {
      const block = canvasBlocks.find((b) => b.id === selectedBlockId);
      if (!block) return;
      const attachment: PostAttachment = {
        kind: "canvas_block",
        problem_id: problem.id,
        problem_title: problem.title,
        visibility: problem.visibility,
        block_id: block.id,
        block_name: block.name,
        node_ids: block.node_ids,
      };
      setPostAttachments((prev) => [...prev, attachment]);
      resetCanvasModal();
      return;
    }
    const ids = Array.from(selectedNodeIds);
    if (ids.length === 0) return;
    const nodeTitles = canvasNodes.filter((n) => ids.includes(n.id)).map((n) => n.title);
    const attachment: PostAttachment = {
      kind: "canvas_nodes",
      problem_id: problem.id,
      problem_title: problem.title,
      visibility: problem.visibility,
      node_ids: ids,
      node_titles: nodeTitles,
    };
    setPostAttachments((prev) => [...prev, attachment]);
    resetCanvasModal();
  };

  const handleLatexAttach = () => {
    const problem = problems.find((p) => p.id === latexProblemId);
    if (!problem || !latexFilePath) return;
    const snippet = latexRange.snippet.trim();
    if (!snippet) return;
    const attachment: PostAttachment = {
      kind: "latex_fragment",
      problem_id: problem.id,
      problem_title: problem.title,
      visibility: problem.visibility,
      file_path: latexFilePath,
      line_start: latexRange.start,
      line_end: latexRange.end,
      snippet: snippet,
    };
    setPostAttachments((prev) => [...prev, attachment]);
    resetLatexModal();
  };

  const handlePost = async () => {
    const hasBody = postContent.trim().length > 0 || postAttachments.length > 0;
    if (!hasBody || posting) return;

    setPosting(true);
    try {
      const composedContent = serializePostContent(postContent, postAttachments);
      const defaultTitle = postAttachments.length > 0
        ? postAttachments[0].kind === "latex_fragment"
          ? "Shared LaTeX fragment"
          : "Shared canvas snapshot"
        : "Update";
      // Create a discussion as the post
      const title = postContent.slice(0, 100).split("\n")[0] || defaultTitle;
      const created = await createDiscussion({
        title: title,
        content: composedContent,
      });
      const optimisticItem: SocialFeedItem = {
        id: `local-${created.id}`,
        type: "DISCUSSION_POST",
        actor: {
          id: created.author?.id || user.id,
          username: created.author?.username || user.username,
          avatar_url: created.author?.avatar_url ?? user.avatar_url,
        },
        problem: null,
        target_id: created.id,
        item_status: null,
        item_kind: null,
        verification_status: null,
        verification_method: null,
        has_lean_code: null,
        extra_data: {
          discussion_id: created.id,
          discussion_title: created.title,
          discussion_content: composedContent,
        },
        created_at: created.created_at || new Date().toISOString(),
      };
      setFeedItems((prev) => {
        const withoutDuplicate = prev.filter((item) => {
          const discussionId = item.extra_data?.discussion_id as string | undefined;
          return item.target_id !== created.id && discussionId !== created.id;
        });
        return [optimisticItem, ...withoutDuplicate];
      });
      setPostContent("");
      setPostAttachments([]);
      setRecentPostId(created.id);
      setComposerPulse(false);
      requestAnimationFrame(() => setComposerPulse(true));
    } catch (err) {
      console.error("Post failed", err);
    } finally {
      setPosting(false);
    }
  };

  const filteredProblems = problems.filter((p) =>
    p.title.toLowerCase().includes(repoFilter.toLowerCase())
  );

  const filteredCanvasNodes = useMemo(() => {
    const query = canvasFilter.trim().toLowerCase();
    if (!query) return canvasNodes;
    return canvasNodes.filter((node) => node.title.toLowerCase().includes(query));
  }, [canvasFilter, canvasNodes]);

  const latexLines = useMemo(() => (latexContent ? latexContent.split("\n") : [""]), [latexContent]);
  const latexLineMax = Math.max(latexLines.length, 1);
  const latexRange = useMemo(() => {
    const start = Math.min(Math.max(1, latexLineStart), latexLineMax);
    const end = Math.min(Math.max(start, latexLineEnd), latexLineMax);
    return {
      start,
      end,
      snippet: latexLines.slice(start - 1, end).join("\n"),
    };
  }, [latexLines, latexLineStart, latexLineEnd, latexLineMax]);

  useEffect(() => {
    if (latexLineStart < 1) setLatexLineStart(1);
    if (latexLineEnd < 1) setLatexLineEnd(1);
    if (latexLineStart > latexLineMax) setLatexLineStart(latexLineMax);
    if (latexLineEnd > latexLineMax) setLatexLineEnd(latexLineMax);
  }, [latexLineMax, latexLineStart, latexLineEnd]);

  const filteredFeedItems = feedItems.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const extraData = item.extra_data || {};
    const values = [
      item.actor?.username,
      item.type,
      item.problem?.title,
      item.item_kind,
      item.item_status,
      item.verification_status,
      extraData["problem_title"],
      extraData["target_username"],
      extraData["team_name"],
      extraData["item_title"],
      extraData["discussion_title"],
      extraData["discussion_content"],
    ]
      .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
      .filter(Boolean);
    return values.some((value) => value.includes(query));
  });

  const canPost = postContent.trim().length > 0 || postAttachments.length > 0;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <DashboardNavbar />

      {/* Main Content Grid */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3 space-y-6">
          {/* User Context */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.username} avatar`}
                  className="w-10 h-10 rounded-full object-cover border border-neutral-100"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 border border-neutral-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                  {getInitials(user.username)}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-neutral-900">{user.username}</div>
                <div className="text-xs text-neutral-500">@{user.username.toLowerCase()}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 py-3 border-t border-neutral-100 mb-2">
              <div className="text-center">
                <div className="text-xs text-neutral-500">Proofs</div>
                <div className="text-sm font-semibold text-neutral-900">{problems.length}</div>
              </div>
              <button 
                onClick={() => setShowFollowingModal(true)}
                className="text-center hover:bg-neutral-50 rounded-md transition-colors"
              >
                <div className="text-xs text-neutral-500">Following</div>
                <div className="text-sm font-semibold text-neutral-900 hover:text-indigo-600">{followingCount}</div>
              </button>
              <div className="text-center">
                <div className="text-xs text-neutral-500">Stars</div>
                <div className="text-sm font-semibold text-indigo-600">
                  {problems.reduce((acc, p) => acc + (p.library_item_count || 0), 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Proofs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-neutral-900">Recent Proofs</h3>
              <Link
                href="/problems/new"
                className="p-1 hover:bg-neutral-100 rounded text-neutral-500 transition-colors bg-white border border-neutral-200 shadow-sm flex items-center gap-1 px-2 text-[10px]"
              >
                <Plus className="w-3 h-3" /> New
              </Link>
            </div>
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Filter..."
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-md px-2.5 py-1.5 mb-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-neutral-400 text-neutral-900"
              />
              {filteredProblems.slice(0, 5).map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.id}`}
                  className="flex items-center gap-2 p-2 hover:bg-white rounded-md group transition-all border border-transparent hover:border-neutral-200 hover:shadow-sm"
                >
                  {problem.visibility === "private" ? (
                    <Lock className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <Globe className="w-4 h-4 text-neutral-400" />
                  )}
                  <span className="text-sm font-medium text-neutral-700 group-hover:text-indigo-600 truncate">
                    {problem.title}
                  </span>
                  {problem.library_item_count > 0 && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </Link>
              ))}
              {problems.length > 5 && (
                <Link
                  href="/catalog?mine=true"
                  className="mt-2 text-xs text-neutral-500 hover:text-indigo-600 flex items-center gap-1 ml-2"
                >
                  Show more
                </Link>
              )}
            </div>
          </div>

          {/* Teams */}
          <TeamsSidebar />
        </aside>

        {/* Center: Activity Feed */}
        <main className="col-span-1 md:col-span-9 lg:col-span-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-semibold text-neutral-900">Home</h1>
            <button
              onClick={loadData}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Feed Input */}
          <div className={`relative bg-white rounded-lg border border-neutral-200 p-4 shadow-sm mb-6 ${composerPulse ? "pm-post-composer" : ""}`}>
            <div className="flex gap-3">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.username} avatar`}
                  className="w-8 h-8 rounded-full object-cover border border-neutral-100"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-neutral-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                  {getInitials(user.username)}
                </div>
              )}
              <div className="flex-1">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 mb-3">
                  <textarea
                    rows={2}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="w-full text-sm border-none focus:ring-0 p-0 resize-none placeholder:text-neutral-500 bg-transparent text-neutral-900"
                    placeholder="Propose a new conjecture or share an update..."
                    disabled={posting}
                  />
                </div>
                {postAttachments.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {postAttachments.map((attachment, index) => (
                      <div
                        key={`${attachment.kind}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600"
                      >
                        <span className="truncate">{formatAttachmentLabel(attachment)}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="text-[11px] font-medium text-neutral-400 hover:text-neutral-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCanvasModalOpen(true)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-100 transition-colors"
                      title="Attach Logic Graph"
                    >
                      <GitFork className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setLatexModalOpen(true)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-100 transition-colors"
                      title="LaTeX Equation"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handlePost}
                    disabled={!canPost || posting}
                    className="bg-neutral-900 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                        Posting...
                      </span>
                    ) : (
                      "Post Update"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 border-b border-neutral-200 mb-6">
            <button
              onClick={() => setFeedTab("following")}
              className={`pb-3 text-sm font-medium transition-colors ${
                feedTab === "following"
                  ? "text-neutral-900 border-b-2 border-indigo-500"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setFeedTab("discover")}
              className={`pb-3 text-sm font-medium transition-colors ${
                feedTab === "discover"
                  ? "text-neutral-900 border-b-2 border-indigo-500"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              Discover
            </button>
          </div>

          {/* Activity Items */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
            </div>
          ) : filteredFeedItems.length === 0 ? (
            <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
              <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-neutral-900 mb-2">
                {searchQuery.trim() ? "No results found" : "No activity yet"}
              </h3>
              <p className="text-xs text-neutral-500 mb-4">
                {searchQuery.trim()
                  ? "Try a different search term."
                  : feedTab === "following"
                  ? "Follow other researchers to see their updates here."
                  : "Be the first to share something!"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFeedItems.map((item) => {
                const isDiscussionPost = Boolean(
                  item.extra_data?.discussion_content || item.extra_data?.discussion_title
                );
                const isRecentPost = Boolean(
                  recentPostId &&
                  (item.target_id === recentPostId ||
                    item.extra_data?.discussion_id === recentPostId)
                );
                const meta = isDiscussionPost
                  ? { label: "posted", color: "text-indigo-600" }
                  : FEED_META[item.type] || { label: "updated", color: "text-neutral-600" };
                const teamName = item.extra_data?.team_name as string | undefined;
                const status = item.item_status?.toLowerCase();
                const verification = item.verification_status;
                const leanBadge = item.has_lean_code;
                const kind = (item.item_kind as string | undefined)?.toLowerCase();
                const discussionTitle = item.extra_data?.discussion_title as string | undefined;
                const discussionContent = item.extra_data?.discussion_content as string | undefined;
                const discussionPayload = extractPostAttachments(discussionContent || "");
                const discussionCleanContent = discussionPayload.cleanContent;
                const discussionAttachments = discussionPayload.attachments;
                const discussionHref = item.target_id ? `/discussions/${item.target_id}` : "#";
                const problemTitle =
                  item.problem?.title ||
                  (item.extra_data?.problem_title as string) ||
                  "a problem";
                const targetUser = item.extra_data?.target_username as string | undefined;
                const isLibraryActivity = ["PUBLISHED_LIBRARY", "UPDATED_LIBRARY", "VERIFIED_LIBRARY"].includes(item.type);
                const libraryStatusLabel = status === "verified"
                  ? "verified"
                  : status === "proposed"
                  ? "proposed"
                  : status || "updated";
                const libraryPill = [
                  libraryStatusLabel,
                  verification || null,
                  leanBadge ? "lean" : null,
                ].filter(Boolean).join(" • ");
                const libraryTitle = (item.extra_data?.item_title as string) || (kind ? `${kind}` : "library item");

                return (
                  <div
                    key={item.id}
                    className={`relative bg-white rounded-lg border border-neutral-200 p-5 shadow-sm ${isRecentPost ? "pm-post-card-enter border-indigo-200/60 shadow-md" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {item.actor.avatar_url ? (
                        <img
                          src={item.actor.avatar_url}
                          alt={`${item.actor.username} avatar`}
                          className="w-8 h-8 rounded-full object-cover border border-neutral-100"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                          {getInitials(item.actor.username)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-neutral-900">
                            <span className="font-semibold">{item.actor.username}</span>{" "}
                            <span className={meta.color}>{meta.label}</span>{" "}
                            {item.type === "FOLLOWED_USER" ? (
                              <span className="font-medium">{targetUser}</span>
                            ) : isDiscussionPost ? (
                              <Link
                                href={discussionHref}
                                className="font-medium text-indigo-600 hover:underline"
                              >
                                {discussionTitle || "an update"}
                              </Link>
                            ) : item.type === "TEAM_INVITE" ? (
                              <span className="font-medium">you to {teamName || "a team"}</span>
                            ) : item.type === "TEAM_JOIN" ? (
                              <span className="font-medium">{teamName || "team"}</span>
                            ) : (
                              <Link
                                href={item.problem ? `/problems/${item.problem.id}` : "#"}
                                className="font-medium text-indigo-600 hover:underline"
                              >
                                {problemTitle}
                              </Link>
                            )}
                          </p>
                          <span className="text-xs text-neutral-400">
                            {formatRelativeTime(item.created_at)}
                          </span>
                        </div>

                        {isLibraryActivity && (
                          <div className="mt-3 bg-neutral-50 rounded border border-neutral-200 p-3">
                            <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-emerald-700 bg-emerald-50 w-fit px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wide">
                              <CheckCircle2 className="w-3 h-3" /> {libraryPill}
                            </div>
                            <div className="text-sm font-mono text-neutral-700 leading-snug">
                              {libraryTitle}
                            </div>
                          </div>
                        )}

                        {item.type === "FORKED_PROBLEM" && (
                          <div className="mt-3 p-3 bg-neutral-900 rounded-md text-neutral-400 font-mono text-xs overflow-hidden">
                            <div className="flex gap-2">
                              <span className="text-purple-400">→</span>
                              <span>Forked from original</span>
                            </div>
                          </div>
                        )}

                        {isDiscussionPost && discussionCleanContent && (
                          <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/60 p-3">
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                              {discussionCleanContent}
                            </p>
                          </div>
                        )}

                        {isDiscussionPost && discussionAttachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {discussionAttachments.map((attachment, idx) => (
                              <PostAttachmentCard
                                key={`${attachment.kind}-${idx}`}
                                attachment={attachment}
                                compact
                                allowPrivate={item.actor.id === user.id}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredFeedItems.length > 0 && (
            <div className="mt-8 text-center">
              <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
                Load more activity
              </button>
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 space-y-8">
          {/* Trending */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-900 mb-3">Trending Proofs</h3>
            <div className="space-y-4">
              {trending.length === 0 ? (
                <p className="text-xs text-neutral-400">No trending proofs yet</p>
              ) : (
                trending.map((problem, idx) => {
                  const maxScore = trending[0]?.activity_score || 1;
                  const percentage = Math.round((problem.activity_score / maxScore) * 100);
                  const isHot = problem.trend_label === "Hot";
                  
                  return (
                    <div key={problem.id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <Link
                          href={`/problems/${problem.id}`}
                          className="text-sm font-medium text-neutral-700 group-hover:text-indigo-600 truncate"
                        >
                          {problem.title}
                        </Link>
                        {problem.trend_label && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isHot 
                              ? "bg-emerald-50 text-emerald-600" 
                              : "bg-neutral-100 text-neutral-500"
                          }`}>
                            {problem.trend_label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mb-1 truncate">
                        by {problem.author.username} · {problem.star_count} stars
                      </p>
                      <div className="w-full bg-neutral-100 rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full ${isHot ? "bg-emerald-500" : "bg-neutral-900"}`} 
                          style={{ width: `${percentage}%` }} 
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Suggested Collaborators */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-900 mb-3">Suggested for you</h3>
            <div className="space-y-3">
              {suggestions.slice(0, 3).map((suggested) => (
                <div key={suggested.id} className="flex items-center gap-3">
                  {suggested.avatar_url ? (
                    <img
                      src={suggested.avatar_url}
                      alt={`${suggested.username} avatar`}
                      className="w-8 h-8 rounded-full object-cover border border-neutral-100"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                      {getInitials(suggested.username)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 truncate">
                      {suggested.username}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {suggested.bio || "Mathematics researcher"}
                    </div>
                  </div>
                  <button
                    onClick={() => handleFollow(suggested.id)}
                    className="text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                  >
                    Follow
                  </button>
                </div>
              ))}
              {suggestions.length === 0 && (
                <p className="text-xs text-neutral-400">No suggestions yet</p>
              )}
            </div>
          </div>

          {/* Latest Discussions */}
          <DiscussionsSidebar />

          {/* Footer Links */}
          <div className="pt-4 border-t border-neutral-200 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-neutral-400">
            <Link href="/teams" className="hover:text-neutral-600">
              Teams
            </Link>
            <Link href="/discussions" className="hover:text-neutral-600">
              Discussions
            </Link>
            <Link href="#" className="hover:text-neutral-600">
              Docs
            </Link>
            <Link href="#" className="hover:text-neutral-600">
              API
            </Link>
            <Link href="/privacy" className="hover:text-neutral-600">
              Privacy
            </Link>
            <span>© 2026 ProofMesh</span>
          </div>
        </aside>
      </div>

      {canvasModalOpen && (
        <div
          className="fixed inset-0 z-50"
        >
          <div className="absolute inset-0 bg-black/40" onClick={resetCanvasModal} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h2 className="text-sm font-semibold text-neutral-900">Attach Canvas Snapshot</h2>
              <button
                onClick={resetCanvasModal}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Problem</label>
                <select
                  value={canvasProblemId}
                  onChange={(e) => {
                    setCanvasProblemId(e.target.value);
                    setSelectedBlockId(null);
                    setSelectedNodeIds(new Set());
                  }}
                  className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800"
                >
                  {problems.map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      {problem.title} · {problem.visibility}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCanvasMode("block")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                    canvasMode === "block"
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-neutral-200 text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  Blocks
                </button>
                <button
                  onClick={() => setCanvasMode("nodes")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                    canvasMode === "nodes"
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-neutral-200 text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  Nodes
                </button>
              </div>
              {canvasLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-900 border-t-transparent" />
                </div>
              ) : canvasMode === "block" ? (
                <div className="space-y-2">
                  {canvasBlocks.length === 0 ? (
                    <p className="text-xs text-neutral-400">No blocks yet for this canvas.</p>
                  ) : (
                    canvasBlocks.map((block) => (
                      <button
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={`w-full text-left px-3 py-2 rounded-md border text-sm ${
                          selectedBlockId === block.id
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        <div className="font-medium">{block.name || "Untitled block"}</div>
                        <div className="text-[11px] text-neutral-500">{block.node_ids.length} nodes</div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={canvasFilter}
                    onChange={(e) => setCanvasFilter(e.target.value)}
                    placeholder="Filter nodes..."
                    className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredCanvasNodes.length === 0 ? (
                      <p className="text-xs text-neutral-400">No nodes found.</p>
                    ) : (
                      filteredCanvasNodes.map((node) => {
                        const selected = selectedNodeIds.has(node.id);
                        const snippet = getNodeSnippet(node);
                        const meta = `${node.kind.toLowerCase()} • ${node.status.toLowerCase()}`;
                        return (
                          <button
                            key={node.id}
                            onClick={() => {
                              setSelectedNodeIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(node.id)) {
                                  next.delete(node.id);
                                } else {
                                  next.add(node.id);
                                }
                                return next;
                              });
                            }}
                            className={`w-full text-left rounded-md border px-3 py-2 text-xs transition ${
                              selected
                                ? "border-indigo-200 bg-indigo-50"
                                : "border-neutral-200 hover:bg-neutral-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-neutral-800 truncate">
                                  {node.title}
                                </div>
                                <div className="text-[11px] text-neutral-500">{meta}</div>
                                <div className="mt-1 text-[11px] text-neutral-600 leading-snug max-h-10 overflow-hidden">
                                  {snippet}
                                </div>
                              </div>
                              <div
                                className={`mt-1 h-4 w-4 rounded border flex items-center justify-center ${
                                  selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-neutral-300"
                                }`}
                              >
                                {selected && (
                                  <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0L3.3 9.1a1 1 0 1 1 1.4-1.4l3 3 6.5-6.4a1 1 0 0 1 1.4 0Z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-200">
              <button
                onClick={resetCanvasModal}
                className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCanvasAttach}
                disabled={
                  canvasMode === "block" ? !selectedBlockId : selectedNodeIds.size === 0
                }
                className="px-4 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Attach
              </button>
            </div>
          </div>
        </div>
      )}

      {latexModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={resetLatexModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h2 className="text-sm font-semibold text-neutral-900">Attach LaTeX Fragment</h2>
              <button
                onClick={resetLatexModal}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Problem</label>
                <select
                  value={latexProblemId}
                  onChange={(e) => {
                    setLatexProblemId(e.target.value);
                    setLatexFilePath("");
                  }}
                  className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800"
                >
                  {problems.map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      {problem.title} · {problem.visibility}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">File</label>
                <select
                  value={latexFilePath}
                  onChange={(e) => setLatexFilePath(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800"
                >
                  {latexFiles.map((file) => (
                    <option key={file.path} value={file.path}>
                      {file.path}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-neutral-500">Start line</label>
                  <input
                    type="number"
                    min={1}
                    max={latexLineMax}
                    value={latexLineStart}
                    onChange={(e) => setLatexLineStart(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500">End line</label>
                  <input
                    type="number"
                    min={1}
                    max={latexLineMax}
                    value={latexLineEnd}
                    onChange={(e) => setLatexLineEnd(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              {latexLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-900 border-t-transparent" />
                </div>
              ) : (
                <pre className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 whitespace-pre-wrap font-mono">
                  {latexRange.snippet || "No content available."}
                </pre>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-neutral-200">
              <button
                onClick={resetLatexModal}
                className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={handleLatexAttach}
                disabled={!latexFilePath || latexRange.snippet.trim().length === 0}
                className="px-4 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Attach
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFollowingModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Following</h2>
              <button
                onClick={() => setShowFollowingModal(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {connections && connections.following.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">You're not following anyone yet</p>
                  <p className="text-xs text-neutral-400 mt-1">Discover researchers in the feed below</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections?.following.map((followedUser) => (
                    <div key={followedUser.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 rounded-lg transition-colors">
                      {followedUser.avatar_url ? (
                        <img
                          src={followedUser.avatar_url}
                          alt={`${followedUser.username} avatar`}
                          className="w-10 h-10 rounded-full object-cover border border-neutral-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-sm font-bold text-neutral-600">
                          {getInitials(followedUser.username)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/users/${followedUser.username}`}
                          className="text-sm font-medium text-neutral-900 hover:text-indigo-600 block truncate"
                          onClick={() => setShowFollowingModal(false)}
                        >
                          {followedUser.username}
                        </Link>
                        {followedUser.bio && (
                          <p className="text-xs text-neutral-500 truncate">{followedUser.bio}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnfollow(followedUser.id)}
                        className="text-xs font-medium text-neutral-600 hover:text-red-600 px-3 py-1.5 rounded-md border border-neutral-200 hover:border-red-200 transition-colors"
                      >
                        Unfollow
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
