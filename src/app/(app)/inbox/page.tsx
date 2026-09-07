import { MessageSquareIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { timeAgo, initials } from "@/lib/format"
import { listConversations } from "@/lib/queries/whatsapp"
import { requireUser } from "@/lib/rbac"

export const metadata: Metadata = { title: "Inbox" }

export default async function InboxPage() {
  await requireUser()
  const conversations = await listConversations()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Shared WhatsApp inbox — {conversations.length} conversation(s).
        </p>
      </div>

      {conversations.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareIcon />
            </EmptyMedia>
            <EmptyTitle>No conversations yet</EmptyTitle>
            <EmptyDescription>
              Inbound WhatsApp messages appear here automatically once the Meta
              webhook is configured.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {conversations.map((c) => (
            <Link
              key={c.contact.id}
              href={`/inbox/${c.contact.id}`}
              className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(c.contact.name ?? c.contact.pushName, c.contact.waPhone)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {c.contact.name ?? c.contact.pushName ?? c.contact.waPhone}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(c.contact.lastMessageAt)}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {c.lastMessageDirection === "out" ? "You: " : ""}
                  {c.lastMessageBody ?? "No messages yet"}
                </span>
                <span className="flex items-center gap-1.5 pt-0.5">
                  {c.leadName ? (
                    <Badge variant="secondary" className="max-w-32">
                      <span className="truncate">{c.leadName}</span>
                    </Badge>
                  ) : null}
                  {c.unreadCount > 0 ? (
                    <Badge variant="info" className="tabular-nums">
                      {c.unreadCount} new
                    </Badge>
                  ) : null}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
