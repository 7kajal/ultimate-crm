import type { Metadata } from "next"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime } from "@/lib/format"
import { listAuditLogs } from "@/lib/actions/admin"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "Audit log" }

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string }>
}) {
  await requireRolePage("admin")
  const { action, entity } = await searchParams

  const logs = await listAuditLogs({ action, entity, limit: 200 })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every privileged mutation — who, what, when. Last 200 entries.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/admin/audit-log">
        <Input
          name="action"
          defaultValue={action ?? ""}
          placeholder="Filter action (e.g. lead., invoice.)"
          className="w-64"
        />
        <Input
          name="entity"
          defaultValue={entity ?? ""}
          placeholder="Filter entity type"
          className="w-44"
        />
        <button
          type="submit"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Apply
        </button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDateTime(l.createdAt)}
                </TableCell>
                <TableCell>{l.actorName ?? l.actorId ?? "system"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {l.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{l.entityType}</TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground">
                  {l.entityId ? `${l.entityId.slice(0, 8)}…` : "—"}
                </TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground">
                  {l.requestId ? `${l.requestId.slice(0, 8)}…` : "—"}
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No audit entries match the filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
