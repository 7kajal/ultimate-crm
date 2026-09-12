import { formatINR } from "@/lib/format"

export type WidgetUnit = "count" | "currency" | "ratio"

/** Format a raw chart value for display, matching the widget unit. */
export function formatValue(value: number, unit: WidgetUnit): string {
  if (unit === "currency") return formatINR(Math.round(value))
  if (unit === "ratio") return `${value}%`
  return new Intl.NumberFormat("en-IN").format(Math.round(value))
}

/** Tailwind stroke classes per chart tone. */
export const toneStroke: Record<string, string> = {
  primary: "stroke-primary",
  success: "stroke-success",
  warning: "stroke-warning",
  destructive: "stroke-destructive",
  info: "stroke-info",
  muted: "stroke-muted-foreground",
  default: "stroke-foreground",
}

/** Tailwind fill classes per chart tone. */
export const toneFill: Record<string, string> = {
  primary: "fill-primary",
  success: "fill-success",
  warning: "fill-warning",
  destructive: "fill-destructive",
  info: "fill-info",
  muted: "fill-muted-foreground",
  default: "fill-foreground",
}

/** Tailwind background classes per chart tone (for divs). */
export const toneBg: Record<string, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground",
  default: "bg-foreground",
}

/** Tailwind stroke classes cycling through the chart palette (fallback). */
export const chartStroke = [
  "stroke-chart-1",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
  "stroke-chart-5",
]

export const chartFill = [
  "fill-chart-1",
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-4",
  "fill-chart-5",
]