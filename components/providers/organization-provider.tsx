"use client"

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { OrganizationContext, type OrganizationWithRole } from "@/hooks/use-organization"

const ORG_STORAGE_KEY = "selected-organization-id-v1"

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

  // Use ref for organizations lookup to stabilize switchOrganization callback
  const organizationsRef = useRef<OrganizationWithRole[]>(initialOrganizations)
  useEffect(() => {
    organizationsRef.current = organizations
  }, [organizations])

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
      let storedOrgId: string | null = null
      if (typeof window !== "undefined") {
        try {
          storedOrgId = localStorage.getItem(ORG_STORAGE_KEY)
        } catch {
          // localStorage unavailable
        }
      }
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
      try {
        localStorage.setItem(ORG_STORAGE_KEY, organization.id)
      } catch {
        // localStorage unavailable (e.g., private browsing, storage quota exceeded)
      }
    }
  }, [organization])

  // Use ref for stable callback - avoids re-renders when organizations array changes
  const switchOrganization = useCallback(
    (orgId: string) => {
      const org = organizationsRef.current.find((o) => o.id === orgId)
      if (org) {
        setOrganization(org)
        router.refresh()
      }
    },
    [router]
  )

  const refreshOrganizations = useCallback(async () => {
    setIsLoading(true)
    await fetchOrganizations()
  }, [fetchOrganizations])

  // Memoize context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
      organization,
      organizations,
      isLoading,
      switchOrganization,
      refreshOrganizations,
    }),
    [organization, organizations, isLoading, switchOrganization, refreshOrganizations]
  )

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  )
}
