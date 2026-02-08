import { CheckCircle2, Flame, GitBranch, MessageSquare, Users } from "lucide-react";

const IDEA2STORY_PAPER_URL = "https://arxiv.org/abs/2601.20833";

const FEED_ITEMS = [
  {
    user: "ER",
    name: "Elena",
    action: "opened a rigor review on theorem node",
    detail: "Boundary case k = 0 needs an explicit justification.",
    time: "2m ago",
    tag: "Rigor",
  },
  {
    user: "SJ",
    name: "Sofia",
    action: "merged exploration branch euclid-fix",
    detail: "Lean verification passed and discussion resolved.",
    time: "5m ago",
    tag: "Merge+Verify",
  },
  {
    user: "DM",
    name: "David",
    action: "published a reusable lemma to shared KB",
    detail: "Lemma `mod_one_not_divides` is now reusable by the team.",
    time: "11m ago",
    tag: "Knowledge",
  },
] as const;

export function LandingSocialPanel() {
  return (
    <section id="community" className="max-w-[1320px] mx-auto px-3 sm:px-4 pb-16 sm:pb-24">
      <div className="text-center mb-6 sm:mb-8 px-2">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 mb-2">
          Social workflow for mathematical proof teams
        </h2>
        <p className="text-sm sm:text-base text-neutral-500 max-w-2xl mx-auto">
          Shared feed, threaded critique, and branch history where Rho assistance and
          {" "}
          <a
            href={IDEA2STORY_PAPER_URL}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 underline decoration-indigo-300 underline-offset-2"
          >
            Idea2Story embedding retrieval
          </a>{" "}
          keep exploration and formal rigor connected.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Flame className="h-4 w-4 text-amber-500" />
              <span className="hidden sm:inline">Live theorem activity</span>
              <span className="sm:hidden">Live activity</span>
            </div>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-600 whitespace-nowrap">
              Rho Hackathon
            </span>
          </div>

          <div className="space-y-2.5">
            {FEED_ITEMS.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 py-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white bg-indigo-100 text-[10px] font-bold text-indigo-700">
                    {item.user}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] text-neutral-700">
                        <span className="font-semibold text-neutral-900">{item.name}</span> {item.action}
                      </p>
                      <span className="shrink-0 text-[10px] text-neutral-500">{item.time}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-neutral-500">{item.detail}</p>
                    <div className="mt-1.5">
                      <span className="rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-neutral-600">
                        {item.tag}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.35)]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Proof review thread
            </div>
            <div className="space-y-2">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-700">
                <span className="font-semibold text-neutral-900">Elena:</span> Let&apos;s make the non-divisibility
                claim explicit before merging.
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] text-indigo-900">
                <span className="font-semibold">You:</span> Added the missing step, linked the Lean check, and updated the branch summary.
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Thread resolved after formal verification pass.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.35)]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <GitBranch className="h-4 w-4 text-emerald-500" />
              <span className="hidden sm:inline">Exploration + verification snapshot</span>
              <span className="sm:hidden">Verification snapshot</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <p className="text-neutral-500">Active explorations</p>
                <p className="mt-0.5 text-lg font-semibold text-neutral-900">6</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <p className="text-neutral-500">Resolved rigor checks</p>
                <p className="mt-0.5 text-lg font-semibold text-neutral-900">18</p>
              </div>
              <div className="col-span-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <div className="flex items-center gap-1.5 text-neutral-600">
                  <Users className="h-3.5 w-3.5" />
                  3 collaborators co-authoring this theorem right now
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
