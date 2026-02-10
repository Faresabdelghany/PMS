"use server"

import { cachedGetUser } from "@/lib/request-cache"
import { rateLimiters, checkRateLimit, rateLimitError } from "@/lib/rate-limit/limiter"
import { buildChatSystemPrompt } from "../ai-helpers"
import type { ActionResult } from "../types"
import type { ChatContext, ProposedAction, SuggestedAction } from "../ai-types"
import type { AIGenerationResult, ChatMessage, ChatResponse } from "./types"
import { verifyAIConfig } from "./config"
import {
  callOpenAIChat,
  callAnthropicChat,
  callGeminiChat,
  callGroqChat,
  callMistralChat,
  callXAIChat,
  callDeepSeekChat,
  callOpenRouterChat,
} from "./chat-providers"

// Chat completion function
export async function sendChatMessage(
  messages: ChatMessage[],
  context: ChatContext
): Promise<ActionResult<ChatResponse>> {
  const configResult = await verifyAIConfig()
  if (configResult.error) {
    return { error: configResult.error }
  }

  // Use cached auth - deduplicates with other calls in the same request
  const { user } = await cachedGetUser()

  if (user) {
    const dailyLimit = await checkRateLimit(rateLimiters.ai, user.id)
    if (!dailyLimit.success) {
      return rateLimitError(dailyLimit.reset)
    }
    const concurrentLimit = await checkRateLimit(rateLimiters.aiConcurrent, user.id)
    if (!concurrentLimit.success) {
      return rateLimitError(concurrentLimit.reset)
    }
  }

  const systemPrompt = buildChatSystemPrompt(context)
  const userMessages = messages.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }))

  const { apiKey, provider, model } = configResult.data!

  let result: ActionResult<AIGenerationResult>

  switch (provider) {
    case "openai":
      result = await callOpenAIChat(apiKey, model, systemPrompt, userMessages)
      break
    case "anthropic":
      result = await callAnthropicChat(apiKey, model, systemPrompt, userMessages)
      break
    case "google":
      result = await callGeminiChat(apiKey, model, systemPrompt, userMessages)
      break
    case "groq":
      result = await callGroqChat(apiKey, model, systemPrompt, userMessages)
      break
    case "mistral":
      result = await callMistralChat(apiKey, model, systemPrompt, userMessages)
      break
    case "xai":
      result = await callXAIChat(apiKey, model, systemPrompt, userMessages)
      break
    case "deepseek":
      result = await callDeepSeekChat(apiKey, model, systemPrompt, userMessages)
      break
    case "openrouter":
      result = await callOpenRouterChat(apiKey, model, systemPrompt, userMessages)
      break
    default:
      return { error: `Unsupported AI provider: ${provider}` }
  }

  if (result.error) {
    return { error: result.error }
  }

  return parseChatResponse(result.data!.text)
}

/**
 * Extract a trailing JSON block from content after a given marker.
 * Uses string indexOf + JSON.parse instead of regex to avoid
 * ReDoS (super-linear backtracking) from patterns like [\s\S]*? (S5852).
 */
function extractJsonSuffix(
  content: string,
  marker: string
): { parsed: unknown; rest: string } | null {
  const idx = content.lastIndexOf(marker)
  if (idx === -1) return null
  const jsonStr = content.substring(idx + marker.length).trim()
  if (!jsonStr) return null
  try {
    const parsed = JSON.parse(jsonStr)
    return { parsed, rest: content.substring(0, idx).trim() }
  } catch {
    return null
  }
}

function parseChatResponse(text: string): ActionResult<ChatResponse> {
  let content = text
  let actions: ProposedAction[] | undefined
  let action: ProposedAction | undefined
  let suggestedActions: SuggestedAction[] | undefined

  // Extract SUGGESTED_ACTIONS: [...] from end of content
  const suggestionsResult = extractJsonSuffix(content, "SUGGESTED_ACTIONS:")
  if (suggestionsResult && Array.isArray(suggestionsResult.parsed)) {
    suggestedActions = suggestionsResult.parsed as SuggestedAction[]
    content = suggestionsResult.rest
  }

  // Extract ACTIONS_JSON: [...] from end of content
  const actionsResult = extractJsonSuffix(content, "ACTIONS_JSON:")
  if (actionsResult && Array.isArray(actionsResult.parsed)) {
    actions = actionsResult.parsed as ProposedAction[]
    content = actionsResult.rest
    return { data: { content, actions, suggestedActions } }
  }

  // Extract ACTION_JSON: {...} from end of content
  const actionResult = extractJsonSuffix(content, "ACTION_JSON:")
  if (
    actionResult &&
    typeof actionResult.parsed === "object" &&
    actionResult.parsed !== null &&
    !Array.isArray(actionResult.parsed)
  ) {
    action = actionResult.parsed as ProposedAction
    content = actionResult.rest
    return { data: { content, action, suggestedActions } }
  }

  return { data: { content, suggestedActions } }
}
