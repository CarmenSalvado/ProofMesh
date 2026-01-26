"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getProblems, Problem } from "@/lib/api";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

export default function DashboardPage() {
	const { user, isLoading: authLoading } = useAuth();
	const router = useRouter();
	const [problems, setProblems] = useState<Problem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!authLoading && !user) {
			router.push("/login");
		}
	}, [authLoading, user, router]);

	useEffect(() => {
		if (user) {
			loadProblems();
		}
	}, [user]);

	async function loadProblems() {
		try {
			setLoading(true);
			const data = await getProblems({ mine: true });
			setProblems(data.problems);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load problems");
		} finally {
			setLoading(false);
		}
	}

	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
				<div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
			</div>
		);
	}

	if (!user) return null;

	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
			<WorkspaceSidebar />

			<main className="flex-1 flex flex-col h-full">
				<WorkspaceHeader
					breadcrumbs={[{ label: "Dashboard" }]}
					status={null}
				/>

				<div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
					<div className="max-w-4xl mx-auto px-8 py-12">
						{/* Welcome */}
						<div className="mb-12">
							<h1 className="text-3xl font-medium tracking-tight text-[var(--text-primary)] mb-2">
								Welcome back, {user.username}
							</h1>
							<p className="text-[var(--text-muted)] font-light">
								Your reasoning workspace is ready.
							</p>
						</div>

						{/* Quick actions */}
						<div className="grid md:grid-cols-3 gap-4 mb-16">
							<Link
								href="/workspaces/new"
								className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-6 hover:border-[var(--border-secondary)] hover:shadow-[var(--shadow-lg)] transition-all group"
							>
								<div className="w-10 h-10 border border-[var(--border-primary)] rounded-lg flex items-center justify-center mb-4 group-hover:border-[var(--border-secondary)] group-hover:bg-[var(--bg-tertiary)] transition-colors">
									<svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
									</svg>
								</div>
								<h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">New Workspace File</h3>
								<p className="text-xs text-[var(--text-muted)]">Create a file inside an existing problem</p>
							</Link>

							<Link
								href="/catalog"
								className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-6 hover:border-[var(--border-secondary)] hover:shadow-[var(--shadow-lg)] transition-all group"
							>
								<div className="w-10 h-10 border border-[var(--border-primary)] rounded-lg flex items-center justify-center mb-4 group-hover:border-[var(--border-secondary)] group-hover:bg-[var(--bg-tertiary)] transition-colors">
									<svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
									</svg>
								</div>
								<h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">Browse Problems</h3>
								<p className="text-xs text-[var(--text-muted)]">Explore open problems from the community</p>
							</Link>

							<button
								onClick={loadProblems}
								className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-6 hover:border-[var(--border-secondary)] hover:shadow-[var(--shadow-lg)] transition-all group text-left"
							>
								<div className="w-10 h-10 border border-[var(--border-primary)] rounded-lg flex items-center justify-center mb-4 group-hover:border-[var(--border-secondary)] group-hover:bg-[var(--bg-tertiary)] transition-colors">
									<svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
									</svg>
								</div>
								<h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">Refresh</h3>
								<p className="text-xs text-[var(--text-muted)]">Reload your problems</p>
							</button>
						</div>

						{/* Recent Problems */}
						<div>
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">
									Your Problems
								</h2>
								<span className="text-xs text-[var(--text-faint)]">{problems.length} total</span>
							</div>

							{error && (
								<div className="border border-[var(--error)] bg-[var(--error-bg)] rounded-lg p-4 mb-4 text-sm text-[var(--error)]">
									{error}
								</div>
							)}

							{loading ? (
								<div className="flex items-center justify-center py-12">
									<div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
								</div>
							) : problems.length === 0 ? (
								<div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-12 text-center">
									<h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">No problems yet</h3>
									<p className="text-xs text-[var(--text-muted)] mb-4">Create your first problem space to get started</p>
									<Link href="/problems/new" className="btn btn-primary">
										<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
										</svg>
										Create Problem
									</Link>
								</div>
							) : (
								<div className="space-y-2">
									{problems.map((problem) => (
										<Link
											key={problem.id}
											href={`/problems/${problem.id}`}
											className="flex items-center justify-between p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg hover:border-[var(--border-secondary)] hover:bg-[var(--bg-hover)] transition-all group"
										>
											<div className="flex items-center gap-4">
												<div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-md flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--bg-hover)] transition-colors">
													<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
													</svg>
												</div>
												<div>
													<h3 className="text-sm font-medium text-[var(--text-primary)]">{problem.title}</h3>
													<p className="text-xs text-[var(--text-faint)]">
														{problem.library_item_count} items ·{" "}
														{new Date(problem.updated_at).toLocaleDateString()}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<span className={`badge ${problem.visibility === "public" ? "badge-public" : "badge-private"}`}>
													{problem.visibility}
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
					</div>
				</div>
			</main>
		</div>
	);
}
