"use client"

import { Building2Icon, PlusIcon } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatINR, initials, timeAgo } from "@/lib/format"
import type { CustomerRow } from "@/lib/queries/customers"

export function CustomersView({ customers }: { customers: CustomerRow[] }) {
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      [c.name, c.company, c.email, c.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    )
  }, [customers, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, email…"
          className="w-full sm:w-64"
        />
        <span className="text-sm text-muted-foreground tabular-nums">
          {filtered.length} of {customers.length}
        </span>
        <Button className="ml-auto" disabled title="Convert a lead to add customers">
          <PlusIcon data-icon="inline-start" />
          New customer
        </Button>
      </div>

      {customers.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>No customers yet</EmptyTitle>
            <EmptyDescription>
              Convert a won lead from the Leads board to create your first
              customer.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/customers/${c.id}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {initials(c.name, c.email)}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{c.company ?? c.name}</span>
                        {c.company ? (
                          <span className="truncate text-xs text-muted-foreground">{c.name}</span>
                        ) : null}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col text-xs text-muted-foreground">
                      <span>{c.email ?? "—"}</span>
                      <span>{c.phone ?? ""}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.ownerName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.gstin ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.invoiceCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(c.totalBilled)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.outstanding > 0 ? (
                      <Badge variant="warning">{formatINR(c.outstanding)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(c.createdAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No customers match the search.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
