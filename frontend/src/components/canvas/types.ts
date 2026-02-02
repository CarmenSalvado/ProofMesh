// Canvas types for ProofMesh visual proof canvas

export interface AuthorInfo {
  type: "human" | "agent";
  id: string;
  name?: string;
  avatar_url?: string;
}

export interface CanvasNode {
  id: string;
  type: string;
  title: string;
  content?: string;
  formula?: string;
  leanCode?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  status: "PROPOSED" | "VERIFIED" | "REJECTED" | "DRAFT" | "EDITING";
  dependencies: string[];
  authors?: AuthorInfo[];
  agentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  type: "uses" | "implies" | "contradicts" | "references";
  label?: string;
}

export interface CanvasBlock {
  id: string;
  name: string;
  nodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface AgentSuggestion {
  id: string;
  agentId: string;
  agentName: string;
  type: "step" | "verification" | "warning" | "optimization";
  title: string;
  description: string;
  confidence: number;
  code?: string;
  targetNodeId?: string;
}

export interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  timestamp: Date;
  status: "pending" | "completed" | "failed";
}

// Node type styling configuration type
export interface NodeTypeStyle {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

// Base node type configurations (uppercase keys)
const NODE_TYPES_BASE: Record<string, NodeTypeStyle> = {
  DEFINITION: {
    label: "Definition",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  LEMMA: {
    label: "Lemma",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  THEOREM: {
    label: "Theorem",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  CLAIM: {
    label: "Claim",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  COUNTEREXAMPLE: {
    label: "Counterexample",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  COMPUTATION: {
    label: "Computation",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  NOTE: {
    label: "Note",
    color: "text-neutral-700",
    bgColor: "bg-neutral-50",
    borderColor: "border-neutral-200",
  },
  RESOURCE: {
    label: "Resource",
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  IDEA: {
    label: "Idea",
    color: "text-fuchsia-700",
    bgColor: "bg-fuchsia-50",
    borderColor: "border-fuchsia-200",
  },
  CONTENT: {
    label: "Content",
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
  },
};

// Build full config with both uppercase and lowercase keys (API may return either)
function buildCaseInsensitiveConfig<T>(base: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(base)) {
    result[key] = value;
    result[key.toLowerCase()] = value;
  }
  return result;
}

export const NODE_TYPE_CONFIG: Record<string, NodeTypeStyle> = buildCaseInsensitiveConfig(NODE_TYPES_BASE);

/** Helper to get node type config regardless of case */
export function getNodeTypeConfig(type: string): NodeTypeStyle {
  return NODE_TYPE_CONFIG[type] || NODE_TYPE_CONFIG[type.toUpperCase()] || NODE_TYPES_BASE.NOTE;
}

// Status styling configuration type
export interface StatusStyle {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}

// Base status configurations
const STATUS_BASE: Record<string, StatusStyle> = {
  VERIFIED: {
    label: "Verified",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    icon: "✓",
  },
  PROPOSED: {
    label: "Proposed",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: "○",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: "✗",
  },
  DRAFT: {
    label: "Draft",
    color: "text-neutral-600",
    bgColor: "bg-neutral-100",
    icon: "◐",
  },
  EDITING: {
    label: "Editing...",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: "✎",
  },
};

export const STATUS_CONFIG: Record<string, StatusStyle> = buildCaseInsensitiveConfig(STATUS_BASE);

/** Helper to get status config regardless of case */
export function getStatusConfig(status: string): StatusStyle {
  return STATUS_CONFIG[status] || STATUS_CONFIG[status.toUpperCase()] || STATUS_BASE.DRAFT;
}
