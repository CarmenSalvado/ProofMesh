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
                <Link
                  key={discussion.id}
                  href={`/discussions/${discussion.id}`}
                  className="block p-4 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
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
                    <h3 className="font-medium text-neutral-900">{discussion.title}</h3>
                    <span className="text-xs text-neutral-400 whitespace-nowrap">
                      {formatRelativeTime(discussion.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{discussion.content}</p>
                  <p className="text-xs text-neutral-500 mt-2">
                    {discussion.comment_count} replies
                  </p>
                </Link>
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
                <Link
                  key={comment.id}
                  href={`/discussions/${comment.discussion_id}`}
                  className="block p-4 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
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
                    <p className="text-sm font-medium text-neutral-900">
                      {comment.discussion_title || "Discussion"}
                    </p>
                    <span className="text-xs text-neutral-400 whitespace-nowrap">
                      {formatRelativeTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2 line-clamp-3">{comment.content}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
