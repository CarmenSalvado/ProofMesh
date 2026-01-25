"use client";

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface EditorProps {
	content: string;
	onChange: (content: string) => void;
	editable?: boolean;
}

export function TiptapEditor({ content, onChange, editable = true }: EditorProps) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
			}),
			Markdown.configure({
				html: false,
				transformPastedText: true,
				transformCopiedText: true,
			}),
			Placeholder.configure({
				placeholder: "Type '/' for commands or start writing...",
			}),
		],
		content: content,
		editable: editable,
		editorProps: {
			attributes: {
				class: 'prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[50vh] px-8 py-4',
			},
		},
		onUpdate: ({ editor }) => {
			// Get markdown content
			const markdown = editor.storage.markdown.getMarkdown();
			onChange(markdown);
		},
	});

	// Sync content updates from outside (careful with loops)
	useEffect(() => {
		if (editor && content !== editor.storage.markdown.getMarkdown()) {
			// Only update if difference is significant or forced
			// This is tricky with Tiptap + controlled input.
			// Usually better to treating it as uncontrolled after init, 
			// or checking if content changed significantly from outside.

			// For now, only set content on mount or if empty to avoid cursor jumps
			if (editor.getText() === "" && content) {
				editor.commands.setContent(content);
			}
		}
	}, [content, editor]);

	if (!editor) {
		return null;
	}

	return (
		<div className="relative w-full">
			{/* Bubble Menu for quick formatting */}
			{editor && (
				<BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
					<div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-lg">
						<button
							onClick={() => editor.chain().focus().toggleBold().run()}
							className={`p-1 rounded hover:bg-[var(--bg-hover)] ${editor.isActive('bold') ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12h8a4 4 0 100-8H6v8zm0 0v8" /></svg>
						</button>
						<button
							onClick={() => editor.chain().focus().toggleItalic().run()}
							className={`p-1 rounded hover:bg-[var(--bg-hover)] ${editor.isActive('italic') ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l4-14" /></svg>
						</button>
						<button
							onClick={() => editor.chain().focus().toggleCode().run()}
							className={`p-1 rounded hover:bg-[var(--bg-hover)] ${editor.isActive('code') ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
						</button>
					</div>
				</BubbleMenu>
			)}

			<EditorContent editor={editor} />
		</div>
	)
}
