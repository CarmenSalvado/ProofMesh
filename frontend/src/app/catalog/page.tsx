"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getProblems, Problem, getTrendingProblems, TrendingProblem, seedProblems } from "@/lib/api";
import {
  TeamsSidebar,
  DiscussionsSidebar,
} from "@/components/social";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  Plus,
  Star,
  BookOpen,
  Lock,
  Globe,
  Sparkles,
  RefreshCw,
  Tag,
  TrendingUp,
  Grid3x3,
  List,
} from "lucide-react";

function formatRelativeTime(iso?: string | null) {
  if (!iso) return "just now";
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

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CatalogPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [trending, setTrending] = useState<TrendingProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [seeding, setSeeding] = useState(false);
  const lastSearchParam = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const queryParam = searchParams.get("q") ?? "";
    if (lastSearchParam.current === queryParam) return;
    lastSearchParam.current = queryParam;
    setSearchQuery(queryParam);
  }, [searchParams]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [problemsData, trendingData] = await Promise.all([
        getProblems({ visibility: "public" }),
        getTrendingProblems(10),
      ]);
      setProblems(problemsData.problems);
      setTrending(trendingData.problems);
    } catch (err) {
      console.error("Failed to load catalog data", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await seedProblems();
      await loadData();
    } catch (err) {
      console.error("Failed to seed problems:", err);
    } finally {
      setSeeding(false);
    }
  };

  const filteredProblems = problems.filter(
    (p) => {
      const matchesSearch = 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesDifficulty = selectedDifficulty === "all" || p.difficulty === selectedDifficulty;
      
      return matchesSearch && matchesDifficulty;
    }
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <DashboardNavbar />

      {/* Main Content Grid */}
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Sidebar */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3 space-y-6">
          {/* User Context */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.username} avatar`}
                  className="w-10 h-10 rounded-full object-cover border border-neutral-100"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 border border-neutral-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                  {getInitials(user.username)}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-neutral-900">{user.username}</div>
                <div className="text-xs text-neutral-500">@{user.username.toLowerCase()}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 py-3 border-t border-neutral-100">
              <div className="text-center">
                <div className="text-xs text-neutral-500">Public</div>
                <div className="text-sm font-semibold text-neutral-900">{problems.length}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-neutral-500">Trending</div>
                <div className="text-sm font-semibold text-indigo-600">{trending.length}</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-neutral-900 mb-3">Navigation</h3>
            <div className="space-y-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-md transition-colors"
              >
                <BookOpen className="w-4 h-4 text-neutral-400" />
                Dashboard
              </Link>
              <Link
                href="/catalog"
                className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 bg-indigo-50 rounded-md font-medium"
              >
                <BookOpen className="w-4 h-4" />
                Catalog
              </Link>
              <Link
                href="/problems/new"
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4 text-neutral-400" />
                New Problem
              </Link>
            </div>
          </div>

          {/* Trending Problems */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-semibold text-neutral-900">Trending</h3>
            </div>
            <div className="space-y-2">
              {trending.slice(0, 5).map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.id}`}
                  className="block p-2 hover:bg-neutral-50 rounded-md transition-colors group"
                >
                  <div className="text-sm font-medium text-neutral-700 group-hover:text-indigo-600 truncate">
                    {problem.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                    <span>{problem.author.username}</span>
                    <span>·</span>
                    <span>{problem.star_count} stars</span>
                  </div>
                </Link>
              ))}
              {trending.length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-4">No trending problems yet</p>
              )}
            </div>
          </div>

          {/* Teams */}
          <TeamsSidebar />
        </aside>

        {/* Center: Problem Catalog */}
        <main className="col-span-1 md:col-span-9 lg:col-span-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900">Problem Catalog</h1>
              <p className="text-xs text-neutral-500 mt-1">
                Explore {problems.length} public problems from the community
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1 px-3 py-1.5 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <div className="flex border border-neutral-200 rounded-md overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 ${viewMode === "grid" ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-900"}`}
                >
                  <Grid3x3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 ${viewMode === "list" ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-900"}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-700">Difficulty:</span>
                  <div className="flex gap-1">
                    {(["all", "easy", "medium", "hard"] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                          selectedDifficulty === diff
                            ? diff === "easy"
                              ? "bg-emerald-100 text-emerald-700"
                              : diff === "medium"
                                ? "bg-amber-100 text-amber-700"
                                : diff === "hard"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-neutral-900 text-white"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                      >
                        {diff === "all" ? "All" : diff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-xs text-neutral-500">
                {filteredProblems.length} {filteredProblems.length === 1 ? "problem" : "problems"}
              </div>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center shadow-sm">
              <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-neutral-900 mb-2">No problems found</h3>
              <p className="text-xs text-neutral-500 mb-4">
                {searchQuery || selectedDifficulty !== "all"
                  ? "Try adjusting your filters or search query"
                  : "No public problems available yet"}
              </p>
              {!searchQuery && selectedDifficulty === "all" && (
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-4 py-2 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {seeding ? "Adding samples..." : "Add sample problems"}
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProblems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.id}`}
                  className="bg-white rounded-lg border border-neutral-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-neutral-900 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {problem.title}
                      </h3>
                      {problem.description && (
                        <p className="text-xs text-neutral-500 line-clamp-2">
                          {problem.description}
                        </p>
                      )}
                    </div>
                    {problem.difficulty && (
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                          problem.difficulty === "easy"
                            ? "bg-emerald-50 text-emerald-600"
                            : problem.difficulty === "medium"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-red-50 text-red-600"
                        }`}
                      >
                        {problem.difficulty}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-neutral-500 mb-3">
                    <span className="flex items-center gap-1">
                      {problem.author.avatar_url ? (
                        <img
                          src={problem.author.avatar_url}
                          alt={`${problem.author.username} avatar`}
                          className="w-5 h-5 rounded-full object-cover border border-neutral-200"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[9px] font-medium text-neutral-600">
                          {getInitials(problem.author.username)}
                        </div>
                      )}
                      {problem.author.username}
                    </span>
                    <span>·</span>
                    <span>{problem.library_item_count} items</span>
                  </div>

                  {problem.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {problem.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] rounded-full hover:bg-neutral-200 transition-colors"
                        >
                          {tag}
                        </span>
                      ))}
                      {problem.tags.length > 3 && (
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] rounded-full">
                          +{problem.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProblems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.id}`}
                  className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-indigo-600 transition-colors truncate">
                          {problem.title}
                        </h3>
                        {problem.difficulty && (
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                              problem.difficulty === "easy"
                                ? "bg-emerald-50 text-emerald-600"
                                : problem.difficulty === "medium"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-red-50 text-red-600"
                            }`}
                          >
                            {problem.difficulty}
                          </span>
                        )}
                      </div>
                      {problem.description && (
                        <p className="text-xs text-neutral-500 line-clamp-2 mb-2">
                          {problem.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          {problem.author.avatar_url ? (
                            <img
                              src={problem.author.avatar_url}
                              alt={`${problem.author.username} avatar`}
                              className="w-4 h-4 rounded-full object-cover border border-neutral-200"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[8px] font-medium text-neutral-600">
                              {getInitials(problem.author.username)}
                            </div>
                          )}
                          {problem.author.username}
                        </span>
                        <span>·</span>
                        <span>{problem.library_item_count} items</span>
                        {problem.tags.length > 0 && (
                          <>
                            <span>·</span>
                            <div className="flex gap-1.5">
                              {problem.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                              {problem.tags.length > 3 && (
                                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] rounded-full">
                                  +{problem.tags.length - 3}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <Star className="w-4 h-4 text-neutral-300 group-hover:text-amber-400 transition-colors ml-4 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {filteredProblems.length > 0 && (
            <div className="mt-8 text-center">
              <button className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
                Load more problems
              </button>
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 space-y-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-semibold text-neutral-900">Quick Stats</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Total Problems</span>
                <span className="text-sm font-semibold text-neutral-900">{problems.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Trending</span>
                <span className="text-sm font-semibold text-indigo-600">{trending.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Easy</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {problems.filter(p => p.difficulty === "easy").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Medium</span>
                <span className="text-sm font-semibold text-amber-600">
                  {problems.filter(p => p.difficulty === "medium").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Hard</span>
                <span className="text-sm font-semibold text-red-600">
                  {problems.filter(p => p.difficulty === "hard").length}
                </span>
              </div>
            </div>
          </div>

          {/* Popular Tags */}
          <div className="bg-white rounded-lg border border-neutral-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-semibold text-neutral-900">Popular Tags</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {["analysis", "algebra", "geometry", "number-theory", "combinatorics"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="text-xs px-2.5 py-1 bg-neutral-100 text-neutral-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Latest Discussions */}
          <DiscussionsSidebar />

          {/* Footer Links */}
          <div className="pt-4 border-t border-neutral-200 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-neutral-400">
            <Link href="/teams" className="hover:text-neutral-600">
              Teams
            </Link>
            <Link href="/discussions" className="hover:text-neutral-600">
              Discussions
            </Link>
            <Link href="/help" className="hover:text-neutral-600">
              Help
            </Link>
            <Link href="/privacy" className="hover:text-neutral-600">
              Privacy
            </Link>
            <span>© 2026 ProofMesh</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
      <CatalogPageContent />
    </Suspense>
  );
}
