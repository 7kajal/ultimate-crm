import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { InboxThread } from "@/components/whatsapp/inbox-thread"
import { listTemplates } from "@/lib/queries/whatsapp"
import { getConversation } from "@/lib/queries/whatsapp"
import { requireUser } from "@/lib/rbac"

export const metadata: Metadata = { title: "Conversation" }

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ contactId: string }>
}) {
  await requireUser()
  const { contactId } = await params

  const conversation = await getConversation(contactId)
  if (!conversation) notFound()

  const templates = (await listTemplates("APPROVED")).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
  }))

  const displayName =
    conversation.contact.name ??
    conversation.contact.pushName ??
    conversation.contact.waPhone

  return (
    <div className="flex flex-col gap-6">
      <InboxThread
        contactId={conversation.contact.id}
        contactName={displayName}
        leadId={conversation.contact.leadId}
        leadName={conversation.contact.leadName}
        messages={conversation.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          type: m.type,
          body: m.body,
          status: m.status,
          templateName: m.templateName,
          errorMessage: m.errorMessage,
          timestamp: m.timestamp,
        }))}
        windowOpen={conversation.windowOpen}
        templates={templates}
      />
    </div>
  )
}
