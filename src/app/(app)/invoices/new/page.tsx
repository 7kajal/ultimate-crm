import { asc, isNull } from "drizzle-orm"
import type { Metadata } from "next"

import { NewInvoiceForm } from "@/components/billing/new-invoice-form"
import { db } from "@/lib/db"
import { customers } from "@/lib/db/schema"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "New invoice" }

export default async function NewInvoicePage() {
  await requireRolePage("admin", "manager")

  const customerOptions = await db
    .select({ id: customers.id, name: customers.name, company: customers.company })
    .from(customers)
    .where(isNull(customers.deletedAt))
    .orderBy(asc(customers.name))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          GST is computed automatically from place of supply.
        </p>
      </div>

      {customerOptions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No customers yet — convert a lead first.
        </div>
      ) : (
        <NewInvoiceForm customers={customerOptions} />
      )}
    </div>
  )
}
