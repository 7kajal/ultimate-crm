"use client"

import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Client-side error reporting hook (Sentry picks this up when configured).
    console.error(JSON.stringify({ level: "error", msg: "app error", digest: error.digest, message: error.message }))
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangleIcon className="size-6 text-destructive" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          The error was logged. Try again — if it persists, share the reference
          below with your admin.
        </p>
        {error.digest ? (
          <code className="mt-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {error.digest}
          </code>
        ) : null}
      </div>
      <Button onClick={reset} variant="outline" size="sm">
        <RotateCcwIcon data-icon="inline-start" />
        Try again
      </Button>
    </div>
  )
}
