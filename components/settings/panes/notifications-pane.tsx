"use client"

import { useState, useEffect, useTransition } from "react"
import { Star, PencilSimple } from "@phosphor-icons/react/dist/ssr"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { SettingsPaneHeader } from "../setting-primitives"
import { cn } from "@/lib/utils"
import { getPreferences, saveNotificationSettings, type UserSettingsWithPreferences } from "@/lib/actions/user-settings"
import { toast } from "sonner"

const detailCards = [
  {
    id: "recommended",
    title: "Recommended settings",
    description: "Stick with defaults so you never miss an important update and avoid spam.",
    icon: Star,
    highlighted: true,
  },
  {
    id: "custom",
    title: "Custom settings",
    description: "Fine-tune notifications to only receive updates you care about.",
    icon: PencilSimple,
    highlighted: false,
  },
] as const

export function NotificationsPane() {
  const [preferences, setPreferences] = useState<UserSettingsWithPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    const result = await getPreferences()
    if (result.data) {
      setPreferences(result.data)
    }
    setIsLoading(false)
  }

  const handleToggle = (key: "notifications_in_app" | "notifications_email", checked: boolean) => {
    if (!preferences) return

    const updated = { ...preferences, [key]: checked }
    setPreferences(updated)

    startTransition(async () => {
      const result = await saveNotificationSettings({ [key]: checked })
      if (result.error) {
        toast.error(result.error)
        setPreferences(preferences)
      }
    })
  }

  const methodItems = [
    {
      id: "in-app" as const,
      key: "notifications_in_app" as const,
      title: "In-app",
      description: "Notifications will go into your Inbox",
      enabled: preferences?.notifications_in_app ?? true,
    },
    {
      id: "email" as const,
      key: "notifications_email" as const,
      title: "Email",
      description: "You will receive emails about project events",
      enabled: preferences?.notifications_email ?? true,
    },
  ]

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Notifications"
        description="Stay in the loop without the noise. Choose where you get updates, and customize which activities trigger notifications."
      />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Methods</h3>
        <div className="space-y-3">
          {methodItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </div>
              <Switch
                checked={item.enabled}
                onCheckedChange={(checked) => handleToggle(item.key, checked)}
                disabled={isLoading || isPending}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Details</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {detailCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={cn(
                "flex flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition shadow-sm",
                card.highlighted
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-border bg-card/60 text-foreground hover:border-border/80"
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    card.highlighted ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <card.icon className="h-4 w-4" />
                </span>
                {card.title}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
