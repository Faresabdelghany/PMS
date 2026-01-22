"use client"

import { useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { UserContext, type UserContextType } from "@/hooks/use-user"
import type { Profile } from "@/lib/supabase/types"

type UserProviderProps = {
  children: ReactNode
  initialUser?: { id: string; email: string } | null
  initialProfile?: Profile | null
}

export function UserProvider({ children, initialUser = null, initialProfile = null }: UserProviderProps) {
  const [state, setState] = useState<UserContextType>({
    user: initialUser,
    profile: initialProfile,
    isLoading: !initialUser,
  })

  useEffect(() => {
    // If we have initial data, don't fetch again
    if (initialUser && initialProfile) {
      return
    }

    const supabase = createClient()

    async function fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        setState({
          user: { id: user.id, email: user.email || "" },
          profile: profile || null,
          isLoading: false,
        })
      } else {
        setState({ user: null, profile: null, isLoading: false })
      }
    }

    fetchUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (error) {
          console.error("Error fetching profile on auth change:", error)
        }

        setState({
          user: { id: session.user.id, email: session.user.email || "" },
          profile: profile || null,
          isLoading: false,
        })
      } else if (event === "SIGNED_OUT") {
        setState({ user: null, profile: null, isLoading: false })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser, initialProfile])

  return <UserContext.Provider value={state}>{children}</UserContext.Provider>
}
