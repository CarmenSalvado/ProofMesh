import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const CRITIC_SYSTEM_PROMPT = `You are a rigorous mathematical critic. Your role is to analyze mathematical arguments, identify gaps, and suggest improvements.

When critiquing:
1. Check logical validity of each step
2. Identify unstated assumptions
3. Look for edge cases or counterexamples
4. Assess completeness of the argument
5. Suggest specific improvements

Format your critique:
- **Validity**: Is the argument logically sound?
- **Gaps**: What steps are missing or unclear?
- **Assumptions**: What is assumed but not stated?
- **Counterexamples**: Are there edge cases that fail?
- **Suggestions**: How to strengthen the argument?
- **Score**: Rate 1-10 with justification

Be constructive but rigorous. Good mathematics requires careful scrutiny.`;

export async function POST(request: Request) {
  const body = await request.json();
  
  const proposal = body?.proposal || body?.prompt || "";
  const context = body?.context || "";
  const leanCode = body?.lean_code || "";
  const verificationResult = body?.verification_result || "";
  
  if (!proposal.trim()) {
    return new Response("Missing proposal to critique", { status: 400 });
  }
  
  const fullPrompt = [
    context ? `Context:\n${context}` : "",
    `Proposal to critique:\n${proposal}`,
    leanCode ? `\nLean formalization:\n\`\`\`lean\n${leanCode}\n\`\`\`` : "",
    verificationResult ? `\nVerification result:\n${verificationResult}` : "",
    "\nProvide a thorough critique of this mathematical argument.",
  ].filter(Boolean).join("\n\n");
  
  const modelId = body?.model_id || "gemini-3-flash-preview";
  const thinkingEnabled = modelId.endsWith("-thinking");
  
  const result = streamText({
    model: google(modelId),
    system: CRITIC_SYSTEM_PROMPT,
    prompt: fullPrompt,
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
              controller.enqueue({ 
                type: "text-delta", 
                textDelta: `<thinking>${text}</thinking>` 
              });
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
  return Response.json({ ok: true, endpoint: "canvas-ai/critique" });
}
