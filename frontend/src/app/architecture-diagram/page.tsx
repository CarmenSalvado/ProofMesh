"use client";

import { useMemo, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import {
  Bot,
  BrainCircuit,
  Database,
  HardDrive,
  Network,
  Radio,
  Server,
  Sparkles,
  Workflow,
} from "lucide-react";

type Side = "left" | "right" | "top" | "bottom";
type MarkerTone = "cyan" | "pink" | "lime" | "amber" | "indigo";

type DiagramNode = {
  id: string;
  title: string;
  subtitle: string;
  chip: string;
  icon: "frontend" | "backend" | "mesh" | "worker" | "realtime" | "gemini" | "redis" | "lean" | "latex" | "minio" | "postgres";
  tone: "indigo" | "cyan" | "pink" | "lime" | "amber";
  x: number;
  y: number;
  w: number;
  h: number;
};

type DiagramLink = {
  id: string;
  from: string;
  to: string;
  fromSide: Side;
  toSide: Side;
  tone: MarkerTone;
  label?: string;
  dashed?: boolean;
};

type Panel = {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  classes: string;
};

const BOARD_WIDTH = 1600;
const BOARD_HEIGHT = 900;

const EXPORT_WIDTH = 2560;
const EXPORT_HEIGHT = 1440;
const MAX_EXPORT_BYTES = 8 * 1024 * 1024;

const DIAGRAM_PANELS: Panel[] = [
  {
    id: "panel-exp",
    title: "Experience Layer",
    x: 30,
    y: 335, // Moved down slightly to center vertically with new layout
    w: 200,
    h: 200, // Reduced height since frontend node is smaller
    classes: "border-indigo-200/70 bg-gradient-to-br from-indigo-100/80 via-slate-50 to-transparent",
  },
  {
    id: "panel-core",
    title: "Core Intelligence",
    x: 270,
    y: 180, // Moved up to use more vertical space
    w: 520, // Slightly wider
    h: 560, // Taller for more vertical spacing
    classes: "border-sky-200/70 bg-gradient-to-br from-sky-100/80 via-slate-50 to-transparent",
  },
  {
    id: "panel-infra",
    title: "Infrastructure & Services",
    x: 840, // More separation from Core
    y: 180,
    w: 730,
    h: 560,
    classes: "border-emerald-200/70 bg-gradient-to-br from-emerald-100/80 via-slate-50 to-transparent",
  },
];

const DIAGRAM_NODES: DiagramNode[] = [
  // ═══════════════════════════════════════════════════════════════
  // EXPERIENCE LAYER
  // ═══════════════════════════════════════════════════════════════
  {
    id: "frontend",
    title: "Frontend",
    subtitle: "Next.js · collaborative UI",
    chip: "User Surface",
    icon: "frontend",
    tone: "indigo",
    x: 50,
    y: 380,
    w: 160, // Smaller
    h: 110, // Smaller
  },

  // ═══════════════════════════════════════════════════════════════
  // CORE INTELLIGENCE (2x3 grid)
  // ═══════════════════════════════════════════════════════════════
  // Row 1
  {
    id: "backend",
    title: "Backend API",
    subtitle: "FastAPI · auth · problems",
    chip: "Control Plane",
    icon: "backend",
    tone: "cyan",
    x: 330,
    y: 240, // Higher up
    w: 155, // Smaller width
    h: 100, // Reduced height
  },
  {
    id: "realtime",
    title: "Realtime WS",
    subtitle: "presence + updates",
    chip: "WebSocket",
    icon: "realtime",
    tone: "indigo",
    x: 575, // More horizontal gap (330+155 = 485 | 575-485=90px gap vs old 60px)
    y: 240,
    w: 155,
    h: 100,
  },

  // Row 2
  {
    id: "mesh",
    title: "Rho / Mesh",
    subtitle: "orchestrator + formalizer",
    chip: "AI Orchestration",
    icon: "mesh",
    tone: "pink",
    x: 330,
    y: 410, // More vertical gap (240+100=340 | 410-340=70px gap vs old 45px)
    w: 155,
    h: 105,
  },
  {
    id: "gemini",
    title: "Gemini Models",
    subtitle: "flash / thinking / pro",
    chip: "Reasoning Tier",
    icon: "gemini",
    tone: "pink",
    x: 575,
    y: 410,
    w: 155,
    h: 105,
  },

  // Row 3
  {
    id: "worker",
    title: "Canvas Worker",
    subtitle: "async runs, traces",
    chip: "Background Jobs",
    icon: "worker",
    tone: "lime",
    x: 330,
    y: 585, // More vertical gap
    w: 155,
    h: 100,
  },
  {
    id: "redis",
    title: "Redis",
    subtitle: "queue + pub/sub",
    chip: "Async Bus",
    icon: "redis",
    tone: "lime",
    x: 575,
    y: 585,
    w: 155,
    h: 100,
  },

  // ═══════════════════════════════════════════════════════════════
  // INFRASTRUCTURE & SERVICES (3 columns)
  // ═══════════════════════════════════════════════════════════════
  // Column 1
  {
    id: "lean",
    title: "Lean Runner",
    subtitle: "POST /verify",
    chip: "Verification",
    icon: "lean",
    tone: "amber",
    x: 900,
    y: 260,
    w: 155,
    h: 105,
  },
  {
    id: "latex",
    title: "TeXLive",
    subtitle: "compile + SyncTeX",
    chip: "LaTeX Service",
    icon: "latex",
    tone: "amber",
    x: 900,
    y: 430,
    w: 155,
    h: 105,
  },

  // Column 2
  {
    id: "minio",
    title: "MinIO Storage",
    subtitle: "artifacts · outputs",
    chip: "S3-compatible",
    icon: "minio",
    tone: "cyan",
    x: 1135, // More horizontal gap
    y: 260,
    w: 155,
    h: 105,
  },
  {
    id: "postgres",
    title: "PostgreSQL",
    subtitle: "users · problems · runs",
    chip: "Primary DB",
    icon: "postgres",
    tone: "cyan",
    x: 1135,
    y: 430,
    w: 155,
    h: 105,
  },

  // Column 3 (External)
  {
    id: "artifacts",
    title: "Artifact Store",
    subtitle: "proofs · LaTeX · assets",
    chip: "External",
    icon: "minio",
    tone: "lime",
    x: 1360,
    y: 350,
    w: 155,
    h: 105,
  },
];

// Map each node to its containing panel for drag constraints
const NODE_PANEL_MAP: Record<string, string> = {
  frontend: "panel-exp",
  backend: "panel-core",
  realtime: "panel-core",
  mesh: "panel-core",
  gemini: "panel-core",
  worker: "panel-core",
  redis: "panel-core",
  lean: "panel-infra",
  minio: "panel-infra",
  latex: "panel-infra",
  postgres: "panel-infra",
  artifacts: "panel-infra",
};

// Get panel bounds for a node
const getPanelForNode = (nodeId: string): Panel | undefined => {
  const panelId = NODE_PANEL_MAP[nodeId];
  return DIAGRAM_PANELS.find(p => p.id === panelId);
};

const DIAGRAM_LINKS: DiagramLink[] = [
  // ═══════════════════════════════════════════════════════════════
  // EXPERIENCE → CORE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "frontend-backend",
    from: "frontend",
    to: "backend",
    fromSide: "right",
    toSide: "left",
    tone: "indigo",
    label: "HTTP/REST",
  },
  {
    id: "frontend-realtime",
    from: "frontend",
    to: "realtime",
    fromSide: "right",
    toSide: "left",
    tone: "indigo",
    label: "WebSocket",
    dashed: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // CORE INTERNAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: "backend-mesh",
    from: "backend",
    to: "mesh",
    fromSide: "bottom",
    toSide: "top",
    tone: "cyan",
    label: "orchestrate",
  },
  {
    id: "mesh-gemini",
    from: "mesh",
    to: "gemini",
    fromSide: "right",
    toSide: "left",
    tone: "pink",
    label: "reasoning",
  },
  {
    id: "mesh-worker",
    from: "mesh",
    to: "worker",
    fromSide: "bottom",
    toSide: "top",
    tone: "lime",
    label: "async jobs",
  },
  {
    id: "worker-redis",
    from: "worker",
    to: "redis",
    fromSide: "right",
    toSide: "left",
    tone: "lime",
    label: "cache",
  },
  {
    id: "redis-realtime",
    from: "redis",
    to: "realtime",
    fromSide: "right",
    toSide: "right", // Curve around right side to avoid Gemini
    tone: "lime",
    label: "pub/sub",
    dashed: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // CORE → INFRA
  // ═══════════════════════════════════════════════════════════════
  {
    id: "mesh-lean",
    from: "mesh",
    to: "lean",
    fromSide: "top", // Go over Gemini
    toSide: "left",
    tone: "amber",
    label: "verify",
  },
  {
    id: "gemini-latex",
    from: "gemini",
    to: "latex",
    fromSide: "right",
    toSide: "left",
    tone: "amber",
    label: "compile",
  },
  {
    id: "backend-postgres",
    from: "backend",
    to: "postgres",
    fromSide: "top", // Arc over Realtime
    toSide: "top",
    tone: "cyan",
    label: "data",
  },
  {
    id: "realtime-minio",
    from: "realtime",
    to: "minio",
    fromSide: "top", // Arc over Lean
    toSide: "top",
    tone: "cyan",
    label: "sync",
  },
  {
    id: "worker-postgres",
    from: "worker",
    to: "postgres",
    fromSide: "bottom", // Go under columns
    toSide: "bottom",
    tone: "lime",
    label: "save run",
  },

  // ═══════════════════════════════════════════════════════════════
  // INFRA INTERNAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: "lean-minio",
    from: "lean",
    to: "minio",
    fromSide: "right",
    toSide: "left",
    tone: "amber",
    label: "logs",
  },
  {
    id: "latex-minio",
    from: "latex",
    to: "minio",
    fromSide: "right",
    toSide: "left",
    tone: "amber",
    label: "pdf",
  },
  {
    id: "minio-artifacts",
    from: "minio",
    to: "artifacts",
    fromSide: "right",
    toSide: "left",
    tone: "lime",
    label: "export",
  },
  {
    id: "postgres-artifacts",
    from: "postgres",
    to: "artifacts",
    fromSide: "right",
    toSide: "bottom",
    tone: "lime",
    label: "meta",
    dashed: true,
  },
];

const SIDE_VECTOR: Record<Side, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

const ICON_MAP = {
  frontend: Network,
  backend: Server,
  mesh: Bot,
  worker: Workflow,
  realtime: Radio,
  gemini: Sparkles,
  redis: HardDrive,
  lean: BrainCircuit,
  latex: Sparkles,
  minio: HardDrive,
  postgres: Database,
} as const;

const NODE_TONE_STYLES: Record<DiagramNode["tone"], { shell: string; chip: string; orb: string }> = {
  indigo: {
    shell: "border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-slate-50",
    chip: "border-indigo-200 bg-indigo-100 text-indigo-700",
    orb: "from-indigo-200 to-sky-200",
  },
  cyan: {
    shell: "border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-white to-slate-50",
    chip: "border-cyan-200 bg-cyan-100 text-cyan-700",
    orb: "from-cyan-200 to-blue-200",
  },
  pink: {
    shell: "border-fuchsia-200/80 bg-gradient-to-br from-fuchsia-50 via-white to-rose-50",
    chip: "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700",
    orb: "from-fuchsia-200 to-pink-200",
  },
  lime: {
    shell: "border-lime-200/80 bg-gradient-to-br from-lime-50 via-white to-emerald-50",
    chip: "border-lime-200 bg-lime-100 text-lime-700",
    orb: "from-lime-200 to-emerald-200",
  },
  amber: {
    shell: "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50",
    chip: "border-amber-200 bg-amber-100 text-amber-700",
    orb: "from-amber-200 to-orange-200",
  },
};

const MARKER_COLOR: Record<MarkerTone, string> = {
  cyan: "#8aa9b8",
  pink: "#b596b7",
  lime: "#9caf8a",
  amber: "#bea88a",
  indigo: "#9ca8bf",
};

// Dynamic edge path calculation based on node positions
function getEdgePath(from: DiagramNode, to: DiagramNode, fromSide?: Side, toSide?: Side): { path: string; labelX: number; labelY: number } {
  // Calculate centers within the board coordinate system (0-1600, 0-900)
  const fromCenterX = from.x + from.w / 2;
  const fromCenterY = from.y + from.h / 2;
  const toCenterX = to.x + to.w / 2;
  const toCenterY = to.y + to.h / 2;

  let fromX: number, fromY: number;
  let toX: number, toY: number;

  // Determine exit point
  if (fromSide) {
    switch (fromSide) {
      case "left": fromX = from.x; fromY = fromCenterY; break;
      case "right": fromX = from.x + from.w; fromY = fromCenterY; break;
      case "top": fromX = fromCenterX; fromY = from.y; break;
      case "bottom": fromX = fromCenterX; fromY = from.y + from.h; break;
    }
  } else {
    // Auto-calculate based on angle
    const angle = Math.atan2(toCenterY - fromCenterY, toCenterX - fromCenterX);
    const PI = Math.PI;
    if (angle > -PI / 4 && angle <= PI / 4) { // Right
      fromX = from.x + from.w; fromY = fromCenterY;
    } else if (angle > PI / 4 && angle <= 3 * PI / 4) { // Bottom
      fromX = fromCenterX; fromY = from.y + from.h;
    } else if (angle > -3 * PI / 4 && angle <= -PI / 4) { // Top
      fromX = fromCenterX; fromY = from.y;
    } else { // Left
      fromX = from.x; fromY = fromCenterY;
    }
  }

  // Determine entry point
  if (toSide) {
    switch (toSide) {
      case "left": toX = to.x; toY = toCenterY; break;
      case "right": toX = to.x + to.w; toY = toCenterY; break;
      case "top": toX = toCenterX; toY = to.y; break;
      case "bottom": toX = toCenterX; toY = to.y + to.h; break;
    }
  } else {
    // Auto-calculate (simplified opposite of from, or angle-based)
    const angle = Math.atan2(fromCenterY - toCenterY, fromCenterX - toCenterX); // vector TO -> FROM
    const PI = Math.PI;
    if (angle > -PI / 4 && angle <= PI / 4) { // Right (To is right of From, so enter Left?) No, vector is To->From.
      // If To -> From is Right, it means From is to the Right of To. So Enter Right.
      toX = to.x + to.w; toY = toCenterY;
    } else if (angle > PI / 4 && angle <= 3 * PI / 4) { // Bottom
      toX = toCenterX; toY = to.y + to.h;
    } else if (angle > -3 * PI / 4 && angle <= -PI / 4) { // Top
      toX = toCenterX; toY = to.y;
    } else { // Left
      toX = to.x; toY = toCenterY;
    }
  }

  // Offset the end point for arrow visibility
  const edx = toX - fromX;
  const edy = toY - fromY;
  const len = Math.sqrt(edx * edx + edy * edy);
  const arrowOffset = 12;
  const endX = len > arrowOffset ? toX - (edx / len) * arrowOffset : toX;
  const endY = len > arrowOffset ? toY - (edy / len) * arrowOffset : toY;

  // Create smooth bezier curve
  // If sides are specified, map control points to direction
  const getControlVector = (side: Side | undefined, x: number, y: number, isStart: boolean): { x: number, y: number } => {
    // If no side specified, infer from position relative to center
    let s = side;
    if (!s) {
      if (x === from.x) s = "left";
      else if (x === from.x + from.w) s = "right";
      else if (y === from.y) s = "top";
      else if (y === from.y + from.h) s = "bottom";
      else s = "right"; // default
    }

    // For end point, the vector should point OUT from the node direction (for CP calculation logic below)
    // Actually standard bezier: CP1 is fromX + dx, CP2 is toX - dx.

    // New Logic: 
    // Start CP goes OUT from start node.
    // End CP comes IN to end node (so "out" from the curve perspective means "away from end node").

    const dist = Math.min(Math.abs(toX - fromX), Math.abs(toY - fromY)) * 0.5 + 100; // heuristic

    /* 
       Let's use a simpler heuristic compatible with existing code structure but using sides.
       If Side is Right, CP is (x + dist, y).
       If Side is Left, CP is (x - dist, y).
       If Side is Top, CP is (x, y - dist).
       If Side is Bottom, CP is (x, y + dist).
    */

    // We need to know which "wall" the point is on relative to the node
    // Since we computed fromX/toX based on side or angle, we can infer direction.

    return { x: 0, y: 0 }; // Placeholder, we'll do it inline below
  };

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;
  const tension = 0.35;
  const distX = Math.abs(endX - fromX);
  const distY = Math.abs(endY - fromY);
  const controlDist = Math.max(distX, distY) * tension;

  // Determine logical directions for control points
  const getDir = (side: Side | undefined, defaultIsVertical: boolean): { dx: number, dy: number } => {
    if (side === "left") return { dx: -1, dy: 0 };
    if (side === "right") return { dx: 1, dy: 0 };
    if (side === "top") return { dx: 0, dy: -1 };
    if (side === "bottom") return { dx: 0, dy: 1 };
    return defaultIsVertical ? { dx: 0, dy: 1 } : { dx: 1, dy: 0 };
  };

  // Determine sides if not provided, for CP calculation
  const effFromSide = fromSide || (Math.abs(distY) > Math.abs(distX) ? (endY > fromY ? "bottom" : "top") : (endX > fromX ? "right" : "left"));
  const effToSide = toSide || (Math.abs(distY) > Math.abs(distX) ? (endY > fromY ? "top" : "bottom") : (endX > fromX ? "left" : "right"));

  const dir1 = getDir(effFromSide, false);
  const dir2 = getDir(effToSide, false); // For end node, "side" is where it enters. CP should be "out" from that face? No, CP2 is usually "before" the end point.
  // Standard Bezier: M S C CP1 CP2 E.
  // CP1 = S + vector_out.
  // CP2 = E + vector_out_from_E (which is vector_opp_to_E_face).

  // If connection is to "left" side of TO node, it enters from left. So vector at E is (1, 0).
  // If effToSide is "left", it means we connect to the LEFT face. So we approach from Left. CP2 should be to the Left of E.
  // So CP2 = E + (dx: -1, 0) * dist.

  const fromDir = getDir(effFromSide, false);
  const toDir = getDir(effToSide, false);

  cp1x = fromX + fromDir.dx * controlDist;
  cp1y = fromY + fromDir.dy * controlDist;

  cp2x = endX + toDir.dx * controlDist;
  cp2y = endY + toDir.dy * controlDist;


  // Calculate label position at midpoint
  const t = 0.5;
  const inv = 1 - t;
  const labelX = inv * inv * inv * fromX + 3 * inv * inv * t * cp1x + 3 * inv * t * t * cp2x + t * t * t * endX;
  const labelY = inv * inv * inv * fromY + 3 * inv * inv * t * cp1y + 3 * inv * t * t * cp2y + t * t * t * endY;

  return {
    path: `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`,
    labelX,
    labelY,
  };
}

function buildCurve(link: DiagramLink, nodes: Record<string, DiagramNode>) {
  const from = nodes[link.from];
  const to = nodes[link.to];
  if (!from || !to) return null;

  return getEdgePath(from, to, link.fromSide, link.toSide);
}

function nodeStyle(node: DiagramNode) {
  // Use percentages that map directly to SVG viewBox coordinates
  return {
    left: `${(node.x / BOARD_WIDTH) * 100}%`,
    top: `${(node.y / BOARD_HEIGHT) * 100}%`,
    width: `${(node.w / BOARD_WIDTH) * 100}%`,
    height: `${(node.h / BOARD_HEIGHT) * 100}%`,
  };
}

function panelStyle(panel: Panel) {
  return {
    left: `${(panel.x / BOARD_WIDTH) * 100}%`,
    top: `${(panel.y / BOARD_HEIGHT) * 100}%`,
    width: `${(panel.w / BOARD_WIDTH) * 100}%`,
    height: `${(panel.h / BOARD_HEIGHT) * 100}%`,
  };
}

export default function ThumbnailPage() {
  const exportRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // State for draggable node positions
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    DIAGRAM_NODES.forEach((node) => {
      positions[node.id] = { x: node.x, y: node.y };
    });
    return positions;
  });

  // Drag state
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Get node with current position
  const getNodeWithPosition = (node: DiagramNode) => ({
    ...node,
    x: nodePositions[node.id]?.x ?? node.x,
    y: nodePositions[node.id]?.y ?? node.y,
  });

  // Build node map with current positions - no memo to force re-render
  const nodeMap = DIAGRAM_NODES.reduce<Record<string, DiagramNode>>((acc, node) => {
    acc[node.id] = {
      ...node,
      x: nodePositions[node.id]?.x ?? node.x,
      y: nodePositions[node.id]?.y ?? node.y,
    };
    return acc;
  }, {});

  // Compute rendered links based on current node positions - no memo
  const renderedLinks = DIAGRAM_LINKS.map((link) => {
    const curve = buildCurve(link, nodeMap);
    if (!curve) return null;
    return {
      ...link,
      ...curve,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (!boardRef.current) return;
    e.preventDefault();

    const boardRect = boardRef.current.getBoundingClientRect();
    const nodePos = nodePositions[nodeId];

    // Calculate mouse position relative to board in board coordinates
    const mouseXInBoard = ((e.clientX - boardRect.left) / boardRect.width) * BOARD_WIDTH;
    const mouseYInBoard = ((e.clientY - boardRect.top) / boardRect.height) * BOARD_HEIGHT;

    setDragOffset({
      x: mouseXInBoard - nodePos.x,
      y: mouseYInBoard - nodePos.y,
    });
    setDraggingNode(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNode || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const node = DIAGRAM_NODES.find(n => n.id === draggingNode);
    const panel = getPanelForNode(draggingNode);

    if (!node) return;

    // Calculate new position in board coordinates
    const mouseXInBoard = ((e.clientX - boardRect.left) / boardRect.width) * BOARD_WIDTH;
    const mouseYInBoard = ((e.clientY - boardRect.top) / boardRect.height) * BOARD_HEIGHT;

    let newX = mouseXInBoard - dragOffset.x;
    let newY = mouseYInBoard - dragOffset.y;

    // Constrain to panel bounds if panel exists (with padding for title)
    if (panel) {
      const padding = 30; // Increased visual padding
      const titlePadding = 45; // Increased title padding
      const minX = panel.x + padding;
      const maxX = panel.x + panel.w - node.w - padding;
      const minY = panel.y + titlePadding;
      const maxY = panel.y + panel.h - node.h - padding;

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));
    } else {
      // Fallback to board bounds
      newX = Math.max(0, Math.min(BOARD_WIDTH - node.w, newX));
      newY = Math.max(0, Math.min(BOARD_HEIGHT - node.h, newY));
    }

    setNodePositions((prev) => ({
      ...prev,
      [draggingNode]: { x: Math.round(newX), y: Math.round(newY) },
    }));
  };

  const handleMouseUp = () => {
    if (draggingNode) {
      // Log the updated positions for easy copy-paste
      console.log("=== UPDATED NODE POSITIONS ===");
      console.log(JSON.stringify(nodePositions, null, 2));
      console.log("==============================");
    }
    setDraggingNode(null);
  };

  // Export positions to clipboard
  const copyPositionsToClipboard = () => {
    const code = DIAGRAM_NODES.map((node) => {
      const pos = nodePositions[node.id];
      return `    x: ${pos.x},\n    y: ${pos.y},`;
    }).join("\n\n");

    const fullExport = Object.entries(nodePositions)
      .map(([id, pos]) => `"${id}": { x: ${pos.x}, y: ${pos.y} }`)
      .join(",\n");

    navigator.clipboard.writeText(fullExport);
    alert("Positions copied to clipboard. Check the console for the full code.");
    console.log("=== COPY THIS TO UPDATE DIAGRAM_NODES ===");
    DIAGRAM_NODES.forEach((node) => {
      const pos = nodePositions[node.id];
      console.log(`${node.id}: x: ${pos.x}, y: ${pos.y}`);
    });
  };

  const dataUrlToBlob = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    return res.blob();
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadThumbnail = async (format: "png" | "jpg") => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const renderBase = {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor: "#f5f5f4",
        canvasWidth: EXPORT_WIDTH,
        canvasHeight: EXPORT_HEIGHT,
      };

      if (format === "png") {
        const pngDataUrl = await toPng(exportRef.current, renderBase);
        const pngBlob = await dataUrlToBlob(pngDataUrl);
        if (pngBlob.size <= MAX_EXPORT_BYTES) {
          triggerDownload(pngBlob, `proofmesh-architecture-${EXPORT_WIDTH}x${EXPORT_HEIGHT}.png`);
          return;
        }

        const jpegDataUrl = await toJpeg(exportRef.current, {
          ...renderBase,
          quality: 0.9,
        });
        const jpegBlob = await dataUrlToBlob(jpegDataUrl);
        triggerDownload(jpegBlob, `proofmesh-architecture-${EXPORT_WIDTH}x${EXPORT_HEIGHT}.jpg`);
        return;
      }

      const jpegDataUrl = await toJpeg(exportRef.current, {
        ...renderBase,
        quality: 0.92,
      });
      const jpegBlob = await dataUrlToBlob(jpegDataUrl);
      triggerDownload(jpegBlob, `proofmesh-architecture-${EXPORT_WIDTH}x${EXPORT_HEIGHT}.jpg`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-6 md:p-10 text-neutral-900">
      <div className="mx-auto w-full max-w-[2200px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-white px-3 py-2">
          <div className="text-xs text-neutral-600">Export 2K (2560×1440) · architecture poster · max 8MB target</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadThumbnail("png")}
              disabled={exporting}
              className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Download PNG"}
            </button>
            <button
              type="button"
              onClick={() => downloadThumbnail("jpg")}
              disabled={exporting}
              className="rounded-md border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Download JPG"}
            </button>
            <button
              type="button"
              onClick={copyPositionsToClipboard}
              className="rounded-md border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-medium text-lime-700 hover:bg-lime-100"
            >
              📋 Copy Positions
            </button>
          </div>
        </div>

        <div
          ref={exportRef}
          className="relative aspect-video overflow-hidden rounded-3xl border border-neutral-300 bg-neutral-100 p-5 shadow-[0_36px_90px_-38px_rgba(0,0,0,0.38)]"
        >
          <div
            ref={boardRef}
            className="relative h-full w-full overflow-hidden rounded-2xl border border-neutral-300 bg-[radial-gradient(circle_at_12%_14%,rgba(186,230,253,0.65),transparent_34%),radial-gradient(circle_at_86%_85%,rgba(217,249,157,0.45),transparent_38%),radial-gradient(circle_at_65%_20%,rgba(245,208,254,0.55),transparent_36%),linear-gradient(145deg,#fcfcfd_0%,#f7f7f8_45%,#f5f5f4_100%)]"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,10,10,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(10,10,10,0.04)_1px,transparent_1px)] bg-[size:34px_34px]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.52),transparent_58%)]" />

            <div className="absolute inset-x-6 top-5 z-40 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] tracking-wide text-cyan-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  PROOFMESH PLATFORM MAP
                </div>
                <h1 className="mt-2 text-[46px] leading-none tracking-tight text-neutral-950">ProofMesh Architecture</h1>
                <p className="mt-2 text-[15px] text-neutral-700">
                  Collaborative math workspace with Rho orchestration, formal verification, and async AI pipelines.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-white/85 px-4 py-3 text-right">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Stack Snapshot</div>
                <div className="mt-1 text-[14px] text-neutral-800">Next.js · FastAPI · Redis · MinIO · Lean 4</div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] text-fuchsia-700">
                  <Bot className="h-3.5 w-3.5" />
                  Rho + Gemini orchestration
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0">
              {DIAGRAM_PANELS.map((panel) => (
                <div
                  key={panel.id}
                  className={`absolute rounded-3xl border ${panel.classes}`}
                  style={panelStyle(panel)}
                >
                  <div className="absolute left-4 top-3 rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-600">
                    {panel.title}
                  </div>
                </div>
              ))}
            </div>

            <svg
              className="absolute inset-0 z-20"
              viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
              preserveAspectRatio="none"
            >
              <defs>
                <marker id="arrow-cyan" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto">
                  <path d="M0,0 L12,6 L0,12 L3.5,6 z" fill={MARKER_COLOR.cyan} />
                </marker>
                <marker id="arrow-pink" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto">
                  <path d="M0,0 L12,6 L0,12 L3.5,6 z" fill={MARKER_COLOR.pink} />
                </marker>
                <marker id="arrow-lime" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto">
                  <path d="M0,0 L12,6 L0,12 L3.5,6 z" fill={MARKER_COLOR.lime} />
                </marker>
                <marker id="arrow-amber" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto">
                  <path d="M0,0 L12,6 L0,12 L3.5,6 z" fill={MARKER_COLOR.amber} />
                </marker>
                <marker id="arrow-indigo" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto">
                  <path d="M0,0 L12,6 L0,12 L3.5,6 z" fill={MARKER_COLOR.indigo} />
                </marker>
              </defs>

              {renderedLinks.map((link) => {
                const color = MARKER_COLOR[link.tone];
                return (
                  <g key={`${link.id}-${link.path.substring(0, 50)}`}>
                    <path
                      d={link.path}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.2}
                      strokeDasharray={link.dashed ? "8 8" : undefined}
                      strokeLinecap="round"
                      opacity={0.88}
                      markerEnd={`url(#arrow-${link.tone})`}
                    />
                    {link.label && (
                      <g transform={`translate(${link.labelX}, ${link.labelY - 7})`}>
                        <rect
                          x={-(link.label.length * 2.95 + 9)}
                          y={-8.5}
                          width={link.label.length * 5.9 + 18}
                          height={17}
                          rx={8.5}
                          fill="rgba(255,255,255,0.92)"
                          stroke="rgba(115,115,115,0.34)"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          fontSize="9.4"
                          fill="rgba(38,38,38,0.92)"
                          letterSpacing="0.3"
                        >
                          {link.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="absolute inset-0 z-30">
              {DIAGRAM_NODES.map((node) => {
                const Icon = ICON_MAP[node.icon];
                const tone = NODE_TONE_STYLES[node.tone];
                const currentNode = getNodeWithPosition(node);
                const isDragging = draggingNode === node.id;

                return (
                  <article
                    key={node.id}
                    className={`absolute rounded-2xl border p-3 shadow-[0_14px_32px_-26px_rgba(0,0,0,0.45)] transition-shadow ${tone.shell} ${isDragging ? 'shadow-2xl ring-2 ring-cyan-400 z-50' : 'hover:shadow-xl cursor-grab'}`}
                    style={nodeStyle(currentNode)}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.11em] ${tone.chip}`}>
                        {node.chip}
                      </span>
                      <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tone.orb} text-slate-900`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                    </div>

                    <h3 className="text-[17px] leading-tight text-neutral-900">{node.title}</h3>
                    <p className="mt-1 text-[12px] leading-snug text-neutral-600">{node.subtitle}</p>
                  </article>
                );
              })}
            </div>

            <div className="absolute bottom-5 left-6 z-40 inline-flex items-center gap-3 rounded-xl border border-neutral-300 bg-white/90 px-4 py-2 text-[11px] text-neutral-700">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-300" /> core data flow
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-fuchsia-300" /> model reasoning
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-lime-300" /> async/infra flow
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
