"use client";

import { User, Bot } from "lucide-react";

interface AuthorAvatarProps {
  author: {
    type: "human" | "agent";
    id: string;
    name?: string;
    avatar_url?: string;
  };
  size?: "xs" | "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: { container: "w-5 h-5", icon: "w-2.5 h-2.5", text: "text-[8px]" },
  sm: { container: "w-6 h-6", icon: "w-3 h-3", text: "text-[10px]" },
  md: { container: "w-8 h-8", icon: "w-4 h-4", text: "text-xs" },
  lg: { container: "w-10 h-10", icon: "w-5 h-5", text: "text-sm" },
};

const AGENT_COLORS = [
  "from-violet-400 to-purple-500",
  "from-blue-400 to-indigo-500",
  "from-cyan-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
];

// Deterministic color based on agent id
function getAgentColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

export function AuthorAvatar({
  author,
  size = "sm",
  showTooltip = true,
  className = "",
}: AuthorAvatarProps) {
  const sizeClasses = SIZE_MAP[size];
  const isAgent = author.type === "agent";

  // Get initials for fallback
  const getInitials = () => {
    if (!author.name) return isAgent ? "AI" : "?";
    return author.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get background gradient for agent
  const getAgentGradient = () => {
    return `bg-gradient-to-br ${getAgentColor(author.id)}`;
  };

  // Human avatar with image
  if (!isAgent && author.avatar_url) {
    return (
      <div
        className={`relative ${sizeClasses.container} rounded-full overflow-hidden ring-2 ring-white shadow-sm ${className}`}
        title={showTooltip ? author.name || "Unknown" : undefined}
      >
        <img
          src={author.avatar_url}
          alt={author.name || "User"}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Agent avatar or human without image
  return (
    <div
      className={`relative ${sizeClasses.container} rounded-full overflow-hidden ring-2 ring-white shadow-sm flex items-center justify-center ${
        isAgent
          ? getAgentGradient()
          : "bg-gradient-to-br from-indigo-100 to-indigo-200"
      } ${className}`}
      title={showTooltip ? author.name || (isAgent ? "Rho Personality" : "Unknown") : undefined}
    >
      {isAgent ? (
        <Bot className={`${sizeClasses.icon} text-white`} />
      ) : author.name ? (
        <span className={`${sizeClasses.text} font-semibold text-indigo-700`}>
          {getInitials()}
        </span>
      ) : (
        <User className={`${sizeClasses.icon} text-indigo-500`} />
      )}
    </div>
  );
}

// Stack of avatars for multiple authors
interface AuthorAvatarStackProps {
  authors: Array<{
    type: "human" | "agent";
    id: string;
    name?: string;
    avatar_url?: string;
  }>;
  max?: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function AuthorAvatarStack({
  authors,
  max = 3,
  size = "sm",
  className = "",
}: AuthorAvatarStackProps) {
  if (!authors || authors.length === 0) return null;

  const displayAuthors = authors.slice(0, max);
  const remaining = authors.length - max;

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex -space-x-2">
        {displayAuthors.map((author, index) => (
          <div
            key={author.id}
            className="relative"
            style={{ zIndex: displayAuthors.length - index }}
          >
            <AuthorAvatar author={author} size={size} showTooltip />
          </div>
        ))}
        {remaining > 0 && (
          <div
            className={`flex items-center justify-center rounded-full ring-2 ring-white bg-neutral-100 text-neutral-600 font-medium ${
              size === "xs"
                ? "w-5 h-5 text-[8px]"
                : size === "sm"
                ? "w-6 h-6 text-[10px]"
                : size === "md"
                ? "w-8 h-8 text-xs"
                : "w-10 h-10 text-sm"
            }`}
            title={`${remaining} more contributor${remaining > 1 ? "s" : ""}`}
          >
            +{remaining}
          </div>
        )}
      </div>
    </div>
  );
}
