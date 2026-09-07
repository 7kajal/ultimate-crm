"use client"

import { RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toastError, toastSuccess } from "@/lib/toast"
import { runLeadScoringAction } from "@/lib/actions/ai"

export function InsightsView({
  insights,
  scoreDistribution,
  canRun,
}: {
  insights: {
    id: string
    type: string
    title: string
    body: string
    score: number | null
    createdAt: Date
  }[]
  scoreDistribution: { bucket: string; count: number }[]
  canRun: boolean
}) {
  const router = useRouter()
  const [isPending, setIsPending] = React.useState(false)

  async function runScoring() {
    setIsPending(true)
    const result = await runLeadScoringAction()
    setIsPending(false)
    if (result.ok) {
      toastSuccess(result.message ?? "Scoring complete")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  const maxBucket = Math.max(...scoreDistribution.map((d) => d.count), 1)

  return (
    <div className="flex flex-col gap-4">
      {canRun ? (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={runScoring} disabled={isPending}>
            <RefreshCwIcon data-icon="inline-start" />
            {isPending ? "Scoring…" : "Run scoring now"}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Score distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Lead score distribution</CardTitle>
            <CardDescription>Open leads by AI score</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {scoreDistribution.map((d) => (
              <div key={d.bucket} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground">{d.bucket}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-primary/70"
                    style={{ width: `${(d.count / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right tabular-nums">{d.count}</span>
              </div>
            ))}
            {scoreDistribution.every((d) => d.count === 0) ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Run scoring to generate scores.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Insights feed */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Insights feed</CardTitle>
            <CardDescription>Scores, risk alerts and summaries</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {insights.map((i) => (
              <div key={i.id} className="flex gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex flex-col items-center gap-1">
                  {i.score !== null ? (
                    <Badge
                      variant={
                        (i.score >= 70
                          ? "success"
                          : i.score >= 40
                            ? "warning"
                            : "destructive") as BadgeProps["variant"]
                      }
                      className="tabular-nums"
                    >
                      {i.score}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{i.type.replace("_", " ")}</Badge>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">{i.body}</p>
                </div>
              </div>
            ))}
            {insights.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No insights yet — run scoring to generate them.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
