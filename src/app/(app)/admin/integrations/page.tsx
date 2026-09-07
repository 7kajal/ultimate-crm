import { sql } from "drizzle-orm"
import { CheckCircle2Icon, XCircleIcon } from "lucide-react"
import type { Metadata } from "next"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isAIConfigured } from "@/lib/ai/provider"
import { db } from "@/lib/db"
import { requireRolePage } from "@/lib/rbac"
import { getPhoneNumberHealth, isWhatsAppConfigured } from "@/lib/whatsapp/cloud-api"

export const metadata: Metadata = { title: "Integrations" }

type IntegrationStatus = {
  name: string
  description: string
  ok: boolean
  detail: string
  envKeys: string[]
}

export default async function IntegrationsPage() {
  await requireRolePage("admin")

  const [dbOk, waConfigured, waHealth] = await Promise.all([
    db
      .execute(sql`select 1`)
      .then(() => true)
      .catch(() => false),
    Promise.resolve(isWhatsAppConfigured()),
    getPhoneNumberHealth(),
  ])

  const razorpayOk = Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  )
  const integrations: IntegrationStatus[] = [
    {
      name: "PostgreSQL",
      description: "Primary datastore",
      ok: dbOk,
      detail: dbOk ? "Connected" : "Connection failed",
      envKeys: ["DATABASE_URL"],
    },
    {
      name: "WhatsApp Cloud API",
      description: "Meta Graph v23 — inbox, templates, campaigns",
      ok: waConfigured && waHealth.ok,
      detail: waHealth.ok
        ? `Connected${waHealth.displayName ? ` · ${waHealth.displayName}` : ""}`
        : waHealth.error ?? "Not configured",
      envKeys: [
        "WHATSAPP_SYSTEM_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_WABA_ID",
        "WHATSAPP_VERIFY_TOKEN",
        "WHATSAPP_APP_SECRET",
      ],
    },
    {
      name: "Razorpay",
      description: "Invoice payments, links and webhooks",
      ok: razorpayOk && Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      detail: razorpayOk
        ? process.env.RAZORPAY_WEBHOOK_SECRET
          ? "Keys configured"
          : "Keys set — webhook secret missing"
        : "Not configured",
      envKeys: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
    },
    {
      name: "AI provider (OpenAI)",
      description: "Lead scoring rationale, summaries, assistant",
      ok: isAIConfigured(),
      detail: isAIConfigured()
        ? `Configured · model ${process.env.AI_MODEL ?? "gpt-4o-mini"}`
        : "Not configured — heuristic scoring only",
      envKeys: ["OPENAI_API_KEY", "AI_MODEL (optional)"],
    },
    {
      name: "Inngest",
      description: "Background jobs — campaigns, crons, webhooks",
      ok: Boolean(process.env.INNGEST_SIGNING_KEY),
      detail: process.env.INNGEST_SIGNING_KEY
        ? "Configured"
        : "Dev mode (no signing key) — works locally",
      envKeys: ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"],
    },
    {
      name: "Sentry",
      description: "Error tracking and tracing",
      ok: Boolean(process.env.SENTRY_DSN),
      detail: process.env.SENTRY_DSN ? "Configured" : "Not configured — logs only",
      envKeys: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
    },
  ]

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Live status of external services. Secrets live only in env.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {integrations.map((i) => (
          <Card key={i.name} className="py-4">
            <CardHeader className="px-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  {i.ok ? (
                    <CheckCircle2Icon className="size-4 text-success" />
                  ) : (
                    <XCircleIcon className="size-4 text-muted-foreground" />
                  )}
                  {i.name}
                </CardTitle>
                <Badge
                  variant={(i.ok ? "success" : "secondary") as BadgeProps["variant"]}
                >
                  {i.ok ? "Operational" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">{i.description}</p>
              <p className="mt-1 text-xs">{i.detail}</p>
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                {i.envKeys.join(" · ")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
