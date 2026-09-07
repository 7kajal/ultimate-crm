"use server"

import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  attendance,
  auditLogs,
  departments,
  employees,
  leaveRequests,
  user,
} from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import {
  ForbiddenError,
  NotFoundError,
  requireSession,
  type Role,
} from "@/lib/rbac"
import {
  applyLeaveSchema,
  createEmployeeSchema,
  markAttendanceSchema,
  reviewLeaveSchema,
  updateEmployeeSchema,
} from "@/lib/validations/hr"

const log = childLogger({ module: "hr-actions" })

type ActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }

async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  diff?: unknown
) {
  const hdrs = await headers()
  await db.insert(auditLogs).values({
    actorId,
    action,
    entityType,
    entityId,
    diff: diff ?? null,
    requestId: hdrs.get("x-request-id"),
    userAgent: hdrs.get("user-agent"),
  })
}

function requireManageRole(role: Role) {
  if (role !== "admin" && role !== "manager") {
    throw new ForbiddenError("Only managers and admins can perform this action")
  }
}

/** Count working days (Mon–Sat) inclusive. */
function workingDays(start: Date, end: Date): number {
  let days = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const dow = cursor.getDay()
    if (dow !== 0) days += 1 // exclude Sundays
    cursor.setDate(cursor.getDate() + 1)
  }
  return Math.max(days, 1)
}

export async function createEmployeeAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin") throw new ForbiddenError("Only admins can add employees")

  const parsed = createEmployeeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  try {
    // Admin plugin's createUser only accepts its default roles; our custom
    // roles ("manager", "employee") are applied right after creation.
    const created = await auth.api.createUser({
      body: {
        email: data.email,
        name: data.name,
        password: data.password,
        role: data.role === "admin" ? "admin" : "user",
        data: {
          phone: data.phone || null,
          designation: data.designation || null,
        },
      },
    })

    await db
      .update(user)
      .set({ role: data.role })
      .where(eq(user.id, created.user.id))

    await db.insert(employees).values({
      userId: created.user.id,
      employeeCode: `EMP-${Date.now().toString(36).toUpperCase()}`,
      departmentId: data.departmentId || null,
      managerId: data.managerId || null,
      employmentType: data.employmentType,
      leaveBalance: data.leaveBalance,
    })

    await audit(session.user.id, "employee.create", "user", created.user.id, {
      email: data.email,
      role: data.role,
    })
    log.info({ userId: created.user.id, actor: session.user.id }, "employee created")
    revalidatePath("/employees")
    return { ok: true, message: "Employee added" }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (message.includes("already") || message.includes("unique")) {
      return {
        ok: false,
        message: "Employee could not be created",
        fieldErrors: { email: ["This email is already registered"] },
      }
    }
    log.error({ err: error }, "create employee failed")
    return { ok: false, message: "Could not create employee" }
  }
}

export async function updateEmployeeAction(
  targetUserId: string,
  input: unknown
): Promise<ActionState> {
  const session = await requireSession()
  requireManageRole(session.user.role as Role)

  const parsed = updateEmployeeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  const userPatch: Record<string, unknown> = {}
  if (data.designation !== undefined) userPatch.designation = data.designation || null
  if (data.phone !== undefined) userPatch.phone = data.phone || null

  const employeePatch: Record<string, unknown> = {}
  if (data.departmentId !== undefined) employeePatch.departmentId = data.departmentId || null
  if (data.managerId !== undefined) employeePatch.managerId = data.managerId || null
  if (data.employmentType !== undefined) employeePatch.employmentType = data.employmentType
  if (data.leaveBalance !== undefined) employeePatch.leaveBalance = data.leaveBalance
  if (data.isActive !== undefined) employeePatch.isActive = data.isActive

  if (Object.keys(userPatch).length > 0) {
    await db.update(user).set(userPatch).where(eq(user.id, targetUserId))
  }
  if (Object.keys(employeePatch).length > 0) {
    await db.update(employees).set(employeePatch).where(eq(employees.userId, targetUserId))
  }

  await audit(session.user.id, "employee.update", "user", targetUserId, {
    ...userPatch,
    ...employeePatch,
  })
  revalidatePath("/employees")
  revalidatePath(`/employees/${targetUserId}`)
  return { ok: true, message: "Employee updated" }
}

export async function markAttendanceAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const parsed = markAttendanceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid attendance" }

  const today = new Date().toISOString().slice(0, 10)
  await db
    .insert(attendance)
    .values({
      userId: session.user.id,
      day: today,
      status: parsed.data.status,
      note: parsed.data.note || null,
    })
    .onConflictDoUpdate({
      target: [attendance.userId, attendance.day],
      set: { status: parsed.data.status, note: parsed.data.note || null },
    })

  revalidatePath(`/employees/${session.user.id}`)
  return { ok: true, message: "Attendance marked" }
}

export async function applyLeaveAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const parsed = applyLeaveSchema.safeParse(input)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    const fieldErrors = flat.fieldErrors as Record<string, string[]>
    const message =
      fieldErrors.endDate?.[0] ?? "Please fix the highlighted fields"
    return { ok: false, message, fieldErrors }
  }

  const { type, startDate, endDate, reason } = parsed.data
  const days = workingDays(startDate, endDate)

  const [employee] = await db
    .select({ leaveBalance: employees.leaveBalance })
    .from(employees)
    .where(eq(employees.userId, session.user.id))
    .limit(1)
  if (!employee) throw new NotFoundError("Employee profile missing")

  if (type !== "unpaid" && days > employee.leaveBalance) {
    return {
      ok: false,
      message: `Insufficient balance: ${days} working days requested, ${employee.leaveBalance} available`,
    }
  }

  // No overlapping pending/approved requests.
  const overlap = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.userId, session.user.id),
        sql`${leaveRequests.status} in ('pending', 'approved')`,
        sql`${leaveRequests.startDate} <= ${endDate.toISOString().slice(0, 10)}`,
        sql`${leaveRequests.endDate} >= ${startDate.toISOString().slice(0, 10)}`
      )
    )
    .limit(1)
  if (overlap.length > 0) {
    return { ok: false, message: "You already have a request overlapping these dates" }
  }

  await db.insert(leaveRequests).values({
    userId: session.user.id,
    type,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    days,
    reason: reason || null,
  })

  await audit(session.user.id, "leave.apply", "leave_request", null, {
    days,
    type,
  })
  revalidatePath("/leaves")
  return { ok: true, message: `Leave requested for ${days} day(s)` }
}

export async function reviewLeaveAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  requireManageRole(session.user.role as Role)

  const parsed = reviewLeaveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid request" }

  const { requestId, decision } = parsed.data
  if (decision === "pending" || decision === "cancelled") {
    return { ok: false, message: "Invalid decision" }
  }

  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(eq(leaveRequests.id, requestId))
    .limit(1)
  if (!request) throw new NotFoundError("Leave request not found")
  if (request.status !== "pending") {
    return { ok: false, message: "This request was already reviewed" }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(leaveRequests)
      .set({
        status: decision,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequests.id, requestId))

    if (decision === "approved" && request.type !== "unpaid") {
      await tx
        .update(employees)
        .set({
          leaveBalance: sql`greatest(${employees.leaveBalance} - ${request.days}, 0)`,
        })
        .where(eq(employees.userId, request.userId))
    }
  })

  await audit(session.user.id, `leave.${decision}`, "leave_request", requestId, {
    userId: request.userId,
    days: request.days,
  })
  log.info({ requestId, decision, actor: session.user.id }, "leave reviewed")
  revalidatePath("/leaves")
  revalidatePath(`/employees/${request.userId}`)
  return { ok: true, message: `Request ${decision}` }
}

export async function createDepartmentAction(
  name: string,
  description?: string
): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin") throw new ForbiddenError("Only admins can create departments")

  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) {
    return { ok: false, message: "Invalid department name" }
  }

  const existing = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.name, trimmed))
    .limit(1)
  if (existing.length > 0) {
    return { ok: false, message: "Department already exists" }
  }

  await db.insert(departments).values({ name: trimmed, description: description?.trim() || null })
  await audit(session.user.id, "department.create", "department", null, { name: trimmed })
  revalidatePath("/employees")
  return { ok: true, message: "Department created" }
}
