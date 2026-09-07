"use server"

import { desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { scoreLeads } from "@/lib/ai/scoring"
import { db } from "@/lib/db"
import { aiInsights } from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import { ForbiddenError, requireSession, type Role } from "@/lib/rbac"

const log = childLogger({ module: "ai-actions" })

type ActionState = { ok: boolean; message: string }

/** On-demand scoring run (admin/manager) — same path as the nightly cron. */
export async function runLeadScoringAction(): Promise<ActionState> {
  const session = await requireSession()
  const role = session.user.role as Role
  if (role !== "admin" && role !== "manager") {
    throw new ForbiddenError("Only managers and admins can run scoring")
  }

  const results = await scoreLeads(200)
  log.info({ actor: session.user.id, count: results.length }, "manual scoring run")
  revalidatePath("/ai")
  revalidatePath("/leads")
  return { ok: true, message: `Scored ${results.length} lead(s)` }
}

export async function listRecentInsights(limit = 20) {
  return db
    .select({
      id: aiInsights.id,
      type: aiInsights.type,
      title: aiInsights.title,
      body: aiInsights.body,
      score: aiInsights.score,
      createdAt: aiInsights.createdAt,
    })
    .from(aiInsights)
    .orderBy(desc(aiInsights.createdAt))
    .limit(limit)
}
