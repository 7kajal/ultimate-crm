import { eq } from "drizzle-orm"
import type { Metadata } from "next"

import { SettingsForm } from "@/components/admin/settings-form"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  await requireRolePage("admin")

  const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Workspace configuration and billing profile.
        </p>
      </div>

      <SettingsForm
        settings={{
          companyName: row?.companyName ?? "My Company",
          gstin: row?.gstin ?? null,
          addressLine: row?.addressLine ?? null,
          city: row?.city ?? null,
          state: row?.state ?? null,
          pincode: row?.pincode ?? null,
          invoicePrefix: row?.invoicePrefix ?? "INV",
          invoiceCounter: row?.invoiceCounter ?? 0,
          defaultGstRate: row?.defaultGstRate ?? 18,
        }}
        supplierStateCode={process.env.COMPANY_STATE_CODE ?? "27"}
      />
    </div>
  )
}
