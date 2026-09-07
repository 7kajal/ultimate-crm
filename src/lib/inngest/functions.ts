import { and, eq, isNull, lt, sql } from "drizzle-orm"

import { inngest } from "@/lib/inngest/client"
import { generateWeeklySummary, scoreLeads } from "@/lib/ai/scoring"
import { db } from "@/lib/db"
import {
  aiInsights,
  campaignRecipients,
  invoices,
  waCampaigns,
  waContacts,
  waMessages,
  waTemplates,
} from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import { isWhatsAppConfigured, sendWhatsAppTemplate } from "@/lib/whatsapp/cloud-api"

const log = childLogger({ module: "inngest-functions" })

/** Daily: flip past-due sent/partially_paid invoices to overdue. */
export const markOverdueInvoices = inngest.createFunction(
  {
    id: "invoices-mark-overdue",
    name: "Mark overdue invoices",
    triggers: [{ cron: "TZ=Asia/Kolkata 2 6 * * *" }], // 06:02 IST daily
  },
  async ({ step }) => {
    const today = new Date().toISOString().slice(0, 10)

    const updated = await step.run("flip-overdue", async () => {
      const rows = await db
        .update(invoices)
        .set({ status: "overdue" })
        .where(
          and(
            lt(invoices.dueDate, today),
            isNull(invoices.deletedAt),
            sql`${invoices.status} in ('sent', 'partially_paid')`
          )
        )
        .returning({ id: invoices.id, number: invoices.number })
      return rows
    })

    log.info({ count: updated.length }, "overdue invoices flipped")
    return { overdueCount: updated.length, numbers: updated.map((r) => r.number) }
  }
)

const BATCH_SIZE = 50

/**
 * Rate-limited campaign fan-out. Meta Cloud API tier-1 allows ~100 msg/s;
 * we stay well under with sequential 50-batches and per-batch steps so a
 * failure resumes from the last completed batch.
 */
export const launchCampaign = inngest.createFunction(
  {
    id: "whatsapp-campaign-launch",
    name: "Launch WhatsApp campaign",
    triggers: [{ event: "whatsapp/campaign.launch" }],
    concurrency: { limit: 1 },
    retries: 2,
  },
  async ({ event, step }) => {
    const campaignId = (event.data as { campaignId: string }).campaignId

    const campaign = await step.run("load-campaign", async () => {
      const [row] = await db
        .select({
          campaign: waCampaigns,
          templateName: waTemplates.name,
          templateLang: waTemplates.language,
        })
        .from(waCampaigns)
        .innerJoin(waTemplates, eq(waCampaigns.templateId, waTemplates.id))
        .where(eq(waCampaigns.id, campaignId))
        .limit(1)

      if (!row) throw new Error(`Campaign ${campaignId} not found`)
      if (row.campaign.status === "cancelled") {
        return { skipped: true as const }
      }
      if (!isWhatsAppConfigured()) {
        throw new Error("WhatsApp is not configured")
      }
      return {
        skipped: false as const,
        templateName: row.templateName,
        templateLang: row.templateLang,
      }
    })

    if (campaign.skipped) return { skipped: true }

    await step.run("mark-running", async () => {
      await db
        .update(waCampaigns)
        .set({ status: "running", startedAt: new Date() })
        .where(eq(waCampaigns.id, campaignId))
    })

    let totalSent = 0
    let totalFailed = 0

    // Process in batches until no pending recipients remain.
    for (let batchIndex = 0; ; batchIndex++) {
      const batch = await step.run(`fetch-batch-${batchIndex}`, async () => {
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
          .limit(BATCH_SIZE)
      })

      if (batch.length === 0) break

      const results = await step.run(`send-batch-${batchIndex}`, async () => {
        const outcomes: { recipientId: string; contactId: string; ok: boolean; waMessageId?: string; error?: string }[] = []
        for (const r of batch) {
          try {
            const res = await sendWhatsAppTemplate(
              r.waPhone,
              campaign.templateName,
              campaign.templateLang
            )
            outcomes.push({
              recipientId: r.recipientId,
              contactId: r.contactId,
              ok: true,
              waMessageId: res.messages?.[0]?.id,
            })
          } catch (error) {
            outcomes.push({
              recipientId: r.recipientId,
              contactId: r.contactId,
              ok: false,
              error: error instanceof Error ? error.message : "send failed",
            })
          }
        }
        return outcomes
      })

      const batchStats = await step.run(`record-batch-${batchIndex}`, async () => {
        for (const r of results) {
          if (r.ok) {
            const [msg] = await db
              .insert(waMessages)
              .values({
                waMessageId: r.waMessageId ?? `camp_${r.recipientId}_${Date.now()}`,
                contactId: r.contactId,
                direction: "out",
                type: "template",
                body: `[Campaign template: ${campaign.templateName}]`,
                templateName: campaign.templateName,
                status: "sent",
                campaignId,
              })
              .returning({ id: waMessages.id })

            await db
              .update(campaignRecipients)
              .set({ status: "sent", messageId: msg?.id, sentAt: new Date() })
              .where(eq(campaignRecipients.id, r.recipientId))
          } else {
            await db
              .update(campaignRecipients)
              .set({ status: "failed", error: r.error })
              .where(eq(campaignRecipients.id, r.recipientId))
          }
        }

        const sent = results.filter((r) => r.ok).length
        const failed = results.length - sent

        await db
          .update(waCampaigns)
          .set({
            sentCount: sql`${waCampaigns.sentCount}::int + ${sent}`,
            failedCount: sql`${waCampaigns.failedCount}::int + ${failed}`,
          })
          .where(eq(waCampaigns.id, campaignId))

        return { sent, failed }
      })

      totalSent += batchStats.sent
      totalFailed += batchStats.failed
    }

    await step.run("mark-completed", async () => {
      await db
        .update(waCampaigns)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(waCampaigns.id, campaignId))
    })

    log.info({ campaignId, totalSent, totalFailed }, "campaign completed")
    return { campaignId, totalSent, totalFailed }
  }
)

/** Nightly: re-score open leads and refresh risk alerts. */
export const scoreLeadsNightly = inngest.createFunction(
  {
    id: "ai-lead-scoring",
    name: "AI lead scoring (nightly)",
    triggers: [{ cron: "TZ=Asia/Kolkata 30 2 * * *" }], // 02:30 IST daily
    retries: 2,
  },
  async ({ step }) => {
    const result = await step.run("score-leads", async () => scoreLeads(200))
    const highValue = result.filter((r) => r.score >= 70).length
    return { scored: result.length, hotLeads: highValue }
  }
)

/** Weekly: pipeline summary insight for the AI dashboard. */
export const weeklySummary = inngest.createFunction(
  {
    id: "ai-weekly-summary",
    name: "AI weekly pipeline summary",
    triggers: [{ cron: "TZ=Asia/Kolkata 0 9 * * 1" }], // Mondays 09:00 IST
    retries: 1,
  },
  async ({ step }) => {
    const summary = await step.run("generate-summary", async () =>
      generateWeeklySummary()
    )
    await step.run("store-summary", async () => {
      await db.insert(aiInsights).values({
        type: "summary",
        entityType: "pipeline",
        entityId: null,
        title: "Weekly pipeline summary",
        body: summary,
      })
    })
    return { summary }
  }
)

export const functions = [
  markOverdueInvoices,
  launchCampaign,
  scoreLeadsNightly,
  weeklySummary,
]

