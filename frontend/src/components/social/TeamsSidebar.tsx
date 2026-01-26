"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, Lock, Globe, ChevronRight } from "lucide-react";
import { getTeams, Team, createTeam } from "@/lib/api";

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

interface TeamsSidebarProps {
  className?: string;
}

export function TeamsSidebar({ className = "" }: TeamsSidebarProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
    is_public: true,
  });
  const [creating, setCreating] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeams({ my_teams: true, limit: 10 });
      setTeams(data.teams);
    } catch (err) {
      console.error("Failed to load teams", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setTeams((prev) => [newTeam, ...prev]);
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

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-neutral-900">Your Teams</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-1 hover:bg-neutral-100 rounded text-neutral-500 transition-colors"
          title="Create team"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-900 border-t-transparent" />
        </div>
      ) : teams.length === 0 ? (
        <div className="flex items-center gap-2 p-1.5 text-neutral-400 text-xs">
          <Users className="w-4 h-4" />
          <span>No teams yet</span>
        </div>
      ) : (
        <div className="space-y-1">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.slug}`}
              className="flex items-center gap-2 p-2 hover:bg-white rounded-md group transition-all border border-transparent hover:border-neutral-200 hover:shadow-sm"
            >
              {team.avatar_url ? (
                <img
                  src={team.avatar_url}
                  alt={team.name}
                  className="w-5 h-5 rounded bg-neutral-100"
                />
              ) : (
                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700">
                  {getInitials(team.name)}
                </div>
              )}
              <span className="text-sm font-medium text-neutral-700 group-hover:text-indigo-600 truncate flex-1">
                {team.name}
              </span>
              {!team.is_public && <Lock className="w-3 h-3 text-neutral-400" />}
            </Link>
          ))}
          {teams.length >= 10 && (
            <Link
              href="/teams"
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-indigo-600 ml-2 mt-2"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">Create a Team</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600"
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
                <div className="flex items-center gap-1 text-sm text-neutral-500">
                  <span>proofmesh.dev/teams/</span>
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
                    setCreateForm((prev) => ({ ...prev, is_public: !prev.is_public }))
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
                    setCreateForm((prev) => ({ ...prev, is_public: !prev.is_public }))
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
