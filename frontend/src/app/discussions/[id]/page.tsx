"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getDiscussion,
  getComments,
  createComment,
  updateDiscussion,
  deleteDiscussion,
  Discussion,
  Comment,
} from "@/lib/api";
import { NotificationsDropdown } from "@/components/social";
import {
  ChevronDown,
  MessageSquare,
  CheckCircle2,
  ArrowLeft,
  MoreHorizontal,
  Send,
  Pin,
  Trash2,
  Edit2,
  Reply,
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

export default function DiscussionDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const discussionId = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadData = useCallback(async () => {
    if (!discussionId) return;
    setLoading(true);
    setError(null);
    try {
      const [discussionData, commentsData] = await Promise.all([
        getDiscussion(discussionId),
        getComments(discussionId, { limit: 100 }),
      ]);
      setDiscussion(discussionData);
      setComments(commentsData.comments);
    } catch (err) {
      console.error("Failed to load discussion", err);
      setError("Discussion not found");
    } finally {
      setLoading(false);
    }
  }, [discussionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !discussion) return;

    setSubmitting(true);
    try {
      const comment = await createComment(discussion.id, {
        content: newComment.trim(),
        parent_id: replyTo || undefined,
      });
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      setReplyTo(null);
    } catch (err) {
      console.error("Failed to submit comment", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleResolved = async () => {
    if (!discussion) return;
    try {
      const updated = await updateDiscussion(discussion.id, {
        is_resolved: !discussion.is_resolved,
      });
      setDiscussion(updated);
      setShowMenu(false);
    } catch (err) {
      console.error("Failed to update discussion", err);
    }
  };

  const handleTogglePinned = async () => {
    if (!discussion) return;
    try {
      const updated = await updateDiscussion(discussion.id, {
        is_pinned: !discussion.is_pinned,
      });
      setDiscussion(updated);
      setShowMenu(false);
    } catch (err) {
      console.error("Failed to update discussion", err);
    }
  };

  const handleDelete = async () => {
    if (!discussion || !confirm("Are you sure you want to delete this discussion?")) return;
    try {
      await deleteDiscussion(discussion.id);
      router.push("/discussions");
    } catch (err) {
      console.error("Failed to delete discussion", err);
    }
  };

  const isAuthor = user && discussion && user.id === discussion.author.id;

  // Build comment tree
  const rootComments = comments.filter((c) => !c.parent_id);
  const getChildren = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (error || !discussion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Discussion not found</h1>
        <p className="text-neutral-500 mb-4">This discussion doesn&apos;t exist or was deleted.</p>
        <Link href="/discussions" className="text-indigo-600 hover:text-indigo-700 font-medium">
          ← Back to Discussions
        </Link>
      </div>
    );
  }

  if (!user) return null;

  const renderComment = (comment: Comment, depth: number = 0) => {
    const children = getChildren(comment.id);
    const isReplying = replyTo === comment.id;

    return (
      <div key={comment.id} className={depth > 0 ? "ml-8 border-l-2 border-neutral-100 pl-4" : ""}>
        <div className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600 flex-shrink-0">
              {getInitials(comment.author.username)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-neutral-900">
                  {comment.author.username}
                </span>
                <span className="text-xs text-neutral-400">
                  {formatRelativeTime(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{comment.content}</p>
              <button
                onClick={() => setReplyTo(isReplying ? null : comment.id)}
                className="mt-2 text-xs text-neutral-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>

              {isReplying && (
                <form onSubmit={handleSubmitComment} className="mt-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={`Reply to ${comment.author.username}...`}
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-neutral-900"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={submitting || !newComment.trim()}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        setNewComment("");
                      }}
                      className="px-3 py-2 text-neutral-500 hover:text-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
        {children.map((child) => renderComment(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-6 h-6 bg-neutral-900 rounded-md flex items-center justify-center text-white group-hover:bg-indigo-600 transition-colors">
                <span className="font-[var(--font-math)] italic text-[12px] leading-none logo-rho">&rho;</span>
              </div>
              <span className="text-sm font-bold tracking-tight">ProofMesh</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsDropdown />
            <div className="h-4 w-px bg-neutral-200 mx-1" />
            <button className="flex items-center gap-2 group">
              <div className="w-6 h-6 rounded-full bg-indigo-100 border border-neutral-200 group-hover:border-indigo-500 transition-colors flex items-center justify-center text-[10px] font-bold text-indigo-700">
                {getInitials(user.username)}
              </div>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Back Link */}
        <Link
          href="/discussions"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discussions
        </Link>

        {/* Discussion */}
        <article className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-8">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
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
              {isAuthor && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-neutral-200 shadow-lg py-1 z-10">
                      <button
                        onClick={handleToggleResolved}
                        className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {discussion.is_resolved ? "Mark as Open" : "Mark as Resolved"}
                      </button>
                      <button
                        onClick={handleTogglePinned}
                        className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2"
                      >
                        <Pin className="w-4 h-4" />
                        {discussion.is_pinned ? "Unpin" : "Pin Discussion"}
                      </button>
                      <div className="h-px bg-neutral-100 my-1" />
                      <button
                        onClick={handleDelete}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-neutral-900 mb-4">{discussion.title}</h1>

            {/* Author & Date */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
                {getInitials(discussion.author.username)}
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">
                  {discussion.author.username}
                </div>
                <div className="text-xs text-neutral-500">
                  Posted {formatRelativeTime(discussion.created_at)}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-sm max-w-none text-neutral-700">
              <p className="whitespace-pre-wrap">{discussion.content}</p>
            </div>
          </div>
        </article>

        {/* Comments Section */}
        <section>
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">
            Comments ({comments.length})
          </h2>

          {/* New Comment Form */}
          {!replyTo && (
            <form onSubmit={handleSubmitComment} className="mb-6">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                  {getInitials(user.username)}
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    rows={3}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none bg-white text-neutral-900"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={submitting || !newComment.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* Comments List */}
          {comments.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
              <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No comments yet. Be the first to reply!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
              <div className="px-6">{rootComments.map((comment) => renderComment(comment))}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
