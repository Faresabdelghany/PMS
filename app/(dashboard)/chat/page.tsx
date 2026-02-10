import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser } from "@/lib/request-cache"
import { getCachedAIConfigured, getCachedActiveOrgFromKV } from "@/lib/server-cache"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

export const metadata: Metadata = {
  title: "Chat - PMS",
}

async function ChatContent() {
  // Fetch auth, org, and AI config check in parallel
  // AI config pre-check eliminates client-side SWR roundtrip for LCP
  const [userResult, org, aiConfigResult] = await Promise.all([
    cachedGetUser(),
    getCachedActiveOrgFromKV(),
    getCachedAIConfigured(),
  ])

  const { user, error: authError } = userResult

  if (authError || !user) {
    redirect("/login")
  }

  if (!org) {
    redirect("/onboarding")
  }

  const orgId = org.id

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
