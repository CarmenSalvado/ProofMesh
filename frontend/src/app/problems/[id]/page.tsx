"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getProblem, getCanvases, getLibraryItems, createCanvas, Problem, Canvas, LibraryItem } from "@/lib/api";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default function ProblemPage({ params }: PageProps) {
	const { user, isLoading: authLoading } = useAuth();
	const router = useRouter();
	const [problemId, setProblemId] = useState<string>("");
	const [problem, setProblem] = useState<Problem | null>(null);
	const [canvases, setCanvases] = useState<Canvas[]>([]);
	const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [creatingCanvas, setCreatingCanvas] = useState(false);

	useEffect(() => {
		params.then((p) => setProblemId(p.id));
	}, [params]);

	useEffect(() => {
		if (problemId) {
			loadData();
		}
	}, [problemId]);

	async function loadData() {
		try {
			setLoading(true);
			setError(null);

			const [problemData, canvasesData, libraryData] = await Promise.all([
				getProblem(problemId),
				getCanvases(problemId),
				getLibraryItems(problemId),
			]);

			setProblem(problemData);
			setCanvases(canvasesData.canvases);
			setLibraryItems(libraryData.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load workspace");
		} finally {
			setLoading(false);
		}
	}

	async function handleCreateCanvas() {
		try {
			setCreatingCanvas(true);
			const canvas = await createCanvas(problemId, { title: "Untitled Canvas" });
			router.push(`/problems/${problemId}/canvas/${canvas.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create canvas");
			setCreatingCanvas(false);
		}
	}

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

	if (!problem) return null;

	const isOwner = user?.id === problem.author.id;

	return (
		<main className="flex-1 flex flex-col h-full overflow-hidden">
			<WorkspaceHeader
				breadcrumbs={[
					{ label: "Workspaces", href: "/dashboard" },
					{ label: problem.title },
				]}
				status={null}
				showControls={false}
			/>

			<div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
				<div className="max-w-5xl mx-auto px-8 py-12">
					{/* Problem header */}
					<div className="mb-10">
						<div className="flex items-center gap-3 mb-4">
							<div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center">
								<span className="font-[var(--font-math)] text-xl text-[var(--accent-primary)]">∑</span>
							</div>
							<div>
								<h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)]">
									{problem.title}
								</h1>
								{problem.description && (
									<p className="text-sm text-[var(--text-muted)]">{problem.description}</p>
								)}
							</div>
						</div>

						<div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
							<span className="flex items-center gap-1.5">
								<div className="w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[9px] text-[var(--text-secondary)]">
									{problem.author.username.slice(0, 2).toUpperCase()}
								</div>
								{problem.author.username}
							</span>
							<span>·</span>
							<span>{problem.canvas_count} canvases</span>
							<span>·</span>
							<span>{problem.library_item_count} library items</span>
							<span>·</span>
							<span className={`badge ${problem.visibility === "public" ? "badge-public" : "badge-private"} ml-2`}>
								{problem.visibility}
							</span>
						</div>

						{problem.tags.length > 0 && (
							<div className="flex gap-2 mt-4">
								{problem.tags.map((tag) => (
									<span key={tag} className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[10px] rounded-full">
										{tag}
									</span>
								))}
							</div>
						)}
					</div>

					{/* Canvases */}
					<div className="mb-10">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
								Canvases
							</h2>
							{isOwner && (
								<button
									onClick={handleCreateCanvas}
									disabled={creatingCanvas}
									className="btn btn-primary disabled:opacity-50"
								>
									{creatingCanvas ? (
										<div className="animate-spin rounded-full h-3 w-3 border border-[var(--bg-primary)] border-t-transparent" />
									) : (
										<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
										</svg>
									)}
									New Canvas
								</button>
							)}
						</div>

						{canvases.length === 0 ? (
							<div className="border border-[var(--border-primary)] rounded-xl p-8 text-center bg-[var(--bg-primary)]">
								<p className="text-sm text-[var(--text-muted)] mb-4">No canvases yet</p>
								{isOwner && (
									<button onClick={handleCreateCanvas} className="btn btn-secondary">
										Create your first canvas
									</button>
								)}
							</div>
						) : (
							<div className="grid gap-3">
								{canvases.map((canvas) => (
									<Link
										key={canvas.id}
										href={`/problems/${problemId}/canvas/${canvas.id}`}
										className="flex items-center justify-between p-4 border border-[var(--border-primary)] rounded-xl hover:border-[var(--border-secondary)] hover:bg-[var(--bg-hover)] transition-all group bg-[var(--bg-primary)]"
									>
										<div className="flex items-center gap-4">
											<div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--bg-hover)] transition-colors">
												<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
												</svg>
											</div>
											<div>
												<h3 className="text-sm font-medium text-[var(--text-primary)] mb-0.5">{canvas.title}</h3>
												<p className="text-xs text-[var(--text-faint)]">
													Updated {new Date(canvas.updated_at).toLocaleDateString()}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-3">
											<span className={`badge badge-verified`}>
												{canvas.status}
											</span>
											<svg className="w-4 h-4 text-[var(--text-faint)] group-hover:text-[var(--text-muted)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
											</svg>
										</div>
									</Link>
								))}
							</div>
						)}
					</div>

					{/* Library Preview */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
								Library
							</h2>
							<span className="text-xs text-[var(--text-faint)]">{libraryItems.length} items</span>
						</div>

						{libraryItems.length === 0 ? (
							<div className="border border-[var(--border-primary)] rounded-lg p-8 text-center bg-[var(--bg-primary)]">
								<p className="text-sm text-[var(--text-muted)]">No library items yet</p>
							</div>
						) : (
							<div className="grid md:grid-cols-3 gap-3">
								{libraryItems.slice(0, 6).map((item) => (
									<div key={item.id} className="border border-[var(--border-primary)] rounded-lg p-4 hover:border-[var(--border-secondary)] transition-colors bg-[var(--bg-primary)]">
										<div className="flex items-center justify-between mb-2">
											<span className={`text-[10px] font-semibold uppercase tracking-widest ${item.kind === "lemma" ? "text-emerald-500" :
												item.kind === "definition" ? "text-indigo-500" :
													item.kind === "theorem" ? "text-amber-500" : "text-blue-500"
												}`}>
												{item.kind}
											</span>
											<span className="text-[10px] font-mono text-[var(--text-faint)]">
												#{item.id.slice(0, 8)}
											</span>
										</div>
										<h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">{item.title}</h4>
										{item.formula && (
											<div className="font-[var(--font-math)] text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded p-2 mb-2">
												{item.formula}
											</div>
										)}
										<span className={`badge ${item.status === "verified" ? "badge-verified" : "badge-draft"}`}>
											{item.status}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</main>
	);
}
