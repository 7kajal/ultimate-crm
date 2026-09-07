import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { db } from "@/lib/db"
import {
  customers,
  invoiceItems,
  invoices,
  payments,
  user,
  type Invoice,
} from "@/lib/db/schema"
import type { Session as RbacSession } from "@/lib/rbac"

const creatorUser = alias(user, "creator_user")

export type InvoiceRow = Invoice & {
  customerName: string
  customerCompany: string | null
}

export type InvoiceFilters = {
  status?: string
  search?: string
}

export async function listInvoices(
  _session: RbacSession,
  filters: InvoiceFilters = {}
): Promise<InvoiceRow[]> {
  const rows = await db
    .select({
      invoice: invoices,
      customerName: customers.name,
      customerCompany: customers.company,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        isNull(invoices.deletedAt),
        filters.status && filters.status !== "all"
          ? sql`${invoices.status}::text = ${filters.status}`
          : undefined,
        filters.search
          ? sql`(${invoices.number} ilike ${"%" + filters.search + "%"} or ${customers.name} ilike ${"%" + filters.search + "%"})`
          : undefined
      )
    )
    .orderBy(desc(invoices.createdAt))
    .limit(300)

  return rows.map((r) => ({
    ...r.invoice,
    customerName: r.customerName,
    customerCompany: r.customerCompany,
  }))
}

export async function getInvoiceDetail(invoiceId: string) {
  const [row] = await db
    .select({
      invoice: invoices,
      customer: customers,
      createdByName: creatorUser.name,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(creatorUser, eq(invoices.createdBy, creatorUser.id))
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  if (!row) return null

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(invoiceItems.position)

  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt))

  return {
    invoice: row.invoice,
    customer: row.customer,
    createdByName: row.createdByName ?? null,
    items,
    payments: invoicePayments,
  }
}

/** Public lookup for the pay page — token is the only secret. */
export async function getPublicInvoice(publicToken: string) {
  const [row] = await db
    .select({
      invoice: invoices,
      customer: customers,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.publicToken, publicToken), isNull(invoices.deletedAt)))
    .limit(1)

  if (!row) return null

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, row.invoice.id))
    .orderBy(invoiceItems.position)

  return { invoice: row.invoice, customer: row.customer, items }
}
