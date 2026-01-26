"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getProblem, getLibraryItems, Problem, LibraryItem } from "@/lib/api";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default function ProblemPage({ params }: PageProps) {
	const { isLoading: authLoading } = useAuth();
	const { id: problemId } = use(params);
	const [problem, setProblem] = useState<Problem | null>(null);
	const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const groupedItems = useMemo(() => {
		const groups = {
			resources: [] as LibraryItem[],
			ideas: [] as LibraryItem[],
			lemmas: [] as LibraryItem[],
			contents: [] as LibraryItem[],
		};
		libraryItems.forEach((item) => {
			if (item.kind === "resource") {
				groups.resources.push(item);
			} else if (item.kind === "idea") {
				groups.ideas.push(item);
			} else if (["lemma", "theorem", "claim", "counterexample"].includes(item.kind)) {
				groups.lemmas.push(item);
			} else {
				groups.contents.push(item);
			}
		});
		return groups;
	}, [libraryItems]);
	const kindStyles: Record<string, string> = {
		resource: "text-slate-500",
		idea: "text-fuchsia-500",
		content: "text-cyan-500",
		lemma: "text-emerald-500",
		claim: "text-blue-500",
		definition: "text-indigo-500",
		theorem: "text-amber-500",
		counterexample: "text-red-500",
		computation: "text-purple-500",
		note: "text-zinc-500",
	};

	const loadData = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			const [problemData, libraryData] = await Promise.all([
				getProblem(problemId),
				getLibraryItems(problemId),
			]);

			setProblem(problemData);
			setLibraryItems(libraryData.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load problem");
		} finally {
			setLoading(false);
		}
	}, [problemId]);

	useEffect(() => {
		if (problemId) {
			loadData();
		}
	}, [problemId, loadData]);

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

	return (
		<main className="flex-1 flex flex-col h-full overflow-hidden">
			<WorkspaceHeader
				breadcrumbs={[
					{ label: "Problems", href: "/dashboard" },
					{ label: problem.title },
				]}
				status={null}
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

						<div className="mt-6 flex flex-wrap gap-3">
							<Link href={`/problems/${problemId}/lab`} className="btn btn-primary">
								Open Workspace Files
							</Link>
						</div>
					</div>

					{/* Problem Space */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
								Problem Space
							</h2>
							<span className="text-xs text-[var(--text-faint)]">{libraryItems.length} total</span>
						</div>

						{libraryItems.length === 0 ? (
							<div className="border border-[var(--border-primary)] rounded-lg p-8 text-center bg-[var(--bg-primary)]">
								<p className="text-sm text-[var(--text-muted)]">No shared items yet</p>
							</div>
						) : (
							<div className="grid md:grid-cols-2 gap-4">
								{[
									{ key: "resources", label: "Resources" },
									{ key: "ideas", label: "Ideas" },
									{ key: "lemmas", label: "Lemmas" },
									{ key: "contents", label: "Contents" },
								].map((section) => {
									const items = groupedItems[section.key as keyof typeof groupedItems];
									return (
										<div
											key={section.key}
											className="border border-[var(--border-primary)] rounded-lg p-4 bg-[var(--bg-primary)]"
										>
											<div className="flex items-center justify-between mb-3">
												<h3 className="text-sm font-medium text-[var(--text-primary)]">{section.label}</h3>
												<span className="text-xs text-[var(--text-faint)]">{items.length}</span>
											</div>
											{items.length === 0 ? (
												<p className="text-xs text-[var(--text-muted)]">No items yet</p>
											) : (
												<div className="space-y-2">
													{items.slice(0, 3).map((item) => (
														<div key={item.id} className="flex items-center justify-between text-xs">
															<span className="truncate text-[var(--text-secondary)]">{item.title}</span>
															<span className={`text-[10px] uppercase ${kindStyles[item.kind] || "text-[var(--text-faint)]"}`}>
																{item.kind}
															</span>
														</div>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{/* Recent Items */}
					{libraryItems.length > 0 && (
						<div className="mt-10">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
									Recent Updates
								</h2>
								<span className="text-xs text-[var(--text-faint)]">{libraryItems.length} items</span>
							</div>
							<div className="grid md:grid-cols-3 gap-3">
								{libraryItems.slice(0, 6).map((item) => (
									<div key={item.id} className="border border-[var(--border-primary)] rounded-lg p-4 hover:border-[var(--border-secondary)] transition-colors bg-[var(--bg-primary)]">
										<div className="flex items-center justify-between mb-2">
											<span className={`text-[10px] font-semibold uppercase tracking-widest ${kindStyles[item.kind] || "text-[var(--text-faint)]"}`}>
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
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
