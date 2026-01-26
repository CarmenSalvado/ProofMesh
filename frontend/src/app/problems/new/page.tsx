"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { createProblem } from "@/lib/api";
import {
  Globe,
  Lock,
  FileText,
  Zap,
  Upload,
  Check,
  X,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";

export default function NewProblemPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "">("medium");
  const [template, setTemplate] = useState<"empty" | "induction" | "import">("empty");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Proof name is required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const problem = await createProblem({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        difficulty: difficulty || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });

      router.push(`/problems/${problem.id}/lab`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create proof");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="w-5 h-5 bg-neutral-900 rounded-sm flex-shrink-0" />
            <span className="text-neutral-300 text-sm">/</span>
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
              {user.username}
            </div>
            <span className="text-neutral-300 text-sm">/</span>
            <span className="text-sm font-semibold tracking-tight">New Proof</span>
          </div>
          <Link
            href="/dashboard"
            className="text-[10px] font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow pt-28 pb-20 px-4 relative">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-40 -z-10"
          style={{
            backgroundImage: "radial-gradient(#e5e5e5 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
              Create a new proof
            </h1>
            <p className="text-sm text-neutral-500">
              Initialize a workspace for collaborative logic derivation.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Proof Name Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-900">Proof Name</label>
                <div className="flex shadow-sm rounded-md transition-shadow focus-within:ring-2 focus-within:ring-neutral-900 focus-within:ring-offset-1">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-neutral-200 bg-neutral-50 text-neutral-500 text-xs font-mono">
                    {user.username} /
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="riemann-hypothesis-v2"
                    className="flex-1 block w-full rounded-none rounded-r-md border border-neutral-200 bg-white text-neutral-900 py-2 px-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-300"
                    required
                  />
                </div>
              </div>
            </div>

            <hr className="border-neutral-100" />

            {/* Description Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-900">
                  Description <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe your proof goals and context..."
                  rows={3}
                  className="block w-full rounded-md border border-neutral-200 bg-white text-neutral-900 py-2 px-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 resize-none"
                />
              </div>
            </div>

            <hr className="border-neutral-100" />

            {/* Visibility Section */}
            <div className="space-y-4">
              <label className="text-xs font-semibold text-neutral-900">Visibility</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Public Option */}
                <label className="relative cursor-pointer group">
                  <input
                    type="radio"
                    name="visibility"
                    className="peer sr-only"
                    checked={visibility === "public"}
                    onChange={() => setVisibility("public")}
                  />
                  <div className="p-4 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-all bg-white group-hover:shadow-sm peer-checked:border-neutral-900 peer-checked:bg-neutral-50">
                    <div className="flex items-start justify-between mb-1">
                      <Globe className="w-5 h-5 text-neutral-600" />
                      <div className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] opacity-0 peer-checked:opacity-100 transition-all scale-75 peer-checked:scale-100">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <span className="block text-sm font-medium text-neutral-900">Public</span>
                    <span className="block text-xs text-neutral-500 mt-1">
                      Anyone can view. Only team members can edit.
                    </span>
                  </div>
                </label>

                {/* Private Option */}
                <label className="relative cursor-pointer group">
                  <input
                    type="radio"
                    name="visibility"
                    className="peer sr-only"
                    checked={visibility === "private"}
                    onChange={() => setVisibility("private")}
                  />
                  <div className="p-4 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-all bg-white group-hover:shadow-sm peer-checked:border-neutral-900 peer-checked:bg-neutral-50">
                    <div className="flex items-start justify-between mb-1">
                      <Lock className="w-5 h-5 text-neutral-600" />
                      <div className="w-4 h-4 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] opacity-0 peer-checked:opacity-100 transition-all scale-75 peer-checked:scale-100">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    </div>
                    <span className="block text-sm font-medium text-neutral-900">Private</span>
                    <span className="block text-xs text-neutral-500 mt-1">
                      Access limited to invited collaborators.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <hr className="border-neutral-100" />

            {/* Template Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-900">Starting Template</label>
                <button
                  type="button"
                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                >
                  Browse all templates <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Empty */}
                <label className="relative cursor-pointer group">
                  <input
                    type="radio"
                    name="template"
                    className="peer sr-only"
                    checked={template === "empty"}
                    onChange={() => setTemplate("empty")}
                  />
                  <div className="h-32 rounded-lg border border-neutral-200 hover:border-neutral-300 bg-white flex flex-col items-center justify-center gap-3 transition-all group-hover:shadow-sm peer-checked:border-neutral-900 peer-checked:bg-neutral-50">
                    <div className="w-8 h-8 rounded bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-neutral-700">Empty Canvas</span>
                    <div className="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 transition-all scale-75 peer-checked:scale-100 text-neutral-900">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                </label>

                {/* Induction */}
                <label className="relative cursor-pointer group">
                  <input
                    type="radio"
                    name="template"
                    className="peer sr-only"
                    checked={template === "induction"}
                    onChange={() => setTemplate("induction")}
                  />
                  <div className="h-32 rounded-lg border border-neutral-200 hover:border-neutral-300 bg-white flex flex-col items-center justify-center gap-3 transition-all group-hover:shadow-sm peer-checked:border-neutral-900 peer-checked:bg-neutral-50">
                    <div className="w-8 h-8 rounded bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-neutral-700">Induction</span>
                    <div className="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 transition-all scale-75 peer-checked:scale-100 text-neutral-900">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                </label>

                {/* Import */}
                <label className="relative cursor-pointer group">
                  <input
                    type="radio"
                    name="template"
                    className="peer sr-only"
                    checked={template === "import"}
                    onChange={() => setTemplate("import")}
                  />
                  <div className="h-32 rounded-lg border border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50 hover:bg-neutral-100 flex flex-col items-center justify-center gap-3 transition-all peer-checked:border-neutral-900 peer-checked:bg-neutral-100">
                    <div className="w-8 h-8 rounded bg-white border border-neutral-200 flex items-center justify-center text-neutral-500">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-neutral-700">Import .tex</span>
                    <div className="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 transition-all scale-75 peer-checked:scale-100 text-neutral-900">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <hr className="border-neutral-100" />

            {/* Tags Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-900">
                  Tags <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="number-theory, analysis, topology"
                  className="block w-full rounded-md border border-neutral-200 bg-white text-neutral-900 py-2 px-3 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1"
                />
                <p className="text-[10px] text-neutral-400">
                  Separate with commas. Helps others discover your work.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-6 flex items-center justify-end gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Back to dashboard
              </Link>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="px-5 py-2.5 bg-neutral-900 text-white text-xs font-medium rounded-md hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-900/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Proof"}
                <span className="text-neutral-500">|</span>
                <span className="font-mono text-[10px] text-neutral-400 flex items-center gap-0.5">
                  <CornerDownLeft className="w-2.5 h-2.5" /> Enter
                </span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100 py-6 mt-auto bg-white">
        <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
          <div className="text-[10px] text-neutral-400">
            <span className="font-semibold text-neutral-500">Tip:</span> You can reference other
            proofs using{" "}
            <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-600 font-mono">
              @proof-name
            </code>{" "}
            in comments.
          </div>
          <div className="flex gap-4 text-[10px] text-neutral-400">
            <Link href="#" className="hover:text-neutral-600">
              Documentation
            </Link>
            <Link href="#" className="hover:text-neutral-600">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
