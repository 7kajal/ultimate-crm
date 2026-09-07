"use client"

import {
  Building2,
  IdCard,
  LayoutDashboard,
  MessageCircleMore,
  MegaphoneIcon,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { UserNav } from "@/components/layout/user-nav"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { Role } from "@/lib/rbac"

type NavItem = {
  title: string
  href: string
  icon: typeof UsersRound
}

type NavItemWithRoles = NavItem & { roles: Role[] }

const NAV_MAIN: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Leads", href: "/leads", icon: UsersRound },
  { title: "Customers", href: "/customers", icon: Building2 },
  { title: "Invoices", href: "/invoices", icon: ReceiptText },
]

const NAV_WHATSAPP: (NavItem | NavItemWithRoles)[] = [
  { title: "Inbox", href: "/inbox", icon: MessageCircleMore },
  { title: "Templates", href: "/whatsapp/templates", icon: MegaphoneIcon, roles: ["admin", "manager"] },
  { title: "Campaigns", href: "/whatsapp/campaigns", icon: MegaphoneIcon, roles: ["admin", "manager"] },
]

const NAV_MANAGE: (NavItem | NavItemWithRoles)[] = [
  { title: "Employees", href: "/employees", icon: IdCard, roles: ["admin", "manager"] },
  { title: "AI Assistant", href: "/ai", icon: Sparkles },
  { title: "Admin", href: "/admin/settings", icon: ShieldCheck, roles: ["admin"] },
]

function hasAccess(item: NavItem | NavItemWithRoles, role: Role): item is NavItem {
  if (!("roles" in item)) return true
  return item.roles.includes(role)
}

export function AppSidebar({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; role?: string | null }
}) {
  const pathname = usePathname()
  const role = (user.role ?? "employee") as Role

  const roleLabels: Record<Role, string> = {
    admin: "Administrator",
    manager: "Manager",
    employee: "Sales Executive",
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link href="/">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="size-4" />
                  </div>
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold">Ultimate CRM</span>
                    <span className="text-xs text-muted-foreground">Workspace</span>
                  </span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Work</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MAIN.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    tooltip={item.title}
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>WhatsApp</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_WHATSAPP.filter((item) => hasAccess(item, role)).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    tooltip={item.title}
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MANAGE.filter((item) => hasAccess(item, role)).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    tooltip={item.title}
                    render={
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserNav user={user} roleLabel={roleLabels[role] ?? role} />
      </SidebarFooter>
    </Sidebar>
  )
}
