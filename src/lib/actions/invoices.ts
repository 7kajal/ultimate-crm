"use server"

import { and, eq, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { computeTotals } from "@/lib/billing/gst"
import {
  createRazorpayOrder,
  createRazorpayPaymentLink,
  isRazorpayConfigured,
} from "@/lib/billing/razorpay"
import { db } from "@/lib/db"
import {
  auditLogs,
  customers,
  invoiceItems,
  invoices,
  payments,
  settings,
  type InvoiceStatus,
} from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import {
  ForbiddenError,
  NotFoundError,
  requireSession,
  type Role,
} from "@/lib/rbac"
import {
  checkoutVerifySchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  type CreateInvoiceInput,
} from "@/lib/validations/invoice"

const log = childLogger({ module: "invoice-actions" })
const SUPPLIER_STATE = process.env.COMPANY_STATE_CODE ?? "27"

type ActionState =
  | { ok: true; message?: string; invoiceId?: string; publicToken?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }

async function audit(
  actorId: string,
  action: string,
  entityId: string | null,
  diff?: unknown
) {
  const hdrs = await headers()
  await db.insert(auditLogs).values({
    actorId,
    action,
    entityType: "invoice",
    entityId,
    diff: diff ?? null,
    requestId: hdrs.get("x-request-id"),
    userAgent: hdrs.get("user-agent"),
  })
}

/** Atomically reserves the next invoice number via the settings counter row. */
async function nextInvoiceNumber(issueDate: Date): Promise<string> {
  const year = issueDate.getFullYear()
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ counter: settings.invoiceCounter })
      .from(settings)
      .where(eq(settings.id, 1))
      .for("update")
      .limit(1)

    const next = (row?.counter ?? 0) + 1
    await tx
      .update(settings)
      .set({ invoiceCounter: next, updatedAt: new Date() })
      .where(eq(settings.id, 1))
    return `INV-${year}-${String(next).padStart(4, "0")}`
  })
}

function requireBillingRole(role: Role) {
  if (role !== "admin" && role !== "manager") {
    throw new ForbiddenError("Only managers and admins can manage invoices")
  }
}

function parseItems(input: CreateInvoiceInput["items"]) {
  return input.map((it, i) => ({
    position: i,
    description: it.description,
    hsnCode: it.hsnCode || null,
    quantity: it.quantity,
    unitPrice: Math.round(it.unitPrice * 100),
    gstRate: it.gstRate,
  }))
}

async function replaceItems(
  invoiceId: string,
  items: CreateInvoiceInput["items"],
  discountPaise: number,
  placeOfSupply: string
) {
  const parsed = parseItems(items)
  const totals = computeTotals(parsed, {
    discount: discountPaise,
    placeOfSupply,
    supplierState: SUPPLIER_STATE,
  })

  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId))
  if (parsed.length > 0) {
    await db.insert(invoiceItems).values(
      parsed.map((p, i) => ({
        invoiceId,
        position: i,
        description: p.description,
        hsnCode: p.hsnCode,
        quantity: String(p.quantity),
        unitPrice: p.unitPrice,
        gstRate: p.gstRate,
        amount: totals.items[i].amount,
      }))
    )
  }
  return totals
}

export async function createInvoiceAction(input: unknown): Promise<ActionState> {
  const session = await requireSession()
  requireBillingRole(session.user.role as Role)

  const parsed = createInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const data = parsed.data

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, data.customerId), isNull(customers.deletedAt)))
    .limit(1)
  if (!customer) return { ok: false, message: "Customer not found" }

  const number = await nextInvoiceNumber(data.issueDate)
  const totals = computeTotals(parseItems(data.items), {
    discount: Math.round(data.discount * 100),
    placeOfSupply: data.placeOfSupply,
    supplierState: SUPPLIER_STATE,
  })

  const [invoice] = await db
    .insert(invoices)
    .values({
      number,
      publicToken: crypto.randomUUID().replace(/-/g, ""),
      customerId: data.customerId,
      leadId: data.leadId || null,
      issueDate: data.issueDate.toISOString().slice(0, 10),
      dueDate: data.dueDate.toISOString().slice(0, 10),
      status: data.sendNow ? "sent" : "draft",
      placeOfSupply: data.placeOfSupply,
      isInterState: totals.isInterState,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxTotal,
      total: totals.total,
      notes: data.notes || null,
      terms: data.terms || null,
      sentAt: data.sendNow ? new Date() : null,
      createdBy: session.user.id,
    })
    .returning({ id: invoices.id, publicToken: invoices.publicToken })

  await db.insert(invoiceItems).values(
    totals.items.map((it, i) => ({
      invoiceId: invoice.id,
      position: i,
      description: it.description,
      hsnCode: it.hsnCode ?? null,
      quantity: String(it.quantity),
      unitPrice: it.unitPrice,
      gstRate: it.gstRate,
      amount: it.amount,
    }))
  )

  await audit(session.user.id, "invoice.create", invoice.id, {
    number,
    total: totals.total,
  })
  log.info({ invoiceId: invoice.id, number, actor: session.user.id }, "invoice created")
  revalidatePath("/invoices")
  revalidatePath("/")
  return { ok: true, invoiceId: invoice.id, publicToken: invoice.publicToken, message: `Invoice ${number} created` }
}

export async function updateInvoiceAction(
  invoiceId: string,
  input: unknown
): Promise<ActionState> {
  const session = await requireSession()
  requireBillingRole(session.user.role as Role)

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)
  if (!invoice) throw new NotFoundError("Invoice not found")
  if (invoice.status !== "draft") {
    return { ok: false, message: "Only draft invoices can be edited" }
  }

  const parsed = updateInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }
  const data = parsed.data

  const placeOfSupply = data.placeOfSupply ?? invoice.placeOfSupply
  let totals = {
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    isInterState: invoice.isInterState,
  }

  if (data.items) {
    const computed = await replaceItems(
      invoiceId,
      data.items,
      Math.round((data.discount ?? invoice.discount / 100) * 100),
      placeOfSupply
    )
    totals = {
      subtotal: computed.subtotal,
      discount: computed.discount,
      taxTotal: computed.taxTotal,
      total: computed.total,
      isInterState: computed.isInterState,
    }
  }

  await db
    .update(invoices)
    .set({
      issueDate: data.issueDate?.toISOString().slice(0, 10) ?? invoice.issueDate,
      dueDate: data.dueDate?.toISOString().slice(0, 10) ?? invoice.dueDate,
      placeOfSupply,
      isInterState: totals.isInterState,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxTotal,
      total: totals.total,
      notes: data.notes ?? invoice.notes,
      terms: data.terms ?? invoice.terms,
    })
    .where(eq(invoices.id, invoiceId))

  await audit(session.user.id, "invoice.update", invoiceId)
  revalidatePath("/invoices")
  revalidatePath(`/invoices/${invoiceId}`)
  return { ok: true, message: "Invoice updated" }
}

export async function sendInvoiceAction(invoiceId: string): Promise<ActionState> {
  const session = await requireSession()
  requireBillingRole(session.user.role as Role)

  const [row] = await db
    .select({ invoice: invoices, customer: customers })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)
  if (!row) throw new NotFoundError("Invoice not found")

  const { invoice, customer } = row
  if (invoice.status !== "draft" && invoice.status !== "overdue") {
    return { ok: false, message: `Invoice is already ${invoice.status}` }
  }
  if (!isRazorpayConfigured()) {
    return {
      ok: false,
      message: "Razorpay not configured — set RAZORPAY_KEY_ID/SECRET to send payment links",
    }
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000"
  const link = await createRazorpayPaymentLink({
    amountPaise: invoice.total - invoice.amountPaid,
    referenceId: invoice.number,
    customerName: customer.name,
    customerContact: customer.phone,
    customerEmail: customer.email,
    description: `Payment for invoice ${invoice.number}`,
    callbackUrl: `${appUrl}/pay/${invoice.publicToken}`,
  })

  await db
    .update(invoices)
    .set({
      status: "sent",
      sentAt: new Date(),
      razorpayPaymentLinkId: link.id,
      razorpayPaymentLinkUrl: (link as { short_url?: string }).short_url ?? null,
    })
    .where(eq(invoices.id, invoiceId))

  await audit(session.user.id, "invoice.send", invoiceId, { linkId: link.id })
  revalidatePath("/invoices")
  revalidatePath(`/invoices/${invoiceId}`)
  return { ok: true, message: "Invoice sent — payment link created" }
}

export async function cancelInvoiceAction(invoiceId: string): Promise<ActionState> {
  const session = await requireSession()
  requireBillingRole(session.user.role as Role)

  const [invoice] = await db
    .select({ status: invoices.status, amountPaid: invoices.amountPaid })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)
  if (!invoice) throw new NotFoundError("Invoice not found")
  if (invoice.amountPaid > 0) {
    return { ok: false, message: "Cannot cancel an invoice with payments" }
  }

  await db
    .update(invoices)
    .set({ status: "cancelled" })
    .where(eq(invoices.id, invoiceId))
  await audit(session.user.id, "invoice.cancel", invoiceId)
  revalidatePath("/invoices")
  revalidatePath(`/invoices/${invoiceId}`)
  return { ok: true, message: "Invoice cancelled" }
}

export async function markPaidAction(invoiceId: string): Promise<ActionState> {
  const session = await requireSession()
  requireBillingRole(session.user.role as Role)

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)
  if (!invoice) throw new NotFoundError("Invoice not found")
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return { ok: false, message: `Invoice is ${invoice.status}` }
  }

  const due = invoice.total - invoice.amountPaid
  const paymentId = `manual_${crypto.randomUUID().slice(0, 12)}`

  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      invoiceId,
      razorpayPaymentId: paymentId,
      amount: due,
      method: "manual",
      status: "captured",
      paidAt: new Date(),
    })
    await tx
      .update(invoices)
      .set({ status: "paid", amountPaid: invoice.total })
      .where(eq(invoices.id, invoiceId))
  })

  await audit(session.user.id, "invoice.mark_paid", invoiceId, { amount: due })
  revalidatePath("/invoices")
  revalidatePath(`/invoices/${invoiceId}`)
  return { ok: true, message: "Marked as paid" }
}

/**
 * Creates (or reuses) a Razorpay order for the pay page checkout flow.
 * Public — guarded by the invoice's unguessable publicToken.
 */
export async function createCheckoutOrderAction(publicToken: string) {
  if (!isRazorpayConfigured()) {
    return { ok: false as const, message: "Online payments are not configured" }
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.publicToken, publicToken),
        isNull(invoices.deletedAt),
        sql`${invoices.status} <> 'cancelled'`
      )
    )
    .limit(1)
  if (!invoice) return { ok: false as const, message: "Invoice not found" }

  const due = invoice.total - invoice.amountPaid
  if (due <= 0) return { ok: false as const, message: "Invoice is already fully paid" }

  if (invoice.razorpayOrderId) {
    return { ok: true as const, orderId: invoice.razorpayOrderId, amount: due }
  }

  const order = await createRazorpayOrder({
    amountPaise: due,
    receipt: invoice.number,
    notes: { invoiceId: invoice.id, number: invoice.number },
  })
  await db
    .update(invoices)
    .set({ razorpayOrderId: order.id })
    .where(eq(invoices.id, invoice.id))

  return { ok: true as const, orderId: order.id, amount: due }
}

/** Server-side verification of the Razorpay Checkout callback. */
export async function verifyCheckoutAction(input: unknown): Promise<
  | { ok: true; message: string }
  | { ok: false; message: string }
> {
  const parsed = checkoutVerifySchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Invalid payment payload" }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, publicToken } =
    parsed.data

  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keySecret) return { ok: false, message: "Payments not configured" }

  const { createHmac, timingSafeEqual } = await import("node:crypto")
  const expected = createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex")

  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(razorpay_signature, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    log.warn({ razorpay_payment_id }, "checkout signature mismatch")
    return { ok: false, message: "Signature verification failed" }
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.publicToken, publicToken), isNull(invoices.deletedAt)))
    .limit(1)
  if (!invoice || invoice.razorpayOrderId !== razorpay_order_id) {
    return { ok: false, message: "Invoice/order mismatch" }
  }

  // Webhook remains the source of truth for marking paid; checkout verify
  // records the payment immediately for instant UX (idempotent by payment id).
  const existing = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.razorpayPaymentId, razorpay_payment_id))
    .limit(1)
  if (existing.length === 0) {
    await applyPaymentToInvoice({
      invoiceId: invoice.id,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      amount: invoice.total - invoice.amountPaid,
      method: "checkout",
      rawEvent: { source: "checkout_callback" },
    })
  }

  return { ok: true, message: "Payment successful" }
}

/** Shared payment application logic (webhook + checkout callback). */
export async function applyPaymentToInvoice(params: {
  invoiceId: string
  razorpayPaymentId: string
  razorpayOrderId: string | null
  amount: number
  method: string | null
  rawEvent: unknown
}) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, params.invoiceId))
    .limit(1)
  if (!invoice) throw new NotFoundError("Invoice not found")

  await db.transaction(async (tx) => {
    await tx
      .insert(payments)
      .values({
        invoiceId: params.invoiceId,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpayOrderId: params.razorpayOrderId,
        amount: params.amount,
        method: params.method,
        status: "captured",
        paidAt: new Date(),
        rawEvent: params.rawEvent as object,
      })
      .onConflictDoNothing({ target: payments.razorpayPaymentId })

    const amountPaid = invoice.amountPaid + params.amount
    const status: InvoiceStatus =
      amountPaid >= invoice.total ? "paid" : "partially_paid"
    await tx
      .update(invoices)
      .set({ amountPaid, status })
      .where(eq(invoices.id, params.invoiceId))
  })

  revalidatePath("/invoices")
  revalidatePath(`/invoices/${params.invoiceId}`)
  log.info(
    { invoiceId: params.invoiceId, paymentId: params.razorpayPaymentId },
    "payment applied"
  )
}
