"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export type AuthState = {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  })

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("id", userId)
      .single()

    return data as Profile | null
  }, [])

  const refreshAuth = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const profile = await fetchProfile(user.id)
      setState({
        user,
        profile,
        isLoading: false,
        isAuthenticated: true,
      })
    } else {
      setState({
        user: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [fetchProfile])

  useEffect(() => {
    refreshAuth()

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const profile = await fetchProfile(session.user.id)
        setState({
          user: session.user,
          profile,
          isLoading: false,
          isAuthenticated: true,
        })
      } else if (event === "SIGNED_OUT") {
        setState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
        })
        router.push("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile, refreshAuth, router])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
  }, [])

  const updateProfile = useCallback(
    async (data: Partial<Profile>) => {
      if (!state.user) return { error: "Not authenticated" }

      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", state.user.id)

      if (!error) {
        setState((prev) => ({
          ...prev,
          profile: prev.profile ? { ...prev.profile, ...data } : null,
        }))
      }

      return { error: error?.message }
    },
    [state.user]
  )

  return {
    ...state,
    signOut,
    updateProfile,
    refreshAuth,
  }
}
