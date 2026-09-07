import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { customers, invoices, user } from "@/lib/db/schema"

export type CustomerRow = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  gstin: string | null
  city: string | null
  state: string | null
  ownerName: string | null
  invoiceCount: number
  totalBilled: number
  outstanding: number
  createdAt: Date
}

export async function listCustomers(search?: string): Promise<CustomerRow[]> {
  const conditions = [isNull(customers.deletedAt)]
  if (search) {
    const term = `%${search}%`
    conditions.push(
      or(
        ilike(customers.name, term),
        ilike(customers.company, term),
        ilike(customers.email, term),
        ilike(customers.phone, term)
      )!
    )
  }

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      company: customers.company,
      email: customers.email,
      phone: customers.phone,
      gstin: customers.gstin,
      city: customers.city,
      state: customers.state,
      ownerName: user.name,
      invoiceCount: sql<number>`(select count(*)::int from invoices i where i.customer_id = ${customers.id} and i.deleted_at is null)`,
      totalBilled: sql<number>`(select coalesce(sum(i.total), 0)::bigint from invoices i where i.customer_id = ${customers.id} and i.deleted_at is null)`,
      outstanding: sql<number>`(select coalesce(sum(i.total - i.amount_paid), 0)::bigint from invoices i where i.customer_id = ${customers.id} and i.deleted_at is null and i.status not in ('paid', 'cancelled', 'draft'))`,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .leftJoin(user, eq(customers.ownerId, user.id))
    .where(and(...conditions))
    .orderBy(asc(customers.name))
    .limit(300)

  return rows.map((r) => ({
    ...r,
    invoiceCount: Number(r.invoiceCount),
    totalBilled: Number(r.totalBilled),
    outstanding: Number(r.outstanding),
  }))
}

export async function getCustomerDetail(customerId: string) {
  const [row] = await db
    .select({
      customer: customers,
      ownerName: user.name,
    })
    .from(customers)
    .leftJoin(user, eq(customers.ownerId, user.id))
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1)

  if (!row) return null

  const customerInvoices = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(and(eq(invoices.customerId, customerId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.issueDate))

  return {
    customer: { ...row.customer, ownerName: row.ownerName },
    invoices: customerInvoices,
  }
}
