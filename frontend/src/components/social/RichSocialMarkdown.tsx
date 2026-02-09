"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const PROJECT_TOKEN_REGEX = /\[\[project:([^|\]]+)\|([^\]]+)\]\]/gi;

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function socialToMarkdown(input: string) {
  const raw = input || "";

  // Convert explicit project tokens into markdown links.
  const withProjects = raw.replace(PROJECT_TOKEN_REGEX, (_, projectId, projectTitle) => {
    const id = String(projectId || "").trim();
    const title = String(projectTitle || "").trim() || "project";
    if (!id) return `#${title}`;
    return `[${`#${title}`}](/problems/${encodePathSegment(id)})`;
  });

  // Convert @mentions into markdown links while keeping trailing punctuation outside.
  // Avoid converting emails by requiring a non-word char (or start) before @.
  return withProjects.replace(
    /(^|[^\w.])@([A-Za-z0-9._-]+)([)\]}>,.;:!?]*)/g,
    (match, prefix, username, punct) => {
      const u = String(username || "").trim();
      if (!u) return match;
      const href = `/users/${encodePathSegment(u)}`;
      return `${prefix}[@${u}](${href})${punct || ""}`;
    }
  );
}

function ChipLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const isUser = href.startsWith("/users/");
  const isProblem = href.startsWith("/problems/");
  if (isUser) {
    let username = href.slice("/users/".length) || "";
    try {
      username = decodeURIComponent(username);
    } catch {
      // Keep raw segment if decoding fails.
    }
    const isRho = username.toLowerCase() === "rho";
    return (
      <Link
        href={href}
        className={
          isRho
            ? "inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.15)] transition hover:bg-violet-200"
            : "inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition hover:bg-indigo-100"
        }
        title={`Open profile @${username || ""}`}
      >
        {children}
      </Link>
    );
  }

  if (isProblem) {
    return (
      <Link
        href={href}
        className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)] transition hover:bg-emerald-100"
        title="Open project"
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-indigo-700 hover:text-indigo-800 hover:underline"
    >
      {children}
    </a>
  );
}

export function RichSocialMarkdown({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const markdown = socialToMarkdown(text || "");
  if (!markdown.trim()) return null;

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        a: ({ href, children }) => {
          const safeHref = typeof href === "string" ? href : "";
          if (!safeHref) return <span>{children}</span>;
          return <ChipLink href={safeHref}>{children}</ChipLink>;
        },
        p: ({ children }) => (
          <p className="whitespace-pre-wrap break-words leading-6 mb-3 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-6">{children}</li>,
        code: ({ inline, children }) =>
          inline ? (
            <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[12px] text-neutral-800">
              {children}
            </code>
          ) : (
            <code className="font-mono text-[12px] text-neutral-800">{children}</code>
          ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[12px] leading-5">
            {children}
          </pre>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
