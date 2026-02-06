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
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=2500",
          scrub: 0.5,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            if (p < 0.15) setPhase(0);
            else if (p < 0.30) setPhase(1);
            else if (p < 0.50) setPhase(2);
            else if (p < 0.60) setPhase(3);
            else setPhase(4);
          },
        },
      });

      tl.fromTo(containerRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 });

    }, sectionRef);

    return () => ctx.revert();
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
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-sm border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border border-neutral-900 bg-neutral-900" />
            <span className="text-sm font-semibold tracking-tight">ProofMesh</span>
          </div>
          <div className="hidden md:flex gap-8">
            <Link href="/methodology" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
              Methodology
            </Link>
            <Link href="/catalog" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
              Problems
            </Link>
            <Link href="/docs" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
              Documentation
            </Link>
          </div>
          <Link href="/register" className="text-xs font-medium border border-neutral-200 px-4 py-2 rounded-md hover:border-neutral-400 transition-colors">
            Request access
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 md:pt-48 md:pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-50 border border-neutral-100 mb-8">
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
              <span className="text-xs font-medium text-neutral-600 tracking-wide uppercase">
                Technical Preview v0.9
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.1] mb-8">
              Infrastructure for rigorous
              <br />
              mathematical collaboration.
            </h1>
            <p className="text-lg md:text-xl text-neutral-500 leading-relaxed max-w-2xl mb-10 font-light">
              A collaborative workspace to accumulate, verify, and attribute formal knowledge.
              Parallel reasoning with explicit provenance and human control.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <Link
                href="/register"
                className="bg-neutral-900 text-white px-6 py-3 rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors inline-flex items-center gap-2"
              >
                Request access
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/docs"
                className="px-6 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                Read the whitepaper
              </Link>
            </div>
          </div>
        </div>
      </section>
      {/* Workspace Preview */}
      <CanvasShowcase />
      <LatexSection />

      {/* Problems / Friction */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="w-10 h-10 border border-neutral-200 rounded flex items-center justify-center mb-6">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium tracking-tight mb-3">Fragmented Knowledge</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Mathematical collaboration is scattered across emails and PDFs. Context is lost, contributions become untraceable.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 border border-neutral-200 rounded flex items-center justify-center mb-6">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium tracking-tight mb-3">Ambiguous Attribution</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Precise authorship often blurs. ProofMesh enforces explicit attribution for every lemma, definition, and proof step.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 border border-neutral-200 rounded flex items-center justify-center mb-6">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium tracking-tight mb-3">Verification Gap</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Informal tools lack structure for objective verification. We treat mathematical objects as database entities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="py-24 px-6 bg-neutral-50 border-y border-neutral-100">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-2xl font-medium tracking-tight mb-4">Core Principles</h2>
          <p className="text-sm text-neutral-500">Built for accuracy, not attention.</p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: "M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11", title: "Human Control", desc: "AI assists with retrieval, but reasoning remains explicitly human-authored." },
            { icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1", title: "Traceability", desc: "Every result carries its full history. Navigate from theorem to axioms." },
            { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", title: "Objective Verification", desc: "Correctness via formal checks or peer review, never by voting." },
            { icon: "M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z", title: "Cumulative", desc: "Solved problems become primitives for future work." },
          ].map((item, i) => (
            <div key={i} className="p-6 border border-neutral-200 rounded-lg bg-white hover:border-neutral-300 transition-colors">
              <div className="mb-4">
                <svg className="w-6 h-6 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
              </div>
              <h4 className="text-sm font-semibold mb-2">{item.title}</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-medium tracking-tight mb-6">
            Accelerate mathematical knowledge.
          </h2>
          <p className="text-neutral-500 mb-10 font-light">
            Join the waitlist to access the infrastructure for the next generation of collaborative reasoning.
          </p>
          <form className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
            <input
              type="email"
              placeholder="work@university.edu"
              className="flex-1 bg-white border border-neutral-200 rounded-md px-4 py-2.5 text-sm outline-none focus:border-neutral-900 transition-colors placeholder:text-neutral-400"
            />
            <button
              type="button"
              className="bg-neutral-900 text-white px-6 py-2.5 rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap"
            >
              Join Waitlist
            </button>
          </form>
          <p className="mt-4 text-xs text-neutral-400">Rolling invites for academic and research institutions.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-100 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-neutral-900 bg-neutral-900" />
            <span className="text-sm font-semibold tracking-tight">ProofMesh</span>
          </div>
          <div className="flex gap-6 text-xs text-neutral-500">
            <Link href="/manifesto" className="hover:text-neutral-900">Manifesto</Link>
            <Link href="/docs" className="hover:text-neutral-900">Documentation</Link>
            <Link href="https://twitter.com" className="hover:text-neutral-900">Twitter/X</Link>
            <Link href="/contact" className="hover:text-neutral-900">Contact</Link>
          </div>
          <div className="text-[10px] text-neutral-400 uppercase tracking-widest">
            © 2025 ProofMesh Labs
          </div>
        </div>
      </footer>
    </div>
  );
}
