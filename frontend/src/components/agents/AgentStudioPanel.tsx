"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  Filter,
  ShieldCheck,
  Cpu,
  Sparkles,
  Trash2,
  CheckCircle2,
  Users,
  BookOpen,
  AlertTriangle,
  Map,
  Loader2,
} from "lucide-react";
import { getAgents, runAgent, AgentProfile, AgentProposal } from "@/lib/api";

const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: "explorer",
    name: "Explorer",
    task: "propose",
    description: "Generate candidate results or directions from the context.",
  },
  {
    id: "refiner",
    name: "Refiner",
    task: "extract",
    description: "Extract structure, definitions, and math statements.",
  },
  {
    id: "verifier",
    name: "Verifier",
    task: "code",
    description: "Propose a verification or computation scaffold.",
  },
  {
    id: "archivist",
    name: "Archivist",
    task: "summarize",
    description: "Summarize the current notes into a clean digest.",
  },
  {
    id: "skeptic",
    name: "Skeptic",
    task: "critique",
    description: "Highlight gaps, risks, or unclear assumptions.",
  },
  {
    id: "mapper",
    name: "Mapper",
    task: "map",
    description: "Outline next steps and dependencies.",
  },
];

const AGENT_UI: Record<
  string,
  { icon: typeof Compass; accent: string; hover: string }
> = {
  explorer: {
    icon: Compass,
    accent: "text-indigo-400",
    hover: "hover:border-indigo-500/50",
  },
  refiner: {
    icon: Filter,
    accent: "text-amber-400",
    hover: "hover:border-amber-500/50",
  },
  verifier: {
    icon: ShieldCheck,
    accent: "text-emerald-400",
    hover: "hover:border-emerald-500/50",
  },
  archivist: {
    icon: BookOpen,
    accent: "text-cyan-400",
    hover: "hover:border-cyan-500/50",
  },
  skeptic: {
    icon: AlertTriangle,
    accent: "text-rose-400",
    hover: "hover:border-rose-500/50",
  },
  mapper: {
    icon: Map,
    accent: "text-sky-400",
    hover: "hover:border-sky-500/50",
  },
};

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
  const [agents, setAgents] = useState<AgentProfile[]>(DEFAULT_AGENTS);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(
    () => new Set(DEFAULT_AGENTS.map((agent) => agent.id))
  );
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [runningAgents, setRunningAgents] = useState<Set<string>>(new Set());
  const insertTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingAgents(true);
    getAgents()
      .then((result) => {
        if (!active) return;
        if (result.agents && result.agents.length > 0) {
          setAgents(result.agents);
          setSelectedAgents(new Set(result.agents.map((agent) => agent.id)));
        }
      })
      .catch((err) => {
        if (!active) return;
        setAgentsError(err instanceof Error ? err.message : "Failed to load agents");
      })
      .finally(() => {
        if (!active) return;
        setLoadingAgents(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedProfiles = useMemo(
    () => agents.filter((agent) => selectedAgents.has(agent.id)),
    [agents, selectedAgents]
  );
  const focusText = useMemo(() => {
    if (selectedProfiles.length === 1) {
      return selectedProfiles[0].description;
    }
    if (selectedProfiles.length > 1) {
      return `${selectedProfiles.length} agents ready. Run to generate proposals.`;
    }
    return "Select at least one agent to run.";
  }, [selectedProfiles]);
  const runLabel = useMemo(() => {
    if (loading) {
      const count = runningAgents.size || selectedProfiles.length;
      return `Running ${count}`;
    }
    if (selectedProfiles.length > 1) return "Run selected";
    return "Run";
  }, [loading, runningAgents.size, selectedProfiles.length]);

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const selectAllAgents = () => {
    setSelectedAgents(new Set(agents.map((agent) => agent.id)));
  };

  const clearAgents = () => {
    setSelectedAgents(new Set());
  };

  const handleRun = async () => {
    if (selectedProfiles.length === 0) {
      setError("Select at least one agent");
      return;
    }
    setLoading(true);
    setRunningAgents(new Set(selectedProfiles.map((agent) => agent.id)));
    setError(null);
    try {
      const runSingle = async (agent: AgentProfile) => {
        try {
          const result = await runAgent({
            problem_id: problemId,
            file_path: filePath || null,
            cell_id: null,
            context,
            task: agent.task,
            instructions: instructions || null,
            agent_id: agent.id,
          });
          return { agent, result };
        } catch (err) {
          throw { agent, error: err };
        } finally {
          setRunningAgents((prev) => {
            const next = new Set(prev);
            next.delete(agent.id);
            return next;
          });
        }
      };

      const settled = await Promise.allSettled(selectedProfiles.map(runSingle));

      const successes = settled.filter(
        (res): res is PromiseFulfilledResult<{ agent: AgentProfile; result: Awaited<ReturnType<typeof runAgent>> }> =>
          res.status === "fulfilled"
      );

      const merged = successes.flatMap(({ value: { agent, result } }) =>
        (result.proposals || []).map((proposal) => ({
          ...proposal,
          agent_id: proposal.agent_id ?? agent.id,
          agent_name: proposal.agent_name ?? agent.name,
        }))
      );

      setProposals(merged);

      const failures = settled.filter((res) => res.status === "rejected");
      if (failures.length > 0) {
        const first = failures[0];
        const agentId = first.status === "rejected" && (first.reason?.agent?.id as string | undefined);
        const message = first.status === "rejected" && first.reason?.error instanceof Error
          ? first.reason.error.message
          : "Failed to run agents";
        setError(agentId ? `Agent ${agentId}: ${message}` : message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run agents");
    } finally {
      setLoading(false);
      setRunningAgents(new Set());
    }
  };

  const formatProposal = (proposal: AgentProposal) => {
    const prefix = proposal.agent_name ? `\n\n*Agent: ${proposal.agent_name}*\n` : "\n\n";
    const body =
      proposal.cell_type === "code"
        ? `\`\`\`python\n${proposal.content_markdown}\n\`\`\`\n`
        : `${proposal.content_markdown}\n`;
    return `${prefix}${body}`;
  };

  const insertProposal = (proposal: AgentProposal) => {
    if (readOnly) return;
    onInsertMarkdown(formatProposal(proposal));
    setInsertedId(proposal.id);
    if (insertTimeoutRef.current) {
      window.clearTimeout(insertTimeoutRef.current);
    }
    insertTimeoutRef.current = window.setTimeout(() => {
      setInsertedId(null);
    }, 1500);
  };

  const insertAllProposals = () => {
    if (readOnly || proposals.length === 0) return;
    const payload = proposals.map(formatProposal).join("\n");
    onInsertMarkdown(payload);
    setInsertedId("all");
    if (insertTimeoutRef.current) {
      window.clearTimeout(insertTimeoutRef.current);
    }
    insertTimeoutRef.current = window.setTimeout(() => {
      setInsertedId(null);
    }, 1500);
  };

  const discardProposal = (proposalId: string) => {
    setProposals((prev) => prev.filter((proposal) => proposal.id !== proposalId));
  };

  useEffect(() => {
    return () => {
      if (insertTimeoutRef.current) {
        window.clearTimeout(insertTimeoutRef.current);
      }
    };
  }, []);

  return (
    <aside className="hidden xl:flex w-80 bg-neutral-950 border-l border-neutral-800 flex-col shrink-0">
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            Agents
          </h2>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-200">
                <Loader2 size={12} className="animate-spin" /> Running
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500 font-medium">Active</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {agents.map((agent) => {
            const ui = AGENT_UI[agent.id] || {
              icon: Sparkles,
              accent: "text-neutral-400",
              hover: "hover:border-neutral-600",
            };
            const Icon = ui.icon;
            const isActive = selectedAgents.has(agent.id);
            const isRunning = runningAgents.has(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`relative flex flex-col items-center justify-center gap-1 bg-neutral-900 border border-neutral-800 ${ui.hover} hover:bg-neutral-800 p-2 rounded transition-all group ${
                  isActive ? "border-white/10 bg-neutral-800" : ""
                } ${isRunning ? "ring-1 ring-emerald-400/60" : ""}`}
                aria-pressed={isActive}
              >
                <Icon className={`${ui.accent} ${isActive ? "scale-110" : "group-hover:scale-110"} transition-transform`} size={16} />
                <span className="text-[10px] font-medium text-neutral-400">{agent.name}</span>
                {isRunning && (
                  <div className="absolute top-1 right-1 flex items-center gap-1 rounded bg-neutral-900/80 px-1 py-[2px] text-[9px] text-emerald-200 border border-emerald-500/30">
                    <Loader2 size={10} className="animate-spin" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {loadingAgents && (
          <div className="text-[10px] text-neutral-500 mb-2">Loading agents...</div>
        )}
        {agentsError && (
          <div className="text-[10px] text-amber-400 mb-2">{agentsError}</div>
        )}

        <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-3">
          <span>{selectedProfiles.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllAgents}
              className="hover:text-neutral-200 transition-colors"
            >
              All
            </button>
            <button
              type="button"
              onClick={clearAgents}
              className="hover:text-neutral-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold">
            Focus
          </p>
          <p className="text-[11px] text-neutral-400">
            {focusText}
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
            {readOnly ? "Read-only file" : `Context: ${filePath || "notes.md"}`}
          </div>
          <button
            onClick={handleRun}
            disabled={loading || loadingAgents || selectedProfiles.length === 0}
            className="px-3 py-1.5 rounded text-[12px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {runLabel}
            </span>
          </button>
        </div>

        {loading && (
          <div className="mt-2 flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900/70 px-3 py-2 text-[11px] text-neutral-200">
            <Loader2 size={14} className="animate-spin text-emerald-300" />
            <div className="flex flex-col">
              <span className="font-semibold text-emerald-200">Agents running</span>
              <span className="text-neutral-400">{runningAgents.size} active · {selectedProfiles.length} requested</span>
            </div>
          </div>
        )}

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
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <button
              onClick={insertAllProposals}
              disabled={readOnly || proposals.length === 0}
              className="px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 transition-colors disabled:opacity-50"
            >
              {insertedId === "all" ? "Inserted" : "Insert all"}
            </button>
            <div className="flex items-center gap-1">
              <Cpu size={12} />
              {proposals.length} proposals
            </div>
          </div>
        </div>

        <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
          {proposals.length === 0 ? (
            <div className="rounded border border-dashed border-neutral-800 p-3 text-[11px] text-neutral-500">
              {loading ? "Agents are running..." : "No proposals yet. Run an agent to generate suggestions."}
            </div>
          ) : (
            proposals.map((proposal) => {
              const ui = proposal.agent_id ? AGENT_UI[proposal.agent_id] : null;
              const accent = ui?.accent || "text-neutral-400";
              const borderAccent = ui?.accent?.replace("text-", "border-") || "border-neutral-800";
              const isInserted = insertedId === proposal.id;
              return (
              <div
                key={proposal.id}
                className={`rounded border ${borderAccent} bg-neutral-900/60 p-3 transition ${
                  isInserted ? "shadow-[0_0_0_1px_rgba(16,185,129,0.6)]" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className={accent} />
                    <span className="text-[11px] font-semibold text-neutral-200">
                      {proposal.title}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                    {proposal.kind}
                  </span>
                </div>
                {proposal.agent_name && (
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 mb-2">
                    <span>{proposal.agent_name}</span>
                    {isInserted && <span className="text-emerald-400">Inserted ✓</span>}
                  </div>
                )}
                <p className="text-[11px] text-neutral-400 whitespace-pre-wrap leading-relaxed">
                  {proposal.content_markdown}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800"
                    title="Discard"
                    onClick={() => discardProposal(proposal.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => insertProposal(proposal)}
                    disabled={readOnly}
                    className="px-2.5 py-1 rounded text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition disabled:opacity-50 flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} />
                    {isInserted ? "Inserted" : "Insert into Markdown"}
                  </button>
                </div>
              </div>
            )})
          )}
        </div>
      </div>

      <div className="flex-1 bg-[#020202]">
        <div className="p-4 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Workspace Signals
            </h2>
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
