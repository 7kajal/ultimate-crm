import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PayButton } from "@/components/billing/pay-button"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_VARIANT } from "@/lib/billing/gst"
import { formatDate, formatINR } from "@/lib/format"
import { getPublicInvoice } from "@/lib/queries/invoices"

export const metadata: Metadata = { title: "Pay invoice" }

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getPublicInvoice(token)
  if (!data) notFound()

  const { invoice, customer, items } = data
  const due = Math.max(invoice.total - invoice.amountPaid, 0)
  const isPaid = invoice.status === "paid" || due === 0

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <CardTitle>Invoice {invoice.number}</CardTitle>
              <CardDescription>
                {customer.company ?? customer.name} · due {formatDate(invoice.dueDate)}
              </CardDescription>
            </div>
            <Badge variant={INVOICE_STATUS_VARIANT[invoice.status] as BadgeProps["variant"]}>
              {INVOICE_STATUS_LABEL[invoice.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span>{item.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {Number(item.quantity)} × {formatINR(item.unitPrice)} · GST {item.gstRate}%
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator />

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatINR(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST ({invoice.isInterState ? "IGST" : "CGST + SGST"})</span>
              <span className="tabular-nums">{formatINR(invoice.taxTotal)}</span>
            </div>
            {invoice.amountPaid > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Paid</span>
                <span className="tabular-nums">−{formatINR(invoice.amountPaid)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-semibold">
              <span>{isPaid ? "Total paid" : "Amount payable"}</span>
              <span className="tabular-nums">{formatINR(isPaid ? invoice.total : due)}</span>
            </div>
          </div>

          {isPaid ? (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-center text-sm text-success">
              This invoice has been paid. Thank you!
            </div>
          ) : invoice.status === "cancelled" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
              This invoice was cancelled.
            </div>
          ) : (
            <PayButton
              publicToken={invoice.publicToken}
              invoiceNumber={invoice.number}
              totalPaise={due}
            />
          )}

          {invoice.notes ? (
            <p className="text-xs text-muted-foreground">{invoice.notes}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
