// Canvas types for ProofMesh visual proof canvas

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
  authors?: string[];
  agentId?: string;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  type: "uses" | "implies" | "contradicts" | "references";
  label?: string;
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

// Node type styling configurations
export const NODE_TYPE_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
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
  // Lowercase aliases (API returns lowercase)
  definition: {
    label: "Definition",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  lemma: {
    label: "Lemma",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  theorem: {
    label: "Theorem",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  claim: {
    label: "Claim",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  counterexample: {
    label: "Counterexample",
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  computation: {
    label: "Computation",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  note: {
    label: "Note",
    color: "text-neutral-700",
    bgColor: "bg-neutral-50",
    borderColor: "border-neutral-200",
  },
  resource: {
    label: "Resource",
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  idea: {
    label: "Idea",
    color: "text-fuchsia-700",
    bgColor: "bg-fuchsia-50",
    borderColor: "border-fuchsia-200",
  },
  content: {
    label: "Content",
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
  },
};

export const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
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
  // Lowercase aliases (API returns lowercase)
  verified: {
    label: "Verified",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
    icon: "✓",
  },
  proposed: {
    label: "Proposed",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: "○",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: "✗",
  },
  draft: {
    label: "Draft",
    color: "text-neutral-600",
    bgColor: "bg-neutral-100",
    icon: "◐",
  },
  editing: {
    label: "Editing...",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: "✎",
  },
};
