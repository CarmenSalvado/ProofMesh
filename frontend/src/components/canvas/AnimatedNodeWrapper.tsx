"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { NodeStateType } from "@/lib/types";

interface AnimatedNodeWrapperProps {
  children: ReactNode;
  nodeId: string;
  state?: NodeStateType;
  stateMessage?: string;
  isNew?: boolean;
  className?: string;
}

// Animation variants for different states
const nodeVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: -20,
    transition: {
      duration: 0.3,
    },
  },
};

// Halo animation for thinking state
const thinkingHaloVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
  },
  animate: {
    opacity: [0.3, 0.6, 0.3],
    scale: [0.95, 1.05, 0.95],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Generating shimmer effect
const generatingShimmerVariants: Variants = {
  initial: {
    backgroundPosition: "-200% 0",
  },
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

// Verifying pulse effect
const verifyingPulseVariants: Variants = {
  initial: {
    opacity: 0.5,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  animate: {
    opacity: [0.5, 1, 0.5],
    borderColor: [
      "rgba(34, 197, 94, 0.3)",
      "rgba(34, 197, 94, 0.8)",
      "rgba(34, 197, 94, 0.3)",
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Get state-specific styles
function getStateStyles(state: NodeStateType): string {
  switch (state) {
    case NodeStateType.THINKING:
      return "ring-2 ring-purple-400/50";
    case NodeStateType.GENERATING:
      return "ring-2 ring-blue-400/50";
    case NodeStateType.VERIFYING:
      return "ring-2 ring-emerald-400/50";
    case NodeStateType.COMPLETE:
      return "ring-2 ring-emerald-500";
    case NodeStateType.ERROR:
      return "ring-2 ring-red-500";
    default:
      return "";
  }
}

// Get halo color based on state
function getHaloColor(state: NodeStateType): string {
  switch (state) {
    case NodeStateType.THINKING:
      return "rgba(168, 85, 247, 0.4)"; // purple
    case NodeStateType.GENERATING:
      return "rgba(59, 130, 246, 0.4)"; // blue
    case NodeStateType.VERIFYING:
      return "rgba(34, 197, 94, 0.4)"; // green
    default:
      return "rgba(99, 102, 241, 0.4)"; // indigo
  }
}

export function AnimatedNodeWrapper({
  children,
  nodeId,
  state = NodeStateType.IDLE,
  stateMessage,
  isNew = false,
  className = "",
}: AnimatedNodeWrapperProps) {
  const isActive = state !== NodeStateType.IDLE && state !== NodeStateType.COMPLETE;
  const stateStyles = getStateStyles(state);
  const haloColor = getHaloColor(state);

  return (
    <motion.div
      key={nodeId}
      variants={isNew ? nodeVariants : undefined}
      initial={isNew ? "initial" : false}
      animate="animate"
      exit="exit"
      className={`relative ${className}`}
    >
      {/* Animated Halo for active states */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            variants={thinkingHaloVariants}
            initial="initial"
            animate="animate"
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              boxShadow: `0 0 30px 10px ${haloColor}`,
              zIndex: -1,
            }}
          />
        )}
      </AnimatePresence>

      {/* Shimmer overlay for generating state */}
      <AnimatePresence>
        {state === NodeStateType.GENERATING && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0"
              variants={generatingShimmerVariants}
              initial="initial"
              animate="animate"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.15) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Border animation for verifying state */}
      <AnimatePresence>
        {state === NodeStateType.VERIFYING && (
          <motion.div
            className="absolute inset-0 rounded-xl border-2 pointer-events-none"
            variants={verifyingPulseVariants}
            initial="initial"
            animate="animate"
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* State Message Tooltip */}
      <AnimatePresence>
        {isActive && stateMessage && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-md whitespace-nowrap z-50 shadow-lg"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
          >
            <span className="flex items-center gap-1.5">
              <motion.span
                className="w-2 h-2 rounded-full bg-current"
                animate={{
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                }}
                style={{
                  color: state === NodeStateType.THINKING
                    ? "#a855f7"
                    : state === NodeStateType.GENERATING
                    ? "#3b82f6"
                    : state === NodeStateType.VERIFYING
                    ? "#22c55e"
                    : "#6366f1",
                }}
              />
              {stateMessage}
            </span>
            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-neutral-900 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success flash for complete state */}
      <AnimatePresence>
        {state === NodeStateType.COMPLETE && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            initial={{ opacity: 0, scale: 1 }}
            animate={{
              opacity: [0, 0.5, 0],
              scale: [1, 1.05, 1.1],
            }}
            transition={{ duration: 0.6 }}
            style={{
              boxShadow: "0 0 40px 20px rgba(34, 197, 94, 0.5)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Error flash */}
      <AnimatePresence>
        {state === NodeStateType.ERROR && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.5, 0],
            }}
            transition={{ duration: 0.4, repeat: 2 }}
            style={{
              boxShadow: "0 0 30px 10px rgba(239, 68, 68, 0.5)",
            }}
          />
        )}
      </AnimatePresence>

      {/* The actual node content with state ring */}
      <div className={`relative ${stateStyles} rounded-xl transition-all duration-300`}>
        {children}
      </div>
    </motion.div>
  );
}

// Utility component for creating nodes with entrance animation
export function AnimatedNodeEntrance({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay,
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.div>
  );
}

// Edge animation component for connecting lines
export function AnimatedEdge({
  isNew = false,
  isActive = false,
}: {
  isNew?: boolean;
  isActive?: boolean;
}) {
  return (
    <motion.div
      initial={isNew ? { pathLength: 0, opacity: 0 } : false}
      animate={{
        pathLength: 1,
        opacity: 1,
        ...(isActive && {
          strokeDashoffset: [0, -20],
        }),
      }}
      transition={{
        duration: isNew ? 0.6 : 0,
        ...(isActive && {
          strokeDashoffset: {
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          },
        }),
      }}
    />
  );
}
