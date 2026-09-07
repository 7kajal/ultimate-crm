import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AttendanceHeatmap } from "@/components/hr/attendance-heatmap"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, formatINR, initials } from "@/lib/format"
import { getEmployeeProfile } from "@/lib/queries/hr"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "Employee" }

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  intern: "Intern",
  contract: "Contract",
}

const LEAVE_STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRolePage("admin", "manager")
  const { id } = await params

  const profile = await getEmployeeProfile({ user: { id } } as never, id)
  if (!profile) notFound()

  const { user: u, employee, performance } = profile

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/employees" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          Employees
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initials(u.name, u.email)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{u.name}</h1>
            <Badge variant={employee.isActive ? "success" : "secondary"}>
              {employee.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[u.designation, profile.departmentName, EMPLOYMENT_LABELS[employee.employmentType]]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">
            {employee.employeeCode} · {u.email}
            {u.phone ? ` · ${u.phone}` : ""}
            {profile.managerName ? ` · Reports to ${profile.managerName}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{performance.dealsWon}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Deals won</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">
              {formatINR(performance.revenueWon)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Revenue won</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">{performance.openLeads}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">Open leads</CardContent>
        </Card>
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-lg tabular-nums">
              {employee.leaveBalance} d
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 text-xs text-muted-foreground">
            Leave balance
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves ({profile.leaves.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Last 5 weeks</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceHeatmap rows={profile.attendance} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="pt-2">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.leaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="capitalize">{l.type}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(l.startDate)} → {formatDate(l.endDate)}
                      </TableCell>
                      <TableCell className="tabular-nums">{l.days}</TableCell>
                      <TableCell>
                        <Badge variant={LEAVE_STATUS_VARIANT[l.status] ?? "secondary"}>
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.reviewerName ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {profile.leaves.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No leave requests yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
