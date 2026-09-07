"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toastSuccess, toastError } from "@/lib/toast"
import { convertLeadAction } from "@/lib/actions/leads"

type ConvertDefaults = {
  name: string
  company: string
  email: string
  phone: string
}

export function ConvertDialog({
  leadId,
  defaults,
  disabled,
}: {
  leadId: string
  defaults: ConvertDefaults
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)

  if (!open) {
    return (
      <Dialog open={false} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button disabled={disabled} size="sm">
              Convert to customer
            </Button>
          }
        />
      </Dialog>
    )
  }

  // Remount per open → form state initializes from `defaults` without effects.
  return (
    <ConvertForm key="convert" leadId={leadId} defaults={defaults} onDone={setOpen} />
  )
}

function ConvertForm({
  leadId,
  defaults,
  onDone,
}: {
  leadId: string
  defaults: ConvertDefaults
  onDone: (open: boolean) => void
}) {
  const router = useRouter()
  const [form, setForm] = React.useState(defaults)
  const [gstin, setGstin] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    const result = await convertLeadAction({
      leadId,
      name: form.name,
      company: form.company,
      email: form.email,
      phone: form.phone,
      gstin,
    })
    setIsPending(false)
    if (result.ok) {
      toastSuccess("Lead converted to customer")
      onDone(false)
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  return (
    <Dialog open onOpenChange={onDone}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert lead</DialogTitle>
          <DialogDescription>
            Creates a customer record and marks this lead as Won.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="conv-name">Customer name *</FieldLabel>
              <Input
                id="conv-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="conv-company">Company</FieldLabel>
                <Input
                  id="conv-company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="conv-gstin">GSTIN</FieldLabel>
                <Input
                  id="conv-gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="27ABCDE1234F1Z5"
                />
                <FieldDescription>Needed for GST invoicing.</FieldDescription>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="conv-email">Email</FieldLabel>
                <Input
                  id="conv-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="conv-phone">Phone</FieldLabel>
                <Input
                  id="conv-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onDone(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Convert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
