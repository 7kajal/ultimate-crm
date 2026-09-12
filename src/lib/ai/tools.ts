import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import { aiInsights, leads, tasks, waContacts, waMessages } from "@/lib/db/schema"
import type { Session } from "@/lib/rbac"
import { formatINR, timeAgo } from "@/lib/format"
import { heuristicScore } from "@/lib/ai/scoring"
import { analyticsEmployees, analyticsInvoices, analyticsOverview } from "@/lib/ai/analytics"
import { dashboardSpecSchema } from "@/lib/ai/widget-schema"
import { canManageAll, leadAccessCondition } from "@/lib/queries/scope"
import { isWhatsAppConfigured } from "@/lib/whatsapp/cloud-api"
import { childLogger } from "@/lib/logger"

const log = childLogger({ module: "ai-tools" })

type ToolResult = Promise<Record<string, unknown>>

/** Managers/admins see org-wide analytics; employees get their own leads. */
function requireManageAll(session: Session): boolean {
  return canManageAll(session)
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
        const scope = leadAccessCondition(session)
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
        const scope = leadAccessCondition(session)
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
        const scope = leadAccessCondition(session)
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
        const scope = leadAccessCondition(session)
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
          const scope = leadAccessCondition(session)
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

    analytics_overview: {
      description:
        "Analytics snapshot for a rolling period (default 30 days): new/won/open leads, pipeline value, win rate, daily trend, pipeline by stage, leads by source, and a per-assignee leaderboard. Employees get their own leads; admins/managers get the whole team. Use the exact numbers it returns when building widgets.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(30),
      }),
      execute: async ({ days }: { days?: number }): Promise<ToolResult> => {
        const result = await analyticsOverview(session, days ?? 30)
        return {
          periodLabel: result.periodLabel,
          summary: {
            newLeads: result.summary.newLeads,
            wonInPeriod: result.summary.wonInPeriod,
            openLeads: result.summary.openLeads,
            pipelineValue: formatINR(result.summary.pipelineValue),
            winRate: `${result.summary.winRate}%`,
            periodWinRate: `${result.summary.periodWinRate}%`,
            avgDealValue: formatINR(result.summary.avgDealValue),
            avgScore: result.summary.avgScore,
            staleLeads: result.summary.staleLeads,
            openTasks: result.summary.openTasks,
          },
          chart: {
            trend: result.trend,
            byStage: result.byStage,
            bySource: result.bySource,
            byAssignee: result.byAssignee,
          },
        }
      },
    },

    analytics_employees: {
      description:
        "Employee and attendance analytics for a rolling period (admins and managers only): headcount by department and employment type, attendance rate, leave requests, and a per-employee leaderboard of leads/won/conversion/tasks. Returns a 'managers only' notice for other roles.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(30),
      }),
      execute: async ({ days }: { days?: number }): Promise<ToolResult> => {
        if (!requireManageAll(session)) {
          return { notice: "Employee stats are available to managers and admins only." }
        }
        const result = await analyticsEmployees(session, days ?? 30)
        return {
          periodLabel: result.periodLabel,
          summary: {
            activeEmployees: result.summary.activeEmployees,
            inactiveCount: result.summary.inactiveCount,
            attendanceRate: `${result.summary.attendanceRate}%`,
            presentRate: `${result.summary.presentRate}%`,
            approvedLeaveRequests: result.summary.approvedLeaveRequests,
            pendingLeaveRequests: result.summary.pendingLeaveRequests,
          },
          chart: {
            byDepartment: result.byDepartment,
            byType: result.byType,
            perEmployee: result.perEmployee,
          },
        }
      },
    },

    analytics_invoices: {
      description:
        "Billing analytics for a rolling period (admins and managers only): outstanding, overdue and collected revenue, invoices by status, and a daily collection timeline. Returns a 'managers only' notice for other roles.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(365).default(30),
      }),
      execute: async ({ days }: { days?: number }): Promise<ToolResult> => {
        if (!requireManageAll(session)) {
          return { notice: "Revenue stats are available to managers and admins only." }
        }
        const result = await analyticsInvoices(session, days ?? 30)
        return {
          periodLabel: result.periodLabel,
          summary: {
            outstanding: formatINR(result.summary.outstanding),
            overdue: formatINR(result.summary.overdue),
            collectedInPeriod: formatINR(result.summary.collectedInPeriod),
            invoices: result.summary.invoiced,
          },
          chart: {
            byStatus: result.byStatus,
            revenueTimeline: result.revenueTimeline,
          },
        }
      },
    },

    render_widget: {
      description:
        "Render a visual dashboard (KPI cards, bar/line/donut charts, tables, leaderboards) inline in the chat, like a presenter drawing on a whiteboard. Call this whenever the user asks for analytics or summary visuals. Build `spec.widgets` only from exact numbers returned by the analytics tools — never invent or round values. Sets `unit: 'count'` for lead/task counts, `unit: 'currency'` for ₹ values, `unit: 'ratio'` for percentages.",
      inputSchema: z.object({
        spec: dashboardSpecSchema,
      }),
      execute: async ({ spec }: { spec: z.infer<typeof dashboardSpecSchema> }): Promise<ToolResult> => {
        const [insight] = await db
          .insert(aiInsights)
          .values({
            type: "summary",
            entityType: "dashboard",
            entityId: session.user.id,
            title: spec.title ?? "AI analytics board",
            body: spec.subtitle ?? spec.periodLabel ?? "",
            payload: spec,
            modelVersion: "dashboard-v1",
          })
          .returning({ id: aiInsights.id })
        log.info({ userId: session.user.id, widgets: spec.widgets.length }, "dashboard rendered")
        return { ok: true, insightId: insight?.id ?? null }
      },
    },
  }
}

export type AssistantTools = ReturnType<typeof createAssistantTools>
