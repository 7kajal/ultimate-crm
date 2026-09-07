import type { Metadata } from "next"

import { LeadsView } from "@/components/leads/leads-view"
import { listAssignableUsers, getPipelineStats, listLeads, canManageAll } from "@/lib/queries/leads"
import { requireUser } from "@/lib/rbac"
import { leadStageValues } from "@/lib/validations/lead"

export const metadata: Metadata = { title: "Leads" }

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; assignee?: string; create?: string }>
}) {
  const session = await requireUser()
  const params = await searchParams

  const stage =
    params.stage && (leadStageValues as readonly string[]).includes(params.stage)
      ? (params.stage as (typeof leadStageValues)[number])
      : "all"
  const assignee = params.assignee ?? "all"

  const [leads, stats, assignees] = await Promise.all([
    listLeads(session, {
      search: params.q,
      stage,
      assignee,
    }),
    getPipelineStats(session),
    listAssignableUsers(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {canManageAll(session)
            ? "All leads across the team."
            : "Your leads and unassigned queue."}
        </p>
      </div>

      <LeadsView
        leads={leads}
        stats={stats}
        assignees={assignees}
        canAssign={canManageAll(session)}
        openCreate={params.create === "1"}
      />
    </div>
  )
}
