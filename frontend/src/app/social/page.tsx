"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  FileText,
  Users,
  GitBranch,
  BookOpen,
  Search,
  ArrowUpRight,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  getSocialConnections,
  getSocialFeed,
  getSocialContributions,
  followUser,
  unfollowUser,
  acceptTeamInvite,
  declineTeamInvite,
  SocialUser,
  SocialFeedItem,
  SocialProblemContribution,
} from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";

const FEED_FILTERS = [
  { id: "all", label: "All", types: null },
  { id: "problems", label: "Problems", types: ["CREATED_PROBLEM", "FORKED_PROBLEM"] },
  { id: "library", label: "Library", types: ["PUBLISHED_LIBRARY", "UPDATED_LIBRARY", "VERIFIED_LIBRARY"] },
  { id: "files", label: "Files", types: ["CREATED_WORKSPACE_FILE"] },
  { id: "connections", label: "Connections", types: ["FOLLOWED_USER", "TEAM_INVITE", "TEAM_JOIN"] },
];

const FEED_META: Record<
  string,
  { label: string; icon: typeof Sparkles; accent: string; badge: string }
> = {
  CREATED_PROBLEM: {
    label: "Problem created",
    icon: BookOpen,
    accent: "text-indigo-600",
    badge: "border-indigo-100 text-indigo-700",
  },
  CREATED_WORKSPACE_FILE: {
    label: "Workspace file",
    icon: FileText,
    accent: "text-slate-600",
    badge: "border-neutral-200 text-neutral-700",
  },
  PUBLISHED_LIBRARY: {
    label: "Library updated",
    icon: ShieldCheck,
    accent: "text-emerald-600",
    badge: "border-emerald-100 text-emerald-700",
  },
  UPDATED_LIBRARY: {
    label: "Library updated",
    icon: ShieldCheck,
    accent: "text-emerald-600",
    badge: "border-emerald-100 text-emerald-700",
  },
  VERIFIED_LIBRARY: {
    label: "Library verified",
    icon: ShieldCheck,
    accent: "text-emerald-700",
    badge: "border-emerald-200 text-emerald-800",
  },
  TEAM_INVITE: {
    label: "Team invite",
    icon: Users,
    accent: "text-blue-600",
    badge: "border-blue-100 text-blue-700",
  },
  TEAM_JOIN: {
    label: "Team join",
    icon: Users,
    accent: "text-blue-700",
    badge: "border-blue-200 text-blue-800",
  },
  FOLLOWED_USER: {
    label: "New connection",
    icon: Users,
    accent: "text-amber-600",
    badge: "border-amber-100 text-amber-700",
  },
  FORKED_PROBLEM: {
    label: "Problem fork",
    icon: GitBranch,
    accent: "text-purple-600",
    badge: "border-purple-100 text-purple-700",
  },
};

const DOT_COLORS = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-slate-400"];

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
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function renderAvatar(user: SocialUser, size = "w-8 h-8") {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.username}
        className={`${size} rounded-full object-cover`}
      />
    );
  }
  return (
    <div className={`${size} rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-[10px] font-semibold border border-neutral-200`}>
      {getInitials(user.username)}
    </div>
  );
}

function renderFeedText(item: SocialFeedItem) {
  const problemTitle =
    item.problem?.title ||
    (item.extra_data?.problem_title as string | undefined) ||
    "a problem";
  const filePath = item.extra_data?.file_path as string | undefined;
  const targetUser = item.extra_data?.target_username as string | undefined;
  const itemTitle = item.extra_data?.item_title as string | undefined;
  const status = item.item_status?.toLowerCase();
  const verification = item.verification_status;
  const kind = item.item_kind?.toLowerCase();
  const leanBadge = item.has_lean_code ? "with Lean" : undefined;
  const teamName = item.extra_data?.team_name as string | undefined;

  switch (item.type) {
    case "CREATED_PROBLEM":
      return `created ${problemTitle}`;
    case "CREATED_WORKSPACE_FILE":
      return `added ${filePath || "a workspace file"} to ${problemTitle}`;
    case "PUBLISHED_LIBRARY":
    case "UPDATED_LIBRARY":
    case "VERIFIED_LIBRARY": {
      const statusLabel = status === "verified"
        ? "verified"
        : status === "proposed"
        ? "proposed"
        : status || "updated";
      const verificationLabel = verification ? ` (${verification})` : "";
      const kindLabel = kind ? `${kind}` : "library item";
      const leanLabel = leanBadge ? ` ${leanBadge}` : "";
      return `${statusLabel}${verificationLabel} ${itemTitle || kindLabel}${leanLabel} in ${problemTitle}`;
    }
    case "FOLLOWED_USER":
      return `connected with ${targetUser || "a researcher"}`;
    case "TEAM_INVITE":
      return `invited you to join ${teamName || "a team"}`;
    case "TEAM_JOIN":
      return `joined team ${teamName || "a team"}`;
    case "FORKED_PROBLEM":
      return `forked ${problemTitle}`;
    default:
      return "posted an update";
  }
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default function SocialPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [followers, setFollowers] = useState<SocialUser[]>([]);
  const [following, setFollowing] = useState<SocialUser[]>([]);
  const [feedItems, setFeedItems] = useState<SocialFeedItem[]>([]);
  const [contributions, setContributions] = useState<SocialProblemContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedScope, setFeedScope] = useState<"network" | "global">("network");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [inviting, setInviting] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [connections, feed, contribs] = await Promise.all([
        getSocialConnections(),
        getSocialFeed({ scope: feedScope, limit: 60 }),
        getSocialContributions(),
      ]);
      setFollowers(connections.followers);
      setFollowing(connections.following);
      setFeedItems(feed.items);
      setContributions(contribs.problems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load social data");
    } finally {
      setLoading(false);
    }
  }, [feedScope]);

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user, loadAll]);

  const followingIds = useMemo(
    () => new Set(following.map((person) => person.id)),
    [following]
  );

  const contributionsByProblem = useMemo(() => {
    const map = new Map<string, SocialProblemContribution>();
    contributions.forEach((entry) => {
      map.set(entry.problem_id, entry);
    });
    return map;
  }, [contributions]);

  const filteredFeed = useMemo(() => {
    const activeFilter = FEED_FILTERS.find((item) => item.id === filter);
    const allowed = activeFilter?.types;
    const term = query.trim().toLowerCase();

    return feedItems.filter((item) => {
      if (allowed && !allowed.includes(item.type)) return false;
      if (!term) return true;
      const values = [
        item.actor.username,
        item.problem?.title || "",
        (item.extra_data?.problem_title as string | undefined) || "",
        (item.extra_data?.item_title as string | undefined) || "",
        (item.extra_data?.file_path as string | undefined) || "",
      ];
      return values.some((value) => value.toLowerCase().includes(term));
    });
  }, [feedItems, filter, query]);

  const feedSections = useMemo(() => {
    const today = new Date();
    const todayItems = filteredFeed.filter((item) =>
      isSameDay(new Date(item.created_at), today)
    );
    const earlierItems = filteredFeed.filter((item) =>
      !isSameDay(new Date(item.created_at), today)
    );
    const sections = [] as { label: string; items: SocialFeedItem[] }[];
    if (todayItems.length) sections.push({ label: "Today", items: todayItems });
    if (earlierItems.length) sections.push({ label: "Earlier", items: earlierItems });
    return sections;
  }, [filteredFeed]);

  useEffect(() => {
    if (filteredFeed.length === 0) {
      setSelectedItemId(null);
      return;
    }
    if (!selectedItemId || !filteredFeed.find((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredFeed[0].id);
    }
  }, [filteredFeed, selectedItemId]);

  const selectedItem = filteredFeed.find((item) => item.id === selectedItemId) || null;

  const handleFollowActor = async () => {
    if (!selectedItem || !user) return;
    const actorId = selectedItem.actor.id;
    if (actorId === user.id) return;
    try {
      if (followingIds.has(actorId)) {
        await unfollowUser(actorId);
      } else {
        await followUser(actorId);
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update follow");
    }
  };

  const handleCopyLink = async () => {
    if (!selectedItem?.problem) return;
    const link = `${window.location.origin}/problems/${selectedItem.problem.id}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f0f9ff_0%,_#f8fafc_42%,_#ffffff_92%)]">
      <DashboardNavbar />
      <main className="max-w-[1440px] mx-auto px-4 py-6 md:py-8">
        <div className="rounded-3xl border border-neutral-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 px-5 py-5 md:px-7 md:py-6 mb-6 shadow-[0_25px_60px_-45px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/70 px-3 py-1 text-[11px] font-medium text-cyan-800 mb-3">
                <Sparkles size={14} />
                Social Graph for Mathematical Work
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Reasoning Stream</h1>
              <p className="text-xs md:text-sm text-neutral-600 mt-1">
                Collaboration signals, approvals, and research momentum.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3 w-full md:w-auto">
              <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Following</div>
                <div className="text-sm md:text-base font-semibold text-neutral-900">{following.length}</div>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Feed Items</div>
                <div className="text-sm md:text-base font-semibold text-neutral-900">{filteredFeed.length}</div>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Active Proofs</div>
                <div className="text-sm md:text-base font-semibold text-neutral-900">{contributions.length}</div>
              </div>
            </div>
          </div>
        </div>

            {error && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-xs text-red-600 mb-4">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
              </div>
            ) : (
              <div className="grid lg:grid-cols-[255px_minmax(0,1fr)_340px] gap-6">
                <aside className="space-y-6 hidden lg:block lg:sticky lg:top-20 h-fit">
                  <div className="border border-neutral-200 rounded-2xl bg-white/80 backdrop-blur p-4">
                    <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-3">
                      Workspace
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white border border-neutral-200 shadow-sm text-xs font-medium text-neutral-900">
                        <Sparkles size={14} className="text-neutral-500" />
                        Activity Stream
                      </div>
                      <Link
                        href="/notifications"
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-neutral-500 hover:bg-white hover:text-neutral-900 transition-colors"
                      >
                        <FileText size={14} className="text-neutral-400" />
                        Inbox
                        <span className="ml-auto bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded text-[10px]">
                          {Math.max(followers.length, 1)}
                        </span>
                      </Link>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-neutral-500">
                        <BookOpen size={14} className="text-neutral-400" />
                        Saved Lemmas
                      </div>
                    </div>
                  </div>

                  <div className="border border-neutral-200 rounded-2xl bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
                        Active Proofs
                      </span>
                      <span className="text-[10px] text-neutral-400">{contributions.length}</span>
                    </div>
                    <div className="space-y-2">
                      {(contributions.length > 0 ? contributions.slice(0, 4) : []).map((problem, index) => (
                        <Link
                          key={problem.problem_id}
                          href={`/problems/${problem.problem_id}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-50 text-xs font-medium text-neutral-600"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[index % DOT_COLORS.length]}`} />
                          <span className="truncate">{problem.problem_title}</span>
                        </Link>
                      ))}
                      {contributions.length === 0 && (
                        <div className="text-xs text-neutral-400">No active proofs yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="border border-neutral-200 rounded-2xl bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
                        Connections
                      </span>
                      <span className="text-[10px] text-neutral-400">{following.length}</span>
                    </div>
                    <div className="space-y-2">
                      {(following.length > 0 ? following.slice(0, 4) : []).map((person) => (
                        <div key={person.id} className="flex items-center gap-2">
                          {renderAvatar(person, "w-7 h-7")}
                          <span className="text-xs text-neutral-600">{person.username}</span>
                        </div>
                      ))}
                      {following.length === 0 && (
                        <div className="text-xs text-neutral-400">No connections yet.</div>
                      )}
                    </div>
                  </div>
                </aside>

                <section className="border border-neutral-200 rounded-2xl bg-white overflow-hidden shadow-[0_30px_70px_-55px_rgba(0,0,0,0.4)]">
                  <header className="h-14 border-b border-neutral-100 flex items-center justify-between px-4 bg-white">
                    <div className="flex items-center gap-4">
                      <h2 className="text-xs font-semibold text-neutral-900">Stream</h2>
                      <div className="h-4 w-px bg-neutral-200" />
                      <div className="flex gap-1">
                        {FEED_FILTERS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setFilter(option.id)}
                            className={`px-3 py-1 text-[10px] font-medium rounded-md transition-colors ${
                              filter === option.id
                                ? "bg-neutral-100 text-neutral-900"
                                : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFeedScope("network")}
                        className={`text-[10px] px-2 py-1 rounded border ${
                          feedScope === "network"
                            ? "border-neutral-400 text-neutral-700"
                            : "border-neutral-200 text-neutral-400"
                        }`}
                      >
                        Network
                      </button>
                      <button
                        onClick={() => setFeedScope("global")}
                        className={`text-[10px] px-2 py-1 rounded border ${
                          feedScope === "global"
                            ? "border-neutral-400 text-neutral-700"
                            : "border-neutral-200 text-neutral-400"
                        }`}
                      >
                        Global
                      </button>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 text-neutral-400" size={12} />
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Filter by lemma..."
                          className="pl-8 pr-3 py-1.5 text-[11px] bg-neutral-50 border border-neutral-200 rounded-md w-44 outline-none focus:border-neutral-400"
                        />
                      </div>
                    </div>
                  </header>

                  <div className="px-6 py-8">
                    {feedSections.length === 0 ? (
                      <div className="text-xs text-neutral-400">
                        No activity yet. Follow people or publish items to see updates.
                      </div>
                    ) : (
                      feedSections.map((section) => (
                        <div key={section.label} className="mb-8">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="h-px bg-neutral-100 flex-1" />
                            <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">
                              {section.label}
                            </span>
                            <div className="h-px bg-neutral-100 flex-1" />
                          </div>

                          <div className="space-y-0">
                            {section.items.map((item, idx) => {
                              const meta = FEED_META[item.type] || FEED_META.CREATED_WORKSPACE_FILE;
                              const Icon = meta.icon;
                              const isActive = item.id === selectedItemId;
                              const isLast = idx === section.items.length - 1;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setSelectedItemId(item.id)}
                                  className="w-full text-left"
                                >
                                  <div className="relative pl-10 pb-8">
                                    {!isLast && (
                                      <div className="absolute left-3 top-8 bottom-0 w-px bg-neutral-100" />
                                    )}
                                    <div
                                      className={`absolute left-0 top-0 mt-0.5 w-8 h-8 rounded-full bg-white border ${
                                        isActive ? "border-neutral-400" : meta.badge
                                      } flex items-center justify-center shadow-sm`}
                                    >
                                      <Icon size={14} className={meta.accent} />
                                    </div>
                                    <div
                                      className={`rounded-md border p-4 transition ${
                                        isActive
                                          ? "border-neutral-300 bg-neutral-50"
                                          : "border-neutral-100 hover:border-neutral-200"
                                      }`}
                                    >
                                      <div className="flex items-baseline justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-neutral-900">
                                            {meta.label}
                                          </span>
                                          <span className="text-xs text-neutral-400">
                                            {item.actor.username}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-neutral-400 font-mono">
                                          {formatRelativeTime(item.created_at)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-neutral-500 mb-3">
                                        {renderFeedText(item)}
                                      </p>
                                      {item.problem && (
                                        <div className="flex items-center justify-between text-[10px] text-neutral-400">
                                          <span className="flex items-center gap-1">
                                            <ArrowUpRight size={12} /> {item.problem.title}
                                          </span>
                                          <span className="uppercase tracking-widest">{item.problem.visibility}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <aside className="border border-neutral-200 rounded-2xl bg-white flex flex-col overflow-hidden lg:sticky lg:top-20 h-fit max-h-[calc(100vh-6rem)]">
                  <div className="h-14 border-b border-neutral-100 flex items-center justify-between px-4">
                    <span className="text-xs font-semibold text-neutral-900">Context Panel</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {!selectedItem ? (
                      <div className="text-xs text-neutral-400">Select an item from the stream.</div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium uppercase tracking-wide ${
                            FEED_META[selectedItem.type]?.badge || "border-neutral-200 text-neutral-600"
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                            {FEED_META[selectedItem.type]?.label || selectedItem.type}
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            ID: {selectedItem.id.slice(0, 6)}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-neutral-900 mb-1">
                            {selectedItem.problem?.title || "Activity update"}
                          </h3>
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                            <div className="w-4 h-4 rounded-full bg-neutral-100 flex items-center justify-center">
                              <Sparkles size={10} className="text-neutral-500" />
                            </div>
                            {selectedItem.actor.username} · {formatRelativeTime(selectedItem.created_at)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-medium text-neutral-900 uppercase tracking-wider mb-2">
                            Statement
                          </div>
                          <div className="p-3 bg-neutral-50 rounded border border-neutral-200 text-xs text-neutral-700 leading-relaxed">
                            {renderFeedText(selectedItem)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-medium text-neutral-900 uppercase tracking-wider mb-2">
                            Contributors
                          </div>
                          <div className="space-y-2">
                            {(selectedItem.problem
                              ? contributionsByProblem.get(selectedItem.problem.id)?.contributors.slice(0, 3) || []
                              : contributions.slice(0, 3).flatMap((entry) => entry.contributors.slice(0, 1))
                            ).map((contrib) => (
                              <div key={contrib.id} className="flex items-center gap-2 text-xs text-neutral-500">
                                {contrib.avatar_url ? (
                                  <img
                                    src={contrib.avatar_url}
                                    alt={`${contrib.username} avatar`}
                                    className="w-5 h-5 rounded-full object-cover border border-neutral-200"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[9px] font-semibold">
                                    {getInitials(contrib.username)}
                                  </div>
                                )}
                                <span>{contrib.username}</span>
                                <span className="text-[10px] text-neutral-400">{contrib.contributions} items</span>
                              </div>
                            ))}
                            {(!selectedItem.problem ||
                              !(contributionsByProblem.get(selectedItem.problem.id)?.contributors.length)) && (
                              <div className="text-xs text-neutral-400">No contributors yet.</div>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-neutral-100 pt-4 space-y-2">
                          {selectedItem.type === "TEAM_INVITE" &&
                            selectedItem.extra_data?.team_slug &&
                            selectedItem.extra_data?.notification_id &&
                            user?.id === selectedItem.extra_data?.invitee_id && (
                              <div className="space-y-2">
                                <button
                                  disabled={inviting === "accept"}
                                  onClick={async () => {
                                    try {
                                      setInviting("accept");
                                      await acceptTeamInvite(
                                        selectedItem.extra_data.team_slug as string,
                                        selectedItem.extra_data.notification_id as string
                                      );
                                      await loadAll();
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : "Failed to accept invite");
                                    } finally {
                                      setInviting(null);
                                    }
                                  }}
                                  className="w-full bg-emerald-600 text-white py-2 rounded-md text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {inviting === "accept" ? "Accepting..." : "Accept invite"}
                                </button>
                                <button
                                  disabled={inviting === "decline"}
                                  onClick={async () => {
                                    try {
                                      setInviting("decline");
                                      await declineTeamInvite(
                                        selectedItem.extra_data.team_slug as string,
                                        selectedItem.extra_data.notification_id as string
                                      );
                                      await loadAll();
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : "Failed to decline invite");
                                    } finally {
                                      setInviting(null);
                                    }
                                  }}
                                  className="w-full bg-white border border-neutral-200 text-neutral-700 py-2 rounded-md text-xs font-medium hover:bg-neutral-50 disabled:opacity-60"
                                >
                                  {inviting === "decline" ? "Declining..." : "Decline"}
                                </button>
                              </div>
                            )}
                          {selectedItem.problem && (
                            <Link
                              href={`/problems/${selectedItem.problem.id}`}
                              className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white py-2 rounded-md text-xs font-medium hover:bg-neutral-800"
                            >
                              Open problem
                              <ArrowUpRight size={12} />
                            </Link>
                          )}
                          {selectedItem.problem && typeof selectedItem.extra_data?.file_path === "string" && (
                            <Link
                              href={`/problems/${selectedItem.problem.id}/lab?file=${encodeURIComponent(
                                selectedItem.extra_data.file_path
                              )}`}
                              className="w-full bg-white border border-neutral-200 text-neutral-600 py-2 rounded-md text-xs font-medium hover:bg-neutral-50 text-center block"
                            >
                              Open workspace file
                            </Link>
                          )}
                          {selectedItem.problem && (
                            <button
                              onClick={handleCopyLink}
                              className="w-full bg-white border border-neutral-200 text-neutral-600 py-2 rounded-md text-xs font-medium hover:bg-neutral-50"
                            >
                              {copyState === "copied"
                                ? "Link copied"
                                : copyState === "error"
                                ? "Copy failed"
                                : "Copy link"}
                            </button>
                          )}
                          {selectedItem.actor.id !== user.id && (
                            <button
                              onClick={handleFollowActor}
                              className="w-full bg-white border border-neutral-200 text-neutral-600 py-2 rounded-md text-xs font-medium hover:bg-neutral-50 flex items-center justify-center gap-2"
                            >
                              <UserPlus size={12} />
                              {followingIds.has(selectedItem.actor.id) ? "Unfollow" : "Follow"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-36 border-t border-neutral-100 bg-gradient-to-r from-neutral-50 to-cyan-50/40 p-4 relative overflow-hidden">
                    <div className="absolute top-2 left-2 text-[10px] font-semibold text-neutral-400 uppercase">
                      Local Graph
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-30">
                      <div className="absolute top-8 left-10 w-2 h-2 bg-neutral-400 rounded-full" />
                      <div className="absolute top-16 left-20 w-2 h-2 bg-neutral-400 rounded-full" />
                      <div className="absolute top-10 left-24 w-2 h-2 bg-neutral-900 rounded-full z-10" />
                      <div className="absolute border-t border-neutral-300 w-12 top-[42px] left-[42px] rotate-12" />
                      <div className="absolute border-t border-neutral-300 w-12 top-[58px] left-[85px] rotate-90" />
                      <div className="absolute top-20 right-10 w-2 h-2 bg-neutral-400 rounded-full" />
                      <div className="absolute border-t border-neutral-300 w-14 top-[70px] right-[40px] rotate-12" />
                    </div>
                  </div>
                </aside>
              </div>
            )}
      </main>
    </div>
  );
}
