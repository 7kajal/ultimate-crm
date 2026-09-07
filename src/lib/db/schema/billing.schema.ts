import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "./auth.schema"
import { customers } from "./crm.schema"

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
])

export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
])

export const webhookSourceEnum = pgEnum("webhook_source", [
  "meta",
  "razorpay",
])

export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processed",
  "failed",
  "skipped",
])

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human number, e.g. INV-2026-0001. */
    number: text("number").notNull().unique(),
    /** Unguessable token for the public pay URL. */
    publicToken: text("public_token").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    /** Place of supply: GST state code, e.g. "27" (Maharashtra). */
    placeOfSupply: text("place_of_supply").notNull().default("27"),
    /** True when supplier state ≠ place of supply → IGST. */
    isInterState: boolean("is_inter_state").notNull().default(false),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    taxTotal: bigint("tax_total", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    amountPaid: bigint("amount_paid", { mode: "number" }).notNull().default(0),
    notes: text("notes"),
    terms: text("terms"),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentLinkId: text("razorpay_payment_link_id"),
    razorpayPaymentLinkUrl: text("razorpay_payment_link_url"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("invoices_customer_idx").on(table.customerId),
    index("invoices_status_idx").on(table.status),
    index("invoices_due_date_idx").on(table.dueDate),
  ]
)

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    hsnCode: text("hsn_code"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    /** Unit price in paise, pre-tax. */
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
    /** GST rate percent, e.g. 18. */
    gstRate: integer("gst_rate").notNull().default(18),
    /** quantity × unitPrice, pre-tax, in paise. */
    amount: bigint("amount", { mode: "number" }).notNull(),
  },
  (table) => [index("invoice_items_invoice_idx").on(table.invoiceId)]
)

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    razorpayPaymentId: text("razorpay_payment_id").notNull().unique(),
    razorpayOrderId: text("razorpay_order_id"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    method: text("method"),
    status: paymentStatusEnum("status").notNull().default("captured"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    rawEvent: jsonb("raw_event"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payments_invoice_idx").on(table.invoiceId)]
)

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: webhookSourceEnum("source").notNull(),
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type"),
    payload: jsonb("payload"),
    status: webhookStatusEnum("status").notNull().default("received"),
    error: text("error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("webhook_events_source_idx").on(table.source)]
)

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoiceItem = typeof invoiceItems.$inferSelect
export type Payment = typeof payments.$inferSelect
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number]
