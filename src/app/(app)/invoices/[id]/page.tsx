import { ArrowLeftIcon, DownloadIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { InvoiceActions } from "@/components/billing/invoice-actions"
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
import { formatDate, formatDateTime, formatINR } from "@/lib/format"
import { getInvoiceDetail } from "@/lib/queries/invoices"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "Invoice" }

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRolePage("admin", "manager")
  const { id } = await params

  const detail = await getInvoiceDetail(id)
  if (!detail) notFound()

  const { invoice, customer, items, payments } = detail
  const due = invoice.total - invoice.amountPaid

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link href="/invoices" />}>
            <ArrowLeftIcon data-icon="inline-start" />
            Invoices
          </Button>
          <Badge variant={INVOICE_STATUS_VARIANT[invoice.status] as BadgeProps["variant"]}>
            {INVOICE_STATUS_LABEL[invoice.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" render={<a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer" />}>
            <DownloadIcon data-icon="inline-start" />
            PDF
          </Button>
          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            paymentLinkUrl={invoice.razorpayPaymentLinkUrl}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{invoice.number}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.company ?? customer.name} · Issued {formatDate(invoice.issueDate)} · Due{" "}
            {formatDate(invoice.dueDate)}
            {detail.createdByName ? ` · by ${detail.createdByName}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{formatINR(invoice.total)}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Total</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{formatINR(invoice.amountPaid)}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Paid</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{formatINR(Math.max(due, 0))}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Balance due</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg">
              {invoice.isInterState ? "IGST" : "CGST + SGST"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">
            Place of supply {invoice.placeOfSupply}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.description}</TableCell>
                <TableCell className="text-muted-foreground">{item.hsnCode ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(item.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(item.unitPrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{item.gstRate}%</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(item.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:max-w-md">
          {invoice.notes ? <p>Notes: {invoice.notes}</p> : null}
          {invoice.terms ? <p>Terms: {invoice.terms}</p> : null}
          <p className="text-xs">
            Pay page: <code className="rounded bg-muted px-1">/pay/{invoice.publicToken}</code>
          </p>
        </div>

        <Card className="lg:w-72">
          <CardContent className="flex flex-col gap-2 pt-6 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatINR(invoice.subtotal)}</span>
            </div>
            {invoice.discount > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums">−{formatINR(invoice.discount)}</span>
              </div>
            ) : null}
            {invoice.isInterState ? (
              <div className="flex justify-between text-muted-foreground">
                <span>IGST</span>
                <span className="tabular-nums">{formatINR(invoice.taxTotal)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>CGST</span>
                  <span className="tabular-nums">
                    {formatINR(Math.floor(invoice.taxTotal / 2))}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST</span>
                  <span className="tabular-nums">
                    {formatINR(invoice.taxTotal - Math.floor(invoice.taxTotal / 2))}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatINR(invoice.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {payments.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.razorpayPaymentId}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.method ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(p.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(p.paidAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
