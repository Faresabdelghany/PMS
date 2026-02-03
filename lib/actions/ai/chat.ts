"use server"

import { createClient } from "@/lib/supabase/server"
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

function parseChatResponse(text: string): ActionResult<ChatResponse> {
  let content = text
  let actions: ProposedAction[] | undefined
  let action: ProposedAction | undefined
  let suggestedActions: SuggestedAction[] | undefined

  // Try to match suggested actions (SUGGESTED_ACTIONS: [...])
  const suggestionsMatch = content.match(/SUGGESTED_ACTIONS:\s*(\[[\s\S]*?\])(?=\s*$|\s*\n|$)/m)
  if (suggestionsMatch) {
    try {
      suggestedActions = JSON.parse(suggestionsMatch[1]) as SuggestedAction[]
      content = content.replace(/SUGGESTED_ACTIONS:\s*\[[\s\S]*?\](?=\s*$|\s*\n|$)/m, "").trim()
    } catch {
      // Ignore parse errors for suggestions
    }
  }

  // Try to match multiple actions first (ACTIONS_JSON: [...])
  const actionsMatch = content.match(/ACTIONS_JSON:\s*(\[[\s\S]*?\])(?=\s*$|\s*\n|$)/m)
  if (actionsMatch) {
    try {
      actions = JSON.parse(actionsMatch[1]) as ProposedAction[]
      content = content.replace(/ACTIONS_JSON:\s*\[[\s\S]*?\](?=\s*$|\s*\n|$)/m, "").trim()
      return { data: { content, actions, suggestedActions } }
    } catch {
      // Fall through to single action check
    }
  }

  // Try to match single action (ACTION_JSON: {...})
  const actionMatch = content.match(/ACTION_JSON:\s*(\{[\s\S]*?\})(?=\s*$|\s*\n|$)/m)
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]) as ProposedAction
      content = content.replace(/ACTION_JSON:\s*\{[\s\S]*?\}(?=\s*$|\s*\n|$)/m, "").trim()
      return { data: { content, action, suggestedActions } }
    } catch {
      return { data: { content, suggestedActions } }
    }
  }

  return { data: { content, suggestedActions } }
}
