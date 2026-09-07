"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupInput, InputGroupTextarea } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { toastSuccess, toastError } from "@/lib/toast"
import { createLeadAction, updateLeadAction } from "@/lib/actions/leads"
import type { Lead, LeadSource, LeadStage } from "@/lib/db/schema"
import { SOURCE_LABELS, STAGE_META } from "@/lib/leads-meta"
import { leadSourceValues, leadStageValues } from "@/lib/validations/lead"

type Assignee = { id: string; name: string; email?: string | null }

type FormState = {
  name: string
  company: string
  email: string
  phone: string
  source: LeadSource
  stage: LeadStage
  value: string
  notes: string
  assignedTo: string
}

const EMPTY_FORM: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  source: "other",
  stage: "new",
  value: "",
  notes: "",
  assignedTo: "",
}

function toFormState(lead?: Lead | null): FormState {
  if (!lead) return EMPTY_FORM
  return {
    name: lead.name,
    company: lead.company ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: lead.source,
    stage: lead.stage,
    value: lead.value ? String(lead.value / 100) : "",
    notes: lead.notes ?? "",
    assignedTo: lead.assignedTo ?? "",
  }
}

export function LeadFormDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: Lead | null
  assignees?: Assignee[]
  canAssign?: boolean
  onSaved?: (leadId: string) => void
}) {
  const { open, lead, ...rest } = props
  if (!open) return null
  // Remount per open → state initializes from `lead` without effects.
  return <LeadForm key={lead?.id ?? "new"} lead={lead ?? null} {...rest} />
}

function LeadForm({
  lead = null,
  onOpenChange,
  assignees = [],
  canAssign = false,
  onSaved,
}: {
  lead: Lead | null
  onOpenChange: (open: boolean) => void
  assignees?: Assignee[]
  canAssign?: boolean
  onSaved?: (leadId: string) => void
}) {
  const isEdit = Boolean(lead)
  const [form, setForm] = React.useState<FormState>(() => toFormState(lead))
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [isPending, setIsPending] = React.useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setErrors({})

    const payload = {
      name: form.name,
      company: form.company,
      email: form.email,
      phone: form.phone,
      source: form.source,
      stage: form.stage,
      value: form.value ? Number(form.value) : 0,
      notes: form.notes,
      ...(canAssign ? { assignedTo: form.assignedTo } : {}),
    }

    const result = isEdit && lead
      ? await updateLeadAction(lead.id, payload)
      : await createLeadAction(payload)

    setIsPending(false)

    if (result.ok) {
      toastSuccess(result.message ?? (isEdit ? "Lead updated" : "Lead created"))
      onOpenChange(false)
      onSaved?.(result.leadId ?? lead?.id ?? "")
    } else {
      setErrors(result.fieldErrors ?? {})
      toastError(result.message)
    }
  }

  const err = (k: string) =>
    errors[k]?.[0] ? <FieldError>{errors[k][0]}</FieldError> : null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the lead details."
              : "Add a new lead to the pipeline."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.name ? "" : undefined}>
                <FieldLabel htmlFor="lead-name">Name *</FieldLabel>
                <Input
                  id="lead-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Jane Cooper"
                  required
                  aria-invalid={errors.name ? true : undefined}
                />
                {err("name")}
              </Field>
              <Field>
                <FieldLabel htmlFor="lead-company">Company</FieldLabel>
                <Input
                  id="lead-company"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  placeholder="Acme Inc."
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.email ? "" : undefined}>
                <FieldLabel htmlFor="lead-email">Email</FieldLabel>
                <Input
                  id="lead-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="jane@acme.com"
                  aria-invalid={errors.email ? true : undefined}
                />
                {err("email")}
              </Field>
              <Field>
                <FieldLabel htmlFor="lead-phone">Phone</FieldLabel>
                <Input
                  id="lead-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Source</FieldLabel>
                <Select
                  value={form.source}
                  onValueChange={(v) => set("source", v as LeadSource)}
                >
                  <SelectTrigger id="lead-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {leadSourceValues.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SOURCE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Stage</FieldLabel>
                <Select
                  value={form.stage}
                  onValueChange={(v) => set("stage", v as LeadStage)}
                >
                  <SelectTrigger id="lead-stage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {leadStageValues.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STAGE_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={errors.value ? "" : undefined}>
                <FieldLabel htmlFor="lead-value">Deal value (₹)</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="lead-value"
                    type="number"
                    min="0"
                    step="any"
                    value={form.value}
                    onChange={(e) => set("value", e.target.value)}
                    placeholder="50000"
                  />
                </InputGroup>
                {err("value")}
              </Field>
            </div>

            {canAssign ? (
              <Field>
                <FieldLabel>Assign to</FieldLabel>
                <Select
                  value={form.assignedTo || "unassigned"}
                  onValueChange={(v) =>
                    set("assignedTo", v && v !== "unassigned" ? v : "")
                  }
                >
                  <SelectTrigger id="lead-assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {assignees.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Managers and admins can reassign later.
                </FieldDescription>
              </Field>
            ) : null}

            <Field data-invalid={errors.notes ? "" : undefined}>
              <FieldLabel htmlFor="lead-notes">Notes</FieldLabel>
              <InputGroup>
                <InputGroupTextarea
                  id="lead-notes"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Context, requirements, links…"
                  rows={3}
                />
              </InputGroup>
              {err("notes")}
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              {isEdit ? "Save changes" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
