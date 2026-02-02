// Canvas components barrel export

// V2 canvas components (current implementation)
export { ProofCanvasV2 } from "./ProofCanvasV2";
export { CanvasNodeItem } from "./CanvasNodeItem";
export { CanvasSidebar } from "./CanvasSidebar";
export { AgentIntelligencePanel } from "./AgentIntelligencePanel";
export { AddNodeModal, type NewNodeData } from "./AddNodeModal";
export { EditNodeModal } from "./EditNodeModal";
export { NodeDetailPanel } from "./NodeDetailPanel";
export { CanvasAIOverlay } from "./CanvasAIOverlay";
export { InlineNodeEditor, type QuickNodeData } from "./InlineNodeEditor";
export { CanvasContextMenu } from "./CanvasContextMenu";
export { CommitToDocumentModal } from "./CommitToDocumentModal";
export { AISuggestionsPanel } from "./AISuggestionsPanel";

// AI-enhanced components
export { FloatingAIBar } from "./FloatingAIBar";
export { ActionSummaryCard, ActionLoadingCard } from "./ActionSummaryCard";
export { AnimatedNodeWrapper, AnimatedNodeEntrance, AnimatedEdge } from "./AnimatedNodeWrapper";
export { NodeInlineMenu, NodeQuickToolbar } from "./NodeInlineMenu";
export { 
  ConnectionHandle, 
  NodeConnectionHandles, 
  AnimatedEdgePath, 
  EdgeArrowMarkers,
  ConnectionPreview,
} from "./ConnectionHandles";

// Traceability components
export { AuthorAvatar, AuthorAvatarStack } from "./AuthorAvatar";
export { NodeContributors, ContributorBadge } from "./NodeContributors";
export { ActivityTimeline, CompactActivityIndicator } from "./ActivityTimeline";

// Animation components
export {
  NodeEntrance,
  SelectionHalo,
  DraggableNode,
  HoverableNode,
  AnimatedConnection,
  ConnectionCreationEffect,
  ParticleBurst,
  AttentionPulse,
  ShimmerEffect,
  AnimatedBorder,
  FloatingElement,
  LayoutTransition,
  AnimatedCounter,
  RippleButton,
} from "./CanvasAnimations";

// Types
export * from "./types";
export type { NodeAnimationState } from "./CanvasNodeItem";
export type { AuthorInfo } from "./types";
export type { ActivityEntry } from "./ActivityTimeline";

// Legacy exports - DEPRECATED: Use ProofCanvasV2 instead
// These will be removed in a future version
/** @deprecated Use ProofCanvasV2 instead */
export { ProofCanvas } from "./ProofCanvas";