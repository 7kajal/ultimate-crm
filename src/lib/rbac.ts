import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"

export type Role = "admin" | "manager" | "employee"

export type Session = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>

export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() })
}

/** For pages/layouts: redirects to /login when unauthenticated. */
export async function requireUser(): Promise<Session> {
  const session = await getSession()
  if (!session?.user) redirect("/login")
  return session
}

/** For pages/layouts: redirects to / when role not allowed. */
export async function requireRolePage(...roles: Role[]): Promise<Session> {
  const session = await requireUser()
  const role = session.user.role as Role
  if (!roles.includes(role)) redirect("/")
  return session
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized")
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

/**
 * For server actions / route handlers. Always call inside the action body —
 * Next.js Server Functions are reachable via direct POST.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session?.user) throw new UnauthorizedError()
  return session
}

export async function requireRoles(...roles: Role[]): Promise<Session> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (!roles.includes(role)) throw new ForbiddenError()
  return session
}
