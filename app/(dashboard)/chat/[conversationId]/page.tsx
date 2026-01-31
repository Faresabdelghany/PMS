import { redirect } from "next/navigation"
import { ChatPageContent } from "@/components/ai/chat-page-content"
import { cachedGetUser, cachedGetUserOrganizations } from "@/lib/request-cache"
import { getConversation, getConversationMessages } from "@/lib/actions/conversations"

type PageProps = {
  params: Promise<{ conversationId: string }>
}

export default async function Page({ params }: PageProps) {
  const { conversationId } = await params

  // Use cached auth - shared with layout (no duplicate DB hit)
  const { user, error: authError } = await cachedGetUser()

  if (authError || !user) {
    redirect("/login")
  }

  // Use cached orgs - shared with layout (no duplicate DB hit)
  const orgsResult = await cachedGetUserOrganizations()

  if (orgsResult.error || !orgsResult.data?.length) {
    redirect("/onboarding")
  }

  const orgId = orgsResult.data[0].id

  // Fetch conversation and messages in parallel
  const [conversationResult, messagesResult] = await Promise.all([
    getConversation(conversationId),
    getConversationMessages(conversationId),
  ])

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
