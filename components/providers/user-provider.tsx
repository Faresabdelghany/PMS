"use client"

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { UserContext, type UserContextType } from "@/hooks/use-user"
import type { Profile } from "@/lib/supabase/types"

type UserProviderProps = {
  children: ReactNode
  initialUser?: { id: string; email: string } | null
  initialProfile?: Profile | null
}

export function UserProvider({ children, initialUser = null, initialProfile = null }: UserProviderProps) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(initialUser)
  const [profile, setProfile] = useState<Profile | null>(initialProfile)
  const [isLoading, setIsLoading] = useState(!initialUser)

  const refreshProfile = useCallback(async () => {
    if (!user) return

    const supabase = createClient()
    const { data: newProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (newProfile) {
      setProfile(newProfile)
    }
  }, [user])

  useEffect(() => {
    // If we have initial user data, don't fetch again
    // initialProfile can be null for new users, but if initialUser is provided
    // we already fetched on the server and shouldn't fetch again
    if (initialUser) {
      return
    }

    const supabase = createClient()

    async function fetchUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single()

        setUser({ id: authUser.id, email: authUser.email || "" })
        setProfile(profileData || null)
        setIsLoading(false)
      } else {
        setUser(null)
        setProfile(null)
        setIsLoading(false)
      }
    }

    fetchUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (error) {
          console.error("Error fetching profile on auth change:", error)
        }

        setUser({ id: session.user.id, email: session.user.email || "" })
        setProfile(profileData || null)
        setIsLoading(false)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser, initialProfile])

  const value = useMemo<UserContextType>(
    () => ({
      user,
      profile,
      isLoading,
      refreshProfile,
    }),
    [user, profile, isLoading, refreshProfile]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
