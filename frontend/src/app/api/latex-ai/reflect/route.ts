import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const memory = String(body?.memory || "");
  const instruction = String(body?.instruction || "");
  const summary = String(body?.summary || "");
  const messages = Array.isArray(body?.messages) ? body.messages : [];

  const historyBlock = messages
    .slice(-8)
    .map((item: { role?: string; content?: string }) => `${item.role || "user"}: ${item.content || ""}`)
    .join("\n");

  const prompt = [
    "You update a short memory for a writing assistant.",
    "Return ONLY JSON: {\"memory\": \"...\"}",
    "Memory should be concise, max 8 bullet points, plain text.",
    memory ? `Current memory:\n${memory}` : "Current memory: (empty)",
    instruction ? `Instruction:\n${instruction}` : "",
    summary ? `Summary:\n${summary}` : "",
    historyBlock ? `Recent chat:\n${historyBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await generateText({
    model: google("gemini-3-flash-preview"),
    system: "You are a memory curator for an AI writing assistant.",
    prompt,
  });

  try {
    const data = JSON.parse(result.text);
    return Response.json({ memory: String(data.memory || "").trim() });
  } catch {
    return Response.json({ memory: memory.trim() });
  }
}
