"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getProblem, getLibraryItems, Problem, LibraryItem } from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import { StarButton } from "@/components/social";
import {
  ArrowLeft,
  BookOpen,
  Layers,
  FileText,
  Lightbulb,
  Sparkles,
  Code,
  AlertTriangle,
  Calculator,
  StickyNote,
  ExternalLink,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  Users,
  FolderOpen,
  LayoutGrid,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

const KIND_META: Record<string, { label: string; icon: typeof BookOpen; color: string; bg: string }> = {
  theorem: { label: "Theorem", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
  lemma: { label: "Lemma", icon: Layers, color: "text-purple-600", bg: "bg-purple-50" },
  definition: { label: "Definition", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50" },
  claim: { label: "Claim", icon: Lightbulb, color: "text-amber-600", bg: "bg-amber-50" },
  idea: { label: "Idea", icon: Sparkles, color: "text-pink-600", bg: "bg-pink-50" },
  content: { label: "Content", icon: Code, color: "text-slate-600", bg: "bg-slate-50" },
  counterexample: { label: "Counterexample", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  computation: { label: "Computation", icon: Calculator, color: "text-cyan-600", bg: "bg-cyan-50" },
  note: { label: "Note", icon: StickyNote, color: "text-neutral-600", bg: "bg-neutral-100" },
  resource: { label: "Resource", icon: ExternalLink, color: "text-blue-600", bg: "bg-blue-50" },
};

export default function ProblemPage({ params }: PageProps) {
  const { isLoading: authLoading } = useAuth();
  const { id: problemId } = use(params);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupedItems = useMemo(() => {
    const groups = {
      resources: [] as LibraryItem[],
      ideas: [] as LibraryItem[],
      lemmas: [] as LibraryItem[],
      contents: [] as LibraryItem[],
    };
    libraryItems.forEach((item) => {
      if (item.kind === "RESOURCE") {
        groups.resources.push(item);
      } else if (item.kind === "IDEA") {
        groups.ideas.push(item);
      } else if (["LEMMA", "THEOREM", "CLAIM", "COUNTEREXAMPLE"].includes(item.kind)) {
        groups.lemmas.push(item);
      } else {
        groups.contents.push(item);
      }
    });
    return groups;
  }, [libraryItems]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const problemData = await getProblem(problemId, { suppressErrorLog: true });
      const libraryData = await getLibraryItems(problemId, undefined, { suppressErrorLog: true });

      setProblem(problemData);
      setLibraryItems(libraryData.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load problem";
      if (message.includes("HTTP 404")) {
        setError("Problem not found.");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    if (problemId) {
      loadData();
    }
  }, [problemId, loadData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <DashboardNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-medium text-neutral-900 mb-2">Error</h1>
            <p className="text-sm text-neutral-500 mb-4">{error}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!problem) return null;

  const sectionData = [
    { key: "resources", label: "Resources", icon: ExternalLink, color: "text-blue-600", bg: "bg-blue-50" },
    { key: "ideas", label: "Ideas", icon: Sparkles, color: "text-pink-600", bg: "bg-pink-50" },
    { key: "lemmas", label: "Lemmas & Theorems", icon: Layers, color: "text-purple-600", bg: "bg-purple-50" },
    { key: "contents", label: "Other Content", icon: Code, color: "text-slate-600", bg: "bg-slate-50" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <DashboardNavbar />

      <div className="flex-1 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-6xl mx-auto px-8 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Problems
              </Link>
              <span className="text-neutral-300">/</span>
              <span className="text-neutral-900 font-medium truncate max-w-md">
                {problem.title}
              </span>
            </div>
          </div>
        </div>

        {/* Problem Header */}
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="font-serif text-2xl text-indigo-600">∑</span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
                  {problem.title}
                </h1>
                {problem.description && (
                  <p className="text-sm text-neutral-500">{problem.description}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-medium text-neutral-600">
                  {problem.author.username.slice(0, 2).toUpperCase()}
                </div>
                <span>{problem.author.username}</span>
              </div>
              <span className="text-neutral-300">·</span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {problem.library_item_count} library items
              </span>
              <span className="text-neutral-300">·</span>
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                problem.visibility === "public"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-neutral-100 text-neutral-600"
              }`}>
                {problem.visibility === "public" ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                {problem.visibility}
              </span>
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                (problem.access_level || "viewer") === "owner"
                  ? "bg-indigo-50 text-indigo-600"
                  : (problem.access_level || "viewer") === "admin"
                  ? "bg-blue-50 text-blue-600"
                  : (problem.access_level || "viewer") === "editor"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-neutral-100 text-neutral-600"
              }`}>
                <Users className="w-3.5 h-3.5" />
                access: {problem.access_level || (problem.can_edit ? "owner" : "viewer")}
              </span>
            </div>

            {problem.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {problem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/problems/${problemId}/lab`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Open Workspace Files
              </Link>
              <Link
                href={`/problems/${problemId}/canvas`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                Visual Canvas
              </Link>
              <StarButton
                targetType="problem"
                targetId={problemId}
                starCount={problem.star_count ?? 0}
                size="md"
                showCount={true}
              />
            </div>
          </div>
        </div>

        {/* Problem Space */}
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900">Problem Space</h2>
            <span className="text-sm text-neutral-400">{libraryItems.length} total items</span>
          </div>

          {libraryItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center shadow-sm">
              <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No shared items yet</p>
              <p className="text-xs text-neutral-400 mt-1">
                Open the workspace to start adding content
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 mb-10">
              {sectionData.map((section) => {
                const items = groupedItems[section.key as keyof typeof groupedItems];
                const Icon = section.icon;
                return (
                  <div
                    key={section.key}
                    className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.bg}`}>
                          <Icon className={`w-4 h-4 ${section.color}`} />
                        </div>
                        <h3 className="text-sm font-medium text-neutral-900">{section.label}</h3>
                      </div>
                      <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-neutral-400">No items yet</p>
                    ) : (
                      <div className="space-y-2">
                        {items.slice(0, 4).map((item) => {
                          const meta = KIND_META[item.kind] || KIND_META.note;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-neutral-50 transition-colors"
                            >
                              <span className="truncate text-neutral-700">{item.title}</span>
                              <span className={`text-[10px] uppercase font-medium ${meta.color}`}>
                                {item.kind}
                              </span>
                            </div>
                          );
                        })}
                        {items.length > 4 && (
                          <p className="text-xs text-neutral-400 pl-2">
                            +{items.length - 4} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recent Items */}
          {libraryItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-neutral-900">Recent Updates</h2>
                <span className="text-sm text-neutral-400">{libraryItems.length} items</span>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {libraryItems.slice(0, 6).map((item) => {
                  const meta = KIND_META[item.kind] || KIND_META.note;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-neutral-200 p-4 hover:border-neutral-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400">
                          #{item.id.slice(0, 8)}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-neutral-900 mb-2 line-clamp-2">
                        {item.title}
                      </h4>
                      {item.formula && (
                        <div className="font-mono text-xs text-neutral-600 bg-neutral-50 rounded-lg p-2 mb-3 overflow-x-auto">
                          {item.formula}
                        </div>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          item.status === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {item.status === "VERIFIED" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {item.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
