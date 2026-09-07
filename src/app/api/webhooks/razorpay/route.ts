import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import { invoices, webhookEvents } from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import { applyPaymentToInvoice } from "@/lib/actions/invoices"
import { razorpayWebhookSecret } from "@/lib/billing/razorpay"

const log = childLogger({ module: "razorpay-webhook" })

type RazorpayWebhookBody = {
  event?: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        amount?: number
        method?: string
        notes?: Record<string, string>
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-razorpay-signature") ?? ""
  const eventId = request.headers.get("x-razorpay-event-id") ?? crypto.randomUUID()

  // 1. Verify HMAC-SHA256 against the RAW body.
  const { createHmac, timingSafeEqual } = await import("node:crypto")
  let secret: string
  try {
    secret = razorpayWebhookSecret()
  } catch {
    log.error("webhook secret not configured — rejecting")
    return NextResponse.json({ error: "not configured" }, { status: 503 })
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    log.warn({ eventId }, "invalid webhook signature")
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  // 2. Idempotency: unique event_id — duplicate deliveries short-circuit here.
  let body: RazorpayWebhookBody
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookBody
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const inserted = await db
    .insert(webhookEvents)
    .values({
      source: "razorpay",
      eventId,
      eventType: body.event ?? null,
      payload: body as object,
      status: "received",
    })
    .onConflictDoNothing({ target: webhookEvents.eventId })
    .returning({ id: webhookEvents.id })

  if (inserted.length === 0) {
    log.info({ eventId }, "duplicate webhook ignored")
    return NextResponse.json({ status: "duplicate" })
  }
  const webhookRowId = inserted[0].id

  const fail = async (message: string) => {
    await db
      .update(webhookEvents)
      .set({ status: "failed", error: message, processedAt: new Date() })
      .where(eq(webhookEvents.id, webhookRowId))
  }

  // 3. Process payment events.
  try {
    const payment = body.payload?.payment?.entity
    if (
      (body.event === "payment.captured" || body.event === "order.paid") &&
      payment?.id
    ) {
      const invoiceId = payment.notes?.invoiceId
      if (!invoiceId) {
        await fail("payment has no invoiceId note")
        return NextResponse.json({ status: "ignored" })
      }

      const [invoice] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)
      if (!invoice) {
        await fail(`invoice ${invoiceId} not found`)
        return NextResponse.json({ status: "ignored" })
      }

      await applyPaymentToInvoice({
        invoiceId,
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id ?? null,
        amount: payment.amount ?? 0,
        method: payment.method ?? null,
        rawEvent: body,
      })
    } else {
      // Other events (refund.processed, payment.failed, …) are stored for audit.
      log.info({ eventId, event: body.event }, "webhook stored without action")
    }

    await db
      .update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, webhookRowId))
    return NextResponse.json({ status: "ok" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    log.error({ err: error, eventId }, "webhook processing failed")
    await fail(message)
    // 500 → Razorpay retries with backoff; idempotency makes retries safe.
    return NextResponse.json({ error: "processing failed" }, { status: 500 })
  }
}
