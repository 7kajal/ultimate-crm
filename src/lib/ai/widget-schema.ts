import { z } from "zod"

const deltaSchema = z.object({
  text: z.string(),
  direction: z.enum(["up", "down", "flat"]),
  tone: z.enum(["positive", "negative", "neutral"]).optional(),
})

export const kpiWidgetSchema = z.object({
  type: z.literal("kpi"),
  label: z.string().max(80),
  /** Pre-formatted display value, e.g. "3.2x", "₹4,50,000", "37". */
  value: z.string().max(40),
  delta: deltaSchema.optional(),
  sublabel: z.string().max(120).optional(),
  tone: z
    .enum(["default", "primary", "success", "warning", "destructive"])
    .optional(),
})

export const barWidgetSchema = z.object({
  type: z.literal("bar"),
  title: z.string().max(120).optional(),
  unit: z.enum(["count", "currency", "ratio"]).default("count"),
  data: z
    .array(
      z.object({
        label: z.string().max(80),
        value: z.number().finite(),
        tone: z
          .enum(["primary", "success", "warning", "destructive", "info", "muted"])
          .optional(),
      })
    )
    .min(1)
    .max(40),
})

export const lineWidgetSchema = z.object({
  type: z.literal("line"),
  title: z.string().max(120).optional(),
  unit: z.enum(["count", "currency", "ratio"]).default("count"),
  series: z
    .array(
      z.object({
        name: z.string().max(60),
        color: z
          .enum(["primary", "success", "warning", "destructive", "info", "muted"])
          .optional(),
        points: z
          .array(z.object({ label: z.string().max(40), value: z.number().finite() }))
          .min(1)
          .max(120),
      })
    )
    .min(1)
    .max(4),
})

export const donutWidgetSchema = z.object({
  type: z.literal("donut"),
  title: z.string().max(120).optional(),
  totalLabel: z.string().max(80).optional(),
  data: z
    .array(
      z.object({
        label: z.string().max(80),
        value: z.number().finite(),
        color: z
          .enum(["primary", "success", "warning", "destructive", "info", "muted"])
          .optional(),
      })
    )
    .min(1)
    .max(12),
})

export const tableWidgetSchema = z.object({
  type: z.literal("table"),
  title: z.string().max(120).optional(),
  columns: z
    .array(z.object({ key: z.string().max(60), label: z.string().max(80) }))
    .min(1)
    .max(8),
  rows: z
    .array(z.record(z.string(), z.union([z.string(), z.number()])))
    .max(25),
})

export const leaderboardWidgetSchema = z.object({
  type: z.literal("leaderboard"),
  title: z.string().max(120).optional(),
  unit: z.enum(["count", "currency", "ratio"]).default("count"),
  rows: z
    .array(
      z.object({
        label: z.string().max(80),
        sublabel: z.string().max(120).optional(),
        value: z.number().finite(),
        tone: z
          .enum(["primary", "success", "warning", "destructive", "info", "muted", "default"])
          .optional(),
      })
    )
    .min(1)
    .max(25),
})

export const dashboardWidgetSchema = z.discriminatedUnion("type", [
  kpiWidgetSchema,
  barWidgetSchema,
  lineWidgetSchema,
  donutWidgetSchema,
  tableWidgetSchema,
  leaderboardWidgetSchema,
])

export const dashboardSpecSchema = z.object({
  title: z.string().max(120).optional(),
  subtitle: z.string().max(200).optional(),
  /** Human-friendly period, e.g. "Last 15 days". */
  periodLabel: z.string().max(40).optional(),
  widgets: z.array(dashboardWidgetSchema).min(1).max(12),
})

export type Delta = z.infer<typeof deltaSchema>
export type KpiWidget = z.infer<typeof kpiWidgetSchema>
export type BarWidget = z.infer<typeof barWidgetSchema>
export type LineWidget = z.infer<typeof lineWidgetSchema>
export type DonutWidget = z.infer<typeof donutWidgetSchema>
export type TableWidget = z.infer<typeof tableWidgetSchema>
export type LeaderboardWidget = z.infer<typeof leaderboardWidgetSchema>
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>
export type DashboardSpec = z.infer<typeof dashboardSpecSchema>