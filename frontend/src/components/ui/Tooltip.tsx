"use client";

import React, { useState, useRef, ReactNode, useCallback, useEffect } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  flip?: boolean;
}

export function Tooltip({
  content,
  children,
  position = "top",
  delay = 200,
  flip = true,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [actualPosition, setActualPosition] = useState<"top" | "bottom" | "left" | "right">(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!isVisible || !triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const padding = 8;
    const edgeBuffer = 32;
    let finalPosition: "top" | "bottom" | "left" | "right" = position;

    if (flip) {
      if (position === "top" && rect.top < edgeBuffer) finalPosition = "bottom";
      if (position === "bottom" && rect.bottom > window.innerHeight - edgeBuffer) finalPosition = "top";
      if (position === "left" && rect.left < edgeBuffer) finalPosition = "right";
      if (position === "right" && rect.right > window.innerWidth - edgeBuffer) finalPosition = "left";
    }

    let x = 0;
    let y = 0;

    switch (finalPosition) {
      case "top":
        x = rect.left + rect.width / 2;
        y = rect.top - 8;
        break;
      case "bottom":
        x = rect.left + rect.width / 2;
        y = rect.bottom + 8;
        break;
      case "left":
        x = rect.left - 8;
        y = rect.top + rect.height / 2;
        break;
      case "right":
        x = rect.right + 8;
        y = rect.top + rect.height / 2;
        break;
    }

    // Clamp to viewport bounds
    x = Math.max(padding, Math.min(x, window.innerWidth - padding));
    y = Math.max(padding, Math.min(y, window.innerHeight - padding));

    setActualPosition(finalPosition);
    setCoords({ x, y });
  }, [isVisible, position, flip]);

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    left: coords.x,
    top: coords.y,
    transform: getTransform(actualPosition),
    zIndex: 9999,
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && (
        <div
          style={tooltipStyle}
          className="px-2 py-1 text-xs text-white bg-neutral-900 rounded shadow-lg whitespace-nowrap pointer-events-none"
          role="tooltip"
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-neutral-900 rotate-45 ${getArrowPosition(actualPosition)}`}
          />
        </div>
      )}
    </>
  );
}

function getTransform(position: "top" | "bottom" | "left" | "right"): string {
  switch (position) {
    case "top":
      return "translate(-50%, -100%)";
    case "bottom":
      return "translate(-50%, 0)";
    case "left":
      return "translate(-100%, -50%)";
    case "right":
      return "translate(0, -50%)";
  }
}

function getArrowPosition(position: "top" | "bottom" | "left" | "right"): string {
  switch (position) {
    case "top":
      return "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2";
    case "bottom":
      return "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2";
    case "left":
      return "right-0 top-1/2 translate-x-1/2 -translate-y-1/2";
    case "right":
      return "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2";
  }
}
