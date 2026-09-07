import { asc, count, desc, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { leads, waContacts, waMessages, waTemplates } from "@/lib/db/schema"

export type ConversationRow = {
  contact: typeof waContacts.$inferSelect
  leadName: string | null
  lastMessageBody: string | null
  lastMessageDirection: "in" | "out" | null
  unreadCount: number
}

export async function listConversations(): Promise<ConversationRow[]> {
  const lastMsg = sql<
    { body: string; direction: string } | null
  >`(select jsonb_build_object('body', m2.body, 'direction', m2.direction)
      from wa_messages m2
      where m2.contact_id = ${waContacts.id}
      order by m2.timestamp desc limit 1)`

  // "Unread" = inbound messages newer than the latest outbound reply.
  const unread = sql<number>`(select count(*) from wa_messages m3
      where m3.contact_id = ${waContacts.id}
        and m3.direction = 'in'
        and m3.timestamp > coalesce(
          (select max(m4.timestamp) from wa_messages m4
            where m4.contact_id = ${waContacts.id} and m4.direction = 'out'),
          to_timestamp(0)))`

  const rows = await db
    .select({
      contact: waContacts,
      leadName: leads.name,
      lastMsg,
      unreadCount: unread,
    })
    .from(waContacts)
    .leftJoin(leads, eq(waContacts.leadId, leads.id))
    .orderBy(desc(sql`coalesce(${waContacts.lastMessageAt}, ${waContacts.createdAt})`))
    .limit(200)

  return rows.map((r) => {
    const msg = r.lastMsg as { body: string; direction: string } | null
    return {
      contact: r.contact,
      leadName: r.leadName,
      lastMessageBody: msg?.body ?? null,
      lastMessageDirection: (msg?.direction as "in" | "out") ?? null,
      unreadCount: Number(r.unreadCount ?? 0),
    }
  })
}

export async function getConversation(
  contactId: string
) {
  const [row] = await db
    .select({
      contact: waContacts,
      leadName: leads.name,
    })
    .from(waContacts)
    .leftJoin(leads, eq(waContacts.leadId, leads.id))
    .where(eq(waContacts.id, contactId))
    .limit(1)

  if (!row) return null

  const messages = await db
    .select()
    .from(waMessages)
    .where(eq(waMessages.contactId, contactId))
    .orderBy(asc(waMessages.timestamp))
    .limit(500)

  // 24-hour customer service window = last inbound message within 24h.
  const lastInbound = messages.filter((m) => m.direction === "in").at(-1)
  const windowOpen = Boolean(
    lastInbound && Date.now() - lastInbound.timestamp.getTime() < 24 * 60 * 60 * 1000
  )

  return {
    contact: { ...row.contact, leadName: row.leadName },
    messages,
    windowOpen,
    lastInboundAt: lastInbound?.timestamp ?? null,
  }
}

export async function listTemplates(status?: string) {
  return db
    .select()
    .from(waTemplates)
    .where(
      status && status !== "all"
        ? sql`${waTemplates.status} = ${status}`
        : undefined
    )
    .orderBy(desc(waTemplates.createdAt))
}

export async function listCampaigns() {
  return db
    .select({
      campaign: sql<{
        id: string
        name: string
        status: string
        scheduled_at: string | null
        started_at: string | null
        completed_at: string | null
        sent_count: string
        failed_count: string
        template_name: string
        recipient_count: number
      }>`c.id, c.name, c.status, c.scheduled_at, c.started_at, c.completed_at, c.sent_count, c.failed_count, t.name as template_name,
        (select count(*) from campaign_recipients cr where cr.campaign_id = c.id)::int as recipient_count`,
    })
    .from(sql`wa_campaigns c
      join wa_templates t on t.id = c.template_id`)
    .orderBy(sql`c.created_at desc`)
    .limit(100)
}

export async function countConversations(): Promise<number> {
  const [row] = await db.select({ c: count() }).from(waContacts)
  return Number(row?.c ?? 0)
}
