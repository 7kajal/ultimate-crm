import type { Metadata } from "next"

import { CustomersView } from "@/components/customers/customers-view"
import { listCustomers } from "@/lib/queries/customers"
import { requireUser } from "@/lib/rbac"

export const metadata: Metadata = { title: "Customers" }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireUser()
  const { q } = await searchParams

  const customers = await listCustomers(q)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Converted accounts with billing history.
        </p>
      </div>

      <CustomersView customers={customers} />
    </div>
  )
}
