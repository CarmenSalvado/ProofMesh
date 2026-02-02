"use client";

import { useOptionalCollaboration } from "./CollaborationProvider";
import { useMemo } from "react";

interface CollaborativeCursorsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  currentFile?: string;
  className?: string;
}

/**
 * Renders other users' cursors on the canvas/editor
 */
export function CollaborativeCursors({
  containerRef,
  currentFile,
  className = "",
}: CollaborativeCursorsProps) {
  const collaboration = useOptionalCollaboration();

  // Filter cursors to only show those in the same file
  const visibleCursors = useMemo(() => {
    if (!collaboration) return [];
    
    const result: Array<{
      userId: string | number;
      username: string;
      color: string;
      x: number;
      y: number;
    }> = [];

    collaboration.cursors.forEach((cursor, userId) => {
      // Only show cursors for users viewing the same file
      if (currentFile && cursor.file !== currentFile) return;
      
      const user = collaboration.getUserById(userId);
      if (!user) return;
      
      result.push({
        userId,
        username: user.display_name || user.username,
        color: user.avatar_color,
        x: cursor.x,
        y: cursor.y,
      });
    });

    return result;
  }, [collaboration, currentFile]);

  if (!containerRef.current || visibleCursors.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {visibleCursors.map((cursor) => (
        <CursorPointer
          key={cursor.userId}
          x={cursor.x}
          y={cursor.y}
          color={cursor.color}
          label={cursor.username}
        />
      ))}
    </div>
  );
}

interface CursorPointerProps {
  x: number;
  y: number;
  color: string;
  label: string;
}

function CursorPointer({ x, y, color, label }: CursorPointerProps) {
  return (
    <div
      className="absolute transition-all duration-75 ease-out"
      style={{
        left: x,
        top: y,
        transform: "translate(-2px, -2px)",
      }}
    >
      {/* Cursor arrow SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="drop-shadow-md"
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86h6.25c.54 0 .81-.65.43-1.03L6.35 3.72c-.31-.31-.85-.09-.85.43z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Username label */}
      <div
        className="absolute left-4 top-5 px-2 py-0.5 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-sm"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
    </div>
  );
}

/**
 * Renders text selections from other users
 */
interface CollaborativeSelectionsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  currentFile?: string;
  getSelectionRects?: (start: number, end: number) => DOMRect[];
}

export function CollaborativeSelections({
  containerRef,
  currentFile,
  getSelectionRects,
}: CollaborativeSelectionsProps) {
  const collaboration = useOptionalCollaboration();

  const visibleSelections = useMemo(() => {
    if (!collaboration || !getSelectionRects) return [];

    const result: Array<{
      userId: string | number;
      color: string;
      rects: DOMRect[];
    }> = [];

    collaboration.selections.forEach((selection, userId) => {
      // Only show selections for users in the same file
      if (currentFile && selection.file !== currentFile) return;

      const user = collaboration.getUserById(userId);
      if (!user) return;

      const rects = getSelectionRects(selection.start, selection.end);
      if (rects.length === 0) return;

      result.push({
        userId,
        color: user.avatar_color,
        rects,
      });
    });

    return result;
  }, [collaboration, currentFile, getSelectionRects]);

  if (!containerRef.current || visibleSelections.length === 0) {
    return null;
  }

  const containerRect = containerRef.current.getBoundingClientRect();

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {visibleSelections.map((selection) =>
        selection.rects.map((rect, i) => (
          <div
            key={`${selection.userId}-${i}`}
            className="absolute opacity-30"
            style={{
              left: rect.left - containerRect.left,
              top: rect.top - containerRect.top,
              width: rect.width,
              height: rect.height,
              backgroundColor: selection.color,
            }}
          />
        ))
      )}
    </div>
  );
}
