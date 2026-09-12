"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { LineWidget } from "@/lib/ai/widget-schema"
import { chartStroke, formatValue, toneBg, toneStroke } from "./format"

const HEIGHT = 170
const PAD = { top: 10, right: 8, bottom: 24, left: 8 }

function useChartWidth(): { ref: React.RefObject<HTMLDivElement | null>; width: number } {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(Math.floor(entry.contentRect.width))
    })
    ro.observe(el)
    setWidth(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

export function LineChart({ widget }: { widget: LineWidget }) {
  const { ref, width } = useChartWidth()
  const unit = widget.unit ?? "count"

  const n = Math.max(...widget.series.map((s) => s.points.length))
  const max = Math.max(1, ...widget.series.flatMap((s) => s.points.map((p) => p.value)))
  const innerW = Math.max(width - PAD.left - PAD.right, 0)
  const innerH = HEIGHT - PAD.top - PAD.bottom

  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH

  const showDots = n <= 20
  const xLabels = [0, Math.floor((n - 1) / 2), n - 1].filter((i, idx, arr) => arr.indexOf(i) === idx)
  const labels = widget.series[0]?.points.map((p) => p.label) ?? []

  return (
    <Card className="animate-widget-pop">
      <CardHeader>
        {widget.title ? <CardTitle>{widget.title}</CardTitle> : null}
        <CardDescription>
          {widget.series.map((s) => s.name).join(" vs ")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={ref} className="w-full">
          {width > 40 ? (
            <svg
              viewBox={`0 0 ${width} ${HEIGHT}`}
              className="h-[170px] w-full text-muted-foreground"
              role="img"
              aria-label={widget.title ?? "Line chart"}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={PAD.top + innerH - f * innerH}
                  y2={PAD.top + innerH - f * innerH}
                  className="stroke-border"
                  strokeWidth={1}
                />
              ))}
              {xLabels.map((i) => (
                <text
                  key={i}
                  x={x(i)}
                  y={HEIGHT - 6}
                  textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                  className="fill-muted-foreground"
                  fontSize={10}
                >
                  {labels[i] ?? ""}
                </text>
              ))}
              {widget.series.map((s, si) => {
                const stroke = s.color ? toneStroke[s.color] ?? chartStroke[0] : chartStroke[si % chartStroke.length]
                const points = s.points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")
                return (
                  <g key={s.name}>
                    <polyline
                      points={points}
                      fill="none"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className={stroke}
                    />
                    {showDots
                      ? s.points.map((p, i) => (
                          <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} className={stroke} />
                        ))
                      : null}
                    <text
                      x={x(s.points.length - 1)}
                      y={Math.max(y(s.points[s.points.length - 1].value) - 6, 6)}
                      textAnchor="end"
                      className={stroke}
                      fontSize={11}
                      fontWeight={600}
                    >
                      {formatValue(s.points[s.points.length - 1].value, unit)}
                    </text>
                  </g>
                )
              })}
            </svg>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {widget.series.map((s, si) => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`h-2 w-2 rounded-full ${s.color ? toneBg[s.color] ?? "bg-primary" : chartStroke[si % chartStroke.length].replace("stroke", "bg")}`}
              />
              {s.name}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}