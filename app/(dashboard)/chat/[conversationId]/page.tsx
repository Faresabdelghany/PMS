import { Suspense } from "react"
import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { getConversation, getConversationMessages } from "@/lib/actions/conversations"
import { Skeleton } from "@/components/ui/skeleton"

type PageProps = {
  params: Promise<{ conversationId: string }>
}

async function ChatContent({ conversationId }: { conversationId: string }) {
  // Fetch auth, orgs, conversation, and messages in parallel
  // All cached functions dedupe with layout, and conversation/messages are independent
  const [userResult, orgsResult, conversationResult, messagesResult] = await Promise.all([
    cachedGetUser(),
    cachedGetUserOrganizations(),
    getConversation(conversationId),
    getConversationMessages(conversationId),
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
    />
  )
}

function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="flex-1 p-4 space-y-4">
        <Skeleton className="h-20 w-3/4" />
        <Skeleton className="h-20 w-3/4 ml-auto" />
        <Skeleton className="h-20 w-3/4" />
      </div>
      <div className="p-4 border-t">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

export default async function Page({ params }: PageProps) {
  const { conversationId } = await params

  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatContent conversationId={conversationId} />
    </Suspense>
  )
}
