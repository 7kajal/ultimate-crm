"use client"

import { RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

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
import { toastError, toastSuccess } from "@/lib/toast"
import { syncTemplatesAction } from "@/lib/actions/whatsapp"
import { timeAgo } from "@/lib/format"

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
  PAUSED: "secondary",
}

export function TemplatesView({
  templates,
  canSync,
  isConfigured,
}: {
  templates: {
    id: string
    name: string
    category: string
    language: string
    status: string
    rejectionReason: string | null
    lastSyncedAt: Date | null
  }[]
  canSync: boolean
  isConfigured: boolean
}) {
  const router = useRouter()
  const [isPending, setIsPending] = React.useState(false)

  async function sync() {
    setIsPending(true)
    const result = await syncTemplatesAction()
    setIsPending(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Synced")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={sync}
          disabled={isPending || !canSync || !isConfigured}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Sync from Meta
        </Button>
        {!isConfigured ? (
          <span className="text-xs text-muted-foreground">
            Set WHATSAPP_SYSTEM_TOKEN + WHATSAPP_WABA_ID to enable sync.
          </span>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last synced</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <span className="flex flex-col">
                    <span>{t.name}</span>
                    {t.rejectionReason ? (
                      <span className="text-xs text-destructive">{t.rejectionReason}</span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.category}</TableCell>
                <TableCell className="text-muted-foreground">{t.language}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>{t.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.lastSyncedAt ? timeAgo(t.lastSyncedAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No templates yet — sync from Meta to import your approved templates.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
