import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser } from "@/lib/request-cache"
import { getConversationWithMessages, getConversations } from "@/lib/actions/conversations"
import { getCachedAIConfigured, getCachedActiveOrgFromKV } from "@/lib/server-cache"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

type PageProps = {
  params: Promise<{ conversationId: string }>
}

async function ChatContent({ conversationId }: { conversationId: string }) {
  // Fetch auth, org, conversation+messages, and AI config in parallel
  // AI config pre-check eliminates client-side SWR roundtrip for LCP
  const [userResult, org, convResult, aiConfigResult] = await Promise.all([
    cachedGetUser(),
    getCachedActiveOrgFromKV(),
    getConversationWithMessages(conversationId),
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

  // If conversation not found, redirect to new chat
  if (convResult.error || !convResult.data?.conversation) {
    redirect("/chat")
  }

  // Server-fetch conversations to eliminate sidebar CLS
  const conversationsResult = await getConversations(orgId)

  return (
    <ChatPageContent
      organizationId={orgId}
      conversationId={conversationId}
      conversation={convResult.data.conversation}
      initialMessages={convResult.data.messages ?? []}
      initialAIConfigured={aiConfigResult.data ?? false}
      initialConversations={conversationsResult.data ?? []}
    />
  )
}

export default async function Page({ params }: PageProps) {
  const { conversationId } = await params

  return (
    <Suspense fallback={<ChatPageSkeleton showMessages />}>
      <ChatContent conversationId={conversationId} />
    </Suspense>
  )
}
