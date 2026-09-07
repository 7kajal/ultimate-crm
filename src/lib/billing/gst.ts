import type { InvoiceStatus } from "@/lib/db/schema"

export type LineItemInput = {
  description: string
  hsnCode?: string | null
  quantity: number
  /** Paise, pre-tax. */
  unitPrice: number
  /** Percent, 0 | 5 | 12 | 18 | 28. */
  gstRate: number
}

export type ComputedItem = LineItemInput & {
  /** quantity × unitPrice, paise. */
  amount: number
  /** Total tax for the line, paise. */
  taxAmount: number
}

export type InvoiceTotals = {
  items: ComputedItem[]
  /** Pre-tax subtotal after line rounding, paise. */
  subtotal: number
  discount: number
  /** CGST+SGST or IGST total, paise. */
  taxTotal: number
  /** Grand total payable, paise. */
  total: number
  cgst: number
  sgst: number
  igst: number
  isInterState: boolean
}

const round = (paise: number) => Math.round(paise)

/**
 * Computes invoice totals with GST split.
 * Intra-state → CGST + SGST (half rate each side).
 * Inter-state → IGST (full rate).
 * Tax is computed on (amount − proportional discount share).
 */
export function computeTotals(
  items: LineItemInput[],
  opts: { discount?: number; placeOfSupply: string; supplierState: string }
): InvoiceTotals {
  const discount = round(opts.discount ?? 0)
  const gross = items.reduce((acc, it) => acc + round(it.quantity * it.unitPrice), 0)
  const discountFactor = gross > 0 ? (gross - discount) / gross : 0

  const computed: ComputedItem[] = items.map((it) => {
    const amount = round(it.quantity * it.unitPrice)
    const taxable = round(amount * discountFactor)
    const taxAmount = round((taxable * it.gstRate) / 100)
    return { ...it, amount, taxAmount }
  })

  const subtotal = computed.reduce((acc, it) => acc + it.amount, 0)
  const taxTotal = computed.reduce((acc, it) => acc + it.taxAmount, 0)
  const isInterState = opts.placeOfSupply !== opts.supplierState

  let cgst = 0
  let sgst = 0
  let igst = 0
  if (isInterState) {
    igst = taxTotal
  } else {
    cgst = round(taxTotal / 2)
    sgst = taxTotal - cgst
  }

  return {
    items: computed,
    subtotal,
    discount,
    taxTotal,
    total: subtotal - discount + taxTotal,
    cgst,
    sgst,
    igst,
    isInterState,
  }
}

/** GST state codes → names (subset covering most business states). */
export const GST_STATES: Record<string, string> = {
  "07": "Delhi",
  "09": "Uttar Pradesh",
  "19": "West Bengal",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "36": "Telangana",
  "06": "Haryana",
  "08": "Rajasthan",
}

export const GST_RATES = [0, 5, 12, 18, 28] as const

export const INVOICE_STATUS_VARIANT: Record<
  InvoiceStatus,
  "secondary" | "info" | "warning" | "success" | "destructive" | "outline"
> = {
  draft: "secondary",
  sent: "info",
  partially_paid: "warning",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
}
