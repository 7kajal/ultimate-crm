import Razorpay from "razorpay"

import { childLogger } from "@/lib/logger"

const log = childLogger({ module: "razorpay" })

let client: Razorpay | null = null

export function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET")
  }
  client ??= new Razorpay({ key_id: keyId, key_secret: keySecret })
  return client
}

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export function razorpayWebhookSecret(): string {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not set")
  return secret
}

export async function createRazorpayOrder(params: {
  amountPaise: number
  receipt: string
  notes?: Record<string, string>
}) {
  const rzp = getRazorpay()
  const order = await rzp.orders.create({
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receipt,
    notes: params.notes,
  })
  log.info({ orderId: order.id, receipt: params.receipt }, "razorpay order created")
  return order
}

export async function createRazorpayPaymentLink(params: {
  amountPaise: number
  referenceId: string
  customerName: string
  customerContact?: string | null
  customerEmail?: string | null
  description: string
  callbackUrl: string
}) {
  const rzp = getRazorpay()
  const link = await rzp.paymentLink.create({
    amount: params.amountPaise,
    currency: "INR",
    accept_partial: false,
    reference_id: params.referenceId,
    description: params.description.slice(0, 200),
    customer: {
      name: params.customerName,
      contact: params.customerContact ?? undefined,
      email: params.customerEmail ?? undefined,
    },
    notify: { sms: Boolean(params.customerContact), email: Boolean(params.customerEmail) },
    reminder_enable: true,
    callback_url: params.callbackUrl,
    callback_method: "get",
  })
  log.info({ linkId: link.id, referenceId: params.referenceId }, "payment link created")
  return link
}
