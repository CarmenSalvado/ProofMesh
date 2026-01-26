"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getTeams,
  createTeam,
  Team,
} from "@/lib/api";
import { NotificationsDropdown } from "@/components/social";
import {
  Search,
  Plus,
  ChevronDown,
  Users,
  Lock,
  Globe,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function TeamsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [publicTeams, setPublicTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
    is_public: true,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [myTeamsData, publicTeamsData] = await Promise.all([
        getTeams({ my_teams: true, limit: 50 }),
        getTeams({ is_public: true, limit: 50 }),
      ]);
      setMyTeams(myTeamsData.teams);
      // Filter out teams that user is already a member of
      const myTeamIds = new Set(myTeamsData.teams.map((t) => t.id));
      setPublicTeams(publicTeamsData.teams.filter((t) => !myTeamIds.has(t.id)));
    } catch (err) {
      console.error("Failed to load teams", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.slug) return;

    setCreating(true);
    try {
      const newTeam = await createTeam({
        name: createForm.name,
        slug: createForm.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        description: createForm.description || undefined,
        is_public: createForm.is_public,
      });
      setMyTeams((prev) => [newTeam, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ name: "", slug: "", description: "", is_public: true });
    } catch (err) {
      console.error("Failed to create team", err);
    } finally {
      setCreating(false);
    }
  };

  const handleNameChange = (name: string) => {
    setCreateForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    }));
  };

  const filteredMyTeams = myTeams.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPublicTeams = publicTeams.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
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
      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-6 h-6 bg-neutral-900 rounded-md flex items-center justify-center text-white group-hover:bg-indigo-600 transition-colors">
                <TrendingUp className="w-3 h-3" />
              </div>
              <span className="text-sm font-bold tracking-tight">ProofMesh</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsDropdown />
            <div className="h-4 w-px bg-neutral-200 mx-1" />
            <button className="flex items-center gap-2 group">
              <div className="w-6 h-6 rounded-full bg-indigo-100 border border-neutral-200 group-hover:border-indigo-500 transition-colors flex items-center justify-center text-[10px] font-bold text-indigo-700">
                {getInitials(user.username)}
              </div>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Teams</h1>
              <p className="text-sm text-neutral-500">Collaborate with other researchers</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Team
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams..."
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* My Teams */}
            <section className="mb-12">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Your Teams</h2>
              {filteredMyTeams.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                  <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <h3 className="text-base font-medium text-neutral-900 mb-2">No teams yet</h3>
                  <p className="text-sm text-neutral-500 mb-4">
                    Create a team to start collaborating with other researchers.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first team
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMyTeams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {team.avatar_url ? (
                          <img
                            src={team.avatar_url}
                            alt={team.name}
                            className="w-10 h-10 rounded-lg bg-neutral-100"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                            {getInitials(team.name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-indigo-600 truncate">
                              {team.name}
                            </h3>
                            {!team.is_public && <Lock className="w-3 h-3 text-neutral-400" />}
                          </div>
                          <p className="text-xs text-neutral-500">@{team.slug}</p>
                        </div>
                      </div>
                      {team.description && (
                        <p className="text-xs text-neutral-600 line-clamp-2 mb-3">
                          {team.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {team.member_count} members
                        </span>
                        <span>{team.problem_count} problems</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Discover Teams */}
            <section>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Discover Teams</h2>
              {filteredPublicTeams.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
                  <Globe className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">No public teams to discover yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPublicTeams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="bg-white rounded-xl border border-neutral-200 p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        {team.avatar_url ? (
                          <img
                            src={team.avatar_url}
                            alt={team.name}
                            className="w-10 h-10 rounded-lg bg-neutral-100"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-sm font-bold text-neutral-600">
                            {getInitials(team.name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-indigo-600 truncate">
                            {team.name}
                          </h3>
                          <p className="text-xs text-neutral-500">@{team.slug}</p>
                        </div>
                      </div>
                      {team.description && (
                        <p className="text-xs text-neutral-600 line-clamp-2 mb-3">
                          {team.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {team.member_count} members
                        </span>
                        <span>{team.problem_count} problems</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">Create a Team</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Research Group"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Team Slug
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-neutral-500">proofmesh.dev/teams/</span>
                  <input
                    type="text"
                    value={createForm.slug}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, slug: e.target.value }))
                    }
                    placeholder="my-research-group"
                    className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-neutral-900"
                    required
                    pattern="[a-z0-9-]+"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="What does your team work on?"
                  rows={2}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none bg-white text-neutral-900"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm((prev) => ({ ...prev, is_public: true }))
                  }
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    createForm.is_public
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateForm((prev) => ({ ...prev, is_public: false }))
                  }
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    !createForm.is_public
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Private
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createForm.name || !createForm.slug}
                  className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
