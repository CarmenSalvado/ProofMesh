"use client";

import React from "react";

// Text block component
export function TextBlock({ children }: { children: React.ReactNode }) {
	return (
		<div className="group relative">
			<div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-zinc-300">
				<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</div>
			<p className="text-base text-zinc-600 leading-relaxed font-light">
				{children}
			</p>
		</div>
	);
}

// Math inline span
export function MathInline({ children }: { children: React.ReactNode }) {
	return (
		<span className="font-[var(--font-math)] italic">{children}</span>
	);
}

// Definition / Primary block
interface DefinitionBlockProps {
	id?: string;
	title?: string;
	type?: "definition" | "lemma" | "theorem" | "claim";
	formula: React.ReactNode;
	note?: string;
}

export function DefinitionBlock({
	id = "1.1",
	title = "Primary Definition",
	type = "definition",
	formula,
	note,
}: DefinitionBlockProps) {
	const typeColors = {
		definition: "text-indigo-600 bg-indigo-600",
		lemma: "text-emerald-600 bg-emerald-600",
		theorem: "text-amber-600 bg-amber-600",
		claim: "text-blue-600 bg-blue-600",
	};

	return (
		<div className="group relative w-full my-10 rounded-xl border border-zinc-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
			{/* Left accent line */}
			<div className={`absolute top-0 left-0 w-1.5 h-full ${typeColors[type].split(" ")[1]}`} />

			{/* Card header */}
			<div className="bg-zinc-50/50 border-b border-zinc-100 px-5 py-3 flex justify-between items-center backdrop-blur-sm">
				<span className={`text-xs font-semibold ${typeColors[type].split(" ")[0]} uppercase tracking-widest flex items-center gap-2`}>
					<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
					</svg>
					{title} {id}
				</span>
				<div className="flex gap-2">
					<button className="text-zinc-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50">
						<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
						</svg>
					</button>
					<button className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded hover:bg-zinc-100">
						<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
						</svg>
					</button>
				</div>
			</div>

			{/* Card body with grid texture */}
			<div className="p-10 flex flex-col items-center justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
				<div className="font-[var(--font-math)] text-3xl text-zinc-900 tracking-wide">
					{formula}
				</div>
				{note && (
					<p className="mt-4 text-xs text-zinc-400 font-mono text-center">
						{note}
					</p>
				)}
			</div>
		</div>
	);
}

// Agent suggestion block
interface AgentSuggestionProps {
	agentName?: string;
	isTyping?: boolean;
	content: React.ReactNode;
	formula?: React.ReactNode;
	onAccept?: () => void;
	onRefine?: () => void;
}

export function AgentSuggestion({
	agentName = "Analytic Bot",
	isTyping = true,
	content,
	formula,
	onAccept,
	onRefine,
}: AgentSuggestionProps) {
	return (
		<div className="group relative my-6">
			<div className="absolute -left-10 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-emerald-200 to-transparent" />

			<div className="flex items-center gap-2 mb-2">
				{isTyping && (
					<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
				)}
				<span className="text-xs font-medium text-emerald-700">
					{isTyping ? `${agentName} is typing...` : agentName}
				</span>
			</div>

			<div className="bg-white border border-emerald-100 shadow-sm shadow-emerald-100/50 rounded-lg p-5">
				<p className="text-sm text-zinc-700 mb-3 font-light">
					{content}
				</p>
				{formula && (
					<div className="font-[var(--font-math)] text-lg text-zinc-800 text-center bg-zinc-50 rounded p-3 border border-zinc-100">
						{formula}
					</div>
				)}
				<div className="mt-3 flex gap-2">
					<button
						onClick={onAccept}
						className="px-3 py-1 bg-zinc-50 hover:bg-emerald-50 text-zinc-600 hover:text-emerald-700 border border-zinc-200 hover:border-emerald-200 rounded text-xs transition-colors"
					>
						Accept
					</button>
					<button
						onClick={onRefine}
						className="px-3 py-1 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 border border-zinc-200 rounded text-xs transition-colors"
					>
						Refine
					</button>
				</div>
			</div>
		</div>
	);
}

// Placeholder block
export function PlaceholderBlock() {
	return (
		<div className="group relative opacity-50 hover:opacity-100 transition-opacity">
			<div className="text-zinc-300 text-base font-[var(--font-math)] italic">
				Write next step or type '/' for commands...
			</div>
		</div>
	);
}
