import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

async function ChatContent() {
  // Fetch auth and orgs only — AI context is loaded client-side to avoid blocking LCP
  const [userResult, orgsResult] = await Promise.all([
    cachedGetUser(),
    cachedGetUserOrganizations(),
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
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <ChatContent />
    </Suspense>
  )
}
