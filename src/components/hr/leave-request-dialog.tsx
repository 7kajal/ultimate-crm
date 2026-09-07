"use client"

import { CalendarPlusIcon } from "lucide-react"
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
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { toastError, toastSuccess } from "@/lib/toast"
import { applyLeaveAction } from "@/lib/actions/hr"

export function ApplyLeaveButton({ leaveBalance }: { leaveBalance: number }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CalendarPlusIcon data-icon="inline-start" />
        Apply for leave
      </Button>
      <LeaveRequestDialog open={open} onOpenChange={setOpen} leaveBalance={leaveBalance} />
    </>
  )
}

export function LeaveRequestDialog({
  open,
  onOpenChange,
  leaveBalance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  leaveBalance: number
}) {
  if (!open) return null
  return (
    <LeaveForm key="leave-form" onOpenChange={onOpenChange} leaveBalance={leaveBalance} />
  )
}

function LeaveForm({
  onOpenChange,
  leaveBalance,
}: {
  onOpenChange: (open: boolean) => void
  leaveBalance: number
}) {
  const router = useRouter()
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [isPending, setIsPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setErrors({})

    const fd = new FormData(e.currentTarget)
    const result = await applyLeaveAction({
      type: fd.get("type"),
      startDate: fd.get("startDate"),
      endDate: fd.get("endDate"),
      reason: fd.get("reason"),
    })

    setIsPending(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Leave requested")
      onOpenChange(false)
      router.refresh()
    } else {
      setErrors(result.fieldErrors ?? {})
      toastError(result.message)
    }
  }

  const err = (k: string) =>
    errors[k]?.[0] ? <FieldError>{errors[k][0]}</FieldError> : null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>
            Paid balance available: {leaveBalance} day(s)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select name="type" defaultValue="casual">
                <SelectTrigger aria-label="Leave type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="casual">Casual (paid)</SelectItem>
                    <SelectItem value="sick">Sick (paid)</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={errors.startDate ? "" : undefined}>
                <FieldLabel htmlFor="leave-start">From *</FieldLabel>
                <Input
                  id="leave-start"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
                {err("startDate")}
              </Field>
              <Field data-invalid={errors.endDate ? "" : undefined}>
                <FieldLabel htmlFor="leave-end">To *</FieldLabel>
                <Input
                  id="leave-end"
                  name="endDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
                {err("endDate")}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="leave-reason">Reason</FieldLabel>
              <Textarea id="leave-reason" name="reason" rows={3} placeholder="Optional context…" />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
