import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const before = String(body?.before || "");
  const after = String(body?.after || "");
  const maxSuggestions = Math.max(1, Math.min(5, Number(body?.max_suggestions || 3)));

  const prompt = [
    "Return ONLY valid JSON: {\"suggestions\":[{\"label\":...,\"insert_text\":...}]}",
    "Task: provide LaTeX autocomplete suggestions.",
    "Avoid non-ASCII characters; use LaTeX commands instead of Unicode symbols.",
    `File: ${body?.file_path || "N/A"}`,
    `Text before cursor:\n${before}`,
    `Text after cursor:\n${after}`,
    `Max suggestions: ${maxSuggestions}`,
  ].join("\n\n");

  const result = await generateText({
    model: google("gemini-3-flash-preview"),
    system: "You are a LaTeX autocomplete engine. Output JSON only. Avoid non-ASCII characters; use LaTeX commands instead of Unicode symbols.",
    prompt,
  });

  try {
    const data = JSON.parse(result.text);
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions.slice(0, maxSuggestions) : [];
    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
