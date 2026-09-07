"use client"

import { MegaphoneIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toastError, toastSuccess } from "@/lib/toast"
import { createCampaignAction } from "@/lib/actions/whatsapp"
import type { LeadStage } from "@/lib/db/schema"
import { STAGE_META } from "@/lib/leads-meta"
import { formatDateTime } from "@/lib/format"

export type CampaignRow = {
  id: string
  name: string
  status: string
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  sentCount: string
  failedCount: string
  templateName: string
  recipientCount: number
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  draft: "secondary",
  scheduled: "info",
  running: "warning",
  completed: "success",
  cancelled: "destructive",
}

export function CampaignsView({
  campaigns,
  templates,
}: {
  campaigns: CampaignRow[]
  templates: { id: string; name: string; category: string }[]
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} disabled={templates.length === 0}>
          <MegaphoneIcon data-icon="inline-start" />
          New campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{c.name}</span>
              <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>{c.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Template: {c.templateName} · {c.recipientCount} recipient(s)
            </p>
            <div className="flex gap-3 text-xs tabular-nums">
              <span className="text-success">{c.sentCount} sent</span>
              <span className="text-destructive">{c.failedCount} failed</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {c.completedAt
                ? `Completed ${formatDateTime(c.completedAt)}`
                : c.startedAt
                  ? `Started ${formatDateTime(c.startedAt)}`
                  : c.scheduledAt
                    ? `Scheduled ${formatDateTime(c.scheduledAt)}`
                    : "Not scheduled"}
            </p>
          </div>
        ))}
        {campaigns.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No campaigns yet — create one to broadcast an approved template.
          </div>
        ) : null}
      </div>

      <NewCampaignDialog
        open={open}
        onOpenChange={setOpen}
        templates={templates}
      />
    </div>
  )
}

function NewCampaignDialog({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: { id: string; name: string; category: string }[]
}) {
  if (!open) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogTrigger render={<span />} />
      </Dialog>
    )
  }
  return <CampaignForm key="new-campaign" onOpenChange={onOpenChange} templates={templates} />
}

function CampaignForm({
  onOpenChange,
  templates,
}: {
  onOpenChange: (open: boolean) => void
  templates: { id: string; name: string; category: string }[]
}) {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [templateId, setTemplateId] = React.useState("")
  const [tags, setTags] = React.useState("")
  const [stages, setStages] = React.useState<string[]>([])
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [isPending, setIsPending] = React.useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setErrors({})

    const result = await createCampaignAction({
      name,
      templateId,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      stages,
    })

    setIsPending(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Campaign scheduled")
      onOpenChange(false)
      router.refresh()
    } else {
      setErrors(result.fieldErrors ?? {})
      toastError(result.message)
    }
  }

  const err = (k: string) =>
    errors[k]?.[0] ? <FieldError>{errors[k][0]}</FieldError> : null

  function toggleStage(stage: LeadStage) {
    setStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Broadcasts an approved template to opted-in contacts matching the
            audience. Sending is rate-limited by the queue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="flex flex-col gap-4">
            <Field data-invalid={errors.name ? "" : undefined}>
              <FieldLabel htmlFor="camp-name">Campaign name *</FieldLabel>
              <Input
                id="camp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Diwali offer — qualified leads"
                required
              />
              {err("name")}
            </Field>
            <Field data-invalid={errors.templateId ? "" : undefined}>
              <FieldLabel>Template *</FieldLabel>
              <Select value={templateId || "none"} onValueChange={(v) => v && v !== "none" && setTemplateId(v)}>
                <SelectTrigger aria-label="Template">
                  <SelectValue placeholder="Select approved template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none" disabled>
                      Select template
                    </SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.category})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {err("templateId")}
            </Field>
            <Field>
              <FieldLabel htmlFor="camp-tags">Contact tags</FieldLabel>
              <Input
                id="camp-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="priority, bulk-order (comma separated)"
              />
            </Field>
            <Field>
              <FieldLabel>Lead stages (optional)</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(STAGE_META) as LeadStage[]).map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => toggleStage(stage)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      stages.includes(stage)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {STAGE_META[stage].label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Schedule campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
