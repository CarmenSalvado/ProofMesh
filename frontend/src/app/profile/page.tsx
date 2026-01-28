"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getProblems, Problem, getSocialConnections, SocialConnectionsResponse } from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  Mail,
  Calendar,
  BookOpen,
  Star,
  Settings,
  Globe,
  Lock,
  ExternalLink,
} from "lucide-react";

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [connections, setConnections] = useState<SocialConnectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"problems" | "starred">("problems");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      Promise.all([
        getProblems().catch(() => ({ problems: [] })),
        getSocialConnections().catch(() => ({ followers: [], following: [], total_followers: 0, total_following: 0 })),
      ]).then(([problemsRes, connectionsRes]) => {
        setProblems(problemsRes.problems || []);
        setConnections(connectionsRes);
        setLoading(false);
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const totalStars = problems.reduce((acc, p) => acc + (p.library_item_count || 0), 0);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <DashboardNavbar />

      <div className="flex-1 overflow-y-auto">
        {/* Profile Header */}
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-4xl mx-auto px-8 py-8">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-indigo-100 border-4 border-white shadow-lg flex items-center justify-center text-2xl font-bold text-indigo-700">
                {getInitials(user.username)}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-2xl font-semibold text-neutral-900">{user.username}</h1>
                  <Link
                    href="/settings"
                    className="text-xs font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-1 px-3 py-1.5 rounded-md border border-neutral-200 hover:border-neutral-300 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Edit Profile
                  </Link>
                </div>

                <div className="flex items-center gap-4 text-sm text-neutral-500 mb-4">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Member
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xl font-semibold text-neutral-900">{problems.length}</div>
                    <div className="text-xs text-neutral-500">Problems</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-neutral-900">{connections?.total_followers || 0}</div>
                    <div className="text-xs text-neutral-500">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-neutral-900">{connections?.total_following || 0}</div>
                    <div className="text-xs text-neutral-500">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-indigo-600">{totalStars}</div>
                    <div className="text-xs text-neutral-500">Library Items</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-4xl mx-auto px-8">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("problems")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "problems"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <BookOpen className="w-4 h-4 inline-block mr-2" />
                Problems
              </button>
              <button
                onClick={() => setActiveTab("starred")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "starred"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <Star className="w-4 h-4 inline-block mr-2" />
                Starred
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : activeTab === "problems" ? (
            <div className="space-y-3">
              {problems.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
                  <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 mb-4">No problems yet</p>
                  <Link
                    href="/problems/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Create your first problem
                  </Link>
                </div>
              ) : (
                problems.map((problem) => (
                  <Link
                    key={problem.id}
                    href={`/problems/${problem.id}`}
                    className="block bg-white rounded-lg border border-neutral-200 p-4 hover:border-neutral-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {problem.visibility === "private" ? (
                            <Lock className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <Globe className="w-4 h-4 text-neutral-400" />
                          )}
                          <h3 className="text-sm font-medium text-neutral-900 truncate">
                            {problem.title}
                          </h3>
                        </div>
                        {problem.description && (
                          <p className="text-xs text-neutral-500 line-clamp-2 mb-2">
                            {problem.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-neutral-400">
                          {problem.difficulty && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              problem.difficulty === "easy" ? "bg-emerald-50 text-emerald-700" :
                              problem.difficulty === "medium" ? "bg-amber-50 text-amber-700" :
                              "bg-red-50 text-red-700"
                            }`}>
                              {problem.difficulty}
                            </span>
                          )}
                          <span>{problem.library_item_count} items</span>
                          <span>Updated {formatDate(problem.updated_at)}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-neutral-300" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
              <Star className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No starred items yet</p>
              <p className="text-xs text-neutral-400 mt-1">
                Star problems and library items to save them here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
