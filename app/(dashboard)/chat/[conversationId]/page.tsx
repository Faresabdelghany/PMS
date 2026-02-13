import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { getConversationWithMessages, getConversations } from "@/lib/actions/conversations"
import { getPageOrganization } from "@/lib/page-auth"
import { getCachedAIConfigured } from "@/lib/server-cache"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

type PageProps = {
  params: Promise<{ conversationId: string }>
}

async function ChatContent({ conversationId }: { conversationId: string }) {
  const { orgId } = await getPageOrganization()

  // Fetch conversation, AI config, and conversations list in parallel
  const [convResult, aiConfigResult, conversationsResult] = await Promise.all([
    getConversationWithMessages(conversationId),
    getCachedAIConfigured(),
    getConversations(orgId),
  ])

  // If conversation not found, redirect to new chat
  if (convResult.error || !convResult.data?.conversation) {
    redirect("/chat")
  }

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
