"use client"

import { KanbanIcon, PlusIcon, TableIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { LeadBoard, LeadBoardSkeleton } from "@/components/leads/lead-board"
import { LeadFormDialog } from "@/components/leads/lead-form-dialog"
import { LeadTable } from "@/components/leads/lead-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { LeadStage } from "@/lib/db/schema"
import { STAGE_META } from "@/lib/leads-meta"
import type { LeadWithAssignee } from "@/lib/queries/leads"

type Assignee = { id: string; name: string; email?: string | null; role?: string | null }

export function LeadsView({
  leads,
  stats,
  assignees,
  canAssign,
  openCreate,
}: {
  leads: LeadWithAssignee[]
  stats: { stage: LeadStage; count: number; totalValue: number }[]
  assignees: Assignee[]
  canAssign: boolean
  openCreate?: boolean
}) {
  const router = useRouter()
  const [view, setView] = React.useState<"table" | "board">("table")
  const [search, setSearch] = React.useState("")
  const [stage, setStage] = React.useState<string>("all")
  const [assignee, setAssignee] = React.useState<string>("all")
  const [createOpen, setCreateOpen] = React.useState(Boolean(openCreate))
  const [editing, setEditing] = React.useState<LeadWithAssignee | null>(null)
  const [isPending, startTransition] = React.useTransition()

  // Debounced search → URL (shareable, server-refetched)
  React.useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (stage !== "all") params.set("stage", stage)
      if (assignee !== "all") params.set("assignee", assignee)
      const url = params.toString() ? `/leads?${params}` : "/leads"
      startTransition(() => router.replace(url, { scroll: false }))
    }, 300)
    return () => clearTimeout(t)
  }, [search, stage, assignee, router])

  const filtered = React.useMemo(() => {
    // Client-side quick-filter on top of server scope for snappy UX.
    const q = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (stage !== "all" && l.stage !== stage) return false
      if (assignee === "unassigned" && l.assignedTo) return false
      if (assignee !== "all" && assignee !== "unassigned" && l.assignedTo !== assignee)
        return false
      if (!q) return true
      return [l.name, l.company, l.email, l.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    })
  }, [leads, search, stage, assignee])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, email…"
          className="w-full sm:w-64"
        />
        <Select value={stage} onValueChange={(v) => v && setStage(v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All stages</SelectItem>
              {(Object.keys(STAGE_META) as LeadStage[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STAGE_META[s].label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={(v) => v && setAssignee(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup
            value={[view]}
            onValueChange={(v) => {
              const next = v[0]
              if (next === "table" || next === "board") setView(next)
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="table" aria-label="Table view">
              <TableIcon data-icon="inline-start" />
              Table
            </ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="Board view">
              <KanbanIcon data-icon="inline-start" />
              Board
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={() => setCreateOpen(true)} disabled={isPending}>
            <PlusIcon data-icon="inline-start" />
            New lead
          </Button>
        </div>
      </div>

      {view === "table" ? (
        <LeadTable
          leads={filtered}
          assignees={assignees}
          canAssign={canAssign}
          onEdit={(lead) => setEditing(lead)}
        />
      ) : (
        <React.Suspense fallback={<LeadBoardSkeleton />}>
          <LeadBoard leads={filtered} stats={stats} />
        </React.Suspense>
      )}

      <LeadFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        assignees={assignees}
        canAssign={canAssign}
        onSaved={() => router.refresh()}
      />
      <LeadFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        lead={editing}
        assignees={assignees}
        canAssign={canAssign}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
