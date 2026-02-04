"use client";

import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  BookOpen,
  FileText,
  Users,
  Shield,
  GitFork,
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
  Brain,
} from "lucide-react";

// Import REAL components
import { CanvasNodeItem } from "@/components/canvas/CanvasNodeItem";
import { CanvasNode, CanvasEdge } from "@/components/canvas/types";
import { ProofCanvasV2 } from "@/components/canvas/ProofCanvasV2";

// Register GSAP plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================================================
// NAVBAR - Clean, matching dashboard
// ============================================================================

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/95 backdrop-blur-sm border-b border-neutral-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-bold text-xs">
            ρ
          </div>
          <span className="text-base font-semibold text-neutral-900">ProofMesh</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/problems" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors hidden sm:block">
            Problems
          </Link>
          <Link href="/library" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors hidden sm:block">
            Library
          </Link>
          <Link href="/login" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
            Log in
          </Link>
          <Link
            href="/register"
            className="bg-neutral-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// HERO SECTION - Clean, professional
// ============================================================================

function HeroSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial entrance animation
      gsap.fromTo(contentRef.current, 
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.2,
        }
      );

      // Parallax effect with fromTo for bidirectional
      gsap.fromTo(contentRef.current, 
        { y: 0, opacity: 1 },
        {
          y: -60,
          opacity: 0.3,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative min-h-screen pt-14 bg-gradient-to-br from-white via-indigo-50/60 to-purple-50/70">
      {/* Animated gradient blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-400/30 to-purple-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div ref={contentRef} className="relative z-10 max-w-4xl mx-auto px-6 pt-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-neutral-200 shadow-sm mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-neutral-600">Live Demo — Powered by Gemini 3.0</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-neutral-900 mb-6 animate-float">
          Where ideas become
          <br />
          <span className="text-indigo-600">verified proofs</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-neutral-500 max-w-2xl mx-auto mb-10">
          The collaborative workspace for mathematical research.
          Watch the demo below: write in LaTeX, visualize reasoning, verify with Lean 4—all powered by Gemini AI.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors shadow-sm"
          >
            Try Demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/problems"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-neutral-700 font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <Play className="w-4 h-4" />
            Explore Examples
          </Link>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-12 pt-8 border-t border-neutral-200">
          {[
            { value: "2.4k+", label: "Problems" },
            { value: "890+", label: "Verified Proofs" },
            { value: "340+", label: "Researchers" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
              <div className="text-sm text-neutral-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-5 h-8 rounded-full border-2 border-neutral-300 flex items-start justify-center p-1.5">
          <div className="w-1 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
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
              <span className="text-[9px] text-indigo-600 ml-auto font-medium">Gemini 3.0</span>
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
// KNOWLEDGE GRAPH SECTION - Inspired by Idea2Paper
// ============================================================================

function KnowledgeGraphSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeNodes, setActiveNodes] = useState<number>(0);
  const [showPapers, setShowPapers] = useState(false);
  const [showConnection, setShowConnection] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(graphRef.current, { opacity: 0, scale: 0.9 });
      gsap.set(textRefs.current[1], { opacity: 0 });
      gsap.set(textRefs.current[2], { opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "+=2000",
          scrub: 0.5,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            // Animate graph nodes appearing
            if (p < 0.3) {
              setActiveNodes(Math.floor(p / 0.3 * 5));
              setShowPapers(false);
              setShowConnection(false);
            } else if (p >= 0.3 && p < 0.6) {
              setActiveNodes(5);
              setShowPapers(true);
              setShowConnection(false);
            } else if (p >= 0.6) {
              setActiveNodes(5);
              setShowPapers(true);
              setShowConnection(true);
            }
          },
        },
      });

      // Graph appears
      tl.to(graphRef.current, { opacity: 1, scale: 1, duration: 1, ease: "power2.out" })
        .fromTo(textRefs.current[0], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, "<")
        // Text transition 1
        .to(textRefs.current[0], { opacity: 0, duration: 0.3 }, "+=0.5")
        .to(textRefs.current[1], { opacity: 1, y: 0, duration: 0.5 }, "<0.1")
        // Text transition 2
        .to(textRefs.current[1], { opacity: 0, duration: 0.3 }, "+=0.5")
        .to(textRefs.current[2], { opacity: 1, y: 0, duration: 0.5 }, "<0.1");

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const steps = [
    { title: "Mathematical\nKnowledge Graph", sub: "Every concept you explore builds your knowledge base" },
    { title: "Powered by\nResearch", sub: "Connected to 50K+ math papers from arXiv" },
    { title: "Gemini-Powered\nFormalization", sub: "AI guides LaTeX and Lean generation using context" },
  ];

  // Knowledge graph nodes with glow
  const graphNodes = [
    { id: 1, label: "Prime Numbers", x: 30, y: 35, color: "bg-blue-500", glow: "shadow-blue-500/50" },
    { id: 2, label: "Euclid's Lemma", x: 55, y: 20, color: "bg-emerald-500", glow: "shadow-emerald-500/50" },
    { id: 3, label: "Infinitude", x: 70, y: 45, color: "bg-amber-500", glow: "shadow-amber-500/50" },
    { id: 4, label: "Divisibility", x: 50, y: 60, color: "bg-purple-500", glow: "shadow-purple-500/50" },
    { id: 5, label: "Number Theory", x: 20, y: 55, color: "bg-rose-500", glow: "shadow-rose-500/50" },
  ];

  return (
    <section ref={sectionRef} className="relative min-h-screen bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/70 overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-gradient-to-br from-purple-400/25 to-pink-400/25 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-br from-indigo-400/25 to-blue-400/25 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '9s' }} />
      
      {/* Left text column */}
      <div className="absolute left-0 top-0 w-[35%] h-full flex items-center justify-center z-20 pl-12">
        <div className="relative h-44 w-full max-w-[380px]">
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

      {/* Right graph visualization */}
      <div className="absolute right-0 top-0 w-[65%] h-full flex items-center justify-center pr-12">
        <div
          ref={graphRef}
          className="relative w-full max-w-[700px] h-[680px] bg-gradient-to-br from-white via-purple-50/60 to-indigo-50/60 rounded-2xl border border-purple-200/50 shadow-2xl backdrop-blur-sm"
          style={{ opacity: 0 }}
        >
          {/* Graph visualization */}
          <div className="absolute inset-0 p-12 pb-20">
            {/* Connections */}
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {activeNodes >= 2 && (
                <>
                  <line x1="30%" y1="35%" x2="55%" y2="20%" stroke="url(#connectionGradient)" strokeWidth="2" />
                  <line x1="55%" y1="20%" x2="70%" y2="45%" stroke="url(#connectionGradient)" strokeWidth="2" />
                </>
              )}
              {activeNodes >= 4 && (
                <>
                  <line x1="30%" y1="35%" x2="50%" y2="60%" stroke="url(#connectionGradient)" strokeWidth="2" />
                  <line x1="50%" y1="60%" x2="70%" y2="45%" stroke="url(#connectionGradient)" strokeWidth="2" />
                </>
              )}
              {activeNodes >= 5 && (
                <>
                  <line x1="20%" y1="55%" x2="30%" y2="35%" stroke="url(#connectionGradient)" strokeWidth="2" />
                  <line x1="20%" y1="55%" x2="50%" y2="60%" stroke="url(#connectionGradient)" strokeWidth="2" />
                </>
              )}
              {showConnection && (
                <line x1="70%" y1="45%" x2="85%" y2="70%" stroke="#4f46e5" strokeWidth="3" strokeDasharray="6,3" className="animate-pulse" />
              )}
            </svg>

            {/* Nodes */}
            {graphNodes.slice(0, activeNodes).map((node) => (
              <div
                key={node.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-in zoom-in duration-500"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div className={`w-4 h-4 ${node.color} rounded-full shadow-xl ${node.glow} animate-pulse`} style={{ animationDuration: '3s' }} />
                <div className={`absolute inset-0 w-4 h-4 ${node.color} rounded-full blur-sm opacity-50`} />
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs font-medium text-neutral-700 bg-white px-2 py-1 rounded-md shadow-sm">
                    {node.label}
                  </span>
                </div>
              </div>
            ))}

            {/* Papers floating in */}
            {showPapers && (
              <div className="absolute right-4 top-4 space-y-2 animate-in slide-in-from-right duration-500">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-neutral-200 max-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-3 h-3 text-neutral-400" />
                    <span className="text-[10px] text-neutral-400">arXiv:2103.xxxxx</span>
                  </div>
                  <p className="text-xs text-neutral-600 line-clamp-2">Prime number distribution theory</p>
                </div>
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-neutral-200 max-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-3 h-3 text-neutral-400" />
                    <span className="text-[10px] text-neutral-400">arXiv:1905.xxxxx</span>
                  </div>
                  <p className="text-xs text-neutral-600 line-clamp-2">Fundamental theorem of arithmetic</p>
                </div>
              </div>
            )}

            {/* LaTeX connection indicator */}
            {showConnection && (
              <div
                className="absolute z-20 animate-in slide-in-from-bottom duration-500"
                style={{ left: "85%", top: "70%" }}
              >
                <div className="bg-indigo-600 text-white rounded-lg px-4 py-2 shadow-xl ring-1 ring-white/20 flex items-center gap-2 -translate-x-1/2 -translate-y-1/2">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">Informing LaTeX generation...</span>
                </div>
              </div>
            )}
          </div>

          {/* Stats overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-neutral-200 px-4 py-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span className="text-neutral-600">{activeNodes} concepts</span>
                {showPapers && <span className="text-neutral-600">2 papers</span>}
                {showConnection && <span className="text-indigo-600 font-medium">→ LaTeX ready</span>}
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <Brain className="w-3 h-3" />
                <span>Knowledge Graph</span>
              </div>
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
            <p className="text-lg text-neutral-400">Write, compile, and refine your proofs with AI assistance</p>
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
              <div key={item.label} className="flex items-center gap-2 text-neutral-400">
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

// ============================================================================
// AGENTS SECTION
// ============================================================================

function AgentsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Use fromTo with stagger for bidirectional scrolling
      gsap.fromTo(cardsRef.current, 
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            toggleActions: "play none none reverse",
            invalidateOnRefresh: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const agents = [
    {
      name: "Explorer",
      icon: Sparkles,
      color: "bg-amber-100 text-amber-700",
      iconBg: "bg-amber-500",
      desc: "Suggests mathematical directions",
      example: 'Consider using contradiction: assume finitely many primes...',
    },
    {
      name: "Formalizer",
      icon: FileText,
      color: "bg-emerald-100 text-emerald-700",
      iconBg: "bg-emerald-500",
      desc: "Translates to Lean 4 code",
      example: "theorem prime_inf : ∀ n, ∃ p > n, Prime p := by ...",
    },
    {
      name: "Critic",
      icon: Shield,
      color: "bg-red-100 text-red-700",
      iconBg: "bg-red-500",
      desc: "Finds edge cases and gaps",
      example: "Warning: Proof assumes n ≥ 1. Case n = 0 needs handling.",
    },
  ];

  return (
    <section ref={sectionRef} className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">AI agents that think mathematically</h2>
          <p className="text-lg text-neutral-500">Specialized assistants powered by Google Gemini 3.0</p>
          <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium text-indigo-700">Powered by Gemini</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {agents.map((agent, i) => (
            <div
              key={agent.name}
              ref={(el) => { cardsRef.current[i] = el; }}
              className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-shadow"
            >
              <div className={`w-10 h-10 ${agent.iconBg} rounded-lg flex items-center justify-center mb-4`}>
                <agent.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-1">{agent.name}</h3>
              <p className="text-sm text-neutral-500 mb-4">{agent.desc}</p>
              <div className="bg-neutral-50 rounded-lg p-3 text-xs font-mono text-neutral-600 border border-neutral-100">
                {agent.example}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FEATURES GRID
// ============================================================================

function FeaturesGrid() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      featuresRef.current.forEach((el) => {
        gsap.fromTo(el, 
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none reverse",
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const features = [
    { icon: BookOpen, title: "Visual Canvas", desc: "Map proof structure spatially" },
    { icon: CheckCircle2, title: "Lean 4 Verified", desc: "Machine-checked correctness" },
    { icon: Users, title: "Real-time Collab", desc: "Work together seamlessly" },
    { icon: GitFork, title: "Fork & Extend", desc: "Build on others' work" },
    { icon: FileText, title: "LaTeX Native", desc: "Professional typesetting" },
    { icon: Zap, title: "Instant Feedback", desc: "See errors as you type" },
  ];

  return (
    <section ref={sectionRef} className="py-24 bg-neutral-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-3">Everything you need</h2>
          <p className="text-lg text-neutral-500">From napkin sketch to verified theorem</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              ref={(el) => { featuresRef.current[i] = el; }}
              className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-1">{f.title}</h3>
              <p className="text-sm text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CTA
// ============================================================================

function FinalCTA() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(contentRef.current, 
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
            invalidateOnRefresh: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-white border-t border-neutral-100">
      <div ref={contentRef} className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-4">Experience the platform</h2>
        <p className="text-lg text-neutral-500 mb-8">See how ProofMesh transforms mathematical collaboration with AI-powered verification.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Try Interactive Demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="https://github.com/CarmenSalvado/ProofMesh"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-neutral-700 font-medium rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            View on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================

function Footer() {
  return (
    <footer className="py-8 bg-neutral-50 border-t border-neutral-200">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-neutral-900 rounded-lg flex items-center justify-center text-white text-xs font-bold">ρ</div>
          <span className="text-sm text-neutral-500">© 2026 ProofMesh</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-neutral-500">
          <Link href="/docs" className="hover:text-neutral-900 transition-colors">Docs</Link>
          <Link href="/problems" className="hover:text-neutral-900 transition-colors">Problems</Link>
          <Link href="https://github.com/CarmenSalvado/ProofMesh" className="hover:text-neutral-900 transition-colors">GitHub</Link>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 min-h-screen antialiased">
      <Navbar />
      <HeroSection />
      <CanvasShowcase />
      <KnowledgeGraphSection />
      <LatexSection />
      <AgentsSection />
      <FeaturesGrid />
      <FinalCTA />
      <Footer />
    </div>
  );
}
