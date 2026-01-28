"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getProblems, Problem, getLibraryItems, LibraryItem } from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  BookOpen,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  Layers,
  FileText,
  Lightbulb,
  Sparkles,
  Code,
  AlertTriangle,
  Calculator,
  StickyNote,
  ExternalLink,
} from "lucide-react";

const KIND_META: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  theorem: { label: "Theorem", icon: BookOpen, color: "text-indigo-600 bg-indigo-50" },
  lemma: { label: "Lemma", icon: Layers, color: "text-purple-600 bg-purple-50" },
  definition: { label: "Definition", icon: FileText, color: "text-emerald-600 bg-emerald-50" },
  claim: { label: "Claim", icon: Lightbulb, color: "text-amber-600 bg-amber-50" },
  idea: { label: "Idea", icon: Sparkles, color: "text-pink-600 bg-pink-50" },
  content: { label: "Content", icon: Code, color: "text-slate-600 bg-slate-50" },
  counterexample: { label: "Counterexample", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  computation: { label: "Computation", icon: Calculator, color: "text-cyan-600 bg-cyan-50" },
  note: { label: "Note", icon: StickyNote, color: "text-neutral-600 bg-neutral-100" },
  resource: { label: "Resource", icon: ExternalLink, color: "text-blue-600 bg-blue-50" },
};

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  verified: { label: "Verified", icon: CheckCircle2, color: "text-emerald-600" },
  proposed: { label: "Proposed", icon: Clock, color: "text-amber-600" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LibraryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      getProblems()
        .then((res) => {
          setProblems(res.problems || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (selectedProblem) {
      setLoadingItems(true);
      getLibraryItems(selectedProblem)
        .then((res) => {
          setLibraryItems(res.items || []);
          setLoadingItems(false);
        })
        .catch(() => setLoadingItems(false));
    } else {
      setLibraryItems([]);
    }
  }, [selectedProblem]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const filteredItems = libraryItems.filter((item) => {
    const matchesSearch =
      searchQuery === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesKind = kindFilter === "all" || item.kind === kindFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesKind && matchesStatus;
  });

  const itemsByKind = libraryItems.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <DashboardNavbar />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-6xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Library</h1>
                <p className="text-sm text-neutral-500">
                  Browse and search verified theorems, lemmas, and definitions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-neutral-500 mb-2">
                  Select Problem
                </label>
                <select
                  value={selectedProblem || ""}
                  onChange={(e) => setSelectedProblem(e.target.value || null)}
                  className="w-full max-w-md px-4 py-2.5 rounded-lg border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Choose a problem...</option>
                  {problems.map((problem) => (
                    <option key={problem.id} value={problem.id}>
                      {problem.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {selectedProblem ? (
          <div className="max-w-6xl mx-auto px-8 py-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search library items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {Object.entries(KIND_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label} {itemsByKind[key] ? `(${itemsByKind[key]})` : ""}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="proposed">Proposed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <div className="text-2xl font-semibold text-neutral-900">{libraryItems.length}</div>
                <div className="text-xs text-neutral-500">Total Items</div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <div className="text-2xl font-semibold text-emerald-600">
                  {libraryItems.filter((i) => i.status === "VERIFIED").length}
                </div>
                <div className="text-xs text-neutral-500">Verified</div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <div className="text-2xl font-semibold text-amber-600">
                  {libraryItems.filter((i) => i.status === "PROPOSED").length}
                </div>
                <div className="text-xs text-neutral-500">Proposed</div>
              </div>
              <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
                <div className="text-2xl font-semibold text-indigo-600">
                  {Object.keys(itemsByKind).length}
                </div>
                <div className="text-xs text-neutral-500">Categories</div>
              </div>
            </div>

            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-neutral-200 shadow-sm">
                <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">
                  {libraryItems.length === 0
                    ? "No library items in this problem yet"
                    : "No items match your filters"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const kindMeta = KIND_META[item.kind] || KIND_META.note;
                  const statusMeta = STATUS_META[item.status] || STATUS_META.proposed;
                  const KindIcon = kindMeta.icon;
                  const StatusIcon = statusMeta.icon;

                  return (
                    <Link
                      key={item.id}
                      href={`/problems/${selectedProblem}`}
                      className="block bg-white rounded-lg border border-neutral-200 p-4 hover:border-neutral-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kindMeta.color}`}>
                          <KindIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium text-neutral-900 truncate">
                              {item.title}
                            </h3>
                            <span className={`flex items-center gap-1 text-xs ${statusMeta.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 line-clamp-2 mb-2">
                            {item.content}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-neutral-400">
                            <span className={`px-2 py-0.5 rounded-full ${kindMeta.color}`}>
                              {kindMeta.label}
                            </span>
                            {item.dependencies.length > 0 && (
                              <span>{item.dependencies.length} dependencies</span>
                            )}
                            <span>Created {formatDate(item.created_at)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-neutral-300" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-8 py-12">
            <div className="text-center py-16 bg-white rounded-xl border border-neutral-200 shadow-sm">
              <BookOpen className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-neutral-900 mb-2">
                Select a Problem
              </h2>
              <p className="text-sm text-neutral-500 max-w-md mx-auto">
                Choose a problem from the dropdown above to browse its library items.
                The library contains verified theorems, lemmas, and definitions.
              </p>
            </div>

            {problems.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-neutral-900 mb-4">Your Problems</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {problems.slice(0, 6).map((problem) => (
                    <button
                      key={problem.id}
                      onClick={() => setSelectedProblem(problem.id)}
                      className="text-left bg-white rounded-lg border border-neutral-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
                    >
                      <h4 className="text-sm font-medium text-neutral-900 truncate mb-1">
                        {problem.title}
                      </h4>
                      <p className="text-xs text-neutral-500">
                        {problem.library_item_count} library items
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
