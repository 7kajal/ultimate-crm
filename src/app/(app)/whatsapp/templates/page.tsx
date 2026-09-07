import type { Metadata } from "next"

import { TemplatesView } from "@/components/whatsapp/templates-view"
import { isWhatsAppConfigured } from "@/lib/whatsapp/cloud-api"
import { listTemplates } from "@/lib/queries/whatsapp"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "WhatsApp templates" }

export default async function TemplatesPage() {
  await requireRolePage("admin", "manager")
  const templates = await listTemplates()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Message templates from your WhatsApp Business Account.
        </p>
      </div>

      <TemplatesView
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          language: t.language,
          status: t.status,
          rejectionReason: t.rejectionReason,
          lastSyncedAt: t.lastSyncedAt,
        }))}
        canSync
        isConfigured={isWhatsAppConfigured()}
      />
    </div>
  )
}
