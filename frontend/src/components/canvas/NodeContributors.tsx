"use client";

import { Users, Bot, Crown, Sparkles } from "lucide-react";
import { AuthorAvatar, AuthorAvatarStack } from "./AuthorAvatar";
import type { AuthorInfo } from "./types";

interface NodeContributorsProps {
  authors: AuthorInfo[];
  createdAt?: string;
  updatedAt?: string;
  showFullList?: boolean;
  className?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NodeContributors({
  authors,
  createdAt,
  updatedAt,
  showFullList = false,
  className = "",
}: NodeContributorsProps) {
  if (!authors || authors.length === 0) {
    return (
      <div className={`flex items-center gap-1.5 text-neutral-400 ${className}`}>
        <Users className="w-3.5 h-3.5" />
        <span className="text-xs">No contributors</span>
      </div>
    );
  }

  // Separate human and agent authors
  const humanAuthors = authors.filter((a) => a.type === "human");
  const agentAuthors = authors.filter((a) => a.type === "agent");
  const hasAgent = agentAuthors.length > 0;

  if (!showFullList) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AuthorAvatarStack authors={authors} max={3} size="xs" />
        {hasAgent && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-50 border border-violet-200">
            <Sparkles className="w-2.5 h-2.5 text-violet-500" />
            <span className="text-[9px] font-medium text-violet-600">AI</span>
          </div>
        )}
      </div>
    );
  }

  // Full list view for detail panel
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Human contributors */}
      {humanAuthors.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            Contributors ({humanAuthors.length})
          </h4>
          <div className="space-y-2">
            {humanAuthors.map((author, index) => (
              <div
                key={author.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-white border border-neutral-100 hover:border-neutral-200 transition-colors"
              >
                <AuthorAvatar author={author} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">
                    {author.name || "Unknown"}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {index === 0 && createdAt
                      ? `Created ${formatDate(createdAt)}`
                      : "Contributor"}
                  </p>
                </div>
                {index === 0 && (
                  <div title="Creator" className="flex items-center">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent contributors */}
      {agentAuthors.length > 0 && (
        <div>
          <h4 className="text-[10px] font-medium text-violet-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bot className="w-3 h-3" />
            AI Assistance ({agentAuthors.length})
          </h4>
          <div className="space-y-2">
            {agentAuthors.map((author) => (
              <div
                key={author.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-violet-50/50 border border-violet-100"
              >
                <AuthorAvatar author={author} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-violet-800 truncate">
                    {author.name || "AI Agent"}
                  </p>
                  <p className="text-xs text-violet-400">
                    Generated content
                  </p>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      {(createdAt || updatedAt) && (
        <div className="pt-2 border-t border-neutral-100">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            {createdAt && (
              <span>Created: {formatDate(createdAt)}</span>
            )}
            {updatedAt && updatedAt !== createdAt && (
              <span>Updated: {formatDate(updatedAt)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Badge version for inline display
interface ContributorBadgeProps {
  authors: AuthorInfo[];
  size?: "sm" | "md";
}

export function ContributorBadge({ authors, size = "sm" }: ContributorBadgeProps) {
  if (!authors || authors.length === 0) return null;

  const humanCount = authors.filter((a) => a.type === "human").length;
  const agentCount = authors.filter((a) => a.type === "agent").length;

  return (
    <div
      className={`flex items-center gap-1.5 ${
        size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1"
      } rounded-full bg-white/80 border border-neutral-200`}
    >
      <AuthorAvatarStack authors={authors} max={2} size={size === "sm" ? "xs" : "sm"} />
      <div className="flex items-center gap-1">
        {humanCount > 0 && (
          <span className={`text-neutral-600 ${size === "sm" ? "text-[9px]" : "text-xs"}`}>
            {humanCount}
          </span>
        )}
        {agentCount > 0 && (
          <span
            className={`text-violet-600 flex items-center gap-0.5 ${
              size === "sm" ? "text-[9px]" : "text-xs"
            }`}
          >
            <Sparkles className={size === "sm" ? "w-2 h-2" : "w-3 h-3"} />
            {agentCount}
          </span>
        )}
      </div>
    </div>
  );
}
