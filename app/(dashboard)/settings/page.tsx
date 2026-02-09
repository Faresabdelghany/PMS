import { redirect } from "next/navigation"

// Server-side redirect — opens settings dialog on /inbox via URL param
// (SettingsDialogProvider handles ?settings= param automatically)
export default function SettingsPage() {
  redirect("/inbox?settings=account")
}
