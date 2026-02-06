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
  Zap,
  CheckCircle,
  XCircle,
  Brain,
  BookOpen,
  GitMerge,
  Filter,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useChat, Message } from "@ai-sdk/react";
import { CanvasNode, NODE_TYPE_CONFIG } from "./types";
import {
  getOrchestrationStatus,
  exploreContext,
  routeCanvasIdeas,
  exploreWithPatterns,
  formalizeText,
  verifyLeanCode,
  critiqueProposal,
  getCanvasAIChatHistory,
  createCanvasAIRun,
  generateStory,
  fuseIdeas,
  executeComputationNode,
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
  allNodes?: CanvasNode[];
  isVisible: boolean;
  onToggle: () => void;
  onCreateNode?: (data: { type: string; title: string; content: string; formula?: string; leanCode?: string; x?: number; y?: number; dependencies?: string[]; authors?: Array<{ type: "human" | "agent"; id: string; name?: string }>; source?: { file_path?: string; cell_id?: string; agent_run_id?: string } }) => Promise<{ id: string } | void>;
  onUpdateNode?: (nodeId: string, updates: { formula?: string; leanCode?: string; status?: "PROPOSED" | "VERIFIED" | "REJECTED"; verification?: { method: string; logs: string; status: string }; dependencies?: string[] }) => Promise<void> | void;
  onCreateBlock?: (name: string, nodeIds: string[]) => void;
}

const AI_AUTHOR = { type: "agent", id: "orchestrator", name: "Rho" } as const;
const buildAISource = (runId?: string) => (runId ? { agent_run_id: runId } : undefined);
const isComputationNode = (node?: ContextNode | CanvasNode | null) =>
  (node?.type || "").toUpperCase() === "COMPUTATION";

const hasMeaningfulCanvasPrompt = (value: string) => {
  const text = (value || "").trim();
  if (!text) return false;
  if (text.length >= 8) return true;
  if (/[0-9=+\-*/^()]/.test(text)) return true;
  return /\b(odd|even|par|impar|lemma|theorem|proof|lean|python|compute|verify)\b/i.test(text);
};

type SlashMode =
  | "canvas"
  | "formalize"
  | "verify"
  | "critic"
  | "compute"
  | "strategist"
  | "socratic";

const SLASH_MODE_OPTIONS: Array<{
  id: SlashMode;
  label: string;
  title: string;
  description: string;
  aliases: string[];
}> = [
  {
    id: "canvas",
    label: "/explorer",
    title: "Explorer",
    description: "Explore ideas and connect nodes directly on canvas",
    aliases: ["canvas", "explore", "mapa", "diagram"],
  },
  {
    id: "formalize",
    label: "/formalize",
    title: "Lean Formalizer",
    description: "Generate Lean code from selected context",
    aliases: ["formaliza", "lean", "formalise"],
  },
  {
    id: "verify",
    label: "/verify",
    title: "Lean Verifier",
    description: "Run Lean verification on selected Lean node",
    aliases: ["verifica", "check"],
  },
  {
    id: "critic",
    label: "/critic",
    title: "Rigorous Critic",
    description: "Stress-test assumptions and detect weak spots",
    aliases: ["critica", "review", "peer"],
  },
  {
    id: "compute",
    label: "/compute",
    title: "Computation Lab",
    description: "Run Python computations tied to computation nodes",
    aliases: ["python", "calc", "run"],
  },
  {
    id: "strategist",
    label: "/strategist",
    title: "Proof Strategist",
    description: "Plan proof roadmap and node decomposition",
    aliases: ["strategy", "plan", "roadmap", "estrategia"],
  },
  {
    id: "socratic",
    label: "/socratic",
    title: "Socratic Tutor",
    description: "Short guided hints instead of long answers",
    aliases: ["tutor", "coach", "hint"],
  },
];

const SLASH_MODE_ALIASES: Record<string, SlashMode> = SLASH_MODE_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option.id;
  option.aliases.forEach((alias) => {
    acc[alias] = option.id;
  });
  return acc;
}, {} as Record<string, SlashMode>);

const parseSlashCommand = (value: string): { mode: SlashMode | null; text: string; hasDirective: boolean } => {
  const trimmed = (value || "").trim();
  if (!trimmed.startsWith("/")) {
    return { mode: null, text: trimmed, hasDirective: false };
  }

  const match = trimmed.match(/^\/([a-zA-Z_-]+)\b\s*(.*)$/);
  if (!match) {
    return { mode: null, text: trimmed, hasDirective: false };
  }

  const token = (match[1] || "").toLowerCase();
  const mapped = SLASH_MODE_ALIASES[token] || null;
  const rest = (match[2] || "").trim();
  return { mode: mapped, text: rest, hasDirective: true };
};

const getSlashQuery = (value: string): string | null => {
  const trimmedStart = (value || "").trimStart();
  const match = trimmedStart.match(/^\/([a-zA-Z_-]*)$/);
  return match ? (match[1] || "").toLowerCase() : null;
};

const buildExplorePromptForMode = (mode: SlashMode, userPrompt: string) => {
  const trimmed = userPrompt.trim();
  if (!trimmed) return "";
  if (mode === "strategist") {
    return [
      "Role: proof strategist.",
      "Output compact, node-oriented structure for canvas.",
      "Prioritize theorem/lemma/dependency ordering and minimal steps.",
      "",
      trimmed,
    ].join("\n");
  }
  if (mode === "socratic") {
    return [
      "Role: socratic tutor.",
      "Keep responses very short and convert guidance into concrete canvas nodes.",
      "Prefer questions + next action over long exposition.",
      "",
      trimmed,
    ].join("\n");
  }
  return trimmed;
};

const getSlashModeIcon = (mode: SlashMode) => {
  switch (mode) {
    case "formalize":
      return FileCode;
    case "verify":
      return CheckCircle;
    case "critic":
      return Filter;
    case "compute":
      return Zap;
    case "strategist":
      return GitMerge;
    case "socratic":
      return BookOpen;
    case "canvas":
    default:
      return Compass;
  }
};

const getSlashModeAccent = (mode: SlashMode | null) => {
  if (mode === "canvas") {
    return {
      panel: "bg-sky-50/40",
      badge: "bg-sky-100 text-sky-700 border-sky-200",
    };
  }
  if (mode === "formalize" || mode === "verify") {
    return {
      panel: "bg-emerald-50/40",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
  }
  if (mode === "critic") {
    return {
      panel: "bg-amber-50/40",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
    };
  }
  if (mode === "compute") {
    return {
      panel: "bg-fuchsia-50/35",
      badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    };
  }
  if (mode === "strategist") {
    return {
      panel: "bg-indigo-50/35",
      badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  }
  if (mode === "socratic") {
    return {
      panel: "bg-cyan-50/40",
      badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
    };
  }
  return {
    panel: "",
    badge: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };
};

const FORMALIZE_DIRECTIVE_REGEX = /^(?:formaliza(?:\s+esto)?|formalize(?:\s+this)?|lean)\b[:\s-]*/i;
const VERIFY_DIRECTIVE_REGEX = /^(?:verifica(?:\s+esto)?|verify(?:\s+this)?)\b[:\s-]*/i;

const isFormalizeDirectiveText = (value: string) => FORMALIZE_DIRECTIVE_REGEX.test((value || "").trim());

const stripFormalizeDirectiveText = (value: string) => (value || "").trim().replace(FORMALIZE_DIRECTIVE_REGEX, "").trim();
const isVerifyDirectiveText = (value: string) => VERIFY_DIRECTIVE_REGEX.test((value || "").trim());
const stripVerifyDirectiveText = (value: string) => (value || "").trim().replace(VERIFY_DIRECTIVE_REGEX, "").trim();

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

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  if (element.closest('[data-no-shortcuts="true"]')) return true;
  if (element.closest(".monaco-editor")) return true;
  if (element.isContentEditable) return true;
  const tagName = element.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
  const role = element.getAttribute("role");
  return role === "textbox" || role === "combobox";
};

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

const SECTION_KEYWORDS = [
  "definition",
  "lemma",
  "theorem",
  "claim",
  "proposition",
  "corollary",
  "counterexample",
  "computation",
  "formal test",
  "idea",
  "note",
  "resource",
  "example",
  "proof",
  "understanding",
  "key concepts",
  "approaches",
  "insights",
  "next steps",
];

const mapKeywordToType = (keyword: string) => {
  switch (keyword) {
    case "definition":
      return "DEFINITION";
    case "lemma":
      return "LEMMA";
    case "theorem":
      return "THEOREM";
    case "claim":
    case "proposition":
      return "CLAIM";
    case "corollary":
      return "LEMMA";
    case "counterexample":
      return "COUNTEREXAMPLE";
    case "computation":
      return "COMPUTATION";
    case "formal test":
      return "FORMAL_TEST";
    case "idea":
      return "IDEA";
    case "resource":
      return "RESOURCE";
    case "example":
      return "CONTENT";
    case "proof":
      return "CONTENT";
    case "understanding":
      return "NOTE";
    case "key concepts":
      return "DEFINITION";
    case "approaches":
      return "IDEA";
    case "insights":
      return "CLAIM";
    case "next steps":
      return "CONTENT";
    case "note":
    default:
      return "NOTE";
  }
};

const inferNodeTypeFromText = (value: string) => {
  const lower = value.toLowerCase();
  if (lower.includes("definition")) return "DEFINITION";
  if (lower.includes("theorem")) return "THEOREM";
  if (lower.includes("lemma")) return "LEMMA";
  if (lower.includes("claim") || lower.includes("proposition")) return "CLAIM";
  if (lower.includes("corollary")) return "LEMMA";
  if (lower.includes("counterexample")) return "COUNTEREXAMPLE";
  if (lower.includes("computation") || lower.includes("calculation")) return "COMPUTATION";
  if (lower.includes("formal test") || lower.includes("lean test")) return "FORMAL_TEST";
  if (lower.includes("resource") || lower.includes("reference") || lower.includes("paper")) return "RESOURCE";
  if (lower.includes("idea") || lower.includes("approach")) return "IDEA";
  if (lower.includes("insight")) return "CLAIM";
  return "NOTE";
};

const parseTypedSections = (text: string) => {
  const lines = text.split("\n");
  const sections: Array<{ type: string; title: string; content: string }> = [];
  let current: { type: string; title: string; content: string } | null = null;

  const flush = () => {
    if (!current) return;
    const content = current.content.trim();
    if (content.length === 0 && current.title.length === 0) return;
    const title = current.title || deriveGroupTitle(content, "Insight");
    sections.push({ type: current.type, title, content });
  };

  const headerRegex = new RegExp(
    `^(?:[-*+]\\s+|\\d+\\.\\s+)?(?:#{1,3}\\s*)?(?:\\*\\*?)?(${SECTION_KEYWORDS.join("|")})(?:\\*\\*?)?\\s*[:\\-–]?\\s*(.*)$`,
    "i"
  );

  lines.forEach((line) => {
    const match = line.match(headerRegex);
    if (match) {
      flush();
      const keyword = match[1].toLowerCase();
      const remainder = match[2] ? match[2].trim() : "";
      current = {
        type: mapKeywordToType(keyword),
        title: remainder,
        content: "",
      };
      return;
    }

    if (!current) {
      current = { type: inferNodeTypeFromText(text), title: "", content: "" };
    }
    current.content += `${line}\n`;
  });

  flush();

  if (sections.length === 0) {
    const cleaned = text.trim();
    if (!cleaned) return [];
    return [
      {
        type: inferNodeTypeFromText(cleaned),
        title: deriveGroupTitle(cleaned, "Insight"),
        content: cleaned,
      },
    ];
  }

  return sections;
};

const extractChatResponse = (content: string) => {
  const stripped = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
  return stripped || content.trim();
};

const MAX_CHAT_PREVIEW_CHARS = 180;
const MAX_NODE_CONTENT_CHARS = 360;
const MAX_SECTIONS_PER_RESPONSE = 8;

const compactChatText = (content: string, maxChars = MAX_CHAT_PREVIEW_CHARS) => {
  const cleaned = stripMarkdown(content || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).trim()}...`;
};

const splitLongInsightContent = (content: string, maxChars = 220) => {
  const cleaned = (content || "").trim();
  if (!cleaned) return [];

  const bulletLines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*+]|\d+\.)\s+/.test(line))
    .map((line) => line.replace(/^(?:[-*+]|\d+\.)\s+/, "").trim())
    .filter(Boolean);

  if (bulletLines.length >= 2) {
    return bulletLines;
  }

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean);
  if (paragraphs.length >= 2) {
    return paragraphs;
  }

  const sentences = cleaned
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return [cleaned];
  }

  const chunks: string[] = [];
  let current = "";
  sentences.forEach((sentence) => {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }
    if (current) chunks.push(current);
    current = sentence;
  });
  if (current) chunks.push(current);

  return chunks.length > 0 ? chunks : [cleaned];
};

const extractCodeFence = (content: string, language: string): string => {
  const regex = new RegExp("```" + language + "\\n([\\s\\S]*?)```", "i");
  const match = (content || "").match(regex);
  return match && match[1] ? match[1].trim() : "";
};

const looksLikePythonCode = (value: string): boolean => {
  const text = (value || "").trim();
  if (!text) return false;
  const pythonKeywordRegex = /(^|\b)(def|class|for|while|if|elif|else|try|except|import|from|return|with|print|lambda)(\b|$)/m;
  const assignmentRegex = /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=/m;
  const callRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/;
  const newlineIndentRegex = /\n\s{2,}\S/;
  return (
    pythonKeywordRegex.test(text) ||
    assignmentRegex.test(text) ||
    callRegex.test(text) ||
    newlineIndentRegex.test(text)
  );
};

const ensurePythonComputation = (input: string): string | null => {
  const trimmed = (input || "").trim();
  if (!trimmed) return "# TODO: write python code";
  const fenced = extractCodeFence(trimmed, "python") || extractCodeFence(trimmed, "py");
  const code = (fenced || trimmed).trim();
  if (!code) return "# TODO: write python code";
  if (looksLikePythonCode(code)) return code;

  const expressionLike = /^[a-zA-Z0-9_+\-*/().,\s]+$/.test(code) && /[+\-*/()]/.test(code);
  if (expressionLike) return code;

  return null;
};

const LEAN_NODE_TYPES = new Set(["FORMAL_TEST", "LEMMA", "THEOREM", "CLAIM", "DEFINITION", "COUNTEREXAMPLE"]);

const looksLikeLeanCode = (value: string): boolean => {
  const text = (value || "").trim();
  if (!text) return false;
  if (/^\s*import\s+\w+/m.test(text)) return true;
  if (/^\s*(theorem|lemma|example|def|inductive|structure|axiom|instance|#check|#eval|#print|namespace|open|variable)\b/m.test(text)) return true;
  if (/\b:=\s*by\b/.test(text)) return true;
  if (/^\s*by\b/m.test(text)) return true;
  if (/[∀∃→↔ℕℤℚℝ]/.test(text)) return true;
  return false;
};

const extractLeanCodeFromNode = (node?: CanvasNode | null): string | null => {
  if (!node) return null;
  const explicitLean = (node.leanCode || "").trim();
  if (explicitLean) return explicitLean;

  const fenced = extractCodeFence(node.content || "", "lean");
  if (fenced) return fenced;

  if (LEAN_NODE_TYPES.has((node.type || "").toUpperCase()) && looksLikeLeanCode(node.content || "")) {
    return (node.content || "").trim();
  }
  return null;
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

const layoutDiagram = (
  nodes: Array<{ id: string; title: string }>,
  edges: Array<{ from: string; to: string }>,
  baseX: number,
  baseY: number
) => {
  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

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
  const queue = nodes
    .filter((node) => (incoming.get(node.id) || 0) === 0)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((node) => node.id);

  queue.forEach((id) => depths.set(id, 0));

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const depth = depths.get(current) || 0;
    const neighbors = (adjacency.get(current) || [])
      .slice()
      .sort((a, b) => (nodeById.get(a)?.title || a).localeCompare(nodeById.get(b)?.title || b));

    neighbors.forEach((next) => {
      depths.set(next, Math.max(depths.get(next) || 0, depth + 1));
      incoming.set(next, (incoming.get(next) || 1) - 1);
      if ((incoming.get(next) || 0) <= 0) queue.push(next);
    });
  }

  nodes.forEach((node) => {
    if (!depths.has(node.id)) depths.set(node.id, 0);
  });

  const groups = new Map<number, Array<{ id: string; title: string }>>();
  nodes.forEach((node) => {
    const depth = depths.get(node.id) ?? 0;
    if (!groups.has(depth)) groups.set(depth, []);
    groups.get(depth)?.push(node);
  });

  const layerDepths = Array.from(groups.keys()).sort((a, b) => a - b);
  const maxLayerSize = Math.max(...layerDepths.map((d) => groups.get(d)?.length || 0), 1);
  const positions: Record<string, { x: number; y: number }> = {};
  const xSpacing = 420;
  const ySpacing = 220;
  const topY = baseY;

  layerDepths.forEach((depth) => {
    const layer = (groups.get(depth) || [])
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    const layerOffset = (maxLayerSize - layer.length) * ySpacing * 0.5;

    layer.forEach((node, index) => {
      positions[node.id] = {
        x: baseX + depth * xSpacing,
        y: topY + layerOffset + index * ySpacing,
      };
    });
  });

  return positions;
};

const getDiagramBounds = (positions: Record<string, { x: number; y: number }>) => {
  const points = Object.values(positions);
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  return { minX, minY, maxX, maxY };
};

const getOrderedPlacementAnchor = (
  nodes: CanvasNode[],
  seedX: number,
  seedY: number,
  options?: {
    xOffset?: number;
    yOffset?: number;
    laneTolerance?: number;
    laneGap?: number;
  }
) => {
  const xOffset = options?.xOffset ?? 260;
  const yOffset = options?.yOffset ?? 180;
  const laneTolerance = options?.laneTolerance ?? 560;
  const laneGap = options?.laneGap ?? 240;
  const fallback = {
    x: seedX + xOffset,
    y: seedY + yOffset,
  };

  const positionedNodes = nodes.filter(
    (node) =>
      typeof node.x === "number" &&
      Number.isFinite(node.x) &&
      typeof node.y === "number" &&
      Number.isFinite(node.y)
  );

  if (positionedNodes.length === 0) return fallback;

  const laneNodes = positionedNodes.filter((node) => Math.abs(node.x - fallback.x) <= laneTolerance);
  if (laneNodes.length === 0) return fallback;

  const laneMaxY = Math.max(...laneNodes.map((node) => node.y as number));
  return {
    x: fallback.x,
    y: Math.max(fallback.y, laneMaxY + laneGap),
  };
};

const SECTION_TYPE_ORDER: Record<string, number> = {
  DEFINITION: 0,
  THEOREM: 1,
  LEMMA: 2,
  CLAIM: 3,
  FORMAL_TEST: 4,
  COMPUTATION: 5,
  IDEA: 6,
  CONTENT: 7,
  NOTE: 8,
  RESOURCE: 9,
};

export function FloatingAIBar({
  problemId,
  selectedNode,
  selectedNodes = [],
  allNodes = [],
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
  const [showThinking, setShowThinking] = useState(false);
  const [assistantNodeCounts, setAssistantNodeCounts] = useState<Record<string, number>>({});
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [activeSlashMode, setActiveSlashMode] = useState<SlashMode | null>(null);
  const [isMounted, setIsMounted] = useState(isVisible);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Idea2Paper states
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [fusionModalOpen, setFusionModalOpen] = useState(false);
  const [usePatterns, setUsePatterns] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<Story | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [selectedStoriesForFusion, setSelectedStoriesForFusion] = useState<string[]>([]);
  const processedChatMessageIdsRef = useRef<Set<string>>(new Set());
  const onCreateNodeRef = useRef<FloatingAIBarProps["onCreateNode"]>(onCreateNode);
  const leanModeRef = useRef<((promptOverride?: string) => Promise<void>) | null>(null);
  const verifyModeRef = useRef<((promptOverride?: string) => Promise<void>) | null>(null);
  const computeModeRef = useRef<((promptOverride?: string) => Promise<void>) | null>(null);
  const criticModeRef = useRef<((promptOverride?: string) => Promise<void>) | null>(null);
  const exploreRunTokenRef = useRef(0);
  const startContextRef = useRef<{ dependencyIds: string[]; baseX: number; baseY: number }>({
    dependencyIds: [],
    baseX: 400,
    baseY: 300,
  });
  const slashQuery = useMemo(() => getSlashQuery(command), [command]);
  const slashModeOptions = useMemo(() => {
    if (slashQuery === null) return [];
    if (!slashQuery) return SLASH_MODE_OPTIONS;
    return SLASH_MODE_OPTIONS.filter((option) =>
      [option.id, ...option.aliases].some((token) => token.startsWith(slashQuery))
    );
  }, [slashQuery]);
  const showSlashModePicker = slashQuery !== null && slashModeOptions.length > 0;
  const activeSlashModeMeta = useMemo(
    () => (activeSlashMode ? SLASH_MODE_OPTIONS.find((option) => option.id === activeSlashMode) || null : null),
    [activeSlashMode]
  );

  const applySlashMode = useCallback((mode: SlashMode) => {
    setActiveSlashMode(mode);
    setCommand("");
    setSlashMenuIndex(0);
    setIsInputFocused(true);
    inputRef.current?.focus();
  }, []);

  const clearSlashMode = useCallback(() => {
    setActiveSlashMode(null);
    setSlashMenuIndex(0);
    setIsInputFocused(true);
    inputRef.current?.focus();
  }, []);

  const handleCommandChange = useCallback((value: string) => {
    const parsed = parseSlashCommand(value);
    if (parsed.hasDirective && parsed.mode) {
      setActiveSlashMode(parsed.mode);
      setCommand(parsed.text);
      setSlashMenuIndex(0);
      return;
    }
    setCommand(value);
  }, []);

  const resolveContextNodeRefs = useCallback((): ContextNode[] => {
    if (contextNodes.length > 0) return contextNodes;
    if (selectedNodes.length > 0) {
      return selectedNodes.map((node) => ({
        id: node.id,
        title: node.title,
        type: node.type,
      }));
    }
    if (selectedNode) {
      return [{ id: selectedNode.id, title: selectedNode.title, type: selectedNode.type }];
    }
    return [];
  }, [contextNodes, selectedNodes, selectedNode]);

  const resolveContextCanvasNodes = useCallback((): CanvasNode[] => {
    const refs = resolveContextNodeRefs();
    if (refs.length === 0) return [];

    const byId = new Map<string, CanvasNode>();
    allNodes.forEach((node) => byId.set(node.id, node));
    selectedNodes.forEach((node) => byId.set(node.id, node));
    if (selectedNode) {
      byId.set(selectedNode.id, selectedNode);
    }

    const seen = new Set<string>();
    const resolved: CanvasNode[] = [];
    refs.forEach((ref) => {
      const node = byId.get(ref.id);
      if (!node || seen.has(node.id)) return;
      seen.add(node.id);
      resolved.push(node);
    });
    return resolved;
  }, [resolveContextNodeRefs, allNodes, selectedNodes, selectedNode]);

  const buildSelectedContextSummary = useCallback((maxContentChars = 900): string => {
    const nodes = resolveContextCanvasNodes();
    if (nodes.length === 0) return "";

    return nodes.map((node, index) => {
      const body = (node.content || "").trim();
      const lean = extractLeanCodeFromNode(node);
      const parts = [
        `[Node ${index + 1}]`,
        `Title: ${node.title}`,
        `Type: ${node.type}`,
      ];
      if (body) {
        parts.push(
          isImageContent(body)
            ? "Content: [image attached]"
            : `Content:\n${body.slice(0, maxContentChars)}`
        );
      }
      if (lean) {
        parts.push(`Lean code:\n\`\`\`lean\n${lean}\n\`\`\``);
      }
      return parts.join("\n");
    }).join("\n\n");
  }, [resolveContextCanvasNodes]);

  const getStartContext = useCallback(() => {
    const contextRefs = resolveContextNodeRefs();
    const contextFullNodes = resolveContextCanvasNodes();
    const primaryNode = contextFullNodes[0] || selectedNode || selectedNodes[0] || null;

    return {
      primaryNode,
      dependencyIds: contextRefs.map((n) => n.id),
      baseX: primaryNode?.x ?? 400,
      baseY: primaryNode?.y ?? 300,
    };
  }, [resolveContextNodeRefs, resolveContextCanvasNodes, selectedNode, selectedNodes]);

  const resolveLeanCodeFromSelection = useCallback((): string | null => {
    for (const node of resolveContextCanvasNodes()) {
      const lean = extractLeanCodeFromNode(node);
      if (lean) return lean;
    }
    return null;
  }, [resolveContextCanvasNodes]);

  useEffect(() => {
    onCreateNodeRef.current = onCreateNode;
  }, [onCreateNode]);

  useEffect(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (isVisible) {
      setIsMounted(true);
      setIsClosing(false);
      return;
    }

    if (isMounted) {
      setIsClosing(true);
      closeTimeoutRef.current = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
      }, 260);
    }
  }, [isVisible, isMounted]);

  useEffect(() => {
    if (!showSlashModePicker) {
      setSlashMenuIndex(0);
      return;
    }
    if (slashMenuIndex >= slashModeOptions.length) {
      setSlashMenuIndex(0);
    }
  }, [showSlashModePicker, slashMenuIndex, slashModeOptions.length]);

  useEffect(() => {
    const { dependencyIds, baseX, baseY } = getStartContext();
    startContextRef.current = { dependencyIds, baseX, baseY };
  }, [getStartContext]);

  // Build context for AI from selected nodes
  const aiContext = useMemo(() => {
    return buildSelectedContextSummary(500);
  }, [buildSelectedContextSummary]);

  const createTypedNodesFromText = useCallback(async (text: string): Promise<number> => {
    const createNode = onCreateNodeRef.current;
    if (!createNode) return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;

    const { dependencyIds, baseX, baseY } = startContextRef.current;
    const anchor = getOrderedPlacementAnchor(allNodes, baseX, baseY, {
      xOffset: 240,
      yOffset: 180,
      laneTolerance: 520,
      laneGap: 220,
    });
    let sections = parseTypedSections(trimmed);
    if (sections.length === 0) return 0;

    if (sections.length === 1 && sections[0].type === "NOTE") {
      const chunks = splitLongInsightContent(sections[0].content);
      if (chunks.length >= 2) {
        const cycle = ["IDEA", "CLAIM", "CONTENT", "NOTE"];
        sections = chunks.map((chunk, idx) => {
          let type = inferNodeTypeFromText(chunk);
          if (type === "NOTE") {
            type = cycle[idx % cycle.length];
          }
          return {
            type,
            title: deriveGroupTitle(chunk, `Insight ${idx + 1}`),
            content: chunk,
          };
        });
      }
    }

    sections = sections
      .filter((section) => section.title.trim() || section.content.trim())
      .slice(0, MAX_SECTIONS_PER_RESPONSE)
      .map((section) => {
        const title = deriveGroupTitle(section.title || section.content, "Insight").trim();
        const rawContent = section.content.trim() || section.title.trim();
        const content = rawContent.length > MAX_NODE_CONTENT_CHARS
          ? `${rawContent.slice(0, MAX_NODE_CONTENT_CHARS).trim()}...`
          : rawContent;
        return {
          type: section.type,
          title,
          content,
        };
      })
      .sort((a, b) => {
        const orderA = SECTION_TYPE_ORDER[a.type] ?? 999;
        const orderB = SECTION_TYPE_ORDER[b.type] ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
      })
      .map((section) => ({
        ...section,
        title: section.title.trim(),
        content: section.content.trim(),
      }));

    if (sections.length === 0) return 0;

    let lastCreatedId: string | null = null;
    const createdIds: string[] = [];

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const rowsPerColumn = 6;
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const position = {
        x: anchor.x + column * 360,
        y: anchor.y + row * 220,
      };
      const deps = new Set(dependencyIds);
      if (lastCreatedId) deps.add(lastCreatedId);
      const normalizedComputation = section.type === "COMPUTATION"
        ? ensurePythonComputation(section.content || section.title)
        : null;
      const finalType = section.type === "COMPUTATION" && !normalizedComputation ? "NOTE" : section.type;
      const nodeContent = finalType === "COMPUTATION"
        ? (normalizedComputation || "# TODO: write python code")
        : section.content;

      const created = await createNode({
        type: finalType,
        title: section.title,
        content: nodeContent,
        x: position.x,
        y: position.y,
        dependencies: Array.from(deps),
        authors: [AI_AUTHOR],
      });

      if (created && typeof created === "object" && "id" in created && created.id) {
        lastCreatedId = created.id;
        createdIds.push(created.id);
      }
    }

    return createdIds.length;
  }, [allNodes]);

  const addInsight = useCallback((insight: Omit<FloatingInsight, "id" | "timestamp">) => {
    const newInsight: FloatingInsight = {
      ...insight,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setInsights((prev) => [newInsight, ...prev].slice(0, 5));
  }, []);

  const handleAssistantMessage = useCallback(async (messageId: string, content: string) => {
    if (processedChatMessageIdsRef.current.has(messageId)) return;
    processedChatMessageIdsRef.current.add(messageId);

    const response = extractChatResponse(content);
    if (!response) return;

    const createdCount = await createTypedNodesFromText(response);
    setAssistantNodeCounts((prev) => ({
      ...prev,
      [messageId]: createdCount,
    }));

    addInsight({
      type: "insight",
      title: "Canvas actualizado",
      content: createdCount > 0
        ? `Creé ${createdCount} nodo${createdCount === 1 ? "" : "s"} en el canvas.`
        : compactChatText(response, 120),
    });
  }, [createTypedNodesFromText, addInsight]);

  const actionProgressLabel = useMemo(() => {
    if (!activeAction) return null;
    const labels: Record<string, string> = {
      explore: "Explorer running",
      "explore-patterns": "Explorer (patterns) running",
      formalize: "Formalizer running",
      verify: "Verifier running",
      lean: "Lean mode running",
      compute: "Compute agent running",
      critic: "Critic running",
      pipeline: "Pipeline running",
      insight: "Insight agent running",
      "generate-story": "Story agent running",
      fusion: "Fusion agent running",
    };
    return labels[activeAction] || "Agent running";
  }, [activeAction]);
  const cancelExplore = useCallback(() => {
    exploreRunTokenRef.current += 1;
    setIsLoading(false);
    setActiveAction((prev) => (prev === "explore" ? null : prev));
    addInsight({
      type: "insight",
      title: "Exploración cancelada",
      content: "Cancelé la generación en curso.",
    });
  }, [addInsight]);

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
      void handleAssistantMessage(message.id, message.content);
    },
  });
  const showActionProgressBar = Boolean(
    actionProgressLabel && (isAiLoading || isLoading || isPipelineRunning || activeAction !== null)
  );

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


  useEffect(() => {
    if (isAiLoading) return;
    const lastAssistant = [...aiMessages].reverse().find((msg) => msg.role === "assistant");
    if (!lastAssistant) return;
    if (processedChatMessageIdsRef.current.has(lastAssistant.id)) return;
    void handleAssistantMessage(lastAssistant.id, lastAssistant.content);
  }, [aiMessages, isAiLoading, handleAssistantMessage]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not execute global shortcuts while user is typing.
      if (isEditableTarget(e.target)) return;
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

  const handleExplore = useCallback(async (promptOverride?: string) => {
    if (isLoading && activeAction === "explore") {
      cancelExplore();
      return;
    }
    const effectivePrompt = (promptOverride ?? command).trim();
    const autoContextNodes = resolveContextNodeRefs();
    const autoContextFullNodes = resolveContextCanvasNodes();
    const promptForRouter = effectivePrompt || autoContextNodes.map((n) => n.title).join("; ");

    console.log("[FloatingAIBar] handleExplore called:", {
      problemId,
      command: promptForRouter,
      hasCommand: !!promptForRouter,
      chatMessagesLength: chatMessages.length,
      contextNodesLength: autoContextNodes.length,
      effectiveContextNodesLength: autoContextNodes.length,
      shouldProceed: !!(promptForRouter || chatMessages.length > 0 || autoContextNodes.length > 0),
    });

    if (!problemId) {
      console.error("[FloatingAIBar] No problemId provided");
      return;
    }
    
    const hasMeaningfulPrompt = hasMeaningfulCanvasPrompt(promptForRouter);
    if (
      !hasMeaningfulPrompt &&
      chatMessages.length === 0 &&
      autoContextNodes.length === 0
    ) {
      addInsight({
        type: "insight",
        title: "Prompt muy corto",
        content: "Escribe una petición un poco más concreta o selecciona un nodo.",
      });
      return;
    }

    if (!promptForRouter && chatMessages.length === 0 && autoContextNodes.length === 0) {
      console.warn("[FloatingAIBar] Cannot explore: no command, no chat messages, and no context nodes");
      addInsight({
        type: "insight",
        title: "Cannot Explore",
        content: "Please provide a command or select nodes to explore their context.",
      });
      return;
    }

    const runToken = ++exploreRunTokenRef.current;
    const isStaleRun = () => runToken !== exploreRunTokenRef.current;

    setIsLoading(true);
    setActiveAction("explore");

    try {
      console.log("[FloatingAIBar] Starting exploration with context...");

      // Build rich context including node content + chat
      let contextStr = "";
      if (autoContextFullNodes.length > 0) {
        const contextDetails = autoContextFullNodes.map((fullNode) => {
          const content = fullNode?.content
            ? isImageContent(fullNode.content)
              ? " - [image]"
              : ` - ${fullNode.content}`
            : "";
          return `${fullNode.title} (${fullNode.type})${content}`;
        }).join("\n");
        contextStr = `Context nodes:\n${contextDetails}\n\n`;
      }
      const chatContext = buildChatContext(chatMessages);
      const fullContext = [contextStr, chatContext, effectivePrompt].filter(Boolean).join("\n\n");

      console.log("[FloatingAIBar] Calling canvas router API...");
      const result = await routeCanvasIdeas({
        problem_id: problemId,
        prompt: promptForRouter,
        context: fullContext,
        max_iterations: 3,
        include_critique: true,
      });
      if (isStaleRun()) return;
      
      console.log("[FloatingAIBar] canvas router result:", {
        route: result.route,
        agents: result.agents_used,
        proposalsCount: result.proposals?.length,
        runId: result.run_id,
        hasDiagrams: result.proposals?.some((proposal) => Boolean((proposal as { diagram?: DiagramSpec }).diagram)),
      });
      
      const runId = result.run_id;

      if (result.insight) {
        addInsight({
          type: "insight",
          title: "Router",
          content: `${result.insight} (${result.route})`,
        });
      }

      const { baseX, baseY } = getStartContext();
      const anchor = getOrderedPlacementAnchor(allNodes, baseX, baseY, {
        xOffset: 260,
        yOffset: 180,
        laneTolerance: 640,
        laneGap: 260,
      });
      const orderedBaseX = anchor.x;
      let proposalCursorY = anchor.y;
      const dependencyIds = autoContextNodes.map((n) => n.id);

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
        if (isStaleRun()) break;
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
          
          const diagramBaseX = orderedBaseX;
          const diagramBaseY = proposalCursorY;
          const positions = layoutDiagram(diagram.nodes, diagram.edges || [], diagramBaseX, diagramBaseY);
          const diagramBounds = getDiagramBounds(positions);
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
                const position = positions[node.id] || { x: diagramBaseX, y: diagramBaseY };
                const baseDeps = (incomingCounts.get(node.id) || 0) === 0 ? dependencyIds : [];
                const rawNodeContent = node.content || proposal.content || node.title;
                const normalizedComputation = node.type === "COMPUTATION"
                  ? ensurePythonComputation(rawNodeContent)
                  : null;
                const finalType = node.type === "COMPUTATION" && !normalizedComputation ? "NOTE" : node.type;
                const nodeContent = finalType === "COMPUTATION"
                  ? (normalizedComputation || "# TODO: write python code")
                  : rawNodeContent;

                const created = await onCreateNode({
                  type: finalType,
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

              // Optional explanation node from proposal reasoning
              if (proposal.reasoning && onCreateNode) {
                const explanationDeps = createdNodeIds.length > 0 ? [createdNodeIds[0]] : dependencyIds;
                const explanationTitle = deriveGroupTitle(proposal.reasoning, "Explanation");
                await onCreateNode({
                  type: "NOTE",
                  title: explanationTitle,
                  content: `**Reasoning**\n\n${proposal.reasoning}`,
                  x: diagramBounds.maxX + 320,
                  y: diagramBounds.minY,
                  dependencies: explanationDeps,
                  authors: [AI_AUTHOR],
                  source: buildAISource(runId),
                });
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

          proposalCursorY = Math.max(proposalCursorY + 360, diagramBounds.maxY + 420);

          continue;
        }

        const nodeX = orderedBaseX;
        const nodeY = proposalCursorY + 20;
        const confidencePercent = Math.round(proposal.score * 100);
        const nodeContent = `**Confidence: ${confidencePercent}%**\n\n${proposal.content}\n\n---\n*Reasoning: ${proposal.reasoning}*`;

        console.log(`[FloatingAIBar] Creating single node for proposal ${index + 1}`);
        
        // Create individual node in queue
        await queueCanvasOperation(
          `create-single-node-${proposal.content.slice(0, 30)}`,
          async () => {
            if (isStaleRun()) return undefined;
            const inferredType = inferNodeTypeFromText(`${proposal.content}\n${proposal.reasoning || ""}`);
            const normalizedComputation = inferredType === "COMPUTATION"
              ? ensurePythonComputation(`${proposal.content}\n${proposal.reasoning || ""}`)
              : null;
            const finalType = inferredType === "COMPUTATION" && !normalizedComputation ? "NOTE" : inferredType;
            const created = await onCreateNode({
              type: finalType,
              title: deriveGroupTitle(proposal.content, "Proposal"),
              content: finalType === "COMPUTATION"
                ? (normalizedComputation || "# TODO: write python code")
                : nodeContent,
              x: nodeX,
              y: nodeY,
              dependencies: dependencyIds,
              authors: [AI_AUTHOR],
              source: buildAISource(runId),
            });

            if (proposal.reasoning && created && typeof created === "object" && "id" in created && created.id) {
              const explanationTitle = deriveGroupTitle(proposal.reasoning, "Explanation");
              await onCreateNode({
                type: "NOTE",
                title: explanationTitle,
                content: `**Reasoning**\n\n${proposal.reasoning}`,
                x: nodeX + 360,
                y: nodeY,
                dependencies: [created.id],
                authors: [AI_AUTHOR],
                source: buildAISource(runId),
              });
            }

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

        proposalCursorY += 420;
      }

      setCommand("");
      // Clear context after creating nodes
      setContextNodes([]);
      
      console.log("[FloatingAIBar] ✅ Exploration completed successfully");
    } catch (err) {
      if (isStaleRun()) return;
      console.error("[FloatingAIBar] ❌ Exploration failed:", err);
      addInsight({
        type: "insight",
        title: "Error",
        content: err instanceof Error ? err.message : "Exploration failed",
      });
    } finally {
      if (!isStaleRun()) {
        setIsLoading(false);
        setActiveAction(null);
      }
    }
  }, [command, problemId, chatMessages, addInsight, onCreateNode, onUpdateNode, onCreateBlock, allNodes, isLoading, activeAction, cancelExplore, resolveContextNodeRefs, resolveContextCanvasNodes, getStartContext]);

  const handleChatSend = useCallback(async () => {
    if (!problemId || isAiLoading) return;
    let trimmed = command.trim();
    let mode = activeSlashMode;

    if (trimmed.startsWith("/")) {
      const slash = parseSlashCommand(trimmed);
      if (slash.hasDirective && !slash.mode) {
        addInsight({
          type: "insight",
          title: "Unknown command",
          content: "Use /canvas, /formalize, /verify, /critic, /compute, /strategist o /socratic.",
        });
        return;
      }
      if (slash.mode) {
        mode = slash.mode;
        setActiveSlashMode(slash.mode);
        trimmed = slash.text;
        setCommand(slash.text);
      }
    }

    const runMode = async (selectedMode: SlashMode, inputText: string) => {
      if (selectedMode === "canvas" || selectedMode === "strategist" || selectedMode === "socratic") {
        await handleExplore(buildExplorePromptForMode(selectedMode, inputText));
        return;
      }
      if (selectedMode === "formalize") {
        if (!leanModeRef.current) {
          addInsight({
            type: "insight",
            title: "Formalize unavailable",
            content: "No pude iniciar formalización en este momento.",
          });
          return;
        }
        await leanModeRef.current(inputText);
        return;
      }
      if (selectedMode === "verify") {
        if (!verifyModeRef.current) {
          addInsight({ type: "insight", title: "Verify unavailable", content: "Verify mode is not ready yet." });
          return;
        }
        await verifyModeRef.current(inputText);
        return;
      }
      if (selectedMode === "critic") {
        if (!criticModeRef.current) {
          addInsight({ type: "insight", title: "Critic unavailable", content: "Critic mode is not ready yet." });
          return;
        }
        await criticModeRef.current(inputText);
        return;
      }
      if (selectedMode === "compute") {
        if (!computeModeRef.current) {
          addInsight({ type: "insight", title: "Compute unavailable", content: "Compute mode is not ready yet." });
          return;
        }
        await computeModeRef.current(inputText);
      }
    };

    if (mode) {
      await runMode(mode, trimmed);
      return;
    }

    const verifyPrompt = isVerifyDirectiveText(trimmed) ? stripVerifyDirectiveText(trimmed) : null;
    if (verifyPrompt !== null) {
      setActiveSlashMode("verify");
      if (!verifyModeRef.current) {
        addInsight({
          type: "insight",
          title: "Verify unavailable",
          content: "No pude iniciar verificación en este momento.",
        });
        return;
      }
      await verifyModeRef.current(verifyPrompt);
      return;
    }

    const formalizePrompt = isFormalizeDirectiveText(trimmed) ? stripFormalizeDirectiveText(trimmed) : null;
    if (formalizePrompt !== null) {
      setActiveSlashMode("formalize");
      if (!leanModeRef.current) {
        addInsight({
          type: "insight",
          title: "Formalize unavailable",
          content: "No pude iniciar formalización en este momento.",
        });
        return;
      }
      await leanModeRef.current(formalizePrompt);
      return;
    }

    if (!trimmed) return;
    setCommand("");

    await appendAiMessage({
      role: "user",
      content: trimmed,
    });
  }, [problemId, isAiLoading, command, activeSlashMode, addInsight, handleExplore, appendAiMessage]);

  const handleUseChatInExplore = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setCommand(trimmed);
    setIsInputFocused(true);
    inputRef.current?.focus();
    if (!problemId || isLoading || isPipelineRunning) return;
    setIsLoading(true);
    setActiveAction("explore");
    try {
      const contextSummary = contextNodes.length > 0
        ? `Context nodes:\n${contextNodes.map((node) => `- ${node.title} (${node.type})`).join("\n")}`
        : "";
      const result = await routeCanvasIdeas({
        problem_id: problemId,
        prompt: trimmed,
        context: [contextSummary, trimmed].filter(Boolean).join("\n\n"),
        max_iterations: 3,
        include_critique: true,
      });
      const explorationRunId = result?.run_id || undefined;
      if (result?.proposals?.length) {
        if (result.insight) {
          addInsight({
            type: "insight",
            title: "Router",
            content: `${result.insight} (${result.route})`,
          });
        }
        const { baseX, baseY, dependencyIds } = getStartContext();
        const anchor = getOrderedPlacementAnchor(allNodes, baseX, baseY, {
          xOffset: 260,
          yOffset: 180,
          laneTolerance: 560,
          laneGap: 220,
        });
        let proposalY = anchor.y;

        addInsight({
          type: "insight",
          title: "Exploration Draft",
          content: `Generated ${result.proposals.length} proposals.`,
        });
        for (const proposal of result.proposals) {
          if (!onCreateNode) continue;
          try {
            await Promise.resolve(
              onCreateNode({
                type: inferNodeTypeFromText(`${proposal.content}\n${proposal.reasoning || ""}`),
                title: deriveGroupTitle(proposal.content, "Proposal"),
                content: proposal.content,
                x: anchor.x,
                y: proposalY,
                dependencies: dependencyIds,
                authors: [AI_AUTHOR],
                source: buildAISource(explorationRunId),
              })
            );
            proposalY += 240;
          } catch (err) {
            console.error("Failed to create exploration node", err);
          }
        }
      } else {
        addInsight({
          type: "insight",
          title: "Exploration Complete",
          content: "No proposals returned. Try a different prompt.",
        });
      }
    } catch (err) {
      console.error("Exploration failed", err);
      addInsight({
        type: "insight",
        title: "Exploration Failed",
        content: err instanceof Error ? err.message : "Exploration failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [
    addInsight,
    allNodes,
    contextNodes,
    getStartContext,
    isLoading,
    isPipelineRunning,
    onCreateNode,
    problemId,
  ]);

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
    if (!problemId) return;
    const selectedContextNodes = resolveContextCanvasNodes();
    if (selectedContextNodes.length === 0) return;

    setIsLoading(true);
    setActiveAction("formalize");

    try {
      const node = selectedContextNodes[0];
      const sourceText = buildSelectedContextSummary() || `${node.title}: ${node.content || ""}`;
      const result = await formalizeText({
        problem_id: problemId,
        text: sourceText,
      });

      setCurrentLeanCode(result.lean_code);

      const { primaryNode, dependencyIds, baseX, baseY } = getStartContext();
      const leanTitle = primaryNode ? `Lean for ${primaryNode.title}` : "Lean 4 code";

      if (onCreateNode) {
        await onCreateNode({
          type: "FORMAL_TEST",
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
  }, [problemId, addInsight, onUpdateNode, onCreateNode, getStartContext, resolveContextCanvasNodes, buildSelectedContextSummary]);

  const handleVerify = useCallback(async (leanCodeOverride?: string) => {
    if (!problemId) return;
    const leanCode = (leanCodeOverride ?? currentLeanCode ?? "").trim();
    if (!leanCode) return;

    setIsLoading(true);
    setActiveAction("verify");
    setVerificationResult(null);

    try {
      const result = await verifyLeanCode({
        problem_id: problemId,
        lean_code: leanCode,
      });

      setVerificationResult({ success: result.success, log: result.log });
      const { primaryNode, dependencyIds, baseX, baseY } = getStartContext();

      if (onCreateNode) {
        await onCreateNode({
          type: "NOTE",
          title: result.success
            ? `✓ Verification of ${primaryNode?.title || "Lean code"}`
            : `✗ Verification of ${primaryNode?.title || "Lean code"}`,
          content: `**Result:** ${result.success ? "OK" : "Failed"}\n\n${result.log || result.error || "No log"}\n\n\`\`\`lean\n${leanCode}\n\`\`\``,
          leanCode: leanCode,
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

  const handleVerifyMode = useCallback(async (promptOverride?: string) => {
    const explicitPrompt = (promptOverride || "").trim();
    const leanFromSelection = resolveLeanCodeFromSelection();
    if (!leanFromSelection) {
      addInsight({
        type: "insight",
        title: "Verify needs Lean node",
        content: explicitPrompt
          ? "Selecciona un nodo con codigo Lean para verificar. /verify no formaliza ni genera codigo."
          : "Selecciona un nodo que ya tenga codigo Lean para ejecutar la verificacion.",
      });
      return;
    }

    setCurrentLeanCode(leanFromSelection);
    await handleVerify(leanFromSelection);
  }, [addInsight, handleVerify, resolveLeanCodeFromSelection]);

  const handleLeanMode = useCallback(async (promptOverride?: string) => {
    if (!problemId) return;

    const { primaryNode, dependencyIds, baseX, baseY } = getStartContext();
    const explicitPrompt = (promptOverride ?? stripFormalizeDirectiveText(command.trim())).trim();
    const selectionSummary = buildSelectedContextSummary();
    const sourceText = [selectionSummary, explicitPrompt].filter(Boolean).join("\n\n");

    if (!sourceText.trim()) {
      addInsight({
        type: "insight",
        title: "Lean mode needs input",
        content: "Select a node or write what you want to formalize.",
      });
      return;
    }

    setIsLoading(true);
    setActiveAction("formalize");

    try {
      const formalization = await formalizeText({
        problem_id: problemId,
        text: sourceText,
      });
      setCurrentLeanCode(formalization.lean_code);

      if (onCreateNode) {
        await onCreateNode({
          type: "FORMAL_TEST",
          title: primaryNode ? `Formal test: ${primaryNode.title}` : "Formal Lean test",
          content: `\`\`\`lean\n${formalization.lean_code}\n\`\`\``,
          leanCode: formalization.lean_code,
          x: baseX + 260,
          y: baseY + 140,
          dependencies: dependencyIds,
          authors: [AI_AUTHOR],
          source: buildAISource(formalization.run_id),
        });
      }

      if (onUpdateNode && primaryNode?.id) {
        onUpdateNode(primaryNode.id, {
          leanCode: formalization.lean_code,
        });
      }

      addInsight({
        type: "code",
        title: "Lean code generated",
        content: formalization.lean_code.slice(0, 300),
        score: formalization.confidence,
        runId: formalization.run_id,
      });
      setCommand("");
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Lean mode error",
        content: err instanceof Error ? err.message : "Lean mode failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [problemId, getStartContext, command, addInsight, onCreateNode, onUpdateNode, buildSelectedContextSummary]);

  useEffect(() => {
    leanModeRef.current = handleLeanMode;
  }, [handleLeanMode]);

  const handleComputeMode = useCallback(async (promptOverride?: string) => {
    if (!problemId) return;

    const { primaryNode, dependencyIds, baseX, baseY } = getStartContext();
    const contextSelection = resolveContextCanvasNodes();
    const selectedComputationNode =
      contextSelection.find((node) => isComputationNode(node)) ||
      (isComputationNode(primaryNode) ? primaryNode : undefined);
    const inputCode = (promptOverride ?? command).trim();
    const normalizedInputCode = inputCode
      ? ensurePythonComputation(inputCode)
      : "";
    let targetNodeId: string | undefined = selectedComputationNode?.id;
    let baseDependencies = dependencyIds;

    if (!targetNodeId) {
      if (!inputCode) {
        addInsight({
          type: "insight",
          title: "Compute mode needs code",
          content: "Select a COMPUTATION node or write Python code in the input.",
        });
        return;
      }
      if (!normalizedInputCode) {
        addInsight({
          type: "insight",
          title: "Compute mode expects Python",
          content: "Escribe codigo Python ejecutable en lugar de texto descriptivo.",
        });
        return;
      }
      if (!onCreateNode) {
        addInsight({
          type: "insight",
          title: "Cannot create computation node",
          content: "Computation requires node creation support in this canvas view.",
        });
        return;
      }

      const created = await onCreateNode({
        type: "COMPUTATION",
        title: deriveGroupTitle(inputCode, "Computation"),
        content: normalizedInputCode,
        x: baseX + 220,
        y: baseY + 140,
        dependencies: dependencyIds,
        authors: [AI_AUTHOR],
      });
      if (created && typeof created === "object" && "id" in created && created.id) {
        targetNodeId = created.id;
        baseDependencies = Array.from(new Set([created.id, ...dependencyIds]));
      }
    }

    if (!targetNodeId) {
      addInsight({
        type: "insight",
        title: "Compute mode unavailable",
        content: "Unable to resolve a computation node for execution.",
      });
      return;
    }

    setIsLoading(true);
    setActiveAction("compute");
    try {
      if (inputCode && !normalizedInputCode) {
        addInsight({
          type: "insight",
          title: "Compute mode expects Python",
          content: "Escribe codigo Python ejecutable en lugar de texto descriptivo.",
        });
        return;
      }
      const execution = await executeComputationNode(problemId, targetNodeId, {
        code: normalizedInputCode || undefined,
      });

      const combinedLog = [execution.stdout, execution.stderr].filter(Boolean).join("\n").trim();
      if (onUpdateNode) {
        onUpdateNode(targetNodeId, {
          status: execution.success ? "VERIFIED" : "PROPOSED",
          verification: {
            method: "python",
            logs: combinedLog || execution.error || "",
            status: execution.success ? "pass" : "fail",
          },
        });
      }

      if (onCreateNode) {
        const previewStdout = execution.stdout || "(no stdout)";
        const previewStderr = execution.stderr || "(no stderr)";
        await onCreateNode({
          type: "NOTE",
          title: execution.success ? "Computation result" : "Computation error",
          content: [
            `**Success:** ${execution.success ? "yes" : "no"}`,
            `**Duration:** ${execution.duration_ms} ms`,
            "",
            "**Executed code**",
            "```python",
            execution.executed_code,
            "```",
            "",
            "**Stdout**",
            "```text",
            previewStdout,
            "```",
            "",
            "**Stderr**",
            "```text",
            previewStderr,
            "```",
          ].join("\n"),
          x: baseX + 320,
          y: baseY + 300,
          dependencies: Array.from(new Set([targetNodeId, ...baseDependencies])),
          authors: [AI_AUTHOR],
        });
      }

      addInsight({
        type: "insight",
        title: execution.success ? "Compute mode complete" : "Compute mode failed",
        content: execution.success
          ? (execution.stdout || "Execution finished without stdout.").slice(0, 300)
          : (execution.error || execution.stderr || "Execution failed").slice(0, 300),
      });
      setCommand("");
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Compute mode error",
        content: err instanceof Error ? err.message : "Computation failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [problemId, getStartContext, command, onCreateNode, onUpdateNode, addInsight, resolveContextCanvasNodes]);

  useEffect(() => {
    verifyModeRef.current = handleVerifyMode;
  }, [handleVerifyMode]);

  useEffect(() => {
    computeModeRef.current = handleComputeMode;
  }, [handleComputeMode]);

  const handleCriticMode = useCallback(async (promptOverride?: string) => {
    if (!problemId) return;
    const { dependencyIds, baseX, baseY } = getStartContext();
    const explicitPrompt = (promptOverride || "").trim();
    const selectionSummary = buildSelectedContextSummary();
    const targetProposal = explicitPrompt || selectionSummary;

    if (!targetProposal.trim()) {
      addInsight({
        type: "insight",
        title: "Critic needs input",
        content: "Write a claim/proof sketch or select a node first.",
      });
      return;
    }

    setIsLoading(true);
    setActiveAction("critic");
    try {
      const critique = await critiqueProposal({
        problem_id: problemId,
        proposal: targetProposal,
        context: selectionSummary || undefined,
        goal: explicitPrompt || undefined,
      });

      if (onCreateNode) {
        await onCreateNode({
          type: "NOTE",
          title: `Critique: ${deriveGroupTitle(targetProposal, "Proposal")}`,
          content: [
            `**Score:** ${(critique.score * 100).toFixed(0)}%`,
            "",
            "**Feedback**",
            critique.feedback,
          ].join("\n"),
          x: baseX + 320,
          y: baseY + 220,
          dependencies: dependencyIds,
          authors: [AI_AUTHOR],
          source: buildAISource(critique.run_id),
        });
      }

      addInsight({
        type: "insight",
        title: "Critique complete",
        content: compactChatText(critique.feedback, 180),
        score: critique.score,
        runId: critique.run_id,
      });
      setCommand("");
    } catch (err) {
      addInsight({
        type: "insight",
        title: "Critic mode error",
        content: err instanceof Error ? err.message : "Critique failed",
      });
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }, [problemId, getStartContext, addInsight, onCreateNode, buildSelectedContextSummary]);

  useEffect(() => {
    criticModeRef.current = handleCriticMode;
  }, [handleCriticMode]);

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
          type: "FORMAL_TEST",
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
      const anchor = getOrderedPlacementAnchor(allNodes, baseX, baseY, {
        xOffset: 260,
        yOffset: 180,
        laneTolerance: 620,
        laneGap: 240,
      });

      for (let index = 0; index < result.proposals.length; index += 1) {
        const proposal = result.proposals[index];
        const rowsPerColumn = 5;
        const column = Math.floor(index / rowsPerColumn);
        const row = index % rowsPerColumn;
        const nodeX = anchor.x + column * 360;
        const nodeY = anchor.y + row * 220;

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
  }, [command, contextNodes, problemId, addInsight, onCreateNode, getStartContext, allNodes]);

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

  const inputPlaceholder = useMemo(() => {
    if (activeSlashModeMeta) {
      if (activeSlashMode === "canvas") return "Describe the math idea to map into nodes...";
      if (activeSlashMode === "formalize") return "Write what you want formalized in Lean...";
      if (activeSlashMode === "verify") return "Select a node with Lean code and run /verify...";
      if (activeSlashMode === "critic") return "Write a claim/proof sketch to critique...";
      if (activeSlashMode === "compute") return "Write executable Python code...";
      if (activeSlashMode === "strategist") return "Goal or theorem to plan as a proof roadmap...";
      if (activeSlashMode === "socratic") return "Ask for short guided hints...";
      return `${activeSlashModeMeta.title} mode`;
    }
    if (contextNodes.length > 0) {
      return `Insights about ${contextNodes[0].title}... (type / for modes)`;
    }
    return "Type / to choose Rho mode";
  }, [activeSlashMode, activeSlashModeMeta, contextNodes]);

  const activeModeAccent = useMemo(() => getSlashModeAccent(activeSlashMode), [activeSlashMode]);
  const contextRefCount = useMemo(() => resolveContextNodeRefs().length, [resolveContextNodeRefs]);
  const hasSelectedLeanNode = useMemo(
    () => resolveContextCanvasNodes().some((node) => Boolean(extractLeanCodeFromNode(node))),
    [resolveContextCanvasNodes]
  );
  const hasSelectedComputationNode = useMemo(
    () => resolveContextCanvasNodes().some((node) => isComputationNode(node)),
    [resolveContextCanvasNodes]
  );

  const canSubmit = useMemo(() => {
    if (isAiLoading) return false;
    const trimmed = command.trim();

    const parsed = parseSlashCommand(trimmed);
    if (parsed.hasDirective && !parsed.mode) return false;
    const effectiveMode = parsed.mode || activeSlashMode;
    const effectiveText = parsed.mode ? parsed.text : trimmed;

    if (effectiveMode === "canvas" || effectiveMode === "strategist" || effectiveMode === "socratic") {
      return Boolean(effectiveText) || contextRefCount > 0 || chatMessages.length > 0;
    }
    if (effectiveMode === "formalize") {
      return Boolean(effectiveText) || contextRefCount > 0;
    }
    if (effectiveMode === "verify") {
      return hasSelectedLeanNode;
    }
    if (effectiveMode === "critic") {
      return Boolean(effectiveText) || contextRefCount > 0;
    }
    if (effectiveMode === "compute") {
      return Boolean(effectiveText) || hasSelectedComputationNode;
    }

    if (!trimmed) return false;
    return true;
  }, [isAiLoading, command, activeSlashMode, chatMessages.length, hasSelectedComputationNode, contextRefCount, hasSelectedLeanNode]);

  if (!isVisible && !isMounted) {
    return (
      <>
        {/* Floating toggle button - minimal pill */}
        <button
          onClick={onToggle}
          onDoubleClick={(e) => e.stopPropagation()}
          className="fixed bottom-24 left-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-xl text-neutral-700 rounded-full shadow-lg shadow-black/5 hover:bg-white hover:shadow-xl transition-all duration-200 group animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Logo size={16} className="opacity-80 group-hover:opacity-100 transition-opacity" />
          <span className="text-sm font-medium">Rho</span>
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
        <div
          className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/10 overflow-visible pointer-events-auto ${
            isClosing ? "pm-ai-panel-exit" : "pm-ai-panel-enter"
          }`}
        >
          {showActionProgressBar && (
            <div className="px-4 pt-3">
              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span className="font-medium text-neutral-600">{actionProgressLabel}</span>
                <span className="pm-thinking__dots">
                  <span className="pm-thinking__dot" />
                  <span className="pm-thinking__dot" />
                  <span className="pm-thinking__dot" />
                </span>
              </div>
              <div className="pm-ai-explore-bar mt-2" />
            </div>
          )}
          {(aiMessages.length > 0 || isAiLoading || command.trim().length > 0) ? (
            <div className="border-b border-neutral-100">
              <div className="max-h-64 overflow-y-auto px-3 py-3 space-y-2">
                {/* AI SDK Messages with streaming */}
                {aiMessages.map((msg) => {
                  const isUser = msg.role === "user";
                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-neutral-900 text-white">
                          <div className="text-xs text-white [&_p]:text-white [&_li]:text-white [&_strong]:text-white [&_em]:text-white [&_code]:text-white [&_a]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_pre]:text-white">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Parse thinking and response for assistant messages
                  const content = msg.content;
                  const thinkingBlocks = content.match(/<thinking>([\s\S]*?)<\/thinking>/g) || [];
                  const responseText = content.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
                  const createdNodes = assistantNodeCounts[msg.id] || 0;
                  const compactResponse = createdNodes > 0
                    ? `Creé ${createdNodes} nodo${createdNodes === 1 ? "" : "s"} en el canvas.`
                    : compactChatText(responseText);
                  
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
                              <div className="markdown-content text-xs text-purple-700">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {thinkingBlocks.map(block => block.replace(/<\/?thinking>/g, "")).join("\n\n")}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Response */}
                      {responseText && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-neutral-50 border border-neutral-200 text-neutral-700 whitespace-pre-wrap">
                            <div className="markdown-content text-xs text-neutral-700">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {compactResponse}
                              </ReactMarkdown>
                            </div>
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
                            <div className="markdown-content text-xs text-purple-700">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {currentThinking.slice(-500)}
                              </ReactMarkdown>
                            </div>
                            <span className="inline-block w-1.5 h-3 bg-purple-400 animate-pulse ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}
                    {currentResponse && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed bg-neutral-50 border border-neutral-200 text-neutral-700 whitespace-pre-wrap">
                          <div className="markdown-content text-xs text-neutral-700">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {compactChatText(currentResponse, 140)}
                            </ReactMarkdown>
                          </div>
                          <span className="inline-block w-1.5 h-3 bg-neutral-400 animate-pulse ml-0.5" />
                        </div>
                      </div>
                    )}
                    {!currentThinking && !currentResponse && (
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Rho iniciando...</span>
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
                <span className="max-w-[120px] truncate">Add &quot;{selectedNode.title}&quot;</span>
              </button>
            </div>
          )}

          {/* Main Input */}
          <div className="border-t border-neutral-100/90">
            {showSlashModePicker && (
              <div className="px-4 pt-3">
                <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
                  {slashModeOptions.map((option, index) => {
                    const ModeIcon = getSlashModeIcon(option.id);
                    const active = index === slashMenuIndex;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applySlashMode(option.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                          active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <ModeIcon className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">{option.label}</span>
                        </span>
                        <span className={`text-[11px] ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              className={`flex items-center gap-3 px-4 py-3 ${activeModeAccent.panel}`}
            >
              <Sparkles className="w-5 h-5 text-neutral-400 flex-shrink-0" />

              {activeSlashModeMeta && (
                <button
                  type="button"
                  onClick={clearSlashMode}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold flex-shrink-0 ${activeModeAccent.badge}`}
                  title="Clear mode"
                >
                  {activeSlashModeMeta.label}
                  <X className="w-3 h-3" />
                </button>
              )}

              <input
                ref={inputRef}
                type="text"
                value={command}
                data-no-shortcuts="true"
                onChange={(e) => handleCommandChange(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onKeyDown={(e) => {
                  if (showSlashModePicker && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    e.preventDefault();
                    setSlashMenuIndex((prev) => {
                      const delta = e.key === "ArrowDown" ? 1 : -1;
                      const next = prev + delta;
                      if (next < 0) return slashModeOptions.length - 1;
                      if (next >= slashModeOptions.length) return 0;
                      return next;
                    });
                    return;
                  }
                  if (showSlashModePicker && (e.key === "Enter" || e.key === "Tab")) {
                    e.preventDefault();
                    const nextOption = slashModeOptions[slashMenuIndex] || slashModeOptions[0];
                    if (nextOption) {
                      applySlashMode(nextOption.id);
                    }
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleChatSend();
                  }
                }}
                placeholder={inputPlaceholder}
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
                    onClick={() => void handleChatSend()}
                    disabled={!canSubmit}
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

            <div className="flex items-center gap-1 px-4 py-2 bg-neutral-50/60 relative">
              <span className="text-[10px] text-neutral-500">
                {activeSlashModeMeta ? `${activeSlashModeMeta.title} active` : "Type `/` for Rho modes"}
              </span>
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
                      Most similar: &quot;{generatedStory.novelty_result.most_similar.title}&quot; ({(generatedStory.novelty_result.most_similar.similarity * 100).toFixed(0)}%)
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
