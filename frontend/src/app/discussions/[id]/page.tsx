"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getDiscussion,
  getComments,
  createComment,
  updateDiscussion,
  deleteDiscussion,
  getSocialUsers,
  getProblems,
  Discussion,
  Comment,
  SocialUser,
  Problem,
} from "@/lib/api";
import { extractPostAttachments } from "@/lib/postAttachments";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import { PostAttachmentCard } from "@/components/social";
import { RichSocialMarkdown } from "@/components/social/RichSocialMarkdown";
import {
  MessageSquare,
  CheckCircle2,
  MoreHorizontal,
  Send,
  Pin,
  Trash2,
  Reply,
  Bot,
  Sparkles,
  WandSparkles,
} from "lucide-react";

const RHO_MENTION_REGEX = /(?:^|\s)@rho\b/i;

type AutocompleteScope = "main" | "reply";
type AutocompleteMode = "user" | "project";

type AutocompleteContext = {
  mode: AutocompleteMode;
  query: string;
  start: number;
  end: number;
};

type AutocompleteItem =
  | {
      key: string;
      mode: "user";
      label: string;
      meta?: string;
      username: string;
    }
  | {
      key: string;
      mode: "project";
      label: string;
      meta?: string;
      problemId: string;
      problemTitle: string;
    };

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

function getAutocompleteContext(text: string, cursor: number): AutocompleteContext | null {
  const prefix = text.slice(0, cursor);
  const match = prefix.match(/(?:^|\s)([@#])([A-Za-z0-9._-]*)$/);
  if (!match) return null;
  const symbol = match[1];
  const query = match[2] || "";
  const end = cursor;
  const start = end - (1 + query.length);
  return {
    mode: symbol === "@" ? "user" : "project",
    query,
    start,
    end,
  };
}

function highlightMentions(text: string) {
  return <RichSocialMarkdown text={text} className="text-neutral-700" />;
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
  const [rhoPending, setRhoPending] = useState(false);
  const [activeComposer, setActiveComposer] = useState<AutocompleteScope | null>(null);
  const [autocomplete, setAutocomplete] = useState<AutocompleteContext | null>(null);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<SocialUser[]>([]);
  const [projectPool, setProjectPool] = useState<Problem[]>([]);
  const [projectSuggestions, setProjectSuggestions] = useState<Problem[]>([]);
  const mainComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const replyComposerRef = useRef<HTMLInputElement | null>(null);

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
        getComments(discussionId, { limit: 200 }),
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

  useEffect(() => {
    if (!autocomplete || autocomplete.mode !== "user") return;
    let cancelled = false;
    setAutocompleteLoading(true);
    getSocialUsers({ q: autocomplete.query || undefined, limit: 8 })
      .then((data) => {
        if (cancelled) return;
        setUserSuggestions(data.users);
      })
      .catch(() => {
        if (cancelled) return;
        setUserSuggestions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setAutocompleteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [autocomplete]);

  useEffect(() => {
    if (!autocomplete || autocomplete.mode !== "project") return;
    const normalized = autocomplete.query.trim().toLowerCase();
    const filterProjects = (problems: Problem[]) => {
      const filtered = problems
        .filter((problem) => {
          if (!normalized) return true;
          return (
            problem.title.toLowerCase().includes(normalized) ||
            problem.id.toLowerCase().startsWith(normalized)
          );
        })
        .slice(0, 8);
      setProjectSuggestions(filtered);
    };

    if (projectPool.length > 0) {
      setAutocompleteLoading(false);
      filterProjects(projectPool);
      return;
    }

    let cancelled = false;
    setAutocompleteLoading(true);
    getProblems()
      .then((data) => {
        if (cancelled) return;
        setProjectPool(data.problems);
        filterProjects(data.problems);
      })
      .catch(() => {
        if (cancelled) return;
        setProjectSuggestions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setAutocompleteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [autocomplete, projectPool]);

  const appendRhoMention = () => {
    setNewComment((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return "@rho ";
      if (RHO_MENTION_REGEX.test(trimmed)) return prev;
      return `${trimmed} @rho `;
    });
  };

  const autocompleteItems = useMemo<AutocompleteItem[]>(() => {
    if (!autocomplete) return [];
    if (autocomplete.mode === "user") {
      return userSuggestions.map((user) => ({
        key: `user-${user.id}`,
        mode: "user",
        label: `@${user.username}`,
        meta: user.bio || undefined,
        username: user.username,
      }));
    }
    return projectSuggestions.map((problem) => ({
      key: `project-${problem.id}`,
      mode: "project",
      label: problem.title,
      meta: problem.visibility,
      problemId: problem.id,
      problemTitle: problem.title,
    }));
  }, [autocomplete, projectSuggestions, userSuggestions]);

  useEffect(() => {
    setAutocompleteIndex(0);
  }, [autocomplete?.mode, autocomplete?.query, autocompleteItems.length]);

  const closeAutocomplete = useCallback(() => {
    setAutocomplete(null);
    setAutocompleteLoading(false);
    setAutocompleteIndex(0);
  }, []);

  const syncAutocomplete = useCallback(
    (value: string, cursor: number | null, scope: AutocompleteScope) => {
      setActiveComposer(scope);
      if (cursor == null) {
        closeAutocomplete();
        return;
      }
      const nextContext = getAutocompleteContext(value, cursor);
      if (!nextContext) {
        closeAutocomplete();
        return;
      }
      setAutocomplete(nextContext);
    },
    [closeAutocomplete]
  );

  const handleComposerChange = useCallback(
    (value: string, cursor: number | null, scope: AutocompleteScope) => {
      setNewComment(value);
      syncAutocomplete(value, cursor, scope);
    },
    [syncAutocomplete]
  );

  const applyAutocompleteSelection = useCallback(
    (item: AutocompleteItem) => {
      if (!autocomplete) return;

      const insertion =
        item.mode === "user"
          ? `@${item.username} `
          : `[[project:${item.problemId}|${item.problemTitle}]] `;
      const nextCursor = autocomplete.start + insertion.length;

      setNewComment((prev) => `${prev.slice(0, autocomplete.start)}${insertion}${prev.slice(autocomplete.end)}`);
      closeAutocomplete();

      requestAnimationFrame(() => {
        const input = activeComposer === "reply" ? replyComposerRef.current : mainComposerRef.current;
        if (!input) return;
        input.focus();
        if ("setSelectionRange" in input) {
          input.setSelectionRange(nextCursor, nextCursor);
        }
      });
    },
    [activeComposer, autocomplete, closeAutocomplete]
  );

  const handleComposerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (!autocomplete) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeAutocomplete();
        return;
      }

      if (!autocompleteItems.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev + 1) % autocompleteItems.length);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev - 1 + autocompleteItems.length) % autocompleteItems.length);
        return;
      }

      if ((e.key === "Enter" || e.key === "Tab") && autocompleteItems[autocompleteIndex]) {
        e.preventDefault();
        applyAutocompleteSelection(autocompleteItems[autocompleteIndex]);
      }
    },
    [applyAutocompleteSelection, autocomplete, autocompleteIndex, autocompleteItems, closeAutocomplete]
  );

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !discussion) return;

    const content = newComment.trim();
    const triggersRho = RHO_MENTION_REGEX.test(content);

    setSubmitting(true);
    if (triggersRho) setRhoPending(true);

    try {
      const comment = await createComment(discussion.id, {
        content,
        parent_id: replyTo || undefined,
      });
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      setReplyTo(null);
      closeAutocomplete();

      // The backend auto-posts Rho as a threaded reply when @rho is present.
      if (triggersRho) {
        const latest = await getComments(discussion.id, { limit: 200 });
        setComments(latest.comments);
      }
    } catch (err) {
      console.error("Failed to submit comment", err);
    } finally {
      setSubmitting(false);
      setRhoPending(false);
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

  const rootComments = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const getChildren = useCallback((parentId: string) => comments.filter((c) => c.parent_id === parentId), [comments]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-neutral-100 to-white">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (error || !discussion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Discussion not found</h1>
        <p className="text-neutral-500 mb-4">This discussion does not exist or was deleted.</p>
        <Link href="/discussions" className="text-indigo-600 hover:text-indigo-700 font-medium">
          Back to Discussions
        </Link>
      </div>
    );
  }

  if (!user) return null;

  const { cleanContent: discussionContent, attachments: discussionAttachments } = extractPostAttachments(
    discussion.content
  );
  const hasRhoMention = RHO_MENTION_REGEX.test(newComment);

  const renderAutocompleteMenu = (scope: AutocompleteScope) => {
    if (!autocomplete || activeComposer !== scope) return null;

    const noResultsText =
      autocomplete.mode === "user" ? "No users match that mention." : "No projects match that link.";

    return (
      <div className="mt-2 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 border-b border-neutral-100">
          {autocomplete.mode === "user" ? "Mention users" : "Link projects"}
        </div>
        {autocompleteLoading ? (
          <div className="px-3 py-2 text-xs text-neutral-500">Searching…</div>
        ) : autocompleteItems.length === 0 ? (
          <div className="px-3 py-2 text-xs text-neutral-500">{noResultsText}</div>
        ) : (
          <div className="max-h-56 overflow-y-auto">
            {autocompleteItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyAutocompleteSelection(item);
                }}
                className={`w-full px-3 py-2 text-left transition ${
                  index === autocompleteIndex ? "bg-emerald-50" : "hover:bg-neutral-50"
                }`}
              >
                {item.mode === "user" ? (
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-800 truncate">{item.label}</div>
                    {item.meta && <div className="text-[11px] text-neutral-500 truncate">{item.meta}</div>}
                  </div>
                ) : (
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-700 truncate">#{item.label}</div>
                    <div className="text-[11px] text-neutral-500 truncate">{item.problemId}</div>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderComment = (comment: Comment, depth = 0) => {
    const children = getChildren(comment.id);
    const isReplying = replyTo === comment.id;
    const isRho = comment.author.username.toLowerCase() === "rho";

    return (
      <div key={comment.id} className={depth > 0 ? "ml-6 md:ml-10 border-l border-cyan-100 pl-4" : ""}>
        <div className="py-4">
          <div className="flex items-start gap-3">
            {comment.author.avatar_url ? (
              <img
                src={comment.author.avatar_url}
                alt={`${comment.author.username} avatar`}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-neutral-200"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  isRho ? "bg-cyan-100 text-cyan-800 border border-cyan-200" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {isRho ? <Bot className="w-4 h-4" /> : getInitials(comment.author.username)}
              </div>
            )}

            <div className={`flex-1 min-w-0 rounded-2xl border p-3 ${isRho ? "bg-cyan-50/70 border-cyan-200" : "bg-white border-neutral-200"}`}>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Link
                  href={`/users/${comment.author.username}`}
                  className="text-sm font-semibold text-neutral-900 hover:text-indigo-600 hover:underline"
                >
                  {comment.author.username}
                </Link>
                {isRho && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200">
                    <Sparkles className="w-3 h-3" />
                    AI
                  </span>
                )}
                <span className="text-xs text-neutral-400">{formatRelativeTime(comment.created_at)}</span>
              </div>

              <div className="text-sm break-words">{highlightMentions(comment.content)}</div>

              {!isRho && (
                <button
                  onClick={() => setReplyTo(isReplying ? null : comment.id)}
                  className="mt-2 text-xs text-neutral-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
              )}

              {isReplying && (
                <form onSubmit={handleSubmitComment} className="mt-3">
                  <div className="flex gap-2">
                    <input
                      ref={isReplying ? replyComposerRef : undefined}
                      type="text"
                      value={newComment}
                      onChange={(e) =>
                        handleComposerChange(
                          e.target.value,
                          e.target.selectionStart ?? e.target.value.length,
                          "reply"
                        )
                      }
                      onFocus={(e) =>
                        syncAutocomplete(
                          e.currentTarget.value,
                          e.currentTarget.selectionStart ?? e.currentTarget.value.length,
                          "reply"
                        )
                      }
                      onClick={(e) =>
                        syncAutocomplete(
                          e.currentTarget.value,
                          e.currentTarget.selectionStart ?? e.currentTarget.value.length,
                          "reply"
                        )
                      }
                      onKeyUp={(e) =>
                        syncAutocomplete(
                          e.currentTarget.value,
                          e.currentTarget.selectionStart ?? e.currentTarget.value.length,
                          "reply"
                        )
                      }
                      onKeyDown={handleComposerKeyDown}
                      placeholder={`Reply to ${comment.author.username}... (@user or #project)`}
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
                        closeAutocomplete();
                        setReplyTo(null);
                        setNewComment("");
                      }}
                      className="px-3 py-2 text-neutral-500 hover:text-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                  {renderAutocompleteMenu("reply")}
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f0f9ff_0%,_#f8fafc_40%,_#ffffff_90%)] text-neutral-900 flex flex-col">
      <DashboardNavbar />

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <article className="bg-white/90 backdrop-blur rounded-2xl border border-neutral-200 overflow-hidden mb-8 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.35)]">
          <div className="p-6 md:p-7">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {discussion.is_pinned && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                    Pinned
                  </span>
                )}
                {discussion.is_resolved && (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
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

            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4">{discussion.title}</h1>

            <div className="flex items-center gap-3 mb-6">
              {discussion.author.avatar_url ? (
                <img
                  src={discussion.author.avatar_url}
                  alt={`${discussion.author.username} avatar`}
                  className="w-10 h-10 rounded-full object-cover border border-neutral-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
                  {getInitials(discussion.author.username)}
                </div>
              )}
              <div>
                <Link
                  href={`/users/${discussion.author.username}`}
                  className="text-sm font-semibold text-neutral-900 hover:text-indigo-600 hover:underline"
                >
                  {discussion.author.username}
                </Link>
                <div className="text-xs text-neutral-500">Posted {formatRelativeTime(discussion.created_at)}</div>
              </div>
            </div>

            <div className="prose prose-sm max-w-none text-neutral-700 space-y-3">
              {discussionContent && <div>{highlightMentions(discussionContent)}</div>}
              {discussionAttachments.length > 0 && (
                <div className="space-y-2">
                  {discussionAttachments.map((attachment, index) => (
                    <PostAttachmentCard
                      key={`${attachment.kind}-${index}`}
                      attachment={attachment}
                      allowPrivate={discussion.author.id === user.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </article>

        <section>
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="text-sm font-semibold text-neutral-900">Comments ({comments.length})</h2>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs text-cyan-800">
              <WandSparkles className="w-3.5 h-3.5" />
              Type <span className="font-semibold">@</span> to mention users, <span className="font-semibold">#</span> to link projects.
            </div>
          </div>

          {!replyTo && (
            <form onSubmit={handleSubmitComment} className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                <div className="text-xs text-cyan-800">
                  <span className="font-semibold">@rho</span> can review your argument and reply in-thread.
                </div>
                <Link
                  href="/users/rho"
                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 hover:underline"
                >
                  View profile
                </Link>
              </div>
              <div className="flex gap-3">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={`${user.username} avatar`}
                    className="w-8 h-8 rounded-full object-cover border border-neutral-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 flex-shrink-0">
                    {getInitials(user.username)}
                  </div>
                )}

                <div className="flex-1">
                  <textarea
                    ref={mainComposerRef}
                    value={newComment}
                    onChange={(e) =>
                      handleComposerChange(
                        e.target.value,
                        e.target.selectionStart ?? e.target.value.length,
                        "main"
                      )
                    }
                    onFocus={(e) =>
                      syncAutocomplete(
                        e.currentTarget.value,
                        e.currentTarget.selectionStart ?? e.currentTarget.value.length,
                        "main"
                      )
                    }
                    onClick={(e) =>
                      syncAutocomplete(
                        e.currentTarget.value,
                        e.currentTarget.selectionStart ?? e.currentTarget.value.length,
                        "main"
                      )
                    }
                    onKeyUp={(e) =>
                      syncAutocomplete(
                        e.currentTarget.value,
                        e.currentTarget.selectionStart ?? e.currentTarget.value.length,
                        "main"
                      )
                    }
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Write a comment, proof idea, or question... (@user, #project)"
                    rows={3}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none bg-white text-neutral-900"
                  />
                  {renderAutocompleteMenu("main")}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {hasRhoMention && (
                      <div className="text-[11px] text-cyan-800 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1">
                        Rho will reply after you post.
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={appendRhoMention}
                        disabled={hasRhoMention}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-cyan-300 bg-white px-3 text-xs font-semibold text-cyan-800 transition hover:border-cyan-400 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        {hasRhoMention ? "Rho linked" : "Call @rho"}
                      </button>

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
              </div>
            </form>
          )}

          {rhoPending && (
            <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800 inline-flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Rho is preparing a reply...
            </div>
          )}

          {comments.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
              <MessageSquare className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No comments yet. Be the first to reply.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 divide-y divide-neutral-100 px-4 md:px-6">
              {rootComments.map((comment) => renderComment(comment))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
