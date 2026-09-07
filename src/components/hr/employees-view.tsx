"use client"

import { MoreHorizontalIcon, PencilIcon, UserPlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import { AddEmployeeDialog } from "@/components/hr/add-employee-dialog"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toastError, toastSuccess } from "@/lib/toast"
import { updateEmployeeAction } from "@/lib/actions/hr"
import type { Department } from "@/lib/db/schema"
import { formatDate, initials } from "@/lib/format"
import type { EmployeeRow } from "@/lib/queries/hr"

const ROLE_VARIANT: Record<string, BadgeProps["variant"]> = {
  admin: "destructive",
  manager: "warning",
  employee: "secondary",
}

export function EmployeesView({
  employees,
  departments,
  managers,
  isAdmin,
}: {
  employees: EmployeeRow[]
  departments: Department[]
  managers: { id: string; name: string; role: string | null }[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [dept, setDept] = React.useState("all")
  const [addOpen, setAddOpen] = React.useState(false)

  const filtered = React.useMemo(
    () => employees.filter((e) => dept === "all" || e.departmentName === dept),
    [employees, dept]
  )

  async function toggleActive(e: EmployeeRow) {
    const result = await updateEmployeeAction(e.userId, { isActive: !e.isActive })
    if (result.ok) {
      toastSuccess(result.message ?? "Updated")
      router.refresh()
    } else {
      toastError(result.message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={dept} onValueChange={(v) => v && setDept(v)}>
          <SelectTrigger className="w-44" aria-label="Department filter">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.name}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground tabular-nums">
          {filtered.length} of {employees.length}
        </span>
        {isAdmin ? (
          <Button className="ml-auto" onClick={() => setAddOpen(true)}>
            <UserPlusIcon data-icon="inline-start" />
            Add employee
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Reports to</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Leave</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => (
              <TableRow key={e.userId} className={e.isActive ? "" : "opacity-60"}>
                <TableCell>
                  <Link
                    href={`/employees/${e.userId}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {initials(e.name, e.email)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{e.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {e.designation ?? e.email}
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_VARIANT[e.role ?? "employee"] ?? "secondary"}>
                    {e.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {e.departmentName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {e.managerName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(e.joinedAt)}
                </TableCell>
                <TableCell className="tabular-nums">{e.leaveBalance} d</TableCell>
                <TableCell>
                  <Badge variant={e.isActive ? "success" : "secondary"}>
                    {e.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.name}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => router.push(`/employees/${e.userId}`)}
                        >
                          View profile
                        </DropdownMenuItem>
                        {isAdmin ? (
                          <>
                            <DropdownMenuItem onClick={() => toggleActive(e)}>
                              <PencilIcon data-icon="inline-start" />
                              {e.isActive ? "Deactivate" : "Reactivate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        departments={departments}
        managers={managers.filter((m) => m.role !== "employee")}
      />
    </div>
  )
}
