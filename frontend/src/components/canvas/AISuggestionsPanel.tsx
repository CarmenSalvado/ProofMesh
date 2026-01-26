"use client";

import { useState, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Zap,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Eye,
  Compass,
  ShieldCheck,
  BookOpen,
  Map,
  X,
} from "lucide-react";

interface AgentSuggestion {
  id: string;
  agent: "explorer" | "verifier" | "skeptic" | "archivist" | "mapper";
  type: "next-step" | "verification" | "warning" | "reference" | "optimization";
  title: string;
  description: string;
  confidence: number;
  actions?: { label: string; action: string }[];
  code?: string;
}

interface AISuggestionsPanelProps {
  suggestions: AgentSuggestion[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onApply?: (suggestion: AgentSuggestion) => void;
  onDismiss?: (suggestionId: string) => void;
  selectedNodeId?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
}

const AGENT_META: Record<
  AgentSuggestion["agent"],
  { icon: typeof Sparkles; color: string; bgColor: string }
> = {
  explorer: { icon: Compass, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  verifier: { icon: ShieldCheck, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  skeptic: { icon: AlertTriangle, color: "text-amber-600", bgColor: "bg-amber-50" },
  archivist: { icon: BookOpen, color: "text-cyan-600", bgColor: "bg-cyan-50" },
  mapper: { icon: Map, color: "text-purple-600", bgColor: "bg-purple-50" },
};

const TYPE_STYLES: Record<AgentSuggestion["type"], { label: string; color: string }> = {
  "next-step": { label: "Suggested Step", color: "text-indigo-600" },
  verification: { label: "Verification", color: "text-emerald-600" },
  warning: { label: "Potential Issue", color: "text-amber-600" },
  reference: { label: "Related Work", color: "text-cyan-600" },
  optimization: { label: "Optimization", color: "text-purple-600" },
};

export function AISuggestionsPanel({
  suggestions,
  isLoading = false,
  onRefresh,
  onApply,
  onDismiss,
  selectedNodeId,
  collapsed = false,
  onToggle,
}: AISuggestionsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredSuggestions = useMemo(() => {
    // If a node is selected, prioritize suggestions related to it
    // For now, show all suggestions
    return suggestions;
  }, [suggestions, selectedNodeId]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-4 top-20 bg-white border border-neutral-200 rounded-lg shadow-sm p-3 hover:bg-neutral-50 transition-colors z-40"
        title="Show AI Suggestions"
      >
        <Sparkles className="w-5 h-5 text-indigo-600" />
        {suggestions.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {suggestions.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-neutral-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">AI Suggestions</h3>
            <p className="text-[10px] text-neutral-500">
              {filteredSuggestions.length} suggestions available
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors disabled:opacity-50"
            title="Refresh suggestions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
            title="Collapse panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-neutral-100 shrink-0">
        <div className="flex gap-2">
          <button className="flex-1 bg-neutral-900 text-white text-xs font-medium py-2 px-3 rounded-md hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Auto-analyze
          </button>
          <button className="flex-1 border border-neutral-200 text-neutral-700 text-xs font-medium py-2 px-3 rounded-md hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Verify all
          </button>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading && filteredSuggestions.length === 0 ? (
          <div className="py-8 text-center">
            <RefreshCw className="w-6 h-6 text-neutral-300 mx-auto mb-2 animate-spin" />
            <p className="text-xs text-neutral-500">Analyzing proof structure...</p>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <div className="py-8 text-center">
            <Sparkles className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs text-neutral-500">No suggestions yet</p>
            <p className="text-[10px] text-neutral-400 mt-1">
              Select a node or refresh to get AI insights
            </p>
          </div>
        ) : (
          filteredSuggestions.map((suggestion) => {
            const agentMeta = AGENT_META[suggestion.agent];
            const typeStyle = TYPE_STYLES[suggestion.type];
            const AgentIcon = agentMeta.icon;
            const isExpanded = expandedId === suggestion.id;

            return (
              <div
                key={suggestion.id}
                className={`rounded-lg border transition-all ${
                  isExpanded
                    ? "border-indigo-200 bg-indigo-50/30 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                {/* Suggestion Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded ${agentMeta.bgColor} shrink-0`}>
                      <AgentIcon className={`w-3.5 h-3.5 ${agentMeta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-medium ${typeStyle.color}`}>
                          {typeStyle.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${suggestion.confidence}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-neutral-400">
                            {suggestion.confidence}%
                          </span>
                        </div>
                      </div>
                      <h4 className="text-sm font-medium text-neutral-900 truncate">
                        {suggestion.title}
                      </h4>
                      {!isExpanded && (
                        <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                          {suggestion.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-neutral-100 mt-2 pt-3">
                    <p className="text-xs text-neutral-600 mb-3">{suggestion.description}</p>

                    {suggestion.code && (
                      <div className="bg-neutral-900 rounded-md p-3 mb-3 relative group">
                        <pre className="text-xs text-neutral-300 font-mono overflow-x-auto">
                          {suggestion.code}
                        </pre>
                        <button
                          className="absolute top-2 right-2 p-1 bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Copy code"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onApply?.(suggestion)}
                        className="flex-1 bg-indigo-600 text-white text-xs font-medium py-1.5 px-3 rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => onDismiss?.(suggestion.id)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-neutral-100 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-neutral-500">
          <span>Powered by Gemini Pro</span>
          <button className="text-indigo-600 hover:text-indigo-700 font-medium">
            Configure
          </button>
        </div>
      </div>
    </div>
  );
}
