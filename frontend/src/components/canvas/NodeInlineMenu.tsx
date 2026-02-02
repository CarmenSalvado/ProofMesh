"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Code2,
  CheckCircle2,
  Link2,
  MessageSquare,
  Pencil,
  Trash2,
  Copy,
  MoreHorizontal,
  GitBranch,
  Lightbulb,
  X,
} from "lucide-react";
import { useState, useCallback } from "react";

interface NodeInlineMenuProps {
  nodeId: string;
  nodeTitle: string;
  nodeType: string;
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, nodeId: string) => void;
}

const primaryActions = [
  {
    id: "explore",
    icon: <Sparkles className="w-4 h-4" />,
    label: "Expand with AI",
    color: "text-purple-600 hover:bg-purple-50",
    description: "Generate related concepts",
  },
  {
    id: "formalize",
    icon: <Code2 className="w-4 h-4" />,
    label: "Formalize",
    color: "text-blue-600 hover:bg-blue-50",
    description: "Convert to Lean 4",
  },
  {
    id: "verify",
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "Verify",
    color: "text-emerald-600 hover:bg-emerald-50",
    description: "Check proof",
  },
  {
    id: "connect",
    icon: <Link2 className="w-4 h-4" />,
    label: "Connect to...",
    color: "text-amber-600 hover:bg-amber-50",
    description: "Link to another node",
  },
];

const secondaryActions = [
  {
    id: "insight",
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    label: "Get Insight",
    color: "text-amber-500",
  },
  {
    id: "pipeline",
    icon: <GitBranch className="w-3.5 h-3.5" />,
    label: "Full Pipeline",
    color: "text-indigo-500",
  },
  {
    id: "comment",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    label: "Comment",
    color: "text-neutral-500",
  },
  {
    id: "edit",
    icon: <Pencil className="w-3.5 h-3.5" />,
    label: "Edit",
    color: "text-neutral-500",
  },
  {
    id: "duplicate",
    icon: <Copy className="w-3.5 h-3.5" />,
    label: "Duplicate",
    color: "text-neutral-500",
  },
  {
    id: "delete",
    icon: <Trash2 className="w-3.5 h-3.5" />,
    label: "Delete",
    color: "text-red-500",
  },
];

export function NodeInlineMenu({
  nodeId,
  nodeTitle,
  nodeType,
  position,
  isOpen,
  onClose,
  onAction,
}: NodeInlineMenuProps) {
  const [showMore, setShowMore] = useState(false);

  const handleAction = useCallback(
    (actionId: string) => {
      onAction(actionId, nodeId);
      if (actionId !== "connect") {
        onClose();
      }
    },
    [nodeId, onAction, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Menu Container */}
          <motion.div
            className="absolute z-50 bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden"
            style={{
              left: position.x,
              top: position.y,
              minWidth: 280,
            }}
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-sm font-medium text-neutral-700 max-w-[180px] truncate">
                  {nodeTitle}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            {/* Primary Actions Grid */}
            <div className="p-2 grid grid-cols-2 gap-1.5">
              {primaryActions.map((action) => (
                <motion.button
                  key={action.id}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-colors ${action.color}`}
                  onClick={() => handleAction(action.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    {action.icon}
                    <span className="text-sm font-medium">{action.label}</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 leading-tight">
                    {action.description}
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Secondary Actions */}
            <div className="border-t border-neutral-100">
              <AnimatePresence mode="wait">
                {showMore ? (
                  <motion.div
                    key="expanded"
                    className="p-2 grid grid-cols-3 gap-1"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    {secondaryActions.map((action) => (
                      <motion.button
                        key={action.id}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-neutral-50 transition-colors ${action.color}`}
                        onClick={() => handleAction(action.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {action.icon}
                        <span className="text-[10px] font-medium">{action.label}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                ) : (
                  <motion.button
                    key="collapsed"
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 transition-colors"
                    onClick={() => setShowMore(true)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span>More actions</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Simplified inline toolbar that appears on node selection (like the image)
export function NodeQuickToolbar({
  nodeId,
  position,
  onAction,
}: {
  nodeId: string;
  position: { x: number; y: number };
  onAction: (action: string, nodeId: string) => void;
}) {
  const quickActions = [
    { id: "comment", icon: <MessageSquare className="w-4 h-4" />, tooltip: "Comment" },
    { id: "edit", icon: <Pencil className="w-4 h-4" />, tooltip: "Edit" },
    { id: "ai", icon: <Sparkles className="w-4 h-4" />, tooltip: "AI Actions", highlight: true },
    { id: "connect", icon: <Link2 className="w-4 h-4" />, tooltip: "Connect" },
  ];

  return (
    <motion.div
      className="absolute z-40 flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-neutral-200 p-1"
      style={{
        left: position.x,
        top: position.y - 50, // Above the node
        transform: "translateX(-50%)",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      {quickActions.map((action) => (
        <motion.button
          key={action.id}
          className={`p-2 rounded-full transition-colors ${
            action.highlight
              ? "text-purple-600 hover:bg-purple-50"
              : "text-neutral-500 hover:bg-neutral-100"
          }`}
          onClick={() => onAction(action.id, nodeId)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={action.tooltip}
        >
          {action.icon}
        </motion.button>
      ))}
    </motion.div>
  );
}
