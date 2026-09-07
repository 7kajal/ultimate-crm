"use server"

import { desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { auditLogs, settings, user } from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import { ForbiddenError, requireSession, type Role } from "@/lib/rbac"

const log = childLogger({ module: "admin-actions" })

type ActionState = { ok: boolean; message: string }

const updateSettingsSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  gstin: z
    .string()
    .trim()
    .max(15)
    .regex(/^[0-9A-Z]*$/, "GSTIN: letters and numbers only")
    .optional()
    .or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  pincode: z.string().trim().max(10).optional().or(z.literal("")),
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9-]+$/, "Prefix: letters, numbers, dashes"),
  defaultGstRate: z.union([
    z.literal(0),
    z.literal(5),
    z.literal(12),
    z.literal(18),
    z.literal(28),
  ]),
})

export async function updateSettingsAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin") throw new ForbiddenError("Only admins can update settings")

  const parsed = updateSettingsSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>
    const first = Object.values(fieldErrors)[0]?.[0]
    return { ok: false, message: first ?? "Please fix the highlighted fields" }
  }

  const data = parsed.data
  await db
    .update(settings)
    .set({
      companyName: data.companyName,
      gstin: data.gstin || null,
      addressLine: data.addressLine || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      invoicePrefix: data.invoicePrefix.toUpperCase(),
      defaultGstRate: data.defaultGstRate,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, 1))

  log.info({ actor: session.user.id }, "settings updated")
  revalidatePath("/admin/settings")
  return { ok: true, message: "Settings saved" }
}

export async function listAuditLogs(filters: {
  action?: string
  entity?: string
  limit?: number
}) {
  await requireSession()

  const conditions = []
  if (filters.action) {
    conditions.push(sql`${auditLogs.action} ilike ${"%" + filters.action + "%"}`)
  }
  if (filters.entity) {
    conditions.push(sql`${auditLogs.entityType} ilike ${"%" + filters.entity + "%"}`)
  }

  const rows = await db
    .select({
      log: auditLogs,
      actorName: user.name,
      actorEmail: user.email,
    })
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.actorId, user.id))
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` and `)}` : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(filters.limit ?? 200)

  return rows.map((r) => ({
    ...r.log,
    actorName: r.actorName,
    actorEmail: r.actorEmail,
  }))
}
