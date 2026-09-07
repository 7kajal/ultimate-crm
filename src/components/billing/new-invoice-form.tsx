"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toastError, toastSuccess } from "@/lib/toast"
import { createInvoiceAction } from "@/lib/actions/invoices"
import { computeTotals, GST_RATES, GST_STATES } from "@/lib/billing/gst"

type CustomerOption = {
  id: string
  name: string
  company: string | null
}

type ItemRow = {
  description: string
  hsnCode: string
  quantity: string
  unitPrice: string
  gstRate: number
}

const EMPTY_ROW: ItemRow = {
  description: "",
  hsnCode: "",
  quantity: "1",
  unitPrice: "",
  gstRate: 18,
}

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (d: number) => {
  const date = new Date()
  date.setDate(date.getDate() + d)
  return date.toISOString().slice(0, 10)
}

export function NewInvoiceForm({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter()
  const [customerId, setCustomerId] = React.useState("")
  const [issueDate, setIssueDate] = React.useState(today())
  const [dueDate, setDueDate] = React.useState(inDays(15))
  const [placeOfSupply, setPlaceOfSupply] = React.useState("27")
  const [discount, setDiscount] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [terms, setTerms] = React.useState("")
  const [items, setItems] = React.useState<ItemRow[]>([{ ...EMPTY_ROW }])
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [isPending, setIsPending] = React.useState(false)

  const totals = React.useMemo(() => {
    return computeTotals(
      items.map((it) => ({
        description: it.description,
        hsnCode: it.hsnCode,
        quantity: Number(it.quantity) || 0,
        unitPrice: (Number(it.unitPrice) || 0) * 100,
        gstRate: it.gstRate,
      })),
      {
        discount: (Number(discount) || 0) * 100,
        placeOfSupply,
        supplierState: process.env.NEXT_PUBLIC_COMPANY_STATE ?? "27",
      }
    )
  }, [items, discount, placeOfSupply])

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  async function submit(sendNow: boolean) {
    setIsPending(true)
    setErrors({})

    const result = await createInvoiceAction({
      customerId,
      issueDate,
      dueDate,
      placeOfSupply,
      discount: Number(discount) || 0,
      notes,
      terms,
      items: items.map((it) => ({
        description: it.description,
        hsnCode: it.hsnCode,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        gstRate: it.gstRate,
      })),
      sendNow,
    })

    setIsPending(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Invoice created")
      router.push(`/invoices/${result.invoiceId}`)
    } else {
      setErrors(result.fieldErrors ?? {})
      toastError(result.message)
    }
  }

  const err = (k: string) =>
    errors[k]?.[0] ? <FieldError>{errors[k][0]}</FieldError> : null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit(false)
      }}
      className="flex flex-col gap-6"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Field className="lg:col-span-2" data-invalid={errors.customerId ? "" : undefined}>
          <FieldLabel>Customer *</FieldLabel>
          <Select value={customerId || "none"} onValueChange={(v) => v && v !== "none" && setCustomerId(v)}>
            <SelectTrigger aria-label="Customer">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none" disabled>
                  Select customer
                </SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company ? `${c.company} — ${c.name}` : c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {err("customerId")}
        </Field>
        <Field>
          <FieldLabel htmlFor="inv-issue">Issue date</FieldLabel>
          <Input
            id="inv-issue"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </Field>
        <Field data-invalid={errors.dueDate ? "" : undefined}>
          <FieldLabel htmlFor="inv-due">Due date</FieldLabel>
          <Input
            id="inv-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-invalid={errors.dueDate ? true : undefined}
          />
          {err("dueDate")}
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Field className="lg:col-span-2">
          <FieldLabel>Place of supply</FieldLabel>
          <Select value={placeOfSupply} onValueChange={(v) => v && setPlaceOfSupply(v)}>
            <SelectTrigger aria-label="Place of supply">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(GST_STATES).map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {code} — {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="inv-discount">Discount (₹)</FieldLabel>
          <Input
            id="inv-discount"
            type="number"
            min="0"
            step="any"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Line items</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => [...prev, { ...EMPTY_ROW }])}
          >
            <PlusIcon data-icon="inline-start" />
            Add item
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-2 items-start gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_90px_80px_110px_90px_36px]"
            >
              <Field>
                <FieldLabel className="sr-only">Description</FieldLabel>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  placeholder="Description of service / product"
                />
              </Field>
              <Field>
                <FieldLabel className="sr-only">HSN</FieldLabel>
                <Input
                  value={item.hsnCode}
                  onChange={(e) => updateItem(index, { hsnCode: e.target.value })}
                  placeholder="HSN"
                />
              </Field>
              <Field>
                <FieldLabel className="sr-only">Quantity</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  placeholder="Qty"
                />
              </Field>
              <Field>
                <FieldLabel className="sr-only">Unit price</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                  placeholder="Rate ₹"
                />
              </Field>
              <Field>
                <FieldLabel className="sr-only">GST rate</FieldLabel>
                <Select
                  value={String(item.gstRate)}
                  onValueChange={(v) => v && updateItem(index, { gstRate: Number(v) })}
                >
                  <SelectTrigger aria-label="GST rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {GST_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r}%
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove item"
                disabled={items.length === 1}
                onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Field>
            <FieldLabel htmlFor="inv-notes">Notes</FieldLabel>
            <Textarea
              id="inv-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Visible on the invoice — thank you note, bank details…"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="inv-terms">Terms</FieldLabel>
            <Textarea
              id="inv-terms"
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms, late fees…"
            />
          </Field>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-2 pt-6 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">
                ₹{(totals.subtotal / 100).toLocaleString("en-IN")}
              </span>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums">
                  −₹{(totals.discount / 100).toLocaleString("en-IN")}
                </span>
              </div>
            ) : null}
            {totals.isInterState ? (
              <div className="flex justify-between text-muted-foreground">
                <span>IGST</span>
                <span className="tabular-nums">
                  ₹{(totals.igst / 100).toLocaleString("en-IN")}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>CGST</span>
                  <span className="tabular-nums">
                    ₹{(totals.cgst / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST</span>
                  <span className="tabular-nums">
                    ₹{(totals.sgst / 100).toLocaleString("en-IN")}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                ₹{(totals.total / 100).toLocaleString("en-IN")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => router.push("/invoices")}>
          Cancel
        </Button>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Save as draft
        </Button>
        <Button type="button" disabled={isPending} onClick={() => void submit(true)}>
          {isPending ? <Spinner data-icon="inline-start" /> : null}
          Create &amp; send
        </Button>
      </div>
    </form>
  )
}
