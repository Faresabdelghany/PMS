"use client"

import type { ReactNode } from "react"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface SettingSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  id?: string
}

export function SettingSection({ title, description, children, className, id }: SettingSectionProps) {
  return (
    <section id={id} className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

interface SettingRowProps {
  label: string
  description?: string
  children: ReactNode
  className?: string
}

export function SettingRow({ label, description, children, className }: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,250px)_minmax(0,1fr)] sm:items-center sm:gap-6",
        className
      )}
    >
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 text-sm text-foreground">{children}</div>
    </div>
  )
}

interface SettingsPaneHeaderProps {
  title: string
  description?: React.ReactNode
}

export function SettingsPaneHeader({ title, description }: SettingsPaneHeaderProps) {
  return (
    <>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <Separator className="my-6" />
    </>
  )
}

interface PlaceholderPaneProps {
  icon: ReactNode
  title: string
  description: string
}

export function PlaceholderPane({ icon, title, description }: PlaceholderPaneProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-muted-foreground">{icon}</div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">{description}</p>
    </div>
  )
}
