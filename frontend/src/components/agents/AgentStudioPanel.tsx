"use client";

import { useMemo, useState } from "react";
import {
  Compass,
  Filter,
  ShieldCheck,
  Cpu,
  Sparkles,
  Trash2,
  CheckCircle2,
  Maximize2,
  Users,
} from "lucide-react";
import { runAgent, AgentProposal } from "@/lib/api";

const TASKS = [
  {
    id: "propose",
    label: "Explore",
    hint: "Derive a result or lemma from the current context.",
    icon: Compass,
    accent: "text-indigo-400",
    hover: "hover:border-indigo-500/50",
  },
  {
    id: "extract",
    label: "Refine",
    hint: "Extract math statements and structure.",
    icon: Filter,
    accent: "text-amber-400",
    hover: "hover:border-amber-500/50",
  },
  {
    id: "code",
    label: "Verify",
    hint: "Generate a verification plan or computation.",
    icon: ShieldCheck,
    accent: "text-emerald-400",
    hover: "hover:border-emerald-500/50",
  },
];

export function AgentStudioPanel({
  problemId,
  context,
  onInsertMarkdown,
  readOnly = false,
  filePath,
  connectedCount,
}: {
  problemId: string;
  context: string;
  onInsertMarkdown: (markdown: string) => void;
  readOnly?: boolean;
  filePath?: string | null;
  connectedCount?: number;
}) {
  const [task, setTask] = useState(TASKS[0].id);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentTask = useMemo(() => TASKS.find((item) => item.id === task), [task]);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runAgent({
        problem_id: problemId,
        file_path: filePath || null,
        cell_id: null,
        context,
        task,
        instructions: instructions || null,
      });
      setProposals(result.proposals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run agent");
    } finally {
      setLoading(false);
    }
  };

  const insertProposal = (proposal: AgentProposal) => {
    if (readOnly) return;
    const payload =
      proposal.cell_type === "code"
        ? `\n\n\`\`\`python\n${proposal.content_markdown}\n\`\`\`\n`
        : `\n\n${proposal.content_markdown}\n`;
    onInsertMarkdown(payload);
  };

  return (
    <aside className="hidden xl:flex w-80 bg-neutral-950 border-l border-neutral-800 flex-col shrink-0">
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Agents
          </h2>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-500 font-medium">Active</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {TASKS.map((item) => {
            const Icon = item.icon;
            const isActive = task === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTask(item.id)}
                className={`flex flex-col items-center justify-center gap-1 bg-neutral-900 border border-neutral-800 ${item.hover} hover:bg-neutral-800 p-2 rounded transition-all group ${
                  isActive ? "border-white/10 bg-neutral-800" : ""
                }`}
              >
                <Icon className={`${item.accent} ${isActive ? "scale-110" : "group-hover:scale-110"} transition-transform`} size={16} />
                <span className="text-[10px] font-medium text-neutral-400">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2 mb-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
            Focus
          </p>
          <p className="text-[11px] text-neutral-400">
            {currentTask?.hint}
          </p>
        </div>

        <div className="space-y-2 mb-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
            Instructions
          </p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Add constraints or hints for the agent..."
            className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-[12px] text-neutral-200 focus:outline-none focus:border-neutral-600 transition-colors"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-[10px] text-neutral-500">
            {readOnly ? "Read-only workspace" : `Context: ${filePath || "workspace"}`}
          </div>
          <button
            onClick={handleRun}
            disabled={loading}
            className="px-3 py-1.5 rounded text-[12px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition disabled:opacity-60"
          >
            {loading ? "Running..." : "Run"}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
            Agent Stream
          </p>
          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
            <Cpu size={12} />
            {proposals.length} proposals
          </div>
        </div>

        <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
          {proposals.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-800 p-3 text-[11px] text-neutral-500">
              No proposals yet. Run an agent to generate suggestions.
            </div>
          ) : (
            proposals.map((proposal) => (
              <div key={proposal.id} className="rounded border border-neutral-800 bg-neutral-900/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-400" />
                    <span className="text-[11px] font-semibold text-neutral-200">
                      {proposal.title}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                    {proposal.kind}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 whitespace-pre-wrap leading-relaxed">
                  {proposal.content_markdown}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800"
                    title="Discard"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => insertProposal(proposal)}
                    disabled={readOnly}
                    className="px-2.5 py-1 rounded text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} />
                    Verify & Add
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 bg-[#020202]">
        <div className="p-4 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Workspace Signals
            </h2>
            <button className="w-6 h-6 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 flex items-center justify-center hover:text-white">
              <Maximize2 size={14} />
            </button>
          </div>

          <div className="mt-4 space-y-2 text-[11px] text-neutral-400">
            <div className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <span className="flex items-center gap-2">
                <Users size={12} /> Contributors
              </span>
              <span className="text-neutral-200">{connectedCount ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <span className="flex items-center gap-2">
                <Cpu size={12} /> Active proposals
              </span>
              <span className="text-neutral-200">{proposals.length}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <span className="flex items-center gap-2">
                <Sparkles size={12} /> Current file
              </span>
              <span className="text-neutral-200">{filePath || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-neutral-800 bg-neutral-950 text-[10px] text-neutral-500 font-mono flex justify-between">
        <span>{connectedCount ?? 0} contributors</span>
        <span className="flex items-center gap-1">
          <Cpu size={12} /> {proposals.length} proposals
        </span>
      </div>
    </aside>
  );
}
