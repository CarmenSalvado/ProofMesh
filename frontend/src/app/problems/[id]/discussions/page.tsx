"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";
import { getDiscussions, getProblem, Discussion, Problem } from "@/lib/api";

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

export default function ProblemDiscussionsPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = params.id as string;
  
  const [problem, setProblem] = useState<Problem | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const problemData = await getProblem(problemId, { suppressErrorLog: true });
      const discussionsData = await getDiscussions({ problem_id: problemId, limit: 50 });
      setProblem(problemData);
      setDiscussions(discussionsData.discussions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message.includes("HTTP 404") ? "Problem not found." : "Failed to load discussions");
      if (!message.includes("HTTP 404")) {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (problemId) {
      loadData();
    }
  }, [problemId, loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Error</h1>
            <p className="text-neutral-500">{error || "Problem not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link 
            href={`/problems/${problemId}`}
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Problem
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">Discussions</h1>
              <p className="text-neutral-500 mt-1">{problem.title}</p>
            </div>
            <Link
              href={`/problems/${problemId}/discussions/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              New Discussion
            </Link>
          </div>
        </div>
      </div>

      {/* Discussions List */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {discussions.length === 0 ? (
          <div className="text-center py-16 bg-neutral-50 rounded-lg">
            <MessageSquare className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No discussions yet</h3>
            <p className="text-neutral-500 mb-6">Be the first to start a discussion about this problem.</p>
            <Link
              href={`/problems/${problemId}/discussions/new`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Start Discussion
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {discussions.map((discussion) => (
              <Link
                key={discussion.id}
                href={`/discussions/${discussion.id}`}
                className="block p-6 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {discussion.author.avatar_url ? (
                      <img
                        src={discussion.author.avatar_url}
                        alt={discussion.author.username}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                        {discussion.author.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-medium text-neutral-900 line-clamp-1">{discussion.title}</h3>
                      {discussion.is_resolved && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-neutral-600 mt-1 line-clamp-2">
                      {discussion.content.slice(0, 200)}...
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
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
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {discussion.comment_count} comments
                      </span>
                      <span>·</span>
                      <span>{formatRelativeTime(discussion.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
