"use client";

import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

type LibraryItemKind = "lemma" | "claim" | "definition" | "theorem" | "counterexample" | "computation" | "note" | "conjecture";
type LibraryItemStatus = "proposed" | "verified" | "rejected";

interface LibraryCardProps {
	id: string;
	itemId: string;
	title: string;
	kind: LibraryItemKind;
	status: LibraryItemStatus;
	content: string;
	formula?: string;
	description?: string;
	linkedTo?: string;
	agentName?: string;
	onClick?: () => void;
}

const kindConfig: Record<LibraryItemKind, { label: string; color: string; bg: string }> = {
	lemma: { label: "LEMMA", color: "text-emerald-700", bg: "bg-emerald-50" },
	claim: { label: "CLAIM", color: "text-blue-700", bg: "bg-blue-50" },
	definition: { label: "DEF", color: "text-indigo-700", bg: "bg-indigo-50" },
	theorem: { label: "THM", color: "text-amber-700", bg: "bg-amber-50" },
	computation: { label: "COMP", color: "text-purple-700", bg: "bg-purple-50" },
	conjecture: { label: "CONJ", color: "text-pink-700", bg: "bg-pink-50" },
	counterexample: { label: "COUNTER", color: "text-red-700", bg: "bg-red-50" },
	note: { label: "NOTE", color: "text-zinc-700", bg: "bg-zinc-100" },
};

const statusConfig: Record<LibraryItemStatus, { label: string; color: string; bg: string }> = {
	verified: { label: "Verified", color: "text-emerald-600", bg: "bg-emerald-50" },
	proposed: { label: "Proposed", color: "text-amber-600", bg: "bg-amber-50" },
	rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-50" },
};

export function LibraryCard({
	id,
	itemId,
	title,
	kind,
	status,
	content,
	formula,
	description,
	linkedTo,
	agentName,
	onClick,
}: LibraryCardProps) {
	const kindCfg = kindConfig[kind] || kindConfig.note;
	const statusCfg = statusConfig[status] || statusConfig.proposed;

	return (
		<div
			onClick={onClick}
			className="border border-zinc-200 rounded-xl p-4 flex flex-col gap-3 hover:border-zinc-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.04)] transition-all cursor-pointer bg-white"
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${kindCfg.color} ${kindCfg.bg}`}>
						{kindCfg.label}
					</span>
					<span className="text-[10px] text-zinc-400 font-mono">#{itemId.slice(0, 8)}</span>
				</div>
				<button
					onClick={(e) => { e.stopPropagation(); }}
					className="text-zinc-300 hover:text-zinc-500 p-1 transition-colors"
				>
					<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
					</svg>
				</button>
			</div>

			{/* Title */}
			<h3 className="text-sm font-medium text-zinc-900">{title}</h3>

			{/* Formula (LaTeX) */}
			{formula && (
				<div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
					<MarkdownRenderer
						content={`$$${formula}$$`}
						className="text-sm [&_.katex]:text-base"
					/>
				</div>
			)}

			{/* Content preview */}
			{content && !formula && (
				<div className="text-sm text-zinc-600 line-clamp-3">
					<MarkdownRenderer content={content} className="prose-sm" />
				</div>
			)}

			{/* Description */}
			{description && (
				<p className="text-xs text-zinc-400 line-clamp-2">{description}</p>
			)}

			{/* Footer */}
			<div className="flex items-center justify-between pt-2 border-t border-zinc-100">
				<div className={`flex items-center gap-1.5 text-[10px] font-medium ${statusCfg.color}`}>
					{status === "verified" && (
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
						</svg>
					)}
					{status === "proposed" && (
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
						</svg>
					)}
					{status === "rejected" && (
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
						</svg>
					)}
					{statusCfg.label}
				</div>

				<div className="flex items-center gap-3">
					{linkedTo && (
						<div className="flex items-center gap-1 text-[10px] text-zinc-400">
							<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
							</svg>
							{linkedTo}
						</div>
					)}

					{agentName && (
						<div className="flex items-center gap-1 text-[10px] text-zinc-400">
							<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
							</svg>
							{agentName}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
