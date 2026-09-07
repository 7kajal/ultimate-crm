import type { Metadata } from "next"

import { ApplyLeaveButton } from "@/components/hr/leave-request-dialog"
import { ReviewLeaveButtons } from "@/components/hr/review-leave-buttons"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/format"
import { getMyLeaveBalance, listLeaveRequests } from "@/lib/queries/hr"
import { requireUser, type Role } from "@/lib/rbac"

export const metadata: Metadata = { title: "Leaves" }

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
}

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await requireUser()
  const { status = "all" } = await searchParams

  const requests = await listLeaveRequests(session, status)
  const role = session.user.role as Role
  const canReview = role === "admin" || role === "manager"
  const leaveBalance = await getMyLeaveBalance(session.user.id)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leaves</h1>
        <p className="text-sm text-muted-foreground">
          {canReview
            ? "Review team leave requests."
            : "Your leave requests and balance."}
        </p>
      </div>

      <LeaveActionsBar canReview={canReview} status={status} leaveBalance={leaveBalance} />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewer</TableHead>
              {canReview ? <TableHead className="w-40">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.userName}</TableCell>
                <TableCell className="capitalize">{r.type}</TableCell>
                <TableCell className="tabular-nums">
                  {formatDate(r.startDate)} → {formatDate(r.endDate)}
                </TableCell>
                <TableCell className="tabular-nums">{r.days}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.reviewerName ?? "—"}
                </TableCell>
                {canReview ? (
                  <TableCell>
                    {r.status === "pending" ? (
                      <ReviewLeaveButtons requestId={r.id} />
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            {requests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canReview ? 7 : 6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No leave requests found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function LeaveActionsBar({
  status,
  leaveBalance,
}: {
  canReview: boolean
  status: string
  leaveBalance: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusFilterLink value="all" label="All" active={status === "all"} />
      <StatusFilterLink value="pending" label="Pending" active={status === "pending"} />
      <StatusFilterLink value="approved" label="Approved" active={status === "approved"} />
      <StatusFilterLink value="rejected" label="Rejected" active={status === "rejected"} />
      <span className="ml-auto flex items-center gap-2">
        <ApplyLeaveButton leaveBalance={leaveBalance} />
      </span>
    </div>
  )
}

function StatusFilterLink({
  value,
  label,
  active,
}: {
  value: string
  label: string
  active: boolean
}) {
  return (
    <Button variant={active ? "secondary" : "ghost"} size="sm" render={<a href={`/leaves?status=${value}`} />}>
      {label}
    </Button>
  )
}

export const dynamic = "force-dynamic"
