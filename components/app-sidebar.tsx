"use client"

import { memo, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
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
  CaretUpDown,
  SignOut,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"
import { useUser } from "@/hooks/use-user"
import { signOut } from "@/lib/actions/auth"
import { getUnreadCount } from "@/lib/actions/inbox"
import { useInboxRealtime } from "@/hooks/use-realtime"
import type { Project } from "@/lib/supabase/types"
import { useCommandPalette } from "@/components/command-palette"
import { useSettingsDialog } from "@/components/providers/settings-dialog-provider"

// Navigation items defined inline (no mock data dependency)
type NavItemId = "inbox" | "my-tasks" | "projects" | "clients" | "chat" | "performance"
type SidebarFooterItemId = "settings" | "templates" | "help"

type NavItem = {
  id: NavItemId
  label: string
  badge?: number
}

type FooterItem = {
  id: SidebarFooterItemId
  label: string
}

const navItems: NavItem[] = [
  { id: "inbox", label: "Inbox" },
  { id: "my-tasks", label: "My task" },
  { id: "projects", label: "Projects" },
  { id: "clients", label: "Clients" },
  { id: "chat", label: "AI Chat" },
  { id: "performance", label: "Performance" },
]

const footerItems: FooterItem[] = [
  { id: "settings", label: "Settings" },
  { id: "templates", label: "Templates" },
  { id: "help", label: "Help" },
]

// Color palette for projects based on progress
const getProjectColor = (progress: number): string => {
  if (progress >= 75) return "var(--chart-1)" // green-ish for near completion
  if (progress >= 50) return "var(--chart-3)" // yellow-ish for mid-progress
  if (progress >= 25) return "var(--chart-5)" // blue-ish for early progress
  return "var(--chart-2)" // red-ish for just started
}

// Preload functions for navigation - triggered on hover for faster perceived navigation
const preloadHandlers: Record<NavItemId, () => void> = {
  inbox: () => {
    if (typeof window !== "undefined") {
      void import("@/components/inbox/InboxContent")
    }
  },
  "my-tasks": () => {
    if (typeof window !== "undefined") {
      void import("@/components/tasks/MyTasksPage")
    }
  },
  projects: () => {
    if (typeof window !== "undefined") {
      void import("@/components/projects-content")
    }
  },
  clients: () => {
    if (typeof window !== "undefined") {
      void import("@/components/clients-content")
    }
  },
  chat: () => {
    if (typeof window !== "undefined") {
      void import("@/components/ai/chat-page-content")
    }
  },
  performance: () => {
    // No preload for performance page yet
  },
}

const preloadProjectDetails = () => {
  if (typeof window !== "undefined") {
    void import("@/components/projects/ProjectDetailsPage")
  }
}

interface AppSidebarProps {
  activeProjects?: Project[]
}

const navItemIcons: Record<NavItemId, React.ComponentType<{ className?: string }>> = {
  inbox: Tray,
  "my-tasks": CheckSquare,
  projects: Folder,
  clients: Users,
  chat: Sparkle,
  performance: ChartBar,
}

const footerItemIcons: Record<SidebarFooterItemId, React.ComponentType<{ className?: string }>> = {
  settings: Gear,
  templates: Layout,
  help: Question,
}

// Memoized project item to prevent re-renders when other projects change
const ProjectMenuItem = memo(function ProjectMenuItem({
  project,
}: {
  project: Project
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="h-9 rounded-lg px-3 group">
        <Link
          href={`/projects/${project.id}`}
          onMouseEnter={preloadProjectDetails}
          onFocus={preloadProjectDetails}
        >
          <ProgressCircle
            progress={project.progress || 0}
            color={getProjectColor(project.progress || 0)}
            size={18}
          />
          <span className="flex-1 truncate text-sm">{project.name}</span>
          <span className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-accent">
            <span className="text-muted-foreground text-lg">···</span>
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})

export function AppSidebar({ activeProjects = [] }: AppSidebarProps) {
  const pathname = usePathname()
  const { profile, user } = useUser()
  const { open: openCommandPalette } = useCommandPalette()
  const { openSettings } = useSettingsDialog()
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch initial unread count
  useEffect(() => {
    getUnreadCount().then(({ data }) => {
      if (data !== undefined) setUnreadCount(data)
    })
  }, [])

  // Real-time updates for inbox
  useInboxRealtime(user?.id, {
    onInsert: () => setUnreadCount((prev) => prev + 1),
    onUpdate: (item, oldItem) => {
      // Decrement when marked as read
      if (!oldItem.is_read && item.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      // Increment when marked as unread (edge case)
      if (oldItem.is_read && !item.is_read) {
        setUnreadCount((prev) => prev + 1)
      }
    },
    onDelete: (item) => {
      // Decrement if deleted item was unread
      if (!item.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    },
  })

  const getHrefForNavItem = (id: NavItemId): string => {
    if (id === "my-tasks") return "/tasks"
    if (id === "projects") return "/"
    if (id === "inbox") return "/inbox"
    if (id === "clients") return "/clients"
    if (id === "chat") return "/chat"
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
      return pathname.startsWith("/inbox")
    }
    if (id === "clients") {
      return pathname.startsWith("/clients")
    }
    if (id === "chat") {
      return pathname.startsWith("/chat")
    }
    return false
  }

  return (
    <Sidebar className="border-border/40 border-r-0 shadow-none border-none">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_-5px_6.6px_0_rgba(0,0,0,0.25)]">
              <Image src="/logo-wrapper.png" alt="Logo" width={16} height={16} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Workspace</span>
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
          <button
            onClick={openCommandPalette}
            className="relative w-full px-0 py-0 text-left"
          >
            <MagnifyingGlass className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <div className="h-9 rounded-lg bg-muted/50 pl-8 text-sm text-muted-foreground flex items-center border-border border shadow-none cursor-pointer hover:bg-muted/70 transition-colors">
              Search
            </div>
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
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
                      className="h-9 rounded-lg px-3 font-normal text-muted-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"
                    >
                      <Link
                        href={href}
                        onMouseEnter={preloadHandlers[item.id]}
                        onFocus={preloadHandlers[item.id]}
                      >
                        {(() => {
                          const Icon = navItemIcons[item.id]
                          return Icon ? <Icon className="h-[18px] w-[18px]" /> : null
                        })()}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.id === "inbox" && unreadCount > 0 && (
                      <SidebarMenuBadge className="bg-muted text-muted-foreground rounded-full px-2">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground">
            Active Projects
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activeProjects.length > 0 ? (
                activeProjects.map((project) => (
                  <ProjectMenuItem key={project.id} project={project} />
                ))
              ) : (
                <SidebarMenuItem>
                  <span className="px-3 text-sm text-muted-foreground">No active projects</span>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40 p-2">
        <SidebarMenu>
          {footerItems.map((item) => {
            const Icon = footerItemIcons[item.id]

            // Settings opens dialog instead of navigating
            if (item.id === "settings") {
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    onClick={() => openSettings()}
                    className="h-9 rounded-lg px-3 text-muted-foreground"
                  >
                    {Icon && <Icon className="h-[18px] w-[18px]" />}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  className="h-9 rounded-lg px-3 text-muted-foreground"
                >
                  <Link href="#">
                    {Icon && <Icon className="h-[18px] w-[18px]" />}
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        <div className="mt-2 flex items-center gap-3 rounded-lg p-2 hover:bg-accent cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || "/avatar-profile.jpg"} />
            <AvatarFallback>
              {profile?.full_name
                ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                : user?.email?.slice(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">
              {profile?.full_name || user?.email?.split("@")[0] || "User"}
            </span>
          </div>
          <button
            onClick={async () => {
              await signOut()
            }}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Sign out"
          >
            <SignOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
