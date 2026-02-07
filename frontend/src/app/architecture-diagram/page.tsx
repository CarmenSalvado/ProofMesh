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

const BOARD_WIDTH = 1800;
const BOARD_HEIGHT = 780;

const EXPORT_WIDTH = 1500;
const EXPORT_HEIGHT = 1000;
const MAX_EXPORT_BYTES = 5 * 1024 * 1024;

const DIAGRAM_PANELS: Panel[] = [
  {
    id: "panel-exp",
    title: "Experience Layer",
    x: 32,
    y: 200,
    w: 280,
    h: 260,
    classes: "border-indigo-200/70 bg-gradient-to-br from-indigo-100/80 via-slate-50 to-transparent",
  },
  {
    id: "panel-core",
    title: "Core Intelligence",
    x: 340,
    y: 84,
    w: 900,
    h: 580,
    classes: "border-sky-200/70 bg-gradient-to-br from-sky-100/80 via-slate-50 to-transparent",
  },
  {
    id: "panel-infra",
    title: "Infrastructure & Services",
    x: 1270,
    y: 84,
    w: 500,
    h: 620,
    classes: "border-emerald-200/70 bg-gradient-to-br from-emerald-100/80 via-slate-50 to-transparent",
  },
];

const DIAGRAM_NODES: DiagramNode[] = [
  {
    id: "frontend",
    title: "Frontend",
    subtitle: "Next.js 16 app · collaborative UI",
    chip: "User Surface",
    icon: "frontend",
    tone: "indigo",
    x: 52,
    y: 250,
    w: 240,
    h: 160,
  },
  {
    id: "backend",
    title: "Backend API",
    subtitle: "FastAPI · auth · problems · social",
    chip: "Control Plane",
    icon: "backend",
    tone: "cyan",
    x: 380,
    y: 120,
    w: 260,
    h: 130,
  },
  {
    id: "mesh",
    title: "Rho / Mesh Runtime",
    subtitle: "orchestrator + explorer/formalizer/critic",
    chip: "AI Orchestration",
    icon: "mesh",
    tone: "pink",
    x: 380,
    y: 300,
    w: 260,
    h: 150,
  },
  {
    id: "worker",
    title: "Canvas AI Worker",
    subtitle: "async runs, traces, node generation",
    chip: "Background Jobs",
    icon: "worker",
    tone: "lime",
    x: 380,
    y: 510,
    w: 260,
    h: 130,
  },
  {
    id: "realtime",
    title: "Realtime WS",
    subtitle: "presence + run updates",
    chip: "WebSocket",
    icon: "realtime",
    tone: "indigo",
    x: 720,
    y: 120,
    w: 230,
    h: 110,
  },
  {
    id: "gemini",
    title: "Gemini Models",
    subtitle: "flash / thinking / pro",
    chip: "Reasoning Tier",
    icon: "gemini",
    tone: "pink",
    x: 720,
    y: 300,
    w: 230,
    h: 130,
  },
  {
    id: "redis",
    title: "Redis",
    subtitle: "queue + pub/sub",
    chip: "Async Bus",
    icon: "redis",
    tone: "lime",
    x: 720,
    y: 510,
    w: 230,
    h: 130,
  },
  {
    id: "lean",
    title: "Lean Runner",
    subtitle: "isolated `POST /verify`",
    chip: "Formal Verification",
    icon: "lean",
    tone: "amber",
    x: 1030,
    y: 120,
    w: 200,
    h: 110,
  },
  {
    id: "latex",
    title: "TeXLive Compiler",
    subtitle: "compile + SyncTeX",
    chip: "LaTeX Service",
    icon: "latex",
    tone: "amber",
    x: 1030,
    y: 290,
    w: 200,
    h: 110,
  },
  {
    id: "minio",
    title: "MinIO Object Storage",
    subtitle: "artifacts · outputs · docs",
    chip: "S3-compatible",
    icon: "minio",
    tone: "cyan",
    x: 1310,
    y: 120,
    w: 220,
    h: 130,
  },
  {
    id: "postgres",
    title: "PostgreSQL",
    subtitle: "users · problems · AI runs",
    chip: "Primary DB",
    icon: "postgres",
    tone: "cyan",
    x: 1310,
    y: 300,
    w: 220,
    h: 130,
  },
];

const DIAGRAM_LINKS: DiagramLink[] = [
  {
    id: "frontend-backend",
    from: "frontend",
    to: "backend",
    fromSide: "right",
    toSide: "left",
    tone: "indigo",
    label: "REST API",
  },
  {
    id: "backend-realtime",
    from: "backend",
    to: "realtime",
    fromSide: "right",
    toSide: "left",
    tone: "indigo",
    label: "WS gateway",
  },
  {
    id: "realtime-frontend",
    from: "realtime",
    to: "frontend",
    fromSide: "left",
    toSide: "top",
    tone: "indigo",
    label: "live events",
    dashed: true,
  },
  {
    id: "backend-mesh",
    from: "backend",
    to: "mesh",
    fromSide: "bottom",
    toSide: "top",
    tone: "cyan",
    label: "orchestration",
  },
  {
    id: "mesh-gemini",
    from: "mesh",
    to: "gemini",
    fromSide: "right",
    toSide: "left",
    tone: "pink",
    label: "prompt + context",
  },
  {
    id: "mesh-lean",
    from: "mesh",
    to: "lean",
    fromSide: "right",
    toSide: "left",
    tone: "amber",
    label: "verify Lean",
  },
  {
    id: "backend-latex",
    from: "backend",
    to: "latex",
    fromSide: "right",
    toSide: "left",
    tone: "amber",
    label: "compile tex",
  },
  {
    id: "backend-redis",
    from: "backend",
    to: "redis",
    fromSide: "bottom",
    toSide: "top",
    tone: "lime",
    label: "enqueue runs",
  },
  {
    id: "redis-worker",
    from: "redis",
    to: "worker",
    fromSide: "left",
    toSide: "right",
    tone: "lime",
    label: "consume jobs",
  },
  {
    id: "worker-mesh",
    from: "worker",
    to: "mesh",
    fromSide: "top",
    toSide: "bottom",
    tone: "cyan",
    label: "AI tasks",
  },
  {
    id: "redis-realtime",
    from: "redis",
    to: "realtime",
    fromSide: "top",
    toSide: "bottom",
    tone: "lime",
    label: "pub/sub",
    dashed: true,
  },
  {
    id: "backend-minio",
    from: "backend",
    to: "minio",
    fromSide: "right",
    toSide: "left",
    tone: "cyan",
    label: "file IO",
  },
  {
    id: "backend-postgres",
    from: "backend",
    to: "postgres",
    fromSide: "right",
    toSide: "left",
    tone: "cyan",
    label: "queries",
  },
  {
    id: "worker-postgres",
    from: "worker",
    to: "postgres",
    fromSide: "right",
    toSide: "left",
    tone: "lime",
    label: "run state",
  },
  {
    id: "latex-minio",
    from: "latex",
    to: "minio",
    fromSide: "bottom",
    toSide: "top",
    tone: "amber",
    label: "PDF artifacts",
  },
  {
    id: "worker-minio",
    from: "worker",
    to: "minio",
    fromSide: "right",
    toSide: "left",
    tone: "lime",
    label: "generated assets",
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

function anchorPoint(node: DiagramNode, side: Side) {
  if (side === "left") {
    return { x: node.x, y: node.y + node.h / 2 };
  }
  if (side === "right") {
    return { x: node.x + node.w, y: node.y + node.h / 2 };
  }
  if (side === "top") {
    return { x: node.x + node.w / 2, y: node.y };
  }
  return { x: node.x + node.w / 2, y: node.y + node.h };
}

function bezierPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) {
  const inv = 1 - t;
  const x =
    inv * inv * inv * p0.x +
    3 * inv * inv * t * p1.x +
    3 * inv * t * t * p2.x +
    t * t * t * p3.x;
  const y =
    inv * inv * inv * p0.y +
    3 * inv * inv * t * p1.y +
    3 * inv * t * t * p2.y +
    t * t * t * p3.y;
  return { x, y };
}

function buildCurve(link: DiagramLink, nodes: Record<string, DiagramNode>) {
  const from = nodes[link.from];
  const to = nodes[link.to];
  if (!from || !to) return null;

  const start = anchorPoint(from, link.fromSide);
  const end = anchorPoint(to, link.toSide);

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  const pull = Math.max(72, Math.min(235, distance * 0.38));

  const fromVec = SIDE_VECTOR[link.fromSide];
  const toVec = SIDE_VECTOR[link.toSide];

  const c1 = {
    x: start.x + fromVec.x * pull,
    y: start.y + fromVec.y * pull,
  };
  const c2 = {
    x: end.x + toVec.x * pull,
    y: end.y + toVec.y * pull,
  };

  const label = bezierPoint(0.5, start, c1, c2, end);

  return {
    path: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    labelX: label.x,
    labelY: label.y,
  };
}

function nodeStyle(node: DiagramNode) {
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
  const [exporting, setExporting] = useState(false);

  const nodeMap = useMemo(() => {
    return DIAGRAM_NODES.reduce<Record<string, DiagramNode>>((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {});
  }, []);

  const renderedLinks = useMemo(() => {
    return DIAGRAM_LINKS.map((link) => {
      const curve = buildCurve(link, nodeMap);
      if (!curve) return null;
      return {
        ...link,
        ...curve,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [nodeMap]);

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
      <div className="mx-auto w-full max-w-[1480px] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-300 bg-white px-3 py-2">
          <div className="text-xs text-neutral-600">Export 3:2 (1500x1000) · architecture poster · max 5MB target</div>
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
          </div>
        </div>

        <div
          ref={exportRef}
          className="relative aspect-[3/2] overflow-hidden rounded-3xl border border-neutral-300 bg-neutral-100 p-5 shadow-[0_36px_90px_-38px_rgba(0,0,0,0.38)]"
        >
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-neutral-300 bg-[radial-gradient(circle_at_12%_14%,rgba(186,230,253,0.65),transparent_34%),radial-gradient(circle_at_86%_85%,rgba(217,249,157,0.45),transparent_38%),radial-gradient(circle_at_65%_20%,rgba(245,208,254,0.55),transparent_36%),linear-gradient(145deg,#fcfcfd_0%,#f7f7f8_45%,#f5f5f4_100%)]">
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

            <div className="pointer-events-none absolute inset-0 top-[102px]">
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
                  <g key={link.id}>
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

                return (
                  <article
                    key={node.id}
                    className={`absolute rounded-2xl border p-3 shadow-[0_14px_32px_-26px_rgba(0,0,0,0.45)] ${tone.shell}`}
                    style={nodeStyle(node)}
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
