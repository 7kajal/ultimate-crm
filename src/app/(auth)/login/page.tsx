import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getSession } from "@/lib/rbac"

import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const [{ next }, session] = await Promise.all([searchParams, getSession()])
  if (session?.user) {
    redirect(next && next.startsWith("/") ? next : "/")
  }
  return <LoginForm next={next} />
}
