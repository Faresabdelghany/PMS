export type NavItem = {
    id: string
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
    id: string
    label: string
}

export const navItems: NavItem[] = [
    { id: "inbox", label: "Inbox", badge: 24 },
    { id: "my-tasks", label: "My task" },
    { id: "projects", label: "Projects", isActive: true },
    { id: "clients", label: "Clients" },
    { id: "performance", label: "Performance" },
]

export const activeProjects: ActiveProjectSummary[] = [
    { id: "ai-learning", name: "AI Learning Platform", color: "#EF4444", progress: 25 },
    { id: "fintech-app", name: "Fintech Mobile App", color: "#F97316", progress: 80 },
    { id: "ecommerce-admin", name: "E-commerce Admin", color: "#22C55E", progress: 65 },
    { id: "healthcare-app", name: "Healthcare Booking App", color: "#94A3B8", progress: 10 },
]

export const footerItems: SidebarFooterItem[] = [
    { id: "settings", label: "Settings" },
    { id: "templates", label: "Templates" },
    { id: "help", label: "Help" },
]
