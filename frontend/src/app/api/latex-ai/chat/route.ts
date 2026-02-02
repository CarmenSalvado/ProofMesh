import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const lastMessage = messages[messages.length - 1];
  const message = (lastMessage?.content || body?.message || body?.prompt || "").trim();

  if (!message) {
    return new Response("Missing message", { status: 400 });
  }

  const history = Array.isArray(body?.history) ? body.history : messages.slice(0, -1);
  const contextFiles = body?.context_files ? String(body.context_files) : "";
  const historyBlock = history
    .slice(-6)
    .map((item: { role?: string; content?: string }) => `${item.role || "user"}: ${item.content || ""}`)
    .join("\n");

  const prompt = [
    `File: ${body?.file_path || "N/A"}`,
    body?.selection ? `Selection:\n${body.selection}` : "",
    body?.context ? `Context:\n${body.context}` : "",
    contextFiles ? `Referenced files:\n${contextFiles}` : "",
    historyBlock ? `History:\n${historyBlock}` : "",
    `User message:\n${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const requestedModel =
    typeof body?.model_id === "string" && body.model_id.trim() ? body.model_id.trim() : "";
  const mode = typeof body?.mode === "string" ? body.mode : "";
  const modelId =
    requestedModel ||
    (mode === "thinking" ? "gemini-3-flash-preview-thinking" : "gemini-3-flash-preview");
  const thinkingEnabled = modelId.endsWith("-thinking");

  const result = streamText({
    model: google(modelId),
    system:
      "You are an expert LaTeX assistant for scientific writing. Reply in English. Be concise, practical, and provide insert-ready LaTeX when asked.",
    prompt,
    providerOptions: {
      google: {
        thinkingConfig: {
          ...(thinkingEnabled ? { thinkingLevel: "high" } : {}),
          includeThoughts: true,
        },
      },
    },
    experimental_transform: () =>
      new TransformStream({
        transform(part, controller) {
          if (part.type === "reasoning") {
            const text = typeof part.textDelta === "string" ? part.textDelta : "";
            if (text) {
              controller.enqueue({ type: "text-delta", textDelta: `\n\nThinking: ${text}` });
            }
            return;
          }
          controller.enqueue(part);
        },
      }),
  });

  return result.toDataStreamResponse();
}

export async function GET() {
  return Response.json({ ok: true });
}
