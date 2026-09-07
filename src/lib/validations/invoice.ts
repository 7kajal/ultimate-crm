import { z } from "zod"

import { GST_RATES } from "@/lib/billing/gst"

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description required").max(500),
  hsnCode: z.string().trim().max(20).optional().or(z.literal("")),
  quantity: z.coerce.number().min(0.001).max(100000),
  /** Rupees on the wire. */
  unitPrice: z.coerce.number().min(0).max(100_000_000),
  gstRate: z.union([
    z.literal(0),
    z.literal(5),
    z.literal(12),
    z.literal(18),
    z.literal(28),
  ]),
})

const baseInvoiceSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  leadId: z.string().uuid().optional().or(z.literal("")),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  placeOfSupply: z.string().length(2),
  /** Rupees. */
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  terms: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z.array(lineItemSchema).min(1, "Add at least one line item").max(100),
  sendNow: z.boolean().default(false),
})

export const createInvoiceSchema = baseInvoiceSchema.refine(
  (v) => v.dueDate >= v.issueDate,
  {
    message: "Due date must be on or after issue date",
    path: ["dueDate"],
  }
)

export const updateInvoiceSchema = baseInvoiceSchema
  .omit({ sendNow: true })
  .partial()

export const checkoutVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  publicToken: z.string().min(1),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export { GST_RATES }
