"use server"

import { getDecryptedApiKey, getAISettings } from "../user-settings"
import type { ActionResult } from "../types"
import { getDefaultModel } from "./utils"

// Verify AI is configured (exported for streaming API route)
export async function verifyAIConfig(): Promise<
  ActionResult<{ apiKey: string; provider: string; model: string }>
> {
  const settingsResult = await getAISettings()
  if (settingsResult.error) {
    return { error: settingsResult.error }
  }

  if (!settingsResult.data?.ai_provider) {
    return { error: "AI provider not configured. Please configure AI settings first." }
  }

  const apiKeyResult = await getDecryptedApiKey()
  if (apiKeyResult.error) {
    return { error: apiKeyResult.error }
  }

  if (!apiKeyResult.data) {
    return { error: "AI API key not configured. Please add your API key in settings." }
  }

  return {
    data: {
      apiKey: apiKeyResult.data,
      provider: settingsResult.data.ai_provider,
      model: settingsResult.data.ai_model_preference || getDefaultModel(settingsResult.data.ai_provider),
    },
  }
}
