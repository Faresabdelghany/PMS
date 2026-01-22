"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { OrganizationContext, type OrganizationWithRole } from "@/hooks/use-organization"

const ORG_STORAGE_KEY = "selected-organization-id"

type OrganizationProviderProps = {
  children: ReactNode
  initialOrganizations?: OrganizationWithRole[]
  initialOrgId?: string
}

export function OrganizationProvider({
  children,
  initialOrganizations = [],
  initialOrgId,
}: OrganizationProviderProps) {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>(initialOrganizations)
  const [organization, setOrganization] = useState<OrganizationWithRole | null>(() => {
    // Try to find initial org from initialOrgId or localStorage
    if (initialOrgId) {
      return initialOrganizations.find((o) => o.id === initialOrgId) || initialOrganizations[0] || null
    }
    return initialOrganizations[0] || null
  })
  const [isLoading, setIsLoading] = useState(!initialOrganizations.length)

  const fetchOrganizations = useCallback(async () => {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setOrganizations([])
      setOrganization(null)
      setIsLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("organization_members")
      .select(`
        role,
        organization:organizations(*)
      `)
      .eq("user_id", user.id)

    if (error) {
      console.error("Error fetching organizations:", error)
      setIsLoading(false)
      return
    }

    const orgs: OrganizationWithRole[] = data
      .filter((m) => m.organization)
      .map((m) => ({
        ...(m.organization as unknown as OrganizationWithRole),
        role: m.role as "admin" | "member",
      }))

    setOrganizations(orgs)

    // Set current organization
    if (orgs.length > 0) {
      // Try to restore from localStorage
      const storedOrgId = typeof window !== "undefined" ? localStorage.getItem(ORG_STORAGE_KEY) : null
      const storedOrg = storedOrgId ? orgs.find((o) => o.id === storedOrgId) : null
      setOrganization(storedOrg || orgs[0])
    } else {
      setOrganization(null)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!initialOrganizations.length) {
      fetchOrganizations()
    }
  }, [fetchOrganizations, initialOrganizations.length])

  // Persist selected organization
  useEffect(() => {
    if (organization && typeof window !== "undefined") {
      localStorage.setItem(ORG_STORAGE_KEY, organization.id)
    }
  }, [organization])

  const switchOrganization = useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId)
      if (org) {
        setOrganization(org)
        router.refresh()
      }
    },
    [organizations, router]
  )

  const refreshOrganizations = useCallback(async () => {
    setIsLoading(true)
    await fetchOrganizations()
  }, [fetchOrganizations])

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizations,
        isLoading,
        switchOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}
