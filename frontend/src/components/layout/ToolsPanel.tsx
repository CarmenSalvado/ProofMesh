"use client";

import { useState } from "react";
import { OrchestrationPanel } from "@/components/agents/OrchestrationPanel";
import { useAuth } from "@/lib/auth";

interface ToolsPanelProps {
	isConnected: boolean;
	agents: any[];
	logs: any[];
	onRunAgents: () => void;
	onStopAgents: () => void;
	onSendChat: (msg: string) => void;
	libraryItems?: any[]; // Pass library items later
}

export function ToolsPanel(props: ToolsPanelProps) {
	const [activeTab, setActiveTab] = useState<"assist" | "tools">("assist");

	return (
		<aside className="w-80 bg-[var(--bg-secondary)] border-l border-[var(--border-primary)] flex flex-col h-full z-10">
			{/* Tabs */}
			<div className="flex items-center px-1 pt-2 border-b border-[var(--border-primary)]">
				<button
					onClick={() => setActiveTab("assist")}
					className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex-1 text-center ${activeTab === "assist"
							? "border-[var(--accent-primary)] text-[var(--text-primary)]"
							: "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
						}`}
				>
					Assist
				</button>
				<button
					onClick={() => setActiveTab("tools")}
					className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex-1 text-center ${activeTab === "tools"
							? "border-[var(--accent-primary)] text-[var(--text-primary)]"
							: "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
						}`}
				>
					Tools
				</button>
			</div>

			<div className="flex-1 overflow-hidden relative">
				{/* Assist Tab (OrchestrationPanel content) */}
				<div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === "assist" ? "opacity-100 z-10" : "opacity-0 pointer-events-none"}`}>
					<OrchestrationPanel {...props} embedded={true} />
				</div>

				{/* Tools Tab (New) */}
				<div className={`absolute inset-0 overflow-y-auto p-4 transition-opacity duration-200 space-y-6 ${activeTab === "tools" ? "opacity-100 z-10" : "opacity-0 pointer-events-none"}`}>

					{/* Symbols Palette (Mock for now, static) */}
					<div>
						<h3 className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-3">
							Symbols Palette
						</h3>
						<div className="grid grid-cols-2 gap-2">
							<button className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] hover:border-[var(--border-secondary)] text-xs text-[var(--text-secondary)]">
								<span>α</span> Greek
							</button>
							<button className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] hover:border-[var(--border-secondary)] text-xs text-[var(--text-secondary)]">
								<span>+</span> Operators
							</button>
							<button className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] hover:border-[var(--border-secondary)] text-xs text-[var(--text-secondary)]">
								<span>∀</span> Logic
							</button>
							<button className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] hover:border-[var(--border-secondary)] text-xs text-[var(--text-secondary)]">
								<span>⊂</span> Set
							</button>
							<button className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] hover:border-[var(--border-secondary)] text-xs text-[var(--text-secondary)]">
								<span>∫</span> Calculus
							</button>
						</div>
					</div>

					{/* Objects / Local Library */}
					<div>
						<h3 className="text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-3">
							Detected Objects
						</h3>
						<div className="space-y-1">
							{/* Mock objects matching the reference image style */}
							<div className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--bg-hover)] text-xs group cursor-pointer">
								<span className="font-mono text-[var(--accent-primary)] bg-[var(--bg-tertiary)] px-1 rounded">C₁</span>
								<span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">- Variable</span>
							</div>
							<div className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--bg-hover)] text-xs group cursor-pointer">
								<span className="font-mono text-purple-500 bg-[var(--bg-tertiary)] px-1 rounded">m</span>
								<span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">- Mass</span>
							</div>

							<div className="mt-4 p-4 border border-dashed border-[var(--border-primary)] rounded text-center text-[var(--text-faint)] text-xs">
								No more objects detected in current context.
							</div>
						</div>
					</div>
				</div>
			</div>
		</aside>
	);
}
