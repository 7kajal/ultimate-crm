import { and, count, eq, gte, isNotNull, isNull, sql, sum } from "drizzle-orm"
import { format } from "date-fns"

import { db } from "@/lib/db"
import {
  attendance,
  departments,
  employees,
  invoices,
  leadActivities,
  leads,
  leaveRequests,
  payments,
  tasks,
  user,
} from "@/lib/db/schema"
import { canManageAll, leadAccessCondition } from "@/lib/queries/scope"
import type { Session } from "@/lib/rbac"

const DAY_MS = 86_400_000

function rangeStart(days: number): Date {
  return new Date(new Date().setHours(0, 0, 0, 0) - (days - 1) * DAY_MS)
}

function calendarDays(days: number): number {
  let count = 0
  for (let i = 0; i < days; i++) {
    const dow = new Date(Date.now() - i * DAY_MS).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function dayForKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10)
}

export type TrendSeries = { label: string; created: number; won: number }

export function fillDailyTrend(days: number, created: Map<string, number>, won: Map<string, number>): TrendSeries[] {
  const points: TrendSeries[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dayForKey(i)
    points.push({
      label: format(new Date(Date.now() - i * DAY_MS), "d MMM"),
      created: created.get(key) ?? 0,
      won: won.get(key) ?? 0,
    })
  }
  return points
}

function scopeOrSelf(session: Session) {
  return canManageAll(session) ? undefined : eq(tasks.assigneeId, session.user.id)
}

/**
 * End-to-end CRM analytics for a rolling period (default 30 days).
 * Employee role rows are scoped to own + unassigned leads.
 */
export async function analyticsOverview(session: Session, days: number) {
  const from = rangeStart(days)
  const scope = leadAccessCondition(session)

  const base = [isNull(leads.deletedAt), ...(scope ? [scope] : [])]

  const [createdRows, convertedRows, stageRows, sourceRows, assigneeRows, scoreRow, taskRow, staleRow] =
    await Promise.all([
      db
        .select({
          day: sql<string>`to_char(${leads.createdAt}, 'YYYY-MM-DD')`,
          count: count(),
        })
        .from(leads)
        .where(and(...base, gte(leads.createdAt, from)))
        .groupBy(sql`1`),

      db
        .select({
          day: sql<string>`to_char(${leadActivities.createdAt}, 'YYYY-MM-DD')`,
          count: count(),
        })
        .from(leadActivities)
        .innerJoin(leads, eq(leadActivities.leadId, leads.id))
        .where(
          and(
            eq(leadActivities.type, "status_change"),
            sql`${leadActivities.metadata}->>'to' = 'won'`,
            gte(leadActivities.createdAt, from),
            ...base
          )
        )
        .groupBy(sql`1`),

      db
        .select({
          stage: leads.stage,
          count: count(),
          value: sum(leads.value),
        })
        .from(leads)
        .where(and(...base))
        .groupBy(leads.stage),

      db
        .select({ source: leads.source, count: count() })
        .from(leads)
        .where(and(...base))
        .groupBy(leads.source),

      db
        .select({
          name: user.name,
          count: count(),
          won: sql<number>`count(*) filter (where ${leads.stage} = 'won')::int`,
        })
        .from(leads)
        .leftJoin(user, eq(leads.assignedTo, user.id))
        .where(and(...base))
        .groupBy(leads.assignedTo, user.name),

      db
        .select({
          value: sql<number>`coalesce(avg(${leads.aiScore})::numeric, 0)::int`,
        })
        .from(leads)
        .where(and(...base, isNotNull(leads.aiScore))),

      db
        .select({ value: count() })
        .from(tasks)
        .where(and(eq(tasks.status, "open"), ...(scopeOrSelf(session) ? [scopeOrSelf(session)!] : []))),

      db
        .select({ value: count() })
        .from(leads)
        .where(
          and(
            ...base,
            sql`${leads.stage}::text not in ('won', 'lost')`,
            sql`(${leads.lastContactedAt} is null or ${leads.lastContactedAt} < ${new Date(Date.now() - 14 * DAY_MS).toISOString()})`
          )
        ),
    ])

  const byStage = stageRows.map((r) => ({
    stage: r.stage,
    count: Number(r.count),
    value: Number(r.value ?? 0),
  }))

  const totalLeads = byStage.reduce((acc, r) => acc + r.count, 0)
  const wonOverall = byStage.find((r) => r.stage === "won")?.count ?? 0
  const openLeads = byStage.filter((r) => r.stage !== "won" && r.stage !== "lost").reduce((acc, r) => acc + r.count, 0)
  const pipelineValue = byStage
    .filter((r) => r.stage !== "won" && r.stage !== "lost")
    .reduce((acc, r) => acc + r.value, 0)

  const createdInPeriod = createdRows.reduce((acc, r) => acc + Number(r.count), 0)
  const wonInPeriod = convertedRows.reduce((acc, r) => acc + Number(r.count), 0)

  const trend = fillDailyTrend(
    days,
    new Map(createdRows.map((r) => [r.day, Number(r.count)])),
    new Map(convertedRows.map((r) => [r.day, Number(r.count)]))
  )

  return {
    periodLabel: `Last ${days} day${days === 1 ? "" : "s"}`,
    periodDays: days,
    summary: {
      newLeads: createdInPeriod,
      wonInPeriod,
      openLeads,
      pipelineValue,
      winRate: totalLeads ? Math.round((wonOverall / totalLeads) * 1000) / 10 : 0,
      periodWinRate: createdInPeriod ? Math.round((wonInPeriod / createdInPeriod) * 1000) / 10 : 0,
      avgDealValue: Math.round(pipelineValue / Math.max(openLeads, 1)),
      avgScore: Number(scoreRow?.[0]?.value ?? 0),
      staleLeads: Number(staleRow?.[0]?.value ?? 0),
      openTasks: Number(taskRow?.[0]?.value ?? 0),
    },
    trend,
    byStage,
    bySource: sourceRows.map((r) => ({ source: r.source, count: Number(r.count) })),
    byAssignee: assigneeRows
      .map((r) => ({
        name: r.name ?? "Unassigned",
        count: Number(r.count),
        won: Number(r.won),
        conversion: Number(r.count) ? Math.round((Number(r.won) / Number(r.count)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count),
  }
}

/** HR + per-employee KPIs. Callers must gate to admin/manager. */
export async function analyticsEmployees(session: Session, days: number) {
  void session
  const from = rangeStart(days)

  const [headRows, deptRows, typeRows, empCounts, leaveRows, pendingRows, attRows] = await Promise.all([
    db.select({ total: count(), active: sql<number>`count(*) filter (where ${employees.isActive})::int` }).from(employees),

    db
      .select({ name: departments.name, count: count() })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(employees.isActive, true))
      .groupBy(departments.name),

    db
      .select({ type: employees.employmentType, count: count() })
      .from(employees)
      .where(eq(employees.isActive, true))
      .groupBy(employees.employmentType),

    db
      .select({
        name: user.name,
        leads: sql<number>`count(leads.id)::int`,
        won: sql<number>`count(*) filter (where leads.stage = 'won')::int`,
        openTasks: sql<number>`count(tasks.id) filter (where tasks.status = 'open')::int`,
      })
      .from(employees)
      .innerJoin(user, eq(employees.userId, user.id))
      .leftJoin(leads, eq(leads.assignedTo, user.id))
      .leftJoin(tasks, eq(tasks.assigneeId, user.id))
      .where(and(eq(employees.isActive, true), isNull(leads.deletedAt)))
      .groupBy(user.id, user.name),

    db
      .select({ value: count() })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.status, "approved"), gte(leaveRequests.createdAt, from))),

    db
      .select({ value: count() })
      .from(leaveRequests)
      .where(eq(leaveRequests.status, "pending")),

    db
      .select({
        value: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'half_day', 'wfh'))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .where(gte(attendance.day, from.toISOString().slice(0, 10))),
  ])

  const totalEmployees = Number(headRows?.[0]?.total ?? 0)
  const activeEmployees = Number(headRows?.[0]?.active ?? 0)
  const workingDays = Math.max(calendarDays(days), 1)
  const expected = activeEmployees * workingDays
  const attendanceRate = attRows[0]?.total
    ? Math.round((Number(attRows[0].value) / Number(attRows[0].total)) * 1000) / 10
    : 0
  const presentRate = expected
    ? Math.round((Number(attRows[0]?.value ?? 0) / expected) * 1000) / 10
    : 0

  return {
    periodLabel: `Last ${days} day${days === 1 ? "" : "s"}`,
    periodDays: days,
    summary: {
      activeEmployees,
      inactiveCount: Math.max(totalEmployees - activeEmployees, 0),
      attendanceRate,
      presentRate,
      approvedLeaveRequests: Number(leaveRows?.[0]?.value ?? 0),
      pendingLeaveRequests: Number(pendingRows?.[0]?.value ?? 0),
    },
    byDepartment: deptRows.map((r) => ({ name: r.name ?? "Unassigned", count: Number(r.count) })),
    byType: typeRows.map((r) => ({ type: r.type, count: Number(r.count) })),
    perEmployee: empCounts
      .map((r) => ({
        name: r.name,
        leads: Number(r.leads),
        won: Number(r.won),
        openTasks: Number(r.openTasks),
        conversion: Number(r.leads) ? Math.round((Number(r.won) / Number(r.leads)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.leads - a.leads),
  }
}

/** Billing/revenue analytics. Callers must gate to admin/manager. */
export async function analyticsInvoices(session: Session, days: number) {
  void session
  const from = rangeStart(days)

  const [statusRows, paymentRows, outstandingRow] = await Promise.all([
    db
      .select({ status: invoices.status, count: count() })
      .from(invoices)
      .where(isNull(invoices.deletedAt))
      .groupBy(invoices.status),

    db
      .select({
        day: sql<string>`to_char(${payments.paidAt}, 'YYYY-MM-DD')`,
        value: sum(payments.amount),
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "captured"),
          gte(payments.paidAt, from)
        )
      )
      .groupBy(sql`1`),

    db
      .select({
        value: sql<number>`coalesce(sum(${invoices.total} - ${invoices.amountPaid}), 0)::bigint`,
      })
      .from(invoices)
      .where(
        and(
          isNull(invoices.deletedAt),
          sql`${invoices.status}::text in ('sent', 'partially_paid', 'overdue')`
        )
      ),
  ])

  const byStatus = statusRows.map((r) => ({ status: r.status, count: Number(r.count) }))

  return {
    periodLabel: `Last ${days} day${days === 1 ? "" : "s"}`,
    periodDays: days,
    summary: {
      outstanding: Number(outstandingRow?.[0]?.value ?? 0),
      overdue: byStatus.find((r) => r.status === "overdue")?.count ?? 0,
      invoiced: byStatus.reduce((acc, r) => acc + r.count, 0),
      collectedInPeriod: paymentRows.reduce((acc, r) => acc + Number(r.value ?? 0), 0),
    },
    byStatus,
    revenueTimeline: paymentRows
      .map((r) => ({
        day: r.day,
        label: new Date(`${r.day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        value: Number(r.value ?? 0),
      }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  }
}