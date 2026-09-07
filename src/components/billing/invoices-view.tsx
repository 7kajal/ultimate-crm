"use client"

import { MoreHorizontalIcon, PlusIcon, SendIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toastError, toastSuccess } from "@/lib/toast"
import {
  cancelInvoiceAction,
  markPaidAction,
  sendInvoiceAction,
} from "@/lib/actions/invoices"
import type { InvoiceStatus } from "@/lib/db/schema"
import { formatDate, formatINR } from "@/lib/format"
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_VARIANT } from "@/lib/billing/gst"

type Row = {
  id: string
  number: string
  status: InvoiceStatus
  total: number
  amountPaid: number
  issueDate: string
  dueDate: string
  customerName: string
  customerCompany: string | null
}

export function InvoicesView({
  invoices,
  status,
}: {
  invoices: Row[]
  status: string
}) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter(
      (i) =>
        i.number.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        (i.customerCompany ?? "").toLowerCase().includes(q)
    )
  }, [invoices, search])

  async function run(id: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusyId(id)
    const result = await fn()
    setBusyId(null)
    if (result.ok) {
      toastSuccess(result.message ?? "Done")
      router.refresh()
    } else {
      toastError(result.message ?? "Failed")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number or customer…"
          className="w-full sm:w-64"
        />
        <Select
          value={status}
          onValueChange={(v) => v && router.push(`/invoices?status=${v}`)}
        >
          <SelectTrigger className="w-40" aria-label="Status filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {INVOICE_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button className="ml-auto" render={<Link href="/invoices/new" />}>
          <PlusIcon data-icon="inline-start" />
          New invoice
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow
                key={inv.id}
                data-busy={busyId === inv.id || undefined}
                className="data-[busy]:opacity-50"
              >
                <TableCell>
                  <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                    {inv.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span>{inv.customerCompany ?? inv.customerName}</span>
                    {inv.customerCompany ? (
                      <span className="text-xs text-muted-foreground">{inv.customerName}</span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(inv.issueDate)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(inv.dueDate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(inv.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatINR(inv.amountPaid)}
                </TableCell>
                <TableCell>
                  <Badge variant={INVOICE_STATUS_VARIANT[inv.status] as BadgeProps["variant"]}>
                    {INVOICE_STATUS_LABEL[inv.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${inv.number}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}`)}>
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            run(inv.id, () => sendInvoiceAction(inv.id))
                          }
                        >
                          <SendIcon data-icon="inline-start" />
                          Send / create link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            run(inv.id, () => markPaidAction(inv.id))
                          }
                        >
                          Mark as paid
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            run(inv.id, () => cancelInvoiceAction(inv.id))
                          }
                        >
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
