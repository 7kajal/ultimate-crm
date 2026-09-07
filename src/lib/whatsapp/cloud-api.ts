import { childLogger } from "@/lib/logger"

const log = childLogger({ module: "wa-cloud-api" })

const GRAPH_BASE = "https://graph.facebook.com"

export function waConfig() {
  return {
    token: process.env.WHATSAPP_SYSTEM_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    wabaId: process.env.WHATSAPP_WABA_ID,
    apiVersion: "v23.0",
  }
}

export function isWhatsAppConfigured(): boolean {
  const { token, phoneNumberId } = waConfig()
  return Boolean(token && phoneNumberId)
}

async function graphFetch<T>(
  path: string,
  init?: RequestInit & { body?: string }
): Promise<T> {
  const { token, apiVersion } = waConfig()
  if (!token) throw new Error("WHATSAPP_SYSTEM_TOKEN is not set")

  const res = await fetch(`${GRAPH_BASE}/${apiVersion}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const json = (await res.json()) as T & { error?: { message: string; code: number } }
  if (!res.ok || json.error) {
    const message = json.error?.message ?? `Graph API error ${res.status}`
    log.error({ path, status: res.status, code: json.error?.code }, message)
    throw new Error(message)
  }
  return json
}

export async function sendWhatsAppText(to: string, body: string) {
  const { phoneNumberId } = waConfig()
  return graphFetch<{ messages: { id: string }[] }>(`${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  })
}

export type TemplateComponent = {
  type: string
  parameters?: { type: string; text?: string }[]
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: TemplateComponent[] = []
) {
  const { phoneNumberId } = waConfig()
  return graphFetch<{ messages: { id: string }[] }>(`${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    }),
  })
}

export type MetaTemplate = {
  id: string
  name: string
  category: string
  language: string
  status: string
  rejected_reason?: string
  components?: unknown
}

export async function syncTemplatesFromMeta(): Promise<MetaTemplate[]> {
  const { wabaId } = waConfig()
  if (!wabaId) throw new Error("WHATSAPP_WABA_ID is not set")

  const json = await graphFetch<{ data: MetaTemplate[] }>(
    `${wabaId}/message_templates?limit=200&fields=id,name,category,language,status,rejected_reason,components`
  )
  return json.data ?? []
}

export async function getPhoneNumberHealth(): Promise<{
  ok: boolean
  displayName?: string
  error?: string
}> {
  try {
    const { phoneNumberId } = waConfig()
    if (!phoneNumberId || !isWhatsAppConfigured()) {
      return { ok: false, error: "not configured" }
    }
    const json = await graphFetch<{
      display_phone_number?: string
      verified_name?: string
    }>(`${phoneNumberId}?fields=display_phone_number,verified_name`)
    return { ok: true, displayName: json.verified_name ?? json.display_phone_number }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    }
  }
}
