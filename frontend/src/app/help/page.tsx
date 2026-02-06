"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import {
  BookOpen,
  Code,
  HelpCircle,
  MessageSquare,
  Lightbulb,
  FileText,
  Users,
  Zap,
  ChevronRight,
  ExternalLink,
  Search,
  Bot,
  BrainCircuit,
  Database,
  Workflow,
  Cpu,
  Layers3,
} from "lucide-react";

const HELP_SECTIONS = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    color: "text-indigo-600 bg-indigo-50",
    items: [
      {
        title: "What is ProofMesh?",
        content: "ProofMesh is a collaborative platform for formal mathematical proofs. It allows mathematicians and researchers to create, verify, and share mathematical proofs using formal verification tools like Lean 4.",
      },
      {
        title: "Creating Your First Problem",
        content: "To create a problem, go to your Dashboard and click New Problem. Give it a title, optional description, and choose its visibility (public or private). Each problem becomes a workspace where you can develop your proof.",
      },
      {
        title: "Understanding the Workspace",
        content: "The workspace is where you develop your proofs. It includes a file explorer, code editor, library panel for verified lemmas, and an AI assistant to help you along the way.",
      },
    ],
  },
  {
    id: "proof-development",
    title: "Proof Development",
    icon: Code,
    color: "text-emerald-600 bg-emerald-50",
    items: [
      {
        title: "Writing Lean 4 Code",
        content: "ProofMesh uses Lean 4 for formal verification. You can write theorem statements, definitions, and proofs directly in the workspace. The system will check your proofs for correctness.",
      },
      {
        title: "Using the Library",
        content: "The library contains verified lemmas, definitions, and theorems that you can reuse in your proofs. You can also contribute new items to the library once they are verified.",
      },
      {
        title: "AI Assistance",
        content: "Our AI personalities can help you with proof strategies, suggest lemmas, and even generate proof sketches. Access them from the Personalities panel in the workspace.",
      },
    ],
  },
  {
    id: "collaboration",
    title: "Collaboration",
    icon: Users,
    color: "text-amber-600 bg-amber-50",
    items: [
      {
        title: "Following Users",
        content: "Follow other users to see their public activity in your feed. Go to the Social page to discover and connect with other mathematicians.",
      },
      {
        title: "Discussions",
        content: "Start discussions about problems, proofs, or general mathematical topics. You can link discussions to specific problems or library items.",
      },
      {
        title: "Teams",
        content: "Create or join teams to collaborate on larger projects. Team members can share workspaces and work together on complex proofs.",
      },
    ],
  },
  {
    id: "library",
    title: "Library System",
    icon: BookOpen,
    color: "text-purple-600 bg-purple-50",
    items: [
      {
        title: "Item Types",
        content: "The library supports various item types: theorems, lemmas, definitions, claims, counterexamples, computations, and notes. Each serves a different purpose in proof development.",
      },
      {
        title: "Verification Status",
        content: "Items can be proposed, verified, or rejected. Verified items have been formally checked and can be safely used as dependencies in other proofs.",
      },
      {
        title: "Dependencies",
        content: "Library items can depend on other items. The system tracks these dependencies to ensure proof integrity and help you understand the structure of your proofs.",
      },
    ],
  },
];

const QUICK_LINKS = [
  { title: "Create a Problem", href: "/problems/new", icon: FileText },
  { title: "Explore Catalog", href: "/catalog", icon: Search },
  { title: "View Discussions", href: "/discussions", icon: MessageSquare },
  { title: "Your Profile", href: "/profile", icon: Users },
];

const RHO_MODE_ROUTING = [
  { mode: "Explorer", purpose: "Idea generation and node expansion", model: "Gemini 3 Flash", agents: "Explorer + Mapper" },
  { mode: "Formalize", purpose: "Translate natural math to Lean scaffolds", model: "Gemini 3 Pro", agents: "Formalizer" },
  { mode: "Verify", purpose: "Proof-check flow + Lean runner feedback", model: "Gemini 3 Pro", agents: "Verifier + Critic" },
  { mode: "Critic", purpose: "Find gaps, assumptions, and weak links", model: "Gemini 3 Pro", agents: "Critic" },
  { mode: "Compute", purpose: "Computation node suggestions", model: "Gemini 3 Flash", agents: "Explorer + Verifier" },
  { mode: "Strategist", purpose: "Roadmap planning and decomposition", model: "Gemini 3 Pro", agents: "Mapper + Critic" },
  { mode: "Socratic", purpose: "Short guided hints", model: "Gemini 3 Flash", agents: "Tutor-style prompt layer" },
];

function SimpleNavbar() {
  return (
    <nav className="sticky top-0 w-full z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo size={24} className="group-hover:opacity-80 transition-opacity" />
          <span className="text-sm font-bold tracking-tight">ProofMesh</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function HelpPage() {
  const { user } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      {user ? <DashboardNavbar showSearch={false} /> : <SimpleNavbar />}

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-neutral-200">
          <div className="max-w-4xl mx-auto px-8 py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-semibold text-neutral-900 mb-3">
              Help and Documentation
            </h1>
            <p className="text-neutral-500 mb-8 max-w-lg mx-auto">
              Everything you need to know about using ProofMesh for collaborative formal proof development.
            </p>

            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-8">
          {user && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 p-4 bg-white rounded-lg border border-neutral-200 hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <link.icon className="w-5 h-5 text-neutral-400 group-hover:text-indigo-600 transition-colors" />
                  <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900">
                    {link.title}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <section className="mb-8 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-neutral-100 bg-gradient-to-r from-cyan-50 via-sky-50 to-white">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-cyan-200 bg-white text-cyan-800 text-[11px] font-medium mb-3">
                <Bot className="w-3.5 h-3.5" />
                Rho Architecture
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 mb-1">What is Rho?</h2>
              <p className="text-sm text-neutral-600">
                Rho is ProofMesh&apos;s AI orchestration layer. It routes requests across personalities, embeddings context,
                and model tiers (Gemini 3 Flash / Gemini 3 Pro) depending on the active mode.
              </p>
            </div>

            <div className="p-6">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 mb-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-neutral-900 font-semibold mb-1">
                      <Workflow className="w-4 h-4 text-indigo-600" />
                      Modes
                    </div>
                    <p className="text-neutral-600">Explorer · Formalize · Verify · Critic · Compute · Strategist · Socratic</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-neutral-900 font-semibold mb-1">
                      <BrainCircuit className="w-4 h-4 text-emerald-600" />
                      Rho Router
                    </div>
                    <p className="text-neutral-600">Prompt shaping, agent selection, and context packing</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-neutral-900 font-semibold mb-1">
                      <Cpu className="w-4 h-4 text-amber-600" />
                      Models
                    </div>
                    <p className="text-neutral-600">Gemini 3 Flash for speed, Gemini 3 Pro for depth and rigor</p>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-neutral-900 font-semibold mb-1">
                      <Database className="w-4 h-4 text-purple-600" />
                      Grounding
                    </div>
                    <p className="text-neutral-600">Embeddings + library + discussion + canvas graph context</p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <div className="min-w-[760px] grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-2 text-[11px] text-neutral-700">
                    <div className="rounded-lg border border-neutral-200 bg-white p-2.5 flex items-center gap-2">
                      <Layers3 className="w-3.5 h-3.5 text-neutral-500" />
                      User Mode Input
                    </div>
                    <div className="text-neutral-400">→</div>
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-2.5 flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 text-cyan-700" />
                      Rho Orchestrator
                    </div>
                    <div className="text-neutral-400">→</div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-2.5 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-neutral-500" />
                      Gemini 3 Flash / Pro
                    </div>
                    <div className="text-neutral-400">→</div>
                    <div className="rounded-lg border border-neutral-200 bg-white p-2.5 flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-neutral-500" />
                      Lean + Library + Embeddings
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="grid grid-cols-4 bg-neutral-50 text-[11px] font-semibold text-neutral-700">
                  <div className="px-3 py-2 border-r border-neutral-200">Mode</div>
                  <div className="px-3 py-2 border-r border-neutral-200">Primary Use</div>
                  <div className="px-3 py-2 border-r border-neutral-200">Model</div>
                  <div className="px-3 py-2">Personality Layer</div>
                </div>
                {RHO_MODE_ROUTING.map((row) => (
                  <div key={row.mode} className="grid grid-cols-4 text-[12px] border-t border-neutral-100">
                    <div className="px-3 py-2.5 border-r border-neutral-100 font-medium text-neutral-900">{row.mode}</div>
                    <div className="px-3 py-2.5 border-r border-neutral-100 text-neutral-600">{row.purpose}</div>
                    <div className="px-3 py-2.5 border-r border-neutral-100 text-neutral-700">{row.model}</div>
                    <div className="px-3 py-2.5 text-neutral-600">{row.agents}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="space-y-4">
            {HELP_SECTIONS.filter((section) =>
              searchQuery === "" ||
              section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              section.items.some(
                (item) =>
                  item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.content.toLowerCase().includes(searchQuery.toLowerCase())
              )
            ).map((section) => (
              <div
                key={section.id}
                className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm"
              >
                <button
                  onClick={() =>
                    setExpandedSection(expandedSection === section.id ? null : section.id)
                  }
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-neutral-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${section.color}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-neutral-900">
                      {section.title}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {section.items.length} topics
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-5 h-5 text-neutral-400 transition-transform ${
                      expandedSection === section.id ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {expandedSection === section.id && (
                  <div className="border-t border-neutral-100">
                    {section.items
                      .filter(
                        (item) =>
                          searchQuery === "" ||
                          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.content.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="p-5 border-b border-neutral-100 last:border-b-0"
                        >
                          <h3 className="text-sm font-medium text-neutral-900 mb-2 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            {item.title}
                          </h3>
                          <p className="text-sm text-neutral-600 leading-relaxed pl-6">
                            {item.content}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Need more help?</h3>
                <p className="text-sm text-white/80">
                  Cannot find what you are looking for? Start a discussion or reach out to the community.
                </p>
              </div>
              <Link
                href="/discussions"
                className="px-4 py-2 bg-white text-indigo-600 text-sm font-medium rounded-lg hover:bg-white/90 transition-colors flex items-center gap-2"
              >
                Ask a Question
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
