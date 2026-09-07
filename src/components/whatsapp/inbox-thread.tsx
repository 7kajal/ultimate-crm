"use client"

import { ArrowLeftIcon, SendHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Message,
  MessageHeader,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Spinner } from "@/components/ui/spinner"
import { toastError, toastSuccess } from "@/lib/toast"
import {
  sendInboxMessageAction,
  sendTemplateToContactAction,
} from "@/lib/actions/whatsapp"

type Msg = {
  id: string
  direction: string
  type: string
  body: string
  status: string
  templateName: string | null
  errorMessage: string | null
  timestamp: Date
}

function statusTicks(status: string) {
  switch (status) {
    case "read":
      return "✓✓"
    case "delivered":
      return "✓✓"
    case "sent":
      return "✓"
    case "failed":
      return "⚠"
    default:
      return ""
  }
}

const time = (d: Date) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

export function InboxThread({
  contactId,
  contactName,
  leadId,
  leadName,
  messages,
  windowOpen,
  templates,
}: {
  contactId: string
  contactName: string
  leadId: string | null
  leadName: string | null
  messages: Msg[]
  windowOpen: boolean
  templates: { id: string; name: string; category: string }[]
}) {
  const router = useRouter()
  const [draft, setDraft] = React.useState("")
  const [isSending, setIsSending] = React.useState(false)
  const [templatesOpen, setTemplatesOpen] = React.useState(false)

  async function send() {
    const body = draft.trim()
    if (!body) return
    setIsSending(true)
    const result = await sendInboxMessageAction({ contactId, body })
    setIsSending(false)
    if (result.ok) {
      setDraft("")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  async function sendTemplate(templateId: string) {
    setIsSending(true)
    const result = await sendTemplateToContactAction({ contactId, templateId })
    setIsSending(false)
    setTemplatesOpen(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Template sent")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  return (
    <div className="flex h-[calc(100svh-8.5rem)] flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-3">
        <Button variant="ghost" size="icon-sm" render={<Link href="/inbox" />}>
          <ArrowLeftIcon />
        </Button>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{contactName}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {leadId ? (
              <Link href={`/leads/${leadId}`} className="hover:underline">
                Lead: {leadName}
              </Link>
            ) : (
              "No linked lead"
            )}
          </span>
        </div>
        <span
          className="ml-auto rounded-full border px-2 py-0.5 text-[11px]"
          style={{
            color: windowOpen ? "var(--success)" : "var(--warning)",
            borderColor: windowOpen
              ? "color-mix(in oklch, var(--success) 30%, transparent)"
              : "color-mix(in oklch, var(--warning) 30%, transparent)",
          }}
        >
          {windowOpen ? "24h window open" : "24h window closed"}
        </span>
      </div>

      {/* Messages */}
      <MessageScrollerProvider>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent>
              {messages.map((m) => (
                <MessageScrollerItem key={m.id}>
                  <Message align={m.direction === "out" ? "end" : "start"}>
                    <Bubble
                      variant={m.direction === "out" ? "default" : "muted"}
                      align={m.direction === "out" ? "end" : "start"}
                    >
                      <BubbleContent className="whitespace-pre-wrap">
                        {m.body}
                      </BubbleContent>
                    </Bubble>
                    <MessageHeader className="justify-end gap-1 text-[10px] text-muted-foreground">
                      {time(m.timestamp)}
                      {m.direction === "out" ? (
                        <span title={m.errorMessage ?? m.status}>
                          {statusTicks(m.status)}
                        </span>
                      ) : null}
                    </MessageHeader>
                  </Message>
                </MessageScrollerItem>
              ))}
              <MessageScrollerItem scrollAnchor>
                <span className="text-xs text-muted-foreground">
                  {messages.length} message(s)
                </span>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Composer */}
      <div className="flex items-center gap-2 border-t pt-3">
        {windowOpen ? (
          <>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Type a message…"
              disabled={isSending}
            />
            <Button size="icon" disabled={isSending || !draft.trim()} onClick={send} aria-label="Send">
              {isSending ? <Spinner /> : <SendHorizontalIcon />}
            </Button>
          </>
        ) : (
          <div className="flex w-full items-center gap-2">
            <p className="flex-1 text-xs text-muted-foreground">
              Free-text window is closed — send an approved template.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={templates.length === 0}
              onClick={() => setTemplatesOpen(true)}
            >
              Send template
            </Button>
          </div>
        )}
      </div>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Send template</DialogTitle>
            <DialogDescription>
              Only APPROVED templates can be sent outside the 24h window.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={isSending}
                onClick={() => void sendTemplate(t.id)}
                className="flex items-center justify-between rounded-lg border p-2.5 text-left text-sm hover:bg-muted/60 disabled:opacity-50"
              >
                <span className="truncate">{t.name}</span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                  {t.category}
                </span>
              </button>
            ))}
            {templates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No templates synced yet.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
