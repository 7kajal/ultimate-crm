"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LeaderboardWidget } from "@/lib/ai/widget-schema"
import { formatValue, toneBg } from "./format"

export function Leaderboard({ widget }: { widget: LeaderboardWidget }) {
  const max = Math.max(...widget.rows.map((r) => r.value), 1)
  const unit = widget.unit ?? "count"

  return (
    <Card className="animate-widget-pop">
      <CardHeader>
        {widget.title ? <CardTitle>{widget.title}</CardTitle> : null}
        <CardDescription>Sorted by {unit === "currency" ? "value" : "count"}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {widget.rows.map((row, i) => (
            <li key={row.label} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatValue(row.value, unit)}
                  </span>
                </div>
                {row.sublabel ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.sublabel}</p>
                ) : null}
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", row.tone ? toneBg[row.tone] ?? "bg-primary" : "bg-primary")}
                    style={{ width: `${Math.max((row.value / max) * 100, 2)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}