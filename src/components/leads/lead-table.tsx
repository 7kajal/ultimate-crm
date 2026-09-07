"use client"

import { MoreHorizontalIcon, PencilIcon, Trash2Icon, UserIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import { useRouter } from "next/navigation"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toastSuccess, toastError } from "@/lib/toast"
import { assignLeadAction, softDeleteLeadAction } from "@/lib/actions/leads"
import { formatINR, timeAgo } from "@/lib/format"
import { SOURCE_LABELS, STAGE_META } from "@/lib/leads-meta"
import type { LeadWithAssignee } from "@/lib/queries/leads"
import { initials } from "@/lib/format"

export function LeadTable({
  leads,
  assignees,
  canAssign,
  onEdit,
}: {
  leads: LeadWithAssignee[]
  assignees: { id: string; name: string }[]
  canAssign: boolean
  onEdit: (lead: LeadWithAssignee) => void
}) {
  const router = useRouter()
  const [busyId, setBusyId] = React.useState<string | null>(null)

  async function handleAssign(leadId: string, assigneeId: string | null) {
    setBusyId(leadId)
    const result = await assignLeadAction({ leadId, assigneeId })
    setBusyId(null)
    if (result.ok) {
      toastSuccess(result.message ?? "Updated")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  async function handleDelete(leadId: string) {
    setBusyId(leadId)
    const result = await softDeleteLeadAction(leadId)
    setBusyId(null)
    if (result.ok) {
      toastSuccess(result.message ?? "Deleted")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No leads match the current filters.
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const meta = STAGE_META[lead.stage]
            return (
              <TableRow
                key={lead.id}
                data-busy={busyId === lead.id || undefined}
                className="data-[busy]:opacity-50"
              >
                <TableCell>
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex flex-col hover:underline"
                  >
                    <span className="font-medium">{lead.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {lead.company ?? lead.email ?? "—"}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={meta.variant as BadgeProps["variant"]}>
                    {meta.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(lead.value)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {SOURCE_LABELS[lead.source]}
                </TableCell>
                <TableCell>
                  {lead.assigneeName ? (
                    <span className="flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                        {initials(lead.assigneeName, lead.assigneeEmail)}
                      </span>
                      {lead.assigneeName}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {timeAgo(lead.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${lead.name}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => router.push(`/leads/${lead.id}`)}
                        >
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(lead)}>
                          <PencilIcon data-icon="inline-start" />
                          Edit
                        </DropdownMenuItem>
                        {canAssign ? (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <UserIcon data-icon="inline-start" />
                              Assign
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem
                                onClick={() => handleAssign(lead.id, null)}
                              >
                                Unassigned
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {assignees.map((a) => (
                                <DropdownMenuItem
                                  key={a.id}
                                  onClick={() => handleAssign(lead.id, a.id)}
                                >
                                  {a.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(lead.id)}
                        >
                          <Trash2Icon data-icon="inline-start" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
