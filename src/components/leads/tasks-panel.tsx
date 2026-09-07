"use client"

import { CalendarClockIcon, PlusIcon } from "lucide-react"
import * as React from "react"
import { useRouter } from "next/navigation"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toastSuccess, toastError } from "@/lib/toast"
import { createTaskAction, toggleTaskAction } from "@/lib/actions/leads"
import { formatDate } from "@/lib/format"

type TaskRow = {
  id: string
  title: string
  status: string
  priority: string
  dueAt: Date | null
  assigneeName: string | null
}

const PRIORITY_VARIANT: Record<string, BadgeProps["variant"]> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
}

export function TasksPanel({
  leadId,
  tasks,
}: {
  leadId: string
  tasks: TaskRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [priority, setPriority] = React.useState("medium")
  const [dueAt, setDueAt] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)

  async function toggle(taskId: string, done: boolean) {
    const result = await toggleTaskAction({ taskId, done })
    if (result.ok) router.refresh()
    else toastError(result.message)
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    const result = await createTaskAction({
      title,
      priority,
      dueAt: dueAt || null,
      leadId,
    })
    setIsPending(false)
    if (result.ok) {
      setOpen(false)
      setTitle("")
      setDueAt("")
      toastSuccess("Task created")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Add task
        </Button>
      </div>

      <ul className="flex flex-col gap-1">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <Checkbox
              checked={t.status === "done"}
              onCheckedChange={(checked) => toggle(t.id, checked === true)}
              aria-label={`Mark ${t.title} ${t.status === "done" ? "open" : "done"}`}
            />
            <span
              className={
                t.status === "done"
                  ? "flex-1 text-sm line-through text-muted-foreground"
                  : "flex-1 text-sm"
              }
            >
              {t.title}
            </span>
            <Badge variant={PRIORITY_VARIANT[t.priority] ?? "secondary"}>
              {t.priority}
            </Badge>
            {t.dueAt ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                <CalendarClockIcon className="size-3" />
                {formatDate(t.dueAt)}
              </span>
            ) : null}
          </li>
        ))}
        {tasks.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">
            No tasks yet.
          </li>
        ) : null}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Assigned to you by default.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="task-title">Title *</FieldLabel>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Send follow-up proposal"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>Priority</FieldLabel>
                  <Select value={priority} onValueChange={(value) => value && setPriority(value)}>
                    <SelectTrigger aria-label="Priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="task-due">Due date</FieldLabel>
                  <Input
                    id="task-due"
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Create task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
