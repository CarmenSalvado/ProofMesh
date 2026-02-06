"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  FileText,
  Play,
  Zap,
  Loader2,
  Check,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Send,
  Compass,
  Lightbulb,
  FileCode,
  Plus,
} from "lucide-react";
import { CanvasNode, CanvasEdge } from "@/components/canvas/types";
import { ProofCanvasV2 } from "@/components/canvas/ProofCanvasV2";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================================================
// CANVAS SHOWCASE - Using REAL ProofCanvasV2 component
// ============================================================================

// Mock nodes with the real CanvasNode structure
const DEMO_NODES_INITIAL: CanvasNode[] = [
  {
    id: "def-001",
    type: "DEFINITION",
    title: "Prime Number",
    formula: "$n \\in \\mathbb{N}, n > 1$",
    x: 60,
    y: 50,
    width: 260,
    status: "DRAFT",
    dependencies: [],
  },
  {
    id: "lem-001", 
    type: "LEMMA",
    title: "Euclid's Construction",
    content: "$N = p_1 \\cdot p_2 \\cdots p_n + 1$",
    x: 480,
    y: 50,
    width: 260,
    status: "VERIFIED",
    dependencies: [],
  },
  {
    id: "thm-001",
    type: "THEOREM", 
    title: "Infinitude of Primes",
    formula: "$\\exists^\\infty p : \\text{Prime}(p)$",
    leanCode: "theorem prime_infinite : ∀ n, ∃ p > n, Prime p",
    x: 320,
    y: 320,
    width: 260,
    status: "VERIFIED",
    dependencies: [],
  },
];

// New node that AI suggests
const AI_SUGGESTED_NODE: CanvasNode = {
  id: "lem-002",
  type: "LEMMA",
  title: "Prime Divisor Lemma",
  content: "$N$ has a prime divisor $q \\notin \\{p_1, \\ldots, p_n\\}$",
  x: 20,
  y: 320,
  width: 260,
  status: "PROPOSED",
  dependencies: [],
};

const DEMO_EDGES_INITIAL: CanvasEdge[] = [
  { id: "e1", from: "def-001", to: "thm-001", type: "implies" },
  { id: "e2", from: "lem-001", to: "thm-001", type: "uses" },
];

const AI_SUGGESTED_EDGE: CanvasEdge = { id: "e3", from: "lem-002", to: "thm-001", type: "uses" };

function CanvasShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const aiBarRef = useRef<HTMLDivElement>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [typedText, setTypedText] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showNewNode, setShowNewNode] = useState(false);

  // Dynamic nodes and edges based on AI interaction
  const currentNodes = showNewNode 
    ? [...DEMO_NODES_INITIAL, AI_SUGGESTED_NODE] 
    : DEMO_NODES_INITIAL;
  const currentEdges = showNewNode 
    ? [...DEMO_EDGES_INITIAL, AI_SUGGESTED_EDGE] 
    : DEMO_EDGES_INITIAL;

  const aiPrompt = "Suggest a lemma for Euclid's proof";
  const aiResponse = "Consider showing that N = p₁·p₂···pₙ + 1 must have a prime divisor not in {p₁...pₙ}";

  useEffect(() => {
    let isActive = true;
    const safeSet = (fn: () => void) => {
      if (isActive) fn();
    };

    const ctx = gsap.context(() => {
      const resetStates = () => {
        safeSet(() => {
          setTypedText("");
          setShowThinking(false);
          setShowResponse(false);
          setShowNewNode(false);
        });

        if (canvasRef.current) gsap.set(canvasRef.current, { opacity: 0, y: 30 });
        if (aiBarRef.current) gsap.set(aiBarRef.current, { opacity: 0, y: 20 });
        if (aiResponseRef.current) gsap.set(aiResponseRef.current, { opacity: 0, y: 10, scale: 0.95 });

        const [text0, text1, text2] = textRefs.current;
        if (text0) gsap.set(text0, { opacity: 0, y: 20 });
        if (text1) gsap.set(text1, { opacity: 0, y: 20 });
        if (text2) gsap.set(text2, { opacity: 0, y: 20 });
      };

      resetStates();

      const typing = { progress: 0 };

      const tl = gsap.timeline({ paused: true });

      tl.addLabel("intro")
        .to(canvasRef.current, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" }, "intro")
        .to(textRefs.current[0], { opacity: 1, y: 0, duration: 0.5 }, "intro+=0.1")
        .to(aiBarRef.current, { opacity: 1, y: 0, duration: 0.4 }, "intro+=0.6")
        .addLabel("typing")
        .to(textRefs.current[0], { opacity: 0, duration: 0.25 }, "typing")
        .to(textRefs.current[1], { opacity: 1, y: 0, duration: 0.4 }, "typing+=0.05")
        .to(typing, {
          progress: 1,
          duration: 1.4,
          ease: "none",
          onStart: () => {
            safeSet(() => {
              setShowThinking(false);
              setShowResponse(false);
              setShowNewNode(false);
            });
          },
          onUpdate: () => {
            safeSet(() => {
              const chars = Math.floor(typing.progress * aiPrompt.length);
              setTypedText(aiPrompt.slice(0, chars));
            });
          },
        }, "typing+=0.1")
        .addLabel("thinking")
        .call(() => safeSet(() => {
          setTypedText(aiPrompt);
          setShowThinking(true);
        }), [], "thinking")
        .to({}, { duration: 0.6 })
        .addLabel("response")
        .call(() => safeSet(() => {
          setShowThinking(false);
          setShowResponse(true);
        }), [], "response")
        .to(aiResponseRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.35 }, "response+=0.1")
        .to({}, { duration: 0.8 })
        .addLabel("newNode")
        .call(() => safeSet(() => setShowNewNode(true)), [], "newNode")
        .to(textRefs.current[1], { opacity: 0, duration: 0.25 }, "newNode")
        .to(textRefs.current[2], { opacity: 1, y: 0, duration: 0.4 }, "newNode+=0.05")
        .to({}, { duration: 1.0 });

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 70%",
        onEnter: () => tl.play(0),
        onLeaveBack: () => {
          tl.pause(0);
          resetStates();
        },
      });

    }, sectionRef);

    return () => {
      isActive = false;
      ctx.revert();
    };
  }, []);

  const steps = [
    { title: "Visual Proof\nCanvas", sub: "Map your mathematical reasoning spatially" },
    { title: "AI-Powered\nExploration", sub: "Ask Mesh to suggest lemmas and insights" },
    { title: "Build Your\nProof", sub: "Connect AI suggestions to your work" },
  ];

  // Dummy handlers
  const noop = () => {};

  return (
    <section ref={sectionRef} className="relative min-h-screen bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/40 overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-br from-blue-400/25 to-indigo-400/25 rounded-full blur-3xl" />
      
      {/* Left text column - centered in space */}
      <div className="absolute left-0 top-0 w-[32%] h-full flex items-center justify-center z-20">
        <div className="relative h-44 w-full max-w-[320px]">
          {steps.map((step, i) => (
            <div
              key={i}
              ref={(el) => { textRefs.current[i] = el; }}
              className="absolute inset-0 flex flex-col justify-center"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-neutral-900 mb-4 leading-[1.1] tracking-tight whitespace-pre-line">
                {step.title}
              </h2>
              <p className="text-base md:text-lg text-neutral-500 font-normal leading-relaxed">{step.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right canvas area - using REAL ProofCanvasV2 */}
      <div className="absolute right-0 top-0 w-[70%] h-full flex items-center justify-center pr-6">
        <div
          ref={canvasRef}
          className="relative w-full max-w-[1000px] h-[700px] rounded-2xl border border-neutral-200 shadow-2xl overflow-hidden bg-white"
        >
          <ProofCanvasV2
            nodes={currentNodes}
            edges={currentEdges}
            selectedNodeId={null}
            onNodeSelect={noop}
            readOnly={true}
            hideZoomControls={true}
            hideMinimap={true}
            hideHelpText={true}
            disableInteraction={true}
          />

          {/* Floating AI Bar */}
          <div
            ref={aiBarRef}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-[500px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/10 border border-neutral-200 z-40"
            style={{ opacity: 0 }}
          >
            {/* Main Input */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0" />
              <div className="flex-1 text-sm text-neutral-800 min-h-[20px]">
                {typedText || <span className="text-neutral-400">Ask Mesh AI...</span>}
                {typedText && typedText.length < aiPrompt.length && (
                  <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse" />
                )}
              </div>
              {showThinking ? (
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-neutral-400" />
              )}
            </div>
            {/* Quick Actions */}
            <div className="flex items-center gap-2 px-4 py-2 border-t border-neutral-100 bg-neutral-50/50 rounded-b-2xl">
              <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full">
                <Compass className="w-3 h-3" />
                Explore
              </button>
              <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-500 rounded-full">
                <Lightbulb className="w-3 h-3" />
                Insight
              </button>
              <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-500 rounded-full">
                <FileCode className="w-3 h-3" />
                Formalize
              </button>
            </div>
          </div>

          {/* AI Response Bubble */}
          <div
            ref={aiResponseRef}
            className="absolute bottom-28 right-6 w-72 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl shadow-black/10 border border-neutral-200 overflow-hidden z-40"
            style={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium text-neutral-700">Mesh AI</span>
              <span className="text-[9px] text-indigo-600 ml-auto font-medium">Rho</span>
              <span className="text-[10px] text-emerald-500">Suggestion</span>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-xs text-neutral-600 leading-relaxed">
                {showResponse ? aiResponse : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-neutral-50/50">
              <button className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded-full">
                <Plus className="w-3 h-3" />
                Add as Lemma
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


// ============================================================================
// LATEX + AI SECTION - Lab-style with floating chat and PDF preview
// ============================================================================

function LatexSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0); // 0: typing, 1: thinking, 2: response, 3: compiling, 4: compiled

  useEffect(() => {
    let isActive = true;
    const safeSet = (fn: () => void) => {
      if (isActive) fn();
    };

    const ctx = gsap.context(() => {
      const resetStates = () => {
        safeSet(() => setPhase(0));
        if (containerRef.current) gsap.set(containerRef.current, { opacity: 0, y: 40 });
      };

      resetStates();

      const tl = gsap.timeline({ paused: true });
      tl.to(containerRef.current, { opacity: 1, y: 0, duration: 0.9, ease: "power2.out" })
        .to({}, { duration: 0.6 })
        .call(() => safeSet(() => setPhase(1)))
        .to({}, { duration: 0.7 })
        .call(() => safeSet(() => setPhase(2)))
        .to({}, { duration: 0.8 })
        .call(() => safeSet(() => setPhase(3)))
        .to({}, { duration: 0.9 })
        .call(() => safeSet(() => setPhase(4)))
        .to({}, { duration: 0.8 });

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 70%",
        onEnter: () => tl.play(0),
        onLeaveBack: () => {
          tl.pause(0);
          resetStates();
        },
      });

    }, sectionRef);

    return () => {
      isActive = false;
      ctx.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} className="min-h-screen bg-gradient-to-br from-neutral-900 via-emerald-900/40 to-teal-900/30">
      {/* Decorative gradient orb */}
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 rounded-full blur-3xl" />
      
      <div ref={containerRef} className="h-screen flex items-center justify-center px-8" style={{ opacity: 0 }}>
        <div className="max-w-7xl w-full">
          {/* Section header */}
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">AI-Powered LaTeX Lab</h2>
            <p className="text-lg text-neutral-200">Write, compile, and refine your proofs with AI assistance</p>
          </div>

          {/* Main layout: Sidebar + Editor + PDF Preview */}
          <div className="flex gap-0 h-[580px] rounded-xl overflow-hidden border border-neutral-800 shadow-2xl">
            
            {/* Mini Sidebar */}
            <div className="w-[140px] bg-[#0a0a0a] border-r border-neutral-800 flex flex-col">
              <div className="px-3 py-2 border-b border-neutral-800">
                <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Files</span>
              </div>
              <div className="flex-1 p-2 space-y-1">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800/50 rounded text-neutral-200">
                  <FileText className="w-3 h-3 text-indigo-400" />
                  <span className="text-[11px] font-mono truncate">proof.tex</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 text-neutral-500 hover:bg-neutral-800/30 rounded cursor-pointer">
                  <FileText className="w-3 h-3" />
                  <span className="text-[11px] font-mono truncate">refs.bib</span>
                </div>
              </div>
              <div className="p-2 border-t border-neutral-800">
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Auto-compile</span>
                </div>
              </div>
            </div>

            {/* Editor with floating chat */}
            <div className="flex-1 bg-[#0d0d0d] flex flex-col min-w-0 relative">
              {/* Editor header - tab bar */}
              <div className="flex items-center justify-between px-2 py-1.5 bg-[#151515] border-b border-neutral-800">
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d0d] rounded-t border-b-2 border-amber-500">
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] text-neutral-200 font-mono">proof.tex</span>
                    <span className="text-neutral-600 text-[10px]">×</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {phase === 3 ? (
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[10px]">Compiling...</span>
                    </div>
                  ) : phase >= 4 ? (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-[10px]">Compiled</span>
                    </div>
                  ) : (
                    <button className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium rounded transition-colors">
                      <Play className="w-3 h-3" />
                      Compile
                    </button>
                  )}
                </div>
              </div>

              {/* Editor content */}
              <div className="flex-1 p-5 font-mono text-[11px] leading-5 text-neutral-300 overflow-hidden bg-[#0d0d0d]">
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">1</span><span className="text-emerald-500/80">% Infinitude of Primes</span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">2</span><span><span className="text-rose-400">\documentclass</span><span className="text-amber-300">[12pt]</span><span className="text-sky-300">{"{"}article{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">3</span><span><span className="text-rose-400">\usepackage</span><span className="text-sky-300">{"{"}amsthm, amsmath{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">4</span><span><span className="text-rose-400">\newtheorem</span><span className="text-sky-300">{"{"}theorem{"}"}{"{"}Theorem{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">5</span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">6</span><span><span className="text-rose-400">\begin</span><span className="text-sky-300">{"{"}document{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">7</span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">8</span><span><span className="text-rose-400">\begin</span><span className="text-sky-300">{"{"}theorem{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">9</span><span className="text-neutral-200 pl-4">There are infinitely many prime numbers.</span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">10</span><span><span className="text-rose-400">\end</span><span className="text-sky-300">{"{"}theorem{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">11</span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">12</span><span><span className="text-rose-400">\begin</span><span className="text-sky-300">{"{"}proof{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">13</span><span className="text-neutral-200 pl-4">Assume <span className="text-violet-400">$p_1, p_2, \ldots, p_n$</span> are all primes.</span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">14</span><span className="text-neutral-200 pl-4">Consider <span className="text-violet-400">$N = p_1 \cdot p_2 \cdots p_n + 1$</span>.</span></div>
                
                {/* AI-added lines */}
                {phase >= 3 && (
                  <>
                    <div className="flex bg-emerald-500/10 border-l-2 border-emerald-400 py-0.5">
                      <span className="text-emerald-500 w-8 text-right pr-4 select-none">15</span>
                      <span className="text-emerald-100 pl-4">Since <span className="text-violet-400">$N \equiv 1 \pmod{"{"}p_i{"}"}$</span>, no <span className="text-violet-400">$p_i$</span> divides <span className="text-violet-400">$N$</span>.</span>
                    </div>
                    <div className="flex bg-emerald-500/10 border-l-2 border-emerald-400 py-0.5">
                      <span className="text-emerald-500 w-8 text-right pr-4 select-none">16</span>
                      <span className="text-emerald-100 pl-4">Hence <span className="text-violet-400">$N$</span> has a prime factor outside our list. <span className="text-violet-400">$\blacksquare$</span></span>
                    </div>
                  </>
                )}
                
                {phase < 3 && (
                  <div className="flex bg-indigo-500/10 border-l-2 border-indigo-400 py-0.5">
                    <span className="text-neutral-600 w-8 text-right pr-4 select-none">15</span>
                    <span className="text-neutral-400 pl-4"><span className="inline-block w-0.5 h-3 bg-indigo-400 animate-pulse" /></span>
                  </div>
                )}
                
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">{phase >= 3 ? '17' : '16'}</span><span><span className="text-rose-400">\end</span><span className="text-sky-300">{"{"}proof{"}"}</span></span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">{phase >= 3 ? '18' : '17'}</span></div>
                <div className="flex hover:bg-neutral-800/30 py-0.5"><span className="text-neutral-600 w-8 text-right pr-4 select-none">{phase >= 3 ? '19' : '18'}</span><span><span className="text-rose-400">\end</span><span className="text-sky-300">{"{"}document{"}"}</span></span></div>
              </div>

              {/* FLOATING CHAT - positioned at bottom of editor */}
              <div className={`absolute bottom-4 left-4 right-4 transition-all duration-500 ${phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="bg-[#09090b] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
                  {/* Chat messages area */}
                  {phase >= 1 && (
                    <div className="max-h-[200px] overflow-y-auto p-3 space-y-3">
                      {/* User message */}
                      <div className="flex justify-end">
                        <div className="max-w-[70%] bg-neutral-800 rounded-xl rounded-tr-sm px-3 py-2 text-xs text-neutral-200">
                          Complete the proof using Euclid&apos;s argument
                        </div>
                      </div>
                      
                      {/* AI thinking */}
                      {phase === 1 && (
                        <div className="flex gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                          </div>
                          <div className="flex items-center gap-2 text-neutral-400 text-xs">
                            <span>Thinking</span>
                            <div className="flex gap-0.5">
                              <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* AI response */}
                      {phase >= 2 && (
                        <div className="flex gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                          </div>
                          <div className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-xl rounded-tl-sm px-3 py-2">
                            <p className="text-xs text-neutral-300">Adding the contradiction argument...</p>
                            {phase === 2 && (
                              <div className="mt-2 flex gap-2">
                                <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium rounded-lg transition-colors">
                                  <Check className="w-3 h-3" />
                                  Accept
                                </button>
                                <button className="px-2 py-1.5 text-neutral-500 text-[10px] rounded-lg hover:bg-neutral-800">
                                  <XIcon className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {phase === 3 && (
                              <div className="mt-2 flex items-center gap-1.5 text-amber-400 text-[10px]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Applied • Recompiling PDF...</span>
                              </div>
                            )}
                            {phase >= 4 && (
                              <div className="mt-2 flex items-center gap-1.5 text-emerald-400 text-[10px]">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Applied • PDF updated</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Input area - like real lab */}
                  <div className="border-t border-neutral-800 p-3">
                    {/* File attachment badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800 rounded text-neutral-400">
                        <FileText className="w-3 h-3" />
                        <span className="text-[10px]">proof.tex</span>
                      </div>
                    </div>
                    
                    {/* Input with mode toggle */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 text-xs text-neutral-500 py-2">
                        {phase === 0 ? (
                          <span>Complete the proof using Euclid&apos;s argument<span className="animate-pulse">|</span></span>
                        ) : (
                          <span className="text-neutral-600">Ask anything...</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Bottom controls */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 p-0.5 bg-neutral-900 rounded-lg">
                        <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 rounded-md text-white">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span className="text-[10px]">Flash</span>
                        </button>
                        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-neutral-500 rounded-md hover:bg-neutral-800">
                          <Sparkles className="w-3 h-3" />
                          <span className="text-[10px]">Thinking</span>
                        </button>
                      </div>
                      <button className="p-2 bg-neutral-100 hover:bg-white text-neutral-900 rounded-lg transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-neutral-800" />

            {/* Right side - PDF Preview */}
            <div className="w-[380px] bg-[#0d0d0d] flex flex-col">
              {/* Preview header with controls */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#151515] border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400">Preview</span>
                  <span className="text-neutral-700">•</span>
                  <span className="text-[10px] text-neutral-500">click to jump to code</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-neutral-500">
                    <button className="p-1 hover:bg-neutral-800 rounded"><ChevronLeft className="w-3 h-3" /></button>
                    <span className="text-[10px]">1 / 1</span>
                    <button className="p-1 hover:bg-neutral-800 rounded"><ChevronRight className="w-3 h-3" /></button>
                  </div>
                  <div className="w-px h-4 bg-neutral-700" />
                  <div className="flex items-center gap-1 text-neutral-500">
                    <button className="p-1 hover:bg-neutral-800 rounded"><ZoomOut className="w-3 h-3" /></button>
                    <span className="text-[10px]">100%</span>
                    <button className="p-1 hover:bg-neutral-800 rounded"><ZoomIn className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
              
              {/* PDF content mockup */}
              <div className="flex-1 p-3 flex items-start justify-center overflow-hidden bg-neutral-800/20 relative">
                {/* Compiling overlay */}
                {phase === 3 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/30 z-10">
                    <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 rounded-lg">
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                      <span className="text-xs text-neutral-200">Compiling...</span>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded shadow-xl w-full max-w-[320px]">
                  {/* PDF page with proper margins */}
                  <div className="p-8">
                    {/* Title */}
                    <h3 className="text-base font-serif font-bold text-neutral-900 text-center mb-1">Infinitude of Primes</h3>
                    <p className="text-[9px] text-neutral-500 text-center mb-6">A Classical Result by Euclid</p>
                    
                    {/* Theorem box */}
                    <div className="mb-5 p-3 bg-neutral-50 border border-neutral-200 rounded">
                      <p className="text-[11px] text-neutral-900 mb-1"><span className="font-bold">Theorem 1.</span> <span className="italic">There are infinitely many prime numbers.</span></p>
                    </div>
                    
                    {/* Proof - fixed height container */}
                    <div className="text-[11px] text-neutral-800 leading-relaxed space-y-2">
                      <p><span className="italic">Proof.</span> Assume p₁, p₂, …, pₙ represent all prime numbers. Define</p>
                      <p className="text-center py-1 font-mono text-[10px]">N = p₁ · p₂ · … · pₙ + 1</p>
                      
                      {/* Content - always same space reserved */}
                      <div className="min-h-[52px]">
                        <div className={`space-y-2 transition-opacity duration-500 ${phase >= 3 ? 'opacity-100 border-l-2 border-emerald-500 pl-2 bg-emerald-50 py-1' : 'opacity-0'}`}>
                          <p>Since N ≡ 1 (mod pᵢ) for all i, no pᵢ divides N.</p>
                          <p>Therefore, N must have a prime factor not in our list, which is a contradiction. ∎</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Page number */}
                  <div className="text-center pb-3 text-[9px] text-neutral-400">1</div>
                </div>
              </div>
              
              {/* Compiler log */}
              <div className="border-t border-neutral-800">
                <div className="flex items-center justify-between px-3 py-1 bg-[#0a0a0a]">
                  <span className="text-[10px] text-neutral-500">Compiler log</span>
                  <span className="text-[10px] text-neutral-600">Collapse</span>
                </div>
                <div className="h-[60px] px-3 py-2 font-mono text-[9px] text-neutral-500 overflow-hidden bg-[#0a0a0a]">
                  {phase === 3 ? (
                    <>
                      <div className="text-amber-400">Latexmk: applying rule &apos;pdflatex&apos;...</div>
                      <div>This is pdfTeX, Version 3.14159265</div>
                      <div className="animate-pulse">Running pdflatex...</div>
                    </>
                  ) : phase >= 4 ? (
                    <>
                      <div>Latexmk: applying rule &apos;pdflatex&apos;...</div>
                      <div>This is pdfTeX, Version 3.14159265</div>
                      <div className="text-emerald-400">Output written on proof.pdf (1 page)</div>
                    </>
                  ) : (
                    <>
                      <div>Rc files read:</div>
                      <div>Latexmk: This is Latexmk, Version 4.86</div>
                      <div className="text-emerald-400">Watching for file changes...</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="flex justify-center gap-8 mt-6">
            {[
              { icon: Sparkles, label: "AI suggestions", color: "text-amber-400" },
              { icon: FileText, label: "Live PDF preview", color: "text-emerald-400" },
              { icon: Zap, label: "Auto-recompile", color: "text-indigo-400" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-neutral-200 px-3 py-1.5 rounded-full bg-neutral-900/40 border border-neutral-700/70 backdrop-blur-sm"
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-neutral-900 rounded-sm" />
            <span className="text-sm font-semibold tracking-tight">ProofMesh</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-neutral-600">
            <Link href="#methodology" className="hover:text-neutral-900 transition-colors">
              Methodology
            </Link>
            <Link href="#community" className="hover:text-neutral-900 transition-colors">
              Community
            </Link>
            <Link href="#pricing" className="hover:text-neutral-900 transition-colors">
              Pricing
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
              Log in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-neutral-900 text-white text-xs font-medium rounded-full hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-500/10"
            >
              Start Proving
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-white -z-10" />
        <div className="absolute inset-0 bg-grid-dots opacity-60 -z-10 mask-gradient-b" />

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          {/* Social Proof Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-neutral-200 shadow-sm mb-6 animate-float">
            <div className="flex -space-x-1.5">
              <div className="w-5 h-5 rounded-full border border-white bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700">
                AL
              </div>
              <div className="w-5 h-5 rounded-full border border-white bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-700">
                JK
              </div>
              <div className="w-5 h-5 rounded-full border border-white bg-amber-100 flex items-center justify-center text-[8px] font-bold text-amber-700">
                MP
              </div>
            </div>
            <span className="text-[10px] font-medium text-neutral-500">
              Joined by 12,000+ researchers
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-neutral-900 mb-6 leading-[1.1]">
            Prove complex theorems,
            <br />
            <span className="text-neutral-400">together.</span>
          </h1>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            The infinite canvas for collaborative logic. Connect nodes, verify lemmas, and solve
            problems in real-time with your team or the global community.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-6 py-3 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-900/10 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
              Create Team Workspace
            </Link>
            <button className="px-6 py-3 bg-white text-neutral-700 text-sm font-medium rounded-lg border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all flex items-center gap-2">
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                />
              </svg>
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      <CanvasShowcase />
      <LatexSection />

      {/* Interactive Mockup Section */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="relative rounded-xl border border-neutral-200 bg-white shadow-[0_30px_60px_-10px_rgba(0,0,0,0.08)] overflow-hidden h-[500px]">
          {/* Mockup Toolbar */}
          <div className="h-12 border-b border-neutral-100 flex items-center justify-between px-4 bg-neutral-50/50">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/20 border border-red-400/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/20 border border-amber-400/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/20 border border-emerald-400/50" />
              </div>
            </div>
            <div className="flex -space-x-2">
              <div
                className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] text-indigo-700 font-bold z-30"
                title="You"
              >
                me
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-orange-100 flex items-center justify-center text-[10px] text-orange-700 font-bold z-20 grayscale hover:grayscale-0 transition-all">
                SJ
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-emerald-100 flex items-center justify-center text-[10px] text-emerald-700 font-bold z-10 grayscale hover:grayscale-0 transition-all">
                DM
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-500 font-bold z-0">
                +4
              </div>
            </div>
          </div>

          {/* Mockup Canvas */}
          <div className="relative h-full bg-grid-dots">
            {/* SVG Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <path
                d="M 400 150 C 400 250, 250 250, 250 350"
                stroke="#e5e5e5"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M 400 150 C 400 250, 550 250, 550 350"
                stroke="#e5e5e5"
                strokeWidth="2"
                fill="none"
              />
            </svg>

            {/* Central Node */}
            <div className="absolute top-[100px] left-[320px] w-64 bg-white rounded-lg border border-neutral-200 shadow-lg p-3 z-10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
                  Theorem 4.2
                </span>
                <svg
                  className="w-4 h-4 text-neutral-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                  />
                </svg>
              </div>
              <div className="h-2 w-3/4 bg-neutral-100 rounded mb-1.5" />
              <div className="h-2 w-full bg-neutral-100 rounded mb-1.5" />
            </div>

            {/* Left Branch (Collaborator A) */}
            <div className="absolute top-[350px] left-[150px] w-56 bg-white rounded-lg border border-orange-200 ring-2 ring-orange-100 shadow-sm p-3 z-10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">
                  Counter-Example
                </span>
                <div className="w-2 h-2 rounded-full bg-orange-500" />
              </div>
              <p className="font-mono text-[10px] text-neutral-500">
                Valid only for n &gt; 2
              </p>

              {/* Live Typing Indicator */}
              <div className="absolute -bottom-8 left-0 flex items-center gap-2 bg-orange-600 text-white text-[10px] px-2 py-1 rounded-full rounded-tl-none">
                <span>Sarah is typing...</span>
              </div>
            </div>

            {/* Right Branch (Locked) */}
            <div className="absolute top-[350px] left-[500px] w-56 bg-neutral-50 rounded-lg border border-neutral-200 shadow-sm p-3 opacity-60 z-10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                  Lemma B
                </span>
                <svg
                  className="w-4 h-4 text-neutral-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <div className="h-2 w-1/2 bg-neutral-200 rounded" />
            </div>

            {/* Fake Cursor 1 */}
            <div className="absolute top-[380px] left-[220px] z-50 pointer-events-none animate-cursor-move">
              <svg className="w-5 h-5 text-orange-600 drop-shadow-md -rotate-12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87a.5.5 0 00.35-.85L6.35 2.86a.5.5 0 00-.85.35z" />
              </svg>
              <div className="ml-3 px-1.5 py-0.5 bg-orange-600 text-white text-[9px] font-bold rounded">
                Sarah
              </div>
            </div>

            {/* Fake Cursor 2 */}
            <div className="absolute top-[120px] left-[560px] z-50 pointer-events-none animate-float">
              <svg className="w-5 h-5 text-emerald-600 drop-shadow-md -rotate-12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87a.5.5 0 00.35-.85L6.35 2.86a.5.5 0 00-.85.35z" />
              </svg>
              <div className="ml-3 px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded">
                David
              </div>
            </div>

            {/* Context Menu Mockup */}
            <div className="absolute top-[140px] left-[580px] w-32 bg-white rounded border border-neutral-100 shadow-xl py-1 z-40 animate-float">
              <div className="px-3 py-1.5 text-[10px] hover:bg-neutral-50 flex items-center gap-2 text-neutral-600">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                Edit Node
              </div>
              <div className="px-3 py-1.5 text-[10px] hover:bg-neutral-50 flex items-center gap-2 text-neutral-600">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                Add Comment
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Features Grid */}
      <section id="methodology" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-3">
            Designed for collective intelligence
          </h2>
          <p className="text-neutral-500">
            From async code reviews to live brainstorming, ProofMesh adapts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="group p-6 rounded-2xl bg-neutral-50 hover:bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Live Multiplayer</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              See your team&apos;s cursors in real-time. Follow a presenter or work independently on
              the same infinite canvas without conflicts.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group p-6 rounded-2xl bg-neutral-50 hover:bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Branching Logic</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Propose changes in a separate branch. Merge proven lemmas back to the main theorem
              only when the team approves.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group p-6 rounded-2xl bg-neutral-50 hover:bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Contextual Discussion</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Leave LaTeX-supported comments directly on nodes or connections. Resolve threads as
              you debug the logic.
            </p>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="border-y border-neutral-100 bg-gradient-to-b from-indigo-50/30 to-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium mb-4">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              AI-Powered
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-3">
              Intelligent agents that accelerate discovery
            </h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">
              Our AI agents work alongside you—proposing lemmas, verifying proofs, and finding gaps
              in your reasoning—while you maintain full control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-all">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-purple-100 text-purple-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">Explorer</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">Proposes new lemmas and research directions based on your current work.</p>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-all">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-emerald-100 text-emerald-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">Verifier</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">Runs formal checks on your proofs and flags potential contradictions.</p>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-all">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-amber-100 text-amber-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">Archivist</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">Summarizes complex proofs and maintains your knowledge library.</p>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-all">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-red-100 text-red-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">Skeptic</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">Challenges your assumptions and highlights gaps in reasoning.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Review / Collaboration Snippet */}
      <section id="community" className="py-20">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs uppercase tracking-wider">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              Peer Review Built-in
            </div>
            <h3 className="text-2xl font-semibold text-neutral-900">
              &quot;It&apos;s like GitHub for Theorems.&quot;
            </h3>
            <p className="text-neutral-500 text-sm leading-relaxed">
              ProofMesh changed how our department handles collaborative research. We no longer send
              PDFs back and forth. We just share a link, and the entire derivation history is
              visible, editable, and discussable.
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700">
                ER
              </div>
              <div>
                <div className="text-sm font-medium text-neutral-900">Dr. Elena Rostova</div>
                <div className="text-xs text-neutral-400">Institute of Applied Mathematics</div>
              </div>
            </div>
          </div>

          {/* Visual Card: Comment Thread */}
          <div className="flex-1 w-full max-w-sm bg-white rounded-xl border border-neutral-200 shadow-xl p-4 relative">
            {/* Thread Item 1 */}
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                ER
              </div>
              <div className="bg-neutral-50 p-3 rounded-lg rounded-tl-none border border-neutral-100 text-xs text-neutral-600">
                <span className="font-semibold text-neutral-900 block mb-1">Elena</span>
                Check the boundary condition on node 3. I think we missed the edge case where k=0.
              </div>
            </div>
            {/* Thread Item 2 */}
            <div className="flex gap-3 justify-end">
              <div className="bg-indigo-600 p-3 rounded-lg rounded-tr-none text-xs text-white shadow-md">
                <span className="font-semibold text-white block mb-1">You</span>
                Good catch! I&apos;ve created a sub-branch to patch that definition.
              </div>
              <div className="w-8 h-8 rounded-full bg-neutral-900 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white">
                Me
              </div>
            </div>
            {/* Input */}
            <div className="mt-4 pt-3 border-t border-neutral-100 flex gap-2">
              <input
                type="text"
                placeholder="Reply..."
                className="w-full text-xs bg-transparent border-none focus:outline-none focus:ring-0 text-neutral-600 p-0"
              />
              <button className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center bg-neutral-900 text-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight mb-6">
            Accelerate mathematical knowledge.
          </h2>
          <p className="text-neutral-400 mb-10 font-light">
            Join thousands of researchers already using ProofMesh to collaborate on proofs, verify
            conjectures, and build the future of mathematics.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-white text-neutral-900 px-8 py-3 rounded-full text-sm font-medium hover:bg-neutral-100 transition-colors inline-flex items-center gap-2 justify-center"
            >
              Get Started Free
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/catalog"
              className="border border-neutral-700 text-white px-8 py-3 rounded-full text-sm font-medium hover:border-neutral-500 transition-colors"
            >
              Browse Problems
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 border-t border-neutral-800 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white rounded-sm" />
            <span className="text-sm font-semibold text-white">ProofMesh</span>
          </div>
          <div className="flex gap-6 text-xs text-neutral-500">
            <Link href="/privacy" className="hover:text-neutral-300">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-neutral-300">
              Terms
            </Link>
            <a href="https://twitter.com" className="hover:text-neutral-300">
              Twitter
            </a>
            <a href="https://github.com" className="hover:text-neutral-300">
              GitHub
            </a>
          </div>
          <div className="text-[10px] text-neutral-600">© 2026 ProofMesh Inc.</div>
        </div>
      </footer>
    </div>
  );
}
