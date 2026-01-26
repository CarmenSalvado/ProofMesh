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
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

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
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <WorkspaceSidebar />

      <main className="flex-1 flex flex-col h-full">
        <WorkspaceHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "New Workspace File" },
          ]}
          status={null}
        />

        <div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
          <div className="max-w-2xl mx-auto px-8 py-12">
            <div className="mb-8">
              <h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)] mb-2">
                Create Workspace File
              </h1>
                <p className="text-sm text-[var(--text-muted)]">
                  A workspace file is stored inside a problem space.
                </p>
            </div>

            {error && (
              <div className="border border-[var(--error)] bg-[var(--error-bg)] rounded-lg p-4 mb-6 text-sm text-[var(--error)]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Problem Space <span className="text-[var(--error)]">*</span>
                </label>
                {loading ? (
                  <div className="text-xs text-[var(--text-muted)]">Loading problems...</div>
                ) : (
                  <select
                    value={problemId}
                    onChange={(event) => setProblemId(event.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
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
                <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="hover:text-[var(--text-primary)] transition-colors"
                  >
                    {seeding ? "Seeding..." : "Add sample problems"}
                  </button>
                  <Link href="/problems/new" className="hover:text-[var(--text-primary)] transition-colors">
                    Create a new problem
                  </Link>
                </div>
              </div>

              {selectedProblem && (
                <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 text-xs text-[var(--text-muted)]">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-faint)] mb-2">
                    Problem Space Details
                  </p>
                  <p className="text-[var(--text-primary)] font-medium mb-2">
                    {selectedProblem.title}
                  </p>
                  {selectedProblem.description && (
                    <p className="mb-2">{selectedProblem.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedProblem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[10px] rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Workspace File Name <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={workspaceTitle}
                  onChange={(event) => setWorkspaceTitle(event.target.value)}
                  placeholder="e.g., exploration-notes"
                  className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
                  required
                />
                <p className="text-[10px] text-[var(--text-faint)] mt-1">
                  This creates a markdown file inside the selected problem.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
                  Folder (optional)
                </label>
                <input
                  type="text"
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="e.g., notes/geometry"
                  className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
                />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Workspace File"}
                </button>
                <Link href="/dashboard" className="btn btn-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
