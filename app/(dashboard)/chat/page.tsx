import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser } from "@/lib/request-cache"
import { getCachedAIConfigured, getCachedActiveOrgFromKV } from "@/lib/server-cache"
import { getConversations } from "@/lib/actions/conversations"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

export const metadata: Metadata = {
  title: "Chat - PMS",
}

async function ChatContent() {
  // Fetch auth, org, AI config, and conversations in parallel
  // Server-fetching conversations eliminates client-side CLS from sidebar loading
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

  // Fetch conversations after auth check (needs authenticated user)
  const conversationsResult = await getConversations(orgId)

  return (
    <ChatPageContent
      organizationId={orgId}
      conversationId={null}
      initialMessages={[]}
      initialAIConfigured={aiConfigResult.data ?? false}
      initialConversations={conversationsResult.data ?? []}
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
