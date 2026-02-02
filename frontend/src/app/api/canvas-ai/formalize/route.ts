import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const FORMALIZER_SYSTEM_PROMPT = `You are a Lean 4 formalization expert. Your role is to translate mathematical statements and proofs into correct Lean 4 code.

Guidelines:
1. Use Mathlib 4 conventions and imports
2. Write idiomatic Lean 4 code
3. Include appropriate type signatures
4. Add documentation comments explaining the formalization
5. Handle edge cases and provide complete proofs when possible

Format your response:
- First explain the formalization strategy
- Then provide the Lean 4 code in a code block
- Note any assumptions or simplifications made

Be precise and use standard Mathlib naming conventions.`;

export async function POST(request: Request) {
  const body = await request.json();
  
  const statement = body?.statement || body?.prompt || "";
  const context = body?.context || "";
  const existingCode = body?.existing_code || "";
  
  if (!statement.trim()) {
    return new Response("Missing statement to formalize", { status: 400 });
  }
  
  const fullPrompt = [
    context ? `Mathematical Context:\n${context}` : "",
    existingCode ? `Existing Lean code:\n\`\`\`lean\n${existingCode}\n\`\`\`` : "",
    `\nStatement to formalize:\n${statement}`,
    "\nProvide a complete Lean 4 formalization with Mathlib imports.",
  ].filter(Boolean).join("\n\n");
  
  const modelId = body?.model_id || "gemini-3-flash-preview";
  const thinkingEnabled = modelId.endsWith("-thinking");
  
  const result = streamText({
    model: google(modelId),
    system: FORMALIZER_SYSTEM_PROMPT,
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
  return Response.json({ ok: true, endpoint: "canvas-ai/formalize" });
}
