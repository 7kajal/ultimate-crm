import { eq, isNull, or, type SQL } from "drizzle-orm"

import { leads } from "@/lib/db/schema"
import type { Role, Session } from "@/lib/rbac"

/** True when the caller may view and manage every row (not just their own). */
export function canManageAll(session: Session): boolean {
  const role = session.user.role as Role
  return role === "admin" || role === "manager"
}

/**
 * Row-level lead scope: employees see their own + unassigned leads,
 * admins/managers see everything. Returns a SQL condition or undefined.
 */
export function leadAccessCondition(session: Session): SQL | undefined {
  if (canManageAll(session)) return undefined
  return or(eq(leads.assignedTo, session.user.id), isNull(leads.assignedTo))
}