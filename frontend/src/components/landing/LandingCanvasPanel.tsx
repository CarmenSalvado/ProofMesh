"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PerfectCursor } from "@/lib/perfectCursor";
import {
  Sparkles,
  Loader2,
  Send,
  Compass,
  FileCode,
  CheckCircle,
  Filter,
  BookOpen,
  GitMerge,
  Zap,
} from "lucide-react";

import { CanvasNode, CanvasEdge } from "@/components/canvas/types";
import { ProofCanvasV2 } from "@/components/canvas/ProofCanvasV2";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const noop = () => {};
const LANDING_CANVAS_SCALE = 0.8;
const LANDING_CANVAS_EXTENT = "125%";

const DEMO_NODES_INITIAL: CanvasNode[] = [
  {
    id: "def-001",
    type: "DEFINITION",
    title: "Prime Number",
    formula: "$n \\in \\mathbb{N}, n > 1$",
    x: 180,
    y: 110,
    width: 260,
    status: "DRAFT",
    dependencies: [],
  },
  {
    id: "lem-001",
    type: "LEMMA",
    title: "Euclid's Construction",
    content: "$N = p_1 \\cdot p_2 \\cdots p_n + 1$",
    x: 900,
    y: 110,
    width: 260,
    status: "VERIFIED",
    dependencies: [],
  },
  {
    id: "thm-001",
    type: "THEOREM",
    title: "Infinitude of Primes",
    formula: "$\\exists^\\infty p : \\text{Prime}(p)$",
    leanCode: "theorem prime_infinite : forall n, exists p > n, Prime p",
    x: 540,
    y: 430,
    width: 260,
    status: "VERIFIED",
    dependencies: [],
  },
];

const AI_SUGGESTED_NODE: CanvasNode = {
  id: "lean-verify-001",
  type: "FORMAL_TEST",
  title: "Lean Verification PASS: prime_infinite",
  content: "lean-runner> theorem `prime_infinite` compiled.\nlean-runner> all goals solved (0 pending).",
  leanCode:
    "theorem prime_infinite : ∀ n : Nat, ∃ p > n, Nat.Prime p := by\n  intro n\n  rcases Nat.exists_prime_gt n with ⟨p, hp_gt, hp_prime⟩\n  exact ⟨p, hp_gt, hp_prime⟩",
  verification: {
    method: "lean4",
    status: "pass",
    logs: "[lean-runner] theorem prime_infinite: verified\n[lean-runner] goals remaining: 0",
  },
  x: 160,
  y: 430,
  width: 320,
  status: "VERIFIED",
  dependencies: [],
};

const DEMO_EDGES_INITIAL: CanvasEdge[] = [
  { id: "e1", from: "def-001", to: "thm-001", type: "implies" },
  { id: "e2", from: "lem-001", to: "thm-001", type: "implies" },
];

const AI_SUGGESTED_EDGE: CanvasEdge = {
  id: "e3",
  from: "lean-verify-001",
  to: "thm-001",
  type: "implies",
};

const COLLABORATORS = [
  { initials: "AL", name: "Ada", color: "bg-indigo-100 text-indigo-700" },
  { initials: "SJ", name: "Sofia", color: "bg-amber-100 text-amber-700" },
  { initials: "DM", name: "David", color: "bg-emerald-100 text-emerald-700" },
];

type CursorId = "al" | "sj" | "dm";

const CURSOR_USERS: Array<{ id: CursorId; name: string; color: string }> = [
  { id: "al", name: "Ada", color: "#4f46e5" },
  { id: "sj", name: "Sofia", color: "#d97706" },
  { id: "dm", name: "David", color: "#059669" },
];

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
    label: "/canvas",
    title: "Canvas Builder",
    description: "Generate and connect nodes directly",
    aliases: ["explore", "diagram", "map"],
  },
  {
    id: "formalize",
    label: "/formalize",
    title: "Lean Formalizer",
    description: "Turn math text into Lean",
    aliases: ["formalise", "lean"],
  },
  {
    id: "verify",
    label: "/verify",
    title: "Lean Verifier",
    description: "Run theorem checks quickly",
    aliases: ["check"],
  },
  {
    id: "critic",
    label: "/critic",
    title: "Rigorous Critic",
    description: "Find weak spots and assumptions",
    aliases: ["review", "peer"],
  },
  {
    id: "compute",
    label: "/compute",
    title: "Computation Lab",
    description: "Run computational checks",
    aliases: ["python", "calc"],
  },
  {
    id: "strategist",
    label: "/strategist",
    title: "Proof Strategist",
    description: "Plan roadmap and decomposition",
    aliases: ["strategy", "roadmap", "plan"],
  },
  {
    id: "socratic",
    label: "/socratic",
    title: "Socratic Tutor",
    description: "Short hints over long answers",
    aliases: ["coach", "hint", "tutor"],
  },
];

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
    return { panel: "bg-sky-50/40", badge: "bg-sky-100 text-sky-700 border-sky-200" };
  }
  if (mode === "formalize" || mode === "verify") {
    return { panel: "bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  }
  if (mode === "critic") {
    return { panel: "bg-amber-50/40", badge: "bg-amber-100 text-amber-700 border-amber-200" };
  }
  if (mode === "compute") {
    return { panel: "bg-fuchsia-50/35", badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" };
  }
  if (mode === "strategist") {
    return { panel: "bg-indigo-50/35", badge: "bg-indigo-100 text-indigo-700 border-indigo-200" };
  }
  if (mode === "socratic") {
    return { panel: "bg-cyan-50/40", badge: "bg-cyan-100 text-cyan-700 border-cyan-200" };
  }
  return { panel: "", badge: "bg-neutral-100 text-neutral-700 border-neutral-200" };
};

export function LandingCanvasPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<HTMLDivElement>(null);
  const cursorRefs = useRef<Record<CursorId, HTMLDivElement | null>>({
    al: null,
    sj: null,
    dm: null,
  });
  const cursorControllersRef = useRef<Record<CursorId, PerfectCursor | null>>({
    al: null,
    sj: null,
    dm: null,
  });

  const [typedText, setTypedText] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [reasoningStepCount, setReasoningStepCount] = useState(0);
  const [showNewNode, setShowNewNode] = useState(false);
  const [verificationPhase, setVerificationPhase] = useState<"idle" | "running" | "passed">("idle");

  const [visibleNodeCount, setVisibleNodeCount] = useState(0);
  const [visibleEdgeCount, setVisibleEdgeCount] = useState(0);
  const [collaboratorCount, setCollaboratorCount] = useState(0);
  const [activityText, setActivityText] = useState("Waiting for collaborators...");
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [showSlashModePicker, setShowSlashModePicker] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [slashQuery, setSlashQuery] = useState("");
  const [activeSlashMode, setActiveSlashMode] = useState<SlashMode | null>(null);

  const aiPrompt = "verify theorem prime_infinite in Lean and attach a proof-check node";
  const aiResponse =
    "Rho generated a Lean proof script for `prime_infinite`, grounded with Idea2Story context retrieval. Simulated Lean execution passed with zero remaining goals.";
  const aiReasoningSteps = [
    "Retrieve theorem and dependency context via Idea2Story embeddings.",
    "Synthesize Lean script for `prime_infinite`.",
    "Attach verification node, execute Lean runner, and mark PASS.",
  ];

  const suggestedVerificationNode = useMemo(() => {
    if (verificationPhase !== "running") {
      return AI_SUGGESTED_NODE;
    }

    return {
      ...AI_SUGGESTED_NODE,
      title: "Lean Verification: running...",
      content: "lean-runner> compiling theorem `prime_infinite`...\nlean-runner> checking goals...",
      status: "DRAFT",
      verification: {
        method: "lean4",
        status: "running",
        logs: "[lean-runner] compiling...\n[lean-runner] goals pending: 2",
      },
    } as CanvasNode;
  }, [verificationPhase]);

  const slashModeOptions = useMemo(() => {
    const query = slashQuery.trim().toLowerCase();
    if (!query) return SLASH_MODE_OPTIONS;
    const filtered = SLASH_MODE_OPTIONS.filter(
      (option) =>
        option.id.includes(query) ||
        option.label.toLowerCase().includes(query) ||
        option.aliases.some((alias) => alias.toLowerCase().includes(query))
    );
    return filtered.length > 0 ? filtered : SLASH_MODE_OPTIONS;
  }, [slashQuery]);

  const activeSlashModeMeta = useMemo(
    () => SLASH_MODE_OPTIONS.find((option) => option.id === activeSlashMode) || null,
    [activeSlashMode]
  );
  const activeModeAccent = getSlashModeAccent(activeSlashMode);

  const scaffoldNodes = DEMO_NODES_INITIAL.slice(0, visibleNodeCount);
  const scaffoldEdges = DEMO_EDGES_INITIAL.slice(0, visibleEdgeCount);

  const currentNodes =
    showNewNode && visibleNodeCount >= 3 ? [...scaffoldNodes, suggestedVerificationNode] : scaffoldNodes;
  const currentEdges =
    showNewNode && visibleEdgeCount >= 2 ? [...scaffoldEdges, AI_SUGGESTED_EDGE] : scaffoldEdges;

  useEffect(() => {
    let isActive = true;
    const safeSet = (fn: () => void) => {
      if (isActive) fn();
    };

    const disposeCursorControllers = () => {
      CURSOR_USERS.forEach(({ id }) => {
        cursorControllersRef.current[id]?.dispose();
        cursorControllersRef.current[id] = null;
      });
    };

    const animateEdgeDraw = (edgeId: string) => {
      requestAnimationFrame(() => {
        const edgePath = rootRef.current?.querySelector(
          `g[data-edge-id="${edgeId}"] .edge-line`
        ) as SVGPathElement | null;
        if (!edgePath) return;

        let length = 0;
        try {
          length = edgePath.getTotalLength();
        } catch {
          return;
        }
        if (!Number.isFinite(length) || length <= 0) return;

        gsap.killTweensOf(edgePath);
        gsap.set(edgePath, {
          strokeDasharray: `${length} ${length}`,
          strokeDashoffset: length,
          opacity: 0.28,
        });
        gsap.to(edgePath, {
          strokeDashoffset: 0,
          opacity: 1,
          duration: 0.88,
          ease: "power2.out",
          onComplete: () => {
            gsap.set(edgePath, { clearProps: "strokeDasharray,strokeDashoffset,opacity" });
          },
        });
      });
    };

    const initCursorControllers = () => {
      disposeCursorControllers();
      CURSOR_USERS.forEach(({ id }) => {
        cursorControllersRef.current[id] = new PerfectCursor((point: number[]) => {
          const cursorEl = cursorRefs.current[id];
          if (!cursorEl) return;
          cursorEl.style.transform = `translate3d(${point[0]}px, ${point[1]}px, 0)`;
        });
      });
    };

    const revealCursor = (id: CursorId) => {
      const cursorEl = cursorRefs.current[id];
      if (cursorEl) {
        gsap.set(cursorEl, { opacity: 1 });
      }
    };

    const moveCursors = (positions: Array<[CursorId, number, number]>) => {
      positions.forEach(([id, x, y]) => {
        cursorControllersRef.current[id]?.addPoint([x, y]);
      });
    };

    const ctx = gsap.context(() => {
      const resetStates = () => {
        safeSet(() => {
          setTypedText("");
          setShowThinking(false);
          setShowResponse(false);
          setShowReasoning(false);
          setReasoningStepCount(0);
          setShowNewNode(false);
          setVerificationPhase("idle");
          setVisibleNodeCount(0);
          setVisibleEdgeCount(0);
          setCollaboratorCount(0);
          setSelectedNodeIds(new Set());
          setShowSlashModePicker(false);
          setSlashMenuIndex(0);
          setSlashQuery("");
          setActiveSlashMode(null);
          setActivityText("Waiting for collaborators...");
        });
        if (canvasRef.current) gsap.set(canvasRef.current, { opacity: 0, y: 24 });
        if (presenceRef.current) gsap.set(presenceRef.current, { opacity: 0, y: 10 });
        if (aiResponseRef.current) gsap.set(aiResponseRef.current, { opacity: 0, y: 8, scale: 0.98 });
        CURSOR_USERS.forEach(({ id }) => {
          const cursorEl = cursorRefs.current[id];
          if (!cursorEl) return;
          gsap.set(cursorEl, { opacity: 0, x: 0, y: 0, force3D: true });
          cursorEl.style.transform = "translate3d(0px, 0px, 0px)";
        });
        initCursorControllers();
      };

      const typing = { progress: 0 };
      resetStates();

      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.12 });

      tl.call(() => {
        typing.progress = 0;
        resetStates();
      })
        .to(canvasRef.current, { opacity: 1, y: 0, duration: 0.75, ease: "power2.out" })
        .to(presenceRef.current, { opacity: 1, y: 0, duration: 0.3 }, "-=0.3")
        .call(() =>
          safeSet(() => {
            setCollaboratorCount(1);
            setVisibleNodeCount(1);
            setActivityText("Ada joined and added a definition node.");
          })
        )
        .call(() => {
          revealCursor("al");
          moveCursors([["al", 170, 155]]);
        })
        .to({}, { duration: 0.12 })
        .call(() => moveCursors([["al", 196, 142]]))
        .to({}, { duration: 0.12 })
        .call(() => moveCursors([["al", 224, 128]]))
        .to({}, { duration: 0.12 })
        .call(() => moveCursors([["al", 246, 142]]))
        .to({}, { duration: 0.12 })
        .call(() => moveCursors([["al", 258, 156]]))
        .to({}, { duration: 0.24 })
        .call(() =>
          safeSet(() => {
            setCollaboratorCount(2);
            setVisibleNodeCount(2);
            setActivityText("Sofia joined and added a lemma node.");
          })
        )
        .call(() => {
          revealCursor("sj");
          moveCursors([
            ["al", 276, 170],
            ["sj", 840, 176],
          ]);
        })
        .to({}, { duration: 0.12 })
        .call(() =>
          moveCursors([
            ["al", 292, 178],
            ["sj", 810, 158],
          ])
        )
        .to({}, { duration: 0.12 })
        .call(() =>
          moveCursors([
            ["al", 306, 186],
            ["sj", 780, 144],
          ])
        )
        .to({}, { duration: 0.12 })
        .call(() =>
          moveCursors([
            ["al", 318, 194],
            ["sj", 760, 132],
          ])
        )
        .to({}, { duration: 0.2 })
        .call(() =>
          safeSet(() => {
            setCollaboratorCount(3);
            setVisibleNodeCount(3);
            setActivityText("David joined and added the theorem target node.");
          })
        )
        .call(() => {
          revealCursor("dm");
          moveCursors([
            ["al", 328, 206],
            ["sj", 720, 190],
            ["dm", 470, 522],
          ]);
        })
        .to({}, { duration: 0.11 })
        .call(() =>
          moveCursors([
            ["al", 336, 214],
            ["sj", 702, 204],
            ["dm", 485, 498],
          ])
        )
        .to({}, { duration: 0.11 })
        .call(() =>
          moveCursors([
            ["al", 346, 222],
            ["sj", 684, 218],
            ["dm", 496, 480],
          ])
        )
        .to({}, { duration: 0.11 })
        .call(() =>
          moveCursors([
            ["al", 354, 232],
            ["sj", 668, 230],
            ["dm", 508, 464],
          ])
        )
        .to({}, { duration: 0.2 })
        .call(() =>
          safeSet(() => {
            setVisibleEdgeCount(1);
            setActivityText("Collaborators connected definition -> theorem.");
          })
        )
        .call(() => animateEdgeDraw("e1"))
        .call(() => moveCursors([["al", 346, 266], ["dm", 514, 454]]))
        .to({}, { duration: 0.1 })
        .call(() => moveCursors([["al", 350, 292], ["dm", 526, 448]]))
        .to({}, { duration: 0.1 })
        .call(() => moveCursors([["al", 356, 316], ["dm", 536, 442]]))
        .to({}, { duration: 0.18 })
        .call(() =>
          safeSet(() => {
            setVisibleEdgeCount(2);
            setActivityText("Collaborators connected lemma -> theorem.");
          })
        )
        .call(() => animateEdgeDraw("e2"))
        .call(() => moveCursors([["sj", 650, 292], ["dm", 546, 432], ["al", 364, 328]]))
        .to({}, { duration: 0.1 })
        .call(() => moveCursors([["sj", 632, 312], ["dm", 556, 428], ["al", 370, 336]]))
        .to({}, { duration: 0.1 })
        .call(() => moveCursors([["sj", 612, 332], ["dm", 566, 424], ["al", 376, 344]]))
        .to({}, { duration: 0.18 })
        .call(() =>
          safeSet(() => {
            setSelectedNodeIds(new Set(["lem-001", "thm-001"]));
            setShowSlashModePicker(true);
            setSlashQuery("ver");
            setSlashMenuIndex(0);
            setTypedText("/ver");
            setActivityText("You selected 2 nodes and opened slash commands.");
          })
        )
        .call(() => moveCursors([["al", 378, 346], ["sj", 598, 338], ["dm", 572, 420]]))
        .to({}, { duration: 0.12 })
        .call(() => moveCursors([["al", 382, 350], ["sj", 590, 344], ["dm", 576, 418]]))
        .to({}, { duration: 0.92 })
        .call(() =>
          safeSet(() => {
            setActiveSlashMode("verify");
            setShowSlashModePicker(false);
            setSlashQuery("");
            setSlashMenuIndex(0);
            setTypedText("");
            setActivityText("You selected /verify and asked Rho.");
          })
        )
        .to(typing, {
          progress: 1,
          duration: 1.75,
          ease: "none",
          onUpdate: () => {
            safeSet(() => {
              const chars = Math.floor(typing.progress * aiPrompt.length);
              setTypedText(aiPrompt.slice(0, chars));
            });
          },
        })
        .call(() => safeSet(() => setShowThinking(true)))
        .to({}, { duration: 1.1 })
        .call(() =>
          safeSet(() => {
            setShowThinking(false);
            setShowResponse(true);
            setShowReasoning(true);
            setReasoningStepCount(0);
            setActivityText("Rho is building the reasoning chain.");
          })
        )
        .to(aiResponseRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.3 })
        .to({}, { duration: 0.58 })
        .call(() => safeSet(() => setReasoningStepCount(1)))
        .to({}, { duration: 0.68 })
        .call(() => safeSet(() => setReasoningStepCount(2)))
        .to({}, { duration: 0.72 })
        .call(() => safeSet(() => setReasoningStepCount(3)))
        .to({}, { duration: 0.62 })
        .call(() =>
          safeSet(() => {
            setShowNewNode(true);
            setVerificationPhase("running");
            setActivityText("Rho attached a formal verification node and started Lean runner.");
          })
        )
        .call(() => animateEdgeDraw("e3"))
        .to({}, { duration: 0.72 })
        .call(() =>
          safeSet(() => {
            setActivityText("Lean runner is elaborating tactics and checking remaining goals...");
          })
        )
        .to({}, { duration: 0.86 })
        .call(() =>
          safeSet(() => {
            setVerificationPhase("passed");
            setActivityText("Lean runner finished: verification PASS, theorem remains valid.");
          })
        )
        .to({}, { duration: 0.2 });

      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top 72%",
        onEnter: () => tl.play(0),
        onEnterBack: () => tl.play(),
        onLeave: () => tl.pause(),
        onLeaveBack: () => {
          tl.pause(0);
          resetStates();
        },
      });
    }, rootRef);

    return () => {
      isActive = false;
      ctx.revert();
      disposeCursorControllers();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden bg-white bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:20px_20px]"
    >
      <div
        ref={presenceRef}
        className="absolute top-4 right-4 z-30 min-w-[260px] rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {COLLABORATORS.slice(0, collaboratorCount).map((c) => (
              <div
                key={c.initials}
                className={`h-6 w-6 rounded-full border border-white text-[10px] font-bold flex items-center justify-center ${c.color}`}
                title={c.name}
              >
                {c.initials}
              </div>
            ))}
          </div>
          <span className="text-[11px] font-medium text-neutral-600">Live collaborators</span>
        </div>
        <p className="text-[11px] text-neutral-500">{activityText}</p>
      </div>

      <div ref={canvasRef} className="absolute inset-0">
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `scale(${LANDING_CANVAS_SCALE})`,
            width: LANDING_CANVAS_EXTENT,
            height: LANDING_CANVAS_EXTENT,
          }}
        >
          <ProofCanvasV2
            nodes={currentNodes}
            edges={currentEdges}
            selectedNodeId={null}
            selectedNodeIds={selectedNodeIds}
            onNodeSelect={noop}
            readOnly={true}
            hideZoomControls={true}
            hideMinimap={true}
            hideHelpText={true}
            disableInteraction={true}
          />
        </div>
      </div>

      <div className="absolute inset-0 z-[26] pointer-events-none">
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `scale(${LANDING_CANVAS_SCALE})`,
            width: LANDING_CANVAS_EXTENT,
            height: LANDING_CANVAS_EXTENT,
          }}
        >
          {CURSOR_USERS.map((cursor) => (
            <div
              key={cursor.id}
              ref={(el) => {
                cursorRefs.current[cursor.id] = el;
              }}
              className="absolute left-0 top-0 transform-gpu"
              style={{ opacity: 0, willChange: "transform, opacity" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-md">
                <path d="M4 4L12 20L14 14L20 12L4 4Z" fill={cursor.color} stroke="white" strokeWidth="1.5" />
              </svg>
              <span
                className="absolute left-5 top-5 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 z-[60] w-[92%] max-w-[650px] -translate-x-1/2 rounded-xl border border-neutral-200 bg-white/95 opacity-100 shadow-lg ring-1 ring-neutral-200/60 backdrop-blur">
        {selectedNodeIds.size > 0 && (
          <div className="px-4 pt-2">
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700">
              {selectedNodeIds.size} nodes selected
            </span>
          </div>
        )}
        <div className="border-t border-neutral-100/90">
          {showSlashModePicker && (
            <div className="px-4 pt-3">
              <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
                {slashModeOptions.map((option, index) => {
                  const ModeIcon = getSlashModeIcon(option.id);
                  const active = index === slashMenuIndex;
                  return (
                    <div
                      key={option.id}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                        active ? "bg-neutral-900 text-white" : "text-neutral-700"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ModeIcon className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">{option.label}</span>
                      </span>
                      <span className={`text-[11px] ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                        {option.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`flex items-center gap-3 px-4 py-3 ${activeModeAccent.panel}`}>
            <Sparkles className="w-5 h-5 text-neutral-400 flex-shrink-0" />

            {activeSlashModeMeta && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold flex-shrink-0 ${activeModeAccent.badge}`}
              >
                {activeSlashModeMeta.label}
              </span>
            )}

            <div className="flex-1 min-h-[20px] text-sm text-neutral-800">
              {typedText || <span className="text-neutral-400">Type `/` and ask Rho...</span>}
              {((showSlashModePicker && typedText.startsWith("/")) ||
                (typedText && typedText.length < aiPrompt.length)) && (
                <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
              )}
            </div>

            {showThinking ? (
              <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-neutral-400" />
            )}
          </div>

          <div className="flex items-center gap-1 px-4 py-2 bg-neutral-50/60 relative">
            <span className="text-[10px] text-neutral-500">
              {activeSlashModeMeta ? `${activeSlashModeMeta.title} active` : "Type `/` for math modes"}
            </span>
            <div className="flex-1" />
            <span className="text-[10px] text-neutral-400">esc</span>
          </div>
        </div>
      </div>

      <div
        ref={aiResponseRef}
        className="absolute bottom-28 right-6 z-30 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-xl backdrop-blur"
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-medium text-neutral-700">Mesh AI · Rho</span>
          <span className="ml-auto text-[10px] text-emerald-500">Suggestion</span>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-neutral-600">{showResponse ? aiResponse : ""}</p>
          {showReasoning && (
            <div className="mt-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Reasoning Chain
              </p>
              {aiReasoningSteps.map((step, index) => {
                const visible = reasoningStepCount > index;
                return (
                  <div
                    key={step}
                    className={`flex items-start gap-1.5 text-[11px] transition-opacity ${
                      visible ? "opacity-100" : "opacity-30"
                    }`}
                  >
                    <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${visible ? "bg-indigo-500" : "bg-neutral-300"}`} />
                    <span className="text-neutral-600">{step}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 bg-neutral-50/60 px-3 py-2">
          {verificationPhase === "running" ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running Lean check...
            </span>
          ) : verificationPhase === "passed" ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
              <CheckCircle className="w-3 h-3" />
              Lean check passed
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-600">
              <Sparkles className="w-3 h-3" />
              Waiting to execute
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
