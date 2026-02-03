"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getProblems,
  seedProblems,
  upsertWorkspaceContent,
  listWorkspaceContents,
  createWorkspaceDirectory,
  Problem,
} from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";

function sanitizeSegment(value: string) {
  return value.trim().replace(/[\\/]/g, "-").replace(/\s+/g, "-");
}

function normalizeFolder(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export default function NewWorkspacePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [problemId, setProblemId] = useState<string>("");
  const [workspaceTitle, setWorkspaceTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadProblems = async () => {
    try {
      setLoading(true);
      const data = await getProblems({ mine: true });
      if (data.problems.length === 0) {
        setSeeding(true);
        await seedProblems();
        const seeded = await getProblems({ mine: true });
        setProblems(seeded.problems);
        setProblemId(seeded.problems[0]?.id || "");
      } else {
        setProblems(data.problems);
        setProblemId((prev) => prev || data.problems[0]?.id || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load problems");
    } finally {
      setLoading(false);
      setSeeding(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProblems();
    }
  }, [user]);

  const selectedProblem = useMemo(
    () => problems.find((p) => p.id === problemId) || null,
    [problems, problemId]
  );

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await seedProblems();
      await loadProblems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed problems");
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspaceTitle.trim()) {
      setError("Workspace file name is required");
      return;
    }
    if (!problemId) {
      setError("Select a problem space");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const baseName = sanitizeSegment(workspaceTitle);
      const fileName = baseName.toLowerCase().endsWith(".md") ? baseName : `${baseName}.md`;
      const folderPath = normalizeFolder(folder);

      if (folderPath) {
        await createWorkspaceDirectory(problemId, folderPath);
      }

      const listing = await listWorkspaceContents(problemId, folderPath);
      const existing = new Set(
        Array.isArray(listing.content) ? listing.content.map((entry) => entry.name) : []
      );
      let candidate = fileName;
      let counter = 1;
      while (existing.has(candidate)) {
        const base = fileName.replace(/\.md$/i, "");
        candidate = `${base}-${counter}.md`;
        counter += 1;
      }

      const path = folderPath ? `${folderPath}/${candidate}` : candidate;
      const content = `# ${workspaceTitle.trim()}\n\n## Context\nProblem Space: ${
        selectedProblem?.title || ""
      }\n\n## Notes\n`;

      await upsertWorkspaceContent(problemId, path, content);
      router.push(`/problems/${problemId}/lab?file=${encodeURIComponent(path)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace file");
    } finally {
      setSubmitting(false);
    }
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
    <div className="min-h-screen bg-white">
      <DashboardNavbar />
      <main className="max-w-2xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight text-neutral-900 mb-2">
            Create Workspace File
          </h1>
            <p className="text-sm text-neutral-500">
              A workspace file is stored inside a problem space.
            </p>
        </div>

        {error && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4 mb-6 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-2">
              Problem Space <span className="text-red-600">*</span>
            </label>
            {loading ? (
              <div className="text-xs text-neutral-500">Loading problems...</div>
            ) : (
              <select
                value={problemId}
                onChange={(event) => setProblemId(event.target.value)}
                className="w-full bg-white text-neutral-900 border border-neutral-200 focus:border-indigo-500 rounded-md px-3 py-2"
                required
              >
                <option value="" disabled>
                  Select a problem space
                </option>
                {problems.map((problem) => (
                  <option key={problem.id} value={problem.id}>
                    {problem.title} ({problem.visibility})
                  </option>
                ))}
              </select>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
              <button
                type="button"
                onClick={handleSeed}
                disabled={seeding}
                className="hover:text-neutral-900 transition-colors"
              >
                {seeding ? "Seeding..." : "Add sample problems"}
              </button>
              <Link href="/problems/new" className="hover:text-neutral-900 transition-colors">
                Create a new problem
              </Link>
            </div>
          </div>

          {selectedProblem && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-xs text-neutral-500">
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
                Problem Space Details
              </p>
              <p className="text-neutral-900 font-medium mb-2">
                {selectedProblem.title}
              </p>
              {selectedProblem.description && (
                <p className="mb-2">{selectedProblem.description}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {selectedProblem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-2">
              Workspace File Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={workspaceTitle}
              onChange={(event) => setWorkspaceTitle(event.target.value)}
              placeholder="e.g., exploration-notes"
              className="w-full bg-white text-neutral-900 border border-neutral-200 focus:border-indigo-500 rounded-md px-3 py-2"
              required
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              This creates a markdown file inside the selected problem.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-2">
              Folder (optional)
            </label>
            <input
              type="text"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              placeholder="e.g., notes/geometry"
              className="w-full bg-white text-neutral-900 border border-neutral-200 focus:border-indigo-500 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting || loading}
              className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? "Creating..." : "Create Workspace File"}
            </button>
            <Link href="/dashboard" className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
