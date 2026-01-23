"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProgressCircle } from "@/components/progress-circle"
import {
  MagnifyingGlass,
  Tray,
  CheckSquare,
  Folder,
  Users,
  ChartBar,
  Gear,
  Layout,
  Question,
  CaretRight,
  CaretUpDown,
} from "@phosphor-icons/react/dist/ssr"
import { footerItems, navItems, type NavItemId, type SidebarFooterItemId } from "@/lib/data/sidebar"
import { useUser } from "@/hooks/use-user"
import { useOrganization } from "@/hooks/use-organization"
import { useProjectsRealtime } from "@/hooks/use-realtime"
import type { Project } from "@/lib/supabase/types"

// Color palette for projects
const PROJECT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const navItemIcons: Record<NavItemId, React.ComponentType<{ className?: string }>> = {
  inbox: Tray,
  "my-tasks": CheckSquare,
  projects: Folder,
  clients: Users,
  performance: ChartBar,
}

const footerItemIcons: Record<SidebarFooterItemId, React.ComponentType<{ className?: string }>> = {
  settings: Gear,
  templates: Layout,
  help: Question,
}

type AppSidebarProps = {
  activeProjects?: Project[]
}

export function AppSidebar({ activeProjects: initialProjects = [] }: AppSidebarProps) {
  const pathname = usePathname()
  const { profile } = useUser()
  const { organization } = useOrganization()

  // Convert to local state for real-time updates
  const [activeProjects, setActiveProjects] = useState(initialProjects)

  // Sync with props when initialProjects changes (e.g., after navigation or hydration)
  // Use JSON.stringify to compare array contents, not references
  const initialProjectsJson = JSON.stringify(initialProjects.map(p => p.id))
  useEffect(() => {
    setActiveProjects(initialProjects)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectsJson])

  // Subscribe to project changes
  // Active statuses that should appear in sidebar
  const activeStatuses = ["active", "planned"]

  useProjectsRealtime(organization?.id, {
    onInsert: (newProject) => {
      // Only add if project is active or planned
      if (!activeStatuses.includes(newProject.status || "")) return
      setActiveProjects((prev) => {
        if (prev.some((p) => p.id === newProject.id)) return prev
        return [...prev, newProject as Project].slice(0, 5) // Keep max 5
      })
    },
    onUpdate: (updatedProject) => {
      setActiveProjects((prev) => {
        // If no longer active or planned, remove from sidebar
        if (!activeStatuses.includes(updatedProject.status || "")) {
          return prev.filter((p) => p.id !== updatedProject.id)
        }
        // Update existing or add if newly active/planned
        const exists = prev.some((p) => p.id === updatedProject.id)
        if (exists) {
          return prev.map((p) =>
            p.id === updatedProject.id ? { ...p, ...updatedProject } : p
          )
        }
        // Newly active/planned project
        return [...prev, updatedProject as Project].slice(0, 5)
      })
    },
    onDelete: (deletedProject) => {
      setActiveProjects((prev) => prev.filter((p) => p.id !== deletedProject.id))
    },
  })

  // Get user display info
  const userName = profile?.full_name || profile?.email?.split("@")[0] || "User"
  const userEmail = profile?.email || ""
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const getHrefForNavItem = (id: NavItemId): string => {
    if (id === "my-tasks") return "/tasks"
    if (id === "projects") return "/"
    if (id === "inbox") return "/" // placeholder
    if (id === "clients") return "/clients"
    return "#"
  }

  const isItemActive = (id: NavItemId): boolean => {
    if (id === "projects") {
      return pathname === "/" || pathname.startsWith("/projects")
    }
    if (id === "my-tasks") {
      return pathname.startsWith("/tasks")
    }
    if (id === "inbox") {
      return false
    }
    if (id === "clients") {
      return pathname.startsWith("/clients")
    }
    return false
  }

  return (
    <Sidebar className="border-border/40 border-r-0 shadow-none border-none">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-800 text-primary-foreground shadow-[inset_0_-5px_6.6px_0_rgba(0,0,0,0.25)]">
              {organization?.logo_url ? (
                <img src={organization.logo_url} alt="Logo" className="h-4 w-4" />
              ) : (
                <img src="/logo-wrapper.png" alt="Logo" className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold truncate max-w-[140px]">
                {organization?.name || "Workspace"}
              </span>
              <span className="text-xs text-muted-foreground">Pro plan</span>
            </div>
          </div>
          <button className="rounded-md p-1 hover:bg-accent">
            <CaretUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-0 gap-0">
        <SidebarGroup>
          <div className="relative px-0 py-0">
            <MagnifyingGlass className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search"
              className="h-9 rounded-lg bg-muted/50 pl-8 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20 border-border border shadow-none"
            />
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const href = getHrefForNavItem(item.id)
                const active = isItemActive(item.id)

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="h-9 rounded-lg px-3 font-normal text-muted-foreground"
                    >
                      <Link href={href}>
                        {(() => {
                          const Icon = navItemIcons[item.id]
                          return Icon ? <Icon className="h-[18px] w-[18px]" /> : null
                        })()}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge className="bg-muted text-muted-foreground rounded-full px-2">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {activeProjects.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground">
              Active Projects
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {activeProjects.map((project, index) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton asChild className="h-9 rounded-lg px-3 group">
                      <Link href={`/projects/${project.id}`}>
                        <ProgressCircle
                          progress={project.progress}
                          color={PROJECT_COLORS[index % PROJECT_COLORS.length]}
                          size={18}
                        />
                        <span className="flex-1 truncate text-sm">{project.name}</span>
                        <span className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-accent">
                          <span className="text-muted-foreground text-lg">···</span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-2">
        <SidebarMenu>
          {footerItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton className="h-9 rounded-lg px-3 text-muted-foreground">
                {(() => {
                  const Icon = footerItemIcons[item.id]
                  return Icon ? <Icon className="h-[18px] w-[18px]" /> : null
                })()}
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <Link
          href="/settings/profile"
          className="mt-2 flex items-center gap-3 rounded-lg p-2 hover:bg-accent cursor-pointer"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">{userName}</span>
            <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
          </div>
          <CaretRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}
