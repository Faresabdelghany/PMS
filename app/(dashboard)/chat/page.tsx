import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"

export default async function Page() {
  // Use cached auth - shared with layout (no duplicate DB hit)
  const { user, error: authError } = await cachedGetUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const orgId = orgsResult.data[0].id

  return (
    <ChatPageContent
      organizationId={orgId}
      conversationId={null}
      initialMessages={[]}
    />
  )
}
