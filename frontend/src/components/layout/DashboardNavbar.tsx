"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getSocialUsers, SocialUser } from "@/lib/api";
import { NotificationsDropdown } from "@/components/social";
import {
  Search,
  ChevronDown,
  User,
  Settings,
  HelpCircle,
  LogOut,
  BookOpen,
  Users,
  Home,
  Compass,
} from "lucide-react";

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

interface DashboardNavbarProps {
  showSearch?: boolean;
}

export function DashboardNavbar({ showSearch = true }: DashboardNavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SocialUser[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleSearchFocus(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const isEditable = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
      if (isEditable) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleSearchFocus);
    return () => window.removeEventListener("keydown", handleSearchFocus);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearchOpen(false);
        return;
      }

      // Remove leading @ if present
      const cleanQuery = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
      
      setSearching(true);
      try {
        const data = await getSocialUsers({ q: cleanQuery, limit: 10 });
        setSearchResults(data.users);
        setSearchOpen(data.users.length > 0);
      } catch (err) {
        console.error("Search failed", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && searchResults.length > 0) {
      router.push(`/users/${searchResults[0].username}`);
      setSearchQuery("");
      setSearchOpen(false);
    }
  };

  const handleUserClick = (username: string) => {
    setSearchQuery("");
    setSearchOpen(false);
    router.push(`/users/${username}`);
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 w-full z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo & Nav Links */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <Logo size={24} className="group-hover:opacity-80 transition-opacity" />
            <span className="text-sm font-bold tracking-tight">ProofMesh</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
            <Link
              href="/catalog"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              Explore
            </Link>
            <Link
              href="/library"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Library
            </Link>
            <Link
              href="/social"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Network
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="flex-1 max-w-xl hidden md:block">
            <form onSubmit={handleSearch} className="relative group">
              <div ref={searchDropdownRef}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-neutral-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-12 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
                  placeholder="Search users..."
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <kbd className="inline-flex items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                    /
                  </kbd>
                </div>

                {/* Search Results Dropdown */}
                {searchOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                    {searching ? (
                      <div className="px-4 py-3 text-sm text-neutral-500 text-center">
                        Searching...
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-neutral-500 text-center">
                        No users found
                      </div>
                    ) : (
                      <div className="py-2">
                        {searchResults.map((user) => (
                          <button
                            key={user.username}
                            type="button"
                            onClick={() => handleUserClick(user.username)}
                            className="w-full px-4 py-2 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                          >
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={`${user.username} avatar`}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-neutral-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium flex-shrink-0">
                                {getInitials(user.username)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-neutral-900">
                                {user.username}
                              </div>
                              <div className="text-xs text-neutral-500">
                                @{user.username}
                              </div>
                            </div>
                            {user.is_following && (
                              <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-600 rounded">
                                Siguiendo
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <NotificationsDropdown />
          <div className="h-4 w-px bg-neutral-200 mx-1" />
          
          {/* User Dropdown */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 group p-1 hover:bg-neutral-50 rounded-md transition-colors"
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.username} avatar`}
                  className="w-6 h-6 rounded-full object-cover border border-neutral-200 group-hover:border-indigo-500 transition-colors"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-100 border border-neutral-200 group-hover:border-indigo-500 transition-colors flex items-center justify-center text-[10px] font-bold text-indigo-700">
                  {getInitials(user.username)}
                </div>
              )}
              <span className="text-sm font-medium text-neutral-700 hidden sm:block">{user.username}</span>
              <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${userDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-neutral-100">
                  <p className="text-sm font-medium text-neutral-900">{user.username}</p>
                  <p className="text-xs text-neutral-500">@{user.username.toLowerCase()}</p>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <User className="w-4 h-4 text-neutral-400" />
                  Your Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <Settings className="w-4 h-4 text-neutral-400" />
                  Settings
                </Link>
                <Link
                  href="/help"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <HelpCircle className="w-4 h-4 text-neutral-400" />
                  Help & Docs
                </Link>
                <div className="border-t border-neutral-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
