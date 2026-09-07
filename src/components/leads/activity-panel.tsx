"use client"

import {
  Building2Icon,
  CalendarClockIcon,
  MailIcon,
  PhoneIcon,
  Repeat2Icon,
  StickyNoteIcon,
} from "lucide-react"
import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toastSuccess, toastError } from "@/lib/toast"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addActivityAction } from "@/lib/actions/leads"
import { timeAgo } from "@/lib/format"

const TYPES = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
] as const

export function ActivityPanel({
  leadId,
  activities,
}: {
  leadId: string
  activities: {
    id: string
    type: string
    body: string
    createdAt: Date
    actorName: string | null
  }[]
}) {
  const router = useRouter()
  const [type, setType] = React.useState<string>("note")
  const [body, setBody] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!body.trim()) return
    setIsPending(true)
    const result = await addActivityAction({ leadId, type, body })
    setIsPending(false)
    if (result.ok) {
      setBody("")
      toastSuccess(result.message ?? "Logged")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(v) => v && setType(v)}>
            <SelectTrigger className="w-32" aria-label="Activity type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
            Log activity
          </Button>
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened? Spoke about pricing, needs proposal by Friday…"
          rows={3}
        />
      </form>

      <ol className="flex flex-col">
        {activities.map((a) => (
          <li key={a.id} className="flex gap-3 py-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {a.type === "call" ? (
                <PhoneIcon className="size-3.5" />
              ) : a.type === "email" ? (
                <MailIcon className="size-3.5" />
              ) : a.type === "meeting" ? (
                <CalendarClockIcon className="size-3.5" />
              ) : a.type === "status_change" ? (
                <Repeat2Icon className="size-3.5" />
              ) : a.type === "assignment" ? (
                <Building2Icon className="size-3.5" />
              ) : (
                <StickyNoteIcon className="size-3.5" />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              <p className="text-xs text-muted-foreground">
                {a.actorName ?? "System"} · {a.type.replace("_", " ")} ·{" "}
                {timeAgo(a.createdAt)}
              </p>
            </div>
          </li>
        ))}
        {activities.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">
            No activity yet — log the first touchpoint above.
          </li>
        ) : null}
      </ol>
    </div>
  )
}
