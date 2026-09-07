import type { Metadata } from "next"

import {
  CampaignsView,
  type CampaignRow,
} from "@/components/whatsapp/campaigns-view"
import { listCampaigns, listTemplates } from "@/lib/queries/whatsapp"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "Campaigns" }

type RawCampaign = {
  id: string
  name: string
  status: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  sent_count: string
  failed_count: string
  template_name: string
  recipient_count: number
}

export default async function CampaignsPage() {
  await requireRolePage("admin", "manager")

  const [rawCampaigns, templates] = await Promise.all([
    listCampaigns(),
    listTemplates("APPROVED"),
  ])

  const campaigns = (rawCampaigns as { campaign: RawCampaign }[]).map(
    (r): CampaignRow => ({
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      scheduledAt: r.campaign.scheduled_at,
      startedAt: r.campaign.started_at,
      completedAt: r.campaign.completed_at,
      sentCount: r.campaign.sent_count,
      failedCount: r.campaign.failed_count,
      templateName: r.campaign.template_name,
      recipientCount: Number(r.campaign.recipient_count ?? 0),
    })
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Broadcast approved templates to opted-in audiences.
        </p>
      </div>

      <CampaignsView
        campaigns={campaigns}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
        }))}
      />
    </div>
  )
}
