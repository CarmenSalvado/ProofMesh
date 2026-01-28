"use client";

import { useState, useEffect } from "react";
import { Star, AlertCircle } from "lucide-react";
import {
  createStar,
  deleteStar,
  checkIsStarred,
  isAuthenticated,
  StarTargetType,
} from "@/lib/api";

interface StarButtonProps {
  targetType: StarTargetType;
  targetId: string;
  initialStarred?: boolean;
  starCount?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

export function StarButton({
  targetType,
  targetId,
  initialStarred = false,
  starCount = 0,
  size = "md",
  showCount = true,
  className = "",
}: StarButtonProps) {
  const [starred, setStarred] = useState(initialStarred);
  const [count, setCount] = useState(starCount);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(!initialStarred);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStarred) return;
    
    const check = async () => {
      setChecking(true);
      try {
        const isStarred = await checkIsStarred(targetType, targetId);
        setStarred(isStarred);
      } catch {
        // Ignore errors
      } finally {
        setChecking(false);
      }
    };
    check();
  }, [targetType, targetId, initialStarred]);

  const handleToggle = async () => {
    if (loading) return;

    // Check authentication
    if (!isAuthenticated()) {
      setError("Please log in to star items");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (starred) {
        await deleteStar(targetType, targetId);
        setStarred(false);
        setCount((prev) => Math.max(0, prev - 1));
      } else {
        await createStar({ target_type: targetType, target_id: targetId });
        setStarred(true);
        setCount((prev) => prev + 1);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to toggle star";
      console.error("Failed to toggle star:", err);
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "p-1 gap-1 text-xs",
    md: "p-1.5 gap-1.5 text-sm",
    lg: "p-2 gap-2 text-base",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={loading || checking}
        className={`
          inline-flex items-center rounded-md font-medium transition-all
          ${sizeClasses[size]}
          ${
            starred
              ? "text-yellow-600 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100"
              : "text-neutral-500 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 hover:text-neutral-700"
          }
          ${loading || checking ? "opacity-60 cursor-not-allowed" : ""}
          ${error ? "border-red-300 text-red-600" : ""}
          ${className}
        `}
        title={error || (starred ? "Remove star" : "Add star")}
      >
        {error ? (
          <AlertCircle className={`${iconSizes[size]} animate-pulse`} />
        ) : (
          <Star
            className={`${iconSizes[size]} ${starred ? "fill-yellow-500" : ""} ${
              loading ? "animate-pulse" : ""
            }`}
          />
        )}
        {showCount && <span>{count}</span>}
      </button>
      {error && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-red-600 text-white text-xs rounded whitespace-nowrap z-50">
          {error}
        </div>
      )}
    </div>
  );
}

// Compact version for lists
interface StarButtonCompactProps {
  targetType: StarTargetType;
  targetId: string;
  starred?: boolean;
  onToggle?: (starred: boolean) => void;
}

export function StarButtonCompact({
  targetType,
  targetId,
  starred: initialStarred = false,
  onToggle,
}: StarButtonCompactProps) {
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (loading) return;

    // Check authentication
    if (!isAuthenticated()) {
      setError("Please log in");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (starred) {
        await deleteStar(targetType, targetId);
        setStarred(false);
        onToggle?.(false);
      } else {
        await createStar({ target_type: targetType, target_id: targetId });
        setStarred(true);
        onToggle?.(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed";
      console.error("Failed to toggle star:", err);
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`p-1 rounded hover:bg-neutral-100 transition-colors ${
          loading ? "opacity-50" : ""
        } ${error ? "text-red-500" : ""}`}
        title={error || (starred ? "Remove star" : "Add star")}
      >
        {error ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Star
            className={`w-4 h-4 ${
              starred ? "text-yellow-500 fill-yellow-500" : "text-neutral-400 hover:text-yellow-500"
            }`}
          />
        )}
      </button>
      {error && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-red-600 text-white text-xs rounded whitespace-nowrap z-50">
          {error}
        </div>
      )}
    </div>
  );
}
