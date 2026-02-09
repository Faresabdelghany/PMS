import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { getConversation, getConversationMessages } from "@/lib/actions/conversations"
import { getAIContext } from "@/lib/actions/ai-context"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

type PageProps = {
  params: Promise<{ conversationId: string }>
}

async function ChatContent({ conversationId }: { conversationId: string }) {
  // Fetch auth, orgs, conversation, messages, and AI context in parallel
  const [userResult, orgsResult, conversationResult, messagesResult, contextResult] = await Promise.all([
    cachedGetUser(),
    cachedGetUserOrganizations(),
    getConversation(conversationId),
    getConversationMessages(conversationId),
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

  // If conversation not found, redirect to new chat
  if (conversationResult.error || !conversationResult.data) {
    redirect("/chat")
  }

  return (
    <ChatPageContent
      organizationId={orgId}
      conversationId={conversationId}
      conversation={conversationResult.data}
      initialMessages={messagesResult.data ?? []}
      initialContext={contextResult.data ?? undefined}
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
