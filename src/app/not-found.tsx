import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-5xl font-bold text-muted-foreground/40">404</p>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you are looking for does not exist or was moved.
        </p>
      </div>
      <Button render={<Link href="/" />} size="sm" variant="outline">
        Back to dashboard
      </Button>
    </div>
  )
}
