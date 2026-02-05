"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  UserPlus,
  MessageSquare,
  Star,
  GitFork,
  CheckCircle2,
  XCircle,
  Users,
  Info,
  Check,
  AtSign,
} from "lucide-react";
import {
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  Notification,
  NotificationType,
  isAuthenticated,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  follow: <UserPlus className="w-4 h-4 text-amber-600" />,
  mention: <AtSign className="w-4 h-4 text-indigo-600" />,
  new_discussion: <MessageSquare className="w-4 h-4 text-blue-600" />,
  new_comment: <MessageSquare className="w-4 h-4 text-neutral-600" />,
  reply_to_comment: <MessageSquare className="w-4 h-4 text-purple-600" />,
  problem_forked: <GitFork className="w-4 h-4 text-purple-600" />,
  problem_starred: <Star className="w-4 h-4 text-yellow-500" />,
  item_verified: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  item_rejected: <XCircle className="w-4 h-4 text-red-600" />,
  team_invite: <Users className="w-4 h-4 text-indigo-600" />,
  team_join: <Users className="w-4 h-4 text-emerald-600" />,
  system: <Info className="w-4 h-4 text-neutral-600" />,
};

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function NotificationsDropdown() {
  const { user, isLoading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (authLoading || !isAuthenticated()) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getNotifications({ limit: 20 });
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  }, [authLoading]);

  useEffect(() => {
    if (authLoading || !user || !isAuthenticated()) return;
    loadNotifications();
    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [authLoading, user, loadNotifications]);

  useEffect(() => {
    if (!authLoading && !user) {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [authLoading, user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markNotificationsRead([notificationId]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const getNotificationLink = (notification: Notification): string => {
    if (notification.target_type === "discussion" && notification.target_id) {
      return `/discussions/${notification.target_id}`;
    }
    if (notification.target_type === "problem" && notification.target_id) {
      return `/problems/${notification.target_id}`;
    }
    if (notification.target_type === "team" && notification.extra_data?.team_slug) {
      return `/teams/${notification.extra_data.team_slug}`;
    }
    if (notification.type === "follow" && notification.actor) {
      return `/users/${notification.actor.username}`;
    }
    return "#";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-neutral-500 hover:text-neutral-900 transition-colors border border-transparent hover:border-neutral-200 rounded-md"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl border border-neutral-200 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-neutral-900 border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={getNotificationLink(notification)}
                    onClick={() => {
                      if (!notification.is_read) handleMarkRead(notification.id);
                      setOpen(false);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0 ${
                      !notification.is_read ? "bg-indigo-50/50" : ""
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {notification.actor ? (
                        <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                          {getInitials(notification.actor.username)}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                          {NOTIFICATION_ICONS[notification.type] || (
                            <Info className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-neutral-900 line-clamp-2">
                          {notification.actor && (
                            <span className="font-semibold">{notification.actor.username} </span>
                          )}
                          {notification.title}
                        </p>
                        <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </div>
                      {notification.content && (
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {notification.content}
                        </p>
                      )}
                    </div>
                    {!notification.is_read && (
                      <span className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-neutral-100 px-4 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-neutral-500 hover:text-neutral-900 font-medium py-1"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
