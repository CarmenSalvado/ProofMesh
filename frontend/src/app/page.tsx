import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LandingCanvasPanel } from "@/components/landing/LandingCanvasPanel";
import { LandingLatexPanel } from "@/components/landing/LandingLatexPanel";
import { LandingSocialPanel } from "@/components/landing/LandingSocialPanel";

const HACKATHON_DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=YOUR_DEMO_VIDEO_ID";
const IDEA2STORY_PAPER_URL = "https://arxiv.org/abs/2601.20833";

const RHO_MODE_ROUTING = [
  { mode: "Explorer", purpose: "Rapid discovery, brainstorming, and scoping", model: "Gemini 3 Flash", agents: "Explorer personality + retrieval", tone: "blue" },
  { mode: "Formalize", purpose: "Convert ideas into precise statements and specs", model: "Gemini 3 Pro", agents: "Formalizer + Lean interface", tone: "emerald" },
  { mode: "Verify", purpose: "Proof checking and counterexample search", model: "Gemini 3 Pro", agents: "Verifier + Lean Runner", tone: "violet" },
  { mode: "Critic", purpose: "Stress-test arguments and edge cases", model: "Gemini 3 Flash", agents: "Skeptic personality", tone: "amber" },
  { mode: "Compute", purpose: "Tool-augmented calculation and structured outputs", model: "Gemini 3 Flash", agents: "Compute agent + library", tone: "cyan" },
  { mode: "Strategist", purpose: "Multi-step planning and decomposition", model: "Gemini 3 Pro", agents: "Orchestrator + planner", tone: "rose" },
  { mode: "Socratic", purpose: "Guided questioning for learning and teaching", model: "Gemini 3 Flash", agents: "Tutor personality", tone: "slate" },
];

const modeToneClasses: Record<string, string> = {
  blue: "bg-blue-600/10 text-blue-700 border-blue-600/20",
  emerald: "bg-emerald-600/10 text-emerald-700 border-emerald-600/20",
  violet: "bg-violet-600/10 text-violet-700 border-violet-600/20",
  amber: "bg-amber-600/10 text-amber-800 border-amber-600/20",
  cyan: "bg-cyan-600/10 text-cyan-800 border-cyan-600/20",
  rose: "bg-rose-600/10 text-rose-800 border-rose-600/20",
  slate: "bg-slate-600/10 text-slate-800 border-slate-600/20",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={20} />
            <span className="text-sm font-semibold tracking-tight">ProofMesh</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-neutral-600">
            <Link href="#methodology" className="hover:text-neutral-900 transition-colors">
              Rigor
            </Link>
            <Link href="#community" className="hover:text-neutral-900 transition-colors">
              Social
            </Link>
            <Link href="#community-story" className="hover:text-neutral-900 transition-colors">
              Explore
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
              Built for collaborative mathematical research and theorem proving
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-neutral-900 mb-6 leading-[1.1]">
            Do serious mathematics.
            <br />
            <span className="text-neutral-400">Prove together, verify fast.</span>
          </h1>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            ProofMesh is a collaborative workspace for mathematical proofs: teams explore ideas in shared threads,
            challenge assumptions in context, and validate results with{" "}
            <span className="rho-mention">@Rho</span>. Meanwhile, {" "}
            <a
              href={IDEA2STORY_PAPER_URL}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 underline decoration-indigo-300 underline-offset-2"
            >
              Idea2Story
            </a>{" "}
            embeddings keep every suggestion grounded in the right theorem context.
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
              Start Proving Together
            </Link>
            <a
              href={HACKATHON_DEMO_VIDEO_URL}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-white text-neutral-700 text-sm font-medium rounded-lg border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all flex items-center gap-2"
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
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                />
              </svg>
              Watch Demo
            </a>
          </div>
        </div>
      </section>

      {/* Interactive Mockup Section */}
      <section className="max-w-[1320px] mx-auto px-4 pb-24">
        <div className="relative rounded-xl border border-neutral-200 bg-white shadow-[0_30px_60px_-10px_rgba(0,0,0,0.08)] overflow-hidden h-[700px] md:h-[790px]">
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
          <div className="relative h-[calc(100%-3rem)]">
            <LandingCanvasPanel />
          </div>
        </div>
      </section>

      {/* LaTeX Editor Animation */}
      <section className="max-w-[1320px] mx-auto px-4 pb-24">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-2">
            Collaborative LaTeX, built for proof teams
          </h2>
          <p className="text-neutral-500">
            Write together, review in context, and keep every compiled revision aligned with formal reasoning.
          </p>
        </div>
        <LandingLatexPanel />
      </section>

      <LandingSocialPanel />

      {/* Social Features Grid */}
      <section id="methodology" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-3">
            One workflow from conjecture to verified proof
          </h2>
          <p className="text-neutral-500">
            Brainstorm, branch, critique, and verify in one auditable workspace for mathematics.
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
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Real-time Co-Exploration</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Collaborate live on the same proof graph, with shared intent and clear ownership of each step.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group p-6 rounded-2xl bg-neutral-50 hover:bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Exploration Branches</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Test bold lines of attack in branches, compare alternatives, and merge only what survives verification.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group p-6 rounded-2xl bg-neutral-50 hover:bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-lg transition-all duration-300">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Contextual Social Review</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Debate assumptions directly on nodes and edges, resolve threads in context, and preserve the reasoning trail.
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
              Rho Stack
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-3">
              Meet <span className="rho-mention">@Rho</span>, your proof copilot
            </h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">
              Ask for critique, formalization, or verification without breaking the flow of mathematical discussion.
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-cyan-50 p-5 md:p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-semibold">@</div>
              <h3 className="text-base font-semibold text-neutral-900">What is Rho?</h3>
            </div>
            <p className="text-sm text-neutral-700 mb-3">
              Rho is the orchestration layer that keeps mathematical context intact while helping your team think,
              formalize, and verify in one place.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-indigo-200 bg-white/80 px-2.5 py-1 text-indigo-700">plays skeptic on demand</span>
              <span className="rounded-full border border-indigo-200 bg-white/80 px-2.5 py-1 text-indigo-700">keeps theorem context loaded</span>
              <span className="rounded-full border border-indigo-200 bg-white/80 px-2.5 py-1 text-indigo-700">bridges chat to formal checks</span>
            </div>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold tracking-tight text-neutral-900 mb-2">
              Technical routing behind Rho
            </h3>
            <p className="text-neutral-500 max-w-2xl mx-auto">
              Rho routes each request through the right model and toolchain, while{" "}
              <a
                href={IDEA2STORY_PAPER_URL}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 underline decoration-indigo-300 underline-offset-2"
              >
                Idea2Story
              </a>{" "}
              embeddings supply grounding context from nodes, discussions, and library items before formal checks run.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 md:p-6 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center text-[11px] font-semibold">ρ</div>
              <h3 className="text-base font-semibold text-neutral-900">How Rho works</h3>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              Rho selects the right reasoning mode, retrieves relevant context, and balances Gemini 3 Flash and Gemini 3 Pro
              for speed or depth based on the task.
            </p>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 mb-4">
              <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] text-xs">
                <div className="rounded-lg border border-neutral-200 bg-white p-2.5 font-medium text-neutral-800">Mode</div>
                <div className="hidden md:flex items-center justify-center text-neutral-400">→</div>
                <div className="rounded-lg border border-neutral-200 bg-white p-2.5 font-medium text-neutral-800">Router</div>
                <div className="hidden md:flex items-center justify-center text-neutral-400">→</div>
                <div className="rounded-lg border border-neutral-200 bg-white p-2.5 font-medium text-neutral-800">Gemini 3 Flash/Pro</div>
                <div className="hidden md:flex items-center justify-center text-neutral-400">→</div>
                <div className="rounded-lg border border-neutral-200 bg-white p-2.5 font-medium text-neutral-800">Embeddings + Lean</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-neutral-200 p-3">
                <p className="text-xs font-semibold text-neutral-700 mb-2">Fast modes (Gemini 3 Flash)</p>
                <div className="flex flex-wrap gap-2">
                  {RHO_MODE_ROUTING.filter((row) => row.model === "Gemini 3 Flash").map((row) => (
                    <span key={row.mode} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${modeToneClasses[row.tone]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {row.mode}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 p-3">
                <p className="text-xs font-semibold text-neutral-700 mb-2">Deep modes (Gemini 3 Pro)</p>
                <div className="flex flex-wrap gap-2">
                  {RHO_MODE_ROUTING.filter((row) => row.model === "Gemini 3 Pro").map((row) => (
                    <span key={row.mode} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${modeToneClasses[row.tone]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {row.mode}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-800">Personalities:</span> You can explore new ideas, challenge your colleagues’ work, and get inspired. Rho assembles these roles dynamically for each step of the proof.
            </div>
          </div>
        </div>
      </section>

      {/* Review / Collaboration Snippet */}
      <section id="community-story" className="py-20">
        <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs uppercase tracking-wider">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              Social Peer Review
            </div>
            <h3 className="text-2xl font-semibold text-neutral-900">
              &quot;A research conversation, not a file exchange.&quot;
            </h3>
            <p className="text-neutral-500 text-sm leading-relaxed">
              We moved from scattered drafts to one shared proof graph. Every assumption, critique, and verification
              step is visible, discussable, and recoverable by the full team.
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
                The exploration branch misses rigor on node 3. Can we justify the k=0 boundary case?
              </div>
            </div>
            {/* Thread Item 2 */}
            <div className="flex gap-3 justify-end">
              <div className="bg-indigo-600 p-3 rounded-lg rounded-tr-none text-xs text-white shadow-md">
                <span className="font-semibold text-white block mb-1">You</span>
                Great catch. I opened a review branch, added the formal check, and linked the result.
              </div>
              <div className="w-8 h-8 rounded-full bg-neutral-900 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white">
                Me
              </div>
            </div>
            {/* Input */}
            <div className="mt-4 pt-3 border-t border-neutral-100 flex gap-2">
              <input
                type="text"
                placeholder="Reply with evidence..."
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
            Build mathematics with rigor and momentum.
          </h2>
          <p className="text-neutral-400 mb-10 font-light">
            Join teams using ProofMesh to explore conjectures, collaborate in shared reasoning, and ship formally
            verified results with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-white text-neutral-900 px-8 py-3 rounded-full text-sm font-medium hover:bg-neutral-100 transition-colors inline-flex items-center gap-2 justify-center"
            >
              Start Proving
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href={HACKATHON_DEMO_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-neutral-700 text-white px-8 py-3 rounded-full text-sm font-medium hover:border-neutral-500 transition-colors"
            >
              Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 border-t border-neutral-800 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span className="text-sm font-semibold text-white">ProofMesh</span>
          </div>
          <div className="flex gap-6 text-xs text-neutral-500">
            <Link href="/privacy" className="hover:text-neutral-300">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-neutral-300">
              Terms
            </Link>
            <a href="https://github.com/CarmenSalvado/ProofMesh" className="hover:text-neutral-300">
              GitHub
            </a>
          </div>
          <div className="text-[10px] text-neutral-600">© 2026 ProofMesh Inc.</div>
        </div>
      </footer>
    </div>
  );
}
