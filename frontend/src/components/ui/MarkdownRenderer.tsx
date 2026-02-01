"use client";

import katex from "katex";

interface MarkdownRendererProps {
	content: string;
	className?: string;
}

// Render math using KaTeX
function renderMath(latex: string, displayMode: boolean): string {
	try {
		const html = katex.renderToString(latex, {
			displayMode,
			throwOnError: false,
			strict: false,
			output: "html",
		});
		// Force black color for visibility
		return `<span style="color: #000000 !important;">${html}</span>`;
	} catch (e) {
		console.error("[KaTeX Error]", e);
		return `<span style="color: #ef4444;">[ERROR: ${latex}]</span>`;
	}
}

// Parse content and render math expressions
function parseAndRenderMath(content: string): string {
	// Replace display math $$...$$ 
	let result = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
		return renderMath(latex.trim(), true);
	});
	
	// Replace inline math $...$
	result = result.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
		return renderMath(latex.trim(), false);
	});
	
	// Convert newlines to <br> for plain text
	result = result.replace(/\n/g, "<br>");
	
	return result;
}

export function MarkdownRenderer({
	content,
	className = "",
}: MarkdownRendererProps) {
	if (!content || content.trim() === "") {
		return null;
	}

	// Check if content contains math delimiters
	const hasMath = /\$/.test(content);
	
	if (hasMath) {
		const html = parseAndRenderMath(content);
		return (
			<div 
				className={`markdown-content ${className}`}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		);
	}

	// Plain text without math
	return (
		<div className={`markdown-content ${className}`}>
			{content}
		</div>
	);
}