import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { getAIContext } from "@/lib/actions/ai-context"

export default async function Page() {
  // Fetch auth, orgs, and AI context in parallel
  const [userResult, orgsResult, contextResult] = await Promise.all([
    cachedGetUser(),
    cachedGetUserOrganizations(),
    getAIContext(),
  ])

  const { user, error: authError } = userResult

  if (authError || !user) {
    redirect("/login")
  }

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const orgId = orgsResult.data[0].id

  return (
    <ChatPageContent
      organizationId={orgId}
      conversationId={null}
      initialMessages={[]}
      initialContext={contextResult.data ?? undefined}
    />
  )
}
