"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getTeam,
  updateTeam,
  deleteTeam,
  inviteTeamMember,
  removeTeamMember,
  leaveTeam,
  getProblems,
  addTeamProblem,
  removeTeamProblem,
  getSocialUsers,
  TeamDetail,
  Problem,
  SocialUser,
  TeamRole,
} from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  Users,
  Lock,
  Globe,
  Settings,
  UserPlus,
  Trash2,
  LogOut,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Shield,
  Crown,
  X,
} from "lucide-react";

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const ROLE_ICONS: Record<TeamRole, React.ReactNode> = {
  owner: <Crown className="w-3 h-3 text-yellow-600" />,
  admin: <Shield className="w-3 h-3 text-indigo-600" />,
  member: null,
};

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export default function TeamDetailPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddProblemModal, setShowAddProblemModal] = useState(false);

  // User's role in the team
  const [userRole, setUserRole] = useState<TeamRole | null>(null);

  // Invite modal state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [inviting, setInviting] = useState(false);

  // Settings modal state
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    is_public: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add problem modal state
  const [userProblems, setUserProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadTeam = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getTeam(slug);
      setTeam(data);

      // Find user's role
      if (user) {
        const member = data.members.find((m) => m.user.id === user.id);
        setUserRole(member ? (member.role as TeamRole) : null);
      }

      // Initialize settings form
      setSettingsForm({
        name: data.name,
        description: data.description || "",
        is_public: data.is_public,
      });
    } catch (err) {
      console.error("Failed to load team", err);
      setError("Team not found");
    } finally {
      setLoading(false);
    }
  }, [slug, user]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await getSocialUsers({ q: query, limit: 10 });
      // Filter out existing members
      const memberIds = new Set(team?.members.map((m) => m.user.id));
      setSearchResults(data.users.filter((u) => !memberIds.has(u.id)));
    } catch (err) {
      console.error("Search failed", err);
    }
  };

  const handleInvite = async (userId: string) => {
    if (!team) return;
    setInviting(true);
    try {
      await inviteTeamMember(team.slug, { user_id: userId, role: inviteRole });
      await loadTeam();
      setShowInviteModal(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      console.error("Invite failed", err);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!team || !confirm("Remove this member from the team?")) return;
    try {
      await removeTeamMember(team.slug, userId);
      await loadTeam();
    } catch (err) {
      console.error("Remove member failed", err);
    }
  };

  const handleLeave = async () => {
    if (!team || !confirm("Are you sure you want to leave this team?")) return;
    try {
      await leaveTeam(team.slug);
      router.push("/teams");
    } catch (err) {
      console.error("Leave failed", err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    setSaving(true);
    try {
      await updateTeam(team.slug, {
        name: settingsForm.name,
        description: settingsForm.description || undefined,
        is_public: settingsForm.is_public,
      });
      await loadTeam();
      setShowSettingsModal(false);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!team || !confirm("Are you sure you want to delete this team? This cannot be undone."))
      return;
    setDeleting(true);
    try {
      await deleteTeam(team.slug);
      router.push("/teams");
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenAddProblem = async () => {
    setShowAddProblemModal(true);
    setLoadingProblems(true);
    try {
      const data = await getProblems({ mine: true });
      setUserProblems(data.problems);
    } catch (err) {
      console.error("Failed to load problems", err);
    } finally {
      setLoadingProblems(false);
    }
  };

  const handleAddProblem = async (problemId: string) => {
    if (!team) return;
    try {
      await addTeamProblem(team.slug, problemId);
      await loadTeam();
      setShowAddProblemModal(false);
    } catch (err) {
      console.error("Add problem failed", err);
    }
  };

  const canManage = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50">
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Team not found</h1>
        <p className="text-neutral-500 mb-4">
          This team doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Link href="/teams" className="text-indigo-600 hover:text-indigo-700 font-medium">
          ← Back to Teams
        </Link>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <DashboardNavbar />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-4">
            {team.avatar_url ? (
              <img
                src={team.avatar_url}
                alt={team.name}
                className="w-16 h-16 rounded-xl bg-neutral-100"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700">
                {getInitials(team.name)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-neutral-900">{team.name}</h1>
                {!team.is_public && <Lock className="w-4 h-4 text-neutral-400" />}
              </div>
              <p className="text-sm text-neutral-500 mb-2">@{team.slug}</p>
              {team.description && (
                <p className="text-sm text-neutral-600 max-w-md">{team.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userRole && userRole !== "owner" && (
              <button
                onClick={handleLeave}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Leave
              </button>
            )}
            {canManage && (
              <>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite
                </button>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Members */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900">
                  Members ({team.members.length})
                </h2>
              </div>
              <div className="divide-y divide-neutral-100">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-neutral-50"
                  >
                    <div className="flex items-center gap-3">
                      {member.user.avatar_url ? (
                        <img
                          src={member.user.avatar_url}
                          alt={`${member.user.username} avatar`}
                          className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                          {getInitials(member.user.username)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-neutral-900">
                            {member.user.username}
                          </span>
                          {ROLE_ICONS[member.role as TeamRole]}
                        </div>
                        <span className="text-xs text-neutral-500">
                          {ROLE_LABELS[member.role as TeamRole]}
                        </span>
                      </div>
                    </div>
                    {canManage && member.role !== "owner" && member.user.id !== user.id && (
                      <button
                        onClick={() => handleRemoveMember(member.user.id)}
                        className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Problems */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900">
                  Team Problems ({team.problem_count})
                </h2>
                {userRole && (
                  <button
                    onClick={handleOpenAddProblem}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <Plus className="w-3 h-3" />
                    Add Problem
                  </button>
                )}
              </div>
              <div className="p-4">
                {team.problem_count === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                    <p className="text-sm text-neutral-500 mb-3">
                      No problems added to this team yet.
                    </p>
                    {userRole && (
                      <button
                        onClick={handleOpenAddProblem}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Add your first problem
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Team problems will be displayed here.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">Invite Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Search users
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-neutral-900"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      className="px-3 py-2 flex items-center justify-between hover:bg-neutral-50"
                    >
                      <div className="flex items-center gap-2">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={`${u.username} avatar`}
                            className="w-7 h-7 rounded-full object-cover border border-neutral-200"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                            {getInitials(u.username)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-neutral-900">{u.username}</span>
                      </div>
                      <button
                        onClick={() => handleInvite(u.id)}
                        disabled={inviting}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                      >
                        {inviting ? "..." : "Invite"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Role</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole("member")}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      inviteRole === "member"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRole("admin")}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      inviteRole === "admin"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">Team Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  value={settingsForm.description}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none bg-white text-neutral-900"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSettingsForm((prev) => ({ ...prev, is_public: true }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    settingsForm.is_public
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsForm((prev) => ({ ...prev, is_public: false }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    !settingsForm.is_public
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600"
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Private
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? "Deleting..." : "Delete Team"}
                  </button>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddProblemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">Add Problem</h3>
              <button
                onClick={() => setShowAddProblemModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              {loadingProblems ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
                </div>
              ) : userProblems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-500">You don&apos;t have any problems yet.</p>
                  <Link
                    href="/problems/new"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 mt-2 inline-block"
                  >
                    Create a problem first
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {userProblems.map((problem) => (
                    <button
                      key={problem.id}
                      onClick={() => handleAddProblem(problem.id)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {problem.visibility === "private" ? (
                          <Lock className="w-3 h-3 text-neutral-400" />
                        ) : (
                          <Globe className="w-3 h-3 text-neutral-400" />
                        )}
                        <span className="text-sm font-medium text-neutral-900 truncate">
                          {problem.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
