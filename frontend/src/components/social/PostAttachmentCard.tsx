"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { FileText, GitFork, Lock } from "lucide-react";
import { forkProblem } from "@/lib/api";
import { PostAttachment } from "@/lib/postAttachments";

interface PostAttachmentCardProps {
  attachment: PostAttachment;
  compact?: boolean;
  allowPrivate?: boolean;
}

function clampLines(value: string, maxLines: number, maxChars: number) {
  const lines = value.split("\n");
  const sliced = lines.slice(0, maxLines).join("\n");
  if (sliced.length <= maxChars) return sliced;
  return `${sliced.slice(0, maxChars).trimEnd()}…`;
}

export function PostAttachmentCard({ attachment, compact = false, allowPrivate = false }: PostAttachmentCardProps) {
  const router = useRouter();
  const [forking, setForking] = useState(false);
  const isPublic = attachment.visibility === "public";
  const canAccess = isPublic || allowPrivate;
  const isCanvas = attachment.kind === "canvas_nodes" || attachment.kind === "canvas_block";
  const link = canAccess
    ? isCanvas
      ? `/problems/${attachment.problem_id}/canvas`
      : `/problems/${attachment.problem_id}/lab${
          attachment.kind === "latex_fragment" && attachment.file_path
            ? `?file=${encodeURIComponent(attachment.file_path)}`
            : ""
        }`
    : null;

  const handleFork = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isPublic || forking) return;
    setForking(true);
    try {
      const forked = await forkProblem(attachment.problem_id);
      if (isCanvas) {
        router.push(`/problems/${forked.id}/canvas`);
      } else {
        const fileParam =
          attachment.kind === "latex_fragment" && attachment.file_path
            ? `?file=${encodeURIComponent(attachment.file_path)}`
            : "";
        router.push(`/problems/${forked.id}/lab${fileParam}`);
      }
    } catch (error) {
      console.error("Failed to fork problem", error);
    } finally {
      setForking(false);
    }
  };

  return (
    <div
      role={link ? "link" : undefined}
      tabIndex={link ? 0 : undefined}
      onClick={() => {
        if (link) router.push(link);
      }}
      onKeyDown={(event) => {
        if (!link) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(link);
        }
      }}
      className={`group relative rounded-lg border border-neutral-200 bg-white/90 p-3 shadow-sm transition ${
        link ? "cursor-pointer hover:border-indigo-200 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border ${
            isCanvas ? "border-indigo-100 bg-indigo-50 text-indigo-600" : "border-neutral-100 bg-neutral-50 text-neutral-600"
          }`}
        >
          {isCanvas ? <GitFork className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-neutral-900">
              {isCanvas ? "Canvas snapshot" : "LaTeX fragment"}
            </div>
            {!isPublic && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
          </div>
          {link ? (
            <Link
              href={link}
              className="mt-1 block text-sm font-medium text-neutral-800 truncate hover:text-indigo-600"
            >
              {attachment.problem_title}
            </Link>
          ) : (
            <div className="mt-1 text-sm font-medium text-neutral-800 truncate">
              {attachment.problem_title}
            </div>
          )}
          {isCanvas ? (
            <div className="mt-2 text-xs text-neutral-600">
              {attachment.kind === "canvas_block" ? (
                <span>
                  Block: <span className="font-medium text-neutral-700">{attachment.block_name || "Untitled"}</span>
                </span>
              ) : (
                <span>
                  Nodes:{" "}
                  {attachment.node_titles && attachment.node_titles.length > 0 ? (
                    <>
                      {attachment.node_titles.slice(0, 3).join(", ")}
                      {attachment.node_titles.length > 3 && ` +${attachment.node_titles.length - 3} more`}
                    </>
                  ) : (
                    "Multiple nodes"
                  )}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-neutral-600">
              {attachment.file_path}
              {attachment.line_start && attachment.line_end
                ? ` · lines ${attachment.line_start}-${attachment.line_end}`
                : ""}
            </div>
          )}
          {!isCanvas && (
            <pre
              className={`mt-2 rounded-md border border-neutral-100 bg-neutral-50 px-2 py-2 text-[11px] text-neutral-700 ${
                compact ? "max-h-24" : "max-h-40"
              } overflow-hidden whitespace-pre-wrap font-mono`}
            >
              {clampLines(attachment.snippet || "", compact ? 6 : 10, compact ? 320 : 520)}
            </pre>
          )}

          <div className="mt-3 flex items-center gap-2">
            {link && (
              <Link
                href={link}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                {isCanvas ? "Open canvas" : "Open LaTeX"}
              </Link>
            )}
            {isPublic && (
              <button
                type="button"
                onClick={handleFork}
                disabled={forking}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-60"
              >
                <GitFork className="h-3 w-3" />
                {forking ? "Forking..." : "Fork"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
