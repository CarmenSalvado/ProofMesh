"use client";

import Link from "next/link";
import { useTheme } from "@/hooks/useTheme";

interface WorkspaceHeaderProps {
	breadcrumbs?: { label: string; href?: string }[];
	status?: "draft" | "verified" | "reviewing" | null;
}

export function WorkspaceHeader({
	breadcrumbs = [],
	status = null,
}: WorkspaceHeaderProps) {
	const { resolvedTheme, toggleTheme } = useTheme();

	const statusConfig = {
		draft: { label: "Draft", className: "badge-draft" },
		verified: { label: "Verified", className: "badge-verified" },
		reviewing: { label: "Reviewing", className: "bg-indigo-50 text-indigo-600 border border-indigo-100" },
	};

	return (
		<header className="h-14 border-b border-[var(--border-primary)] flex items-center justify-between px-6 bg-[var(--bg-primary)]/80 backdrop-blur-md sticky top-0 z-20">
			<div className="flex items-center gap-4">
				{/* Breadcrumbs */}
				{breadcrumbs.length > 0 && (
					<div className="flex items-center text-xs text-[var(--text-muted)]">
						{breadcrumbs.map((crumb, i) => (
							<span key={i} className="flex items-center">
								{i > 0 && (
									<svg className="w-3 h-3 mx-2 text-[var(--text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
									</svg>
								)}
								{crumb.href ? (
									<Link href={crumb.href} className="hover:text-[var(--text-secondary)] transition-colors">
										{crumb.label}
									</Link>
								) : i === breadcrumbs.length - 1 ? (
									<span className="text-[var(--text-primary)] font-medium">{crumb.label}</span>
								) : (
									<span className="hover:text-[var(--text-secondary)] cursor-pointer transition-colors">{crumb.label}</span>
								)}
							</span>
						))}
					</div>
				)}

				{/* Status badge - Only show if status is provided */}
				{status && (
					<span className={`badge ${statusConfig[status].className}`}>
						{statusConfig[status].label}
					</span>
				)}
			</div>

			<div className="flex items-center gap-4">
				{/* Theme toggle */}
				<button
					onClick={toggleTheme}
					className="theme-toggle"
					title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
				>
					{resolvedTheme === "light" ? (
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
						</svg>
					) : (
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
						</svg>
					)}
				</button>

			</div>
		</header>
	);
}
