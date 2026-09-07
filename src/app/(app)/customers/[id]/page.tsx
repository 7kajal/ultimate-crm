import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_VARIANT } from "@/lib/billing/gst"
import { formatDate, formatINR, initials } from "@/lib/format"
import { getCustomerDetail } from "@/lib/queries/customers"
import { requireUser } from "@/lib/rbac"

export const metadata: Metadata = { title: "Customer" }

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireUser()
  const { id } = await params

  const detail = await getCustomerDetail(id)
  if (!detail) notFound()

  const { customer, invoices } = detail
  const totalBilled = invoices.reduce((a, i) => a + i.total, 0)
  const outstanding = invoices
    .filter((i) => !["paid", "cancelled", "draft"].includes(i.status))
    .reduce((a, i) => a + (i.total - i.amountPaid), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/customers" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Customers
        </Button>
      </div>

      <div className="flex items-start gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials(customer.name, customer.email)}
        </span>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {customer.company ?? customer.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              customer.name !== customer.company ? customer.name : null,
              customer.email,
              customer.phone,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">
            {[
              customer.gstin ? `GSTIN ${customer.gstin}` : null,
              [customer.addressLine, customer.city, customer.state, customer.pincode]
                .filter(Boolean)
                .join(", "),
              customer.ownerName ? `Owner: ${customer.ownerName}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No address on file"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{invoices.length}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Invoices</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{formatINR(totalBilled)}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Lifetime billed</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{formatINR(outstanding)}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Outstanding</CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <Link href={`/invoices/${i.id}`} className="font-medium hover:underline">
                    {i.number}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(i.issueDate)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(i.dueDate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatINR(i.amountPaid)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={INVOICE_STATUS_VARIANT[
                      i.status as keyof typeof INVOICE_STATUS_VARIANT
                    ] as BadgeProps["variant"]}
                  >
                    {INVOICE_STATUS_LABEL[i.status as keyof typeof INVOICE_STATUS_LABEL] ?? i.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No invoices for this customer yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
