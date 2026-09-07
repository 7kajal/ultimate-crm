import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { leads, tasks, waContacts, waMessages } from "@/lib/db/schema"
import type { Role, Session } from "@/lib/rbac"
import { formatINR, timeAgo } from "@/lib/format"
import { heuristicScore } from "@/lib/ai/scoring"
import { isWhatsAppConfigured } from "@/lib/whatsapp/cloud-api"

/** Row-level scope mirrors leads queries: employees see own + unassigned. */
function leadScope(session: Session) {
  const role = session.user.role as Role
  if (role === "admin" || role === "manager") return undefined
  return or(eq(leads.assignedTo, session.user.id), isNull(leads.assignedTo))
}

/**
 * Tools for the CRM assistant. Every tool is scoped to the caller's session.
 * Mutating tools keep narrow, auditable surfaces.
 */
export function createAssistantTools(session: Session) {
  return {
    query_leads: {
      description:
        "Search leads by name/company/email, optionally filtered by stage. Returns the top matches with score, value and stage.",
      inputSchema: z.object({
        query: z.string().max(100).optional(),
        stage: z
          .enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"])
          .optional(),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: async ({ query, stage, limit }: {
        query?: string
        stage?: string
        limit?: number
      }) => {
        const conditions = [isNull(leads.deletedAt)]
        const scope = leadScope(session)
        if (scope) conditions.push(scope)
        if (stage) conditions.push(sql`${leads.stage}::text = ${stage}`)
        if (query) {
          const term = `%${query}%`
          conditions.push(
            or(
              ilike(leads.name, term),
              ilike(leads.company, term),
              ilike(leads.email, term)
            )!
          )
        }

        const rows = await db
          .select()
          .from(leads)
          .where(and(...conditions))
          .orderBy(desc(leads.createdAt))
          .limit(limit ?? 5)

        return rows.map((l) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          stage: l.stage,
          value: formatINR(l.value),
          aiScore: l.aiScore ?? heuristicScore(l),
          assignee: l.assignedTo === session.user.id ? "you" : l.assignedTo,
          lastContact: l.lastContactedAt ? timeAgo(l.lastContactedAt) : "never",
        }))
      },
    },

    pipeline_stats: {
      description:
        "Get pipeline statistics: lead counts and total value per stage, for the whole team (managers/admins) or the caller's own leads.",
      inputSchema: z.object({}),
      execute: async () => {
        const scope = leadScope(session)
        const rows = await db
          .select({
            stage: leads.stage,
            count: sql<number>`count(*)::int`,
            totalValue: sql<number>`coalesce(sum(${leads.value}), 0)::bigint`,
          })
          .from(leads)
          .where(and(isNull(leads.deletedAt), ...(scope ? [scope] : [])))
          .groupBy(leads.stage)

        return rows.map((r) => ({
          stage: r.stage,
          count: Number(r.count),
          value: formatINR(Number(r.totalValue)),
        }))
      },
    },

    stale_leads: {
      description:
        "Find open leads with no contact in the given number of days (default 14). Useful for follow-up triage.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(90).default(14),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: async ({ days, limit }: { days?: number; limit?: number }) => {
        const cutoff = new Date(Date.now() - (days ?? 14) * 86_400_000)
        const scope = leadScope(session)
        const rows = await db
          .select()
          .from(leads)
          .where(
            and(
              isNull(leads.deletedAt),
              sql`${leads.stage}::text not in ('won', 'lost')`,
              sql`(${leads.lastContactedAt} is null or ${leads.lastContactedAt} < ${cutoff.toISOString()})`,
              ...(scope ? [scope] : [])
            )
          )
          .orderBy(sql`${leads.lastContactedAt} asc nulls first`)
          .limit(limit ?? 5)

        return rows.map((l) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          stage: l.stage,
          lastContact: l.lastContactedAt ? timeAgo(l.lastContactedAt) : "never",
        }))
      },
    },

    draft_whatsapp_reply: {
      description:
        "Fetch the recent WhatsApp conversation with a contact so you can draft a suitable reply. Returns the last messages (oldest first).",
      inputSchema: z.object({
        leadName: z.string().max(120),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ leadName, limit }: { leadName: string; limit?: number }) => {
        const scope = leadScope(session)
        const [lead] = await db
          .select({ id: leads.id })
          .from(leads)
          .where(
            and(
              ilike(leads.name, `%${leadName}%`),
              isNull(leads.deletedAt),
              ...(scope ? [scope] : [])
            )
          )
          .limit(1)
        if (!lead) return { error: `No lead matching "${leadName}"` }

        const [contact] = await db
          .select({ id: waContacts.id })
          .from(waContacts)
          .where(eq(waContacts.leadId, lead.id))
          .limit(1)
        if (!contact) return { error: `No WhatsApp contact linked to ${leadName}` }

        const messages = await db
          .select({
            direction: waMessages.direction,
            body: waMessages.body,
            timestamp: waMessages.timestamp,
          })
          .from(waMessages)
          .where(eq(waMessages.contactId, contact.id))
          .orderBy(desc(waMessages.timestamp))
          .limit(limit ?? 8)

        return {
          messages: messages.reverse().map((m) => ({
            from: m.direction === "in" ? "customer" : "you",
            body: m.body,
            at: timeAgo(m.timestamp),
          })),
          windowNote: isWhatsAppConfigured()
            ? "Check the 24h window in the inbox before sending free text."
            : "WhatsApp sending is not configured.",
        }
      },
    },

    create_task: {
      description:
        "Create a follow-up task assigned to the current user, optionally linked to a lead by name.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        leadName: z.string().max(120).optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        dueInDays: z.number().int().min(0).max(90).default(2),
      }),
      execute: async ({ title, leadName, priority, dueInDays }: {
        title: string
        leadName?: string
        priority?: "low" | "medium" | "high"
        dueInDays?: number
      }) => {
        let leadId: string | null = null
        if (leadName) {
          const scope = leadScope(session)
          const [lead] = await db
            .select({ id: leads.id })
            .from(leads)
            .where(
              and(
                ilike(leads.name, `%${leadName}%`),
                isNull(leads.deletedAt),
                ...(scope ? [scope] : [])
              )
            )
            .limit(1)
          leadId = lead?.id ?? null
        }

        const dueAt = new Date(Date.now() + (dueInDays ?? 2) * 86_400_000)
        const [task] = await db
          .insert(tasks)
          .values({
            title,
            priority: priority ?? "medium",
            dueAt,
            assigneeId: session.user.id,
            leadId,
            createdBy: session.user.id,
          })
          .returning({ id: tasks.id })

        return {
          taskId: task.id,
          title,
          dueAt: dueAt.toISOString().slice(0, 10),
          linkedLead: leadName ?? null,
        }
      },
    },
  }
}

export type AssistantTools = ReturnType<typeof createAssistantTools>
