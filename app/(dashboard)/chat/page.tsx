import type { Metadata } from "next"
import { Suspense } from "react"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { getPageOrganization } from "@/lib/page-auth"
import { getCachedAIConfigured, getCachedConversations } from "@/lib/server-cache"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

export const metadata: Metadata = {
  title: "Chat - PMS",
}

async function ChatContent() {
  const { orgId } = await getPageOrganization()

  // Fetch conversations and AI config in parallel
  const [conversationsResult, aiConfigResult] = await Promise.all([
    getCachedConversations(orgId),
    getCachedAIConfigured(),
  ])

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
