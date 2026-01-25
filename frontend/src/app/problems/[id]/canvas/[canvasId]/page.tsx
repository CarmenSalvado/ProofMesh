"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getProblem, getCanvas, updateCanvas, Problem, Canvas } from "@/lib/api";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { ToolsPanel } from "@/components/layout/ToolsPanel";
import { TiptapEditor } from "@/components/editor/TiptapEditor";
import { useWebSocket } from "@/hooks/useWebSocket";

interface PageProps {
	params: Promise<{ id: string; canvasId: string }>;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);

	useEffect(() => {
		const handler = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(handler);
	}, [value, delay]);

	return debouncedValue;
}

export default function CanvasPage({ params }: PageProps) {
	const { user, isLoading: authLoading } = useAuth();
	const router = useRouter();

	const [problemId, setProblemId] = useState<string>("");
	const [canvasId, setCanvasId] = useState<string>("");
	const [problem, setProblem] = useState<Problem | null>(null);
	const [canvas, setCanvas] = useState<Canvas | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [autoProve, setAutoProve] = useState(false);
	const [saving, setSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");

	// WebSocket connection
	const { isConnected, logs, agents, runAgents, stopAgents, sendChat } = useWebSocket({
		canvasId: canvasId || "waiting",
	});

	// Debounced content for auto-save
	const debouncedContent = useDebounce(content, 1000);
	const debouncedTitle = useDebounce(title, 1000);

	useEffect(() => {
		params.then((p) => {
			setProblemId(p.id);
			setCanvasId(p.canvasId);
		});
	}, [params]);

	useEffect(() => {
		if (problemId && canvasId) {
			loadData();
		}
	}, [problemId, canvasId]);

	// Auto-save effect
	useEffect(() => {
		if (canvas && (debouncedContent !== canvas.content || debouncedTitle !== canvas.title)) {
			saveCanvas();
		}
	}, [debouncedContent, debouncedTitle]);

	async function loadData() {
		try {
			setLoading(true);
			setError(null);

			const [problemData, canvasData] = await Promise.all([
				getProblem(problemId),
				getCanvas(problemId, canvasId),
			]);

			setProblem(problemData);
			setCanvas(canvasData);
			setTitle(canvasData.title);
			setContent(canvasData.content);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load canvas");
		} finally {
			setLoading(false);
		}
	}

	async function saveCanvas() {
		if (!canvas) return;

		try {
			setSaving(true);
			await updateCanvas(problemId, canvasId, {
				title: title || "Untitled",
				content,
			});
			setLastSaved(new Date());
		} catch (err) {
			console.error("Failed to save:", err);
		} finally {
			setSaving(false);
		}
	}

	const handleRunAgents = useCallback(() => {
		runAgents();
		setAutoProve(true);
	}, [runAgents]);

	const handleStopAgents = useCallback(() => {
		stopAgents();
		setAutoProve(false);
	}, [stopAgents]);

	if (authLoading || loading) {
		return (
			<div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)] h-full">
				<div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)] h-full">
				<div className="text-center">
					<h1 className="text-xl font-medium text-[var(--text-primary)] mb-2">Error</h1>
					<p className="text-sm text-[var(--text-muted)] mb-4">{error}</p>
					<Link href="/dashboard" className="btn btn-primary">
						Back to Dashboard
					</Link>
				</div>
			</div>
		);
	}

	if (!problem || !canvas) return null;

	return (
		<main className="flex-1 flex flex-col h-full relative overflow-hidden">
			<WorkspaceHeader
				breadcrumbs={[
					{ label: "Workspaces", href: "/dashboard" },
					{ label: problem.title, href: `/problems/${problemId}` },
					{ label: title || "Untitled" },
				]}
				status={canvas.status}
				autoProveEnabled={autoProve}
				onAutoProveToggle={(enabled) => {
					if (enabled) handleRunAgents();
					else handleStopAgents();
				}}
				onRunAgents={handleRunAgents}
			/>

			{/* Editor & Agent Split View */}
			<div className="flex-1 flex overflow-hidden">
				{/* Editor Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{/* View Mode Toggle */}
					{/* Content Area - Unified Editor */}
					<div className="flex-1 overflow-y-auto bg-[var(--bg-primary)] relative">
						{/* Background Grid Pattern */}
						<div className="absolute inset-0 z-0 opacity-40 bg-grid pointer-events-none" />

						<div className="relative z-10 max-w-4xl mx-auto px-12 py-16 min-h-full">
							<div className="flex items-center justify-between mb-8">
								{/* Save indicator */}
								<div className="flex items-center gap-2">
									{isConnected && (
										<span className="flex items-center gap-1 text-[10px] text-[var(--success)]">
											<span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
											Live
										</span>
									)}
									<span className="text-[10px] text-[var(--text-muted)]">
										{saving ? (
											<span className="flex items-center gap-1">
												<div className="animate-spin rounded-full h-2 w-2 border border-[var(--text-muted)] border-t-transparent" />
												Saving...
											</span>
										) : lastSaved ? (
											<span>Saved {lastSaved.toLocaleTimeString()}</span>
										) : null}
									</span>
								</div>
							</div>

							{/* Title Input */}
							<input
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="w-full text-5xl font-bold tracking-tight text-[var(--text-primary)] bg-transparent outline-none placeholder:text-[var(--text-faint)] mb-8 border-none p-0 font-[var(--font-math)] focus:ring-0 focus:shadow-none"
								placeholder="Untitled"
							/>

							{/* Notion-style Editor */}
							<div className="min-h-[50vh]">
								<TiptapEditor
									content={content}
									onChange={setContent}
									editable={true}
								/>
							</div>
						</div>
					</div>


				</div>
				{/* Agent Orchestration Panel (Right) */}
				<ToolsPanel
					isConnected={isConnected}
					agents={agents}
					logs={logs}
					onRunAgents={handleRunAgents}
					onStopAgents={handleStopAgents}
					onSendChat={sendChat}
				/>
			</div>
		</main >
	);
}
