"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const IDEA2STORY_PAPER_URL = "https://arxiv.org/abs/2601.20833";

type LeftTab = "files" | "chats" | "knowledge";

const MOCK_KNOWLEDGE_NODES = [
  {
    id: "def-prime",
    title: "Prime Number",
    kind: "Definition",
    tone: "text-indigo-300 border-indigo-500/40 bg-indigo-500/10",
    x: 52,
    y: 32,
  },
  {
    id: "lem-euclid",
    title: "Euclid Construction",
    kind: "Lemma",
    tone: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    x: 128,
    y: 54,
  },
  {
    id: "thm-primes",
    title: "Infinitude Theorem",
    kind: "Theorem",
    tone: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    x: 88,
    y: 112,
  },
] as const;

const MOCK_KNOWLEDGE_EDGES: Array<{ from: string; to: string }> = [
  { from: "def-prime", to: "thm-primes" },
  { from: "lem-euclid", to: "thm-primes" },
];

export function LandingLatexPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(false);
  const [phase, setPhase] = useState(0); // 0 typing, 1 thinking, 2 response, 3 compiling, 4 done
  const [reasoningStepCount, setReasoningStepCount] = useState(0);
  const [leftTab, setLeftTab] = useState<LeftTab>("files");
  const editorHasPatch = phase >= 3;
  const previewHasPatch = phase >= 4;
  const highlightedKnowledgeId = phase >= 2 ? "lem-euclid" : null;
  const reasoningSteps = [
    "Identify where Euclid's contradiction is missing.",
    "Derive N mod p_i = 1 for every listed prime.",
    "Conclude existence of a new prime divisor and close the proof.",
  ];

  useEffect(() => {
    let isActive = true;
    hasPlayedRef.current = false;
    const safeSet = (fn: () => void) => {
      if (isActive) fn();
    };

    const ctx = gsap.context(() => {
      const resetStates = () => {
        safeSet(() => setPhase(0));
        safeSet(() => setReasoningStepCount(0));
        safeSet(() => setLeftTab("files"));
        if (panelRef.current) gsap.set(panelRef.current, { opacity: 0, y: 30 });
        if (editorPaneRef.current) gsap.set(editorPaneRef.current, { opacity: 0, y: 14 });
        if (previewPaneRef.current) gsap.set(previewPaneRef.current, { opacity: 0, y: 16, scale: 0.99 });
        if (chatRef.current) gsap.set(chatRef.current, { opacity: 0, y: 8 });
      };

      resetStates();

      const tl = gsap.timeline({ paused: true });
      tl.call(() => safeSet(() => setPhase(0)))
        .to(panelRef.current, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" })
        .to(editorPaneRef.current, { opacity: 1, y: 0, duration: 0.42, ease: "power2.out" }, "-=0.28")
        .to(previewPaneRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power2.out" }, "-=0.36")
        .to(chatRef.current, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, "-=0.18")
        .to({}, { duration: 0.72 })
        .call(() => safeSet(() => setPhase(1)))
        .to({}, { duration: 1.05 })
        .call(() =>
          safeSet(() => {
            setPhase(2);
            setReasoningStepCount(0);
            setLeftTab("knowledge");
          })
        )
        .to(chatRef.current, { y: -2, duration: 0.24, repeat: 1, yoyo: true, ease: "sine.inOut" })
        .to({}, { duration: 0.44 })
        .call(() => safeSet(() => setReasoningStepCount(1)))
        .to({}, { duration: 0.56 })
        .call(() => safeSet(() => setReasoningStepCount(2)))
        .to({}, { duration: 0.62 })
        .call(() => safeSet(() => setReasoningStepCount(3)))
        .to({}, { duration: 0.5 })
        .call(() =>
          safeSet(() => {
            setPhase(3);
            setLeftTab("knowledge");
          })
        )
        .to(previewPaneRef.current, { scale: 1.012, duration: 0.28, repeat: 1, yoyo: true, ease: "sine.inOut" })
        .to({}, { duration: 1.18 })
        .call(() =>
          safeSet(() => {
            setPhase(4);
            setLeftTab("files");
          })
        )
        .to({}, { duration: 1.04 });

      ScrollTrigger.create({
        trigger: rootRef.current,
        start: "top 72%",
        once: true,
        onEnter: () => {
          if (hasPlayedRef.current) return;
          hasPlayedRef.current = true;
          tl.play(0);
        },
      });
    }, rootRef);

    return () => {
      isActive = false;
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-900 to-emerald-950/50 p-4 md:p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.65)]"
    >
      <div
        ref={panelRef}
        className="rounded-xl overflow-hidden border border-neutral-800 bg-[#0d0d0d]"
        style={{ opacity: 0 }}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 bg-[#151515] px-4 py-2.5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Collaborative LaTeX Workspace</h3>
            <p className="text-[11px] text-neutral-400">Shared editor + Rho critique + compile rigor</p>
          </div>
          {phase === 3 ? (
            <div className="flex items-center gap-1.5 text-amber-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Compiling</span>
            </div>
          ) : phase >= 4 ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Compiled</span>
            </div>
          ) : (
            <button className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white">
              <Play className="w-3.5 h-3.5" />
              Compile
            </button>
          )}
        </div>

        <div className="grid min-h-[760px] grid-cols-1 xl:grid-cols-[1.55fr_1fr]">
          <div ref={editorPaneRef} className="flex min-w-0 border-b border-neutral-800 xl:border-b-0 xl:border-r">
            <aside className="hidden w-[224px] shrink-0 border-r border-neutral-800 bg-[#090909] lg:flex lg:flex-col">
              <div className="border-b border-neutral-800 p-2">
                <div className="flex items-center gap-1 rounded-md bg-[#101010] p-1">
                  {([
                    { id: "files", label: "Files", Icon: Folder },
                    { id: "chats", label: "Chats", Icon: MessageSquare },
                    { id: "knowledge", label: "Knowledge", Icon: BookOpen },
                  ] as const).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLeftTab(id)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                        leftTab === id
                          ? "bg-[#1a1a1a] text-neutral-200"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {leftTab === "files" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1 pb-1">
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500">Project files</span>
                      <RefreshCw className="h-3 w-3 text-neutral-600" />
                    </div>
                    <div className="flex items-center gap-2 rounded border border-neutral-700/70 bg-neutral-800/60 px-2 py-1.5 text-neutral-200">
                      <FileText className="h-3 w-3 text-amber-400" />
                      <span className="truncate font-mono text-[11px]">proof.tex</span>
                    </div>
                    <div className="flex items-center gap-2 rounded border border-transparent px-2 py-1.5 text-neutral-500">
                      <FileText className="h-3 w-3" />
                      <span className="truncate font-mono text-[11px]">refs.bib</span>
                    </div>
                    <div className="flex items-center gap-2 rounded border border-transparent px-2 py-1.5 text-neutral-500">
                      <Folder className="h-3 w-3 text-sky-400" />
                      <span className="truncate font-mono text-[11px]">figures/</span>
                    </div>
                  </div>
                )}

                {leftTab === "chats" && (
                  <div className="space-y-2">
                    <div className="px-1 text-[10px] uppercase tracking-wide text-neutral-500">Recent chats</div>
                    <div className="rounded-lg border border-neutral-800 bg-[#0f0f0f] px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-neutral-200">Proof edits</span>
                        <span className="text-[10px] text-neutral-600">2m</span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-neutral-500">
                        Strengthen contradiction step and add formal justification.
                      </p>
                    </div>
                    <div className="rounded-lg border border-neutral-800 bg-[#0f0f0f] px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-neutral-200">Bibliography</span>
                        <span className="text-[10px] text-neutral-600">9m</span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-neutral-500">
                        Link source for Euclid&apos;s argument and supporting lemma lineage.
                      </p>
                    </div>
                  </div>
                )}

                {leftTab === "knowledge" && (
                  <div className="space-y-2.5">
                    <div className="rounded-md border border-neutral-800 bg-[#101010] px-2 py-1.5">
                      <div className="flex items-center gap-1.5 text-neutral-500">
                        <Search className="h-3 w-3" />
                        <span className="text-[10px]">Search shared knowledge and proof blocks...</span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-800 bg-[#0c0c0c] px-2.5 py-2">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-500">
                        <span>Exploration map</span>
                        <span>{MOCK_KNOWLEDGE_NODES.length} nodes</span>
                      </div>
                      <svg viewBox="0 0 180 140" className="h-[140px] w-full rounded-md border border-neutral-800 bg-[#080808]">
                        {MOCK_KNOWLEDGE_EDGES.map((edge) => {
                          const from = MOCK_KNOWLEDGE_NODES.find((node) => node.id === edge.from);
                          const to = MOCK_KNOWLEDGE_NODES.find((node) => node.id === edge.to);
                          if (!from || !to) return null;
                          return (
                            <line
                              key={`${edge.from}-${edge.to}`}
                              x1={from.x}
                              y1={from.y}
                              x2={to.x}
                              y2={to.y}
                              stroke="rgba(148,163,184,0.45)"
                              strokeWidth="1.2"
                            />
                          );
                        })}
                        {MOCK_KNOWLEDGE_NODES.map((node) => {
                          const highlighted = highlightedKnowledgeId === node.id;
                          return (
                            <g key={node.id}>
                              <circle
                                cx={node.x}
                                cy={node.y}
                                r={highlighted ? 7 : 5.8}
                                fill={highlighted ? "#34d399" : "#64748b"}
                                stroke={highlighted ? "#059669" : "#334155"}
                                strokeWidth={highlighted ? 2 : 1}
                              />
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    <div className="space-y-1.5">
                      {MOCK_KNOWLEDGE_NODES.map((node) => {
                        const highlighted = highlightedKnowledgeId === node.id;
                        return (
                          <div
                            key={node.id}
                            className={`rounded-lg border px-2 py-1.5 transition-colors ${
                              highlighted
                                ? "border-emerald-500/40 bg-emerald-500/8"
                                : "border-neutral-800 bg-[#0f0f0f]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${node.tone}`}>
                                {node.kind}
                              </span>
                              <span className="text-[9px] text-neutral-500">{highlighted ? "active context" : "verified context"}</span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-neutral-200">{node.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-800 p-2">
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Auto-compile enabled
                </div>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col bg-[#0d0d0d]">
              <div className="flex items-center justify-between border-b border-neutral-800 bg-[#151515] px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-2 rounded-t border-b-2 border-amber-500 bg-[#0d0d0d] px-3 py-1.5">
                    <FileText className="h-3 w-3 text-amber-400" />
                    <span className="font-mono text-[11px] text-neutral-200">proof.tex</span>
                    <span className="text-[10px] text-neutral-600">x</span>
                  </div>
                  <span className="hidden text-[10px] text-neutral-600 md:block">main.tex / proof.tex</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                  <span className={`rounded border px-1.5 py-0.5 uppercase tracking-wide ${phase >= 4 ? "border-emerald-600/40 text-emerald-400" : "border-neutral-700 text-neutral-500"}`}>
                    {phase >= 4 ? "synced" : "editing"}
                  </span>
                  <span>UTF-8 · LaTeX · Ln 15, Col 14</span>
                </div>
              </div>

              <div className="relative h-[520px] overflow-hidden bg-[#0c0c0c] font-mono text-[11px] leading-5 text-neutral-300">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-9 border-l border-neutral-800 bg-[#111111] px-2 py-3">
                  <div className="space-y-1">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div
                        key={`mini-${i}`}
                        className={`h-[3px] rounded-sm ${i > 13 && editorHasPatch ? "bg-emerald-500/60" : "bg-neutral-700/70"}`}
                        style={{ width: `${60 + ((i * 11) % 35)}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="h-full overflow-hidden px-4 py-4 pr-11">
                  {[
                    "% Infinitude of Primes",
                    "\\documentclass[12pt]{article}",
                    "\\usepackage{amsthm, amsmath}",
                    "\\newtheorem{theorem}{Theorem}",
                    "",
                    "\\begin{document}",
                    "",
                    "\\begin{theorem}",
                    "  There are infinitely many prime numbers.",
                    "\\end{theorem}",
                    "",
                    "\\begin{proof}",
                    "  Assume p_1, p_2, ..., p_n are all primes.",
                    "  Let N = p_1 * p_2 * ... * p_n + 1.",
                  ].map((line, idx) => {
                    const trimmed = line.trim();
                    const isComment = trimmed.startsWith("%");
                    const isEnvironment = /\\(begin|end)\{/.test(trimmed);
                    const isCommand = trimmed.startsWith("\\");
                    const tone = isComment
                      ? "text-emerald-500/80"
                      : isEnvironment
                        ? "text-sky-300"
                        : isCommand
                          ? "text-violet-300"
                          : "text-neutral-300";
                    return (
                      <div key={idx} className="flex gap-3 rounded-sm hover:bg-neutral-800/30">
                        <span className="w-6 shrink-0 text-right text-neutral-600">{idx + 1}</span>
                        <span className={tone}>{line}</span>
                      </div>
                    );
                  })}

                  {editorHasPatch ? (
                    <>
                      <div className="mt-0.5 flex gap-3 rounded-r-sm border-l-2 border-emerald-400 bg-emerald-500/10">
                        <span className="w-6 shrink-0 text-right text-emerald-500">15</span>
                        <span className="text-emerald-100">Since N mod p_i = 1, no p_i divides N.</span>
                      </div>
                      <div className="flex gap-3 rounded-r-sm border-l-2 border-emerald-400 bg-emerald-500/10">
                        <span className="w-6 shrink-0 text-right text-emerald-500">16</span>
                        <span className="text-emerald-100">Hence N has a prime divisor not in our list. Contradiction.</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-0.5 flex gap-3 rounded-r-sm border-l-2 border-indigo-400 bg-indigo-500/10">
                      <span className="w-6 shrink-0 text-right text-neutral-600">15</span>
                      <span className="text-neutral-400">
                        <span className="inline-block h-3 w-0.5 animate-pulse bg-indigo-400" />
                      </span>
                    </div>
                  )}

                  <div className="flex gap-3 rounded-sm hover:bg-neutral-800/30">
                    <span className="w-6 shrink-0 text-right text-neutral-600">{editorHasPatch ? "17" : "16"}</span>
                    <span className="text-sky-300">{"\\end{proof}"}</span>
                  </div>
                  <div className="flex gap-3 rounded-sm hover:bg-neutral-800/30">
                    <span className="w-6 shrink-0 text-right text-neutral-600">{editorHasPatch ? "18" : "17"}</span>
                    <span className="text-sky-300">{"\\end{document}"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto border-t border-neutral-800 bg-[#0a0a0a] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400">proof.tex</span>
                </div>
                <div ref={chatRef} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <div className="mb-2 flex justify-end">
                    <div className="max-w-[70%] rounded-xl rounded-tr-sm bg-neutral-800 px-3 py-2 text-xs text-neutral-200">
                      Tighten the proof with explicit modular argument and rigorous finish.
                    </div>
                  </div>

                  {phase === 1 && (
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Rho is synthesizing team context...</span>
                    </div>
                  )}

                  {phase >= 2 && (
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
                      <div className="rounded-xl rounded-tl-sm border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
                        Rho is integrating{" "}
                        <a
                          href={IDEA2STORY_PAPER_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-300 underline decoration-sky-700/60 underline-offset-2"
                        >
                          Idea2Story
                        </a>{" "}
                        embedding context and tightening the final contradiction steps.
                        <div className="mt-2 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                            Rigor Chain
                          </p>
                          {reasoningSteps.map((step, index) => {
                            const visible = reasoningStepCount > index;
                            return (
                              <div
                                key={step}
                                className={`flex items-start gap-1.5 text-[11px] transition-opacity ${
                                  visible ? "opacity-100" : "opacity-30"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                                    visible ? "bg-emerald-400" : "bg-neutral-500"
                                  }`}
                                />
                                <span>{step}</span>
                              </div>
                            );
                          })}
                        </div>
                        {phase === 3 && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Recompiling shared PDF...
                          </div>
                        )}
                        {phase >= 4 && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Reviewed, compiled, and synced
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg bg-neutral-900 p-0.5">
                      <span className="flex items-center gap-1 rounded-md bg-neutral-800 px-2.5 py-1 text-[10px] text-white">
                        <Zap className="h-3 w-3 text-amber-400" />
                        Flash
                      </span>
                      <span className="px-2.5 py-1 text-[10px] text-neutral-500">Rigor mode</span>
                    </div>
                    <button className="rounded-md bg-neutral-100 p-1.5 text-neutral-900">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div ref={previewPaneRef} className="flex flex-col bg-[#0d0d0d]">
            <div className="flex items-center justify-between border-b border-neutral-800 bg-[#151515] px-3 py-2 text-[11px] text-neutral-400">
              <div className="flex items-center gap-2">
                <span>PDF Preview</span>
                <span className="text-neutral-600">•</span>
                <span>click to jump to code</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-500">
                <div className="flex items-center gap-1">
                  <button className="rounded p-1 hover:bg-neutral-800">
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="text-[10px]">1 / 1</span>
                  <button className="rounded p-1 hover:bg-neutral-800">
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="h-4 w-px bg-neutral-700" />
                <div className="flex items-center gap-1">
                  <button className="rounded p-1 hover:bg-neutral-800">
                    <ZoomOut className="h-3 w-3" />
                  </button>
                  <span className="text-[10px]">100%</span>
                  <button className="rounded p-1 hover:bg-neutral-800">
                    <ZoomIn className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="relative flex-1 bg-neutral-900/30 p-4">
              {phase === 3 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/40">
                  <div className="flex items-center gap-2 rounded-md bg-neutral-950 px-3 py-2 text-xs text-neutral-200">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    Compiling...
                  </div>
                </div>
              )}

              <div className="mx-auto flex h-full w-full max-w-[470px] items-center justify-center">
                <div className="relative aspect-[1/1.414] w-full max-w-[420px] overflow-hidden border border-neutral-300 bg-[#fffdfa] shadow-[0_28px_56px_-24px_rgba(0,0,0,0.6)]">
                  <div className="absolute inset-x-0 top-0 h-6 border-b border-neutral-200/80 bg-neutral-50/80" />
                  <div className="relative h-full px-10 pb-10 pt-9 text-[12px] leading-[1.78] text-neutral-900">
                    <h4 className="text-center text-[16px] font-semibold tracking-[0.02em]">
                      On the Infinitude of Prime Numbers
                    </h4>
                    <p className="mt-1 text-center text-[10px] text-neutral-500">A. Lovelace</p>

                    <p className="mt-6 text-justify">
                      <span className="font-semibold">Theorem 1.</span> There are infinitely many prime
                      numbers.
                    </p>

                    <p className="mt-4 italic">Proof.</p>
                    <p className="mt-2 text-justify">
                      Assume p_1, ..., p_n are all prime numbers. Define
                    </p>
                    <p className="my-3 text-center text-[13px]">N = p_1 p_2 ... p_n + 1.</p>

                    {previewHasPatch ? (
                      <div className="space-y-2 transition-opacity duration-500 opacity-100">
                        <p className="text-justify">
                          For each i in {`{1, ..., n}`}, N mod p_i = 1; hence p_i does not divide N.
                        </p>
                        <p className="text-justify">
                          Therefore N has a prime divisor q distinct from p_1, ..., p_n, a contradiction.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-neutral-500 transition-opacity duration-300">
                        <p className="text-justify">
                          Draft output: the contradiction step is still missing, so this PDF has not yet been
                          refreshed with the final argument.
                        </p>
                      </div>
                    )}

                    <div
                      className={`mt-3 flex justify-end text-[14px] transition-opacity duration-300 ${
                        previewHasPatch ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <span>&#9633;</span>
                    </div>

                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-neutral-500">
                      1
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-[76px] border-t border-neutral-800 bg-[#0a0a0a] px-3 py-2 font-mono text-[9px] text-neutral-500">
              {phase === 3 ? (
                <>
                  <div className="text-amber-400">Latexmk: applying pdflatex...</div>
                  <div>Detected edits in proof.tex (lines 15-16)</div>
                  <div>Running pdflatex...</div>
                </>
              ) : phase >= 4 ? (
                <>
                  <div>Latexmk: applying pdflatex...</div>
                  <div>This is pdfTeX, Version 3.14159265</div>
                  <div className="text-emerald-400">Output written on proof.pdf (1 page)</div>
                </>
              ) : (
                <>
                  <div>Latexmk 4.86</div>
                  <div>Rc files read:</div>
                  <div className="text-emerald-400">Watching for file changes...</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-neutral-800 bg-[#0a0a0a] px-4 py-3">
          <span className="rounded-full border border-neutral-700/70 bg-neutral-900/40 px-3 py-1.5 text-xs text-neutral-200">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
            Rho chat reasoning
          </span>
          <span className="rounded-full border border-neutral-700/70 bg-neutral-900/40 px-3 py-1.5 text-xs text-neutral-200">
            <BookOpen className="mr-1 inline h-3.5 w-3.5 text-sky-400" />
            <a
              href={IDEA2STORY_PAPER_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline decoration-sky-700/60 underline-offset-2"
            >
              Idea2Story embeddings retrieval
            </a>
          </span>
          <span className="rounded-full border border-neutral-700/70 bg-neutral-900/40 px-3 py-1.5 text-xs text-neutral-200">
            <FileText className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />
            Rigorous PDF preview
          </span>
          <span className="rounded-full border border-neutral-700/70 bg-neutral-900/40 px-3 py-1.5 text-xs text-neutral-200">
            <Zap className="mr-1 inline h-3.5 w-3.5 text-indigo-400" />
            Auto-recompile checks
          </span>
        </div>
      </div>
    </section>
  );
}
