"use client";

import Link from "next/link";

const PROJECT_LINK_TOKEN_REGEX = /^\[\[project:([^|\]]+)\|([^\]]+)\]\]$/i;

function stripTrailingPunctuation(username: string) {
  return username.replace(/[)\]}>,.;:!?]+$/g, "");
}

export function RichSocialText({ text }: { text: string }) {
  const parts = (text || "").split(/(\[\[project:[^\]|]+\|[^\]]+\]\]|@[A-Za-z0-9._-]+)/g);
  return parts.map((part, idx) => {
    if (!part) return null;

    const projectMatch = part.match(PROJECT_LINK_TOKEN_REGEX);
    if (projectMatch) {
      const [, projectId, projectTitle] = projectMatch;
      return (
        <Link
          key={`project-${idx}`}
          href={`/problems/${encodeURIComponent(projectId)}`}
          title={`Open project ${projectTitle}`}
          className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)] transition hover:bg-emerald-100"
        >
          #{projectTitle}
        </Link>
      );
    }

    if (!part.startsWith("@")) return <span key={`text-${idx}`}>{part}</span>;

    const rawMention = part.slice(1).trim();
    const mentionedUsername = stripTrailingPunctuation(rawMention);
    if (!mentionedUsername) return <span key={`mention-${idx}`}>{part}</span>;

    const isRho = mentionedUsername.toLowerCase() === "rho";
    return (
      <Link
        key={`mention-${idx}`}
        href={`/users/${encodeURIComponent(mentionedUsername)}`}
        title={`Open profile @${mentionedUsername}`}
        className={
          isRho
            ? "inline-flex items-center rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.15)] transition hover:bg-violet-200"
            : "inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-900 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] transition hover:bg-indigo-100"
        }
      >
        @{mentionedUsername}
      </Link>
    );
  });
}

