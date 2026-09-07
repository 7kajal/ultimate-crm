"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
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
import { toastError, toastSuccess } from "@/lib/toast"
import { updateSettingsAction } from "@/lib/actions/admin"
import { GST_RATES } from "@/lib/billing/gst"

type SettingsData = {
  companyName: string
  gstin: string | null
  addressLine: string | null
  city: string | null
  state: string | null
  pincode: string | null
  invoicePrefix: string
  invoiceCounter: number
  defaultGstRate: number
}

export function SettingsForm({
  settings,
  supplierStateCode,
}: {
  settings: SettingsData
  supplierStateCode: string
}) {
  const [isPending, setIsPending] = React.useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)

    const fd = new FormData(e.currentTarget)
    const result = await updateSettingsAction({
      companyName: fd.get("companyName"),
      gstin: fd.get("gstin"),
      addressLine: fd.get("addressLine"),
      city: fd.get("city"),
      state: fd.get("state"),
      pincode: fd.get("pincode"),
      invoicePrefix: fd.get("invoicePrefix"),
      defaultGstRate: Number(fd.get("defaultGstRate")),
    })

    setIsPending(false)
    if (result.ok) toastSuccess(result.message)
    else toastError(result.message)
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company profile</CardTitle>
          <CardDescription>
            Shown on invoices and used for GST calculations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="set-name">Company name *</FieldLabel>
                <Input id="set-name" name="companyName" defaultValue={settings.companyName} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="set-gstin">GSTIN</FieldLabel>
                <Input
                  id="set-gstin"
                  name="gstin"
                  defaultValue={settings.gstin ?? ""}
                  placeholder="27ABCDE1234F1Z5"
                  maxLength={15}
                />
                <FieldDescription>Your own GST registration number.</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="set-address">Address</FieldLabel>
              <Input id="set-address" name="addressLine" defaultValue={settings.addressLine ?? ""} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="set-city">City</FieldLabel>
                <Input id="set-city" name="city" defaultValue={settings.city ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="set-state">State</FieldLabel>
                <Input id="set-state" name="state" defaultValue={settings.state ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="set-pincode">Pincode</FieldLabel>
                <Input id="set-pincode" name="pincode" defaultValue={settings.pincode ?? ""} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="set-prefix">Invoice prefix</FieldLabel>
                <Input
                  id="set-prefix"
                  name="invoicePrefix"
                  defaultValue={settings.invoicePrefix}
                  maxLength={10}
                />
                <FieldDescription>
                  Next number: {settings.invoicePrefix.toUpperCase()}-{new Date().getFullYear()}-
                  {String(settings.invoiceCounter + 1).padStart(4, "0")}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Default GST rate</FieldLabel>
                <Select name="defaultGstRate" defaultValue={String(settings.defaultGstRate)}>
                  <SelectTrigger aria-label="Default GST rate">
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
              <Field>
                <FieldLabel htmlFor="set-supplier-state">Supplier state code</FieldLabel>
                <Input id="set-supplier-state" value={supplierStateCode} disabled />
                <FieldDescription>
                  From COMPANY_STATE_CODE env — drives CGST/SGST vs IGST.
                </FieldDescription>
              </Field>
            </div>

            <Field orientation="horizontal">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner data-icon="inline-start" /> : null}
                Save settings
              </Button>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  )
}
