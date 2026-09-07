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
  FieldDescription,
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
import { Spinner } from "@/components/ui/spinner"
import { toastError, toastSuccess } from "@/lib/toast"
import { createEmployeeAction } from "@/lib/actions/hr"
import type { Department } from "@/lib/db/schema"
import { employmentTypeValues } from "@/lib/validations/hr"

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  intern: "Intern",
  contract: "Contract",
}

type Assignee = { id: string; name: string; role: string | null }

export function AddEmployeeDialog({
  open,
  onOpenChange,
  departments,
  managers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: Department[]
  managers: Assignee[]
}) {
  if (!open) return null
  return (
    <AddEmployeeForm
      key="add-employee"
      onOpenChange={onOpenChange}
      departments={departments}
      managers={managers}
    />
  )
}

function AddEmployeeForm({
  onOpenChange,
  departments,
  managers,
}: {
  onOpenChange: (open: boolean) => void
  departments: Department[]
  managers: Assignee[]
}) {
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [isPending, setIsPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setErrors({})

    const fd = new FormData(e.currentTarget)
    const result = await createEmployeeAction({
      name: fd.get("name"),
      email: fd.get("email"),
      password: fd.get("password"),
      phone: fd.get("phone"),
      designation: fd.get("designation"),
      role: fd.get("role"),
      departmentId: fd.get("departmentId") || "",
      managerId: fd.get("managerId") || "",
      employmentType: fd.get("employmentType"),
      leaveBalance: fd.get("leaveBalance") || 24,
    })

    setIsPending(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Employee added")
      onOpenChange(false)
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
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Creates the user account and employee profile.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.name ? "" : undefined}>
                <FieldLabel htmlFor="emp-name">Full name *</FieldLabel>
                <Input id="emp-name" name="name" required aria-invalid={errors.name ? true : undefined} />
                {err("name")}
              </Field>
              <Field data-invalid={errors.email ? "" : undefined}>
                <FieldLabel htmlFor="emp-email">Email *</FieldLabel>
                <Input id="emp-email" name="email" type="email" required aria-invalid={errors.email ? true : undefined} />
                {err("email")}
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.password ? "" : undefined}>
                <FieldLabel htmlFor="emp-password">Temp password *</FieldLabel>
                <Input id="emp-password" name="password" type="text" minLength={8} required defaultValue="Welcome@123" />
                <FieldDescription>Share securely; user should change it.</FieldDescription>
                {err("password")}
              </Field>
              <Field>
                <FieldLabel htmlFor="emp-phone">Phone</FieldLabel>
                <Input id="emp-phone" name="phone" type="tel" placeholder="+91 …" />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.role ? "" : undefined}>
                <FieldLabel>Role *</FieldLabel>
                <Select name="role" defaultValue="employee">
                  <SelectTrigger aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {err("role")}
              </Field>
              <Field>
                <FieldLabel htmlFor="emp-designation">Designation</FieldLabel>
                <Input id="emp-designation" name="designation" placeholder="Sales Executive" />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Department</FieldLabel>
                <Select name="departmentId" defaultValue="none">
                  <SelectTrigger aria-label="Department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Reports to</FieldLabel>
                <Select name="managerId" defaultValue="none">
                  <SelectTrigger aria-label="Manager">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">None</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Employment type</FieldLabel>
                <Select name="employmentType" defaultValue="full_time">
                  <SelectTrigger aria-label="Employment type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {employmentTypeValues.map((t) => (
                        <SelectItem key={t} value={t}>
                          {EMPLOYMENT_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="emp-leave">Annual leave balance</FieldLabel>
                <Input id="emp-leave" name="leaveBalance" type="number" min="0" max="365" defaultValue={24} />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Add employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
