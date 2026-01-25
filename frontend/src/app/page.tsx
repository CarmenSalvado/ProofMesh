import Link from "next/link";

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
      <section className="border-y border-neutral-100 bg-neutral-50/50 py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-xl font-medium tracking-tight mb-3">Structured Reasoning Environment</h2>
            <p className="text-sm text-neutral-500">Separation of exploration (Canvas) and verification (Library).</p>
          </div>

          {/* Abstract Interface */}
          <div className="relative w-full max-w-5xl mx-auto bg-white border border-neutral-200 rounded-lg shadow-sm h-[500px] flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-neutral-100 bg-neutral-50/30 hidden md:flex flex-col">
              <div className="p-4 border-b border-neutral-100">
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Project</div>
                <div className="text-sm font-medium text-neutral-900">P vs NP Exploration</div>
              </div>
              <div className="p-4 flex-1">
                <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Contributors</div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-600">AL</div>
                  <span className="text-xs text-neutral-600">A. Lovelace</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-600">DH</div>
                  <span className="text-xs text-neutral-600">D. Hilbert</span>
                </div>
                <div className="mt-8 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Dependencies</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>Lemma 2.4 (Verified)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>Thm 1.1 (External)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Canvas */}
            <div className="flex-1 relative bg-white bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:20px_20px]">
              <div className="absolute top-4 left-4 inline-flex items-center gap-2 bg-white border border-neutral-200 px-3 py-1.5 rounded-md shadow-sm">
                <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-xs font-medium text-neutral-700">Canvas 3: Main approach</span>
              </div>

              {/* Node 1 */}
              <div className="absolute top-24 left-24 w-64 bg-white border border-neutral-300 rounded-md shadow-sm p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-neutral-400">#CLAIM-442</span>
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <p className="text-xs text-neutral-800 italic mb-3">
                  "If P = NP, then circuit complexity lower bounds would imply..."
                </p>
                <div className="flex justify-between items-center border-t border-neutral-100 pt-2">
                  <span className="text-[10px] text-neutral-500">Authored by A. Lovelace</span>
                </div>
              </div>

              {/* Connection */}
              <div className="absolute top-40 left-[320px] w-20 h-px bg-neutral-300" />

              {/* Node 2 */}
              <div className="absolute top-32 left-[380px] w-64 bg-white border border-neutral-300 rounded-md shadow-sm p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-neutral-400">#LEMMA-09</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-xs text-neutral-800 italic mb-3">
                  "The reduction preserves polynomial bounds."
                </p>
                <div className="flex justify-between items-center border-t border-neutral-100 pt-2">
                  <span className="text-[10px] text-neutral-500">Verified by System</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
