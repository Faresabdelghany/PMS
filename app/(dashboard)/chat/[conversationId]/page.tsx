import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { getConversationWithMessages } from "@/lib/actions/conversations"
import { getCachedAIContext } from "@/lib/server-cache"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

type PageProps = {
  params: Promise<{ conversationId: string }>
}

async function ChatContent({ conversationId }: { conversationId: string }) {
  // Fetch auth, orgs, conversation+messages (single RPC), and AI context in parallel (all request-level cached)
  const [userResult, orgsResult, convResult, contextResult] = await Promise.all([
    cachedGetUser(),
    cachedGetUserOrganizations(),
    getConversationWithMessages(conversationId),
    getCachedAIContext(),
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
  if (convResult.error || !convResult.data?.conversation) {
    redirect("/chat")
  }

  return (
    <ChatPageContent
      organizationId={orgId}
      conversationId={conversationId}
      conversation={convResult.data.conversation}
      initialMessages={convResult.data.messages ?? []}
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
