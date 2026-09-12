"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TableWidget } from "@/lib/ai/widget-schema"

export function StatTable({ widget }: { widget: TableWidget }) {
  return (
    <Card className="animate-widget-pop">
      <CardHeader>
        {widget.title ? <CardTitle>{widget.title}</CardTitle> : null}
        <CardDescription>
          {widget.rows.length} row{widget.rows.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-(--card-spacing) overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                {widget.columns.map((col) => (
                  <TableHead key={col.key} className="px-4">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {widget.rows.map((row, i) => (
                <TableRow key={i}>
                  {widget.columns.map((col) => {
                    const value = row[col.key]
                    return (
                      <TableCell key={col.key} className="px-4 tabular-nums whitespace-nowrap">
                        {value ?? "—"}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
              {widget.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={widget.columns.length} className="px-4 py-6 text-center text-muted-foreground">
                    No rows
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}