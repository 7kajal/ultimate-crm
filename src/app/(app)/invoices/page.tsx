import type { Metadata } from "next"

import { InvoicesView } from "@/components/billing/invoices-view"
import { listInvoices } from "@/lib/queries/invoices"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "Invoices" }

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireRolePage("admin", "manager")
  const { status = "all" } = await searchParams

  const invoices = await listInvoices({ user: { id: "" } } as never, { status })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Billing, GST and payment collection.
        </p>
      </div>

      <InvoicesView invoices={invoices} status={status} />
    </div>
  )
}
