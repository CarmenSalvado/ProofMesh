"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  Image as ImageIcon,
  Target,
  Play,
  Zap,
  CheckCircle,
  XCircle,
  Brain,
  BookOpen,
  GitMerge,
  Filter,
} from "lucide-react";
import { useChat, Message } from "@ai-sdk/react";
import { CanvasNode, NODE_TYPE_CONFIG } from "./types";
import {
  getOrchestrationStatus,
  exploreContext,
  exploreWithPatterns,
  formalizeText,
  verifyLeanCode,
  critiqueProposal,
  getCanvasAIChatHistory,
  createCanvasAIRun,
  generateStory,
  fuseIdeas,
  type Story,
  type CanvasAIMessage,
  type CanvasAIRun,
} from "@/lib/api";
import { queueCanvasOperation } from "@/lib/asyncQueue";

// Using CanvasAIMessage as ChatMessage
type ChatMessage = CanvasAIMessage;

interface FloatingInsight {
  id: string;
  type: "insight" | "proposal" | "critique" | "code";
  title: string;
  content: string;
  nodeRef?: string;
  score?: number;
  runId?: string;
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
  onCreateNode?: (data: { type: string; title: string; content: string; formula?: string; leanCode?: string; x?: number; y?: number; dependencies?: string[]; authors?: Array<{ type: "human" | "agent"; id: string; name?: string }>; source?: { file_path?: string; cell_id?: string; agent_run_id?: string } }) => Promise<{ id: string } | void>;
  onUpdateNode?: (nodeId: string, updates: { formula?: string; leanCode?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED"; verification?: { method: string; logs: string; status: string }; dependencies?: string[] }) => Promise<void> | void;
  onCreateBlock?: (name: string, nodeIds: string[]) => void;
}

const AI_AUTHOR = { type: "agent", id: "orchestrator", name: "AI Pipeline" } as const;
const buildAISource = (runId?: string) => (runId ? { agent_run_id: runId } : undefined);

const isImageContent = (value?: string) => {
  if (!value) return false;
  if (value.startsWith("data:image")) return true;
  return /!\[[^\]]*]\((data:image|https?:\/\/)/i.test(value);
};

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("Failed to read image"));
  reader.readAsDataURL(file);
});

const stripMarkdown = (value: string) => value
  .replace(/`{1,3}[^`]*`{1,3}/g, " ")
  .replace(/\[(.*?)\]\(.*?\)/g, "$1")
  .replace(/[*_>#~\-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const deriveGroupTitle = (value: string, fallback = "Proposal") => {
  const cleaned = stripMarkdown(value || "");
  if (!cleaned) return fallback;
  const firstLine = cleaned.split("\n").find((line) => line.trim()) || cleaned;
  const sentence = firstLine.split(/[.!?]/)[0] || firstLine;
  const words = sentence.trim().split(/\s+/).slice(0, 8).join(" ");
  if (!words) return fallback;
  return words.length < sentence.length ? `${words}…` : words;
};

const buildChatContext = (messages: ChatMessage[]) => {
  if (messages.length === 0) return "";
  return `Insights context:\n${messages
    .slice(-8)
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n")}`;
};

type DiagramNodeSpec = {
  id: string;
  type?: string | null;
  title: string;
  content?: string | null;
  formula?: string | null;
  lean_code?: string | null;
  leanCode?: string | null;
};

type DiagramEdgeSpec = {
  from: string;
  to: string;
  type?: string | null;
  label?: string | null;
};

type DiagramSpec = {
  nodes: DiagramNodeSpec[];
  edges?: DiagramEdgeSpec[] | null;
};

const EDGE_TYPES = new Set(["uses", "implies", "contradicts", "references"]);

const normalizeNodeType = (value?: string | null) => {
  if (!value) return "NOTE";
  const upper = String(value).trim().toUpperCase();
  if (NODE_TYPE_CONFIG[upper]) return upper;
  if (NODE_TYPE_CONFIG[upper.toLowerCase()]) return upper;
  return "NOTE";
};

const normalizeEdgeType = (value?: string | null) => {
  const lowered = String(value || "uses").trim().toLowerCase();
  return EDGE_TYPES.has(lowered) ? lowered : "uses";
};

const sanitizeDiagram = (diagram?: DiagramSpec | null) => {
  if (!diagram || !Array.isArray(diagram.nodes)) return null;
  const nodes = diagram.nodes
    .map((node, index) => ({
      id: String(node.id || `n${index + 1}`),
      type: normalizeNodeType(node.type),
      title: String(node.title || "").trim(),
      content: node.content ? String(node.content).trim() : "",
      formula: node.formula ? String(node.formula).trim() : undefined,
      leanCode: node.lean_code || node.leanCode || undefined,
    }))
    .filter((node) => node.title.length > 0);

  if (nodes.length < 2) return null;

  const seen = new Set<string>();
  const uniqueNodes: typeof nodes = [];
  nodes.forEach((node) => {
    const key = `${node.type.toLowerCase()}::${node.title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniqueNodes.push(node);
  });

  const finalNodes = uniqueNodes.length >= 2 ? uniqueNodes : nodes;

  const nodeIds = new Set(finalNodes.map((n) => n.id));
  const edges = Array.isArray(diagram.edges)
    ? diagram.edges
      .map((edge) => ({
        from: String(edge.from || "").trim(),
        to: String(edge.to || "").trim(),
        type: normalizeEdgeType(edge.type),
        label: edge.label ? String(edge.label).trim() : undefined,
      }))
      .filter((edge) => edge.from && edge.to && edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to))
    : [];

  if (edges.length === 0) {
    for (let i = 1; i < finalNodes.length; i += 1) {
      edges.push({ from: finalNodes[i - 1].id, to: finalNodes[i].id, type: "implies", label: undefined });
    }
  }

  return { nodes: finalNodes, edges };
};

const layoutDiagram = (nodes: Array<{ id: string }>, edges: Array<{ from: string; to: string }>, baseX: number, baseY: number) => {
  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach((node) => {
    incoming.set(node.id, 0);
    adjacency.set(node.id, []);
  });

  edges.forEach((edge) => {
    if (!incoming.has(edge.to) || !incoming.has(edge.from)) return;
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
    adjacency.get(edge.from)?.push(edge.to);
  });

  const depths = new Map<string, number>();
  const queue: string[] = [];
  nodes.forEach((node) => {
    if ((incoming.get(node.id) || 0) === 0) {
      depths.set(node.id, 0);
      queue.push(node.id);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const depth = depths.get(current) || 0;
    const neighbors = adjacency.get(current) || [];
    neighbors.forEach((next) => {
      const nextDepth = Math.max(depths.get(next) || 0, depth + 1);
      depths.set(next, nextDepth);
      incoming.set(next, (incoming.get(next) || 1) - 1);
      if ((incoming.get(next) || 0) <= 0) {
        queue.push(next);
      }
    });
  }

  const groups = new Map<number, string[]>();
  nodes.forEach((node) => {
    const depth = depths.get(node.id) ?? 0;
    if (!groups.has(depth)) groups.set(depth, []);
    groups.get(depth)?.push(node.id);
  });

  const positions: Record<string, { x: number; y: number }> = {};
  const xSpacing = 420; // Increased from 320 for better separation
  const ySpacing = 280; // Increased from 190 for better separation

  Array.from(groups.entries()).forEach(([depth, ids]) => {
    ids.forEach((id, index) => {
      const offset = index - (ids.length - 1) / 2;
      positions[id] = {
        x: baseX + depth * xSpacing,
        y: baseY + offset * ySpacing,
      };
    });
  });

  nodes.forEach((node, index) => {
    if (!positions[node.id]) {
      positions[node.id] = {
        x: baseX + (index % 3) * xSpacing,
        y: baseY + Math.floor(index / 3) * ySpacing,
      };
    }
  });

  return positions;
};

export function FloatingAIBar({
  problemId,
  selectedNode,
  selectedNodes = [],
  isVisible,
  onToggle,
  onCreateNode,
  onUpdateNode,
  onCreateBlock,
}: FloatingAIBarProps) {
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<FloatingInsight[]>([]);
  const [isOrchestrationAvailable, setIsOrchestrationAvailable] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [contextNodes, setContextNodes] = useState<ContextNode[]>([]);
  const [currentLeanCode, setCurrentLeanCode] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; log: string } | null>(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [activeRuns, setActiveRuns] = useState<CanvasAIRun[]>([]);
  const [showThinking, setShowThinking] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Idea2Paper states
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [fusionModalOpen, setFusionModalOpen] = useState(false);
  const [usePatterns, setUsePatterns] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<Story | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [selectedStoriesForFusion, setSelectedStoriesForFusion] = useState<string[]>([]);
  const onCreateNodeRef = useRef<FloatingAIBarProps["onCreateNode"]>(onCreateNode);
  const startContextRef = useRef<{ dependencyIds: string[]; baseX: number; baseY: number }>({
    dependencyIds: [],
    baseX: 400,
    baseY: 300,
  });

  const getStartContext = useCallback(() => {
    const primaryNode = selectedNode || selectedNodes[0] || null;
    const dependencyIds =
      contextNodes.length > 0
        ? contextNodes.map((n) => n.id)
        : primaryNode
          ? [primaryNode.id]
          : [];

    return {
      primaryNode,
      dependencyIds,
      baseX: primaryNode?.x ?? 400,
      baseY: primaryNode?.y ?? 300,
    };
  }, [contextNodes, selectedNode, selectedNodes]);

  useEffect(() => {
    onCreateNodeRef.current = onCreateNode;
  }, [onCreateNode]);

  useEffect(() => {
    const { dependencyIds, baseX, baseY } = getStartContext();
    startContextRef.current = { dependencyIds, baseX, baseY };
  }, [getStartContext]);

  // Build context for AI from selected nodes
  const aiContext = useMemo(() => {
    if (contextNodes.length === 0) return "";
    const details = contextNodes.map(n => {
      const fullNode = selectedNode?.id === n.id ? selectedNode : selectedNodes.find(sn => sn.id === n.id);
      const content = fullNode?.content
        ? isImageContent(fullNode.content)
          ? " [image attached]"
          : ` - ${fullNode.content.slice(0, 500)}`
        : "";
      return `${n.title} (${n.type})${content}`;
    }).join("\n");
    return details;
  }, [contextNodes, selectedNode, selectedNodes]);

  // AI SDK useChat for streaming exploration
  const {
    messages: aiMessages,
    append: appendAiMessage,
    isLoading: isAiLoading,
    setMessages: setAiMessages,
  } = useChat({
    api: "/api/canvas-ai/explore",
    id: `canvas-explore-${problemId}`,
    body: {
      context: aiContext,
      problem_id: problemId,
    },
    onFinish: (message) => {
      // Parse thinking tags and final response
      const content = message.content;
      const hasThinking = content.includes("<thinking>") && content.includes("</thinking>");
      
      if (hasThinking) {
        // Extract final response (after all thinking tags)
        const parts = content.split(/<\/thinking>/);
        const finalResponse = parts[parts.length - 1].trim();
        
        if (finalResponse) {
          addInsight({
            type: "proposal",
            title: "AI Exploration Complete",
            content: finalResponse.slice(0, 300) + (finalResponse.length > 300 ? "..." : ""),
          });
          const createNode = onCreateNodeRef.current;
          if (createNode) {
            const { dependencyIds, baseX, baseY } = startContextRef.current;
            void createNode({
              type: "NOTE",
              title: deriveGroupTitle(finalResponse, "Chat Insight"),
              content: finalResponse,
              x: baseX + 220,
              y: baseY + 180,
              dependencies: dependencyIds,
              authors: [AI_AUTHOR],
            });
          }
        }
      } else {
        addInsight({
          type: "proposal",
          title: "AI Exploration Complete",
          content: content.slice(0, 300) + (content.length > 300 ? "..." : ""),
        });
        const createNode = onCreateNodeRef.current;
        if (createNode) {
          const { dependencyIds, baseX, baseY } = startContextRef.current;
          void createNode({
            type: "NOTE",
            title: deriveGroupTitle(content, "Chat Insight"),
            content,
            x: baseX + 220,
            y: baseY + 180,
            dependencies: dependencyIds,
            authors: [AI_AUTHOR],
          });
        }
      }
    },
  });

  // Extract current thinking and response from streaming
  const currentThinking = useMemo(() => {
    const lastMessage = aiMessages[aiMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return null;
    
    const content = lastMessage.content;
    const thinkingMatch = content.match(/<thinking>([\s\S]*?)(<\/thinking>|$)/g);
    if (!thinkingMatch) return null;
    
    // Get the last (potentially incomplete) thinking block
    const lastThinking = thinkingMatch[thinkingMatch.length - 1];
    return lastThinking.replace(/<\/?thinking>/g, "").trim();
  }, [aiMessages]);

  const currentResponse = useMemo(() => {
    const lastMessage = aiMessages[aiMessages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return null;
    
    const content = lastMessage.content;
    // Remove all thinking tags and get remaining content
    const withoutThinking = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
    return withoutThinking || null;
  }, [aiMessages]);

  // Sync selection -> context (single or multi)
  useEffect(() => {
    const selection = selectedNodes.length > 0
      ? selectedNodes
      : selectedNode
        ? [selectedNode]
        : [];
    setContextNodes(selection.map((node) => ({
      id: node.id,
      title: node.title,
      type: node.type,
    })));
  }, [selectedNode, selectedNodes]);

  // Check orchestration status
  useEffect(() => {
    getOrchestrationStatus()
      .then((status) => setIsOrchestrationAvailable(status.available))
      .catch(() => setIsOrchestrationAvailable(false));
  }, []);

  // Load chat history on mount
  useEffect(() => {
    if (!problemId || !isVisible) return;
    
    const loadHistory = async () => {
      try {
        const data = await getCanvasAIChatHistory(problemId);
        setChatMessages(data.messages || []);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    };
    
    loadHistory();
    
    // Refresh history periodically while visible
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, [problemId, isVisible]);

  useEffect(() => {
    if (isInputFocused) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeRuns, isInputFocused]);

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
    console.log("[FloatingAIBar] handleExplore called:", {
      problemId,
      command: command.trim(),
      hasCommand: !!command.trim(),
      chatMessagesLength: chatMessages.length,
      contextNodesLength: contextNodes.length,
      shouldProceed: !!(command.trim() || chatMessages.length > 0 || contextNodes.length > 0)
    });

    if (!problemId) {
      console.error("[FloatingAIBar] No problemId provided");
      return;
    }
    
    if (!command.trim() && chatMessages.length === 0 && contextNodes.length === 0) {
      console.warn("[FloatingAIBar] Cannot explore: no command, no chat messages, and no context nodes");
      addInsight({
        type: "insight",
        title: "Cannot Explore",
        content: "Please provide a command or select nodes to explore their context.",
      });
      return;
    }

    setIsLoading(true);
    setActiveAction("explore");

    try {
      console.log("[FloatingAIBar] Starting exploration with context...");

      // Build rich context including node content + chat
      let contextStr = "";
      if (contextNodes.length > 0) {
        const contextDetails = contextNodes.map(n => {
          const fullNode = selectedNode?.id === n.id ? selectedNode : selectedNodes.find(sn => sn.id === n.id);
          const content = fullNode?.content
            ? isImageContent(fullNode.content)
              ? " - [image]"
              : ` - ${fullNode.content}`
            : "";
          return `${n.title} (${n.type})${content}`;
        }).join("\n");
        contextStr = `Context nodes:\n${contextDetails}\n\n`;
      }
      const chatContext = buildChatContext(chatMessages);
      const fullContext = [contextStr, chatContext, command.trim()].filter(Boolean).join("\n\n");

      console.log("[FloatingAIBar] Calling exploreContext API...");
      const result = await exploreContext({
        problem_id: problemId,
        context: fullContext,
        max_iterations: 3,
      });
      
      console.log("[FloatingAIBar] exploreContext result:", {
        proposalsCount: result.proposals?.length,
        runId: result.run_id,
        hasDiagrams: result.proposals?.some((p: any) => p.diagram)
      });
      
      const runId = result.run_id;

      const baseX = selectedNode?.x ?? 400;
      const baseY = selectedNode?.y ?? 300;
      const dependencyIds = contextNodes.length > 0
        ? contextNodes.map((n) => n.id)
        : selectedNode
          ? [selectedNode.id]
          : [];

      if (!result.proposals || result.proposals.length === 0) {
        console.warn("[FloatingAIBar] No proposals received from API");
        addInsight({
          type: "insight",
          title: "No Proposals",
          content: "The AI didn't generate any proposals. Try a different prompt or add more context nodes.",
        });
        return;
      }

      console.log(`[FloatingAIBar] Processing ${result.proposals.length} proposals...`);
      
      for (let index = 0; index < result.proposals.length; index += 1) {
        const proposal = result.proposals[index];
        
        console.log(`[FloatingAIBar] Processing proposal ${index + 1}:`, {
          content: proposal.content,
          score: proposal.score,
          hasDiagram: !!(proposal as { diagram?: DiagramSpec }).diagram,
          diagramNodeCount: (proposal as { diagram?: DiagramSpec }).diagram?.nodes?.length
        });

        addInsight({
          type: "proposal",
          title: `Proposal ${index + 1}`,
          content: proposal.content,
          score: proposal.score,
          runId,
        });

        if (!onCreateNode) {
          console.warn("[FloatingAIBar] onCreateNode callback not provided, skipping node creation");
          continue;
        }

        const diagram = sanitizeDiagram((proposal as { diagram?: DiagramSpec }).diagram);
        if (diagram) {
          console.log(`[FloatingAIBar] ✨ Creating diagram for proposal ${index + 1}:`, {
            nodesCount: diagram.nodes.length,
            edgesCount: diagram.edges?.length || 0,
            nodes: diagram.nodes.map(n => ({ id: n.id, type: n.type, title: n.title }))
          });
          
          const diagramBaseY = baseY + index * 650; // Increased from 420 for better separation between proposals
          const positions = layoutDiagram(diagram.nodes, diagram.edges || [], baseX, diagramBaseY);
          const incomingCounts = new Map<string, number>();

          diagram.nodes.forEach((node) => {
            incomingCounts.set(node.id, 0);
          });
          diagram.edges?.forEach((edge) => {
            incomingCounts.set(edge.to, (incomingCounts.get(edge.to) || 0) + 1);
          });

          // Execute full diagram creation in queue
          await queueCanvasOperation(
            `create-diagram-${proposal.content.slice(0, 30)}`,
            async () => {
              const diagramIdToActualId = new Map<string, string>();
              const baseDepsByActualId = new Map<string, string[]>();
              const createdNodeIds: string[] = [];

              // Create all diagram nodes
              for (const node of diagram.nodes) {
                const position = positions[node.id] || { x: baseX, y: diagramBaseY };
                const baseDeps = (incomingCounts.get(node.id) || 0) === 0 ? dependencyIds : [];
                const nodeContent = node.content || proposal.content || node.title;

                const created = await onCreateNode({
                  type: node.type,
                  title: node.title,
                  content: nodeContent,
                  formula: node.formula,
                  leanCode: node.leanCode,
                  x: position.x,
                  y: position.y,
                  dependencies: baseDeps,
                  authors: [AI_AUTHOR],
                  source: buildAISource(runId),
                });

                if (created && typeof created === "object" && "id" in created && created.id) {
                  diagramIdToActualId.set(node.id, created.id);
                  baseDepsByActualId.set(created.id, baseDeps);
                  createdNodeIds.push(created.id);
                }
              }

              // Update edges (dependencies) after creating all nodes
              if (onUpdateNode && diagram.edges && diagram.edges.length > 0) {
                const depsByActualId = new Map<string, Set<string>>();

                diagram.edges.forEach((edge) => {
                  const fromActual = diagramIdToActualId.get(edge.from);
                  const toActual = diagramIdToActualId.get(edge.to);
                  if (!fromActual || !toActual) return;
                  if (!depsByActualId.has(toActual)) {
                    depsByActualId.set(toActual, new Set());
                  }
                  depsByActualId.get(toActual)?.add(fromActual);
                });

                // Update all dependencies in parallel
                await Promise.all(
                  Array.from(depsByActualId.entries()).map(async ([actualId, deps]) => {
                    const baseDeps = baseDepsByActualId.get(actualId) || [];
                    const merged = Array.from(new Set([...baseDeps, ...Array.from(deps)]));
                    await onUpdateNode(actualId, { dependencies: merged });
                  })
                );
              }

              // Create block with all created nodes
              if (onCreateBlock && createdNodeIds.length > 0) {
                const titleSeed = proposal.content || diagram.nodes[0]?.title || "Proposal";
                const groupTitle = deriveGroupTitle(titleSeed);
                onCreateBlock(groupTitle, createdNodeIds);
              }

              return { diagramIdToActualId, createdNodeIds };
            },
            {
              onSuccess: (result) => {
                console.log(`[FloatingAIBar] ✅ Diagram created successfully:`, result);
              },
              onError: (error) => {
                console.error(`[FloatingAIBar] ❌ Error creating diagram:`, error);
                addInsight({
                  type: "insight",
                  title: "Error creando diagrama",
                  content: error.message,
                });
              },
            }
          );

          continue;
        }

        const angle = ((index - (result.proposals.length - 1) / 2) * 45) * (Math.PI / 180);
        const distance = 300;
        const nodeX = baseX + Math.sin(angle) * distance;
        const nodeY = baseY + distance * 0.7;
        const confidencePercent = Math.round(proposal.score * 100);
        const nodeContent = `**Confidence: ${confidencePercent}%**\n\n${proposal.content}\n\n---\n*Reasoning: ${proposal.reasoning}*`;

        console.log(`[FloatingAIBar] Creating single node for proposal ${index + 1}`);
        
        // Create individual node in queue
        await queueCanvasOperation(
          `create-single-node-${proposal.content.slice(0, 30)}`,
          async () => {
            const created = await onCreateNode({
              type: "NOTE",
              title: proposal.content.slice(0, 60) + (proposal.content.length > 60 ? "..." : ""),
              content: nodeContent,
              x: nodeX,
              y: nodeY,
              dependencies: dependencyIds,
              authors: [AI_AUTHOR],
              source: buildAISource(runId),
            });

            if (onCreateBlock && created && typeof created === "object" && "id" in created && created.id) {
              const groupTitle = deriveGroupTitle(proposal.content);
              onCreateBlock(groupTitle, [created.id]);
            }

            return created;
          },
          {
            onSuccess: (created) => {
              console.log(`[FloatingAIBar] ✅ Single node created successfully:`, created);
            },
            onError: (error) => {
              console.error(`[FloatingAIBar] ❌ Error creating single node:`, error);
              addInsight({
                type: "insight",
                title: "Error creating node",
                content: error.message,
              });
            },
          }
        );
      }

      setCommand("");
      // Clear context after creating nodes
      setContextNodes([]);
      
      console.log("[FloatingAIBar] ✅ Exploration completed successfully");
    } catch (err) {
      console.error("[FloatingAIBar] ❌ Exploration failed:", err);
      addInsight({
        type: "insight",
        title: "Error",
        content: err instanceof Error ? err.message : "Exploration failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [command, problemId, contextNodes, selectedNode, selectedNodes, chatMessages, addInsight, onCreateNode, onUpdateNode, onCreateBlock]);

  const handleChatSend = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed || !problemId || isAiLoading) return;

    setCommand("");
    
    // Use AI SDK streaming instead of backend worker
    await appendAiMessage({
      role: "user",
      content: trimmed,
    });
  }, [command, problemId, isAiLoading, appendAiMessage]);

  const handlePrimarySend = useCallback(async () => {
    const trimmed = command.trim();
    if (!trimmed || !problemId || isAiLoading || isLoading) return;

    if (isOrchestrationAvailable && onCreateNode) {
      await handleExplore();
      return;
    }

    await handleChatSend();
  }, [command, problemId, isAiLoading, isLoading, isOrchestrationAvailable, onCreateNode, handleExplore, handleChatSend]);

  const handleUseChatInExplore = useCallback((content: string) => {
    setCommand(content);
    inputRef.current?.focus();
  }, []);

  const handleQuickInsight = useCallback(async () => {
    if (contextNodes.length === 0) return;

    setIsLoading(true);
    setActiveAction("insight");

    const node = contextNodes[0];
    addInsight({
      type: "insight",
      title: "Quick Insight",
      content: `Node "${node.title}" is a ${NODE_TYPE_CONFIG[node.type]?.label || node.type}. ${node.type === "AXIOM" ? "This serves as a foundational assumption." :
        node.type === "LEMMA" ? "This is a helper result for proving larger.orems." :
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

      const { primaryNode, dependencyIds, baseX, baseY } = getStartContext();
      const leanTitle = primaryNode ? `Lean for ${primaryNode.title}` : "Lean 4 code";

      if (onCreateNode) {
        await onCreateNode({
          type: "LEMMA",
          title: leanTitle.slice(0, 80),
          content: `Lean 4 code for ${primaryNode?.title || "this step"}:\n\n\`\`\`lean\n${result.lean_code}\n\`\`\``,
          leanCode: result.lean_code,
          x: baseX + 260,
          y: baseY + 180,
          dependencies: dependencyIds,
          authors: [AI_AUTHOR],
          source: buildAISource(result.run_id),
        });
      }

      // Update node's leanCode field if we have onUpdateNode
      if (onUpdateNode && primaryNode?.id) {
        onUpdateNode(primaryNode.id, { leanCode: result.lean_code });
      }

      addInsight({
        type: "code",
        title: "Lean 4 Code",
        content: result.lean_code,
        score: result.confidence,
        nodeRef: node.id,
        runId: result.run_id,
      });
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
  }, [contextNodes, selectedNode, selectedNodes, problemId, addInsight, onUpdateNode, onCreateNode, getStartContext]);

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
      const { primaryNode, dependencyIds, baseX, baseY } = getStartContext();

      if (onCreateNode) {
        await onCreateNode({
          type: "NOTE",
          title: result.success
            ? `✓ Verification of ${primaryNode?.title || "Lean code"}`
            : `✗ Verification of ${primaryNode?.title || "Lean code"}`,
          content: `**Result:** ${result.success ? "OK" : "Failed"}\n\n${result.log || result.error || "No log"}\n\n\`\`\`lean\n${currentLeanCode}\n\`\`\``,
          leanCode: currentLeanCode,
          x: baseX + 320,
          y: baseY + 260,
          dependencies: dependencyIds,
          authors: [AI_AUTHOR],
          source: buildAISource(result.run_id),
        });
      }

      if (onUpdateNode && primaryNode?.id) {
        onUpdateNode(primaryNode.id, {
          status: result.success ? "VERIFIED" : "REJECTED",
          verification: {
            method: "lean4",
            logs: result.log || result.error || "",
            status: result.success ? "pass" : "fail",
          },
        });
      }

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
  }, [currentLeanCode, problemId, addInsight, onCreateNode, onUpdateNode, getStartContext]);

  const handleFullPipeline = useCallback(async () => {
    if (!problemId) return;
    if (!command.trim() && contextNodes.length === 0 && chatMessages.length === 0) return;

    setIsPipelineRunning(true);
    setActiveAction("pipeline");
    setVerificationResult(null);
    setCurrentLeanCode(null);

    try {
      const { primaryNode, dependencyIds, baseX, baseY } = getStartContext();
      // Step 1: Explore
      addInsight({ type: "insight", title: "🔄 Pipeline: Exploring...", content: "Generating proposals..." });

      let contextStr = command.trim();
      if (contextNodes.length > 0) {
        const contextDetails = contextNodes.map(n => {
          const fullNode = selectedNode?.id === n.id ? selectedNode : selectedNodes.find(sn => sn.id === n.id);
          const content = fullNode?.content
            ? isImageContent(fullNode.content)
              ? " [image]"
              : `: ${fullNode.content}`
            : "";
          return `${n.title} (${n.type})${content}`;
        }).join("\n");
        contextStr = contextDetails + (contextStr ? `\n\n${contextStr}` : "");
      }
      const chatContext = buildChatContext(chatMessages);
      if (chatContext) {
        contextStr = `${chatContext}${contextStr ? `\n\n${contextStr}` : ""}`;
      }

      const exploration = await exploreContext({
        problem_id: problemId,
        context: contextStr,
        max_iterations: 3,
      });
      const explorationRunId = exploration.run_id;

      if (!exploration.proposals || exploration.proposals.length === 0) {
        addInsight({ type: "insight", title: "Pipeline Failed", content: "No proposals generated" });
        return;
      }

      let proposalNodeId: string | undefined;
      let leanNodeId: string | undefined;

      const bestProposal = exploration.proposals[0];
      addInsight({
        type: "proposal",
        title: "Proposal Generated",
        content: bestProposal.content,
        score: bestProposal.score,
        runId: explorationRunId,
      });

      if (onCreateNode) {
        const createdProposal = await onCreateNode({
          type: "LEMMA",
          title: deriveGroupTitle(bestProposal.content, "Proposal"),
          content: bestProposal.content,
          x: baseX + 240,
          y: baseY + 140,
          dependencies: dependencyIds,
          authors: [AI_AUTHOR],
          source: buildAISource(explorationRunId),
        });

        if (createdProposal && typeof createdProposal === "object" && "id" in createdProposal) {
          proposalNodeId = createdProposal.id;
        }
      }

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

      if (onCreateNode) {
        const leanDeps = Array.from(
          new Set(
            [proposalNodeId, ...dependencyIds].filter((id): id is string => Boolean(id))
          )
        );

        const createdLean = await onCreateNode({
          type: "LEMMA",
          title: primaryNode ? `Lean for ${primaryNode.title}` : "Lean formalization",
          content: `\`\`\`lean\n${formalization.lean_code}\n\`\`\``,
          leanCode: formalization.lean_code,
          x: baseX + 260,
          y: baseY + 320,
          dependencies: leanDeps,
          authors: [AI_AUTHOR],
          source: buildAISource(formalization.run_id),
        });

        if (createdLean && typeof createdLean === "object" && "id" in createdLean) {
          leanNodeId = createdLean.id;
        }
      }

      if (onUpdateNode && primaryNode?.id) {
        onUpdateNode(primaryNode.id, { leanCode: formalization.lean_code });
      }

      // Step 4: Verify
      addInsight({ type: "insight", title: "🔄 Pipeline: Verifying...", content: "Running Lean 4 verification..." });

      const verification = await verifyLeanCode({
        problem_id: problemId,
        lean_code: formalization.lean_code,
      });

      setVerificationResult({ success: verification.success, log: verification.log });
      const verificationDeps = Array.from(
        new Set(
          [leanNodeId, proposalNodeId, ...dependencyIds].filter((id): id is string => Boolean(id))
        )
      );

      if (onCreateNode) {
        await onCreateNode({
          type: "NOTE",
          title: verification.success ? "Verification ✓" : "Verification ✗",
          content: `${verification.success ? "The proof was verified successfully." : "Verification failed."}\n\n${verification.log || verification.error || ""}\n\n\`\`\`lean\n${formalization.lean_code}\n\`\`\``,
          leanCode: formalization.lean_code,
          x: baseX + 280,
          y: baseY + 500,
          dependencies: verificationDeps,
          authors: [AI_AUTHOR],
          source: buildAISource(verification.run_id),
        });
      }

      // Final result
      if (verification.success) {
        addInsight({
          type: "insight",
          title: "✅ Pipeline Complete!",
          content: `Proof verified successfully!\n\nScore: ${(critique.score * 100).toFixed(0)}%\nConfidence: ${(formalization.confidence * 100).toFixed(0)}%`,
          score: 1,
        });

        if (onUpdateNode && primaryNode?.id) {
          onUpdateNode(primaryNode.id, {
            leanCode: formalization.lean_code,
            status: "VERIFIED",
            verification: {
              method: "lean4",
              logs: verification.log || verification.error || "",
              status: "pass",
            },
          });
          addInsight({
            type: "insight",
            title: "✓ Node Updated",
            content: `Lean code added to "${primaryNode.title}" and marked as Verified.`,
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
  }, [command, contextNodes, selectedNode, selectedNodes, chatMessages, problemId, addInsight, onCreateNode, onUpdateNode, getStartContext]);

  // ============ Idea2Paper Handlers ============

  // Pattern-based exploration
  const handleExploreWithPatterns = useCallback(async () => {
    if (!command.trim() && contextNodes.length === 0) return;
    if (!problemId) return;

    setIsLoading(true);
    setActiveAction("explore-patterns");

    try {
      const contextStr = command.trim() || contextNodes.map(n => n.title).join(", ");

      const result = await exploreWithPatterns(problemId, {
        query: contextStr,
        use_patterns: true,
        num_patterns: 5,
      });

      addInsight({
        type: "proposal",
        title: "Pattern-Based Exploration",
        content: `Generated ${result.proposals.length} pattern-guided proposals`,
        score: 0.8,
      });

      // Create nodes from proposals (similar to handleExplore)
      const { baseX, baseY, dependencyIds } = getStartContext();

      for (let index = 0; index < result.proposals.length; index += 1) {
        const proposal = result.proposals[index];
        const angle = ((index - (result.proposals.length - 1) / 2) * 45) * (Math.PI / 180);
        const distance = 300;
        const nodeX = baseX + Math.sin(angle) * distance;
        const nodeY = baseY + distance * 0.7;

        if (onCreateNode) {
          await onCreateNode({
            type: "LEMMA",
            title: proposal.content.slice(0, 60) + (proposal.content.length > 60 ? "..." : ""),
            content: `**Pattern-Guided Proposal**\n\n${proposal.content}`,
            x: nodeX,
            y: nodeY,
            dependencies: dependencyIds,
            authors: [AI_AUTHOR],
            source: buildAISource(result.run_id),
          });
        }
      }

      setCommand("");
      setContextNodes([]);
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Pattern Exploration Error",
        content: err instanceof Error ? err.message : "Pattern-based exploration failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [command, contextNodes, problemId, addInsight, onCreateNode, getStartContext]);

  // Generate Story
  const handleGenerateStory = useCallback(async () => {
    if (!command.trim() && contextNodes.length === 0) return;
    if (!problemId) return;

    setIsGeneratingStory(true);
    setActiveAction("generate-story");

    try {
      const userIdea = command.trim() || contextNodes.map(n => `${n.title}: ${n.type}`).join("\n");

      const result = await generateStory(problemId, {
        user_idea: userIdea,
        context: contextNodes.length > 0 ? contextNodes.map(n => n.title).join(", ") : undefined,
      });

      setGeneratedStory(result.story);

      addInsight({
        type: "proposal",
        title: "Research Story Generated",
        content: `**${result.story.sections.title}**\n\n${result.story.sections.abstract.slice(0, 200)}...`,
        score: result.story.review_result?.scores.average || 0.7,
      });

      // Optionally create nodes from story sections
      if (onCreateNode) {
        const { baseX, baseY, dependencyIds } = getStartContext();

        // Create title node
        await onCreateNode({
          type: "THEOREM",
          title: result.story.sections.title,
          content: `**Abstract**\n${result.story.sections.abstract}`,
          x: baseX,
          y: baseY,
          dependencies: dependencyIds,
          authors: [AI_AUTHOR],
        });
      }

      setStoryModalOpen(true);
      setCommand("");
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Story Generation Error",
        content: err instanceof Error ? err.message : "Story generation failed",
      });
    } finally {
      setIsGeneratingStory(false);
      setActiveAction(null);
    }
  }, [command, contextNodes, problemId, addInsight, onCreateNode, getStartContext]);

  // Idea Fusion
  const handleFusionIdeas = useCallback(async () => {
    if (contextNodes.length < 2) {
      addInsight({
        type: "insight",
        title: "Fusion Requires Multiple Ideas",
        content: "Please select at least 2 nodes to fuse their ideas together.",
      });
      return;
    }

    if (!problemId) return;

    setIsLoading(true);
    setActiveAction("fusion");

    try {
      const ideas = contextNodes.map(n => `${n.title} (${n.type})`);

      const result = await fuseIdeas(problemId, {
        ideas,
        context: command.trim() || undefined,
      });

      const patternLine = result.pattern_name ? `**Pattern:** ${result.pattern_name}\n\n` : "";
      addInsight({
        type: "proposal",
        title: "Idea Fusion Complete",
        content: `**${result.fusion_type}**\n\n${patternLine}${result.fused_idea}`,
        score: 0.8,
      });

      // Create node from fused idea
      if (onCreateNode) {
        const { baseX, baseY } = getStartContext();
        const dependencyIds = contextNodes.map(n => n.id);

        await onCreateNode({
          type: "LEMMA",
          title: `Fused: ${result.fusion_type}`,
          content: `**Fused Idea**\n\n${patternLine}${result.fused_idea}\n\n**Explanation:**\n${result.explanation}`,
          x: baseX + 200,
          y: baseY,
          dependencies: dependencyIds,
          authors: [AI_AUTHOR],
        });
      }

      setCommand("");
      setContextNodes([]);
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Fusion Error",
        content: err instanceof Error ? err.message : "Idea fusion failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [command, contextNodes, problemId, addInsight, onCreateNode, getStartContext]);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleDismissInsight = useCallback((id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleRemoveContext = useCallback((id: string) => {
    setContextNodes(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleImageAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    if (!onCreateNode) return;

    const baseX = selectedNode?.x ?? 400;
    const baseY = selectedNode?.y ?? 300;

    void (async () => {
      try {
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const dataUrl = await readFileAsDataUrl(file);
          if (!dataUrl) continue;
          const title = file.name.replace(/\.[^/.]+$/, "") || "Image";
          await Promise.resolve(onCreateNode({
            type: "RESOURCE",
            title,
            content: `![${title}](${dataUrl})`,
            x: baseX + index * 40,
            y: baseY + index * 30,
            dependencies: [],
          }));
        }
      } finally {
        if (e.target) {
          e.target.value = "";
        }
      }
    })();
  }, [onCreateNode, selectedNode]);

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
          {(isInputFocused && (command.trim().length > 0 || aiMessages.length > 0)) || isAiLoading ? (
            <div className="border-b border-neutral-100">
              <div className="max-h-64 overflow-y-auto px-3 py-3 space-y-2">
                {/* AI SDK Messages with streaming */}
                {aiMessages.map((msg) => {
                  const isUser = msg.role === "user";
                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-neutral-900 text-white">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }
                  
                  // Parse thinking and response for assistant messages
                  const content = msg.content;
                  const thinkingBlocks = content.match(/<thinking>([\s\S]*?)<\/thinking>/g) || [];
                  const responseText = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
                  
                  return (
                    <div key={msg.id} className="flex flex-col gap-2">
                      {/* Thinking blocks */}
                      {showThinking && thinkingBlocks.length > 0 && (
                        <div className="flex justify-start">
                          <div className="max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-purple-50 border border-purple-200 text-purple-700">
                            <div className="flex items-center gap-1.5 mb-1.5 text-purple-500">
                              <Brain className="w-3 h-3" />
                              <span className="font-medium text-[10px] uppercase tracking-wide">Thinking</span>
                            </div>
                            <div className="text-purple-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                              {thinkingBlocks.map(block => block.replace(/<\/?thinking>/g, "")).join("\n\n")}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Response */}
                      {responseText && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-neutral-50 border border-neutral-200 text-neutral-700 whitespace-pre-wrap">
                            {responseText}
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => handleUseChatInExplore(responseText)}
                                className="text-[10px] text-indigo-600 hover:text-indigo-700"
                              >
                                Use in exploration
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Streaming indicator with current thinking */}
                {isAiLoading && (
                  <div className="flex flex-col gap-2">
                    {currentThinking && showThinking && (
                      <div className="flex justify-start animate-pulse">
                        <div className="max-w-[90%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-purple-50 border border-purple-200 text-purple-600">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Brain className="w-3 h-3 animate-pulse" />
                            <span className="font-medium text-[10px] uppercase tracking-wide">Thinking...</span>
                          </div>
                          <div className="whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {currentThinking.slice(-500)}
                            <span className="inline-block w-1.5 h-3 bg-purple-400 animate-pulse ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}
                    {currentResponse && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-neutral-50 border border-neutral-200 text-neutral-700 whitespace-pre-wrap">
                          {currentResponse}
                          <span className="inline-block w-1.5 h-3 bg-neutral-400 animate-pulse ml-0.5" />
                        </div>
                      </div>
                    )}
                    {!currentThinking && !currentResponse && (
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Iniciando...</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
              
              {/* Toggle thinking visibility */}
              {aiMessages.some(m => m.content.includes("<thinking>")) && (
                <div className="px-3 py-1.5 border-t border-neutral-100 flex justify-end">
                  <button
                    onClick={() => setShowThinking(!showThinking)}
                    className="text-[10px] text-neutral-400 hover:text-neutral-600 flex items-center gap-1"
                  >
                    <Brain className="w-3 h-3" />
                    {showThinking ? "Ocultar pensamiento" : "Mostrar pensamiento"}
                  </button>
                </div>
              )}
            </div>
          ) : null}

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

          {/* Main Input */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Sparkles className="w-5 h-5 text-neutral-400 flex-shrink-0" />

            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handlePrimarySend();
                }
              }}
              placeholder={contextNodes.length > 0 ? `Insights about ${contextNodes[0].title}...` : "Insights..."}
              className="flex-1 text-sm bg-transparent outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:border-none placeholder:text-neutral-400 text-neutral-800"
              disabled={isAiLoading}
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

              {isAiLoading ? (
                <div className="p-2">
                  <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                </div>
              ) : (
                <button
                  onClick={handlePrimarySend}
                  disabled={!command.trim() || isAiLoading || isLoading}
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
              disabled={(!command.trim() && aiMessages.length === 0 && contextNodes.length === 0) || isLoading}
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
              disabled={(!command.trim() && contextNodes.length === 0 && chatMessages.length === 0) || !isOrchestrationAvailable || isLoading || isPipelineRunning}
              active={activeAction === "pipeline"}
            />

            <div className="w-px h-4 bg-neutral-200 mx-1" />

            {/* Idea2Paper Actions */}
            <QuickActionButton
              icon={Filter}
              label="Patterns"
              onClick={handleExploreWithPatterns}
              disabled={(!command.trim() && contextNodes.length === 0) || isLoading}
              active={activeAction === "explore-patterns"}
            />

            <QuickActionButton
              icon={BookOpen}
              label="Story"
              onClick={handleGenerateStory}
              disabled={(!command.trim() && contextNodes.length === 0) || isGeneratingStory}
              active={activeAction === "generate-story"}
            />

            <QuickActionButton
              icon={GitMerge}
              label="Fusion"
              onClick={handleFusionIdeas}
              disabled={contextNodes.length < 2 || isLoading}
              active={activeAction === "fusion"}
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
        copied={copied}
      />

      {/* Story Modal */}
      {storyModalOpen && generatedStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{generatedStory.sections.title}</h2>
                <p className="text-xs text-neutral-500 mt-1">
                  {generatedStory.metadata.pattern_name && `Pattern: ${generatedStory.metadata.pattern_name} • `}
                  Version {generatedStory.version}
                </p>
              </div>
              <button
                onClick={() => setStoryModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Abstract */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Abstract</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{generatedStory.sections.abstract}</p>
              </section>

              {/* Problem Framing */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Problem Framing</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{generatedStory.sections.problem_framing}</p>
              </section>

              {/* Gap Identification */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Gap Identification</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{generatedStory.sections.gap_identification}</p>
              </section>

              {/* Solution Approach */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Solution Approach</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{generatedStory.sections.solution_approach}</p>
              </section>

              {/* Method Skeleton */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Method Skeleton</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{generatedStory.sections.method_skeleton}</p>
              </section>

              {/* Innovation Claims */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Innovation Claims</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{generatedStory.sections.innovation_claims}</p>
              </section>

              {/* Experiments Plan */}
              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Experiments Plan</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{generatedStory.sections.experiments_plan}</p>
              </section>

              {/* Review Result */}
              {generatedStory.review_result && (
                <section className={generatedStory.review_result.passed
                  ? "p-4 rounded-xl bg-emerald-50 border border-emerald-200"
                  : "p-4 rounded-xl bg-amber-50 border border-amber-200"}>
                  <div className="flex items-center gap-2 mb-2">
                    {generatedStory.review_result.passed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-amber-600" />
                    )}
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Review {generatedStory.review_result.passed ? "Passed" : "Below Threshold"}
                    </h3>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-neutral-900">{(generatedStory.review_result.scores.average * 10).toFixed(1)}</p>
                      <p className="text-xs text-neutral-500">Avg Score</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-neutral-900">{(generatedStory.review_result.scores.q25 * 10).toFixed(1)}</p>
                      <p className="text-xs text-neutral-500">Q25</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-neutral-900">{(generatedStory.review_result.scores.q50 * 10).toFixed(1)}</p>
                      <p className="text-xs text-neutral-500">Q50</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-neutral-900">{(generatedStory.review_result.scores.q75 * 10).toFixed(1)}</p>
                      <p className="text-xs text-neutral-500">Q75</p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 mt-2">Criteria: {generatedStory.review_result.pass_criteria}</p>
                </section>
              )}

              {/* Novelty Result */}
              {generatedStory.novelty_result && (
                <section className={generatedStory.novelty_result.is_novel
                  ? "p-4 rounded-xl bg-blue-50 border border-blue-200"
                  : "p-4 rounded-xl bg-orange-50 border border-orange-200"}>
                  <h3 className="text-sm font-semibold text-neutral-900 mb-2">
                    Novelty Check: {generatedStory.novelty_result.is_novel ? "Novel" : "Similar to Existing Work"}
                  </h3>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-lg font-bold text-neutral-900">
                        {(generatedStory.novelty_result.similarity_score * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-neutral-500">Similarity</p>
                    </div>
                    <div>
                      <span className={generatedStory.novelty_result.risk_level === "low"
                        ? "px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"
                        : generatedStory.novelty_result.risk_level === "medium"
                        ? "px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
                        : "px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"}>
                        {generatedStory.novelty_result.risk_level} risk
                      </span>
                    </div>
                  </div>
                  {generatedStory.novelty_result.most_similar && (
                    <p className="text-xs text-neutral-600 mt-2">
                      Most similar: "{generatedStory.novelty_result.most_similar.title}" ({(generatedStory.novelty_result.most_similar.similarity * 100).toFixed(0)}%)
                    </p>
                  )}
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
              <button
                onClick={() => setStoryModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const storyText = "# " + generatedStory.sections.title + "\n\n" +
                    generatedStory.sections.abstract + "\n\n" +
                    generatedStory.sections.problem_framing + "\n\n" +
                    generatedStory.sections.gap_identification + "\n\n" +
                    generatedStory.sections.solution_approach + "\n\n" +
                    generatedStory.sections.method_skeleton + "\n\n" +
                    generatedStory.sections.innovation_claims + "\n\n" +
                    generatedStory.sections.experiments_plan;
                  navigator.clipboard.writeText(storyText);
                  addInsight({
                    type: "insight",
                    title: "Story Copied",
                    content: "Full story copied to clipboard",
                  });
                }}
                className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Copy Story
              </button>
            </div>
          </div>
        </div>
      )}
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
  const getClassName = () => {
    const base = "flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full transition-colors ";
    if (active) return base + "text-neutral-800 bg-neutral-200";
    if (disabled) return base + "text-neutral-300 cursor-not-allowed";
    return base + "text-neutral-500 hover:text-neutral-700";
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={getClassName()}
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
  copied: string | null;
}

function FloatingInsights({ insights, onDismiss, onCopy, copied }: FloatingInsightsProps) {
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
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(insight.id);
              }}
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
          <div className="flex items-center px-3 py-2 bg-neutral-50/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(insight.id, insight.content);
              }}
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
          </div>
        </div>
      ))}
    </div>
  );
}
