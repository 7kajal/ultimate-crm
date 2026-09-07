import { cn } from "@/lib/utils"
import type { Attendance } from "@/lib/db/schema"
import { formatDate } from "@/lib/format"

const STATUS_STYLE: Record<string, string> = {
  present: "bg-success/70 text-success-foreground",
  wfh: "bg-info/70",
  half_day: "bg-warning/60",
  leave: "bg-warning/80",
  absent: "bg-destructive/70",
}

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  wfh: "WFH",
  half_day: "Half day",
  leave: "Leave",
  absent: "Absent",
}

/**
 * Last-5-week attendance grid (Mon–Sun columns), oldest first.
 * Mirrors GitHub contribution-graph reading patterns.
 */
export function AttendanceHeatmap({ rows }: { rows: Attendance[] }) {
  const byDay = new Map(rows.map((r) => [r.day, r]))

  // Build 5 weeks ending this week (Sunday-start weeks for simple math).
  const today = new Date()
  const end = new Date(today)
  end.setDate(end.getDate() + (6 - end.getDay())) // upcoming Sunday

  const weeks: { day: string; status: string | null }[][] = []
  const cursor = new Date(end)
  cursor.setDate(cursor.getDate() - 34) // 5 weeks back

  while (cursor <= end) {
    const week: { day: string; status: string | null }[] = []
    for (let i = 0; i < 7; i++) {
      const iso = cursor.toISOString().slice(0, 10)
      const row = byDay.get(iso)
      week.push({ day: iso, status: row?.status ?? null })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex gap-1.5">
            {week.map((cell) => {
              const isFuture = new Date(cell.day) > today
              return (
                <div
                  key={cell.day}
                  title={
                    cell.status
                      ? `${formatDate(cell.day)} · ${STATUS_LABEL[cell.status]}`
                      : formatDate(cell.day)
                  }
                  className={cn(
                    "size-5 rounded-sm border",
                    cell.status
                      ? STATUS_STYLE[cell.status]
                      : isFuture
                        ? "border-transparent bg-muted/20"
                        : "border-border/50 bg-muted/40"
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {(Object.keys(STATUS_LABEL) as string[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", STATUS_STYLE[s])} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
