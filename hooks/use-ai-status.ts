"use client"

import useSWR from "swr"
import { hasAIConfigured, getAISettings } from "@/lib/actions/user-settings"
import { SWRKeys, SWRStaleTime } from "@/lib/swr-config"

type AIStatusData = {
  isConfigured: boolean
  provider: string | null
  model: string | null
}

async function fetchAIStatus(): Promise<AIStatusData> {
  const [configResult, settingsResult] = await Promise.all([
    hasAIConfigured(),
    getAISettings(),
  ])

  return {
    isConfigured: configResult.data ?? false,
    provider: settingsResult.data?.ai_provider ?? null,
    model: settingsResult.data?.ai_model_preference ?? null,
  }
}

export type AIStatusResult = {
  isConfigured: boolean
  isLoading: boolean
  provider: string | null
  model: string | null
  refetch: () => Promise<AIStatusData | undefined>
}

/**
 * Hook for AI configuration status with SWR caching.
 * Provides automatic caching, deduplication, and background revalidation.
 */
export function useAIStatus(): AIStatusResult {
  const { data, isLoading, mutate } = useSWR(
    SWRKeys.aiStatus,
    fetchAIStatus,
    {
      // Keep data fresh for 5 minutes before revalidating
      dedupingInterval: SWRStaleTime.aiSettings,
      // Don't retry too aggressively for AI settings
      errorRetryCount: 2,
      // Revalidate when window regains focus
      revalidateOnFocus: true,
    }
  )

  return {
    isConfigured: data?.isConfigured ?? false,
    isLoading,
    provider: data?.provider ?? null,
    model: data?.model ?? null,
    refetch: mutate,
  }
}
