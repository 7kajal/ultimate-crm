import { eq } from "drizzle-orm"

import { renderInvoicePdf } from "@/lib/billing/invoice-pdf"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { childLogger } from "@/lib/logger"
import { getInvoiceDetail } from "@/lib/queries/invoices"
import { requireSession } from "@/lib/rbac"

const log = childLogger({ module: "invoice-pdf" })

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireSession()
  const { id } = await params

  const detail = await getInvoiceDetail(id)
  if (!detail) {
    return Response.json({ error: "Invoice not found" }, { status: 404 })
  }

  const [company] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)

  // Reconstruct totals split from stored aggregates.
  const isInterState = detail.invoice.isInterState
  const taxTotal = detail.invoice.taxTotal

  const { computeTotals } = await import("@/lib/billing/gst")
  const totals = computeTotals(
    detail.items.map((it) => ({
      description: it.description,
      hsnCode: it.hsnCode,
      quantity: Number(it.quantity),
      unitPrice: it.unitPrice,
      gstRate: it.gstRate,
    })),
    {
      discount: detail.invoice.discount,
      placeOfSupply: detail.invoice.placeOfSupply,
      supplierState: process.env.COMPANY_STATE_CODE ?? "27",
    }
  )

  const pdf = await renderInvoicePdf({
    number: detail.invoice.number,
    issueDate: detail.invoice.issueDate,
    dueDate: detail.invoice.dueDate,
    status: detail.invoice.status,
    company: {
      name: company?.companyName ?? "Ultimate CRM",
      gstin: company?.gstin,
      address: [company?.addressLine, company?.city, company?.state, company?.pincode]
        .filter(Boolean)
        .join(", "),
    },
    customer: {
      name: detail.customer.name,
      company: detail.customer.company,
      address: [
        detail.customer.addressLine,
        detail.customer.city,
        detail.customer.state,
        detail.customer.pincode,
      ]
        .filter(Boolean)
        .join(", "),
      gstin: detail.customer.gstin,
    },
    placeOfSupply: detail.invoice.placeOfSupply,
    totals: {
      ...totals,
      // Trust stored split for CGST/SGST rounding parity.
      taxTotal,
      cgst: isInterState ? 0 : taxTotal - Math.floor(taxTotal / 2),
      sgst: isInterState ? 0 : Math.floor(taxTotal / 2),
      igst: isInterState ? taxTotal : 0,
    },
    amountPaid: detail.invoice.amountPaid,
    notes: detail.invoice.notes,
    terms: detail.invoice.terms,
  })

  log.info({ invoiceId: id }, "pdf generated")
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${detail.invoice.number}.pdf"`,
    },
  })
}
