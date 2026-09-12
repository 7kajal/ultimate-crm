"use client"

import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Delta, KpiWidget } from "@/lib/ai/widget-schema"

const valueTone: Record<NonNullable<KpiWidget["tone"]>, string> = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
}

const deltaTone: Record<NonNullable<Delta["tone"]>, string> = {
  positive: "text-success",
  negative: "text-destructive",
  neutral: "text-muted-foreground",
}

function DeltaBadge({ delta }: { delta: Delta }) {
  const Icon =
    delta.direction === "up"
      ? TrendingUpIcon
      : delta.direction === "down"
        ? TrendingDownIcon
        : MinusIcon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        deltaTone[delta.tone ?? "neutral"]
      )}
    >
      <Icon data-icon="inline-start" className="size-3.5" />
      {delta.text}
    </span>
  )
}

export function KpiCard({ widget }: { widget: KpiWidget }) {
  return (
    <Card className="animate-widget-pop">
      <CardHeader className="gap-0">
        <CardDescription>{widget.label}</CardDescription>
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle
            className={cn(
              "text-3xl font-semibold tabular-nums tracking-tight",
              valueTone[widget.tone ?? "default"]
            )}
          >
            {widget.value}
          </CardTitle>
          {widget.delta ? <DeltaBadge delta={widget.delta} /> : null}
        </div>
      </CardHeader>
      {widget.sublabel ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{widget.sublabel}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}