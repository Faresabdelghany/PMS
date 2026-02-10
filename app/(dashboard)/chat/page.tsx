import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { getCachedAIConfigured } from "@/lib/server-cache"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

export const metadata: Metadata = {
  title: "Chat - PMS",
}

async function ChatContent() {
  // Fetch auth, orgs, and AI config check in parallel
  // AI config pre-check eliminates client-side SWR roundtrip for LCP
  const [userResult, orgsResult, aiConfigResult] = await Promise.all([
    cachedGetUser(),
    cachedGetUserOrganizations(),
    getCachedAIConfigured(),
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
      initialAIConfigured={aiConfigResult.data ?? false}
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
