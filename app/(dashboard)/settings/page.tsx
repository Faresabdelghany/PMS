import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Settings - PMS",
}

// Server-side redirect — opens settings dialog on /inbox via URL param
// (SettingsDialogProvider handles ?settings= param automatically)
export default function SettingsPage() {
  redirect("/inbox?settings=account")
}
