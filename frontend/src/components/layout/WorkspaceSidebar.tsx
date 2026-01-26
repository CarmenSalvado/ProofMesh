"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getProblems, Problem } from "@/lib/api";

export function WorkspaceSidebar() {
	const pathname = usePathname();
	const { user, logout } = useAuth();
	const [problems, setProblems] = useState<Problem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (user) {
			loadProblems();
		}
	}, [user]);

	async function loadProblems() {
		try {
			const data = await getProblems({ mine: true });
			setProblems(data.problems.slice(0, 5));
		} catch (err) {
			console.error("Failed to load problems:", err);
		} finally {
			setLoading(false);
		}
	}

	const iconPaths = {
		home: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
		book: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
		users: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.199l.001.001m-4.4-4.85a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zm-7.5 0a7.5 7.5 0 00-7.5 7.5v.75h15v-.75a7.5 7.5 0 00-7.5-7.5",
		plus: "M12 4.5v15m7.5-7.5h-15",
		settings: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z",
	};

	return (
		<aside className="w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] flex-col justify-between hidden md:flex h-screen">
			<div className="p-4">
				{/* Logo */}
				<Link href="/dashboard" className="flex items-center gap-3 px-2 mb-8 hover:opacity-80 transition-opacity">
					<div className="w-6 h-6 bg-[var(--text-primary)] rounded-md flex items-center justify-center text-[var(--bg-primary)]">
						<span className="font-[var(--font-math)] italic text-sm">∑</span>
					</div>
					<span className="text-sm font-medium tracking-tight text-[var(--text-primary)]">PROOFMESH</span>
				</Link>

				{/* Main Nav */}
				<nav className="space-y-1">
					<Link
						href="/dashboard"
						className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === "/dashboard"
								? "text-[var(--text-primary)] bg-[var(--bg-primary)] shadow-sm border border-[var(--border-primary)]"
								: "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
							}`}
					>
						<svg className="w-4 h-4 text-[var(--text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths.home} />
						</svg>
						Dashboard
					</Link>
					<Link
						href="/social"
						className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === "/social"
								? "text-[var(--text-primary)] bg-[var(--bg-primary)] shadow-sm border border-[var(--border-primary)]"
								: "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
							}`}
					>
						<svg className="w-4 h-4 text-[var(--text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths.users} />
						</svg>
						Social
					</Link>

					<Link
						href="/workspaces/new"
						className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === "/workspaces/new"
								? "text-[var(--text-primary)] bg-[var(--bg-primary)] shadow-sm border border-[var(--border-primary)]"
								: "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
							}`}
					>
						<svg className="w-4 h-4 text-[var(--text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths.plus} />
						</svg>
						New Workspace File
					</Link>
				</nav>

				{/* Problems */}
				<div className="mt-8">
					<p className="px-2 text-[10px] font-medium text-[var(--text-faint)] uppercase tracking-widest mb-2">
						Recent Problems
					</p>
					<nav className="space-y-1">
						{loading ? (
							<div className="px-2 py-2">
								<div className="animate-pulse flex items-center gap-3">
									<div className="w-4 h-4 bg-[var(--border-primary)] rounded" />
									<div className="h-3 bg-[var(--border-primary)] rounded flex-1" />
								</div>
							</div>
						) : problems.length === 0 ? (
							<p className="px-2 py-2 text-[11px] text-[var(--text-faint)]">No problems yet</p>
						) : (
							problems.map((problem) => (
								<Link
									key={problem.id}
									href={`/problems/${problem.id}`}
									className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-xs font-medium transition-all truncate ${pathname?.includes(problem.id)
											? "text-[var(--text-primary)] bg-[var(--bg-primary)] shadow-sm border border-[var(--border-primary)]"
											: "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
										}`}
								>
									<svg
										className={`w-4 h-4 flex-shrink-0 ${pathname?.includes(problem.id) ? "text-[var(--accent-primary)]" : "text-[var(--text-faint)]"}`}
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths.book} />
									</svg>
									<span className="truncate">{problem.title}</span>
								</Link>
							))
						)}
					</nav>
				</div>

				{/* Settings Link */}
				<div className="mt-8">
					<Link
						href="/settings"
						className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === "/settings"
								? "text-[var(--text-primary)] bg-[var(--bg-primary)] shadow-sm border border-[var(--border-primary)]"
								: "text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
							}`}
					>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths.settings} />
						</svg>
						Settings
					</Link>
				</div>
			</div>

			{/* User */}
			{user && (
				<div className="p-4 border-t border-[var(--border-primary)]">
					<div className="flex items-center gap-3 w-full hover:bg-[var(--bg-hover)] p-2 rounded-md transition-colors">
						<div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[var(--border-secondary)] to-[var(--text-faint)] flex items-center justify-center text-[10px] font-medium text-[var(--bg-primary)] ring-1 ring-[var(--bg-primary)] shadow-sm">
							{user.username.slice(0, 2).toUpperCase()}
						</div>
						<div className="text-left flex-1 min-w-0">
							<p className="text-xs font-medium text-[var(--text-primary)] truncate">{user.username}</p>
							<p className="text-[10px] text-[var(--text-faint)] truncate">{user.email}</p>
						</div>
						<button
							onClick={logout}
							className="text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
							title="Logout"
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
							</svg>
						</button>
					</div>
				</div>
			)}
		</aside>
	);
}
