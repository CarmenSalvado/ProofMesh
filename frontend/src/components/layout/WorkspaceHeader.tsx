"use client";

import Link from "next/link";

interface WorkspaceHeaderProps {
	breadcrumbs?: { label: string; href?: string }[];
	status?: "draft" | "verified" | "reviewing" | null;
}

export function WorkspaceHeader({
	breadcrumbs = [],
	status = null,
}: WorkspaceHeaderProps) {

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
		</header>
	);
}
