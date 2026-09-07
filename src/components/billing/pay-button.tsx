"use client"

import Script from "next/script"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { toastError, toastSuccess } from "@/lib/toast"
import {
  createCheckoutOrderAction,
  verifyCheckoutAction,
} from "@/lib/actions/invoices"

type RazorpayCheckout = new (options: {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  handler: (response: {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }) => void
  theme?: { color?: string }
}) => { open: () => void }

declare global {
  interface Window {
    Razorpay?: RazorpayCheckout
  }
}

export function PayButton({
  publicToken,
  invoiceNumber,
  totalPaise,
}: {
  publicToken: string
  invoiceNumber: string
  totalPaise: number
}) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [scriptReady, setScriptReady] = React.useState(false)

  async function onPay() {
    setIsLoading(true)
    try {
      const order = await createCheckoutOrderAction(publicToken)
      if (!order.ok) {
        toastError(order.message)
        return
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      if (!keyId || !window.Razorpay) {
        toastError("Payment gateway not available")
        return
      }

      const rzp = new window.Razorpay({
        key: keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        name: "Ultimate CRM",
        description: `Invoice ${invoiceNumber}`,
        handler: (response) => {
          void (async () => {
            const result = await verifyCheckoutAction({
              ...response,
              publicToken,
            })
            if (result.ok) {
              toastSuccess(result.message)
              window.location.reload()
            } else {
              toastError(result.message)
            }
          })()
        },
        theme: { color: "#111111" },
      })
      rzp.open()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onReady={() => setScriptReady(true)}
      />
      <Button size="lg" className="w-full" disabled={!scriptReady || isLoading} onClick={onPay}>
        {isLoading ? <Spinner data-icon="inline-start" /> : null}
        Pay ₹{(totalPaise / 100).toLocaleString("en-IN")}
      </Button>
    </>
  )
}
