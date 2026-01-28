"use client"

import { createContext, useContext } from "react"
import type { Profile } from "@/lib/supabase/types"

export type UserContextType = {
  user: {
    id: string
    email: string
  } | null
  profile: Profile | null
  isLoading: boolean
  refreshProfile?: () => Promise<void>
}

export const UserContext = createContext<UserContextType | null>(null)

/**
 * Hook to access user context
 * Returns null values if not within UserProvider (for backward compatibility)
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext)
  // Return default values if not within provider (backward compatibility)
  if (!context) {
    return {
      user: null,
      profile: null,
      isLoading: false,
    }
  }
  return context
}
