"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { BarWidget } from "@/lib/ai/widget-schema"
import { formatValue, toneFill } from "./format"

export function BarChart({ widget }: { widget: BarWidget }) {
  const max = Math.max(...widget.data.map((d) => d.value), 1)
  const color = (tone?: string) => tone ? (toneFill[tone] ?? "fill-primary") : "fill-primary"

  return (
    <Card className="animate-widget-pop">
      <CardHeader>
        {widget.title ? <CardTitle>{widget.title}</CardTitle> : null}
        <CardDescription>
          {widget.data.length} bar{widget.data.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-1.5">
          {widget.data.map((d, i) => (
            <div key={`${d.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
              <div
                className={color(d.tone)}
                style={{ height: `${Math.max((d.value / max) * 100, 1)}%` }}
                title={`${d.label}: ${formatValue(d.value, widget.unit ?? "count")}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {widget.data.map((d, i) => (
            <span
              key={`${d.label}-${i}`}
              className="min-w-0 flex-1 truncate text-center text-[10px] leading-4 text-muted-foreground"
            >
              {d.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}