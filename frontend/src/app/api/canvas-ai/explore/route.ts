import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const EXPLORER_SYSTEM_PROMPT = `You are a mathematical exploration assistant. Your role is to help users discover mathematical ideas, patterns, and potential proof strategies.

When exploring a mathematical concept or problem:
1. First, understand what is being asked
2. Consider relevant definitions, theorems, and techniques
3. Propose multiple approaches or perspectives
4. Identify key insights that could lead to solutions
5. Suggest formalizations when appropriate

Format your response with clear sections:
- **Understanding**: What the problem is asking
- **Key Concepts**: Relevant mathematical ideas
- **Approaches**: Different strategies to explore
- **Insights**: Notable observations or patterns
- **Next Steps**: Suggested directions

When possible, include explicitly labeled items so they can become canvas nodes:
- Definition:
- Lemma:
- Theorem:
- Claim:
- Computation:
- Idea:
- Note:
- Resource:

Be rigorous but exploratory. Mathematics is about discovery.`;

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
