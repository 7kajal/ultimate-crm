import { and, asc, count, desc, eq, ilike, isNull, or, sql, sum } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  leadActivities,
  leads,
  tasks,
  user,
  type Lead,
  type LeadStage,
} from "@/lib/db/schema"
import type { Role, Session } from "@/lib/rbac"

export type LeadWithAssignee = Lead & {
  assigneeName: string | null
  assigneeEmail: string | null
}

export type LeadFilters = {
  search?: string
  stage?: LeadStage | "all"
  assignee?: string | "all" | "unassigned"
  source?: string | "all"
}

/** Row-level scope: employees see only their own + unassigned leads. */
function accessCondition(session: Session) {
  const role = session.user.role as Role
  if (role === "admin" || role === "manager") return undefined
  return or(eq(leads.assignedTo, session.user.id), isNull(leads.assignedTo))
}

export function canManageAll(session: Session): boolean {
  const role = session.user.role as Role
  return role === "admin" || role === "manager"
}

export async function listLeads(
  session: Session,
  filters: LeadFilters = {}
): Promise<LeadWithAssignee[]> {
  const conditions = [isNull(leads.deletedAt)]
  const access = accessCondition(session)
  if (access) conditions.push(access)

  if (filters.search) {
    const term = `%${filters.search}%`
    conditions.push(
      or(
        ilike(leads.name, term),
        ilike(leads.company, term),
        ilike(leads.email, term),
        ilike(leads.phone, term)
      )!
    )
  }
  if (filters.stage && filters.stage !== "all") {
    conditions.push(eq(leads.stage, filters.stage))
  }
  if (filters.assignee === "unassigned") {
    conditions.push(isNull(leads.assignedTo))
  } else if (filters.assignee && filters.assignee !== "all") {
    conditions.push(eq(leads.assignedTo, filters.assignee))
  }
  if (filters.source && filters.source !== "all") {
    conditions.push(sql`${leads.source}::text = ${filters.source}`)
  }

  const rows = await db
    .select({
      lead: leads,
      assigneeName: user.name,
      assigneeEmail: user.email,
    })
    .from(leads)
    .leftJoin(user, eq(leads.assignedTo, user.id))
    .where(and(...conditions))
    .orderBy(desc(leads.createdAt))
    .limit(500)

  return rows.map((r) => ({
    ...r.lead,
    assigneeName: r.assigneeName,
    assigneeEmail: r.assigneeEmail,
  }))
}

export async function getLeadDetail(session: Session, id: string) {
  const access = accessCondition(session)
  const [row] = await db
    .select({
      lead: leads,
      assigneeName: user.name,
      assigneeEmail: user.email,
    })
    .from(leads)
    .leftJoin(user, eq(leads.assignedTo, user.id))
    .where(and(eq(leads.id, id), isNull(leads.deletedAt), ...(access ? [access] : [])))
    .limit(1)

  if (!row) return null

  const activities = await db
    .select({
      activity: leadActivities,
      actorName: user.name,
    })
    .from(leadActivities)
    .leftJoin(user, eq(leadActivities.userId, user.id))
    .where(eq(leadActivities.leadId, id))
    .orderBy(desc(leadActivities.createdAt))
    .limit(100)

  const leadTasks = await db
    .select({ task: tasks, assigneeName: user.name })
    .from(tasks)
    .leftJoin(user, eq(tasks.assigneeId, user.id))
    .where(eq(tasks.leadId, id))
    .orderBy(asc(tasks.status), asc(tasks.dueAt))

  return {
    lead: {
      ...row.lead,
      assigneeName: row.assigneeName,
      assigneeEmail: row.assigneeEmail,
    },
    activities: activities.map((a) => ({ ...a.activity, actorName: a.actorName })),
    tasks: leadTasks.map((t) => ({ ...t.task, assigneeName: t.assigneeName })),
  }
}

export async function getPipelineStats(session: Session) {
  const access = accessCondition(session)
  const rows = await db
    .select({
      stage: leads.stage,
      count: count(),
      totalValue: sum(leads.value),
    })
    .from(leads)
    .where(and(isNull(leads.deletedAt), ...(access ? [access] : [])))
    .groupBy(leads.stage)

  return rows.map((r) => ({
    stage: r.stage,
    count: Number(r.count),
    totalValue: Number(r.totalValue ?? 0),
  }))
}

export async function listAssignableUsers() {
  return db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .orderBy(asc(user.name))
}
