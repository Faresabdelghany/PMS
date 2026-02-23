"use client"

import type { ReactNode } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
}

/**
 * Reusable page header that matches the Projects / Clients top-bar pattern.
 *
 * - `title`       — page title shown next to the sidebar trigger
 * - `description` — optional subtitle (accepted but intentionally omitted from
 *                   the compact header bar to stay consistent with the reference)
 * - `actions`     — optional ReactNode rendered on the right (buttons, links…)
 * - `children`    — optional secondary row rendered below the main bar
 *                   (use for filter bars, search inputs, tab lists, etc.)
 */
export function PageHeader({ title, actions, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent text-muted-foreground" />
          <p className="text-base font-medium text-foreground">{title}</p>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children && (
        <div className="px-4 py-3">
          {children}
        </div>
      )}
    </header>
  )
}
