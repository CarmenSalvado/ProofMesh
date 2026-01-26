"use client";

import { useState, useCallback } from "react";
import {
  Bot,
  Sparkles,
  Users,
  ChevronRight,
  Send,
  Settings,
  X,
  Check,
  RefreshCw,
  ShieldCheck,
  Compass,
  AlertTriangle,
  Zap,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Copy,
} from "lucide-react";
import { CanvasNode, AgentSuggestion, AgentActivity, NODE_TYPE_CONFIG } from "./types";

interface AgentIntelligencePanelProps {
  selectedNode: CanvasNode | null;
  collaboratorCount: number;
  isConnected: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onSuggestionAccept?: (suggestion: AgentSuggestion) => void;
  onSuggestionRefine?: (suggestion: AgentSuggestion) => void;
  onAgentCommand?: (command: string) => void;
}

// Mock data for demo - will be replaced with real agent integration
const MOCK_AGENTS = [
  { id: "syntax-guard", name: "SyntaxGuard", status: "active", color: "#10b981" },
  { id: "logic-prover", name: "LogicProver", status: "active", color: "#6366f1" },
];

// Empty arrays - real agent activities and suggestions will come from API
const MOCK_ACTIVITIES: AgentActivity[] = [];

const MOCK_SUGGESTIONS: AgentSuggestion[] = [];

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function AgentIntelligencePanel({
  selectedNode,
  collaboratorCount,
  isConnected,
  collapsed,
  onToggle,
  onSuggestionAccept,
  onSuggestionRefine,
  onAgentCommand,
}: AgentIntelligencePanelProps) {
  const [command, setCommand] = useState("");
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [activities] = useState<AgentActivity[]>(MOCK_ACTIVITIES);
  const [suggestions] = useState<AgentSuggestion[]>(MOCK_SUGGESTIONS);

  const handleSubmitCommand = useCallback(() => {
    if (command.trim() && onAgentCommand) {
      onAgentCommand(command.trim());
      setCommand("");
    }
  }, [command, onAgentCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitCommand();
      }
    },
    [handleSubmitCommand]
  );

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-4 top-4 bg-white border border-neutral-200 rounded-lg shadow-sm p-3 hover:bg-neutral-50 transition-colors z-40"
        title="Show Agent Intelligence"
      >
        <Bot className="w-5 h-5 text-indigo-600" />
        {suggestions.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {suggestions.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-neutral-200 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Agent Intelligence</h3>
              <p className="text-[10px] text-neutral-500">
                {suggestions.length} suggestions
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Session Status */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-emerald-700 text-xs">
            <Users className="w-3.5 h-3.5" />
            <span className="font-medium">Collaborative session active</span>
          </div>
          <p className="text-[10px] text-emerald-600 mt-1">
            {MOCK_AGENTS.length} AI agents and {collaboratorCount} human{collaboratorCount !== 1 ? "s" : ""} monitoring
          </p>
        </div>
      </div>

      {/* Active Agents */}
      <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
        <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Active Agents
        </h4>
        <div className="flex gap-2">
          {MOCK_AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-md"
            >
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: agent.color }}
              />
              <span className="text-xs text-neutral-700">{agent.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
        <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Recent Activity
        </h4>
        <div className="space-y-2">
          {activities.slice(0, 3).map((activity) => (
            <div key={activity.id} className="flex items-start gap-2">
              <div
                className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] shrink-0 ${
                  activity.status === "completed" ? "bg-emerald-500" : "bg-indigo-500"
                }`}
              >
                {activity.status === "completed" ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-700 truncate">{activity.action}</p>
                <p className="text-[10px] text-neutral-400">
                  {activity.agentName} · {formatTimeAgo(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            AI Suggestions
          </h4>
          <button className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium">
            Refresh
          </button>
        </div>

        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const isExpanded = expandedSuggestion === suggestion.id;
            const typeIcon = suggestion.type === "warning" ? AlertTriangle : Sparkles;
            const TypeIcon = typeIcon;

            return (
              <div
                key={suggestion.id}
                className={`rounded-lg border transition-all ${
                  isExpanded
                    ? "border-indigo-200 bg-indigo-50/30 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <button
                  onClick={() => setExpandedSuggestion(isExpanded ? null : suggestion.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded shrink-0 ${
                      suggestion.type === "warning" ? "bg-amber-50" : "bg-indigo-50"
                    }`}>
                      <TypeIcon className={`w-3.5 h-3.5 ${
                        suggestion.type === "warning" ? "text-amber-600" : "text-indigo-600"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-neutral-500">
                          {suggestion.agentName}
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

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-neutral-100 mt-2 pt-3">
                    <p className="text-xs text-neutral-600 mb-3">
                      {suggestion.description}
                    </p>

                    {suggestion.code && (
                      <div className="bg-neutral-900 rounded-md p-3 mb-3 relative group">
                        <pre className="text-xs text-neutral-300 font-mono overflow-x-auto">
                          {suggestion.code}
                        </pre>
                        <button className="absolute top-2 right-2 p-1 bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSuggestionAccept?.(suggestion)}
                        className="flex-1 bg-indigo-600 text-white text-xs font-medium py-2 px-3 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </button>
                      <button
                        onClick={() => onSuggestionRefine?.(suggestion)}
                        className="flex-1 border border-neutral-200 text-neutral-700 text-xs font-medium py-2 px-3 rounded-md hover:bg-neutral-50 transition-colors"
                      >
                        Refine
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                      <button className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Visualize on Canvas
                      </button>
                      <div className="flex items-center gap-1">
                        <button className="p-1 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {suggestions.length === 0 && (
          <div className="py-8 text-center">
            <Sparkles className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No suggestions yet</p>
            <p className="text-xs text-neutral-400 mt-1">
              Agents are analyzing your proof
            </p>
          </div>
        )}
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-neutral-500 uppercase">Selected</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              NODE_TYPE_CONFIG[selectedNode.type]?.bgColor || "bg-neutral-100"
            } ${NODE_TYPE_CONFIG[selectedNode.type]?.color || "text-neutral-600"}`}>
              {NODE_TYPE_CONFIG[selectedNode.type]?.label || selectedNode.type}
            </span>
          </div>
          <p className="text-xs text-neutral-900 font-medium truncate">{selectedNode.title}</p>
        </div>
      )}

      {/* Command Input */}
      <div className="p-4 border-t border-neutral-100 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask agents to prove, verify, or search..."
            className="w-full px-3 py-2.5 pr-10 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleSubmitCommand}
            disabled={!command.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-indigo-600 disabled:opacity-50 disabled:hover:text-neutral-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <button className="text-[10px] text-neutral-500 hover:text-neutral-700 flex items-center gap-1">
              <Compass className="w-3 h-3" />
              Context
            </button>
            <button className="text-[10px] text-neutral-500 hover:text-neutral-700 flex items-center gap-1">
              <Settings className="w-3 h-3" />
              Config
            </button>
          </div>
          <span className="text-[9px] text-neutral-400">Powered by AI Agents</span>
        </div>
      </div>
    </div>
  );
}
