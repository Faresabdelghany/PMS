"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSettingsDialog } from "@/components/providers/settings-dialog-provider"
import { Loader2 } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const { openSettings } = useSettingsDialog()

  useEffect(() => {
    openSettings("account")
    router.replace("/inbox")
  }, [openSettings, router])

  return (
    <div className="flex flex-1 items-center justify-center min-h-0">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
