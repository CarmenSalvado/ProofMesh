"use client";

import { MessageSquare, Repeat2 } from "lucide-react";
import {
  NotificationsDropdown,
  PostAttachmentCard,
  StarButton,
} from "@/components/social";

export default function SocialGifPage() {
  const latexAttachment = {
    kind: "latex_fragment" as const,
    problem_id: "demo-prime-proof",
    problem_title: "Prime Gaps in Collaborative Verification",
    visibility: "public" as const,
    file_path: "proofs/prime_gap.tex",
    line_start: 42,
    line_end: 74,
    snippet:
      "\\begin{lemma}\\nFor every n, there exists p > n such that p is prime.\\n\\end{lemma}\\n\\begin{proof}\\nUse Euclid construction and formal check in Lean.\\n\\end{proof}",
  };

  const canvasAttachment = {
    kind: "canvas_block" as const,
    problem_id: "demo-prime-proof",
    problem_title: "Prime Gaps in Collaborative Verification",
    visibility: "public" as const,
    block_id: "block-euclid",
    block_name: "Euclid Strategy Branch",
    node_ids: ["def-prime", "lemma-euclid", "thm-inf"],
    node_titles: ["Prime Number", "Euclid's Construction", "Infinitude of Primes"],
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-5 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-neutral-900">ProofMesh Social Timeline</p>
            <p className="text-xs text-neutral-500">Real social components, real interaction flow</p>
          </div>
          <NotificationsDropdown />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Sofia merged branch `euclid-fix`</p>
                <p className="mt-0.5 text-xs text-neutral-500">Lean verification passed and thread resolved.</p>
              </div>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-600">
                2m ago
              </span>
            </div>

            <PostAttachmentCard attachment={canvasAttachment} />

            <div className="mt-3 flex items-center gap-2">
              <StarButton targetType="discussion" targetId="demo-discussion-1" initialStarred={true} starCount={18} />
              <button className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                <MessageSquare className="h-3.5 w-3.5" /> 7
              </button>
              <button className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                <Repeat2 className="h-3.5 w-3.5" /> Re-share
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Elena posted rigor review update</p>
                <p className="mt-0.5 text-xs text-neutral-500">Boundary case fixed and comments closed.</p>
              </div>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-600">
                5m ago
              </span>
            </div>

            <PostAttachmentCard attachment={latexAttachment} />

            <div className="mt-3 flex items-center gap-2">
              <StarButton targetType="discussion" targetId="demo-discussion-2" initialStarred={false} starCount={9} />
              <button className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                <MessageSquare className="h-3.5 w-3.5" /> 4
              </button>
              <button className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">
                <Repeat2 className="h-3.5 w-3.5" /> Re-share
              </button>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
