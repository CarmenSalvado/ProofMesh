"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
// KaTeX CSS loaded from CDN in layout.tsx for Firefox compatibility

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

export function MarkdownRenderer({
	content,
	className = "",
}: MarkdownRendererProps) {
	const [isFirefox, setIsFirefox] = useState(false);

	useEffect(() => {
		// Detect Firefox - KaTeX fonts don't render properly
		setIsFirefox(navigator.userAgent.toLowerCase().includes("firefox"));
	}, []);

	// Firefox fallback: show plain text without KaTeX processing
	if (isFirefox) {
		return (
			<div className={`prose prose-sm max-w-none ${className}`}>
				<ReactMarkdown>
					{content}
				</ReactMarkdown>
			</div>
		);
	}

	return (
		<div className={`prose prose-sm max-w-none ${className}`}>
			<ReactMarkdown
				remarkPlugins={[remarkMath]}
				rehypePlugins={[rehypeKatex]}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
