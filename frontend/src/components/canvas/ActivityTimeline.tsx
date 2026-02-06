"use client";

import { useState } from "react";
import { 
  User, 
  Bot, 
  Edit3, 
  CheckCircle, 
  MessageSquare, 
  Sparkles,
  GitCommit,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthorAvatar } from "./AuthorAvatar";

export interface ActivityEntry {
  id: string;
  type: "created" | "updated" | "verified" | "commented" | "agent_generated" | "published";
  user: {
    type: "human" | "agent";
    id: string;
    name?: string;
    avatar_url?: string;
  } | null;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityTimelineProps {
  activities: ActivityEntry[];
  isLoading?: boolean;
  emptyMessage?: string;
}

const ACTIVITY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  created: {
    icon: GitCommit,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    label: "Created",
  },
  published: {
    icon: GitCommit,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    label: "Published",
  },
  updated: {
    icon: Edit3,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "Updated",
  },
  verified: {
    icon: CheckCircle,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    label: "Verified",
  },
  commented: {
    icon: MessageSquare,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    label: "Commented",
  },
  agent_generated: {
    icon: Sparkles,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    label: "AI Generated",
  },
};

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatFullDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format metadata into human-readable description
function formatMetadata(metadata: Record<string, unknown>): React.ReactNode {
  const parts: React.ReactNode[] = [];
  
  // Handle changes array
  if (metadata.changes && Array.isArray(metadata.changes)) {
    const changes = metadata.changes as string[];
    if (changes.length > 0) {
      parts.push(
        <span key="changes" className="text-neutral-600">
          Changed: {changes.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}
        </span>
      );
    }
  }
  
  // Handle item/problem title
  if (metadata.item_title && metadata.problem_title) {
    parts.push(
      <span key="location" className="text-neutral-500">
        {metadata.item_title} • {metadata.problem_title}
      </span>
    );
  } else if (metadata.item_title) {
    parts.push(
      <span key="item" className="text-neutral-500">{metadata.item_title}</span>
    );
  } else if (metadata.problem_title) {
    parts.push(
      <span key="problem" className="text-neutral-500">{metadata.problem_title}</span>
    );
  }
  
  // Handle verification method
  if (metadata.method) {
    parts.push(
      <span key="method" className="text-emerald-600">
        Method: {metadata.method}
      </span>
    );
  }
  
  // Handle status
  if (metadata.status) {
    parts.push(
      <span key="status" className="text-blue-600">
        Status: {metadata.status}
      </span>
    );
  }
  
  if (parts.length === 0) {
    // Fallback: show minimal info from any other fields
    const simplePairs = Object.entries(metadata)
      .filter(([key]) => !key.includes("_id"))
      .slice(0, 3);
    if (simplePairs.length > 0) {
      return simplePairs.map(([key, value]) => (
        <span key={key} className="text-neutral-500">
          {key}: {String(value)}
        </span>
      ));
    }
  }
  
  return parts.length > 0 ? parts : null;
}

export function ActivityTimeline({
  activities,
  isLoading = false,
  emptyMessage = "No activity yet",
}: ActivityTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-neutral-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
        <p className="text-sm text-neutral-500">{emptyMessage}</p>
      </div>
    );
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Group activities by date
  const groupedActivities: Record<string, ActivityEntry[]> = {};
  activities.forEach((activity) => {
    const date = new Date(activity.timestamp).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!groupedActivities[date]) {
      groupedActivities[date] = [];
    }
    groupedActivities[date].push(activity);
  });

  return (
    <div className="space-y-6">
      {Object.entries(groupedActivities).map(([date, dayActivities]) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              {date}
            </span>
            <div className="flex-1 h-px bg-neutral-100" />
          </div>

          {/* Activities for this date */}
          <div className="space-y-3">
            {dayActivities.map((activity, index) => {
              const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.updated;
              const Icon = config.icon;
              const isExpanded = expandedItems.has(activity.id);
              const hasMetadata = activity.metadata && Object.keys(activity.metadata).length > 0;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <div
                    className={`flex gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      isExpanded
                        ? "bg-neutral-50 border-neutral-200"
                        : "bg-white border-transparent hover:bg-neutral-50 hover:border-neutral-100"
                    }`}
                    onClick={() => hasMetadata && toggleExpanded(activity.id)}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-full ${config.bgColor} ${config.borderColor} border flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-neutral-800 leading-relaxed">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {activity.user && (
                              <>
                                <AuthorAvatar
                                  author={activity.user}
                                  size="xs"
                                  showTooltip={false}
                                />
                                <span className="text-xs text-neutral-500">
                                  {activity.user.name ||
                                    (activity.user.type === "agent" ? "Rho Personality" : "Unknown")}
                                </span>
                              </>
                            )}
                            <span className="text-xs text-neutral-400">•</span>
                            <span
                              className="text-xs text-neutral-400"
                              title={formatFullDate(activity.timestamp)}
                            >
                              {formatRelativeTime(activity.timestamp)}
                            </span>
                            {hasMetadata && (
                              <>
                                <span className="text-xs text-neutral-400">•</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-neutral-400" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded metadata */}
                      <AnimatePresence>
                        {isExpanded && hasMetadata && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 pt-2 border-t border-neutral-100">
                              <div className="flex flex-col gap-1 text-xs">
                                {formatMetadata(activity.metadata!)}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact version for node cards
interface CompactActivityIndicatorProps {
  activities: ActivityEntry[];
  max?: number;
}

export function CompactActivityIndicator({
  activities,
  max = 3,
}: CompactActivityIndicatorProps) {
  if (!activities || activities.length === 0) return null;

  const recentActivities = activities.slice(0, max);
  const remaining = activities.length - max;

  return (
    <div className="flex items-center gap-1">
      {recentActivities.map((activity, index) => {
        const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.updated;
        return (
          <div
            key={activity.id}
            className={`w-5 h-5 rounded-full ${config.bgColor} ${config.borderColor} border flex items-center justify-center`}
            title={`${config.label}: ${activity.description}`}
            style={{ marginLeft: index > 0 ? "-6px" : 0, zIndex: max - index }}
          >
            <config.icon className={`w-2.5 h-2.5 ${config.color}`} />
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className="w-5 h-5 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center text-[8px] text-neutral-500 font-medium"
          style={{ marginLeft: "-6px" }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
