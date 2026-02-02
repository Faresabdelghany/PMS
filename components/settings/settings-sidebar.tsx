"use client"

import {
  UserCircle,
  Bell,
  SlidersHorizontal,
  UsersThree,
  ShieldCheck,
  SquaresFour,
  CreditCard,
  UploadSimple,
  Robot,
  Sparkle,
  Tag,
  Bookmark,
} from "@phosphor-icons/react/dist/ssr"
import { cn } from "@/lib/utils"

export type SettingsItemId =
  | "account"
  | "notifications"
  | "preferences"
  | "teammates"
  | "identity"
  | "types"
  | "tags"
  | "labels"
  | "billing"
  | "import"
  | "agents"
  | "skills"

const settingsSections = [
  {
    id: "personal",
    label: "Personal",
    items: [
      { id: "account" as const, label: "Account" },
      { id: "notifications" as const, label: "Notifications" },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "preferences" as const, label: "Preferences" },
      { id: "teammates" as const, label: "Teammates" },
      { id: "identity" as const, label: "Identity" },
      { id: "types" as const, label: "Types" },
      { id: "tags" as const, label: "Tags" },
      { id: "labels" as const, label: "Labels" },
      { id: "billing" as const, label: "Plans and billing" },
      { id: "import" as const, label: "Import" },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      { id: "agents" as const, label: "Agents" },
      { id: "skills" as const, label: "Skills" },
    ],
  },
] as const

const settingsItemIcons: Record<SettingsItemId, React.ComponentType<{ className?: string; weight?: "regular" | "bold" | "fill" }>> = {
  account: UserCircle,
  notifications: Bell,
  preferences: SlidersHorizontal,
  teammates: UsersThree,
  identity: ShieldCheck,
  types: SquaresFour,
  tags: Tag,
  labels: Bookmark,
  billing: CreditCard,
  import: UploadSimple,
  agents: Robot,
  skills: Sparkle,
}

interface SettingsSidebarProps {
  activeItemId: SettingsItemId
  onItemSelect: (itemId: SettingsItemId) => void
}

export function SettingsSidebar({ activeItemId, onItemSelect }: SettingsSidebarProps) {
  return (
    <aside className="w-full border-b border-border/60 bg-muted/40 px-4 py-4 sm:w-64 sm:border-b-0 sm:border-r sm:py-6">
      <nav className="space-y-4 text-sm">
        {settingsSections.map((section) => (
          <div key={section.id} className="space-y-1.5">
            <div className="px-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.id === activeItemId
                const Icon = settingsItemIcons[item.id]
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemSelect(item.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      isActive && "bg-accent text-foreground font-medium"
                    )}
                  >
                    <Icon className="h-4 w-4" weight={isActive ? "fill" : "regular"} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

export { settingsSections }
