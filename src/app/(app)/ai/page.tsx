import { and, isNull, sql } from "drizzle-orm"
import type { Metadata } from "next"

import { AssistantChat } from "@/components/ai/assistant-chat"
import { InsightsView } from "@/components/ai/insights-view"
import { isAIConfigured } from "@/lib/ai/provider"
import { listRecentInsights } from "@/lib/actions/ai"
import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { requireUser, type Role } from "@/lib/rbac"

export const metadata: Metadata = { title: "AI" }

export default async function AiPage() {
  const session = await requireUser()
  const role = session.user.role as Role

  const [insights, distribution] = await Promise.all([
    listRecentInsights(15),
    db
      .select({
        bucket: sql<string>`case
          when ${leads.aiScore} is null then 'unscored'
          when ${leads.aiScore} >= 70 then '70–100'
          when ${leads.aiScore} >= 40 then '40–69'
          else '0–39' end`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(
        and(isNull(leads.deletedAt), sql`${leads.stage}::text not in ('won','lost')`)
      )
      .groupBy(sql`1`),
  ])

  const buckets = ["70–100", "40–69", "0–39", "unscored"]
  const byBucket = new Map(distribution.map((d) => [d.bucket, Number(d.count)]))
  const scoreDistribution = buckets.map((bucket) => ({
    bucket,
    count: byBucket.get(bucket) ?? 0,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Lead scoring, risk signals and a pipeline-aware assistant.
        </p>
      </div>

      <InsightsView
        insights={insights}
        scoreDistribution={scoreDistribution}
        canRun={role === "admin" || role === "manager"}
      />

      <AssistantChat configured={isAIConfigured()} />
    </div>
  )
}
