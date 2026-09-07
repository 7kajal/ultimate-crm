import { and, asc, count, desc, eq, gte, sql, sum } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "@/lib/db"
import {
  attendance,
  departments,
  employees,
  leadActivities,
  leads,
  leaveRequests,
  user,
} from "@/lib/db/schema"
import type { Role, Session } from "@/lib/rbac"

const managerUser = alias(user, "manager_user")
const reviewerUser = alias(user, "reviewer_user")

export type EmployeeRow = {
  userId: string
  name: string
  email: string
  role: string | null
  designation: string | null
  phone: string | null
  employeeCode: string
  employmentType: string
  leaveBalance: number
  joinedAt: string
  isActive: boolean
  departmentName: string | null
  managerName: string | null
}

export async function listEmployees(): Promise<EmployeeRow[]> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      phone: user.phone,
      employeeCode: employees.employeeCode,
      employmentType: employees.employmentType,
      leaveBalance: employees.leaveBalance,
      joinedAt: employees.joinedAt,
      isActive: employees.isActive,
      departmentName: departments.name,
      managerName: managerUser.name,
    })
    .from(employees)
    .innerJoin(user, eq(employees.userId, user.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .leftJoin(managerUser, eq(employees.managerId, managerUser.id))
    .orderBy(asc(user.name))

  return rows.map((r) => ({
    ...r,
    managerName: r.managerName ?? null,
  }))
}

export async function getEmployeeProfile(viewerSession: Session, targetUserId: string) {
  const [row] = await db
    .select({
      user,
      employee: employees,
      departmentName: departments.name,
    })
    .from(employees)
    .innerJoin(user, eq(employees.userId, user.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employees.userId, targetUserId))
    .limit(1)

  if (!row) return null

  let managerName: string | null = null
  if (row.employee.managerId) {
    const [mgr] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, row.employee.managerId))
      .limit(1)
    managerName = mgr?.name ?? null
  }

  const since = new Date()
  since.setDate(since.getDate() - 34)

  const [attendanceRows, leaves, perf] = await Promise.all([
    db
      .select()
      .from(attendance)
      .where(and(eq(attendance.userId, targetUserId), gte(attendance.day, since.toISOString().slice(0, 10))))
      .orderBy(asc(attendance.day)),
    db
      .select({
        request: leaveRequests,
        reviewerName: reviewerUser.name,
      })
      .from(leaveRequests)
      .leftJoin(reviewerUser, eq(leaveRequests.reviewedBy, reviewerUser.id))
      .where(eq(leaveRequests.userId, targetUserId))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(20),
    db
      .select({
        stage: leads.stage,
        count: count(),
        totalValue: sum(leads.value),
      })
      .from(leads)
      .where(and(eq(leads.assignedTo, targetUserId), sql`${leads.deletedAt} is null`))
      .groupBy(leads.stage),
  ])

  const perfByStage = new Map(perf.map((p) => [p.stage, p]))
  const won = perfByStage.get("won")
  const openCount = perf
    .filter((p) => p.stage !== "won" && p.stage !== "lost")
    .reduce((acc, p) => acc + Number(p.count), 0)

  const recentActivityCount = await db
    .select({ c: count() })
    .from(leadActivities)
    .where(
      and(eq(leadActivities.userId, targetUserId), gte(leadActivities.createdAt, since))
    )

  return {
    user: row.user,
    employee: row.employee,
    departmentName: row.departmentName,
    managerName,
    attendance: attendanceRows,
    leaves: leaves.map((l) => ({ ...l.request, reviewerName: l.reviewerName })),
    performance: {
      dealsWon: Number(won?.count ?? 0),
      revenueWon: Number(won?.totalValue ?? 0),
      openLeads: openCount,
      activitiesLast30d: Number(recentActivityCount[0]?.c ?? 0),
    },
  }
}

export async function listLeaveRequests(session: Session, status?: string) {
  const role = session.user.role as Role
  const scope =
    role === "admin" || role === "manager"
      ? undefined
      : eq(leaveRequests.userId, session.user.id)

  const rows = await db
    .select({
      request: leaveRequests,
      userName: user.name,
      userEmail: user.email,
      reviewerName: reviewerUser.name,
    })
    .from(leaveRequests)
    .innerJoin(user, eq(leaveRequests.userId, user.id))
    .leftJoin(reviewerUser, eq(leaveRequests.reviewedBy, reviewerUser.id))
    .where(
      and(
        scope,
        status && status !== "all"
          ? sql`${leaveRequests.status}::text = ${status}`
          : undefined
      )
    )
    .orderBy(desc(leaveRequests.createdAt))
    .limit(200)

  return rows.map((r) => ({
    ...r.request,
    userName: r.userName,
    userEmail: r.userEmail,
    reviewerName: r.reviewerName ?? null,
  }))
}

export async function listDepartments() {
  return db.select().from(departments).orderBy(asc(departments.name))
}

export async function getPendingLeaveCount(): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(leaveRequests)
    .where(eq(leaveRequests.status, "pending"))
  return Number(row?.c ?? 0)
}

export async function getMyLeaveBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ leaveBalance: employees.leaveBalance })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1)
  return row?.leaveBalance ?? 0
}

export async function getTodayAttendance(userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const [row] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, userId), eq(attendance.day, today)))
    .limit(1)
  return row ?? null
}
