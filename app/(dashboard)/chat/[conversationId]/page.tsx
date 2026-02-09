import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { getConversationWithMessages } from "@/lib/actions/conversations"
import { ChatPageSkeleton } from "@/components/skeletons/chat-skeletons"

type PageProps = {
  params: Promise<{ conversationId: string }>
}

async function ChatContent({ conversationId }: { conversationId: string }) {
  // Fetch auth, orgs, and conversation+messages in parallel
  // AI context is loaded client-side to avoid blocking LCP
  const [userResult, orgsResult, convResult] = await Promise.all([
    cachedGetUser(),
    cachedGetUserOrganizations(),
    getConversationWithMessages(conversationId),
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
