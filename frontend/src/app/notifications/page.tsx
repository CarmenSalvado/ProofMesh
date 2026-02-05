"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  Notification,
  NotificationType,
} from "@/lib/api";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  ChevronDown,
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
  ArrowLeft,
  AtSign,
} from "lucide-react";

const NOTIFICATION_ICONS: Record<NotificationType, React.ReactNode> = {
  follow: <UserPlus className="w-5 h-5 text-amber-600" />,
  mention: <AtSign className="w-5 h-5 text-indigo-600" />,
  new_discussion: <MessageSquare className="w-5 h-5 text-blue-600" />,
  new_comment: <MessageSquare className="w-5 h-5 text-neutral-600" />,
  reply_to_comment: <MessageSquare className="w-5 h-5 text-purple-600" />,
  problem_forked: <GitFork className="w-5 h-5 text-purple-600" />,
  problem_starred: <Star className="w-5 h-5 text-yellow-500" />,
  item_verified: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
  item_rejected: <XCircle className="w-5 h-5 text-red-600" />,
  team_invite: <Users className="w-5 h-5 text-indigo-600" />,
  team_join: <Users className="w-5 h-5 text-emerald-600" />,
  system: <Info className="w-5 h-5 text-neutral-600" />,
};

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getNotifications({
        unread_only: filter === "unread",
        limit: 100,
      });
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

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
      <DashboardNavbar />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-neutral-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-1 mb-6 w-fit">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "unread"
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-900 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
            <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-base font-medium text-neutral-900 mb-2">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </h3>
            <p className="text-sm text-neutral-500">
              {filter === "unread"
                ? "You're all caught up!"
                : "When you get notifications, they'll show up here."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={getNotificationLink(notification)}
                onClick={() => {
                  if (!notification.is_read) handleMarkRead(notification.id);
                }}
                className={`flex items-start gap-4 p-5 hover:bg-neutral-50 transition-colors ${
                  !notification.is_read ? "bg-indigo-50/50" : ""
                }`}
              >
                <div className="flex-shrink-0">
                  {notification.actor ? (
                    notification.actor.avatar_url ? (
                      <img
                        src={notification.actor.avatar_url}
                        alt={`${notification.actor.username} avatar`}
                        className="w-10 h-10 rounded-full object-cover border border-neutral-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600">
                        {getInitials(notification.actor.username)}
                      </div>
                    )
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                      {NOTIFICATION_ICONS[notification.type] || (
                        <Info className="w-5 h-5 text-neutral-400" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-neutral-900">
                        {notification.actor && (
                          <span className="font-semibold">{notification.actor.username} </span>
                        )}
                        {notification.title}
                      </p>
                      {notification.content && (
                        <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                          {notification.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-neutral-400">
                        {formatRelativeTime(notification.created_at)}
                      </span>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-indigo-600 rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
