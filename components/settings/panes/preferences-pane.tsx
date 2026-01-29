"use client"

import { useState, useEffect, useTransition } from "react"
import { useTheme } from "next-themes"
import { Copy, Check } from "@phosphor-icons/react/dist/ssr"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { SettingsPaneHeader, SettingSection, SettingRow } from "../setting-primitives"
import { useOrganization } from "@/hooks/use-organization"
import { getPreferences, savePreferences, type UserSettingsWithPreferences } from "@/lib/actions/user-settings"
import { toast } from "sonner"

const TIMEZONES = [
  { value: "auto", label: "Auto-detect" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York, America" },
  { value: "America/Los_Angeles", label: "Los Angeles, America" },
  { value: "America/Chicago", label: "Chicago, America" },
  { value: "Europe/London", label: "London, Europe" },
  { value: "Europe/Paris", label: "Paris, Europe" },
  { value: "Europe/Berlin", label: "Berlin, Europe" },
  { value: "Asia/Tokyo", label: "Tokyo, Asia" },
  { value: "Asia/Shanghai", label: "Shanghai, Asia" },
  { value: "Asia/Dubai", label: "Dubai, Asia" },
  { value: "Australia/Sydney", label: "Sydney, Australia" },
]

export function PreferencesPane() {
  const { organization } = useOrganization()
  const { theme, setTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Preference state
  const [preferences, setPreferences] = useState<UserSettingsWithPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load preferences on mount
  useEffect(() => {
    setIsMounted(true)
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    const result = await getPreferences()
    if (result.data) {
      setPreferences(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const handleCopyId = async () => {
    if (!organization?.id) return
    try {
      await navigator.clipboard.writeText(organization.id)
      setCopied(true)
    } catch (err) {
      console.error(err)
    }
  }

  const handlePreferenceChange = (key: keyof UserSettingsWithPreferences, value: any) => {
    if (!preferences) return

    const updated = { ...preferences, [key]: value }
    setPreferences(updated)

    startTransition(async () => {
      const result = await savePreferences({ [key]: value })
      if (result.error) {
        toast.error(result.error)
        // Revert on error
        setPreferences(preferences)
      }
    })
  }

  const workspaceName = organization?.name || "My Workspace"
  const workspaceId = organization?.id || ""

  return (
    <div className="space-y-8">
      <SettingsPaneHeader
        title="Preferences"
        description="Manage your workspace details, and set global workspace preferences."
      />

      <SettingSection title="Information">
        <SettingRow label="Workspace" description="This is the name shown across the workspace.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-inner">
              <span className="text-xl font-bold">{workspaceName[0]?.toUpperCase()}</span>
            </div>
            <Input value={workspaceName} readOnly className="h-9 text-sm flex-1" />
          </div>
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Workspace">
        <SettingRow label="Workspace ID" description="Use this ID when connecting integrations.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={workspaceId} className="font-mono text-sm" />
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleCopyId}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Appearance">
        <SettingRow label="Theme">
          <Select
            value={isMounted ? theme ?? "system" : "system"}
            onValueChange={(value) => setTheme(value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System default</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Open links in app"
          description="When you click a link to the app, open it in the app if possible."
        >
          <Switch
            checked={preferences?.open_links_in_app ?? true}
            onCheckedChange={(checked) => handlePreferenceChange("open_links_in_app", checked)}
            disabled={isLoading || isPending}
          />
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Location and time">
        <SettingRow label="Timezone">
          <Select
            value={preferences?.timezone ?? "auto"}
            onValueChange={(value) => handlePreferenceChange("timezone", value)}
            disabled={isLoading || isPending}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Start weeks on" description="The first day of the week in your calendars.">
          <Select
            value={preferences?.week_start_day ?? "monday"}
            onValueChange={(value) => handlePreferenceChange("week_start_day", value)}
            disabled={isLoading || isPending}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monday">Monday</SelectItem>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="saturday">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
