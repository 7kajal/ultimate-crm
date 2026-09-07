import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer"

import type { InvoiceTotals } from "@/lib/billing/gst"
import { formatINR } from "@/lib/format"

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  muted: { color: "#555" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  section: { marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  table: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#ddd" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  colDesc: { width: "42%" },
  colHsn: { width: "12%" },
  colQty: { width: "10%", textAlign: "right" },
  colRate: { width: "16%", textAlign: "right" },
  colTax: { width: "8%", textAlign: "right" },
  colAmount: { width: "12%", textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: "45%" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#111",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  footer: { position: "absolute", bottom: 32, left: 40, right: 40, color: "#777" },
})

export type InvoicePdfData = {
  number: string
  issueDate: string
  dueDate: string
  status: string
  company: { name: string; gstin?: string | null; address?: string | null }
  customer: {
    name: string
    company?: string | null
    address?: string | null
    gstin?: string | null
  }
  placeOfSupply: string
  totals: InvoiceTotals
  amountPaid: number
  notes?: string | null
  terms?: string | null
}

function Pdf({ data }: { data: InvoicePdfData }) {
  const { totals } = data
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{data.company.name}</Text>
            {data.company.address ? (
              <Text style={styles.muted}>{data.company.address}</Text>
            ) : null}
            {data.company.gstin ? (
              <Text style={styles.muted}>GSTIN: {data.company.gstin}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>TAX INVOICE</Text>
            <Text>{data.number}</Text>
            <Text style={styles.muted}>Issued: {data.issueDate}</Text>
            <Text style={styles.muted}>Due: {data.dueDate}</Text>
            <Text style={styles.muted}>({data.status})</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.muted}>Bill To</Text>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {data.customer.company ?? data.customer.name}
          </Text>
          {data.customer.address ? (
            <Text style={styles.muted}>{data.customer.address}</Text>
          ) : null}
          {data.customer.gstin ? (
            <Text style={styles.muted}>GSTIN: {data.customer.gstin}</Text>
          ) : null}
          <Text style={styles.muted}>
            Place of supply: {data.placeOfSupply}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colHsn}>HSN</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colTax}>GST</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {totals.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colHsn}>{item.hsnCode ?? "—"}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colRate}>{formatINR(item.unitPrice)}</Text>
              <Text style={styles.colTax}>{item.gstRate}%</Text>
              <Text style={styles.colAmount}>{formatINR(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatINR(totals.subtotal)}</Text>
          </View>
          {totals.discount > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Discount</Text>
              <Text>-{formatINR(totals.discount)}</Text>
            </View>
          ) : null}
          {totals.isInterState ? (
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>IGST</Text>
              <Text>{formatINR(totals.igst)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>CGST</Text>
                <Text>{formatINR(totals.cgst)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>SGST</Text>
                <Text>{formatINR(totals.sgst)}</Text>
              </View>
            </>
          )}
          <View style={styles.grand}>
            <Text>Total</Text>
            <Text>{formatINR(totals.total)}</Text>
          </View>
          {data.amountPaid > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Paid</Text>
              <Text>-{formatINR(data.amountPaid)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          {data.notes ? <Text>Notes: {data.notes}</Text> : null}
          {data.terms ? <Text>Terms: {data.terms}</Text> : null}
        </View>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<Pdf data={data} />)
}
