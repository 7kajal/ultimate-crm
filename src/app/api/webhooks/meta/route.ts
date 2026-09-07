import { and, desc, eq, ilike, isNull } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { db } from "@/lib/db"
import {
  leadActivities,
  leads,
  waContacts,
  waMessages,
  webhookEvents,
} from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"

const log = childLogger({ module: "meta-webhook" })

type MetaWebhookEntry = {
  id?: string
  changes?: {
    field?: string
    value?: {
      metadata?: { phone_number_id?: string }
      contacts?: { wa_id?: string; profile?: { name?: string } }[]
      messages?: {
        id?: string
        from?: string
        timestamp?: string
        type?: string
        text?: { body?: string }
        button?: { text?: string }
        interactive?: {
          button_reply?: { title?: string }
          list_reply?: { title?: string }
        }
        image?: { id?: string }
        document?: { filename?: string }
        errors?: { code?: number; title?: string }[]
      }[]
      statuses?: {
        id?: string
        status?: string
        timestamp?: string
        errors?: { code?: number; title?: string; message?: string }[]
        recipient_id?: string
      }[]
    }
  }[]
}

/** GET: Meta subscription verification — echo hub.challenge. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    log.info("webhook verified by Meta")
    return new NextResponse(challenge ?? "", { status: 200 })
  }
  log.warn("webhook verification failed")
  return new NextResponse("Forbidden", { status: 403 })
}

/** POST: inbound messages + status updates, HMAC-verified and idempotent. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-hub-signature-256") ?? ""

  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    log.error("WHATSAPP_APP_SECRET not configured — rejecting webhook")
    return NextResponse.json({ error: "not configured" }, { status: 503 })
  }

  const { createHmac, timingSafeEqual, createHash } = await import("node:crypto")
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    log.warn("invalid Meta webhook signature")
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  // Idempotency: Meta retries carry identical bodies — hash as event id.
  const eventId = createHash("sha256").update(rawBody).digest("hex")
  const inserted = await db
    .insert(webhookEvents)
    .values({
      source: "meta",
      eventId,
      eventType: "messages",
      payload: { size: rawBody.length },
      status: "received",
    })
    .onConflictDoNothing({ target: webhookEvents.eventId })
    .returning({ id: webhookEvents.id })

  if (inserted.length === 0) {
    return NextResponse.json({ status: "duplicate" })
  }
  const webhookRowId = inserted[0].id

  try {
    let body: { entry?: MetaWebhookEntry[] }
    try {
      body = JSON.parse(rawBody) as { entry?: MetaWebhookEntry[] }
    } catch {
      await markFailed(webhookRowId, "invalid json")
      return NextResponse.json({ error: "invalid json" }, { status: 400 })
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value
        if (!value) continue
        await processStatuses(value.statuses ?? [])
        await processMessages(value)
      }
    }

    await db
      .update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.id, webhookRowId))
    return NextResponse.json({ status: "ok" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    log.error({ err: error }, "meta webhook processing failed")
    await markFailed(webhookRowId, message)
    return NextResponse.json({ error: "processing failed" }, { status: 500 })
  }
}

async function markFailed(rowId: string, message: string) {
  await db
    .update(webhookEvents)
    .set({ status: "failed", error: message, processedAt: new Date() })
    .where(eq(webhookEvents.id, rowId))
}

async function upsertContact(waId: string, profileName?: string) {
  const [existing] = await db
    .select()
    .from(waContacts)
    .where(eq(waContacts.waPhone, waId))
    .limit(1)

  if (existing) {
    if (profileName && !existing.pushName) {
      const [updated] = await db
        .update(waContacts)
        .set({ pushName: profileName })
        .where(eq(waContacts.id, existing.id))
        .returning()
      return updated
    }
    return existing
  }

  // Auto-link: match an existing lead by phone digits (last 10).
  const digits = waId.replace(/\D/g, "").slice(-10)
  const [lead] = digits
    ? await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            ilike(leads.phone, `%${digits.slice(0, 5)}%${digits.slice(5)}%`),
            isNull(leads.deletedAt)
          )
        )
        .orderBy(desc(leads.createdAt))
        .limit(1)
    : []

  const [created] = await db
    .insert(waContacts)
    .values({
      waPhone: waId,
      pushName: profileName,
      name: profileName,
      leadId: lead?.id ?? null,
    })
    .onConflictDoNothing({ target: waContacts.waPhone })
    .returning()

  return (
    created ??
    (
      await db
        .select()
        .from(waContacts)
        .where(eq(waContacts.waPhone, waId))
        .limit(1)
    )[0]
  )
}

async function processMessages(value: NonNullable<
  MetaWebhookEntry["changes"]
>[number]["value"]) {
  const messages = value?.messages ?? []
  const profileName = value?.contacts?.[0]?.profile?.name

  for (const msg of messages) {
    if (!msg.id || !msg.from) continue

    const contact = await upsertContact(msg.from, profileName)
    if (!contact) continue

    const body =
      msg.text?.body ??
      msg.button?.text ??
      msg.interactive?.button_reply?.title ??
      msg.interactive?.list_reply?.title ??
      (msg.type === "image" ? "[image]" : msg.type === "document" ? `[document: ${msg.document?.filename ?? "file"}]` : `[${msg.type ?? "unknown"}]`)

    const inserted = await db
      .insert(waMessages)
      .values({
        waMessageId: msg.id,
        contactId: contact.id,
        direction: "in",
        type: (msg.type as "text" | undefined) === "text" ? "text" : "system",
        body,
        payload: msg as object,
        status: "received",
        timestamp: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
      })
      .onConflictDoNothing({ target: waMessages.waMessageId })
      .returning({ id: waMessages.id })

    if (inserted.length === 0) continue // duplicate wamid

    await db
      .update(waContacts)
      .set({ lastMessageAt: new Date() })
      .where(eq(waContacts.id, contact.id))

    if (contact.leadId) {
      await db.insert(leadActivities).values({
        leadId: contact.leadId,
        type: "whatsapp",
        body: `WhatsApp in: ${body.slice(0, 200)}`,
        metadata: { waMessageId: msg.id, direction: "in" },
      })
    }
    log.info({ contactId: contact.id, waMessageId: msg.id }, "inbound message stored")
  }
}

async function processStatuses(
  statuses: NonNullable<
    NonNullable<MetaWebhookEntry["changes"]>[number]["value"]
  >["statuses"]
) {
  for (const st of statuses ?? []) {
    if (!st.id || !st.status) continue
    if (!["sent", "delivered", "read", "failed"].includes(st.status)) continue

    const patch: {
      status: "sent" | "delivered" | "read" | "failed"
      errorCode?: string | null
      errorMessage?: string | null
    } = {
      status: st.status as "sent" | "delivered" | "read" | "failed",
    }
    if (st.status === "failed" && st.errors?.[0]) {
      patch.errorCode = String(st.errors[0].code ?? "")
      patch.errorMessage = st.errors[0].message ?? st.errors[0].title
    }

    const updated = await db
      .update(waMessages)
      .set(patch)
      .where(eq(waMessages.waMessageId, st.id))
      .returning({ contactId: waMessages.contactId })

    if (updated.length === 0) continue
    log.debug({ waMessageId: st.id, status: st.status }, "status updated")
  }
}
