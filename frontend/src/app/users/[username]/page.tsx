"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, MessageSquareReply, MessageSquareText } from "lucide-react";
import {
  getProblems,
  getUserActivity,
  Problem,
  SocialUser,
  Discussion,
  Comment,
} from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";

const PROJECT_LINK_TOKEN_REGEX = /^\[\[project:([^|\]]+)\|([^\]]+)\]\]$/i;

function formatRelativeTime(iso?: string | null) {
  if (!iso) return "just now";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "just now";
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function renderRichSocialText(text: string) {
  const parts = text.split(/(\[\[project:[^\]|]+\|[^\]]+\]\]|@[A-Za-z0-9._-]+)/g);
  return parts.map((part, idx) => {
    if (!part) return null;

    const projectMatch = part.match(PROJECT_LINK_TOKEN_REGEX);
    if (projectMatch) {
      const [, projectId, projectTitle] = projectMatch;
      return (
        <Link
          key={`project-${idx}`}
          href={`/problems/${encodeURIComponent(projectId)}`}
          title={`Open project ${projectTitle}`}
          className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)] transition hover:bg-emerald-100"
        >
          #{projectTitle}
        </Link>
      );
    }

    if (!part.startsWith("@")) return <span key={`text-${idx}`}>{part}</span>;

    const isRho = part.toLowerCase() === "@rho";
    const mentionedUsername = part.slice(1).trim();
    return (
      <Link
        key={`mention-${idx}`}
        href={`/users/${encodeURIComponent(mentionedUsername)}`}
        title={`Open profile @${mentionedUsername}`}
        className={
          isRho
            ? "inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.15)] transition hover:bg-violet-200"
            : "inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition hover:bg-indigo-100"
        }
      >
        {part}
      </Link>
    );
  });
}

function UserAvatar({
  username,
  avatarUrl,
  className,
  textClassName,
}: {
  username: string;
  avatarUrl?: string | null;
  className: string;
  textClassName: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${className} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full bg-gradient-to-br from-indigo-100 to-cyan-100 flex items-center justify-center font-bold text-indigo-700`}
    >
      <span className={textClassName}>{username.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const normalizedUsername = username.toLowerCase();

  const [user, setUser] = useState<SocialUser | null>(null);
  const [userProblems, setUserProblems] = useState<Problem[]>([]);
  const [userDiscussions, setUserDiscussions] = useState<Discussion[]>([]);
  const [userComments, setUserComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        setLoading(true);
        const [activityData, problemsData] = await Promise.all([
          getUserActivity(username, { discussions_limit: 50, comments_limit: 50 }),
          getProblems(),
        ]);

        setUser(activityData.user);
        setUserDiscussions(activityData.discussions);
        setUserComments(activityData.comments);
        setUserProblems(
          problemsData.problems.filter(
            (problem) => problem.author.username.toLowerCase() === normalizedUsername
          )
        );
      } catch (err) {
        setError("Failed to load user profile");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (username) {
      loadUserData();
    }
  }, [username, normalizedUsername]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-white">
        <DashboardNavbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">User Not Found</h1>
            <p className="text-neutral-500">The user @{username} does not exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <DashboardNavbar />

      <div className="border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start gap-6">
            <UserAvatar
              username={user.username}
              avatarUrl={user.avatar_url}
              className="w-24 h-24"
              textClassName="text-3xl"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-neutral-900">{user.username}</h1>
              <p className="text-neutral-500">@{user.username.toLowerCase()}</p>
              {user.bio && <p className="mt-3 text-neutral-700">{user.bio}</p>}
              <div className="flex items-center gap-6 mt-4 text-sm text-neutral-600">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {userProblems.length} publications
                </span>
                <span className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4" />
                  {userDiscussions.length} posts
                </span>
                <span className="flex items-center gap-2">
                  <MessageSquareReply className="w-4 h-4" />
                  {userComments.length} replies
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Publications</h2>
          {userProblems.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 rounded-lg text-neutral-500">
              No publications yet
            </div>
          ) : (
            <div className="space-y-3">
              {userProblems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.id}`}
                  className="block p-4 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <UserAvatar
                      username={problem.author.username}
                      avatarUrl={problem.author.avatar_url}
                      className="w-6 h-6"
                      textClassName="text-[10px]"
                    />
                    <span className="text-xs text-neutral-500">@{problem.author.username}</span>
                  </div>
                  <h3 className="font-medium text-neutral-900">{problem.title}</h3>
                  <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                    {problem.description || "No description"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Posts</h2>
          {userDiscussions.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 rounded-lg text-neutral-500">
              No posts yet
            </div>
          ) : (
            <div className="space-y-3">
              {userDiscussions.map((discussion) => (
                <div
                  key={discussion.id}
                  className="p-4 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <UserAvatar
                      username={discussion.author.username}
                      avatarUrl={discussion.author.avatar_url}
                      className="w-6 h-6"
                      textClassName="text-[10px]"
                    />
                    <span className="text-xs text-neutral-500">@{discussion.author.username}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={`/discussions/${discussion.id}`}
                      className="font-medium text-neutral-900 hover:text-indigo-700"
                    >
                      {discussion.title}
                    </Link>
                    <span className="text-xs text-neutral-400 whitespace-nowrap">
                      {formatRelativeTime(discussion.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2 line-clamp-2 leading-6">
                    {renderRichSocialText(discussion.content)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-2">
                    {discussion.comment_count} replies
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Replies</h2>
          {userComments.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 rounded-lg text-neutral-500">
              No replies yet
            </div>
          ) : (
            <div className="space-y-3">
              {userComments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-4 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <UserAvatar
                      username={comment.author.username}
                      avatarUrl={comment.author.avatar_url}
                      className="w-6 h-6"
                      textClassName="text-[10px]"
                    />
                    <span className="text-xs text-neutral-500">@{comment.author.username}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={`/discussions/${comment.discussion_id}`}
                      className="text-sm font-medium text-neutral-900 hover:text-indigo-700"
                    >
                      {comment.discussion_title || "Discussion"}
                    </Link>
                    <span className="text-xs text-neutral-400 whitespace-nowrap">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2 line-clamp-3 leading-6">
                    {renderRichSocialText(comment.content)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
