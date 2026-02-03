"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getProblems,
  Problem,
  getSocialFeed,
  getSocialConnections,
  getSocialUsers,
  followUser,
  unfollowUser,
  SocialFeedItem,
  SocialUser,
  SocialConnectionsResponse,
  getDiscussions,
  Discussion,
  getTeams,
  Team,
  createDiscussion,
  getTrendingProblems,
  TrendingProblem,
  getPlatformStats,
  PlatformStats,
} from "@/lib/api";
import {
  NotificationsDropdown,
  TeamsSidebar,
  DiscussionsSidebar,
} from "@/components/social";
import {
  Search,
  Plus,
  ChevronDown,
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
  User,
  Settings,
  HelpCircle,
  LogOut,
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

function formatRelativeTime(iso?: string | null) {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
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

export default function DashboardPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
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
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleSearchFocus(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const isEditable = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
      if (isEditable) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleSearchFocus);
    return () => window.removeEventListener("keydown", handleSearchFocus);
  }, []);

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

  const handleFollow = async (userId: string) => {
    try {
      await followUser(userId);
      setSuggestions((prev) => prev.filter((u) => u.id !== userId));
      setFollowingCount((prev) => prev + 1);
      // Recargar el feed si estamos en la pestaña "following"
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
      // Recargar el feed si estamos en la pestaña "following"
      if (feedTab === "following") {
        const feedData = await getSocialFeed({ scope: "network", limit: 20 });
        setFeedItems(feedData.items);
      }
    } catch (err) {
      console.error("Unfollow failed", err);
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() || posting) return;
    
    setPosting(true);
    try {
      // Create a discussion as the post
      const title = postContent.slice(0, 100).split("\n")[0] || "Update";
      await createDiscussion({
        title: title,
        content: postContent,
      });
      setPostContent("");
      // Refresh feed
      await loadData();
    } catch (err) {
      console.error("Post failed", err);
    } finally {
      setPosting(false);
    }
  };

  const filteredProblems = problems.filter((p) =>
    p.title.toLowerCase().includes(repoFilter.toLowerCase())
  );

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
      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-6 h-6 bg-neutral-900 rounded-md flex items-center justify-center text-white group-hover:bg-indigo-600 transition-colors">
                <span className="font-[var(--font-math)] italic text-[12px] leading-none logo-rho">&rho;</span>
              </div>
              <span className="text-sm font-bold tracking-tight">ProofMesh</span>
            </Link>
          </div>

          <div className="flex-1 max-w-xl hidden md:block">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-neutral-400" />
              </div>
              <input
                ref={searchInputRef}
                type="search"
                className="block w-full rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-12 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
                placeholder="/ to search activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <kbd className="inline-flex items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                  /
                </kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsDropdown />
            <div className="h-4 w-px bg-neutral-200 mx-1" />
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 group p-1 hover:bg-neutral-50 rounded-md transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-100 border border-neutral-200 group-hover:border-indigo-500 transition-colors flex items-center justify-center text-[10px] font-bold text-indigo-700">
                  {getInitials(user.username)}
                </div>
                <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${userDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-3 py-2 border-b border-neutral-100">
                    <p className="text-sm font-medium text-neutral-900">{user.username}</p>
                    <p className="text-xs text-neutral-500">@{user.username.toLowerCase()}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <User className="w-4 h-4 text-neutral-400" />
                    Your Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <Settings className="w-4 h-4 text-neutral-400" />
                    Settings
                  </Link>
                  <Link
                    href="/help"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    onClick={() => setUserDropdownOpen(false)}
                  >
                    <HelpCircle className="w-4 h-4 text-neutral-400" />
                    Help & Docs
                  </Link>
                  <div className="border-t border-neutral-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Grid */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3 space-y-6">
          {/* User Context */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 border border-neutral-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                {getInitials(user.username)}
              </div>
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
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm mb-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-neutral-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                {getInitials(user.username)}
              </div>
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
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-100 transition-colors"
                      title="Attach Logic Graph"
                    >
                      <GitFork className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded hover:bg-neutral-100 transition-colors"
                      title="LaTeX Equation"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handlePost}
                    disabled={!postContent.trim() || posting}
                    className="bg-neutral-900 text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting ? "Posting..." : "Post Update"}
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
                    className="relative bg-white rounded-lg border border-neutral-200 p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                        {getInitials(item.actor.username)}
                      </div>
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

                        {isDiscussionPost && discussionContent && (
                          <div className="mt-3 rounded-md border border-indigo-100 bg-indigo-50/60 p-3">
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                              {discussionContent}
                            </p>
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
                  <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                    {getInitials(suggested.username)}
                  </div>
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
                      <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-sm font-bold text-neutral-600">
                        {getInitials(followedUser.username)}
                      </div>
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
