"use client"

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { GripVerticalIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toastSuccess, toastError } from "@/lib/toast"
import { changeStageAction } from "@/lib/actions/leads"
import type { LeadStage } from "@/lib/db/schema"
import { formatINR, initials } from "@/lib/format"
import { BOARD_STAGES, STAGE_META } from "@/lib/leads-meta"
import type { LeadWithAssignee } from "@/lib/queries/leads"

type BoardLead = Pick<
  LeadWithAssignee,
  "id" | "name" | "company" | "value" | "stage" | "aiScore" | "assigneeName" | "assigneeEmail"
>

function LeadCard({ lead }: { lead: BoardLead }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={[
        "group rounded-lg border bg-card p-3 shadow-xs touch-none select-none",
        "hover:border-ring/50 cursor-grab active:cursor-grabbing",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-1">
        <Link
          href={`/leads/${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1"
          draggable={false}
        >
          <p className="truncate text-sm font-medium hover:underline">{lead.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {lead.company ?? "—"}
          </p>
        </Link>
        <GripVerticalIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-medium tabular-nums">
          {formatINR(lead.value)}
        </span>
        <div className="flex items-center gap-1.5">
          {lead.aiScore !== null ? (
            <Badge variant={lead.aiScore >= 70 ? "success" : lead.aiScore >= 40 ? "warning" : "secondary"} className="tabular-nums">
              {lead.aiScore}
            </Badge>
          ) : null}
          {lead.assigneeName ? (
            <Avatar className="size-5">
              <AvatarFallback className="text-[9px]">
                {initials(lead.assigneeName, lead.assigneeEmail)}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StageColumn({
  stage,
  leads,
  totalCount,
  totalValue,
}: {
  stage: LeadStage
  leads: BoardLead[]
  totalCount: number
  totalValue: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const meta = STAGE_META[stage]

  return (
    <div className="flex w-72 shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {totalCount}
          </span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatINR(totalValue)}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={[
          "flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-ring bg-muted/60" : "border-transparent bg-muted/30",
        ].join(" ")}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Drop leads here
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function LeadBoard({
  leads,
  stats,
}: {
  leads: LeadWithAssignee[]
  stats: { stage: LeadStage; count: number; totalValue: number }[]
}) {
  const router = useRouter()
  const [optimisticLeads, applyOptimistic] = React.useOptimistic<
    BoardLead[],
    { leadId: string; stage: LeadStage }
  >(
    leads.map((l) => ({
      id: l.id,
      name: l.name,
      company: l.company,
      value: l.value,
      stage: l.stage,
      aiScore: l.aiScore,
      assigneeName: l.assigneeName,
      assigneeEmail: l.assigneeEmail,
    })),
    (state, { leadId, stage }) =>
      state.map((l) => (l.id === leadId ? { ...l, stage } : l))
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const statsByStage = React.useMemo(() => {
    const map = new Map(stats.map((s) => [s.stage, s]))
    return (stage: LeadStage) =>
      map.get(stage) ?? { stage, count: 0, totalValue: 0 }
  }, [stats])

  async function onDragEnd(event: DragEndEvent) {
    const leadId = String(event.active.id)
    const stage = event.over?.id as LeadStage | undefined
    const lead = optimisticLeads.find((l) => l.id === leadId)
    if (!stage || !lead || lead.stage === stage) return

    applyOptimistic({ leadId, stage })

    const result = await changeStageAction({ leadId, stage })
    if (result.ok) {
      toastSuccess(result.message ?? "Moved")
      router.refresh()
    } else {
      toastError(result.message)
      router.refresh()
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {BOARD_STAGES.map((stage) => {
          const columnLeads = optimisticLeads.filter((l) => l.stage === stage)
          const stat = statsByStage(stage)
          return (
            <StageColumn
              key={stage}
              stage={stage}
              leads={columnLeads}
              totalCount={stat.count}
              totalValue={stat.totalValue}
            />
          )
        })}
      </div>
    </DndContext>
  )
}

export function LeadBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_STAGES.map((stage) => (
        <div key={stage} className="flex w-72 shrink-0 flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
