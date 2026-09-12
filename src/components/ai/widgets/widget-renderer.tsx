"use client"

import { CalendarRangeIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  BarWidget,
  DashboardSpec,
  DashboardWidget,
  DonutWidget,
  KpiWidget,
  LeaderboardWidget,
  LineWidget,
  TableWidget,
} from "@/lib/ai/widget-schema"
import { BarChart } from "./bar-chart"
import { DonutChart } from "./donut-chart"
import { KpiCard } from "./kpi-card"
import { Leaderboard } from "./leaderboard"
import { LineChart } from "./line-chart"
import { StatTable } from "./stat-table"

const SPAN: Partial<Record<DashboardWidget["type"], string>> = {
  kpi: "sm:col-span-1",
  bar: "sm:col-span-1 lg:col-span-2",
  line: "sm:col-span-1 lg:col-span-2",
  donut: "sm:col-span-1 lg:col-span-2",
  table: "sm:col-span-2 lg:col-span-2",
  leaderboard: "sm:col-span-1 lg:col-span-2",
}

function Widget({ widget }: { widget: DashboardWidget }) {
  switch (widget.type) {
    case "kpi":
      return <KpiCard widget={widget as KpiWidget} />
    case "bar":
      return <BarChart widget={widget as BarWidget} />
    case "line":
      return <LineChart widget={widget as LineWidget} />
    case "donut":
      return <DonutChart widget={widget as DonutWidget} />
    case "table":
      return <StatTable widget={widget as TableWidget} />
    case "leaderboard":
      return <Leaderboard widget={widget as LeaderboardWidget} />
  }
}

export function WidgetRenderer({
  spec,
  className,
}: {
  spec: DashboardSpec
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {(spec.title || spec.periodLabel) ? (
        <div className="flex flex-wrap items-center gap-2">
          {spec.title ? (
            <h3 className="text-sm font-semibold text-foreground">{spec.title}</h3>
          ) : null}
          {spec.periodLabel ? (
            <Badge variant="secondary">
              <CalendarRangeIcon data-icon="inline-start" />
              {spec.periodLabel}
            </Badge>
          ) : null}
        </div>
      ) : null}
      {spec.subtitle ? (
        <p className="text-xs text-muted-foreground">{spec.subtitle}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {spec.widgets.map((widget, i) => (
          <div
            key={`${widget.type}-${i}`}
            className={cn("min-w-0", SPAN[widget.type] ?? "lg:col-span-2")}
            style={{ animationDelay: `${Math.min(i * 60, 420)}ms` }}
          >
            <Widget widget={widget} />
          </div>
        ))}
      </div>
    </div>
  )
}