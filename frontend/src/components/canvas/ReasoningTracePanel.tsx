"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  Search,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Eye,
} from "lucide-react";
import { getReasoningTraces, connectReasoningStreamWebSocket, type ReasoningTraceStep } from "@/lib/api";

interface ReasoningChunk {
  type: string;
  content?: string;
  step_number?: number;
  kg_nodes_used?: string[];
}

interface ReasoningStep extends ReasoningTraceStep {
  agent_name?: string;
}

interface ReasoningTracePanelProps {
  runId: string;
  isActive: boolean;
  onClose?: () => void;
}

const stepTypeConfig: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  thinking: {
    icon: Brain,
    label: "Thinking",
    color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  },
  retrieval: {
    icon: Search,
    label: "Knowledge Retrieval",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  generation: {
    icon: Sparkles,
    label: "Generating",
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  verification: {
    icon: CheckCircle,
    label: "Verifying",
    color: "text-green-500 bg-green-500/10 border-green-500/30",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    color: "text-red-500 bg-red-500/10 border-red-500/30",
  },
};

export function ReasoningTracePanel({
  runId,
  isActive,
  onClose,
}: ReasoningTracePanelProps) {
  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentStepType, setCurrentStepType] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsConnectionRef = useRef<{ close: () => void } | null>(null);

  // Load initial traces
  useEffect(() => {
    const loadTraces = async () => {
      try {
        const traces = await getReasoningTraces(runId);
        setSteps(traces);
        // Expand last step by default
        if (traces.length > 0) {
          setExpandedSteps(new Set([traces.length - 1]));
        }
      } catch (error) {
        console.error("Failed to load reasoning traces:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTraces();
  }, [runId]);

  // Connect to streaming WebSocket if run is active
  useEffect(() => {
    if (!isActive) return;

    const connection = connectReasoningStreamWebSocket(
      runId,
      (chunk) => {
        if (chunk.type) {
          if (chunk.type === "complete") {
            // Reset streaming state and reload traces
            setStreamingContent("");
            setCurrentStepType(null);
            getReasoningTraces(runId).then((traces) => {
              setSteps(traces);
            });
          } else if (chunk.type === "error") {
            setCurrentStepType("error");
            if (chunk.content) {
              setStreamingContent(chunk.content);
            }
          } else {
            setCurrentStepType(chunk.type);
            if (chunk.content) {
              setStreamingContent((prev) => prev + chunk.content);
            }
          }
        }
      },
      (error) => {
        console.error("WebSocket error:", error);
      }
    );

    wsConnectionRef.current = connection;

    return () => {
      connection.close();
    };
  }, [runId, isActive]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingContent, steps]);

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      return newSet;
    });
  };

  const renderStepIcon = (stepType: string, isStreaming: boolean) => {
    const config = stepTypeConfig[stepType] || stepTypeConfig.thinking;
    const Icon = config.icon;
    
    if (isStreaming) {
      return (
        <div className={`p-1.5 rounded-lg ${config.color} border animate-pulse`}>
          <Icon className="w-4 h-4" />
        </div>
      );
    }
    
    return (
      <div className={`p-1.5 rounded-lg ${config.color} border`}>
        <Icon className="w-4 h-4" />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Reasoning Chain</span>
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              Live
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {steps.length === 0 && !streamingContent && (
          <div className="text-center text-muted-foreground text-sm py-8">
            No reasoning steps recorded yet
          </div>
        )}

        {/* Completed steps */}
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.step_number);
          const config = stepTypeConfig[step.step_type] || stepTypeConfig.thinking;
          
          return (
            <div
              key={step.id}
              className="border rounded-lg overflow-hidden bg-background"
            >
              {/* Step header */}
              <button
                onClick={() => toggleStep(step.step_number)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                {renderStepIcon(step.step_type, false)}
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{config.label}</span>
                    {step.agent_name && (
                      <span className="text-xs text-muted-foreground">
                        ({step.agent_name})
                      </span>
                    )}
                  </div>
                  {step.duration_ms && (
                    <span className="text-xs text-muted-foreground">
                      {step.duration_ms}ms
                    </span>
                  )}
                </div>
                
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              
              {/* Step content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t">
                  {/* KG nodes used */}
                  {step.kg_nodes_used && step.kg_nodes_used.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 mb-2">
                      {step.kg_nodes_used.map((node, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30"
                        >
                          <BookOpen className="w-3 h-3" />
                          {node}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {step.content.slice(0, 1000)}
                    {step.content.length > 1000 && "..."}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming step */}
        {currentStepType && (
          <div className="border rounded-lg overflow-hidden bg-background animate-pulse-subtle">
            <div className="flex items-center gap-3 px-3 py-2">
              {renderStepIcon(currentStepType, true)}
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {stepTypeConfig[currentStepType]?.label || "Processing"}
                  </span>
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            </div>
            
            {streamingContent && (
              <div className="px-3 pb-3 border-t">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">
                  {streamingContent}
                  <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-blink ml-0.5" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Mini version for inline display
export function ReasoningTraceMini({
  runId,
  isActive,
}: {
  runId: string;
  isActive: boolean;
}) {
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const wsConnectionRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const connection = connectReasoningStreamWebSocket(
      runId,
      (chunk) => {
        if (chunk.type === "complete" || chunk.type === "error") {
          setStreamingText("");
          setCurrentStep(null);
        } else if (chunk.type) {
          setCurrentStep(chunk.type);
          if (chunk.content) {
            setStreamingText((prev) => (prev + chunk.content).slice(-200));
          }
        }
      },
      (error) => {
        console.error("Failed to connect:", error);
      }
    );

    wsConnectionRef.current = connection;

    return () => {
      connection.close();
    };
  }, [runId, isActive]);

  if (!currentStep) return null;

  const config = stepTypeConfig[currentStep] || stepTypeConfig.thinking;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-xs animate-fade-in border-t border-indigo-100">
      <div className={`p-1 rounded ${config.color}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-indigo-800">{config.label}</div>
        {streamingText && (
          <div className="text-indigo-600/70 truncate">
            {streamingText}
          </div>
        )}
      </div>
      <Loader2 className="w-3 h-3 animate-spin text-indigo-400 flex-shrink-0" />
    </div>
  );
}
