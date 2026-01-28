"use client";

import { useState, useEffect, useCallback, memo } from "react";
import {
  Plus,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
  Lightbulb,
  Check,
  AlertTriangle,
} from "lucide-react";
import { CanvasNode, NODE_TYPE_CONFIG } from "./types";
import { exploreContext, OrchestrationProposal } from "@/lib/api";

type NodeType = keyof typeof NODE_TYPE_CONFIG;

interface GhostNode {
  id: string;
  sourceNodeId: string;
  proposal: OrchestrationProposal;
  suggestedType: NodeType;
  position: { x: number; y: number };
}

interface CanvasAIOverlayProps {
  problemId: string;
  nodes: CanvasNode[];
  selectedNode: CanvasNode | null;
  zoom: number;
  pan: { x: number; y: number };
  enabled: boolean;
  onCreateNode: (data: {
    type: string;
    title: string;
    content: string;
    position: { x: number; y: number };
    parentId?: string;
  }) => void;
  onDismiss: () => void;
}

// Calculate position for ghost node relative to source
function calculateGhostPosition(
  sourceNode: CanvasNode,
  index: number,
  total: number
): { x: number; y: number } {
  const spacing = 200;
  const baseAngle = -Math.PI / 4; // Start at -45 degrees
  const angleStep = (Math.PI / 2) / Math.max(total - 1, 1); // Spread over 90 degrees
  const angle = baseAngle + index * angleStep;
  
  return {
    x: sourceNode.x + Math.cos(angle) * spacing + 150,
    y: sourceNode.y + Math.sin(angle) * spacing,
  };
}

// Infer node type from proposal content
function inferNodeType(proposal: OrchestrationProposal): NodeType {
  const content = proposal.content.toLowerCase();
  
  if (content.includes("lemma") || content.includes("prove that")) {
    return "LEMMA";
  }
  if (content.includes("theorem")) {
    return "THEOREM";
  }
  if (content.includes("definition") || content.includes("define")) {
    return "DEFINITION";
  }
  if (content.includes("proof") || content.includes("∎")) {
    return "PROOF";
  }
  if (content.includes("conjecture") || content.includes("hypothesis")) {
    return "CONJECTURE";
  }
  if (content.includes("example") || content.includes("counter-example")) {
    return "EXAMPLE";
  }
  if (content.includes("note") || content.includes("remark")) {
    return "REMARK";
  }
  
  return "LEMMA"; // Default
}

// Ghost Node Component
const GhostNodeComponent = memo(function GhostNodeComponent({
  ghost,
  zoom,
  onAccept,
  onDismiss,
}: {
  ghost: GhostNode;
  zoom: number;
  onAccept: (ghost: GhostNode) => void;
  onDismiss: (id: string) => void;
}) {
  const config = NODE_TYPE_CONFIG[ghost.suggestedType] || NODE_TYPE_CONFIG.LEMMA;
  
  return (
    <div
      className="absolute transition-all duration-300 animate-fadeIn"
      style={{
        left: ghost.position.x,
        top: ghost.position.y,
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
      }}
    >
      {/* Connection line to source */}
      <svg
        className="absolute pointer-events-none"
        style={{
          left: -200,
          top: 0,
          width: 200,
          height: 100,
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id={`ghost-gradient-${ghost.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(99 102 241 / 0.2)" />
            <stop offset="100%" stopColor="rgb(99 102 241 / 0.5)" />
          </linearGradient>
        </defs>
        <path
          d="M 0 50 Q 100 50, 180 30"
          fill="none"
          stroke={`url(#ghost-gradient-${ghost.id})`}
          strokeWidth="2"
          strokeDasharray="6 4"
          className="animate-dash"
        />
        <circle cx="180" cy="30" r="4" fill="rgb(99 102 241 / 0.5)" />
      </svg>
      
      {/* Ghost node card */}
      <div
        className={`w-64 rounded-xl border-2 border-dashed backdrop-blur-sm transition-all duration-200 hover:border-solid hover:shadow-lg ${config.bgColor} ${config.borderColor} opacity-80 hover:opacity-100`}
      >
        <div className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className={`text-xs font-medium ${config.color}`}>
                {config.label} (Suggested)
              </span>
            </div>
            <button
              onClick={() => onDismiss(ghost.id)}
              className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-white/50 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          {/* Content preview */}
          <p className="text-sm text-neutral-700 line-clamp-3 mb-3">
            {ghost.proposal.content}
          </p>
          
          {/* Confidence indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${ghost.proposal.score * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-500">
              {(ghost.proposal.score * 100).toFixed(0)}%
            </span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAccept(ghost)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Add Node
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export function CanvasAIOverlay({
  problemId,
  nodes,
  selectedNode,
  zoom,
  pan,
  enabled,
  onCreateNode,
  onDismiss,
}: CanvasAIOverlayProps) {
  const [ghostNodes, setGhostNodes] = useState<GhostNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Generate suggestions when a node is selected
  useEffect(() => {
    if (!enabled || !selectedNode || !problemId) {
      setGhostNodes([]);
      return;
    }
    
    const generateSuggestions = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const context = `Based on this ${NODE_TYPE_CONFIG[selectedNode.type]?.label || "node"}: "${selectedNode.title}"\nContent: ${selectedNode.content || "No content"}\nSuggest 2-3 related mathematical concepts, lemmas, or next steps in the proof.`;
        
        const result = await exploreContext({
          problem_id: problemId,
          context,
          max_iterations: 2,
        });
        
        const newGhosts: GhostNode[] = result.proposals.slice(0, 3).map((proposal, index) => ({
          id: crypto.randomUUID(),
          sourceNodeId: selectedNode.id,
          proposal,
          suggestedType: inferNodeType(proposal),
          position: calculateGhostPosition(selectedNode, index, Math.min(result.proposals.length, 3)),
        }));
        
        setGhostNodes(newGhosts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate suggestions");
        setGhostNodes([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Debounce suggestion generation
    const timeoutId = setTimeout(generateSuggestions, 500);
    return () => clearTimeout(timeoutId);
  }, [enabled, selectedNode, problemId]);
  
  const handleAcceptGhost = useCallback((ghost: GhostNode) => {
    onCreateNode({
      type: ghost.suggestedType,
      title: ghost.proposal.content.slice(0, 50) + (ghost.proposal.content.length > 50 ? "..." : ""),
      content: ghost.proposal.content,
      position: ghost.position,
      parentId: ghost.sourceNodeId,
    });
    
    // Remove the accepted ghost
    setGhostNodes((prev) => prev.filter((g) => g.id !== ghost.id));
  }, [onCreateNode]);
  
  const handleDismissGhost = useCallback((id: string) => {
    setGhostNodes((prev) => prev.filter((g) => g.id !== id));
  }, []);
  
  if (!enabled) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Ghost nodes container - follows canvas pan */}
      <div
        className="absolute pointer-events-auto"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}
      >
        {ghostNodes.map((ghost) => (
          <GhostNodeComponent
            key={ghost.id}
            ghost={ghost}
            zoom={zoom}
            onAccept={handleAcceptGhost}
            onDismiss={handleDismissGhost}
          />
        ))}
      </div>
      
      {/* Loading indicator */}
      {isLoading && selectedNode && (
        <div
          className="absolute flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm border border-neutral-200 rounded-full shadow-sm"
          style={{
            left: (selectedNode.x + 150) * zoom + pan.x,
            top: (selectedNode.y - 40) * zoom + pan.y,
          }}
        >
          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          <span className="text-xs text-neutral-600">Generating suggestions...</span>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg shadow-sm">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 text-red-500 hover:text-red-700"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      
      {/* AI toggle indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-full shadow-lg">
        <Sparkles className="w-4 h-4" />
        <span className="text-xs font-medium">AI Suggestions Active</span>
        <button
          onClick={onDismiss}
          className="p-0.5 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// CSS for animations (add to globals.css)
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(10px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// @keyframes dash {
//   to { stroke-dashoffset: -20; }
// }
// .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
// .animate-dash { animation: dash 1s linear infinite; }
