"use client"

import { ExternalLinkIcon, SendIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { toastError, toastSuccess } from "@/lib/toast"
import { cancelInvoiceAction, markPaidAction, sendInvoiceAction } from "@/lib/actions/invoices"

export function InvoiceActions({
  invoiceId,
  status,
  paymentLinkUrl,
}: {
  invoiceId: string
  status: string
  paymentLinkUrl: string | null
}) {
  const router = useRouter()
  const [isPending, setIsPending] = React.useState(false)

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setIsPending(true)
    const result = await fn()
    setIsPending(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Done")
      router.refresh()
    } else {
      toastError(result.message ?? "Failed")
    }
  }

  const canSend = status === "draft" || status === "overdue"
  const canCancel = status !== "paid" && status !== "cancelled"
  const canMarkPaid = status !== "paid" && status !== "cancelled" && status !== "draft"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSend ? (
        <Button size="sm" disabled={isPending} onClick={() => run(() => sendInvoiceAction(invoiceId))}>
          <SendIcon data-icon="inline-start" />
          Send / create link
        </Button>
      ) : null}
      {paymentLinkUrl ? (
        <Button size="sm" variant="outline" render={<a href={paymentLinkUrl} target="_blank" rel="noreferrer" />}>
          <ExternalLinkIcon data-icon="inline-start" />
          Payment link
        </Button>
      ) : null}
      {canMarkPaid ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => markPaidAction(invoiceId))}>
          Mark paid
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => run(() => cancelInvoiceAction(invoiceId))}
        >
          Cancel invoice
        </Button>
      ) : null}
    </div>
  )
}
