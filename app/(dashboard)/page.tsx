import { redirect } from "next/navigation"

// Root "/" redirects to /inbox (middleware handles this too, but this is a fallback)
export default function Page() {
  redirect("/inbox")
}
