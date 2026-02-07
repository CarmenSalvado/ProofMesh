"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getDiscussions,
  createDiscussion,
  Discussion,
  DiscussionCreate,
} from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  Plus,
  MessageSquare,
  CheckCircle2,
  Filter,
  Search,
} from "lucide-react";

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DiscussionsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    content: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadDiscussions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getDiscussions({ limit: 50 });
      setDiscussions(data.discussions);
    } catch (err) {
      console.error("Failed to load discussions", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title || !createForm.content) return;

    setCreating(true);
    try {
      const newDiscussion = await createDiscussion({
        title: createForm.title,
        content: createForm.content,
      });
      setDiscussions((prev) => [newDiscussion, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ title: "", content: "" });
      router.push(`/discussions/${newDiscussion.id}`);
    } catch (err) {
      console.error("Failed to create discussion", err);
    } finally {
      setCreating(false);
    }
  };

  const filteredDiscussions = discussions.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.content.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === "open") return matchesSearch && !d.is_resolved;
    if (filter === "resolved") return matchesSearch && d.is_resolved;
    return matchesSearch;
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
      <DashboardNavbar />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Discussions</h1>
            <p className="text-sm text-neutral-500">
              Ask questions and share insights with the community
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Discussion
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search discussions..."
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-1">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === "all"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("open")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === "open"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setFilter("resolved")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === "resolved"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {/* Discussions List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent" />
          </div>
        ) : filteredDiscussions.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-base font-medium text-neutral-900 mb-2">No discussions found</h3>
            <p className="text-sm text-neutral-500 mb-4">
              {searchQuery
                ? "Try a different search term."
                : "Be the first to start a discussion!"}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start a discussion
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDiscussions.map((discussion) => (
              <Link
                key={discussion.id}
                href={`/discussions/${discussion.id}`}
                className="block bg-white rounded-xl border border-neutral-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  {discussion.author.avatar_url ? (
                    <img
                      src={discussion.author.avatar_url}
                      alt={`${discussion.author.username} avatar`}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-neutral-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600 flex-shrink-0">
                      {getInitials(discussion.author.username)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 className="text-base font-semibold text-neutral-900 group-hover:text-indigo-600 line-clamp-1">
                        {discussion.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {discussion.is_pinned && (
                          <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                            Pinned
                          </span>
                        )}
                        {discussion.is_resolved && (
                          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600 line-clamp-2 mb-3">
                      {discussion.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          router.push(`/users/${discussion.author.username}`);
                        }}
                        className="font-medium hover:text-indigo-600 hover:underline"
                      >
                        {discussion.author.username}
                      </button>
                      <span>·</span>
                      <span>{formatRelativeTime(discussion.created_at)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {discussion.comment_count} comments
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Discussion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">Start a Discussion</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateDiscussion} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="What's your question or topic?"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  value={createForm.content}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="Provide details about your question or topic. You can use Markdown and LaTeX (wrap math in $ or $$)."
                  rows={8}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none bg-white text-neutral-900 font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.title || !createForm.content}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Posting..." : "Post Discussion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
