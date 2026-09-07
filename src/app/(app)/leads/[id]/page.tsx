import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ActivityPanel } from "@/components/leads/activity-panel"
import { ConvertDialog } from "@/components/leads/convert-dialog"
import { TasksPanel } from "@/components/leads/tasks-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatDate,
  formatINR,
  initials,
  timeAgo,
} from "@/lib/format"
import { SOURCE_LABELS, STAGE_META } from "@/lib/leads-meta"
import { getLeadDetail } from "@/lib/queries/leads"
import { requireUser } from "@/lib/rbac"

export const metadata: Metadata = { title: "Lead" }

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireUser()
  const { id } = await params

  const detail = await getLeadDetail(session, id)
  if (!detail) notFound()

  const { lead, activities, tasks } = detail
  const meta = STAGE_META[lead.stage]
  const openTasks = tasks.filter((t) => t.status === "open").length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/leads" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Leads
        </Button>
        <Separator orientation="vertical" className="h-5!" />
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <span className="text-xs text-muted-foreground">
          Created {timeAgo(lead.createdAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(lead.name)}
          </span>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold tracking-tight">{lead.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[lead.company, lead.email, lead.phone].filter(Boolean).join(" · ") ||
                "No contact details"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.convertedCustomerId ? (
            <Badge variant="success">Converted</Badge>
          ) : (
            <ConvertDialog
              leadId={lead.id}
              disabled={Boolean(lead.convertedCustomerId)}
              defaults={{
                name: lead.name,
                company: lead.company ?? "",
                email: lead.email ?? "",
                phone: lead.phone ?? "",
              }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">
              {formatINR(lead.value)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">
            Deal value
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg">{SOURCE_LABELS[lead.source]}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">
            Source
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg">
              {lead.assigneeName ?? "Unassigned"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">
            Owner
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg">
              {lead.lastContactedAt ? formatDate(lead.lastContactedAt) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">
            Last contacted
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">
            Activities ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({openTasks} open)</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="activities" className="pt-2">
          <Card>
            <CardContent className="pt-6">
              <ActivityPanel leadId={lead.id} activities={activities} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks" className="pt-2">
          <Card>
            <CardContent className="pt-6">
              <TasksPanel leadId={lead.id} tasks={tasks} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="whatsapp" className="pt-2">
          <Card>
            <CardContent className="flex min-h-40 items-center justify-center pt-6 text-sm text-muted-foreground">
              Conversation history lands with the WhatsApp phase.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
