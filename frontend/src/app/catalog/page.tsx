"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getProblems, Problem } from "@/lib/api";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

export default function CatalogPage() {
	const { user, isLoading: authLoading } = useAuth();
	const router = useRouter();
	const [problems, setProblems] = useState<Problem[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		if (!authLoading && !user) {
			router.push("/login");
		}
	}, [authLoading, user, router]);

	useEffect(() => {
		loadProblems();
	}, []);

	async function loadProblems() {
		try {
			setLoading(true);
			const data = await getProblems({ visibility: "public" });
			setProblems(data.problems);
		} catch (err) {
			console.error("Failed to load problems:", err);
		} finally {
			setLoading(false);
		}
	}

	const filteredProblems = problems.filter(
		(p) =>
			p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
				<div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
			<WorkspaceSidebar />

			<main className="flex-1 flex flex-col h-full">
				<WorkspaceHeader
					breadcrumbs={[
						{ label: "Dashboard", href: "/dashboard" },
						{ label: "Catalog" },
					]}
					status={null}
					showControls={false}
				/>

				<div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
					<div className="max-w-5xl mx-auto px-8 py-12">
						<div className="mb-8">
							<h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)] mb-2">
								Problem Catalog
							</h1>
							<p className="text-sm text-[var(--text-muted)]">
								Explore public mathematical problems from the community
							</p>
						</div>

						{/* Search */}
						<div className="mb-8">
							<div className="relative">
								<svg
									className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-faint)]"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
									/>
								</svg>
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search problems by title, description, or tags..."
									className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] text-[var(--text-primary)]"
								/>
							</div>
						</div>

						{/* Results */}
						{loading ? (
							<div className="flex items-center justify-center py-12">
								<div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
							</div>
						) : filteredProblems.length === 0 ? (
							<div className="border border-[var(--border-primary)] rounded-xl p-12 text-center bg-[var(--bg-primary)]">
								<h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">No problems found</h3>
								<p className="text-xs text-[var(--text-muted)]">
									{searchQuery ? "Try a different search term" : "No public problems available yet"}
								</p>
							</div>
						) : (
							<div className="grid gap-4">
								{filteredProblems.map((problem) => (
									<Link
										key={problem.id}
										href={`/problems/${problem.id}`}
										className="border border-[var(--border-primary)] bg-[var(--bg-primary)] rounded-xl p-6 hover:border-[var(--border-secondary)] hover:shadow-[var(--shadow-lg)] transition-all group"
									>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<h3 className="text-base font-medium text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-primary)] transition-colors">
													{problem.title}
												</h3>
												{problem.description && (
													<p className="text-sm text-[var(--text-muted)] mb-3 line-clamp-2">
														{problem.description}
													</p>
												)}
												<div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
													<span className="flex items-center gap-1">
														<div className="w-4 h-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[8px] text-[var(--text-secondary)]">
															{problem.author.username.slice(0, 2).toUpperCase()}
														</div>
														{problem.author.username}
													</span>
													<span>·</span>
													<span>{problem.canvas_count} canvases</span>
													<span>·</span>
													<span>{problem.library_item_count} items</span>
												</div>
											</div>
											{problem.difficulty && (
												<span
													className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${problem.difficulty === "easy"
														? "bg-[var(--success-bg)] text-[var(--success)]"
														: problem.difficulty === "medium"
															? "bg-[var(--warning-bg)] text-[var(--warning)]"
															: "bg-[var(--error-bg)] text-[var(--error)]"
														}`}
												>
													{problem.difficulty}
												</span>
											)}
										</div>
										{problem.tags.length > 0 && (
											<div className="flex gap-2 mt-4">
												{problem.tags.slice(0, 5).map((tag) => (
													<span
														key={tag}
														className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-[10px] rounded-full"
													>
														{tag}
													</span>
												))}
											</div>
										)}
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
