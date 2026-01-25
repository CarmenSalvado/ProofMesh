"use client";

import { useState } from "react";
import { LogEntry, AgentStatus } from "@/hooks/useWebSocket";

interface OrchestrationPanelProps {
	isConnected: boolean;
	agents: AgentStatus[];
	logs: LogEntry[];
	onRunAgents: () => void;
	onStopAgents: () => void;
	onSendChat: (message: string) => void;
	embedded?: boolean;
}

export function OrchestrationPanel({
	isConnected,
	agents,
	logs,
	onRunAgents,
	onStopAgents,
	onSendChat,
	embedded = false,
}: OrchestrationPanelProps) {
	const [command, setCommand] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (command.trim()) {
			onSendChat(command.trim());
			setCommand("");
		}
	};

	const iconPaths: Record<string, string> = {
		calculator: "M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z",
		shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
		graph: "M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z",
	};

	const getStatusColor = (status: AgentStatus["status"]) => {
		switch (status) {
			case "working": return { bg: "bg-[var(--success-bg)]", border: "border-[var(--success)]", text: "text-[var(--success)]", icon: "text-[var(--success)]" };
			case "thinking": return { bg: "bg-[var(--bg-tertiary)]", border: "border-[var(--accent-primary)]", text: "text-[var(--accent-primary)]", icon: "text-[var(--accent-primary)]" };
			case "error": return { bg: "bg-[var(--error-bg)]", border: "border-[var(--error)]", text: "text-[var(--error)]", icon: "text-[var(--error)]" };
			default: return { bg: "bg-[var(--bg-tertiary)]", border: "border-[var(--border-primary)]", text: "text-[var(--text-muted)]", icon: "text-[var(--text-faint)]" };
		}
	};

	const getLogColor = (level: LogEntry["level"]) => {
		switch (level) {
			case "success": return "text-emerald-400";
			case "warning": return "text-amber-400";
			case "error": return "text-red-400";
			default: return "text-zinc-400";
		}
	};

	const getAgentIcon = (name: string) => {
		if (name.toLowerCase().includes("solver") || name.toLowerCase().includes("symbolic")) return "calculator";
		if (name.toLowerCase().includes("verifier") || name.toLowerCase().includes("logic")) return "shield";
		if (name.toLowerCase().includes("graph") || name.toLowerCase().includes("theorist")) return "graph";
		return "calculator";
	};

	const isWorking = agents.some(a => a.status === "working" || a.status === "thinking");

	const Content = (
		<>
			{!embedded ? (
				<div className="h-12 border-b border-[var(--border-primary)] px-4 flex items-center justify-between flex-shrink-0">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-widest">
							Orchestration
						</span>
						<span className={`w-2 h-2 rounded-full ${isConnected ? "bg-[var(--success)]" : "bg-[var(--text-faint)]"}`} />
					</div>
					<button
						onClick={isWorking ? onStopAgents : onRunAgents}
						className={`text-xs px-2 py-1 rounded transition-colors ${isWorking
							? "bg-[var(--error-bg)] text-[var(--error)] hover:opacity-80"
							: "bg-[var(--success-bg)] text-[var(--success)] hover:opacity-80"
							}`}
					>
						{isWorking ? "Stop" : "Run"}
					</button>
				</div>
			) : (
				<div className="px-4 py-2 flex items-center justify-between border-b border-[var(--border-primary)] flex-shrink-0 bg-[var(--bg-tertiary)] bg-opacity-30">
					<div className="flex items-center gap-2">
						<span className={`w-1.5 h-1.5 rounded-full ${isWorking ? "bg-[var(--success)] animate-pulse" : "bg-[var(--text-faint)]"}`} />
						<span className="text-[10px] font-medium text-[var(--text-muted)]">
							{isWorking ? "AGENTS ACTIVE" : "IDLE"}
						</span>
					</div>
					<button
						onClick={isWorking ? onStopAgents : onRunAgents}
						className="text-[10px] px-2 py-0.5 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
					>
						{isWorking ? "Stop Process" : "Run All"}
					</button>
				</div>
			)}

			{/* Active Agents List */}
			<div className="p-4 space-y-3 overflow-y-auto max-h-[40%] border-b border-[var(--border-primary)] flex-shrink-0">
				{agents.length === 0 ? (
					<div className="text-center py-4 text-xs text-[var(--text-faint)]">
						No active agents
					</div>
				) : (
					agents.map((agent) => {
						const colors = getStatusColor(agent.status);
						const iconKey = getAgentIcon(agent.name);
						return (
							<div
								key={agent.agent_id}
								className={`agent-card ${agent.status !== "idle" ? colors.border : ""}`}
								style={{ borderColor: agent.status !== "idle" ? undefined : "" }}
							>
								<div className="flex items-center gap-3 mb-2">
									<div className={`w-8 h-8 rounded-md ${colors.bg} flex items-center justify-center ${colors.icon} border ${colors.border}`}>
										<svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths[iconKey]} />
										</svg>
									</div>
									<div className="flex-1 min-w-0">
										<h4 className="text-xs font-semibold text-[var(--text-primary)]">{agent.name}</h4>
										<span className={`text-[10px] ${colors.text} font-medium`}>
											{agent.task || agent.status}
										</span>
									</div>
									{agent.status === "working" && (
										<svg className="w-4 h-4 text-[var(--success)] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
										</svg>
									)}
									{agent.status === "thinking" && (
										<div className="flex gap-0.5">
											{[0, 1, 2].map((i) => (
												<span
													key={i}
													className="w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-bounce"
													style={{ animationDelay: `${i * 150}ms` }}
												/>
											))}
										</div>
									)}
								</div>
								{agent.progress !== null && agent.progress !== undefined && (
									<div className="progress-bar">
										<div
											className="progress-bar-fill bg-[var(--success)]"
											style={{ width: `${agent.progress}%` }}
										/>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>

			{/* Terminal */}
			<div className="flex-1 terminal p-4 overflow-y-auto flex flex-col min-h-0 bg-[#09090b]">
				<div className="flex items-center justify-between mb-4 text-zinc-500 border-b border-zinc-800 pb-2 flex-shrink-0">
					<span>SYSTEM_LOGS</span>
					<span className={`flex items-center gap-1 ${isConnected ? "text-emerald-500" : "text-zinc-500"}`}>
						<span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-zinc-500"}`} />
						{isConnected ? "LIVE" : "OFFLINE"}
					</span>
				</div>

				<div className="space-y-2 flex-1 overflow-y-auto font-mono">
					{logs.length === 0 ? (
						<div className="text-zinc-600 text-[11px]">
							Waiting for messages...
						</div>
					) : (
						logs.map((log, i) => (
							<div key={i} className="flex gap-2 text-[11px]">
								<span className="text-zinc-600 select-none flex-shrink-0">{log.timestamp}</span>
								{log.agent && (
									<span className={`flex-shrink-0 ${log.agent.startsWith("@") ? "text-indigo-400" : "text-emerald-400"
										}`}>
										{log.agent.startsWith("@") ? log.agent : `@${log.agent}`}
									</span>
								)}
								<span className={getLogColor(log.level)}>{log.message}</span>
							</div>
						))
					)}
				</div>

				<div className="flex items-center gap-1 mt-auto pt-4 text-zinc-500 text-xs">
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
					</svg>
					{isConnected ? "Awaiting input" : "Connecting..."}
				</div>
			</div>

			{/* Input */}
			<form onSubmit={handleSubmit} className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-primary)] flex-shrink-0">
				<div className="relative">
					<svg className="absolute left-3 top-2.5 text-[var(--text-faint)] w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
					</svg>
					<input
						type="text"
						value={command}
						onChange={(e) => setCommand(e.target.value)}
						placeholder={isConnected ? "Command agents..." : "Connecting..."}
						disabled={!isConnected}
						className="w-full pl-9 pr-3 py-2 disabled:opacity-50"
					/>
				</div>
			</form>
		</>
	);

	if (embedded) {
		return (
			<div className="flex flex-col h-full bg-[var(--bg-secondary)] text-[13px]">
				{Content}
			</div>
		);
	}

	return (
		<aside className="w-[340px] bg-[var(--bg-secondary)] border-l border-[var(--border-primary)] flex flex-col backdrop-blur-sm z-10">
			{Content}
		</aside>
	);
}
