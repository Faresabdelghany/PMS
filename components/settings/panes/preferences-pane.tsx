"use client"

import { useState, useEffect } from "react"
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

export function PreferencesPane() {
  const { organization } = useOrganization()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [isMounted, setIsMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

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
          <Switch defaultChecked />
        </SettingRow>
      </SettingSection>

      <Separator />

      <SettingSection title="Location and time">
        <SettingRow label="Timezone">
          <Select defaultValue="auto">
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="utc">UTC</SelectItem>
              <SelectItem value="america-new_york">New York, America</SelectItem>
              <SelectItem value="america-los_angeles">Los Angeles, America</SelectItem>
              <SelectItem value="europe-london">London, Europe</SelectItem>
              <SelectItem value="asia-tokyo">Tokyo, Asia</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Start weeks on" description="The first day of the week in your calendars.">
          <Select defaultValue="monday">
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
