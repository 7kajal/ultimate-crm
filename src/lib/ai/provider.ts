export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

/** Lazy model factory — zero cost when AI is not configured. */
export async function getModel() {
  if (!isAIConfigured()) {
    throw new Error("AI is not configured — set OPENAI_API_KEY")
  }
  const { createOpenAI } = await import("@ai-sdk/openai")
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai(process.env.AI_MODEL ?? "gpt-4o-mini")
}
