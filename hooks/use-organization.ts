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

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider")
  }
  return context
}
