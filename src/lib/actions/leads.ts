"use server"

import { and, eq, isNull, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { db } from "@/lib/db"
import {
  auditLogs,
  customers,
  leadActivities,
  leads,
  tasks,
  user,
  type LeadStage,
} from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import {
  ForbiddenError,
  NotFoundError,
  requireSession,
  type Role,
} from "@/lib/rbac"
import {
  addActivitySchema,
  assignLeadSchema,
  changeStageSchema,
  convertLeadSchema,
  createLeadSchema,
  createTaskSchema,
  toggleTaskSchema,
  updateLeadSchema,
} from "@/lib/validations/lead"

const log = childLogger({ module: "leads-actions" })

type ActionState =
  | { ok: true; message?: string; leadId?: string }
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

async function getAccessibleLead(
  session: Awaited<ReturnType<typeof requireSession>>,
  leadId: string
) {
  const role = session.user.role as Role
  const scope =
    role === "admin" || role === "manager"
      ? undefined
      : or(eq(leads.assignedTo, session.user.id), isNull(leads.assignedTo))

  const [lead] = await db
    .select()
    .from(leads)
    .where(
      and(eq(leads.id, leadId), isNull(leads.deletedAt), ...(scope ? [scope] : []))
    )
    .limit(1)

  if (!lead) throw new NotFoundError("Lead not found")
  return lead
}

function revalidateLeadPaths(leadId?: string) {
  revalidatePath("/leads")
  revalidatePath("/")
  if (leadId) revalidatePath(`/leads/${leadId}`)
}

export async function createLeadAction(
  input: unknown
): Promise<ActionState & { leadId?: string }> {
  const session = await requireSession()
  const parsed = createLeadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  const role = session.user.role as Role
  const assigneeId =
    role === "admin" || role === "manager" ? (data.assignedTo || null) : null

  const [lead] = await db
    .insert(leads)
    .values({
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      source: data.source,
      stage: data.stage,
      value: Math.round(data.value * 100),
      tags: data.tags,
      notes: data.notes || null,
      assignedTo: assigneeId,
      createdBy: session.user.id,
      nextFollowUpAt: data.nextFollowUpAt ?? null,
      expectedCloseAt: data.expectedCloseAt ?? null,
    })
    .returning({ id: leads.id })

  await db.insert(leadActivities).values({
    leadId: lead.id,
    userId: session.user.id,
    type: "system",
    body: `Lead created${assigneeId ? ` and assigned` : ""}`,
  })

  await audit(session.user.id, "lead.create", "lead", lead.id, { name: data.name })
  log.info({ leadId: lead.id, actor: session.user.id }, "lead created")
  revalidateLeadPaths(lead.id)

  return { ok: true, leadId: lead.id, message: "Lead created" }
}

export async function updateLeadAction(
  leadId: string,
  input: unknown
): Promise<ActionState> {
  const session = await requireSession()
  await getAccessibleLead(session, leadId)

  const parsed = updateLeadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.company !== undefined) patch.company = data.company || null
  if (data.email !== undefined) patch.email = data.email || null
  if (data.phone !== undefined) patch.phone = data.phone || null
  if (data.source !== undefined) patch.source = data.source
  if (data.value !== undefined) patch.value = Math.round(data.value * 100)
  if (data.tags !== undefined) patch.tags = data.tags
  if (data.notes !== undefined) patch.notes = data.notes || null
  if (data.nextFollowUpAt !== undefined) patch.nextFollowUpAt = data.nextFollowUpAt ?? null
  if (data.expectedCloseAt !== undefined) patch.expectedCloseAt = data.expectedCloseAt ?? null

  if (Object.keys(patch).length === 0) return { ok: true }

  await db.update(leads).set(patch).where(eq(leads.id, leadId))
  await audit(session.user.id, "lead.update", "lead", leadId, patch)
  log.info({ leadId, actor: session.user.id }, "lead updated")
  revalidateLeadPaths(leadId)
  return { ok: true, message: "Lead updated" }
}

export async function softDeleteLeadAction(leadId: string): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role === "employee") {
    const lead = await getAccessibleLead(session, leadId)
    if (lead.assignedTo !== session.user.id) {
      throw new ForbiddenError("Only the assignee or a manager can delete this lead")
    }
  } else {
    await getAccessibleLead(session, leadId)
  }

  await db
    .update(leads)
    .set({ deletedAt: new Date() })
    .where(eq(leads.id, leadId))
  await audit(session.user.id, "lead.delete", "lead", leadId)
  log.warn({ leadId, actor: session.user.id }, "lead soft-deleted")
  revalidateLeadPaths(leadId)
  return { ok: true, message: "Lead deleted" }
}

export async function assignLeadAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin" && role !== "manager") {
    throw new ForbiddenError("Only managers and admins can reassign leads")
  }

  const parsed = assignLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid assignment" }

  const { leadId, assigneeId } = parsed.data
  await getAccessibleLead(session, leadId)

  if (assigneeId) {
    const [assignee] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, assigneeId))
      .limit(1)
    if (!assignee) return { ok: false, message: "Assignee not found" }

    await db.update(leads).set({ assignedTo: assigneeId }).where(eq(leads.id, leadId))
    await db.insert(leadActivities).values({
      leadId,
      userId: session.user.id,
      type: "assignment",
      body: `Assigned to ${assignee.name}`,
    })
  } else {
    await db.update(leads).set({ assignedTo: null }).where(eq(leads.id, leadId))
    await db.insert(leadActivities).values({
      leadId,
      userId: session.user.id,
      type: "assignment",
      body: `Unassigned`,
    })
  }

  await audit(session.user.id, "lead.assign", "lead", leadId, { assigneeId })
  revalidateLeadPaths(leadId)
  return { ok: true, message: "Assignment updated" }
}

export async function changeStageAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const parsed = changeStageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid stage" }

  const { leadId, stage } = parsed.data
  const lead = await getAccessibleLead(session, leadId)
  if (lead.stage === stage) return { ok: true }

  await db.update(leads).set({ stage }).where(eq(leads.id, leadId))
  await db.insert(leadActivities).values({
    leadId,
    userId: session.user.id,
    type: "status_change",
    body: `Stage: ${lead.stage} → ${stage}`,
    metadata: { from: lead.stage, to: stage },
  })
  await audit(session.user.id, "lead.stage_change", "lead", leadId, {
    from: lead.stage,
    to: stage,
  })
  revalidateLeadPaths(leadId)
  return { ok: true, message: `Moved to ${stage}` }
}

export async function addActivityAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const parsed = addActivitySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check your input",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { leadId, type, body } = parsed.data
  await getAccessibleLead(session, leadId)

  await db.insert(leadActivities).values({
    leadId,
    userId: session.user.id,
    type,
    body,
  })

  if (type !== "note") {
    await db
      .update(leads)
      .set({ lastContactedAt: new Date() })
      .where(eq(leads.id, leadId))
  }

  revalidateLeadPaths(leadId)
  return { ok: true, message: "Activity logged" }
}

export async function convertLeadAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const parsed = convertLeadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the customer details",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const { leadId, ...customerData } = parsed.data
  const lead = await getAccessibleLead(session, leadId)

  if (lead.convertedCustomerId) {
    return { ok: false, message: "Lead is already converted" }
  }

  const result = await db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({
        name: customerData.name,
        company: customerData.company || null,
        email: customerData.email || null,
        phone: customerData.phone || null,
        gstin: customerData.gstin || null,
        addressLine: customerData.addressLine || null,
        city: customerData.city || null,
        state: customerData.state || null,
        pincode: customerData.pincode || null,
        notes: customerData.notes || null,
        originLeadId: leadId,
        ownerId: lead.assignedTo ?? session.user.id,
        createdBy: session.user.id,
      })
      .returning({ id: customers.id })

    await tx
      .update(leads)
      .set({ stage: "won" as LeadStage, convertedCustomerId: customer.id })
      .where(eq(leads.id, leadId))

    await tx.insert(leadActivities).values({
      leadId,
      userId: session.user.id,
      type: "system",
      body: `Converted to customer · stage set to Won`,
      metadata: { customerId: customer.id },
    })

    return customer
  })

  await audit(session.user.id, "lead.convert", "lead", leadId, {
    customerId: result.id,
  })
  log.info({ leadId, customerId: result.id }, "lead converted")
  revalidateLeadPaths(leadId)
  return { ok: true, message: "Converted to customer", leadId }
}

export async function createTaskAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the task details",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const data = parsed.data
  if (data.leadId) await getAccessibleLead(session, data.leadId)

  await db.insert(tasks).values({
    title: data.title,
    description: data.description || null,
    priority: data.priority,
    dueAt: data.dueAt ?? null,
    leadId: data.leadId || null,
    assigneeId: data.assigneeId || session.user.id,
    createdBy: session.user.id,
  })

  revalidateLeadPaths(data.leadId ?? undefined)
  return { ok: true, message: "Task created" }
}

export async function toggleTaskAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const parsed = toggleTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid request" }

  const { taskId, done } = parsed.data
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1)
  if (!task) throw new NotFoundError("Task not found")

  const role = session.user.role as Role
  const canTouch =
    task.assigneeId === session.user.id ||
    task.createdBy === session.user.id ||
    role === "admin" ||
    role === "manager"
  if (!canTouch) throw new ForbiddenError()

  await db
    .update(tasks)
    .set({
      status: done ? "done" : "open",
      completedAt: done ? new Date() : null,
    })
    .where(eq(tasks.id, taskId))

  revalidateLeadPaths(task.leadId ?? undefined)
  return { ok: true }
}
