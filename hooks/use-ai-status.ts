"use client"

import { useEffect, useState, useCallback } from "react"
import { hasAIConfigured, getAISettings } from "@/lib/actions/user-settings"

export type AIStatusResult = {
  isConfigured: boolean
  isLoading: boolean
  provider: string | null
  model: string | null
  refetch: () => Promise<void>
}

export function useAIStatus(): AIStatusResult {
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [provider, setProvider] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const [configResult, settingsResult] = await Promise.all([
        hasAIConfigured(),
        getAISettings(),
      ])

      setIsConfigured(configResult.data ?? false)
      if (settingsResult.data) {
        setProvider(settingsResult.data.ai_provider)
        setModel(settingsResult.data.ai_model_preference)
      }
    } catch {
      setIsConfigured(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return {
    isConfigured,
    isLoading,
    provider,
    model,
    refetch: fetchStatus,
  }
}
