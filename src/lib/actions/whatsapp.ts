"use server"

import { and, eq, gte, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { db } from "@/lib/db"
import {
  auditLogs,
  campaignRecipients,
  leadActivities,
  waCampaigns,
  waContacts,
  waMessages,
  waTemplates,
} from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import { inngest } from "@/lib/inngest/client"
import { ForbiddenError, NotFoundError, requireSession, type Role } from "@/lib/rbac"
import {
  isWhatsAppConfigured,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  syncTemplatesFromMeta,
} from "@/lib/whatsapp/cloud-api"
import { z } from "zod"

const log = childLogger({ module: "wa-actions" })

type ActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }

async function audit(
  actorId: string,
  action: string,
  entityId: string | null,
  diff?: unknown
) {
  const hdrs = await headers()
  await db.insert(auditLogs).values({
    actorId,
    action,
    entityType: "whatsapp",
    entityId,
    diff: diff ?? null,
    requestId: hdrs.get("x-request-id"),
  })
}

const sendMessageSchema = z.object({
  contactId: z.string().uuid(),
  body: z.string().trim().min(1).max(4096),
})

const sendTemplateSchema = z.object({
  contactId: z.string().uuid(),
  templateId: z.string().uuid(),
})

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateId: z.string().uuid(),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
  stages: z.array(z.string().trim().max(30)).max(10).default([]),
})

/**
 * Sends a free-text reply. Only allowed inside the 24-hour customer service
 * window (last inbound message < 24h ago) — Meta policy.
 */
export async function sendInboxMessageAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  if (!isWhatsAppConfigured()) {
    return { ok: false, message: "WhatsApp not configured — set WHATSAPP_* env vars" }
  }

  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid message" }

  const { contactId, body } = parsed.data
  const [contact] = await db
    .select()
    .from(waContacts)
    .where(eq(waContacts.id, contactId))
    .limit(1)
  if (!contact) throw new NotFoundError("Contact not found")

  const [lastInbound] = await db
    .select({ timestamp: waMessages.timestamp })
    .from(waMessages)
    .where(and(eq(waMessages.contactId, contactId), eq(waMessages.direction, "in")))
    .orderBy(sql`${waMessages.timestamp} desc`)
    .limit(1)

  const windowOpen =
    lastInbound &&
    Date.now() - lastInbound.timestamp.getTime() < 24 * 60 * 60 * 1000
  if (!windowOpen) {
    return {
      ok: false,
      message:
        "The 24-hour window is closed — send an approved template instead of free text",
    }
  }

  try {
    const result = await sendWhatsAppText(contact.waPhone, body)
    const waMessageId = result.messages?.[0]?.id ?? null

    await db.insert(waMessages).values({
      waMessageId,
      contactId,
      direction: "out",
      type: "text",
      body,
      status: "sent",
      sentBy: session.user.id,
    })
    await db
      .update(waContacts)
      .set({ lastMessageAt: new Date() })
      .where(eq(waContacts.id, contactId))

    if (contact.leadId) {
      await db.insert(leadActivities).values({
        leadId: contact.leadId,
        userId: session.user.id,
        type: "whatsapp",
        body: `WhatsApp out: ${body.slice(0, 200)}`,
        metadata: { waMessageId, direction: "out" },
      })
    }

    revalidatePath(`/inbox/${contactId}`)
    revalidatePath("/inbox")
    return { ok: true, message: "Message sent" }
  } catch (error) {
    log.error({ err: error }, "send message failed")
    return { ok: false, message: error instanceof Error ? error.message : "Send failed" }
  }
}

export async function sendTemplateToContactAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  if (!isWhatsAppConfigured()) {
    return { ok: false, message: "WhatsApp not configured" }
  }

  const parsed = sendTemplateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid request" }

  const [contact] = await db
    .select()
    .from(waContacts)
    .where(eq(waContacts.id, parsed.data.contactId))
    .limit(1)
  const [template] = await db
    .select()
    .from(waTemplates)
    .where(eq(waTemplates.id, parsed.data.templateId))
    .limit(1)
  if (!contact || !template) throw new NotFoundError("Contact or template not found")
  if (template.status !== "APPROVED") {
    return { ok: false, message: `Template is ${template.status} — only APPROVED can send` }
  }

  try {
    const result = await sendWhatsAppTemplate(
      contact.waPhone,
      template.name,
      template.language
    )
    const waMessageId = result.messages?.[0]?.id ?? null

    await db.insert(waMessages).values({
      waMessageId,
      contactId: contact.id,
      direction: "out",
      type: "template",
      body: `[Template: ${template.name}]`,
      templateName: template.name,
      status: "sent",
      sentBy: session.user.id,
    })
    await db
      .update(waContacts)
      .set({ lastMessageAt: new Date() })
      .where(eq(waContacts.id, contact.id))

    if (contact.leadId) {
      await db.insert(leadActivities).values({
        leadId: contact.leadId,
        userId: session.user.id,
        type: "whatsapp",
        body: `WhatsApp template sent: ${template.name}`,
      })
    }

    revalidatePath(`/inbox/${contact.id}`)
    return { ok: true, message: "Template sent" }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Send failed" }
  }
}

export async function syncTemplatesAction(): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin" && role !== "manager") {
    throw new ForbiddenError("Only managers and admins can sync templates")
  }

  try {
    const templates = await syncTemplatesFromMeta()
    for (const t of templates) {
      await db
        .insert(waTemplates)
        .values({
          metaTemplateId: t.id,
          name: t.name,
          category: t.category,
          language: t.language,
          status: t.status,
          rejectionReason: t.rejected_reason ?? null,
          components: (t.components ?? []) as object,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: waTemplates.metaTemplateId,
          set: {
            name: t.name,
            category: t.category,
            language: t.language,
            status: t.status,
            rejectionReason: t.rejected_reason ?? null,
            components: (t.components ?? []) as object,
            lastSyncedAt: new Date(),
          },
        })
    }

    await audit(session.user.id, "wa.templates_sync", null, { count: templates.length })
    revalidatePath("/whatsapp/templates")
    return { ok: true, message: `Synced ${templates.length} template(s)` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Sync failed" }
  }
}

export async function createCampaignAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin" && role !== "manager") {
    throw new ForbiddenError("Only managers and admins can create campaigns")
  }

  const parsed = campaignSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the campaign details",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const [template] = await db
    .select({ id: waTemplates.id, status: waTemplates.status })
    .from(waTemplates)
    .where(eq(waTemplates.id, parsed.data.templateId))
    .limit(1)
  if (!template) return { ok: false, message: "Template not found" }
  if (template.status !== "APPROVED") {
    return { ok: false, message: "Only APPROVED templates can be used" }
  }

  // Resolve audience: opted-in contacts matching tags, optionally lead stage.
  const conditions = [eq(waContacts.optedIn, true)]
  if (parsed.data.tags.length > 0) {
    conditions.push(sql`${waContacts.tags} && ${parsed.data.tags}`)
  }
  if (parsed.data.stages.length > 0) {
    conditions.push(sql`${waContacts.leadId} in (select id from leads where stage::text = any(${parsed.data.stages}))`)
  }

  const audience = await db
    .select({ id: waContacts.id })
    .from(waContacts)
    .where(and(...conditions))

  if (audience.length === 0) {
    return { ok: false, message: "Audience is empty — adjust tags/stages" }
  }

  const [campaign] = await db
    .insert(waCampaigns)
    .values({
      name: parsed.data.name,
      templateId: parsed.data.templateId,
      audienceFilter: { tags: parsed.data.tags, stages: parsed.data.stages },
      status: "scheduled",
      scheduledAt: new Date(),
      createdBy: session.user.id,
    })
    .returning({ id: waCampaigns.id })

  await db.insert(campaignRecipients).values(
    audience.map((a) => ({ campaignId: campaign.id, contactId: a.id }))
  )

  await audit(session.user.id, "wa.campaign_create", campaign.id, {
    audience: audience.length,
  })

  // Hand off to Inngest for rate-limited fan-out.
  await inngest.send({
    name: "whatsapp/campaign.launch",
    data: { campaignId: campaign.id },
  })

  revalidatePath("/whatsapp/campaigns")
  return { ok: true, message: `Campaign scheduled for ${audience.length} recipient(s)` }
}

export async function cancelCampaignAction(campaignId: string): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin" && role !== "manager") throw new ForbiddenError()

  const [campaign] = await db
    .select({ status: waCampaigns.status })
    .from(waCampaigns)
    .where(eq(waCampaigns.id, campaignId))
    .limit(1)
  if (!campaign) throw new NotFoundError("Campaign not found")
  if (!["draft", "scheduled"].includes(campaign.status)) {
    return { ok: false, message: `Cannot cancel a ${campaign.status} campaign` }
  }

  await db
    .update(waCampaigns)
    .set({ status: "cancelled" })
    .where(eq(waCampaigns.id, campaignId))
  await audit(session.user.id, "wa.campaign_cancel", campaignId)
  revalidatePath("/whatsapp/campaigns")
  return { ok: true, message: "Campaign cancelled" }
}

/** Used by the Inngest fan-out — not exposed as a user action. */
export async function getCampaignPendingRecipients(campaignId: string, limit: number) {
  return db
    .select({
      recipientId: campaignRecipients.id,
      contactId: waContacts.id,
      waPhone: waContacts.waPhone,
    })
    .from(campaignRecipients)
    .innerJoin(waContacts, eq(campaignRecipients.contactId, waContacts.id))
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, "pending"),
        eq(waContacts.optedIn, true)
      )
    )
    .limit(limit)
}

export async function getRecentInboundSince(since: Date) {
  return db
    .select({ id: waMessages.id })
    .from(waMessages)
    .where(and(eq(waMessages.direction, "in"), gte(waMessages.timestamp, since)))
    .limit(1)
}
