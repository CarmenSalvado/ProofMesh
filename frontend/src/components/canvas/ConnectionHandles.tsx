"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type HandlePosition = "top" | "right" | "bottom" | "left";

interface ConnectionHandleProps {
  position: HandlePosition;
  isVisible: boolean;
  isConnecting: boolean;
  isActive: boolean;
  onMouseDown: (e: React.MouseEvent, position: HandlePosition) => void;
  onMouseUp: (e: React.MouseEvent) => void;
}

const positionStyles: Record<HandlePosition, string> = {
  top: "-top-2 left-1/2 -translate-x-1/2",
  right: "top-1/2 -right-2 -translate-y-1/2",
  bottom: "-bottom-2 left-1/2 -translate-x-1/2",
  left: "top-1/2 -left-2 -translate-y-1/2",
};

export function ConnectionHandle({
  position,
  isVisible,
  isConnecting,
  isActive,
  onMouseDown,
  onMouseUp,
}: ConnectionHandleProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <AnimatePresence>
      {(isVisible || isConnecting || isActive) && (
        <motion.div
          className={`absolute ${positionStyles[position]} z-20`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.15 }}
        >
          <motion.button
            className={`
              w-4 h-4 rounded-full border-2 cursor-crosshair transition-all
              ${isActive || isConnecting 
                ? "bg-emerald-500 border-emerald-600 shadow-lg shadow-emerald-500/30" 
                : isHovered
                  ? "bg-emerald-100 border-emerald-500"
                  : "bg-white border-neutral-300 hover:border-emerald-500 hover:bg-emerald-50"
              }
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onMouseDown={(e) => onMouseDown(e, position)}
            onMouseUp={onMouseUp}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
          >
            {/* Plus icon inside when hovered */}
            {isHovered && !isActive && !isConnecting && (
              <motion.svg
                className="w-full h-full text-emerald-600"
                viewBox="0 0 16 16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" />
                <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" />
              </motion.svg>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface NodeConnectionHandlesProps {
  nodeId: string;
  isSelected: boolean;
  isConnecting: boolean;
  connectingFromPosition?: HandlePosition;
  onStartConnection: (e: React.MouseEvent, nodeId: string, position: HandlePosition) => void;
  onEndConnection: (e: React.MouseEvent, nodeId: string, position: HandlePosition) => void;
}

export function NodeConnectionHandles({
  nodeId,
  isSelected,
  isConnecting,
  connectingFromPosition,
  onStartConnection,
  onEndConnection,
}: NodeConnectionHandlesProps) {
  const [hoveredHandle, setHoveredHandle] = useState<HandlePosition | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, position: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();
    onStartConnection(e, nodeId, position);
  }, [nodeId, onStartConnection]);

  const handleMouseUp = useCallback((e: React.MouseEvent, position: HandlePosition) => {
    e.preventDefault();
    e.stopPropagation();
    onEndConnection(e, nodeId, position);
  }, [nodeId, onEndConnection]);

  const positions: HandlePosition[] = ["top", "right", "bottom", "left"];

  return (
    <>
      {positions.map((position) => (
        <ConnectionHandle
          key={position}
          position={position}
          isVisible={isSelected}
          isConnecting={isConnecting && connectingFromPosition === position}
          isActive={isConnecting && connectingFromPosition !== position}
          onMouseDown={(e) => handleMouseDown(e, position)}
          onMouseUp={(e) => handleMouseUp(e, position)}
        />
      ))}
    </>
  );
}

// Animated edge path for new connections
interface AnimatedEdgePathProps {
  path: string;
  isNew?: boolean;
  isActive?: boolean;
  edgeType?: string;
  onDelete?: () => void;
  isSelected?: boolean;
}

const edgeTypeColors: Record<string, { stroke: string; markerFill: string }> = {
  uses: { stroke: "#6366f1", markerFill: "#6366f1" },
  implies: { stroke: "#22c55e", markerFill: "#22c55e" },
  contradicts: { stroke: "#ef4444", markerFill: "#ef4444" },
  references: { stroke: "#8b5cf6", markerFill: "#8b5cf6" },
};

export function AnimatedEdgePath({
  path,
  isNew = false,
  isActive = false,
  edgeType = "implies",
  onDelete,
  isSelected = false,
}: AnimatedEdgePathProps) {
  const colors = edgeTypeColors[edgeType] || edgeTypeColors.implies;
  
  return (
    <g>
      {/* Hover area (wider for easier selection) */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        className="cursor-pointer"
        onClick={onDelete}
      />
      
      {/* Selection highlight */}
      {isSelected && (
        <motion.path
          d={path}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="4"
          strokeOpacity="0.3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
      
      {/* Main path */}
      <motion.path
        d={path}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        initial={isNew ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={isNew ? { duration: 0.5, ease: "easeOut" } : undefined}
        markerEnd={`url(#arrow-${edgeType})`}
      />
      
      {/* Active animation (data flowing) */}
      {isActive && (
        <motion.path
          d={path}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="8 4"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -24 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      )}
    </g>
  );
}

// Arrow markers for SVG
export function EdgeArrowMarkers() {
  return (
    <defs>
      {Object.entries(edgeTypeColors).map(([type, colors]) => (
        <marker
          key={type}
          id={`arrow-${type}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.markerFill} />
        </marker>
      ))}
      {/* Default arrow */}
      <marker
        id="arrow-default"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
      </marker>
    </defs>
  );
}

// Connection preview line while dragging
interface ConnectionPreviewProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromPosition?: HandlePosition;
}

export function ConnectionPreview({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
}: ConnectionPreviewProps) {
  // Create a smooth bezier curve based on the start position
  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;
  
  const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
  const controlPointDistance = Math.min(distance * 0.5, 100);
  
  switch (fromPosition) {
    case "top":
      cp1x = fromX;
      cp1y = fromY - controlPointDistance;
      cp2x = toX;
      cp2y = toY + controlPointDistance;
      break;
    case "bottom":
      cp1x = fromX;
      cp1y = fromY + controlPointDistance;
      cp2x = toX;
      cp2y = toY - controlPointDistance;
      break;
    case "left":
      cp1x = fromX - controlPointDistance;
      cp1y = fromY;
      cp2x = toX + controlPointDistance;
      cp2y = toY;
      break;
    case "right":
    default:
      cp1x = fromX + controlPointDistance;
      cp1y = fromY;
      cp2x = toX - controlPointDistance;
      cp2y = toY;
      break;
  }
  
  const path = `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
  
  return (
    <g>
      {/* Glowing effect */}
      <motion.path
        d={path}
        fill="none"
        stroke="#22c55e"
        strokeWidth="4"
        strokeOpacity="0.3"
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      
      {/* Main line */}
      <motion.path
        d={path}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 4"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -20 }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
      />
      
      {/* Target indicator */}
      <motion.circle
        cx={toX}
        cy={toY}
        r="8"
        fill="#22c55e"
        fillOpacity="0.2"
        stroke="#22c55e"
        strokeWidth="2"
        initial={{ scale: 0.8 }}
        animate={{ scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
      <circle
        cx={toX}
        cy={toY}
        r="4"
        fill="#22c55e"
      />
    </g>
  );
}
