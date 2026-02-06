"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createDiscussion, getProblem, Problem } from "@/lib/api";

export default function NewProblemDiscussionPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = params.id as string;
  
  const [problem, setProblem] = useState<Problem | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProblem() {
      try {
        const data = await getProblem(problemId, { suppressErrorLog: true });
        setProblem(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setError(message.includes("HTTP 404") ? "Problem not found." : "Failed to load problem");
        if (!message.includes("HTTP 404")) {
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    }

    if (problemId) {
      loadProblem();
    }
  }, [problemId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const discussion = await createDiscussion({
        title: title.trim(),
        content: content.trim(),
        problem_id: problemId,
      });
      router.push(`/discussions/${discussion.id}`);
    } catch (err) {
      setError("Failed to create discussion. Please try again.");
      console.error(err);
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Problem Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-neutral-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            href={`/problems/${problemId}/discussions`}
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Discussions
          </Link>
          <div className="mt-4">
            <p className="text-xs text-neutral-500 uppercase tracking-wide">Problem Discussion</p>
            <h1 className="text-lg font-medium text-neutral-900 truncate">{problem.title}</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold text-neutral-900 mb-6">Start a New Discussion</h2>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-neutral-700 mb-2">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What would you like to discuss about this problem?"
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-neutral-700 mb-2">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your question or idea in detail..."
              rows={12}
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              required
            />
            <p className="mt-2 text-xs text-neutral-500">
              You can use Markdown formatting. Math expressions are supported with $...$ for inline and $$...$$ for display.
            </p>
          </div>

          <div className="flex items-center justify-end gap-4">
            <Link
              href={`/problems/${problemId}/discussions`}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Discussion"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
