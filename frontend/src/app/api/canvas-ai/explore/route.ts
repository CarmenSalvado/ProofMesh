import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const EXPLORER_SYSTEM_PROMPT = `You are a mathematical canvas assistant.

Your primary goal is node generation, not long chat.

Output rules (strict):
1) Keep response short: max 6 lines total.
2) Each line must be a node candidate with one label:
   Definition:, Lemma:, Theorem:, Claim:, Computation:, Idea:, Note:, Resource:
3) Each line must be concise (max ~18 words after the label).
4) Do NOT output long paragraphs, introductions, or conclusions.
5) If the user asks a simple conceptual question, output 3-5 short nodes.
6) Use plain language when possible and keep mathematical rigor.

Example format:
Definition: Integer parity means an integer is even or odd.
Claim: even + odd is always odd.
Idea: Write even=2a and odd=2b+1.
Computation: (2a)+(2b+1)=2(a+b)+1.
Note: Therefore the sum has odd form.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const prompt = body?.prompt || body?.message || "";
    const context = body?.context || "";
    const libraryItems = body?.library_items || [];
    const kgContext = body?.kg_context || "";
    
    // Handle useChat messages format
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUserMessage = messages.filter((m: {role: string}) => m.role === "user").pop();
    const userMessage = lastUserMessage?.content || prompt;
    
    if (!userMessage.trim()) {
      return new Response("Missing prompt", { status: 400 });
    }
    
    // Build context from library items
    const libraryContext = libraryItems.length > 0
      ? `\n\nRelevant library items:\n${libraryItems.map((item: { title: string; content: string; type: string }) => 
          `- ${item.type}: ${item.title}\n  ${item.content}`
        ).join("\n")}`
      : "";
    
    // Build full prompt
    const fullPrompt = [
      context ? `Context:\n${context}` : "",
      libraryContext,
      kgContext ? `\nKnowledge Graph Context:\n${kgContext}` : "",
      `\nUser Request:\n${userMessage}`,
    ].filter(Boolean).join("\n\n");
    
    const modelId = body?.model_id || "gemini-3-flash-preview";
    
    console.log("[canvas-ai/explore] Using model:", modelId);
    console.log("[canvas-ai/explore] Prompt:", userMessage.slice(0, 100));
    
    const result = streamText({
      model: google(modelId),
      system: EXPLORER_SYSTEM_PROMPT,
      prompt: fullPrompt,
      onFinish: ({ text, usage }) => {
        console.log("[canvas-ai/explore] Finished. Text length:", text.length, "Tokens:", usage?.totalTokens);
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[canvas-ai/explore] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: "canvas-ai/explore" });
}
