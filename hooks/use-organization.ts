"use client"

import { createContext, useContext } from "react"
import type { Organization } from "@/lib/supabase/types"

export type OrganizationWithRole = Organization & {
  role: "admin" | "member"
}

export type OrganizationContextType = {
  organization: OrganizationWithRole | null
  organizations: OrganizationWithRole[]
  isLoading: boolean
  switchOrganization: (orgId: string) => void
  refreshOrganizations: () => Promise<void>
}

export const OrganizationContext = createContext<OrganizationContextType | null>(null)

/**
 * Hook to access organization context
 * Returns null values if not within OrganizationProvider (for backward compatibility)
 */
export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext)
  // Return default values if not within provider (backward compatibility)
  if (!context) {
    return {
      organization: null,
      organizations: [],
      isLoading: false,
      switchOrganization: () => {},
      refreshOrganizations: async () => {},
    }
  }
  return context
}
