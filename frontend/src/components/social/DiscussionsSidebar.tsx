"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageSquare, CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { getDiscussions, Discussion } from "@/lib/api";

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
  return `${days}d ago`;
}

interface DiscussionsSidebarProps {
  className?: string;
  problemId?: string;
}

export function DiscussionsSidebar({ className = "", problemId }: DiscussionsSidebarProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDiscussions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDiscussions({
        problem_id: problemId,
        limit: 5,
      });
      setDiscussions(data.discussions);
    } catch (err) {
      console.error("Failed to load discussions", err);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  return (
    <div className={`bg-neutral-50 rounded-lg p-4 border border-neutral-200 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-neutral-900">
          {problemId ? "Problem Discussions" : "Discussions in your field"}
        </h3>
        <Link
          href={problemId ? `/problems/${problemId}/discussions/new` : "/discussions/new"}
          className="p-1 hover:bg-neutral-200 rounded text-neutral-500 transition-colors"
          title="Start discussion"
        >
          <Plus className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-900 border-t-transparent" />
        </div>
      ) : discussions.length === 0 ? (
        <div className="text-center py-4">
          <MessageSquare className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
          <p className="text-xs text-neutral-500">No discussions yet</p>
          <Link
            href={problemId ? `/problems/${problemId}/discussions/new` : "/discussions/new"}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1 inline-block"
          >
            Start the first one
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map((discussion, idx) => (
            <div key={discussion.id}>
              <Link href={`/discussions/${discussion.id}`} className="block group">
                <div className="flex items-start gap-2">
                  <h4 className="text-xs font-medium text-neutral-700 group-hover:text-indigo-600 line-clamp-2 flex-1">
                    {discussion.title}
                  </h4>
                  {discussion.is_resolved && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1">
                  <Link
                    href={`/users/${discussion.author.username}`}
                    className="font-medium hover:text-indigo-600 hover:underline"
                  >
                    {discussion.author.username}
                  </Link>
                  <span>·</span>
                  <MessageSquare className="w-3 h-3" />
                  <span>{discussion.comment_count}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(discussion.created_at)}</span>
                </div>
              </Link>
              {idx < discussions.length - 1 && <div className="h-px bg-neutral-200 w-full mt-3" />}
            </div>
          ))}
        </div>
      )}

      <Link
        href={problemId ? `/problems/${problemId}/discussions` : "/discussions"}
        className="block mt-3 text-[10px] font-medium text-neutral-500 hover:text-neutral-900"
      >
        View all discussions →
      </Link>
    </div>
  );
}
