"use client"

import { ArrowUpIcon, SparklesIcon, SquareXIcon } from "lucide-react"
import * as React from "react"

import { WidgetRenderer } from "@/components/ai/widgets/widget-renderer"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useChat } from "@ai-sdk/react"
import { dashboardSpecSchema, type DashboardSpec } from "@/lib/ai/widget-schema"
import { DefaultChatTransport, type UIMessage } from "ai"

const SUGGESTIONS = [
  "Show me my hottest leads",
  "Which leads have gone stale?",
  "Draft a WhatsApp reply to Meera Joshi",
  "Create a task to send the revised proposal",
  "Show me analytics for employees and leads for the last 15 days",
  "What does my pipeline look like this month?",
]

export function AssistantChat({ configured }: { configured: boolean }) {
  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  })

  const messages: UIMessage[] = chat.messages
  const isStreaming = chat.status === "submitted" || chat.status === "streaming"
  const [input, setInput] = React.useState("")

  function send(text?: string) {
    const value = (text ?? input).trim()
    if (!value || isStreaming) return
    void chat.sendMessage({ text: value })
    setInput("")
  }

  return (
    <div className="flex h-[560px] flex-col rounded-lg border">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <SparklesIcon className="size-4 text-primary" />
        <span className="text-sm font-medium">CRM Assistant</span>
        {isStreaming ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            onClick={() => chat.stop()}
            aria-label="Stop"
          >
            <SquareXIcon />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Ask about your pipeline, leads or follow-ups.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <div
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <Bubble
                  variant={m.role === "user" ? "default" : "muted"}
                  align={m.role === "user" ? "end" : "start"}
                  className="max-w-[85%]"
                >
                  <BubbleContent className="whitespace-pre-wrap">
                    {messageText(m)}
                  </BubbleContent>
                </Bubble>
              </div>
              {widgetParts(m).map((part) => (
                <WidgetPart key={part.toolCallId} part={part} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder={
              configured ? "Ask the assistant…" : "AI not configured — set OPENAI_API_KEY"
            }
            disabled={!configured || isStreaming}
            className="max-h-32 min-h-9"
          />
          <Button
            size="icon"
            disabled={!configured || isStreaming || !input.trim()}
            onClick={() => send()}
            aria-label="Send"
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Flatten a UIMessage's text parts for display. */
function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n")
}

type RenderWidgetPart = {
  toolCallId: string
  state: string
  input?: { spec?: DashboardSpec }
}

/** Tool parts for the visual board rendered by the assistant. */
function widgetParts(m: UIMessage): RenderWidgetPart[] {
  return m.parts.flatMap((p) =>
    p.type === "tool-render_widget"
      ? [(p as unknown) as RenderWidgetPart]
      : []
  )
}

/** Renders a rendered board once its spec has fully streamed. */
function WidgetPart({ part }: { part: RenderWidgetPart }) {
  const ready = part.state === "input-available" || part.state === "output-available"
  const parsed = ready ? dashboardSpecSchema.safeParse(part.input?.spec) : undefined

  if (ready && parsed?.success) {
    return (
      <div className="rounded-xl border bg-background/60 p-3">
        <WidgetRenderer spec={parsed.data} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background/60 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <SparklesIcon className="size-3.5 animate-pulse" />
        Drawing the analytics board…
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
