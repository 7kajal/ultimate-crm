import type { Metadata } from "next"
import {
  ArrowUpRight,
  MessageCircleMore,
  ReceiptText,
  UsersRound,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline health, revenue and team activity — at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Open Leads</CardDescription>
            <CardTitle className="text-3xl tabular-nums">—</CardTitle>
            <CardAction>
              <Badge variant="secondary">
                <UsersRound data-icon="inline-start" />
                CRM
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-xs text-muted-foreground">
            Populated in the Leads phase
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Pipeline Value</CardDescription>
            <CardTitle className="text-3xl tabular-nums">—</CardTitle>
            <CardAction>
              <Badge variant="secondary">INR</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-xs text-muted-foreground">
            Weighted by stage probability
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Invoices Outstanding</CardDescription>
            <CardTitle className="text-3xl tabular-nums">—</CardTitle>
            <CardAction>
              <Badge variant="secondary">
                <ReceiptText data-icon="inline-start" />
                Billing
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-xs text-muted-foreground">
            Overdue detection via nightly cron
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>WhatsApp Unread</CardDescription>
            <CardTitle className="text-3xl tabular-nums">—</CardTitle>
            <CardAction>
              <Badge variant="secondary">
                <MessageCircleMore data-icon="inline-start" />
                Inbox
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-xs text-muted-foreground">
            Shared inbox assignment
          </CardFooter>
        </Card>
      </div>

      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArrowUpRight />
          </EmptyMedia>
          <EmptyTitle>Modules land in upcoming phases</EmptyTitle>
          <EmptyDescription>
            Leads → Employees → Invoices &amp; Razorpay → WhatsApp → AI layer.
            This overview wires into each module as it ships.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
