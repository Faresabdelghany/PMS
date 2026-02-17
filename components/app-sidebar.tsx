"use client"

import { memo, useState, useEffect, startTransition, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
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
import { getOptimizedAvatarUrl } from "@/lib/assets/avatars"
import { ProgressCircle } from "@/components/progress-circle"
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { Tray } from "@phosphor-icons/react/dist/ssr/Tray"
import { CheckSquare } from "@phosphor-icons/react/dist/ssr/CheckSquare"
import { Folder } from "@phosphor-icons/react/dist/ssr/Folder"
import { Users } from "@phosphor-icons/react/dist/ssr/Users"
import { Gear } from "@phosphor-icons/react/dist/ssr/Gear"
import { Layout } from "@phosphor-icons/react/dist/ssr/Layout"
import { Question } from "@phosphor-icons/react/dist/ssr/Question"
import { CaretUpDown } from "@phosphor-icons/react/dist/ssr/CaretUpDown"
import { SignOut } from "@phosphor-icons/react/dist/ssr/SignOut"
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { User } from "@phosphor-icons/react/dist/ssr/User"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUser } from "@/hooks/use-user"
import { signOut } from "@/lib/actions/auth"
import { getUnreadCount } from "@/lib/actions/inbox"
import { usePooledProjectsRealtime, usePooledInboxRealtime } from "@/hooks/realtime-context"
import { useOrganization } from "@/hooks/use-organization"
import type { Project } from "@/lib/supabase/types"
import { useCommandPalette } from "@/components/command-palette"
import { useSettingsDialog } from "@/components/providers/settings-dialog-provider"
import { cn } from "@/lib/utils"
import { PROGRESS_THRESHOLDS, BADGE_CAP, SIDEBAR_PROJECT_LIMIT } from "@/lib/constants"

// Navigation items defined inline (no mock data dependency)
type NavItemId = "inbox" | "my-tasks" | "projects" | "clients" | "chat"
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
]

const footerItems: FooterItem[] = [
  { id: "settings", label: "Settings" },
  { id: "templates", label: "Templates" },
  { id: "help", label: "Help" },
]

// Color palette for projects based on progress
const getProjectColor = (progress: number): string => {
  if (progress >= PROGRESS_THRESHOLDS.high) return "var(--chart-1)" // green-ish for near completion
  if (progress >= PROGRESS_THRESHOLDS.medium) return "var(--chart-3)" // yellow-ish for mid-progress
  if (progress >= PROGRESS_THRESHOLDS.low) return "var(--chart-5)" // blue-ish for early progress
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
}

const footerItemIcons: Record<SidebarFooterItemId, React.ComponentType<{ className?: string }>> = {
  settings: Gear,
  templates: Layout,
  help: Question,
}

// Memoized nav item icon component to avoid IIFE in render
const NavItemIcon = memo(function NavItemIcon({ id }: { id: NavItemId }) {
  const Icon = navItemIcons[id]
  return Icon ? <Icon className="h-[18px] w-[18px]" /> : null
})

// Memoized project item to prevent re-renders when other projects change
const ProjectMenuItem = memo(function ProjectMenuItem({
  project,
  onPrefetch,
}: {
  project: Project
  onPrefetch: (href: string) => void
}) {
  const href = `/projects/${project.id}`

  // Combined handler: preload component code + prefetch RSC payload
  const handleHover = useCallback(() => {
    preloadProjectDetails()
    onPrefetch(href)
  }, [href, onPrefetch])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="h-9 rounded-lg px-3 group">
        <Link
          href={href}
          prefetch={false}
          onMouseEnter={handleHover}
          onFocus={handleHover}
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
  const router = useRouter()
  const { profile, user } = useUser()
  const { organization } = useOrganization()
  const { open: openCommandPalette } = useCommandPalette()
  const { openSettings } = useSettingsDialog()
  const [unreadCount, setUnreadCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>(activeProjects)

  // Sync with server props when they change (e.g. on navigation/revalidation)
  useEffect(() => {
    setProjects(activeProjects)
  }, [activeProjects])

  // Real-time updates for sidebar projects
  usePooledProjectsRealtime(organization?.id, {
    onInsert: (project) => {
      if (project.status === "active") {
        setProjects((prev) => {
          // Avoid duplicates
          if (prev.some((p) => p.id === project.id)) return prev
          // Add to front (most recently updated), cap at limit
          return [project as Project, ...prev].slice(0, SIDEBAR_PROJECT_LIMIT)
        })
      }
    },
    onUpdate: (project, oldProject) => {
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === project.id)

        if (project.status === "active") {
          if (exists) {
            // Update in place
            return prev.map((p) => (p.id === project.id ? (project as Project) : p))
          }
          // Newly active — add to front, cap at limit
          return [project as Project, ...prev].slice(0, SIDEBAR_PROJECT_LIMIT)
        }

        // No longer active — remove from list
        if (exists) {
          return prev.filter((p) => p.id !== project.id)
        }
        return prev
      })
    },
    onDelete: (oldProject) => {
      setProjects((prev) => prev.filter((p) => p.id !== oldProject.id))
    },
  })

  // Hover-based prefetch callback - more bandwidth-efficient than viewport prefetching
  // Only prefetches when user shows intent by hovering
  const handlePrefetch = useCallback((href: string) => {
    router.prefetch(href)
  }, [router])

  // Fetch initial unread count - deferred to not block hydration
  useEffect(() => {
    const fetchCount = async () => {
      const { data } = await getUnreadCount()
      if (data !== undefined) {
        startTransition(() => setUnreadCount(data))
      }
    }

    if ("requestIdleCallback" in globalThis) {
      const id = globalThis.requestIdleCallback(() => { fetchCount() }, { timeout: 3000 })
      return () => globalThis.cancelIdleCallback(id)
    }
    const id = setTimeout(fetchCount, 100)
    return () => clearTimeout(id)
  }, [])

  // Real-time updates for inbox (pooled — shares WebSocket with other subscriptions)
  usePooledInboxRealtime(user?.id, {
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
    if (id === "projects") return "/projects"
    if (id === "inbox") return "/inbox"
    if (id === "clients") return "/clients"
    if (id === "chat") return "/chat"
    return "#"
  }

  const isItemActive = (id: NavItemId): boolean => {
    if (id === "projects") {
      return pathname.startsWith("/projects")
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
          <button className="rounded-md p-1 hover:bg-accent" aria-label="Switch workspace">
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
                        onMouseEnter={() => {
                          preloadHandlers[item.id]()
                          handlePrefetch(href)
                        }}
                        onFocus={() => {
                          preloadHandlers[item.id]()
                          handlePrefetch(href)
                        }}
                      >
                        <NavItemIcon id={item.id} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.id === "inbox" && (
                      <SidebarMenuBadge
                        className={cn(
                          "rounded-full px-2 transition-opacity",
                          unreadCount > 0
                            ? "bg-muted text-muted-foreground opacity-100"
                            : "opacity-0 pointer-events-none"
                        )}
                        aria-hidden={unreadCount === 0}
                      >
                        {unreadCount > 0 ? (unreadCount > BADGE_CAP ? `${BADGE_CAP}+` : unreadCount) : "0"}
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
              {projects.length > 0 ? (
                projects.map((project) => (
                  <ProjectMenuItem key={project.id} project={project} onPrefetch={handlePrefetch} />
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mt-2 flex w-full items-center gap-3 rounded-lg p-2 hover:bg-accent cursor-pointer text-left transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage src={getOptimizedAvatarUrl(profile?.avatar_url, 64) || "/avatar-profile.jpg"} alt={profile?.full_name || "User avatar"} />
                <AvatarFallback>
                  {profile?.full_name
                    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                    : user?.email?.slice(0, 2).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col min-w-0">
                <span className="text-sm font-medium truncate">
                  {profile?.full_name || user?.email?.split("@")[0] || "User"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user?.email || ""}
                </span>
              </div>
              <CaretUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {profile?.full_name || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || ""}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSettings()}>
              <User className="h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await signOut()
              }}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <SignOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
