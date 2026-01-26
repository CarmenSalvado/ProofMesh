"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { createProblem } from "@/lib/api";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

export default function NewProblemPage() {
	const { user, isLoading: authLoading } = useAuth();
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [visibility, setVisibility] = useState<"private" | "public">("private");
	const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "">("medium");
	const [tags, setTags] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
				<div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
			</div>
		);
	}

	if (!user) {
		router.push("/login");
		return null;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim()) {
			setError("Title is required");
			return;
		}

		try {
			setLoading(true);
			setError("");

			const problem = await createProblem({
				title: title.trim(),
				description: description.trim() || undefined,
				visibility,
				difficulty: difficulty || undefined,
				tags: tags.split(",").map(t => t.trim()).filter(Boolean),
			});

			router.push(`/problems/${problem.id}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create problem");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
			<WorkspaceSidebar />

			<main className="flex-1 flex flex-col h-full">
				<WorkspaceHeader
					breadcrumbs={[
						{ label: "Dashboard", href: "/dashboard" },
						{ label: "New Problem" },
					]}
					status={null}
				/>

				<div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
					<div className="max-w-2xl mx-auto px-8 py-12">
						<div className="mb-8">
							<h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)] mb-2">
								Create New Problem
							</h1>
							<p className="text-sm text-[var(--text-muted)]">
								Define a problem space for shared work
							</p>
						</div>

						{error && (
							<div className="border border-[var(--error)] bg-[var(--error-bg)] rounded-lg p-4 mb-6 text-sm text-[var(--error)]">
								{error}
							</div>
						)}

						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Title */}
							<div>
								<label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
									Title <span className="text-[var(--error)]">*</span>
								</label>
								<input
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="e.g., Prime Gap Exploration"
									className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
									required
								/>
							</div>

							{/* Description */}
							<div>
								<label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
									Description
								</label>
								<textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Briefly describe the problem and current context..."
									rows={4}
									className="w-full resize-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
								/>
							</div>

							{/* Visibility & Difficulty */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
										Visibility
									</label>
									<select
										value={visibility}
										onChange={(e) => setVisibility(e.target.value as "private" | "public")}
										className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
									>
										<option value="private">Private</option>
										<option value="public">Public</option>
									</select>
								</div>

								<div>
									<label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
										Difficulty
									</label>
									<select
										value={difficulty}
										onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
										className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
									>
										<option value="">Not specified</option>
										<option value="easy">Easy</option>
										<option value="medium">Medium</option>
										<option value="hard">Hard</option>
									</select>
								</div>
							</div>

							{/* Tags */}
							<div>
								<label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
									Tags
								</label>
								<input
									type="text"
									value={tags}
									onChange={(e) => setTags(e.target.value)}
									placeholder="number-theory, analysis, topology"
									className="w-full bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] focus:border-[var(--accent-primary)]"
								/>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-3 pt-4">
								<button
									type="submit"
									disabled={loading}
									className="btn btn-primary disabled:opacity-50"
								>
									{loading ? (
										<>
											<div className="animate-spin rounded-full h-3 w-3 border border-[var(--bg-primary)] border-t-transparent" />
											Creating...
										</>
									) : (
										<>
											<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
											</svg>
											Create Problem
										</>
									)}
								</button>
								<Link href="/dashboard" className="btn btn-secondary">
									Cancel
								</Link>
							</div>
						</form>
					</div>
				</div>
			</main>
		</div>
	);
}
