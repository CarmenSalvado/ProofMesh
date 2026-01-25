"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Thread {
	id: string;
	title: string;
	status: "active" | "verified" | "pending";
	author?: string;
}

interface SidebarProps {
	projectTitle?: string;
	threads?: Thread[];
	contributors?: { initials: string; name: string }[];
	dependencies?: { title: string; status: string }[];
}

export function Sidebar({
	projectTitle = "Current Project",
	threads = [],
	contributors = [],
	dependencies = [],
}: SidebarProps) {
	const pathname = usePathname();

	return (
		<aside className="w-64 border-r border-neutral-100 bg-neutral-50/30 flex flex-col h-[calc(100vh-56px)] sticky top-14">
			{/* Project */}
			<div className="p-4 border-b border-neutral-100">
				<div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
					Project
				</div>
				<div className="text-sm font-medium text-neutral-900">{projectTitle}</div>
			</div>

			{/* Canvases */}
			<div className="flex-1 overflow-y-auto">
				<div className="p-4">
					<div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
						Canvases
					</div>
					<div className="space-y-1">
						{threads.length === 0 ? (
							<p className="text-xs text-neutral-400">No canvases yet</p>
						) : (
							threads.map((thread) => (
								<Link
									key={thread.id}
									href={`#${thread.id}`}
									className={`flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${pathname?.includes(thread.id)
											? "bg-neutral-100 text-neutral-900"
											: "text-neutral-600 hover:bg-neutral-100"
										}`}
								>
									<span>{thread.title}</span>
									<div
										className={`w-2 h-2 rounded-full ${thread.status === "verified"
												? "bg-emerald-500"
												: thread.status === "pending"
													? "bg-amber-400"
													: "bg-neutral-300"
											}`}
									/>
								</Link>
							))
						)}
					</div>
				</div>

				{/* Contributors */}
				{contributors.length > 0 && (
					<div className="p-4 border-t border-neutral-100">
						<div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
							Contributors
						</div>
						<div className="space-y-2">
							{contributors.map((c, i) => (
								<div key={i} className="flex items-center gap-3">
									<div className="w-6 h-6 rounded bg-neutral-200 flex items-center justify-center text-[10px] text-neutral-600">
										{c.initials}
									</div>
									<span className="text-xs text-neutral-600">{c.name}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Dependencies */}
				{dependencies.length > 0 && (
					<div className="p-4 border-t border-neutral-100">
						<div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
							Dependencies
						</div>
						<div className="space-y-2">
							{dependencies.map((dep, i) => (
								<div key={i} className="flex items-center gap-2 text-xs text-neutral-500">
									<svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
									</svg>
									<span>{dep.title} ({dep.status})</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</aside>
	);
}
