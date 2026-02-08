"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import {
  signUpSchema,
  signInSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  updateProfileSchema,
  validate,
  formDataToObject,
} from "@/lib/validations"
import { rateLimiters, checkRateLimit, rateLimitError } from "@/lib/rate-limit/limiter"

export type AuthResult = {
  error?: string
  success?: boolean
}

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// Auto-create personal organization for new users
// Uses optimistic insert with retry on slug collision instead of sequential checks
export async function createPersonalOrganization(userId: string, fullName: string): Promise<{ error?: string }> {
  const adminClient = createAdminClient()

  const orgName = `${fullName}'s Workspace`
  const baseSlug = generateSlug(orgName)
  let slug = baseSlug
  let org: { id: string } | null = null
  const maxAttempts = 3

  // Optimistic insert with retry on unique constraint violation
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await adminClient
      .from("organizations")
      .insert({
        name: orgName,
        slug,
      })
      .select()
      .single()

    if (!error) {
      org = data
      break
    }

    // 23505 is PostgreSQL unique constraint violation
    if (error.code === "23505") {
      // Add random suffix for next attempt
      slug = `${baseSlug}-${crypto.randomUUID().split("-")[0]}`
      continue
    }

    // Other error, bail out
    return { error: error.message }
  }

  if (!org) {
    return { error: "Failed to create organization after multiple attempts" }
  }

  // Add user as admin
  const { error: memberError } = await adminClient
    .from("organization_members")
    .insert({
      organization_id: org.id,
      user_id: userId,
      role: "admin",
    })

  if (memberError) {
    // Rollback: delete the organization
    await adminClient.from("organizations").delete().eq("id", org.id)
    return { error: memberError.message }
  }

  return {}
}

// Sign up with email and password
export async function signUp(formData: FormData): Promise<AuthResult> {
  // Validate input first (sync operation, no await needed)
  const validation = validate(signUpSchema, formDataToObject(formData))
  if (!validation.success) {
    return { error: validation.error }
  }

  // Start parallel operations: headers for rate limiting and Supabase client creation
  const [headersList, supabase] = await Promise.all([
    headers(),
    createClient(),
  ])

  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  // Check rate limit
  const limit = await checkRateLimit(rateLimiters.auth, ip)
  if (!limit.success) {
    return rateLimitError(limit.reset)
  }

  const { email, password, fullName } = validation.data

  // Sign up with email confirmation disabled (auto-confirm)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If user is created and session exists, auto-create personal workspace
  if (data.user && data.session) {
    // Create personal organization in the background
    // Don't fail signup if org creation fails, user can create org later via onboarding
    await createPersonalOrganization(data.user.id, fullName || "My")

    // Warm cache for the new user
    const { warmUserCache } = await import("@/lib/cache")
    warmUserCache(data.user.id).catch(() => {})

    revalidatePath("/", "layout")
    redirect("/inbox")
  }

  // Fallback: if no session (email confirmation is required in Supabase settings)
  // Try to sign in the user directly
  if (data.user && !data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      return { error: signInError.message }
    }

    // Create personal organization (errors are non-fatal, user can create org later)
    await createPersonalOrganization(data.user.id, fullName || "My")

    revalidatePath("/", "layout")
    redirect("/inbox")
  }

  return { success: true }
}

// Sign in with email and password
export async function signIn(formData: FormData): Promise<AuthResult> {
  // Validate input first (sync operation, no await needed)
  const validation = validate(signInSchema, formDataToObject(formData))
  if (!validation.success) {
    return { error: validation.error }
  }

  // Start parallel operations: headers for rate limiting and Supabase client creation
  const [headersList, supabase] = await Promise.all([
    headers(),
    createClient(),
  ])

  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  // Check rate limit (fast - returns immediately if KV unavailable)
  const limit = await checkRateLimit(rateLimiters.auth, ip)
  if (!limit.success) {
    return rateLimitError(limit.reset)
  }

  const { email, password } = validation.data

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Warm the KV cache with user's dashboard data (non-blocking, best-effort)
  if (data.user) {
    const { warmUserCache } = await import("@/lib/cache")
    warmUserCache(data.user.id).catch(() => {})
  }

  // Targeted revalidation - only invalidate auth-related cache, not entire layout
  // The middleware will refresh the session, so we just need to clear stale data
  revalidatePath("/")
  redirect("/inbox")
}

// Sign in with OAuth (Google)
export async function signInWithGoogle(): Promise<void> {
  // Parallelize client creation and headers fetch
  const [supabase, headersList] = await Promise.all([
    createClient(),
    headers(),
  ])

  const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    redirect(data.url)
  }
}

// Sign out
export async function signOut(): Promise<void> {
  const supabase = await createClient()

  // Invalidate session cache before signing out
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) {
    const { invalidate } = await import("@/lib/cache")
    invalidate.session(session.user.id).catch(() => {})
  }

  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}

// Get current user
export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

// Get current user with profile
export async function getUserWithProfile() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profileError) {
    return { user, profile: null }
  }

  return { user, profile }
}

// Update user profile
export async function updateProfile(formData: FormData): Promise<AuthResult> {
  // Validate input
  const validation = validate(updateProfileSchema, formDataToObject(formData))
  if (!validation.success) {
    return { error: validation.error }
  }

  const { fullName, avatarUrl } = validation.data
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated" }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      avatar_url: avatarUrl ?? null,
    })
    .eq("id", user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  return { success: true }
}

// Reset password (send reset email)
export async function resetPassword(formData: FormData): Promise<AuthResult> {
  // Validate input
  const validation = validate(resetPasswordSchema, formDataToObject(formData))
  if (!validation.success) {
    return { error: validation.error }
  }

  const { email } = validation.data
  const supabase = await createClient()

  const headersList = await headers()
  const origin = headersList.get("origin") || process.env.NEXT_PUBLIC_SITE_URL

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

// Update password (after reset)
export async function updatePassword(formData: FormData): Promise<AuthResult> {
  // Validate input
  const validation = validate(updatePasswordSchema, formDataToObject(formData))
  if (!validation.success) {
    return { error: validation.error }
  }

  const { password } = validation.data
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/", "layout")
  redirect("/inbox")
}
