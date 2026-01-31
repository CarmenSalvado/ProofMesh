"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  X,
  Compass,
  FileCode,
  Loader2,
  Lightbulb,
  Copy,
  Check,
  Plus,
  Command,
  Image as ImageIcon,
  Target,
  Play,
  Zap,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { CanvasNode, NODE_TYPE_CONFIG } from "./types";
import {
  getOrchestrationStatus,
  exploreContext,
  formalizeText,
  verifyLeanCode,
  critiqueProposal,
} from "@/lib/api";

interface FloatingInsight {
  id: string;
  type: "insight" | "proposal" | "critique" | "code";
  title: string;
  content: string;
  nodeRef?: string;
  score?: number;
  timestamp: Date;
}

interface ContextNode {
  id: string;
  title: string;
  type: string;
}

interface FloatingAIBarProps {
  problemId: string;
  selectedNode: CanvasNode | null;
  selectedNodes?: CanvasNode[];
  isVisible: boolean;
  onToggle: () => void;
  onCreateNode?: (data: { type: string; title: string; content: string; formula?: string; x?: number; y?: number; dependencies?: string[] }) => void;
  onUpdateNode?: (nodeId: string, updates: { formula?: string; leanCode?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED" }) => void;
}

export function FloatingAIBar({
  problemId,
  selectedNode,
  selectedNodes = [],
  isVisible,
  onToggle,
  onCreateNode,
  onUpdateNode,
}: FloatingAIBarProps) {
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<FloatingInsight[]>([]);
  const [isOrchestrationAvailable, setIsOrchestrationAvailable] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [contextNodes, setContextNodes] = useState<ContextNode[]>([]);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [currentLeanCode, setCurrentLeanCode] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; log: string } | null>(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check orchestration status
  useEffect(() => {
    getOrchestrationStatus()
      .then((status) => setIsOrchestrationAvailable(status.available))
      .catch(() => setIsOrchestrationAvailable(false));
  }, []);

  // Manual add context - user clicks to add selected nodes
  const handleAddContext = useCallback(() => {
    if (selectedNode && !contextNodes.find(n => n.id === selectedNode.id)) {
      setContextNodes(prev => [...prev, {
        id: selectedNode.id,
        title: selectedNode.title,
        type: selectedNode.type,
      }]);
    }
  }, [selectedNode, contextNodes]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onToggle();
      }
      if (e.key === "Escape" && isVisible) {
        onToggle();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, onToggle]);

  const addInsight = useCallback((insight: Omit<FloatingInsight, "id" | "timestamp">) => {
    const newInsight: FloatingInsight = {
      ...insight,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setInsights((prev) => [newInsight, ...prev].slice(0, 5));
  }, []);

  const handleExplore = useCallback(async () => {
    if (!command.trim() || !problemId) return;

    setIsLoading(true);
    setActiveAction("explore");

    try {
      // Build rich context including node content
      let contextStr = "";
      if (contextNodes.length > 0) {
        const contextDetails = contextNodes.map(n => {
          const fullNode = selectedNode?.id === n.id ? selectedNode : selectedNodes.find(sn => sn.id === n.id);
          const content = fullNode?.content ? ` - ${fullNode.content}` : "";
          return `${n.title} (${n.type})${content}`;
        }).join("\n");
        contextStr = `Context nodes:\n${contextDetails}\n\n`;
      }

      const result = await exploreContext({
        problem_id: problemId,
        context: contextStr + command,
        max_iterations: 3,
      });

      // Calculate base position for new nodes
      const baseX = selectedNode?.x ?? 400;
      const baseY = selectedNode?.y ?? 300;
      const dependencyIds = contextNodes.map(n => n.id);

      // Create one node per proposal
      result.proposals.forEach((proposal, index) => {
        // Add as insight for display
        addInsight({
          type: "proposal",
          title: `Proposal ${index + 1}`,
          content: proposal.content,
          score: proposal.score,
        });

        // Auto-create a canvas node for each proposal
        if (onCreateNode) {
          // Fan out positions for multiple proposals
          const angle = ((index - (result.proposals.length - 1) / 2) * 45) * (Math.PI / 180);
          const distance = 300;
          const nodeX = baseX + Math.sin(angle) * distance;
          const nodeY = baseY + distance * 0.7;

          // Format content with confidence score
          const confidencePercent = Math.round(proposal.score * 100);
          const nodeContent = `**Confidence: ${confidencePercent}%**\n\n${proposal.content}\n\n---\n*Reasoning: ${proposal.reasoning}*`;

          onCreateNode({
            type: "NOTE",
            title: proposal.content.slice(0, 60) + (proposal.content.length > 60 ? "..." : ""),
            content: nodeContent,
            x: nodeX,
            y: nodeY,
            dependencies: dependencyIds,
          });
        }
      });

      setCommand("");
      // Clear context after creating nodes
      setContextNodes([]);
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Error",
        content: err instanceof Error ? err.message : "Exploration failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [command, problemId, contextNodes, selectedNode, selectedNodes, addInsight, onCreateNode]);

  const handleQuickInsight = useCallback(async () => {
    if (contextNodes.length === 0) return;

    setIsLoading(true);
    setActiveAction("insight");

    const node = contextNodes[0];
    addInsight({
      type: "insight",
      title: "Quick Insight",
      content: `Node "${node.title}" is a ${NODE_TYPE_CONFIG[node.type]?.label || node.type}. ${node.type === "AXIOM" ? "This serves as a foundational assumption." :
        node.type === "LEMMA" ? "This is a helper result for proving larger theorems." :
          node.type === "THEOREM" ? "This represents a main result in the proof." :
            node.type === "DEFINITION" ? "This establishes key terminology." :
              "This is part of the proof structure."
        }`,
      nodeRef: node.id,
    });

    setIsLoading(false);
    setActiveAction(null);
  }, [contextNodes, addInsight]);

  const handleFormalize = useCallback(async () => {
    if (contextNodes.length === 0 || !problemId) return;

    setIsLoading(true);
    setActiveAction("formalize");

    try {
      const node = contextNodes[0];
      const nodeContent = selectedNode?.id === node.id ? selectedNode?.content : "";
      const result = await formalizeText({
        problem_id: problemId,
        text: `${node.title}: ${nodeContent || ""}`,
      });

      setCurrentLeanCode(result.lean_code);

      // Update the node's leanCode field if we have onUpdateNode
      if (onUpdateNode && selectedNode) {
        onUpdateNode(selectedNode.id, { leanCode: result.lean_code });
        addInsight({
          type: "code",
          title: "✓ Lean Code Added to Node",
          content: result.lean_code,
          score: result.confidence,
          nodeRef: node.id,
        });
      } else {
        addInsight({
          type: "code",
          title: "Lean 4 Code",
          content: result.lean_code,
          score: result.confidence,
          nodeRef: node.id,
        });
      }
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Error",
        content: err instanceof Error ? err.message : "Formalization failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [contextNodes, selectedNode, problemId, addInsight, onUpdateNode]);

  const handleVerify = useCallback(async () => {
    if (!currentLeanCode || !problemId) return;

    setIsLoading(true);
    setActiveAction("verify");
    setVerificationResult(null);

    try {
      const result = await verifyLeanCode({
        problem_id: problemId,
        lean_code: currentLeanCode,
      });

      setVerificationResult({ success: result.success, log: result.log });
      addInsight({
        type: "insight",
        title: result.success ? "✓ Verification Passed" : "✗ Verification Failed",
        content: result.log || (result.success ? "Lean code verified successfully!" : "Verification failed"),
        score: result.success ? 1 : 0,
      });
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Verification Error",
        content: err instanceof Error ? err.message : "Verification failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [currentLeanCode, problemId, addInsight]);

  const handleFullPipeline = useCallback(async () => {
    if (!command.trim() && contextNodes.length === 0) return;
    if (!problemId) return;

    setIsPipelineRunning(true);
    setActiveAction("pipeline");
    setVerificationResult(null);
    setCurrentLeanCode(null);

    try {
      // Step 1: Explore
      addInsight({ type: "insight", title: "🔄 Pipeline: Exploring...", content: "Generating proposals..." });

      let contextStr = command.trim();
      if (contextNodes.length > 0) {
        const contextDetails = contextNodes.map(n => {
          const fullNode = selectedNode?.id === n.id ? selectedNode : selectedNodes.find(sn => sn.id === n.id);
          return `${n.title} (${n.type})${fullNode?.content ? `: ${fullNode.content}` : ""}`;
        }).join("\n");
        contextStr = contextDetails + (contextStr ? `\n\n${contextStr}` : "");
      }

      const exploration = await exploreContext({
        problem_id: problemId,
        context: contextStr,
        max_iterations: 3,
      });

      if (!exploration.proposals || exploration.proposals.length === 0) {
        addInsight({ type: "insight", title: "Pipeline Failed", content: "No proposals generated" });
        return;
      }

      const bestProposal = exploration.proposals[0];
      addInsight({ type: "proposal", title: "Proposal Generated", content: bestProposal.content, score: bestProposal.score });

      // Step 2: Critique
      addInsight({ type: "insight", title: "🔄 Pipeline: Critiquing...", content: "Evaluating proposal..." });

      const critique = await critiqueProposal({
        problem_id: problemId,
        proposal: bestProposal.content,
      });

      addInsight({ type: "insight", title: "Critique Complete", content: critique.feedback, score: critique.score });

      // Step 3: Formalize
      addInsight({ type: "insight", title: "🔄 Pipeline: Formalizing...", content: "Converting to Lean 4..." });

      const formalization = await formalizeText({
        problem_id: problemId,
        text: bestProposal.content,
      });

      setCurrentLeanCode(formalization.lean_code);
      addInsight({ type: "code", title: "Lean 4 Code", content: formalization.lean_code, score: formalization.confidence });

      // Step 4: Verify
      addInsight({ type: "insight", title: "🔄 Pipeline: Verifying...", content: "Running Lean 4 verification..." });

      const verification = await verifyLeanCode({
        problem_id: problemId,
        lean_code: formalization.lean_code,
      });

      setVerificationResult({ success: verification.success, log: verification.log });

      // Final result
      if (verification.success) {
        addInsight({
          type: "insight",
          title: "✅ Pipeline Complete!",
          content: `Proof verified successfully!\n\nScore: ${(critique.score * 100).toFixed(0)}%\nConfidence: ${(formalization.confidence * 100).toFixed(0)}%`,
          score: 1,
        });

        // Update the selected node's leanCode field instead of creating a new node
        if (onUpdateNode && contextNodes.length > 0) {
          const targetNodeId = contextNodes[0].id;
          onUpdateNode(targetNodeId, { leanCode: formalization.lean_code, status: "VERIFIED" });
          addInsight({
            type: "insight",
            title: "✓ Node Updated",
            content: `Lean code added to "${contextNodes[0].title}" and marked as Verified.`,
          });
        } else if (onCreateNode) {
          // Fallback: create new node if no context node selected
          const baseX = selectedNode?.x ?? 400;
          const baseY = selectedNode?.y ?? 300;
          onCreateNode({
            type: "LEMMA",
            title: bestProposal.content.slice(0, 60) + (bestProposal.content.length > 60 ? "..." : ""),
            content: `**Verified ✓**\n\n${bestProposal.content}\n\n---\n*Confidence: ${(formalization.confidence * 100).toFixed(0)}%*`,
            formula: formalization.lean_code,
            x: baseX,
            y: baseY + 200,
            dependencies: contextNodes.map(n => n.id),
          });
        }
      } else {
        addInsight({
          type: "insight",
          title: "⚠️ Verification Failed",
          content: verification.log || "Lean verification failed. The code may need adjustments.",
          score: 0,
        });
      }

      setCommand("");
      setContextNodes([]);
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Pipeline Error",
        content: err instanceof Error ? err.message : "Pipeline failed",
      });
    } finally {
      setIsPipelineRunning(false);
      setActiveAction(null);
    }
  }, [command, contextNodes, selectedNode, selectedNodes, problemId, addInsight, onCreateNode, onUpdateNode]);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleDismissInsight = useCallback((id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleCreateFromInsight = useCallback((insight: FloatingInsight) => {
    if (!onCreateNode) return;

    onCreateNode({
      type: insight.type === "code" ? "LEMMA" : "NOTE",
      title: insight.title,
      content: insight.content,
      dependencies: [],
    });

    handleDismissInsight(insight.id);
  }, [onCreateNode, handleDismissInsight]);

  const handleRemoveContext = useCallback((id: string) => {
    setContextNodes(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleImageAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedImages(prev => [...prev, ...files].slice(0, 3));
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  if (!isVisible) {
    return (
      <>
        {/* Floating toggle button - minimal pill */}
        <button
          onClick={onToggle}
          onDoubleClick={(e) => e.stopPropagation()}
          className="fixed bottom-24 left-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-xl text-neutral-700 rounded-full shadow-lg shadow-black/5 hover:bg-white hover:shadow-xl transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Sparkles className="w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          <span className="text-sm font-medium">AI</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
            ⌘K
          </kbd>
        </button>

        {/* Floating insights remain visible */}
        <FloatingInsights
          insights={insights}
          onDismiss={handleDismissInsight}
          onCopy={handleCopy}
          onCreateNode={handleCreateFromInsight}
          copied={copied}
        />
      </>
    );
  }

  return (
    <>
      {/* Command Bar - clean floating design */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-none"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/10 overflow-hidden pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Context nodes */}
          {contextNodes.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
              <Target className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              {contextNodes.map((node) => (
                <span
                  key={node.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-neutral-100 rounded-full text-neutral-600 flex-shrink-0"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${NODE_TYPE_CONFIG[node.type]?.color.replace("text-", "bg-") || "bg-neutral-400"}`} />
                  <span className="max-w-[100px] truncate">{node.title}</span>
                  <button
                    onClick={() => handleRemoveContext(node.id)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add selected node to context button */}
          {selectedNode && !contextNodes.find(n => n.id === selectedNode.id) && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-100">
              <button
                onClick={handleAddContext}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 rounded-full text-indigo-600 transition-colors flex-shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span className={`w-1.5 h-1.5 rounded-full ${NODE_TYPE_CONFIG[selectedNode.type]?.color.replace("text-", "bg-") || "bg-neutral-400"}`} />
                <span className="max-w-[120px] truncate">Add "{selectedNode.title}"</span>
              </button>
            </div>
          )}

          {/* Attached images preview */}
          {attachedImages.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2">
              {attachedImages.map((file, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Attachment ${index + 1}`}
                    className="w-12 h-12 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Input */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Sparkles className="w-5 h-5 text-neutral-400 flex-shrink-0" />

            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleExplore();
                }
              }}
              placeholder={contextNodes.length > 0 ? `Ask about ${contextNodes[0].title}...` : "Ask anything..."}
              className="flex-1 text-sm bg-transparent outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:border-none placeholder:text-neutral-400 text-neutral-800"
              disabled={isLoading}
              autoFocus
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-center gap-0.5">
              <button
                onClick={handleImageAttach}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full transition-colors"
                title="Attach image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {isLoading ? (
                <div className="p-2">
                  <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                </div>
              ) : (
                <button
                  onClick={handleExplore}
                  disabled={!command.trim()}
                  className="p-2 text-neutral-500 hover:text-neutral-700 rounded-full transition-colors disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onToggle}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Actions - minimal bottom bar */}
          <div className="flex items-center gap-1 px-4 py-2 bg-neutral-50/50">
            <QuickActionButton
              icon={Compass}
              label="Explore"
              onClick={handleExplore}
              disabled={!command.trim() || isLoading}
              active={activeAction === "explore"}
            />

            <QuickActionButton
              icon={Lightbulb}
              label="Insight"
              onClick={handleQuickInsight}
              disabled={contextNodes.length === 0 || isLoading}
              active={activeAction === "insight"}
            />

            <QuickActionButton
              icon={FileCode}
              label="Formalize"
              onClick={handleFormalize}
              disabled={contextNodes.length === 0 || !isOrchestrationAvailable || isLoading}
              active={activeAction === "formalize"}
            />

            <QuickActionButton
              icon={Play}
              label="Verify"
              onClick={handleVerify}
              disabled={!currentLeanCode || !isOrchestrationAvailable || isLoading}
              active={activeAction === "verify"}
            />

            <div className="w-px h-4 bg-neutral-200 mx-1" />

            <QuickActionButton
              icon={Zap}
              label="Pipeline"
              onClick={handleFullPipeline}
              disabled={(!command.trim() && contextNodes.length === 0) || !isOrchestrationAvailable || isLoading || isPipelineRunning}
              active={activeAction === "pipeline"}
            />

            <div className="flex-1" />

            {verificationResult && (
              <span className={`flex items-center gap-1 text-[10px] ${verificationResult.success ? "text-emerald-600" : "text-red-500"}`}>
                {verificationResult.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {verificationResult.success ? "Verified" : "Failed"}
              </span>
            )}

            <span className="text-[10px] text-neutral-400">
              esc
            </span>
          </div>
        </div>
      </div>

      {/* Floating Insights */}
      <FloatingInsights
        insights={insights}
        onDismiss={handleDismissInsight}
        onCopy={handleCopy}
        onCreateNode={handleCreateFromInsight}
        copied={copied}
      />
    </>
  );
}

interface QuickActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

function QuickActionButton({ icon: Icon, label, onClick, disabled, active }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full transition-colors ${active
        ? "text-neutral-800 bg-neutral-200"
        : disabled
          ? "text-neutral-300 cursor-not-allowed"
          : "text-neutral-500 hover:text-neutral-700"
        }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

interface FloatingInsightsProps {
  insights: FloatingInsight[];
  onDismiss: (id: string) => void;
  onCopy: (id: string, content: string) => void;
  onCreateNode: (insight: FloatingInsight) => void;
  copied: string | null;
}

function FloatingInsights({ insights, onDismiss, onCopy, onCreateNode, copied }: FloatingInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-2 max-w-sm pointer-events-none">
      {insights.map((insight, index) => (
        <div
          key={insight.id}
          className="bg-white/90 backdrop-blur-xl rounded-xl shadow-xl shadow-black/10 overflow-hidden animate-in slide-in-from-right duration-300 pointer-events-auto"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              {insight.type === "proposal" && <Compass className="w-3.5 h-3.5 text-blue-500" />}
              {insight.type === "insight" && <Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
              {insight.type === "code" && <FileCode className="w-3.5 h-3.5 text-emerald-500" />}
              <span className="text-sm font-medium text-neutral-800">{insight.title}</span>
              {insight.score !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${insight.score > 0.7 ? "bg-emerald-100 text-emerald-600" :
                  insight.score > 0.4 ? "bg-amber-100 text-amber-600" :
                    "bg-neutral-100 text-neutral-500"
                  }`}>
                  {(insight.score * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <button
              onClick={() => onDismiss(insight.id)}
              className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-3 pb-2">
            {insight.type === "code" ? (
              <pre className="text-xs text-neutral-700 font-mono bg-neutral-100 rounded-lg p-2 overflow-x-auto max-h-32">
                {insight.content}
              </pre>
            ) : (
              <p className="text-xs text-neutral-600 leading-relaxed line-clamp-3">
                {insight.content}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 px-3 py-2 bg-neutral-50/50">
            <button
              onClick={() => onCopy(insight.id, insight.content)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-700 rounded-full transition-colors"
            >
              {copied === insight.id ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={() => onCreateNode(insight)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:text-neutral-800 rounded-full transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
