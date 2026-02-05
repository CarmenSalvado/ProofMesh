"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import { uploadAvatar, updateMe } from "@/lib/api";

export default function SettingsPage() {
  const { user, isLoading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-900 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const handleAvatarPick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
      await refreshUser();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload avatar";
      setAvatarError(message);
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      await updateMe({ avatar_url: null });
      await refreshUser();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove avatar";
      setAvatarError(message);
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <DashboardNavbar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-12">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
              Settings
            </h1>
            <p className="text-sm text-neutral-500">
              Manage your account preferences
            </p>
          </div>

          {/* Profile Section */}
          <div className="bg-white border border-neutral-200 rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-sm font-medium text-neutral-900 mb-4">Profile</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatar_url}
                        alt={`${user.username} avatar`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-neutral-500">
                        {user.username.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Profile photo</p>
                    <p className="text-[11px] text-neutral-400">
                      PNG or JPG up to 5MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAvatarPick}
                    disabled={avatarUploading}
                    className="px-3 py-2 bg-neutral-900 text-white text-xs font-medium rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {avatarUploading ? "Uploading..." : "Change photo"}
                  </button>
                  {user.avatar_url ? (
                    <button
                      onClick={handleAvatarRemove}
                      disabled={avatarUploading}
                      className="px-3 py-2 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              {avatarError ? (
                <p className="text-xs text-red-500">{avatarError}</p>
              ) : null}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 opacity-60 cursor-not-allowed"
                  disabled
                />
                <p className="text-[10px] text-neutral-400 mt-1">Username cannot be changed</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 opacity-60 cursor-not-allowed"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white border border-red-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-medium text-red-600 mb-4">Danger Zone</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-700">Sign Out</p>
                <p className="text-xs text-neutral-400">Sign out of your account</p>
              </div>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
