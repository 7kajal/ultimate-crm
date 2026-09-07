"use client"

import { CheckIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { toastError, toastSuccess } from "@/lib/toast"
import { reviewLeaveAction } from "@/lib/actions/hr"

export function ReviewLeaveButtons({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = React.useState<"approve" | "reject" | null>(null)

  async function review(decision: "approved" | "rejected") {
    setIsPending(decision === "approved" ? "approve" : "reject")
    const result = await reviewLeaveAction({ requestId, decision })
    setIsPending(null)
    if (result.ok) {
      toastSuccess(result.message ?? "Reviewed")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Approve"
        disabled={isPending !== null}
        onClick={() => review("approved")}
      >
        <CheckIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Reject"
        disabled={isPending !== null}
        onClick={() => review("rejected")}
      >
        <XIcon />
      </Button>
    </div>
  )
}
