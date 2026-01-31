import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-neutral-900 rounded-sm flex items-center justify-center text-white">
              <span className="font-[var(--font-math)] italic text-[11px] leading-none logo-rho">&rho;</span>
            </div>
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
