import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai"

import { getModel, isAIConfigured } from "@/lib/ai/provider"
import { createAssistantTools } from "@/lib/ai/tools"
import { childLogger } from "@/lib/logger"
import { requireSession } from "@/lib/rbac"

const log = childLogger({ module: "ai-chat" })

export const runtime = "nodejs"
export const maxDuration = 60

const SYSTEM_PROMPT = `You are the Ultimate CRM assistant for a B2B sales team in India.
You help with pipeline questions, lead lookups, follow-up triage, drafting WhatsApp replies, and creating tasks.
Rules:
- Use the provided tools to fetch live CRM data; never invent lead names, numbers or stages.
- Money is stored in paise — always present amounts in ₹ (INR, Indian digit grouping).
- When drafting WhatsApp replies, keep them short, warm and professional; mirror the customer's language.
- When you create a task, confirm what you created in one line.
- If data is missing, say so and suggest the closest alternative.`

export async function POST(request: Request) {
  const session = await requireSession()

  if (!isAIConfigured()) {
    return Response.json(
      { error: "AI is not configured — set OPENAI_API_KEY" },
      { status: 503 }
    )
  }

  let uiMessages: UIMessage[]
  try {
    const body = (await request.json()) as { messages?: UIMessage[] }
    uiMessages = body.messages ?? []
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 })
  }

  try {
    const model = await getModel()
    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(uiMessages),
      tools: createAssistantTools(session),
      stopWhen: stepCountIs(6),
      onFinish: ({ usage }) => {
        log.info(
          { userId: session.user.id, tokens: usage.totalTokens },
          "chat completion"
        )
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    log.error({ err: error }, "chat route failed")
    return Response.json({ error: "AI request failed" }, { status: 500 })
  }
}
