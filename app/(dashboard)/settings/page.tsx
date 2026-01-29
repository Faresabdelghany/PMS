"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSettingsDialog } from "@/components/providers/settings-dialog-provider"
import { Loader2 } from "lucide-react"

// Map URL paths to settings dialog sections
const pathToSection: Record<string, string> = {
  "/settings": "account",
  "/settings/profile": "account",
  "/settings/ai": "agents",
  "/settings/organization": "teammates",
  "/settings/tags": "tags",
  "/settings/labels": "types",
}

export default function SettingsPage() {
  const router = useRouter()
  const { openSettings } = useSettingsDialog()

  useEffect(() => {
    // Determine which section to open based on the path
    const path = window.location.pathname
    const section = pathToSection[path] || "account"

    // Open the settings dialog with the appropriate section
    openSettings(section as Parameters<typeof openSettings>[0])

    // Redirect to the projects page (home)
    router.replace("/")
  }, [openSettings, router])

  // Show a brief loading state while redirecting
  return (
    <div className="flex flex-1 items-center justify-center min-h-0">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
