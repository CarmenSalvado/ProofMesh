"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Users, BookOpen, MessageSquare, Star } from "lucide-react";
import { getSocialUsers, getProblems, SocialUser, Problem } from "@/lib/api";

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  
  const [user, setUser] = useState<SocialUser | null>(null);
  const [userProblems, setUserProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        setLoading(true);
        // Search for user in social users
        const usersData = await getSocialUsers({ q: username, limit: 50 });
        const foundUser = usersData.users.find(u => u.username === username);
        
        if (foundUser) {
          setUser(foundUser);
        }
        
        // Get user's problems
        const problemsData = await getProblems();
        // Filter problems by this user (approximation since API doesn't filter by author)
        const filteredProblems = problemsData.problems.filter(
          p => p.author.username === username
        );
        setUserProblems(filteredProblems);
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
  }, [username]);

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
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/social" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </Link>
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
      {/* Header */}
      <div className="border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/social" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </Link>
          
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-3xl font-bold text-indigo-700">
              {username.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-neutral-900">{username}</h1>
              <p className="text-neutral-500">@{username.toLowerCase()}</p>
              {user.bio && (
                <p className="mt-3 text-neutral-700">{user.bio}</p>
              )}
              
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <BookOpen className="w-4 h-4" />
                  <span>{userProblems.length} problems</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Problems</h2>
        
        {userProblems.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 rounded-lg">
            <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No public problems yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userProblems.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.id}`}
                className="block p-4 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-neutral-900">{problem.title}</h3>
                    <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                      {problem.description || "No description"}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {problem.library_item_count} items
                      </span>
                    </div>
                  </div>
                  {problem.difficulty && (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      problem.difficulty === "easy" ? "bg-emerald-100 text-emerald-700" :
                      problem.difficulty === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-rose-100 text-rose-700"
                    }`}>
                      {problem.difficulty}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
