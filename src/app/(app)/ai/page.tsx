import { and, isNull, sql } from "drizzle-orm"
import type { Metadata } from "next"
import { InfoIcon } from "lucide-react"

import { AssistantChat } from "@/components/ai/assistant-chat"
import { InsightsView } from "@/components/ai/insights-view"
import { WidgetRenderer } from "@/components/ai/widgets/widget-renderer"
import { isAIConfigured } from "@/lib/ai/provider"
import { DEMO_SPEC } from "@/lib/ai/demo-spec"
import { dashboardSpecSchema } from "@/lib/ai/widget-schema"
import { getLatestDashboard, listRecentInsights } from "@/lib/actions/ai"
import { db } from "@/lib/db"
import { leads } from "@/lib/db/schema"
import { requireUser, type Role } from "@/lib/rbac"

export const metadata: Metadata = { title: "AI" }

export default async function AiPage() {
  const session = await requireUser()
  const role = session.user.role as Role
  const configured = isAIConfigured()

  const [insights, distribution, pinned] = await Promise.all([
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
    getLatestDashboard(session.user.id).then((payload) =>
      payload !== null ? dashboardSpecSchema.safeParse(payload) : null
    ),
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

      {configured && pinned?.success ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Your last AI board
          </h2>
          <div className="rounded-xl border bg-background/60 p-4">
            <WidgetRenderer spec={pinned.data} />
          </div>
        </section>
      ) : null}

      {!configured ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <InfoIcon className="size-4" />
            <span>
              AI is not connected yet — set <code>OPENAI_API_KEY</code> to go live.
              Here is a demo of what the assistant renders for
              “show me analytics for employees and leads for the last 15 days”.
            </span>
          </div>
          <div className="rounded-xl border bg-background/60 p-4">
            <WidgetRenderer spec={DEMO_SPEC} />
          </div>
        </section>
      ) : null}

      <InsightsView
        insights={insights}
        scoreDistribution={scoreDistribution}
        canRun={role === "admin" || role === "manager"}
      />

      <AssistantChat configured={configured} />
    </div>
  )
}
