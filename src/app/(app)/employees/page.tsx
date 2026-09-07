import type { Metadata } from "next"

import { EmployeesView } from "@/components/hr/employees-view"
import { listDepartments, listEmployees } from "@/lib/queries/hr"
import { requireRolePage } from "@/lib/rbac"

export const metadata: Metadata = { title: "Employees" }

export default async function EmployeesPage() {
  const session = await requireRolePage("admin", "manager")
  const [employees, departments] = await Promise.all([
    listEmployees(),
    listDepartments(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">
          Team directory, departments and leave balances.
        </p>
      </div>

      <EmployeesView
        employees={employees}
        departments={departments}
        managers={employees.map((e) => ({
          id: e.userId,
          name: e.name,
          role: e.role,
        }))}
        isAdmin={session.user.role === "admin"}
      />
    </div>
  )
}
