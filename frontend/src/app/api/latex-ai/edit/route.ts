import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const instruction = String(body?.instruction || body?.message || "").trim();
  const content = String(body?.content || "");
  const selection = body?.selection ? String(body.selection) : "";
  const filePath = body?.file_path ? String(body.file_path) : "";
  const memory = body?.memory ? String(body.memory) : "";
  const contextFiles = body?.context_files ? String(body.context_files) : "";
  const forceEdit =
    body?.force_edit === true || body?.force_edit === "true" || body?.force_edit === 1;

  if (!instruction) {
    return new Response("Missing instruction", { status: 400 });
  }

  const editIntentPattern =
    /(add|insert|append|update|edit|rewrite|replace|fix|refactor|delete|remove|change|improve|shorten|expand|format|reformat|summarize|summarise|rewrite|prove|derive|section|subsection|seccion|equation|theorem|lemma|proof|corrig|corrige|corrigir|correg|cambia|modifica|anade|agrega|inserta|borra|elimina|quita|mejor|resume|resumir|acorta|amplia|create|write|draft|paper|article|document|crea|crear|genera|generar|redacta|redactar|escribe|escribir|paper|articulo|documento)/i;
  const normalizedInstruction = instruction.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hasSelection = Boolean(selection && selection.trim().length > 0);
  const shouldEdit = forceEdit || editIntentPattern.test(normalizedInstruction) || hasSelection;

  const prompt = [
    `File: ${filePath || "N/A"}`,
    memory ? `Style memory:\n${memory}` : "",
    selection ? `Selection (if any):\n${selection}` : "",
    contextFiles ? `Additional referenced files:\n${contextFiles}` : "",
    "Document content:",
    content,
    "User instruction:",
    instruction,
    "Editing rules:",
    "- Line/column are 1-based.",
    "- If a selection was provided, edits must stay inside it.",
    "- Preserve valid LaTeX and do not change unrelated parts.",
    "- Use multiple small edits when helpful.",
    "- If no edits are needed, call updateDocument with an empty edits array and explain why in comment.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const system = shouldEdit
    ? `You are a precise LaTeX editor. Unless the user is asking a purely curious question or a standalone explanation, you MUST call updateDocument and apply changes to the document.
Use 1-based line/column positions. Keep explanations brief and do not emit raw JSON.`
    : `You are a precise LaTeX assistant. Provide explanations only when the user is asking a curious question or wants a conceptual explanation.
If you decide to edit, call updateDocument with 1-based line/column positions and keep explanations brief.`;

  const requestedModel =
    typeof body?.model_id === "string" && body.model_id.trim() ? body.model_id.trim() : "";
  const mode = typeof body?.mode === "string" ? body.mode : "";
  const modelId =
    requestedModel ||
    (mode === "thinking" ? "gemini-3-flash-preview-thinking" : "gemini-3-flash-preview");
  const thinkingEnabled = modelId.endsWith("-thinking");

  const result = streamText({
    model: google(modelId),
    system,
    prompt,
    providerOptions: {
      google: {
        thinkingConfig: {
          ...(thinkingEnabled ? { thinkingLevel: "high" } : {}),
          includeThoughts: true,
        },
      },
    },
    tools: {
      updateDocument: {
        description: "DIRECTLY modify the LaTeX document. Use this to insert, update, or delete code.",
        parameters: z.object({
          summary: z.string().describe("A concise summary of the changes made"),
          edits: z.array(z.object({
            start: z.object({ line: z.number(), column: z.number() }),
            end: z.object({ line: z.number(), column: z.number() }),
            text: z.string().describe("The replacement text")
          })).describe("List of edits to apply"),
          comment: z.string().optional().describe("Final explanation to show to the user")
        })
      }
    },
    toolChoice: shouldEdit ? { type: "tool", toolName: "updateDocument" } : "auto",
  });

  // Transform the AI SDK stream into the custom NDJSON format expected by the frontend
  const customStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        let sawToolCall = false;
        const handledToolCalls = new Set<string>();
        let suppressedText = "";

        const emitToolCall = (args: any) => {
          const edits = Array.isArray(args?.edits) ? args.edits : [];
          const summary = typeof args?.summary === "string" ? args.summary : "AI Edit";
          const comment = typeof args?.comment === "string" ? args.comment : "";

          if (edits.length > 0) {
            const editPayload = JSON.stringify({
              type: "edit",
              edits: edits,
            }) + "\n";
            controller.enqueue(encoder.encode(editPayload));
          }

          const resultPayload = JSON.stringify({
            type: "result",
            summary,
            comment,
            edits: edits,
          }) + "\n";
          controller.enqueue(encoder.encode(resultPayload));
        };

        for await (const part of result.fullStream) {
          // Stream text deltas as "Thinking" comments or just assistant text
          if (part.type === 'text-delta') {
            const text = part.textDelta;
            if (shouldEdit) {
              suppressedText += text;
              continue;
            }
            const line = JSON.stringify({ type: "comment", text }) + "\n";
            controller.enqueue(encoder.encode(line));
          }
          if (part.type === "reasoning") {
            const reasoningText = typeof part.textDelta === "string" ? part.textDelta : "";
            if (reasoningText) {
              const line = JSON.stringify({ type: "comment", text: `Thinking: ${reasoningText}` }) + "\n";
              controller.enqueue(encoder.encode(line));
            }
          }

          // Handle tool calls - this is the "edit" action
          if (part.type === 'tool-call' && part.toolName === 'updateDocument') {
            const args = part.args as any;
            sawToolCall = true;
            if (part.toolCallId) handledToolCalls.add(part.toolCallId);
            emitToolCall(args);
          }
        }

        if (!sawToolCall) {
          const toolCalls = await result.toolCalls;
          toolCalls.forEach((call) => {
            if (call.toolName !== "updateDocument") return;
            if (handledToolCalls.has(call.toolCallId)) return;
            sawToolCall = true;
            emitToolCall(call.args);
          });
        }

        if (shouldEdit && !sawToolCall) {
          const message = suppressedText.trim();
          const line = JSON.stringify({
            type: "comment",
            text: message || "No edits were produced. Try rephrasing the request more explicitly.",
          }) + "\n";
          controller.enqueue(encoder.encode(line));
        }
      } catch (err) {
        console.error("Stream generation error:", err);
        const errorLine = JSON.stringify({ type: "comment", text: "Error generating response." }) + "\n";
        controller.enqueue(encoder.encode(errorLine));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(customStream, {
    headers: { 'Content-Type': 'application/x-ndjson' }
  });
}
