"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  GitBranch,
  CheckCircle2,
  XCircle,
  Code2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileCode,
  Link2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import type { ActionSummaryData, NodeCreatedSummary, EdgeCreatedSummary } from "@/lib/types";

interface ActionSummaryCardProps {
  data: ActionSummaryData;
  onNodeClick?: (nodeId: string) => void;
}

const actionConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  explore: {
    icon: <Sparkles className="w-4 h-4" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
    label: "Exploration",
  },
  formalize: {
    icon: <Code2 className="w-4 h-4" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    label: "Formalization",
  },
  verify: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-200",
    label: "Verification",
  },
  critique: {
    icon: <MessageSquare className="w-4 h-4" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
    label: "Critique",
  },
  pipeline: {
    icon: <GitBranch className="w-4 h-4" />,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 border-indigo-200",
    label: "Full Pipeline",
  },
};

function NodeBadge({ node, onClick }: { node: NodeCreatedSummary; onClick?: () => void }) {
  const kindColors: Record<string, string> = {
    LEMMA: "bg-blue-100 text-blue-700 border-blue-200",
    THEOREM: "bg-purple-100 text-purple-700 border-purple-200",
    DEFINITION: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CLAIM: "bg-amber-100 text-amber-700 border-amber-200",
    COMPUTATION: "bg-violet-100 text-violet-700 border-violet-200",
    FORMAL_TEST: "bg-sky-100 text-sky-700 border-sky-200",
    NOTE: "bg-neutral-100 text-neutral-600 border-neutral-200",
    RESOURCE: "bg-pink-100 text-pink-700 border-pink-200",
  };

  const colors = kindColors[node.kind?.toUpperCase()] || kindColors.NOTE;

  return (
    <motion.button
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${colors} hover:opacity-80 transition-opacity`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <FileCode className="w-3 h-3" />
      <span className="max-w-[150px] truncate">{node.title}</span>
    </motion.button>
  );
}

function EdgeBadge({ edge }: { edge: EdgeCreatedSummary }) {
  const typeLabels: Record<string, string> = {
    implies: "→",
    uses: "uses",
    contradicts: "⊥",
    references: "ref",
  };

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
      <Link2 className="w-2.5 h-2.5" />
      {edge.from_id.slice(0, 4)}...{typeLabels[edge.type] || edge.type}...{edge.to_id.slice(0, 4)}
    </span>
  );
}

export function ActionSummaryCard({ data, onNodeClick }: ActionSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = actionConfig[data.action] || actionConfig.explore;
  const hasError = !!data.error;
  const hasNodes = data.nodes_created && data.nodes_created.length > 0;
  const hasEdges = data.edges_created && data.edges_created.length > 0;
  const hasLeanCode = !!data.lean_code;
  const hasVerification = !!data.verification_result;

  const showExpandButton = hasNodes || hasEdges || hasLeanCode;

  return (
    <motion.div
      className={`rounded-xl border overflow-hidden ${hasError ? "bg-red-50 border-red-200" : config.bgColor}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${hasError ? "bg-red-100" : "bg-white/60"}`}>
            {hasError ? (
              <XCircle className="w-4 h-4 text-red-500" />
            ) : (
              <span className={config.color}>{config.icon}</span>
            )}
          </div>
          <div>
            <span className={`text-sm font-semibold ${hasError ? "text-red-700" : config.color}`}>
              {config.label}
            </span>
            {data.confidence !== undefined && (
              <span className="ml-2 text-xs text-neutral-500">
                {Math.round(data.confidence * 100)}% confidence
              </span>
            )}
          </div>
        </div>

        {showExpandButton && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/50 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-neutral-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            )}
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="px-4 pb-3 flex items-center gap-4 text-xs">
        {hasNodes && (
          <span className="flex items-center gap-1 text-neutral-600">
            <FileCode className="w-3.5 h-3.5" />
            {data.nodes_created!.length} nodes
          </span>
        )}
        {hasEdges && (
          <span className="flex items-center gap-1 text-neutral-600">
            <Link2 className="w-3.5 h-3.5" />
            {data.edges_created!.length} connections
          </span>
        )}
        {hasVerification && (
          <span className={`flex items-center gap-1 ${data.verification_result!.success ? "text-emerald-600" : "text-red-600"}`}>
            {data.verification_result!.success ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            {data.verification_result!.success ? "Verified" : "Failed"}
          </span>
        )}
      </div>

      {/* Error Message */}
      {hasError && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{data.error}</p>
          </div>
        </div>
      )}

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/30 pt-3 space-y-3">
              {/* Created Nodes */}
              {hasNodes && (
                <div>
                  <h5 className="text-xs font-medium text-neutral-500 mb-2">Created Nodes</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {data.nodes_created!.map((node, i) => (
                      <NodeBadge
                        key={node.id || i}
                        node={node}
                        onClick={() => onNodeClick?.(node.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Created Edges */}
              {hasEdges && (
                <div>
                  <h5 className="text-xs font-medium text-neutral-500 mb-2">Connections</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {data.edges_created!.slice(0, 5).map((edge, i) => (
                      <EdgeBadge key={i} edge={edge} />
                    ))}
                    {data.edges_created!.length > 5 && (
                      <span className="text-xs text-neutral-400">
                        +{data.edges_created!.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Lean Code Preview */}
              {hasLeanCode && (
                <div>
                  <h5 className="text-xs font-medium text-neutral-500 mb-2">Lean 4 Code</h5>
                  <pre className="p-2 bg-neutral-900 text-neutral-100 rounded-lg text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                    {data.lean_code}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Loading card for ongoing runs
export function ActionLoadingCard({
  action,
  progress,
  currentStep,
}: {
  action: string;
  progress: number;
  currentStep?: string;
}) {
  const config = actionConfig[action] || actionConfig.explore;

  return (
    <motion.div
      className={`rounded-xl border overflow-hidden ${config.bgColor}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={`p-1.5 rounded-lg bg-white/60 ${config.color}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-semibold ${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-neutral-500">{progress}%</span>
          </div>
          {currentStep && (
            <p className="text-xs text-neutral-600">{currentStep}</p>
          )}
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-white/50 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${config.color.replace("text-", "bg-")}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
