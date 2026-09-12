"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DonutWidget } from "@/lib/ai/widget-schema"
import { chartStroke, formatValue, toneBg, toneStroke } from "./format"

const TOTAL_COLOR = "stroke-muted"

export function DonutChart({ widget }: { widget: DonutWidget }) {
  const total = Math.max(widget.data.reduce((acc, d) => acc + Math.max(d.value, 0), 0), 1)
  const R = 40
  const C = 2 * Math.PI * R

  const slices = widget.data.map((d, i) => {
    const before = widget.data
      .slice(0, i)
      .reduce((a, x) => a + Math.max(x.value, 0), 0)
    return {
      ...d,
      len: (Math.max(d.value, 0) / total) * C,
      offset: -(before / total) * C,
      stroke: d.color
        ? toneStroke[d.color] ?? TOTAL_COLOR
        : chartStroke[i % chartStroke.length],
    }
  })

  return (
    <Card className="animate-widget-pop">
      <CardHeader>
        {widget.title ? <CardTitle>{widget.title}</CardTitle> : null}
        {widget.totalLabel ? <CardDescription>{widget.totalLabel}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5">
          <div className="relative size-36 shrink-0">
            <svg viewBox="0 0 100 100" className="size-36 -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth={16}
                className={TOTAL_COLOR}
              />
              {slices.map((s, i) => (
                <circle
                  key={`${s.label}-${i}`}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  strokeWidth={16}
                  strokeDasharray={`${s.len} ${C - s.len}`}
                  strokeDashoffset={s.offset}
                  className={s.stroke}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-foreground">
                {widget.data.reduce((a, d) => a + d.value, 0)}
              </span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {widget.data.map((d, i) => (
              <li key={`${d.label}-${i}`} className="flex items-center gap-2 text-xs">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-xs ${
                    d.color
                      ? toneBg[d.color] ?? "bg-primary"
                      : chartStroke[i % chartStroke.length].replace("stroke", "bg")
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.label}</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatValue(d.value, "count")}
                </span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">
                  {((d.value / total) * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}