// Sidebar types - navigation items are now defined inline in app-sidebar.tsx
// Active projects are fetched from Supabase

export type NavItemId = "inbox" | "my-tasks" | "projects" | "clients" | "performance"

export type SidebarFooterItemId = "settings" | "templates" | "help"

export type NavItem = {
    id: NavItemId
    label: string
    badge?: number
    isActive?: boolean
}

export type ActiveProjectSummary = {
    id: string
    name: string
    color: string
    progress: number
}

export type SidebarFooterItem = {
    id: SidebarFooterItemId
    label: string
}
