export type CanvasAttachment = {
  kind: "canvas_nodes" | "canvas_block";
  problem_id: string;
  problem_title: string;
  visibility: "public" | "private";
  node_ids?: string[];
  node_titles?: string[];
  block_id?: string;
  block_name?: string;
};

export type LatexAttachment = {
  kind: "latex_fragment";
  problem_id: string;
  problem_title: string;
  visibility: "public" | "private";
  file_path: string;
  line_start?: number;
  line_end?: number;
  snippet: string;
};

export type PostAttachment = CanvasAttachment | LatexAttachment;

const ATTACHMENT_REGEX = /<!--pm:attach\s+([\s\S]*?)\s*-->/g;

export function serializePostContent(content: string, attachments: PostAttachment[]): string {
  const trimmed = content.trim();
  if (attachments.length === 0) return trimmed;
  const serialized = attachments
    .map((attachment) => `<!--pm:attach ${JSON.stringify(attachment)} -->`)
    .join("\n");
  if (!trimmed) return serialized;
  return `${trimmed}\n\n${serialized}`;
}

export function extractPostAttachments(content?: string | null): {
  cleanContent: string;
  attachments: PostAttachment[];
} {
  if (!content) return { cleanContent: "", attachments: [] };
  const attachments: PostAttachment[] = [];
  const cleanContent = content.replace(ATTACHMENT_REGEX, (_, raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        attachments.push(parsed as PostAttachment);
      }
    } catch {
      // Ignore malformed attachment
    }
    return "";
  }).trim();

  return { cleanContent, attachments };
}
