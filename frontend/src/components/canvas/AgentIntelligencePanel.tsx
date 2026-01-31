"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  AlertTriangle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Play,
  Loader2,
  Zap,
  FileCode,
  CheckCircle2,
  XCircle,
  Compass,
} from "lucide-react";
import { CanvasNode, AgentSuggestion, AgentActivity, NODE_TYPE_CONFIG } from "./types";
import {
  getOrchestrationStatus,
  exploreContext,
  critiqueProposal,
  formalizeText,
  verifyLeanCode,
  streamPipeline,
  StreamEvent,
  OrchestrationProposal,
} from "@/lib/api";

interface AgentIntelligencePanelProps {
  problemId: string;
  selectedNode: CanvasNode | null;
  collaboratorCount: number;
  isConnected: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onSuggestionAccept?: (suggestion: AgentSuggestion) => void;
  onSuggestionRefine?: (suggestion: AgentSuggestion) => void;
  onAgentCommand?: (command: string) => void;
  onCreateNode?: (data: { type: string; title: string; content: string; formula?: string }) => void;
}

interface PipelineStage {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "warning";
  data?: Record<string, unknown>;
}

const AGENT_PROFILES = [
  { id: "explorer", name: "Explorer", icon: Compass, color: "#10b981", description: "Propose mathematical directions" },
  { id: "critic", name: "Critic", icon: AlertTriangle, color: "#f59e0b", description: "Evaluate and critique proposals" },
  { id: "formalizer", name: "Formalizer", icon: FileCode, color: "#6366f1", description: "Convert to Lean 4 code" },
];

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function AgentIntelligencePanel({
  problemId,
  selectedNode,
  collaboratorCount,
  isConnected,
  collapsed,
  onToggle,
  onSuggestionAccept,
  onSuggestionRefine,
  onAgentCommand,
  onCreateNode,
}: AgentIntelligencePanelProps) {
  const [command, setCommand] = useState("");
  const [isOrchestrationAvailable, setIsOrchestrationAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [proposals, setProposals] = useState<OrchestrationProposal[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leanCode, setLeanCode] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; log: string } | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  // Check orchestration status on mount
  useEffect(() => {
    getOrchestrationStatus()
      .then((status) => setIsOrchestrationAvailable(status.available))
      .catch(() => setIsOrchestrationAvailable(false));
  }, []);

  const addActivity = useCallback((action: string, agentName: string, status: "pending" | "completed" | "failed") => {
    const activity: AgentActivity = {
      id: crypto.randomUUID(),
      agentId: agentName.toLowerCase(),
      agentName,
      action,
      timestamp: new Date(),
      status,
    };
    setActivities((prev) => [activity, ...prev].slice(0, 10));
  }, []);

  const handleExplore = useCallback(async () => {
    if (!command.trim() || !problemId) return;
    
    setIsLoading(true);
    setError(null);
    setProposals([]);
    addActivity(`Exploring: "${command.slice(0, 30)}..."`, "Explorer", "pending");
    
    try {
      const result = await exploreContext({
        problem_id: problemId,
        context: command,
        max_iterations: 3,
      });
      
      setProposals(result.proposals);
      addActivity(`Found ${result.proposals.length} proposals (best: ${(result.best_score * 100).toFixed(0)}%)`, "Explorer", "completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exploration failed");
      addActivity("Exploration failed", "Explorer", "failed");
    } finally {
      setIsLoading(false);
    }
  }, [command, problemId, addActivity]);

  const handleCritique = useCallback(async (proposal: OrchestrationProposal) => {
    if (!problemId) return;
    
    setIsLoading(true);
    addActivity(`Critiquing proposal...`, "Critic", "pending");
    
    try {
      const result = await critiqueProposal({
        problem_id: problemId,
        proposal: proposal.content,
      });
      
      addActivity(`Score: ${(result.score * 100).toFixed(0)}% - ${result.suggestions.length} suggestions`, "Critic", "completed");
      
      // Update proposal with critique
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposal.id
            ? { ...p, reasoning: `${p.reasoning}\n\n**Critique (${(result.score * 100).toFixed(0)}%):** ${result.feedback}` }
            : p
        )
      );
    } catch (err) {
      addActivity("Critique failed", "Critic", "failed");
    } finally {
      setIsLoading(false);
    }
  }, [problemId, addActivity]);

  const handleFormalize = useCallback(async (proposal: OrchestrationProposal) => {
    if (!problemId) return;
    
    setIsLoading(true);
    setLeanCode(null);
    addActivity(`Formalizing to Lean 4...`, "Formalizer", "pending");
    
    try {
      const result = await formalizeText({
        problem_id: problemId,
        text: proposal.content,
      });
      
      setLeanCode(result.lean_code);
      addActivity(`Formalized with ${(result.confidence * 100).toFixed(0)}% confidence`, "Formalizer", "completed");
    } catch (err) {
      addActivity("Formalization failed", "Formalizer", "failed");
    } finally {
      setIsLoading(false);
    }
  }, [problemId, addActivity]);

  const handleVerify = useCallback(async () => {
    if (!problemId || !leanCode) return;
    
    setIsLoading(true);
    setVerificationResult(null);
    addActivity("Verifying Lean 4 code...", "LeanRunner", "pending");
    
    try {
      const result = await verifyLeanCode({
        problem_id: problemId,
        lean_code: leanCode,
      });
      
      setVerificationResult({ success: result.success, log: result.log });
      addActivity(result.success ? "Verification passed" : "Verification failed", "LeanRunner", result.success ? "completed" : "failed");
    } catch (err) {
      addActivity("Verification error", "LeanRunner", "failed");
    } finally {
      setIsLoading(false);
    }
  }, [problemId, leanCode, addActivity]);

  const handleFullPipeline = useCallback(() => {
    if (!command.trim() || !problemId) return;
    
    setIsPipelineRunning(true);
    setError(null);
    setPipelineStages([
      { name: "explore", status: "pending" },
      { name: "critique", status: "pending" },
      { name: "formalize", status: "pending" },
      { name: "verify", status: "pending" },
    ]);
    
    const controller = streamPipeline(
      { problem_id: problemId, context: command, auto_publish: false },
      (event: StreamEvent) => {
        if (event.event === "stage_start") {
          setPipelineStages((prev) =>
            prev.map((s) => (s.name === event.stage ? { ...s, status: "running" } : s))
          );
          addActivity(`Running ${event.stage}...`, event.stage || "Pipeline", "pending");
        } else if (event.event === "stage_complete") {
          setPipelineStages((prev) =>
            prev.map((s) => (s.name === event.stage ? { ...s, status: "completed", data: event.data } : s))
          );
          addActivity(`${event.stage} completed`, event.stage || "Pipeline", "completed");
        } else if (event.event === "proposal" && event.data) {
          setProposals([{
            id: crypto.randomUUID(),
            content: String(event.data.content || ""),
            reasoning: "",
            score: Number(event.data.score || 0),
            iteration: 0,
          }]);
        } else if (event.event === "pipeline_end") {
          setIsPipelineRunning(false);
          addActivity(`Pipeline ${event.status}: ${event.message}`, "Pipeline", event.status === "completed" ? "completed" : "failed");
        } else if (event.event === "error") {
          setError(event.message || "Pipeline error");
          setIsPipelineRunning(false);
        }
      },
      (err) => {
        setError(err.message);
        setIsPipelineRunning(false);
      }
    );
    
    streamControllerRef.current = controller;
  }, [command, problemId, addActivity]);

  const handleStopPipeline = useCallback(() => {
    streamControllerRef.current?.abort();
    setIsPipelineRunning(false);
    addActivity("Pipeline stopped by user", "Pipeline", "failed");
  }, [addActivity]);

  const handleSubmitCommand = useCallback(() => {
    if (command.trim()) {
      if (onAgentCommand) {
        onAgentCommand(command.trim());
      } else {
        handleExplore();
      }
    }
  }, [command, onAgentCommand, handleExplore]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitCommand();
      }
    },
    [handleSubmitCommand]
  );

  const handleAcceptProposal = useCallback((proposal: OrchestrationProposal) => {
    if (onCreateNode) {
      onCreateNode({
        type: "LEMMA",
        title: proposal.content.slice(0, 50) + (proposal.content.length > 50 ? "..." : ""),
        content: proposal.content,
        formula: leanCode || undefined,
        leanCode: leanCode || undefined,
      });
    }
  }, [onCreateNode, leanCode]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="absolute right-4 top-4 bg-white border border-neutral-200 rounded-lg shadow-sm p-3 hover:bg-neutral-50 transition-colors z-40"
        title="Show Agent Intelligence"
      >
        <Bot className="w-5 h-5 text-indigo-600" />
        {proposals.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {proposals.length}
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
              <h3 className="text-sm font-semibold text-neutral-900">AI Orchestrator</h3>
              <p className="text-[10px] text-neutral-500">
                {isOrchestrationAvailable ? "Connected" : "Unavailable"}
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

        {/* Status */}
        <div className={`border rounded-lg px-3 py-2 ${isOrchestrationAvailable ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          <div className={`flex items-center gap-2 text-xs ${isOrchestrationAvailable ? "text-emerald-700" : "text-amber-700"}`}>
            {isOrchestrationAvailable ? <Zap className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span className="font-medium">
              {isOrchestrationAvailable ? "AI agents ready" : "Configure GEMINI_API_KEY"}
            </span>
          </div>
          <p className={`text-[10px] mt-1 ${isOrchestrationAvailable ? "text-emerald-600" : "text-amber-600"}`}>
            {isOrchestrationAvailable
              ? `${AGENT_PROFILES.length} agents + ${collaboratorCount} collaborator${collaboratorCount !== 1 ? "s" : ""}`
              : "Set environment variable to enable AI"}
          </p>
        </div>
      </div>

      {/* Active Agents */}
      <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
        <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Available Agents
        </h4>
        <div className="flex flex-wrap gap-2">
          {AGENT_PROFILES.map((agent) => {
            const Icon = agent.icon;
            return (
              <div
                key={agent.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-md"
                title={agent.description}
              >
                <Icon className="w-3 h-3" style={{ color: agent.color }} />
                <span className="text-xs text-neutral-700">{agent.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Progress */}
      {pipelineStages.length > 0 && (
        <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
              Pipeline Progress
            </h4>
            {isPipelineRunning && (
              <button
                onClick={handleStopPipeline}
                className="text-[10px] text-red-600 hover:text-red-700 font-medium"
              >
                Stop
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {pipelineStages.map((stage) => (
              <div
                key={stage.name}
                className={`flex-1 h-1.5 rounded-full ${
                  stage.status === "completed" ? "bg-emerald-500" :
                  stage.status === "running" ? "bg-indigo-500 animate-pulse" :
                  stage.status === "failed" ? "bg-red-500" :
                  stage.status === "warning" ? "bg-amber-500" :
                  "bg-neutral-200"
                }`}
                title={`${stage.name}: ${stage.status}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {pipelineStages.map((stage) => (
              <span key={stage.name} className="text-[9px] text-neutral-400 capitalize">
                {stage.name.slice(0, 3)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
        <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Recent Activity
        </h4>
        <div className="space-y-2 max-h-24 overflow-y-auto">
          {activities.length === 0 ? (
            <p className="text-xs text-neutral-400">No activity yet</p>
          ) : (
            activities.slice(0, 4).map((activity) => (
              <div key={activity.id} className="flex items-start gap-2">
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] shrink-0 ${
                    activity.status === "completed" ? "bg-emerald-500" :
                    activity.status === "failed" ? "bg-red-500" :
                    "bg-indigo-500"
                  }`}
                >
                  {activity.status === "completed" ? (
                    <Check className="w-3 h-3" />
                  ) : activity.status === "failed" ? (
                    <XCircle className="w-3 h-3" />
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
            ))
          )}
        </div>
      </div>

      {/* Proposals / Suggestions */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            AI Proposals
          </h4>
          {proposals.length > 0 && (
            <button
              onClick={() => setProposals([])}
              className="text-[10px] text-neutral-500 hover:text-neutral-700"
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {proposals.map((proposal) => {
            const isExpanded = expandedProposal === proposal.id;
            return (
              <div
                key={proposal.id}
                className={`rounded-lg border transition-all ${
                  isExpanded
                    ? "border-indigo-200 bg-indigo-50/30 shadow-sm"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <button
                  onClick={() => setExpandedProposal(isExpanded ? null : proposal.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 rounded shrink-0 bg-indigo-50">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-neutral-500">Explorer</span>
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${proposal.score * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-neutral-400">
                            {(proposal.score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-neutral-900 line-clamp-2">
                        {proposal.content}
                      </p>
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
                    <p className="text-xs text-neutral-600 mb-3 whitespace-pre-wrap">
                      {proposal.reasoning || proposal.content}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <button
                        onClick={() => handleCritique(proposal)}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 disabled:opacity-50"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Critique
                      </button>
                      <button
                        onClick={() => handleFormalize(proposal)}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 disabled:opacity-50"
                      >
                        <FileCode className="w-3 h-3" />
                        Formalize
                      </button>
                    </div>

                    {leanCode && (
                      <div className="mb-3">
                        <div className="bg-neutral-900 rounded-md p-3 relative group">
                          <pre className="text-xs text-neutral-300 font-mono overflow-x-auto whitespace-pre-wrap">
                            {leanCode}
                          </pre>
                          <button
                            onClick={() => navigator.clipboard.writeText(leanCode)}
                            className="absolute top-2 right-2 p-1 bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={handleVerify}
                          disabled={isLoading}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Verify with Lean 4
                        </button>
                      </div>
                    )}

                    {verificationResult && (
                      <div className={`mb-3 p-2 rounded-lg ${verificationResult.success ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${verificationResult.success ? "text-emerald-700" : "text-red-700"}`}>
                          {verificationResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {verificationResult.success ? "Verification Passed" : "Verification Failed"}
                        </div>
                        {verificationResult.log && (
                          <pre className="mt-2 text-[10px] text-neutral-600 font-mono overflow-x-auto">
                            {verificationResult.log}
                          </pre>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptProposal(proposal)}
                        className="flex-1 bg-indigo-600 text-white text-xs font-medium py-2 px-3 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Add to Canvas
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
                      <span className="text-[10px] text-neutral-500">
                        Iteration {proposal.iteration}
                      </span>
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

        {proposals.length === 0 && !isLoading && (
          <div className="py-8 text-center">
            <Sparkles className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No proposals yet</p>
            <p className="text-xs text-neutral-400 mt-1">
              Enter a mathematical statement below
            </p>
          </div>
        )}

        {isLoading && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-neutral-500">AI is thinking...</p>
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
          <button
            onClick={() => setCommand(selectedNode.content || selectedNode.title)}
            className="mt-2 text-[10px] text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Use as context →
          </button>
        </div>
      )}

      {/* Command Input */}
      <div className="p-4 border-t border-neutral-100 shrink-0">
        <div className="relative">
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter mathematical statement to explore..."
            rows={2}
            className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleExplore}
            disabled={!command.trim() || isLoading || !isOrchestrationAvailable}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
            Explore
          </button>
          <button
            onClick={handleFullPipeline}
            disabled={!command.trim() || isPipelineRunning || !isOrchestrationAvailable}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Run full pipeline: Explore → Critique → Formalize → Verify"
          >
            {isPipelineRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Pipeline
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-neutral-400">
            {isOrchestrationAvailable ? "Powered by Gemini" : "AI unavailable"}
          </span>
        </div>
      </div>
    </div>
  );
}
